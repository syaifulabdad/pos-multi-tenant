import { BadRequestError, ValidationError } from '../../lib/errors';
import type { InventoryBatchStatus } from './domain';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const QUANTITY_PATTERN = /^-?(?:0|[1-9]\d{0,14})(?:\.\d{1,6})?$/;

export interface CreateBatchInput {
  readonly productId: string;
  readonly supplierId: string | null;
  readonly batchNumber: string | null;
  readonly receivedAt: string;
  readonly manufacturedAt: string | null;
  readonly expiresAt: string | null;
  readonly unitCostMinor: number;
  readonly currency: string;
  readonly status: InventoryBatchStatus;
}
export interface AdjustStockInput {
  readonly productUnitId: string;
  readonly locationId: string;
  readonly batchId: string | null;
  readonly quantity: string;
  readonly reason: string;
  readonly opening: boolean;
}
export interface CreateReservationInput {
  readonly productUnitId: string;
  readonly quantity: string;
  readonly expiresInSeconds: number;
}

function object(value: unknown): Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new BadRequestError('Request body must be a JSON object');
  }
  return value as Readonly<Record<string, unknown>>;
}
function fail(errors: Record<string, string[]>): void {
  if (Object.keys(errors).length > 0) throw new ValidationError(errors);
}
function only(body: Readonly<Record<string, unknown>>, allowedFields: readonly string[]): void {
  const allowed = new Set(allowedFields);
  const errors: Record<string, string[]> = {};
  for (const field of Object.keys(body)) {
    if (!allowed.has(field)) errors[field] = [`${field} is not allowed`];
  }
  fail(errors);
}
function uuid(
  value: unknown,
  field: string,
  nullable: boolean,
  errors: Record<string, string[]>,
): string | null {
  if (nullable && (value === null || value === undefined || value === '')) return null;
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    errors[field] = [`${field} must be a valid public identifier`];
    return null;
  }
  return value.toLowerCase();
}
function requiredUuid(value: unknown, field: string, errors: Record<string, string[]>): string {
  return uuid(value, field, false, errors) ?? '';
}
function optionalText(
  value: unknown,
  field: string,
  maximum: number,
  errors: Record<string, string[]>,
): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > maximum) {
    errors[field] = [`${field} must contain at most ${maximum} characters`];
    return null;
  }
  return value.trim();
}
function isoTimestamp(
  value: unknown,
  field: string,
  nullable: boolean,
  errors: Record<string, string[]>,
): string | null {
  if (nullable && (value === null || value === undefined || value === '')) return null;
  if (typeof value !== 'string') {
    errors[field] = [`${field} must be an ISO timestamp`];
    return null;
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) {
    errors[field] = [`${field} must be a canonical ISO timestamp`];
    return null;
  }
  return value;
}
function quantity(value: unknown, signed: boolean, errors: Record<string, string[]>): string {
  const parsed = typeof value === 'string' ? value.trim() : '';
  if (
    !QUANTITY_PATTERN.test(parsed) ||
    parsed === '0' ||
    parsed === '-0' ||
    (!signed && parsed.startsWith('-'))
  ) {
    errors.quantity = [
      signed
        ? 'Quantity must be a non-zero decimal string with at most 6 decimal places'
        : 'Quantity must be a positive decimal string with at most 6 decimal places',
    ];
  }
  return parsed;
}

export function parseCreateBatch(value: unknown): CreateBatchInput {
  const body = object(value);
  only(body, [
    'productId',
    'supplierId',
    'batchNumber',
    'receivedAt',
    'manufacturedAt',
    'expiresAt',
    'unitCostMinor',
    'currency',
    'status',
  ]);
  const errors: Record<string, string[]> = {};
  const receivedAt = isoTimestamp(body.receivedAt, 'receivedAt', false, errors) ?? '';
  const manufacturedAt = isoTimestamp(body.manufacturedAt, 'manufacturedAt', true, errors);
  const expiresAt = isoTimestamp(body.expiresAt, 'expiresAt', true, errors);
  if (manufacturedAt !== null && receivedAt !== '' && manufacturedAt > receivedAt) {
    errors.manufacturedAt = ['Manufactured timestamp cannot be after receipt'];
  }
  if (expiresAt !== null && receivedAt !== '' && expiresAt < receivedAt) {
    errors.expiresAt = ['Expiry timestamp cannot be before receipt'];
  }
  const cost = body.unitCostMinor;
  if (!Number.isSafeInteger(cost) || (cost as number) < 0) {
    errors.unitCostMinor = ['Unit cost must be a non-negative safe integer'];
  }
  const currency = typeof body.currency === 'string' ? body.currency.trim().toUpperCase() : '';
  if (!CURRENCY_PATTERN.test(currency)) errors.currency = ['Currency must be a three-letter code'];
  const status = body.status;
  if (status !== 'available' && status !== 'quarantine' && status !== 'blocked') {
    errors.status = ['New batch status must be available, quarantine, or blocked'];
  }
  const result: CreateBatchInput = {
    productId: requiredUuid(body.productId, 'productId', errors),
    supplierId: uuid(body.supplierId, 'supplierId', true, errors),
    batchNumber: optionalText(body.batchNumber, 'batchNumber', 100, errors),
    receivedAt,
    manufacturedAt,
    expiresAt,
    unitCostMinor: Number.isSafeInteger(cost) ? (cost as number) : 0,
    currency,
    status: status === 'quarantine' || status === 'blocked' ? status : 'available',
  };
  fail(errors);
  return result;
}

export function parseAdjustStock(value: unknown): AdjustStockInput {
  const body = object(value);
  only(body, ['productUnitId', 'locationId', 'batchId', 'quantity', 'reason', 'opening']);
  const errors: Record<string, string[]> = {};
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (reason.length < 3 || reason.length > 500) {
    errors.reason = ['Reason must contain between 3 and 500 characters'];
  }
  if (typeof body.opening !== 'boolean') errors.opening = ['Opening must be a boolean'];
  const result = {
    productUnitId: requiredUuid(body.productUnitId, 'productUnitId', errors),
    locationId: requiredUuid(body.locationId, 'locationId', errors),
    batchId: uuid(body.batchId, 'batchId', true, errors),
    quantity: quantity(body.quantity, true, errors),
    reason,
    opening: body.opening === true,
  };
  fail(errors);
  return result;
}

export function parseCreateReservation(value: unknown): CreateReservationInput {
  const body = object(value);
  only(body, ['productUnitId', 'quantity', 'expiresInSeconds']);
  const errors: Record<string, string[]> = {};
  const expires = body.expiresInSeconds;
  if (!Number.isInteger(expires) || (expires as number) < 60 || (expires as number) > 86_400) {
    errors.expiresInSeconds = ['Reservation lifetime must be between 60 and 86400 seconds'];
  }
  const result = {
    productUnitId: requiredUuid(body.productUnitId, 'productUnitId', errors),
    quantity: quantity(body.quantity, false, errors),
    expiresInSeconds: Number.isInteger(expires) ? (expires as number) : 900,
  };
  fail(errors);
  return result;
}

export function parseInventoryId(value: string): string {
  if (!UUID_PATTERN.test(value)) throw new BadRequestError('Invalid identifier');
  return value.toLowerCase();
}

export function parseIdempotencyKey(value: string | undefined): string {
  if (value === undefined || value.trim().length < 8 || value.trim().length > 200) {
    throw new BadRequestError('Idempotency-Key must contain between 8 and 200 characters');
  }
  return value.trim();
}
