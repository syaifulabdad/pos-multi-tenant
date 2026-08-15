import type {
  BrandData,
  CategoryData,
  CustomerData,
  MasterDirectoryData,
  ProductData,
  ProductPriceData,
  ProductUnitData,
  SupplierData,
  UnitData,
} from '@pos/contracts';

import { AppError, ValidationError } from '../../lib/errors';
import type { ClientMetadata } from '../auth/domain';
import type {
  BrandRecord,
  CategoryRecord,
  CustomerRecord,
  MasterDirectoryRecord,
  MasterRepository,
  ProductPriceRecord,
  ProductRecord,
  ProductUnitRecord,
  SupplierRecord,
  UnitRecord,
} from './domain';
import type {
  CreateBrandInput,
  CreateCategoryInput,
  CreateCustomerInput,
  CreateProductInput,
  CreateProductUnitInput,
  CreateSupplierInput,
  CreateUnitInput,
  SetProductPriceInput,
  UpdateBrandInput,
  UpdateCategoryInput,
  UpdateCustomerInput,
  UpdateProductInput,
  UpdateProductUnitInput,
  UpdateSupplierInput,
  UpdateUnitInput,
} from './validation';

interface MasterRequestContext extends ClientMetadata {
  readonly tenantId: number;
  readonly actorUserId: number;
  readonly requestId: string;
  readonly authorizedBranchUuids: readonly string[];
}

type ResourceName =
  | 'Category'
  | 'Brand'
  | 'Unit'
  | 'Product'
  | 'Product unit'
  | 'Product price'
  | 'Branch'
  | 'Supplier'
  | 'Customer';

class MasterNotFoundError extends AppError {
  constructor(resource: ResourceName) {
    super({
      status: 404,
      code: `${resource.toUpperCase().replace(' ', '_')}_NOT_FOUND`,
      message: `${resource} not found`,
    });
  }
}

class MasterConflictError extends AppError {
  constructor(code: string, message: string) {
    super({ status: 409, code, message });
  }
}

