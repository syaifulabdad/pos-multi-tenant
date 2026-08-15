import type { ClientMetadata } from '../auth/domain';
import type { LocationType } from '../../db/schema';

export type InventoryBatchStatus = 'available' | 'quarantine' | 'depleted' | 'blocked';
export type InventoryReservationStatus = 'active' | 'released' | 'consumed' | 'expired';
export type InventoryMovementType =
  | 'opening'
  | 'adjustment_in'
  | 'adjustment_out'
  | 'receipt'
  | 'sale'
  | 'sale_return'
  | 'purchase_return'
  | 'transfer_in'
  | 'transfer_out'
  | 'opname_in'
  | 'opname_out';

export interface InventoryProductRecord {
  readonly id: number;
  readonly uuid: string;
  readonly sku: string;
  readonly name: string;
  readonly productUnitId: number;
  readonly productUnitUuid: string;
  readonly baseUnitId: number;
  readonly baseUnitUuid: string;
  readonly unitSymbol: string;
  readonly precision: number;
  readonly trackBatches: boolean;
  readonly trackExpiry: boolean;
  readonly status: 'active' | 'inactive';
}

export interface InventoryProductUnitRecord {
  readonly id: number;
  readonly uuid: string;
  readonly productId: number;
  readonly productUuid: string;
  readonly unitUuid: string;
  readonly unitSymbol: string;
  readonly precision: number;
  readonly conversionNumerator: number;
  readonly conversionDenominator: number;
  readonly status: 'active' | 'inactive';
}

export interface InventorySupplierRecord {
  readonly id: number;
  readonly uuid: string;
  readonly status: 'active' | 'inactive';
}

export interface InventoryLocationRecord {
  readonly id: number;
  readonly uuid: string;
  readonly warehouseId: number;
  readonly warehouseUuid: string;
  readonly warehouseCode: string;
  readonly branchId: number;
  readonly code: string;
  readonly name: string;
  readonly type: LocationType;
  readonly status: 'active' | 'inactive';
}

export interface InventoryBatchRecord {
  readonly id: number;
  readonly uuid: string;
  readonly productId: number;
  readonly productUuid: string;
  readonly supplierId: number | null;
  readonly supplierUuid: string | null;
  readonly batchNumber: string | null;
  readonly receivedAt: string;
  readonly manufacturedAt: string | null;
  readonly expiresAt: string | null;
  readonly unitCostMinor: number;
  readonly currency: string;
  readonly status: InventoryBatchStatus;
}

export interface InventoryBalanceRecord {
  readonly id: number;
  readonly locationId: number;
  readonly locationUuid: string;
  readonly warehouseId: number;
  readonly productId: number;
  readonly productUuid: string;
  readonly batchId: number | null;
  readonly batchUuid: string | null;
  readonly batchReceivedAt: string | null;
  readonly batchExpiresAt: string | null;
  readonly batchStatus: InventoryBatchStatus | null;
  readonly onHandMinor: number;
  readonly reservedMinor: number;
}

export interface InventoryMovementRecord {
  readonly uuid: string;
  readonly productUuid: string;
  readonly locationUuid: string;
  readonly batchUuid: string | null;
  readonly type: InventoryMovementType;
  readonly quantityMinor: number;
  readonly balanceAfterMinor: number;
  readonly reservedAfterMinor: number;
  readonly reason: string;
  readonly referenceType: string;
  readonly referenceUuid: string;
  readonly createdAt: string;
}

export interface ReservationAllocationRecord {
  readonly warehouseId: number;
  readonly locationId: number;
  readonly locationUuid: string;
  readonly batchId: number | null;
  readonly batchUuid: string | null;
  readonly quantityMinor: number;
}

export interface InventoryReservationRecord {
  readonly id: number;
  readonly uuid: string;
  readonly productId: number;
  readonly productUuid: string;
  readonly requestedMinor: number;
  readonly status: InventoryReservationStatus;
  readonly expiresAt: string;
  readonly allocations: readonly ReservationAllocationRecord[];
}

export interface InventoryDirectoryRecord {
  readonly products: readonly InventoryProductRecord[];
  readonly productUnits: readonly InventoryProductUnitRecord[];
  readonly suppliers: readonly InventorySupplierRecord[];
  readonly locations: readonly InventoryLocationRecord[];
  readonly batches: readonly InventoryBatchRecord[];
  readonly balances: readonly InventoryBalanceRecord[];
  readonly movements: readonly InventoryMovementRecord[];
  readonly reservations: readonly InventoryReservationRecord[];
}

interface InventoryMutationEvent extends ClientMetadata {
  readonly tenantId: number;
  readonly branchId: number;
  readonly actorUserId: number;
  readonly requestId: string;
  readonly occurredAt: string;
}

export interface CreateInventoryBatchEvent extends InventoryMutationEvent {
  readonly targetUuid: string;
  readonly productId: number;
  readonly productUuid: string;
  readonly supplierId: number | null;
  readonly supplierUuid: string | null;
  readonly batchNumber: string | null;
  readonly receivedAt: string;
  readonly manufacturedAt: string | null;
  readonly expiresAt: string | null;
  readonly unitCostMinor: number;
  readonly currency: string;
  readonly status: InventoryBatchStatus;
}

export interface AdjustInventoryEvent extends InventoryMutationEvent {
  readonly targetUuid: string;
  readonly referenceUuid: string;
  readonly locationId: number;
  readonly locationUuid: string;
  readonly warehouseId: number;
  readonly productId: number;
  readonly productUuid: string;
  readonly batchId: number | null;
  readonly batchUuid: string | null;
  readonly quantityMinor: number;
  readonly reason: string;
  readonly referenceType: 'opening' | 'adjustment';
}

export interface CreateReservationEvent extends InventoryMutationEvent {
  readonly targetUuid: string;
  readonly productId: number;
  readonly productUuid: string;
  readonly requestedMinor: number;
  readonly expiresAt: string;
  readonly allocations: readonly ReservationAllocationRecord[];
}

export interface ReleaseReservationEvent extends InventoryMutationEvent {
  readonly targetId: number;
  readonly targetUuid: string;
  readonly status: 'released' | 'expired';
  readonly allocations: readonly ReservationAllocationRecord[];
}

export interface InventoryRepository {
  loadDirectory(tenantId: number, branchId: number): Promise<InventoryDirectoryRecord>;
  findMovementByReference(
    tenantId: number,
    branchId: number,
    referenceType: string,
    referenceUuid: string,
  ): Promise<InventoryMovementRecord | null>;
  createBatch(event: CreateInventoryBatchEvent): Promise<boolean>;
  adjust(event: AdjustInventoryEvent): Promise<boolean>;
  createReservation(event: CreateReservationEvent): Promise<boolean>;
  releaseReservation(event: ReleaseReservationEvent): Promise<boolean>;
}
