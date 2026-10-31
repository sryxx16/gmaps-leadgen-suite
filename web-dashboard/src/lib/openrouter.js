// Rationale: Unified multi-provider AI client (DeepSeek primary + OpenRouter Free fallback) with shared Neon DB key support, grounded lead analysis prompting, and deterministic anti-AI-slop text humanizer.

import { classifyWebsiteUrl } from './leadQualification.js';

export const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';
export const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
export const DEEPSEEK_PROXY_URL = '/api/ai/deepseek';
export const OPENROUTER_PROXY_URL = '/api/ai/openrouter';

export const DEFAULT_OPENROUTER_MODEL = 'openrouter/free';
export const DEFAULT_DEEPSEEK_MODEL = 'deepseek-chat';

export const AI_SETTINGS_STORAGE_KEY = 'gmaps_leadgen_ai_settings_v2';
const LEGACY_OPENROUTER_STORAGE_KEY = 'gmaps_leadgen_openrouter_v1';

export const DEEPSEEK_MODELS = [
  {
    id: 'deepseek-chat',
    name: 'DeepSeek V3 (deepseek-chat: Cepat & JSON Stabil)',
  },
  {
    id: 'deepseek-reasoner',
    name: 'DeepSeek R1 (deepseek-reasoner: Deep Thinking)',
  },
];

export const FALLBACK_FREE_MODELS = [
  {
    id: 'openrouter/free',
    name: 'OpenRouter Free Auto-Router (Direkomendasikan)',
    contextLength: 128000,
  },
  {
    id: 'google/gemma-3-27b-it:free',
    name: 'Google: Gemma 3 27B IT (Free)',
    contextLength: 131072,
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct:free',
    name: 'Meta: Llama 3.3 70B Instruct (Free)',
    contextLength: 128000,
  },
  {
    id: 'deepseek/deepseek-chat-v3-0324:free',
    name: 'DeepSeek: Chat V3 via OpenRouter (Free)',
    contextLength: 128000,
  },
  {
    id: 'qwen/qwen3-32b:free',
    name: 'Qwen: Qwen3 32B (Free)',
    contextLength: 40960,
  },
];

export const DEFAULT_AI_SETTINGS = {
  primaryProvider: 'deepseek', // 'deepseek' | 'openrouter'
  autoFallback: true,
  deepseekApiKey: '',
  deepseekModel: DEFAULT_DEEPSEEK_MODEL,
  openrouterApiKey: '',
  openrouterModel: DEFAULT_OPENROUTER_MODEL,
  agencyName: 'Tim Web Developer',
  serviceFocus: 'Pembuatan Website Katalog, Company Profile & Landing Page SEO Lokal',
  pitchTone: 'casual', // 'casual' | 'formal' | 'consultative'
  cloudDeepseekReady: false,
  cloudDeepseekMask: '',
  cloudOpenrouterReady: false,
  cloudOpenrouterMask: '',
};

export class OpenRouterClientError extends Error {
  constructor(
    message,
    { code = 'AI_CLIENT_ERROR', status = 0, retryable = false, provider = '' } = {}
  ) {
    super(message);
    this.name = 'OpenRouterClientError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.provider = provider;
  }
}

export function isDeepSeekConfigured(settings = {}) {
  return Boolean(String(settings.deepseekApiKey || '').trim() || settings.cloudDeepseekReady);
}

export function isOpenRouterConfigured(settings = {}) {
  return Boolean(String(settings.openrouterApiKey || '').trim() || settings.cloudOpenrouterReady);
}

export function isAnyAiConfigured(settings = {}) {
  return isDeepSeekConfigured(settings) || isOpenRouterConfigured(settings);
}

export function isZeroCostModel(model) {
  if (!model || typeof model.id !== 'string') return false;
  const id = model.id.trim();
  if (id === DEFAULT_OPENROUTER_MODEL) return true;
  if (!id.endsWith(':free')) return false;

  const promptCost = Number(model.pricing?.prompt ?? NaN);
  const completionCost = Number(model.pricing?.completion ?? NaN);
  const requestCost = Number(model.pricing?.request ?? 0);

  return promptCost === 0 && completionCost === 0 && requestCost === 0;
}

