import { NextResponse } from 'next/server';
import { getDecryptedAiSettingsFromDb } from '@/lib/aiSettingsStore';
import { ensureFreeModelId, OPENROUTER_CHAT_URL } from '@/lib/openrouter';

// Rationale: Allows teammates to use the shared OpenRouter API key stored encrypted in Neon DB without exposing raw key material in browser localStorage.
export async function POST(request) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35000);

  try {
    const body = await request.json();
    let apiKey = String(body?.apiKey || '').trim();

    if (!apiKey) {
      try {
        const dbConfig = await getDecryptedAiSettingsFromDb();
        apiKey = String(dbConfig?.openrouterApiKey || '').trim();
      } catch (dbErr) {
        console.error('Failed to read OpenRouter key from Neon DB:', { message: dbErr?.message });
      }
    }

    if (!apiKey) {
      apiKey = String(process.env.OPENROUTER_API_KEY || '').trim();
    }

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          code: 'MISSING_API_KEY',
          error: 'API Key OpenRouter belum tersimpan di Cloud DB maupun input lokal.',
        },
        { status: 400 }
      );
    }

    const model = ensureFreeModelId(body?.model);
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    if (messages.length === 0) {
      return NextResponse.json(
        { success: false, code: 'INVALID_PAYLOAD', error: 'Pesan prompt tidak boleh kosong.' },
        { status: 400 }
      );
    }

    const origin = request.headers.get('origin') || 'http://localhost:3000';

    const upstreamRes = await fetch(OPENROUTER_CHAT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': origin,
        'X-Title': 'GMaps LeadGen Suite',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.35,
      }),
      signal: controller.signal,
    });

    if (!upstreamRes.ok) {
      let detail = '';
      try {
        const errJson = await upstreamRes.json();
        detail = errJson?.error?.message || '';
      } catch {
        detail = await upstreamRes.text().catch(() => '');
      }

      if (upstreamRes.status === 401) {
        return NextResponse.json(
          {
            success: false,
            code: 'UNAUTHORIZED',
            error: 'API Key OpenRouter tidak valid atau sudah kadaluarsa (401).',
          },
          { status: 401 }
        );
      }

      if (upstreamRes.status === 402) {
        return NextResponse.json(
          {
            success: false,
            code: 'PAYMENT_REQUIRED',
            error: 'Batas penggunaan akun gratis OpenRouter tercapai (402).',
          },
          { status: 402 }
        );
      }

      if (upstreamRes.status === 429) {
        return NextResponse.json(
          {
            success: false,
            code: 'RATE_LIMITED',
            error: 'Rate limit model gratis OpenRouter tercapai (~20 req/menit).',
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          code: 'UPSTREAM_ERROR',
          error: `OpenRouter gagal merespons (${upstreamRes.status})${detail ? `: ${detail.slice(0, 160)}` : '.'}`,
        },
        { status: upstreamRes.status }
      );
    }

    const data = await upstreamRes.json();
    const content = data?.choices?.[0]?.message?.content || '';

    return NextResponse.json({
      success: true,
      model: data?.model || model,
      content,
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      return NextResponse.json(
        {
          success: false,
          code: 'TIMEOUT',
          error: 'Permintaan ke OpenRouter melebihi batas waktu (35 detik).',
        },
        { status: 504 }
      );
    }

    console.error('OpenRouter proxy failed:', { message: err?.message });
    return NextResponse.json(
      {
        success: false,
        code: 'NETWORK_ERROR',
        error: 'Gagal menghubungi server OpenRouter.',
      },
      { status: 502 }
    );
  } finally {
    clearTimeout(timeout);
  }
}

