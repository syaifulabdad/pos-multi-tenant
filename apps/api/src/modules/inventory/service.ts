import type {
  InventoryBalanceData,
  InventoryBatchData,
  InventoryDirectoryData,
  InventoryLocationData,
  InventoryProductData,
  InventoryReservationData,
  ReservationAllocationData,
  StockMovementData,
} from '@pos/contracts';

import { AppError, ValidationError } from '../../lib/errors';
import type { ClientMetadata } from '../auth/domain';
import type {
  InventoryBalanceRecord,
  InventoryBatchRecord,
  InventoryDirectoryRecord,
  InventoryLocationRecord,
  InventoryMovementRecord,
  InventoryProductRecord,
  InventoryProductUnitRecord,
  InventoryRepository,
  InventoryReservationRecord,
  ReservationAllocationRecord,
} from './domain';
import type { AdjustStockInput, CreateBatchInput, CreateReservationInput } from './validation';

export interface InventoryRequestContext extends ClientMetadata {
  readonly tenantId: number;
  readonly branchId: number;
  readonly actorUserId: number;
  readonly requestId: string;
}

class InventoryNotFoundError extends AppError {
  constructor(resource: string) {
    super({ status: 404, code: 'INVENTORY_RESOURCE_NOT_FOUND', message: `${resource} not found` });
  }
}
class InventoryConflictError extends AppError {
  constructor(code: string, message: string) {
    super({ status: 409, code, message });
  }
}

function find<T extends { readonly uuid: string }>(
  records: readonly T[],
  uuid: string,
  resource: string,
): T {
  const found = records.find((record) => record.uuid === uuid);
  if (found === undefined) throw new InventoryNotFoundError(resource);
  return found;
}

function formatMinor(value: number, precision: number): string {
  const negative = value < 0;
  const digits = Math.abs(value)
    .toString()
    .padStart(precision + 1, '0');
  const formatted =
    precision === 0
      ? digits
      : `${digits.slice(0, -precision)}.${digits.slice(-precision)}`.replace(/\.?0+$/, '');
  return negative ? `-${formatted}` : formatted;
}

function decimalRational(value: string) {
  const negative = value.startsWith('-');
  const unsigned = negative ? value.slice(1) : value;
  const [whole = '0', fraction = ''] = unsigned.split('.');
  const denominator = 10n ** BigInt(fraction.length);
  const numerator = BigInt(`${whole}${fraction}`) * (negative ? -1n : 1n);
  return { numerator, denominator, decimalPlaces: fraction.length };
}

function toBaseMinor(
  quantity: string,
  productUnit: InventoryProductUnitRecord,
  product: InventoryProductRecord,
): number {
  const parsed = decimalRational(quantity);
  if (parsed.decimalPlaces > productUnit.precision) {
    throw new ValidationError({
      quantity: [`Quantity exceeds the ${productUnit.precision}-decimal precision of this unit`],
    });
  }
  const numerator =
    parsed.numerator * BigInt(productUnit.conversionNumerator) * 10n ** BigInt(product.precision);
  const denominator = parsed.denominator * BigInt(productUnit.conversionDenominator);
  if (numerator % denominator !== 0n) {
    throw new ValidationError({
      quantity: ['Quantity cannot be represented exactly in the product base unit'],
    });
  }
  const result = numerator / denominator;
  if (result > BigInt(Number.MAX_SAFE_INTEGER) || result < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new ValidationError({ quantity: ['Quantity exceeds the supported safe range'] });
  }
  if (result === 0n) {
    throw new ValidationError({ quantity: ['Quantity is below the base-unit precision'] });
  }
  return Number(result);
}

