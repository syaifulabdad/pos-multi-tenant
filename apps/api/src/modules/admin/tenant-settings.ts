import type { TenantSettingsData } from '@pos/contracts';
import { Hono, type Context } from 'hono';

import { AppError, BadRequestError, ValidationError } from '../../lib/errors';
import { successResponse } from '../../lib/responses';
import type { AppBindings, WorkerBindings } from '../../types';
import { clientMetadata } from '../auth/http';
import type { BusinessType, UiMode } from '../../db/schema';

interface TenantSettingsInput {
  readonly name: string;
  readonly businessType: BusinessType;
  readonly uiMode: UiMode;
  readonly timezone: string;
}

export interface TenantSettingsRepository {
  update(event: {
    readonly tenantId: number;
    readonly tenantUuid: string;
    readonly actorUserId: number;
    readonly requestId: string;
    readonly input: TenantSettingsInput;
    readonly before: Readonly<Record<string, unknown>>;
    readonly occurredAt: string;
    readonly ipAddress: string | null;
    readonly userAgent: string | null;
  }): Promise<boolean>;
}

export type TenantSettingsRepositoryFactory = (env: WorkerBindings) => TenantSettingsRepository;

export class D1TenantSettingsRepository implements TenantSettingsRepository {
  constructor(private readonly database: D1Database) {}

  async update(event: Parameters<TenantSettingsRepository['update']>[0]): Promise<boolean> {
    const result = await this.database.batch([
      this.database
        .prepare(
          `UPDATE tenants
           SET name = ?1, business_type = ?2, ui_mode = ?3, timezone = ?4, updated_at = ?5
           WHERE id = ?6 AND uuid = ?7 AND status = 'active'`,
        )
        .bind(
          event.input.name,
          event.input.businessType,
          event.input.uiMode,
          event.input.timezone,
          event.occurredAt,
          event.tenantId,
          event.tenantUuid,
        ),
      this.database
        .prepare(
          `INSERT INTO audit_logs
             (tenant_id, user_id, request_id, action, entity, entity_id, before_json,
              after_json, ip_address, user_agent, created_at)
           SELECT ?1, ?2, ?3, 'UPDATE', 'tenant', ?4, ?5, ?6, ?7, ?8, ?9
           FROM tenants target WHERE target.id = ?1 AND target.uuid = ?4`,
        )
        .bind(
          event.tenantId,
          event.actorUserId,
          event.requestId,
          event.tenantUuid,
          JSON.stringify(event.before),
          JSON.stringify(event.input),
          event.ipAddress,
          event.userAgent,
          event.occurredAt,
        ),
    ]);
    return (result[0]?.meta.changes ?? 0) === 1;
  }
}

export const createTenantSettingsRepository: TenantSettingsRepositoryFactory = (env) =>
  new D1TenantSettingsRepository(env.DB);

function parse(value: unknown): TenantSettingsInput {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new BadRequestError('Request body must be a JSON object');
  }
  const body = value as Readonly<Record<string, unknown>>;
  const errors: Record<string, string[]> = {};
  const allowed = new Set(['name', 'businessType', 'uiMode', 'timezone']);
  for (const field of Object.keys(body)) {
    if (!allowed.has(field)) errors[field] = [`${field} is not allowed`];
  }
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const businessType = body.businessType;
  const uiMode = body.uiMode;
  const timezone = typeof body.timezone === 'string' ? body.timezone.trim() : '';
  if (name.length < 2 || name.length > 160) {
    errors.name = ['Name must contain between 2 and 160 characters'];
  }
  if (
    businessType !== 'retail' &&
    businessType !== 'pharmacy' &&
    businessType !== 'retail_pharmacy'
  ) {
    errors.businessType = ['Business type is invalid'];
  }
  if (uiMode !== 'simple' && uiMode !== 'professional' && uiMode !== 'advanced') {
    errors.uiMode = ['UI mode is invalid'];
  }
  try {
    if (timezone.length === 0 || timezone.length > 64) throw new Error('invalid');
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
  } catch {
    errors.timezone = ['Timezone is invalid'];
  }
  if (Object.keys(errors).length > 0) throw new ValidationError(errors);
  return {
    name,
    businessType: businessType as BusinessType,
    uiMode: uiMode as UiMode,
    timezone,
  };
}

async function readJson(context: Context<AppBindings>) {
  try {
    return await context.req.json<unknown>();
  } catch {
    throw new BadRequestError('Request body must be valid JSON');
  }
}

export function createTenantSettingsRoutes(repositoryFactory: TenantSettingsRepositoryFactory) {
  const routes = new Hono<AppBindings>();
  routes.patch('/', async (context) => {
    const tenant = context.get('tenant');
    const user = context.get('user');
    if (tenant === null || user === null)
      throw new Error('Tenant settings context was not resolved');
    const input = parse(await readJson(context));
    const updated = await repositoryFactory(context.env).update({
      tenantId: tenant.id,
      tenantUuid: tenant.uuid,
      actorUserId: user.id,
      requestId: context.get('requestId'),
      input,
      before: {
        name: tenant.name,
        businessType: tenant.businessType,
        uiMode: tenant.uiMode,
        timezone: tenant.timezone,
      },
      occurredAt: new Date().toISOString(),
      ...clientMetadata(context),
    });
    if (!updated) {
      throw new AppError({
        status: 409,
        code: 'TENANT_NOT_ACTIVE',
        message: 'Tenant settings cannot be updated',
      });
    }
    const data: TenantSettingsData = {
      id: tenant.uuid,
      slug: tenant.slug,
      name: input.name,
      plan: tenant.plan,
      businessType: input.businessType,
      uiMode: input.uiMode,
      timezone: input.timezone,
    };
    return context.json(successResponse(context.get('requestId'), data, 'Tenant settings updated'));
  });
  return routes;
}
