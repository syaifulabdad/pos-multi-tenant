import type {
  AdminUserData,
  ApiError,
  ApiSuccess,
  SecurityEventListData,
  UserDirectoryData,
} from '@pos/contracts';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app';
import type { AccessRepository } from '../src/modules/access/domain';
import type {
  AdminBranchRecord,
  AdminRepository,
  AdminRoleRecord,
  AdminUserRecord,
} from '../src/modules/admin/domain';
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
const SESSION: SessionRecord = {
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
const ROLE: AdminRoleRecord = {
  id: 51,
  uuid: '0198c11b-aa99-7334-9d51-598c00e7fbde',
  code: 'manager',
  name: 'Manager',
  description: null,
  isSystem: false,
  isActive: true,
  permissions: ['user.manage'],
};
const BRANCH: AdminBranchRecord = {
  id: 61,
  uuid: '0198be7c-3936-7c53-829f-e43ffb76bb19',
  code: 'SBY01',
  name: 'Surabaya Pusat',
};
const OTHER_USER: AdminUserRecord = {
  id: 42,
  uuid: '0198c8b1-2c0b-71f0-b255-f760dd171104',
  email: 'manager@alpha.test',
  name: 'Manager User',
  status: 'active',
  roles: [ROLE],
  branches: [BRANCH],
  createdAt: '2026-08-15T08:00:00.000Z',
  lastLoginAt: null,
};
const COOKIE_HEADER = { Cookie: `pos_session=${'a'.repeat(43)}` };

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
    findActiveSession: vi.fn(async () => SESSION),
    revokeSession: vi.fn(async () => undefined),
  };
}

