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
    <div className="login-wrapper">
      <div className="login-box glass">
        <h2>🔒 Area Terbatas</h2>
        <p>Masukkan Master Password untuk mengakses data Lead.</p>
        
        {error && <div className="error-msg">{error}</div>}
        
        <form onSubmit={handleLogin}>
          <div className="input-group">
            <label>Master Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Masukkan password..."
              required
              autoFocus
            />
          </div>
          <button type="submit" className="btn" style={{width: '100%'}} disabled={loading}>
            {loading ? 'Mengecek...' : 'Masuk ke Dashboard'}
          </button>
        </form>
      </div>
    </div>
  );
}
