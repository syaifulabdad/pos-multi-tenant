import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-6 text-center">
      <div>
        <p className="text-sm font-bold tracking-[0.2em] text-teal-700">404</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          Halaman tidak ditemukan
        </h1>
        <p className="mt-3 text-slate-600">Alamat yang Anda buka tidak tersedia.</p>
        <Link
          to="/"
          className="mt-8 inline-flex rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700"
        >
          Kembali ke beranda
        </Link>
      </div>
    </main>
  );
}
