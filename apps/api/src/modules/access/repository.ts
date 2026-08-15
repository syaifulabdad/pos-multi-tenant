import type { WorkerBindings } from '../../types';
import type {
  AccessRepository,
  BranchAccess,
  PermissionDeniedEvent,
  SwitchBranchEvent,
} from './domain';

interface PermissionRow {
  readonly code: string;
}

interface BranchRow {
  readonly id: number;
  readonly uuid: string;
  readonly code: string;
  readonly name: string;
  readonly timezone: string;
  readonly is_default: number;
}

function mapBranch(row: BranchRow): BranchAccess {
  return {
    id: row.id,
    uuid: row.uuid,
    code: row.code,
    name: row.name,
    timezone: row.timezone,
    isDefault: row.is_default === 1,
  };
}

export class D1AccessRepository implements AccessRepository {
  constructor(private readonly database: WorkerBindings['DB']) {}

  async listPermissionCodes(tenantId: number, userId: number): Promise<readonly string[]> {
    const result = await this.database
      .prepare(
        `SELECT DISTINCT p.code
         FROM user_roles ur
         INNER JOIN roles r
           ON r.tenant_id = ur.tenant_id AND r.id = ur.role_id AND r.is_active = 1
         INNER JOIN role_permissions rp
           ON rp.tenant_id = r.tenant_id AND rp.role_id = r.id
         INNER JOIN permissions p ON p.id = rp.permission_id
         WHERE ur.tenant_id = ?1 AND ur.user_id = ?2
         ORDER BY p.code ASC`,
      )
      .bind(tenantId, userId)
      .all<PermissionRow>();

    return result.results.map((row) => row.code);
  }

  async listAssignedBranches(tenantId: number, userId: number): Promise<readonly BranchAccess[]> {
    const result = await this.database
      .prepare(
        `SELECT b.id, b.uuid, b.code, b.name, b.timezone, ub.is_default
         FROM user_branches ub
         INNER JOIN branches b
           ON b.tenant_id = ub.tenant_id AND b.id = ub.branch_id
         WHERE ub.tenant_id = ?1 AND ub.user_id = ?2 AND b.status = 'active'
         ORDER BY ub.is_default DESC, b.code ASC, b.id ASC`,
      )
      .bind(tenantId, userId)
      .all<BranchRow>();

    return result.results.map(mapBranch);
  }

  async findAssignedBranch(
    tenantId: number,
    userId: number,
    branchUuid: string,
  ): Promise<BranchAccess | null> {
    const row = await this.database
      .prepare(
        `SELECT b.id, b.uuid, b.code, b.name, b.timezone, ub.is_default
         FROM user_branches ub
         INNER JOIN branches b
           ON b.tenant_id = ub.tenant_id AND b.id = ub.branch_id
         WHERE ub.tenant_id = ?1 AND ub.user_id = ?2
           AND b.uuid = ?3 AND b.status = 'active'
         LIMIT 1`,
      )
      .bind(tenantId, userId, branchUuid)
      .first<BranchRow>();

    return row === null ? null : mapBranch(row);
  }

  async switchSessionBranch(event: SwitchBranchEvent): Promise<boolean> {
    const result = await this.database.batch([
      this.database
        .prepare(
          `UPDATE sessions
           SET active_branch_id = ?1
           WHERE tenant_id = ?2 AND id = ?3 AND user_id = ?4
             AND revoked_at IS NULL AND expires_at > ?5
             AND EXISTS (
               SELECT 1 FROM user_branches ub
               INNER JOIN branches b
                 ON b.tenant_id = ub.tenant_id AND b.id = ub.branch_id
               WHERE ub.tenant_id = ?2 AND ub.user_id = ?4
                 AND ub.branch_id = ?1 AND b.status = 'active'
             )`,
        )
        .bind(event.branch.id, event.tenantId, event.sessionId, event.userId, event.occurredAt),
      this.database
        .prepare(
          `INSERT INTO audit_logs
             (tenant_id, branch_id, user_id, request_id, action, entity, entity_id,
              after_json, ip_address, user_agent, created_at)
           SELECT ?1, ?2, ?3, ?4, 'BRANCH_SWITCH', 'session', ?5, ?6, ?7, ?8, ?9
           WHERE EXISTS (
             SELECT 1 FROM user_branches ub
             INNER JOIN branches b
               ON b.tenant_id = ub.tenant_id AND b.id = ub.branch_id
             WHERE ub.tenant_id = ?1 AND ub.user_id = ?3
               AND ub.branch_id = ?2 AND b.status = 'active'
           )
           AND EXISTS (
             SELECT 1 FROM sessions s
             WHERE s.tenant_id = ?1 AND s.id = ?5 AND s.user_id = ?3
               AND s.revoked_at IS NULL AND s.expires_at > ?9
           )`,
        )
        .bind(
          event.tenantId,
          event.branch.id,
          event.userId,
          event.requestId,
          event.sessionId,
          JSON.stringify({ branch_id: event.branch.uuid }),
          event.ipAddress,
          event.userAgent,
          event.occurredAt,
        ),
    ]);

    return (result[0]?.meta.changes ?? 0) === 1;
  }

  async recordPermissionDenied(event: PermissionDeniedEvent): Promise<void> {
    await this.database
      .prepare(
        `INSERT INTO security_events
           (tenant_id, user_id, request_id, event_type, severity, metadata_json,
            ip_address, user_agent)
         VALUES (?1, ?2, ?3, 'permission_denied', 'warning', ?4, ?5, ?6)`,
      )
      .bind(
        event.tenantId,
        event.userId,
        event.requestId,
        JSON.stringify({
          permission: event.permission,
          route: event.route,
          branch_id: event.branchId,
        }),
        event.ipAddress,
        event.userAgent,
      )
      .run();
  }
}
