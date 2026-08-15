export type FieldErrors = Readonly<Record<string, readonly string[]>>;

export interface ApiMeta {
  readonly request_id: string;
  readonly [key: string]: unknown;
}

export interface ApiSuccess<T> {
  readonly success: true;
  readonly data: T;
  readonly message: string;
  readonly meta: ApiMeta;
}

export interface ApiError {
  readonly success: false;
  readonly message: string;
  readonly errors: FieldErrors;
  readonly request_id: string;
  readonly code?: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export interface TenantBootstrapData {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly plan: string;
  readonly businessType: 'retail' | 'pharmacy' | 'retail_pharmacy';
  readonly uiMode: 'simple' | 'professional' | 'advanced';
  readonly timezone: string;
}

export interface AuthUserData {
  readonly id: string;
  readonly email: string;
  readonly name: string;
}

export interface AuthSessionData {
  readonly expiresAt: string;
}

export interface LoginData {
  readonly user: AuthUserData;
  readonly session: AuthSessionData;
}

export type SessionData = LoginData;

export interface LogoutData {
  readonly loggedOut: true;
}

export interface BranchData {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly timezone: string;
  readonly isDefault: boolean;
}

export interface AccessContextData {
  readonly permissions: readonly string[];
  readonly branches: readonly BranchData[];
  readonly activeBranch: BranchData | null;
}

export interface ManagedSessionData {
  readonly id: string;
  readonly createdAt: string;
  readonly lastSeenAt: string;
  readonly expiresAt: string;
  readonly userAgent: string | null;
  readonly current: boolean;
}

export interface SessionListData {
  readonly sessions: readonly ManagedSessionData[];
}

export interface SessionRevokeData {
  readonly revoked: true;
  readonly current: boolean;
}

export interface AdminRoleSummaryData {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly isSystem: boolean;
  readonly isActive: boolean;
  readonly permissions: readonly string[];
}

export interface AdminBranchSummaryData {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface AdminUserData {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly status: 'invited' | 'active' | 'disabled';
  readonly roles: readonly AdminRoleSummaryData[];
  readonly branches: readonly AdminBranchSummaryData[];
  readonly createdAt: string;
  readonly lastLoginAt: string | null;
}

export interface UserDirectoryData {
  readonly users: readonly AdminUserData[];
  readonly roles: readonly AdminRoleSummaryData[];
  readonly branches: readonly AdminBranchSummaryData[];
}

export interface RoleDirectoryData {
  readonly roles: readonly AdminRoleSummaryData[];
  readonly permissions: readonly {
    readonly code: string;
    readonly description: string;
  }[];
}

export interface SecurityEventData {
  readonly type: string;
  readonly severity: string;
  readonly requestId: string;
  readonly user: {
    readonly id: string;
    readonly email: string;
  } | null;
  readonly metadata: Readonly<Record<string, unknown>> | null;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly createdAt: string;
}

export interface SecurityEventListData {
  readonly events: readonly SecurityEventData[];
}

export type OrganizationStatus = 'active' | 'inactive';
export type LocationType =
  'storage' | 'sales_floor' | 'receiving' | 'quarantine' | 'damaged' | 'expired';

export interface OrganizationBranchData {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly status: OrganizationStatus;
  readonly timezone: string;
  readonly address: string | null;
}

export interface WarehouseData {
  readonly id: string;
  readonly branchId: string;
  readonly code: string;
  readonly name: string;
  readonly status: OrganizationStatus;
  readonly address: string | null;
}

export interface LocationData {
  readonly id: string;
  readonly warehouseId: string;
  readonly code: string;
  readonly name: string;
  readonly type: LocationType;
  readonly status: OrganizationStatus;
}

export interface PosTerminalData {
  readonly id: string;
  readonly branchId: string;
  readonly code: string;
  readonly name: string;
  readonly status: OrganizationStatus;
  readonly lastSeenAt: string | null;
}

export interface OrganizationDirectoryData {
  readonly branches: readonly OrganizationBranchData[];
  readonly warehouses: readonly WarehouseData[];
  readonly locations: readonly LocationData[];
  readonly terminals: readonly PosTerminalData[];
}

export type MasterStatus = 'active' | 'inactive';
export type ProductType = 'stock' | 'service';
export type CustomerType = 'individual' | 'business';

export interface CategoryData {
  readonly id: string;
  readonly parentId: string | null;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: MasterStatus;
}

export interface BrandData {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: MasterStatus;
}

export interface UnitData {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly symbol: string;
  readonly precision: number;
  readonly status: MasterStatus;
}

export interface ProductUnitData {
  readonly id: string;
  readonly productId: string;
  readonly unitId: string;
  readonly conversionNumerator: number;
  readonly conversionDenominator: number;
  readonly barcode: string | null;
  readonly isBase: boolean;
  readonly isSaleUnit: boolean;
  readonly isPurchaseUnit: boolean;
  readonly status: MasterStatus;
}

export interface ProductPriceData {
  readonly id: string;
  readonly productUnitId: string;
  readonly branchId: string | null;
  readonly amountMinor: number;
  readonly currency: string;
  readonly status: 'active' | 'superseded';
  readonly validFrom: string;
  readonly validTo: string | null;
}

export interface ProductData {
  readonly id: string;
  readonly categoryId: string | null;
  readonly brandId: string | null;
  readonly baseUnitId: string;
  readonly sku: string;
  readonly name: string;
  readonly description: string | null;
  readonly type: ProductType;
  readonly status: MasterStatus;
  readonly trackBatches: boolean;
  readonly trackExpiry: boolean;
  readonly allowDecimal: boolean;
  readonly units: readonly ProductUnitData[];
  readonly prices: readonly ProductPriceData[];
}

export interface SupplierData {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly contactName: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly address: string | null;
  readonly taxId: string | null;
  readonly status: MasterStatus;
}

export interface CustomerData {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly type: CustomerType;
  readonly phone: string | null;
  readonly email: string | null;
  readonly address: string | null;
  readonly status: MasterStatus;
}

export interface MasterDirectoryData {
  readonly categories: readonly CategoryData[];
  readonly brands: readonly BrandData[];
  readonly units: readonly UnitData[];
  readonly products: readonly ProductData[];
  readonly suppliers: readonly SupplierData[];
  readonly customers: readonly CustomerData[];
  readonly branches: readonly AdminBranchSummaryData[];
}

export type InventoryBatchStatus = 'available' | 'quarantine' | 'depleted' | 'blocked';
export type InventoryBatchEffectiveStatus = InventoryBatchStatus | 'expired';
export type ReservationStatus = 'active' | 'released' | 'consumed' | 'expired';
export type StockMovementType =
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

export interface InventoryProductData {
  readonly id: string;
  readonly sku: string;
  readonly name: string;
  readonly productUnitId: string;
  readonly baseUnitId: string;
  readonly unitSymbol: string;
  readonly precision: number;
  readonly trackBatches: boolean;
  readonly trackExpiry: boolean;
}

export interface InventoryLocationData {
  readonly id: string;
  readonly warehouseId: string;
  readonly warehouseCode: string;
  readonly code: string;
  readonly name: string;
  readonly type: LocationType;
}

export interface InventoryBatchData {
  readonly id: string;
  readonly productId: string;
  readonly supplierId: string | null;
  readonly batchNumber: string | null;
  readonly receivedAt: string;
  readonly manufacturedAt: string | null;
  readonly expiresAt: string | null;
  readonly unitCostMinor: number;
  readonly currency: string;
  readonly status: InventoryBatchStatus;
  readonly effectiveStatus: InventoryBatchEffectiveStatus;
}

export interface InventoryBalanceData {
  readonly productId: string;
  readonly locationId: string;
  readonly batchId: string | null;
  readonly onHand: string;
  readonly reserved: string;
  readonly available: string;
}

export interface StockMovementData {
  readonly id: string;
  readonly productId: string;
  readonly locationId: string;
  readonly batchId: string | null;
  readonly type: StockMovementType;
  readonly quantity: string;
  readonly balanceAfter: string;
  readonly reservedAfter: string;
  readonly reason: string;
  readonly referenceType: string;
  readonly referenceId: string;
  readonly createdAt: string;
}

export interface ReservationAllocationData {
  readonly locationId: string;
  readonly batchId: string | null;
  readonly quantity: string;
}

export interface InventoryReservationData {
  readonly id: string;
  readonly productId: string;
  readonly quantity: string;
  readonly status: ReservationStatus;
  readonly expiresAt: string;
  readonly allocations: readonly ReservationAllocationData[];
}

export interface InventoryDirectoryData {
  readonly products: readonly InventoryProductData[];
  readonly locations: readonly InventoryLocationData[];
  readonly batches: readonly InventoryBatchData[];
  readonly balances: readonly InventoryBalanceData[];
  readonly movements: readonly StockMovementData[];
  readonly reservations: readonly InventoryReservationData[];
}

export interface TenantSettingsData {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly plan: string;
  readonly businessType: 'retail' | 'pharmacy' | 'retail_pharmacy';
  readonly uiMode: 'simple' | 'professional' | 'advanced';
  readonly timezone: string;
}

export interface HealthData {
  readonly status: 'ok';
  readonly environment: 'development' | 'staging' | 'production' | 'test';
  readonly services: {
    readonly database: 'up';
    readonly objectStorage: 'configured';
    readonly cache: 'configured';
  };
  readonly checkedAt: string;
}
