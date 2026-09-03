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
      style={{
        background: 'transparent',
        border: '1px solid rgba(239, 68, 68, 0.5)',
        color: '#fca5a5',
        padding: '0.4rem 1rem',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '0.875rem'
      }}
    >
      Keluar
    </button>
  );
}
