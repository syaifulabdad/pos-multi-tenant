import type { AccessContextData, ApiError, ApiSuccess, BranchData } from '@pos/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app';
import type { AccessRepository, BranchAccess } from '../src/modules/access/domain';
import { AccessService } from '../src/modules/access/service';
import type { AuthRepository, SessionRecord } from '../src/modules/auth/domain';
import type { RateLimitRepository } from '../src/modules/rate-limit/domain';
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
const BRANCH_A: BranchAccess = {
  id: 11,
  uuid: '0198be7c-3936-7c53-829f-e43ffb76bb19',
  code: 'SBY01',
  name: 'Surabaya Pusat',
  timezone: 'Asia/Jakarta',
  isDefault: true,
};
const BRANCH_B: BranchAccess = {
  id: 12,
  uuid: '0198be7c-3e86-7224-92cc-eaee122cbd0e',
  code: 'SBY02',
  name: 'Surabaya Timur',
  timezone: 'Asia/Jakarta',
  isDefault: false,
};
const SESSION: SessionRecord = {
  session: {
    id: 71,
    uuid: '0198b993-11bf-71cc-be53-400c7a17ac20',
    activeBranchId: null,
    expiresAt: '2026-08-15T16:00:00.000Z',
  },
  user: {
    id: 41,
    uuid: '0198b992-e0b2-73df-9d33-355491a97fe7',
    email: 'owner@alpha.test',
    name: 'Alpha Owner',
  },
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

function authRepository(session: SessionRecord = SESSION): AuthRepository {
  return {
    findUserByEmail: vi.fn(async () => null),
    recordFailedLogin: vi.fn(async () => undefined),
    recordSuccessfulLogin: vi.fn(async () => undefined),
    findActiveSession: vi.fn(async () => session),
    revokeSession: vi.fn(async () => undefined),
  };
}

function rateLimitRepository(): RateLimitRepository {
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

function accessRepository(overrides: Partial<AccessRepository> = {}): AccessRepository {
  return {
    listPermissionCodes: vi.fn(async () => ['branch.switch', 'product.view']),
    listAssignedBranches: vi.fn(async () => [BRANCH_A, BRANCH_B]),
    findAssignedBranch: vi.fn(async (_tenantId, _userId, branchUuid) =>
      branchUuid === BRANCH_B.uuid ? BRANCH_B : null,
    ),
    switchSessionBranch: vi.fn(async () => true),
    recordPermissionDenied: vi.fn(async () => undefined),
    ...overrides,
  };
}

const REQUEST_HEADERS = { Cookie: `pos_session=${'a'.repeat(43)}` };

describe('access context service', () => {
  it('selects the server-defined default when the session has no branch', async () => {
    const repository = accessRepository();
    const service = new AccessService(repository);
    const access = await service.resolve({
      tenantId: TENANT.id,
      user: SESSION.user,
      session: SESSION.session,
    });

    expect(access.branch).toEqual(BRANCH_A);
    expect(access.permissions).toEqual(['branch.switch', 'product.view']);
    expect(repository.listAssignedBranches).toHaveBeenCalledWith(TENANT.id, SESSION.user.id);
  });

  it('uses the persisted session branch when it remains assigned', async () => {
    const repository = accessRepository();
    const access = await new AccessService(repository).resolve({
      tenantId: TENANT.id,
      user: SESSION.user,
      session: { ...SESSION.session, activeBranchId: BRANCH_B.id },
    });

    expect(access.branch).toEqual(BRANCH_B);
  });

  it('does not accept a stale session branch outside current assignments', async () => {
    const repository = accessRepository();
    const service = new AccessService(repository);
    const access = await service.resolve({
      tenantId: TENANT.id,
      user: SESSION.user,
      session: { ...SESSION.session, activeBranchId: 999 },
    });

    expect(access.branch).toEqual(BRANCH_A);
    expect(access.branches).not.toContainEqual(expect.objectContaining({ id: 999 }));
  });

  it('requires an explicit selection when multiple branches have no default', async () => {
    const repository = accessRepository({
      listAssignedBranches: vi.fn(async () => [{ ...BRANCH_A, isDefault: false }, BRANCH_B]),
    });
    const access = await new AccessService(repository).resolve({
      tenantId: TENANT.id,
      user: SESSION.user,
      session: SESSION.session,
    });

    expect(access.branch).toBeNull();
  });

  it('rejects a branch UUID that is not assigned to the tenant user', async () => {
    const repository = accessRepository({ findAssignedBranch: vi.fn(async () => null) });
    const service = new AccessService(repository);

    await expect(
      service.switchBranch(
        { tenantId: TENANT.id, user: SESSION.user, session: SESSION.session },
        '0198beac-4e48-7031-8899-0bc638aafbad',
        'request-branch-denied',
        { ipAddress: null, userAgent: null },
      ),
    ).rejects.toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });
    expect(repository.switchSessionBranch).not.toHaveBeenCalled();
  });
});

