import type { BusinessType, TenantStatus, UiMode } from '../../db/schema';

export interface TenantRecord {
  readonly id: number;
  readonly uuid: string;
  readonly slug: string;
  readonly name: string;
  readonly status: TenantStatus;
  readonly plan: string;
  readonly businessType: BusinessType;
  readonly uiMode: UiMode;
  readonly timezone: string;
}

export type TenantContext = TenantRecord;

export interface TenantLookupRepository {
  findBySlug(slug: string): Promise<TenantRecord | null>;
  findByVerifiedDomain(hostname: string): Promise<TenantRecord | null>;
}
