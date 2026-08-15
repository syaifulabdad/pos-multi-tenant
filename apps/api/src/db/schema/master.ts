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
import { branches } from './organization';
import { tenants } from './platform';

export const MASTER_STATUSES = ['active', 'inactive'] as const;
export type MasterStatus = (typeof MASTER_STATUSES)[number];
export const PRODUCT_TYPES = ['stock', 'service'] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];
export const CUSTOMER_TYPES = ['individual', 'business'] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];

const createdAt = () =>
  text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`);

const updatedAt = () =>
  text('updated_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`);

export const categories = sqliteTable(
  'categories',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    uuid: text('uuid').notNull(),
    tenantId: integer('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    parentId: integer('parent_id'),
    code: text('code').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    status: text('status').$type<MasterStatus>().notNull().default('active'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('categories_uuid_unique').on(table.uuid),
    uniqueIndex('categories_tenant_code_unique').on(table.tenantId, table.code),
    uniqueIndex('categories_tenant_id_unique').on(table.tenantId, table.id),
    index('categories_tenant_parent_idx').on(table.tenantId, table.parentId),
    index('categories_tenant_status_idx').on(table.tenantId, table.status),
    foreignKey({
      name: 'categories_tenant_parent_fk',
      columns: [table.tenantId, table.parentId],
      foreignColumns: [table.tenantId, table.id],
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    check('categories_status_check', sql`${table.status} IN ('active', 'inactive')`),
    check('categories_code_uppercase_check', sql`${table.code} = upper(${table.code})`),
    check(
      'categories_parent_self_check',
      sql`${table.parentId} IS NULL OR ${table.parentId} <> ${table.id}`,
    ),
  ],
);

export const brands = sqliteTable(
  'brands',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    uuid: text('uuid').notNull(),
    tenantId: integer('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    code: text('code').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    status: text('status').$type<MasterStatus>().notNull().default('active'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('brands_uuid_unique').on(table.uuid),
    uniqueIndex('brands_tenant_code_unique').on(table.tenantId, table.code),
    uniqueIndex('brands_tenant_id_unique').on(table.tenantId, table.id),
    index('brands_tenant_status_idx').on(table.tenantId, table.status),
    check('brands_status_check', sql`${table.status} IN ('active', 'inactive')`),
    check('brands_code_uppercase_check', sql`${table.code} = upper(${table.code})`),
  ],
);

export const units = sqliteTable(
  'units',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    uuid: text('uuid').notNull(),
    tenantId: integer('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    code: text('code').notNull(),
    name: text('name').notNull(),
    symbol: text('symbol').notNull(),
    precision: integer('precision').notNull().default(0),
    status: text('status').$type<MasterStatus>().notNull().default('active'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('units_uuid_unique').on(table.uuid),
    uniqueIndex('units_tenant_code_unique').on(table.tenantId, table.code),
    uniqueIndex('units_tenant_id_unique').on(table.tenantId, table.id),
    index('units_tenant_status_idx').on(table.tenantId, table.status),
    check('units_status_check', sql`${table.status} IN ('active', 'inactive')`),
    check('units_code_uppercase_check', sql`${table.code} = upper(${table.code})`),
    check('units_precision_check', sql`${table.precision} BETWEEN 0 AND 6`),
  ],
);

export const products = sqliteTable(
  'products',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    uuid: text('uuid').notNull(),
    tenantId: integer('tenant_id').notNull(),
    categoryId: integer('category_id'),
    brandId: integer('brand_id'),
    baseUnitId: integer('base_unit_id').notNull(),
    sku: text('sku').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    type: text('type').$type<ProductType>().notNull().default('stock'),
    status: text('status').$type<MasterStatus>().notNull().default('active'),
    trackBatches: integer('track_batches', { mode: 'boolean' }).notNull().default(false),
    trackExpiry: integer('track_expiry', { mode: 'boolean' }).notNull().default(false),
    allowDecimal: integer('allow_decimal', { mode: 'boolean' }).notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('products_uuid_unique').on(table.uuid),
    uniqueIndex('products_tenant_sku_unique').on(table.tenantId, table.sku),
    uniqueIndex('products_tenant_id_unique').on(table.tenantId, table.id),
    index('products_tenant_category_idx').on(table.tenantId, table.categoryId),
    index('products_tenant_brand_idx').on(table.tenantId, table.brandId),
    index('products_tenant_status_idx').on(table.tenantId, table.status),
    foreignKey({
      name: 'products_tenant_category_fk',
      columns: [table.tenantId, table.categoryId],
      foreignColumns: [categories.tenantId, categories.id],
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      name: 'products_tenant_brand_fk',
      columns: [table.tenantId, table.brandId],
      foreignColumns: [brands.tenantId, brands.id],
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      name: 'products_tenant_base_unit_fk',
      columns: [table.tenantId, table.baseUnitId],
      foreignColumns: [units.tenantId, units.id],
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    check('products_status_check', sql`${table.status} IN ('active', 'inactive')`),
    check('products_type_check', sql`${table.type} IN ('stock', 'service')`),
    check('products_sku_uppercase_check', sql`${table.sku} = upper(${table.sku})`),
    check(
      'products_expiry_requires_batch_check',
      sql`${table.trackExpiry} = 0 OR ${table.trackBatches} = 1`,
    ),
    check(
      'products_service_tracking_check',
      sql`${table.type} = 'stock' OR (${table.trackBatches} = 0 AND ${table.trackExpiry} = 0)`,
    ),
  ],
);

export const productUnits = sqliteTable(
  'product_units',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    uuid: text('uuid').notNull(),
    tenantId: integer('tenant_id').notNull(),
    productId: integer('product_id').notNull(),
    unitId: integer('unit_id').notNull(),
    conversionNumerator: integer('conversion_numerator').notNull().default(1),
    conversionDenominator: integer('conversion_denominator').notNull().default(1),
    barcode: text('barcode'),
    isBase: integer('is_base', { mode: 'boolean' }).notNull().default(false),
    isSaleUnit: integer('is_sale_unit', { mode: 'boolean' }).notNull().default(true),
    isPurchaseUnit: integer('is_purchase_unit', { mode: 'boolean' }).notNull().default(true),
    status: text('status').$type<MasterStatus>().notNull().default('active'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('product_units_uuid_unique').on(table.uuid),
    uniqueIndex('product_units_tenant_product_unit_unique').on(
      table.tenantId,
      table.productId,
      table.unitId,
    ),
    uniqueIndex('product_units_tenant_id_unique').on(table.tenantId, table.id),
    uniqueIndex('product_units_tenant_barcode_unique')
      .on(table.tenantId, table.barcode)
      .where(sql`${table.barcode} IS NOT NULL`),
    uniqueIndex('product_units_one_base_unique')
      .on(table.tenantId, table.productId)
      .where(sql`${table.isBase} = 1`),
    index('product_units_tenant_product_idx').on(table.tenantId, table.productId),
    foreignKey({
      name: 'product_units_tenant_product_fk',
      columns: [table.tenantId, table.productId],
      foreignColumns: [products.tenantId, products.id],
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    foreignKey({
      name: 'product_units_tenant_unit_fk',
      columns: [table.tenantId, table.unitId],
      foreignColumns: [units.tenantId, units.id],
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    check('product_units_status_check', sql`${table.status} IN ('active', 'inactive')`),
    check(
      'product_units_conversion_check',
      sql`${table.conversionNumerator} > 0 AND ${table.conversionDenominator} > 0`,
    ),
    check(
      'product_units_base_conversion_check',
      sql`${table.isBase} = 0 OR (${table.conversionNumerator} = 1 AND ${table.conversionDenominator} = 1)`,
    ),
  ],
);

export const productPrices = sqliteTable(
  'product_prices',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    uuid: text('uuid').notNull(),
    tenantId: integer('tenant_id').notNull(),
    productUnitId: integer('product_unit_id').notNull(),
    branchId: integer('branch_id'),
    amountMinor: integer('amount_minor').notNull(),
    currency: text('currency').notNull().default('IDR'),
    status: text('status').notNull().default('active'),
    validFrom: text('valid_from').notNull(),
    validTo: text('valid_to'),
    createdBy: integer('created_by').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('product_prices_uuid_unique').on(table.uuid),
    uniqueIndex('product_prices_active_global_unique')
      .on(table.tenantId, table.productUnitId)
      .where(sql`${table.branchId} IS NULL AND ${table.status} = 'active'`),
    uniqueIndex('product_prices_active_branch_unique')
      .on(table.tenantId, table.productUnitId, table.branchId)
      .where(sql`${table.branchId} IS NOT NULL AND ${table.status} = 'active'`),
    index('product_prices_tenant_unit_history_idx').on(
      table.tenantId,
      table.productUnitId,
      table.createdAt,
    ),
    foreignKey({
      name: 'product_prices_tenant_product_unit_fk',
      columns: [table.tenantId, table.productUnitId],
      foreignColumns: [productUnits.tenantId, productUnits.id],
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      name: 'product_prices_tenant_branch_fk',
      columns: [table.tenantId, table.branchId],
      foreignColumns: [branches.tenantId, branches.id],
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      name: 'product_prices_tenant_creator_fk',
      columns: [table.tenantId, table.createdBy],
      foreignColumns: [users.tenantId, users.id],
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    check('product_prices_amount_check', sql`${table.amountMinor} >= 0`),
    check('product_prices_currency_check', sql`length(${table.currency}) = 3`),
    check('product_prices_status_check', sql`${table.status} IN ('active', 'superseded')`),
    check(
      'product_prices_validity_check',
      sql`${table.validTo} IS NULL OR ${table.validTo} > ${table.validFrom}`,
    ),
  ],
);

export const suppliers = sqliteTable(
  'suppliers',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    uuid: text('uuid').notNull(),
    tenantId: integer('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    code: text('code').notNull(),
    name: text('name').notNull(),
    contactName: text('contact_name'),
    phone: text('phone'),
    email: text('email'),
    address: text('address'),
    taxId: text('tax_id'),
    status: text('status').$type<MasterStatus>().notNull().default('active'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('suppliers_uuid_unique').on(table.uuid),
    uniqueIndex('suppliers_tenant_code_unique').on(table.tenantId, table.code),
    uniqueIndex('suppliers_tenant_id_unique').on(table.tenantId, table.id),
    index('suppliers_tenant_status_idx').on(table.tenantId, table.status),
    index('suppliers_tenant_name_idx').on(table.tenantId, table.name),
    check('suppliers_status_check', sql`${table.status} IN ('active', 'inactive')`),
    check('suppliers_code_uppercase_check', sql`${table.code} = upper(${table.code})`),
  ],
);

export const customers = sqliteTable(
  'customers',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    uuid: text('uuid').notNull(),
    tenantId: integer('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    code: text('code').notNull(),
    name: text('name').notNull(),
    type: text('type').$type<CustomerType>().notNull().default('individual'),
    phone: text('phone'),
    email: text('email'),
    address: text('address'),
    status: text('status').$type<MasterStatus>().notNull().default('active'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('customers_uuid_unique').on(table.uuid),
    uniqueIndex('customers_tenant_code_unique').on(table.tenantId, table.code),
    uniqueIndex('customers_tenant_id_unique').on(table.tenantId, table.id),
    index('customers_tenant_status_idx').on(table.tenantId, table.status),
    index('customers_tenant_name_idx').on(table.tenantId, table.name),
    index('customers_tenant_phone_idx').on(table.tenantId, table.phone),
    check('customers_status_check', sql`${table.status} IN ('active', 'inactive')`),
    check('customers_type_check', sql`${table.type} IN ('individual', 'business')`),
    check('customers_code_uppercase_check', sql`${table.code} = upper(${table.code})`),
  ],
);
