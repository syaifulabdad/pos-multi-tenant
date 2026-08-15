import type { WorkerBindings } from '../../types';
import type {
  AuthRepository,
  AuthUserRecord,
  FailedLoginEvent,
  RevokeSessionEvent,
  SessionRecord,
  SuccessfulLoginEvent,
} from './domain';

interface AuthUserRow {
  readonly id: number;
  readonly uuid: string;
  readonly tenant_id: number;
  readonly email: string;
  readonly name: string;
  readonly password_hash: string;
  readonly status: AuthUserRecord['status'];
  readonly failed_login_attempts: number;
  readonly locked_until: string | null;
}

interface SessionRow {
  readonly session_id: number;
  readonly session_uuid: string;
  readonly active_branch_id: number | null;
  readonly expires_at: string;
  readonly last_seen_at: string;
  readonly user_id: number;
  readonly user_uuid: string;
  readonly email: string;
  readonly name: string;
}

export class D1AuthRepository implements AuthRepository {
  constructor(private readonly database: WorkerBindings['DB']) {}

  async findUserByEmail(tenantId: number, normalizedEmail: string): Promise<AuthUserRecord | null> {
    const row = await this.database
      .prepare(
        `SELECT id, uuid, tenant_id, email, name, password_hash, status,
                failed_login_attempts, locked_until
         FROM users
         WHERE tenant_id = ?1 AND email = ?2
         LIMIT 1`,
      )
      .bind(tenantId, normalizedEmail)
      .first<AuthUserRow>();

    if (row === null) return null;
    return {
      id: row.id,
      uuid: row.uuid,
      tenantId: row.tenant_id,
      email: row.email,
      name: row.name,
      passwordHash: row.password_hash,
      status: row.status,
      failedLoginAttempts: row.failed_login_attempts,
      lockedUntil: row.locked_until,
    };
  }

  async recordFailedLogin(event: FailedLoginEvent): Promise<void> {
    const statements: D1PreparedStatement[] = [];

    if (event.userId !== null && event.incrementAttempts) {
      statements.push(
        this.database
          .prepare(
            `UPDATE users
             SET failed_login_attempts = failed_login_attempts + 1,
                 locked_until = CASE
                   WHEN failed_login_attempts + 1 >= 5 THEN ?1
                   ELSE locked_until
                 END,
                 updated_at = ?2
             WHERE tenant_id = ?3 AND id = ?4`,
          )
          .bind(event.lockUntil, event.occurredAt, event.tenantId, event.userId),
      );
    }

    statements.push(
      this.database
        .prepare(
          `INSERT INTO login_history
             (tenant_id, user_id, email_hash, success, failure_reason, ip_address,
              user_agent, request_id)
           VALUES (?1, ?2, ?3, 0, ?4, ?5, ?6, ?7)`,
        )
        .bind(
          event.tenantId,
          event.userId,
          event.emailHash,
          event.reason,
          event.ipAddress,
          event.userAgent,
          event.requestId,
        ),
      this.database
        .prepare(
          `INSERT INTO security_events
             (tenant_id, user_id, request_id, event_type, severity, metadata_json,
              ip_address, user_agent)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
        )
        .bind(
          event.tenantId,
          event.userId,
          event.requestId,
          event.reason === 'account_locked' ? 'login_locked' : 'login_failed',
          event.reason === 'account_locked' ? 'high' : 'warning',
          JSON.stringify({ reason: event.reason }),
          event.ipAddress,
          event.userAgent,
        ),
    );

    await this.database.batch(statements);
  }

  async recordSuccessfulLogin(event: SuccessfulLoginEvent): Promise<void> {
    await this.database.batch([
      this.database
        .prepare(
          `UPDATE users
           SET failed_login_attempts = 0, locked_until = NULL,
               last_login_at = ?1, updated_at = ?1
           WHERE tenant_id = ?2 AND id = ?3`,
        )
        .bind(event.occurredAt, event.tenantId, event.userId),
      this.database
        .prepare(
          `INSERT INTO sessions
             (uuid, tenant_id, user_id, token_hash, expires_at, last_seen_at,
              ip_address, user_agent)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
        )
        .bind(
          event.sessionUuid,
          event.tenantId,
          event.userId,
          event.tokenHash,
          event.expiresAt,
          event.occurredAt,
          event.ipAddress,
          event.userAgent,
        ),
      this.database
        .prepare(
          `INSERT INTO login_history
             (tenant_id, user_id, email_hash, success, ip_address, user_agent, request_id)
           VALUES (?1, ?2, ?3, 1, ?4, ?5, ?6)`,
        )
        .bind(
          event.tenantId,
          event.userId,
          event.emailHash,
          event.ipAddress,
          event.userAgent,
          event.requestId,
        ),
      this.database
        .prepare(
          `INSERT INTO audit_logs
             (tenant_id, user_id, request_id, action, entity, entity_id,
              ip_address, user_agent)
           VALUES (?1, ?2, ?3, 'LOGIN', 'session', ?4, ?5, ?6)`,
        )
        .bind(
          event.tenantId,
          event.userId,
          event.requestId,
          event.sessionUuid,
          event.ipAddress,
          event.userAgent,
        ),
    ]);
  }

  async findActiveSession(
    tenantId: number,
    tokenHash: string,
    now: string,
  ): Promise<SessionRecord | null> {
    const row = await this.database
      .prepare(
        `SELECT s.id AS session_id, s.uuid AS session_uuid, s.active_branch_id,
                s.expires_at, s.last_seen_at, u.id AS user_id, u.uuid AS user_uuid, u.email, u.name
         FROM sessions s
         INNER JOIN users u ON u.tenant_id = s.tenant_id AND u.id = s.user_id
         WHERE s.tenant_id = ?1 AND s.token_hash = ?2
           AND s.revoked_at IS NULL AND s.expires_at > ?3 AND u.status = 'active'
         LIMIT 1`,
      )
      .bind(tenantId, tokenHash, now)
      .first<SessionRow>();

    if (row === null) return null;

    const refreshBefore = new Date(new Date(now).getTime() - 5 * 60 * 1000).toISOString();
    if (row.last_seen_at < refreshBefore) {
      await this.database
        .prepare(
          `UPDATE sessions
           SET last_seen_at = ?1
           WHERE tenant_id = ?2 AND id = ?3
             AND revoked_at IS NULL AND expires_at > ?1`,
        )
        .bind(now, tenantId, row.session_id)
        .run();
    }

    return {
      session: {
        id: row.session_id,
        uuid: row.session_uuid,
        activeBranchId: row.active_branch_id,
        expiresAt: row.expires_at,
      },
      user: {
        id: row.user_id,
        uuid: row.user_uuid,
        email: row.email,
        name: row.name,
      },
    };
  }

  async revokeSession(event: RevokeSessionEvent): Promise<void> {
    await this.database.batch([
      this.database
        .prepare(
          `UPDATE sessions
           SET revoked_at = ?1
           WHERE tenant_id = ?2 AND id = ?3 AND user_id = ?4 AND revoked_at IS NULL`,
        )
        .bind(event.occurredAt, event.tenantId, event.sessionId, event.userId),
      this.database
        .prepare(
          `INSERT INTO audit_logs
             (tenant_id, user_id, request_id, action, entity, entity_id,
              ip_address, user_agent)
           VALUES (?1, ?2, ?3, 'LOGOUT', 'session', ?4, ?5, ?6)`,
        )
        .bind(
          event.tenantId,
          event.userId,
          event.requestId,
          event.sessionUuid,
          event.ipAddress,
          event.userAgent,
        ),
    ]);
  }
}
