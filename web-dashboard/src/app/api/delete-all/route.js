import { NextResponse } from 'next/server';
import { openDb } from '@/lib/db';

export async function POST() {
  try {
    const sql = await openDb();

    // Hapus seluruh baris data dari tabel Lead
    await sql`DELETE FROM "Lead"`;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Delete all leads failed:', { message: err?.message });
    return NextResponse.json(
      { success: false, error: 'Gagal mengosongkan seluruh data prospek di database.' },
      { status: 500 }
    );
  }
}
