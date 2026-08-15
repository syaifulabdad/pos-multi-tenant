import type { WorkerBindings } from '../../types';
import type {
  AdjustInventoryEvent,
  CreateInventoryBatchEvent,
  CreateReservationEvent,
  InventoryBalanceRecord,
  InventoryBatchRecord,
  InventoryBatchStatus,
  InventoryDirectoryRecord,
  InventoryLocationRecord,
  InventoryMovementRecord,
  InventoryMovementType,
  InventoryProductRecord,
  InventoryProductUnitRecord,
  InventoryRepository,
  InventorySupplierRecord,
  InventoryReservationRecord,
  InventoryReservationStatus,
  ReleaseReservationEvent,
  ReservationAllocationRecord,
} from './domain';

interface ProductRow {
  readonly id: number;
  readonly uuid: string;
  readonly sku: string;
  readonly name: string;
  readonly product_unit_id: number;
  readonly product_unit_uuid: string;
  readonly base_unit_id: number;
  readonly base_unit_uuid: string;
  readonly unit_symbol: string;
  readonly precision: number;
  readonly track_batches: number;
  readonly track_expiry: number;
  readonly status: 'active' | 'inactive';
}
interface ProductUnitRow {
  readonly id: number;
  readonly uuid: string;
  readonly product_id: number;
  readonly product_uuid: string;
  readonly unit_uuid: string;
  readonly unit_symbol: string;
  readonly precision: number;
  readonly conversion_numerator: number;
  readonly conversion_denominator: number;
  readonly status: 'active' | 'inactive';
}
interface SupplierRow {
  readonly id: number;
  readonly uuid: string;
  readonly status: 'active' | 'inactive';
}
interface LocationRow {
  readonly id: number;
  readonly uuid: string;
  readonly warehouse_id: number;
  readonly warehouse_uuid: string;
  readonly warehouse_code: string;
  readonly branch_id: number;
  readonly code: string;
  readonly name: string;
  readonly type: InventoryLocationRecord['type'];
  readonly status: 'active' | 'inactive';
}
interface BatchRow {
  readonly id: number;
  readonly uuid: string;
  readonly product_id: number;
  readonly product_uuid: string;
  readonly supplier_id: number | null;
  readonly supplier_uuid: string | null;
  readonly batch_number: string | null;
  readonly received_at: string;
  readonly manufactured_at: string | null;
  readonly expires_at: string | null;
  readonly unit_cost_minor: number;
  readonly currency: string;
  readonly status: InventoryBatchStatus;
}
interface BalanceRow {
  readonly id: number;
  readonly location_id: number;
  readonly location_uuid: string;
  readonly warehouse_id: number;
  readonly product_id: number;
  readonly product_uuid: string;
  readonly batch_id: number | null;
  readonly batch_uuid: string | null;
  readonly batch_received_at: string | null;
  readonly batch_expires_at: string | null;
  readonly batch_status: InventoryBatchStatus | null;
  readonly on_hand_minor: number;
  readonly reserved_minor: number;
}
interface MovementRow {
  readonly uuid: string;
  readonly product_uuid: string;
  readonly location_uuid: string;
  readonly batch_uuid: string | null;
  readonly type: InventoryMovementType;
  readonly quantity_minor: number;
  readonly balance_after_minor: number;
  readonly reserved_after_minor: number;
  readonly reason: string;
  readonly reference_type: string;
  readonly reference_uuid: string;
  readonly created_at: string;
}
interface ReservationRow {
  readonly id: number;
  readonly uuid: string;
  readonly product_id: number;
  readonly product_uuid: string;
  readonly requested_minor: number;
  readonly status: InventoryReservationStatus;
  readonly expires_at: string;
}
interface ReservationItemRow {
  readonly reservation_id: number;
  readonly warehouse_id: number;
  readonly location_id: number;
  readonly location_uuid: string;
  readonly batch_id: number | null;
  readonly batch_uuid: string | null;
  readonly quantity_minor: number;
}

export class D1InventoryRepository implements InventoryRepository {
  constructor(private readonly database: WorkerBindings['DB']) {}

