import type { AuthenticatedSession, AuthenticatedUser, ClientMetadata } from '../auth/domain';

export interface BranchAccess {
  readonly id: number;
  readonly uuid: string;
  readonly code: string;
  readonly name: string;
  readonly timezone: string;
  readonly isDefault: boolean;
}

export interface AccessContext {
  readonly permissions: readonly string[];
  readonly branches: readonly BranchAccess[];
  readonly branch: BranchAccess | null;
}

export interface SwitchBranchEvent extends ClientMetadata {
  readonly tenantId: number;
  readonly userId: number;
  readonly sessionId: number;
  readonly branch: BranchAccess;
  readonly requestId: string;
  readonly occurredAt: string;
}

export interface PermissionDeniedEvent extends ClientMetadata {
  readonly tenantId: number;
  readonly userId: number;
  readonly branchId: number | null;
  readonly permission: string;
  readonly requestId: string;
  readonly route: string;
}

export interface AccessRepository {
  listPermissionCodes(tenantId: number, userId: number): Promise<readonly string[]>;
  listAssignedBranches(tenantId: number, userId: number): Promise<readonly BranchAccess[]>;
  findAssignedBranch(
    tenantId: number,
    userId: number,
    branchUuid: string,
  ): Promise<BranchAccess | null>;
  switchSessionBranch(event: SwitchBranchEvent): Promise<boolean>;
  recordPermissionDenied(event: PermissionDeniedEvent): Promise<void>;
}

export interface AccessRequestIdentity {
  readonly tenantId: number;
  readonly user: AuthenticatedUser;
  readonly session: AuthenticatedSession;
}
