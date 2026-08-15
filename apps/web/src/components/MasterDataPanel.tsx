import type {
  BrandData,
  CategoryData,
  CustomerData,
  CustomerType,
  MasterDirectoryData,
  ProductData,
  ProductType,
  ProductUnitData,
  SupplierData,
  UnitData,
} from '@pos/contracts';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState, type FormEvent, type ReactNode } from 'react';

import { getJson, patchJson, postJson } from '../lib/api';

type MasterTab = 'products' | 'references' | 'partners';
type ReferenceKind = 'category' | 'brand' | 'unit';
type PartnerKind = 'supplier' | 'customer';
interface Operation {
  readonly method: 'POST' | 'PATCH';
  readonly path: string;
  readonly body: unknown;
}

const fieldClass =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10';
const actionClass =
  'rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50';
const emptyDirectory: MasterDirectoryData = {
  categories: [],
  brands: [],
  units: [],
  products: [],
  suppliers: [],
  customers: [],
  branches: [],
};

function Field({
  label,
  children,
  wide = false,
}: {
  readonly label: string;
  readonly children: ReactNode;
  readonly wide?: boolean;
}) {
  return (
    <label className={`text-xs font-bold text-slate-600 ${wide ? 'sm:col-span-2' : ''}`}>
      {label}
      {children}
    </label>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-10 items-center gap-2 rounded-xl bg-slate-50 px-3 text-xs font-bold text-slate-600">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}

function Empty({ children }: { readonly children: ReactNode }) {
  return <p className="rounded-2xl bg-slate-50 p-4 text-xs text-slate-500">{children}</p>;
}

function StatusButton({
  status,
  disabled,
  onClick,
}: {
  readonly status: 'active' | 'inactive';
  readonly disabled: boolean;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`shrink-0 rounded-lg px-2.5 py-1 text-[0.65rem] font-extrabold disabled:opacity-50 ${
        status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
      }`}
    >
      {status === 'active' ? 'Aktif' : 'Nonaktif'}
    </button>
  );
}

function referenceTitle(kind: ReferenceKind): string {
  if (kind === 'category') return 'Kategori';
  if (kind === 'brand') return 'Merek';
  return 'Satuan';
}

export function MasterDataPanel({ permissions }: { readonly permissions: readonly string[] }) {
  const canCreate = permissions.includes('product.create');
  const canUpdate = permissions.includes('product.update');
  const canManageSuppliers = permissions.includes('purchase.create');
  const canManageCustomers = permissions.includes('sales.create');
  const directory = useQuery({
    queryKey: ['master-directory'],
    queryFn: ({ signal }) => getJson<MasterDirectoryData>('/api/v1/master/directory', signal),
    retry: false,
  });
  const operation = useMutation({
    mutationFn: (input: Operation) =>
      input.method === 'POST'
        ? postJson<unknown>(input.path, input.body)
        : patchJson<unknown>(input.path, input.body),
    onSuccess: () => directory.refetch(),
  });

  const [tab, setTab] = useState<MasterTab>('products');
  const [referenceKind, setReferenceKind] = useState<ReferenceKind>('category');
  const [referenceCode, setReferenceCode] = useState('');
  const [referenceName, setReferenceName] = useState('');
  const [referenceParentId, setReferenceParentId] = useState('');
  const [unitSymbol, setUnitSymbol] = useState('');
  const [unitPrecision, setUnitPrecision] = useState('0');

  const [sku, setSku] = useState('');
  const [productName, setProductName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [baseUnitId, setBaseUnitId] = useState('');
  const [productType, setProductType] = useState<ProductType>('stock');
  const [trackBatches, setTrackBatches] = useState(false);
  const [trackExpiry, setTrackExpiry] = useState(false);
  const [allowDecimal, setAllowDecimal] = useState(false);
  const [productBarcode, setProductBarcode] = useState('');

  const [conversionProductId, setConversionProductId] = useState('');
  const [conversionUnitId, setConversionUnitId] = useState('');
  const [conversionNumerator, setConversionNumerator] = useState('1');
  const [conversionDenominator, setConversionDenominator] = useState('1');
  const [conversionBarcode, setConversionBarcode] = useState('');
  const [isSaleUnit, setIsSaleUnit] = useState(true);
  const [isPurchaseUnit, setIsPurchaseUnit] = useState(true);

  const [priceProductUnitId, setPriceProductUnitId] = useState('');
  const [priceBranchId, setPriceBranchId] = useState('');
  const [amountMinor, setAmountMinor] = useState('');

  const [partnerKind, setPartnerKind] = useState<PartnerKind>(
    canManageSuppliers ? 'supplier' : 'customer',
  );
  const [partnerCode, setPartnerCode] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [partnerPhone, setPartnerPhone] = useState('');
  const [partnerEmail, setPartnerEmail] = useState('');
  const [customerType, setCustomerType] = useState<CustomerType>('individual');

  function mutate(method: Operation['method'], path: string, body: unknown) {
    operation.mutate({ method, path, body });
  }

  function submitReference(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const common = { code: referenceCode, name: referenceName, description: null };
    const body =
      referenceKind === 'category'
        ? { ...common, parentId: referenceParentId || null }
        : referenceKind === 'brand'
          ? common
          : {
              code: referenceCode,
              name: referenceName,
              symbol: unitSymbol,
              precision: Number(unitPrecision),
            };
    mutate(
      'POST',
      `/api/v1/master/${referenceKind === 'category' ? 'categories' : referenceKind === 'brand' ? 'brands' : 'units'}`,
      body,
    );
  }

  function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutate('POST', '/api/v1/master/products', {
      sku,
      name: productName,
      description: null,
      categoryId: categoryId || null,
      brandId: brandId || null,
      baseUnitId,
      type: productType,
      trackBatches,
      trackExpiry,
      allowDecimal,
      barcode: productBarcode || null,
    });
  }

  function submitConversion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutate('POST', '/api/v1/master/product-units', {
      productId: conversionProductId,
      unitId: conversionUnitId,
      conversionNumerator: Number(conversionNumerator),
      conversionDenominator: Number(conversionDenominator),
      barcode: conversionBarcode || null,
      isSaleUnit,
      isPurchaseUnit,
    });
  }

  function submitPrice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutate('POST', '/api/v1/master/prices', {
      productUnitId: priceProductUnitId,
      branchId: priceBranchId || null,
      amountMinor: Number(amountMinor),
      currency: 'IDR',
    });
  }

  function submitPartner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const contact = {
      code: partnerCode,
      name: partnerName,
      phone: partnerPhone || null,
      email: partnerEmail || null,
      address: null,
    };
    if (partnerKind === 'supplier') {
      mutate('POST', '/api/v1/master/suppliers', {
        ...contact,
        contactName: null,
        taxId: null,
      });
    } else {
      mutate('POST', '/api/v1/master/customers', { ...contact, type: customerType });
    }
  }

  function toggleCategory(category: CategoryData) {
    mutate('PATCH', `/api/v1/master/categories/${category.id}`, {
      parentId: category.parentId,
      name: category.name,
      description: category.description,
      status: category.status === 'active' ? 'inactive' : 'active',
    });
  }

  function toggleBrand(brand: BrandData) {
    mutate('PATCH', `/api/v1/master/brands/${brand.id}`, {
      name: brand.name,
      description: brand.description,
      status: brand.status === 'active' ? 'inactive' : 'active',
    });
  }

  function toggleUnit(unit: UnitData) {
    mutate('PATCH', `/api/v1/master/units/${unit.id}`, {
      name: unit.name,
      symbol: unit.symbol,
      precision: unit.precision,
      status: unit.status === 'active' ? 'inactive' : 'active',
    });
  }

  function toggleProduct(product: ProductData) {
    mutate('PATCH', `/api/v1/master/products/${product.id}`, {
      categoryId: product.categoryId,
      brandId: product.brandId,
      name: product.name,
      description: product.description,
      type: product.type,
      status: product.status === 'active' ? 'inactive' : 'active',
      trackBatches: product.trackBatches,
      trackExpiry: product.trackExpiry,
      allowDecimal: product.allowDecimal,
    });
  }

  function toggleProductUnit(unit: ProductUnitData) {
    mutate('PATCH', `/api/v1/master/product-units/${unit.id}`, {
      conversionNumerator: unit.conversionNumerator,
      conversionDenominator: unit.conversionDenominator,
      barcode: unit.barcode,
      isSaleUnit: unit.isSaleUnit,
      isPurchaseUnit: unit.isPurchaseUnit,
      status: unit.status === 'active' ? 'inactive' : 'active',
    });
  }

  function toggleSupplier(supplier: SupplierData) {
    mutate('PATCH', `/api/v1/master/suppliers/${supplier.id}`, {
      name: supplier.name,
      contactName: supplier.contactName,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
      taxId: supplier.taxId,
      status: supplier.status === 'active' ? 'inactive' : 'active',
    });
  }

  function toggleCustomer(customer: CustomerData) {
    mutate('PATCH', `/api/v1/master/customers/${customer.id}`, {
      name: customer.name,
      type: customer.type,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      status: customer.status === 'active' ? 'inactive' : 'active',
    });
  }

  const data = directory.data ?? emptyDirectory;
  const activeUnits = data?.units.filter((unit) => unit.status === 'active') ?? [];
  const activeProducts = data?.products.filter((product) => product.status === 'active') ?? [];
  const activeProductUnits = activeProducts.flatMap((product) =>
    product.units.filter((unit) => unit.status === 'active').map((unit) => ({ product, unit })),
  );
  const canCreatePartner =
    (partnerKind === 'supplier' && canManageSuppliers) ||
    (partnerKind === 'customer' && canManageCustomers);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:col-span-2">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-700">
            Master data
          </p>
          <h2 className="mt-2 text-xl font-bold tracking-tight">Katalog &amp; mitra</h2>
        </div>
        {data === undefined ? null : (
          <p className="text-xs font-bold text-slate-400">
            {data.products.length} produk · {data.suppliers.length} pemasok ·{' '}
            {data.customers.length} pelanggan
          </p>
        )}
      </div>

      <div className="mt-5 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1" role="tablist">
        {(
          [
            ['products', 'Produk & harga'],
            ['references', 'Kategori, merek & satuan'],
            ['partners', 'Pemasok & pelanggan'],
          ] as const
        ).map(([value, label]) => (
          <button
            type="button"
            role="tab"
            aria-selected={tab === value}
            key={value}
            onClick={() => setTab(value)}
            className={`min-w-max flex-1 rounded-lg px-3 py-2 text-xs font-extrabold ${
              tab === value ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {directory.isPending ? (
        <div className="mt-5 h-56 animate-pulse rounded-2xl bg-slate-100" role="status" />
      ) : directory.isError ? (
        <p
          className="mt-5 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"
          role="alert"
        >
          Master data belum dapat dimuat.
        </p>
      ) : (
        <>
          {tab === 'references' ? (
            <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="grid gap-3 sm:grid-cols-3">
                {(
                  [
                    ['category', data.categories],
                    ['brand', data.brands],
                    ['unit', data.units],
                  ] as const
                ).map(([kind, records]) => (
                  <div key={kind} className="rounded-2xl bg-slate-50 p-4">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
                      {referenceTitle(kind)}
                    </h3>
                    <div className="mt-3 space-y-2">
                      {records.length === 0 ? (
                        <p className="text-xs text-slate-400">Belum ada.</p>
                      ) : (
                        records.map((record) => (
                          <div key={record.id} className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold">{record.name}</p>
                              <p className="text-[0.65rem] text-slate-400">
                                {record.code}
                                {kind === 'unit' ? ` · ${(record as UnitData).symbol}` : ''}
                              </p>
                            </div>
                            <StatusButton
                              status={record.status}
                              disabled={!canUpdate || operation.isPending}
                              onClick={() =>
                                kind === 'category'
                                  ? toggleCategory(record as CategoryData)
                                  : kind === 'brand'
                                    ? toggleBrand(record as BrandData)
                                    : toggleUnit(record as UnitData)
                              }
                            />
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {canCreate ? (
                <form
                  onSubmit={submitReference}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-extrabold">Tambah referensi</h3>
                    <select
                      value={referenceKind}
                      onChange={(event) => setReferenceKind(event.target.value as ReferenceKind)}
                      className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-bold"
                    >
                      <option value="category">Kategori</option>
                      <option value="brand">Merek</option>
                      <option value="unit">Satuan</option>
                    </select>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    <Field label="Kode">
                      <input
                        required
                        minLength={2}
                        maxLength={50}
                        value={referenceCode}
                        onChange={(event) => setReferenceCode(event.target.value.toUpperCase())}
                        className={fieldClass}
                      />
                    </Field>
                    <Field label="Nama">
                      <input
                        required
                        minLength={2}
                        maxLength={160}
                        value={referenceName}
                        onChange={(event) => setReferenceName(event.target.value)}
                        className={fieldClass}
                      />
                    </Field>
                    {referenceKind === 'category' ? (
                      <Field label="Kategori induk" wide>
                        <select
                          value={referenceParentId}
                          onChange={(event) => setReferenceParentId(event.target.value)}
                          className={fieldClass}
                        >
                          <option value="">Tanpa induk</option>
                          {data.categories
                            .filter((category) => category.status === 'active')
                            .map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.code} · {category.name}
                              </option>
                            ))}
                        </select>
                      </Field>
                    ) : referenceKind === 'unit' ? (
                      <>
                        <Field label="Simbol">
                          <input
                            required
                            maxLength={20}
                            value={unitSymbol}
                            onChange={(event) => setUnitSymbol(event.target.value)}
                            className={fieldClass}
                          />
                        </Field>
                        <Field label="Presisi desimal">
                          <input
                            required
                            type="number"
                            min={0}
                            max={6}
                            value={unitPrecision}
                            onChange={(event) => setUnitPrecision(event.target.value)}
                            className={fieldClass}
                          />
                        </Field>
                      </>
                    ) : null}
                  </div>
                  <button
                    type="submit"
                    disabled={operation.isPending}
                    className={`${actionClass} mt-4 w-full sm:w-auto`}
                  >
                    Simpan {referenceTitle(referenceKind).toLowerCase()}
                  </button>
                </form>
              ) : null}
            </div>
          ) : tab === 'products' ? (
            <div className="mt-5">
              <div className="grid gap-3 lg:grid-cols-2">
                {data.products.length === 0 ? (
                  <Empty>Belum ada produk. Buat kategori, satuan, lalu produk pertama.</Empty>
                ) : (
                  data.products.map((product) => {
                    const base = product.units.find((unit) => unit.isBase);
                    const activePrice = product.prices.find(
                      (price) => price.status === 'active' && price.branchId === null,
                    );
                    return (
                      <article key={product.id} className="rounded-2xl bg-slate-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-extrabold">{product.name}</p>
                            <p className="mt-0.5 text-[0.65rem] font-bold text-slate-400">
                              {product.sku} · {product.type === 'stock' ? 'Stok' : 'Jasa'}
                            </p>
                          </div>
                          <StatusButton
                            status={product.status}
                            disabled={!canUpdate || operation.isPending}
                            onClick={() => toggleProduct(product)}
                          />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {product.units.map((unit) => {
                            const unitName =
                              data.units.find((entry) => entry.id === unit.unitId)?.symbol ??
                              'unit';
                            return (
                              <button
                                type="button"
                                key={unit.id}
                                disabled={unit.isBase || !canUpdate || operation.isPending}
                                onClick={() => toggleProductUnit(unit)}
                                className={`rounded-md px-2 py-1 text-[0.6rem] font-bold disabled:cursor-default ${unit.status === 'active' ? 'bg-white text-slate-600' : 'bg-slate-200 text-slate-400'}`}
                              >
                                {unit.isBase ? 'Dasar · ' : ''}
                                {unit.conversionNumerator}/{unit.conversionDenominator} {unitName}
                              </button>
                            );
                          })}
                        </div>
                        <p className="mt-3 text-xs font-bold text-teal-800">
                          {activePrice === undefined
                            ? 'Harga global belum diatur'
                            : new Intl.NumberFormat('id-ID', {
                                style: 'currency',
                                currency: activePrice.currency,
                                maximumFractionDigits: 0,
                              }).format(activePrice.amountMinor)}
                        </p>
                        {base?.barcode === null || base === undefined ? null : (
                          <p className="mt-1 font-mono text-[0.6rem] text-slate-400">
                            {base.barcode}
                          </p>
                        )}
                      </article>
                    );
                  })
                )}
              </div>

              {canCreate ? (
                <form
                  onSubmit={submitProduct}
                  className="mt-5 rounded-2xl border border-slate-200 p-4 sm:p-5"
                >
                  <h3 className="text-sm font-extrabold">Produk baru</h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="SKU">
                      <input
                        required
                        minLength={2}
                        maxLength={50}
                        value={sku}
                        onChange={(event) => setSku(event.target.value.toUpperCase())}
                        className={fieldClass}
                      />
                    </Field>
                    <Field label="Nama">
                      <input
                        required
                        minLength={2}
                        maxLength={160}
                        value={productName}
                        onChange={(event) => setProductName(event.target.value)}
                        className={fieldClass}
                      />
                    </Field>
                    <Field label="Satuan dasar">
                      <select
                        required
                        value={baseUnitId}
                        onChange={(event) => setBaseUnitId(event.target.value)}
                        className={fieldClass}
                      >
                        <option value="">Pilih</option>
                        {activeUnits.map((unit) => (
                          <option key={unit.id} value={unit.id}>
                            {unit.code} · {unit.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Jenis">
                      <select
                        value={productType}
                        onChange={(event) => {
                          const value = event.target.value as ProductType;
                          setProductType(value);
                          if (value === 'service') {
                            setTrackBatches(false);
                            setTrackExpiry(false);
                          }
                        }}
                        className={fieldClass}
                      >
                        <option value="stock">Barang stok</option>
                        <option value="service">Jasa</option>
                      </select>
                    </Field>
                    <Field label="Kategori">
                      <select
                        value={categoryId}
                        onChange={(event) => setCategoryId(event.target.value)}
                        className={fieldClass}
                      >
                        <option value="">Tanpa kategori</option>
                        {data.categories
                          .filter((value) => value.status === 'active')
                          .map((value) => (
                            <option key={value.id} value={value.id}>
                              {value.name}
                            </option>
                          ))}
                      </select>
                    </Field>
                    <Field label="Merek">
                      <select
                        value={brandId}
                        onChange={(event) => setBrandId(event.target.value)}
                        className={fieldClass}
                      >
                        <option value="">Tanpa merek</option>
                        {data.brands
                          .filter((value) => value.status === 'active')
                          .map((value) => (
                            <option key={value.id} value={value.id}>
                              {value.name}
                            </option>
                          ))}
                      </select>
                    </Field>
                    <Field label="Barcode">
                      <input
                        maxLength={100}
                        value={productBarcode}
                        onChange={(event) => setProductBarcode(event.target.value)}
                        className={fieldClass}
                      />
                    </Field>
                    <div className="grid grid-cols-1 gap-2">
                      <Check
                        label="Boleh desimal"
                        checked={allowDecimal}
                        onChange={setAllowDecimal}
                      />
                      {productType === 'stock' ? (
                        <div className="grid grid-cols-2 gap-2">
                          <Check
                            label="Batch"
                            checked={trackBatches}
                            onChange={(checked) => {
                              setTrackBatches(checked);
                              if (!checked) setTrackExpiry(false);
                            }}
                          />
                          <Check
                            label="Expiry"
                            checked={trackExpiry}
                            onChange={(checked) => {
                              setTrackExpiry(checked);
                              if (checked) setTrackBatches(true);
                            }}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={operation.isPending || activeUnits.length === 0}
                    className={`${actionClass} mt-4 w-full sm:w-auto`}
                  >
                    Buat produk
                  </button>
                </form>
              ) : null}

              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                {canCreate ? (
                  <form
                    onSubmit={submitConversion}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <h3 className="text-sm font-extrabold">Konversi multi-satuan</h3>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <Field label="Produk" wide>
                        <select
                          required
                          value={conversionProductId}
                          onChange={(event) => setConversionProductId(event.target.value)}
                          className={fieldClass}
                        >
                          <option value="">Pilih</option>
                          {activeProducts.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.sku} · {product.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Satuan">
                        <select
                          required
                          value={conversionUnitId}
                          onChange={(event) => setConversionUnitId(event.target.value)}
                          className={fieldClass}
                        >
                          <option value="">Pilih</option>
                          {activeUnits.map((unit) => (
                            <option key={unit.id} value={unit.id}>
                              {unit.code} · {unit.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Pembilang">
                        <input
                          required
                          type="number"
                          min={1}
                          max={1000000000}
                          value={conversionNumerator}
                          onChange={(event) => setConversionNumerator(event.target.value)}
                          className={fieldClass}
                        />
                      </Field>
                      <Field label="Penyebut">
                        <input
                          required
                          type="number"
                          min={1}
                          max={1000000000}
                          value={conversionDenominator}
                          onChange={(event) => setConversionDenominator(event.target.value)}
                          className={fieldClass}
                        />
                      </Field>
                      <Field label="Barcode" wide>
                        <input
                          maxLength={100}
                          value={conversionBarcode}
                          onChange={(event) => setConversionBarcode(event.target.value)}
                          className={fieldClass}
                        />
                      </Field>
                      <Check label="Satuan jual" checked={isSaleUnit} onChange={setIsSaleUnit} />
                      <Check
                        label="Satuan beli"
                        checked={isPurchaseUnit}
                        onChange={setIsPurchaseUnit}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={operation.isPending}
                      className={`${actionClass} mt-4 w-full sm:w-auto`}
                    >
                      Tambah konversi
                    </button>
                  </form>
                ) : null}
                {canUpdate ? (
                  <form onSubmit={submitPrice} className="rounded-2xl border border-slate-200 p-4">
                    <h3 className="text-sm font-extrabold">Harga baru</h3>
                    <p className="mt-1 text-[0.65rem] text-slate-400">
                      Harga lama otomatis menjadi riwayat dan tidak ditimpa.
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <Field label="Produk & satuan" wide>
                        <select
                          required
                          value={priceProductUnitId}
                          onChange={(event) => setPriceProductUnitId(event.target.value)}
                          className={fieldClass}
                        >
                          <option value="">Pilih</option>
                          {activeProductUnits.map(({ product, unit }) => {
                            const unitName =
                              data.units.find((value) => value.id === unit.unitId)?.symbol ??
                              'unit';
                            return (
                              <option key={unit.id} value={unit.id}>
                                {product.sku} · {unitName} ({unit.conversionNumerator}/
                                {unit.conversionDenominator})
                              </option>
                            );
                          })}
                        </select>
                      </Field>
                      <Field label="Cabang">
                        <select
                          value={priceBranchId}
                          onChange={(event) => setPriceBranchId(event.target.value)}
                          className={fieldClass}
                        >
                          <option value="">Global</option>
                          {data.branches.map((branch) => (
                            <option key={branch.id} value={branch.id}>
                              {branch.code} · {branch.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Harga IDR">
                        <input
                          required
                          type="number"
                          min={0}
                          step={1}
                          value={amountMinor}
                          onChange={(event) => setAmountMinor(event.target.value)}
                          className={fieldClass}
                        />
                      </Field>
                    </div>
                    <button
                      type="submit"
                      disabled={operation.isPending}
                      className={`${actionClass} mt-4 w-full sm:w-auto`}
                    >
                      Tetapkan harga
                    </button>
                  </form>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
                    Pemasok
                  </h3>
                  <div className="mt-3 space-y-2">
                    {data.suppliers.length === 0 ? (
                      <p className="text-xs text-slate-400">Belum ada.</p>
                    ) : (
                      data.suppliers.map((supplier) => (
                        <div key={supplier.id} className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold">{supplier.name}</p>
                            <p className="text-[0.65rem] text-slate-400">
                              {supplier.code}
                              {supplier.phone === null ? '' : ` · ${supplier.phone}`}
                            </p>
                          </div>
                          <StatusButton
                            status={supplier.status}
                            disabled={!canManageSuppliers || operation.isPending}
                            onClick={() => toggleSupplier(supplier)}
                          />
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
                    Pelanggan
                  </h3>
                  <div className="mt-3 space-y-2">
                    {data.customers.length === 0 ? (
                      <p className="text-xs text-slate-400">Belum ada.</p>
                    ) : (
                      data.customers.map((customer) => (
                        <div key={customer.id} className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold">{customer.name}</p>
                            <p className="text-[0.65rem] text-slate-400">
                              {customer.code} ·{' '}
                              {customer.type === 'business' ? 'Bisnis' : 'Individu'}
                            </p>
                          </div>
                          <StatusButton
                            status={customer.status}
                            disabled={!canManageCustomers || operation.isPending}
                            onClick={() => toggleCustomer(customer)}
                          />
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
              {canManageSuppliers || canManageCustomers ? (
                <form onSubmit={submitPartner} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-extrabold">Tambah mitra</h3>
                    <select
                      value={partnerKind}
                      onChange={(event) => setPartnerKind(event.target.value as PartnerKind)}
                      className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-bold"
                    >
                      {canManageSuppliers ? <option value="supplier">Pemasok</option> : null}
                      {canManageCustomers ? <option value="customer">Pelanggan</option> : null}
                    </select>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    <Field label="Kode">
                      <input
                        required
                        minLength={2}
                        maxLength={50}
                        value={partnerCode}
                        onChange={(event) => setPartnerCode(event.target.value.toUpperCase())}
                        className={fieldClass}
                      />
                    </Field>
                    <Field label="Nama">
                      <input
                        required
                        minLength={2}
                        maxLength={160}
                        value={partnerName}
                        onChange={(event) => setPartnerName(event.target.value)}
                        className={fieldClass}
                      />
                    </Field>
                    <Field label="Telepon">
                      <input
                        maxLength={40}
                        value={partnerPhone}
                        onChange={(event) => setPartnerPhone(event.target.value)}
                        className={fieldClass}
                      />
                    </Field>
                    <Field label="Email">
                      <input
                        type="email"
                        maxLength={254}
                        value={partnerEmail}
                        onChange={(event) => setPartnerEmail(event.target.value)}
                        className={fieldClass}
                      />
                    </Field>
                    {partnerKind === 'customer' ? (
                      <Field label="Jenis pelanggan" wide>
                        <select
                          value={customerType}
                          onChange={(event) => setCustomerType(event.target.value as CustomerType)}
                          className={fieldClass}
                        >
                          <option value="individual">Individu</option>
                          <option value="business">Bisnis</option>
                        </select>
                      </Field>
                    ) : null}
                  </div>
                  <button
                    type="submit"
                    disabled={operation.isPending || !canCreatePartner}
                    className={`${actionClass} mt-4 w-full sm:w-auto`}
                  >
                    Simpan {partnerKind === 'supplier' ? 'pemasok' : 'pelanggan'}
                  </button>
                </form>
              ) : null}
            </div>
          )}
          {operation.isError ? (
            <p
              className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"
              role="alert"
            >
              Perubahan tidak dapat disimpan. Periksa relasi, nilai unik, dan resource aktif.
            </p>
          ) : null}
          {operation.isSuccess ? (
            <p className="mt-4 text-xs font-semibold text-emerald-700" role="status">
              Master data berhasil diperbarui.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