function mapCategory(record: CategoryRecord): CategoryData {
  return {
    id: record.uuid,
    parentId: record.parentUuid,
    code: record.code,
    name: record.name,
    description: record.description,
    status: record.status,
  };
}
function mapBrand(record: BrandRecord): BrandData {
  return {
    id: record.uuid,
    code: record.code,
    name: record.name,
    description: record.description,
    status: record.status,
  };
}
function mapUnit(record: UnitRecord): UnitData {
  return {
    id: record.uuid,
    code: record.code,
    name: record.name,
    symbol: record.symbol,
    precision: record.precision,
    status: record.status,
  };
}
function mapProductUnit(record: ProductUnitRecord): ProductUnitData {
  return {
    id: record.uuid,
    productId: record.productUuid,
    unitId: record.unitUuid,
    conversionNumerator: record.conversionNumerator,
    conversionDenominator: record.conversionDenominator,
    barcode: record.barcode,
    isBase: record.isBase,
    isSaleUnit: record.isSaleUnit,
    isPurchaseUnit: record.isPurchaseUnit,
    status: record.status,
  };
}
function mapPrice(record: ProductPriceRecord): ProductPriceData {
  return {
    id: record.uuid,
    productUnitId: record.productUnitUuid,
    branchId: record.branchUuid,
    amountMinor: record.amountMinor,
    currency: record.currency,
    status: record.status,
    validFrom: record.validFrom,
    validTo: record.validTo,
  };
}
function mapProduct(
  record: ProductRecord,
  productUnits: readonly ProductUnitRecord[],
  prices: readonly ProductPriceRecord[],
): ProductData {
  const units = productUnits.filter((entry) => entry.productId === record.id);
  const unitIds = new Set(units.map((entry) => entry.id));
  return {
    id: record.uuid,
    categoryId: record.categoryUuid,
    brandId: record.brandUuid,
    baseUnitId: record.baseUnitUuid,
    sku: record.sku,
    name: record.name,
    description: record.description,
    type: record.type,
    status: record.status,
    trackBatches: record.trackBatches,
    trackExpiry: record.trackExpiry,
    allowDecimal: record.allowDecimal,
    units: units.map(mapProductUnit),
    prices: prices.filter((price) => unitIds.has(price.productUnitId)).map(mapPrice),
  };
}
function mapSupplier(record: SupplierRecord): SupplierData {
  return {
    id: record.uuid,
    code: record.code,
    name: record.name,
    contactName: record.contactName,
    phone: record.phone,
    email: record.email,
    address: record.address,
    taxId: record.taxId,
    status: record.status,
  };
}
function mapCustomer(record: CustomerRecord): CustomerData {
  return {
    id: record.uuid,
    code: record.code,
    name: record.name,
    type: record.type,
    phone: record.phone,
    email: record.email,
    address: record.address,
    status: record.status,
  };
}
function publicDirectory(
  directory: MasterDirectoryRecord,
  authorizedBranchUuids: readonly string[],
): MasterDirectoryData {
  const authorizedBranches = new Set(authorizedBranchUuids);
  const visiblePrices = directory.prices.filter(
    (price) => price.branchUuid === null || authorizedBranches.has(price.branchUuid),
  );
  return {
    categories: directory.categories.map(mapCategory),
    brands: directory.brands.map(mapBrand),
    units: directory.units.map(mapUnit),
    products: directory.products.map((product) =>
      mapProduct(product, directory.productUnits, visiblePrices),
    ),
    suppliers: directory.suppliers.map(mapSupplier),
    customers: directory.customers.map(mapCustomer),
    branches: directory.branches
      .filter((branch) => authorizedBranches.has(branch.uuid))
      .map((branch) => ({
        id: branch.uuid,
        code: branch.code,
        name: branch.name,
      })),
  };
}
function find<T extends { readonly uuid: string }>(
  records: readonly T[],
  uuid: string,
  resource: ResourceName,
): T {
  const record = records.find((entry) => entry.uuid === uuid);
  if (record === undefined) throw new MasterNotFoundError(resource);
  return record;
}
function resolveOptional<T extends { readonly uuid: string; readonly status: string }>(
  records: readonly T[],
  uuid: string | null,
  field: string,
  requireActive = true,
): T | null {
  if (uuid === null) return null;
  const record = records.find((entry) => entry.uuid === uuid);
  if (record === undefined || (requireActive && record.status !== 'active')) {
    throw new ValidationError({ [field]: [`${field} is unavailable for this tenant`] });
  }
  return record;
}
function gcd(left: number, right: number): number {
  let a = left;
  let b = right;
  while (b !== 0) [a, b] = [b, a % b];
  return a;
}

