import { createMiddleware } from 'hono/factory';

import { createDatabase } from '../db/client';
import type { AppBindings, WorkerBindings } from '../types';
import type { TenantLookupRepository } from '../modules/tenants/domain';
import { DrizzleTenantLookupRepository } from '../modules/tenants/repository';
import { TenantResolverService } from '../modules/tenants/service';

export type TenantRepositoryFactory = (env: WorkerBindings) => TenantLookupRepository;

export const createTenantRepository: TenantRepositoryFactory = (env) =>
  new DrizzleTenantLookupRepository(createDatabase(env.DB));

export function tenantResolver(
  repositoryFactory: TenantRepositoryFactory = createTenantRepository,
) {
  return createMiddleware<AppBindings>(async (context, next) => {
    const hostname = new URL(context.req.url).hostname;
    const service = new TenantResolverService(repositoryFactory(context.env));
    const tenant = await service.resolve({
      hostname,
      baseDomain: context.env.BASE_DOMAIN,
      environment: context.env.APP_ENV,
    });

    context.set('tenant', tenant);
    await next();
  });
}
