import type { InventoryDirectoryData, InventoryReservationData } from '@pos/contracts';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app';
import type { AccessRepository } from '../src/modules/access/domain';
import type { AuthRepository, SessionRecord } from '../src/modules/auth/domain';
import type {
  InventoryBatchRecord,
  InventoryDirectoryRecord,
  InventoryMovementRecord,
  InventoryRepository,
  InventoryReservationRecord,
} from '../src/modules/inventory/domain';
import { InventoryService } from '../src/modules/inventory/service';
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
  businessType: 'pharmacy',
  uiMode: 'advanced',
  timezone: 'Asia/Jakarta',
};
const BRANCH = {
  id: 61,
  uuid: '0198be7c-3936-7c53-829f-e43ffb76bb19',
  code: 'SBY01',
  name: 'Surabaya Pusat',
  timezone: 'Asia/Jakarta',
  isDefault: true,
} as const;
const SESSION: SessionRecord = {
  session: {
    id: 71,
    uuid: '0198b993-11bf-71cc-be53-400c7a17ac20',
    activeBranchId: BRANCH.id,
    expiresAt: '2026-08-16T08:00:00.000Z',
  },
  user: {
    id: 41,
    uuid: '0198b992-e0b2-73df-9d33-355491a97fe7',
    email: 'owner@alpha.test',
    name: 'Alpha Owner',
  },
};
const PRODUCT = {
  id: 201,
  uuid: '0198f000-0000-7000-8000-000000000001',
  sku: 'AMOX500',
  name: 'Amoxicillin 500 mg',
  productUnitId: 211,
  productUnitUuid: '0198f000-0000-7000-8000-000000000002',
  baseUnitId: 221,
  baseUnitUuid: '0198f000-0000-7000-8000-000000000003',
  unitSymbol: 'tab',
  precision: 0,
  trackBatches: true,
  trackExpiry: true,
  status: 'active' as const,
};
const PRODUCT_UNIT = {
  id: PRODUCT.productUnitId,
  uuid: PRODUCT.productUnitUuid,
  productId: PRODUCT.id,
  productUuid: PRODUCT.uuid,
  unitUuid: PRODUCT.baseUnitUuid,
  unitSymbol: PRODUCT.unitSymbol,
  precision: 0,
  conversionNumerator: 1,
  conversionDenominator: 1,
  status: 'active' as const,
};
const DECIMAL_PRODUCT = {
  ...PRODUCT,
  id: 202,
  uuid: '0198f000-0000-7000-8000-000000000004',
  sku: 'SYRUP',
  name: 'Syrup',
  productUnitId: 212,
  productUnitUuid: '0198f000-0000-7000-8000-000000000005',
  baseUnitId: 222,
  baseUnitUuid: '0198f000-0000-7000-8000-000000000006',
  unitSymbol: 'ml',
  precision: 3,
  trackBatches: false,
  trackExpiry: false,
};
const DECIMAL_UNIT = {
  ...PRODUCT_UNIT,
  id: DECIMAL_PRODUCT.productUnitId,
  uuid: DECIMAL_PRODUCT.productUnitUuid,
  productId: DECIMAL_PRODUCT.id,
  productUuid: DECIMAL_PRODUCT.uuid,
  unitUuid: DECIMAL_PRODUCT.baseUnitUuid,
  unitSymbol: 'ml',
  precision: 2,
};
const LOCATION = {
  id: 301,
  uuid: '0198f000-0000-7000-8000-000000000007',
  warehouseId: 311,
  warehouseUuid: '0198f000-0000-7000-8000-000000000008',
  warehouseCode: 'WH01',
  branchId: BRANCH.id,
  code: 'RACK01',
  name: 'Main Rack',
  type: 'storage' as const,
  status: 'active' as const,
};
const EARLY_BATCH: InventoryBatchRecord = {
  id: 401,
  uuid: '0198f000-0000-7000-8000-000000000009',
  productId: PRODUCT.id,
  productUuid: PRODUCT.uuid,
  supplierId: null,
  supplierUuid: null,
  batchNumber: 'B-EARLY',
  receivedAt: '2026-07-01T00:00:00.000Z',
  manufacturedAt: null,
  expiresAt: '2026-09-01T00:00:00.000Z',
  unitCostMinor: 1000,
  currency: 'IDR',
  status: 'available',
};
const LATE_BATCH: InventoryBatchRecord = {
  ...EARLY_BATCH,
  id: 402,
  uuid: '0198f000-0000-7000-8000-000000000010',
  batchNumber: 'B-LATE',
  receivedAt: '2026-06-01T00:00:00.000Z',
  expiresAt: '2026-12-01T00:00:00.000Z',
};
const BASE_DIRECTORY: InventoryDirectoryRecord = {
  products: [PRODUCT, DECIMAL_PRODUCT],
  productUnits: [PRODUCT_UNIT, DECIMAL_UNIT],
  suppliers: [],
  locations: [LOCATION],
  batches: [EARLY_BATCH, LATE_BATCH],
  balances: [
    {
      id: 501,
      locationId: LOCATION.id,
      locationUuid: LOCATION.uuid,
      warehouseId: LOCATION.warehouseId,
      productId: PRODUCT.id,
      productUuid: PRODUCT.uuid,
      batchId: EARLY_BATCH.id,
      batchUuid: EARLY_BATCH.uuid,
      batchReceivedAt: EARLY_BATCH.receivedAt,
      batchExpiresAt: EARLY_BATCH.expiresAt,
      batchStatus: 'available',
      onHandMinor: 3,
      reservedMinor: 0,
    },
    {
      id: 502,
      locationId: LOCATION.id,
      locationUuid: LOCATION.uuid,
      warehouseId: LOCATION.warehouseId,
      productId: PRODUCT.id,
      productUuid: PRODUCT.uuid,
      batchId: LATE_BATCH.id,
      batchUuid: LATE_BATCH.uuid,
      batchReceivedAt: LATE_BATCH.receivedAt,
      batchExpiresAt: LATE_BATCH.expiresAt,
      batchStatus: 'available',
      onHandMinor: 5,
      reservedMinor: 0,
    },
  ],
  movements: [],
  reservations: [],
};
const REQUEST_CONTEXT = {
  tenantId: TENANT.id,
  branchId: BRANCH.id,
  actorUserId: SESSION.user.id,
  requestId: 'request-inventory',
  ipAddress: '203.0.113.10',
  userAgent: 'Vitest',
} as const;