  async loadDirectory(tenantId: number, branchId: number): Promise<InventoryDirectoryRecord> {
    const [
      productResult,
      productUnitResult,
      supplierResult,
      locationResult,
      batchResult,
      balanceResult,
      movementResult,
      reservationResult,
      reservationItemResult,
    ] = await Promise.all([
      this.database
        .prepare(
          `SELECT p.id, p.uuid, p.sku, p.name, pu.id AS product_unit_id,
                  pu.uuid AS product_unit_uuid, p.base_unit_id,
                  u.uuid AS base_unit_uuid, u.symbol AS unit_symbol, u.precision,
                  p.track_batches, p.track_expiry, p.status
           FROM products p
           INNER JOIN product_units pu
             ON pu.tenant_id = p.tenant_id AND pu.product_id = p.id AND pu.is_base = 1
           INNER JOIN units u
             ON u.tenant_id = p.tenant_id AND u.id = p.base_unit_id
           WHERE p.tenant_id = ?1 AND p.type = 'stock'
           ORDER BY p.name ASC, p.id ASC`,
        )
        .bind(tenantId)
        .all<ProductRow>(),
      this.database
        .prepare(
          `SELECT pu.id, pu.uuid, pu.product_id, p.uuid AS product_uuid,
                  u.uuid AS unit_uuid, u.symbol AS unit_symbol, u.precision,
                  pu.conversion_numerator, pu.conversion_denominator, pu.status
           FROM product_units pu
           INNER JOIN products p
             ON p.tenant_id = pu.tenant_id AND p.id = pu.product_id
           INNER JOIN units u
             ON u.tenant_id = pu.tenant_id AND u.id = pu.unit_id
           WHERE pu.tenant_id = ?1 AND p.type = 'stock'
           ORDER BY pu.product_id ASC, pu.is_base DESC, pu.id ASC`,
        )
        .bind(tenantId)
        .all<ProductUnitRow>(),
      this.database
        .prepare(
          `SELECT id, uuid, status FROM suppliers
           WHERE tenant_id = ?1 ORDER BY id ASC`,
        )
        .bind(tenantId)
        .all<SupplierRow>(),
      this.database
        .prepare(
          `SELECT l.id, l.uuid, l.warehouse_id, w.uuid AS warehouse_uuid,
                  w.code AS warehouse_code, w.branch_id, l.code, l.name, l.type, l.status
           FROM locations l
           INNER JOIN warehouses w
             ON w.tenant_id = l.tenant_id AND w.id = l.warehouse_id
           WHERE l.tenant_id = ?1 AND w.branch_id = ?2
           ORDER BY w.code ASC, l.code ASC`,
        )
        .bind(tenantId, branchId)
        .all<LocationRow>(),
      this.database
        .prepare(
          `SELECT ib.id, ib.uuid, ib.product_id, p.uuid AS product_uuid,
                  ib.supplier_id, s.uuid AS supplier_uuid, ib.batch_number,
                  ib.received_at, ib.manufactured_at, ib.expires_at,
                  ib.unit_cost_minor, ib.currency, ib.status
           FROM inventory_batches ib
           INNER JOIN products p ON p.tenant_id = ib.tenant_id AND p.id = ib.product_id
           LEFT JOIN suppliers s ON s.tenant_id = ib.tenant_id AND s.id = ib.supplier_id
           WHERE ib.tenant_id = ?1
           ORDER BY ib.expires_at ASC, ib.received_at ASC, ib.id ASC`,
        )
        .bind(tenantId)
        .all<BatchRow>(),
      this.database
        .prepare(
          `SELECT b.id, b.location_id, l.uuid AS location_uuid, b.warehouse_id,
                  b.product_id, p.uuid AS product_uuid, b.batch_id,
                  ib.uuid AS batch_uuid, ib.received_at AS batch_received_at,
                  ib.expires_at AS batch_expires_at, ib.status AS batch_status,
                  b.on_hand_minor, b.reserved_minor
           FROM inventory_balances b
           INNER JOIN locations l
             ON l.tenant_id = b.tenant_id AND l.id = b.location_id
           INNER JOIN products p
             ON p.tenant_id = b.tenant_id AND p.id = b.product_id
           LEFT JOIN inventory_batches ib
             ON ib.tenant_id = b.tenant_id AND ib.id = b.batch_id
           WHERE b.tenant_id = ?1 AND b.branch_id = ?2
           ORDER BY p.name ASC, ib.expires_at ASC, ib.received_at ASC, b.id ASC`,
        )
        .bind(tenantId, branchId)
        .all<BalanceRow>(),
      this.database
        .prepare(
          `SELECT sm.uuid, p.uuid AS product_uuid, l.uuid AS location_uuid,
                  ib.uuid AS batch_uuid, sm.type, sm.quantity_minor,
                  sm.balance_after_minor, sm.reserved_after_minor, sm.reason,
                  sm.reference_type, sm.reference_uuid, sm.created_at
           FROM stock_movements sm
           INNER JOIN products p
             ON p.tenant_id = sm.tenant_id AND p.id = sm.product_id
           INNER JOIN locations l
             ON l.tenant_id = sm.tenant_id AND l.id = sm.location_id
           LEFT JOIN inventory_batches ib
             ON ib.tenant_id = sm.tenant_id AND ib.id = sm.batch_id
           WHERE sm.tenant_id = ?1 AND sm.branch_id = ?2
           ORDER BY sm.created_at DESC, sm.id DESC LIMIT 100`,
        )
        .bind(tenantId, branchId)
        .all<MovementRow>(),
      this.database
        .prepare(
          `SELECT r.id, r.uuid, r.product_id, p.uuid AS product_uuid,
                  r.requested_minor, r.status, r.expires_at
           FROM inventory_reservations r
           INNER JOIN products p
             ON p.tenant_id = r.tenant_id AND p.id = r.product_id
           WHERE r.tenant_id = ?1 AND r.branch_id = ?2
           ORDER BY r.created_at DESC, r.id DESC LIMIT 100`,
        )
        .bind(tenantId, branchId)
        .all<ReservationRow>(),
      this.database
        .prepare(
          `SELECT ri.reservation_id, ri.warehouse_id, ri.location_id,
                  l.uuid AS location_uuid, ri.batch_id, ib.uuid AS batch_uuid,
                  ri.quantity_minor
           FROM inventory_reservation_items ri
           INNER JOIN inventory_reservations r
             ON r.tenant_id = ri.tenant_id AND r.id = ri.reservation_id
           INNER JOIN locations l
             ON l.tenant_id = ri.tenant_id AND l.id = ri.location_id
           LEFT JOIN inventory_batches ib
             ON ib.tenant_id = ri.tenant_id AND ib.id = ri.batch_id
           WHERE ri.tenant_id = ?1 AND ri.branch_id = ?2
             AND r.id IN (
               SELECT id FROM inventory_reservations
               WHERE tenant_id = ?1 AND branch_id = ?2
               ORDER BY created_at DESC, id DESC LIMIT 100
             )
           ORDER BY ri.id ASC`,
        )
        .bind(tenantId, branchId)
        .all<ReservationItemRow>(),
    ]);

    const products: InventoryProductRecord[] = productResult.results.map((row) => ({
      id: row.id,
      uuid: row.uuid,
      sku: row.sku,
      name: row.name,
      productUnitId: row.product_unit_id,
      productUnitUuid: row.product_unit_uuid,
      baseUnitId: row.base_unit_id,
      baseUnitUuid: row.base_unit_uuid,
      unitSymbol: row.unit_symbol,
      precision: row.precision,
      trackBatches: row.track_batches === 1,
      trackExpiry: row.track_expiry === 1,
      status: row.status,
    }));
    const productUnits: InventoryProductUnitRecord[] = productUnitResult.results.map((row) => ({
      id: row.id,
      uuid: row.uuid,
      productId: row.product_id,
      productUuid: row.product_uuid,
      unitUuid: row.unit_uuid,
      unitSymbol: row.unit_symbol,
      precision: row.precision,
      conversionNumerator: row.conversion_numerator,
      conversionDenominator: row.conversion_denominator,
      status: row.status,
    }));
    const suppliers: InventorySupplierRecord[] = supplierResult.results.map((row) => ({
      id: row.id,
      uuid: row.uuid,
      status: row.status,
    }));
    const locations: InventoryLocationRecord[] = locationResult.results.map((row) => ({
      id: row.id,
      uuid: row.uuid,
      warehouseId: row.warehouse_id,
      warehouseUuid: row.warehouse_uuid,
      warehouseCode: row.warehouse_code,
      branchId: row.branch_id,
      code: row.code,
      name: row.name,
      type: row.type,
      status: row.status,
    }));
    const batches: InventoryBatchRecord[] = batchResult.results.map((row) => ({
      id: row.id,
      uuid: row.uuid,
      productId: row.product_id,
      productUuid: row.product_uuid,
      supplierId: row.supplier_id,
      supplierUuid: row.supplier_uuid,
      batchNumber: row.batch_number,
      receivedAt: row.received_at,
      manufacturedAt: row.manufactured_at,
      expiresAt: row.expires_at,
      unitCostMinor: row.unit_cost_minor,
      currency: row.currency,
      status: row.status,
    }));
    const balances: InventoryBalanceRecord[] = balanceResult.results.map((row) => ({
      id: row.id,
      locationId: row.location_id,
      locationUuid: row.location_uuid,
      warehouseId: row.warehouse_id,
      productId: row.product_id,
      productUuid: row.product_uuid,
      batchId: row.batch_id,
      batchUuid: row.batch_uuid,
      batchReceivedAt: row.batch_received_at,
      batchExpiresAt: row.batch_expires_at,
      batchStatus: row.batch_status,
      onHandMinor: row.on_hand_minor,
      reservedMinor: row.reserved_minor,
    }));
    const movements: InventoryMovementRecord[] = movementResult.results.map((row) => ({
      uuid: row.uuid,
      productUuid: row.product_uuid,
      locationUuid: row.location_uuid,
      batchUuid: row.batch_uuid,
      type: row.type,
      quantityMinor: row.quantity_minor,
      balanceAfterMinor: row.balance_after_minor,
      reservedAfterMinor: row.reserved_after_minor,
      reason: row.reason,
      referenceType: row.reference_type,
      referenceUuid: row.reference_uuid,
      createdAt: row.created_at,
    }));
    const allocationsByReservation = new Map<number, ReservationAllocationRecord[]>();
    for (const row of reservationItemResult.results) {
      const allocation: ReservationAllocationRecord = {
        warehouseId: row.warehouse_id,
        locationId: row.location_id,
        locationUuid: row.location_uuid,
        batchId: row.batch_id,
        batchUuid: row.batch_uuid,
        quantityMinor: row.quantity_minor,
      };
      const current = allocationsByReservation.get(row.reservation_id) ?? [];
      current.push(allocation);
      allocationsByReservation.set(row.reservation_id, current);
    }
    const reservations: InventoryReservationRecord[] = reservationResult.results.map((row) => ({
      id: row.id,
      uuid: row.uuid,
      productId: row.product_id,
      productUuid: row.product_uuid,
      requestedMinor: row.requested_minor,
      status: row.status,
      expiresAt: row.expires_at,
      allocations: allocationsByReservation.get(row.id) ?? [],
    }));
    return {
      products,
      productUnits,
      suppliers,
      locations,
      batches,
      balances,
      movements,
      reservations,
    };
  }

