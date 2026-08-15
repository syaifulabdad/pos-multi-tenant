import { AppError } from '../../lib/errors';
import { sha256 } from '../../security/crypto';
import type { ClientMetadata } from '../auth/domain';
import type {
  RateLimitPolicy,
  RateLimitRepository,
  RateLimitResult,
  RateLimitScope,
} from './domain';

export class RateLimitExceededError extends AppError {
  readonly retryAfterSeconds: number;
  readonly limit: number;

  constructor(result: RateLimitResult) {
    super({ status: 429, code: 'RATE_LIMITED', message: 'Too many requests' });
    this.name = 'RateLimitExceededError';
    this.retryAfterSeconds = result.retryAfterSeconds;
    this.limit = result.limit;
  }
}

export interface RateLimitIdentity extends ClientMetadata {
  readonly tenantId: number;
  readonly userId: number | null;
  readonly requestId: string;
}

function scopeIdentity(scope: RateLimitScope, identity: RateLimitIdentity): string {
  if (scope === 'tenant') return String(identity.tenantId);
  if (scope === 'user') return String(identity.userId ?? 'anonymous');
  return identity.ipAddress ?? 'unknown';
}

export class RateLimitService {
  constructor(
    private readonly repository: RateLimitRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async enforce(
    category: string,
    policies: readonly RateLimitPolicy[],
    identity: RateLimitIdentity,
  ): Promise<void> {
    const now = this.now();
    const nowEpochSeconds = Math.floor(now.getTime() / 1000);

    for (const policy of policies) {
      const keyHash = await sha256(
        `${identity.tenantId}:${category}:${policy.scope}:${scopeIdentity(policy.scope, identity)}`,
      );
      const result = await this.repository.consume({
        tenantId: identity.tenantId,
        keyHash,
        category,
        scope: policy.scope,
        limit: policy.limit,
        windowSeconds: policy.windowSeconds,
        nowEpochSeconds,
        nowIso: now.toISOString(),
      });

      if (!result.allowed) {
        await this.repository.recordExceeded({
          tenantId: identity.tenantId,
          userId: identity.userId,
          requestId: identity.requestId,
          category,
          scope: policy.scope,
          retryAfterSeconds: result.retryAfterSeconds,
          ipAddress: identity.ipAddress,
          userAgent: identity.userAgent,
        });
        throw new RateLimitExceededError(result);
      }
    }
  }
}