function rateRepository(): RateLimitRepository {
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

function accessRepository(permissions: readonly string[]): AccessRepository {
  return {
    listPermissionCodes: vi.fn(async () => permissions),
    listAssignedBranches: vi.fn(async () => []),
    findAssignedBranch: vi.fn(async () => null),
    switchSessionBranch: vi.fn(async () => false),
    recordPermissionDenied: vi.fn(async () => undefined),
  };
}

function adminRepository(overrides: Partial<AdminRepository> = {}): AdminRepository {
  return {
    loadUserDirectory: vi.fn(async () => ({
      users: [OTHER_USER],
      roles: [ROLE],
      branches: [BRANCH],
    })),
    loadRoleDirectory: vi.fn(async () => ({
      roles: [ROLE],
      permissions: [{ id: 1, code: 'user.manage', description: 'Manage users' }],
    })),
    findUser: vi.fn(async (_tenantId, uuid) => (uuid === OTHER_USER.uuid ? OTHER_USER : null)),
    findRole: vi.fn(async (_tenantId, uuid) => (uuid === ROLE.uuid ? ROLE : null)),
    createUser: vi.fn(async () => true),
    updateUser: vi.fn(async () => true),
    createRole: vi.fn(async () => true),
    updateRole: vi.fn(async () => true),
    listSecurityEvents: vi.fn(async () => []),
    ...overrides,
  };
}

function application(admin: AdminRepository, permissions: readonly string[]) {
  return createApp({
    tenantRepositoryFactory: () => tenantRepository(),
    authRepositoryFactory: () => authRepository(),
    accessRepositoryFactory: () => accessRepository(permissions),
    rateLimitRepositoryFactory: () => rateRepository(),
    adminRepositoryFactory: () => admin,
  });
}

describe('tenant administration', () => {
  it('enforces user.manage on the backend before loading directory data', async () => {
    const admin = adminRepository();
    const response = await application(admin, []).request(
      'https://alpha-store.example.test/api/v1/admin/users',
      { headers: COOKIE_HEADER },
      environment(),
    );

    expect(response.status).toBe(403);
    expect(admin.loadUserDirectory).not.toHaveBeenCalled();
  });

  it('lists only public tenant user, role, and branch identifiers', async () => {
    const admin = adminRepository();
    const response = await application(admin, ['user.manage']).request(
      'https://alpha-store.example.test/api/v1/admin/users',
      { headers: COOKIE_HEADER },
      environment(),
    );
    const body = await response.json<ApiSuccess<UserDirectoryData>>();

    expect(response.status).toBe(200);
    expect(body.data.users[0]).toMatchObject({
      id: OTHER_USER.uuid,
      email: OTHER_USER.email,
      roles: [{ id: ROLE.uuid }],
      branches: [{ id: BRANCH.uuid }],
    });
    expect(JSON.stringify(body.data)).not.toContain('password');
    expect(admin.loadUserDirectory).toHaveBeenCalledWith(TENANT.id);
  });

  it('hashes the initial password and binds assignments to available tenant records', async () => {
    let created: Parameters<AdminRepository['createUser']>[0] | undefined;
    let createdUser: AdminUserRecord | null = null;
    const admin = adminRepository({
      createUser: vi.fn(async (event) => {
        created = event;
        createdUser = {
          ...OTHER_USER,
          uuid: event.targetUuid,
          email: event.email,
          name: event.name,
        };
        return true;
      }),
      findUser: vi.fn(async (_tenantId, uuid) => (createdUser?.uuid === uuid ? createdUser : null)),
    });
    const response = await application(admin, ['user.manage']).request(
      'https://alpha-store.example.test/api/v1/admin/users',
      {
        method: 'POST',
        headers: { ...COOKIE_HEADER, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'new.manager@alpha.test',
          name: 'New Manager',
          password: 'a-secure-initial-password',
          roleIds: [ROLE.uuid],
          branchIds: [BRANCH.uuid],
        }),
      },
      environment(),
    );
    const body = await response.json<ApiSuccess<{ user: AdminUserData }>>();

    expect(response.status).toBe(201);
    expect(body.data.user.email).toBe('new.manager@alpha.test');
    expect(created?.passwordHash).toMatch(/^pbkdf2-sha256\$600000\$/);
    expect(created?.passwordHash).not.toContain('a-secure-initial-password');
    expect(created).toMatchObject({
      tenantId: TENANT.id,
      actorUserId: SESSION.user.id,
      roleIds: [ROLE.id],
      branchIds: [BRANCH.id],
    });
  });

  it('rejects assignment identifiers that are not available in the tenant', async () => {
    const admin = adminRepository();
    const response = await application(admin, ['user.manage']).request(
      'https://alpha-store.example.test/api/v1/admin/users',
      {
        method: 'POST',
        headers: { ...COOKIE_HEADER, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'new.manager@alpha.test',
          name: 'New Manager',
          password: 'a-secure-initial-password',
          roleIds: ['0198cab0-1628-77d5-ad10-c6180cae3b81'],
          branchIds: [BRANCH.uuid],
        }),
      },
      environment(),
    );

    expect(response.status).toBe(422);
    expect(admin.createUser).not.toHaveBeenCalled();
  });

  it('prevents administrators from changing their own access through user management', async () => {
    const admin = adminRepository();
    const response = await application(admin, ['user.manage']).request(
      `https://alpha-store.example.test/api/v1/admin/users/${SESSION.user.uuid}`,
      {
        method: 'PATCH',
        headers: { ...COOKIE_HEADER, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Changed Owner',
          status: 'disabled',
          roleIds: [ROLE.uuid],
          branchIds: [BRANCH.uuid],
        }),
      },
      environment(),
    );
    const body = await response.json<ApiError>();

    expect(response.status).toBe(409);
    expect(body.code).toBe('SELF_MANAGEMENT_NOT_ALLOWED');
    expect(admin.updateUser).not.toHaveBeenCalled();
  });

  it('updates another tenant user and forwards disabled status for atomic session revocation', async () => {
    let updatedUser = OTHER_USER;
    const admin = adminRepository({
      updateUser: vi.fn(async (event) => {
        updatedUser = { ...OTHER_USER, name: event.name, status: event.status };
        return true;
      }),
      findUser: vi.fn(async (_tenantId, uuid) => (uuid === OTHER_USER.uuid ? updatedUser : null)),
    });
    const response = await application(admin, ['user.manage']).request(
      `https://alpha-store.example.test/api/v1/admin/users/${OTHER_USER.uuid}`,
      {
        method: 'PATCH',
        headers: { ...COOKIE_HEADER, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Disabled Manager',
          status: 'disabled',
          roleIds: [ROLE.uuid],
          branchIds: [BRANCH.uuid],
        }),
      },
      environment(),
    );
    const body = await response.json<ApiSuccess<{ user: AdminUserData }>>();

    expect(response.status).toBe(200);
    expect(body.data.user.status).toBe('disabled');
    expect(admin.updateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT.id,
        targetId: OTHER_USER.id,
        status: 'disabled',
      }),
    );
  });

  it('enforces role.manage and resolves only catalogued permissions when creating roles', async () => {
    let createdRole: AdminRoleRecord | null = null;
    const admin = adminRepository({
      createRole: vi.fn(async (event) => {
        createdRole = {
          ...ROLE,
          uuid: event.targetUuid,
          code: event.code,
          name: event.name,
          permissions: event.permissionCodes,
        };
        return true;
      }),
      findRole: vi.fn(async (_tenantId, uuid) => (createdRole?.uuid === uuid ? createdRole : null)),
    });
    const denied = await application(admin, ['user.manage']).request(
      'https://alpha-store.example.test/api/v1/admin/roles',
      {
        method: 'POST',
        headers: { ...COOKIE_HEADER, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: 'floor_manager',
          name: 'Floor Manager',
          permissionCodes: ['user.manage'],
        }),
      },
      environment(),
    );
    expect(denied.status).toBe(403);

    const response = await application(admin, ['role.manage']).request(
      'https://alpha-store.example.test/api/v1/admin/roles',
      {
        method: 'POST',
        headers: { ...COOKIE_HEADER, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: 'floor_manager',
          name: 'Floor Manager',
          permissionCodes: ['user.manage'],
        }),
      },
      environment(),
    );

    expect(response.status).toBe(201);
    expect(admin.createRole).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT.id, permissionIds: [1] }),
    );
  });

  it('requires settings.manage and safely parses tenant security-event metadata', async () => {
    const admin = adminRepository({
      listSecurityEvents: vi.fn(async () => [
        {
          eventType: 'permission_denied',
          severity: 'warning',
          requestId: 'request-security-event',
          userUuid: OTHER_USER.uuid,
          userEmail: OTHER_USER.email,
          metadataJson: '{"permission":"role.manage"}',
          ipAddress: '203.0.113.10',
          userAgent: 'Vitest',
          createdAt: '2026-08-15T08:00:00.000Z',
        },
      ]),
    });
    const denied = await application(admin, ['user.manage']).request(
      'https://alpha-store.example.test/api/v1/admin/security-events',
      { headers: COOKIE_HEADER },
      environment(),
    );
    expect(denied.status).toBe(403);

    const response = await application(admin, ['settings.manage']).request(
      'https://alpha-store.example.test/api/v1/admin/security-events?limit=10',
      { headers: COOKIE_HEADER },
      environment(),
    );
    const body = await response.json<ApiSuccess<SecurityEventListData>>();
    expect(response.status).toBe(200);
    expect(body.data.events[0]).toMatchObject({
      type: 'permission_denied',
      user: { id: OTHER_USER.uuid },
      metadata: { permission: 'role.manage' },
    });
    expect(admin.listSecurityEvents).toHaveBeenLastCalledWith(TENANT.id, 10);
  });
});
