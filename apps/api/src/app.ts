import { Hono } from 'hono';

import { AppError } from './lib/errors';
import { errorResponse } from './lib/responses';
import {
  createAccessRepository,
  loadAccessContext,
  requireBranch,
  requirePermission,
  requirePermissionByMethod,
  type AccessRepositoryFactory,
} from './middleware/access';
import {
  authenticateSession,
  createAuthRepository,
  type AuthRepositoryFactory,
} from './middleware/auth';
import {
  createRateLimitRepository,
  rateLimit,
  type RateLimitRepositoryFactory,
} from './middleware/rate-limit';
import { requestId } from './middleware/request-id';
import { requestLogger } from './middleware/request-logger';
import { tenantResolver, type TenantRepositoryFactory } from './middleware/tenant-resolver';
import { createAccessRoutes } from './modules/access/routes';
import {
  createAdminRepository,
  createAdminRoutes,
  type AdminRepositoryFactory,
} from './modules/admin/routes';
import {
  createTenantSettingsRepository,
  createTenantSettingsRoutes,
  type TenantSettingsRepositoryFactory,
} from './modules/admin/tenant-settings';
import { createAuthRoutes } from './modules/auth/routes';
import { healthRoutes } from './modules/health/routes';
import {
  createInventoryRepository,
  createInventoryRoutes,
  type InventoryRepositoryFactory,
} from './modules/inventory/routes';
import {
  createMasterRepository,
  createMasterRoutes,
  type MasterRepositoryFactory,
} from './modules/master/routes';
import {
  createOrganizationRepository,
  createOrganizationRoutes,
  type OrganizationRepositoryFactory,
} from './modules/organization/routes';
import {
  createSessionManagementRepository,
  createSessionRoutes,
  type SessionManagementRepositoryFactory,
} from './modules/sessions/routes';
import { tenantRoutes } from './modules/tenants/routes';
import type { AppBindings } from './types';

const LOGIN_RATE_LIMITS = [
  { scope: 'ip', limit: 10, windowSeconds: 60 },
  { scope: 'tenant', limit: 100, windowSeconds: 60 },
] as const;
const BRANCH_SWITCH_RATE_LIMITS = [
  { scope: 'user', limit: 30, windowSeconds: 60 },
  { scope: 'tenant', limit: 500, windowSeconds: 60 },
] as const;
const SESSION_MANAGEMENT_RATE_LIMITS = [
  { scope: 'user', limit: 60, windowSeconds: 60 },
  { scope: 'tenant', limit: 1_000, windowSeconds: 60 },
] as const;
const ADMIN_RATE_LIMITS = [
  { scope: 'user', limit: 120, windowSeconds: 60 },
  { scope: 'tenant', limit: 2_000, windowSeconds: 60 },
] as const;
const INVENTORY_RATE_LIMITS = [
  { scope: 'user', limit: 300, windowSeconds: 60 },
  { scope: 'tenant', limit: 5_000, windowSeconds: 60 },
] as const;

export interface AppDependencies {
  readonly tenantRepositoryFactory?: TenantRepositoryFactory;
  readonly authRepositoryFactory?: AuthRepositoryFactory;
  readonly accessRepositoryFactory?: AccessRepositoryFactory;
  readonly adminRepositoryFactory?: AdminRepositoryFactory;
  readonly tenantSettingsRepositoryFactory?: TenantSettingsRepositoryFactory;
  readonly inventoryRepositoryFactory?: InventoryRepositoryFactory;
  readonly masterRepositoryFactory?: MasterRepositoryFactory;
  readonly organizationRepositoryFactory?: OrganizationRepositoryFactory;
  readonly rateLimitRepositoryFactory?: RateLimitRepositoryFactory;
  readonly sessionManagementRepositoryFactory?: SessionManagementRepositoryFactory;
}

