import type { WorkerBindings } from '../../types';
import type {
  BrandRecord,
  CategoryRecord,
  CreateBrandEvent,
  CreateCategoryEvent,
  CreateCustomerEvent,
  CreateProductEvent,
  CreateProductUnitEvent,
  CreateSupplierEvent,
  CreateUnitEvent,
  CustomerRecord,
  MasterBranchRecord,
  MasterCustomerType,
  MasterDirectoryRecord,
  MasterProductType,
  MasterRecordStatus,
  MasterRepository,
  ProductPriceRecord,
  ProductRecord,
  ProductUnitRecord,
  SetProductPriceEvent,
  SupplierRecord,
  UnitRecord,
  UpdateBrandEvent,
  UpdateCategoryEvent,
  UpdateCustomerEvent,
  UpdateProductEvent,
  UpdateProductUnitEvent,
  UpdateSupplierEvent,
  UpdateUnitEvent,
} from './domain';

interface CategoryRow {
  readonly id: number;
  readonly uuid: string;
  readonly parent_id: number | null;
  readonly parent_uuid: string | null;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: MasterRecordStatus;
}
interface BrandRow {
  readonly id: number;
  readonly uuid: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: MasterRecordStatus;
}
interface UnitRow {
  readonly id: number;
  readonly uuid: string;
  readonly code: string;
  readonly name: string;
  readonly symbol: string;
  readonly precision: number;
  readonly status: MasterRecordStatus;
}
interface ProductRow {
  readonly id: number;
  readonly uuid: string;
  readonly category_id: number | null;
  readonly category_uuid: string | null;
  readonly brand_id: number | null;
  readonly brand_uuid: string | null;
  readonly base_unit_id: number;
  readonly base_unit_uuid: string;
  readonly sku: string;
  readonly name: string;
  readonly description: string | null;
  readonly type: MasterProductType;
  readonly status: MasterRecordStatus;
  readonly track_batches: number;
  readonly track_expiry: number;
  readonly allow_decimal: number;
}
interface ProductUnitRow {
  readonly id: number;
  readonly uuid: string;
  readonly product_id: number;
  readonly product_uuid: string;
  readonly unit_id: number;
  readonly unit_uuid: string;
  readonly conversion_numerator: number;
  readonly conversion_denominator: number;
  readonly barcode: string | null;
  readonly is_base: number;
  readonly is_sale_unit: number;
  readonly is_purchase_unit: number;
  readonly status: MasterRecordStatus;
}
interface PriceRow {
  readonly id: number;
  readonly uuid: string;
  readonly product_unit_id: number;
  readonly product_unit_uuid: string;
  readonly branch_id: number | null;
  readonly branch_uuid: string | null;
  readonly amount_minor: number;
  readonly currency: string;
  readonly status: 'active' | 'superseded';
  readonly valid_from: string;
  readonly valid_to: string | null;
}
interface SupplierRow {
  readonly id: number;
  readonly uuid: string;
  readonly code: string;
  readonly name: string;
  readonly contact_name: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly address: string | null;
  readonly tax_id: string | null;
  readonly status: MasterRecordStatus;
}
interface CustomerRow {
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
interface BranchRow {
  readonly id: number;
  readonly uuid: string;
  readonly code: string;
  readonly name: string;
  readonly status: MasterRecordStatus;
}

type AuditedTable =
  | 'categories'
  | 'brands'
  | 'units'
  | 'products'
  | 'product_units'
  | 'product_prices'
  | 'suppliers'
  | 'customers';
type AuditedEntity =
  | 'category'
  | 'brand'
  | 'unit'
  | 'product'
  | 'product_unit'
  | 'product_price'
  | 'supplier'
  | 'customer';

interface AuditEvent {
  readonly tenantId: number;
  readonly actorUserId: number;
  readonly requestId: string;
  readonly targetUuid: string;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly occurredAt: string;
}

export class D1MasterRepository implements MasterRepository {
  constructor(private readonly database: WorkerBindings['DB']) {}

