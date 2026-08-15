import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

import { users } from './identity';
import { branches } from './organization';
import { tenants } from './platform';

const createdAt = () =>
  text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`);

const updatedAt = () =>
  text('updated_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`);

export const permissions = sqliteTable(
  'permissions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    code: text('code').notNull(),
    resource: text('resource').notNull(),
    action: text('action').notNull(),
    description: text('description').notNull(),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex('permissions_code_unique').on(table.code)],
);

export const roles = sqliteTable(
  'roles',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    uuid: text('uuid').notNull(),
    tenantId: integer('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    code: text('code').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    isSystem: integer('is_system', { mode: 'boolean' }).notNull().default(false),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('roles_uuid_unique').on(table.uuid),
    uniqueIndex('roles_tenant_code_unique').on(table.tenantId, table.code),
    uniqueIndex('roles_tenant_id_unique').on(table.tenantId, table.id),
    index('roles_tenant_active_idx').on(table.tenantId, table.isActive),
    check('roles_code_lowercase_check', sql`${table.code} = lower(${table.code})`),
  ],
);

export const rolePermissions = sqliteTable(
  'role_permissions',
  {
    tenantId: integer('tenant_id').notNull(),
    roleId: integer('role_id').notNull(),
    permissionId: integer('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.roleId, table.permissionId] }),
    index('role_permissions_permission_idx').on(table.permissionId),
    foreignKey({
      name: 'role_permissions_tenant_role_fk',
      columns: [table.tenantId, table.roleId],
      foreignColumns: [roles.tenantId, roles.id],
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
  ],
);

export const userRoles = sqliteTable(
  'user_roles',
  {
    tenantId: integer('tenant_id').notNull(),
    userId: integer('user_id').notNull(),
    roleId: integer('role_id').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.userId, table.roleId] }),
    index('user_roles_tenant_user_idx').on(table.tenantId, table.userId),
    foreignKey({
      name: 'user_roles_tenant_user_fk',
      columns: [table.tenantId, table.userId],
      foreignColumns: [users.tenantId, users.id],
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    foreignKey({
      name: 'user_roles_tenant_role_fk',
      columns: [table.tenantId, table.roleId],
      foreignColumns: [roles.tenantId, roles.id],
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
  ],
);

export const userBranches = sqliteTable(
  'user_branches',
  {
    tenantId: integer('tenant_id').notNull(),
    userId: integer('user_id').notNull(),
    branchId: integer('branch_id').notNull(),
    isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.userId, table.branchId] }),
    index('user_branches_tenant_user_idx').on(table.tenantId, table.userId),
    uniqueIndex('user_branches_one_default_unique')
      .on(table.tenantId, table.userId)
      .where(sql`${table.isDefault} = 1`),
    foreignKey({
      name: 'user_branches_tenant_user_fk',
      columns: [table.tenantId, table.userId],
      foreignColumns: [users.tenantId, users.id],
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    foreignKey({
      name: 'user_branches_tenant_branch_fk',
      columns: [table.tenantId, table.branchId],
      foreignColumns: [branches.tenantId, branches.id],
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
  ],
);
