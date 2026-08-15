import type { WorkerBindings } from '../../types';
import type {
  AdminBranchRecord,
  AdminPermissionRecord,
  AdminRepository,
  AdminRoleRecord,
  AdminUserRecord,
  CreateManagedRoleEvent,
  CreateManagedUserEvent,
  ManagedUserStatus,
  RoleDirectoryRecord,
  SecurityEventRecord,
  UpdateManagedRoleEvent,
  UpdateManagedUserEvent,
  UserDirectoryRecord,
} from './domain';

interface UserRow {
  readonly id: number;
  readonly uuid: string;
  readonly email: string;
  readonly name: string;
  readonly status: ManagedUserStatus;
  readonly created_at: string;
  readonly last_login_at: string | null;
}

interface RoleRow {
  readonly id: number;
  readonly uuid: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly is_system: number;
  readonly is_active: number;
}

interface PermissionRow {
  readonly id: number;
  readonly code: string;
  readonly description: string;
}

interface RolePermissionRow {
  readonly role_id: number;
  readonly code: string;
}

interface BranchRow {
  readonly id: number;
  readonly uuid: string;
  readonly code: string;
  readonly name: string;
}

interface UserRoleRow {
  readonly user_id: number;
  readonly role_id: number;
}

interface UserBranchRow {
  readonly user_id: number;
  readonly branch_id: number;
}

interface SecurityEventRow {
  readonly event_type: string;
  readonly severity: string;
  readonly request_id: string;
  readonly user_uuid: string | null;
  readonly user_email: string | null;
  readonly metadata_json: string | null;
  readonly ip_address: string | null;
  readonly user_agent: string | null;
  readonly created_at: string;
}

function mapBranch(row: BranchRow): AdminBranchRecord {
  return { id: row.id, uuid: row.uuid, code: row.code, name: row.name };
}

function mapRole(row: RoleRow, permissions: readonly string[]): AdminRoleRecord {
  return {
    id: row.id,
    uuid: row.uuid,
    code: row.code,
    name: row.name,
    description: row.description,
    isSystem: row.is_system === 1,
    isActive: row.is_active === 1,
    permissions,
  };
}

export class D1AdminRepository implements AdminRepository {
  constructor(private readonly database: WorkerBindings['DB']) {}

  private async listRoles(tenantId: number): Promise<readonly AdminRoleRecord[]> {
    const [roleResult, assignmentResult] = await Promise.all([
      this.database
        .prepare(
          `SELECT id, uuid, code, name, description, is_system, is_active
           FROM roles
           WHERE tenant_id = ?1
           ORDER BY is_system DESC, name ASC, id ASC`,
        )
        .bind(tenantId)
        .all<RoleRow>(),
      this.database
        .prepare(
          `SELECT rp.role_id, p.code
           FROM role_permissions rp
           INNER JOIN permissions p ON p.id = rp.permission_id
           WHERE rp.tenant_id = ?1
           ORDER BY p.code ASC`,
        )
        .bind(tenantId)
        .all<RolePermissionRow>(),
    ]);

    const permissionsByRole = new Map<number, string[]>();
    for (const assignment of assignmentResult.results) {
      const permissions = permissionsByRole.get(assignment.role_id) ?? [];
      permissions.push(assignment.code);
      permissionsByRole.set(assignment.role_id, permissions);
    }
    return roleResult.results.map((row) => mapRole(row, permissionsByRole.get(row.id) ?? []));
  }

  private async listBranches(tenantId: number): Promise<readonly AdminBranchRecord[]> {
    const result = await this.database
      .prepare(
        `SELECT id, uuid, code, name
         FROM branches
         WHERE tenant_id = ?1 AND status = 'active'
         ORDER BY code ASC, id ASC`,
      )
      .bind(tenantId)
      .all<BranchRow>();
    return result.results.map(mapBranch);
  }