function effectiveBatchStatus(batch: InventoryBatchRecord, now: string) {
  return batch.expiresAt !== null && batch.expiresAt < now ? 'expired' : batch.status;
}
function mapProduct(product: InventoryProductRecord): InventoryProductData {
  return {
    id: product.uuid,
    sku: product.sku,
    name: product.name,
    productUnitId: product.productUnitUuid,
    baseUnitId: product.baseUnitUuid,
    unitSymbol: product.unitSymbol,
    precision: product.precision,
    trackBatches: product.trackBatches,
    trackExpiry: product.trackExpiry,
  };
}
function mapLocation(location: InventoryLocationRecord): InventoryLocationData {
  return {
    id: location.uuid,
    warehouseId: location.warehouseUuid,
    warehouseCode: location.warehouseCode,
    code: location.code,
    name: location.name,
    type: location.type,
  };
}
function mapBatch(batch: InventoryBatchRecord, now: string): InventoryBatchData {
  return {
    id: batch.uuid,
    productId: batch.productUuid,
    supplierId: batch.supplierUuid,
    batchNumber: batch.batchNumber,
    receivedAt: batch.receivedAt,
    manufacturedAt: batch.manufacturedAt,
    expiresAt: batch.expiresAt,
    unitCostMinor: batch.unitCostMinor,
    currency: batch.currency,
    status: batch.status,
    effectiveStatus: effectiveBatchStatus(batch, now),
  };
}
function mapBalance(
  balance: InventoryBalanceRecord,
  product: InventoryProductRecord,
): InventoryBalanceData {
  return {
    productId: balance.productUuid,
    locationId: balance.locationUuid,
    batchId: balance.batchUuid,
    onHand: formatMinor(balance.onHandMinor, product.precision),
    reserved: formatMinor(balance.reservedMinor, product.precision),
    available: formatMinor(balance.onHandMinor - balance.reservedMinor, product.precision),
  };
}
function mapMovement(
  movement: InventoryMovementRecord,
  product: InventoryProductRecord,
): StockMovementData {
  return {
    id: movement.uuid,
    productId: movement.productUuid,
    locationId: movement.locationUuid,
    batchId: movement.batchUuid,
    type: movement.type,
    quantity: formatMinor(movement.quantityMinor, product.precision),
    balanceAfter: formatMinor(movement.balanceAfterMinor, product.precision),
    reservedAfter: formatMinor(movement.reservedAfterMinor, product.precision),
    reason: movement.reason,
    referenceType: movement.referenceType,
    referenceId: movement.referenceUuid,
    createdAt: movement.createdAt,
  };
}
function mapAllocation(
  allocation: ReservationAllocationRecord,
  product: InventoryProductRecord,
): ReservationAllocationData {
  return {
    locationId: allocation.locationUuid,
    batchId: allocation.batchUuid,
    quantity: formatMinor(allocation.quantityMinor, product.precision),
  };
}
function mapReservation(
  reservation: InventoryReservationRecord,
  product: InventoryProductRecord,
): InventoryReservationData {
  return {
    id: reservation.uuid,
    productId: reservation.productUuid,
    quantity: formatMinor(reservation.requestedMinor, product.precision),
    status: reservation.status,
    expiresAt: reservation.expiresAt,
    allocations: reservation.allocations.map((allocation) => mapAllocation(allocation, product)),
  };
}

