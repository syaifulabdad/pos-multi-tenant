import type {
  AdminBranchSummaryData,
  AdminRoleSummaryData,
  AdminUserData,
  RoleDirectoryData,
  SecurityEventData,
  UserDirectoryData,
} from '@pos/contracts';

import { AppError, ValidationError } from '../../lib/errors';
import { hashPassword } from '../../security/crypto';
import type { ClientMetadata } from '../auth/domain';
import type {
  AdminBranchRecord,
  AdminPermissionRecord,
  AdminRepository,
  AdminRoleRecord,
  AdminUserRecord,
} from './domain';
import type {
  CreateRoleInput,
  CreateUserInput,
  UpdateRoleInput,
  UpdateUserInput,
} from './validation';

interface AdminRequestContext extends ClientMetadata {
  readonly tenantId: number;
  readonly actorUserId: number;
  readonly actorUserUuid: string;
  readonly requestId: string;
}

class AdminResourceNotFoundError extends AppError {
  constructor(resource: 'User' | 'Role') {
    super({
      status: 404,
      code: `${resource.toUpperCase()}_NOT_FOUND`,
      message: `${resource} not found`,
    });
  }
}

class AdminConflictError extends AppError {
  constructor(code: string, message: string) {
    super({ status: 409, code, message });
  }
}

function mapRole(role: AdminRoleRecord): AdminRoleSummaryData {
  return {
    id: role.uuid,
    code: role.code,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    isActive: role.isActive,
    permissions: role.permissions,
  };
}

function mapBranch(branch: AdminBranchRecord): AdminBranchSummaryData {
  return { id: branch.uuid, code: branch.code, name: branch.name };
}

function mapUser(user: AdminUserRecord): AdminUserData {
  return {
    id: user.uuid,
    email: user.email,
    name: user.name,
    status: user.status,
    roles: user.roles.map(mapRole),
    branches: user.branches.map(mapBranch),
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

function resolveByUuid<T extends { readonly id: number; readonly uuid: string }>(
  requested: readonly string[],
  available: readonly T[],
  field: string,
): readonly T[] {
  const byUuid = new Map(available.map((record) => [record.uuid, record]));
  const resolved = requested.map((uuid) => byUuid.get(uuid));
  if (resolved.some((record) => record === undefined)) {
    throw new ValidationError({ [field]: [`${field} contains an unavailable tenant resource`] });
  }
  return resolved as readonly T[];
}

function resolvePermissionIds(
  requested: readonly string[],
  available: readonly AdminPermissionRecord[],
): readonly number[] {
  const byCode = new Map(available.map((permission) => [permission.code, permission.id]));
  const ids: number[] = [];
  for (const code of requested) {
    const id = byCode.get(code);
    if (id === undefined) {
      throw new ValidationError({
        permissionCodes: ['permissionCodes contains an unknown permission'],
      });
    }
    ids.push(id);
  }
  return ids;
}

function parseMetadata(value: string | null): Readonly<Record<string, unknown>> | null {
  if (value === null) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Readonly<Record<string, unknown>>)
      : null;
  } catch {
    return null;
  }
}

