import type {
  AdminRoleSummaryData,
  AdminUserData,
  RoleDirectoryData,
  SecurityEventListData,
  UserDirectoryData,
} from '@pos/contracts';
import { Hono, type Context } from 'hono';

import { BadRequestError } from '../../lib/errors';
import { successResponse } from '../../lib/responses';
import type { AppBindings, WorkerBindings } from '../../types';
import { clientMetadata } from '../auth/http';
import type { AdminRepository } from './domain';
import { D1AdminRepository } from './repository';
import { AdminService } from './service';
import {
  parseCreateRole,
  parseCreateUser,
  parsePublicUuid,
  parseSecurityEventLimit,
  parseUpdateRole,
  parseUpdateUser,
} from './validation';

export type AdminRepositoryFactory = (env: WorkerBindings) => AdminRepository;

export const createAdminRepository: AdminRepositoryFactory = (env) => new D1AdminRepository(env.DB);

async function readJson(context: Context<AppBindings>) {
  try {
    return await context.req.json<unknown>();
  } catch {
    throw new BadRequestError('Request body must be valid JSON');
  }
}

function requestContext(context: Context<AppBindings>) {
  const tenant = context.get('tenant');
  const user = context.get('user');
  if (tenant === null || user === null) throw new Error('Admin context was not resolved');
  return {
    tenantId: tenant.id,
    actorUserId: user.id,
    actorUserUuid: user.uuid,
    requestId: context.get('requestId'),
    ...clientMetadata(context),
  };
}

export function createAdminRoutes(repositoryFactory: AdminRepositoryFactory) {
  const routes = new Hono<AppBindings>();

  routes.get('/users', async (context) => {
    const request = requestContext(context);
    const service = new AdminService(repositoryFactory(context.env));
    const data: UserDirectoryData = await service.userDirectory(request.tenantId);
    return context.json(successResponse(context.get('requestId'), data));
  });

  routes.post('/users', async (context) => {
    const request = requestContext(context);
    const input = parseCreateUser(await readJson(context));
    const service = new AdminService(repositoryFactory(context.env));
    const user: AdminUserData = await service.createUser(input, request);
    return context.json(successResponse(context.get('requestId'), { user }, 'User created'), 201);
  });

  routes.patch('/users/:userId', async (context) => {
    const request = requestContext(context);
    const targetUuid = parsePublicUuid(context.req.param('userId'));
    const input = parseUpdateUser(await readJson(context));
    const service = new AdminService(repositoryFactory(context.env));
    const user: AdminUserData = await service.updateUser(targetUuid, input, request);
    return context.json(successResponse(context.get('requestId'), { user }, 'User updated'));
  });

  routes.get('/roles', async (context) => {
    const request = requestContext(context);
    const service = new AdminService(repositoryFactory(context.env));
    const data: RoleDirectoryData = await service.roleDirectory(request.tenantId);
    return context.json(successResponse(context.get('requestId'), data));
  });

  routes.post('/roles', async (context) => {
    const request = requestContext(context);
    const input = parseCreateRole(await readJson(context));
    const service = new AdminService(repositoryFactory(context.env));
    const role: AdminRoleSummaryData = await service.createRole(input, request);
    return context.json(successResponse(context.get('requestId'), { role }, 'Role created'), 201);
  });

  routes.patch('/roles/:roleId', async (context) => {
    const request = requestContext(context);
    const targetUuid = parsePublicUuid(context.req.param('roleId'));
    const input = parseUpdateRole(await readJson(context));
    const service = new AdminService(repositoryFactory(context.env));
    const role: AdminRoleSummaryData = await service.updateRole(targetUuid, input, request);
    return context.json(successResponse(context.get('requestId'), { role }, 'Role updated'));
  });

  routes.get('/security-events', async (context) => {
    const request = requestContext(context);
    const limit = parseSecurityEventLimit(context.req.query('limit'));
    const service = new AdminService(repositoryFactory(context.env));
    const data: SecurityEventListData = {
      events: await service.securityEvents(request.tenantId, limit),
    };
    return context.json(successResponse(context.get('requestId'), data));
  });

  return routes;
}
