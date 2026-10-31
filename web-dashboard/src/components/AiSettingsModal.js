'use client';

import { useState, useEffect } from 'react';
import {
  DEEPSEEK_MODELS,
  DEFAULT_DEEPSEEK_MODEL,
  DEFAULT_OPENROUTER_MODEL,
  FALLBACK_FREE_MODELS,
  fetchFreeOpenRouterModels,
  testAiProviderConnection,
} from '@/lib/openrouter';

export default function AiSettingsModal({ settings, onClose, onSave }) {
  const [form, setForm] = useState(() => ({ ...settings }));
  const [activeConfigTab, setActiveConfigTab] = useState(
    () => (settings?.primaryProvider === 'openrouter' ? 'openrouter' : 'deepseek')
  );
  const [showDeepseekKey, setShowDeepseekKey] = useState(false);
  const [showOpenrouterKey, setShowOpenrouterKey] = useState(false);
  const [models, setModels] = useState(FALLBACK_FREE_MODELS);
  const [loadingModels, setLoadingModels] = useState(true);
  const [modelsNote, setModelsNote] = useState('');
  const [testingProvider, setTestingProvider] = useState(null); // 'deepseek' | 'openrouter' | null
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    let cancelled = false;

    fetchFreeOpenRouterModels(settings?.openrouterApiKey || '').then((res) => {
      if (cancelled) return;
      setModels(res.models);
      setModelsNote(
        res.fromFallback
          ? 'Menggunakan daftar model gratis bawaan (offline/fallback).'
          : `${res.models.length} model gratis aktif dimuat dari OpenRouter.`
      );
      setLoadingModels(false);
    });

    return () => {
      cancelled = true;
    };
  }, [settings?.openrouterApiKey]);

  const handleRefreshModels = async () => {
    if (loadingModels) return;
    setLoadingModels(true);
    setModelsNote('');
    const res = await fetchFreeOpenRouterModels(form.openrouterApiKey);
    setModels(res.models);
    setModelsNote(
      res.fromFallback
        ? res.warning || 'Menggunakan daftar model gratis bawaan.'
        : `${res.models.length} model gratis terbaru berhasil dimuat.`
    );
    setLoadingModels(false);
  };

  const handleTest = async (provider) => {
    if (testingProvider) return;
    setTestingProvider(provider);
    setTestResult(null);

    try {
      const res = await testAiProviderConnection(provider, form);
      const label = provider === 'deepseek' ? 'DeepSeek' : 'OpenRouter Free';
      setTestResult({
        ok: true,
        provider,
        text: `${label} terhubung (${res.latencyMs} ms) memakai ${res.modelUsed} — sampel: ${res.qualification}.`,
      });
    } catch (err) {
      setTestResult({
        ok: false,
        provider,
        text: err?.message || `Gagal menguji koneksi ${provider}.`,
      });
    } finally {
      setTestingProvider(null);
    }
  };

  const handleSelectPrimary = (provider) => {
    setForm((prev) => ({ ...prev, primaryProvider: provider }));
    setActiveConfigTab(provider);
    setTestResult(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  const hasDeepseekKey = Boolean(form.deepseekApiKey?.trim());
  const hasOpenrouterKey = Boolean(form.openrouterApiKey?.trim());

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="clean-card w-full sm:max-w-xl rounded-t-2xl sm:rounded-2xl max-h-[92dvh] flex flex-col shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-start justify-between gap-3 shrink-0">
          <div>
            <h2 className="text-base font-bold text-white">Pengaturan Provider AI (DeepSeek &amp; OpenRouter)</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Setiap provider memiliki slot API Key terpisah sehingga tidak saling menimpa.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-colors"
            aria-label="Tutup modal pengaturan AI"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-5 space-y-4 overflow-y-auto text-xs flex-1">
            {/* 1. PRIMARY PROVIDER SELECTOR */}
            <div className="space-y-2">
              <span className="font-semibold text-zinc-300 uppercase tracking-wider text-[11px] block">
                1. Pilih Provider Utama (Default Eksekusi)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleSelectPrimary('deepseek')}
                  className={`p-3 rounded-xl border text-left transition-colors ${
                    form.primaryProvider === 'deepseek'
                      ? 'bg-zinc-800/80 border-zinc-300'
                      : 'bg-[#18181b] border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-white text-xs">DeepSeek API</span>
                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-300">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          hasDeepseekKey ? 'bg-emerald-400' : 'bg-zinc-500'
                        }`}
                      />
                      {form.primaryProvider === 'deepseek' ? 'Utama' : 'Cadangan'}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Cepat, JSON stabil (DeepSeek V3 / R1), tanpa antrean panjang.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectPrimary('openrouter')}
                  className={`p-3 rounded-xl border text-left transition-colors ${
                    form.primaryProvider === 'openrouter'
                      ? 'bg-zinc-800/80 border-zinc-300'
                      : 'bg-[#18181b] border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-white text-xs">OpenRouter (Free)</span>
                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-300">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          hasOpenrouterKey ? 'bg-emerald-400' : 'bg-zinc-500'
                        }`}
                      />
                      {form.primaryProvider === 'openrouter' ? 'Utama' : 'Cadangan'}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Khusus model gratis (:free), cocok untuk cadangan nol biaya.
                  </p>
                </button>
              </div>

              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[#18181b] border border-zinc-800/90 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(form.autoFallback)}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, autoFallback: e.target.checked }))
                  }
                  className="mt-0.5 rounded border-zinc-700 bg-zinc-900"
                />
                <div className="space-y-0.5">
                  <span className="text-zinc-200 font-medium block">
                    Aktifkan Auto-Fallback Pintar (Anti-Bentrok)
                  </span>
                  <span className="text-[11px] text-zinc-400 block leading-relaxed">
                    Jika keduanya terisi dan provider utama kehabisan saldo (402) atau terkena rate-limit (429), otomatis beralih ke provider cadangan.
                  </span>
                </div>
              </label>
            </div>

            {/* 2. ISOLATED CREDENTIAL TABS */}
            <div className="space-y-3 pt-2 border-t border-zinc-800/80">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-zinc-300 uppercase tracking-wider text-[11px]">
                  2. Input API Key &amp; Model per Provider
                </span>
                <div className="inline-flex p-0.5 rounded-lg bg-zinc-900 border border-zinc-800">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveConfigTab('deepseek');
                      setTestResult(null);
                    }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1.5 ${
                      activeConfigTab === 'deepseek'
                        ? 'bg-zinc-100 text-zinc-950 font-semibold'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        hasDeepseekKey ? 'bg-emerald-500' : 'bg-zinc-500'
                      }`}
                    />
                    <span>Tab DeepSeek</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveConfigTab('openrouter');
                      setTestResult(null);
                    }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1.5 ${
                      activeConfigTab === 'openrouter'
                        ? 'bg-zinc-100 text-zinc-950 font-semibold'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        hasOpenrouterKey ? 'bg-emerald-500' : 'bg-zinc-500'
                      }`}
                    />
                    <span>Tab OpenRouter Free</span>
                  </button>
                </div>
              </div>

              {activeConfigTab === 'deepseek' ? (
                <div className="p-3.5 rounded-xl bg-[#18181b] border border-zinc-800 space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <label htmlFor="ds-api-key" className="font-medium text-zinc-200">
                        DeepSeek API Key
                      </label>
                      <a
                        href="https://platform.deepseek.com/api_keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-zinc-400 hover:text-white underline underline-offset-2"
                      >
                        Buka Dashboard DeepSeek
                      </a>
                    </div>
                    <div className="relative">
                      <input
                        id="ds-api-key"
                        type={showDeepseekKey ? 'text' : 'password'}
                        value={form.deepseekApiKey || ''}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, deepseekApiKey: e.target.value }))
                        }
                        placeholder="sk-..."
                        className="w-full px-3.5 py-2.5 pr-28 clean-input rounded-xl font-mono text-xs bg-[#121215]"
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-2 gap-1">
                        {form.deepseekApiKey && (
                          <button
                            type="button"
                            onClick={() =>
                              setForm((prev) => ({ ...prev, deepseekApiKey: '' }))
                            }
                            className="px-2 py-1 text-[11px] text-zinc-500 hover:text-rose-300"
                          >
                            Hapus
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setShowDeepseekKey((prev) => !prev)}
                          className="px-2 py-1 text-[11px] font-medium text-zinc-400 hover:text-white"
                        >
                          {showDeepseekKey ? 'Sembunyi' : 'Lihat'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="ds-model" className="font-medium text-zinc-200 block">
                      Model DeepSeek
                    </label>
                    <select
                      id="ds-model"
                      value={form.deepseekModel || DEFAULT_DEEPSEEK_MODEL}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, deepseekModel: e.target.value }))
                      }
                      className="w-full px-3 py-2 clean-input rounded-xl text-xs bg-[#121215]"
                    >
                      {DEEPSEEK_MODELS.map((m) => (
                        <option key={m.id} value={m.id} className="bg-[#121215] text-zinc-100">
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-zinc-500">
                      Diproses via proxy terautentikasi server (bebas kendala CORS).
                    </span>
                    <button
                      type="button"
                      onClick={() => handleTest('deepseek')}
                      disabled={Boolean(testingProvider) || !hasDeepseekKey}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 transition-colors disabled:opacity-40 inline-flex items-center gap-1.5 shrink-0"
                    >
                      {testingProvider === 'deepseek' && (
                        <span className="w-3 h-3 border-2 border-zinc-400/30 border-t-white rounded-full animate-spin" />
                      )}
                      <span>
                        {testingProvider === 'deepseek' ? 'Menguji...' : 'Tes DeepSeek'}
                      </span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-[#18181b] border border-zinc-800 space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <label htmlFor="or-api-key" className="font-medium text-zinc-200">
                        OpenRouter API Key
                      </label>
                      <a
                        href="https://openrouter.ai/settings/keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-zinc-400 hover:text-white underline underline-offset-2"
                      >
                        Ambil Key Gratis OpenRouter
                      </a>
                    </div>
                    <div className="relative">
                      <input
                        id="or-api-key"
                        type={showOpenrouterKey ? 'text' : 'password'}
                        value={form.openrouterApiKey || ''}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, openrouterApiKey: e.target.value }))
                        }
                        placeholder="sk-or-v1-..."
                        className="w-full px-3.5 py-2.5 pr-28 clean-input rounded-xl font-mono text-xs bg-[#121215]"
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-2 gap-1">
                        {form.openrouterApiKey && (
                          <button
                            type="button"
                            onClick={() =>
                              setForm((prev) => ({ ...prev, openrouterApiKey: '' }))
                            }
                            className="px-2 py-1 text-[11px] text-zinc-500 hover:text-rose-300"
                          >
                            Hapus
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setShowOpenrouterKey((prev) => !prev)}
                          className="px-2 py-1 text-[11px] font-medium text-zinc-400 hover:text-white"
                        >
                          {showOpenrouterKey ? 'Sembunyi' : 'Lihat'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <label htmlFor="or-model" className="font-medium text-zinc-200">
                        Model Gratis (:free)
                      </label>
                      <button
                        type="button"
                        onClick={handleRefreshModels}
                        disabled={loadingModels}
                        className="text-[11px] text-zinc-400 hover:text-white disabled:opacity-50"
                      >
                        {loadingModels ? 'Memuat...' : 'Segarkan Daftar'}
                      </button>
                    </div>
                    <select
                      id="or-model"
                      value={form.openrouterModel || DEFAULT_OPENROUTER_MODEL}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, openrouterModel: e.target.value }))
                      }
                      className="w-full px-3 py-2 clean-input rounded-xl text-xs bg-[#121215]"
                    >
                      {models.map((m) => (
                        <option key={m.id} value={m.id} className="bg-[#121215] text-zinc-100">
                          {m.name} {m.id !== DEFAULT_OPENROUTER_MODEL ? `(${m.id})` : ''}
                        </option>
                      ))}
                    </select>
                    {modelsNote && <p className="text-[11px] text-zinc-500">{modelsNote}</p>}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-zinc-500">
                      Hanya memfilter model bertarif Rp 0 (:free).
                    </span>
                    <button
                      type="button"
                      onClick={() => handleTest('openrouter')}
                      disabled={Boolean(testingProvider) || !hasOpenrouterKey}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 transition-colors disabled:opacity-40 inline-flex items-center gap-1.5 shrink-0"
                    >
                      {testingProvider === 'openrouter' && (
                        <span className="w-3 h-3 border-2 border-zinc-400/30 border-t-white rounded-full animate-spin" />
                      )}
                      <span>
                        {testingProvider === 'openrouter' ? 'Menguji...' : 'Tes OpenRouter'}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {testResult && (
              <div
                role="status"
                className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                  testResult.ok
                    ? 'bg-emerald-950/40 border-emerald-900/70 text-emerald-200'
                    : 'bg-rose-950/40 border-rose-900/70 text-rose-200'
                }`}
              >
                <span className="leading-relaxed">{testResult.text}</span>
                {!testResult.ok && (
                  <button
                    type="button"
                    onClick={() => handleTest(testResult.provider)}
                    disabled={Boolean(testingProvider)}
                    className="shrink-0 px-2.5 py-1 rounded-md bg-rose-900/50 hover:bg-rose-900 text-rose-100 font-medium"
                  >
                    Ulangi
                  </button>
                )}
              </div>
            )}

            {/* 3. AGENCY PROFILE */}
            <div className="pt-2 border-t border-zinc-800/80 space-y-3">
              <div className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
                3. Personalisasi Penawaran Agensi / Freelancer
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="agency-name" className="text-[11px] text-zinc-400 block">
                    Nama Tim / Pengirim
                  </label>
                  <input
                    id="agency-name"
                    type="text"
                    value={form.agencyName || ''}
                    onChange={(e) => setForm((prev) => ({ ...prev, agencyName: e.target.value }))}
                    placeholder="Misal: Studio Web Nusantara"
                    className="w-full px-3 py-2 clean-input rounded-lg text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="pitch-tone" className="text-[11px] text-zinc-400 block">
                    Gaya Bahasa Pesan WA
                  </label>
                  <select
                    id="pitch-tone"
                    value={form.pitchTone || 'casual'}
                    onChange={(e) => setForm((prev) => ({ ...prev, pitchTone: e.target.value }))}
                    className="w-full px-3 py-2 clean-input rounded-lg text-xs bg-[#18181b]"
                  >
                    <option value="casual" className="bg-[#18181b]">Santai &amp; Natural WA</option>
                    <option value="consultative" className="bg-[#18181b]">Konsultatif Berbasis Data</option>
                    <option value="formal" className="bg-[#18181b]">Formal &amp; Sopan B2B</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="service-focus" className="text-[11px] text-zinc-400 block">
                  Fokus Layanan yang Ditawarkan
                </label>
                <input
                  id="service-focus"
                  type="text"
                  value={form.serviceFocus || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, serviceFocus: e.target.value }))}
                  placeholder="Misal: Pembuatan Website Katalog Mandiri & Landing Page SEO"
                  className="w-full px-3 py-2 clean-input rounded-lg text-xs"
                />
              </div>
            </div>

            {/* 4. STORAGE LOCATION EXPLANATION */}
            <div className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800/80 text-[11px] text-zinc-400 leading-relaxed">
              <strong className="text-zinc-200">Lokasi Penyimpanan Data:</strong> Kedua API Key &amp; profil penawaran di atas disimpan lokal hanya di browser perangkat Anda (<code className="text-zinc-300">localStorage</code> — tidak pernah masuk ke Git atau dilihat perangkat lain). Sedangkan <strong className="text-zinc-200">hasil riset AI &amp; draft WA</strong> disimpan permanen ke database Cloud Neon Postgres.
            </div>
          </div>

          <div className="px-5 py-3.5 border-t border-zinc-800 bg-[#0e0e11] flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-white text-zinc-950 transition-colors shadow-sm"
            >
              Simpan Pengaturan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
