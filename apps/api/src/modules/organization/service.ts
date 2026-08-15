import type {
  LocationData,
  OrganizationBranchData,
  OrganizationDirectoryData,
  PosTerminalData,
  WarehouseData,
} from '@pos/contracts';

import { AppError, ValidationError } from '../../lib/errors';
import type { ClientMetadata } from '../auth/domain';
import type {
  LocationRecord,
  OrganizationBranchRecord,
  OrganizationDirectoryRecord,
  OrganizationRepository,
  PosTerminalRecord,
  WarehouseRecord,
} from './domain';
import type {
  CreateBranchInput,
  CreateLocationInput,
  CreateTerminalInput,
  CreateWarehouseInput,
  UpdateBranchInput,
  UpdateLocationInput,
  UpdateTerminalInput,
  UpdateWarehouseInput,
} from './validation';

interface OrganizationRequestContext extends ClientMetadata {
  readonly tenantId: number;
  readonly actorUserId: number;
  readonly requestId: string;
}

type ResourceName = 'Branch' | 'Warehouse' | 'Location' | 'Terminal';

class OrganizationNotFoundError extends AppError {
  constructor(resource: ResourceName) {
    super({
      status: 404,
      code: `${resource.toUpperCase()}_NOT_FOUND`,
      message: `${resource} not found`,
    });
  }
}

class OrganizationConflictError extends AppError {
  constructor(code: string, message: string) {
    super({ status: 409, code, message });
  }
}

function mapBranch(branch: OrganizationBranchRecord): OrganizationBranchData {
  return {
    id: branch.uuid,
    code: branch.code,
    name: branch.name,
    status: branch.status,
    timezone: branch.timezone,
    address: branch.address,
  };
}

function mapWarehouse(warehouse: WarehouseRecord): WarehouseData {
  return {
    id: warehouse.uuid,
    branchId: warehouse.branchUuid,
    code: warehouse.code,
    name: warehouse.name,
    status: warehouse.status,
    address: warehouse.address,
  };
}

function mapLocation(location: LocationRecord): LocationData {
  return {
    id: location.uuid,
    warehouseId: location.warehouseUuid,
    code: location.code,
    name: location.name,
    type: location.type,
    status: location.status,
  };
}

function mapTerminal(terminal: PosTerminalRecord): PosTerminalData {
  return {
    id: terminal.uuid,
    branchId: terminal.branchUuid,
    code: terminal.code,
    name: terminal.name,
    status: terminal.status,
    lastSeenAt: terminal.lastSeenAt,
  };
}

function publicDirectory(directory: OrganizationDirectoryRecord): OrganizationDirectoryData {
  return {
    branches: directory.branches.map(mapBranch),
    warehouses: directory.warehouses.map(mapWarehouse),
    locations: directory.locations.map(mapLocation),
    terminals: directory.terminals.map(mapTerminal),
  };
}

function findByUuid<T extends { readonly uuid: string }>(
  records: readonly T[],
  uuid: string,
  resource: ResourceName,
): T {
  const record = records.find((entry) => entry.uuid === uuid);
  if (record === undefined) throw new OrganizationNotFoundError(resource);
  return record;
}

function unavailableReference(field: 'branchId' | 'warehouseId'): never {
  throw new ValidationError({ [field]: [`${field} is not available for this tenant and status`] });
}

