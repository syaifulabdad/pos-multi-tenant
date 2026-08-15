import { describe, expect, it } from 'vitest';

import type {
  AdjustInventoryEvent,
  CreateReservationEvent,
  ReservationAllocationRecord,
} from '../src/modules/inventory/domain';
import { D1InventoryRepository } from '../src/modules/inventory/repository';

interface RecordedStatement {
  readonly sql: string;
  values: readonly unknown[];
}
function recordingDatabase() {
  const prepared: RecordedStatement[] = [];
  const batches: readonly unknown[][] = [];
  const mutableBatches = batches as unknown[][];
  const database = {
    prepare(sql: string) {
      const record: RecordedStatement = { sql, values: [] };
      prepared.push(record);
      const statement = {
        bind(...values: unknown[]) {
          record.values = values;
          return statement;
        },
      };
      return statement;
    },
    async batch(statements: unknown[]) {
      mutableBatches.push(statements);
      return statements.map(() => ({ success: true, results: [], meta: { changes: 1 } }));
    },
  };
  return { database: database as unknown as D1Database, prepared, batches };
}

const context = {
  tenantId: 101,
  branchId: 61,
  actorUserId: 41,
  requestId: 'request-inventory-repository',
  occurredAt: '2026-08-15T08:00:00.000Z',
  ipAddress: '203.0.113.10',
  userAgent: 'Vitest',
} as const;
const allocation: ReservationAllocationRecord = {
  warehouseId: 301,
  locationId: 302,
  locationUuid: '0198f000-0000-7000-8000-000000000001',
  batchId: 401,
  batchUuid: '0198f000-0000-7000-8000-000000000002',
  quantityMinor: 3,
};

describe('D1 inventory concurrency and audit guards', () => {
  it('atomically rejects an adjustment below reserved stock and deduplicates its reference', async () => {
    const recording = recordingDatabase();
    const repository = new D1InventoryRepository(recording.database);
    const event: AdjustInventoryEvent = {
      ...context,
      targetUuid: '0198f000-0000-7000-8000-000000000003',
      referenceUuid: 'hashed-idempotency-reference',
      warehouseId: allocation.warehouseId,
      locationId: allocation.locationId,
      locationUuid: allocation.locationUuid,
      productId: 201,
      productUuid: '0198f000-0000-7000-8000-000000000004',
      batchId: allocation.batchId,
      batchUuid: allocation.batchUuid,
      quantityMinor: -2,
      reason: 'Damaged stock',
      referenceType: 'adjustment',
    };

    await expect(repository.adjust(event)).resolves.toBe(true);

    expect(recording.batches).toHaveLength(1);
    expect(recording.prepared).toHaveLength(3);
    expect(recording.prepared[0]?.sql).toContain('on_hand_minor + ?1 >= reserved_minor');
    expect(recording.prepared[0]?.sql).toContain('NOT EXISTS');
    expect(recording.prepared[0]?.values).toContain(event.referenceUuid);
    expect(recording.prepared[1]?.sql).toContain('INSERT INTO stock_movements');
    expect(recording.prepared[1]?.sql).toContain('changes() = 1');
    expect(recording.prepared[2]?.sql).toContain('INSERT INTO audit_logs');
    expect(recording.prepared[2]?.sql).toContain('FROM stock_movements target');
  });

  it('uses conditional balance updates and a failing quantity check for all-or-nothing reservations', async () => {
    const recording = recordingDatabase();
    const repository = new D1InventoryRepository(recording.database);
    const event: CreateReservationEvent = {
      ...context,
      targetUuid: '0198f000-0000-7000-8000-000000000005',
      productId: 201,
      productUuid: '0198f000-0000-7000-8000-000000000004',
      requestedMinor: 3,
      expiresAt: '2026-08-15T08:15:00.000Z',
      allocations: [allocation],
    };

    await expect(repository.createReservation(event)).resolves.toBe(true);

    expect(recording.batches).toHaveLength(1);
    expect(recording.prepared).toHaveLength(4);
    expect(recording.prepared[1]?.sql).toContain('on_hand_minor - reserved_minor >= ?1');
    expect(recording.prepared[2]?.sql).toContain('CASE WHEN changes() = 1 THEN ?8 ELSE 0 END');
    expect(recording.prepared[3]?.sql).toContain('INSERT INTO audit_logs');
    expect(recording.prepared[3]?.sql).toContain('FROM inventory_reservations target');
  });
});