  private createAudit(
    event: AuditEvent,
    table: AuditedTable,
    entity: AuditedEntity,
    after: Readonly<Record<string, unknown>>,
    action: 'CREATE' | 'PRICE_CHANGE' = 'CREATE',
  ): D1PreparedStatement {
    return this.database
      .prepare(
        `INSERT INTO audit_logs
           (tenant_id, user_id, request_id, action, entity, entity_id, after_json,
            ip_address, user_agent, created_at)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10
         FROM ${table} target
         WHERE target.tenant_id = ?1 AND target.uuid = ?6`,
      )
      .bind(
        event.tenantId,
        event.actorUserId,
        event.requestId,
        action,
        entity,
        event.targetUuid,
        JSON.stringify(after),
        event.ipAddress,
        event.userAgent,
        event.occurredAt,
      );
  }

  private updateAudit(
    event: AuditEvent,
    table: AuditedTable,
    entity: AuditedEntity,
    before: Readonly<Record<string, unknown>>,
    after: Readonly<Record<string, unknown>>,
  ): D1PreparedStatement {
    return this.database
      .prepare(
        `INSERT INTO audit_logs
           (tenant_id, user_id, request_id, action, entity, entity_id, before_json,
            after_json, ip_address, user_agent, created_at)
         SELECT ?1, ?2, ?3, 'UPDATE', ?4, ?5, ?6, ?7, ?8, ?9, ?10
         FROM ${table} target
         WHERE target.tenant_id = ?1 AND target.uuid = ?5`,
      )
      .bind(
        event.tenantId,
        event.actorUserId,
        event.requestId,
        entity,
        event.targetUuid,
        JSON.stringify(before),
        JSON.stringify(after),
        event.ipAddress,
        event.userAgent,
        event.occurredAt,
      );
  }

