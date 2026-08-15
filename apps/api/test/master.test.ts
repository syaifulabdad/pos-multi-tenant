import type {
  ApiError,
  ApiSuccess,
  MasterDirectoryData,
  ProductData,
  ProductPriceData,
  ProductUnitData,
  TenantSettingsData,
} from '@pos/contracts';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app';
import type { AccessRepository } from '../src/modules/access/domain';
import type { TenantSettingsRepository } from '../src/modules/admin/tenant-settings';
import type { AuthRepository, SessionRecord } from '../src/modules/auth/domain';
import type {
  BrandRecord,
  CategoryRecord,
  CustomerRecord,
  MasterDirectoryRecord,
  MasterRepository,
  ProductPriceRecord,
  ProductRecord,
  ProductUnitRecord,
  SupplierRecord,
  UnitRecord,
} from '../src/modules/master/domain';
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
const CATEGORY: CategoryRecord = {
  id: 201,
  uuid: '0198e000-0000-7000-8000-000000000001',
  parentId: null,
  parentUuid: null,
  code: 'MEDICINE',
  name: 'Medicine',
  description: null,
  status: 'active',
};
const BRAND: BrandRecord = {
  id: 202,
  uuid: '0198e000-0000-7000-8000-000000000002',
  code: 'GENERIC',
  name: 'Generic',
  description: null,
  status: 'active',
};
const UNIT: UnitRecord = {
  id: 203,
  uuid: '0198e000-0000-7000-8000-000000000003',
  code: 'TABLET',
  name: 'Tablet',
  symbol: 'tab',
  precision: 0,
  status: 'active',
};
const BOX_UNIT: UnitRecord = {
  id: 204,
  uuid: '0198e000-0000-7000-8000-000000000004',
  code: 'BOX',
  name: 'Box',
  symbol: 'box',
  precision: 0,
  status: 'active',
};
const PRODUCT: ProductRecord = {
  id: 205,
  uuid: '0198e000-0000-7000-8000-000000000005',
  categoryId: CATEGORY.id,
  categoryUuid: CATEGORY.uuid,
  brandId: BRAND.id,
  brandUuid: BRAND.uuid,
  baseUnitId: UNIT.id,
  baseUnitUuid: UNIT.uuid,
  sku: 'PARA500',
  name: 'Paracetamol 500mg',
  description: null,
  type: 'stock',
  status: 'active',
  trackBatches: true,
  trackExpiry: true,
  allowDecimal: false,
};
const BASE_PRODUCT_UNIT: ProductUnitRecord = {
  id: 206,
  uuid: '0198e000-0000-7000-8000-000000000006',
  productId: PRODUCT.id,
  productUuid: PRODUCT.uuid,
  unitId: UNIT.id,
  unitUuid: UNIT.uuid,
  conversionNumerator: 1,
  conversionDenominator: 1,
  barcode: '899000000001',
  isBase: true,
  isSaleUnit: true,
  isPurchaseUnit: true,
  status: 'active',
};
const PRICE: ProductPriceRecord = {
  id: 207,
  uuid: '0198e000-0000-7000-8000-000000000007',
  productUnitId: BASE_PRODUCT_UNIT.id,
  productUnitUuid: BASE_PRODUCT_UNIT.uuid,
  branchId: null,
  branchUuid: null,
  amountMinor: 2500,
  currency: 'IDR',
  status: 'active',
  validFrom: '2026-08-15T08:00:00.000Z',
  validTo: null,
};
const SUPPLIER: SupplierRecord = {
  id: 208,
  uuid: '0198e000-0000-7000-8000-000000000008',
  code: 'SUP-01',
  name: 'Supplier One',
  contactName: null,
  phone: null,
  email: null,
  address: null,
  taxId: null,
  status: 'active',
};
const CUSTOMER: CustomerRecord = {
  id: 209,
  uuid: '0198e000-0000-7000-8000-000000000009',
  code: 'CUS-01',
  name: 'Customer One',
  type: 'individual',
  phone: null,
  email: null,
  address: null,
  status: 'active',
};
const DIRECTORY: MasterDirectoryRecord = {
  categories: [CATEGORY],
  brands: [BRAND],
  units: [UNIT, BOX_UNIT],
  products: [PRODUCT],
  productUnits: [BASE_PRODUCT_UNIT],
  prices: [PRICE],
  suppliers: [SUPPLIER],
  customers: [CUSTOMER],
  branches: [
    {
      id: 61,
      uuid: '0198be7c-3936-7c53-829f-e43ffb76bb19',
      code: 'SBY01',
      name: 'Surabaya Pusat',
      status: 'active',
    },
  ],
};
const ASSIGNED_BRANCH = {
  id: 61,
  uuid: '0198be7c-3936-7c53-829f-e43ffb76bb19',
  code: 'SBY01',
  name: 'Surabaya Pusat',
  timezone: 'Asia/Jakarta',
  isDefault: true,
} as const;
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
    listAssignedBranches: vi.fn(async () => [ASSIGNED_BRANCH]),
    findAssignedBranch: vi.fn(async () => null),
    switchSessionBranch: vi.fn(async () => false),
    recordPermissionDenied: vi.fn(async () => undefined),
  };
}
function masterRepository(overrides: Partial<MasterRepository> = {}): MasterRepository {
  return {
    loadDirectory: vi.fn(async () => DIRECTORY),
    createCategory: vi.fn(async () => true),
    updateCategory: vi.fn(async () => true),
    createBrand: vi.fn(async () => true),
    updateBrand: vi.fn(async () => true),
    createUnit: vi.fn(async () => true),
    updateUnit: vi.fn(async () => true),
    createProduct: vi.fn(async () => true),
    updateProduct: vi.fn(async () => true),
    createProductUnit: vi.fn(async () => true),
    updateProductUnit: vi.fn(async () => true),
    setProductPrice: vi.fn(async () => true),
    createSupplier: vi.fn(async () => true),
    updateSupplier: vi.fn(async () => true),
    createCustomer: vi.fn(async () => true),
    updateCustomer: vi.fn(async () => true),
    ...overrides,
  };
}
function application(
  master: MasterRepository,
  permissions: readonly string[],
  tenantSettings?: TenantSettingsRepository,
) {
  return createApp({
    tenantRepositoryFactory: () => tenantRepository(),
    authRepositoryFactory: () => authRepository(),
    accessRepositoryFactory: () => accessRepository(permissions),
    rateLimitRepositoryFactory: () => rateRepository(),
    masterRepositoryFactory: () => master,
    ...(tenantSettings === undefined
      ? {}
      : { tenantSettingsRepositoryFactory: () => tenantSettings }),
  });
}

