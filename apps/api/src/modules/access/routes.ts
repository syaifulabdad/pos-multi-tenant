import type { AccessContextData, BranchData } from '@pos/contracts';
import { Hono, type Context } from 'hono';

import { BadRequestError, ValidationError } from '../../lib/errors';
import { successResponse } from '../../lib/responses';
import type { AccessRepositoryFactory } from '../../middleware/access';
import type { AppBindings } from '../../types';
import { clientMetadata } from '../auth/http';
import type { BranchAccess } from './domain';
import { AccessService } from './service';

async function readJson(context: Context<AppBindings>): Promise<unknown> {
  try {
    return await context.req.json<unknown>();
  } catch {
    throw new BadRequestError('Request body must be valid JSON');
  }
}

function parseBranchSelection(value: unknown): string {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new BadRequestError('Request body must be a JSON object');
  }

  const branchId = (value as Readonly<Record<string, unknown>>).branchId;
  if (
    typeof branchId !== 'string' ||
    branchId.length < 20 ||
    branchId.length > 64 ||
    !/^[A-Za-z0-9-]+$/.test(branchId)
  ) {
    throw new ValidationError({ branchId: ['Branch identifier is invalid'] });
  }
  return branchId;
}

function publicBranch(branch: BranchAccess): BranchData {
  return {
    id: branch.uuid,
    code: branch.code,
    name: branch.name,
    timezone: branch.timezone,
    isDefault: branch.isDefault,
  };
}

export function createAccessRoutes(repositoryFactory: AccessRepositoryFactory) {
  const routes = new Hono<AppBindings>();

  routes.get('/', (context) => {
    const activeBranch = context.get('branch');
    const data: AccessContextData = {
      permissions: context.get('permissions'),
      branches: context.get('branches').map(publicBranch),
      activeBranch: activeBranch === null ? null : publicBranch(activeBranch),
    };
    return context.json(successResponse(context.get('requestId'), data));
  });

  routes.post('/branch', async (context) => {
    const tenant = context.get('tenant');
    const user = context.get('user');
    const session = context.get('session');
    if (tenant === null || user === null || session === null) {
      throw new Error('Access context was not resolved');
    }

    const branchId = parseBranchSelection(await readJson(context));
    const service = new AccessService(repositoryFactory(context.env));
    const branch = await service.switchBranch(
      { tenantId: tenant.id, user, session },
      branchId,
      context.get('requestId'),
      clientMetadata(context),
    );
    context.set('branch', branch);
    context.set('session', { ...session, activeBranchId: branch.id });

    return context.json(
      successResponse(context.get('requestId'), publicBranch(branch), 'Branch selected'),
    );
  });

  return routes;
}
