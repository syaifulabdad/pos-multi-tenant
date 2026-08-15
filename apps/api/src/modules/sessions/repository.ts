import type { WorkerBindings } from '../../types';
import type {
  ManagedSessionRecord,
  RevokeManagedSessionEvent,
  SessionManagementRepository,
} from './domain';

interface SessionRow {
  readonly id: number;
  readonly uuid: string;
  readonly created_at: string;
  readonly last_seen_at: string;
  readonly expires_at: string;
  readonly user_agent: string | null;
}

function mapSession(row: SessionRow): ManagedSessionRecord {
  return {
    id: row.id,
    uuid: row.uuid,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    expiresAt: row.expires_at,
    userAgent: row.user_agent,
  };
}

export class D1SessionManagementRepository implements SessionManagementRepository {
  constructor(private readonly database: WorkerBindings['DB']) {}

  async listActiveSessions(
    tenantId: number,
    userId: number,
    now: string,
  ): Promise<readonly ManagedSessionRecord[]> {
    const result = await this.database
      .prepare(
        `SELECT id, uuid, created_at, last_seen_at, expires_at, user_agent
         FROM sessions
         WHERE tenant_id = ?1 AND user_id = ?2
           AND revoked_at IS NULL AND expires_at > ?3
         ORDER BY last_seen_at DESC, id DESC`,
      )
      .bind(tenantId, userId, now)
      .all<SessionRow>();

    return result.results.map(mapSession);
  }

  async findOwnedActiveSession(
    tenantId: number,
    userId: number,
    sessionUuid: string,
    now: string,
  ): Promise<ManagedSessionRecord | null> {
    const row = await this.database
      .prepare(
        `SELECT id, uuid, created_at, last_seen_at, expires_at, user_agent
         FROM sessions
         WHERE tenant_id = ?1 AND user_id = ?2 AND uuid = ?3
           AND revoked_at IS NULL AND expires_at > ?4
         LIMIT 1`,
      )
      .bind(tenantId, userId, sessionUuid, now)
      .first<SessionRow>();

    return row === null ? null : mapSession(row);
  }

  async revokeOwnedSession(event: RevokeManagedSessionEvent): Promise<boolean> {
    const result = await this.database.batch([
      this.database
        .prepare(
          `UPDATE sessions
           SET revoked_at = ?1
           WHERE tenant_id = ?2 AND user_id = ?3 AND id = ?4
             AND uuid = ?5 AND revoked_at IS NULL`,
        )
        .bind(
          event.occurredAt,
          event.tenantId,
          event.userId,
          event.targetSessionId,
          event.targetSessionUuid,
        ),
      this.database
        .prepare(
          `INSERT INTO audit_logs
             (tenant_id, user_id, request_id, action, entity, entity_id,
              after_json, ip_address, user_agent, created_at)
           SELECT ?1, ?2, ?3, 'SESSION_REVOKE', 'session', ?4, ?5, ?6, ?7, ?8
           FROM sessions s
           WHERE s.tenant_id = ?1 AND s.user_id = ?2 AND s.id = ?9
             AND s.uuid = ?4 AND s.revoked_at = ?8`,
        )
        .bind(
          event.tenantId,
          event.userId,
          event.requestId,
          event.targetSessionUuid,
          JSON.stringify({ current: event.targetSessionId === event.currentSessionId }),
          event.ipAddress,
          event.userAgent,
          event.occurredAt,
          event.targetSessionId,
        ),
      this.database
        .prepare(
          `INSERT INTO security_events
             (tenant_id, user_id, request_id, event_type, severity, metadata_json,
              ip_address, user_agent, created_at)
           SELECT ?1, ?2, ?3, 'session_revoked', 'info', ?4, ?5, ?6, ?7
           FROM sessions s
           WHERE s.tenant_id = ?1 AND s.user_id = ?2 AND s.id = ?8
             AND s.uuid = ?9 AND s.revoked_at = ?7`,
        )
        .bind(
          event.tenantId,
          event.userId,
          event.requestId,
          JSON.stringify({
            session_id: event.targetSessionUuid,
            current: event.targetSessionId === event.currentSessionId,
          }),
          event.ipAddress,
          event.userAgent,
          event.occurredAt,
          event.targetSessionId,
          event.targetSessionUuid,
        ),
    ]);

    return (result[0]?.meta.changes ?? 0) === 1;
  }
}
