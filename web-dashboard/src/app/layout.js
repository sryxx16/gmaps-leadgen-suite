import { cookies } from 'next/headers';
import Link from 'next/link';
import LogoutButton from './LogoutButton';
import './globals.css';

export const metadata = {
  title: 'GMaps LeadGen Dashboard',
  description: 'Dashboard untuk mengelola data prospek Google Maps',
};

export default async function RootLayout({ children }) {
  const cookieStore = await cookies();
  const isAuthenticated = cookieStore.has('auth');

  return (
    <html lang="id">
      <body className="bg-slate-950 text-slate-100 min-h-screen font-sans antialiased">
        {isAuthenticated && (
          <nav className="max-w-4xl mx-auto my-6 px-6 py-4 bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-full flex justify-between items-center shadow-lg">
            <div className="flex items-center gap-6">
              <h1 className="text-xl font-bold text-white tracking-tight">
                GMaps LeadGen
              </h1>
              <div className="flex gap-4">
                <Link href="/" className="text-slate-400 hover:text-slate-100 text-sm font-medium transition-colors">
                  Dashboard
                </Link>
                <Link href="/import" className="text-slate-400 hover:text-slate-100 text-sm font-medium transition-colors">
                  Import Data
                </Link>
              </div>
            </div>
            <LogoutButton />
          </nav>
        )}
        <main>{children}</main>
      </body>
    </html>
  );
}
