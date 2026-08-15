import type { ClientMetadata } from '../auth/domain';

export interface ManagedSessionRecord {
  readonly id: number;
  readonly uuid: string;
  readonly createdAt: string;
  readonly lastSeenAt: string;
  readonly expiresAt: string;
  readonly userAgent: string | null;
}

export interface RevokeManagedSessionEvent extends ClientMetadata {
  readonly tenantId: number;
  readonly userId: number;
  readonly currentSessionId: number;
  readonly targetSessionId: number;
  readonly targetSessionUuid: string;
  readonly requestId: string;
  readonly occurredAt: string;
}

export interface SessionManagementRepository {
  listActiveSessions(
    tenantId: number,
    userId: number,
    now: string,
  ): Promise<readonly ManagedSessionRecord[]>;
  findOwnedActiveSession(
    tenantId: number,
    userId: number,
    sessionUuid: string,
    now: string,
  ): Promise<ManagedSessionRecord | null>;
  revokeOwnedSession(event: RevokeManagedSessionEvent): Promise<boolean>;
}