function repository(overrides: Partial<InventoryRepository> = {}): InventoryRepository {
  return {
    loadDirectory: vi.fn(async () => BASE_DIRECTORY),
    findMovementByReference: vi.fn(async () => null),
    createBatch: vi.fn(async () => true),
    adjust: vi.fn(async () => true),
    createReservation: vi.fn(async () => true),
    releaseReservation: vi.fn(async () => true),
    ...overrides,
  };
}
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
function authRepository(activeBranchId: number | null = BRANCH.id): AuthRepository {
  return {
    findUserByEmail: vi.fn(async () => null),
    recordFailedLogin: vi.fn(async () => undefined),
    recordSuccessfulLogin: vi.fn(async () => undefined),
    findActiveSession: vi.fn(async () => ({
      ...SESSION,
      session: { ...SESSION.session, activeBranchId },
    })),
    revokeSession: vi.fn(async () => undefined),
  };
}
function accessRepository(
  permissions: readonly string[],
  hasAssignedBranch: boolean,
): AccessRepository {
  return {
    listPermissionCodes: vi.fn(async () => permissions),
    listAssignedBranches: vi.fn(async () => (hasAssignedBranch ? [BRANCH] : [])),
    findAssignedBranch: vi.fn(async () => null),
    switchSessionBranch: vi.fn(async () => false),
    recordPermissionDenied: vi.fn(async () => undefined),
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
function application(
  inventory: InventoryRepository,
  permissions: readonly string[],
  activeBranchId: number | null = BRANCH.id,
) {
  return createApp({
    tenantRepositoryFactory: () => tenantRepository(),
    authRepositoryFactory: () => authRepository(activeBranchId),
    accessRepositoryFactory: () => accessRepository(permissions, activeBranchId !== null),
    rateLimitRepositoryFactory: () => rateRepository(),
    inventoryRepositoryFactory: () => inventory,
  });
}
const COOKIE_HEADER = { Cookie: `pos_session=${'a'.repeat(43)}` };

function reservationRepository() {
  let reservation: InventoryReservationRecord | null = null;
  const inventory = repository({
    createReservation: vi.fn(async (event) => {
      reservation = {
        id: 601,
        uuid: event.targetUuid,
        productId: event.productId,
        productUuid: event.productUuid,
        requestedMinor: event.requestedMinor,
        status: 'active',
        expiresAt: event.expiresAt,
        allocations: event.allocations,
      };
      return true;
    }),
    loadDirectory: vi.fn(async () => ({
      ...BASE_DIRECTORY,
      reservations: reservation === null ? [] : [reservation],
    })),
  });
  return inventory;
}

describe('inventory engine', () => {
  it('requires stock.view and an assigned active branch for inventory reads', async () => {
    const inventory = repository();
    const denied = await application(inventory, []).request(
      'https://alpha-store.example.test/api/v1/inventory/directory',
      { headers: COOKIE_HEADER },
      environment(),
    );
    const noBranch = await application(inventory, ['stock.view'], null).request(
      'https://alpha-store.example.test/api/v1/inventory/directory',
      { headers: COOKIE_HEADER },
      environment(),
    );
    const allowed = await application(inventory, ['stock.view']).request(
      'https://alpha-store.example.test/api/v1/inventory/directory',
      { headers: COOKIE_HEADER },
      environment(),
    );
    const body = await allowed.json<{ readonly data: InventoryDirectoryData }>();

    expect(denied.status).toBe(403);
    expect(noBranch.status).toBe(409);
    expect(allowed.status).toBe(200);
    expect(body.data.products[0]).toMatchObject({ id: PRODUCT.uuid, unitSymbol: 'tab' });
  });

  it('allocates expiry-tracked stock by FEFO and splits across batches', async () => {
    const inventory = reservationRepository();
    const service = new InventoryService(inventory, () => new Date('2026-08-15T08:00:00.000Z'));

    const result = await service.createReservation(
      { productUnitId: PRODUCT_UNIT.uuid, quantity: '5', expiresInSeconds: 900 },
      REQUEST_CONTEXT,
    );

    expect(result.allocations).toEqual([
      { locationId: LOCATION.uuid, batchId: EARLY_BATCH.uuid, quantity: '3' },
      { locationId: LOCATION.uuid, batchId: LATE_BATCH.uuid, quantity: '2' },
    ]);
    expect(inventory.createReservation).toHaveBeenCalledWith(
      expect.objectContaining({
        requestedMinor: 5,
        allocations: [
          expect.objectContaining({ batchId: EARLY_BATCH.id, quantityMinor: 3 }),
          expect.objectContaining({ batchId: LATE_BATCH.id, quantityMinor: 2 }),
        ],
      }),
    );
  });

  it('allocates non-expiry batches by FIFO receipt time', async () => {
    const fifoProduct = {
      ...PRODUCT,
      id: 203,
      uuid: '0198f000-0000-7000-8000-000000000012',
      sku: 'SOAP',
      name: 'Soap',
      productUnitId: 213,
      productUnitUuid: '0198f000-0000-7000-8000-000000000013',
      trackExpiry: false,
    };
    const fifoUnit = {
      ...PRODUCT_UNIT,
      id: fifoProduct.productUnitId,
      uuid: fifoProduct.productUnitUuid,
      productId: fifoProduct.id,
      productUuid: fifoProduct.uuid,
    };
    const newerBatch = {
      ...EARLY_BATCH,
      id: 403,
      uuid: '0198f000-0000-7000-8000-000000000014',
      productId: fifoProduct.id,
      productUuid: fifoProduct.uuid,
      batchNumber: 'NEW',
      receivedAt: '2026-08-01T00:00:00.000Z',
      expiresAt: null,
    };
    const olderBatch = {
      ...newerBatch,
      id: 404,
      uuid: '0198f000-0000-7000-8000-000000000015',
      batchNumber: 'OLD',
      receivedAt: '2026-07-01T00:00:00.000Z',
    };
    let created: InventoryReservationRecord | null = null;
    const directory: InventoryDirectoryRecord = {
      ...BASE_DIRECTORY,
      products: [fifoProduct],
      productUnits: [fifoUnit],
      batches: [newerBatch, olderBatch],
      balances: [
        {
          id: 503,
          locationId: LOCATION.id,
          locationUuid: LOCATION.uuid,
          warehouseId: LOCATION.warehouseId,
          productId: fifoProduct.id,
          productUuid: fifoProduct.uuid,
          batchId: newerBatch.id,
          batchUuid: newerBatch.uuid,
          batchReceivedAt: newerBatch.receivedAt,
          batchExpiresAt: null,
          batchStatus: 'available',
          onHandMinor: 5,
          reservedMinor: 0,
        },
        {
          id: 504,
          locationId: LOCATION.id,
          locationUuid: LOCATION.uuid,
          warehouseId: LOCATION.warehouseId,
          productId: fifoProduct.id,
          productUuid: fifoProduct.uuid,
          batchId: olderBatch.id,
          batchUuid: olderBatch.uuid,
          batchReceivedAt: olderBatch.receivedAt,
          batchExpiresAt: null,
          batchStatus: 'available',
          onHandMinor: 2,
          reservedMinor: 0,
        },
      ],
      reservations: [],
    };
    const inventory = repository({
      createReservation: vi.fn(async (event) => {
        created = {
          id: 602,
          uuid: event.targetUuid,
          productId: event.productId,
          productUuid: event.productUuid,
          requestedMinor: event.requestedMinor,
          status: 'active',
          expiresAt: event.expiresAt,
          allocations: event.allocations,
        };
        return true;
      }),
      loadDirectory: vi.fn(async () => ({
        ...directory,
        reservations: created === null ? [] : [created],
      })),
    });
    const service = new InventoryService(inventory, () => new Date('2026-08-15T08:00:00.000Z'));

    const result = await service.createReservation(
      { productUnitId: fifoUnit.uuid, quantity: '3', expiresInSeconds: 900 },
      REQUEST_CONTEXT,
    );

    expect(result.allocations.map((allocation) => allocation.batchId)).toEqual([
      olderBatch.uuid,
      newerBatch.uuid,
    ]);
  });

  it('rejects reservations when sellable availability is insufficient', async () => {
    const inventory = repository();
    const service = new InventoryService(inventory, () => new Date('2026-08-15T08:00:00.000Z'));

    await expect(
      service.createReservation(
        { productUnitId: PRODUCT_UNIT.uuid, quantity: '9', expiresInSeconds: 900 },
        REQUEST_CONTEXT,
      ),
    ).rejects.toMatchObject({ status: 409, code: 'STOCK_UNAVAILABLE' });
    expect(inventory.createReservation).not.toHaveBeenCalled();
  });

  it('converts decimal quantities exactly and returns an idempotent adjustment result', async () => {
    const existingMovement: InventoryMovementRecord = {
      uuid: '0198f000-0000-7000-8000-000000000011',
      productUuid: DECIMAL_PRODUCT.uuid,
      locationUuid: LOCATION.uuid,
      batchUuid: null,
      type: 'adjustment_in',
      quantityMinor: 1250,
      balanceAfterMinor: 1250,
      reservedAfterMinor: 0,
      reason: 'Opening measured stock',
      referenceType: 'adjustment',
      referenceUuid: 'hashed-reference',
      createdAt: '2026-08-15T08:00:00.000Z',
    };
    const inventory = repository({
      adjust: vi.fn(async () => false),
      findMovementByReference: vi.fn(async () => existingMovement),
    });
    const service = new InventoryService(inventory, () => new Date('2026-08-15T08:00:00.000Z'));

    const result = await service.adjust(
      {
        productUnitId: DECIMAL_UNIT.uuid,
        locationId: LOCATION.uuid,
        batchId: null,
        quantity: '1.25',
        reason: 'Opening measured stock',
        opening: false,
      },
      'inventory-adjustment-key',
      REQUEST_CONTEXT,
    );

    expect(result).toMatchObject({ id: existingMovement.uuid, quantity: '1.25' });
    expect(inventory.adjust).toHaveBeenCalledWith(
      expect.objectContaining({ quantityMinor: 1250, batchId: null }),
    );
  });

  it('enforces batch and expiry invariants before creating stock batches', async () => {
    const inventory = repository();
    const service = new InventoryService(inventory, () => new Date('2026-08-15T08:00:00.000Z'));

    await expect(
      service.createBatch(
        {
          productId: PRODUCT.uuid,
          supplierId: null,
          batchNumber: null,
          receivedAt: '2026-08-15T08:00:00.000Z',
          manufacturedAt: null,
          expiresAt: null,
          unitCostMinor: 1000,
          currency: 'IDR',
          status: 'available',
        },
        REQUEST_CONTEXT,
      ),
    ).rejects.toMatchObject({ status: 422 });
    expect(inventory.createBatch).not.toHaveBeenCalled();
  });

  it('allows only one concurrent adjustment to consume the same available stock', async () => {
    let committed: InventoryMovementRecord | null = null;
    const inventory = repository({
      adjust: vi.fn(async (event) => {
        if (committed !== null) return false;
        committed = {
          uuid: event.targetUuid,
          productUuid: PRODUCT.uuid,
          locationUuid: LOCATION.uuid,
          batchUuid: EARLY_BATCH.uuid,
          type: 'adjustment_out',
          quantityMinor: event.quantityMinor,
          balanceAfterMinor: 1,
          reservedAfterMinor: 0,
          reason: event.reason,
          referenceType: event.referenceType,
          referenceUuid: event.referenceUuid,
          createdAt: event.occurredAt,
        };
        return true;
      }),
      loadDirectory: vi.fn(async () => ({
        ...BASE_DIRECTORY,
        movements: committed === null ? [] : [committed],
      })),
      findMovementByReference: vi.fn(async () => null),
    });
    const service = new InventoryService(inventory, () => new Date('2026-08-15T08:00:00.000Z'));
    const input = {
      productUnitId: PRODUCT_UNIT.uuid,
      locationId: LOCATION.uuid,
      batchId: EARLY_BATCH.uuid,
      quantity: '-2',
      reason: 'Concurrent damaged stock',
      opening: false,
    } as const;

    const results = await Promise.allSettled([
      service.adjust(input, 'concurrent-adjustment-a', REQUEST_CONTEXT),
      service.adjust(input, 'concurrent-adjustment-b', REQUEST_CONTEXT),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected');
    expect(rejected).toMatchObject({
      status: 'rejected',
      reason: { status: 409, code: 'INSUFFICIENT_AVAILABLE_STOCK' },
    });
  });

  it('requires sales.create for reservations and releases only active allocations', async () => {
    const inventory = reservationRepository();
    const denied = await application(inventory, ['stock.view']).request(
      'https://alpha-store.example.test/api/v1/inventory/reservations',
      {
        method: 'POST',
        headers: { ...COOKIE_HEADER, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productUnitId: PRODUCT_UNIT.uuid,
          quantity: '2',
          expiresInSeconds: 900,
        }),
      },
      environment(),
    );
    expect(denied.status).toBe(403);
    expect(inventory.createReservation).not.toHaveBeenCalled();

    const allowedApp = application(inventory, ['sales.create']);
    const created = await allowedApp.request(
      'https://alpha-store.example.test/api/v1/inventory/reservations',
      {
        method: 'POST',
        headers: { ...COOKIE_HEADER, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productUnitId: PRODUCT_UNIT.uuid,
          quantity: '2',
          expiresInSeconds: 900,
        }),
      },
      environment(),
    );
    const createdBody = await created.json<{
      readonly data: { readonly reservation: InventoryReservationData };
    }>();
    const released = await allowedApp.request(
      `https://alpha-store.example.test/api/v1/inventory/reservations/${createdBody.data.reservation.id}/release`,
      {
        method: 'PATCH',
        headers: { ...COOKIE_HEADER, 'Content-Type': 'application/json' },
        body: '{}',
      },
      environment(),
    );

    expect(created.status).toBe(201);
    expect(released.status).toBe(200);
    expect(inventory.releaseReservation).toHaveBeenCalledWith(
      expect.objectContaining({
        targetUuid: createdBody.data.reservation.id,
        allocations: expect.arrayContaining([expect.objectContaining({ batchId: EARLY_BATCH.id })]),
      }),
    );
  });
});
