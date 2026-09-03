'use client';
import { useRouter } from 'next/navigation';

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  return (
    <button 
      onClick={handleLogout} 
      className="px-4 py-2 border border-red-900/50 text-red-400 hover:bg-red-950/50 hover:text-red-300 text-sm font-medium rounded-full transition-colors"
    >
      Keluar
    </button>
  );
}
