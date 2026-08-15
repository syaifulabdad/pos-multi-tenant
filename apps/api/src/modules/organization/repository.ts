import type { WorkerBindings } from '../../types';
import type {
  CreateBranchEvent,
  CreateLocationEvent,
  CreateTerminalEvent,
  CreateWarehouseEvent,
  LocationRecord,
  OrganizationBranchRecord,
  OrganizationDirectoryRecord,
  OrganizationLocationType,
  OrganizationRepository,
  OrganizationStatus,
  PosTerminalRecord,
  UpdateBranchEvent,
  UpdateLocationEvent,
  UpdateTerminalEvent,
  UpdateWarehouseEvent,
  WarehouseRecord,
} from './domain';

interface BranchRow {
  readonly id: number;
  readonly uuid: string;
  readonly code: string;
  readonly name: string;
  readonly status: OrganizationStatus;
  readonly timezone: string;
  readonly address: string | null;
}

interface WarehouseRow {
  readonly id: number;
  readonly uuid: string;
  readonly branch_id: number;
  readonly branch_uuid: string;
  readonly code: string;
  readonly name: string;
  readonly status: OrganizationStatus;
  readonly address: string | null;
}

interface LocationRow {
  readonly id: number;
  readonly uuid: string;
  readonly warehouse_id: number;
  readonly warehouse_uuid: string;
  readonly code: string;
  readonly name: string;
  readonly type: OrganizationLocationType;
  readonly status: OrganizationStatus;
}

interface TerminalRow {
  readonly id: number;
  readonly uuid: string;
  readonly branch_id: number;
  readonly branch_uuid: string;
  readonly code: string;
  readonly name: string;
  readonly status: OrganizationStatus;
  readonly last_seen_at: string | null;
}

function afterJson(value: Readonly<Record<string, unknown>>): string {
  return JSON.stringify(value);
}

export class D1OrganizationRepository implements OrganizationRepository {
  constructor(private readonly database: WorkerBindings['DB']) {}

  async loadDirectory(tenantId: number): Promise<OrganizationDirectoryRecord> {
    const [branchResult, warehouseResult, locationResult, terminalResult] = await Promise.all([
      this.database
        .prepare(
          `SELECT id, uuid, code, name, status, timezone, address
           FROM branches
           WHERE tenant_id = ?1
           ORDER BY code ASC, id ASC`,
        )
        .bind(tenantId)
        .all<BranchRow>(),
      this.database
        .prepare(
          `SELECT w.id, w.uuid, w.branch_id, b.uuid AS branch_uuid,
                  w.code, w.name, w.status, w.address
           FROM warehouses w
           INNER JOIN branches b ON b.tenant_id = w.tenant_id AND b.id = w.branch_id
           WHERE w.tenant_id = ?1
           ORDER BY w.code ASC, w.id ASC`,
        )
        .bind(tenantId)
        .all<WarehouseRow>(),
      this.database
        .prepare(
          `SELECT l.id, l.uuid, l.warehouse_id, w.uuid AS warehouse_uuid,
                  l.code, l.name, l.type, l.status
           FROM locations l
           INNER JOIN warehouses w ON w.tenant_id = l.tenant_id AND w.id = l.warehouse_id
           WHERE l.tenant_id = ?1
           ORDER BY w.code ASC, l.code ASC, l.id ASC`,
        )
        .bind(tenantId)
        .all<LocationRow>(),
      this.database
        .prepare(
          `SELECT pt.id, pt.uuid, pt.branch_id, b.uuid AS branch_uuid,
                  pt.code, pt.name, pt.status, pt.last_seen_at
           FROM pos_terminals pt
           INNER JOIN branches b ON b.tenant_id = pt.tenant_id AND b.id = pt.branch_id
           WHERE pt.tenant_id = ?1
           ORDER BY pt.code ASC, pt.id ASC`,
        )
        .bind(tenantId)
        .all<TerminalRow>(),
    ]);

    const branches: OrganizationBranchRecord[] = branchResult.results.map((row) => ({
      id: row.id,
      uuid: row.uuid,
      code: row.code,
      name: row.name,
      status: row.status,
      timezone: row.timezone,
      address: row.address,
    }));
    const warehouses: WarehouseRecord[] = warehouseResult.results.map((row) => ({
      id: row.id,
      uuid: row.uuid,
      branchId: row.branch_id,
      branchUuid: row.branch_uuid,
      code: row.code,
      name: row.name,
      status: row.status,
      address: row.address,
    }));
    const locations: LocationRecord[] = locationResult.results.map((row) => ({
      id: row.id,
      uuid: row.uuid,
      warehouseId: row.warehouse_id,
      warehouseUuid: row.warehouse_uuid,
      code: row.code,
      name: row.name,
      type: row.type,
      status: row.status,
    }));
    const terminals: PosTerminalRecord[] = terminalResult.results.map((row) => ({
      id: row.id,
      uuid: row.uuid,
      branchId: row.branch_id,
      branchUuid: row.branch_uuid,
      code: row.code,
      name: row.name,
      status: row.status,
      lastSeenAt: row.last_seen_at,
    }));
    return { branches, warehouses, locations, terminals };
  }

