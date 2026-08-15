import { createMiddleware } from 'hono/factory';

import { clientMetadata } from '../modules/auth/http';
import type { AccessRepository } from '../modules/access/domain';
import { D1AccessRepository } from '../modules/access/repository';
import {
  AccessService,
  BranchRequiredError,
  PermissionDeniedError,
} from '../modules/access/service';
import type { AppBindings, WorkerBindings } from '../types';

export type AccessRepositoryFactory = (env: WorkerBindings) => AccessRepository;

export const createAccessRepository: AccessRepositoryFactory = (env) =>
  new D1AccessRepository(env.DB);

export function loadAccessContext(
  repositoryFactory: AccessRepositoryFactory = createAccessRepository,
) {
  return createMiddleware<AppBindings>(async (context, next) => {
    const tenant = context.get('tenant');
    const user = context.get('user');
    const session = context.get('session');
    if (tenant === null || user === null || session === null) throw new PermissionDeniedError();

    const service = new AccessService(repositoryFactory(context.env));
    const access = await service.resolve({ tenantId: tenant.id, user, session });
    context.set('permissions', access.permissions);
    context.set('branches', access.branches);
    context.set('branch', access.branch);

    await next();
  });
}

export function requirePermission(
  permission: string,
  repositoryFactory: AccessRepositoryFactory = createAccessRepository,
) {
  return createMiddleware<AppBindings>(async (context, next) => {
    if (!context.get('permissions').includes(permission)) {
      const tenant = context.get('tenant');
      const user = context.get('user');
      if (tenant !== null && user !== null) {
        await repositoryFactory(context.env).recordPermissionDenied({
          tenantId: tenant.id,
          userId: user.id,
          branchId: context.get('branch')?.id ?? null,
          permission,
          requestId: context.get('requestId'),
          route: context.req.path,
          ...clientMetadata(context),
        });
      }
      throw new PermissionDeniedError();
    }

    await next();
  });
}

export const requireBranch = createMiddleware<AppBindings>(async (context, next) => {
  if (context.get('branch') === null) throw new BranchRequiredError();
  await next();
});