  async findMovementByReference(
    tenantId: number,
    branchId: number,
    referenceType: string,
    referenceUuid: string,
  ): Promise<InventoryMovementRecord | null> {
    const row = await this.database
      .prepare(
        `SELECT sm.uuid, p.uuid AS product_uuid, l.uuid AS location_uuid,
                ib.uuid AS batch_uuid, sm.type, sm.quantity_minor,
                sm.balance_after_minor, sm.reserved_after_minor, sm.reason,
                sm.reference_type, sm.reference_uuid, sm.created_at
         FROM stock_movements sm
         INNER JOIN products p
           ON p.tenant_id = sm.tenant_id AND p.id = sm.product_id
         INNER JOIN locations l
           ON l.tenant_id = sm.tenant_id AND l.id = sm.location_id
         LEFT JOIN inventory_batches ib
           ON ib.tenant_id = sm.tenant_id AND ib.id = sm.batch_id
         WHERE sm.tenant_id = ?1 AND sm.branch_id = ?2
           AND sm.reference_type = ?3 AND sm.reference_uuid = ?4
         LIMIT 1`,
      )
      .bind(tenantId, branchId, referenceType, referenceUuid)
      .first<MovementRow>();
    return row === null
      ? null
      : {
          uuid: row.uuid,
          productUuid: row.product_uuid,
          locationUuid: row.location_uuid,
          batchUuid: row.batch_uuid,
          type: row.type,
          quantityMinor: row.quantity_minor,
          balanceAfterMinor: row.balance_after_minor,
          reservedAfterMinor: row.reserved_after_minor,
          reason: row.reason,
          referenceType: row.reference_type,
          referenceUuid: row.reference_uuid,
          createdAt: row.created_at,
        };
  }