  async loadDirectory(tenantId: number): Promise<MasterDirectoryRecord> {
    const [
      categoryResult,
      brandResult,
      unitResult,
      productResult,
      productUnitResult,
      priceResult,
      supplierResult,
      customerResult,
      branchResult,
    ] = await Promise.all([
      this.database
        .prepare(
          `SELECT c.id, c.uuid, c.parent_id, parent.uuid AS parent_uuid,
                  c.code, c.name, c.description, c.status
           FROM categories c
           LEFT JOIN categories parent
             ON parent.tenant_id = c.tenant_id AND parent.id = c.parent_id
           WHERE c.tenant_id = ?1
           ORDER BY c.name ASC, c.id ASC`,
        )
        .bind(tenantId)
        .all<CategoryRow>(),
      this.database
        .prepare(
          `SELECT id, uuid, code, name, description, status
           FROM brands WHERE tenant_id = ?1 ORDER BY name ASC, id ASC`,
        )
        .bind(tenantId)
        .all<BrandRow>(),
      this.database
        .prepare(
          `SELECT id, uuid, code, name, symbol, precision, status
           FROM units WHERE tenant_id = ?1 ORDER BY name ASC, id ASC`,
        )
        .bind(tenantId)
        .all<UnitRow>(),
      this.database
        .prepare(
          `SELECT p.id, p.uuid, p.category_id, c.uuid AS category_uuid,
                  p.brand_id, b.uuid AS brand_uuid,
                  p.base_unit_id, u.uuid AS base_unit_uuid,
                  p.sku, p.name, p.description, p.type, p.status,
                  p.track_batches, p.track_expiry, p.allow_decimal
           FROM products p
           LEFT JOIN categories c ON c.tenant_id = p.tenant_id AND c.id = p.category_id
           LEFT JOIN brands b ON b.tenant_id = p.tenant_id AND b.id = p.brand_id
           INNER JOIN units u ON u.tenant_id = p.tenant_id AND u.id = p.base_unit_id
           WHERE p.tenant_id = ?1
           ORDER BY p.name ASC, p.id ASC`,
        )
        .bind(tenantId)
        .all<ProductRow>(),
      this.database
        .prepare(
          `SELECT pu.id, pu.uuid, pu.product_id, p.uuid AS product_uuid,
                  pu.unit_id, u.uuid AS unit_uuid,
                  pu.conversion_numerator, pu.conversion_denominator, pu.barcode,
                  pu.is_base, pu.is_sale_unit, pu.is_purchase_unit, pu.status
           FROM product_units pu
           INNER JOIN products p ON p.tenant_id = pu.tenant_id AND p.id = pu.product_id
           INNER JOIN units u ON u.tenant_id = pu.tenant_id AND u.id = pu.unit_id
           WHERE pu.tenant_id = ?1
           ORDER BY pu.product_id ASC, pu.is_base DESC, pu.id ASC`,
        )
        .bind(tenantId)
        .all<ProductUnitRow>(),
      this.database
        .prepare(
          `SELECT pp.id, pp.uuid, pp.product_unit_id, pu.uuid AS product_unit_uuid,
                  pp.branch_id, b.uuid AS branch_uuid, pp.amount_minor, pp.currency,
                  pp.status, pp.valid_from, pp.valid_to
           FROM product_prices pp
           INNER JOIN product_units pu
             ON pu.tenant_id = pp.tenant_id AND pu.id = pp.product_unit_id
           LEFT JOIN branches b ON b.tenant_id = pp.tenant_id AND b.id = pp.branch_id
           WHERE pp.tenant_id = ?1
           ORDER BY pp.created_at DESC, pp.id DESC`,
        )
        .bind(tenantId)
        .all<PriceRow>(),
      this.database
        .prepare(
          `SELECT id, uuid, code, name, contact_name, phone, email, address, tax_id, status
           FROM suppliers WHERE tenant_id = ?1 ORDER BY name ASC, id ASC`,
        )
        .bind(tenantId)
        .all<SupplierRow>(),
      this.database
        .prepare(
          `SELECT id, uuid, code, name, type, phone, email, address, status
           FROM customers WHERE tenant_id = ?1 ORDER BY name ASC, id ASC`,
        )
        .bind(tenantId)
        .all<CustomerRow>(),
      this.database
        .prepare(
          `SELECT id, uuid, code, name, status
           FROM branches WHERE tenant_id = ?1 ORDER BY code ASC, id ASC`,
        )
        .bind(tenantId)
        .all<BranchRow>(),
    ]);

    const categories: CategoryRecord[] = categoryResult.results.map((row) => ({
      id: row.id,
      uuid: row.uuid,
      parentId: row.parent_id,
      parentUuid: row.parent_uuid,
      code: row.code,
      name: row.name,
      description: row.description,
      status: row.status,
    }));
    const brands: BrandRecord[] = brandResult.results.map((row) => ({ ...row }));
    const units: UnitRecord[] = unitResult.results.map((row) => ({ ...row }));
    const products: ProductRecord[] = productResult.results.map((row) => ({
      id: row.id,
      uuid: row.uuid,
      categoryId: row.category_id,
      categoryUuid: row.category_uuid,
      brandId: row.brand_id,
      brandUuid: row.brand_uuid,
      baseUnitId: row.base_unit_id,
      baseUnitUuid: row.base_unit_uuid,
      sku: row.sku,
      name: row.name,
      description: row.description,
      type: row.type,
      status: row.status,
      trackBatches: row.track_batches === 1,
      trackExpiry: row.track_expiry === 1,
      allowDecimal: row.allow_decimal === 1,
    }));
    const productUnits: ProductUnitRecord[] = productUnitResult.results.map((row) => ({
      id: row.id,
      uuid: row.uuid,
      productId: row.product_id,
      productUuid: row.product_uuid,
      unitId: row.unit_id,
      unitUuid: row.unit_uuid,
      conversionNumerator: row.conversion_numerator,
      conversionDenominator: row.conversion_denominator,
      barcode: row.barcode,
      isBase: row.is_base === 1,
      isSaleUnit: row.is_sale_unit === 1,
      isPurchaseUnit: row.is_purchase_unit === 1,
      status: row.status,
    }));
    const prices: ProductPriceRecord[] = priceResult.results.map((row) => ({
      id: row.id,
      uuid: row.uuid,
      productUnitId: row.product_unit_id,
      productUnitUuid: row.product_unit_uuid,
      branchId: row.branch_id,
      branchUuid: row.branch_uuid,
      amountMinor: row.amount_minor,
      currency: row.currency,
      status: row.status,
      validFrom: row.valid_from,
      validTo: row.valid_to,
    }));
    const suppliers: SupplierRecord[] = supplierResult.results.map((row) => ({
      id: row.id,
      uuid: row.uuid,
      code: row.code,
      name: row.name,
      contactName: row.contact_name,
      phone: row.phone,
      email: row.email,
      address: row.address,
      taxId: row.tax_id,
      status: row.status,
    }));
    const customers: CustomerRecord[] = customerResult.results.map((row) => ({ ...row }));
    const branches: MasterBranchRecord[] = branchResult.results.map((row) => ({ ...row }));
    return {
      categories,
      brands,
      units,
      products,
      productUnits,
      prices,
      suppliers,
      customers,
      branches,
    };
  }

