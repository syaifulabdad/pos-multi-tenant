import type { ClientMetadata } from '../auth/domain';

export type MasterRecordStatus = 'active' | 'inactive';
export type MasterProductType = 'stock' | 'service';
export type MasterCustomerType = 'individual' | 'business';

export interface CategoryRecord {
  readonly id: number;
  readonly uuid: string;
  readonly parentId: number | null;
  readonly parentUuid: string | null;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: MasterRecordStatus;
}

export interface BrandRecord {
  readonly id: number;
  readonly uuid: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: MasterRecordStatus;
}

export interface UnitRecord {
  readonly id: number;
  readonly uuid: string;
  readonly code: string;
  readonly name: string;
  readonly symbol: string;
  readonly precision: number;
  readonly status: MasterRecordStatus;
}

export interface ProductUnitRecord {
  readonly id: number;
  readonly uuid: string;
  readonly productId: number;
  readonly productUuid: string;
  readonly unitId: number;
  readonly unitUuid: string;
  readonly conversionNumerator: number;
  readonly conversionDenominator: number;
  readonly barcode: string | null;
  readonly isBase: boolean;
  readonly isSaleUnit: boolean;
  readonly isPurchaseUnit: boolean;
  readonly status: MasterRecordStatus;
}

export interface ProductPriceRecord {
  readonly id: number;
  readonly uuid: string;
  readonly productUnitId: number;
  readonly productUnitUuid: string;
  readonly branchId: number | null;
  readonly branchUuid: string | null;
  readonly amountMinor: number;
  readonly currency: string;
  readonly status: 'active' | 'superseded';
  readonly validFrom: string;
  readonly validTo: string | null;
}

export interface ProductRecord {
  readonly id: number;
  readonly uuid: string;
  readonly categoryId: number | null;
  readonly categoryUuid: string | null;
  readonly brandId: number | null;
  readonly brandUuid: string | null;
  readonly baseUnitId: number;
  readonly baseUnitUuid: string;
  readonly sku: string;
  readonly name: string;
  readonly description: string | null;
  readonly type: MasterProductType;
  readonly status: MasterRecordStatus;
  readonly trackBatches: boolean;
  readonly trackExpiry: boolean;
  readonly allowDecimal: boolean;
}

export interface SupplierRecord {
  readonly id: number;
  readonly uuid: string;
  readonly code: string;
  readonly name: string;
  readonly contactName: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly address: string | null;
  readonly taxId: string | null;
  readonly status: MasterRecordStatus;
}

export interface CustomerRecord {
  readonly id: number;
  readonly uuid: string;
  readonly code: string;
  readonly name: string;
  readonly type: MasterCustomerType;
  readonly phone: string | null;
  readonly email: string | null;
  readonly address: string | null;
  readonly status: MasterRecordStatus;
}

export interface MasterBranchRecord {
  readonly id: number;
  readonly uuid: string;
  readonly code: string;
  readonly name: string;
  readonly status: MasterRecordStatus;
}

export interface MasterDirectoryRecord {
  readonly categories: readonly CategoryRecord[];
  readonly brands: readonly BrandRecord[];
  readonly units: readonly UnitRecord[];
  readonly products: readonly ProductRecord[];
  readonly productUnits: readonly ProductUnitRecord[];
  readonly prices: readonly ProductPriceRecord[];
  readonly suppliers: readonly SupplierRecord[];
  readonly customers: readonly CustomerRecord[];
  readonly branches: readonly MasterBranchRecord[];
}

interface MasterMutationEvent extends ClientMetadata {
  readonly tenantId: number;
  readonly actorUserId: number;
  readonly requestId: string;
  readonly occurredAt: string;
}

export interface CreateCategoryEvent extends MasterMutationEvent {
  readonly targetUuid: string;
  readonly parentId: number | null;
  readonly parentUuid: string | null;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
}

export interface UpdateCategoryEvent extends MasterMutationEvent {
  readonly targetId: number;
  readonly targetUuid: string;
  readonly parentId: number | null;
  readonly parentUuid: string | null;
  readonly name: string;
  readonly description: string | null;
  readonly status: MasterRecordStatus;
  readonly before: Readonly<Record<string, unknown>>;
}

export interface CreateBrandEvent extends MasterMutationEvent {
  readonly targetUuid: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
}

export interface UpdateBrandEvent extends MasterMutationEvent {
  readonly targetId: number;
  readonly targetUuid: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: MasterRecordStatus;
  readonly before: Readonly<Record<string, unknown>>;
}

export interface CreateUnitEvent extends MasterMutationEvent {
  readonly targetUuid: string;
  readonly code: string;
  readonly name: string;
  readonly symbol: string;
  readonly precision: number;
}

export interface UpdateUnitEvent extends MasterMutationEvent {
  readonly targetId: number;
  readonly targetUuid: string;
  readonly name: string;
  readonly symbol: string;
  readonly precision: number;
  readonly status: MasterRecordStatus;
  readonly before: Readonly<Record<string, unknown>>;
}