  async loadUserDirectory(tenantId: number): Promise<UserDirectoryRecord> {
    const [userResult, roles, branches, userRoleResult, userBranchResult] = await Promise.all([
      this.database
        .prepare(
          `SELECT id, uuid, email, name, status, created_at, last_login_at
           FROM users
           WHERE tenant_id = ?1
           ORDER BY name ASC, id ASC`,
        )
        .bind(tenantId)
        .all<UserRow>(),
      this.listRoles(tenantId),
      this.listBranches(tenantId),
      this.database
        .prepare(
          `SELECT user_id, role_id
           FROM user_roles
           WHERE tenant_id = ?1
           ORDER BY user_id ASC, role_id ASC`,
        )
        .bind(tenantId)
        .all<UserRoleRow>(),
      this.database
        .prepare(
          `SELECT user_id, branch_id
           FROM user_branches
           WHERE tenant_id = ?1
           ORDER BY user_id ASC, is_default DESC, branch_id ASC`,
        )
        .bind(tenantId)
        .all<UserBranchRow>(),
    ]);

    const roleById = new Map(roles.map((role) => [role.id, role]));
    const branchById = new Map(branches.map((branch) => [branch.id, branch]));
    const rolesByUser = new Map<number, AdminRoleRecord[]>();
    const branchesByUser = new Map<number, AdminBranchRecord[]>();

    for (const assignment of userRoleResult.results) {
      const role = roleById.get(assignment.role_id);
      if (role === undefined) continue;
      const assigned = rolesByUser.get(assignment.user_id) ?? [];
      assigned.push(role);
      rolesByUser.set(assignment.user_id, assigned);
    }
    for (const assignment of userBranchResult.results) {
      const branch = branchById.get(assignment.branch_id);
      if (branch === undefined) continue;
      const assigned = branchesByUser.get(assignment.user_id) ?? [];
      assigned.push(branch);
      branchesByUser.set(assignment.user_id, assigned);
    }

    const users: AdminUserRecord[] = userResult.results.map((row) => ({
      id: row.id,
      uuid: row.uuid,
      email: row.email,
      name: row.name,
      status: row.status,
      roles: rolesByUser.get(row.id) ?? [],
      branches: branchesByUser.get(row.id) ?? [],
      createdAt: row.created_at,
      lastLoginAt: row.last_login_at,
    }));
    return { users, roles, branches };
  }

  async loadRoleDirectory(tenantId: number): Promise<RoleDirectoryRecord> {
    const [roles, permissionResult] = await Promise.all([
      this.listRoles(tenantId),
      this.database
        .prepare('SELECT id, code, description FROM permissions ORDER BY code ASC')
        .all<PermissionRow>(),
    ]);
    const permissions: AdminPermissionRecord[] = permissionResult.results.map((row) => ({
      id: row.id,
      code: row.code,
      description: row.description,
    }));
    return { roles, permissions };
  }

  async findUser(tenantId: number, userUuid: string): Promise<AdminUserRecord | null> {
    const directory = await this.loadUserDirectory(tenantId);
    return directory.users.find((user) => user.uuid === userUuid) ?? null;
  }

  async findRole(tenantId: number, roleUuid: string): Promise<AdminRoleRecord | null> {
    const roles = await this.listRoles(tenantId);
    return roles.find((role) => role.uuid === roleUuid) ?? null;
  }

  async createUser(event: CreateManagedUserEvent): Promise<boolean> {
    const statements: D1PreparedStatement[] = [
      this.database
        .prepare(
          `INSERT INTO users
             (uuid, tenant_id, email, name, password_hash, status, password_changed_at,
              created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, 'active', ?6, ?6, ?6)
           ON CONFLICT DO NOTHING`,
        )
        .bind(
          event.targetUuid,
          event.tenantId,
          event.email,
          event.name,
          event.passwordHash,
          event.occurredAt,
        ),
    ];

    for (const roleId of event.roleIds) {
      statements.push(
        this.database
          .prepare(
            `INSERT INTO user_roles (tenant_id, user_id, role_id, created_at)
             SELECT ?1, u.id, r.id, ?4
             FROM users u
             INNER JOIN roles r ON r.tenant_id = u.tenant_id AND r.id = ?3 AND r.is_active = 1
             WHERE u.tenant_id = ?1 AND u.uuid = ?2`,
          )
          .bind(event.tenantId, event.targetUuid, roleId, event.occurredAt),
      );
    }
    for (const [index, branchId] of event.branchIds.entries()) {
      statements.push(
        this.database
          .prepare(
            `INSERT INTO user_branches
               (tenant_id, user_id, branch_id, is_default, created_at)
             SELECT ?1, u.id, b.id, ?4, ?5
             FROM users u
             INNER JOIN branches b
               ON b.tenant_id = u.tenant_id AND b.id = ?3 AND b.status = 'active'
             WHERE u.tenant_id = ?1 AND u.uuid = ?2`,
          )
          .bind(event.tenantId, event.targetUuid, branchId, index === 0 ? 1 : 0, event.occurredAt),
      );
    }

    statements.push(
      this.database
        .prepare(
          `INSERT INTO audit_logs
             (tenant_id, user_id, request_id, action, entity, entity_id, after_json,
              ip_address, user_agent, created_at)
           SELECT ?1, ?2, ?3, 'CREATE', 'user', ?4, ?5, ?6, ?7, ?8
           FROM users target
           WHERE target.tenant_id = ?1 AND target.uuid = ?4`,
        )
        .bind(
          event.tenantId,
          event.actorUserId,
          event.requestId,
          event.targetUuid,
          JSON.stringify({
            email: event.email,
            name: event.name,
            status: 'active',
            roles: event.roleUuids,
            branches: event.branchUuids,
          }),
          event.ipAddress,
          event.userAgent,
          event.occurredAt,
        ),
    );

    const result = await this.database.batch(statements);
    return (result[0]?.meta.changes ?? 0) === 1;
  }