  async createCategory(event: CreateCategoryEvent): Promise<boolean> {
    const result = await this.database.batch([
      this.database
        .prepare(
          `INSERT INTO categories
             (uuid, tenant_id, parent_id, code, name, description, status, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'active', ?7, ?7)
           ON CONFLICT DO NOTHING`,
        )
        .bind(
          event.targetUuid,
          event.tenantId,
          event.parentId,
          event.code,
          event.name,
          event.description,
          event.occurredAt,
        ),
      this.createAudit(event, 'categories', 'category', {
        parent_id: event.parentUuid,
        code: event.code,
        name: event.name,
        description: event.description,
        status: 'active',
      }),
    ]);
    return (result[0]?.meta.changes ?? 0) === 1;
  }

  async updateCategory(event: UpdateCategoryEvent): Promise<boolean> {
    const result = await this.database.batch([
      this.database
        .prepare(
          `UPDATE categories
           SET parent_id = ?1, name = ?2, description = ?3, status = ?4, updated_at = ?5
           WHERE tenant_id = ?6 AND id = ?7 AND uuid = ?8`,
        )
        .bind(
          event.parentId,
          event.name,
          event.description,
          event.status,
          event.occurredAt,
          event.tenantId,
          event.targetId,
          event.targetUuid,
        ),
      this.updateAudit(event, 'categories', 'category', event.before, {
        parent_id: event.parentUuid,
        name: event.name,
        description: event.description,
        status: event.status,
      }),
    ]);
    return (result[0]?.meta.changes ?? 0) === 1;
  }

  async createBrand(event: CreateBrandEvent): Promise<boolean> {
    const result = await this.database.batch([
      this.database
        .prepare(
          `INSERT INTO brands
             (uuid, tenant_id, code, name, description, status, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, 'active', ?6, ?6)
           ON CONFLICT DO NOTHING`,
        )
        .bind(
          event.targetUuid,
          event.tenantId,
          event.code,
          event.name,
          event.description,
          event.occurredAt,
        ),
      this.createAudit(event, 'brands', 'brand', {
        code: event.code,
        name: event.name,
        description: event.description,
        status: 'active',
      }),
    ]);
    return (result[0]?.meta.changes ?? 0) === 1;
  }

  async updateBrand(event: UpdateBrandEvent): Promise<boolean> {
    const result = await this.database.batch([
      this.database
        .prepare(
          `UPDATE brands SET name = ?1, description = ?2, status = ?3, updated_at = ?4
           WHERE tenant_id = ?5 AND id = ?6 AND uuid = ?7`,
        )
        .bind(
          event.name,
          event.description,
          event.status,
          event.occurredAt,
          event.tenantId,
          event.targetId,
          event.targetUuid,
        ),
      this.updateAudit(event, 'brands', 'brand', event.before, {
        name: event.name,
        description: event.description,
        status: event.status,
      }),
    ]);
    return (result[0]?.meta.changes ?? 0) === 1;
  }

  async createUnit(event: CreateUnitEvent): Promise<boolean> {
    const result = await this.database.batch([
      this.database
        .prepare(
          `INSERT INTO units
             (uuid, tenant_id, code, name, symbol, precision, status, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'active', ?7, ?7)
           ON CONFLICT DO NOTHING`,
        )
        .bind(
          event.targetUuid,
          event.tenantId,
          event.code,
          event.name,
          event.symbol,
          event.precision,
          event.occurredAt,
        ),
      this.createAudit(event, 'units', 'unit', {
        code: event.code,
        name: event.name,
        symbol: event.symbol,
        precision: event.precision,
        status: 'active',
      }),
    ]);
    return (result[0]?.meta.changes ?? 0) === 1;
  }

