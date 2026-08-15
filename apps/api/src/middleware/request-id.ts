import { createMiddleware } from 'hono/factory';

import type { AppBindings } from '../types';

const REQUEST_ID_HEADER = 'X-Request-ID';
const VALID_REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

function resolveRequestId(candidate: string | undefined): string {
  if (candidate !== undefined && VALID_REQUEST_ID.test(candidate)) {
    return candidate;
  }

  return crypto.randomUUID();
}

export const requestId = createMiddleware<AppBindings>(async (context, next) => {
  const id = resolveRequestId(context.req.header(REQUEST_ID_HEADER));

  context.set('requestId', id);
  context.set('tenant', null);
  context.set('user', null);
  context.set('session', null);
  context.set('permissions', []);
  context.set('branches', []);
  context.set('branch', null);
  context.header(REQUEST_ID_HEADER, id);

  await next();
});
