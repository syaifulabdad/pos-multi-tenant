import type {
  LocationData,
  LocationType,
  OrganizationBranchData,
  OrganizationDirectoryData,
  PosTerminalData,
  WarehouseData,
} from '@pos/contracts';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';

import { getJson, patchJson, postJson } from '../lib/api';

type ResourceKind = 'branch' | 'warehouse' | 'location' | 'terminal';
type ManagedResource =
  | { readonly kind: 'branch'; readonly value: OrganizationBranchData }
  | { readonly kind: 'warehouse'; readonly value: WarehouseData }
  | { readonly kind: 'location'; readonly value: LocationData }
  | { readonly kind: 'terminal'; readonly value: PosTerminalData };

const fieldClass =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10';

const locationLabels: Readonly<Record<LocationType, string>> = {
  storage: 'Penyimpanan',
  sales_floor: 'Area penjualan',
  receiving: 'Penerimaan',
  quarantine: 'Karantina',
  damaged: 'Barang rusak',
  expired: 'Kedaluwarsa',
};

function StatusButton({
  resource,
  pending,
  onToggle,
}: {
  readonly resource: ManagedResource;
  readonly pending: boolean;
  readonly onToggle: (resource: ManagedResource) => void;
}) {
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => onToggle(resource)}
      className={`rounded-lg px-2.5 py-1 text-[0.65rem] font-extrabold disabled:opacity-50 ${
        resource.value.status === 'active'
          ? 'bg-emerald-100 text-emerald-700'
          : 'bg-slate-200 text-slate-600'
      }`}
    >
      {resource.value.status === 'active' ? 'Aktif' : 'Nonaktif'}
    </button>
  );
}

