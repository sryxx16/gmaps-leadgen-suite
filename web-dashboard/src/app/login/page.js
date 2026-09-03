'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
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
        const data = await res.json();
        setError(data.error || 'Password salah');
      }
    } catch (err) {
      setError('Terjadi kesalahan sistem');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 via-slate-950 to-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-700/50 p-10">

        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-slate-100 mb-2">Login Dashboard</h2>
          <p className="text-slate-400 text-sm">Masukkan Master Password untuk mengakses data Lead.</p>
        </div>

        {error && (
          <div className="bg-red-950/50 border border-red-900/50 text-red-400 p-3 rounded-lg text-sm mb-6 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Master Password</label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ketik password di sini..."
                required
                autoFocus
                className="w-full px-4 py-3.5 bg-slate-950/50 border border-slate-700/50 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all shadow-inner"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-slate-100 hover:bg-white text-slate-900 font-semibold rounded-xl shadow-sm transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {loading ? (
              <span className="animate-pulse">Memeriksa...</span>
            ) : (
              'Masuk ke Dashboard →'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
