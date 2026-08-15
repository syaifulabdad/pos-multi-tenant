import type { WorkerBindings } from '../../types';
import type {
  ConsumeRateLimitInput,
  RateLimitExceededEvent,
  RateLimitRepository,
  RateLimitResult,
} from './domain';

interface BucketRow {
  readonly request_count: number;
  readonly expires_at: number;
}

export class D1RateLimitRepository implements RateLimitRepository {
  constructor(private readonly database: WorkerBindings['DB']) {}

  async consume(input: ConsumeRateLimitInput): Promise<RateLimitResult> {
    const expiresAt = input.nowEpochSeconds + input.windowSeconds;
    await this.database
      .prepare('DELETE FROM rate_limit_buckets WHERE expires_at <= ?1')
      .bind(input.nowEpochSeconds)
      .run();

    const row = await this.database
      .prepare(
        `INSERT INTO rate_limit_buckets
           (key_hash, tenant_id, category, scope, request_count,
            window_started_at, expires_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, 1, ?5, ?6, ?7)
         ON CONFLICT(key_hash) DO UPDATE SET
           request_count = CASE
             WHEN rate_limit_buckets.expires_at <= excluded.window_started_at THEN 1
             ELSE MIN(rate_limit_buckets.request_count + 1, ?8)
           END,
           window_started_at = CASE
             WHEN rate_limit_buckets.expires_at <= excluded.window_started_at
             THEN excluded.window_started_at ELSE rate_limit_buckets.window_started_at
           END,
           expires_at = CASE
             WHEN rate_limit_buckets.expires_at <= excluded.window_started_at
             THEN excluded.expires_at ELSE rate_limit_buckets.expires_at
           END,
           updated_at = excluded.updated_at
         RETURNING request_count, expires_at`,
      )
      .bind(
        input.keyHash,
        input.tenantId,
        input.category,
        input.scope,
        input.nowEpochSeconds,
        expiresAt,
        input.nowIso,
        input.limit + 1,
      )
      .first<BucketRow>();

    if (row === null) throw new Error('Rate limit bucket did not return a result');
    return {
      allowed: row.request_count <= input.limit,
      limit: input.limit,
      remaining: Math.max(0, input.limit - row.request_count),
      retryAfterSeconds: Math.max(1, row.expires_at - input.nowEpochSeconds),
    };
  }

  async recordExceeded(event: RateLimitExceededEvent): Promise<void> {
    await this.database
      .prepare(
        `INSERT INTO security_events
           (tenant_id, user_id, request_id, event_type, severity, metadata_json,
            ip_address, user_agent)
         VALUES (?1, ?2, ?3, 'rate_limited', 'warning', ?4, ?5, ?6)`,
      )
      .bind(
        event.tenantId,
        event.userId,
        event.requestId,
        JSON.stringify({
          category: event.category,
          scope: event.scope,
          retry_after_seconds: event.retryAfterSeconds,
        }),
        event.ipAddress,
        event.userAgent,
      )
      .run();
  }
}
