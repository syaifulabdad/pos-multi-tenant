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
