import type { ClientMetadata } from '../auth/domain';

export type ManagedUserStatus = 'invited' | 'active' | 'disabled';

export interface AdminPermissionRecord {
  readonly id: number;
  readonly code: string;
  readonly description: string;
}

export interface AdminRoleRecord {
  readonly id: number;
  readonly uuid: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly isSystem: boolean;
  readonly isActive: boolean;
  readonly permissions: readonly string[];
}

export interface AdminBranchRecord {
  readonly id: number;
  readonly uuid: string;
  readonly code: string;
  readonly name: string;
}

export interface AdminUserRecord {
  readonly id: number;
  readonly uuid: string;
  readonly email: string;
  readonly name: string;
  readonly status: ManagedUserStatus;
  readonly roles: readonly AdminRoleRecord[];
  readonly branches: readonly AdminBranchRecord[];
  readonly createdAt: string;
  readonly lastLoginAt: string | null;
}

export interface UserDirectoryRecord {
  readonly users: readonly AdminUserRecord[];
  readonly roles: readonly AdminRoleRecord[];
  readonly branches: readonly AdminBranchRecord[];
}

export interface RoleDirectoryRecord {
  readonly roles: readonly AdminRoleRecord[];
  readonly permissions: readonly AdminPermissionRecord[];
}

export interface SecurityEventRecord {
  readonly eventType: string;
  readonly severity: string;
  readonly requestId: string;
  readonly userUuid: string | null;
  readonly userEmail: string | null;
  readonly metadataJson: string | null;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly createdAt: string;
}

interface AdminMutationEvent extends ClientMetadata {
  readonly tenantId: number;
  readonly actorUserId: number;
  readonly requestId: string;
  readonly occurredAt: string;
}

export interface CreateManagedUserEvent extends AdminMutationEvent {
  readonly targetUuid: string;
  readonly email: string;
  readonly name: string;
  readonly passwordHash: string;
  readonly roleIds: readonly number[];
  readonly roleUuids: readonly string[];
  readonly branchIds: readonly number[];
  readonly branchUuids: readonly string[];
}

export interface UpdateManagedUserEvent extends AdminMutationEvent {
  readonly targetId: number;
  readonly targetUuid: string;
  readonly name: string;
  readonly status: 'active' | 'disabled';
  readonly roleIds: readonly number[];
  readonly roleUuids: readonly string[];
  readonly branchIds: readonly number[];
  readonly branchUuids: readonly string[];
  readonly before: Readonly<Record<string, unknown>>;
}

export interface CreateManagedRoleEvent extends AdminMutationEvent {
  readonly targetUuid: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly permissionIds: readonly number[];
  readonly permissionCodes: readonly string[];
}

export interface UpdateManagedRoleEvent extends AdminMutationEvent {
  readonly targetId: number;
  readonly targetUuid: string;
  readonly name: string;
  readonly description: string | null;
  readonly isActive: boolean;
  readonly permissionIds: readonly number[];
  readonly permissionCodes: readonly string[];
  readonly before: Readonly<Record<string, unknown>>;
}

export interface AdminRepository {
  loadUserDirectory(tenantId: number): Promise<UserDirectoryRecord>;
  loadRoleDirectory(tenantId: number): Promise<RoleDirectoryRecord>;
  findUser(tenantId: number, userUuid: string): Promise<AdminUserRecord | null>;
  findRole(tenantId: number, roleUuid: string): Promise<AdminRoleRecord | null>;
  createUser(event: CreateManagedUserEvent): Promise<boolean>;
  updateUser(event: UpdateManagedUserEvent): Promise<boolean>;
  createRole(event: CreateManagedRoleEvent): Promise<boolean>;
  updateRole(event: UpdateManagedRoleEvent): Promise<boolean>;
  listSecurityEvents(tenantId: number, limit: number): Promise<readonly SecurityEventRecord[]>;
}