export function ensureFreeModelId(modelId) {
  const clean = typeof modelId === 'string' ? modelId.trim() : '';
  if (clean === DEFAULT_OPENROUTER_MODEL || clean.endsWith(':free')) {
    return clean;
  }
  return DEFAULT_OPENROUTER_MODEL;
}

export function ensureDeepSeekModelId(modelId) {
  const clean = typeof modelId === 'string' ? modelId.trim() : '';
  return clean === 'deepseek-reasoner' ? 'deepseek-reasoner' : DEFAULT_DEEPSEEK_MODEL;
}

export function filterFreeModels(rawModels = []) {
  const map = new Map();
  map.set(DEFAULT_OPENROUTER_MODEL, {
    id: DEFAULT_OPENROUTER_MODEL,
    name: 'OpenRouter Free Auto-Router (Direkomendasikan)',
    contextLength: 128000,
  });

  if (Array.isArray(rawModels)) {
    for (const item of rawModels) {
      if (!isZeroCostModel(item)) continue;
      const id = item.id.trim();
      if (id === DEFAULT_OPENROUTER_MODEL) continue;
      map.set(id, {
        id,
        name: (item.name || id).trim(),
        contextLength: Number(item.context_length) || 0,
      });
    }
  }

  const [autoRouter, ...rest] = Array.from(map.values());
  rest.sort((a, b) => a.name.localeCompare(b.name));
  return [autoRouter, ...rest];
}

export async function fetchFreeOpenRouterModels(
  apiKey = '',
  { signal, fetchImpl = globalThis.fetch, timeoutMs = 12000 } = {}
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  if (signal) signal.addEventListener('abort', onAbort, { once: true });

  try {
    const headers = { Accept: 'application/json' };
    if (apiKey && apiKey.trim()) {
      headers.Authorization = `Bearer ${apiKey.trim()}`;
    }

    const res = await fetchImpl(OPENROUTER_MODELS_URL, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const payload = await res.json();
    const models = filterFreeModels(payload?.data || []);
    return {
      models: models.length > 1 ? models : FALLBACK_FREE_MODELS,
      fromFallback: models.length <= 1,
    };
  } catch (err) {
    return {
      models: FALLBACK_FREE_MODELS,
      fromFallback: true,
      warning: err?.message || 'Gagal memuat daftar model live, menggunakan daftar bawaan.',
    };
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

// Deterministic humanizer: strips emojis, double dashes (--), em/en-dashes, while preserving single hyphens in Indonesian reduplicated words (e.g. produk-produk, rata-rata).
export function humanizeGeneratedText(input) {
  const raw = String(input ?? '');
  if (!raw.trim()) return '';

  return raw
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '')
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/\s*(?:--+|\u2014|\u2015)\s*/g, ', ')
        .replace(/\s+[\u2013-]\s+/g, ', ')
        .replace(/([.!?:])\s*,\s*/g, '$1 ')
        .replace(/,\s*,+/g, ',')
        .replace(/^,\s*/, '')
        .replace(/\s*,\s*([.!?])/g, '$1')
        .replace(/[ \t]{2,}/g, ' ')
        .trim()
    )
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractFirstJsonObject(text) {
  const cleaned = String(text || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  const start = cleaned.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return cleaned.slice(start, i + 1);
      }
    }
  }

  return null;
}