describe('master data administration', () => {
  it('enforces product.view before returning the tenant master directory', async () => {
    const repository = masterRepository();
    const denied = await application(repository, []).request(
      'https://alpha-store.example.test/api/v1/master/directory',
      { headers: COOKIE_HEADER },
      environment(),
    );
    expect(denied.status).toBe(403);
    expect(repository.loadDirectory).not.toHaveBeenCalled();

    const response = await application(repository, ['product.view']).request(
      'https://alpha-store.example.test/api/v1/master/directory',
      { headers: COOKIE_HEADER },
      environment(),
    );
    const body = await response.json<ApiSuccess<MasterDirectoryData>>();
    expect(response.status).toBe(200);
    expect(body.data.products[0]).toMatchObject({
      id: PRODUCT.uuid,
      baseUnitId: UNIT.uuid,
      units: [{ id: BASE_PRODUCT_UNIT.uuid, unitId: UNIT.uuid }],
      prices: [{ id: PRICE.uuid }],
    });
    expect(JSON.stringify(body.data)).not.toContain(`"id":${PRODUCT.id}`);
  });

  it('filters branch-scoped prices and branch metadata by user assignment', async () => {
    const unassignedBranch = {
      id: 62,
      uuid: '0198e000-0000-7000-8000-000000000010',
      code: 'JKT01',
      name: 'Jakarta',
      status: 'active' as const,
    };
    const hiddenPrice: ProductPriceRecord = {
      ...PRICE,
      id: 210,
      uuid: '0198e000-0000-7000-8000-000000000011',
      branchId: unassignedBranch.id,
      branchUuid: unassignedBranch.uuid,
    };
    const repository = masterRepository({
      loadDirectory: vi.fn(async () => ({
        ...DIRECTORY,
        branches: [...DIRECTORY.branches, unassignedBranch],
        prices: [PRICE, hiddenPrice],
      })),
    });
    const response = await application(repository, ['product.view']).request(
      'https://alpha-store.example.test/api/v1/master/directory',
      { headers: COOKIE_HEADER },
      environment(),
    );
    const body = await response.json<ApiSuccess<MasterDirectoryData>>();

    expect(response.status).toBe(200);
    expect(body.data.branches.map((branch) => branch.id)).toEqual([ASSIGNED_BRANCH.uuid]);
    expect(body.data.products[0]?.prices.map((price) => price.id)).toEqual([PRICE.uuid]);
  });

  it('creates a product and its base unit using tenant-bound references', async () => {
    let createdProduct: ProductRecord | null = null;
    let createdBaseUnit: ProductUnitRecord | null = null;
    const repository = masterRepository({
      createProduct: vi.fn(async (event) => {
        createdProduct = {
          ...PRODUCT,
          uuid: event.targetUuid,
          sku: event.sku,
          name: event.name,
        };
        createdBaseUnit = {
          ...BASE_PRODUCT_UNIT,
          uuid: event.baseProductUnitUuid,
          productUuid: event.targetUuid,
          barcode: event.barcode,
        };
        return true;
      }),
      loadDirectory: vi.fn(async () => ({
        ...DIRECTORY,
        products:
          createdProduct === null ? DIRECTORY.products : [...DIRECTORY.products, createdProduct],
        productUnits:
          createdBaseUnit === null
            ? DIRECTORY.productUnits
            : [...DIRECTORY.productUnits, createdBaseUnit],
      })),
    });
    const response = await application(repository, ['product.create']).request(
      'https://alpha-store.example.test/api/v1/master/products',
      {
        method: 'POST',
        headers: { ...COOKIE_HEADER, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: 'AMOX500',
          name: 'Amoxicillin 500mg',
          description: null,
          categoryId: CATEGORY.uuid,
          brandId: BRAND.uuid,
          baseUnitId: UNIT.uuid,
          type: 'stock',
          trackBatches: true,
          trackExpiry: true,
          allowDecimal: false,
          barcode: '899000000002',
        }),
      },
      environment(),
    );
    const body = await response.json<ApiSuccess<{ product: ProductData }>>();

    expect(response.status).toBe(201);
    expect(body.data.product.sku).toBe('AMOX500');
    expect(body.data.product.units).toEqual(
      expect.arrayContaining([expect.objectContaining({ isBase: true })]),
    );
    expect(repository.createProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT.id,
        categoryId: CATEGORY.id,
        brandId: BRAND.id,
        baseUnitId: UNIT.id,
      }),
    );
  });

  it('validates batch/expiry and decimal-unit product invariants', async () => {
    const repository = masterRepository();
    const response = await application(repository, ['product.create']).request(
      'https://alpha-store.example.test/api/v1/master/products',
      {
        method: 'POST',
        headers: { ...COOKIE_HEADER, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: 'INVALID01',
          name: 'Invalid Product',
          categoryId: null,
          brandId: null,
          baseUnitId: UNIT.uuid,
          type: 'stock',
          trackBatches: false,
          trackExpiry: true,
          allowDecimal: true,
          barcode: null,
        }),
      },
      environment(),
    );

    expect(response.status).toBe(422);
    expect(repository.createProduct).not.toHaveBeenCalled();
  });

  it('reduces rational multi-unit conversions before persistence', async () => {
    let created: ProductUnitRecord | null = null;
    const repository = masterRepository({
      createProductUnit: vi.fn(async (event) => {
        created = {
          ...BASE_PRODUCT_UNIT,
          id: 300,
          uuid: event.targetUuid,
          unitId: event.unitId,
          unitUuid: event.unitUuid,
          isBase: false,
          conversionNumerator: event.conversionNumerator,
          conversionDenominator: event.conversionDenominator,
        };
        return true;
      }),
      loadDirectory: vi.fn(async () => ({
        ...DIRECTORY,
        productUnits:
          created === null ? DIRECTORY.productUnits : [...DIRECTORY.productUnits, created],
      })),
    });
    const response = await application(repository, ['product.create']).request(
      'https://alpha-store.example.test/api/v1/master/product-units',
      {
        method: 'POST',
        headers: { ...COOKIE_HEADER, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: PRODUCT.uuid,
          unitId: BOX_UNIT.uuid,
          conversionNumerator: 20,
          conversionDenominator: 2,
          barcode: '899000000010',
          isSaleUnit: true,
          isPurchaseUnit: true,
        }),
      },
      environment(),
    );
    const body = await response.json<ApiSuccess<{ productUnit: ProductUnitData }>>();

    expect(response.status).toBe(201);
    expect(body.data.productUnit).toMatchObject({
      conversionNumerator: 10,
      conversionDenominator: 1,
    });
    expect(repository.createProductUnit).toHaveBeenCalledWith(
      expect.objectContaining({ productId: PRODUCT.id, unitId: BOX_UNIT.id }),
    );
  });

  it('protects the immutable base product-unit conversion', async () => {
    const repository = masterRepository();
    const response = await application(repository, ['product.update']).request(
      `https://alpha-store.example.test/api/v1/master/product-units/${BASE_PRODUCT_UNIT.uuid}`,
      {
        method: 'PATCH',
        headers: { ...COOKIE_HEADER, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversionNumerator: 2,
          conversionDenominator: 1,
          barcode: BASE_PRODUCT_UNIT.barcode,
          isSaleUnit: true,
          isPurchaseUnit: true,
          status: 'active',
        }),
      },
      environment(),
    );
    const body = await response.json<ApiError>();

    expect(response.status).toBe(409);
    expect(body.code).toBe('BASE_PRODUCT_UNIT_PROTECTED');
    expect(repository.updateProductUnit).not.toHaveBeenCalled();
  });

  it('creates immutable price history entries for global or active branch scopes', async () => {
    let created: ProductPriceRecord | null = null;
    const repository = masterRepository({
      setProductPrice: vi.fn(async (event) => {
        created = {
          ...PRICE,
          uuid: event.targetUuid,
          amountMinor: event.amountMinor,
          branchId: event.branchId,
          branchUuid: event.branchUuid,
        };
        return true;
      }),
      loadDirectory: vi.fn(async () => ({
        ...DIRECTORY,
        prices: created === null ? DIRECTORY.prices : [created, ...DIRECTORY.prices],
      })),
    });
    const response = await application(repository, ['product.update']).request(
      'https://alpha-store.example.test/api/v1/master/prices',
      {
        method: 'POST',
        headers: { ...COOKIE_HEADER, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productUnitId: BASE_PRODUCT_UNIT.uuid,
          branchId: DIRECTORY.branches[0]?.uuid,
          amountMinor: 2750,
          currency: 'IDR',
        }),
      },
      environment(),
    );
    const body = await response.json<ApiSuccess<{ price: ProductPriceData }>>();

    expect(response.status).toBe(201);
    expect(body.data.price).toMatchObject({
      amountMinor: 2750,
      branchId: DIRECTORY.branches[0]?.uuid,
    });
    expect(repository.setProductPrice).toHaveBeenCalledWith(
      expect.objectContaining({
        productUnitId: BASE_PRODUCT_UNIT.id,
        branchId: DIRECTORY.branches[0]?.id,
      }),
    );
  });

  it('rejects prices for tenant-local branches not assigned to the user', async () => {
    const unassignedBranch = {
      id: 62,
      uuid: '0198e000-0000-7000-8000-000000000010',
      code: 'JKT01',
      name: 'Jakarta',
      status: 'active' as const,
    };
    const repository = masterRepository({
      loadDirectory: vi.fn(async () => ({
        ...DIRECTORY,
        branches: [...DIRECTORY.branches, unassignedBranch],
      })),
    });
    const response = await application(repository, ['product.update']).request(
      'https://alpha-store.example.test/api/v1/master/prices',
      {
        method: 'POST',
        headers: { ...COOKIE_HEADER, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productUnitId: BASE_PRODUCT_UNIT.uuid,
          branchId: unassignedBranch.uuid,
          amountMinor: 2750,
          currency: 'IDR',
        }),
      },
      environment(),
    );

    expect(response.status).toBe(404);
    expect(repository.setProductPrice).not.toHaveBeenCalled();
  });

  it('uses separate purchase and sales permissions for supplier and customer creation', async () => {
    const repository = masterRepository({
      createSupplier: vi.fn(async () => false),
      createCustomer: vi.fn(async () => false),
    });
    const supplierDenied = await application(repository, ['sales.create']).request(
      'https://alpha-store.example.test/api/v1/master/suppliers',
      {
        method: 'POST',
        headers: { ...COOKIE_HEADER, 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'SUP-02', name: 'Supplier Two' }),
      },
      environment(),
    );
    const customerDenied = await application(repository, ['purchase.create']).request(
      'https://alpha-store.example.test/api/v1/master/customers',
      {
        method: 'POST',
        headers: { ...COOKIE_HEADER, 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'CUS-02', name: 'Customer Two', type: 'individual' }),
      },
      environment(),
    );
    expect(supplierDenied.status).toBe(403);
    expect(customerDenied.status).toBe(403);
    expect(repository.createSupplier).not.toHaveBeenCalled();
    expect(repository.createCustomer).not.toHaveBeenCalled();
  });

  it('strictly updates presentation settings without allowing slug or plan changes', async () => {
    const settings: TenantSettingsRepository = { update: vi.fn(async () => true) };
    const app = application(masterRepository(), ['settings.manage'], settings);
    const rejected = await app.request(
      'https://alpha-store.example.test/api/v1/admin/tenant',
      {
        method: 'PATCH',
        headers: { ...COOKIE_HEADER, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Alpha Pharmacy',
          businessType: 'pharmacy',
          uiMode: 'advanced',
          timezone: 'Asia/Jakarta',
          slug: 'attempted-override',
          plan: 'enterprise',
        }),
      },
      environment(),
    );
    expect(rejected.status).toBe(422);
    expect(settings.update).not.toHaveBeenCalled();

    const response = await app.request(
      'https://alpha-store.example.test/api/v1/admin/tenant',
      {
        method: 'PATCH',
        headers: { ...COOKIE_HEADER, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Alpha Pharmacy',
          businessType: 'pharmacy',
          uiMode: 'advanced',
          timezone: 'Asia/Jakarta',
        }),
      },
      environment(),
    );
    const body = await response.json<ApiSuccess<TenantSettingsData>>();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      id: TENANT.uuid,
      slug: TENANT.slug,
      plan: TENANT.plan,
      name: 'Alpha Pharmacy',
    });
    expect(settings.update).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT.id }));
  });
});
