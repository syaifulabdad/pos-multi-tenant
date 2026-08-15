import type { TenantBootstrapData } from '@pos/contracts';
import { Hono } from 'hono';

import { successResponse } from '../../lib/responses';
import type { AppBindings } from '../../types';

export const tenantRoutes = new Hono<AppBindings>().get('/bootstrap', (context) => {
  const tenant = context.get('tenant');
  if (tenant === null) throw new Error('Tenant context was not resolved');

  const data: TenantBootstrapData = {
    id: tenant.uuid,
    slug: tenant.slug,
    name: tenant.name,
    plan: tenant.plan,
    businessType: tenant.businessType,
    uiMode: tenant.uiMode,
    timezone: tenant.timezone,
  };

  return context.json(successResponse(context.get('requestId'), data));
});