  async updateUnit(event: UpdateUnitEvent): Promise<boolean> {
    const result = await this.database.batch([
      this.database
        .prepare(
          `UPDATE units SET name = ?1, symbol = ?2, precision = ?3, status = ?4, updated_at = ?5
           WHERE tenant_id = ?6 AND id = ?7 AND uuid = ?8`,
        )
        .bind(
          event.name,
          event.symbol,
          event.precision,
          event.status,
          event.occurredAt,
          event.tenantId,
          event.targetId,
          event.targetUuid,
        ),
      this.updateAudit(event, 'units', 'unit', event.before, {
        name: event.name,
        symbol: event.symbol,
        precision: event.precision,
        status: event.status,
      }),
    ]);
    return (result[0]?.meta.changes ?? 0) === 1;
  }

  async createProduct(event: CreateProductEvent): Promise<boolean> {
    const result = await this.database.batch([
      this.database
        .prepare(
          `INSERT INTO products
             (uuid, tenant_id, category_id, brand_id, base_unit_id, sku, name, description,
              type, status, track_batches, track_expiry, allow_decimal, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'active', ?10, ?11, ?12, ?13, ?13)
           ON CONFLICT DO NOTHING`,
        )
        .bind(
          event.targetUuid,
          event.tenantId,
          event.categoryId,
          event.brandId,
          event.baseUnitId,
          event.sku,
          event.name,
          event.description,
          event.type,
          event.trackBatches ? 1 : 0,
          event.trackExpiry ? 1 : 0,
          event.allowDecimal ? 1 : 0,
          event.occurredAt,
        ),
      this.database
        .prepare(
          `INSERT INTO product_units
             (uuid, tenant_id, product_id, unit_id, conversion_numerator,
              conversion_denominator, barcode, is_base, is_sale_unit, is_purchase_unit,
              status, created_at, updated_at)
           SELECT ?1, ?2, p.id, ?4, 1, 1, ?5, 1, 1, 1, 'active', ?6, ?6
           FROM products p
           WHERE p.tenant_id = ?2 AND p.uuid = ?3`,
        )
        .bind(
          event.baseProductUnitUuid,
          event.tenantId,
          event.targetUuid,
          event.baseUnitId,
          event.barcode,
          event.occurredAt,
        ),
      this.createAudit(event, 'products', 'product', {
        category_id: event.categoryUuid,
        brand_id: event.brandUuid,
        base_unit_id: event.baseUnitUuid,
        sku: event.sku,
        name: event.name,
        type: event.type,
        status: 'active',
        track_batches: event.trackBatches,
        track_expiry: event.trackExpiry,
        allow_decimal: event.allowDecimal,
      }),
    ]);
    return (result[0]?.meta.changes ?? 0) === 1;
  }

  async updateProduct(event: UpdateProductEvent): Promise<boolean> {
    const result = await this.database.batch([
      this.database
        .prepare(
          `UPDATE products
           SET category_id = ?1, brand_id = ?2, name = ?3, description = ?4,
               type = ?5, status = ?6, track_batches = ?7, track_expiry = ?8,
               allow_decimal = ?9, updated_at = ?10
           WHERE tenant_id = ?11 AND id = ?12 AND uuid = ?13`,
        )
        .bind(
          event.categoryId,
          event.brandId,
          event.name,
          event.description,
          event.type,
          event.status,
          event.trackBatches ? 1 : 0,
          event.trackExpiry ? 1 : 0,
          event.allowDecimal ? 1 : 0,
          event.occurredAt,
          event.tenantId,
          event.targetId,
          event.targetUuid,
        ),
      this.updateAudit(event, 'products', 'product', event.before, {
        category_id: event.categoryUuid,
        brand_id: event.brandUuid,
        name: event.name,
        description: event.description,
        type: event.type,
        status: event.status,
        track_batches: event.trackBatches,
        track_expiry: event.trackExpiry,
        allow_decimal: event.allowDecimal,
      }),
    ]);
    return (result[0]?.meta.changes ?? 0) === 1;
  }

