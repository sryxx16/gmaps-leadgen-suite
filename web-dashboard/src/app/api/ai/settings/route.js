import { NextResponse } from 'next/server';
import {
  getPublicAiSettingsFromDb,
  saveAiSettingsToDb,
} from '@/lib/aiSettingsStore';

export async function GET() {
  try {
    const settings = await getPublicAiSettingsFromDb();
    if (!settings) {
      return NextResponse.json(
        { success: false, error: 'Gagal memuat pengaturan AI dari database Neon.' },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true, settings });
  } catch (err) {
    console.error('GET /api/ai/settings error:', { message: err?.message });
    return NextResponse.json(
      { success: false, error: 'Gagal memuat pengaturan AI dari database Neon.' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const saved = await saveAiSettingsToDb(body || {});
    return NextResponse.json({ success: true, settings: saved });
  } catch (err) {
    console.error('POST /api/ai/settings error:', { message: err?.message });
    return NextResponse.json(
      {
        success: false,
        error: 'Gagal menyimpan pengaturan AI ke database Neon. Coba beberapa saat lagi.',
      },
      { status: 500 }
    );
  }
}

