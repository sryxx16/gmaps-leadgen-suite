import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Inter } from 'next/font/google';
import './globals.css';
import Link from 'next/link';
import { cookies } from 'next/headers';
import LogoutButton from './LogoutButton';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'GMaps LeadGen Dashboard',
  description: 'Kelola data prospek klien dengan mudah',
};

export default function RootLayout({ children }) {
  const cookieStore = cookies();
  const isAuthenticated = cookieStore.has('auth');

  return (
    <html lang="id">
      <body className={inter.className}>
        <nav className="navbar glass">
          <div className="nav-brand">
            <h1>GMaps LeadGen</h1>
          </div>
          <div className="nav-links">
            {isAuthenticated ? (
              <>
                <Link href="/">Dashboard</Link>
                <Link href="/import">Import Data</Link>
                <LogoutButton />
              </>
            ) : (
              <Link href="/login">Login</Link>
            )}
          </div>
        </nav>
        <main className="container">
          {children}
        </main>
      </body>
    </html>
  );
}