describe('access HTTP API', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns public permission and assigned-branch context', async () => {
    const repository = accessRepository();
    const application = createApp({
      tenantRepositoryFactory: () => tenantRepository(),
      authRepositoryFactory: () => authRepository(),
      accessRepositoryFactory: () => repository,
      rateLimitRepositoryFactory: () => rateLimitRepository(),
    });
    const response = await application.request(
      'https://alpha-store.example.test/api/v1/access',
      { headers: { ...REQUEST_HEADERS, 'X-Branch-ID': String(BRANCH_B.id) } },
      environment(),
    );
    const body = await response.json<ApiSuccess<AccessContextData>>();

    expect(response.status).toBe(200);
    expect(body.data.permissions).toEqual(['branch.switch', 'product.view']);
    expect(body.data.activeBranch?.id).toBe(BRANCH_A.uuid);
    expect(body.data.branches[0]).toEqual({
      id: BRANCH_A.uuid,
      code: BRANCH_A.code,
      name: BRANCH_A.name,
      timezone: BRANCH_A.timezone,
      isDefault: true,
    });
    expect(JSON.stringify(body.data)).not.toContain(`"id":${BRANCH_A.id}`);
  });

  it('switches only to an assigned branch using its public ID', async () => {
    const repository = accessRepository();
    const application = createApp({
      tenantRepositoryFactory: () => tenantRepository(),
      authRepositoryFactory: () => authRepository(),
      accessRepositoryFactory: () => repository,
      rateLimitRepositoryFactory: () => rateLimitRepository(),
    });
    const response = await application.request(
      'https://alpha-store.example.test/api/v1/access/branch',
      {
        method: 'POST',
        headers: { ...REQUEST_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId: BRANCH_B.uuid, tenant_id: 999 }),
      },
      environment(),
    );
    const body = await response.json<ApiSuccess<BranchData>>();

    expect(response.status).toBe(200);
    expect(body.data.id).toBe(BRANCH_B.uuid);
    expect(repository.findAssignedBranch).toHaveBeenCalledWith(
      TENANT.id,
      SESSION.user.id,
      BRANCH_B.uuid,
    );
    expect(repository.switchSessionBranch).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT.id,
        userId: SESSION.user.id,
        sessionId: SESSION.session.id,
        branch: BRANCH_B,
      }),
    );
  });

  it('blocks branch switching without backend permission and records a security event', async () => {
    const repository = accessRepository({
      listPermissionCodes: vi.fn(async () => ['branch.view']),
    });
    const application = createApp({
      tenantRepositoryFactory: () => tenantRepository(),
      authRepositoryFactory: () => authRepository(),
      accessRepositoryFactory: () => repository,
      rateLimitRepositoryFactory: () => rateLimitRepository(),
    });
    const response = await application.request(
      'https://alpha-store.example.test/api/v1/access/branch',
      {
        method: 'POST',
        headers: { ...REQUEST_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId: BRANCH_B.uuid }),
      },
      environment(),
    );
    const body = await response.json<ApiError>();

    expect(response.status).toBe(403);
    expect(body.code).toBe('PERMISSION_DENIED');
    expect(repository.findAssignedBranch).not.toHaveBeenCalled();
    expect(repository.recordPermissionDenied).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT.id,
        userId: SESSION.user.id,
        permission: 'branch.switch',
      }),
    );
  });

  it('returns 403 for a cross-tenant or unassigned branch without leaking its existence', async () => {
    const repository = accessRepository({ findAssignedBranch: vi.fn(async () => null) });
    const application = createApp({
      tenantRepositoryFactory: () => tenantRepository(),
      authRepositoryFactory: () => authRepository(),
      accessRepositoryFactory: () => repository,
      rateLimitRepositoryFactory: () => rateLimitRepository(),
    });
    const response = await application.request(
      'https://alpha-store.example.test/api/v1/access/branch',
      {
        method: 'POST',
        headers: { ...REQUEST_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId: '0198bf00-621e-7290-988d-3374e97235f8' }),
      },
      environment(),
    );

    expect(response.status).toBe(403);
    await expect(response.json<ApiError>()).resolves.toMatchObject({
      message: 'Permission denied',
      code: 'PERMISSION_DENIED',
    });
  });
});
