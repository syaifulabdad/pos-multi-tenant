import type { ApiError, ApiSuccess, SessionListData, SessionRevokeData } from '@pos/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app';
import type { AuthRepository, SessionRecord } from '../src/modules/auth/domain';
import type { RateLimitRepository, RateLimitResult } from '../src/modules/rate-limit/domain';
import { RateLimitService } from '../src/modules/rate-limit/service';
import type {
  ManagedSessionRecord,
  SessionManagementRepository,
} from '../src/modules/sessions/domain';
import type { TenantLookupRepository, TenantRecord } from '../src/modules/tenants/domain';
import type { WorkerBindings } from '../src/types';

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
const CURRENT_SESSION: SessionRecord = {
  session: {
    id: 71,
    uuid: '0198b993-11bf-71cc-be53-400c7a17ac20',
    activeBranchId: null,
    expiresAt: '2026-08-16T08:00:00.000Z',
  },
  user: {
    id: 41,
    uuid: '0198b992-e0b2-73df-9d33-355491a97fe7',
    email: 'owner@alpha.test',
    name: 'Alpha Owner',
  },
};
const OTHER_SESSION: ManagedSessionRecord = {
  id: 72,
  uuid: '0198c488-ac20-7899-a0bb-f1fdfe937cd1',
  createdAt: '2026-08-15T07:00:00.000Z',
  lastSeenAt: '2026-08-15T07:30:00.000Z',
  expiresAt: '2026-08-16T07:00:00.000Z',
  userAgent: 'Other Browser',
};

function environment(): WorkerBindings {
  return {
    DB: {} as D1Database,
    STORAGE: {} as R2Bucket,
    CACHE: {} as KVNamespace,
    ASSETS: {} as Fetcher,
    APP_ENV: 'test',
    BASE_DOMAIN: 'example.test',
    LOG_LEVEL: 'error',
  };
}

function tenantRepository(): TenantLookupRepository {
  return {
    findBySlug: vi.fn(async (slug) => (slug === TENANT.slug ? TENANT : null)),
    findByVerifiedDomain: vi.fn(async () => null),
  };
}

function authRepository(): AuthRepository {
  return {
    findUserByEmail: vi.fn(async () => null),
    recordFailedLogin: vi.fn(async () => undefined),
    recordSuccessfulLogin: vi.fn(async () => undefined),
    findActiveSession: vi.fn(async () => CURRENT_SESSION),
    revokeSession: vi.fn(async () => undefined),
  };
}

function allowedRateRepository(): RateLimitRepository {
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

function sessionRepository(
  overrides: Partial<SessionManagementRepository> = {},
): SessionManagementRepository {
  const currentRecord: ManagedSessionRecord = {
    id: CURRENT_SESSION.session.id,
    uuid: CURRENT_SESSION.session.uuid,
    createdAt: '2026-08-15T06:00:00.000Z',
    lastSeenAt: '2026-08-15T08:00:00.000Z',
    expiresAt: CURRENT_SESSION.session.expiresAt,
    userAgent: 'Current Browser',
  };
  return {
    listActiveSessions: vi.fn(async () => [currentRecord, OTHER_SESSION]),
    findOwnedActiveSession: vi.fn(async (_tenantId, _userId, uuid) =>
      uuid === OTHER_SESSION.uuid
        ? OTHER_SESSION
        : uuid === currentRecord.uuid
          ? currentRecord
          : null,
    ),
    revokeOwnedSession: vi.fn(async () => true),
    ...overrides,
  };
}

const COOKIE_HEADER = { Cookie: `pos_session=${'a'.repeat(43)}` };

describe('distributed rate limiting', () => {
  it('hashes scope identities and records a security event when denied', async () => {
    const denied: RateLimitResult = {
      allowed: false,
      limit: 10,
      remaining: 0,
      retryAfterSeconds: 37,
    };
    const repository: RateLimitRepository = {
      consume: vi.fn(async () => denied),
      recordExceeded: vi.fn(async () => undefined),
    };
    const service = new RateLimitService(repository, () => new Date('2026-08-15T08:00:00Z'));

    await expect(
      service.enforce('auth.login', [{ scope: 'ip', limit: 10, windowSeconds: 60 }], {
        tenantId: TENANT.id,
        userId: null,
        requestId: 'request-rate-limit',
        ipAddress: '203.0.113.10',
        userAgent: 'Vitest',
      }),
    ).rejects.toMatchObject({ status: 429, code: 'RATE_LIMITED', retryAfterSeconds: 37 });

    const consumed = vi.mocked(repository.consume).mock.calls[0]?.[0];
    expect(consumed?.keyHash).not.toContain('203.0.113.10');
    expect(repository.recordExceeded).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT.id,
        category: 'auth.login',
        scope: 'ip',
      }),
    );
  });

  it('returns standard 429 and retry headers before password verification', async () => {
    const rateRepository: RateLimitRepository = {
      consume: vi.fn(async () => ({
        allowed: false,
        limit: 10,
        remaining: 0,
        retryAfterSeconds: 42,
      })),
      recordExceeded: vi.fn(async () => undefined),
    };
    const auth = authRepository();
    const application = createApp({
      tenantRepositoryFactory: () => tenantRepository(),
      authRepositoryFactory: () => auth,
      rateLimitRepositoryFactory: () => rateRepository,
    });
    const response = await application.request(
      'https://alpha-store.example.test/api/v1/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.10' },
        body: JSON.stringify({ email: 'owner@alpha.test', password: 'incorrect-password' }),
      },
      environment(),
    );
    const body = await response.json<ApiError>();

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('42');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(body.code).toBe('RATE_LIMITED');
    expect(auth.findUserByEmail).not.toHaveBeenCalled();
  });
});

