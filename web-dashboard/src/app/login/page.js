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
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      
      const data = await res.json();
      if (res.ok && data.success) {
        router.push('/');
        router.refresh();
      } else {
        setError(data.error || 'Login gagal.');
      }
    } catch (err) {
      setError('Error server atau jaringan.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper relative overflow-hidden">
      {/* Animated Background Blobs */}
      <div className="blob blob-1"></div>
      <div className="blob blob-2"></div>
      <div className="blob blob-3"></div>

      <div className="login-box glass-card">
        <div className="icon-container">
          <span className="lock-icon">🔒</span>
        </div>
        <h2>Area Terbatas</h2>
        <p>Masukkan Master Password untuk mengakses data Lead.</p>
        
        {error && <div className="error-msg">{error}</div>}
        
        <form onSubmit={handleLogin}>
          <div className="input-group">
            <label>Master Password</label>
            <div className="input-wrapper">
              <span className="input-icon">🔑</span>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ketik password di sini..."
                required
                autoFocus
              />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? (
              <span className="spinner">Memeriksa...</span>
            ) : (
              'Masuk ke Dashboard ➔'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
