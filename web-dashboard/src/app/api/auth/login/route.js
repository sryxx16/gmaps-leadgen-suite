import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { password } = await request.json();
    const correctPassword = process.env.ADMIN_PASSWORD || 'admin123';

    if (password === correctPassword) {
      // Buat response success
      const response = NextResponse.json({ success: true });
      
      // Set cookie login (HttpOnly biar aman dari XSS)
      response.cookies.set({
        name: 'auth',
        value: 'authenticated',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 1 minggu
        path: '/'
      });

      return response;
    }

    return NextResponse.json({ success: false, error: 'Password salah!' }, { status: 401 });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}
