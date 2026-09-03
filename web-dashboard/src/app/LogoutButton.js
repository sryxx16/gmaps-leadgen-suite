'use client';

import { useRouter } from 'next/navigation';

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    if (!confirm('Yakin mau keluar dari sistem?')) return;
    
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  return (
    <button 
      onClick={handleLogout} 
      className="btn btn-danger"
      style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
    >
      Keluar
    </button>
  );
}