  async updateUser(event: UpdateManagedUserEvent): Promise<boolean> {
    const statements: D1PreparedStatement[] = [
      this.database
        .prepare(
          `UPDATE users
           SET name = ?1, status = ?2, updated_at = ?3
           WHERE tenant_id = ?4 AND id = ?5 AND uuid = ?6`,
        )
        .bind(
          event.name,
          event.status,
          event.occurredAt,
          event.tenantId,
          event.targetId,
          event.targetUuid,
        ),
      this.database
        .prepare('DELETE FROM user_roles WHERE tenant_id = ?1 AND user_id = ?2')
        .bind(event.tenantId, event.targetId),
      this.database
        .prepare('DELETE FROM user_branches WHERE tenant_id = ?1 AND user_id = ?2')
        .bind(event.tenantId, event.targetId),
    ];

    for (const roleId of event.roleIds) {
      statements.push(
        this.database
          .prepare(
            `INSERT INTO user_roles (tenant_id, user_id, role_id, created_at)
             SELECT ?1, ?2, r.id, ?4
             FROM roles r
             WHERE r.tenant_id = ?1 AND r.id = ?3`,
          )
          .bind(event.tenantId, event.targetId, roleId, event.occurredAt),
      );
    }
    for (const [index, branchId] of event.branchIds.entries()) {
      statements.push(
        this.database
          .prepare(
            `INSERT INTO user_branches
               (tenant_id, user_id, branch_id, is_default, created_at)
             SELECT ?1, ?2, b.id, ?4, ?5
             FROM branches b
             WHERE b.tenant_id = ?1 AND b.id = ?3 AND b.status = 'active'`,
          )
          .bind(event.tenantId, event.targetId, branchId, index === 0 ? 1 : 0, event.occurredAt),
      );
    }
    if (event.status === 'disabled') {
      statements.push(
        this.database
          .prepare(
            `UPDATE sessions
             SET revoked_at = ?1
             WHERE tenant_id = ?2 AND user_id = ?3 AND revoked_at IS NULL`,
          )
          .bind(event.occurredAt, event.tenantId, event.targetId),
      );
    }
    statements.push(
      this.database
        .prepare(
          `INSERT INTO audit_logs
             (tenant_id, user_id, request_id, action, entity, entity_id, before_json,
              after_json, ip_address, user_agent, created_at)
           SELECT ?1, ?2, ?3, 'UPDATE', 'user', ?4, ?5, ?6, ?7, ?8, ?9
           WHERE EXISTS (
             SELECT 1 FROM users target
             WHERE target.tenant_id = ?1 AND target.id = ?10 AND target.uuid = ?4
           )`,
        )
        .bind(
          event.tenantId,
          event.actorUserId,
          event.requestId,
          event.targetUuid,
          JSON.stringify(event.before),
          JSON.stringify({
            name: event.name,
            status: event.status,
            roles: event.roleUuids,
            branches: event.branchUuids,
          }),
          event.ipAddress,
          event.userAgent,
          event.occurredAt,
          event.targetId,
        ),
    );

    const result = await this.database.batch(statements);
    return (result[0]?.meta.changes ?? 0) === 1;
  }

