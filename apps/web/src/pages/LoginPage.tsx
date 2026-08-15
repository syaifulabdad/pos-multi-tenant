import type {
  AccessContextData,
  BranchData,
  LoginData,
  ManagedSessionData,
  SessionListData,
  SessionRevokeData,
  TenantBootstrapData,
} from '@pos/contracts';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { ApiClientError, deleteJson, getJson, postJson } from '../lib/api';

function BrandMark() {
  return (
    <Link to="/" className="inline-flex items-center gap-3" aria-label="Nadi POS, beranda">
      <span className="grid size-9 place-items-center rounded-xl bg-slate-950 text-sm font-black text-white">
        N
      </span>
      <span className="text-sm font-extrabold tracking-tight">Nadi POS</span>
    </Link>
  );
}

function TenantUnavailable({ error }: { readonly error: Error | null }) {
  const requestId = error instanceof ApiClientError ? error.requestId : undefined;

  return (
    <div className="mx-auto max-w-md rounded-3xl border border-amber-200 bg-white p-8 shadow-xl shadow-slate-900/5">
      <span
        className="grid size-11 place-items-center rounded-2xl bg-amber-50 text-xl"
        aria-hidden="true"
      >
        ↗
      </span>
      <h1 className="mt-6 text-2xl font-bold tracking-tight text-slate-950">
        Buka subdomain bisnis Anda
      </h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        Halaman masuk hanya tersedia melalui alamat tenant yang aktif, misalnya{' '}
        <span className="font-semibold text-slate-800">toko-anda.example.test/login</span>.
      </p>
      {requestId === undefined ? null : (
        <p className="mt-5 font-mono text-[0.65rem] text-slate-400">Request ID: {requestId}</p>
      )}
      <Link to="/" className="mt-7 inline-flex text-sm font-bold text-teal-700 hover:text-teal-900">
        ← Kembali ke beranda
      </Link>
    </div>
  );
}

