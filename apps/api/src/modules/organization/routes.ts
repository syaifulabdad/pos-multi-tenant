import type {
  LocationData,
  OrganizationBranchData,
  OrganizationDirectoryData,
  PosTerminalData,
  WarehouseData,
} from '@pos/contracts';
import { Hono, type Context } from 'hono';

import { BadRequestError } from '../../lib/errors';
import { successResponse } from '../../lib/responses';
import type { AppBindings, WorkerBindings } from '../../types';
import { clientMetadata } from '../auth/http';
import type { OrganizationRepository } from './domain';
import { D1OrganizationRepository } from './repository';
import { OrganizationService } from './service';
import {
  parseCreateBranch,
  parseCreateLocation,
  parseCreateTerminal,
  parseCreateWarehouse,
  parseOrganizationId,
  parseUpdateBranch,
  parseUpdateLocation,
  parseUpdateTerminal,
  parseUpdateWarehouse,
} from './validation';

export type OrganizationRepositoryFactory = (env: WorkerBindings) => OrganizationRepository;

export const createOrganizationRepository: OrganizationRepositoryFactory = (env) =>
  new D1OrganizationRepository(env.DB);

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
  if (tenant === null || user === null) throw new Error('Organization context was not resolved');
  return {
    tenantId: tenant.id,
    actorUserId: user.id,
    requestId: context.get('requestId'),
    ...clientMetadata(context),
  };
}

export function createOrganizationRoutes(repositoryFactory: OrganizationRepositoryFactory) {
  const routes = new Hono<AppBindings>();

  routes.get('/', async (context) => {
    const request = requestContext(context);
    const service = new OrganizationService(repositoryFactory(context.env));
    const data: OrganizationDirectoryData = await service.directory(request.tenantId);
    return context.json(successResponse(context.get('requestId'), data));
  });

  routes.post('/branches', async (context) => {
    const request = requestContext(context);
    const service = new OrganizationService(repositoryFactory(context.env));
    const branch: OrganizationBranchData = await service.createBranch(
      parseCreateBranch(await readJson(context)),
      request,
    );
    return context.json(
      successResponse(context.get('requestId'), { branch }, 'Branch created'),
      201,
    );
  });

  routes.patch('/branches/:id', async (context) => {
    const request = requestContext(context);
    const service = new OrganizationService(repositoryFactory(context.env));
    const branch: OrganizationBranchData = await service.updateBranch(
      parseOrganizationId(context.req.param('id')),
      parseUpdateBranch(await readJson(context)),
      request,
    );
    return context.json(successResponse(context.get('requestId'), { branch }, 'Branch updated'));
  });

  routes.post('/warehouses', async (context) => {
    const request = requestContext(context);
    const service = new OrganizationService(repositoryFactory(context.env));
    const warehouse: WarehouseData = await service.createWarehouse(
      parseCreateWarehouse(await readJson(context)),
      request,
    );
    return context.json(
      successResponse(context.get('requestId'), { warehouse }, 'Warehouse created'),
      201,
    );
  });

  routes.patch('/warehouses/:id', async (context) => {
    const request = requestContext(context);
    const service = new OrganizationService(repositoryFactory(context.env));
    const warehouse: WarehouseData = await service.updateWarehouse(
      parseOrganizationId(context.req.param('id')),
      parseUpdateWarehouse(await readJson(context)),
      request,
    );
    return context.json(
      successResponse(context.get('requestId'), { warehouse }, 'Warehouse updated'),
    );
  });

  routes.post('/locations', async (context) => {
    const request = requestContext(context);
    const service = new OrganizationService(repositoryFactory(context.env));
    const location: LocationData = await service.createLocation(
      parseCreateLocation(await readJson(context)),
      request,
    );
    return context.json(
      successResponse(context.get('requestId'), { location }, 'Location created'),
      201,
    );
  });

  routes.patch('/locations/:id', async (context) => {
    const request = requestContext(context);
    const service = new OrganizationService(repositoryFactory(context.env));
    const location: LocationData = await service.updateLocation(
      parseOrganizationId(context.req.param('id')),
      parseUpdateLocation(await readJson(context)),
      request,
    );
    return context.json(
      successResponse(context.get('requestId'), { location }, 'Location updated'),
    );
  });

  routes.post('/terminals', async (context) => {
    const request = requestContext(context);
    const service = new OrganizationService(repositoryFactory(context.env));
    const terminal: PosTerminalData = await service.createTerminal(
      parseCreateTerminal(await readJson(context)),
      request,
    );
    return context.json(
      successResponse(context.get('requestId'), { terminal }, 'Terminal created'),
      201,
    );
  });

  routes.patch('/terminals/:id', async (context) => {
    const request = requestContext(context);
    const service = new OrganizationService(repositoryFactory(context.env));
    const terminal: PosTerminalData = await service.updateTerminal(
      parseOrganizationId(context.req.param('id')),
      parseUpdateTerminal(await readJson(context)),
      request,
    );
    return context.json(
      successResponse(context.get('requestId'), { terminal }, 'Terminal updated'),
    );
  });

  return routes;
}
