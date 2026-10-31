'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardClient({ initialLeads = [], categories = [] }) {
  const router = useRouter();
  const [leads, setLeads] = useState(initialLeads);
  const [searchQuery, setSearchQuery] = useState('');
  const [websiteFilter, setWebsiteFilter] = useState('ALL'); // 'ALL' | 'NO_WEB' | 'HAS_WEB'
  const [ratingFilter, setRatingFilter] = useState('ALL'); // 'ALL' | '4.5' | '4.0'
  const [channelFilter, setChannelFilter] = useState('ALL'); // 'ALL' | 'HAS_WA' | 'HAS_SHOP' | 'HAS_SOCIAL'
  const [aiFilter, setAiFilter] = useState('ALL'); // 'ALL' | 'HOT' | 'WARM' | 'COLD' | 'UNRESEARCHED'
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  
  const [selectedAiLead, setSelectedAiLead] = useState(null);
  const [showExtensionModal, setShowExtensionModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Sync state leads jika initialLeads dari server berubah
  useEffect(() => {
    setLeads(initialLeads);
  }, [initialLeads]);

  // Normalisasi nomor telepon ke wa.me (format 62...)
  const normalizeWa = (phone) => {
    if (!phone) return '';
    let digits = phone.replace(/[^\d]/g, '');
    if (digits.startsWith('0')) digits = '62' + digits.slice(1);
    if (!digits.startsWith('62') && digits.length >= 8) digits = '62' + digits;
    return digits;
  };

  // Filter Utama Berdasarkan Semua Kriteria
  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      // 1. Filter Status Website
      const hasWeb = !!lead.website && lead.website.trim().length > 0;
      if (websiteFilter === 'NO_WEB' && hasWeb) return false;
      if (websiteFilter === 'HAS_WEB' && !hasWeb) return false;

      // 2. Filter Rating
      const rVal = parseFloat((lead.rating || '').toString().replace(',', '.'));
      if (ratingFilter === '4.5') {
        if (isNaN(rVal) || rVal < 4.5) return false;
      } else if (ratingFilter === '4.0') {
        if (isNaN(rVal) || rVal < 4.0) return false;
      }

      // 3. Filter Saluran / Kontak
      const hasWa = !!(lead.whatsapp || lead.phone);
      const hasShop = !!lead.onlineShop;
      const hasSocial = !!lead.socialMedia;
      if (channelFilter === 'HAS_WA' && !hasWa) return false;
      if (channelFilter === 'HAS_SHOP' && !hasShop) return false;
      if (channelFilter === 'HAS_SOCIAL' && !hasSocial) return false;

      // 4. Filter Kualifikasi AI
      const qual = lead.aiResearch?.leadQualification || '';
      if (aiFilter === 'HOT' && !qual.includes('HOT')) return false;
      if (aiFilter === 'WARM' && !qual.includes('WARM')) return false;
      if (aiFilter === 'COLD' && !qual.includes('COLD')) return false;
      if (aiFilter === 'UNRESEARCHED' && lead.aiResearch) return false;

      // 5. Filter Kategori Bisnis
      const leadCat = lead.categoryName || 'Tanpa Kategori';
      if (categoryFilter !== 'ALL' && leadCat !== categoryFilter) return false;

      // 6. Pencarian Teks Bebas
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (lead.name || '').toLowerCase().includes(q);
        const matchAddress = (lead.address || '').toLowerCase().includes(q);
        const matchPhone = (lead.phone || '').toLowerCase().includes(q);
        const matchWa = (lead.whatsapp || '').toLowerCase().includes(q);
        const matchCat = leadCat.toLowerCase().includes(q);
        const matchSocial = (lead.socialMedia || '').toLowerCase().includes(q);
        const matchShop = (lead.onlineShop || '').toLowerCase().includes(q);
        if (!matchName && !matchAddress && !matchPhone && !matchWa && !matchCat && !matchSocial && !matchShop) {
          return false;
        }
      }

      return true;
    });
  }, [leads, searchQuery, websiteFilter, ratingFilter, channelFilter, aiFilter, categoryFilter]);

  const hasActiveFilters = searchQuery !== '' || 
    websiteFilter !== 'ALL' || 
    ratingFilter !== 'ALL' || 
    channelFilter !== 'ALL' || 
    aiFilter !== 'ALL' || 
    categoryFilter !== 'ALL';

  const resetAllFilters = () => {
    setSearchQuery('');
    setWebsiteFilter('ALL');
    setRatingFilter('ALL');
    setChannelFilter('ALL');
    setAiFilter('ALL');
    setCategoryFilter('ALL');
  };

  // Hapus satu baris lead (langsung hilang dari layar seketika)
  const handleDelete = async (id, name) => {
    if (!confirm(`Hapus data bisnis "${name}"?`)) return;

    // 1. Instan hapus dari state UI (0 ms)
    setLeads(prev => prev.filter(l => String(l.id) !== String(id)));

    // 2. Sync ke database
    try {
      await fetch('/api/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      router.refresh();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  // Hapus semua data (langsung kosong dari layar seketika)
  const handleDeleteAll = async () => {
    if (!confirm('Yakin ingin menghapus SEMUA data leads di sistem?')) return;

    // 1. Instan kosongkan state UI
    setLeads([]);

    // 2. Sync ke database
    try {
      await fetch('/api/delete-all', { method: 'POST' });
      router.refresh();
    } catch (err) {
      console.error('Delete all error:', err);
    }
  };

  const handleExportCsv = () => {
    if (filteredLeads.length === 0) {
      alert('Tidak ada data untuk diexport.');
      return;
    }

    const headers = [
      'Nama Bisnis', 'Rating', 'Ulasan', 'Kategori', 'Alamat', 
      'Telepon', 'WhatsApp', 'Website Resmi', 'Sosmed', 'Online Shop', 
      'Kualifikasi AI', 'Riset Jejak Digital', 'Pitch AI', 'Maps URL', 'Tanggal Scrape'
    ];

    const rows = [headers];

    filteredLeads.forEach(l => {
      rows.push([
        `"${(l.name || '').replace(/"/g, '""')}"`,
        `"${(l.rating || '').replace(/"/g, '""')}"`,
        `"${(l.reviewCount || '').replace(/"/g, '""')}"`,
        `"${(l.categoryName || '').replace(/"/g, '""')}"`,
        `"${(l.address || '').replace(/"/g, '""')}"`,
        `"${(l.phone || '').replace(/"/g, '""')}"`,
        `"${(l.whatsapp || l.phone || '').replace(/"/g, '""')}"`,
        `"${(l.website || '').replace(/"/g, '""')}"`,
        `"${(l.socialMedia || '').replace(/"/g, '""')}"`,
        `"${(l.onlineShop || '').replace(/"/g, '""')}"`,
        `"${(l.aiResearch?.leadQualification || '').replace(/"/g, '""')}"`,
        `"${(l.aiResearch?.digitalPresenceSummary || '').replace(/"/g, '""')}"`,
        `"${(l.aiResearch?.pitchDraft || '').replace(/"/g, '""')}"`,
        `"${(l.mapsUrl || '').replace(/"/g, '""')}"`,
        `"${(l.scrapedAt || '').replace(/"/g, '""')}"`
      ]);
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `leads_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyPitch = (text) => {
    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  // Kategori unik dengan jumlah
  const categoryCounts = useMemo(() => {
    const counts = {};
    leads.forEach(l => {
      const cat = l.categoryName || 'Tanpa Kategori';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [leads]);

  const availableCategories = Object.keys(categoryCounts).sort();

  // Statistik Dinamis
  const totalLeads = leads.length;
  const filteredCount = filteredLeads.length;
  const noWebsiteCount = leads.filter(l => !l.website).length;
  const hotLeadsCount = leads.filter(l => l.aiResearch?.leadQualification === 'HOT LEAD').length;
  const hasOlshopCount = leads.filter(l => l.onlineShop || l.socialMedia).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* 1. HEADER HALAMAN & AKSI CEPAT */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-800/80">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Dashboard Leads
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Kelola prospek bisnis hasil scraping Google Maps, kualifikasi AI, dan kontak WhatsApp.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowExtensionModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium bg-zinc-100 hover:bg-white text-zinc-950 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4 text-zinc-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            <span>Bagi Ekstensi ke Teman</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-colors"
            title="Download CSV"
          >
            <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={handleDeleteAll}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-red-400 hover:bg-red-950/20 transition-colors"
            title="Hapus seluruh data di database"
          >
            <span>Hapus Semua</span>
          </button>
        </div>
      </div>

      {/* 2. STATS CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        {/* Total Leads */}
        <div className="p-4 rounded-xl bg-[#121215] border border-zinc-800/80">
          <div className="text-xs font-medium text-zinc-400">Total Leads</div>
          <div className="text-2xl font-bold text-white tracking-tight mt-1">{totalLeads}</div>
          <div className="text-[11px] text-zinc-500 mt-1">{filteredCount} cocok filter</div>
        </div>

        {/* Belum Punya Website */}
        <div 
          onClick={() => setWebsiteFilter(websiteFilter === 'NO_WEB' ? 'ALL' : 'NO_WEB')}
          className={`p-4 rounded-xl border cursor-pointer transition-colors ${
            websiteFilter === 'NO_WEB' 
              ? 'bg-zinc-800/60 border-zinc-500' 
              : 'bg-[#121215] border-zinc-800/80 hover:border-zinc-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Belum Punya Website</span>
            <span className="text-[10px] text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded">Prospek</span>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight mt-1">{noWebsiteCount}</div>
          <div className="text-[11px] text-zinc-500 mt-1">
            {totalLeads > 0 ? Math.round((noWebsiteCount / totalLeads) * 100) : 0}% dari total
          </div>
        </div>

        {/* Hot Leads */}
        <div 
          onClick={() => setAiFilter(aiFilter === 'HOT' ? 'ALL' : 'HOT')}
          className={`p-4 rounded-xl border cursor-pointer transition-colors ${
            aiFilter === 'HOT' 
              ? 'bg-zinc-800/60 border-zinc-500' 
              : 'bg-[#121215] border-zinc-800/80 hover:border-zinc-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Hot Leads (AI)</span>
            <span className="text-[10px] text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded">Prioritas</span>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight mt-1">{hotLeadsCount}</div>
          <div className="text-[11px] text-zinc-500 mt-1">Siap dihubungi</div>
        </div>

        {/* Punya Olshop / Sosmed */}
        <div 
          onClick={() => setChannelFilter(channelFilter === 'HAS_SHOP' ? 'ALL' : 'HAS_SHOP')}
          className={`p-4 rounded-xl border cursor-pointer transition-colors ${
            channelFilter === 'HAS_SHOP' 
              ? 'bg-zinc-800/60 border-zinc-500' 
              : 'bg-[#121215] border-zinc-800/80 hover:border-zinc-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Olshop / Sosmed</span>
            <span className="text-[10px] text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded">Shopee/IG</span>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight mt-1">{hasOlshopCount}</div>
          <div className="text-[11px] text-zinc-500 mt-1">Ada link toko/sosmed</div>
        </div>

      </div>

      {/* 3. TOOLBAR FILTER TUNGGAL & KONSISTEN */}
      <div className="p-4 rounded-xl bg-[#121215] border border-zinc-800/80 space-y-4">
        
        {/* Search Bar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input 
              type="text" 
              className="w-full bg-[#18181b] border border-zinc-800 rounded-lg py-2 pl-9 pr-8 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors" 
              placeholder="Cari nama bisnis, alamat, no telp, WA, atau kategori..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button 
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="px-3 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors whitespace-nowrap"
            >
              Reset Filter ↺
            </button>
          )}
        </div>

        {/* Filter Groups */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-zinc-800/60 text-xs">
          
          {/* Website Filter */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block">Website</span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setWebsiteFilter('ALL')}
                className={`px-3 py-1 rounded-lg text-xs transition-colors ${
                  websiteFilter === 'ALL'
                    ? 'bg-white text-zinc-950 font-semibold shadow-sm'
                    : 'bg-zinc-900/80 text-zinc-400 border border-zinc-800 hover:text-zinc-200 hover:border-zinc-700'
                }`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setWebsiteFilter('NO_WEB')}
                className={`px-3 py-1 rounded-lg text-xs transition-colors flex items-center gap-1 ${
                  websiteFilter === 'NO_WEB'
                    ? 'bg-white text-zinc-950 font-semibold shadow-sm'
                    : 'bg-zinc-900/80 text-zinc-400 border border-zinc-800 hover:text-zinc-200 hover:border-zinc-700'
                }`}
              >
                <span>Belum Ada Web</span>
                <span className="text-[10px] text-zinc-400 font-mono">({noWebsiteCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setWebsiteFilter('HAS_WEB')}
                className={`px-3 py-1 rounded-lg text-xs transition-colors ${
                  websiteFilter === 'HAS_WEB'
                    ? 'bg-white text-zinc-950 font-semibold shadow-sm'
                    : 'bg-zinc-900/80 text-zinc-400 border border-zinc-800 hover:text-zinc-200 hover:border-zinc-700'
                }`}
              >
                Ada Web
              </button>
            </div>
          </div>

          {/* Saluran & Kontak */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block">Kontak & Toko</span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setChannelFilter('ALL')}
                className={`px-3 py-1 rounded-lg text-xs transition-colors ${
                  channelFilter === 'ALL'
                    ? 'bg-white text-zinc-950 font-semibold shadow-sm'
                    : 'bg-zinc-900/80 text-zinc-400 border border-zinc-800 hover:text-zinc-200 hover:border-zinc-700'
                }`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setChannelFilter('HAS_WA')}
                className={`px-3 py-1 rounded-lg text-xs transition-colors ${
                  channelFilter === 'HAS_WA'
                    ? 'bg-white text-zinc-950 font-semibold shadow-sm'
                    : 'bg-zinc-900/80 text-zinc-400 border border-zinc-800 hover:text-zinc-200 hover:border-zinc-700'
                }`}
              >
                WhatsApp
              </button>
              <button
                type="button"
                onClick={() => setChannelFilter('HAS_SHOP')}
                className={`px-3 py-1 rounded-lg text-xs transition-colors ${
                  channelFilter === 'HAS_SHOP'
                    ? 'bg-white text-zinc-950 font-semibold shadow-sm'
                    : 'bg-zinc-900/80 text-zinc-400 border border-zinc-800 hover:text-zinc-200 hover:border-zinc-700'
                }`}
              >
                Shopee/Olshop
              </button>
              <button
                type="button"
                onClick={() => setChannelFilter('HAS_SOCIAL')}
                className={`px-3 py-1 rounded-lg text-xs transition-colors ${
                  channelFilter === 'HAS_SOCIAL'
                    ? 'bg-white text-zinc-950 font-semibold shadow-sm'
                    : 'bg-zinc-900/80 text-zinc-400 border border-zinc-800 hover:text-zinc-200 hover:border-zinc-700'
                }`}
              >
                Sosmed
              </button>
            </div>
          </div>

          {/* AI & Rating */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block">Kualifikasi AI</span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setAiFilter('ALL')}
                className={`px-3 py-1 rounded-lg text-xs transition-colors ${
                  aiFilter === 'ALL'
                    ? 'bg-white text-zinc-950 font-semibold shadow-sm'
                    : 'bg-zinc-900/80 text-zinc-400 border border-zinc-800 hover:text-zinc-200 hover:border-zinc-700'
                }`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setAiFilter('HOT')}
                className={`px-3 py-1 rounded-lg text-xs transition-colors flex items-center gap-1 ${
                  aiFilter === 'HOT'
                    ? 'bg-white text-zinc-950 font-semibold shadow-sm'
                    : 'bg-zinc-900/80 text-zinc-400 border border-zinc-800 hover:text-zinc-200 hover:border-zinc-700'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                <span>Hot Lead</span>
              </button>
              <button
                type="button"
                onClick={() => setRatingFilter(ratingFilter === '4.5' ? 'ALL' : '4.5')}
                className={`px-3 py-1 rounded-lg text-xs transition-colors ${
                  ratingFilter === '4.5'
                    ? 'bg-white text-zinc-950 font-semibold shadow-sm'
                    : 'bg-zinc-900/80 text-zinc-400 border border-zinc-800 hover:text-zinc-200 hover:border-zinc-700'
                }`}
              >
                Rating ≥ 4.5
              </button>
            </div>
          </div>

        </div>

        {/* Kategori Bisnis Horizontal Scroll */}
        {availableCategories.length > 0 && (
          <div className="pt-2 border-t border-zinc-800/60 flex items-center gap-2 overflow-x-auto text-xs pb-1">
            <span className="text-[11px] text-zinc-500 whitespace-nowrap">Kategori:</span>
            <button
              type="button"
              onClick={() => setCategoryFilter('ALL')}
              className={`px-2.5 py-1 rounded-md text-xs whitespace-nowrap transition-colors ${
                categoryFilter === 'ALL'
                  ? 'bg-white text-zinc-950 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 bg-zinc-900/60 border border-zinc-800'
              }`}
            >
              Semua ({totalLeads})
            </button>
            {availableCategories.map(cat => (
              <button
                type="button"
                key={cat}
                onClick={() => setCategoryFilter(categoryFilter === cat ? 'ALL' : cat)}
                className={`px-2.5 py-1 rounded-md text-xs whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  categoryFilter === cat
                    ? 'bg-white text-zinc-950 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200 bg-zinc-900/60 border border-zinc-800'
                }`}
              >
                <span>{cat}</span>
                <span className="text-[10px] text-zinc-500 font-mono">({categoryCounts[cat] || 0})</span>
              </button>
            ))}
          </div>
        )}

      </div>

      {/* 4. TABEL HASIL DATA */}
      <div className="rounded-xl bg-[#121215] border border-zinc-800/80 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider bg-[#16161a]">
                <th className="py-3 px-4">Nama Bisnis</th>
                <th className="py-3 px-3">Rating</th>
                <th className="py-3 px-4">Kategori & Alamat</th>
                <th className="py-3 px-4">Kontak</th>
                <th className="py-3 px-3">Website</th>
                <th className="py-3 px-3">Sosmed / Olshop</th>
                <th className="py-3 px-3">Kualifikasi AI</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-xs text-zinc-300">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-12 text-center text-zinc-500 text-xs">
                    {totalLeads === 0 
                      ? 'Belum ada data prospek. Buka Google Maps, scraping bisnis dengan ekstensi, lalu klik tombol "Sinkron ke Dashboard".'
                      : 'Tidak ada data yang cocok dengan filter saat ini.'}
                  </td>
                </tr>
              ) : filteredLeads.map((lead, idx) => {
                const waDigits = normalizeWa(lead.whatsapp || lead.phone);
                const qual = lead.aiResearch?.leadQualification;
                const pitchDraft = lead.aiResearch?.pitchDraft;

                const waPitchText = pitchDraft || `Halo kak ${lead.name}, salam kenal dari tim Web Developer. Kami melihat profil bisnis kakak di Google Maps dan ingin menawarkan pembuatan website katalog mandiri agar hemat komisi marketplace. Boleh kami kirimkan contoh demonya kak?`;
                const waUrl = waDigits ? `https://wa.me/${waDigits}?text=${encodeURIComponent(waPitchText)}` : '';

                return (
                  <tr key={lead.id || idx} className="hover:bg-zinc-800/30 transition-colors">
                    
                    {/* Nama Bisnis */}
                    <td className="py-3 px-4 max-w-[200px]">
                      <div className="font-medium text-white truncate" title={lead.name}>
                        {lead.name}
                      </div>
                      <div className="text-[11px] text-zinc-500 truncate mt-0.5">
                        {lead.categoryName || 'Bisnis'}
                      </div>
                    </td>

                    {/* Rating */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {lead.rating ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-amber-400 font-medium">★ {lead.rating}</span>
                          <span className="text-[11px] text-zinc-500">({lead.reviewCount || 0})</span>
                        </div>
                      ) : (
                        <span className="text-zinc-600">-</span>
                      )}
                    </td>

                    {/* Alamat */}
                    <td className="py-3 px-4 max-w-[220px]">
                      <div className="text-zinc-400 truncate" title={lead.address}>
                        {lead.address || '-'}
                      </div>
                    </td>

                    {/* Kontak */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-mono text-zinc-200">{lead.phone || '-'}</div>
                      {lead.whatsapp && lead.whatsapp !== lead.phone && (
                        <div className="font-mono text-zinc-400 text-[11px]">WA: {lead.whatsapp}</div>
                      )}
                    </td>

                    {/* Website */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {lead.website ? (
                        <a 
                          href={lead.website} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-zinc-300 hover:text-white underline underline-offset-2 text-xs"
                        >
                          Buka Web ↗
                        </a>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[11px] bg-zinc-900 text-zinc-400 border border-zinc-800">
                          Belum Ada
                        </span>
                      )}
                    </td>

                    {/* Sosmed / Olshop */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {lead.onlineShop && (
                          <a 
                            href={lead.onlineShop} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="px-2 py-0.5 rounded text-[11px] bg-zinc-900 text-zinc-300 border border-zinc-800 hover:border-zinc-700"
                          >
                            Olshop
                          </a>
                        )}
                        {lead.socialMedia && (
                          <a 
                            href={lead.socialMedia} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="px-2 py-0.5 rounded text-[11px] bg-zinc-900 text-zinc-300 border border-zinc-800 hover:border-zinc-700"
                          >
                            Sosmed
                          </a>
                        )}
                        {!lead.onlineShop && !lead.socialMedia && (
                          <span className="text-zinc-600">-</span>
                        )}
                      </div>
                    </td>

                    {/* Kualifikasi AI */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {lead.aiResearch ? (
                        <button 
                          type="button"
                          onClick={() => setSelectedAiLead(lead)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-zinc-900 text-zinc-300 border border-zinc-800 hover:border-zinc-700 flex items-center gap-1.5"
                          title="Lihat detail riset AI"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${qual === 'HOT LEAD' ? 'bg-red-400' : 'bg-amber-400'}`}></span>
                          <span>{qual || 'WARM LEAD'}</span>
                        </button>
                      ) : (
                        <span className="text-zinc-600 text-xs">Belum Riset</span>
                      )}
                    </td>

                    {/* Aksi */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {waUrl ? (
                          <a 
                            href={waUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium rounded-md border border-zinc-700 transition-colors"
                          >
                            Chat WA
                          </a>
                        ) : (
                          <span className="text-zinc-600 text-xs px-2">-</span>
                        )}

                        <a 
                          href={lead.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((lead.name + ' ' + (lead.address || '')).trim())}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="px-2 py-1 text-zinc-400 hover:text-white text-xs font-medium rounded-md hover:bg-zinc-800 transition-colors"
                        >
                          Maps
                        </a>

                        <button 
                          type="button"
                          className="px-2 py-1 text-zinc-400 hover:text-red-400 hover:bg-red-950/30 rounded transition-colors text-xs font-bold" 
                          onClick={() => handleDelete(lead.id, lead.name)}
                          title="Hapus baris ini"
                        >
                          ✕
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

      {/* 5. MODAL DETAIL AI & PITCH WHATSAPP */}
      {selectedAiLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#121215] border border-zinc-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            
            <div className="flex justify-between items-start border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">{selectedAiLead.name}</h3>
                <p className="text-xs text-zinc-400">{selectedAiLead.categoryName} • {selectedAiLead.address}</p>
              </div>
              <button 
                type="button"
                onClick={() => setSelectedAiLead(null)}
                className="text-zinc-500 hover:text-white text-sm p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-zinc-400">Status:</span>
                <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 font-medium">
                  {selectedAiLead.aiResearch?.leadQualification || 'WARM LEAD'}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-1">
                <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block">Temuan Jejak Digital Web</span>
                <p className="text-zinc-200 leading-relaxed">
                  {selectedAiLead.aiResearch?.digitalPresenceSummary || 'Belum ada ringkasan.'}
                </p>
              </div>

              {selectedAiLead.aiResearch?.pitchAngle && (
                <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1">
                  <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block">Sudut Penawaran</span>
                  <p className="text-zinc-300 leading-relaxed">
                    {selectedAiLead.aiResearch.pitchAngle}
                  </p>
                </div>
              )}

              <div className="space-y-1">
                <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block">Draft Pesan WhatsApp</span>
                <textarea 
                  readOnly 
                  rows={4}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-zinc-200 focus:outline-none resize-none leading-relaxed text-xs"
                  value={selectedAiLead.aiResearch?.pitchDraft || ''}
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                <button 
                  type="button"
                  onClick={() => handleCopyPitch(selectedAiLead.aiResearch?.pitchDraft || '')}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors"
                >
                  {copySuccess ? '✓ Disalin!' : 'Salin Pesan'}
                </button>
                
                {normalizeWa(selectedAiLead.whatsapp || selectedAiLead.phone) ? (
                  <a 
                    href={`https://wa.me/${normalizeWa(selectedAiLead.whatsapp || selectedAiLead.phone)}?text=${encodeURIComponent(selectedAiLead.aiResearch?.pitchDraft || '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-1.5 rounded-lg text-xs font-medium bg-white hover:bg-zinc-200 text-zinc-950 transition-colors"
                  >
                    Buka WhatsApp →
                  </a>
                ) : null}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 6. MODAL PANDUAN DOWNLOAD & INSTALASI EKSTENSI UNTUK TEMAN */}
      {showExtensionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#121215] border border-zinc-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-5">
            
            <div className="flex justify-between items-start border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Pasang Ekstensi untuk Teman</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Scraping data Google Maps bersama-sama dan sinkronkan ke web ini.</p>
              </div>
              <button 
                type="button"
                onClick={() => setShowExtensionModal(false)}
                className="text-zinc-500 hover:text-white text-sm p-1"
              >
                ✕
              </button>
            </div>

            {/* Tombol Download File ZIP */}
            <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-semibold text-white block">File Ekstensi (ZIP)</span>
                <span className="text-[11px] text-zinc-400">Versi terbaru dengan AI & Shopee detector</span>
              </div>
              <a
                href="/gmaps-leadgen-extension.zip"
                download="gmaps-leadgen-extension.zip"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-white hover:bg-zinc-200 text-zinc-950 transition-colors"
              >
                Download ZIP
              </a>
            </div>

            {/* 3 Langkah Mudah Instalasi */}
            <div className="space-y-2 text-xs">
              <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block">
                Cara Pasang di Chrome / Edge (1 Menit):
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-1">
                  <div className="text-zinc-400 font-bold text-xs">1. Ekstrak ZIP</div>
                  <p className="text-[11px] text-zinc-400">Download file zip di atas lalu klik kanan & pilih "Extract All".</p>
                </div>
                <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-1">
                  <div className="text-zinc-400 font-bold text-xs">2. Developer Mode</div>
                  <p className="text-[11px] text-zinc-400">Buka <code className="text-zinc-300">chrome://extensions</code> dan aktifkan toggle Developer mode di kanan atas.</p>
                </div>
                <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-1">
                  <div className="text-zinc-400 font-bold text-xs">3. Load Unpacked</div>
                  <p className="text-[11px] text-zinc-400">Klik "Load unpacked" lalu pilih folder hasil ekstrak tadi. Selesai!</p>
                </div>
              </div>
            </div>

            {/* Sinkronisasi Data */}
            <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300">
              💡 <strong>Cara kirim data barengan:</strong> Di ekstensi teman abang, cukup klik tombol <strong>"Sinkron ke Dashboard"</strong>. Datanya otomatis langsung masuk dan tampil di tabel ini!
            </div>

            <div className="text-right pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setShowExtensionModal(false)}
                className="px-4 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white"
              >
                Tutup
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