  private audit(
    event: {
      readonly tenantId: number;
      readonly branchId: number;
      readonly actorUserId: number;
      readonly requestId: string;
      readonly targetUuid: string;
      readonly ipAddress: string | null;
      readonly userAgent: string | null;
      readonly occurredAt: string;
    },
    entity: 'inventory_batch' | 'stock_movement' | 'inventory_reservation',
    table: 'inventory_batches' | 'stock_movements' | 'inventory_reservations',
    action: 'CREATE' | 'STOCK_ADJUSTMENT' | 'UPDATE',
    after: Readonly<Record<string, unknown>>,
  ) {
    return this.database
      .prepare(
        `INSERT INTO audit_logs
           (tenant_id, branch_id, user_id, request_id, action, entity, entity_id,
            after_json, ip_address, user_agent, created_at)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11
         FROM ${table} target
         WHERE target.tenant_id = ?1 AND target.uuid = ?7`,
      )
      .bind(
        event.tenantId,
        event.branchId,
        event.actorUserId,
        event.requestId,
        action,
        entity,
        event.targetUuid,
        JSON.stringify(after),
        event.ipAddress,
        event.userAgent,
        event.occurredAt,
      );
  }

  async createBatch(event: CreateInventoryBatchEvent): Promise<boolean> {
    const result = await this.database.batch([
      this.database
        .prepare(
          `INSERT INTO inventory_batches
             (uuid, tenant_id, product_id, supplier_id, batch_number, received_at,
              manufactured_at, expires_at, unit_cost_minor, currency, status,
              created_by, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?13)
           ON CONFLICT DO NOTHING`,
        )
        .bind(
          event.targetUuid,
          event.tenantId,
          event.productId,
          event.supplierId,
          event.batchNumber,
          event.receivedAt,
          event.manufacturedAt,
          event.expiresAt,
          event.unitCostMinor,
          event.currency,
          event.status,
          event.actorUserId,
          event.occurredAt,
        ),
      this.audit(event, 'inventory_batch', 'inventory_batches', 'CREATE', {
        product_id: event.productUuid,
        supplier_id: event.supplierUuid,
        batch_number: event.batchNumber,
        received_at: event.receivedAt,
        manufactured_at: event.manufacturedAt,
        expires_at: event.expiresAt,
        unit_cost_minor: event.unitCostMinor,
        currency: event.currency,
        status: event.status,
      }),
    ]);
    return (result[0]?.meta.changes ?? 0) === 1;
  }

