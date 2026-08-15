import { AppError } from '../../lib/errors';
import type { AppEnvironment } from '../../types';
import type { TenantContext, TenantLookupRepository, TenantRecord } from './domain';

export const RESERVED_SUBDOMAINS = new Set([
  'www',
  'api',
  'admin',
  'app',
  'support',
  'help',
  'billing',
  'status',
]);

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const IP_ADDRESS_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}$|^\[[0-9a-f:]+\]$/i;

export type TenantLocator =
  | { readonly kind: 'slug'; readonly value: string }
  | { readonly kind: 'domain'; readonly value: string };

export interface TenantResolutionInput {
  readonly hostname: string;
  readonly baseDomain: string;
  readonly environment: AppEnvironment;
}

export class TenantNotFoundError extends AppError {
  constructor() {
    super({ status: 404, code: 'TENANT_NOT_FOUND', message: 'Tenant not found' });
    this.name = 'TenantNotFoundError';
  }
}

export class TenantUnavailableError extends AppError {
  constructor(status: TenantRecord['status']) {
    const suspended = status === 'suspended';
    super({
      status: suspended ? 423 : 403,
      code: suspended ? 'TENANT_SUSPENDED' : 'TENANT_INACTIVE',
      message: suspended ? 'Tenant account is suspended' : 'Tenant account is not active',
    });
    this.name = 'TenantUnavailableError';
  }
}

function normalizeHostname(value: string): string {
  return value.trim().toLowerCase().replace(/\.$/, '');
}

export function locateTenant(input: TenantResolutionInput): TenantLocator | null {
  const hostname = normalizeHostname(input.hostname);
  const baseDomain = normalizeHostname(input.baseDomain);

  if (hostname.length === 0 || baseDomain.length === 0 || IP_ADDRESS_PATTERN.test(hostname)) {
    return null;
  }

  if (hostname === baseDomain) return null;

  const baseSuffix = `.${baseDomain}`;
  if (hostname.endsWith(baseSuffix)) {
    const candidate = hostname.slice(0, -baseSuffix.length);
    if (
      !candidate.includes('.') &&
      SLUG_PATTERN.test(candidate) &&
      !RESERVED_SUBDOMAINS.has(candidate)
    ) {
      return { kind: 'slug', value: candidate };
    }
    return null;
  }

  if (input.environment !== 'production' && hostname.endsWith('.localhost')) {
    const candidate = hostname.slice(0, -'.localhost'.length);
    if (
      !candidate.includes('.') &&
      SLUG_PATTERN.test(candidate) &&
      !RESERVED_SUBDOMAINS.has(candidate)
    ) {
      return { kind: 'slug', value: candidate };
    }
    return null;
  }

  if (hostname === 'localhost') return null;

  return { kind: 'domain', value: hostname };
}

export class TenantResolverService {
  constructor(private readonly repository: TenantLookupRepository) {}

  async resolve(input: TenantResolutionInput): Promise<TenantContext> {
    const locator = locateTenant(input);
    if (locator === null) throw new TenantNotFoundError();

    const tenant =
      locator.kind === 'slug'
        ? await this.repository.findBySlug(locator.value)
        : await this.repository.findByVerifiedDomain(locator.value);

    if (tenant === null) throw new TenantNotFoundError();
    if (tenant.status !== 'active') throw new TenantUnavailableError(tenant.status);

    return tenant;
  }
}
