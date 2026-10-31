import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_OPENROUTER_MODEL,
  ensureFreeModelId,
  filterFreeModels,
  parseAiResearchResponse,
  analyzeLeadWithAi,
  analyzeLeadWithOpenRouter,
  resolveActiveProvider,
} from './openrouter.js';

test('filterFreeModels keeps only zero-cost :free models and pins openrouter/free first', () => {
  const catalog = [
    {
      id: 'openai/gpt-4o',
      name: 'OpenAI: GPT-4o',
      pricing: { prompt: '0.0000025', completion: '0.00001' },
    },
    {
      id: 'meta-llama/llama-3.3-70b-instruct:free',
      name: 'Meta: Llama 3.3 70B',
      pricing: { prompt: '0', completion: '0' },
      context_length: 128000,
    },
    {
      id: 'spoofed/paid-disguised:free',
      name: 'Spoofed Paid Model',
      pricing: { prompt: '0.0001', completion: '0' },
    },
  ];

  const filtered = filterFreeModels(catalog);
  assert.equal(filtered.length, 2);
  assert.equal(filtered[0].id, DEFAULT_OPENROUTER_MODEL);
  assert.equal(filtered[1].id, 'meta-llama/llama-3.3-70b-instruct:free');
  assert.equal(ensureFreeModelId('openai/gpt-4o'), DEFAULT_OPENROUTER_MODEL);
});

test('parseAiResearchResponse strips reasoning blocks and markdown fences cleanly', () => {
  const raw = `<think>Evaluating business signals...</think>
\`\`\`json
{
  "leadQualification": "hot lead",
  "leadScore": 91.6,
  "opportunityType": "Website Katalog Mandiri",
  "digitalPresenceSummary": "Toko memiliki 420 ulasan positif dan aktif di Shopee namun belum memiliki domain website sendiri.",
  "pitchAngle": "Bantu hemat potongan biaya admin marketplace dengan katalog order langsung.",
  "pitchDraft": "Halo Kak, salam kenal. Kami lihat toko Kakak sudah punya 420+ ulasan bagus di Maps...",
  "followUpDraft": "Halo Kak, izin menyapa kembali terkait contoh katalog websitenya..."
}
\`\`\`
Semoga membantu!`;

  const res = parseAiResearchResponse(raw, 'deepseek/deepseek-chat');
  assert.equal(res.leadQualification, 'HOT LEAD');
  assert.equal(res.leadScore, 92);
  assert.equal(res.modelUsed, 'deepseek/deepseek-chat');
  assert.ok(res.pitchDraft.includes('420+'));
});

test('resolveActiveProvider defaults to DeepSeek without colliding when only one key is present', () => {
  assert.equal(
    resolveActiveProvider({
      primaryProvider: 'deepseek',
      deepseekApiKey: '',
      openrouterApiKey: 'sk-or-v1-abc',
    }),
    'openrouter'
  );
  assert.equal(
    resolveActiveProvider({
      primaryProvider: 'deepseek',
      deepseekApiKey: 'sk-ds-123',
      openrouterApiKey: 'sk-or-v1-abc',
    }),
    'deepseek'
  );
});

test('analyzeLeadWithAi uses DeepSeek primary and auto-falls back to OpenRouter Free on 402/429', async () => {
  const lead = { name: 'Toko Roti Mawar', address: 'Bandung' };
  const calls = [];

  const mockFetch = async (url) => {
    calls.push(url);
    if (url === '/api/ai/deepseek') {
      return {
        ok: false,
        status: 402,
        json: async () => ({
          success: false,
          code: 'INSUFFICIENT_BALANCE',
          error: 'Saldo DeepSeek habis',
        }),
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        model: 'google/gemma-3-27b-it:free',
        choices: [
          {
            message: {
              content: JSON.stringify({
                leadQualification: 'HOT LEAD',
                leadScore: 88,
                opportunityType: 'Website Katalog',
                digitalPresenceSummary: 'Aktif di Maps tanpa website.',
                pitchAngle: 'Katalog online mandiri.',
                pitchDraft: 'Halo Kak Toko Roti Mawar, salam kenal...',
                followUpDraft: 'Halo Kak, izin follow-up...',
              }),
            },
          },
        ],
      }),
    };
  };

  const res = await analyzeLeadWithAi(
    lead,
    {
      primaryProvider: 'deepseek',
      autoFallback: true,
      deepseekApiKey: 'sk-deepseek-key',
      openrouterApiKey: 'sk-or-v1-free-key',
    },
    { fetchImpl: mockFetch }
  );

  assert.equal(calls.length, 2);
  assert.equal(calls[0], '/api/ai/deepseek');
  assert.ok(calls[1].includes('openrouter.ai'));
  assert.equal(res.providerUsed, 'openrouter');
  assert.equal(res.fallbackFrom, 'deepseek');
  assert.equal(res.leadQualification, 'HOT LEAD');
});

test('analyzeLeadWithOpenRouter fails fast on missing API key and surfaces 429 rate-limit clearly', async () => {
  const lead = { name: 'Toko Roti Mawar', address: 'Bandung' };

  await assert.rejects(
    () => analyzeLeadWithOpenRouter(lead, { openrouterApiKey: '   ' }),
    (err) => err.code === 'MISSING_API_KEY' && err.retryable === false
  );

  const mock429Fetch = async () => ({
    ok: false,
    status: 429,
    json: async () => ({ error: { message: 'Rate limit exceeded' } }),
  });

  await assert.rejects(
    () =>
      analyzeLeadWithOpenRouter(
        lead,
        { openrouterApiKey: 'sk-or-v1-test', openrouterModel: 'openai/gpt-4o' },
        { fetchImpl: mock429Fetch }
      ),
    (err) => err.code === 'RATE_LIMITED' && err.status === 429 && err.retryable === true
  );
});
