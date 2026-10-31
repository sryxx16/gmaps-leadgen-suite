'use client';

import { useState } from 'react';

export default function AiLeadModal({
  lead,
  isAnalyzing,
  onClose,
  onReanalyze,
  onSaveEditedPitch,
  normalizeWa,
}) {
  const [activeTab, setActiveTab] = useState('primary');
  const [primaryText, setPrimaryText] = useState(() => lead?.aiResearch?.pitchDraft || '');
  const [followUpText, setFollowUpText] = useState(() => lead?.aiResearch?.followUpDraft || '');
  const [savingPitch, setSavingPitch] = useState(false);
  const [saveNotice, setSaveNotice] = useState(null);
  const [copied, setCopied] = useState(false);

  if (!lead) return null;

  const research = lead.aiResearch || {};
  const qual = research.leadQualification || 'WARM LEAD';
  const score = research.leadScore;
  const waDigits = normalizeWa(lead.whatsapp || lead.phone);

  const currentMessage = activeTab === 'followup' ? followUpText : primaryText;
  const isDirty =
    primaryText !== (research.pitchDraft || '') ||
    followUpText !== (research.followUpDraft || '');

  const qualBadgeStyle = qual.includes('HOT')
    ? 'bg-rose-950/50 text-rose-200 border-rose-900/70'
    : qual.includes('COLD')
      ? 'bg-zinc-900 text-zinc-400 border-zinc-800'
      : 'bg-amber-950/50 text-amber-200 border-amber-900/70';

  const handleCopy = async () => {
    if (!currentMessage) return;
    try {
      await navigator.clipboard.writeText(currentMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setSaveNotice({ type: 'error', text: 'Gagal menyalin teks ke clipboard.' });
    }
  };

  const handleSaveEdits = async () => {
    if (savingPitch || !isDirty) return;
    setSavingPitch(true);
    setSaveNotice(null);
    try {
      await onSaveEditedPitch(lead.id, {
        ...research,
        pitchDraft: primaryText,
        followUpDraft: followUpText,
      });
      setSaveNotice({ type: 'success', text: 'Draft pesan tersimpan ke database.' });
    } catch (err) {
      setSaveNotice({
        type: 'error',
        text: err?.message || 'Gagal menyimpan perubahan draft ke database.',
      });
    } finally {
      setSavingPitch(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="clean-card w-full sm:max-w-xl rounded-t-2xl sm:rounded-2xl max-h-[92dvh] flex flex-col shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-white truncate">{lead.name}</h3>
            <p className="text-xs text-zinc-400 truncate mt-0.5">
              {lead.categoryName || 'Bisnis Lokal'} &bull; {lead.address || 'Alamat tidak tersedia'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-colors shrink-0"
            aria-label="Tutup detail analisis AI"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto text-xs flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-2.5 py-1 rounded-lg font-semibold border ${qualBadgeStyle}`}>
                {qual}
              </span>
              {typeof score === 'number' && (
                <span className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 font-mono">
                  Skor {score}/100
                </span>
              )}
              {research.opportunityType && (
                <span className="px-2.5 py-1 rounded-lg bg-zinc-900/80 border border-zinc-800 text-zinc-300">
                  {research.opportunityType}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => onReanalyze(lead)}
              disabled={isAnalyzing}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-colors disabled:opacity-40"
            >
              {isAnalyzing ? (
                <>
                  <span className="w-3 h-3 border-2 border-zinc-400/30 border-t-zinc-200 rounded-full animate-spin" />
                  <span>Menganalisis...</span>
                </>
              ) : (
                <span>Analisis Ulang AI</span>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-[#18181b] border border-zinc-800/90 space-y-1">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                Ringkasan Jejak Digital
              </span>
              <p className="text-zinc-200 leading-relaxed">
                {research.digitalPresenceSummary || 'Belum ada ringkasan analisis.'}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#18181b] border border-zinc-800/90 space-y-1">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                Sudut Penawaran (Pitch Angle)
              </span>
              <p className="text-zinc-200 leading-relaxed">
                {research.pitchAngle || 'Tawarkan pembuatan website katalog mandiri yang terhubung ke WhatsApp.'}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex p-0.5 rounded-lg bg-zinc-900 border border-zinc-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('primary')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    activeTab === 'primary'
                      ? 'bg-zinc-100 text-zinc-950 font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Pesan Utama WA
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('followup')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    activeTab === 'followup'
                      ? 'bg-zinc-100 text-zinc-950 font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Follow-up Hari ke-3
                </button>
              </div>

              {isDirty && (
                <button
                  type="button"
                  onClick={handleSaveEdits}
                  disabled={savingPitch}
                  className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-medium border border-zinc-700 transition-colors disabled:opacity-40"
                >
                  {savingPitch ? 'Menyimpan...' : 'Simpan Edit ke DB'}
                </button>
              )}
            </div>

            <textarea
              rows={4}
              value={currentMessage}
              onChange={(e) => {
                if (activeTab === 'followup') setFollowUpText(e.target.value);
                else setPrimaryText(e.target.value);
              }}
              placeholder={
                activeTab === 'followup'
                  ? 'Tulis atau hasilkan pesan follow-up singkat...'
                  : 'Tulis atau hasilkan pesan penawaran WhatsApp...'
              }
              className="w-full clean-input rounded-xl p-3 text-xs leading-relaxed resize-y"
            />

            {research.modelUsed && (
              <div className="text-[11px] text-zinc-500 flex items-center justify-between gap-2">
                <span>Model: {research.modelUsed}</span>
                {research.analyzedAt && (
                  <span>
                    {new Date(research.analyzedAt).toLocaleDateString('id-ID', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                )}
              </div>
            )}
          </div>

          {saveNotice && (
            <div
              role="status"
              className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                saveNotice.type === 'success'
                  ? 'bg-emerald-950/40 border-emerald-900/70 text-emerald-200'
                  : 'bg-rose-950/40 border-rose-900/70 text-rose-200'
              }`}
            >
              <span>{saveNotice.text}</span>
              {saveNotice.type === 'error' && isDirty && (
                <button
                  type="button"
                  onClick={handleSaveEdits}
                  disabled={savingPitch}
                  className="px-2.5 py-1 rounded-md bg-rose-900/50 hover:bg-rose-900 text-rose-100 font-medium"
                >
                  Coba Lagi
                </button>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-zinc-800 bg-[#0e0e11] flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            disabled={!currentMessage}
            className="px-3.5 py-2 rounded-xl text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 transition-colors disabled:opacity-40"
          >
            {copied ? 'Berhasil Disalin' : 'Salin Pesan'}
          </button>

          {waDigits ? (
            <a
              href={`https://wa.me/${waDigits}?text=${encodeURIComponent(currentMessage || '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-white text-zinc-950 transition-colors shadow-sm inline-flex items-center gap-1.5"
            >
              <span>Kirim ke WhatsApp</span>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </a>
          ) : (
            <span className="text-xs text-zinc-500">Nomor WA tidak tersedia</span>
          )}
        </div>
      </div>
    </div>
  );
}
