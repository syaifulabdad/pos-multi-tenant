import { BadRequestError, ValidationError } from '../../lib/errors';
import type { MasterCustomerType, MasterProductType, MasterRecordStatus } from './domain';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CODE_PATTERN = /^[A-Z][A-Z0-9_.-]{1,49}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface NamedInput {
  readonly name: string;
  readonly description: string | null;
}

export interface CreateCategoryInput extends NamedInput {
  readonly code: string;
  readonly parentId: string | null;
}
export interface UpdateCategoryInput extends NamedInput {
  readonly parentId: string | null;
  readonly status: MasterRecordStatus;
}
export interface CreateBrandInput extends NamedInput {
  readonly code: string;
}
export interface UpdateBrandInput extends NamedInput {
  readonly status: MasterRecordStatus;
}
export interface CreateUnitInput {
  readonly code: string;
  readonly name: string;
  readonly symbol: string;
  readonly precision: number;
}
export interface UpdateUnitInput {
  readonly name: string;
  readonly symbol: string;
  readonly precision: number;
  readonly status: MasterRecordStatus;
}
export interface CreateProductInput extends NamedInput {
  readonly sku: string;
  readonly categoryId: string | null;
  readonly brandId: string | null;
  readonly baseUnitId: string;
  readonly type: MasterProductType;
  readonly trackBatches: boolean;
  readonly trackExpiry: boolean;
  readonly allowDecimal: boolean;
  readonly barcode: string | null;
}
export interface UpdateProductInput extends NamedInput {
  readonly categoryId: string | null;
  readonly brandId: string | null;
  readonly type: MasterProductType;
  readonly status: MasterRecordStatus;
  readonly trackBatches: boolean;
  readonly trackExpiry: boolean;
  readonly allowDecimal: boolean;
}
export interface CreateProductUnitInput {
  readonly productId: string;
  readonly unitId: string;
  readonly conversionNumerator: number;
  readonly conversionDenominator: number;
  readonly barcode: string | null;
  readonly isSaleUnit: boolean;
  readonly isPurchaseUnit: boolean;
}
export interface UpdateProductUnitInput {
  readonly conversionNumerator: number;
  readonly conversionDenominator: number;
  readonly barcode: string | null;
  readonly isSaleUnit: boolean;
  readonly isPurchaseUnit: boolean;
  readonly status: MasterRecordStatus;
}
export interface SetProductPriceInput {
  readonly productUnitId: string;
  readonly branchId: string | null;
  readonly amountMinor: number;
  readonly currency: string;
}
export interface CreateSupplierInput {
  readonly code: string;
  readonly name: string;
  readonly contactName: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly address: string | null;
  readonly taxId: string | null;
}
export interface UpdateSupplierInput extends Omit<CreateSupplierInput, 'code'> {
  readonly status: MasterRecordStatus;
}
export interface CreateCustomerInput {
  readonly code: string;
  readonly name: string;
  readonly type: MasterCustomerType;
  readonly phone: string | null;
  readonly email: string | null;
  readonly address: string | null;
}
export interface UpdateCustomerInput extends Omit<CreateCustomerInput, 'code'> {
  readonly status: MasterRecordStatus;
}

function bodyObject(value: unknown): Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new BadRequestError('Request body must be a JSON object');
  }
  return value as Readonly<Record<string, unknown>>;
}

function fail(errors: Record<string, string[]>): void {
  if (Object.keys(errors).length > 0) throw new ValidationError(errors);
}

function requireOnly(body: Readonly<Record<string, unknown>>, fields: readonly string[]): void {
  const allowed = new Set(fields);
  const errors: Record<string, string[]> = {};
  for (const field of Object.keys(body)) {
    if (!allowed.has(field)) errors[field] = [`${field} is not allowed`];
  }
  fail(errors);
}

function code(value: unknown, field: string, errors: Record<string, string[]>): string {
  const parsed = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!CODE_PATTERN.test(parsed)) {
    errors[field] = [
      `${field} must contain 2-50 uppercase letters, numbers, dots, dashes, or underscores`,
    ];
  }
  return parsed;
}

function name(value: unknown, errors: Record<string, string[]>): string {
  const parsed = typeof value === 'string' ? value.trim() : '';
  if (parsed.length < 2 || parsed.length > 160) {
    errors.name = ['Name must contain between 2 and 160 characters'];
  }
  return parsed;
}

