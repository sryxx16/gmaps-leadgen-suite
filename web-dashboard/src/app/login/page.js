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
      const res = await fetch('/api/login', {
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
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 rounded-2xl shadow-xl border border-slate-800 p-8">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl shadow-inner">
            🔒
          </div>
        </div>
        
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-slate-100 mb-2">Area Terbatas</h2>
          <p className="text-slate-400 text-sm">Masukkan Master Password untuk mengakses data Lead.</p>
        </div>
        
        {error && (
          <div className="bg-red-950/50 border border-red-900/50 text-red-400 p-3 rounded-lg text-sm mb-6 text-center">
            {error}
          </div>
        )}
        
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Master Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                🔑
              </div>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ketik password di sini..."
                required
                autoFocus
                className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
              />
            </div>
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3 px-4 bg-slate-100 hover:bg-white text-slate-900 font-semibold rounded-xl shadow-sm transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
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
