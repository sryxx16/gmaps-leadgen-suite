import { NextResponse } from 'next/server';
import { openDb } from '@/lib/db';

export async function POST(request) {
  try {
    const body = await request.json();
    const rawId = body?.id;

    if (rawId === undefined || rawId === null || String(rawId).trim() === '') {
      return NextResponse.json(
        { success: false, error: 'ID prospek tidak valid.' },
        { status: 400 }
      );
    }

    const id = String(rawId).trim();
    const sql = await openDb();

    // Hapus data (support format bigint maupun text)
    if (/^\d+$/.test(id)) {
      await sql`DELETE FROM "Lead" WHERE id = ${id}::bigint`;
    } else {
      await sql`DELETE FROM "Lead" WHERE id::text = ${id}`;
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Delete lead failed:', { message: err?.message });
    return NextResponse.json(
      { success: false, error: 'Gagal menghapus prospek dari database.' },
      { status: 500 }
    );
  }
}