function optionalText(
  value: unknown,
  field: string,
  maximum: number,
  errors: Record<string, string[]>,
): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.trim().length > maximum) {
    errors[field] = [`${field} must contain at most ${maximum} characters`];
    return null;
  }
  return value.trim();
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

function status(value: unknown, errors: Record<string, string[]>): MasterRecordStatus {
  if (value !== 'active' && value !== 'inactive') {
    errors.status = ['Status must be active or inactive'];
    return 'inactive';
  }
  return value;
}

function booleanValue(value: unknown, field: string, errors: Record<string, string[]>): boolean {
  if (typeof value !== 'boolean') {
    errors[field] = [`${field} must be a boolean`];
    return false;
  }
  return value;
}

function positiveInteger(value: unknown, field: string, errors: Record<string, string[]>): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1 || (value as number) > 1_000_000_000) {
    errors[field] = [`${field} must be an integer between 1 and 1000000000`];
    return 1;
  }
  return value as number;
}

function named(
  body: Readonly<Record<string, unknown>>,
  errors: Record<string, string[]>,
): NamedInput {
  return {
    name: name(body.name, errors),
    description: optionalText(body.description, 'description', 1000, errors),
  };
}

function productType(value: unknown, errors: Record<string, string[]>): MasterProductType {
  if (value !== 'stock' && value !== 'service') {
    errors.type = ['Product type must be stock or service'];
    return 'stock';
  }
  return value;
}

function contact(body: Readonly<Record<string, unknown>>, errors: Record<string, string[]>) {
  const email = optionalText(body.email, 'email', 254, errors)?.toLowerCase() ?? null;
  if (email !== null && !EMAIL_PATTERN.test(email)) errors.email = ['Email is invalid'];
  return {
    phone: optionalText(body.phone, 'phone', 40, errors),
    email,
    address: optionalText(body.address, 'address', 1000, errors),
  };
}

function productRules(
  type: MasterProductType,
  trackBatches: boolean,
  trackExpiry: boolean,
  errors: Record<string, string[]>,
): void {
  if (trackExpiry && !trackBatches) {
    errors.trackExpiry = ['Expiry tracking requires batch tracking'];
  }
  if (type === 'service' && (trackBatches || trackExpiry)) {
    errors.type = ['Service products cannot use batch or expiry tracking'];
  }
}

export function parseCreateCategory(value: unknown): CreateCategoryInput {
  const body = bodyObject(value);
  requireOnly(body, ['code', 'parentId', 'name', 'description']);
  const errors: Record<string, string[]> = {};
  const result = {
    ...named(body, errors),
    code: code(body.code, 'code', errors),
    parentId: uuid(body.parentId, 'parentId', true, errors),
  };
  fail(errors);
  return result;
}

export function parseUpdateCategory(value: unknown): UpdateCategoryInput {
  const body = bodyObject(value);
  requireOnly(body, ['parentId', 'name', 'description', 'status']);
  const errors: Record<string, string[]> = {};
  const result = {
    ...named(body, errors),
    parentId: uuid(body.parentId, 'parentId', true, errors),
    status: status(body.status, errors),
  };
  fail(errors);
  return result;
}

export function parseCreateBrand(value: unknown): CreateBrandInput {
  const body = bodyObject(value);
  requireOnly(body, ['code', 'name', 'description']);
  const errors: Record<string, string[]> = {};
  const result = { ...named(body, errors), code: code(body.code, 'code', errors) };
  fail(errors);
  return result;
}

export function parseUpdateBrand(value: unknown): UpdateBrandInput {
  const body = bodyObject(value);
  requireOnly(body, ['name', 'description', 'status']);
  const errors: Record<string, string[]> = {};
  const result = { ...named(body, errors), status: status(body.status, errors) };
  fail(errors);
  return result;
}

export function parseCreateUnit(value: unknown): CreateUnitInput {
  const body = bodyObject(value);
  requireOnly(body, ['code', 'name', 'symbol', 'precision']);
  const errors: Record<string, string[]> = {};
  const symbol = typeof body.symbol === 'string' ? body.symbol.trim() : '';
  const precision = body.precision;
  if (symbol.length < 1 || symbol.length > 20)
    errors.symbol = ['Symbol is required and limited to 20 characters'];
  if (!Number.isInteger(precision) || (precision as number) < 0 || (precision as number) > 6) {
    errors.precision = ['Precision must be an integer between 0 and 6'];
  }
  const result = {
    code: code(body.code, 'code', errors),
    name: name(body.name, errors),
    symbol,
    precision: Number.isInteger(precision) ? (precision as number) : 0,
  };
  fail(errors);
  return result;
}