export function parseAiResearchResponse(rawContent, modelUsed = DEFAULT_DEEPSEEK_MODEL) {
  const jsonStr = extractFirstJsonObject(rawContent);
  if (!jsonStr) {
    throw new OpenRouterClientError(
      `Model (${modelUsed}) tidak mengembalikan format JSON yang valid. Coba analisis ulang.`,
      { code: 'INVALID_AI_JSON', retryable: true }
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new OpenRouterClientError(
      `Gagal mengurai respons JSON dari model (${modelUsed}). Coba analisis ulang.`,
      { code: 'INVALID_AI_JSON', retryable: true }
    );
  }

  const qualUpper = String(parsed.leadQualification || 'WARM LEAD').toUpperCase().trim();
  const leadQualification = qualUpper.includes('HOT')
    ? 'HOT LEAD'
    : qualUpper.includes('COLD')
      ? 'COLD LEAD'
      : 'WARM LEAD';

  const defaultScore =
    leadQualification === 'HOT LEAD' ? 85 : leadQualification === 'COLD LEAD' ? 28 : 60;
  const rawScore = Number(parsed.leadScore);
  const leadScore = Number.isFinite(rawScore)
    ? Math.max(0, Math.min(100, Math.round(rawScore)))
    : defaultScore;

  const digitalPresenceSummary = humanizeGeneratedText(parsed.digitalPresenceSummary);
  const pitchDraft = humanizeGeneratedText(parsed.pitchDraft);

  if (!digitalPresenceSummary || !pitchDraft) {
    throw new OpenRouterClientError(
      `Respons model (${modelUsed}) belum lengkap (ringkasan atau draft pesan kosong).`,
      { code: 'INCOMPLETE_AI_JSON', retryable: true }
    );
  }

  return {
    leadQualification,
    leadScore,
    hasOfficialWebsite: Boolean(parsed.hasOfficialWebsite === true),
    opportunityType:
      humanizeGeneratedText(parsed.opportunityType) || 'Pembuatan Website Katalog Mandiri',
    digitalPresenceSummary,
    pitchAngle: humanizeGeneratedText(parsed.pitchAngle),
    pitchDraft,
    followUpDraft: humanizeGeneratedText(parsed.followUpDraft),
    modelUsed: String(modelUsed || DEFAULT_DEEPSEEK_MODEL).trim(),
    analyzedAt: new Date().toISOString(),
  };
}

export function buildLeadPrompt(lead, settings = DEFAULT_AI_SETTINGS) {
  const toneGuide =
    settings.pitchTone === 'formal'
      ? 'sopan, ringkas, dan profesional ala komunikasi bisnis Indonesia ke pemilik usaha, tanpa terdengar kaku seperti surat resmi'
      : settings.pitchTone === 'consultative'
        ? 'konsultatif berbasis fakta ulasan dan kanal online yang tertera, fokus menawarkan diskusi singkat yang relevan'
        : 'akrab, santai, dan wajar seperti chat WhatsApp asli dari manusia di Indonesia (sapaan Kak atau Bapak/Ibu sesuai jenis usaha)';

  const webType = classifyWebsiteUrl(lead.website);
  let websiteContext = 'BELUM PUNYA WEBSITE RESMI';
  if (webType === 'OWNED_DOMAIN') {
    websiteContext = `SUDAH PUNYA DOMAIN MANDIRI (${lead.website})`;
  } else if (webType === 'FREE_BUILDER') {
    websiteContext = `MASIH PAKAI SUBDOMAIN GRATISAN (${lead.website}, belum punya domain resmi sendiri)`;
  } else if (lead.website) {
    websiteContext = `Tautan tercantum bukan website resmi (${lead.website})`;
  }

  // Literal word "json" included intentionally to satisfy DeepSeek strict JSON Output mode requirement.
  const systemPrompt = `Kamu adalah Analis Kualifikasi Prospek B2B dan Penulis Pesan WhatsApp untuk "${settings.agencyName || DEFAULT_AI_SETTINGS.agencyName}".
Fokus layanan yang kamu tawarkan: ${settings.serviceFocus || DEFAULT_AI_SETTINGS.serviceFocus}.
Target klien utama kami HANYA bisnis aktif yang BELUM memiliki website berdomain resmi sendiri.

ATURAN FAKTA DAN ANTI-HALUSINASI (WAJIB DIPATUHI):
1. Analisis HANYA berdasarkan data Google Maps yang diberikan. Jangan pernah mengarang akun Instagram, Shopee, jumlah pengikut, cabang, atau klaim apa pun yang tidak tertulis di input.
2. Jika kolom sosial media atau marketplace tertulis kosong, nyatakan secara jujur bahwa tautan tersebut belum tercantum di profil Maps mereka.

KRITERIA PENILAIAN OBJEKTIF:
1. HOT LEAD (skor 75 sampai 95): Bisnis lokal aktif yang belum punya domain resmi (termasuk yang masih memakai Linktree, Blogspot, Canva, Instagram, atau Shopee), memiliki reputasi ulasan sehat di Maps, dan punya kontak yang bisa dihubungi.
2. WARM LEAD (skor 45 sampai 74): Bisnis lokal tanpa website resmi yang memiliki kontak, namun jumlah ulasan masih sedikit sehingga skala usahanya masih berkembang.
3. COLD LEAD (skor 0 sampai 39): Bisnis yang SUDAH punya website berdomain resmi mandiri, jaringan franchise korporat besar, instansi pemerintah/publik, toko tutup, atau tidak punya jalur kontak sama sekali. Set "hasOfficialWebsite": true jika mereka memang sudah punya domain mandiri.

ATURAN GAYA BAHASA HUMANIZER (ANTI GAYA AI):
1. DILARANG KERAS menggunakan tanda double dash (--), em-dash, maupun tanda strip pemisah kalimat ( - ). Gunakan koma atau titik biasa saja.
2. DILARANG menggunakan emoji apa pun, daftar poin/bullet list di dalam pesan chat, atau tanda seru berlebihan.
3. DILARANG menggunakan kalimat klise terjemahan AI seperti: "Di era digital saat ini", "Semoga pesan ini menemui Anda dalam keadaan baik", "Meningkatkan visibilitas secara signifikan", "Solusi terpadu", "Transformasi digital", "Tak dapat dipungkiri", atau "Jangan lewatkan kesempatan".
4. Panjang "pitchDraft" maksimal 45 sampai 60 kata (cukup 3 sampai 4 kalimat pendek agar nyaman dibaca sekali lihat di layar HP). Gaya bahasa: ${toneGuide}.
5. Susunan alami "pitchDraft":
   a. Sapaan singkat yang wajar dan sebut nama usahanya.
   b. Satu pengamatan spesifik dari data Maps mereka (misal ulasan yang sudah ramai, rating bagus, atau baru mencantumkan sosmed/marketplace tanpa website resmi).
   c. Manfaat praktis sesuai bidang usahanya (kuliner: menu dan pesan langsung ke WA tanpa potongan aplikasi; jasa/bengkel/klinik/salon: halaman info layanan dan jadwal agar pelanggan dari Google lebih yakin; toko ritel: katalog produk resmi sendiri tanpa tercampur lapak kompetitor), lalu tawarkan izin kirim contoh tampilan singkat tanpa menyebut harga.
   d. Satu kalimat penutup ringan tanpa paksaan (contoh: kalau saat ini belum butuh tidak apa-apa, abaikan saja).
6. Panjang "followUpDraft" maksimal 25 kata, sopan menanyakan apakah contoh konsepnya boleh dikirimkan, tanpa memaksa.

Balas HANYA dalam format json objek murni yang valid tanpa markdown backticks:
{
  "leadQualification": "HOT LEAD" | "WARM LEAD" | "COLD LEAD",
  "leadScore": 85,
  "hasOfficialWebsite": false,
  "opportunityType": "Jenis kebutuhan spesifik 3 sampai 5 kata, contoh: Website Katalog Order WA",
  "digitalPresenceSummary": "2 kalimat analisis tajam dan faktual mengenai kondisi digital usaha ini beserta alasan skornya, tanpa tanda -- atau em-dash.",
  "pitchAngle": "1 kalimat alasan bisnis paling relevan kenapa usaha ini terbantu jika punya website resmi sendiri.",
  "pitchDraft": "Pesan WhatsApp pertama siap kirim yang terdengar seperti diketik manusia asli, 45 sampai 60 kata, tanpa tanda -- atau em-dash.",
  "followUpDraft": "Pesan sapaan tindak lanjut hari ke-3 yang singkat dan sopan, tanpa tanda -- atau em-dash."
}`;

  const userPrompt = `Analisis prospek Google Maps berikut secara objektif dan kembalikan hasil dalam json:
Nama Usaha: ${lead.name || '-'}
Kategori Usaha: ${lead.categoryName || lead.category || 'Usaha Lokal'}
Alamat: ${lead.address || '-'}
Rating Google Maps: ${lead.rating ? `${lead.rating} dari 5.0` : 'Belum ada rating'} (${lead.reviewCount || 0} ulasan)
Status Website di Maps: ${websiteContext}
Tautan Sosial Media di Maps: ${lead.socialMedia || 'Belum tercantum'}
Tautan Marketplace di Maps: ${lead.onlineShop || 'Belum tercantum'}
Kontak Telepon / WA: ${lead.whatsapp || lead.phone || 'Tidak tersedia'}`;

  return { systemPrompt, userPrompt };
}

export async function analyzeLeadWithDeepSeek(
  lead,
  rawSettings = {},
  { signal, fetchImpl = globalThis.fetch, timeoutMs = 45000 } = {}
) {
  const settings = { ...DEFAULT_AI_SETTINGS, ...rawSettings };
  const apiKey = String(settings.deepseekApiKey || settings.apiKey || '').trim();

  if (!apiKey && !settings.cloudDeepseekReady) {
    throw new OpenRouterClientError(
      'API Key DeepSeek belum diisi. Buka Pengaturan AI untuk menyimpan key ke Cloud DB.',
      { code: 'MISSING_API_KEY', status: 400, retryable: false, provider: 'deepseek' }
    );
  }

  const selectedModel = ensureDeepSeekModelId(settings.deepseekModel);
  const { systemPrompt, userPrompt } = buildLeadPrompt(lead, settings);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  if (signal) signal.addEventListener('abort', onAbort, { once: true });

  try {
    const res = await fetchImpl(DEEPSEEK_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey,
        model: selectedModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
      signal: controller.signal,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.success) {
      const status = res.status || 500;
      const code =
        data?.code ||
        (status === 401
          ? 'UNAUTHORIZED'
          : status === 402
            ? 'INSUFFICIENT_BALANCE'
            : status === 429
              ? 'RATE_LIMITED'
              : 'UPSTREAM_ERROR');

      const retryableOnFallback =
        status === 402 || status === 429 || status >= 500 || code === 'TIMEOUT';

      throw new OpenRouterClientError(
        data?.error || `DeepSeek gagal merespons (${status}).`,
        { code, status, retryable: retryableOnFallback, provider: 'deepseek' }
      );
    }

    const modelLabel = `deepseek/${data.model || selectedModel}`;
    return parseAiResearchResponse(data.content || '', modelLabel);
  } catch (err) {
    if (err instanceof OpenRouterClientError) throw err;
    if (err?.name === 'AbortError') {
      throw new OpenRouterClientError(
        signal?.aborted
          ? 'Proses analisis AI dibatalkan.'
          : 'Permintaan ke DeepSeek melebihi batas waktu (45 detik).',
        {
          code: signal?.aborted ? 'ABORTED' : 'TIMEOUT',
          retryable: !signal?.aborted,
          provider: 'deepseek',
        }
      );
    }
    throw new OpenRouterClientError(
      `Gagal terhubung ke endpoint DeepSeek: ${err?.message || 'Periksa jaringan Anda.'}`,
      { code: 'NETWORK_ERROR', retryable: true, provider: 'deepseek' }
    );
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

export async function analyzeLeadWithOpenRouter(
  lead,
  rawSettings = {},
  { signal, fetchImpl = globalThis.fetch, timeoutMs = 35000 } = {}
) {
  const settings = { ...DEFAULT_AI_SETTINGS, ...rawSettings };
  const apiKey = String(settings.openrouterApiKey || settings.apiKey || '').trim();
  const useCloudProxy = !apiKey && Boolean(settings.cloudOpenrouterReady);

  if (!apiKey && !useCloudProxy) {
    throw new OpenRouterClientError(
      'API Key OpenRouter belum diisi. Buka Pengaturan AI untuk menyimpan key gratis ke Cloud DB.',
      { code: 'MISSING_API_KEY', status: 400, retryable: false, provider: 'openrouter' }
    );
  }

  const selectedModel = ensureFreeModelId(settings.openrouterModel || settings.model);
  const { systemPrompt, userPrompt } = buildLeadPrompt(lead, settings);
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  if (signal) signal.addEventListener('abort', onAbort, { once: true });

  try {
    if (useCloudProxy) {
      const res = await fetchImpl(OPENROUTER_PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          messages,
        }),
        signal: controller.signal,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        const status = res.status || 500;
        const code =
          data?.code ||
          (status === 401
            ? 'UNAUTHORIZED'
            : status === 402
              ? 'PAYMENT_REQUIRED'
              : status === 429
                ? 'RATE_LIMITED'
                : 'UPSTREAM_ERROR');
        const retryable = status === 402 || status === 429 || status >= 500 || code === 'TIMEOUT';
        throw new OpenRouterClientError(
          data?.error || `OpenRouter gagal merespons (${status}).`,
          { code, status, retryable, provider: 'openrouter' }
        );
      }

      return parseAiResearchResponse(data.content || '', data.model || selectedModel);
    }

    const referer =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'http://localhost:3000';

    const res = await fetchImpl(OPENROUTER_CHAT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': referer,
        'X-Title': 'GMaps LeadGen Suite',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: selectedModel,
        messages,
        temperature: 0.35,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      let detail = '';
      try {
        const errJson = await res.json();
        detail = errJson?.error?.message || '';
      } catch {
        detail = await res.text().catch(() => '');
      }

      if (res.status === 401) {
        throw new OpenRouterClientError(
          'API Key OpenRouter tidak valid atau sudah kadaluarsa (401).',
          { code: 'UNAUTHORIZED', status: 401, retryable: false, provider: 'openrouter' }
        );
      }
      if (res.status === 402) {
        throw new OpenRouterClientError(
          'Batas penggunaan akun gratis OpenRouter tercapai (402).',
          { code: 'PAYMENT_REQUIRED', status: 402, retryable: true, provider: 'openrouter' }
        );
      }
      if (res.status === 429) {
        throw new OpenRouterClientError(
          'Rate limit model gratis OpenRouter tercapai (~20 req/menit).',
          { code: 'RATE_LIMITED', status: 429, retryable: true, provider: 'openrouter' }
        );
      }
      throw new OpenRouterClientError(
        `OpenRouter gagal merespons (${res.status})${detail ? `: ${detail.slice(0, 160)}` : '.'}`,
        {
          code: 'UPSTREAM_ERROR',
          status: res.status,
          retryable: res.status >= 500,
          provider: 'openrouter',
        }
      );
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || '';
    const actualModel = data?.model || selectedModel;

    return parseAiResearchResponse(content, actualModel);
  } catch (err) {
    if (err instanceof OpenRouterClientError) throw err;
    if (err?.name === 'AbortError') {
      throw new OpenRouterClientError(
        signal?.aborted
          ? 'Proses analisis AI dibatalkan.'
          : 'Permintaan ke OpenRouter melebihi batas waktu (35 detik).',
        {
          code: signal?.aborted ? 'ABORTED' : 'TIMEOUT',
          retryable: !signal?.aborted,
          provider: 'openrouter',
        }
      );
    }
    throw new OpenRouterClientError(
      `Gagal terhubung ke OpenRouter: ${err?.message || 'Periksa koneksi internet Anda.'}`,
      { code: 'NETWORK_ERROR', retryable: true, provider: 'openrouter' }
    );
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

export function resolveActiveProvider(rawSettings = {}) {
  const settings = { ...DEFAULT_AI_SETTINGS, ...rawSettings };
  const hasDeepSeek = isDeepSeekConfigured(settings);
  const hasOpenRouter = isOpenRouterConfigured(settings);
  const preferred = settings.primaryProvider === 'openrouter' ? 'openrouter' : 'deepseek';

  if (preferred === 'deepseek') {
    if (hasDeepSeek) return 'deepseek';
    if (hasOpenRouter) return 'openrouter';
    return 'deepseek';
  }

  if (hasOpenRouter) return 'openrouter';
  if (hasDeepSeek) return 'deepseek';
  return 'openrouter';
}

export async function analyzeLeadWithAi(lead, rawSettings = {}, options = {}) {
  const settings = { ...DEFAULT_AI_SETTINGS, ...rawSettings };
  const hasDeepSeek = isDeepSeekConfigured(settings);
  const hasOpenRouter = isOpenRouterConfigured(settings);

  if (!hasDeepSeek && !hasOpenRouter) {
    throw new OpenRouterClientError(
      'Belum ada API Key AI yang tersimpan. Buka Pengaturan AI lalu simpan API Key DeepSeek atau OpenRouter.',
      { code: 'MISSING_API_KEY', status: 400, retryable: false }
    );
  }

  const activePrimary = resolveActiveProvider(settings);
  const secondary = activePrimary === 'deepseek' ? 'openrouter' : 'deepseek';
  const secondaryReady = secondary === 'deepseek' ? hasDeepSeek : hasOpenRouter;

  const runForProvider = (providerName) =>
    providerName === 'deepseek'
      ? analyzeLeadWithDeepSeek(lead, settings, options)
      : analyzeLeadWithOpenRouter(lead, settings, options);

  try {
    const result = await runForProvider(activePrimary);
    return {
      ...result,
      providerUsed: activePrimary,
      fallbackFrom: null,
    };
  } catch (primaryErr) {
    if (primaryErr?.code === 'ABORTED') throw primaryErr;

    const canFallback =
      Boolean(settings.autoFallback) &&
      secondaryReady &&
      Boolean(primaryErr?.retryable);

    if (!canFallback) {
      throw primaryErr;
    }

    const fallbackResult = await runForProvider(secondary);
    return {
      ...fallbackResult,
      providerUsed: secondary,
      fallbackFrom: activePrimary,
    };
  }
}

export async function testAiProviderConnection(provider, rawSettings = {}, options = {}) {
  const start = Date.now();
  const sampleLead = {
    name: 'Kopi Senja Nusantara',
    categoryName: 'Kedai Kopi',
    address: 'Jl. Pajajaran No. 18, Bogor',
    rating: '4.8',
    reviewCount: '312',
    website: '',
    socialMedia: 'https://instagram.com/kopisenja',
    onlineShop: '',
    phone: '081234567890',
  };

  const result =
    provider === 'deepseek'
      ? await analyzeLeadWithDeepSeek(sampleLead, rawSettings, options)
      : await analyzeLeadWithOpenRouter(sampleLead, rawSettings, options);

  return {
    ok: true,
    provider,
    latencyMs: Date.now() - start,
    modelUsed: result.modelUsed,
    qualification: result.leadQualification,
  };
}

let cachedSettingsRaw = null;
let cachedSettingsObj = DEFAULT_AI_SETTINGS;
const settingsListeners = new Set();

function normalizeSettingsObject(parsed = {}) {
  return {
    ...DEFAULT_AI_SETTINGS,
    primaryProvider: parsed.primaryProvider === 'openrouter' ? 'openrouter' : 'deepseek',
    autoFallback: typeof parsed.autoFallback === 'boolean' ? parsed.autoFallback : true,
    deepseekApiKey: String(parsed.deepseekApiKey || '').trim(),
    deepseekModel: ensureDeepSeekModelId(parsed.deepseekModel),
    openrouterApiKey: String(parsed.openrouterApiKey || parsed.apiKey || '').trim(),
    openrouterModel: ensureFreeModelId(parsed.openrouterModel || parsed.model),
    agencyName: String(parsed.agencyName ?? DEFAULT_AI_SETTINGS.agencyName),
    serviceFocus: String(parsed.serviceFocus ?? DEFAULT_AI_SETTINGS.serviceFocus),
    pitchTone: ['casual', 'consultative', 'formal'].includes(parsed.pitchTone)
      ? parsed.pitchTone
      : 'casual',
    cloudDeepseekReady: Boolean(parsed.cloudDeepseekReady),
    cloudDeepseekMask: String(parsed.cloudDeepseekMask || ''),
    cloudOpenrouterReady: Boolean(parsed.cloudOpenrouterReady),
    cloudOpenrouterMask: String(parsed.cloudOpenrouterMask || ''),
  };
}

export function mergeCloudAndLocalAiSettings(cloudSettings = null, localSettings = {}) {
  const localNorm = normalizeSettingsObject(localSettings);
  if (!cloudSettings) {
    return localNorm;
  }

  return normalizeSettingsObject({
    ...localNorm,
    primaryProvider: cloudSettings.primaryProvider || localNorm.primaryProvider,
    autoFallback:
      typeof cloudSettings.autoFallback === 'boolean'
        ? cloudSettings.autoFallback
        : localNorm.autoFallback,
    deepseekModel: cloudSettings.deepseekModel || localNorm.deepseekModel,
    openrouterModel: cloudSettings.openrouterModel || localNorm.openrouterModel,
    agencyName: cloudSettings.agencyName || localNorm.agencyName,
    serviceFocus: cloudSettings.serviceFocus || localNorm.serviceFocus,
    pitchTone: cloudSettings.pitchTone || localNorm.pitchTone,
    cloudDeepseekReady: Boolean(cloudSettings.cloudDeepseekReady),
    cloudDeepseekMask: cloudSettings.cloudDeepseekMask || '',
    cloudOpenrouterReady: Boolean(cloudSettings.cloudOpenrouterReady),
    cloudOpenrouterMask: cloudSettings.cloudOpenrouterMask || '',
  });
}

export function subscribeAiSettings(listener) {
  settingsListeners.add(listener);
  if (typeof window === 'undefined') {
    return () => settingsListeners.delete(listener);
  }
  const onStorage = (e) => {
    if (e.key === AI_SETTINGS_STORAGE_KEY) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    settingsListeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function getServerAiSettingsSnapshot() {
  return DEFAULT_AI_SETTINGS;
}

export function loadAiSettings() {
  if (typeof window === 'undefined') return DEFAULT_AI_SETTINGS;
  try {
    let raw = window.localStorage.getItem(AI_SETTINGS_STORAGE_KEY);
    if (!raw) {
      const legacyRaw = window.localStorage.getItem(LEGACY_OPENROUTER_STORAGE_KEY);
      if (legacyRaw) {
        const migrated = normalizeSettingsObject(JSON.parse(legacyRaw));
        raw = JSON.stringify(migrated);
        window.localStorage.setItem(AI_SETTINGS_STORAGE_KEY, raw);
      }
    }

    if (raw === cachedSettingsRaw && cachedSettingsObj) {
      return cachedSettingsObj;
    }
    cachedSettingsRaw = raw;
    if (!raw) {
      cachedSettingsObj = DEFAULT_AI_SETTINGS;
      return cachedSettingsObj;
    }
    cachedSettingsObj = normalizeSettingsObject(JSON.parse(raw));
    return cachedSettingsObj;
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
}

export function saveAiSettings(nextSettings) {
  const merged = normalizeSettingsObject(nextSettings);
  if (typeof window !== 'undefined') {
    const serialized = JSON.stringify(merged);
    window.localStorage.setItem(AI_SETTINGS_STORAGE_KEY, serialized);
    cachedSettingsRaw = serialized;
    cachedSettingsObj = merged;
    settingsListeners.forEach((fn) => fn());
  }
  return merged;
}
