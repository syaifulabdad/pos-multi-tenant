import { UnauthorizedError } from '../../lib/errors';
import {
  DUMMY_PASSWORD_HASH,
  generateSessionToken,
  sha256,
  verifyPassword,
} from '../../security/crypto';
import type { TenantContext } from '../tenants/domain';
import type {
  AuthenticatedSession,
  AuthenticatedUser,
  AuthRepository,
  ClientMetadata,
  SessionRecord,
} from './domain';
import type { LoginInput } from './validation';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
export const SESSION_TTL_SECONDS = 8 * 60 * 60;
const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export interface LoginRequest extends LoginInput, ClientMetadata {
  readonly tenant: TenantContext;
  readonly requestId: string;
}

export interface LoginResult {
  readonly token: string;
  readonly user: AuthenticatedUser;
  readonly session: AuthenticatedSession;
}

export class AuthenticationService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async login(request: LoginRequest): Promise<LoginResult> {
    const occurredAt = this.now();
    const user = await this.repository.findUserByEmail(request.tenant.id, request.email);
    const passwordMatches = await verifyPassword(
      request.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    const emailHash = await sha256(request.email);
    const locked =
      user !== null &&
      user.lockedUntil !== null &&
      new Date(user.lockedUntil).getTime() > occurredAt.getTime();
    const unavailable = user !== null && user.status !== 'active';

    if (user === null || !passwordMatches || locked || unavailable) {
      const nextAttempts = (user?.failedLoginAttempts ?? 0) + 1;
      const reachesLockThreshold =
        user !== null && !locked && !unavailable && nextAttempts >= MAX_FAILED_ATTEMPTS;
      const reason =
        locked || reachesLockThreshold
          ? 'account_locked'
          : unavailable
            ? 'account_unavailable'
            : 'invalid_credentials';
      const lockUntil =
        user !== null && !locked && !unavailable
          ? new Date(occurredAt.getTime() + LOCK_DURATION_MS).toISOString()
          : null;

      await this.repository.recordFailedLogin({
        tenantId: request.tenant.id,
        userId: user?.id ?? null,
        emailHash,
        requestId: request.requestId,
        reason,
        incrementAttempts: user !== null && !locked && !unavailable,
        lockUntil,
        occurredAt: occurredAt.toISOString(),
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
      });
      throw new UnauthorizedError('Invalid email or password');
    }

    const token = generateSessionToken();
    const tokenHash = await sha256(token);
    const session: AuthenticatedSession = {
      id: 0,
      uuid: crypto.randomUUID(),
      activeBranchId: null,
      expiresAt: new Date(occurredAt.getTime() + SESSION_TTL_SECONDS * 1000).toISOString(),
    };
    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      uuid: user.uuid,
      email: user.email,
      name: user.name,
    };

    await this.repository.recordSuccessfulLogin({
      tenantId: request.tenant.id,
      userId: user.id,
      sessionUuid: session.uuid,
      tokenHash,
      expiresAt: session.expiresAt,
      occurredAt: occurredAt.toISOString(),
      emailHash,
      requestId: request.requestId,
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
    });

    return { token, user: authenticatedUser, session };
  }

  async authenticate(tenantId: number, token: string): Promise<SessionRecord> {
    if (!SESSION_TOKEN_PATTERN.test(token)) throw new UnauthorizedError();

    const tokenHash = await sha256(token);
    const session = await this.repository.findActiveSession(
      tenantId,
      tokenHash,
      this.now().toISOString(),
    );
    if (session === null) throw new UnauthorizedError();

    return session;
  }

  async logout(
    tenantId: number,
    user: AuthenticatedUser,
    session: AuthenticatedSession,
    requestId: string,
    metadata: ClientMetadata,
  ): Promise<void> {
    await this.repository.revokeSession({
      tenantId,
      userId: user.id,
      sessionId: session.id,
      sessionUuid: session.uuid,
      requestId,
      occurredAt: this.now().toISOString(),
      ...metadata,
    });
  }
}
