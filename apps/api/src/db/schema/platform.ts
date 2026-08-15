import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const TENANT_STATUSES = ['pending', 'active', 'suspended', 'inactive'] as const;
export const BUSINESS_TYPES = ['retail', 'pharmacy', 'retail_pharmacy'] as const;
export const UI_MODES = ['simple', 'professional', 'advanced'] as const;

export type TenantStatus = (typeof TENANT_STATUSES)[number];
export type BusinessType = (typeof BUSINESS_TYPES)[number];
export type UiMode = (typeof UI_MODES)[number];

const createdAt = () =>
  text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`);

const updatedAt = () =>
  text('updated_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`);

export const tenants = sqliteTable(
  'tenants',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    uuid: text('uuid').notNull(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    status: text('status').$type<TenantStatus>().notNull().default('pending'),
    plan: text('plan').notNull().default('starter'),
    businessType: text('business_type').$type<BusinessType>().notNull().default('retail'),
    uiMode: text('ui_mode').$type<UiMode>().notNull().default('simple'),
    timezone: text('timezone').notNull().default('Asia/Jakarta'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('tenants_uuid_unique').on(table.uuid),
    uniqueIndex('tenants_slug_unique').on(table.slug),
    index('tenants_status_idx').on(table.status),
    check(
      'tenants_status_check',
      sql`${table.status} IN ('pending', 'active', 'suspended', 'inactive')`,
    ),
    check(
      'tenants_business_type_check',
      sql`${table.businessType} IN ('retail', 'pharmacy', 'retail_pharmacy')`,
    ),
    check('tenants_ui_mode_check', sql`${table.uiMode} IN ('simple', 'professional', 'advanced')`),
    check('tenants_slug_lowercase_check', sql`${table.slug} = lower(${table.slug})`),
    check('tenants_slug_length_check', sql`length(${table.slug}) BETWEEN 2 AND 63`),
  ],
);

export const tenantDomains = sqliteTable(
  'tenant_domains',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    tenantId: integer('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    hostname: text('hostname').notNull(),
    isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
    verifiedAt: text('verified_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('tenant_domains_hostname_unique').on(table.hostname),
    index('tenant_domains_tenant_idx').on(table.tenantId),
    index('tenant_domains_verified_idx').on(table.verifiedAt),
    check(
      'tenant_domains_hostname_lowercase_check',
      sql`${table.hostname} = lower(${table.hostname})`,
    ),
  ],
);
