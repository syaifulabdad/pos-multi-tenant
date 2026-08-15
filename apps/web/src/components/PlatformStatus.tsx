import type { HealthData } from '@pos/contracts';
import { useQuery } from '@tanstack/react-query';

import { getJson } from '../lib/api';

function StatusIcon({ state }: { readonly state: 'loading' | 'online' | 'offline' }) {
  if (state === 'loading') {
    return <span className="size-2 animate-pulse rounded-full bg-amber-400" aria-hidden="true" />;
  }

  return (
    <span
      className={`size-2 rounded-full ${state === 'online' ? 'bg-emerald-500' : 'bg-rose-500'}`}
      aria-hidden="true"
    />
  );
}

export function PlatformStatus() {
  const healthQuery = useQuery({
    queryKey: ['platform-health'],
    queryFn: ({ signal }) => getJson<HealthData>('/api/v1/health', signal),
    refetchInterval: 60_000,
  });

  const state = healthQuery.isPending ? 'loading' : healthQuery.isSuccess ? 'online' : 'offline';
  const label =
    state === 'loading'
      ? 'Memeriksa layanan'
      : state === 'online'
        ? 'API & database aktif'
        : 'Layanan belum terhubung';

  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm backdrop-blur"
      role="status"
    >
      <StatusIcon state={state} />
      <span>{label}</span>
    </div>
  );
}
