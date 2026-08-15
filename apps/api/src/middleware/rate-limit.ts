import { createMiddleware } from 'hono/factory';

import { clientMetadata } from '../modules/auth/http';
import type { RateLimitPolicy, RateLimitRepository } from '../modules/rate-limit/domain';
import { D1RateLimitRepository } from '../modules/rate-limit/repository';
import { RateLimitExceededError, RateLimitService } from '../modules/rate-limit/service';
import type { AppBindings, WorkerBindings } from '../types';

export type RateLimitRepositoryFactory = (env: WorkerBindings) => RateLimitRepository;

export const createRateLimitRepository: RateLimitRepositoryFactory = (env) =>
  new D1RateLimitRepository(env.DB);

export function rateLimit(
  category: string,
  policies: readonly RateLimitPolicy[],
  repositoryFactory: RateLimitRepositoryFactory = createRateLimitRepository,
) {
  return createMiddleware<AppBindings>(async (context, next) => {
    const tenant = context.get('tenant');
    if (tenant === null) throw new Error('Tenant context is required for rate limiting');

    const user = context.get('user');
    const metadata = clientMetadata(context);
    const service = new RateLimitService(repositoryFactory(context.env));

    try {
      await service.enforce(category, policies, {
        tenantId: tenant.id,
        userId: user?.id ?? null,
        requestId: context.get('requestId'),
        ...metadata,
      });
    } catch (error) {
      if (error instanceof RateLimitExceededError) {
        context.header('Retry-After', String(error.retryAfterSeconds));
        context.header('X-RateLimit-Limit', String(error.limit));
        context.header('X-RateLimit-Remaining', '0');
      }
      throw error;
    }

    await next();
  });
}