  async createRole(event: CreateManagedRoleEvent): Promise<boolean> {
    const statements: D1PreparedStatement[] = [
      this.database
        .prepare(
          `INSERT INTO roles
             (uuid, tenant_id, code, name, description, is_system, is_active, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, 0, 1, ?6, ?6)
           ON CONFLICT DO NOTHING`,
        )
        .bind(
          event.targetUuid,
          event.tenantId,
          event.code,
          event.name,
          event.description,
          event.occurredAt,
        ),
    ];
    for (const permissionId of event.permissionIds) {
      statements.push(
        this.database
          .prepare(
            `INSERT INTO role_permissions (tenant_id, role_id, permission_id, created_at)
             SELECT ?1, r.id, p.id, ?5
             FROM roles r
             INNER JOIN permissions p ON p.id = ?4
             WHERE r.tenant_id = ?1 AND r.uuid = ?2 AND r.code = ?3`,
          )
          .bind(event.tenantId, event.targetUuid, event.code, permissionId, event.occurredAt),
      );
    }
    statements.push(
      this.database
        .prepare(
          `INSERT INTO audit_logs
             (tenant_id, user_id, request_id, action, entity, entity_id, after_json,
              ip_address, user_agent, created_at)
           SELECT ?1, ?2, ?3, 'PERMISSION_CHANGE', 'role', ?4, ?5, ?6, ?7, ?8
           FROM roles target
           WHERE target.tenant_id = ?1 AND target.uuid = ?4`,
        )
        .bind(
          event.tenantId,
          event.actorUserId,
          event.requestId,
          event.targetUuid,
          JSON.stringify({
            code: event.code,
            name: event.name,
            description: event.description,
            is_active: true,
            permissions: event.permissionCodes,
          }),
          event.ipAddress,
          event.userAgent,
          event.occurredAt,
        ),
    );
    const result = await this.database.batch(statements);
    return (result[0]?.meta.changes ?? 0) === 1;
  }

  async updateRole(event: UpdateManagedRoleEvent): Promise<boolean> {
    const statements: D1PreparedStatement[] = [
      this.database
        .prepare(
          `UPDATE roles
           SET name = ?1, description = ?2, is_active = ?3, updated_at = ?4
           WHERE tenant_id = ?5 AND id = ?6 AND uuid = ?7`,
        )
        .bind(
          event.name,
          event.description,
          event.isActive ? 1 : 0,
          event.occurredAt,
          event.tenantId,
          event.targetId,
          event.targetUuid,
        ),
      this.database
        .prepare('DELETE FROM role_permissions WHERE tenant_id = ?1 AND role_id = ?2')
        .bind(event.tenantId, event.targetId),
    ];
    for (const permissionId of event.permissionIds) {
      statements.push(
        this.database
          .prepare(
            `INSERT INTO role_permissions (tenant_id, role_id, permission_id, created_at)
             SELECT ?1, ?2, p.id, ?4 FROM permissions p WHERE p.id = ?3`,
          )
          .bind(event.tenantId, event.targetId, permissionId, event.occurredAt),
      );
    }
    statements.push(
      this.database
        .prepare(
          `INSERT INTO audit_logs
             (tenant_id, user_id, request_id, action, entity, entity_id, before_json,
              after_json, ip_address, user_agent, created_at)
           SELECT ?1, ?2, ?3, 'PERMISSION_CHANGE', 'role', ?4, ?5, ?6, ?7, ?8, ?9
           WHERE EXISTS (
             SELECT 1 FROM roles target
             WHERE target.tenant_id = ?1 AND target.id = ?10 AND target.uuid = ?4
           )`,
        )
        .bind(
          event.tenantId,
          event.actorUserId,
          event.requestId,
          event.targetUuid,
          JSON.stringify(event.before),
          JSON.stringify({
            name: event.name,
            description: event.description,
            is_active: event.isActive,
            permissions: event.permissionCodes,
          }),
          event.ipAddress,
          event.userAgent,
          event.occurredAt,
          event.targetId,
        ),
    );
    const result = await this.database.batch(statements);
    return (result[0]?.meta.changes ?? 0) === 1;
  }

  async listSecurityEvents(
    tenantId: number,
    limit: number,
  ): Promise<readonly SecurityEventRecord[]> {
    const result = await this.database
      .prepare(
        `SELECT se.event_type, se.severity, se.request_id,
                u.uuid AS user_uuid, u.email AS user_email,
                se.metadata_json, se.ip_address, se.user_agent, se.created_at
         FROM security_events se
         LEFT JOIN users u ON u.tenant_id = se.tenant_id AND u.id = se.user_id
         WHERE se.tenant_id = ?1
         ORDER BY se.created_at DESC, se.id DESC
         LIMIT ?2`,
      )
      .bind(tenantId, limit)
      .all<SecurityEventRow>();
    return result.results.map((row) => ({
      eventType: row.event_type,
      severity: row.severity,
      requestId: row.request_id,
      userUuid: row.user_uuid,
      userEmail: row.user_email,
      metadataJson: row.metadata_json,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: row.created_at,
    }));
  }
}
