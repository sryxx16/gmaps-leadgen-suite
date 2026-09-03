import { NextResponse } from 'next/server';
import { openDb } from '@/lib/db';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    const cookieStore = cookies();
    const isAuthenticated = cookieStore.get('auth')?.value === 'true';

    if (!isAuthenticated) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await openDb();
    
    // Hapus semua data dari tabel Lead
    const { error } = await supabase
      .from('Lead')
      .delete()
      .neq('id', 0); // Trik Supabase untuk delete all
      
    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete all error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
