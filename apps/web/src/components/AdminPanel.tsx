import type {
  AdminRoleSummaryData,
  AdminUserData,
  RoleDirectoryData,
  SecurityEventListData,
  UserDirectoryData,
} from '@pos/contracts';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';

import { getJson, patchJson, postJson } from '../lib/api';

interface AdminPanelProperties {
  readonly permissions: readonly string[];
  readonly currentUserId: string;
}

const fieldClass =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10';

function ErrorNotice({ message }: { readonly message: string }) {
  return (
    <p
      className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"
      role="alert"
    >
      {message}
    </p>
  );
}

function UsersPanel({ currentUserId }: { readonly currentUserId: string }) {
  const directory = useQuery({
    queryKey: ['admin-users'],
    queryFn: ({ signal }) => getJson<UserDirectoryData>('/api/v1/admin/users', signal),
    retry: false,
  });
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [branchIds, setBranchIds] = useState<string[]>([]);
  const createUser = useMutation({
    mutationFn: () =>
      postJson<{ readonly user: AdminUserData }>('/api/v1/admin/users', {
        email,
        name,
        password,
        roleIds,
        branchIds,
      }),
    onSuccess: async () => {
      setEmail('');
      setName('');
      setPassword('');
      setRoleIds([]);
      setBranchIds([]);
      await directory.refetch();
    },
  });
  const updateUser = useMutation({
    mutationFn: (user: AdminUserData) =>
      patchJson<{ readonly user: AdminUserData }>(`/api/v1/admin/users/${user.id}`, {
        name: user.name,
        status: user.status === 'active' ? 'disabled' : 'active',
        roleIds: user.roles.map((role) => role.id),
        branchIds: user.branches.map((branch) => branch.id),
      }),
    onSuccess: () => directory.refetch(),
  });

  function toggle(current: string[], value: string, selected: boolean): string[] {
    return selected ? [...current, value] : current.filter((entry) => entry !== value);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createUser.mutate();
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-700">Pengguna</p>
          <h2 className="mt-2 text-xl font-bold tracking-tight">Akses tim</h2>
        </div>
        <span className="text-xs font-bold text-slate-400">
          {directory.data?.users.length ?? '—'} akun
        </span>
      </div>

      {directory.isPending ? (
        <div className="mt-5 h-24 animate-pulse rounded-2xl bg-slate-100" role="status" />
      ) : directory.isError ? (
        <ErrorNotice message="Daftar pengguna belum dapat dimuat." />
      ) : (
        <>
          <div className="mt-5 space-y-2">
            {directory.data.users.map((user) => (
              <div
                key={user.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">{user.name}</p>
                  <p className="truncate text-xs text-slate-500">{user.email}</p>
                  <p className="mt-1 text-[0.65rem] font-semibold text-slate-400">
                    {user.roles.map((role) => role.name).join(', ')} ·{' '}
                    {user.branches.map((branch) => branch.code).join(', ')}
                  </p>
                </div>
                {user.id === currentUserId ? (
                  <span className="text-[0.65rem] font-black uppercase text-teal-700">Anda</span>
                ) : (
                  <button
                    type="button"
                    disabled={updateUser.isPending}
                    onClick={() => updateUser.mutate(user)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-extrabold disabled:opacity-50 ${
                      user.status === 'active'
                        ? 'bg-rose-50 text-rose-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {user.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                )}
              </div>
            ))}
          </div>

          <form onSubmit={submit} className="mt-6 border-t border-slate-100 pt-5">
            <h3 className="text-sm font-extrabold">Tambah pengguna</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
              <label className="text-xs font-bold text-slate-600">
                Email
                <input
                  required
                  type="email"
                  maxLength={254}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={fieldClass}
                />
              </label>
            </div>
            <label className="mt-3 block text-xs font-bold text-slate-600">
              Kata sandi awal
              <input
                required
                type="password"
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={fieldClass}
              />
            </label>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <fieldset>
                <legend className="text-xs font-extrabold text-slate-700">Role</legend>
                <div className="mt-2 space-y-1.5">
                  {directory.data.roles
                    .filter((role) => role.isActive)
                    .map((role) => (
                      <label
                        key={role.id}
                        className="flex items-center gap-2 text-xs text-slate-600"
                      >
                        <input
                          type="checkbox"
                          checked={roleIds.includes(role.id)}
                          onChange={(event) =>
                            setRoleIds((current) => toggle(current, role.id, event.target.checked))
                          }
                        />
                        {role.name}
                      </label>
                    ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-xs font-extrabold text-slate-700">Cabang</legend>
                <div className="mt-2 space-y-1.5">
                  {directory.data.branches.map((branch) => (
                    <label
                      key={branch.id}
                      className="flex items-center gap-2 text-xs text-slate-600"
                    >
                      <input
                        type="checkbox"
                        checked={branchIds.includes(branch.id)}
                        onChange={(event) =>
                          setBranchIds((current) =>
                            toggle(current, branch.id, event.target.checked),
                          )
                        }
                      />
                      {branch.code} · {branch.name}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
            <button
              type="submit"
              disabled={createUser.isPending || roleIds.length === 0 || branchIds.length === 0}
              className="mt-5 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-extrabold text-white disabled:opacity-50"
            >
              {createUser.isPending ? 'Menyimpan…' : 'Buat pengguna'}
            </button>
            {createUser.isError ? <ErrorNotice message="Pengguna tidak dapat dibuat." /> : null}
            {updateUser.isError ? (
              <ErrorNotice message="Status pengguna tidak dapat diubah." />
            ) : null}
          </form>
        </>
      )}
    </section>
  );
}

function RolesPanel() {
  const directory = useQuery({
    queryKey: ['admin-roles'],
    queryFn: ({ signal }) => getJson<RoleDirectoryData>('/api/v1/admin/roles', signal),
    retry: false,
  });
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [permissionCodes, setPermissionCodes] = useState<string[]>([]);
  const createRole = useMutation({
    mutationFn: () =>
      postJson<{ readonly role: AdminRoleSummaryData }>('/api/v1/admin/roles', {
        code,
        name,
        description: null,
        permissionCodes,
      }),
    onSuccess: async () => {
      setCode('');
      setName('');
      setPermissionCodes([]);
      await directory.refetch();
    },
  });
  const updateRole = useMutation({
    mutationFn: (role: AdminRoleSummaryData) =>
      patchJson<{ readonly role: AdminRoleSummaryData }>(`/api/v1/admin/roles/${role.id}`, {
        name: role.name,
        description: role.description,
        isActive: !role.isActive,
        permissionCodes: role.permissions,
      }),
    onSuccess: () => directory.refetch(),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createRole.mutate();
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-700">Role</p>
      <h2 className="mt-2 text-xl font-bold tracking-tight">Permission set</h2>
      {directory.isPending ? (
        <div className="mt-5 h-24 animate-pulse rounded-2xl bg-slate-100" role="status" />
      ) : directory.isError ? (
        <ErrorNotice message="Daftar role belum dapat dimuat." />
      ) : (
        <>
          <div className="mt-5 flex flex-wrap gap-2">
            {directory.data.roles.map((role) => (
              <button
                type="button"
                key={role.id}
                disabled={updateRole.isPending || role.isSystem}
                onClick={() => updateRole.mutate(role)}
                title={role.isSystem ? 'Role sistem dilindungi' : 'Klik untuk mengubah status'}
                className={`rounded-xl border px-3 py-2 text-left disabled:cursor-not-allowed ${
                  role.isActive
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-slate-200 bg-slate-50 text-slate-500'
                }`}
              >
                <span className="block text-xs font-extrabold">{role.name}</span>
                <span className="mt-0.5 block text-[0.6rem]">
                  {role.permissions.length} permission
                </span>
              </button>
            ))}
          </div>
          <form onSubmit={submit} className="mt-6 border-t border-slate-100 pt-5">
            <h3 className="text-sm font-extrabold">Role baru</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold text-slate-600">
                Kode
                <input
                  required
                  minLength={2}
                  maxLength={50}
                  pattern="[a-z][a-z0-9_-]+"
                  value={code}
                  onChange={(event) => setCode(event.target.value.toLowerCase())}
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
            </div>
            <fieldset className="mt-4">
              <legend className="text-xs font-extrabold text-slate-700">Permission</legend>
              <div className="mt-2 grid max-h-48 gap-1.5 overflow-auto rounded-xl bg-slate-50 p-3 sm:grid-cols-2">
                {directory.data.permissions.map((permission) => (
                  <label
                    key={permission.code}
                    className="flex items-start gap-2 text-[0.7rem] text-slate-600"
                  >
                    <input
                      className="mt-0.5"
                      type="checkbox"
                      checked={permissionCodes.includes(permission.code)}
                      onChange={(event) =>
                        setPermissionCodes((current) =>
                          event.target.checked
                            ? [...current, permission.code]
                            : current.filter((codeValue) => codeValue !== permission.code),
                        )
                      }
                    />
                    <span>
                      <strong className="block text-slate-800">{permission.code}</strong>
                      {permission.description}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <button
              type="submit"
              disabled={createRole.isPending || permissionCodes.length === 0}
              className="mt-5 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-extrabold text-white disabled:opacity-50"
            >
              {createRole.isPending ? 'Menyimpan…' : 'Buat role'}
            </button>
            {createRole.isError ? <ErrorNotice message="Role tidak dapat dibuat." /> : null}
            {updateRole.isError ? <ErrorNotice message="Status role tidak dapat diubah." /> : null}
          </form>
        </>
      )}
    </section>
  );
}

function SecurityEventsPanel() {
  const events = useQuery({
    queryKey: ['admin-security-events'],
    queryFn: ({ signal }) =>
      getJson<SecurityEventListData>('/api/v1/admin/security-events?limit=30', signal),
    retry: false,
  });

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-700">Keamanan</p>
          <h2 className="mt-2 text-xl font-bold tracking-tight">Peristiwa terbaru</h2>
        </div>
        <button
          type="button"
          onClick={() => events.refetch()}
          className="text-xs font-extrabold text-teal-700"
        >
          Muat ulang
        </button>
      </div>
      {events.isPending ? (
        <div className="mt-5 h-24 animate-pulse rounded-2xl bg-slate-100" role="status" />
      ) : events.isError ? (
        <ErrorNotice message="Peristiwa keamanan belum dapat dimuat." />
      ) : events.data.events.length === 0 ? (
        <p className="mt-5 text-sm text-slate-500">Belum ada peristiwa keamanan.</p>
      ) : (
        <div className="mt-5 max-h-96 space-y-2 overflow-auto">
          {events.data.events.map((event) => (
            <div key={event.requestId} className="rounded-2xl bg-slate-50 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-extrabold text-slate-900">{event.type}</p>
                <span className="rounded-md bg-amber-100 px-2 py-1 text-[0.6rem] font-black uppercase text-amber-800">
                  {event.severity}
                </span>
              </div>
              <p className="mt-1 text-[0.65rem] text-slate-500">
                {event.user?.email ?? 'Sistem'} ·{' '}
                {new Date(event.createdAt).toLocaleString('id-ID')}
              </p>
              <p className="mt-1 truncate font-mono text-[0.6rem] text-slate-400">
                {event.requestId}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function AdminPanel({ permissions, currentUserId }: AdminPanelProperties) {
  const canManageUsers = permissions.includes('user.manage');
  const canManageRoles = permissions.includes('role.manage');
  const canViewSecurity = permissions.includes('settings.manage');
  if (!canManageUsers && !canManageRoles && !canViewSecurity) return null;

  return (
    <div className="mt-8 grid items-start gap-5 lg:grid-cols-2">
      {canManageUsers ? <UsersPanel currentUserId={currentUserId} /> : null}
      {canManageRoles ? <RolesPanel /> : null}
      {canViewSecurity ? <SecurityEventsPanel /> : null}
    </div>
  );
}