export interface CreateProductEvent extends MasterMutationEvent {
  readonly targetUuid: string;
  readonly baseProductUnitUuid: string;
  readonly categoryId: number | null;
  readonly categoryUuid: string | null;
  readonly brandId: number | null;
  readonly brandUuid: string | null;
  readonly baseUnitId: number;
  readonly baseUnitUuid: string;
  readonly sku: string;
  readonly name: string;
  readonly description: string | null;
  readonly type: MasterProductType;
  readonly trackBatches: boolean;
  readonly trackExpiry: boolean;
  readonly allowDecimal: boolean;
  readonly barcode: string | null;
}

export interface UpdateProductEvent extends MasterMutationEvent {
  readonly targetId: number;
  readonly targetUuid: string;
  readonly categoryId: number | null;
  readonly categoryUuid: string | null;
  readonly brandId: number | null;
  readonly brandUuid: string | null;
  readonly name: string;
  readonly description: string | null;
  readonly type: MasterProductType;
  readonly status: MasterRecordStatus;
  readonly trackBatches: boolean;
  readonly trackExpiry: boolean;
  readonly allowDecimal: boolean;
  readonly before: Readonly<Record<string, unknown>>;
}

export interface CreateProductUnitEvent extends MasterMutationEvent {
  readonly targetUuid: string;
  readonly productId: number;
  readonly productUuid: string;
  readonly unitId: number;
  readonly unitUuid: string;
  readonly conversionNumerator: number;
  readonly conversionDenominator: number;
  readonly barcode: string | null;
  readonly isSaleUnit: boolean;
  readonly isPurchaseUnit: boolean;
}

export interface UpdateProductUnitEvent extends MasterMutationEvent {
  readonly targetId: number;
  readonly targetUuid: string;
  readonly conversionNumerator: number;
  readonly conversionDenominator: number;
  readonly barcode: string | null;
  readonly isSaleUnit: boolean;
  readonly isPurchaseUnit: boolean;
  readonly status: MasterRecordStatus;
  readonly before: Readonly<Record<string, unknown>>;
}

export interface SetProductPriceEvent extends MasterMutationEvent {
  readonly targetUuid: string;
  readonly productUnitId: number;
  readonly productUnitUuid: string;
  readonly branchId: number | null;
  readonly branchUuid: string | null;
  readonly amountMinor: number;
  readonly currency: string;
}

export interface CreateSupplierEvent extends MasterMutationEvent {
  readonly targetUuid: string;
  readonly code: string;
  readonly name: string;
  readonly contactName: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly address: string | null;
  readonly taxId: string | null;
}

export interface UpdateSupplierEvent extends MasterMutationEvent {
  readonly targetId: number;
  readonly targetUuid: string;
  readonly name: string;
  readonly contactName: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly address: string | null;
  readonly taxId: string | null;
  readonly status: MasterRecordStatus;
  readonly before: Readonly<Record<string, unknown>>;
}

export interface CreateCustomerEvent extends MasterMutationEvent {
  readonly targetUuid: string;
  readonly code: string;
  readonly name: string;
  readonly type: MasterCustomerType;
  readonly phone: string | null;
  readonly email: string | null;
  readonly address: string | null;
}

export interface UpdateCustomerEvent extends MasterMutationEvent {
  readonly targetId: number;
  readonly targetUuid: string;
  readonly name: string;
  readonly type: MasterCustomerType;
  readonly phone: string | null;
  readonly email: string | null;
  readonly address: string | null;
  readonly status: MasterRecordStatus;
  readonly before: Readonly<Record<string, unknown>>;
}

export interface MasterRepository {
  loadDirectory(tenantId: number): Promise<MasterDirectoryRecord>;
  createCategory(event: CreateCategoryEvent): Promise<boolean>;
  updateCategory(event: UpdateCategoryEvent): Promise<boolean>;
  createBrand(event: CreateBrandEvent): Promise<boolean>;
  updateBrand(event: UpdateBrandEvent): Promise<boolean>;
  createUnit(event: CreateUnitEvent): Promise<boolean>;
  updateUnit(event: UpdateUnitEvent): Promise<boolean>;
  createProduct(event: CreateProductEvent): Promise<boolean>;
  updateProduct(event: UpdateProductEvent): Promise<boolean>;
  createProductUnit(event: CreateProductUnitEvent): Promise<boolean>;
  updateProductUnit(event: UpdateProductUnitEvent): Promise<boolean>;
  setProductPrice(event: SetProductPriceEvent): Promise<boolean>;
  createSupplier(event: CreateSupplierEvent): Promise<boolean>;
  updateSupplier(event: UpdateSupplierEvent): Promise<boolean>;
  createCustomer(event: CreateCustomerEvent): Promise<boolean>;
  updateCustomer(event: UpdateCustomerEvent): Promise<boolean>;
}