export class OrganizationService {
  constructor(
    private readonly repository: OrganizationRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async directory(tenantId: number): Promise<OrganizationDirectoryData> {
    return publicDirectory(await this.repository.loadDirectory(tenantId));
  }

  private event(context: OrganizationRequestContext) {
    return { ...context, occurredAt: this.now().toISOString() };
  }

  async createBranch(
    input: CreateBranchInput,
    context: OrganizationRequestContext,
  ): Promise<OrganizationBranchData> {
    const targetUuid = crypto.randomUUID();
    const created = await this.repository.createBranch({
      ...this.event(context),
      targetUuid,
      ...input,
    });
    if (!created) throw new OrganizationConflictError('BRANCH_CODE_EXISTS', 'Branch code exists');
    const directory = await this.repository.loadDirectory(context.tenantId);
    return mapBranch(findByUuid(directory.branches, targetUuid, 'Branch'));
  }

  async updateBranch(
    targetUuid: string,
    input: UpdateBranchInput,
    context: OrganizationRequestContext,
  ): Promise<OrganizationBranchData> {
    const directory = await this.repository.loadDirectory(context.tenantId);
    const target = findByUuid(directory.branches, targetUuid, 'Branch');
    if (target.status === 'active' && input.status === 'inactive') {
      if (directory.branches.filter((branch) => branch.status === 'active').length === 1) {
        throw new OrganizationConflictError(
          'LAST_ACTIVE_BRANCH',
          'The final active branch cannot be disabled',
        );
      }
      const hasActiveChildren =
        directory.warehouses.some(
          (warehouse) => warehouse.branchId === target.id && warehouse.status === 'active',
        ) ||
        directory.terminals.some(
          (terminal) => terminal.branchId === target.id && terminal.status === 'active',
        );
      if (hasActiveChildren) {
        throw new OrganizationConflictError(
          'BRANCH_HAS_ACTIVE_RESOURCES',
          'Disable branch warehouses and terminals first',
        );
      }
    }
    const updated = await this.repository.updateBranch({
      ...this.event(context),
      targetId: target.id,
      targetUuid: target.uuid,
      ...input,
      before: {
        name: target.name,
        status: target.status,
        timezone: target.timezone,
        address: target.address,
      },
    });
    if (!updated) throw new OrganizationNotFoundError('Branch');
    return mapBranch(
      findByUuid(
        (await this.repository.loadDirectory(context.tenantId)).branches,
        targetUuid,
        'Branch',
      ),
    );
  }

  async createWarehouse(
    input: CreateWarehouseInput,
    context: OrganizationRequestContext,
  ): Promise<WarehouseData> {
    const directory = await this.repository.loadDirectory(context.tenantId);
    const branch = directory.branches.find(
      (entry) => entry.uuid === input.branchId && entry.status === 'active',
    );
    if (branch === undefined) unavailableReference('branchId');
    const targetUuid = crypto.randomUUID();
    const created = await this.repository.createWarehouse({
      ...this.event(context),
      targetUuid,
      branchId: branch.id,
      branchUuid: branch.uuid,
      code: input.code,
      name: input.name,
      address: input.address,
    });
    if (!created) {
      throw new OrganizationConflictError('WAREHOUSE_CODE_EXISTS', 'Warehouse code exists');
    }
    return mapWarehouse(
      findByUuid(
        (await this.repository.loadDirectory(context.tenantId)).warehouses,
        targetUuid,
        'Warehouse',
      ),
    );
  }

  async updateWarehouse(
    targetUuid: string,
    input: UpdateWarehouseInput,
    context: OrganizationRequestContext,
  ): Promise<WarehouseData> {
    const directory = await this.repository.loadDirectory(context.tenantId);
    const target = findByUuid(directory.warehouses, targetUuid, 'Warehouse');
    const branch = directory.branches.find((entry) => entry.uuid === input.branchId);
    if (branch === undefined || (input.status === 'active' && branch.status !== 'active')) {
      unavailableReference('branchId');
    }
    if (
      target.status === 'active' &&
      input.status === 'inactive' &&
      directory.locations.some(
        (location) => location.warehouseId === target.id && location.status === 'active',
      )
    ) {
      throw new OrganizationConflictError(
        'WAREHOUSE_HAS_ACTIVE_LOCATIONS',
        'Disable warehouse locations first',
      );
    }
    const updated = await this.repository.updateWarehouse({
      ...this.event(context),
      targetId: target.id,
      targetUuid: target.uuid,
      branchId: branch.id,
      branchUuid: branch.uuid,
      name: input.name,
      status: input.status,
      address: input.address,
      before: {
        branch_id: target.branchUuid,
        name: target.name,
        status: target.status,
        address: target.address,
      },
    });
    if (!updated) throw new OrganizationNotFoundError('Warehouse');
    return mapWarehouse(
      findByUuid(
        (await this.repository.loadDirectory(context.tenantId)).warehouses,
        targetUuid,
        'Warehouse',
      ),
    );
  }

  async createLocation(
    input: CreateLocationInput,
    context: OrganizationRequestContext,
  ): Promise<LocationData> {
    const directory = await this.repository.loadDirectory(context.tenantId);
    const warehouse = directory.warehouses.find(
      (entry) => entry.uuid === input.warehouseId && entry.status === 'active',
    );
    const branch =
      warehouse === undefined
        ? undefined
        : directory.branches.find((entry) => entry.id === warehouse.branchId);
    if (warehouse === undefined || branch?.status !== 'active') unavailableReference('warehouseId');
    const targetUuid = crypto.randomUUID();
    const created = await this.repository.createLocation({
      ...this.event(context),
      targetUuid,
      warehouseId: warehouse.id,
      warehouseUuid: warehouse.uuid,
      code: input.code,
      name: input.name,
      type: input.type,
    });
    if (!created) {
      throw new OrganizationConflictError(
        'LOCATION_CODE_EXISTS',
        'Location code exists in this warehouse',
      );
    }
    return mapLocation(
      findByUuid(
        (await this.repository.loadDirectory(context.tenantId)).locations,
        targetUuid,
        'Location',
      ),
    );
  }

  async updateLocation(
    targetUuid: string,
    input: UpdateLocationInput,
    context: OrganizationRequestContext,
  ): Promise<LocationData> {
    const directory = await this.repository.loadDirectory(context.tenantId);
    const target = findByUuid(directory.locations, targetUuid, 'Location');
    const warehouse = directory.warehouses.find((entry) => entry.uuid === input.warehouseId);
    const branch =
      warehouse === undefined
        ? undefined
        : directory.branches.find((entry) => entry.id === warehouse.branchId);
    if (
      warehouse === undefined ||
      (input.status === 'active' && (warehouse.status !== 'active' || branch?.status !== 'active'))
    ) {
      unavailableReference('warehouseId');
    }
    const updated = await this.repository.updateLocation({
      ...this.event(context),
      targetId: target.id,
      targetUuid: target.uuid,
      warehouseId: warehouse.id,
      warehouseUuid: warehouse.uuid,
      name: input.name,
      type: input.type,
      status: input.status,
      before: {
        warehouse_id: target.warehouseUuid,
        name: target.name,
        type: target.type,
        status: target.status,
      },
    });
    if (!updated) throw new OrganizationNotFoundError('Location');
    return mapLocation(
      findByUuid(
        (await this.repository.loadDirectory(context.tenantId)).locations,
        targetUuid,
        'Location',
      ),
    );
  }

  async createTerminal(
    input: CreateTerminalInput,
    context: OrganizationRequestContext,
  ): Promise<PosTerminalData> {
    const directory = await this.repository.loadDirectory(context.tenantId);
    const branch = directory.branches.find(
      (entry) => entry.uuid === input.branchId && entry.status === 'active',
    );
    if (branch === undefined) unavailableReference('branchId');
    const targetUuid = crypto.randomUUID();
    const created = await this.repository.createTerminal({
      ...this.event(context),
      targetUuid,
      branchId: branch.id,
      branchUuid: branch.uuid,
      code: input.code,
      name: input.name,
    });
    if (!created) {
      throw new OrganizationConflictError('TERMINAL_CODE_EXISTS', 'Terminal code exists');
    }
    return mapTerminal(
      findByUuid(
        (await this.repository.loadDirectory(context.tenantId)).terminals,
        targetUuid,
        'Terminal',
      ),
    );
  }

  async updateTerminal(
    targetUuid: string,
    input: UpdateTerminalInput,
    context: OrganizationRequestContext,
  ): Promise<PosTerminalData> {
    const directory = await this.repository.loadDirectory(context.tenantId);
    const target = findByUuid(directory.terminals, targetUuid, 'Terminal');
    const branch = directory.branches.find((entry) => entry.uuid === input.branchId);
    if (branch === undefined || (input.status === 'active' && branch.status !== 'active')) {
      unavailableReference('branchId');
    }
    const updated = await this.repository.updateTerminal({
      ...this.event(context),
      targetId: target.id,
      targetUuid: target.uuid,
      branchId: branch.id,
      branchUuid: branch.uuid,
      name: input.name,
      status: input.status,
      before: {
        branch_id: target.branchUuid,
        name: target.name,
        status: target.status,
      },
    });
    if (!updated) throw new OrganizationNotFoundError('Terminal');
    return mapTerminal(
      findByUuid(
        (await this.repository.loadDirectory(context.tenantId)).terminals,
        targetUuid,
        'Terminal',
      ),
    );
  }
}