  async createProductUnit(event: CreateProductUnitEvent): Promise<boolean> {
    const result = await this.database.batch([
      this.database
        .prepare(
          `INSERT INTO product_units
             (uuid, tenant_id, product_id, unit_id, conversion_numerator,
              conversion_denominator, barcode, is_base, is_sale_unit, is_purchase_unit,
              status, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, ?8, ?9, 'active', ?10, ?10)
           ON CONFLICT DO NOTHING`,
        )
        .bind(
          event.targetUuid,
          event.tenantId,
          event.productId,
          event.unitId,
          event.conversionNumerator,
          event.conversionDenominator,
          event.barcode,
          event.isSaleUnit ? 1 : 0,
          event.isPurchaseUnit ? 1 : 0,
          event.occurredAt,
        ),
      this.createAudit(event, 'product_units', 'product_unit', {
        product_id: event.productUuid,
        unit_id: event.unitUuid,
        conversion_numerator: event.conversionNumerator,
        conversion_denominator: event.conversionDenominator,
        barcode: event.barcode,
        is_sale_unit: event.isSaleUnit,
        is_purchase_unit: event.isPurchaseUnit,
        status: 'active',
      }),
    ]);
    return (result[0]?.meta.changes ?? 0) === 1;
  }

  async updateProductUnit(event: UpdateProductUnitEvent): Promise<boolean> {
    const result = await this.database.batch([
      this.database
        .prepare(
          `UPDATE product_units
           SET conversion_numerator = ?1, conversion_denominator = ?2, barcode = ?3,
               is_sale_unit = ?4, is_purchase_unit = ?5, status = ?6, updated_at = ?7
           WHERE tenant_id = ?8 AND id = ?9 AND uuid = ?10 AND is_base = 0`,
        )
        .bind(
          event.conversionNumerator,
          event.conversionDenominator,
          event.barcode,
          event.isSaleUnit ? 1 : 0,
          event.isPurchaseUnit ? 1 : 0,
          event.status,
          event.occurredAt,
          event.tenantId,
          event.targetId,
          event.targetUuid,
        ),
      this.updateAudit(event, 'product_units', 'product_unit', event.before, {
        conversion_numerator: event.conversionNumerator,
        conversion_denominator: event.conversionDenominator,
        barcode: event.barcode,
        is_sale_unit: event.isSaleUnit,
        is_purchase_unit: event.isPurchaseUnit,
        status: event.status,
      }),
    ]);
    return (result[0]?.meta.changes ?? 0) === 1;
  }

  async setProductPrice(event: SetProductPriceEvent): Promise<boolean> {
    const result = await this.database.batch([
      this.database
        .prepare(
          `UPDATE product_prices
           SET status = 'superseded', valid_to = ?1
           WHERE tenant_id = ?2 AND product_unit_id = ?3 AND status = 'active'
             AND ((branch_id IS NULL AND ?4 IS NULL) OR branch_id = ?4)
             AND EXISTS (
               SELECT 1 FROM product_units pu
               WHERE pu.tenant_id = ?2 AND pu.id = ?3 AND pu.status = 'active'
             )
             AND (
               ?4 IS NULL OR EXISTS (
                 SELECT 1 FROM branches b
                 WHERE b.tenant_id = ?2 AND b.id = ?4 AND b.status = 'active'
               )
             )`,
        )
        .bind(event.occurredAt, event.tenantId, event.productUnitId, event.branchId),
      this.database
        .prepare(
          `INSERT INTO product_prices
             (uuid, tenant_id, product_unit_id, branch_id, amount_minor, currency,
              status, valid_from, created_by, created_at)
           SELECT ?1, ?2, pu.id, ?4, ?5, ?6, 'active', ?7, ?8, ?7
           FROM product_units pu
           WHERE pu.tenant_id = ?2 AND pu.id = ?3 AND pu.status = 'active'
             AND (
               ?4 IS NULL OR EXISTS (
                 SELECT 1 FROM branches b
                 WHERE b.tenant_id = ?2 AND b.id = ?4 AND b.status = 'active'
               )
             )`,
        )
        .bind(
          event.targetUuid,
          event.tenantId,
          event.productUnitId,
          event.branchId,
          event.amountMinor,
          event.currency,
          event.occurredAt,
          event.actorUserId,
        ),
      this.createAudit(
        event,
        'product_prices',
        'product_price',
        {
          product_unit_id: event.productUnitUuid,
          branch_id: event.branchUuid,
          amount_minor: event.amountMinor,
          currency: event.currency,
          status: 'active',
        },
        'PRICE_CHANGE',
      ),
    ]);
    return (result[1]?.meta.changes ?? 0) === 1;
  }

