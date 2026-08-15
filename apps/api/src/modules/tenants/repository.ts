import { and, eq, isNotNull } from 'drizzle-orm';

import { tenantDomains, tenants } from '../../db/schema';
import type { Database } from '../../db/client';
import type { TenantLookupRepository, TenantRecord } from './domain';

const tenantSelection = {
  id: tenants.id,
  uuid: tenants.uuid,
  slug: tenants.slug,
  name: tenants.name,
  status: tenants.status,
  plan: tenants.plan,
  businessType: tenants.businessType,
  uiMode: tenants.uiMode,
  timezone: tenants.timezone,
} as const;

export class DrizzleTenantLookupRepository implements TenantLookupRepository {
  constructor(private readonly database: Database) {}

  async findBySlug(slug: string): Promise<TenantRecord | null> {
    const rows = await this.database
      .select(tenantSelection)
      .from(tenants)
      .where(eq(tenants.slug, slug))
      .limit(1);

    return rows[0] ?? null;
  }

  async findByVerifiedDomain(hostname: string): Promise<TenantRecord | null> {
    const rows = await this.database
      .select(tenantSelection)
      .from(tenantDomains)
      .innerJoin(tenants, eq(tenantDomains.tenantId, tenants.id))
      .where(and(eq(tenantDomains.hostname, hostname), isNotNull(tenantDomains.verifiedAt)))
      .limit(1);

    return rows[0] ?? null;
  }
}
