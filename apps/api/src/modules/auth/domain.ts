import type { UserStatus } from '../../db/schema';

export interface AuthUserRecord {
  readonly id: number;
  readonly uuid: string;
  readonly tenantId: number;
  readonly email: string;
  readonly name: string;
  readonly passwordHash: string;
  readonly status: UserStatus;
  readonly failedLoginAttempts: number;
  readonly lockedUntil: string | null;
}

export interface AuthenticatedUser {
  readonly id: number;
  readonly uuid: string;
  readonly email: string;
  readonly name: string;
}

export interface AuthenticatedSession {
  readonly id: number;
  readonly uuid: string;
  readonly activeBranchId: number | null;
  readonly expiresAt: string;
}

export interface SessionRecord {
  readonly session: AuthenticatedSession;
  readonly user: AuthenticatedUser;
}

export interface ClientMetadata {
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}

export interface FailedLoginEvent extends ClientMetadata {
  readonly tenantId: number;
  readonly userId: number | null;
  readonly emailHash: string;
  readonly requestId: string;
  readonly occurredAt: string;
  readonly reason: 'invalid_credentials' | 'account_unavailable' | 'account_locked';
  readonly incrementAttempts: boolean;
  readonly lockUntil: string | null;
}

export interface SuccessfulLoginEvent extends ClientMetadata {
  readonly tenantId: number;
  readonly userId: number;
  readonly sessionUuid: string;
  readonly tokenHash: string;
  readonly expiresAt: string;
  readonly occurredAt: string;
  readonly emailHash: string;
  readonly requestId: string;
}

export interface RevokeSessionEvent extends ClientMetadata {
  readonly tenantId: number;
  readonly userId: number;
  readonly sessionId: number;
  readonly sessionUuid: string;
  readonly requestId: string;
  readonly occurredAt: string;
}

export interface AuthRepository {
  findUserByEmail(tenantId: number, normalizedEmail: string): Promise<AuthUserRecord | null>;
  recordFailedLogin(event: FailedLoginEvent): Promise<void>;
  recordSuccessfulLogin(event: SuccessfulLoginEvent): Promise<void>;
  findActiveSession(
    tenantId: number,
    tokenHash: string,
    now: string,
  ): Promise<SessionRecord | null>;
  revokeSession(event: RevokeSessionEvent): Promise<void>;
}
