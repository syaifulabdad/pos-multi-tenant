import type {
  ApiError,
  ApiSuccess,
  LocationData,
  OrganizationDirectoryData,
  WarehouseData,
} from '@pos/contracts';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app';
import type { AccessRepository } from '../src/modules/access/domain';
import type { AuthRepository, SessionRecord } from '../src/modules/auth/domain';
import type {
  LocationRecord,
  OrganizationBranchRecord,
  OrganizationDirectoryRecord,
  OrganizationRepository,
  PosTerminalRecord,
  WarehouseRecord,
} from '../src/modules/organization/domain';
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
const BRANCH: OrganizationBranchRecord = {
  id: 61,
  uuid: '0198be7c-3936-7c53-829f-e43ffb76bb19',
  code: 'SBY01',
  name: 'Surabaya Pusat',
  status: 'active',
  timezone: 'Asia/Jakarta',
  address: null,
};
const SECOND_BRANCH: OrganizationBranchRecord = {
  ...BRANCH,
  id: 62,
  uuid: '0198da7d-97dd-7a79-af70-bf9d46e5bab2',
  code: 'JKT01',
  name: 'Jakarta Pusat',
};
const WAREHOUSE: WarehouseRecord = {
  id: 81,
  uuid: '0198db81-6a0f-7874-a11d-3478dad607bb',
  branchId: BRANCH.id,
  branchUuid: BRANCH.uuid,
  code: 'WH-SBY',
  name: 'Gudang Surabaya',
  status: 'active',
  address: null,
};
const LOCATION: LocationRecord = {
  id: 91,
  uuid: '0198db82-2a96-79f7-989b-1fd6f784cc9c',
  warehouseId: WAREHOUSE.id,
  warehouseUuid: WAREHOUSE.uuid,
  code: 'RACK-A',
  name: 'Rak A',
  type: 'storage',
  status: 'active',
};
const TERMINAL: PosTerminalRecord = {
  id: 101,
  uuid: '0198db82-a188-772c-9439-61ac4b07885d',
  branchId: BRANCH.id,
  branchUuid: BRANCH.uuid,
  code: 'POS-SBY-01',
  name: 'Kasir 1',
  status: 'active',
  lastSeenAt: null,
};
const DIRECTORY: OrganizationDirectoryRecord = {
  branches: [BRANCH, SECOND_BRANCH],
  warehouses: [WAREHOUSE],
  locations: [LOCATION],
  terminals: [TERMINAL],
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

function organizationRepository(
  overrides: Partial<OrganizationRepository> = {},
): OrganizationRepository {
  return {
    loadDirectory: vi.fn(async () => DIRECTORY),
    createBranch: vi.fn(async () => true),
    updateBranch: vi.fn(async () => true),
    createWarehouse: vi.fn(async () => true),
    updateWarehouse: vi.fn(async () => true),
    createLocation: vi.fn(async () => true),
    updateLocation: vi.fn(async () => true),
    createTerminal: vi.fn(async () => true),
    updateTerminal: vi.fn(async () => true),
    ...overrides,
  };
}

function application(repository: OrganizationRepository, permissions: readonly string[]) {
  return createApp({
    tenantRepositoryFactory: () => tenantRepository(),
    authRepositoryFactory: () => authRepository(),
    accessRepositoryFactory: () => accessRepository(permissions),
    rateLimitRepositoryFactory: () => rateRepository(),
    organizationRepositoryFactory: () => repository,
  });
}

describe('organization administration', () => {
  it('requires settings.manage before loading organization data', async () => {
    const repository = organizationRepository();
    const response = await application(repository, []).request(
      'https://alpha-store.example.test/api/v1/admin/organization',
      { headers: COOKIE_HEADER },
      environment(),
    );

    expect(response.status).toBe(403);
    expect(repository.loadDirectory).not.toHaveBeenCalled();
  });

  it('lists the tenant hierarchy using only public identifiers', async () => {
    const repository = organizationRepository();
    const response = await application(repository, ['settings.manage']).request(
      'https://alpha-store.example.test/api/v1/admin/organization',
      { headers: COOKIE_HEADER },
      environment(),
    );
    const body = await response.json<ApiSuccess<OrganizationDirectoryData>>();

    expect(response.status).toBe(200);
    expect(body.data.branches[0]).toMatchObject({ id: BRANCH.uuid });
    expect(body.data.warehouses[0]).toMatchObject({
      id: WAREHOUSE.uuid,
      branchId: BRANCH.uuid,
    });
    expect(body.data.locations[0]).toMatchObject({
      id: LOCATION.uuid,
      warehouseId: WAREHOUSE.uuid,
    });
    expect(body.data.terminals[0]).toMatchObject({
      id: TERMINAL.uuid,
      branchId: BRANCH.uuid,
    });
    expect(repository.loadDirectory).toHaveBeenCalledWith(TENANT.id);
    expect(JSON.stringify(body.data)).not.toContain(`"id":${BRANCH.id}`);
  });

  it('rejects cross-tenant or unavailable branch references', async () => {
    const repository = organizationRepository();
    const response = await application(repository, ['settings.manage']).request(
      'https://alpha-store.example.test/api/v1/admin/organization/warehouses',
      {
        method: 'POST',
        headers: { ...COOKIE_HEADER, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: '0198dc86-b056-7330-aaae-7182b6e14d8f',
          code: 'WH-FOREIGN',
          name: 'Foreign Warehouse',
          address: null,
        }),
      },
      environment(),
    );

    expect(response.status).toBe(422);
    expect(repository.createWarehouse).not.toHaveBeenCalled();
  });

  it('resolves a public branch ID to a tenant-bound warehouse mutation', async () => {
    let createdWarehouse: WarehouseRecord | null = null;
    const repository = organizationRepository({
      createWarehouse: vi.fn(async (event) => {
        createdWarehouse = {
          ...WAREHOUSE,
          uuid: event.targetUuid,
          code: event.code,
          name: event.name,
        };
        return true;
      }),
      loadDirectory: vi.fn(async () => ({
        ...DIRECTORY,
        warehouses:
          createdWarehouse === null
            ? DIRECTORY.warehouses
            : [...DIRECTORY.warehouses, createdWarehouse],
      })),
    });
    const response = await application(repository, ['settings.manage']).request(
      'https://alpha-store.example.test/api/v1/admin/organization/warehouses',
      {
        method: 'POST',
        headers: { ...COOKIE_HEADER, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: BRANCH.uuid,
          code: 'WH-NEW',
          name: 'Gudang Baru',
          address: 'Jalan Contoh',
        }),
      },
      environment(),
    );
    const body = await response.json<ApiSuccess<{ warehouse: WarehouseData }>>();

    expect(response.status).toBe(201);
    expect(body.data.warehouse).toMatchObject({ branchId: BRANCH.uuid, code: 'WH-NEW' });
    expect(repository.createWarehouse).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT.id,
        actorUserId: SESSION.user.id,
        branchId: BRANCH.id,
        branchUuid: BRANCH.uuid,
      }),
    );
  });

  it('creates typed locations only inside active tenant warehouses', async () => {
    let createdLocation: LocationRecord | null = null;
    const repository = organizationRepository({
      createLocation: vi.fn(async (event) => {
        createdLocation = {
          ...LOCATION,
          uuid: event.targetUuid,
          code: event.code,
          name: event.name,
          type: event.type,
        };
        return true;
      }),
      loadDirectory: vi.fn(async () => ({
        ...DIRECTORY,
        locations:
          createdLocation === null
            ? DIRECTORY.locations
            : [...DIRECTORY.locations, createdLocation],
      })),
    });
    const response = await application(repository, ['settings.manage']).request(
      'https://alpha-store.example.test/api/v1/admin/organization/locations',
      {
        method: 'POST',
        headers: { ...COOKIE_HEADER, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouseId: WAREHOUSE.uuid,
          code: 'QUAR-01',
          name: 'Area Karantina',
          type: 'quarantine',
        }),
      },
      environment(),
    );
    const body = await response.json<ApiSuccess<{ location: LocationData }>>();

    expect(response.status).toBe(201);
    expect(body.data.location).toMatchObject({
      warehouseId: WAREHOUSE.uuid,
      type: 'quarantine',
    });
    expect(repository.createLocation).toHaveBeenCalledWith(
      expect.objectContaining({ warehouseId: WAREHOUSE.id, warehouseUuid: WAREHOUSE.uuid }),
    );
  });

  it('rejects invalid location types during input validation', async () => {
    const repository = organizationRepository();
    const response = await application(repository, ['settings.manage']).request(
      'https://alpha-store.example.test/api/v1/admin/organization/locations',
      {
        method: 'POST',
        headers: { ...COOKIE_HEADER, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouseId: WAREHOUSE.uuid,
          code: 'BAD-01',
          name: 'Bad Location',
          type: 'customer_area',
        }),
      },
      environment(),
    );

    expect(response.status).toBe(422);
    expect(repository.createLocation).not.toHaveBeenCalled();
  });

  it('protects the final active branch from being disabled', async () => {
    const repository = organizationRepository({
      loadDirectory: vi.fn(async () => ({ ...DIRECTORY, branches: [BRANCH] })),
    });
    const response = await application(repository, ['settings.manage']).request(
      `https://alpha-store.example.test/api/v1/admin/organization/branches/${BRANCH.uuid}`,
      {
        method: 'PATCH',
        headers: { ...COOKIE_HEADER, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: BRANCH.name,
          status: 'inactive',
          timezone: BRANCH.timezone,
          address: BRANCH.address,
        }),
      },
      environment(),
    );
    const body = await response.json<ApiError>();

    expect(response.status).toBe(409);
    expect(body.code).toBe('LAST_ACTIVE_BRANCH');
    expect(repository.updateBranch).not.toHaveBeenCalled();
  });
});