export function parseUpdateUnit(value: unknown): UpdateUnitInput {
  const body = bodyObject(value);
  requireOnly(body, ['name', 'symbol', 'precision', 'status']);
  const errors: Record<string, string[]> = {};
  const symbol = typeof body.symbol === 'string' ? body.symbol.trim() : '';
  const precision = body.precision;
  if (symbol.length < 1 || symbol.length > 20)
    errors.symbol = ['Symbol is required and limited to 20 characters'];
  if (!Number.isInteger(precision) || (precision as number) < 0 || (precision as number) > 6) {
    errors.precision = ['Precision must be an integer between 0 and 6'];
  }
  const result = {
    name: name(body.name, errors),
    symbol,
    precision: Number.isInteger(precision) ? (precision as number) : 0,
    status: status(body.status, errors),
  };
  fail(errors);
  return result;
}

export function parseCreateProduct(value: unknown): CreateProductInput {
  const body = bodyObject(value);
  requireOnly(body, [
    'sku',
    'name',
    'description',
    'categoryId',
    'brandId',
    'baseUnitId',
    'type',
    'trackBatches',
    'trackExpiry',
    'allowDecimal',
    'barcode',
  ]);
  const errors: Record<string, string[]> = {};
  const type = productType(body.type, errors);
  const trackBatches = booleanValue(body.trackBatches, 'trackBatches', errors);
  const trackExpiry = booleanValue(body.trackExpiry, 'trackExpiry', errors);
  productRules(type, trackBatches, trackExpiry, errors);
  const result = {
    ...named(body, errors),
    sku: code(body.sku, 'sku', errors),
    categoryId: uuid(body.categoryId, 'categoryId', true, errors),
    brandId: uuid(body.brandId, 'brandId', true, errors),
    baseUnitId: requiredUuid(body.baseUnitId, 'baseUnitId', errors),
    type,
    trackBatches,
    trackExpiry,
    allowDecimal: booleanValue(body.allowDecimal, 'allowDecimal', errors),
    barcode: optionalText(body.barcode, 'barcode', 100, errors),
  };
  fail(errors);
  return result;
}

export function parseUpdateProduct(value: unknown): UpdateProductInput {
  const body = bodyObject(value);
  requireOnly(body, [
    'name',
    'description',
    'categoryId',
    'brandId',
    'type',
    'status',
    'trackBatches',
    'trackExpiry',
    'allowDecimal',
  ]);
  const errors: Record<string, string[]> = {};
  const type = productType(body.type, errors);
  const trackBatches = booleanValue(body.trackBatches, 'trackBatches', errors);
  const trackExpiry = booleanValue(body.trackExpiry, 'trackExpiry', errors);
  productRules(type, trackBatches, trackExpiry, errors);
  const result = {
    ...named(body, errors),
    categoryId: uuid(body.categoryId, 'categoryId', true, errors),
    brandId: uuid(body.brandId, 'brandId', true, errors),
    type,
    status: status(body.status, errors),
    trackBatches,
    trackExpiry,
    allowDecimal: booleanValue(body.allowDecimal, 'allowDecimal', errors),
  };
  fail(errors);
  return result;
}

export function parseCreateProductUnit(value: unknown): CreateProductUnitInput {
  const body = bodyObject(value);
  requireOnly(body, [
    'productId',
    'unitId',
    'conversionNumerator',
    'conversionDenominator',
    'barcode',
    'isSaleUnit',
    'isPurchaseUnit',
  ]);
  const errors: Record<string, string[]> = {};
  const result = {
    productId: requiredUuid(body.productId, 'productId', errors),
    unitId: requiredUuid(body.unitId, 'unitId', errors),
    conversionNumerator: positiveInteger(body.conversionNumerator, 'conversionNumerator', errors),
    conversionDenominator: positiveInteger(
      body.conversionDenominator,
      'conversionDenominator',
      errors,
    ),
    barcode: optionalText(body.barcode, 'barcode', 100, errors),
    isSaleUnit: booleanValue(body.isSaleUnit, 'isSaleUnit', errors),
    isPurchaseUnit: booleanValue(body.isPurchaseUnit, 'isPurchaseUnit', errors),
  };
  fail(errors);
  return result;
}

