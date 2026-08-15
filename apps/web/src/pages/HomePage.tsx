import { PlatformStatus } from '../components/PlatformStatus';

const capabilities = [
  {
    number: '01',
    title: 'Penjualan yang ringkas',
    description:
      'Alur kasir dirancang untuk pencarian cepat, pemindai barcode, dan pembayaran tanpa distraksi.',
  },
  {
    number: '02',
    title: 'Stok yang dapat ditelusuri',
    description:
      'Setiap pergerakan stok akan dicatat sebagai ledger agar riwayat selalu utuh dan dapat diaudit.',
  },
  {
    number: '03',
    title: 'Satu platform, banyak cabang',
    description:
      'Konteks tenant dan akses cabang ditempatkan di server, bukan dipercayakan kepada browser.',
  },
] as const;

export function HomePage() {
  return (
    <div className="min-h-screen overflow-hidden bg-[#f6f7f3] text-slate-950">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[620px] overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute -right-28 -top-56 size-[590px] rounded-full border-[110px] border-teal-100/60" />
        <div className="absolute left-[42%] top-24 size-2 rounded-full bg-amber-400" />
        <div className="hero-grid absolute inset-0 opacity-50" />
      </div>

      <header className="relative mx-auto flex max-w-7xl items-center justify-between px-6 py-7 lg:px-10">
        <a href="/" className="group inline-flex items-center gap-3" aria-label="Nadi POS, beranda">
          <span className="grid size-9 place-items-center rounded-xl bg-slate-950 text-sm font-black text-white shadow-lg shadow-slate-950/15 transition group-hover:bg-teal-800">
            N
          </span>
          <span className="text-sm font-extrabold tracking-tight">Nadi POS</span>
        </a>
        <div className="flex items-center gap-3">
          <a
            href="/login"
            className="hidden text-xs font-extrabold text-slate-600 transition hover:text-teal-800 sm:inline"
          >
            Masuk
          </a>
          <PlatformStatus />
        </div>
      </header>

      <main className="relative">
        <section className="mx-auto grid min-h-[600px] max-w-7xl items-center gap-12 px-6 pb-20 pt-14 lg:grid-cols-[1.18fr_0.82fr] lg:px-10 lg:pb-28 lg:pt-20">
          <div>
            <p className="mb-7 flex items-center gap-3 text-xs font-extrabold uppercase tracking-[0.22em] text-teal-800">
              <span className="h-px w-8 bg-teal-700" />
              Retail &amp; pharmacy operations
            </p>
            <h1 className="max-w-3xl text-5xl font-semibold leading-[0.98] tracking-[-0.055em] text-slate-950 sm:text-6xl lg:text-[5.4rem]">
              Operasional bisnis,
              <span className="block font-serif font-normal italic text-teal-800">
                dalam satu alur.
              </span>
            </h1>
            <p className="mt-8 max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
              Fondasi POS multi-tenant yang disiapkan untuk kasir, inventori, pembelian, keuangan,
              dan alur khusus apotek—tanpa mengorbankan keamanan data.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <a
                href="#fondasi"
                className="inline-flex items-center gap-3 rounded-xl bg-slate-950 px-5 py-3.5 text-sm font-bold text-white shadow-xl shadow-slate-950/15 transition hover:-translate-y-0.5 hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700"
              >
                Lihat fondasi
                <span aria-hidden="true">↓</span>
              </a>
              <p className="text-xs font-medium leading-5 text-slate-500">
                Dibangun bertahap.
                <br />
                Diuji pada setiap fase.
              </p>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:justify-self-end">
            <div
              className="absolute -inset-5 -rotate-3 rounded-[2rem] border border-teal-200 bg-teal-100/50"
              aria-hidden="true"
            />
            <div className="relative overflow-hidden rounded-[1.75rem] border border-white/80 bg-white p-6 shadow-[0_30px_90px_-45px_rgba(15,23,42,0.45)] sm:p-8">
              <div className="flex items-start justify-between border-b border-slate-100 pb-6">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                    Arsitektur inti
                  </p>
                  <p className="mt-2 text-xl font-bold tracking-tight">Aman sejak fondasi</p>
                </div>
                <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[0.65rem] font-black uppercase tracking-wider text-emerald-700">
                  Phase 0
                </span>
              </div>
              <div className="space-y-5 py-7">
                {[
                  ['Tenant context', 'Server-side'],
                  ['Inventory model', 'Immutable ledger'],
                  ['Batch allocation', 'FEFO / FIFO'],
                  ['API contract', 'Versioned'],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-6">
                    <span className="text-sm text-slate-500">{label}</span>
                    <span className="text-right text-sm font-bold text-slate-900">{value}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-xl bg-slate-950 p-4 text-white">
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-teal-300">
                  Prinsip utama
                </p>
                <p className="mt-2 text-sm font-semibold leading-6">
                  Data tenant tidak pernah ditentukan oleh input klien.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="fondasi" className="border-y border-slate-200/80 bg-white/70">
          <div className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-24">
            <div className="mb-14 max-w-2xl">
              <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-amber-600">
                Dirancang untuk tumbuh
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
                Sederhana di depan. Ketat di belakang.
              </h2>
            </div>
            <div className="grid gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 md:grid-cols-3">
              {capabilities.map((capability) => (
                <article key={capability.number} className="bg-white p-7 sm:p-8">
                  <span className="font-mono text-xs font-bold text-teal-700">
                    {capability.number}
                  </span>
                  <h3 className="mt-8 text-lg font-bold tracking-tight">{capability.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{capability.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-8 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <p>© 2026 Nadi POS</p>
        <p>Fondasi Cloudflare Workers · Hono · React</p>
      </footer>
    </div>
  );
}