  async adjust(event: AdjustInventoryEvent): Promise<boolean> {
    const batchKey = event.batchId?.toString() ?? 'none';
    const balanceMutation =
      event.quantityMinor > 0
        ? this.database
            .prepare(
              `INSERT INTO inventory_balances
                 (tenant_id, branch_id, warehouse_id, location_id, product_id, batch_id,
                  batch_key, on_hand_minor, reserved_minor, updated_at)
               SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 0, ?9
               WHERE NOT EXISTS (
                 SELECT 1 FROM stock_movements
                 WHERE tenant_id = ?1 AND reference_type = ?10 AND reference_uuid = ?11
               )
               ON CONFLICT (tenant_id, branch_id, location_id, product_id, batch_key)
               DO UPDATE SET
                 on_hand_minor = inventory_balances.on_hand_minor + excluded.on_hand_minor,
                 updated_at = excluded.updated_at`,
            )
            .bind(
              event.tenantId,
              event.branchId,
              event.warehouseId,
              event.locationId,
              event.productId,
              event.batchId,
              batchKey,
              event.quantityMinor,
              event.occurredAt,
              event.referenceType,
              event.referenceUuid,
            )
        : this.database
            .prepare(
              `UPDATE inventory_balances
               SET on_hand_minor = on_hand_minor + ?1, updated_at = ?2
               WHERE tenant_id = ?3 AND branch_id = ?4 AND location_id = ?5
                 AND product_id = ?6 AND batch_key = ?7
                 AND on_hand_minor + ?1 >= reserved_minor
                 AND NOT EXISTS (
                   SELECT 1 FROM stock_movements
                   WHERE tenant_id = ?3 AND reference_type = ?8 AND reference_uuid = ?9
                 )`,
            )
            .bind(
              event.quantityMinor,
              event.occurredAt,
              event.tenantId,
              event.branchId,
              event.locationId,
              event.productId,
              batchKey,
              event.referenceType,
              event.referenceUuid,
            );
    const movementType: InventoryMovementType =
      event.referenceType === 'opening'
        ? 'opening'
        : event.quantityMinor > 0
          ? 'adjustment_in'
          : 'adjustment_out';
    const result = await this.database.batch([
      balanceMutation,
      this.database
        .prepare(
          `INSERT INTO stock_movements
             (uuid, tenant_id, branch_id, warehouse_id, location_id, product_id,
              batch_id, batch_key, type, quantity_minor, balance_after_minor,
              reserved_after_minor, reason, reference_type, reference_uuid,
              created_by, created_at)
           SELECT ?1, b.tenant_id, b.branch_id, b.warehouse_id, b.location_id,
                  b.product_id, b.batch_id, b.batch_key, ?2, ?3, b.on_hand_minor,
                  b.reserved_minor, ?4, ?5, ?6, ?7, ?8
           FROM inventory_balances b
           WHERE b.tenant_id = ?9 AND b.branch_id = ?10 AND b.location_id = ?11
             AND b.product_id = ?12 AND b.batch_key = ?13 AND changes() = 1`,
        )
        .bind(
          event.targetUuid,
          movementType,
          event.quantityMinor,
          event.reason,
          event.referenceType,
          event.referenceUuid,
          event.actorUserId,
          event.occurredAt,
          event.tenantId,
          event.branchId,
          event.locationId,
          event.productId,
          batchKey,
        ),
      this.audit(event, 'stock_movement', 'stock_movements', 'STOCK_ADJUSTMENT', {
        product_id: event.productUuid,
        location_id: event.locationUuid,
        batch_id: event.batchUuid,
        quantity_minor: event.quantityMinor,
        reason: event.reason,
        reference_type: event.referenceType,
      }),
    ]);
    return (result[1]?.meta.changes ?? 0) === 1;
  }