export function parseUpdateProductUnit(value: unknown): UpdateProductUnitInput {
  const body = bodyObject(value);
  requireOnly(body, [
    'conversionNumerator',
    'conversionDenominator',
    'barcode',
    'isSaleUnit',
    'isPurchaseUnit',
    'status',
  ]);
  const errors: Record<string, string[]> = {};
  const result = {
    conversionNumerator: positiveInteger(body.conversionNumerator, 'conversionNumerator', errors),
    conversionDenominator: positiveInteger(
      body.conversionDenominator,
      'conversionDenominator',
      errors,
    ),
    barcode: optionalText(body.barcode, 'barcode', 100, errors),
    isSaleUnit: booleanValue(body.isSaleUnit, 'isSaleUnit', errors),
    isPurchaseUnit: booleanValue(body.isPurchaseUnit, 'isPurchaseUnit', errors),
    status: status(body.status, errors),
  };
  fail(errors);
  return result;
}

export function parseSetProductPrice(value: unknown): SetProductPriceInput {
  const body = bodyObject(value);
  requireOnly(body, ['productUnitId', 'branchId', 'amountMinor', 'currency']);
  const errors: Record<string, string[]> = {};
  const amount = body.amountMinor;
  if (!Number.isSafeInteger(amount) || (amount as number) < 0) {
    errors.amountMinor = ['Amount must be a non-negative safe integer in minor currency units'];
  }
  const currency = typeof body.currency === 'string' ? body.currency.trim().toUpperCase() : 'IDR';
  if (!/^[A-Z]{3}$/.test(currency)) errors.currency = ['Currency must be a three-letter code'];
  const result = {
    productUnitId: requiredUuid(body.productUnitId, 'productUnitId', errors),
    branchId: uuid(body.branchId, 'branchId', true, errors),
    amountMinor: Number.isSafeInteger(amount) ? (amount as number) : 0,
    currency,
  };
  fail(errors);
  return result;
}

export function parseCreateSupplier(value: unknown): CreateSupplierInput {
  const body = bodyObject(value);
  requireOnly(body, ['code', 'name', 'contactName', 'phone', 'email', 'address', 'taxId']);
  const errors: Record<string, string[]> = {};
  const result = {
    code: code(body.code, 'code', errors),
    name: name(body.name, errors),
    contactName: optionalText(body.contactName, 'contactName', 160, errors),
    ...contact(body, errors),
    taxId: optionalText(body.taxId, 'taxId', 80, errors),
  };
  fail(errors);
  return result;
}

export function parseUpdateSupplier(value: unknown): UpdateSupplierInput {
  const body = bodyObject(value);
  requireOnly(body, ['name', 'contactName', 'phone', 'email', 'address', 'taxId', 'status']);
  const errors: Record<string, string[]> = {};
  const result = {
    name: name(body.name, errors),
    contactName: optionalText(body.contactName, 'contactName', 160, errors),
    ...contact(body, errors),
    taxId: optionalText(body.taxId, 'taxId', 80, errors),
    status: status(body.status, errors),
  };
  fail(errors);
  return result;
}

export function parseCreateCustomer(value: unknown): CreateCustomerInput {
  const body = bodyObject(value);
  requireOnly(body, ['code', 'name', 'type', 'phone', 'email', 'address']);
  const errors: Record<string, string[]> = {};
  const type = body.type;
  if (type !== 'individual' && type !== 'business') errors.type = ['Customer type is invalid'];
  const result = {
    code: code(body.code, 'code', errors),
    name: name(body.name, errors),
    type: (type === 'business' ? 'business' : 'individual') as MasterCustomerType,
    ...contact(body, errors),
  };
  fail(errors);
  return result;
}

export function parseUpdateCustomer(value: unknown): UpdateCustomerInput {
  const body = bodyObject(value);
  requireOnly(body, ['name', 'type', 'phone', 'email', 'address', 'status']);
  const errors: Record<string, string[]> = {};
  const type = body.type;
  if (type !== 'individual' && type !== 'business') errors.type = ['Customer type is invalid'];
  const result = {
    name: name(body.name, errors),
    type: (type === 'business' ? 'business' : 'individual') as MasterCustomerType,
    ...contact(body, errors),
    status: status(body.status, errors),
  };
  fail(errors);
  return result;
}

export function parseMasterId(value: string): string {
  if (!UUID_PATTERN.test(value)) throw new BadRequestError('Invalid identifier');
  return value.toLowerCase();
}
