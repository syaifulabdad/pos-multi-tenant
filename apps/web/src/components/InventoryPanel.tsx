import type {
  InventoryBatchData,
  InventoryDirectoryData,
  InventoryReservationData,
  StockMovementData,
} from '@pos/contracts';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState, type FormEvent } from 'react';

import { getJson, patchJson, postJson } from '../lib/api';

const fieldClass =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10';
const actionClass =
  'rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50';

function localIso(value: string): string {
  return new Date(value).toISOString();
}
function dateTimeDefault(offsetDays = 0): string {
  const date = new Date(Date.now() + offsetDays * 86_400_000);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function InventoryPanel({ permissions }: { readonly permissions: readonly string[] }) {
  const canAdjust = permissions.includes('stock.adjust');
  const canReserve = permissions.includes('sales.create');
  const directory = useQuery({
    queryKey: ['inventory-directory'],
    queryFn: ({ signal }) => getJson<InventoryDirectoryData>('/api/v1/inventory/directory', signal),
    retry: false,
  });

  const [batchProductId, setBatchProductId] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [receivedAt, setReceivedAt] = useState(dateTimeDefault());
  const [expiresAt, setExpiresAt] = useState(dateTimeDefault(365));
  const [unitCostMinor, setUnitCostMinor] = useState('0');

  const [adjustProductId, setAdjustProductId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [adjustBatchId, setAdjustBatchId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [opening, setOpening] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const [reservationProductId, setReservationProductId] = useState('');
  const [reservationQuantity, setReservationQuantity] = useState('');

  const createBatch = useMutation({
    mutationFn: () => {
      const product = directory.data?.products.find((entry) => entry.id === batchProductId);
      return postJson<{ readonly batch: InventoryBatchData }>('/api/v1/inventory/batches', {
        productId: batchProductId,
        supplierId: null,
        batchNumber: product?.trackBatches === true ? batchNumber : null,
        receivedAt: localIso(receivedAt),
        manufacturedAt: null,
        expiresAt: product?.trackExpiry === true ? localIso(expiresAt) : null,
        unitCostMinor: Number(unitCostMinor),
        currency: 'IDR',
        status: 'available',
      });
    },
    onSuccess: async () => {
      setBatchNumber('');
      await directory.refetch();
    },
  });
  const adjust = useMutation({
    mutationFn: () => {
      const product = directory.data?.products.find((entry) => entry.id === adjustProductId);
      if (product === undefined) throw new Error('Product unavailable');
      return postJson<{ readonly movement: StockMovementData }>(
        '/api/v1/inventory/adjustments',
        {
          productUnitId: product.productUnitId,
          locationId,
          batchId: product.trackBatches ? adjustBatchId : null,
          quantity,
          reason,
          opening,
        },
        { 'Idempotency-Key': idempotencyKey },
      );
    },
    onSuccess: async () => {
      setQuantity('');
      setReason('');
      setIdempotencyKey(crypto.randomUUID());
      await directory.refetch();
    },
  });
  const reserve = useMutation({
    mutationFn: () => {
      const product = directory.data?.products.find((entry) => entry.id === reservationProductId);
      if (product === undefined) throw new Error('Product unavailable');
      return postJson<{ readonly reservation: InventoryReservationData }>(
        '/api/v1/inventory/reservations',
        {
          productUnitId: product.productUnitId,
          quantity: reservationQuantity,
          expiresInSeconds: 900,
        },
      );
    },
    onSuccess: async () => {
      setReservationQuantity('');
      await directory.refetch();
    },
  });
  const release = useMutation({
    mutationFn: (reservation: InventoryReservationData) =>
      patchJson(`/api/v1/inventory/reservations/${reservation.id}/release`, {}),
    onSuccess: () => directory.refetch(),
  });
  const expire = useMutation({
    mutationFn: () =>
      postJson<{ readonly expired: number }>('/api/v1/inventory/reservations/expire'),
    onSuccess: () => directory.refetch(),
  });

  const totals = useMemo(() => {
    const values = new Map<string, { onHand: number; reserved: number; available: number }>();
    for (const balance of directory.data?.balances ?? []) {
      const current = values.get(balance.productId) ?? { onHand: 0, reserved: 0, available: 0 };
      current.onHand += Number(balance.onHand);
      current.reserved += Number(balance.reserved);
      current.available += Number(balance.available);
      values.set(balance.productId, current);
    }
    return values;
  }, [directory.data]);
  const selectedBatchProduct = directory.data?.products.find(
    (product) => product.id === batchProductId,
  );
  const selectedAdjustProduct = directory.data?.products.find(
    (product) => product.id === adjustProductId,
  );
  const availableBatches =
    directory.data?.batches.filter(
      (batch) => batch.productId === adjustProductId && batch.effectiveStatus === 'available',
    ) ?? [];
  const operationError =
    createBatch.isError || adjust.isError || reserve.isError || release.isError || expire.isError;

  function submitBatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createBatch.mutate();
  }
  function submitAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    adjust.mutate();
  }
  function submitReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    reserve.mutate();
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:col-span-2">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-700">Inventori</p>
          <h2 className="mt-2 text-xl font-bold tracking-tight">Ketersediaan &amp; ledger stok</h2>
        </div>
        {canAdjust ? (
          <button
            type="button"
            disabled={expire.isPending}
            onClick={() => expire.mutate()}
            className="text-xs font-extrabold text-teal-700 disabled:opacity-50"
          >
            Lepaskan reservasi kedaluwarsa
          </button>
        ) : null}
      </div>

      {directory.isPending ? (
        <div className="mt-5 h-56 animate-pulse rounded-2xl bg-slate-100" role="status" />
      ) : directory.isError ? (
        <p
          className="mt-5 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"
          role="alert"
        >
          Inventori memerlukan cabang aktif dan permission stok.
        </p>
      ) : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {directory.data.products.length === 0 ? (
              <p className="text-xs text-slate-500">Belum ada produk stok aktif.</p>
            ) : (
              directory.data.products.map((product) => {
                const total = totals.get(product.id) ?? { onHand: 0, reserved: 0, available: 0 };
                return (
                  <article key={product.id} className="rounded-2xl bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-extrabold">{product.name}</p>
                        <p className="text-[0.65rem] font-bold text-slate-400">
                          {product.sku} · {product.unitSymbol}
                        </p>
                      </div>
                      <span className="rounded-lg bg-emerald-100 px-2 py-1 text-xs font-black text-emerald-700">
                        {total.available}
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-[0.65rem]">
                      <div>
                        <p className="text-slate-400">On hand</p>
                        <p className="font-bold">{total.onHand}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Reserved</p>
                        <p className="font-bold">{total.reserved}</p>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold">Batch &amp; expiry</h3>
                <span className="text-[0.65rem] font-bold text-slate-400">
                  {directory.data.batches.length} batch
                </span>
              </div>
              <div className="mt-3 max-h-64 space-y-2 overflow-auto">
                {directory.data.batches.length === 0 ? (
                  <p className="text-xs text-slate-400">Belum ada batch.</p>
                ) : (
                  directory.data.batches.map((batch) => {
                    const product = directory.data.products.find(
                      (entry) => entry.id === batch.productId,
                    );
                    return (
                      <div
                        key={batch.id}
                        className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold">
                            {product?.name ?? 'Produk'} · {batch.batchNumber ?? 'Tanpa batch'}
                          </p>
                          <p className="text-[0.65rem] text-slate-400">
                            {batch.expiresAt === null
                              ? 'Tanpa expiry'
                              : `Expiry ${new Date(batch.expiresAt).toLocaleDateString('id-ID')}`}
                          </p>
                        </div>
                        <span
                          className={`rounded-md px-2 py-1 text-[0.6rem] font-black uppercase ${batch.effectiveStatus === 'expired' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}
                        >
                          {batch.effectiveStatus}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <h3 className="text-sm font-extrabold">Pergerakan terbaru</h3>
              <div className="mt-3 max-h-64 space-y-2 overflow-auto">
                {directory.data.movements.length === 0 ? (
                  <p className="text-xs text-slate-400">Ledger masih kosong.</p>
                ) : (
                  directory.data.movements.map((movement) => {
                    const product = directory.data.products.find(
                      (entry) => entry.id === movement.productId,
                    );
                    return (
                      <div
                        key={movement.id}
                        className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold">
                            {product?.name ?? 'Produk'} · {movement.reason}
                          </p>
                          <p className="text-[0.65rem] text-slate-400">
                            {new Date(movement.createdAt).toLocaleString('id-ID')} · saldo{' '}
                            {movement.balanceAfter}
                          </p>
                        </div>
                        <span
                          className={`text-xs font-black ${movement.quantity.startsWith('-') ? 'text-rose-700' : 'text-emerald-700'}`}
                        >
                          {movement.quantity}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {canAdjust ? (
            <div className="mt-5 grid gap-5 xl:grid-cols-2">
              <form onSubmit={submitBatch} className="rounded-2xl border border-slate-200 p-4">
                <h3 className="text-sm font-extrabold">Batch penerimaan manual</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-bold text-slate-600 sm:col-span-2">
                    Produk
                    <select
                      required
                      value={batchProductId}
                      onChange={(event) => setBatchProductId(event.target.value)}
                      className={fieldClass}
                    >
                      <option value="">Pilih</option>
                      {directory.data.products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.sku} · {product.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {selectedBatchProduct?.trackBatches === true ? (
                    <label className="text-xs font-bold text-slate-600">
                      Nomor batch
                      <input
                        required
                        maxLength={100}
                        value={batchNumber}
                        onChange={(event) => setBatchNumber(event.target.value)}
                        className={fieldClass}
                      />
                    </label>
                  ) : null}
                  <label className="text-xs font-bold text-slate-600">
                    Diterima
                    <input
                      required
                      type="datetime-local"
                      value={receivedAt}
                      onChange={(event) => setReceivedAt(event.target.value)}
                      className={fieldClass}
                    />
                  </label>
                  {selectedBatchProduct?.trackExpiry === true ? (
                    <label className="text-xs font-bold text-slate-600">
                      Kedaluwarsa
                      <input
                        required
                        type="datetime-local"
                        value={expiresAt}
                        onChange={(event) => setExpiresAt(event.target.value)}
                        className={fieldClass}
                      />
                    </label>
                  ) : null}
                  <label className="text-xs font-bold text-slate-600">
                    Biaya per unit
                    <input
                      required
                      type="number"
                      min={0}
                      step={1}
                      value={unitCostMinor}
                      onChange={(event) => setUnitCostMinor(event.target.value)}
                      className={fieldClass}
                    />
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={createBatch.isPending || batchProductId.length === 0}
                  className={`${actionClass} mt-4 w-full sm:w-auto`}
                >
                  Buat batch
                </button>
              </form>

              <form onSubmit={submitAdjustment} className="rounded-2xl border border-slate-200 p-4">
                <h3 className="text-sm font-extrabold">Penyesuaian stok</h3>
                <p className="mt-1 text-[0.65rem] text-slate-400">
                  Gunakan nilai negatif untuk pengurangan. Setiap perubahan menambah ledger
                  immutable.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-bold text-slate-600">
                    Produk
                    <select
                      required
                      value={adjustProductId}
                      onChange={(event) => {
                        setAdjustProductId(event.target.value);
                        setAdjustBatchId('');
                      }}
                      className={fieldClass}
                    >
                      <option value="">Pilih</option>
                      {directory.data.products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.sku} · {product.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-bold text-slate-600">
                    Lokasi
                    <select
                      required
                      value={locationId}
                      onChange={(event) => setLocationId(event.target.value)}
                      className={fieldClass}
                    >
                      <option value="">Pilih</option>
                      {directory.data.locations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.warehouseCode}/{location.code} · {location.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {selectedAdjustProduct?.trackBatches === true ? (
                    <label className="text-xs font-bold text-slate-600">
                      Batch
                      <select
                        required
                        value={adjustBatchId}
                        onChange={(event) => setAdjustBatchId(event.target.value)}
                        className={fieldClass}
                      >
                        <option value="">Pilih</option>
                        {availableBatches.map((batch) => (
                          <option key={batch.id} value={batch.id}>
                            {batch.batchNumber} ·{' '}
                            {batch.expiresAt === null
                              ? 'tanpa expiry'
                              : new Date(batch.expiresAt).toLocaleDateString('id-ID')}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <label className="text-xs font-bold text-slate-600">
                    Jumlah ({selectedAdjustProduct?.unitSymbol ?? 'unit'})
                    <input
                      required
                      inputMode="decimal"
                      value={quantity}
                      onChange={(event) => setQuantity(event.target.value)}
                      className={fieldClass}
                      placeholder="10 atau -2"
                    />
                  </label>
                  <label className="text-xs font-bold text-slate-600 sm:col-span-2">
                    Alasan
                    <input
                      required
                      minLength={3}
                      maxLength={500}
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      className={fieldClass}
                    />
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                    <input
                      type="checkbox"
                      checked={opening}
                      onChange={(event) => setOpening(event.target.checked)}
                    />
                    Saldo awal
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={
                    adjust.isPending || adjustProductId.length === 0 || locationId.length === 0
                  }
                  className={`${actionClass} mt-4 w-full sm:w-auto`}
                >
                  Posting penyesuaian
                </button>
              </form>
            </div>
          ) : null}

          {canReserve ? (
            <div className="mt-5 grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
              <form
                onSubmit={submitReservation}
                className="rounded-2xl border border-slate-200 p-4"
              >
                <h3 className="text-sm font-extrabold">Reservasi FEFO/FIFO</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <label className="text-xs font-bold text-slate-600">
                    Produk
                    <select
                      required
                      value={reservationProductId}
                      onChange={(event) => setReservationProductId(event.target.value)}
                      className={fieldClass}
                    >
                      <option value="">Pilih</option>
                      {directory.data.products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.sku} · {product.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-bold text-slate-600">
                    Jumlah
                    <input
                      required
                      inputMode="decimal"
                      value={reservationQuantity}
                      onChange={(event) => setReservationQuantity(event.target.value)}
                      className={fieldClass}
                    />
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={reserve.isPending}
                  className={`${actionClass} mt-4 w-full sm:w-auto`}
                >
                  Reservasi 15 menit
                </button>
              </form>
              <div className="rounded-2xl border border-slate-200 p-4">
                <h3 className="text-sm font-extrabold">Reservasi aktif</h3>
                <div className="mt-3 space-y-2">
                  {directory.data.reservations.filter((entry) => entry.status === 'active')
                    .length === 0 ? (
                    <p className="text-xs text-slate-400">Tidak ada reservasi aktif.</p>
                  ) : (
                    directory.data.reservations
                      .filter((entry) => entry.status === 'active')
                      .map((reservation) => {
                        const product = directory.data.products.find(
                          (entry) => entry.id === reservation.productId,
                        );
                        return (
                          <div
                            key={reservation.id}
                            className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5"
                          >
                            <div>
                              <p className="text-xs font-bold">
                                {product?.name ?? 'Produk'} · {reservation.quantity}
                              </p>
                              <p className="text-[0.65rem] text-slate-400">
                                {reservation.allocations.length} alokasi · sampai{' '}
                                {new Date(reservation.expiresAt).toLocaleTimeString('id-ID')}
                              </p>
                            </div>
                            <button
                              type="button"
                              disabled={release.isPending}
                              onClick={() => release.mutate(reservation)}
                              className="text-[0.65rem] font-extrabold text-rose-700 disabled:opacity-50"
                            >
                              Lepaskan
                            </button>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {operationError ? (
            <p
              className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"
              role="alert"
            >
              Operasi inventori gagal. Periksa cabang, lokasi, batch, precision, dan ketersediaan
              stok.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