  async createReservation(event: CreateReservationEvent): Promise<boolean> {
    const statements: D1PreparedStatement[] = [
      this.database
        .prepare(
          `INSERT INTO inventory_reservations
             (uuid, tenant_id, branch_id, product_id, requested_minor, status,
              expires_at, created_by, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, 'active', ?6, ?7, ?8, ?8)`,
        )
        .bind(
          event.targetUuid,
          event.tenantId,
          event.branchId,
          event.productId,
          event.requestedMinor,
          event.expiresAt,
          event.actorUserId,
          event.occurredAt,
        ),
    ];
    for (const allocation of event.allocations) {
      const batchKey = allocation.batchId?.toString() ?? 'none';
      statements.push(
        this.database
          .prepare(
            `UPDATE inventory_balances
             SET reserved_minor = reserved_minor + ?1, updated_at = ?2
             WHERE tenant_id = ?3 AND branch_id = ?4 AND location_id = ?5
               AND product_id = ?6 AND batch_key = ?7
               AND on_hand_minor - reserved_minor >= ?1
               AND EXISTS (
                 SELECT 1 FROM inventory_reservations r
                 WHERE r.tenant_id = ?3 AND r.uuid = ?8 AND r.status = 'active'
               )`,
          )
          .bind(
            allocation.quantityMinor,
            event.occurredAt,
            event.tenantId,
            event.branchId,
            allocation.locationId,
            event.productId,
            batchKey,
            event.targetUuid,
          ),
        this.database
          .prepare(
            `INSERT INTO inventory_reservation_items
               (tenant_id, reservation_id, branch_id, warehouse_id, location_id,
                product_id, batch_id, batch_key, quantity_minor, created_at)
             SELECT ?1, r.id, ?2, ?3, ?4, ?5, ?6, ?7,
                    CASE WHEN changes() = 1 THEN ?8 ELSE 0 END, ?9
             FROM inventory_reservations r
             WHERE r.tenant_id = ?1 AND r.uuid = ?10`,
          )
          .bind(
            event.tenantId,
            event.branchId,
            allocation.warehouseId,
            allocation.locationId,
            event.productId,
            allocation.batchId,
            batchKey,
            allocation.quantityMinor,
            event.occurredAt,
            event.targetUuid,
          ),
      );
    }
    statements.push(
      this.audit(event, 'inventory_reservation', 'inventory_reservations', 'CREATE', {
        product_id: event.productUuid,
        requested_minor: event.requestedMinor,
        expires_at: event.expiresAt,
        allocations: event.allocations.map((allocation) => ({
          location_id: allocation.locationUuid,
          batch_id: allocation.batchUuid,
          quantity_minor: allocation.quantityMinor,
        })),
      }),
    );
    const result = await this.database.batch(statements);
    return (result[0]?.meta.changes ?? 0) === 1;
  }