export class MasterService {
  constructor(
    private readonly repository: MasterRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async directory(
    tenantId: number,
    authorizedBranchUuids: readonly string[],
  ): Promise<MasterDirectoryData> {
    return publicDirectory(await this.repository.loadDirectory(tenantId), authorizedBranchUuids);
  }

  private event(context: MasterRequestContext) {
    return {
      tenantId: context.tenantId,
      actorUserId: context.actorUserId,
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      occurredAt: this.now().toISOString(),
    };
  }

  async createCategory(input: CreateCategoryInput, context: MasterRequestContext) {
    const directory = await this.repository.loadDirectory(context.tenantId);
    const parent = resolveOptional(directory.categories, input.parentId, 'parentId');
    const targetUuid = crypto.randomUUID();
    const created = await this.repository.createCategory({
      ...this.event(context),
      targetUuid,
      parentId: parent?.id ?? null,
      parentUuid: parent?.uuid ?? null,
      code: input.code,
      name: input.name,
      description: input.description,
    });
    if (!created) throw new MasterConflictError('CATEGORY_CODE_EXISTS', 'Category code exists');
    return mapCategory(
      find(
        (await this.repository.loadDirectory(context.tenantId)).categories,
        targetUuid,
        'Category',
      ),
    );
  }

  async updateCategory(
    targetUuid: string,
    input: UpdateCategoryInput,
    context: MasterRequestContext,
  ) {
    const directory = await this.repository.loadDirectory(context.tenantId);
    const target = find(directory.categories, targetUuid, 'Category');
    const parent = resolveOptional(
      directory.categories,
      input.parentId,
      'parentId',
      input.status === 'active',
    );
    if (parent?.id === target.id) {
      throw new ValidationError({ parentId: ['A category cannot be its own parent'] });
    }
    let cursor = parent;
    while (cursor !== null) {
      if (cursor.id === target.id) {
        throw new ValidationError({ parentId: ['Category hierarchy cannot contain a cycle'] });
      }
      const parentId = cursor.parentId;
      cursor =
        parentId === null
          ? null
          : (directory.categories.find((category) => category.id === parentId) ?? null);
    }
    if (
      target.status === 'active' &&
      input.status === 'inactive' &&
      (directory.categories.some(
        (category) => category.parentId === target.id && category.status === 'active',
      ) ||
        directory.products.some(
          (product) => product.categoryId === target.id && product.status === 'active',
        ))
    ) {
      throw new MasterConflictError(
        'CATEGORY_IN_USE',
        'Disable child categories and active products first',
      );
    }
    const updated = await this.repository.updateCategory({
      ...this.event(context),
      targetId: target.id,
      targetUuid: target.uuid,
      parentId: parent?.id ?? null,
      parentUuid: parent?.uuid ?? null,
      name: input.name,
      description: input.description,
      status: input.status,
      before: {
        parent_id: target.parentUuid,
        name: target.name,
        description: target.description,
        status: target.status,
      },
    });
    if (!updated) throw new MasterNotFoundError('Category');
    return mapCategory(
      find(
        (await this.repository.loadDirectory(context.tenantId)).categories,
        targetUuid,
        'Category',
      ),
    );
  }

  async createBrand(input: CreateBrandInput, context: MasterRequestContext) {
    const targetUuid = crypto.randomUUID();
    const created = await this.repository.createBrand({
      ...this.event(context),
      targetUuid,
      ...input,
    });
    if (!created) throw new MasterConflictError('BRAND_CODE_EXISTS', 'Brand code exists');
    return mapBrand(
      find((await this.repository.loadDirectory(context.tenantId)).brands, targetUuid, 'Brand'),
    );
  }

  async updateBrand(targetUuid: string, input: UpdateBrandInput, context: MasterRequestContext) {
    const directory = await this.repository.loadDirectory(context.tenantId);
    const target = find(directory.brands, targetUuid, 'Brand');
    if (
      target.status === 'active' &&
      input.status === 'inactive' &&
      directory.products.some(
        (product) => product.brandId === target.id && product.status === 'active',
      )
    ) {
      throw new MasterConflictError(
        'BRAND_IN_USE',
        'Disable active products using this brand first',
      );
    }
    const updated = await this.repository.updateBrand({
      ...this.event(context),
      targetId: target.id,
      targetUuid: target.uuid,
      ...input,
      before: {
        name: target.name,
        description: target.description,
        status: target.status,
      },
    });
    if (!updated) throw new MasterNotFoundError('Brand');
    return mapBrand(
      find((await this.repository.loadDirectory(context.tenantId)).brands, targetUuid, 'Brand'),
    );
  }

  async createUnit(input: CreateUnitInput, context: MasterRequestContext) {
    const targetUuid = crypto.randomUUID();
    const created = await this.repository.createUnit({
      ...this.event(context),
      targetUuid,
      ...input,
    });
    if (!created) throw new MasterConflictError('UNIT_CODE_EXISTS', 'Unit code exists');
    return mapUnit(
      find((await this.repository.loadDirectory(context.tenantId)).units, targetUuid, 'Unit'),
    );
  }

  async updateUnit(targetUuid: string, input: UpdateUnitInput, context: MasterRequestContext) {
    const directory = await this.repository.loadDirectory(context.tenantId);
    const target = find(directory.units, targetUuid, 'Unit');
    const assigned = directory.productUnits.some((productUnit) => productUnit.unitId === target.id);
    if (assigned && input.precision !== target.precision) {
      throw new MasterConflictError(
        'UNIT_PRECISION_LOCKED',
        'Precision cannot change after a unit is assigned to a product',
      );
    }
    if (
      target.status === 'active' &&
      input.status === 'inactive' &&
      directory.productUnits.some(
        (productUnit) => productUnit.unitId === target.id && productUnit.status === 'active',
      )
    ) {
      throw new MasterConflictError('UNIT_IN_USE', 'Disable active product units first');
    }
    const updated = await this.repository.updateUnit({
      ...this.event(context),
      targetId: target.id,
      targetUuid: target.uuid,
      ...input,
      before: {
        name: target.name,
        symbol: target.symbol,
        precision: target.precision,
        status: target.status,
      },
    });
    if (!updated) throw new MasterNotFoundError('Unit');
    return mapUnit(
      find((await this.repository.loadDirectory(context.tenantId)).units, targetUuid, 'Unit'),
    );
  }

  async createProduct(input: CreateProductInput, context: MasterRequestContext) {
    const directory = await this.repository.loadDirectory(context.tenantId);
    const category = resolveOptional(directory.categories, input.categoryId, 'categoryId');
    const brand = resolveOptional(directory.brands, input.brandId, 'brandId');
    const baseUnit = resolveOptional(directory.units, input.baseUnitId, 'baseUnitId');
    if (baseUnit === null) throw new ValidationError({ baseUnitId: ['Base unit is required'] });
    if (input.allowDecimal && baseUnit.precision === 0) {
      throw new ValidationError({
        allowDecimal: ['Decimal products require a base unit with non-zero precision'],
      });
    }
    const targetUuid = crypto.randomUUID();
    const created = await this.repository.createProduct({
      ...this.event(context),
      targetUuid,
      baseProductUnitUuid: crypto.randomUUID(),
      categoryId: category?.id ?? null,
      categoryUuid: category?.uuid ?? null,
      brandId: brand?.id ?? null,
      brandUuid: brand?.uuid ?? null,
      baseUnitId: baseUnit.id,
      baseUnitUuid: baseUnit.uuid,
      sku: input.sku,
      name: input.name,
      description: input.description,
      type: input.type,
      trackBatches: input.trackBatches,
      trackExpiry: input.trackExpiry,
      allowDecimal: input.allowDecimal,
      barcode: input.barcode,
    });
    if (!created) {
      throw new MasterConflictError('PRODUCT_IDENTIFIER_EXISTS', 'SKU or barcode already exists');
    }
    const refreshed = await this.repository.loadDirectory(context.tenantId);
    return mapProduct(
      find(refreshed.products, targetUuid, 'Product'),
      refreshed.productUnits,
      refreshed.prices,
    );
  }

  async updateProduct(
    targetUuid: string,
    input: UpdateProductInput,
    context: MasterRequestContext,
  ) {
    const directory = await this.repository.loadDirectory(context.tenantId);
    const target = find(directory.products, targetUuid, 'Product');
    const category = resolveOptional(
      directory.categories,
      input.categoryId,
      'categoryId',
      input.status === 'active',
    );
    const brand = resolveOptional(
      directory.brands,
      input.brandId,
      'brandId',
      input.status === 'active',
    );
    const baseUnit = find(directory.units, target.baseUnitUuid, 'Unit');
    if (input.allowDecimal && baseUnit.precision === 0) {
      throw new ValidationError({
        allowDecimal: ['Decimal products require a base unit with non-zero precision'],
      });
    }
    const updated = await this.repository.updateProduct({
      ...this.event(context),
      targetId: target.id,
      targetUuid: target.uuid,
      categoryId: category?.id ?? null,
      categoryUuid: category?.uuid ?? null,
      brandId: brand?.id ?? null,
      brandUuid: brand?.uuid ?? null,
      name: input.name,
      description: input.description,
      type: input.type,
      status: input.status,
      trackBatches: input.trackBatches,
      trackExpiry: input.trackExpiry,
      allowDecimal: input.allowDecimal,
      before: {
        category_id: target.categoryUuid,
        brand_id: target.brandUuid,
        name: target.name,
        description: target.description,
        type: target.type,
        status: target.status,
        track_batches: target.trackBatches,
        track_expiry: target.trackExpiry,
        allow_decimal: target.allowDecimal,
      },
    });
    if (!updated) throw new MasterNotFoundError('Product');
    const refreshed = await this.repository.loadDirectory(context.tenantId);
    return mapProduct(
      find(refreshed.products, targetUuid, 'Product'),
      refreshed.productUnits,
      refreshed.prices,
    );
  }

  async createProductUnit(input: CreateProductUnitInput, context: MasterRequestContext) {
    const directory = await this.repository.loadDirectory(context.tenantId);
    const product = find(directory.products, input.productId, 'Product');
    const unit = resolveOptional(directory.units, input.unitId, 'unitId');
    if (unit === null) throw new ValidationError({ unitId: ['Unit is required'] });
    const divisor = gcd(input.conversionNumerator, input.conversionDenominator);
    const targetUuid = crypto.randomUUID();
    const created = await this.repository.createProductUnit({
      ...this.event(context),
      targetUuid,
      productId: product.id,
      productUuid: product.uuid,
      unitId: unit.id,
      unitUuid: unit.uuid,
      conversionNumerator: input.conversionNumerator / divisor,
      conversionDenominator: input.conversionDenominator / divisor,
      barcode: input.barcode,
      isSaleUnit: input.isSaleUnit,
      isPurchaseUnit: input.isPurchaseUnit,
    });
    if (!created) {
      throw new MasterConflictError(
        'PRODUCT_UNIT_EXISTS',
        'Product unit or barcode already exists',
      );
    }
    return mapProductUnit(
      find(
        (await this.repository.loadDirectory(context.tenantId)).productUnits,
        targetUuid,
        'Product unit',
      ),
    );
  }

  async updateProductUnit(
    targetUuid: string,
    input: UpdateProductUnitInput,
    context: MasterRequestContext,
  ) {
    const directory = await this.repository.loadDirectory(context.tenantId);
    const target = find(directory.productUnits, targetUuid, 'Product unit');
    if (target.isBase) {
      throw new MasterConflictError(
        'BASE_PRODUCT_UNIT_PROTECTED',
        'The base product unit cannot be modified',
      );
    }
    const divisor = gcd(input.conversionNumerator, input.conversionDenominator);
    const updated = await this.repository.updateProductUnit({
      ...this.event(context),
      targetId: target.id,
      targetUuid: target.uuid,
      conversionNumerator: input.conversionNumerator / divisor,
      conversionDenominator: input.conversionDenominator / divisor,
      barcode: input.barcode,
      isSaleUnit: input.isSaleUnit,
      isPurchaseUnit: input.isPurchaseUnit,
      status: input.status,
      before: {
        conversion_numerator: target.conversionNumerator,
        conversion_denominator: target.conversionDenominator,
        barcode: target.barcode,
        is_sale_unit: target.isSaleUnit,
        is_purchase_unit: target.isPurchaseUnit,
        status: target.status,
      },
    });
    if (!updated) throw new MasterNotFoundError('Product unit');
    return mapProductUnit(
      find(
        (await this.repository.loadDirectory(context.tenantId)).productUnits,
        targetUuid,
        'Product unit',
      ),
    );
  }

  async setPrice(input: SetProductPriceInput, context: MasterRequestContext) {
    const directory = await this.repository.loadDirectory(context.tenantId);
    const productUnit = find(directory.productUnits, input.productUnitId, 'Product unit');
    if (productUnit.status !== 'active') {
      throw new ValidationError({ productUnitId: ['Product unit must be active'] });
    }
    const branch = resolveOptional(directory.branches, input.branchId, 'branchId');
    if (branch !== null && !context.authorizedBranchUuids.includes(branch.uuid)) {
      throw new MasterNotFoundError('Branch');
    }
    const targetUuid = crypto.randomUUID();
    const created = await this.repository.setProductPrice({
      ...this.event(context),
      targetUuid,
      productUnitId: productUnit.id,
      productUnitUuid: productUnit.uuid,
      branchId: branch?.id ?? null,
      branchUuid: branch?.uuid ?? null,
      amountMinor: input.amountMinor,
      currency: input.currency,
    });
    if (!created) throw new MasterConflictError('PRICE_NOT_SET', 'Price could not be set');
    return mapPrice(
      find(
        (await this.repository.loadDirectory(context.tenantId)).prices,
        targetUuid,
        'Product price',
      ),
    );
  }

  async createSupplier(input: CreateSupplierInput, context: MasterRequestContext) {
    const targetUuid = crypto.randomUUID();
    const created = await this.repository.createSupplier({
      ...this.event(context),
      targetUuid,
      ...input,
    });
    if (!created) throw new MasterConflictError('SUPPLIER_CODE_EXISTS', 'Supplier code exists');
    return mapSupplier(
      find(
        (await this.repository.loadDirectory(context.tenantId)).suppliers,
        targetUuid,
        'Supplier',
      ),
    );
  }

  async updateSupplier(
    targetUuid: string,
    input: UpdateSupplierInput,
    context: MasterRequestContext,
  ) {
    const target = find(
      (await this.repository.loadDirectory(context.tenantId)).suppliers,
      targetUuid,
      'Supplier',
    );
    const updated = await this.repository.updateSupplier({
      ...this.event(context),
      targetId: target.id,
      targetUuid: target.uuid,
      ...input,
      before: {
        name: target.name,
        contact_name: target.contactName,
        phone: target.phone,
        email: target.email,
        address: target.address,
        tax_id: target.taxId,
        status: target.status,
      },
    });
    if (!updated) throw new MasterNotFoundError('Supplier');
    return mapSupplier(
      find(
        (await this.repository.loadDirectory(context.tenantId)).suppliers,
        targetUuid,
        'Supplier',
      ),
    );
  }

  async createCustomer(input: CreateCustomerInput, context: MasterRequestContext) {
    const targetUuid = crypto.randomUUID();
    const created = await this.repository.createCustomer({
      ...this.event(context),
      targetUuid,
      ...input,
    });
    if (!created) throw new MasterConflictError('CUSTOMER_CODE_EXISTS', 'Customer code exists');
    return mapCustomer(
      find(
        (await this.repository.loadDirectory(context.tenantId)).customers,
        targetUuid,
        'Customer',
      ),
    );
  }

  async updateCustomer(
    targetUuid: string,
    input: UpdateCustomerInput,
    context: MasterRequestContext,
  ) {
    const target = find(
      (await this.repository.loadDirectory(context.tenantId)).customers,
      targetUuid,
      'Customer',
    );
    const updated = await this.repository.updateCustomer({
      ...this.event(context),
      targetId: target.id,
      targetUuid: target.uuid,
      ...input,
      before: {
        name: target.name,
        type: target.type,
        phone: target.phone,
        email: target.email,
        address: target.address,
        status: target.status,
      },
    });
    if (!updated) throw new MasterNotFoundError('Customer');
    return mapCustomer(
      find(
        (await this.repository.loadDirectory(context.tenantId)).customers,
        targetUuid,
        'Customer',
      ),
    );
  }
}
