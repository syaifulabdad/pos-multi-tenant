import type { ClientMetadata } from '../auth/domain';

export type OrganizationStatus = 'active' | 'inactive';
export type OrganizationLocationType =
  'storage' | 'sales_floor' | 'receiving' | 'quarantine' | 'damaged' | 'expired';

export interface OrganizationBranchRecord {
  readonly id: number;
  readonly uuid: string;
  readonly code: string;
  readonly name: string;
  readonly status: OrganizationStatus;
  readonly timezone: string;
  readonly address: string | null;
}

export interface WarehouseRecord {
  readonly id: number;
  readonly uuid: string;
  readonly branchId: number;
  readonly branchUuid: string;
  readonly code: string;
  readonly name: string;
  readonly status: OrganizationStatus;
  readonly address: string | null;
}

export interface LocationRecord {
  readonly id: number;
  readonly uuid: string;
  readonly warehouseId: number;
  readonly warehouseUuid: string;
  readonly code: string;
  readonly name: string;
  readonly type: OrganizationLocationType;
  readonly status: OrganizationStatus;
}

export interface PosTerminalRecord {
  readonly id: number;
  readonly uuid: string;
  readonly branchId: number;
  readonly branchUuid: string;
  readonly code: string;
  readonly name: string;
  readonly status: OrganizationStatus;
  readonly lastSeenAt: string | null;
}

export interface OrganizationDirectoryRecord {
  readonly branches: readonly OrganizationBranchRecord[];
  readonly warehouses: readonly WarehouseRecord[];
  readonly locations: readonly LocationRecord[];
  readonly terminals: readonly PosTerminalRecord[];
}

interface OrganizationMutationEvent extends ClientMetadata {
  readonly tenantId: number;
  readonly actorUserId: number;
  readonly requestId: string;
  readonly occurredAt: string;
}

export interface CreateBranchEvent extends OrganizationMutationEvent {
  readonly targetUuid: string;
  readonly code: string;
  readonly name: string;
  readonly timezone: string;
  readonly address: string | null;
}

export interface UpdateBranchEvent extends OrganizationMutationEvent {
  readonly targetId: number;
  readonly targetUuid: string;
  readonly name: string;
  readonly status: OrganizationStatus;
  readonly timezone: string;
  readonly address: string | null;
  readonly before: Readonly<Record<string, unknown>>;
}

export interface CreateWarehouseEvent extends OrganizationMutationEvent {
  readonly targetUuid: string;
  readonly branchId: number;
  readonly branchUuid: string;
  readonly code: string;
  readonly name: string;
  readonly address: string | null;
}

export interface UpdateWarehouseEvent extends OrganizationMutationEvent {
  readonly targetId: number;
  readonly targetUuid: string;
  readonly branchId: number;
  readonly branchUuid: string;
  readonly name: string;
  readonly status: OrganizationStatus;
  readonly address: string | null;
  readonly before: Readonly<Record<string, unknown>>;
}

export interface CreateLocationEvent extends OrganizationMutationEvent {
  readonly targetUuid: string;
  readonly warehouseId: number;
  readonly warehouseUuid: string;
  readonly code: string;
  readonly name: string;
  readonly type: OrganizationLocationType;
}

export interface UpdateLocationEvent extends OrganizationMutationEvent {
  readonly targetId: number;
  readonly targetUuid: string;
  readonly warehouseId: number;
  readonly warehouseUuid: string;
  readonly name: string;
  readonly type: OrganizationLocationType;
  readonly status: OrganizationStatus;
  readonly before: Readonly<Record<string, unknown>>;
}

export interface CreateTerminalEvent extends OrganizationMutationEvent {
  readonly targetUuid: string;
  readonly branchId: number;
  readonly branchUuid: string;
  readonly code: string;
  readonly name: string;
}

export interface UpdateTerminalEvent extends OrganizationMutationEvent {
  readonly targetId: number;
  readonly targetUuid: string;
  readonly branchId: number;
  readonly branchUuid: string;
  readonly name: string;
  readonly status: OrganizationStatus;
  readonly before: Readonly<Record<string, unknown>>;
}

export interface OrganizationRepository {
  loadDirectory(tenantId: number): Promise<OrganizationDirectoryRecord>;
  createBranch(event: CreateBranchEvent): Promise<boolean>;
  updateBranch(event: UpdateBranchEvent): Promise<boolean>;
  createWarehouse(event: CreateWarehouseEvent): Promise<boolean>;
  updateWarehouse(event: UpdateWarehouseEvent): Promise<boolean>;
  createLocation(event: CreateLocationEvent): Promise<boolean>;
  updateLocation(event: UpdateLocationEvent): Promise<boolean>;
  createTerminal(event: CreateTerminalEvent): Promise<boolean>;
  updateTerminal(event: UpdateTerminalEvent): Promise<boolean>;
}
