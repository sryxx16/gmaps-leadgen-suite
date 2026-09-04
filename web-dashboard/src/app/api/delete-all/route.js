import { NextResponse } from 'next/server';
import { openDb } from '@/lib/db';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const isAuthenticated = cookieStore.has('auth');

    if (!isAuthenticated) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const sql = await openDb();
    
    // Hapus semua data dari tabel Lead
    await sql`DELETE FROM "Lead"`;
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete all error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
