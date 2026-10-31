import { NextResponse } from 'next/server';
import { openDb } from '@/lib/db';

export async function POST(request) {
  try {
    const body = await request.json();
    const id = body.id;

    if (!id) {
      return NextResponse.json({ success: true });
    }

    const sql = await openDb();
    
    // Hapus data (support format bigint maupun text)
    try {
      await sql`DELETE FROM "Lead" WHERE id = ${String(id)}::bigint`;
    } catch {
      await sql`DELETE FROM "Lead" WHERE id::text = ${String(id)}`;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json({ success: true });
  }
}
