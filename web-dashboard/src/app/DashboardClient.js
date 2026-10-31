'use client';

import { useState, useMemo, useRef, useCallback, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  DEFAULT_OPENROUTER_MODEL,
  analyzeLeadWithAi,
  resolveActiveProvider,
  loadAiSettings,
  saveAiSettings,
  subscribeAiSettings,
  getServerAiSettingsSnapshot,
} from '@/lib/openrouter';
import SectionErrorBoundary from '@/components/SectionErrorBoundary';
import AiSettingsModal from '@/components/AiSettingsModal';
import AiLeadModal from '@/components/AiLeadModal';
import ExtensionGuideModal from '@/components/ExtensionGuideModal';

const PAGE_SIZE = 25;

function getSocialLabel(url) {
  const lower = (url || '').toLowerCase();
  if (lower.includes('instagram.com') || lower.includes('instagr.am')) return 'Instagram';
  if (lower.includes('tiktok.com')) return 'TikTok';
  if (lower.includes('facebook.com') || lower.includes('fb.')) return 'Facebook';
  if (lower.includes('linktr.ee') || lower.includes('lynk.id') || lower.includes('s.id')) return 'Bio Link';
  return 'Sosmed';
}

function getShopLabel(url) {
  const lower = (url || '').toLowerCase();
  if (lower.includes('shopee.') || lower.includes('shope.ee') || lower.includes('shp.ee')) return 'Shopee';
  if (lower.includes('tokopedia.') || lower.includes('tkp.me')) return 'Tokopedia';
  if (lower.includes('lazada.') || lower.includes('lzd.co')) return 'Lazada';
  if (lower.includes('gofood.') || lower.includes('grab.com')) return 'Food App';
  return 'Olshop';
}

function getQualificationStyles(qual = '') {
  if (qual.includes('HOT')) {
    return {
      pill: 'bg-rose-950/50 text-rose-200 border-rose-900/70 hover:border-rose-700',
      dot: 'bg-rose-400',
    };
  }
  if (qual.includes('COLD')) {
    return {
      pill: 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700',
      dot: 'bg-zinc-500',
    };
  }
  return {
    pill: 'bg-amber-950/40 text-amber-200 border-amber-900/70 hover:border-amber-700',
    dot: 'bg-amber-400',
  };
}