  async createSupplier(event: CreateSupplierEvent): Promise<boolean> {
    const result = await this.database.batch([
      this.database
        .prepare(
          `INSERT INTO suppliers
             (uuid, tenant_id, code, name, contact_name, phone, email, address, tax_id,
              status, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'active', ?10, ?10)
           ON CONFLICT DO NOTHING`,
        )
        .bind(
          event.targetUuid,
          event.tenantId,
          event.code,
          event.name,
          event.contactName,
          event.phone,
          event.email,
          event.address,
          event.taxId,
          event.occurredAt,
        ),
      this.createAudit(event, 'suppliers', 'supplier', {
        code: event.code,
        name: event.name,
        contact_name: event.contactName,
        phone: event.phone,
        email: event.email,
        status: 'active',
      }),
    ]);
    return (result[0]?.meta.changes ?? 0) === 1;
  }

  async updateSupplier(event: UpdateSupplierEvent): Promise<boolean> {
    const result = await this.database.batch([
      this.database
        .prepare(
          `UPDATE suppliers
           SET name = ?1, contact_name = ?2, phone = ?3, email = ?4, address = ?5,
               tax_id = ?6, status = ?7, updated_at = ?8
           WHERE tenant_id = ?9 AND id = ?10 AND uuid = ?11`,
        )
        .bind(
          event.name,
          event.contactName,
          event.phone,
          event.email,
          event.address,
          event.taxId,
          event.status,
          event.occurredAt,
          event.tenantId,
          event.targetId,
          event.targetUuid,
        ),
      this.updateAudit(event, 'suppliers', 'supplier', event.before, {
        name: event.name,
        contact_name: event.contactName,
        phone: event.phone,
        email: event.email,
        address: event.address,
        tax_id: event.taxId,
        status: event.status,
      }),
    ]);
    return (result[0]?.meta.changes ?? 0) === 1;
  }

  async createCustomer(event: CreateCustomerEvent): Promise<boolean> {
    const result = await this.database.batch([
      this.database
        .prepare(
          `INSERT INTO customers
             (uuid, tenant_id, code, name, type, phone, email, address, status,
              created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'active', ?9, ?9)
           ON CONFLICT DO NOTHING`,
        )
        .bind(
          event.targetUuid,
          event.tenantId,
          event.code,
          event.name,
          event.type,
          event.phone,
          event.email,
          event.address,
          event.occurredAt,
        ),
      this.createAudit(event, 'customers', 'customer', {
        code: event.code,
        name: event.name,
        type: event.type,
        phone: event.phone,
        email: event.email,
        status: 'active',
      }),
    ]);
    return (result[0]?.meta.changes ?? 0) === 1;
  }

  async updateCustomer(event: UpdateCustomerEvent): Promise<boolean> {
    const result = await this.database.batch([
      this.database
        .prepare(
          `UPDATE customers
           SET name = ?1, type = ?2, phone = ?3, email = ?4, address = ?5,
               status = ?6, updated_at = ?7
           WHERE tenant_id = ?8 AND id = ?9 AND uuid = ?10`,
        )
        .bind(
          event.name,
          event.type,
          event.phone,
          event.email,
          event.address,
          event.status,
          event.occurredAt,
          event.tenantId,
          event.targetId,
          event.targetUuid,
        ),
      this.updateAudit(event, 'customers', 'customer', event.before, {
        name: event.name,
        type: event.type,
        phone: event.phone,
        email: event.email,
        address: event.address,
        status: event.status,
      }),
    ]);
    return (result[0]?.meta.changes ?? 0) === 1;
  }
}
