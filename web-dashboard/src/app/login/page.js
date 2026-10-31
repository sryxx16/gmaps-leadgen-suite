'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!password.trim() || loading) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push('/');
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Password tidak sesuai. Periksa kembali kredensial akses Anda.');
      }
    } catch {
      setError('Gagal menghubungi server autentikasi. Periksa koneksi jaringan Anda.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[#09090b]">
      <div className="w-full max-w-md clean-card rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="space-y-2 text-center">
          <div className="w-11 h-11 rounded-xl bg-zinc-100 text-zinc-950 flex items-center justify-center mx-auto font-bold text-base shadow-sm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            GMaps LeadGen
          </h1>
          <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed">
            Masukkan Master Password untuk mengakses dashboard prospek dan asisten AI.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="bg-rose-950/40 border border-rose-900/70 text-rose-200 px-3.5 py-3 rounded-xl text-xs flex items-center justify-between gap-3"
          >
            <span>{error}</span>
            {password.trim() && (
              <button
                type="button"
                onClick={handleLogin}
                disabled={loading}
                className="shrink-0 px-2.5 py-1 rounded-md bg-rose-900/50 hover:bg-rose-900 text-rose-100 font-medium transition-colors"
              >
                Coba Lagi
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="master-password"
              className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider"
            >
              Master Password
            </label>
            <div className="relative">
              <input
                id="master-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password akses..."
                required
                autoFocus
                className="w-full px-3.5 py-2.5 pr-16 clean-input rounded-xl text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                {showPassword ? 'Sembunyi' : 'Lihat'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !password.trim()}
            className="w-full py-2.5 px-4 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-sm rounded-xl shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin" />
                <span>Memverifikasi...</span>
              </>
            ) : (
              <span>Masuk ke Dashboard</span>
            )}
          </button>
        </form>

        <div className="pt-2 border-t border-zinc-800/80 text-center">
          <p className="text-[11px] text-zinc-500">
            Terhubung ke Neon Serverless Postgres &bull; Proteksi Sesi Aktif
          </p>
        </div>
      </div>
    </div>
  );
}
