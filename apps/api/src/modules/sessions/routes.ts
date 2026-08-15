import type { SessionListData, SessionRevokeData } from '@pos/contracts';
import { Hono } from 'hono';

import { ValidationError } from '../../lib/errors';
import { successResponse } from '../../lib/responses';
import type { AppBindings, WorkerBindings } from '../../types';
import { clearSessionCookie, clientMetadata } from '../auth/http';
import type { SessionManagementRepository } from './domain';
import { D1SessionManagementRepository } from './repository';
import { SessionManagementService } from './service';

export type SessionManagementRepositoryFactory = (
  env: WorkerBindings,
) => SessionManagementRepository;

export const createSessionManagementRepository: SessionManagementRepositoryFactory = (env) =>
  new D1SessionManagementRepository(env.DB);

function validateSessionId(value: string): string {
  if (value.length < 20 || value.length > 64 || !/^[A-Za-z0-9-]+$/.test(value)) {
    throw new ValidationError({ sessionId: ['Session identifier is invalid'] });
  }
  return value;
}

export function createSessionRoutes(repositoryFactory: SessionManagementRepositoryFactory) {
  const routes = new Hono<AppBindings>();

  routes.get('/', async (context) => {
    const tenant = context.get('tenant');
    const user = context.get('user');
    const currentSession = context.get('session');
    if (tenant === null || user === null || currentSession === null) {
      throw new Error('Session context was not resolved');
    }

    const service = new SessionManagementService(repositoryFactory(context.env));
    const sessions = await service.list(tenant.id, user, currentSession);
    const data: SessionListData = { sessions };
    return context.json(successResponse(context.get('requestId'), data));
  });

  routes.delete('/:sessionId', async (context) => {
    const tenant = context.get('tenant');
    const user = context.get('user');
    const currentSession = context.get('session');
    if (tenant === null || user === null || currentSession === null) {
      throw new Error('Session context was not resolved');
    }

    const targetSessionId = validateSessionId(context.req.param('sessionId'));
    const service = new SessionManagementService(repositoryFactory(context.env));
    const result = await service.revoke(
      tenant.id,
      user,
      currentSession,
      targetSessionId,
      context.get('requestId'),
      clientMetadata(context),
    );
    if (result.current) clearSessionCookie(context);

    const data: SessionRevokeData = { revoked: true, current: result.current };
    return context.json(successResponse(context.get('requestId'), data, 'Session revoked'));
  });

  return routes;
}
