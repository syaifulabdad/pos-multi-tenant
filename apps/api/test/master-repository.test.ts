import { describe, expect, it } from 'vitest';

import { D1TenantSettingsRepository } from '../src/modules/admin/tenant-settings';
import type {
  CreateCategoryEvent,
  CreateProductEvent,
  SetProductPriceEvent,
} from '../src/modules/master/domain';
import { D1MasterRepository } from '../src/modules/master/repository';

interface RecordedStatement {
  readonly sql: string;
  values: readonly unknown[];
}

function recordingDatabase() {
  const prepared: RecordedStatement[] = [];
  const batches: RecordedStatement[][] = [];
  const database = {
    prepare(sql: string) {
      const record: RecordedStatement = { sql, values: [] };
      prepared.push(record);
      const statement = {
        bind(...values: unknown[]) {
          record.values = values;
          return statement;
        },
        async all() {
          return { results: [], success: true, meta: {} };
        },
      };
      return statement;
    },
    async batch(statements: unknown[]) {
      batches.push(
        statements.map(
          (statement) =>
            prepared.find((entry) => entry === statement) ?? (statement as RecordedStatement),
        ),
      );
      return statements.map(() => ({ success: true, results: [], meta: { changes: 1 } }));
    },
  };

  return {
    database: database as unknown as D1Database,
    prepared,
    batches,
  };
}

const mutationContext = {
  tenantId: 101,
  actorUserId: 41,
  requestId: 'request-master-repository',
  occurredAt: '2026-08-15T08:00:00.000Z',
  ipAddress: '203.0.113.10',
  userAgent: 'Vitest',
} as const;

