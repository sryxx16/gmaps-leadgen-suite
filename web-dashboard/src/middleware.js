import { NextResponse } from 'next/server';

export function middleware(request) {
  const path = request.nextUrl.pathname;

  // Lindungi halaman dashboard dan import dengan autentikasi
  const isProtectedPath = path === '/' || path.startsWith('/import');

  if (isProtectedPath) {
    const isAuthenticated = request.cookies.has('auth');

    if (!isAuthenticated) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  if (path === '/login' && request.cookies.has('auth')) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
