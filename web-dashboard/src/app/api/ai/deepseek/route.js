import { NextResponse } from 'next/server';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const ALLOWED_DEEPSEEK_MODELS = new Set(['deepseek-chat', 'deepseek-reasoner']);

// Rationale: Proxies DeepSeek requests server-side because api.deepseek.com blocks browser CORS preflight.
export async function POST(request) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    const body = await request.json();
    const apiKey = String(body?.apiKey || process.env.DEEPSEEK_API_KEY || '').trim();

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          code: 'MISSING_API_KEY',
          error: 'API Key DeepSeek belum diisi.',
        },
        { status: 400 }
      );
    }

    const requestedModel = String(body?.model || 'deepseek-chat').trim();
    const model = ALLOWED_DEEPSEEK_MODELS.has(requestedModel)
      ? requestedModel
      : 'deepseek-chat';

    const messages = Array.isArray(body?.messages) ? body.messages : [];
    if (messages.length === 0) {
      return NextResponse.json(
        { success: false, code: 'INVALID_PAYLOAD', error: 'Pesan prompt tidak boleh kosong.' },
        { status: 400 }
      );
    }

    const upstreamBody = {
      model,
      messages,
      stream: false,
      max_tokens: model === 'deepseek-reasoner' ? 2500 : 1200,
    };

    // deepseek-chat supports strict json_object output and temperature; deepseek-reasoner omits them per DeepSeek spec.
    if (model === 'deepseek-chat') {
      upstreamBody.response_format = { type: 'json_object' };
      upstreamBody.temperature = 0.3;
    }

    const upstreamRes = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(upstreamBody),
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
            error: 'API Key DeepSeek tidak valid atau sudah dicabut (401).',
          },
          { status: 401 }
        );
      }

      if (upstreamRes.status === 402) {
        return NextResponse.json(
          {
            success: false,
            code: 'INSUFFICIENT_BALANCE',
            error: 'Saldo akun DeepSeek tidak mencukupi (402). Isi saldo atau gunakan fallback OpenRouter Free.',
          },
          { status: 402 }
        );
      }

      if (upstreamRes.status === 429) {
        return NextResponse.json(
          {
            success: false,
            code: 'RATE_LIMITED',
            error: 'Rate limit DeepSeek tercapai (429). Tunggu beberapa saat.',
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          code: 'UPSTREAM_ERROR',
          error: `DeepSeek gagal merespons (${upstreamRes.status})${detail ? `: ${detail.slice(0, 160)}` : '.'}`,
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
          error: 'Permintaan ke server DeepSeek melebihi batas waktu (45 detik).',
        },
        { status: 504 }
      );
    }

    console.error('DeepSeek proxy failed:', { message: err?.message });
    return NextResponse.json(
      {
        success: false,
        code: 'NETWORK_ERROR',
        error: 'Gagal menghubungi server DeepSeek.',
      },
      { status: 502 }
    );
  } finally {
    clearTimeout(timeout);
  }
}

