import { AppError } from '../../lib/errors';
import type { ClientMetadata } from '../auth/domain';
import type {
  AccessContext,
  AccessRepository,
  AccessRequestIdentity,
  BranchAccess,
} from './domain';

export class PermissionDeniedError extends AppError {
  constructor() {
    super({ status: 403, code: 'PERMISSION_DENIED', message: 'Permission denied' });
    this.name = 'PermissionDeniedError';
  }
}

export class BranchRequiredError extends AppError {
  constructor() {
    super({ status: 409, code: 'BRANCH_REQUIRED', message: 'An assigned branch must be selected' });
    this.name = 'BranchRequiredError';
  }
}

export class AccessService {
  constructor(
    private readonly repository: AccessRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async resolve(identity: AccessRequestIdentity): Promise<AccessContext> {
    const [permissions, branches] = await Promise.all([
      this.repository.listPermissionCodes(identity.tenantId, identity.user.id),
      this.repository.listAssignedBranches(identity.tenantId, identity.user.id),
    ]);
    const selectedBranch =
      branches.find((branch) => branch.id === identity.session.activeBranchId) ??
      branches.find((branch) => branch.isDefault) ??
      (branches.length === 1 ? branches[0] : null) ??
      null;

    return { permissions, branches, branch: selectedBranch };
  }

  async switchBranch(
    identity: AccessRequestIdentity,
    branchUuid: string,
    requestId: string,
    metadata: ClientMetadata,
  ): Promise<BranchAccess> {
    const branch = await this.repository.findAssignedBranch(
      identity.tenantId,
      identity.user.id,
      branchUuid,
    );
    if (branch === null) throw new PermissionDeniedError();

    const switched = await this.repository.switchSessionBranch({
      tenantId: identity.tenantId,
      userId: identity.user.id,
      sessionId: identity.session.id,
      branch,
      requestId,
      occurredAt: this.now().toISOString(),
      ...metadata,
    });
    if (!switched) throw new PermissionDeniedError();

    return branch;
  }
}
