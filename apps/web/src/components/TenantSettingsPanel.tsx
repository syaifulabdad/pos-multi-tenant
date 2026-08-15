import type { TenantBootstrapData, TenantSettingsData } from '@pos/contracts';
import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';

import { patchJson } from '../lib/api';

const fieldClass =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10';

export function TenantSettingsPanel({ tenant }: { readonly tenant: TenantBootstrapData }) {
  const [name, setName] = useState(tenant.name);
  const [businessType, setBusinessType] = useState(tenant.businessType);
  const [uiMode, setUiMode] = useState(tenant.uiMode);
  const [timezone, setTimezone] = useState(tenant.timezone);
  const update = useMutation({
    mutationFn: () =>
      patchJson<TenantSettingsData>('/api/v1/admin/tenant', {
        name,
        businessType,
        uiMode,
        timezone,
      }),
    onSuccess: (settings) => {
      setName(settings.name);
      setBusinessType(settings.businessType);
      setUiMode(settings.uiMode);
      setTimezone(settings.timezone);
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    update.mutate();
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-700">Tenant</p>
          <h2 className="mt-2 text-xl font-bold tracking-tight">Profil ruang kerja</h2>
        </div>
        <div className="text-right text-[0.65rem] font-bold text-slate-400">
          <p>{tenant.slug}</p>
          <p>{tenant.plan}</p>
        </div>
      </div>

      <form onSubmit={submit} className="mt-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-slate-600 sm:col-span-2">
            Nama bisnis
            <input
              required
              minLength={2}
              maxLength={160}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Jenis bisnis
            <select
              value={businessType}
              onChange={(event) =>
                setBusinessType(event.target.value as 'retail' | 'pharmacy' | 'retail_pharmacy')
              }
              className={fieldClass}
            >
              <option value="retail">Retail</option>
              <option value="pharmacy">Apotek</option>
              <option value="retail_pharmacy">Retail &amp; apotek</option>
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">
            Mode antarmuka
            <select
              value={uiMode}
              onChange={(event) =>
                setUiMode(event.target.value as 'simple' | 'professional' | 'advanced')
              }
              className={fieldClass}
            >
              <option value="simple">Sederhana</option>
              <option value="professional">Profesional</option>
              <option value="advanced">Lanjutan</option>
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600 sm:col-span-2">
            Zona waktu IANA
            <input
              required
              maxLength={64}
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              className={fieldClass}
              placeholder="Asia/Jakarta"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={update.isPending}
          className="mt-5 w-full rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-extrabold text-white disabled:opacity-50 sm:w-auto"
        >
          {update.isPending ? 'Menyimpan…' : 'Simpan pengaturan'}
        </button>
        {update.isSuccess ? (
          <p className="mt-3 text-xs font-semibold text-emerald-700" role="status">
            Pengaturan tenant tersimpan.
          </p>
        ) : null}
        {update.isError ? (
          <p className="mt-3 text-xs font-semibold text-rose-700" role="alert">
            Pengaturan tidak dapat disimpan. Periksa nama dan zona waktu.
          </p>
        ) : null}
      </form>
    </section>
  );
}