function LoginSuccess({ result }: { readonly result: LoginData }) {
  const access = useQuery({
    queryKey: ['access-context'],
    queryFn: ({ signal }) => getJson<AccessContextData>('/api/v1/access', signal),
    retry: false,
  });
  const branchSwitch = useMutation({
    mutationFn: (branchId: string) => postJson<BranchData>('/api/v1/access/branch', { branchId }),
    onSuccess: () => access.refetch(),
  });
  const sessions = useQuery({
    queryKey: ['managed-sessions'],
    queryFn: ({ signal }) => getJson<SessionListData>('/api/v1/auth/sessions', signal),
    retry: false,
  });
  const sessionRevoke = useMutation({
    mutationFn: (session: ManagedSessionData) =>
      deleteJson<SessionRevokeData>(`/api/v1/auth/sessions/${session.id}`),
    onSuccess: () => sessions.refetch(),
  });
  const canSwitch = access.data?.permissions.includes('branch.switch') ?? false;

  return (
    <div className="rounded-3xl border border-emerald-200 bg-white p-8 shadow-xl shadow-slate-900/5">
      <span
        className="grid size-12 place-items-center rounded-full bg-emerald-100 text-xl text-emerald-700"
        aria-hidden="true"
      >
        ✓
      </span>
      <p className="mt-7 text-xs font-extrabold uppercase tracking-[0.2em] text-emerald-700">
        Sesi aktif
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
        Selamat datang, {result.user.name}
      </h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        Identitas, permission, dan penugasan cabang diverifikasi kembali oleh server pada setiap
        konteks operasional.
      </p>
      <div className="mt-7 rounded-2xl bg-slate-50 p-4">
        <p className="text-xs font-bold text-slate-500">Masuk sebagai</p>
        <p className="mt-1 text-sm font-semibold text-slate-900">{result.user.email}</p>
      </div>

      {access.isPending ? (
        <div className="mt-4 h-20 animate-pulse rounded-2xl bg-slate-100" role="status" />
      ) : access.isError ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          Konteks akses belum dapat dimuat. Coba muat ulang halaman.
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-slate-500">Cabang aktif</p>
              <p className="mt-1 text-sm font-bold text-slate-950">
                {access.data.activeBranch?.name ?? 'Belum dipilih'}
              </p>
            </div>
            <span className="rounded-lg bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-800">
              {access.data.permissions.length} permission
            </span>
          </div>

          {access.data.branches.length > 1 && canSwitch ? (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <label htmlFor="active-branch" className="text-xs font-bold text-slate-600">
                Ganti cabang
              </label>
              <select
                id="active-branch"
                value={access.data.activeBranch?.id ?? ''}
                disabled={branchSwitch.isPending}
                onChange={(event) => branchSwitch.mutate(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10"
              >
                <option value="" disabled>
                  Pilih cabang
                </option>
                {access.data.branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.code} · {branch.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {branchSwitch.isError ? (
            <p className="mt-3 text-xs font-semibold text-rose-700" role="alert">
              Cabang tidak dapat dipilih. Periksa kembali hak akses Anda.
            </p>
          ) : null}
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-slate-500">Perangkat &amp; sesi</p>
          <span className="text-[0.65rem] font-bold text-slate-400">
            {sessions.data?.sessions.length ?? '—'} aktif
          </span>
        </div>
        {sessions.isPending ? (
          <div className="mt-3 h-12 animate-pulse rounded-xl bg-slate-100" role="status" />
        ) : sessions.isError ? (
          <p className="mt-3 text-xs font-semibold text-amber-700">
            Daftar sesi belum dapat dimuat.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {sessions.data.sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-slate-800">
                    {session.current ? 'Perangkat ini' : (session.userAgent ?? 'Perangkat lain')}
                  </p>
                  <p className="mt-0.5 text-[0.65rem] text-slate-400">
                    Aktif {new Date(session.lastSeenAt).toLocaleString('id-ID')}
                  </p>
                </div>
                {session.current ? (
                  <span className="rounded-md bg-emerald-100 px-2 py-1 text-[0.6rem] font-black uppercase text-emerald-700">
                    Saat ini
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={sessionRevoke.isPending}
                    onClick={() => sessionRevoke.mutate(session)}
                    className="shrink-0 text-[0.65rem] font-extrabold text-rose-700 hover:text-rose-900 disabled:opacity-50"
                  >
                    {sessionRevoke.isPending && sessionRevoke.variables?.id === session.id
                      ? 'Mencabut…'
                      : 'Cabut'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {sessionRevoke.isError ? (
          <p className="mt-3 text-xs font-semibold text-rose-700" role="alert">
            Sesi tidak dapat dicabut. Muat ulang lalu coba lagi.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function LoginForm({ tenant }: { readonly tenant: TenantBootstrapData }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const login = useMutation({
    mutationFn: (credentials: { readonly email: string; readonly password: string }) =>
      postJson<LoginData>('/api/v1/auth/login', credentials),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    login.mutate({ email, password });
  }

  if (login.isSuccess) return <LoginSuccess result={login.data} />;

  const requestId = login.error instanceof ApiClientError ? login.error.requestId : undefined;

  return (
    <div className="rounded-3xl border border-white bg-white p-7 shadow-[0_30px_90px_-50px_rgba(15,23,42,0.5)] sm:p-9">
      <div className="mb-8">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-800">
          <span className="size-1.5 rounded-full bg-teal-600" aria-hidden="true" />
          {tenant.name}
        </div>
        <h1 className="text-3xl font-semibold tracking-[-0.035em] text-slate-950">
          Masuk ke ruang kerja
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Gunakan akun yang telah terdaftar pada tenant ini.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-5">
        <div>
          <label htmlFor="email" className="text-sm font-bold text-slate-700">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:bg-white focus:ring-4 focus:ring-teal-600/10"
            placeholder="nama@bisnis.id"
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-sm font-bold text-slate-700">
              Kata sandi
            </label>
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              className="text-xs font-bold text-teal-700 hover:text-teal-900"
            >
              {showPassword ? 'Sembunyikan' : 'Tampilkan'}
            </button>
          </div>
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            minLength={8}
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:bg-white focus:ring-4 focus:ring-teal-600/10"
            placeholder="Minimal 8 karakter"
          />
        </div>

        {login.isError ? (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
            <p className="text-sm font-semibold text-rose-800">
              Email atau kata sandi tidak sesuai.
            </p>
            {requestId === undefined ? null : (
              <p className="mt-1 font-mono text-[0.65rem] text-rose-500">Request ID: {requestId}</p>
            )}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={login.isPending}
          className="flex w-full items-center justify-center rounded-xl bg-slate-950 px-5 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-slate-950/15 transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {login.isPending ? 'Memverifikasi…' : 'Masuk'}
        </button>
      </form>
      <p className="mt-6 text-center text-xs leading-5 text-slate-400">
        Sesi disimpan dalam cookie HTTP-only dan terikat pada host tenant ini.
      </p>
    </div>
  );
}

export function LoginPage() {
  const tenant = useQuery({
    queryKey: ['tenant-bootstrap'],
    queryFn: ({ signal }) => getJson<TenantBootstrapData>('/api/v1/tenant/bootstrap', signal),
    retry: false,
  });

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f6f7f3]">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -right-32 -top-48 size-[520px] rounded-full border-[100px] border-teal-100/70" />
        <div className="hero-grid absolute inset-0 opacity-35" />
      </div>
      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-7">
        <BrandMark />
        <span className="text-xs font-semibold text-slate-500">Akses terenkripsi</span>
      </header>
      <main className="relative mx-auto grid max-w-6xl place-items-center px-6 py-12 sm:py-20">
        <div className="w-full max-w-md">
          {tenant.isPending ? (
            <div
              className="rounded-3xl border border-white bg-white p-9 shadow-xl shadow-slate-900/5"
              role="status"
            >
              <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
              <div className="mt-7 h-8 w-3/4 animate-pulse rounded bg-slate-200" />
              <div className="mt-4 h-4 w-full animate-pulse rounded bg-slate-100" />
              <div className="mt-10 h-12 w-full animate-pulse rounded-xl bg-slate-100" />
            </div>
          ) : tenant.isError ? (
            <TenantUnavailable error={tenant.error} />
          ) : (
            <LoginForm tenant={tenant.data} />
          )}
        </div>
      </main>
    </div>
  );
}
