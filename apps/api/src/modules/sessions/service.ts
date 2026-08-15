import { AppError } from '../../lib/errors';
import type { AuthenticatedSession, AuthenticatedUser, ClientMetadata } from '../auth/domain';
import type { ManagedSessionRecord, SessionManagementRepository } from './domain';

export interface PublicManagedSession {
  readonly id: string;
  readonly createdAt: string;
  readonly lastSeenAt: string;
  readonly expiresAt: string;
  readonly userAgent: string | null;
  readonly current: boolean;
}

export class SessionNotFoundError extends AppError {
  constructor() {
    super({ status: 404, code: 'SESSION_NOT_FOUND', message: 'Session not found' });
    this.name = 'SessionNotFoundError';
  }
}

export class SessionManagementService {
  constructor(
    private readonly repository: SessionManagementRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async list(
    tenantId: number,
    user: AuthenticatedUser,
    currentSession: AuthenticatedSession,
  ): Promise<readonly PublicManagedSession[]> {
    const sessions = await this.repository.listActiveSessions(
      tenantId,
      user.id,
      this.now().toISOString(),
    );
    return sessions.map((session) => this.toPublic(session, currentSession.id));
  }

  async revoke(
    tenantId: number,
    user: AuthenticatedUser,
    currentSession: AuthenticatedSession,
    targetSessionUuid: string,
    requestId: string,
    metadata: ClientMetadata,
  ): Promise<{ readonly current: boolean }> {
    const now = this.now().toISOString();
    const target = await this.repository.findOwnedActiveSession(
      tenantId,
      user.id,
      targetSessionUuid,
      now,
    );
    if (target === null) throw new SessionNotFoundError();

    const revoked = await this.repository.revokeOwnedSession({
      tenantId,
      userId: user.id,
      currentSessionId: currentSession.id,
      targetSessionId: target.id,
      targetSessionUuid: target.uuid,
      requestId,
      occurredAt: now,
      ...metadata,
    });
    if (!revoked) throw new SessionNotFoundError();

    return { current: target.id === currentSession.id };
  }

  private toPublic(session: ManagedSessionRecord, currentSessionId: number): PublicManagedSession {
    return {
      id: session.uuid,
      createdAt: session.createdAt,
      lastSeenAt: session.lastSeenAt,
      expiresAt: session.expiresAt,
      userAgent: session.userAgent,
      current: session.id === currentSessionId,
    };
  }
}
