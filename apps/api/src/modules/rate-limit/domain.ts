import type { ClientMetadata } from '../auth/domain';

export type RateLimitScope = 'ip' | 'tenant' | 'user';

export interface RateLimitPolicy {
  readonly scope: RateLimitScope;
  readonly limit: number;
  readonly windowSeconds: number;
}

export interface ConsumeRateLimitInput {
  readonly tenantId: number;
  readonly keyHash: string;
  readonly category: string;
  readonly scope: RateLimitScope;
  readonly limit: number;
  readonly windowSeconds: number;
  readonly nowEpochSeconds: number;
  readonly nowIso: string;
}

export interface RateLimitResult {
  readonly allowed: boolean;
  readonly limit: number;
  readonly remaining: number;
  readonly retryAfterSeconds: number;
}

export interface RateLimitExceededEvent extends ClientMetadata {
  readonly tenantId: number;
  readonly userId: number | null;
  readonly requestId: string;
  readonly category: string;
  readonly scope: RateLimitScope;
  readonly retryAfterSeconds: number;
}

export interface RateLimitRepository {
  consume(input: ConsumeRateLimitInput): Promise<RateLimitResult>;
  recordExceeded(event: RateLimitExceededEvent): Promise<void>;
}