export class AdminService {
  constructor(
    private readonly repository: AdminRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async userDirectory(tenantId: number): Promise<UserDirectoryData> {
    const directory = await this.repository.loadUserDirectory(tenantId);
    return {
      users: directory.users.map(mapUser),
      roles: directory.roles.map(mapRole),
      branches: directory.branches.map(mapBranch),
    };
  }

  async roleDirectory(tenantId: number): Promise<RoleDirectoryData> {
    const directory = await this.repository.loadRoleDirectory(tenantId);
    return {
      roles: directory.roles.map(mapRole),
      permissions: directory.permissions.map((permission) => ({
        code: permission.code,
        description: permission.description,
      })),
    };
  }

  async createUser(input: CreateUserInput, context: AdminRequestContext): Promise<AdminUserData> {
    const directory = await this.repository.loadUserDirectory(context.tenantId);
    const roles = resolveByUuid(
      input.roleIds,
      directory.roles.filter((role) => role.isActive),
      'roleIds',
    );
    const branches = resolveByUuid(input.branchIds, directory.branches, 'branchIds');
    const targetUuid = crypto.randomUUID();
    const occurredAt = this.now().toISOString();
    const created = await this.repository.createUser({
      ...context,
      targetUuid,
      email: input.email,
      name: input.name,
      passwordHash: await hashPassword(input.password),
      roleIds: roles.map((role) => role.id),
      roleUuids: roles.map((role) => role.uuid),
      branchIds: branches.map((branch) => branch.id),
      branchUuids: branches.map((branch) => branch.uuid),
      occurredAt,
    });
    if (!created) throw new AdminConflictError('EMAIL_ALREADY_EXISTS', 'Email already exists');

    const user = await this.repository.findUser(context.tenantId, targetUuid);
    if (user === null) throw new AdminResourceNotFoundError('User');
    return mapUser(user);
  }

  async updateUser(
    targetUuid: string,
    input: UpdateUserInput,
    context: AdminRequestContext,
  ): Promise<AdminUserData> {
    if (targetUuid === context.actorUserUuid) {
      throw new AdminConflictError(
        'SELF_MANAGEMENT_NOT_ALLOWED',
        'Use dedicated account settings to change your own access',
      );
    }
    const [target, directory] = await Promise.all([
      this.repository.findUser(context.tenantId, targetUuid),
      this.repository.loadUserDirectory(context.tenantId),
    ]);
    if (target === null) throw new AdminResourceNotFoundError('User');
    const roles = resolveByUuid(input.roleIds, directory.roles, 'roleIds');
    const branches = resolveByUuid(input.branchIds, directory.branches, 'branchIds');
    const updated = await this.repository.updateUser({
      ...context,
      targetId: target.id,
      targetUuid: target.uuid,
      name: input.name,
      status: input.status,
      roleIds: roles.map((role) => role.id),
      roleUuids: roles.map((role) => role.uuid),
      branchIds: branches.map((branch) => branch.id),
      branchUuids: branches.map((branch) => branch.uuid),
      before: {
        name: target.name,
        status: target.status,
        roles: target.roles.map((role) => role.uuid),
        branches: target.branches.map((branch) => branch.uuid),
      },
      occurredAt: this.now().toISOString(),
    });
    if (!updated) throw new AdminResourceNotFoundError('User');
    const user = await this.repository.findUser(context.tenantId, targetUuid);
    if (user === null) throw new AdminResourceNotFoundError('User');
    return mapUser(user);
  }

  async createRole(
    input: CreateRoleInput,
    context: AdminRequestContext,
  ): Promise<AdminRoleSummaryData> {
    const directory = await this.repository.loadRoleDirectory(context.tenantId);
    const permissionIds = resolvePermissionIds(input.permissionCodes, directory.permissions);
    const targetUuid = crypto.randomUUID();
    const created = await this.repository.createRole({
      ...context,
      targetUuid,
      code: input.code,
      name: input.name,
      description: input.description,
      permissionIds,
      permissionCodes: input.permissionCodes,
      occurredAt: this.now().toISOString(),
    });
    if (!created) throw new AdminConflictError('ROLE_CODE_EXISTS', 'Role code already exists');
    const role = await this.repository.findRole(context.tenantId, targetUuid);
    if (role === null) throw new AdminResourceNotFoundError('Role');
    return mapRole(role);
  }

  async updateRole(
    targetUuid: string,
    input: UpdateRoleInput,
    context: AdminRequestContext,
  ): Promise<AdminRoleSummaryData> {
    const [target, directory] = await Promise.all([
      this.repository.findRole(context.tenantId, targetUuid),
      this.repository.loadRoleDirectory(context.tenantId),
    ]);
    if (target === null) throw new AdminResourceNotFoundError('Role');
    if (target.isSystem) {
      throw new AdminConflictError('SYSTEM_ROLE_PROTECTED', 'System roles cannot be modified');
    }
    const permissionIds = resolvePermissionIds(input.permissionCodes, directory.permissions);
    const updated = await this.repository.updateRole({
      ...context,
      targetId: target.id,
      targetUuid: target.uuid,
      name: input.name,
      description: input.description,
      isActive: input.isActive,
      permissionIds,
      permissionCodes: input.permissionCodes,
      before: {
        name: target.name,
        description: target.description,
        is_active: target.isActive,
        permissions: target.permissions,
      },
      occurredAt: this.now().toISOString(),
    });
    if (!updated) throw new AdminResourceNotFoundError('Role');
    const role = await this.repository.findRole(context.tenantId, targetUuid);
    if (role === null) throw new AdminResourceNotFoundError('Role');
    return mapRole(role);
  }

  async securityEvents(tenantId: number, limit: number): Promise<readonly SecurityEventData[]> {
    const events = await this.repository.listSecurityEvents(tenantId, limit);
    return events.map((event) => ({
      type: event.eventType,
      severity: event.severity,
      requestId: event.requestId,
      user:
        event.userUuid === null || event.userEmail === null
          ? null
          : { id: event.userUuid, email: event.userEmail },
      metadata: parseMetadata(event.metadataJson),
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      createdAt: event.createdAt,
    }));
  }
}
