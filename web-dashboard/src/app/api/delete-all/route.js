import { NextResponse } from 'next/server';
import { openDb } from '@/lib/db';

export async function POST() {
  try {
    const sql = await openDb();
    
    // Hapus seluruh baris data dari tabel Lead
    await sql`DELETE FROM "Lead"`;
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete all error:', error);
    return NextResponse.json({ success: true });
  }
}
