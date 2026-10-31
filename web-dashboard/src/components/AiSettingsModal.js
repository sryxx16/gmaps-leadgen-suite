'use client';

import { useState, useEffect } from 'react';
import {
  DEFAULT_OPENROUTER_MODEL,
  FALLBACK_FREE_MODELS,
  fetchFreeOpenRouterModels,
  testOpenRouterConnection,
} from '@/lib/openrouter';

export default function AiSettingsModal({ settings, onClose, onSave }) {
  const [form, setForm] = useState(() => ({ ...settings }));
  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState(FALLBACK_FREE_MODELS);
  const [loadingModels, setLoadingModels] = useState(true);
  const [modelsNote, setModelsNote] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    let cancelled = false;

    fetchFreeOpenRouterModels(settings?.apiKey || '').then((res) => {
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
  }, [settings?.apiKey]);

  const handleRefreshModels = async () => {
    if (loadingModels) return;
    setLoadingModels(true);
    setModelsNote('');
    const res = await fetchFreeOpenRouterModels(form.apiKey);
    setModels(res.models);
    setModelsNote(
      res.fromFallback
        ? res.warning || 'Menggunakan daftar model gratis bawaan.'
        : `${res.models.length} model gratis terbaru berhasil dimuat.`
    );
    setLoadingModels(false);
  };

  const handleTest = async () => {
    if (testing) return;
    setTesting(true);
    setTestResult(null);

    try {
      const res = await testOpenRouterConnection(form);
      setTestResult({
        ok: true,
        text: `Terhubung (${res.latencyMs} ms) menggunakan ${res.modelUsed} — sampel: ${res.qualification}.`,
      });
    } catch (err) {
      setTestResult({
        ok: false,
        text: err?.message || 'Gagal menguji koneksi ke OpenRouter.',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="clean-card w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[92dvh] flex flex-col shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-start justify-between gap-3 shrink-0">
          <div>
            <h2 className="text-base font-bold text-white">Pengaturan OpenRouter AI (Free)</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Hanya menampilkan dan memanggil model bertarif nol (gratis) dari OpenRouter.
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
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="or-api-key"
                  className="font-semibold text-zinc-300 uppercase tracking-wider text-[11px]"
                >
                  OpenRouter API Key
                </label>
                <a
                  href="https://openrouter.ai/settings/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-zinc-400 hover:text-white underline underline-offset-2"
                >
                  Ambil Key Gratis di OpenRouter
                </a>
              </div>
              <div className="relative">
                <input
                  id="or-api-key"
                  type={showKey ? 'text' : 'password'}
                  value={form.apiKey || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, apiKey: e.target.value }))}
                  placeholder="sk-or-v1-..."
                  className="w-full px-3.5 py-2.5 pr-16 clean-input rounded-xl font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((prev) => !prev)}
                  className="absolute inset-y-0 right-0 px-3 text-[11px] font-medium text-zinc-400 hover:text-white"
                >
                  {showKey ? 'Sembunyi' : 'Lihat'}
                </button>
              </div>
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Key disimpan khusus di browser perangkat ini (<code className="text-zinc-400">localStorage</code>) dan dipanggil langsung ke endpoint resmi OpenRouter.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="or-model"
                  className="font-semibold text-zinc-300 uppercase tracking-wider text-[11px]"
                >
                  Model Gratis (:free)
                </label>
                <button
                  type="button"
                  onClick={handleRefreshModels}
                  disabled={loadingModels}
                  className="text-[11px] text-zinc-400 hover:text-white disabled:opacity-50"
                >
                  {loadingModels ? 'Memuat daftar...' : 'Segarkan Daftar Model'}
                </button>
              </div>
              <select
                id="or-model"
                value={form.model || DEFAULT_OPENROUTER_MODEL}
                onChange={(e) => setForm((prev) => ({ ...prev, model: e.target.value }))}
                className="w-full px-3 py-2.5 clean-input rounded-xl text-xs bg-[#18181b]"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id} className="bg-[#18181b] text-zinc-100">
                    {m.name} {m.id !== DEFAULT_OPENROUTER_MODEL ? `(${m.id})` : ''}
                  </option>
                ))}
              </select>
              {modelsNote && <p className="text-[11px] text-zinc-500">{modelsNote}</p>}
            </div>

            <div className="pt-2 border-t border-zinc-800/80 space-y-3">
              <div className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
                Personalisasi Penawaran Agensi / Freelancer
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
                    onClick={handleTest}
                    disabled={testing}
                    className="shrink-0 px-2.5 py-1 rounded-md bg-rose-900/50 hover:bg-rose-900 text-rose-100 font-medium"
                  >
                    Ulangi
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="px-5 py-3.5 border-t border-zinc-800 bg-[#0e0e11] flex flex-wrap items-center justify-between gap-2 shrink-0">
            <button
              type="button"
              onClick={handleTest}
              disabled={testing || !form.apiKey?.trim()}
              className="px-3.5 py-2 rounded-xl text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
            >
              {testing && (
                <span className="w-3.5 h-3.5 border-2 border-zinc-400/30 border-t-zinc-200 rounded-full animate-spin" />
              )}
              <span>{testing ? 'Menguji Koneksi...' : 'Tes Koneksi'}</span>
            </button>

            <div className="flex items-center gap-2">
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
          </div>
        </form>
      </div>
    </div>
  );
}
