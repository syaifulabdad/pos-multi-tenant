import { BadRequestError, ValidationError } from '../../lib/errors';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_PATTERN = /^[a-z][a-z0-9_-]{1,49}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface CreateUserInput {
  readonly email: string;
  readonly name: string;
  readonly password: string;
  readonly roleIds: readonly string[];
  readonly branchIds: readonly string[];
}

export interface UpdateUserInput {
  readonly name: string;
  readonly status: 'active' | 'disabled';
  readonly roleIds: readonly string[];
  readonly branchIds: readonly string[];
}

export interface CreateRoleInput {
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly permissionCodes: readonly string[];
}

export interface UpdateRoleInput {
  readonly name: string;
  readonly description: string | null;
  readonly isActive: boolean;
  readonly permissionCodes: readonly string[];
}

function objectBody(value: unknown): Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new BadRequestError('Request body must be a JSON object');
  }
  return value as Readonly<Record<string, unknown>>;
}

function stringList(
  value: unknown,
  field: string,
  errors: Record<string, string[]>,
  pattern?: RegExp,
): readonly string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) {
    errors[field] = [`${field} must contain between 1 and 100 values`];
    return [];
  }
  const entries = value.filter((entry): entry is string => typeof entry === 'string');
  if (entries.length !== value.length || entries.some((entry) => entry.length === 0)) {
    errors[field] = [`${field} must contain only non-empty strings`];
    return [];
  }
  if (new Set(entries).size !== entries.length) {
    errors[field] = [`${field} must not contain duplicate values`];
    return [];
  }
  if (pattern !== undefined && entries.some((entry) => !pattern.test(entry))) {
    errors[field] = [`${field} contains an invalid identifier`];
    return [];
  }
  return entries;
}

function requiredName(value: unknown, errors: Record<string, string[]>): string {
  const name = typeof value === 'string' ? value.trim() : '';
  if (name.length < 2 || name.length > 120) {
    errors.name = ['Name must contain between 2 and 120 characters'];
  }
  return name;
}

function optionalDescription(value: unknown, errors: Record<string, string[]>): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || value.trim().length > 500) {
    errors.description = ['Description must contain at most 500 characters'];
    return null;
  }
  return value.trim();
}

function throwIfInvalid(errors: Record<string, string[]>): void {
  if (Object.keys(errors).length > 0) throw new ValidationError(errors);
}

export function parseCreateUser(value: unknown): CreateUserInput {
  const body = objectBody(value);
  const errors: Record<string, string[]> = {};
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const name = requiredName(body.name, errors);
  const password = typeof body.password === 'string' ? body.password : '';
  const roleIds = stringList(body.roleIds, 'roleIds', errors, UUID_PATTERN);
  const branchIds = stringList(body.branchIds, 'branchIds', errors, UUID_PATTERN);

  if (email.length === 0 || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    errors.email = ['Email is invalid'];
  }
  if (password.length < 12 || password.length > 128) {
    errors.password = ['Password must contain between 12 and 128 characters'];
  }
  throwIfInvalid(errors);
  return { email, name, password, roleIds, branchIds };
}

export function parseUpdateUser(value: unknown): UpdateUserInput {
  const body = objectBody(value);
  const errors: Record<string, string[]> = {};
  const name = requiredName(body.name, errors);
  const status = body.status;
  const roleIds = stringList(body.roleIds, 'roleIds', errors, UUID_PATTERN);
  const branchIds = stringList(body.branchIds, 'branchIds', errors, UUID_PATTERN);
  if (status !== 'active' && status !== 'disabled') {
    errors.status = ['Status must be active or disabled'];
  }
  throwIfInvalid(errors);
  return { name, status: status as 'active' | 'disabled', roleIds, branchIds };
}

export function parseCreateRole(value: unknown): CreateRoleInput {
  const body = objectBody(value);
  const errors: Record<string, string[]> = {};
  const code = typeof body.code === 'string' ? body.code.trim().toLowerCase() : '';
  const name = requiredName(body.name, errors);
  const description = optionalDescription(body.description, errors);
  const permissionCodes = stringList(body.permissionCodes, 'permissionCodes', errors);
  if (!CODE_PATTERN.test(code)) {
    errors.code = [
      'Code must be lowercase and contain only letters, numbers, underscores, or dashes',
    ];
  }
  throwIfInvalid(errors);
  return { code, name, description, permissionCodes };
}

export function parseUpdateRole(value: unknown): UpdateRoleInput {
  const body = objectBody(value);
  const errors: Record<string, string[]> = {};
  const name = requiredName(body.name, errors);
  const description = optionalDescription(body.description, errors);
  const isActive = body.isActive;
  const permissionCodes = stringList(body.permissionCodes, 'permissionCodes', errors);
  if (typeof isActive !== 'boolean') errors.isActive = ['isActive must be a boolean'];
  throwIfInvalid(errors);
  return { name, description, isActive: isActive as boolean, permissionCodes };
}

export function parsePublicUuid(value: string): string {
  if (!UUID_PATTERN.test(value)) throw new BadRequestError('Invalid identifier');
  return value.toLowerCase();
}

export function parseSecurityEventLimit(value: string | undefined): number {
  if (value === undefined) return 50;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
    throw new ValidationError({ limit: ['Limit must be an integer between 1 and 100'] });
  }
  return parsed;
}
