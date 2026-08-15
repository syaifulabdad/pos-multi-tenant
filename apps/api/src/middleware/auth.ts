import { createMiddleware } from 'hono/factory';

import type { AppBindings, WorkerBindings } from '../types';
import type { AuthRepository } from '../modules/auth/domain';
import { readSessionCookie } from '../modules/auth/http';
import { D1AuthRepository } from '../modules/auth/repository';
import { AuthenticationService } from '../modules/auth/service';
import { UnauthorizedError } from '../lib/errors';

export type AuthRepositoryFactory = (env: WorkerBindings) => AuthRepository;

export const createAuthRepository: AuthRepositoryFactory = (env) => new D1AuthRepository(env.DB);

export function authenticateSession(
  repositoryFactory: AuthRepositoryFactory = createAuthRepository,
) {
  return createMiddleware<AppBindings>(async (context, next) => {
    const tenant = context.get('tenant');
    if (tenant === null) throw new UnauthorizedError();

    const token = readSessionCookie(context);
    if (token === undefined) throw new UnauthorizedError();

    const service = new AuthenticationService(repositoryFactory(context.env));
    const authenticated = await service.authenticate(tenant.id, token);
    context.set('user', authenticated.user);
    context.set('session', authenticated.session);

    await next();
  });
}
