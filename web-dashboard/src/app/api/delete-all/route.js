import { NextResponse } from 'next/server';
import { openDb } from '@/lib/db';

export async function POST() {
  try {
    const db = await openDb();
    
    // Hapus semua data dari tabel Lead
    await db.execute('DELETE FROM Lead');
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete All error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