export function createApp(dependencies: AppDependencies = {}) {
  const application = new Hono<AppBindings>();
  const authRepositoryFactory = dependencies.authRepositoryFactory ?? createAuthRepository;
  const accessRepositoryFactory = dependencies.accessRepositoryFactory ?? createAccessRepository;
  const adminRepositoryFactory = dependencies.adminRepositoryFactory ?? createAdminRepository;
  const tenantSettingsRepositoryFactory =
    dependencies.tenantSettingsRepositoryFactory ?? createTenantSettingsRepository;
  const inventoryRepositoryFactory =
    dependencies.inventoryRepositoryFactory ?? createInventoryRepository;
  const masterRepositoryFactory = dependencies.masterRepositoryFactory ?? createMasterRepository;
  const organizationRepositoryFactory =
    dependencies.organizationRepositoryFactory ?? createOrganizationRepository;
  const rateLimitRepositoryFactory =
    dependencies.rateLimitRepositoryFactory ?? createRateLimitRepository;
  const sessionManagementRepositoryFactory =
    dependencies.sessionManagementRepositoryFactory ?? createSessionManagementRepository;

  application.use('*', requestId);
  application.use('*', requestLogger);
  application.use('/api/v1/tenant/*', tenantResolver(dependencies.tenantRepositoryFactory));
  application.use('/api/v1/auth/*', tenantResolver(dependencies.tenantRepositoryFactory));
  application.use('/api/v1/access/*', tenantResolver(dependencies.tenantRepositoryFactory));
  application.use('/api/v1/admin/*', tenantResolver(dependencies.tenantRepositoryFactory));
  application.use('/api/v1/inventory', tenantResolver(dependencies.tenantRepositoryFactory));
  application.use('/api/v1/inventory/*', tenantResolver(dependencies.tenantRepositoryFactory));
  application.use('/api/v1/master', tenantResolver(dependencies.tenantRepositoryFactory));
  application.use('/api/v1/master/*', tenantResolver(dependencies.tenantRepositoryFactory));
  application.use(
    '/api/v1/auth/login',
    rateLimit('auth.login', LOGIN_RATE_LIMITS, rateLimitRepositoryFactory),
  );
  application.use('/api/v1/auth/me', authenticateSession(authRepositoryFactory));
  application.use('/api/v1/auth/logout', authenticateSession(authRepositoryFactory));
  application.use('/api/v1/auth/sessions', authenticateSession(authRepositoryFactory));
  application.use('/api/v1/auth/sessions/*', authenticateSession(authRepositoryFactory));
  application.use('/api/v1/access/*', authenticateSession(authRepositoryFactory));
  application.use('/api/v1/admin/*', authenticateSession(authRepositoryFactory));
  application.use('/api/v1/inventory', authenticateSession(authRepositoryFactory));
  application.use('/api/v1/inventory/*', authenticateSession(authRepositoryFactory));
  application.use('/api/v1/master', authenticateSession(authRepositoryFactory));
  application.use('/api/v1/master/*', authenticateSession(authRepositoryFactory));
  application.use(
    '/api/v1/auth/sessions',
    rateLimit('auth.sessions', SESSION_MANAGEMENT_RATE_LIMITS, rateLimitRepositoryFactory),
  );
  application.use(
    '/api/v1/auth/sessions/*',
    rateLimit('auth.sessions', SESSION_MANAGEMENT_RATE_LIMITS, rateLimitRepositoryFactory),
  );
  application.use(
    '/api/v1/access/branch',
    rateLimit('access.branch_switch', BRANCH_SWITCH_RATE_LIMITS, rateLimitRepositoryFactory),
  );
  application.use(
    '/api/v1/admin/*',
    rateLimit('admin.manage', ADMIN_RATE_LIMITS, rateLimitRepositoryFactory),
  );
  application.use(
    '/api/v1/inventory',
    rateLimit('inventory.manage', INVENTORY_RATE_LIMITS, rateLimitRepositoryFactory),
  );
  application.use(
    '/api/v1/inventory/*',
    rateLimit('inventory.manage', INVENTORY_RATE_LIMITS, rateLimitRepositoryFactory),
  );
  application.use(
    '/api/v1/master',
    rateLimit('master.manage', ADMIN_RATE_LIMITS, rateLimitRepositoryFactory),
  );
  application.use(
    '/api/v1/master/*',
    rateLimit('master.manage', ADMIN_RATE_LIMITS, rateLimitRepositoryFactory),
  );
  application.use('/api/v1/access/*', loadAccessContext(accessRepositoryFactory));
  application.use('/api/v1/admin/*', loadAccessContext(accessRepositoryFactory));
  application.use('/api/v1/inventory', loadAccessContext(accessRepositoryFactory));
  application.use('/api/v1/inventory/*', loadAccessContext(accessRepositoryFactory));
  application.use('/api/v1/inventory', requireBranch);
  application.use('/api/v1/inventory/*', requireBranch);
  application.use('/api/v1/master', loadAccessContext(accessRepositoryFactory));
  application.use('/api/v1/master/*', loadAccessContext(accessRepositoryFactory));
  application.use(
    '/api/v1/access/branch',
    requirePermission('branch.switch', accessRepositoryFactory),
  );
  application.use('/api/v1/admin/users', requirePermission('user.manage', accessRepositoryFactory));
  application.use(
    '/api/v1/admin/users/*',
    requirePermission('user.manage', accessRepositoryFactory),
  );
  application.use('/api/v1/admin/roles', requirePermission('role.manage', accessRepositoryFactory));
  application.use(
    '/api/v1/admin/roles/*',
    requirePermission('role.manage', accessRepositoryFactory),
  );
  application.use(
    '/api/v1/admin/security-events',
    requirePermission('settings.manage', accessRepositoryFactory),
  );
  application.use(
    '/api/v1/admin/organization',
    requirePermission('settings.manage', accessRepositoryFactory),
  );
  application.use(
    '/api/v1/admin/organization/*',
    requirePermission('settings.manage', accessRepositoryFactory),
  );
  application.use(
    '/api/v1/admin/tenant',
    requirePermission('settings.manage', accessRepositoryFactory),
  );
  application.use(
    '/api/v1/inventory/directory',
    requirePermission('stock.view', accessRepositoryFactory),
  );
  application.use(
    '/api/v1/inventory/batches',
    requirePermission('stock.adjust', accessRepositoryFactory),
  );
  application.use(
    '/api/v1/inventory/adjustments',
    requirePermission('stock.adjust', accessRepositoryFactory),
  );
  application.use(
    '/api/v1/inventory/reservations',
    requirePermissionByMethod({ POST: 'sales.create' }, accessRepositoryFactory),
  );
  application.use(
    '/api/v1/inventory/reservations/:id/release',
    requirePermission('sales.create', accessRepositoryFactory),
  );
  application.use(
    '/api/v1/inventory/reservations/expire',
    requirePermission('stock.adjust', accessRepositoryFactory),
  );
  application.use(
    '/api/v1/master/directory',
    requirePermission('product.view', accessRepositoryFactory),
  );
  for (const path of [
    '/api/v1/master/categories/*',
    '/api/v1/master/brands/*',
    '/api/v1/master/units/*',
    '/api/v1/master/products/*',
    '/api/v1/master/product-units/*',
  ]) {
    application.use(
      path,
      requirePermissionByMethod(
        { POST: 'product.create', PATCH: 'product.update' },
        accessRepositoryFactory,
      ),
    );
  }
  application.use(
    '/api/v1/master/prices/*',
    requirePermissionByMethod({ POST: 'product.update' }, accessRepositoryFactory),
  );
  application.use(
    '/api/v1/master/suppliers/*',
    requirePermissionByMethod(
      { POST: 'purchase.create', PATCH: 'purchase.create' },
      accessRepositoryFactory,
    ),
  );
  application.use(
    '/api/v1/master/customers/*',
    requirePermissionByMethod(
      { POST: 'sales.create', PATCH: 'sales.create' },
      accessRepositoryFactory,
    ),
  );

  application.route('/api/v1/health', healthRoutes);
  application.route('/api/v1/tenant', tenantRoutes);
  application.route('/api/v1/auth', createAuthRoutes(authRepositoryFactory));
  application.route(
    '/api/v1/auth/sessions',
    createSessionRoutes(sessionManagementRepositoryFactory),
  );
  application.route('/api/v1/access', createAccessRoutes(accessRepositoryFactory));
  application.route('/api/v1/admin', createAdminRoutes(adminRepositoryFactory));
  application.route(
    '/api/v1/admin/tenant',
    createTenantSettingsRoutes(tenantSettingsRepositoryFactory),
  );
  application.route(
    '/api/v1/admin/organization',
    createOrganizationRoutes(organizationRepositoryFactory),
  );
  application.route('/api/v1/inventory', createInventoryRoutes(inventoryRepositoryFactory));
  application.route('/api/v1/master', createMasterRoutes(masterRepositoryFactory));

  application.notFound((context) => {
    return context.json(
      errorResponse(context.get('requestId'), 'Resource not found', {}, 'NOT_FOUND'),
      404,
    );
  });

  application.onError((error, context) => {
    const requestIdValue = context.get('requestId') ?? crypto.randomUUID();

    if (error instanceof AppError) {
      return context.json(
        errorResponse(requestIdValue, error.message, error.errors, error.code),
        error.status,
      );
    }

    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        event: 'request.failed',
        request_id: requestIdValue,
        error: {
          name: error.name,
          message: context.env.APP_ENV === 'production' ? 'Internal server error' : error.message,
        },
      }),
    );

    return context.json(
      errorResponse(requestIdValue, 'Internal server error', {}, 'INTERNAL_SERVER_ERROR'),
      500,
    );
  });

  return application;
}

export const app = createApp();