  async createBranch(event: CreateBranchEvent): Promise<boolean> {
    const result = await this.database.batch([
      this.database
        .prepare(
          `INSERT INTO branches
             (uuid, tenant_id, code, name, status, timezone, address, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, 'active', ?5, ?6, ?7, ?7)
           ON CONFLICT DO NOTHING`,
        )
        .bind(
          event.targetUuid,
          event.tenantId,
          event.code,
          event.name,
          event.timezone,
          event.address,
          event.occurredAt,
        ),
      this.database
        .prepare(
          `INSERT INTO audit_logs
             (tenant_id, user_id, request_id, action, entity, entity_id, after_json,
              ip_address, user_agent, created_at)
           SELECT ?1, ?2, ?3, 'CREATE', 'branch', ?4, ?5, ?6, ?7, ?8
           FROM branches target
           WHERE target.tenant_id = ?1 AND target.uuid = ?4`,
        )
        .bind(
          event.tenantId,
          event.actorUserId,
          event.requestId,
          event.targetUuid,
          afterJson({
            code: event.code,
            name: event.name,
            status: 'active',
            timezone: event.timezone,
            address: event.address,
          }),
          event.ipAddress,
          event.userAgent,
          event.occurredAt,
        ),
    ]);
    return (result[0]?.meta.changes ?? 0) === 1;
  }

  async updateBranch(event: UpdateBranchEvent): Promise<boolean> {
    const result = await this.database.batch([
      this.database
        .prepare(
          `UPDATE branches
           SET name = ?1, status = ?2, timezone = ?3, address = ?4, updated_at = ?5
           WHERE tenant_id = ?6 AND id = ?7 AND uuid = ?8`,
        )
        .bind(
          event.name,
          event.status,
          event.timezone,
          event.address,
          event.occurredAt,
          event.tenantId,
          event.targetId,
          event.targetUuid,
        ),
      this.database
        .prepare(
          `INSERT INTO audit_logs
             (tenant_id, user_id, request_id, action, entity, entity_id, before_json,
              after_json, ip_address, user_agent, created_at)
           SELECT ?1, ?2, ?3, 'UPDATE', 'branch', ?4, ?5, ?6, ?7, ?8, ?9
           FROM branches target
           WHERE target.tenant_id = ?1 AND target.id = ?10 AND target.uuid = ?4`,
        )
        .bind(
          event.tenantId,
          event.actorUserId,
          event.requestId,
          event.targetUuid,
          JSON.stringify(event.before),
          afterJson({
            name: event.name,
            status: event.status,
            timezone: event.timezone,
            address: event.address,
          }),
          event.ipAddress,
          event.userAgent,
          event.occurredAt,
          event.targetId,
        ),
    ]);
    return (result[0]?.meta.changes ?? 0) === 1;
  }

  async createWarehouse(event: CreateWarehouseEvent): Promise<boolean> {
    const result = await this.database.batch([
      this.database
        .prepare(
          `INSERT INTO warehouses
             (uuid, tenant_id, branch_id, code, name, status, address, created_at, updated_at)
           SELECT ?1, ?2, b.id, ?4, ?5, 'active', ?6, ?7, ?7
           FROM branches b
           WHERE b.tenant_id = ?2 AND b.id = ?3 AND b.status = 'active'
           ON CONFLICT DO NOTHING`,
        )
        .bind(
          event.targetUuid,
          event.tenantId,
          event.branchId,
          event.code,
          event.name,
          event.address,
          event.occurredAt,
        ),
      this.database
        .prepare(
          `INSERT INTO audit_logs
             (tenant_id, user_id, request_id, action, entity, entity_id, after_json,
              ip_address, user_agent, created_at)
           SELECT ?1, ?2, ?3, 'CREATE', 'warehouse', ?4, ?5, ?6, ?7, ?8
           FROM warehouses target
           WHERE target.tenant_id = ?1 AND target.uuid = ?4`,
        )
        .bind(
          event.tenantId,
          event.actorUserId,
          event.requestId,
          event.targetUuid,
          afterJson({
            branch_id: event.branchUuid,
            code: event.code,
            name: event.name,
            status: 'active',
            address: event.address,
          }),
          event.ipAddress,
          event.userAgent,
          event.occurredAt,
        ),
    ]);
    return (result[0]?.meta.changes ?? 0) === 1;
  }

