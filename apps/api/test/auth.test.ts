import type { ApiError, ApiSuccess, LoginData, LogoutData, SessionData } from '@pos/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app';
import type {
  AuthRepository,
  AuthUserRecord,
  FailedLoginEvent,
  SessionRecord,
} from '../src/modules/auth/domain';
import { AuthenticationService } from '../src/modules/auth/service';
import { parseLoginInput } from '../src/modules/auth/validation';
import type { RateLimitRepository } from '../src/modules/rate-limit/domain';
import type { TenantLookupRepository, TenantRecord } from '../src/modules/tenants/domain';
import { DUMMY_PASSWORD_HASH, hashPassword, sha256, verifyPassword } from '../src/security/crypto';
import type { WorkerBindings } from '../src/types';

const NOW = new Date('2026-08-15T08:00:00.000Z');
const TENANT: TenantRecord = {
  id: 101,
  uuid: '0198b862-5fd6-7a24-8f4f-5df54cb39425',
  slug: 'alpha-store',
  name: 'Alpha Store',
  status: 'active',
  plan: 'professional',
  businessType: 'retail',
  uiMode: 'professional',
  timezone: 'Asia/Jakarta',
};
const USER: AuthUserRecord = {
  id: 41,
  uuid: '0198b992-e0b2-73df-9d33-355491a97fe7',
  tenantId: TENANT.id,
  email: 'owner@alpha.test',
  name: 'Alpha Owner',
  passwordHash: DUMMY_PASSWORD_HASH,
  status: 'active',
  failedLoginAttempts: 0,
  lockedUntil: null,
};
const ACTIVE_SESSION: SessionRecord = {
  session: {
    id: 71,
    uuid: '0198b993-11bf-71cc-be53-400c7a17ac20',
    activeBranchId: null,
    expiresAt: '2026-08-15T16:00:00.000Z',
  },
  user: {
    id: USER.id,
    uuid: USER.uuid,
    email: USER.email,
    name: USER.name,
  },
};

function createEnvironment(environment: WorkerBindings['APP_ENV'] = 'test'): WorkerBindings {
  return {
    DB: {} as D1Database,
    STORAGE: {} as R2Bucket,
    CACHE: {} as KVNamespace,
    ASSETS: {} as Fetcher,
    APP_ENV: environment,
    BASE_DOMAIN: 'example.test',
    LOG_LEVEL: 'error',
  };
}

function createTenantRepository(): TenantLookupRepository {
  return {
    findBySlug: vi.fn(async (slug) => (slug === TENANT.slug ? TENANT : null)),
    findByVerifiedDomain: vi.fn(async () => null),
  };
}

function createAuthRepository(overrides: Partial<AuthRepository> = {}): AuthRepository {
  return {
    findUserByEmail: vi.fn(async () => USER),
    recordFailedLogin: vi.fn(async () => undefined),
    recordSuccessfulLogin: vi.fn(async () => undefined),
    findActiveSession: vi.fn(async () => ACTIVE_SESSION),
    revokeSession: vi.fn(async () => undefined),
    ...overrides,
  };
}

function createRateLimitRepository(): RateLimitRepository {
  return {
    consume: vi.fn(async (input) => ({
      allowed: true,
      limit: input.limit,
      remaining: input.limit - 1,
      retryAfterSeconds: input.windowSeconds,
    })),
    recordExceeded: vi.fn(async () => undefined),
  };
}

describe('password security', () => {
  it('hashes passwords with random salt and verifies without storing plaintext', async () => {
    const hash = await hashPassword('correct horse battery staple');

    expect(hash).toMatch(/^pbkdf2-sha256\$600000\$/);
    expect(hash).not.toContain('correct horse battery staple');
    await expect(verifyPassword('correct horse battery staple', hash)).resolves.toBe(true);
    await expect(verifyPassword('wrong password', hash)).resolves.toBe(false);
  });

  it('rejects malformed password hashes without throwing', async () => {
    await expect(verifyPassword('password', 'invalid-hash')).resolves.toBe(false);
  });
});

describe('authentication service', () => {
  it('creates an opaque, hashed session and an atomic success event', async () => {
    const repository = createAuthRepository();
    const service = new AuthenticationService(repository, () => NOW);
    const result = await service.login({
      tenant: TENANT,
      email: USER.email,
      password: 'not-a-real-user-password',
      requestId: 'request-login-123',
      ipAddress: '203.0.113.10',
      userAgent: 'Vitest',
    });
    const event = vi.mocked(repository.recordSuccessfulLogin).mock.calls[0]?.[0];

    expect(result.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(event?.tenantId).toBe(TENANT.id);
    expect(event?.tokenHash).toBe(await sha256(result.token));
    expect(event?.tokenHash).not.toBe(result.token);
    expect(event?.expiresAt).toBe('2026-08-15T16:00:00.000Z');
  });

  it('uses an indistinguishable error and records a security event for an unknown user', async () => {
    const repository = createAuthRepository({ findUserByEmail: vi.fn(async () => null) });
    const service = new AuthenticationService(repository, () => NOW);

    await expect(
      service.login({
        tenant: TENANT,
        email: 'unknown@alpha.test',
        password: 'incorrect-password',
        requestId: 'request-failed-123',
        ipAddress: null,
        userAgent: null,
      }),
    ).rejects.toMatchObject({ status: 401, message: 'Invalid email or password' });

    const event = vi.mocked(repository.recordFailedLogin).mock.calls[0]?.[0];
    expect(event).toMatchObject({
      tenantId: TENANT.id,
      userId: null,
      reason: 'invalid_credentials',
      incrementAttempts: false,
    } satisfies Partial<FailedLoginEvent>);
  });

  it('locks the account on the fifth failed attempt', async () => {
    const repository = createAuthRepository({
      findUserByEmail: vi.fn(async () => ({ ...USER, failedLoginAttempts: 4 })),
    });
    const service = new AuthenticationService(repository, () => NOW);

    await expect(
      service.login({
        tenant: TENANT,
        email: USER.email,
        password: 'incorrect-password',
        requestId: 'request-lock-123',
        ipAddress: null,
        userAgent: null,
      }),
    ).rejects.toMatchObject({ status: 401 });

    expect(repository.recordFailedLogin).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'account_locked',
        incrementAttempts: true,
        lockUntil: '2026-08-15T08:15:00.000Z',
      }),
    );
  });

  it('always scopes session lookup to the resolved tenant', async () => {
    const repository = createAuthRepository();
    const service = new AuthenticationService(repository, () => NOW);
    const token = 'a'.repeat(43);

    await service.authenticate(TENANT.id, token);

    expect(repository.findActiveSession).toHaveBeenCalledWith(
      TENANT.id,
      await sha256(token),
      NOW.toISOString(),
    );
  });
});

