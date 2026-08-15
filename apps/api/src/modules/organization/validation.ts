import { BadRequestError, ValidationError } from '../../lib/errors';
import type { OrganizationLocationType, OrganizationStatus } from './domain';

const CODE_PATTERN = /^[A-Z][A-Z0-9_-]{1,31}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LOCATION_TYPES = new Set<OrganizationLocationType>([
  'storage',
  'sales_floor',
  'receiving',
  'quarantine',
  'damaged',
  'expired',
]);

export interface CreateBranchInput {
  readonly code: string;
  readonly name: string;
  readonly timezone: string;
  readonly address: string | null;
}

export interface UpdateBranchInput {
  readonly name: string;
  readonly status: OrganizationStatus;
  readonly timezone: string;
  readonly address: string | null;
}

export interface CreateWarehouseInput {
  readonly branchId: string;
  readonly code: string;
  readonly name: string;
  readonly address: string | null;
}

export interface UpdateWarehouseInput {
  readonly branchId: string;
  readonly name: string;
  readonly status: OrganizationStatus;
  readonly address: string | null;
}

export interface CreateLocationInput {
  readonly warehouseId: string;
  readonly code: string;
  readonly name: string;
  readonly type: OrganizationLocationType;
}

export interface UpdateLocationInput {
  readonly warehouseId: string;
  readonly name: string;
  readonly type: OrganizationLocationType;
  readonly status: OrganizationStatus;
}

export interface CreateTerminalInput {
  readonly branchId: string;
  readonly code: string;
  readonly name: string;
}

export interface UpdateTerminalInput {
  readonly branchId: string;
  readonly name: string;
  readonly status: OrganizationStatus;
}

function objectBody(value: unknown): Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new BadRequestError('Request body must be a JSON object');
  }
  return value as Readonly<Record<string, unknown>>;
}

function nameValue(value: unknown, errors: Record<string, string[]>): string {
  const name = typeof value === 'string' ? value.trim() : '';
  if (name.length < 2 || name.length > 120) {
    errors.name = ['Name must contain between 2 and 120 characters'];
  }
  return name;
}

function codeValue(value: unknown, errors: Record<string, string[]>): string {
  const code = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!CODE_PATTERN.test(code)) {
    errors.code = ['Code must contain 2-32 uppercase letters, numbers, underscores, or dashes'];
  }
  return code;
}

function addressValue(value: unknown, errors: Record<string, string[]>): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || value.trim().length > 500) {
    errors.address = ['Address must contain at most 500 characters'];
    return null;
  }
  return value.trim();
}

function statusValue(value: unknown, errors: Record<string, string[]>): OrganizationStatus {
  if (value !== 'active' && value !== 'inactive') {
    errors.status = ['Status must be active or inactive'];
    return 'inactive';
  }
  return value;
}

function referenceValue(
  value: unknown,
  field: 'branchId' | 'warehouseId',
  errors: Record<string, string[]>,
): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    errors[field] = [`${field} must be a valid public identifier`];
    return '';
  }
  return value.toLowerCase();
}

function locationTypeValue(
  value: unknown,
  errors: Record<string, string[]>,
): OrganizationLocationType {
  if (typeof value !== 'string' || !LOCATION_TYPES.has(value as OrganizationLocationType)) {
    errors.type = ['Location type is invalid'];
    return 'storage';
  }
  return value as OrganizationLocationType;
}

function timezoneValue(value: unknown, errors: Record<string, string[]>): string {
  const timezone = typeof value === 'string' ? value.trim() : '';
  if (timezone.length === 0 || timezone.length > 64) {
    errors.timezone = ['Timezone is invalid'];
    return timezone;
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
  } catch {
    errors.timezone = ['Timezone is invalid'];
  }
  return timezone;
}

function finish(errors: Record<string, string[]>): void {
  if (Object.keys(errors).length > 0) throw new ValidationError(errors);
}

export function parseCreateBranch(value: unknown): CreateBranchInput {
  const body = objectBody(value);
  const errors: Record<string, string[]> = {};
  const result = {
    code: codeValue(body.code, errors),
    name: nameValue(body.name, errors),
    timezone: timezoneValue(body.timezone, errors),
    address: addressValue(body.address, errors),
  };
  finish(errors);
  return result;
}

export function parseUpdateBranch(value: unknown): UpdateBranchInput {
  const body = objectBody(value);
  const errors: Record<string, string[]> = {};
  const result = {
    name: nameValue(body.name, errors),
    status: statusValue(body.status, errors),
    timezone: timezoneValue(body.timezone, errors),
    address: addressValue(body.address, errors),
  };
  finish(errors);
  return result;
}

export function parseCreateWarehouse(value: unknown): CreateWarehouseInput {
  const body = objectBody(value);
  const errors: Record<string, string[]> = {};
  const result = {
    branchId: referenceValue(body.branchId, 'branchId', errors),
    code: codeValue(body.code, errors),
    name: nameValue(body.name, errors),
    address: addressValue(body.address, errors),
  };
  finish(errors);
  return result;
}

export function parseUpdateWarehouse(value: unknown): UpdateWarehouseInput {
  const body = objectBody(value);
  const errors: Record<string, string[]> = {};
  const result = {
    branchId: referenceValue(body.branchId, 'branchId', errors),
    name: nameValue(body.name, errors),
    status: statusValue(body.status, errors),
    address: addressValue(body.address, errors),
  };
  finish(errors);
  return result;
}

export function parseCreateLocation(value: unknown): CreateLocationInput {
  const body = objectBody(value);
  const errors: Record<string, string[]> = {};
  const result = {
    warehouseId: referenceValue(body.warehouseId, 'warehouseId', errors),
    code: codeValue(body.code, errors),
    name: nameValue(body.name, errors),
    type: locationTypeValue(body.type, errors),
  };
  finish(errors);
  return result;
}

export function parseUpdateLocation(value: unknown): UpdateLocationInput {
  const body = objectBody(value);
  const errors: Record<string, string[]> = {};
  const result = {
    warehouseId: referenceValue(body.warehouseId, 'warehouseId', errors),
    name: nameValue(body.name, errors),
    type: locationTypeValue(body.type, errors),
    status: statusValue(body.status, errors),
  };
  finish(errors);
  return result;
}

export function parseCreateTerminal(value: unknown): CreateTerminalInput {
  const body = objectBody(value);
  const errors: Record<string, string[]> = {};
  const result = {
    branchId: referenceValue(body.branchId, 'branchId', errors),
    code: codeValue(body.code, errors),
    name: nameValue(body.name, errors),
  };
  finish(errors);
  return result;
}

export function parseUpdateTerminal(value: unknown): UpdateTerminalInput {
  const body = objectBody(value);
  const errors: Record<string, string[]> = {};
  const result = {
    branchId: referenceValue(body.branchId, 'branchId', errors),
    name: nameValue(body.name, errors),
    status: statusValue(body.status, errors),
  };
  finish(errors);
  return result;
}

export function parseOrganizationId(value: string): string {
  if (!UUID_PATTERN.test(value)) throw new BadRequestError('Invalid identifier');
  return value.toLowerCase();
}