  async updateWarehouse(event: UpdateWarehouseEvent): Promise<boolean> {
    const result = await this.database.batch([
      this.database
        .prepare(
          `UPDATE warehouses
           SET branch_id = ?1, name = ?2, status = ?3, address = ?4, updated_at = ?5
           WHERE tenant_id = ?6 AND id = ?7 AND uuid = ?8
             AND EXISTS (
               SELECT 1 FROM branches b
               WHERE b.tenant_id = ?6 AND b.id = ?1
                 AND (?3 = 'inactive' OR b.status = 'active')
             )`,
        )
        .bind(
          event.branchId,
          event.name,
          event.status,
          event.address,
          event.occurredAt,
          event.tenantId,
          event.targetId,
          event.targetUuid,
        ),
      this.database
        .prepare(
          `INSERT INTO audit_logs
             (tenant_id, user_id, request_id, action, entity, entity_id, before_json,
              after_json, ip_address, user_agent, created_at)
           SELECT ?1, ?2, ?3, 'UPDATE', 'warehouse', ?4, ?5, ?6, ?7, ?8, ?9
           FROM warehouses target
           WHERE target.tenant_id = ?1 AND target.id = ?10 AND target.uuid = ?4
             AND target.branch_id = ?11 AND target.name = ?12 AND target.status = ?13`,
        )
        .bind(
          event.tenantId,
          event.actorUserId,
          event.requestId,
          event.targetUuid,
          JSON.stringify(event.before),
          afterJson({
            branch_id: event.branchUuid,
            name: event.name,
            status: event.status,
            address: event.address,
          }),
          event.ipAddress,
          event.userAgent,
          event.occurredAt,
          event.targetId,
          event.branchId,
          event.name,
          event.status,
        ),
    ]);
    return (result[0]?.meta.changes ?? 0) === 1;
  }

  async createLocation(event: CreateLocationEvent): Promise<boolean> {
    const result = await this.database.batch([
      this.database
        .prepare(
          `INSERT INTO locations
             (uuid, tenant_id, warehouse_id, code, name, type, status, created_at, updated_at)
           SELECT ?1, ?2, w.id, ?4, ?5, ?6, 'active', ?7, ?7
           FROM warehouses w
           INNER JOIN branches b ON b.tenant_id = w.tenant_id AND b.id = w.branch_id
           WHERE w.tenant_id = ?2 AND w.id = ?3
             AND w.status = 'active' AND b.status = 'active'
           ON CONFLICT DO NOTHING`,
        )
        .bind(
          event.targetUuid,
          event.tenantId,
          event.warehouseId,
          event.code,
          event.name,
          event.type,
          event.occurredAt,
        ),
      this.database
        .prepare(
          `INSERT INTO audit_logs
             (tenant_id, user_id, request_id, action, entity, entity_id, after_json,
              ip_address, user_agent, created_at)
           SELECT ?1, ?2, ?3, 'CREATE', 'location', ?4, ?5, ?6, ?7, ?8
           FROM locations target
           WHERE target.tenant_id = ?1 AND target.uuid = ?4`,
        )
        .bind(
          event.tenantId,
          event.actorUserId,
          event.requestId,
          event.targetUuid,
          afterJson({
            warehouse_id: event.warehouseUuid,
            code: event.code,
            name: event.name,
            type: event.type,
            status: 'active',
          }),
          event.ipAddress,
          event.userAgent,
          event.occurredAt,
        ),
    ]);
    return (result[0]?.meta.changes ?? 0) === 1;
  }