describe('authentication HTTP API', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('validates login input before accessing credentials', () => {
    expect(() => parseLoginInput({ email: 'invalid', password: 'short' })).toThrowError(
      expect.objectContaining({ status: 422, code: 'VALIDATION_FAILED' }),
    );
  });

  it('sets a host-only HTTP-only session cookie after login', async () => {
    const authRepository = createAuthRepository();
    const application = createApp({
      tenantRepositoryFactory: () => createTenantRepository(),
      authRepositoryFactory: () => authRepository,
      rateLimitRepositoryFactory: () => createRateLimitRepository(),
    });
    const response = await application.request(
      'https://alpha-store.example.test/api/v1/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': '202' },
        body: JSON.stringify({
          email: USER.email,
          password: 'not-a-real-user-password',
          tenant_id: 202,
        }),
      },
      createEnvironment('production'),
    );
    const body = await response.json<ApiSuccess<LoginData>>();
    const cookie = response.headers.get('Set-Cookie');

    expect(response.status).toBe(200);
    expect(body.data.user).toEqual({ id: USER.uuid, email: USER.email, name: USER.name });
    expect(cookie).toContain('__Host-pos_session=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).not.toContain('Domain=');
    expect(authRepository.findUserByEmail).toHaveBeenCalledWith(TENANT.id, USER.email);
  });

  it('rejects session endpoints without a cookie', async () => {
    const application = createApp({
      tenantRepositoryFactory: () => createTenantRepository(),
      authRepositoryFactory: () => createAuthRepository(),
    });
    const response = await application.request(
      'https://alpha-store.example.test/api/v1/auth/me',
      {},
      createEnvironment(),
    );
    const body = await response.json<ApiError>();

    expect(response.status).toBe(401);
    expect(body.code).toBe('UNAUTHORIZED');
  });

  it('cannot reuse a Tenant A session on a Tenant B host', async () => {
    const betaTenant = {
      ...TENANT,
      id: 202,
      uuid: '0198ba09-da4d-7d2f-9c9c-ab008e210331',
      slug: 'beta-store',
      name: 'Beta Store',
    };
    const tenantRepository: TenantLookupRepository = {
      findBySlug: vi.fn(async (slug) => (slug === betaTenant.slug ? betaTenant : null)),
      findByVerifiedDomain: vi.fn(async () => null),
    };
    const authRepository = createAuthRepository({
      findActiveSession: vi.fn(async () => null),
    });
    const application = createApp({
      tenantRepositoryFactory: () => tenantRepository,
      authRepositoryFactory: () => authRepository,
    });
    const response = await application.request(
      'https://beta-store.example.test/api/v1/auth/me',
      { headers: { Cookie: `pos_session=${'a'.repeat(43)}` } },
      createEnvironment(),
    );

    expect(response.status).toBe(401);
    expect(authRepository.findActiveSession).toHaveBeenCalledWith(
      betaTenant.id,
      await sha256('a'.repeat(43)),
      expect.any(String),
    );
  });

  it('returns the authenticated user and revokes logout atomically', async () => {
    const authRepository = createAuthRepository();
    const application = createApp({
      tenantRepositoryFactory: () => createTenantRepository(),
      authRepositoryFactory: () => authRepository,
    });
    const environment = createEnvironment();
    const headers = { Cookie: `pos_session=${'a'.repeat(43)}` };

    const meResponse = await application.request(
      'https://alpha-store.example.test/api/v1/auth/me',
      { headers },
      environment,
    );
    const meBody = await meResponse.json<ApiSuccess<SessionData>>();
    expect(meResponse.status).toBe(200);
    expect(meBody.data.user.id).toBe(USER.uuid);

    const logoutResponse = await application.request(
      'https://alpha-store.example.test/api/v1/auth/logout',
      { method: 'POST', headers },
      environment,
    );
    const logoutBody = await logoutResponse.json<ApiSuccess<LogoutData>>();
    expect(logoutBody.data.loggedOut).toBe(true);
    expect(authRepository.revokeSession).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT.id, userId: USER.id, sessionId: 71 }),
    );
    expect(logoutResponse.headers.get('Set-Cookie')).toContain('pos_session=;');
  });
});
