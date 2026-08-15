import type { ApiError, ApiSuccess, TenantBootstrapData } from '@pos/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app';
import type { TenantLookupRepository, TenantRecord } from '../src/modules/tenants/domain';
import { locateTenant } from '../src/modules/tenants/service';
import type { WorkerBindings } from '../src/types';

const ALPHA_TENANT: TenantRecord = {
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

const BETA_TENANT: TenantRecord = {
  id: 202,
  uuid: '0198b862-62c8-7e75-8e08-c8141fd375c0',
  slug: 'beta-pharmacy',
  name: 'Beta Pharmacy',
  status: 'active',
  plan: 'advanced',
  businessType: 'pharmacy',
  uiMode: 'advanced',
  timezone: 'Asia/Makassar',
};

function createEnvironment(): WorkerBindings {
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

function createRepository(tenants: readonly TenantRecord[]) {
  const repository: TenantLookupRepository = {
    findBySlug: vi.fn(async (slug) => tenants.find((tenant) => tenant.slug === slug) ?? null),
    findByVerifiedDomain: vi.fn(async (hostname) =>
      hostname === 'pos.alpha.id'
        ? (tenants.find((tenant) => tenant.slug === 'alpha-store') ?? null)
        : null,
    ),
  };

  return repository;
}

describe('tenant hostname location', () => {
  it('extracts one normalized subdomain from the configured base domain', () => {
    expect(
      locateTenant({
        hostname: 'Alpha-Store.Example.Test.',
        baseDomain: 'example.test',
        environment: 'production',
      }),
    ).toEqual({ kind: 'slug', value: 'alpha-store' });
  });

  it('supports subdomain.localhost only outside production', () => {
    expect(
      locateTenant({
        hostname: 'alpha-store.localhost',
        baseDomain: 'example.test',
        environment: 'development',
      }),
    ).toEqual({ kind: 'slug', value: 'alpha-store' });
    expect(
      locateTenant({
        hostname: 'alpha-store.localhost',
        baseDomain: 'example.test',
        environment: 'production',
      }),
    ).toEqual({ kind: 'domain', value: 'alpha-store.localhost' });
  });

  it.each(['www', 'api', 'admin', 'app', 'support', 'help', 'billing', 'status'])(
    'rejects the reserved %s subdomain',
    (subdomain) => {
      expect(
        locateTenant({
          hostname: `${subdomain}.example.test`,
          baseDomain: 'example.test',
          environment: 'production',
        }),
      ).toBeNull();
    },
  );

  it('rejects root, nested, and IP hosts as tenant subdomains', () => {
    const input = { baseDomain: 'example.test', environment: 'production' } as const;

    expect(locateTenant({ ...input, hostname: 'example.test' })).toBeNull();
    expect(locateTenant({ ...input, hostname: 'nested.alpha.example.test' })).toBeNull();
    expect(locateTenant({ ...input, hostname: '127.0.0.1' })).toBeNull();
  });
});

describe('tenant resolver middleware', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns only public bootstrap data for the host tenant', async () => {
    const repository = createRepository([ALPHA_TENANT, BETA_TENANT]);
    const application = createApp({ tenantRepositoryFactory: () => repository });
    const response = await application.request(
      'https://alpha-store.example.test/api/v1/tenant/bootstrap?tenant_id=202',
      { headers: { 'X-Tenant-ID': '202' } },
      createEnvironment(),
    );
    const body = await response.json<ApiSuccess<TenantBootstrapData>>();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({
      id: ALPHA_TENANT.uuid,
      slug: 'alpha-store',
      name: 'Alpha Store',
      plan: 'professional',
      businessType: 'retail',
      uiMode: 'professional',
      timezone: 'Asia/Jakarta',
    });
    expect(body.data.id).not.toBe(String(ALPHA_TENANT.id));
    expect(repository.findBySlug).toHaveBeenCalledWith('alpha-store');
    expect(repository.findBySlug).not.toHaveBeenCalledWith('beta-pharmacy');
  });

  it('resolves only verified custom domains through the repository', async () => {
    const repository = createRepository([ALPHA_TENANT]);
    const application = createApp({ tenantRepositoryFactory: () => repository });
    const response = await application.request(
      'https://pos.alpha.id/api/v1/tenant/bootstrap',
      {},
      createEnvironment(),
    );

    expect(response.status).toBe(200);
    expect(repository.findByVerifiedDomain).toHaveBeenCalledWith('pos.alpha.id');
  });

  it('returns the same controlled 404 for unknown and reserved tenants', async () => {
    const repository = createRepository([]);
    const application = createApp({ tenantRepositoryFactory: () => repository });

    for (const hostname of ['unknown.example.test', 'admin.example.test']) {
      const response = await application.request(
        `https://${hostname}/api/v1/tenant/bootstrap`,
        {},
        createEnvironment(),
      );
      const body = await response.json<ApiError>();

      expect(response.status).toBe(404);
      expect(body).toMatchObject({
        success: false,
        message: 'Tenant not found',
        code: 'TENANT_NOT_FOUND',
      });
    }
  });

  it.each([
    ['suspended', 423, 'TENANT_SUSPENDED'],
    ['inactive', 403, 'TENANT_INACTIVE'],
    ['pending', 403, 'TENANT_INACTIVE'],
  ] as const)('blocks tenants with %s status', async (status, expectedStatus, expectedCode) => {
    const repository = createRepository([{ ...ALPHA_TENANT, status }]);
    const application = createApp({ tenantRepositoryFactory: () => repository });
    const response = await application.request(
      'https://alpha-store.example.test/api/v1/tenant/bootstrap',
      {},
      createEnvironment(),
    );
    const body = await response.json<ApiError>();

    expect(response.status).toBe(expectedStatus);
    expect(body.code).toBe(expectedCode);
    expect(body.request_id).toBe(response.headers.get('X-Request-ID'));
  });
});