export default function DashboardClient({ initialLeads = [] }) {
  const router = useRouter();
  const [leads, setLeads] = useState(initialLeads);

  // Filter & pagination states
  const [searchQuery, setSearchQuery] = useState('');
  const [websiteFilter, setWebsiteFilter] = useState('ALL'); // 'ALL' | 'NO_WEB' | 'HAS_WEB'
  const [ratingFilter, setRatingFilter] = useState('ALL'); // 'ALL' | '4.5' | '4.0'
  const [channelFilter, setChannelFilter] = useState('ALL'); // 'ALL' | 'HAS_WA' | 'HAS_SHOP' | 'HAS_SOCIAL'
  const [aiFilter, setAiFilter] = useState('ALL'); // 'ALL' | 'HOT' | 'WARM' | 'COLD' | 'UNRESEARCHED'
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [pageState, setPageState] = useState({ page: 1, filterKey: '' });

  // Modals & settings
  const aiSettings = useSyncExternalStore(
    subscribeAiSettings,
    loadAiSettings,
    getServerAiSettingsSnapshot
  );
  const [showAiSettingsModal, setShowAiSettingsModal] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [showExtensionModal, setShowExtensionModal] = useState(false);

  // Action feedback & mutation tracking
  const [analyzingIds, setAnalyzingIds] = useState([]);
  const [deletingIds, setDeletingIds] = useState([]);
  const [deletingAll, setDeletingAll] = useState(false);
  const [unsyncedAiMap, setUnsyncedAiMap] = useState({});
  const [notice, setNotice] = useState(null);
  const [bulkState, setBulkState] = useState({
    running: false,
    done: 0,
    total: 0,
    currentName: '',
    note: '',
  });
  const bulkAbortRef = useRef(null);

  const normalizeWa = useCallback((phone) => {
    if (!phone) return '';
    let digits = String(phone).replace(/[^\d]/g, '');
    if (digits.startsWith('0')) digits = '62' + digits.slice(1);
    if (!digits.startsWith('62') && digits.length >= 8) digits = '62' + digits;
    return digits;
  }, []);

  const selectedAiLead = useMemo(() => {
    if (selectedLeadId === null) return null;
    return leads.find((l) => String(l.id) === String(selectedLeadId)) || null;
  }, [leads, selectedLeadId]);

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const hasWeb = Boolean(lead.website && lead.website.trim().length > 0);
      if (websiteFilter === 'NO_WEB' && hasWeb) return false;
      if (websiteFilter === 'HAS_WEB' && !hasWeb) return false;

      const rVal = parseFloat((lead.rating || '').toString().replace(',', '.'));
      if (ratingFilter === '4.5' && (Number.isNaN(rVal) || rVal < 4.5)) return false;
      if (ratingFilter === '4.0' && (Number.isNaN(rVal) || rVal < 4.0)) return false;

      const hasWa = Boolean(lead.whatsapp || lead.phone);
      const hasShop = Boolean(lead.onlineShop);
      const hasSocial = Boolean(lead.socialMedia);
      if (channelFilter === 'HAS_WA' && !hasWa) return false;
      if (channelFilter === 'HAS_SHOP' && !hasShop) return false;
      if (channelFilter === 'HAS_SOCIAL' && !hasSocial) return false;

      const qual = lead.aiResearch?.leadQualification || '';
      if (aiFilter === 'HOT' && !qual.includes('HOT')) return false;
      if (aiFilter === 'WARM' && !qual.includes('WARM')) return false;
      if (aiFilter === 'COLD' && !qual.includes('COLD')) return false;
      if (aiFilter === 'UNRESEARCHED' && lead.aiResearch) return false;

      const leadCat = lead.categoryName || 'Tanpa Kategori';
      if (categoryFilter !== 'ALL' && leadCat !== categoryFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const haystacks = [
          lead.name,
          lead.address,
          lead.phone,
          lead.whatsapp,
          leadCat,
          lead.socialMedia,
          lead.onlineShop,
        ];
        const matched = haystacks.some((val) => (val || '').toLowerCase().includes(q));
        if (!matched) return false;
      }

      return true;
    });
  }, [leads, searchQuery, websiteFilter, ratingFilter, channelFilter, aiFilter, categoryFilter]);

  const filterKey = `${searchQuery}|${websiteFilter}|${ratingFilter}|${channelFilter}|${aiFilter}|${categoryFilter}`;
  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / PAGE_SIZE));
  const activePage = pageState.filterKey === filterKey ? pageState.page : 1;
  const safePage = Math.min(activePage, totalPages);
  const setCurrentPage = (updater) => {
    setPageState((prev) => {
      const base = prev.filterKey === filterKey ? prev.page : 1;
      const next = typeof updater === 'function' ? updater(base) : updater;
      return { page: next, filterKey };
    });
  };
  const paginatedLeads = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredLeads.slice(start, start + PAGE_SIZE);
  }, [filteredLeads, safePage]);

  const activeFilterCount = [
    websiteFilter !== 'ALL',
    ratingFilter !== 'ALL',
    channelFilter !== 'ALL',
    aiFilter !== 'ALL',
    categoryFilter !== 'ALL',
  ].filter(Boolean).length;

  const hasActiveFilters = searchQuery.trim() !== '' || activeFilterCount > 0;

  const resetAllFilters = () => {
    setSearchQuery('');
    setWebsiteFilter('ALL');
    setRatingFilter('ALL');
    setChannelFilter('ALL');
    setAiFilter('ALL');
    setCategoryFilter('ALL');
  };

  const categoryCounts = useMemo(() => {
    const counts = {};
    leads.forEach((l) => {
      const cat = l.categoryName || 'Tanpa Kategori';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [leads]);

  const availableCategories = useMemo(
    () => Object.keys(categoryCounts).sort(),
    [categoryCounts]
  );

  // KPI metrics
  const totalLeads = leads.length;
  const filteredCount = filteredLeads.length;
  const noWebsiteCount = useMemo(() => leads.filter((l) => !l.website).length, [leads]);
  const hotLeadsCount = useMemo(
    () => leads.filter((l) => l.aiResearch?.leadQualification?.includes('HOT')).length,
    [leads]
  );
  const researchedCount = useMemo(() => leads.filter((l) => Boolean(l.aiResearch)).length, [leads]);
  const waReadyCount = useMemo(
    () => leads.filter((l) => Boolean(l.whatsapp || l.phone)).length,
    [leads]
  );
  const unresearchedInFilter = useMemo(
    () => filteredLeads.filter((l) => !l.aiResearch),
    [filteredLeads]
  );

  const persistAiToDb = useCallback(async (id, aiResearch) => {
    const res = await fetch('/api/leads/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, aiResearch }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    return data.aiResearch || aiResearch;
  }, []);

  async function retryUnsyncedDbSaves(overrideMap) {
    const targetMap = overrideMap || unsyncedAiMap;
    const entries = Object.entries(targetMap);
    if (entries.length === 0) return;

    setNotice({
      type: 'info',
      text: `Menyimpan ulang ${entries.length} hasil analisis AI ke database...`,
    });

    const remaining = { ...targetMap };
    let saved = 0;

    for (const [id, payload] of entries) {
      try {
        await persistAiToDb(id, payload);
        delete remaining[id];
        saved++;
      } catch {
        // Keep failed item in remaining map for subsequent retry
      }
    }

    setUnsyncedAiMap(remaining);
    if (Object.keys(remaining).length === 0) {
      setNotice({
        type: 'success',
        text: `Seluruh ${saved} hasil analisis AI berhasil tersimpan ke Cloud DB.`,
      });
      router.refresh();
    } else {
      setNotice({
        type: 'warning',
        text: `${saved} tersimpan, namun ${Object.keys(remaining).length} data masih gagal disinkronkan ke DB.`,
        actionLabel: 'Coba Simpan Lagi',
        onAction: () => retryUnsyncedDbSaves(remaining),
      });
    }
  }

  const handleSaveAiSettings = (nextSettings) => {
    const saved = saveAiSettings(nextSettings);
    const active = resolveActiveProvider(saved);
    const providerLabel = active === 'deepseek' ? 'DeepSeek' : 'OpenRouter Free';
    setShowAiSettingsModal(false);
    setNotice({
      type: 'success',
      text: `Pengaturan AI disimpan (Provider aktif: ${providerLabel}).`,
    });
  };

  async function handleAnalyzeSingle(lead) {
    if (!lead?.id) return;
    const key = String(lead.id);
    if (analyzingIds.includes(key)) return;

    const latestSettings = loadAiSettings();
    const hasAnyKey = Boolean(
      latestSettings.deepseekApiKey?.trim() || latestSettings.openrouterApiKey?.trim()
    );

    if (!hasAnyKey) {
      setShowAiSettingsModal(true);
      setNotice({
        type: 'warning',
        text: 'Masukkan API Key DeepSeek atau OpenRouter terlebih dahulu untuk menjalankan analisis AI.',
      });
      return;
    }

    setAnalyzingIds((prev) => [...prev, key]);
    setNotice(null);

    try {
      const aiResult = await analyzeLeadWithAi(lead, latestSettings);

      setLeads((prev) =>
        prev.map((item) =>
          String(item.id) === key ? { ...item, aiResearch: aiResult } : item
        )
      );

      try {
        await persistAiToDb(lead.id, aiResult);
        setUnsyncedAiMap((prev) => {
          if (!prev[key]) return prev;
          const copy = { ...prev };
          delete copy[key];
          return copy;
        });
        const fallbackNote = aiResult.fallbackFrom
          ? ` (dialihkan otomatis ke ${aiResult.providerUsed === 'deepseek' ? 'DeepSeek' : 'OpenRouter Free'})`
          : '';
        setNotice({
          type: aiResult.fallbackFrom ? 'warning' : 'success',
          text: `Analisis "${lead.name}" selesai: ${aiResult.leadQualification} (Skor ${aiResult.leadScore}/100)${fallbackNote}.`,
        });
      } catch {
        const nextUnsynced = { ...unsyncedAiMap, [key]: aiResult };
        setUnsyncedAiMap(nextUnsynced);
        setNotice({
          type: 'warning',
          text: `Analisis "${lead.name}" tampil di layar, namun gagal disimpan ke Cloud DB.`,
          actionLabel: 'Simpan Ulang ke DB',
          onAction: () => retryUnsyncedDbSaves(nextUnsynced),
        });
      }
    } catch (err) {
      if (err?.code === 'UNAUTHORIZED' || err?.code === 'MISSING_API_KEY') {
        setShowAiSettingsModal(true);
      }
      setNotice({
        type: 'error',
        text: `Gagal analisis "${lead.name}": ${err?.message || 'Kesalahan provider AI.'}`,
        actionLabel: err?.retryable ? 'Coba Lagi' : undefined,
        onAction: err?.retryable ? () => handleAnalyzeSingle(lead) : undefined,
      });
    } finally {
      setAnalyzingIds((prev) => prev.filter((id) => id !== key));
    }
  }

  const handleSaveEditedPitch = async (leadId, updatedResearch) => {
    const saved = await persistAiToDb(leadId, updatedResearch);
    setLeads((prev) =>
      prev.map((item) =>
        String(item.id) === String(leadId) ? { ...item, aiResearch: saved } : item
      )
    );
  };

  const stopBulkAnalysis = () => {
    if (bulkAbortRef.current) {
      bulkAbortRef.current.abort();
    }
  };

  const handleBulkAnalyze = async () => {
    if (bulkState.running) return;

    const latestSettings = loadAiSettings();
    const hasAnyKey = Boolean(
      latestSettings.deepseekApiKey?.trim() || latestSettings.openrouterApiKey?.trim()
    );

    if (!hasAnyKey) {
      setShowAiSettingsModal(true);
      setNotice({
        type: 'warning',
        text: 'Isi API Key DeepSeek atau OpenRouter terlebih dahulu sebelum menjalankan Riset AI Masal.',
      });
      return;
    }

    const activeProvider = resolveActiveProvider(latestSettings);
    const providerLabel = activeProvider === 'deepseek' ? 'DeepSeek' : 'OpenRouter Free';
    const stepDelayMs = activeProvider === 'deepseek' ? 900 : 3200;

    const queue = unresearchedInFilter;
    if (queue.length === 0) {
      setNotice({
        type: 'info',
        text: 'Seluruh prospek pada filter aktif saat ini sudah memiliki hasil analisis AI.',
      });
      return;
    }

    if (
      !window.confirm(
        `Jalankan analisis AI (${providerLabel}) untuk ${queue.length} prospek pada filter saat ini?`
      )
    ) {
      return;
    }

    const abortController = new AbortController();
    bulkAbortRef.current = abortController;

    setBulkState({
      running: true,
      done: 0,
      total: queue.length,
      currentName: queue[0]?.name || '',
      note: `Memulai antrean via ${providerLabel}...`,
    });
    setNotice(null);

    let completed = 0;
    let failed = 0;

    for (let i = 0; i < queue.length; i++) {
      if (abortController.signal.aborted) break;

      const target = queue[i];
      const key = String(target.id);

      setBulkState((prev) => ({
        ...prev,
        currentName: target.name,
        note: `Memproses [${i + 1}/${queue.length}] (${providerLabel}) — ${target.name}`,
      }));
      setAnalyzingIds((prev) => (prev.includes(key) ? prev : [...prev, key]));

      try {
        let aiResult;
        try {
          aiResult = await analyzeLeadWithAi(target, latestSettings, {
            signal: abortController.signal,
          });
        } catch (err) {
          if (err?.status === 429 && !abortController.signal.aborted) {
            setBulkState((prev) => ({
              ...prev,
              note: 'Rate limit tercapai, menunggu jeda aman 6 detik lalu mencoba kembali...',
            }));
            await new Promise((r) => setTimeout(r, 6200));
            aiResult = await analyzeLeadWithAi(
              target,
              { ...latestSettings, openrouterModel: DEFAULT_OPENROUTER_MODEL },
              { signal: abortController.signal }
            );
          } else {
            throw err;
          }
        }

        setLeads((prev) =>
          prev.map((item) =>
            String(item.id) === key ? { ...item, aiResearch: aiResult } : item
          )
        );

        try {
          await persistAiToDb(target.id, aiResult);
        } catch {
          setUnsyncedAiMap((prev) => ({ ...prev, [key]: aiResult }));
        }

        completed++;
        setBulkState((prev) => ({ ...prev, done: completed }));
      } catch (err) {
        if (err?.code === 'ABORTED') break;
        failed++;
        if (err?.code === 'UNAUTHORIZED' || err?.code === 'MISSING_API_KEY') {
          setShowAiSettingsModal(true);
          setNotice({
            type: 'error',
            text: err.message,
          });
          setAnalyzingIds((prev) => prev.filter((id) => id !== key));
          break;
        }
      } finally {
        setAnalyzingIds((prev) => prev.filter((id) => id !== key));
      }

      if (i < queue.length - 1 && !abortController.signal.aborted) {
        await new Promise((resolve) => {
          const t = setTimeout(resolve, stepDelayMs);
          abortController.signal.addEventListener(
            'abort',
            () => {
              clearTimeout(t);
              resolve();
            },
            { once: true }
          );
        });
      }
    }

    const wasAborted = abortController.signal.aborted;
    bulkAbortRef.current = null;
    setBulkState({
      running: false,
      done: completed,
      total: queue.length,
      currentName: '',
      note: '',
    });

    if (completed > 0 || failed > 0) {
      setNotice({
        type: failed > 0 ? 'warning' : 'success',
        text: wasAborted
          ? `Riset masal dihentikan: ${completed} berhasil disimpan${failed > 0 ? `, ${failed} gagal` : ''}.`
          : `Riset masal selesai: ${completed} prospek berhasil dianalisis${failed > 0 ? `, ${failed} dilewati karena kendala model` : ''}.`,
      });
      router.refresh();
    }
  };

  const executeDeleteLead = async (lead) => {
    const key = String(lead.id);
    if (deletingIds.includes(key)) return;

    const snapshot = leads;
    setDeletingIds((prev) => [...prev, key]);
    setLeads((prev) => prev.filter((l) => String(l.id) !== key));
    if (String(selectedLeadId) === key) setSelectedLeadId(null);

    try {
      const res = await fetch('/api/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lead.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setNotice({
        type: 'success',
        text: `Prospek "${lead.name}" berhasil dihapus.`,
      });
      router.refresh();
    } catch (err) {
      setLeads(snapshot);
      setNotice({
        type: 'error',
        text: `Gagal menghapus "${lead.name}": ${err.message}`,
        actionLabel: 'Coba Hapus Lagi',
        onAction: () => executeDeleteLead(lead),
      });
    } finally {
      setDeletingIds((prev) => prev.filter((id) => id !== key));
    }
  };

  const handleDelete = (lead) => {
    if (!window.confirm(`Hapus prospek "${lead.name}" dari database?`)) return;
    executeDeleteLead(lead);
  };

  const executeDeleteAll = async () => {
    if (deletingAll) return;
    const snapshot = leads;
    setDeletingAll(true);
    setLeads([]);

    try {
      const res = await fetch('/api/delete-all', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setNotice({
        type: 'success',
        text: 'Seluruh data prospek telah dikosongkan dari database.',
      });
      router.refresh();
    } catch (err) {
      setLeads(snapshot);
      setNotice({
        type: 'error',
        text: `Gagal mengosongkan database: ${err.message}`,
        actionLabel: 'Coba Lagi',
        onAction: executeDeleteAll,
      });
    } finally {
      setDeletingAll(false);
    }
  };

  const handleDeleteAll = () => {
    if (leads.length === 0 || deletingAll) return;
    if (!window.confirm(`Yakin ingin menghapus SEMUA (${leads.length}) prospek di database?`)) {
      return;
    }
    executeDeleteAll();
  };

  const handleExportCsv = () => {
    if (filteredLeads.length === 0) {
      setNotice({
        type: 'warning',
        text: 'Tidak ada baris prospek pada filter saat ini untuk diekspor.',
      });
      return;
    }

    const headers = [
      'Nama Bisnis',
      'Rating',
      'Ulasan',
      'Kategori',
      'Alamat',
      'Telepon',
      'WhatsApp',
      'Website Resmi',
      'Sosmed',
      'Online Shop',
      'Kualifikasi AI',
      'Skor AI',
      'Peluang Layanan',
      'Riset Jejak Digital',
      'Pitch WA Utama',
      'Follow Up WA',
      'Maps URL',
      'Tanggal Scrape',
    ];

    const escapeCsv = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;

    const rows = [
      headers.map(escapeCsv).join(','),
      ...filteredLeads.map((l) =>
        [
          l.name,
          l.rating,
          l.reviewCount,
          l.categoryName,
          l.address,
          l.phone,
          l.whatsapp || l.phone,
          l.website,
          l.socialMedia,
          l.onlineShop,
          l.aiResearch?.leadQualification,
          l.aiResearch?.leadScore,
          l.aiResearch?.opportunityType,
          l.aiResearch?.digitalPresenceSummary,
          l.aiResearch?.pitchDraft,
          l.aiResearch?.followUpDraft,
          l.mapsUrl,
          l.scrapedAt,
        ]
          .map(escapeCsv)
          .join(',')
      ),
    ];

    const blob = new Blob(['\uFEFF' + rows.join('\r\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gmaps_leads_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setNotice({
      type: 'success',
      text: `Berhasil mengunduh CSV (${filteredLeads.length} baris prospek).`,
    });
  };

  const hasApiKey = Boolean(
    aiSettings.deepseekApiKey?.trim() || aiSettings.openrouterApiKey?.trim()
  );
  const activeProviderName =
    resolveActiveProvider(aiSettings) === 'deepseek' ? 'DeepSeek' : 'OpenRouter';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-5">
      {/* 1. PAGE HEADER & PRIMARY ACTIONS */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Dashboard Prospek
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            Kelola hasil scraping Google Maps, skor prospek dengan DeepSeek &amp; OpenRouter AI, dan kirim penawaran via WhatsApp.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleBulkAnalyze}
            disabled={bulkState.running || unresearchedInFilter.length === 0}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-white text-zinc-950 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
            title="Analisis otomatis seluruh prospek pada filter aktif yang belum diriset"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>
              Riset AI Masal
              {unresearchedInFilter.length > 0 ? ` (${unresearchedInFilter.length})` : ''}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowAiSettingsModal(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 hover:border-zinc-700 transition-colors"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                hasApiKey ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            <span>AI: {activeProviderName}</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredLeads.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-colors disabled:opacity-40"
          >
            <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setShowExtensionModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-colors"
          >
            <span>Panduan Ekstensi</span>
          </button>

          {totalLeads > 0 && (
            <button
              type="button"
              onClick={handleDeleteAll}
              disabled={deletingAll}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-rose-300 hover:bg-rose-950/30 border border-transparent hover:border-rose-900/50 transition-colors disabled:opacity-40"
            >
              <span>{deletingAll ? 'Menghapus...' : 'Hapus Semua'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. ACTION FEEDBACK & BULK PROGRESS BANNERS */}
      {notice && (
        <div
          role="status"
          className={`p-3.5 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            notice.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-900/70 text-emerald-200'
              : notice.type === 'error'
                ? 'bg-rose-950/40 border-rose-900/70 text-rose-200'
                : notice.type === 'warning'
                  ? 'bg-amber-950/40 border-amber-900/70 text-amber-200'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-200'
          }`}
        >
          <span className="leading-relaxed">{notice.text}</span>
          <div className="flex items-center gap-2 shrink-0">
            {notice.actionLabel && notice.onAction && (
              <button
                type="button"
                onClick={notice.onAction}
                className="px-3 py-1 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-semibold transition-colors"
              >
                {notice.actionLabel}
              </button>
            )}
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="px-2 py-1 rounded-lg text-zinc-400 hover:text-white transition-colors"
              aria-label="Tutup notifikasi"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {bulkState.running && (
        <div className="clean-card rounded-xl p-4 space-y-2.5 border-zinc-700">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-3.5 h-3.5 border-2 border-zinc-400/30 border-t-white rounded-full animate-spin shrink-0" />
              <span className="font-semibold text-white truncate">{bulkState.note}</span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="font-mono text-zinc-400">
                {bulkState.done} / {bulkState.total} selesai
              </span>
              <button
                type="button"
                onClick={stopBulkAnalysis}
                className="px-3 py-1 rounded-lg bg-rose-950/60 hover:bg-rose-900/70 text-rose-200 border border-rose-900/80 font-medium transition-colors"
              >
                Hentikan
              </button>
            </div>
          </div>
          <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full bg-zinc-100 transition-all duration-300"
              style={{
                width: `${
                  bulkState.total > 0
                    ? Math.round((bulkState.done / bulkState.total) * 100)
                    : 0
                }%`,
              }}
            />
          </div>
        </div>
      )}

      {/* 3. INTERACTIVE KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5">
        <button
          type="button"
          onClick={resetAllFilters}
          className="text-left p-4 rounded-xl clean-card-interactive"
        >
          <div className="text-xs font-medium text-zinc-400">Total Prospek</div>
          <div className="text-2xl font-bold text-white tracking-tight mt-1">{totalLeads}</div>
          <div className="text-[11px] text-zinc-500 mt-1">
            {filteredCount} ditampilkan &bull; {researchedCount} diriset AI
          </div>
        </button>

        <button
          type="button"
          onClick={() => setWebsiteFilter(websiteFilter === 'NO_WEB' ? 'ALL' : 'NO_WEB')}
          className={`text-left p-4 rounded-xl border transition-colors ${
            websiteFilter === 'NO_WEB'
              ? 'bg-zinc-800/70 border-zinc-400'
              : 'bg-[#121215] border-zinc-800/80 hover:border-zinc-700'
          }`}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-medium text-zinc-400 truncate">Belum Ada Website</span>
            <span className="text-[10px] text-zinc-300 bg-zinc-800 px-1.5 py-0.5 rounded shrink-0">
              Target
            </span>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight mt-1">{noWebsiteCount}</div>
          <div className="text-[11px] text-zinc-500 mt-1">
            {totalLeads > 0 ? Math.round((noWebsiteCount / totalLeads) * 100) : 0}% dari total data
          </div>
        </button>

        <button
          type="button"
          onClick={() => setAiFilter(aiFilter === 'HOT' ? 'ALL' : 'HOT')}
          className={`text-left p-4 rounded-xl border transition-colors ${
            aiFilter === 'HOT'
              ? 'bg-zinc-800/70 border-zinc-400'
              : 'bg-[#121215] border-zinc-800/80 hover:border-zinc-700'
          }`}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-medium text-zinc-400 truncate">Hot Leads (AI)</span>
            <span className="text-[10px] text-rose-200 bg-rose-950/60 border border-rose-900/60 px-1.5 py-0.5 rounded shrink-0">
              Prioritas
            </span>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight mt-1">{hotLeadsCount}</div>
          <div className="text-[11px] text-zinc-500 mt-1">Potensi konversi tertinggi</div>
        </button>

        <button
          type="button"
          onClick={() => setChannelFilter(channelFilter === 'HAS_WA' ? 'ALL' : 'HAS_WA')}
          className={`text-left p-4 rounded-xl border transition-colors ${
            channelFilter === 'HAS_WA'
              ? 'bg-zinc-800/70 border-zinc-400'
              : 'bg-[#121215] border-zinc-800/80 hover:border-zinc-700'
          }`}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-medium text-zinc-400 truncate">Siap Kontak WA</span>
            <span className="text-[10px] text-emerald-200 bg-emerald-950/60 border border-emerald-900/60 px-1.5 py-0.5 rounded shrink-0">
              Aktif
            </span>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight mt-1">{waReadyCount}</div>
          <div className="text-[11px] text-zinc-500 mt-1">Memiliki nomor telepon / WA</div>
        </button>
      </div>

      {/* 4. FILTER TOOLBAR (COLLAPSIBLE ON MOBILE) */}
      <div className="p-4 rounded-xl clean-card space-y-3.5">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              className="w-full clean-input rounded-xl py-2 pl-9 pr-8 text-xs"
              placeholder="Cari nama bisnis, alamat, nomor WA, atau kategori..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-white text-xs"
                aria-label="Bersihkan pencarian"
              >
                &times;
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMobileFiltersOpen((prev) => !prev)}
            className="md:hidden inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-zinc-900 text-zinc-200 border border-zinc-800 shrink-0"
          >
            <span>Filter</span>
            {activeFilterCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-md bg-zinc-100 text-zinc-950 text-[10px] font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="px-3 py-2 rounded-xl text-xs font-medium text-zinc-300 hover:text-white bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors whitespace-nowrap shrink-0"
            >
              Reset
            </button>
          )}
        </div>

        <div
          className={`${
            mobileFiltersOpen ? 'block' : 'hidden'
          } md:block space-y-3.5 pt-3 border-t border-zinc-800/70 text-xs`}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {/* Website Filter */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                Status Website
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'ALL', label: 'Semua' },
                  { id: 'NO_WEB', label: `Belum Ada (${noWebsiteCount})` },
                  { id: 'HAS_WEB', label: 'Ada Web' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setWebsiteFilter(opt.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                      websiteFilter === opt.id
                        ? 'bg-zinc-100 text-zinc-950 font-semibold shadow-sm'
                        : 'bg-zinc-900/90 text-zinc-400 border border-zinc-800 hover:text-zinc-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Channel Filter */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                Saluran &amp; Toko
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'ALL', label: 'Semua' },
                  { id: 'HAS_WA', label: 'WhatsApp' },
                  { id: 'HAS_SHOP', label: 'Olshop' },
                  { id: 'HAS_SOCIAL', label: 'Sosmed' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setChannelFilter(opt.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                      channelFilter === opt.id
                        ? 'bg-zinc-100 text-zinc-950 font-semibold shadow-sm'
                        : 'bg-zinc-900/90 text-zinc-400 border border-zinc-800 hover:text-zinc-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* AI & Rating Filter */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                Kualifikasi AI &amp; Rating
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'ALL', label: 'Semua' },
                  { id: 'HOT', label: 'Hot' },
                  { id: 'WARM', label: 'Warm' },
                  { id: 'COLD', label: 'Cold' },
                  { id: 'UNRESEARCHED', label: 'Belum Riset' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setAiFilter(opt.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                      aiFilter === opt.id
                        ? 'bg-zinc-100 text-zinc-950 font-semibold shadow-sm'
                        : 'bg-zinc-900/90 text-zinc-400 border border-zinc-800 hover:text-zinc-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setRatingFilter(ratingFilter === '4.5' ? 'ALL' : '4.5')}
                  className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                    ratingFilter === '4.5'
                      ? 'bg-zinc-100 text-zinc-950 font-semibold shadow-sm'
                      : 'bg-zinc-900/90 text-zinc-400 border border-zinc-800 hover:text-zinc-200'
                  }`}
                >
                  Rating &ge; 4.5
                </button>
              </div>
            </div>
          </div>

          {availableCategories.length > 0 && (
            <div className="pt-2.5 border-t border-zinc-800/60 flex items-center gap-1.5 overflow-x-auto pb-1">
              <span className="text-[11px] text-zinc-500 whitespace-nowrap mr-1">Kategori:</span>
              <button
                type="button"
                onClick={() => setCategoryFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg text-xs whitespace-nowrap transition-colors ${
                  categoryFilter === 'ALL'
                    ? 'bg-zinc-100 text-zinc-950 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200 bg-zinc-900/70 border border-zinc-800'
                }`}
              >
                Semua ({totalLeads})
              </button>
              {availableCategories.map((cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setCategoryFilter(categoryFilter === cat ? 'ALL' : cat)}
                  className={`px-2.5 py-1 rounded-lg text-xs whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                    categoryFilter === cat
                      ? 'bg-zinc-100 text-zinc-950 font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200 bg-zinc-900/70 border border-zinc-800'
                  }`}
                >
                  <span>{cat}</span>
                  <span className="text-[10px] opacity-70 font-mono">
                    ({categoryCounts[cat] || 0})
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 5. DATA DISPLAY: EMPTY STATE / MOBILE CARDS / DESKTOP TABLE */}
      <SectionErrorBoundary title="Gagal menampilkan daftar prospek">
        {filteredLeads.length === 0 ? (
          <div className="clean-card rounded-2xl p-10 sm:p-14 text-center space-y-3">
            <div className="w-11 h-11 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h2 className="text-sm font-semibold text-white">
              {totalLeads === 0
                ? 'Belum Ada Prospek Tersimpan'
                : 'Tidak Ada Prospek yang Cocok dengan Filter'}
            </h2>
            <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
              {totalLeads === 0
                ? 'Jalankan ekstensi Chrome di Google Maps lalu tekan Sinkron ke Dashboard, atau unggah file export JSON secara manual.'
                : 'Coba longgarkan filter pencarian atau tekan Reset untuk melihat seluruh data prospek.'}
            </p>
            <div className="pt-1 flex items-center justify-center gap-2">
              {totalLeads === 0 ? (
                <Link
                  href="/import"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-white text-zinc-950 transition-colors"
                >
                  Import File JSON
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-white text-zinc-950 transition-colors"
                >
                  Reset Semua Filter
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* MOBILE & TABLET CARD VIEW (< lg) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:hidden">
              {paginatedLeads.map((lead, idx) => {
                const key = String(lead.id ?? idx);
                const isAnalyzing = analyzingIds.includes(key);
                const isDeleting = deletingIds.includes(key);
                const waDigits = normalizeWa(lead.whatsapp || lead.phone);
                const qual = lead.aiResearch?.leadQualification || '';
                const score = lead.aiResearch?.leadScore;
                const qualStyle = getQualificationStyles(qual);

                const defaultPitch = `Halo Kak ${lead.name}, salam kenal dari ${aiSettings.agencyName || 'Tim Web Developer'}. Kami melihat profil bisnis Kakak di Google Maps dan ingin menawarkan pembuatan website katalog mandiri agar pelanggan lebih mudah order. Boleh kami kirimkan contoh demonya Kak?`;
                const waText = lead.aiResearch?.pitchDraft || defaultPitch;
                const waUrl = waDigits
                  ? `https://wa.me/${waDigits}?text=${encodeURIComponent(waText)}`
                  : '';
                const mapsHref =
                  lead.mapsUrl ||
                  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    `${lead.name} ${lead.address || ''}`.trim()
                  )}`;

                return (
                  <div
                    key={key}
                    className="clean-card rounded-xl p-4 flex flex-col justify-between gap-3.5"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-white leading-snug line-clamp-2">
                            {lead.name}
                          </h3>
                          <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
                            {lead.categoryName || 'Bisnis Lokal'}
                          </p>
                        </div>

                        {lead.rating && (
                          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-xs font-medium text-amber-400">
                            <span>&#9733; {lead.rating}</span>
                            <span className="text-[10px] text-zinc-500">
                              ({lead.reviewCount || 0})
                            </span>
                          </span>
                        )}
                      </div>

                      {lead.address && (
                        <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                          {lead.address}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        {lead.website ? (
                          <a
                            href={lead.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-0.5 rounded-md bg-zinc-900 text-zinc-200 border border-zinc-700 hover:border-zinc-500 underline underline-offset-2"
                          >
                            Website Resmi
                          </a>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-zinc-900/90 text-zinc-400 border border-zinc-800">
                            Belum Ada Web
                          </span>
                        )}

                        {lead.onlineShop && (
                          <a
                            href={lead.onlineShop}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-0.5 rounded-md bg-zinc-900 text-zinc-300 border border-zinc-800 hover:border-zinc-600"
                          >
                            {getShopLabel(lead.onlineShop)}
                          </a>
                        )}

                        {lead.socialMedia && (
                          <a
                            href={lead.socialMedia}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-0.5 rounded-md bg-zinc-900 text-zinc-300 border border-zinc-800 hover:border-zinc-600"
                          >
                            {getSocialLabel(lead.socialMedia)}
                          </a>
                        )}

                        {(lead.whatsapp || lead.phone) && (
                          <span className="px-2 py-0.5 rounded-md bg-zinc-900/60 text-zinc-300 border border-zinc-800/80 font-mono">
                            {lead.whatsapp || lead.phone}
                          </span>
                        )}
                      </div>

                      {lead.aiResearch && (
                        <button
                          type="button"
                          onClick={() => setSelectedLeadId(lead.id)}
                          className="w-full text-left p-2.5 rounded-lg bg-[#18181b] border border-zinc-800 hover:border-zinc-700 transition-colors space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-zinc-200">
                              <span className={`w-1.5 h-1.5 rounded-full ${qualStyle.dot}`} />
                              <span>{qual}</span>
                              {typeof score === 'number' && (
                                <span className="text-zinc-400 font-mono">({score})</span>
                              )}
                            </span>
                            <span className="text-[10px] text-zinc-400">Lihat Pitch &rarr;</span>
                          </div>
                          {lead.aiResearch.digitalPresenceSummary && (
                            <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                              {lead.aiResearch.digitalPresenceSummary}
                            </p>
                          )}
                        </button>
                      )}
                    </div>

                    <div className="pt-2.5 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {waUrl ? (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-100 hover:bg-white text-zinc-950 transition-colors"
                          >
                            Chat WA
                          </a>
                        ) : (
                          <span className="px-2.5 py-1.5 rounded-lg text-xs text-zinc-600 bg-zinc-900/60 border border-zinc-800/60">
                            Tanpa WA
                          </span>
                        )}

                        {lead.aiResearch ? (
                          <button
                            type="button"
                            onClick={() => setSelectedLeadId(lead.id)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 transition-colors"
                          >
                            Detail AI
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAnalyzeSingle(lead)}
                            disabled={isAnalyzing}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 transition-colors disabled:opacity-50"
                          >
                            {isAnalyzing && (
                              <span className="w-3 h-3 border-2 border-zinc-400/30 border-t-white rounded-full animate-spin" />
                            )}
                            <span>{isAnalyzing ? 'Menganalisis...' : 'Analisis AI'}</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <a
                          href={mapsHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-colors"
                        >
                          Maps
                        </a>
                        <button
                          type="button"
                          onClick={() => handleDelete(lead)}
                          disabled={isDeleting}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors disabled:opacity-40"
                          title="Hapus prospek ini"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* DESKTOP TABLE VIEW (lg+) */}
            <div className="hidden lg:block rounded-xl clean-card overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-800 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider bg-[#16161a]">
                      <th className="py-3.5 px-4">Nama Bisnis</th>
                      <th className="py-3.5 px-3">Rating</th>
                      <th className="py-3.5 px-4">Alamat</th>
                      <th className="py-3.5 px-4">Kontak</th>
                      <th className="py-3.5 px-3">Website</th>
                      <th className="py-3.5 px-3">Sosmed / Olshop</th>
                      <th className="py-3.5 px-3">Kualifikasi AI</th>
                      <th className="py-3.5 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 text-xs text-zinc-300">
                    {paginatedLeads.map((lead, idx) => {
                      const key = String(lead.id ?? idx);
                      const isAnalyzing = analyzingIds.includes(key);
                      const isDeleting = deletingIds.includes(key);
                      const waDigits = normalizeWa(lead.whatsapp || lead.phone);
                      const qual = lead.aiResearch?.leadQualification || '';
                      const score = lead.aiResearch?.leadScore;
                      const qualStyle = getQualificationStyles(qual);

                      const defaultPitch = `Halo Kak ${lead.name}, salam kenal dari ${aiSettings.agencyName || 'Tim Web Developer'}. Kami melihat profil bisnis Kakak di Google Maps dan ingin menawarkan pembuatan website katalog mandiri agar pelanggan lebih mudah order. Boleh kami kirimkan contoh demonya Kak?`;
                      const waText = lead.aiResearch?.pitchDraft || defaultPitch;
                      const waUrl = waDigits
                        ? `https://wa.me/${waDigits}?text=${encodeURIComponent(waText)}`
                        : '';
                      const mapsHref =
                        lead.mapsUrl ||
                        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          `${lead.name} ${lead.address || ''}`.trim()
                        )}`;

                      return (
                        <tr key={key} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="py-3 px-4 max-w-[210px]">
                            <div className="font-medium text-white truncate" title={lead.name}>
                              {lead.name}
                            </div>
                            <div className="text-[11px] text-zinc-500 truncate mt-0.5">
                              {lead.categoryName || 'Bisnis Lokal'}
                            </div>
                          </td>

                          <td className="py-3 px-3 whitespace-nowrap">
                            {lead.rating ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-amber-400 font-medium">
                                  &#9733; {lead.rating}
                                </span>
                                <span className="text-[11px] text-zinc-500">
                                  ({lead.reviewCount || 0})
                                </span>
                              </div>
                            ) : (
                              <span className="text-zinc-600">-</span>
                            )}
                          </td>

                          <td className="py-3 px-4 max-w-[220px]">
                            <div className="text-zinc-400 truncate" title={lead.address}>
                              {lead.address || '-'}
                            </div>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="font-mono text-zinc-200">{lead.phone || '-'}</div>
                            {lead.whatsapp && lead.whatsapp !== lead.phone && (
                              <div className="font-mono text-zinc-400 text-[11px]">
                                WA: {lead.whatsapp}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-3 whitespace-nowrap">
                            {lead.website ? (
                              <a
                                href={lead.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-zinc-300 hover:text-white underline underline-offset-2 text-xs"
                              >
                                Buka Web &#8599;
                              </a>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md text-[11px] bg-zinc-900 text-zinc-400 border border-zinc-800">
                                Belum Ada
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {lead.onlineShop && (
                                <a
                                  href={lead.onlineShop}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2 py-0.5 rounded-md text-[11px] bg-zinc-900 text-zinc-300 border border-zinc-800 hover:border-zinc-600"
                                >
                                  {getShopLabel(lead.onlineShop)}
                                </a>
                              )}
                              {lead.socialMedia && (
                                <a
                                  href={lead.socialMedia}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2 py-0.5 rounded-md text-[11px] bg-zinc-900 text-zinc-300 border border-zinc-800 hover:border-zinc-600"
                                >
                                  {getSocialLabel(lead.socialMedia)}
                                </a>
                              )}
                              {!lead.onlineShop && !lead.socialMedia && (
                                <span className="text-zinc-600">-</span>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-3 whitespace-nowrap">
                            {isAnalyzing ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-zinc-900 text-zinc-300 border border-zinc-700">
                                <span className="w-3 h-3 border-2 border-zinc-400/30 border-t-white rounded-full animate-spin" />
                                <span>Menganalisis...</span>
                              </span>
                            ) : lead.aiResearch ? (
                              <button
                                type="button"
                                onClick={() => setSelectedLeadId(lead.id)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors inline-flex items-center gap-1.5 ${qualStyle.pill}`}
                                title="Klik untuk melihat detail riset & draft pesan WhatsApp"
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${qualStyle.dot}`} />
                                <span>{qual || 'WARM LEAD'}</span>
                                {typeof score === 'number' && (
                                  <span className="opacity-75 font-mono">&bull; {score}</span>
                                )}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleAnalyzeSingle(lead)}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 hover:border-zinc-500 transition-colors"
                              >
                                Analisis AI
                              </button>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              {waUrl ? (
                                <a
                                  href={waUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2.5 py-1 bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold rounded-lg transition-colors"
                                >
                                  Chat WA
                                </a>
                              ) : (
                                <span className="text-zinc-600 text-xs px-2">-</span>
                              )}

                              <a
                                href={mapsHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-1 text-zinc-400 hover:text-white text-xs font-medium rounded-lg hover:bg-zinc-800 transition-colors"
                              >
                                Maps
                              </a>

                              <button
                                type="button"
                                disabled={isDeleting}
                                className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors disabled:opacity-40"
                                onClick={() => handleDelete(lead)}
                                title="Hapus baris ini"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* PAGINATION FOOTER */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1 text-xs text-zinc-400">
                <span>
                  Menampilkan {(safePage - 1) * PAGE_SIZE + 1}&ndash;
                  {Math.min(safePage * PAGE_SIZE, filteredLeads.length)} dari {filteredLeads.length} prospek
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Sebelumnya
                  </button>
                  <span className="px-3 py-1.5 font-mono text-zinc-300">
                    Hal {safePage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Berikutnya
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </SectionErrorBoundary>

      {/* MODALS */}
      <SectionErrorBoundary title="Gagal memuat jendela pengaturan AI">
        {showAiSettingsModal && (
          <AiSettingsModal
            key={`settings-${aiSettings.primaryProvider}-${hasApiKey ? 'ready' : 'empty'}`}
            settings={aiSettings}
            onClose={() => setShowAiSettingsModal(false)}
            onSave={handleSaveAiSettings}
          />
        )}
      </SectionErrorBoundary>

      <SectionErrorBoundary title="Gagal memuat detail riset AI">
        {selectedAiLead && (
          <AiLeadModal
            key={`lead-${selectedAiLead.id}-${selectedAiLead.aiResearch?.analyzedAt || 'init'}`}
            lead={selectedAiLead}
            isAnalyzing={analyzingIds.includes(String(selectedAiLead.id))}
            onClose={() => setSelectedLeadId(null)}
            onReanalyze={handleAnalyzeSingle}
            onSaveEditedPitch={handleSaveEditedPitch}
            normalizeWa={normalizeWa}
          />
        )}
      </SectionErrorBoundary>

      <ExtensionGuideModal
        open={showExtensionModal}
        onClose={() => setShowExtensionModal(false)}
      />
    </div>
  );
}