describe('session and device management', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists only public session metadata and marks the current session', async () => {
    const sessions = sessionRepository();
    const application = createApp({
      tenantRepositoryFactory: () => tenantRepository(),
      authRepositoryFactory: () => authRepository(),
      rateLimitRepositoryFactory: () => allowedRateRepository(),
      sessionManagementRepositoryFactory: () => sessions,
    });
    const response = await application.request(
      'https://alpha-store.example.test/api/v1/auth/sessions',
      { headers: COOKIE_HEADER },
      environment(),
    );
    const body = await response.json<ApiSuccess<SessionListData>>();

    expect(response.status).toBe(200);
    expect(body.data.sessions).toHaveLength(2);
    expect(body.data.sessions[0]).toMatchObject({
      id: CURRENT_SESSION.session.uuid,
      current: true,
      userAgent: 'Current Browser',
    });
    expect(JSON.stringify(body.data)).not.toContain('token');
    expect(sessions.listActiveSessions).toHaveBeenCalledWith(
      TENANT.id,
      CURRENT_SESSION.user.id,
      expect.any(String),
    );
  });

  it('revokes another owned session without clearing the current cookie', async () => {
    const sessions = sessionRepository();
    const application = createApp({
      tenantRepositoryFactory: () => tenantRepository(),
      authRepositoryFactory: () => authRepository(),
      rateLimitRepositoryFactory: () => allowedRateRepository(),
      sessionManagementRepositoryFactory: () => sessions,
    });
    const response = await application.request(
      `https://alpha-store.example.test/api/v1/auth/sessions/${OTHER_SESSION.uuid}`,
      { method: 'DELETE', headers: COOKIE_HEADER },
      environment(),
    );
    const body = await response.json<ApiSuccess<SessionRevokeData>>();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ revoked: true, current: false });
    expect(response.headers.get('Set-Cookie')).toBeNull();
    expect(sessions.revokeOwnedSession).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT.id,
        userId: CURRENT_SESSION.user.id,
        targetSessionId: OTHER_SESSION.id,
      }),
    );
  });

  it('returns 404 if a concurrent request wins the revocation race', async () => {
    const sessions = sessionRepository({
      revokeOwnedSession: vi.fn(async () => false),
    });
    const application = createApp({
      tenantRepositoryFactory: () => tenantRepository(),
      authRepositoryFactory: () => authRepository(),
      rateLimitRepositoryFactory: () => allowedRateRepository(),
      sessionManagementRepositoryFactory: () => sessions,
    });
    const response = await application.request(
      `https://alpha-store.example.test/api/v1/auth/sessions/${OTHER_SESSION.uuid}`,
      { method: 'DELETE', headers: COOKIE_HEADER },
      environment(),
    );

    expect(response.status).toBe(404);
    await expect(response.json<ApiError>()).resolves.toMatchObject({
      code: 'SESSION_NOT_FOUND',
      message: 'Session not found',
    });
  });

  it('clears the cookie when the current session is revoked', async () => {
    const sessions = sessionRepository();
    const application = createApp({
      tenantRepositoryFactory: () => tenantRepository(),
      authRepositoryFactory: () => authRepository(),
      rateLimitRepositoryFactory: () => allowedRateRepository(),
      sessionManagementRepositoryFactory: () => sessions,
    });
    const response = await application.request(
      `https://alpha-store.example.test/api/v1/auth/sessions/${CURRENT_SESSION.session.uuid}`,
      { method: 'DELETE', headers: COOKIE_HEADER },
      environment(),
    );
    const body = await response.json<ApiSuccess<SessionRevokeData>>();

    expect(body.data.current).toBe(true);
    expect(response.headers.get('Set-Cookie')).toContain('pos_session=;');
  });

  it('returns the same 404 for a foreign or unknown session ID', async () => {
    const sessions = sessionRepository({
      findOwnedActiveSession: vi.fn(async () => null),
    });
    const application = createApp({
      tenantRepositoryFactory: () => tenantRepository(),
      authRepositoryFactory: () => authRepository(),
      rateLimitRepositoryFactory: () => allowedRateRepository(),
      sessionManagementRepositoryFactory: () => sessions,
    });
    const response = await application.request(
      'https://alpha-store.example.test/api/v1/auth/sessions/0198c55c-a851-7b53-a074-a29814bb70a8',
      { method: 'DELETE', headers: COOKIE_HEADER },
      environment(),
    );

    expect(response.status).toBe(404);
    await expect(response.json<ApiError>()).resolves.toMatchObject({
      code: 'SESSION_NOT_FOUND',
      message: 'Session not found',
    });
  });
});