describe('D1 master repository tenant isolation and auditing', () => {
  it('binds the resolved tenant to every directory query', async () => {
    const recording = recordingDatabase();
    const repository = new D1MasterRepository(recording.database);

    await repository.loadDirectory(mutationContext.tenantId);

    expect(recording.prepared).toHaveLength(9);
    for (const statement of recording.prepared) {
      expect(statement.values).toEqual([mutationContext.tenantId]);
      expect(statement.sql).toContain('tenant_id = ?1');
    }
  });

  it('creates a category and its audit record in one tenant-bound batch', async () => {
    const recording = recordingDatabase();
    const repository = new D1MasterRepository(recording.database);
    const event: CreateCategoryEvent = {
      ...mutationContext,
      targetUuid: '0198e000-0000-7000-8000-000000000001',
      parentId: null,
      parentUuid: null,
      code: 'MED',
      name: 'Medicines',
      description: null,
    };

    await expect(repository.createCategory(event)).resolves.toBe(true);

    expect(recording.batches).toHaveLength(1);
    expect(recording.prepared).toHaveLength(2);
    expect(recording.prepared[0]?.sql).toContain('INSERT INTO categories');
    expect(recording.prepared[0]?.values).toContain(mutationContext.tenantId);
    expect(recording.prepared[1]?.sql).toContain('INSERT INTO audit_logs');
    expect(recording.prepared[1]?.sql).toContain(
      'WHERE target.tenant_id = ?1 AND target.uuid = ?6',
    );
    expect(recording.prepared[1]?.values.slice(0, 3)).toEqual([
      mutationContext.tenantId,
      mutationContext.actorUserId,
      mutationContext.requestId,
    ]);
  });

  it('creates a product, its base unit, and its audit atomically with tenant guards', async () => {
    const recording = recordingDatabase();
    const repository = new D1MasterRepository(recording.database);
    const event: CreateProductEvent = {
      ...mutationContext,
      targetUuid: '0198e000-0000-7000-8000-000000000002',
      baseProductUnitUuid: '0198e000-0000-7000-8000-000000000003',
      categoryId: 11,
      categoryUuid: '0198e000-0000-7000-8000-000000000004',
      brandId: 12,
      brandUuid: '0198e000-0000-7000-8000-000000000005',
      baseUnitId: 13,
      baseUnitUuid: '0198e000-0000-7000-8000-000000000006',
      sku: 'AMOX500',
      name: 'Amoxicillin 500 mg',
      description: null,
      type: 'stock',
      trackBatches: true,
      trackExpiry: true,
      allowDecimal: false,
      barcode: '899000000001',
    };

    await expect(repository.createProduct(event)).resolves.toBe(true);

    expect(recording.batches).toHaveLength(1);
    expect(recording.prepared).toHaveLength(3);
    expect(recording.prepared[0]?.sql).toContain('INSERT INTO products');
    expect(recording.prepared[1]?.sql).toContain('INSERT INTO product_units');
    expect(recording.prepared[1]?.sql).toContain('WHERE p.tenant_id = ?2 AND p.uuid = ?3');
    expect(recording.prepared[2]?.sql).toContain('INSERT INTO audit_logs');
    expect(recording.prepared[2]?.sql).toContain('FROM products target');
  });

  it('guards price superseding and insertion by tenant-local active resources', async () => {
    const recording = recordingDatabase();
    const repository = new D1MasterRepository(recording.database);
    const event: SetProductPriceEvent = {
      ...mutationContext,
      targetUuid: '0198e000-0000-7000-8000-000000000007',
      productUnitId: 21,
      productUnitUuid: '0198e000-0000-7000-8000-000000000008',
      branchId: 31,
      branchUuid: '0198e000-0000-7000-8000-000000000009',
      amountMinor: 25_000,
      currency: 'IDR',
    };

    await expect(repository.setProductPrice(event)).resolves.toBe(true);

    expect(recording.batches).toHaveLength(1);
    expect(recording.prepared).toHaveLength(3);
    expect(recording.prepared[0]?.sql).toContain('WHERE tenant_id = ?2');
    expect(recording.prepared[0]?.sql).toContain('pu.tenant_id = ?2');
    expect(recording.prepared[0]?.sql).toContain('b.tenant_id = ?2');
    expect(recording.prepared[1]?.sql).toContain('pu.tenant_id = ?2');
    expect(recording.prepared[1]?.sql).toContain('b.tenant_id = ?2');
    expect(recording.prepared[2]?.sql).toContain('FROM product_prices target');
    expect(recording.prepared[2]?.values.slice(0, 3)).toEqual([
      mutationContext.tenantId,
      mutationContext.actorUserId,
      mutationContext.requestId,
    ]);
  });

  it('updates tenant settings and writes the audit in the same tenant-bound batch', async () => {
    const recording = recordingDatabase();
    const repository = new D1TenantSettingsRepository(recording.database);

    await expect(
      repository.update({
        tenantId: mutationContext.tenantId,
        tenantUuid: '0198e000-0000-7000-8000-000000000010',
        actorUserId: mutationContext.actorUserId,
        requestId: mutationContext.requestId,
        input: {
          name: 'Alpha Pharmacy',
          businessType: 'pharmacy',
          uiMode: 'advanced',
          timezone: 'Asia/Jakarta',
        },
        before: { name: 'Alpha Store' },
        occurredAt: mutationContext.occurredAt,
        ipAddress: mutationContext.ipAddress,
        userAgent: mutationContext.userAgent,
      }),
    ).resolves.toBe(true);

    expect(recording.batches).toHaveLength(1);
    expect(recording.prepared).toHaveLength(2);
    expect(recording.prepared[0]?.sql).toContain('UPDATE tenants');
    expect(recording.prepared[0]?.sql).toContain('WHERE id = ?6 AND uuid = ?7');
    expect(recording.prepared[1]?.sql).toContain('INSERT INTO audit_logs');
    expect(recording.prepared[1]?.sql).toContain(
      'FROM tenants target WHERE target.id = ?1 AND target.uuid = ?4',
    );
    expect(recording.prepared[1]?.values.slice(0, 3)).toEqual([
      mutationContext.tenantId,
      mutationContext.actorUserId,
      mutationContext.requestId,
    ]);
  });
});
