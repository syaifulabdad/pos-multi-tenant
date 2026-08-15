import { sql } from 'drizzle-orm';
import { foreignKey, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { users } from './identity';
import { branches } from './organization';
import { tenants } from './platform';

const createdAt = () =>
  text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`);

export const auditLogs = sqliteTable(
  'audit_logs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    tenantId: integer('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    branchId: integer('branch_id'),
    userId: integer('user_id'),
    requestId: text('request_id').notNull(),
    action: text('action').notNull(),
    entity: text('entity').notNull(),
    entityId: text('entity_id'),
    beforeJson: text('before_json'),
    afterJson: text('after_json'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
  },
  (table) => [
    index('audit_logs_tenant_created_idx').on(table.tenantId, table.createdAt),
    index('audit_logs_tenant_entity_idx').on(table.tenantId, table.entity, table.entityId),
    index('audit_logs_tenant_user_idx').on(table.tenantId, table.userId),
    foreignKey({
      name: 'audit_logs_tenant_branch_fk',
      columns: [table.tenantId, table.branchId],
      foreignColumns: [branches.tenantId, branches.id],
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      name: 'audit_logs_tenant_user_fk',
      columns: [table.tenantId, table.userId],
      foreignColumns: [users.tenantId, users.id],
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
  ],
);

export const securityEvents = sqliteTable(
  'security_events',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    tenantId: integer('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    userId: integer('user_id'),
    requestId: text('request_id').notNull(),
    eventType: text('event_type').notNull(),
    severity: text('severity').notNull().default('warning'),
    metadataJson: text('metadata_json'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
  },
  (table) => [
    index('security_events_tenant_created_idx').on(table.tenantId, table.createdAt),
    index('security_events_tenant_type_idx').on(table.tenantId, table.eventType),
    foreignKey({
      name: 'security_events_tenant_user_fk',
      columns: [table.tenantId, table.userId],
      foreignColumns: [users.tenantId, users.id],
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
  ],
);
