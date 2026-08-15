import type { LoginData, LogoutData, SessionData } from '@pos/contracts';
import { Hono, type Context } from 'hono';

import { BadRequestError } from '../../lib/errors';
import { successResponse } from '../../lib/responses';
import type { AppBindings } from '../../types';
import type { AuthRepositoryFactory } from '../../middleware/auth';
import { clientMetadata, clearSessionCookie, writeSessionCookie } from './http';
import { AuthenticationService } from './service';
import { parseLoginInput } from './validation';

async function readJson(context: Context<AppBindings>) {
  try {
    return await context.req.json<unknown>();
  } catch {
    throw new BadRequestError('Request body must be valid JSON');
  }
}

export function createAuthRoutes(repositoryFactory: AuthRepositoryFactory) {
  const routes = new Hono<AppBindings>();

  routes.post('/login', async (context) => {
    const tenant = context.get('tenant');
    if (tenant === null) throw new Error('Tenant context was not resolved');

    const input = parseLoginInput(await readJson(context));
    const service = new AuthenticationService(repositoryFactory(context.env));
    const result = await service.login({
      ...input,
      tenant,
      requestId: context.get('requestId'),
      ...clientMetadata(context),
    });
    writeSessionCookie(context, result.token);

    const data: LoginData = {
      user: { id: result.user.uuid, email: result.user.email, name: result.user.name },
      session: { expiresAt: result.session.expiresAt },
    };
    return context.json(successResponse(context.get('requestId'), data, 'Login successful'));
  });

  routes.get('/me', (context) => {
    const user = context.get('user');
    const session = context.get('session');
    if (user === null || session === null) throw new Error('Session context was not resolved');

    const data: SessionData = {
      user: { id: user.uuid, email: user.email, name: user.name },
      session: { expiresAt: session.expiresAt },
    };
    return context.json(successResponse(context.get('requestId'), data));
  });

  routes.post('/logout', async (context) => {
    const tenant = context.get('tenant');
    const user = context.get('user');
    const session = context.get('session');
    if (tenant === null || user === null || session === null) {
      throw new Error('Session context was not resolved');
    }

    const service = new AuthenticationService(repositoryFactory(context.env));
    await service.logout(
      tenant.id,
      user,
      session,
      context.get('requestId'),
      clientMetadata(context),
    );
    clearSessionCookie(context);

    const data: LogoutData = { loggedOut: true };
    return context.json(successResponse(context.get('requestId'), data, 'Logout successful'));
  });

  return routes;
}
