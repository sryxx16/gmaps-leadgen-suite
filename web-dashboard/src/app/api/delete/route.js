import { NextResponse } from 'next/server';
import { openDb } from '@/lib/db';

export async function POST(request) {
  try {
    const { id } = await request.json();
    
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID tidak diberikan.' }, { status: 400 });
    }

    const db = await openDb();
    const result = await db.execute('DELETE FROM Lead WHERE id = ?', [id]);

    if (result.rowsAffected > 0) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false, error: 'Data tidak ditemukan.' }, { status: 404 });
    }
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
