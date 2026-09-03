import { NextResponse } from 'next/server';
import { openDb } from '@/lib/db';
import { cookies } from 'next/headers';

export async function POST(request) {
  try {
    const cookieStore = cookies();
    const isAuthenticated = cookieStore.get('auth')?.value === 'true';

    if (!isAuthenticated) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID tidak valid' }, { status: 400 });
    }

    const supabase = await openDb();
    const { data, error } = await supabase
      .from('Lead')
      .delete()
      .eq('id', id)
      .select();

    if (error) {
      throw error;
    }

    if (data && data.length > 0) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false, error: 'Data tidak ditemukan.' }, { status: 404 });
    }
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
