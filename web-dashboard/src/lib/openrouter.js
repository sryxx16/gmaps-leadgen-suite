// Rationale: Unified BYOK multi-provider router (DeepSeek primary via server CORS proxy + OpenRouter zero-cost direct browser fallback) without external SDK bloat.

export const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';
export const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
export const DEEPSEEK_PROXY_URL = '/api/ai/deepseek';

export const DEFAULT_OPENROUTER_MODEL = 'openrouter/free';
export const DEFAULT_DEEPSEEK_MODEL = 'deepseek-chat';

export const AI_SETTINGS_STORAGE_KEY = 'gmaps_leadgen_ai_settings_v2';
const LEGACY_OPENROUTER_STORAGE_KEY = 'gmaps_leadgen_openrouter_v1';

export const DEEPSEEK_MODELS = [
  {
    id: 'deepseek-chat',
    name: 'DeepSeek V3 (deepseek-chat — Cepat & JSON Stabil)',
  },
  {
    id: 'deepseek-reasoner',
    name: 'DeepSeek R1 (deepseek-reasoner — Deep Thinking)',
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
    leadQualification === 'HOT LEAD' ? 85 : leadQualification === 'COLD LEAD' ? 30 : 60;
  const rawScore = Number(parsed.leadScore);
  const leadScore = Number.isFinite(rawScore)
    ? Math.max(0, Math.min(100, Math.round(rawScore)))
    : defaultScore;

  const digitalPresenceSummary = String(parsed.digitalPresenceSummary || '').trim();
  const pitchDraft = String(parsed.pitchDraft || '').trim();

  if (!digitalPresenceSummary || !pitchDraft) {
    throw new OpenRouterClientError(
      `Respons model (${modelUsed}) belum lengkap (ringkasan atau draft pesan kosong).`,
      { code: 'INCOMPLETE_AI_JSON', retryable: true }
    );
  }

  return {
    leadQualification,
    leadScore,
    opportunityType: String(parsed.opportunityType || 'Optimasi Kehadiran Digital').trim(),
    digitalPresenceSummary,
    pitchAngle: String(parsed.pitchAngle || '').trim(),
    pitchDraft,
    followUpDraft: String(parsed.followUpDraft || '').trim(),
    modelUsed: String(modelUsed || DEFAULT_DEEPSEEK_MODEL).trim(),
    analyzedAt: new Date().toISOString(),
  };
}

function buildLeadPrompt(lead, settings) {
  const toneGuide =
    settings.pitchTone === 'formal'
      ? 'profesional, sopan, dan terstruktur untuk pemilik bisnis/manajer'
      : settings.pitchTone === 'consultative'
        ? 'konsultatif, berbasis data ulasan/jejak digital, memberi insight singkat sebelum menawarkan solusi'
        : 'ramah, natural ala chat WhatsApp Indonesia (sapaan Kak/Bapak/Ibu), singkat, tidak kaku seperti robot spam';

  // Literal word "json" included intentionally to satisfy DeepSeek strict JSON Output mode requirement.
  const systemPrompt = `Kamu adalah B2B Lead Qualification & Cold Outreach Specialist untuk "${settings.agencyName || DEFAULT_AI_SETTINGS.agencyName}".
Layanan utama yang ditawarkan: ${settings.serviceFocus || DEFAULT_AI_SETTINGS.serviceFocus}.
Gaya bahasa pesan: ${toneGuide}.

Tugasmu menganalisis data prospek bisnis dari Google Maps dan menghasilkan output dalam format json yang valid.

Aturan penilaian objektif:
- HOT LEAD (skor 75-100): Bisnis aktif (ulasan cukup ramai / rating bagus / aktif di Shopee/Tokopedia/Instagram) TETAPI belum punya website resmi, serta punya nomor kontak.
- WARM LEAD (skor 45-74): Bisnis belum punya website namun ulasan masih sedikit, ATAU sudah punya website sederhana yang berpotensi ditawarkan redesign/SEO/landing page promosi.
- COLD LEAD (skor 0-44): Sudah punya website korporat matang dan tidak ada celah penawaran jelas, atau data sangat minim tanpa sinyal aktivitas.

Wajib balas HANYA dalam json objek murni sesuai struktur berikut tanpa markdown backticks:
{
  "leadQualification": "HOT LEAD" | "WARM LEAD" | "COLD LEAD",
  "leadScore": 85,
  "opportunityType": "Kategori peluang singkat, misal: Website Katalog Mandiri / Landing Page Jasa / Redesign & SEO Lokal",
  "digitalPresenceSummary": "1-2 kalimat analisis faktual tentang posisi digital bisnis ini berdasarkan rating, ulasan, website, sosmed, dan marketplace.",
  "pitchAngle": "1 kalimat strategi sudut masuk penawaran paling tajam untuk bisnis ini.",
  "pitchDraft": "Pesan WhatsApp pertama siap kirim (maksimal 3-4 kalimat singkat, sebut nama bisnis & detail spesifik seperti rating/kategori/marketplace mereka, akhiri dengan pertanyaan ringan tanpa memaksa).",
  "followUpDraft": "Pesan follow-up singkat hari ke-3 (1-2 kalimat sopan) jika pesan pertama belum dibalas."
}`;

  const userPrompt = `Analisis data prospek berikut dan kembalikan hasil dalam json:
- Nama Bisnis: ${lead.name || '-'}
- Kategori: ${lead.categoryName || lead.category || 'Bisnis Lokal'}
- Alamat: ${lead.address || '-'}
- Rating Maps: ${lead.rating ? `${lead.rating} / 5.0` : 'Belum ada'} (${lead.reviewCount || 0} ulasan)
- Website Resmi: ${lead.website ? lead.website : 'BELUM ADA WEBSITE'}
- Sosial Media: ${lead.socialMedia || 'Tidak tercantum di Maps'}
- Marketplace / Olshop: ${lead.onlineShop || 'Tidak tercantum di Maps'}
- Kontak WA / Telp: ${lead.whatsapp || lead.phone || 'Tidak ada'}`;

  return { systemPrompt, userPrompt };
}

export async function analyzeLeadWithDeepSeek(
  lead,
  rawSettings = {},
  { signal, fetchImpl = globalThis.fetch, timeoutMs = 45000 } = {}
) {
  const settings = { ...DEFAULT_AI_SETTINGS, ...rawSettings };
  const apiKey = String(settings.deepseekApiKey || settings.apiKey || '').trim();

  if (!apiKey) {
    throw new OpenRouterClientError(
      'API Key DeepSeek belum diisi. Buka Pengaturan AI untuk memasukkan key DeepSeek Anda.',
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

  if (!apiKey) {
    throw new OpenRouterClientError(
      'API Key OpenRouter belum diisi. Buka Pengaturan AI untuk memasukkan key gratis Anda.',
      { code: 'MISSING_API_KEY', status: 400, retryable: false, provider: 'openrouter' }
    );
  }

  const selectedModel = ensureFreeModelId(settings.openrouterModel || settings.model);
  const { systemPrompt, userPrompt } = buildLeadPrompt(lead, settings);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  if (signal) signal.addEventListener('abort', onAbort, { once: true });

  try {
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
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
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
  const hasDeepSeek = Boolean(settings.deepseekApiKey?.trim());
  const hasOpenRouter = Boolean(settings.openrouterApiKey?.trim());
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
  const hasDeepSeek = Boolean(settings.deepseekApiKey?.trim());
  const hasOpenRouter = Boolean(settings.openrouterApiKey?.trim());

  if (!hasDeepSeek && !hasOpenRouter) {
    throw new OpenRouterClientError(
      'Belum ada API Key AI yang diisi. Buka Pengaturan AI lalu masukkan API Key DeepSeek atau OpenRouter.',
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
  };
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
