import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { tenants } from './platform';

export const rateLimitBuckets = sqliteTable(
  'rate_limit_buckets',
  {
    keyHash: text('key_hash').primaryKey(),
    tenantId: integer('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    category: text('category').notNull(),
    scope: text('scope').notNull(),
    requestCount: integer('request_count').notNull(),
    windowStartedAt: integer('window_started_at').notNull(),
    expiresAt: integer('expires_at').notNull(),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    index('rate_limit_buckets_tenant_category_idx').on(table.tenantId, table.category),
    index('rate_limit_buckets_expiry_idx').on(table.expiresAt),
    check('rate_limit_buckets_count_check', sql`${table.requestCount} >= 0`),
    check('rate_limit_buckets_window_check', sql`${table.expiresAt} > ${table.windowStartedAt}`),
  ],
);
