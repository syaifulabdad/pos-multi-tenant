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

import { tenants } from './platform';

export const BRANCH_STATUSES = ['active', 'inactive'] as const;
export type BranchStatus = (typeof BRANCH_STATUSES)[number];
export const LOCATION_TYPES = [
  'storage',
  'sales_floor',
  'receiving',
  'quarantine',
  'damaged',
  'expired',
] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];

const createdAt = () =>
  text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`);

const updatedAt = () =>
  text('updated_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`);

export const branches = sqliteTable(
  'branches',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    uuid: text('uuid').notNull(),
    tenantId: integer('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    code: text('code').notNull(),
    name: text('name').notNull(),
    status: text('status').$type<BranchStatus>().notNull().default('active'),
    timezone: text('timezone').notNull().default('Asia/Jakarta'),
    address: text('address'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('branches_uuid_unique').on(table.uuid),
    uniqueIndex('branches_tenant_code_unique').on(table.tenantId, table.code),
    uniqueIndex('branches_tenant_id_unique').on(table.tenantId, table.id),
    index('branches_tenant_status_idx').on(table.tenantId, table.status),
    check('branches_status_check', sql`${table.status} IN ('active', 'inactive')`),
    check('branches_code_uppercase_check', sql`${table.code} = upper(${table.code})`),
  ],
);

export const warehouses = sqliteTable(
  'warehouses',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    uuid: text('uuid').notNull(),
    tenantId: integer('tenant_id').notNull(),
    branchId: integer('branch_id').notNull(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    status: text('status').$type<BranchStatus>().notNull().default('active'),
    address: text('address'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('warehouses_uuid_unique').on(table.uuid),
    uniqueIndex('warehouses_tenant_code_unique').on(table.tenantId, table.code),
    uniqueIndex('warehouses_tenant_id_unique').on(table.tenantId, table.id),
    uniqueIndex('warehouses_tenant_branch_id_unique').on(table.tenantId, table.branchId, table.id),
    index('warehouses_tenant_branch_idx').on(table.tenantId, table.branchId),
    index('warehouses_tenant_status_idx').on(table.tenantId, table.status),
    foreignKey({
      name: 'warehouses_tenant_branch_fk',
      columns: [table.tenantId, table.branchId],
      foreignColumns: [branches.tenantId, branches.id],
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    check('warehouses_status_check', sql`${table.status} IN ('active', 'inactive')`),
    check('warehouses_code_uppercase_check', sql`${table.code} = upper(${table.code})`),
  ],
);

export const locations = sqliteTable(
  'locations',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    uuid: text('uuid').notNull(),
    tenantId: integer('tenant_id').notNull(),
    warehouseId: integer('warehouse_id').notNull(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    type: text('type').$type<LocationType>().notNull().default('storage'),
    status: text('status').$type<BranchStatus>().notNull().default('active'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('locations_uuid_unique').on(table.uuid),
    uniqueIndex('locations_tenant_warehouse_code_unique').on(
      table.tenantId,
      table.warehouseId,
      table.code,
    ),
    uniqueIndex('locations_tenant_id_unique').on(table.tenantId, table.id),
    uniqueIndex('locations_tenant_warehouse_id_unique').on(
      table.tenantId,
      table.warehouseId,
      table.id,
    ),
    index('locations_tenant_warehouse_idx').on(table.tenantId, table.warehouseId),
    index('locations_tenant_status_idx').on(table.tenantId, table.status),
    foreignKey({
      name: 'locations_tenant_warehouse_fk',
      columns: [table.tenantId, table.warehouseId],
      foreignColumns: [warehouses.tenantId, warehouses.id],
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    check(
      'locations_type_check',
      sql`${table.type} IN ('storage', 'sales_floor', 'receiving', 'quarantine', 'damaged', 'expired')`,
    ),
    check('locations_status_check', sql`${table.status} IN ('active', 'inactive')`),
    check('locations_code_uppercase_check', sql`${table.code} = upper(${table.code})`),
  ],
);

export const posTerminals = sqliteTable(
  'pos_terminals',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    uuid: text('uuid').notNull(),
    tenantId: integer('tenant_id').notNull(),
    branchId: integer('branch_id').notNull(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    status: text('status').$type<BranchStatus>().notNull().default('active'),
    lastSeenAt: text('last_seen_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('pos_terminals_uuid_unique').on(table.uuid),
    uniqueIndex('pos_terminals_tenant_code_unique').on(table.tenantId, table.code),
    uniqueIndex('pos_terminals_tenant_id_unique').on(table.tenantId, table.id),
    index('pos_terminals_tenant_branch_idx').on(table.tenantId, table.branchId),
    index('pos_terminals_tenant_status_idx').on(table.tenantId, table.status),
    foreignKey({
      name: 'pos_terminals_tenant_branch_fk',
      columns: [table.tenantId, table.branchId],
      foreignColumns: [branches.tenantId, branches.id],
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    check('pos_terminals_status_check', sql`${table.status} IN ('active', 'inactive')`),
    check('pos_terminals_code_uppercase_check', sql`${table.code} = upper(${table.code})`),
  ],
);
