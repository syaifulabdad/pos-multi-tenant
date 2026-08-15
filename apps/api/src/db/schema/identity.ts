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

import { branches } from './organization';
import { tenants } from './platform';

export const USER_STATUSES = ['invited', 'active', 'disabled'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

const createdAt = () =>
  text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`);

const updatedAt = () =>
  text('updated_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`);

export const users = sqliteTable(
  'users',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    uuid: text('uuid').notNull(),
    tenantId: integer('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    email: text('email').notNull(),
    name: text('name').notNull(),
    passwordHash: text('password_hash').notNull(),
    status: text('status').$type<UserStatus>().notNull().default('invited'),
    failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
    lockedUntil: text('locked_until'),
    passwordChangedAt: text('password_changed_at'),
    lastLoginAt: text('last_login_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('users_uuid_unique').on(table.uuid),
    uniqueIndex('users_tenant_email_unique').on(table.tenantId, table.email),
    uniqueIndex('users_tenant_id_unique').on(table.tenantId, table.id),
    index('users_tenant_status_idx').on(table.tenantId, table.status),
    check('users_email_lowercase_check', sql`${table.email} = lower(${table.email})`),
    check('users_failed_login_attempts_check', sql`${table.failedLoginAttempts} >= 0`),
    check('users_status_check', sql`${table.status} IN ('invited', 'active', 'disabled')`),
  ],
);

export const sessions = sqliteTable(
  'sessions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    uuid: text('uuid').notNull(),
    tenantId: integer('tenant_id').notNull(),
    userId: integer('user_id').notNull(),
    activeBranchId: integer('active_branch_id'),
    tokenHash: text('token_hash').notNull(),
    expiresAt: text('expires_at').notNull(),
    lastSeenAt: text('last_seen_at').notNull(),
    revokedAt: text('revoked_at'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('sessions_uuid_unique').on(table.uuid),
    uniqueIndex('sessions_token_hash_unique').on(table.tokenHash),
    index('sessions_tenant_user_idx').on(table.tenantId, table.userId),
    index('sessions_expiry_idx').on(table.expiresAt),
    foreignKey({
      name: 'sessions_tenant_user_fk',
      columns: [table.tenantId, table.userId],
      foreignColumns: [users.tenantId, users.id],
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    foreignKey({
      name: 'sessions_tenant_branch_fk',
      columns: [table.tenantId, table.activeBranchId],
      foreignColumns: [branches.tenantId, branches.id],
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
  ],
);

export const loginHistory = sqliteTable(
  'login_history',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    tenantId: integer('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    userId: integer('user_id'),
    emailHash: text('email_hash').notNull(),
    success: integer('success', { mode: 'boolean' }).notNull(),
    failureReason: text('failure_reason'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    requestId: text('request_id').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index('login_history_tenant_created_idx').on(table.tenantId, table.createdAt),
    index('login_history_tenant_user_idx').on(table.tenantId, table.userId),
    foreignKey({
      name: 'login_history_tenant_user_fk',
      columns: [table.tenantId, table.userId],
      foreignColumns: [users.tenantId, users.id],
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
  ],
);
