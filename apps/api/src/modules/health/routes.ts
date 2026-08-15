import { Hono } from 'hono';

import { successResponse } from '../../lib/responses';
import type { AppBindings } from '../../types';
import { checkHealth } from './service';

export const healthRoutes = new Hono<AppBindings>().get('/', async (context) => {
  const health = await checkHealth(context.env);

  return context.json(successResponse(context.get('requestId'), health));
});