  async updateLocation(event: UpdateLocationEvent): Promise<boolean> {
    const result = await this.database.batch([
      this.database
        .prepare(
          `UPDATE locations
           SET warehouse_id = ?1, name = ?2, type = ?3, status = ?4, updated_at = ?5
           WHERE tenant_id = ?6 AND id = ?7 AND uuid = ?8
             AND EXISTS (
               SELECT 1 FROM warehouses w
               INNER JOIN branches b ON b.tenant_id = w.tenant_id AND b.id = w.branch_id
               WHERE w.tenant_id = ?6 AND w.id = ?1
                 AND (?4 = 'inactive' OR (w.status = 'active' AND b.status = 'active'))
             )`,
        )
        .bind(
          event.warehouseId,
          event.name,
          event.type,
          event.status,
          event.occurredAt,
          event.tenantId,
          event.targetId,
          event.targetUuid,
        ),
      this.database
        .prepare(
          `INSERT INTO audit_logs
             (tenant_id, user_id, request_id, action, entity, entity_id, before_json,
              after_json, ip_address, user_agent, created_at)
           SELECT ?1, ?2, ?3, 'UPDATE', 'location', ?4, ?5, ?6, ?7, ?8, ?9
           FROM locations target
           WHERE target.tenant_id = ?1 AND target.id = ?10 AND target.uuid = ?4
             AND target.warehouse_id = ?11 AND target.name = ?12
             AND target.type = ?13 AND target.status = ?14`,
        )
        .bind(
          event.tenantId,
          event.actorUserId,
          event.requestId,
          event.targetUuid,
          JSON.stringify(event.before),
          afterJson({
            warehouse_id: event.warehouseUuid,
            name: event.name,
            type: event.type,
            status: event.status,
          }),
          event.ipAddress,
          event.userAgent,
          event.occurredAt,
          event.targetId,
          event.warehouseId,
          event.name,
          event.type,
          event.status,
        ),
    ]);
    return (result[0]?.meta.changes ?? 0) === 1;
  }

  async createTerminal(event: CreateTerminalEvent): Promise<boolean> {
    const result = await this.database.batch([
      this.database
        .prepare(
          `INSERT INTO pos_terminals
             (uuid, tenant_id, branch_id, code, name, status, created_at, updated_at)
           SELECT ?1, ?2, b.id, ?4, ?5, 'active', ?6, ?6
           FROM branches b
           WHERE b.tenant_id = ?2 AND b.id = ?3 AND b.status = 'active'
           ON CONFLICT DO NOTHING`,
        )
        .bind(
          event.targetUuid,
          event.tenantId,
          event.branchId,
          event.code,
          event.name,
          event.occurredAt,
        ),
      this.database
        .prepare(
          `INSERT INTO audit_logs
             (tenant_id, user_id, request_id, action, entity, entity_id, after_json,
              ip_address, user_agent, created_at)
           SELECT ?1, ?2, ?3, 'CREATE', 'pos_terminal', ?4, ?5, ?6, ?7, ?8
           FROM pos_terminals target
           WHERE target.tenant_id = ?1 AND target.uuid = ?4`,
        )
        .bind(
          event.tenantId,
          event.actorUserId,
          event.requestId,
          event.targetUuid,
          afterJson({
            branch_id: event.branchUuid,
            code: event.code,
            name: event.name,
            status: 'active',
          }),
          event.ipAddress,
          event.userAgent,
          event.occurredAt,
        ),
    ]);
    return (result[0]?.meta.changes ?? 0) === 1;
  }

  async updateTerminal(event: UpdateTerminalEvent): Promise<boolean> {
    const result = await this.database.batch([
      this.database
        .prepare(
          `UPDATE pos_terminals
           SET branch_id = ?1, name = ?2, status = ?3, updated_at = ?4
           WHERE tenant_id = ?5 AND id = ?6 AND uuid = ?7
             AND EXISTS (
               SELECT 1 FROM branches b
               WHERE b.tenant_id = ?5 AND b.id = ?1
                 AND (?3 = 'inactive' OR b.status = 'active')
             )`,
        )
        .bind(
          event.branchId,
          event.name,
          event.status,
          event.occurredAt,
          event.tenantId,
          event.targetId,
          event.targetUuid,
        ),
      this.database
        .prepare(
          `INSERT INTO audit_logs
             (tenant_id, user_id, request_id, action, entity, entity_id, before_json,
              after_json, ip_address, user_agent, created_at)
           SELECT ?1, ?2, ?3, 'UPDATE', 'pos_terminal', ?4, ?5, ?6, ?7, ?8, ?9
           FROM pos_terminals target
           WHERE target.tenant_id = ?1 AND target.id = ?10 AND target.uuid = ?4
             AND target.branch_id = ?11 AND target.name = ?12 AND target.status = ?13`,
        )
        .bind(
          event.tenantId,
          event.actorUserId,
          event.requestId,
          event.targetUuid,
          JSON.stringify(event.before),
          afterJson({
            branch_id: event.branchUuid,
            name: event.name,
            status: event.status,
          }),
          event.ipAddress,
          event.userAgent,
          event.occurredAt,
          event.targetId,
          event.branchId,
          event.name,
          event.status,
        ),
    ]);
    return (result[0]?.meta.changes ?? 0) === 1;
  }
}
