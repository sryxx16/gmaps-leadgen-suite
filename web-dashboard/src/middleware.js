import { NextResponse } from 'next/server';

export function middleware(request) {
  // Ambil path URL yang sedang diakses
  const path = request.nextUrl.pathname;

  // Cek apakah halaman yang dituju butuh login (semua kecuali /login, dan /api/auth)
  const isProtectedPath = path === '/' || path.startsWith('/import') || path.startsWith('/api/') && !path.startsWith('/api/auth');

  if (isProtectedPath) {
    // Cek keberadaan cookie 'auth'
    const isAuthenticated = request.cookies.has('auth');

    if (!isAuthenticated) {
      // Kalau belum login, tapi akses API yang diproteksi, kasih error 401
      if (path.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      
      // Kalau belum login buka halaman biasa, lempar ke halaman /login
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Kalau halaman /login tapi udah punya cookie auth, lempar balik ke Dashboard
  if (path === '/login' && request.cookies.has('auth')) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

// Konfigurasi path mana aja yang di-handle sama middleware ini
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
