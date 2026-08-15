import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

import { users } from './identity';
import { products, suppliers } from './master';
import { branches, locations, warehouses } from './organization';

export const INVENTORY_BATCH_STATUSES = ['available', 'quarantine', 'depleted', 'blocked'] as const;
export type InventoryBatchStatus = (typeof INVENTORY_BATCH_STATUSES)[number];
export const RESERVATION_STATUSES = ['active', 'released', 'consumed', 'expired'] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];
export const STOCK_MOVEMENT_TYPES = [
  'opening',
  'adjustment_in',
  'adjustment_out',
  'receipt',
  'sale',
  'sale_return',
  'purchase_return',
  'transfer_in',
  'transfer_out',
  'opname_in',
  'opname_out',
] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

const createdAt = () =>
  text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`);
const updatedAt = () =>
  text('updated_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`);

export const inventoryBatches = sqliteTable(
  'inventory_batches',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    uuid: text('uuid').notNull(),
    tenantId: integer('tenant_id').notNull(),
    productId: integer('product_id').notNull(),
    supplierId: integer('supplier_id'),
    batchNumber: text('batch_number'),
    receivedAt: text('received_at').notNull(),
    manufacturedAt: text('manufactured_at'),
    expiresAt: text('expires_at'),
    unitCostMinor: integer('unit_cost_minor').notNull().default(0),
    currency: text('currency').notNull().default('IDR'),
    status: text('status').$type<InventoryBatchStatus>().notNull().default('available'),
    createdBy: integer('created_by').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('inventory_batches_uuid_unique').on(table.uuid),
    uniqueIndex('inventory_batches_tenant_id_unique').on(table.tenantId, table.id),
    uniqueIndex('inventory_batches_tenant_product_id_unique').on(
      table.tenantId,
      table.productId,
      table.id,
    ),
    uniqueIndex('inventory_batches_tenant_product_number_unique')
      .on(table.tenantId, table.productId, table.batchNumber)
      .where(sql`${table.batchNumber} IS NOT NULL`),
    index('inventory_batches_tenant_product_expiry_idx').on(
      table.tenantId,
      table.productId,
      table.expiresAt,
      table.receivedAt,
    ),
    index('inventory_batches_tenant_status_idx').on(table.tenantId, table.status),
    foreignKey({
      name: 'inventory_batches_tenant_product_fk',
      columns: [table.tenantId, table.productId],
      foreignColumns: [products.tenantId, products.id],
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      name: 'inventory_batches_tenant_supplier_fk',
      columns: [table.tenantId, table.supplierId],
      foreignColumns: [suppliers.tenantId, suppliers.id],
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      name: 'inventory_batches_tenant_creator_fk',
      columns: [table.tenantId, table.createdBy],
      foreignColumns: [users.tenantId, users.id],
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    check(
      'inventory_batches_status_check',
      sql`${table.status} IN ('available', 'quarantine', 'depleted', 'blocked')`,
    ),
    check('inventory_batches_cost_check', sql`${table.unitCostMinor} >= 0`),
    check('inventory_batches_currency_check', sql`length(${table.currency}) = 3`),
    check(
      'inventory_batches_expiry_check',
      sql`${table.expiresAt} IS NULL OR ${table.expiresAt} >= ${table.receivedAt}`,
    ),
    check(
      'inventory_batches_manufactured_check',
      sql`${table.manufacturedAt} IS NULL OR ${table.manufacturedAt} <= ${table.receivedAt}`,
    ),
  ],
);

export const inventoryBalances = sqliteTable(
  'inventory_balances',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    tenantId: integer('tenant_id').notNull(),
    branchId: integer('branch_id').notNull(),
    warehouseId: integer('warehouse_id').notNull(),
    locationId: integer('location_id').notNull(),
    productId: integer('product_id').notNull(),
    batchId: integer('batch_id'),
    batchKey: text('batch_key').notNull(),
    onHandMinor: integer('on_hand_minor').notNull().default(0),
    reservedMinor: integer('reserved_minor').notNull().default(0),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('inventory_balances_scope_unique').on(
      table.tenantId,
      table.branchId,
      table.locationId,
      table.productId,
      table.batchKey,
    ),
    uniqueIndex('inventory_balances_tenant_id_unique').on(table.tenantId, table.id),
    index('inventory_balances_tenant_branch_product_idx').on(
      table.tenantId,
      table.branchId,
      table.productId,
    ),
    index('inventory_balances_tenant_batch_idx').on(table.tenantId, table.batchId),
    foreignKey({
      name: 'inventory_balances_tenant_branch_fk',
      columns: [table.tenantId, table.branchId],
      foreignColumns: [branches.tenantId, branches.id],
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      name: 'inventory_balances_tenant_branch_warehouse_fk',
      columns: [table.tenantId, table.branchId, table.warehouseId],
      foreignColumns: [warehouses.tenantId, warehouses.branchId, warehouses.id],
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      name: 'inventory_balances_tenant_warehouse_location_fk',
      columns: [table.tenantId, table.warehouseId, table.locationId],
      foreignColumns: [locations.tenantId, locations.warehouseId, locations.id],
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      name: 'inventory_balances_tenant_product_fk',
      columns: [table.tenantId, table.productId],
      foreignColumns: [products.tenantId, products.id],
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      name: 'inventory_balances_tenant_product_batch_fk',
      columns: [table.tenantId, table.productId, table.batchId],
      foreignColumns: [inventoryBatches.tenantId, inventoryBatches.productId, inventoryBatches.id],
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    check(
      'inventory_balances_nonnegative_check',
      sql`${table.onHandMinor} >= 0 AND ${table.reservedMinor} >= 0`,
    ),
    check('inventory_balances_reserved_check', sql`${table.reservedMinor} <= ${table.onHandMinor}`),
    check(
      'inventory_balances_batch_key_check',
      sql`${table.batchKey} = coalesce(CAST(${table.batchId} AS TEXT), 'none')`,
    ),
  ],
);

export const inventoryReservations = sqliteTable(
  'inventory_reservations',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    uuid: text('uuid').notNull(),
    tenantId: integer('tenant_id').notNull(),
    branchId: integer('branch_id').notNull(),
    productId: integer('product_id').notNull(),
    requestedMinor: integer('requested_minor').notNull(),
    status: text('status').$type<ReservationStatus>().notNull().default('active'),
    expiresAt: text('expires_at').notNull(),
    releasedAt: text('released_at'),
    consumedAt: text('consumed_at'),
    createdBy: integer('created_by').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('inventory_reservations_uuid_unique').on(table.uuid),
    uniqueIndex('inventory_reservations_tenant_id_unique').on(table.tenantId, table.id),
    index('inventory_reservations_tenant_branch_status_idx').on(
      table.tenantId,
      table.branchId,
      table.status,
      table.expiresAt,
    ),
    foreignKey({
      name: 'inventory_reservations_tenant_branch_fk',
      columns: [table.tenantId, table.branchId],
      foreignColumns: [branches.tenantId, branches.id],
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      name: 'inventory_reservations_tenant_product_fk',
      columns: [table.tenantId, table.productId],
      foreignColumns: [products.tenantId, products.id],
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      name: 'inventory_reservations_tenant_creator_fk',
      columns: [table.tenantId, table.createdBy],
      foreignColumns: [users.tenantId, users.id],
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    check('inventory_reservations_quantity_check', sql`${table.requestedMinor} > 0`),
    check(
      'inventory_reservations_status_check',
      sql`${table.status} IN ('active', 'released', 'consumed', 'expired')`,
    ),
    check(
      'inventory_reservations_lifecycle_check',
      sql`(${table.status} = 'active' AND ${table.releasedAt} IS NULL AND ${table.consumedAt} IS NULL) OR (${table.status} IN ('released', 'expired') AND ${table.releasedAt} IS NOT NULL AND ${table.consumedAt} IS NULL) OR (${table.status} = 'consumed' AND ${table.consumedAt} IS NOT NULL)`,
    ),
  ],
);

export const inventoryReservationItems = sqliteTable(
  'inventory_reservation_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    tenantId: integer('tenant_id').notNull(),
    reservationId: integer('reservation_id').notNull(),
    branchId: integer('branch_id').notNull(),
    warehouseId: integer('warehouse_id').notNull(),
    locationId: integer('location_id').notNull(),
    productId: integer('product_id').notNull(),
    batchId: integer('batch_id'),
    batchKey: text('batch_key').notNull(),
    quantityMinor: integer('quantity_minor').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('inventory_reservation_items_allocation_unique').on(
      table.tenantId,
      table.reservationId,
      table.locationId,
      table.batchKey,
    ),
    index('inventory_reservation_items_tenant_reservation_idx').on(
      table.tenantId,
      table.reservationId,
    ),
    foreignKey({
      name: 'inventory_reservation_items_tenant_reservation_fk',
      columns: [table.tenantId, table.reservationId],
      foreignColumns: [inventoryReservations.tenantId, inventoryReservations.id],
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      name: 'inventory_reservation_items_tenant_branch_warehouse_fk',
      columns: [table.tenantId, table.branchId, table.warehouseId],
      foreignColumns: [warehouses.tenantId, warehouses.branchId, warehouses.id],
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      name: 'inventory_reservation_items_tenant_warehouse_location_fk',
      columns: [table.tenantId, table.warehouseId, table.locationId],
      foreignColumns: [locations.tenantId, locations.warehouseId, locations.id],
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      name: 'inventory_reservation_items_tenant_product_fk',
      columns: [table.tenantId, table.productId],
      foreignColumns: [products.tenantId, products.id],
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      name: 'inventory_reservation_items_tenant_product_batch_fk',
      columns: [table.tenantId, table.productId, table.batchId],
      foreignColumns: [inventoryBatches.tenantId, inventoryBatches.productId, inventoryBatches.id],
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    check('inventory_reservation_items_quantity_check', sql`${table.quantityMinor} > 0`),
    check(
      'inventory_reservation_items_batch_key_check',
      sql`${table.batchKey} = coalesce(CAST(${table.batchId} AS TEXT), 'none')`,
    ),
  ],
);

export const stockMovements = sqliteTable(
  'stock_movements',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    uuid: text('uuid').notNull(),
    tenantId: integer('tenant_id').notNull(),
    branchId: integer('branch_id').notNull(),
    warehouseId: integer('warehouse_id').notNull(),
    locationId: integer('location_id').notNull(),
    productId: integer('product_id').notNull(),
    batchId: integer('batch_id'),
    batchKey: text('batch_key').notNull(),
    type: text('type').$type<StockMovementType>().notNull(),
    quantityMinor: integer('quantity_minor').notNull(),
    balanceAfterMinor: integer('balance_after_minor').notNull(),
    reservedAfterMinor: integer('reserved_after_minor').notNull(),
    reason: text('reason').notNull(),
    referenceType: text('reference_type').notNull(),
    referenceUuid: text('reference_uuid').notNull(),
    createdBy: integer('created_by').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('stock_movements_uuid_unique').on(table.uuid),
    uniqueIndex('stock_movements_tenant_reference_unique').on(
      table.tenantId,
      table.referenceType,
      table.referenceUuid,
    ),
    index('stock_movements_tenant_branch_product_created_idx').on(
      table.tenantId,
      table.branchId,
      table.productId,
      table.createdAt,
    ),
    index('stock_movements_tenant_batch_created_idx').on(
      table.tenantId,
      table.batchId,
      table.createdAt,
    ),
    foreignKey({
      name: 'stock_movements_tenant_branch_fk',
      columns: [table.tenantId, table.branchId],
      foreignColumns: [branches.tenantId, branches.id],
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      name: 'stock_movements_tenant_branch_warehouse_fk',
      columns: [table.tenantId, table.branchId, table.warehouseId],
      foreignColumns: [warehouses.tenantId, warehouses.branchId, warehouses.id],
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      name: 'stock_movements_tenant_warehouse_location_fk',
      columns: [table.tenantId, table.warehouseId, table.locationId],
      foreignColumns: [locations.tenantId, locations.warehouseId, locations.id],
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      name: 'stock_movements_tenant_product_fk',
      columns: [table.tenantId, table.productId],
      foreignColumns: [products.tenantId, products.id],
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      name: 'stock_movements_tenant_product_batch_fk',
      columns: [table.tenantId, table.productId, table.batchId],
      foreignColumns: [inventoryBatches.tenantId, inventoryBatches.productId, inventoryBatches.id],
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      name: 'stock_movements_tenant_creator_fk',
      columns: [table.tenantId, table.createdBy],
      foreignColumns: [users.tenantId, users.id],
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    check(
      'stock_movements_type_check',
      sql`${table.type} IN ('opening', 'adjustment_in', 'adjustment_out', 'receipt', 'sale', 'sale_return', 'purchase_return', 'transfer_in', 'transfer_out', 'opname_in', 'opname_out')`,
    ),
    check('stock_movements_quantity_check', sql`${table.quantityMinor} <> 0`),
    check(
      'stock_movements_balance_check',
      sql`${table.balanceAfterMinor} >= 0 AND ${table.reservedAfterMinor} >= 0 AND ${table.reservedAfterMinor} <= ${table.balanceAfterMinor}`,
    ),
    check(
      'stock_movements_batch_key_check',
      sql`${table.batchKey} = coalesce(CAST(${table.batchId} AS TEXT), 'none')`,
    ),
  ],
);

export type NewInventoryBatch = typeof inventoryBatches.$inferInsert;
export type InventoryBatchRow = typeof inventoryBatches.$inferSelect;
export type InventoryBalanceRow = typeof inventoryBalances.$inferSelect;
export type StockMovementRow = typeof stockMovements.$inferSelect;