async function hashReference(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export class InventoryService {
  constructor(
    private readonly repository: InventoryRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private event(context: InventoryRequestContext) {
    return { ...context, occurredAt: this.now().toISOString() };
  }

  private publicDirectory(directory: InventoryDirectoryRecord): InventoryDirectoryData {
    const now = this.now().toISOString();
    const products = directory.products.filter((product) => product.status === 'active');
    const productById = new Map(directory.products.map((product) => [product.id, product]));
    return {
      products: products.map(mapProduct),
      locations: directory.locations
        .filter((location) => location.status === 'active')
        .map(mapLocation),
      batches: directory.batches.map((batch) => mapBatch(batch, now)),
      balances: directory.balances.flatMap((balance) => {
        const product = productById.get(balance.productId);
        return product === undefined ? [] : [mapBalance(balance, product)];
      }),
      movements: directory.movements.flatMap((movement) => {
        const product = directory.products.find((entry) => entry.uuid === movement.productUuid);
        return product === undefined ? [] : [mapMovement(movement, product)];
      }),
      reservations: directory.reservations.flatMap((reservation) => {
        const product = productById.get(reservation.productId);
        return product === undefined ? [] : [mapReservation(reservation, product)];
      }),
    };
  }

  async directory(context: InventoryRequestContext): Promise<InventoryDirectoryData> {
    return this.publicDirectory(
      await this.repository.loadDirectory(context.tenantId, context.branchId),
    );
  }

  async createBatch(input: CreateBatchInput, context: InventoryRequestContext) {
    const directory = await this.repository.loadDirectory(context.tenantId, context.branchId);
    const product = find(directory.products, input.productId, 'Product');
    if (product.status !== 'active') {
      throw new ValidationError({ productId: ['Product must be active'] });
    }
    const supplier =
      input.supplierId === null ? null : find(directory.suppliers, input.supplierId, 'Supplier');
    if (supplier !== null && supplier.status !== 'active') {
      throw new ValidationError({ supplierId: ['Supplier must be active'] });
    }
    if (product.trackBatches && input.batchNumber === null) {
      throw new ValidationError({ batchNumber: ['Batch number is required for this product'] });
    }
    if (!product.trackBatches && input.batchNumber !== null) {
      throw new ValidationError({ batchNumber: ['This product does not track batches'] });
    }
    if (product.trackExpiry && input.expiresAt === null) {
      throw new ValidationError({ expiresAt: ['Expiry is required for this product'] });
    }
    if (!product.trackExpiry && input.expiresAt !== null) {
      throw new ValidationError({ expiresAt: ['This product does not track expiry'] });
    }
    const targetUuid = crypto.randomUUID();
    const created = await this.repository.createBatch({
      ...this.event(context),
      targetUuid,
      productId: product.id,
      productUuid: product.uuid,
      supplierId: supplier?.id ?? null,
      supplierUuid: supplier?.uuid ?? null,
      batchNumber: input.batchNumber,
      receivedAt: input.receivedAt,
      manufacturedAt: input.manufacturedAt,
      expiresAt: input.expiresAt,
      unitCostMinor: input.unitCostMinor,
      currency: input.currency,
      status: input.status,
    });
    if (!created) throw new InventoryConflictError('BATCH_EXISTS', 'Batch number already exists');
    const reloaded = await this.repository.loadDirectory(context.tenantId, context.branchId);
    return mapBatch(find(reloaded.batches, targetUuid, 'Batch'), this.now().toISOString());
  }

  async adjust(input: AdjustStockInput, idempotencyKey: string, context: InventoryRequestContext) {
    const directory = await this.repository.loadDirectory(context.tenantId, context.branchId);
    const productUnit = find(directory.productUnits, input.productUnitId, 'Product unit');
    const product = find(directory.products, productUnit.productUuid, 'Product');
    const location = find(directory.locations, input.locationId, 'Location');
    if (product.status !== 'active' || productUnit.status !== 'active') {
      throw new ValidationError({ productUnitId: ['Product and unit must be active'] });
    }
    if (location.status !== 'active') {
      throw new ValidationError({ locationId: ['Location must be active'] });
    }
    const quantityMinor = toBaseMinor(input.quantity, productUnit, product);
    const batch = input.batchId === null ? null : find(directory.batches, input.batchId, 'Batch');
    if (product.trackBatches && batch === null) {
      throw new ValidationError({ batchId: ['A batch is required for this product'] });
    }
    if (!product.trackBatches && batch !== null) {
      throw new ValidationError({ batchId: ['This product does not use batches'] });
    }
    if (batch !== null && batch.productId !== product.id) {
      throw new InventoryNotFoundError('Batch');
    }
    if (quantityMinor > 0 && batch !== null) {
      if (
        batch.status !== 'available' ||
        effectiveBatchStatus(batch, this.now().toISOString()) === 'expired'
      ) {
        throw new ValidationError({
          batchId: ['Positive stock requires an available, unexpired batch'],
        });
      }
    }
    const referenceUuid = await hashReference(
      `${context.tenantId}:stock-adjustment:${idempotencyKey}`,
    );
    const targetUuid = crypto.randomUUID();
    const adjusted = await this.repository.adjust({
      ...this.event(context),
      targetUuid,
      referenceUuid,
      locationId: location.id,
      locationUuid: location.uuid,
      warehouseId: location.warehouseId,
      productId: product.id,
      productUuid: product.uuid,
      batchId: batch?.id ?? null,
      batchUuid: batch?.uuid ?? null,
      quantityMinor,
      reason: input.reason,
      referenceType: input.opening ? 'opening' : 'adjustment',
    });
    const movement = adjusted
      ? find(
          (await this.repository.loadDirectory(context.tenantId, context.branchId)).movements,
          targetUuid,
          'Stock movement',
        )
      : await this.repository.findMovementByReference(
          context.tenantId,
          context.branchId,
          input.opening ? 'opening' : 'adjustment',
          referenceUuid,
        );
    if (movement === null) {
      throw new InventoryConflictError(
        'INSUFFICIENT_AVAILABLE_STOCK',
        'Adjustment would reduce stock below its reserved quantity',
      );
    }
    return mapMovement(movement, product);
  }

  async createReservation(input: CreateReservationInput, context: InventoryRequestContext) {
    const directory = await this.repository.loadDirectory(context.tenantId, context.branchId);
    const productUnit = find(directory.productUnits, input.productUnitId, 'Product unit');
    const product = find(directory.products, productUnit.productUuid, 'Product');
    if (product.status !== 'active' || productUnit.status !== 'active') {
      throw new ValidationError({ productUnitId: ['Product and unit must be active'] });
    }
    const requestedMinor = toBaseMinor(input.quantity, productUnit, product);
    if (requestedMinor <= 0) {
      throw new ValidationError({ quantity: ['Reservation quantity must be positive'] });
    }
    const now = this.now().toISOString();
    const candidates = directory.balances
      .filter((balance) => {
        if (balance.productId !== product.id || balance.onHandMinor <= balance.reservedMinor) {
          return false;
        }
        const location = directory.locations.find((entry) => entry.id === balance.locationId);
        if (
          location === undefined ||
          location.status !== 'active' ||
          (location.type !== 'storage' && location.type !== 'sales_floor')
        ) {
          return false;
        }
        if (!product.trackBatches) return balance.batchId === null;
        return (
          balance.batchId !== null &&
          balance.batchStatus === 'available' &&
          (!product.trackExpiry ||
            (balance.batchExpiresAt !== null && balance.batchExpiresAt >= now))
        );
      })
      .sort((left, right) => {
        const leftExpiry = left.batchExpiresAt ?? '9999';
        const rightExpiry = right.batchExpiresAt ?? '9999';
        if (product.trackExpiry && leftExpiry !== rightExpiry) {
          return leftExpiry.localeCompare(rightExpiry);
        }
        const leftReceived = left.batchReceivedAt ?? '';
        const rightReceived = right.batchReceivedAt ?? '';
        if (leftReceived !== rightReceived) return leftReceived.localeCompare(rightReceived);
        if ((left.batchId ?? 0) !== (right.batchId ?? 0)) {
          return (left.batchId ?? 0) - (right.batchId ?? 0);
        }
        return left.id - right.id;
      });
    let remaining = requestedMinor;
    const allocations: ReservationAllocationRecord[] = [];
    for (const balance of candidates) {
      if (remaining === 0) break;
      const available = balance.onHandMinor - balance.reservedMinor;
      const quantityMinor = Math.min(remaining, available);
      allocations.push({
        warehouseId: balance.warehouseId,
        locationId: balance.locationId,
        locationUuid: balance.locationUuid,
        batchId: balance.batchId,
        batchUuid: balance.batchUuid,
        quantityMinor,
      });
      remaining -= quantityMinor;
    }
    if (remaining > 0) {
      throw new InventoryConflictError('STOCK_UNAVAILABLE', 'Available stock is insufficient');
    }
    const targetUuid = crypto.randomUUID();
    const expiresAt = new Date(this.now().getTime() + input.expiresInSeconds * 1000).toISOString();
    const created = await this.repository.createReservation({
      ...this.event(context),
      targetUuid,
      productId: product.id,
      productUuid: product.uuid,
      requestedMinor,
      expiresAt,
      allocations,
    });
    if (!created) {
      throw new InventoryConflictError(
        'STOCK_CHANGED',
        'Stock changed while the reservation was being created',
      );
    }
    const reloaded = await this.repository.loadDirectory(context.tenantId, context.branchId);
    return mapReservation(find(reloaded.reservations, targetUuid, 'Reservation'), product);
  }

  async releaseReservation(
    targetUuid: string,
    context: InventoryRequestContext,
    status: 'released' | 'expired' = 'released',
  ) {
    const directory = await this.repository.loadDirectory(context.tenantId, context.branchId);
    const target = find(directory.reservations, targetUuid, 'Reservation');
    if (target.status !== 'active') {
      throw new InventoryConflictError('RESERVATION_NOT_ACTIVE', 'Reservation is not active');
    }
    const released = await this.repository.releaseReservation({
      ...this.event(context),
      targetId: target.id,
      targetUuid: target.uuid,
      status,
      allocations: target.allocations,
    });
    if (!released) {
      throw new InventoryConflictError('RESERVATION_CHANGED', 'Reservation changed concurrently');
    }
    const product = directory.products.find((entry) => entry.id === target.productId);
    if (product === undefined) throw new InventoryNotFoundError('Product');
    return { ...mapReservation(target, product), status };
  }

  async expireReservations(context: InventoryRequestContext): Promise<number> {
    const directory = await this.repository.loadDirectory(context.tenantId, context.branchId);
    const now = this.now().toISOString();
    const expired = directory.reservations.filter(
      (reservation) => reservation.status === 'active' && reservation.expiresAt <= now,
    );
    let count = 0;
    for (const reservation of expired) {
      const released = await this.repository.releaseReservation({
        ...this.event(context),
        targetId: reservation.id,
        targetUuid: reservation.uuid,
        status: 'expired',
        allocations: reservation.allocations,
      });
      if (released) count += 1;
    }
    return count;
  }
}