export function OrganizationPanel() {
  const directory = useQuery({
    queryKey: ['admin-organization'],
    queryFn: ({ signal }) =>
      getJson<OrganizationDirectoryData>('/api/v1/admin/organization', signal),
    retry: false,
  });
  const [kind, setKind] = useState<ResourceKind>('branch');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [address, setAddress] = useState('');
  const [timezone, setTimezone] = useState('Asia/Jakarta');
  const [locationType, setLocationType] = useState<LocationType>('storage');

  const createResource = useMutation({
    mutationFn: async () => {
      if (kind === 'branch') {
        return postJson<{ readonly branch: OrganizationBranchData }>(
          '/api/v1/admin/organization/branches',
          { code, name, timezone, address: address || null },
        );
      }
      if (kind === 'warehouse') {
        return postJson<{ readonly warehouse: WarehouseData }>(
          '/api/v1/admin/organization/warehouses',
          { branchId: parentId, code, name, address: address || null },
        );
      }
      if (kind === 'location') {
        return postJson<{ readonly location: LocationData }>(
          '/api/v1/admin/organization/locations',
          { warehouseId: parentId, code, name, type: locationType },
        );
      }
      return postJson<{ readonly terminal: PosTerminalData }>(
        '/api/v1/admin/organization/terminals',
        { branchId: parentId, code, name },
      );
    },
    onSuccess: async () => {
      setCode('');
      setName('');
      setAddress('');
      await directory.refetch();
    },
  });

  const toggleResource = useMutation({
    mutationFn: (resource: ManagedResource) => {
      const status = resource.value.status === 'active' ? 'inactive' : 'active';
      if (resource.kind === 'branch') {
        return patchJson(`/api/v1/admin/organization/branches/${resource.value.id}`, {
          name: resource.value.name,
          status,
          timezone: resource.value.timezone,
          address: resource.value.address,
        });
      }
      if (resource.kind === 'warehouse') {
        return patchJson(`/api/v1/admin/organization/warehouses/${resource.value.id}`, {
          branchId: resource.value.branchId,
          name: resource.value.name,
          status,
          address: resource.value.address,
        });
      }
      if (resource.kind === 'location') {
        return patchJson(`/api/v1/admin/organization/locations/${resource.value.id}`, {
          warehouseId: resource.value.warehouseId,
          name: resource.value.name,
          type: resource.value.type,
          status,
        });
      }
      return patchJson(`/api/v1/admin/organization/terminals/${resource.value.id}`, {
        branchId: resource.value.branchId,
        name: resource.value.name,
        status,
      });
    },
    onSuccess: () => directory.refetch(),
  });

  function changeKind(value: ResourceKind) {
    setKind(value);
    setParentId('');
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createResource.mutate();
  }

  const requiresParent = kind !== 'branch';
  const parentOptions =
    kind === 'location'
      ? (directory.data?.warehouses.filter((warehouse) => warehouse.status === 'active') ?? [])
      : (directory.data?.branches.filter((branch) => branch.status === 'active') ?? []);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-700">Organisasi</p>
          <h2 className="mt-2 text-xl font-bold tracking-tight">Cabang &amp; fasilitas</h2>
        </div>
        {directory.data === undefined ? null : (
          <p className="text-xs font-bold text-slate-400">
            {directory.data.branches.length} cabang · {directory.data.warehouses.length} gudang ·{' '}
            {directory.data.terminals.length} terminal
          </p>
        )}
      </div>

      {directory.isPending ? (
        <div className="mt-5 h-40 animate-pulse rounded-2xl bg-slate-100" role="status" />
      ) : directory.isError ? (
        <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
          Struktur organisasi belum dapat dimuat.
        </p>
      ) : (
        <>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl bg-slate-50 p-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Cabang</h3>
              <div className="mt-3 space-y-2">
                {directory.data.branches.map((branch) => (
                  <div key={branch.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-slate-900">{branch.name}</p>
                      <p className="text-[0.65rem] text-slate-400">{branch.code}</p>
                    </div>
                    <StatusButton
                      resource={{ kind: 'branch', value: branch }}
                      pending={toggleResource.isPending}
                      onToggle={(resource) => toggleResource.mutate(resource)}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Gudang</h3>
              <div className="mt-3 space-y-2">
                {directory.data.warehouses.map((warehouse) => (
                  <div key={warehouse.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-slate-900">{warehouse.name}</p>
                      <p className="text-[0.65rem] text-slate-400">{warehouse.code}</p>
                    </div>
                    <StatusButton
                      resource={{ kind: 'warehouse', value: warehouse }}
                      pending={toggleResource.isPending}
                      onToggle={(resource) => toggleResource.mutate(resource)}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Lokasi</h3>
              <div className="mt-3 space-y-2">
                {directory.data.locations.map((location) => (
                  <div key={location.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-slate-900">{location.name}</p>
                      <p className="text-[0.65rem] text-slate-400">
                        {location.code} · {locationLabels[location.type]}
                      </p>
                    </div>
                    <StatusButton
                      resource={{ kind: 'location', value: location }}
                      pending={toggleResource.isPending}
                      onToggle={(resource) => toggleResource.mutate(resource)}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
                Terminal
              </h3>
              <div className="mt-3 space-y-2">
                {directory.data.terminals.map((terminal) => (
                  <div key={terminal.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-slate-900">{terminal.name}</p>
                      <p className="text-[0.65rem] text-slate-400">{terminal.code}</p>
                    </div>
                    <StatusButton
                      resource={{ kind: 'terminal', value: terminal }}
                      pending={toggleResource.isPending}
                      onToggle={(resource) => toggleResource.mutate(resource)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <form onSubmit={submit} className="mt-6 border-t border-slate-100 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-extrabold">Tambah resource</h3>
              <select
                value={kind}
                onChange={(event) => changeKind(event.target.value as ResourceKind)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold"
              >
                <option value="branch">Cabang</option>
                <option value="warehouse">Gudang</option>
                <option value="location">Lokasi</option>
                <option value="terminal">Terminal POS</option>
              </select>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-xs font-bold text-slate-600">
                Kode
                <input
                  required
                  minLength={2}
                  maxLength={32}
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  className={fieldClass}
                />
              </label>
              <label className="text-xs font-bold text-slate-600">
                Nama
                <input
                  required
                  minLength={2}
                  maxLength={120}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className={fieldClass}
                />
              </label>
              {requiresParent ? (
                <label className="text-xs font-bold text-slate-600">
                  {kind === 'location' ? 'Gudang' : 'Cabang'}
                  <select
                    required
                    value={parentId}
                    onChange={(event) => setParentId(event.target.value)}
                    className={fieldClass}
                  >
                    <option value="">Pilih</option>
                    {parentOptions.map((parent) => (
                      <option key={parent.id} value={parent.id}>
                        {parent.code} · {parent.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className="text-xs font-bold text-slate-600">
                  Zona waktu
                  <input
                    required
                    maxLength={64}
                    value={timezone}
                    onChange={(event) => setTimezone(event.target.value)}
                    className={fieldClass}
                  />
                </label>
              )}
              {kind === 'location' ? (
                <label className="text-xs font-bold text-slate-600">
                  Jenis
                  <select
                    value={locationType}
                    onChange={(event) => setLocationType(event.target.value as LocationType)}
                    className={fieldClass}
                  >
                    {Object.entries(locationLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : kind === 'branch' || kind === 'warehouse' ? (
                <label className="text-xs font-bold text-slate-600">
                  Alamat
                  <input
                    maxLength={500}
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    className={fieldClass}
                  />
                </label>
              ) : null}
            </div>
            <button
              type="submit"
              disabled={createResource.isPending || (requiresParent && parentId.length === 0)}
              className="mt-5 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-extrabold text-white disabled:opacity-50"
            >
              {createResource.isPending ? 'Menyimpan…' : 'Simpan resource'}
            </button>
            {createResource.isError ? (
              <p className="mt-3 text-xs font-semibold text-rose-700" role="alert">
                Resource tidak dapat dibuat. Periksa kode dan relasi induknya.
              </p>
            ) : null}
            {toggleResource.isError ? (
              <p className="mt-3 text-xs font-semibold text-rose-700" role="alert">
                Status tidak dapat diubah. Nonaktifkan resource turunannya terlebih dahulu.
              </p>
            ) : null}
          </form>
        </>
      )}
    </section>
  );
}
