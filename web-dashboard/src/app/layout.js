import { cookies } from 'next/headers';
import Link from 'next/link';
import LogoutButton from './LogoutButton';
import './globals.css';

export const metadata = {
  title: 'GMaps LeadGen — Dashboard Prospek Google Maps',
  description: 'Dashboard kelola data prospek Google Maps terintegrasi AI dan ekstensi scraper',
};

export default async function RootLayout({ children }) {
  const cookieStore = await cookies();
  const isAuthenticated = cookieStore.has('auth');

  return (
    <html lang="id">
      <body className="min-h-screen bg-[#09090b] text-zinc-100 font-sans antialiased">
        {isAuthenticated && (
          <header className="w-full border-b border-zinc-800/80 bg-[#0c0c0e]/90 backdrop-blur-md sticky top-0 z-40">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
              {/* Brand Logo & Cloud Status */}
              <div className="flex items-center gap-4 sm:gap-6">
                <Link href="/" className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-white font-bold text-xs">
                    G
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold tracking-tight text-white">
                      GMaps LeadGen
                    </span>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400 border border-zinc-700">
                      Cloud
                    </span>
                  </div>
                </Link>

                {/* Nav Links */}
                <nav className="flex items-center gap-1 border-l border-zinc-800 pl-3 sm:pl-4">
                  <Link 
                    href="/" 
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-white bg-zinc-800/80 transition-colors"
                  >
                    Dashboard
                  </Link>
                  <Link 
                    href="/import" 
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 transition-colors"
                  >
                    Import JSON
                  </Link>
                </nav>
              </div>

              {/* Actions Right */}
              <div className="flex items-center gap-2.5">
                <a
                  href="/gmaps-leadgen-extension.zip"
                  download="gmaps-leadgen-extension.zip"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors"
                  title="Download file zip ekstensi untuk teman"
                >
                  <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span className="hidden sm:inline">Ekstensi Chrome</span>
                  <span className="sm:hidden">Ekstensi</span>
                </a>

                <LogoutButton />
              </div>
            </div>
          </header>
        )}
        <main>{children}</main>
      </body>
    </html>
  );
}