  async releaseReservation(event: ReleaseReservationEvent): Promise<boolean> {
    const statements: D1PreparedStatement[] = [
      this.database
        .prepare(
          `UPDATE inventory_reservations
           SET status = ?1, released_at = ?2, updated_at = ?2
           WHERE tenant_id = ?3 AND branch_id = ?4 AND id = ?5 AND uuid = ?6
             AND status = 'active'`,
        )
        .bind(
          event.status,
          event.occurredAt,
          event.tenantId,
          event.branchId,
          event.targetId,
          event.targetUuid,
        ),
    ];
    for (const allocation of event.allocations) {
      statements.push(
        this.database
          .prepare(
            `UPDATE inventory_balances
             SET reserved_minor = reserved_minor - ?1, updated_at = ?2
             WHERE tenant_id = ?3 AND branch_id = ?4 AND location_id = ?5
               AND product_id = (
                 SELECT product_id FROM inventory_reservations
                 WHERE tenant_id = ?3 AND id = ?6 AND uuid = ?7
                   AND status = ?8 AND released_at = ?2
               )
               AND batch_key = ?9 AND reserved_minor >= ?1`,
          )
          .bind(
            allocation.quantityMinor,
            event.occurredAt,
            event.tenantId,
            event.branchId,
            allocation.locationId,
            event.targetId,
            event.targetUuid,
            event.status,
            allocation.batchId?.toString() ?? 'none',
          ),
      );
    }
    statements.push(
      this.database
        .prepare(
          `INSERT INTO audit_logs
             (tenant_id, branch_id, user_id, request_id, action, entity, entity_id,
              after_json, ip_address, user_agent, created_at)
           SELECT ?1, ?2, ?3, ?4, 'UPDATE', 'inventory_reservation', ?5,
                  ?6, ?7, ?8, ?9
           FROM inventory_reservations target
           WHERE target.tenant_id = ?1 AND target.branch_id = ?2
             AND target.uuid = ?5 AND target.status = ?10 AND target.released_at = ?9`,
        )
        .bind(
          event.tenantId,
          event.branchId,
          event.actorUserId,
          event.requestId,
          event.targetUuid,
          JSON.stringify({ status: event.status, released_at: event.occurredAt }),
          event.ipAddress,
          event.userAgent,
          event.occurredAt,
          event.status,
        ),
    );
    const result = await this.database.batch(statements);
    return (result[0]?.meta.changes ?? 0) === 1;
  }
}
