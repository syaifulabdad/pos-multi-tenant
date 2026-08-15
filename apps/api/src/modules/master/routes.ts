import { Hono, type Context } from 'hono';

import { BadRequestError } from '../../lib/errors';
import { successResponse } from '../../lib/responses';
import type { AppBindings, WorkerBindings } from '../../types';
import { clientMetadata } from '../auth/http';
import type { MasterRepository } from './domain';
import { D1MasterRepository } from './repository';
import { MasterService } from './service';
import {
  parseCreateBrand,
  parseCreateCategory,
  parseCreateCustomer,
  parseCreateProduct,
  parseCreateProductUnit,
  parseCreateSupplier,
  parseCreateUnit,
  parseMasterId,
  parseSetProductPrice,
  parseUpdateBrand,
  parseUpdateCategory,
  parseUpdateCustomer,
  parseUpdateProduct,
  parseUpdateProductUnit,
  parseUpdateSupplier,
  parseUpdateUnit,
} from './validation';

export type MasterRepositoryFactory = (env: WorkerBindings) => MasterRepository;
export const createMasterRepository: MasterRepositoryFactory = (env) =>
  new D1MasterRepository(env.DB);

async function json(context: Context<AppBindings>) {
  try {
    return await context.req.json<unknown>();
  } catch {
    throw new BadRequestError('Request body must be valid JSON');
  }
}

function requestContext(context: Context<AppBindings>) {
  const tenant = context.get('tenant');
  const user = context.get('user');
  if (tenant === null || user === null) throw new Error('Master context was not resolved');
  return {
    tenantId: tenant.id,
    actorUserId: user.id,
    requestId: context.get('requestId'),
    authorizedBranchUuids: context.get('branches').map((branch) => branch.uuid),
    ...clientMetadata(context),
  };
}

export function createMasterRoutes(repositoryFactory: MasterRepositoryFactory) {
  const routes = new Hono<AppBindings>();
  const service = (context: Context<AppBindings>) =>
    new MasterService(repositoryFactory(context.env));

  routes.get('/directory', async (context) => {
    const request = requestContext(context);
    const data = await service(context).directory(request.tenantId, request.authorizedBranchUuids);
    return context.json(successResponse(context.get('requestId'), data));
  });

  routes.post('/categories', async (context) => {
    const category = await service(context).createCategory(
      parseCreateCategory(await json(context)),
      requestContext(context),
    );
    return context.json(
      successResponse(context.get('requestId'), { category }, 'Category created'),
      201,
    );
  });
  routes.patch('/categories/:id', async (context) => {
    const category = await service(context).updateCategory(
      parseMasterId(context.req.param('id')),
      parseUpdateCategory(await json(context)),
      requestContext(context),
    );
    return context.json(
      successResponse(context.get('requestId'), { category }, 'Category updated'),
    );
  });

  routes.post('/brands', async (context) => {
    const brand = await service(context).createBrand(
      parseCreateBrand(await json(context)),
      requestContext(context),
    );
    return context.json(successResponse(context.get('requestId'), { brand }, 'Brand created'), 201);
  });
  routes.patch('/brands/:id', async (context) => {
    const brand = await service(context).updateBrand(
      parseMasterId(context.req.param('id')),
      parseUpdateBrand(await json(context)),
      requestContext(context),
    );
    return context.json(successResponse(context.get('requestId'), { brand }, 'Brand updated'));
  });

  routes.post('/units', async (context) => {
    const unit = await service(context).createUnit(
      parseCreateUnit(await json(context)),
      requestContext(context),
    );
    return context.json(successResponse(context.get('requestId'), { unit }, 'Unit created'), 201);
  });
  routes.patch('/units/:id', async (context) => {
    const unit = await service(context).updateUnit(
      parseMasterId(context.req.param('id')),
      parseUpdateUnit(await json(context)),
      requestContext(context),
    );
    return context.json(successResponse(context.get('requestId'), { unit }, 'Unit updated'));
  });

  routes.post('/products', async (context) => {
    const product = await service(context).createProduct(
      parseCreateProduct(await json(context)),
      requestContext(context),
    );
    return context.json(
      successResponse(context.get('requestId'), { product }, 'Product created'),
      201,
    );
  });
  routes.patch('/products/:id', async (context) => {
    const product = await service(context).updateProduct(
      parseMasterId(context.req.param('id')),
      parseUpdateProduct(await json(context)),
      requestContext(context),
    );
    return context.json(successResponse(context.get('requestId'), { product }, 'Product updated'));
  });

  routes.post('/product-units', async (context) => {
    const productUnit = await service(context).createProductUnit(
      parseCreateProductUnit(await json(context)),
      requestContext(context),
    );
    return context.json(
      successResponse(context.get('requestId'), { productUnit }, 'Product unit created'),
      201,
    );
  });
  routes.patch('/product-units/:id', async (context) => {
    const productUnit = await service(context).updateProductUnit(
      parseMasterId(context.req.param('id')),
      parseUpdateProductUnit(await json(context)),
      requestContext(context),
    );
    return context.json(
      successResponse(context.get('requestId'), { productUnit }, 'Product unit updated'),
    );
  });

  routes.post('/prices', async (context) => {
    const price = await service(context).setPrice(
      parseSetProductPrice(await json(context)),
      requestContext(context),
    );
    return context.json(successResponse(context.get('requestId'), { price }, 'Price set'), 201);
  });

  routes.post('/suppliers', async (context) => {
    const supplier = await service(context).createSupplier(
      parseCreateSupplier(await json(context)),
      requestContext(context),
    );
    return context.json(
      successResponse(context.get('requestId'), { supplier }, 'Supplier created'),
      201,
    );
  });
  routes.patch('/suppliers/:id', async (context) => {
    const supplier = await service(context).updateSupplier(
      parseMasterId(context.req.param('id')),
      parseUpdateSupplier(await json(context)),
      requestContext(context),
    );
    return context.json(
      successResponse(context.get('requestId'), { supplier }, 'Supplier updated'),
    );
  });

  routes.post('/customers', async (context) => {
    const customer = await service(context).createCustomer(
      parseCreateCustomer(await json(context)),
      requestContext(context),
    );
    return context.json(
      successResponse(context.get('requestId'), { customer }, 'Customer created'),
      201,
    );
  });
  routes.patch('/customers/:id', async (context) => {
    const customer = await service(context).updateCustomer(
      parseMasterId(context.req.param('id')),
      parseUpdateCustomer(await json(context)),
      requestContext(context),
    );
    return context.json(
      successResponse(context.get('requestId'), { customer }, 'Customer updated'),
    );
  });

  return routes;
}
