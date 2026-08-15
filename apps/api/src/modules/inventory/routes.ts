import { Hono, type Context } from 'hono';

import { BadRequestError } from '../../lib/errors';
import { successResponse } from '../../lib/responses';
import type { AppBindings, WorkerBindings } from '../../types';
import { clientMetadata } from '../auth/http';
import type { InventoryRepository } from './domain';
import { D1InventoryRepository } from './repository';
import { InventoryService, type InventoryRequestContext } from './service';
import {
  parseAdjustStock,
  parseCreateBatch,
  parseCreateReservation,
  parseIdempotencyKey,
  parseInventoryId,
} from './validation';

export type InventoryRepositoryFactory = (env: WorkerBindings) => InventoryRepository;
export const createInventoryRepository: InventoryRepositoryFactory = (env) =>
  new D1InventoryRepository(env.DB);

async function json(context: Context<AppBindings>) {
  try {
    return await context.req.json<unknown>();
  } catch {
    throw new BadRequestError('Request body must be valid JSON');
  }
}
function requestContext(context: Context<AppBindings>): InventoryRequestContext {
  const tenant = context.get('tenant');
  const user = context.get('user');
  const branch = context.get('branch');
  if (tenant === null || user === null || branch === null) {
    throw new Error('Inventory context was not resolved');
  }
  return {
    tenantId: tenant.id,
    branchId: branch.id,
    actorUserId: user.id,
    requestId: context.get('requestId'),
    ...clientMetadata(context),
  };
}

export function createInventoryRoutes(repositoryFactory: InventoryRepositoryFactory) {
  const routes = new Hono<AppBindings>();
  const service = (context: Context<AppBindings>) =>
    new InventoryService(repositoryFactory(context.env));

  routes.get('/directory', async (context) => {
    const data = await service(context).directory(requestContext(context));
    return context.json(successResponse(context.get('requestId'), data));
  });
  routes.post('/batches', async (context) => {
    const batch = await service(context).createBatch(
      parseCreateBatch(await json(context)),
      requestContext(context),
    );
    return context.json(successResponse(context.get('requestId'), { batch }, 'Batch created'), 201);
  });
  routes.post('/adjustments', async (context) => {
    const movement = await service(context).adjust(
      parseAdjustStock(await json(context)),
      parseIdempotencyKey(context.req.header('Idempotency-Key')),
      requestContext(context),
    );
    return context.json(
      successResponse(context.get('requestId'), { movement }, 'Stock adjusted'),
      201,
    );
  });
  routes.post('/reservations', async (context) => {
    const reservation = await service(context).createReservation(
      parseCreateReservation(await json(context)),
      requestContext(context),
    );
    return context.json(
      successResponse(context.get('requestId'), { reservation }, 'Stock reserved'),
      201,
    );
  });
  routes.patch('/reservations/:id/release', async (context) => {
    const reservation = await service(context).releaseReservation(
      parseInventoryId(context.req.param('id')),
      requestContext(context),
    );
    return context.json(
      successResponse(context.get('requestId'), { reservation }, 'Reservation released'),
    );
  });
  routes.post('/reservations/expire', async (context) => {
    const expired = await service(context).expireReservations(requestContext(context));
    return context.json(
      successResponse(context.get('requestId'), { expired }, 'Expired reservations released'),
    );
  });
  return routes;
}
