'use client';

import { useState, useMemo } from 'react';

export default function DashboardClient({ initialLeads, categories }) {
  const [leads, setLeads] = useState(initialLeads);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      if (statusFilter === 'NO_WEB' && lead.website) return false;
      if (statusFilter === 'HAS_WEB' && !lead.website) return false;

      const leadCat = lead.categoryName || 'Tanpa Kategori';
      if (categoryFilter !== 'ALL' && leadCat !== categoryFilter) return false;

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchName = lead.name?.toLowerCase().includes(query);
        const matchAddress = lead.address?.toLowerCase().includes(query);
        if (!matchName && !matchAddress) return false;
      }

      return true;
    });
  }, [leads, searchQuery, statusFilter, categoryFilter]);

  const handleDelete = async (id, name) => {
    if (!confirm(`Yakin mau menghapus data bisnis "${name}"?`)) return;

    try {
      const res = await fetch('/api/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const result = await res.json();
      if (result.success) {
        setLeads(leads.filter(l => l.id !== id));
      } else {
        alert('Gagal menghapus: ' + result.error);
      }
    } catch (err) {
      alert('Error jaringan: ' + err.message);
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm('PERINGATAN: Yakin mau menghapus SEMUA data leads di sistem? Ini tidak bisa dikembalikan.')) return;

    try {
      const res = await fetch('/api/delete-all', { method: 'POST' });
      const result = await res.json();
      if (result.success) {
        setLeads([]);
      } else {
        alert('Gagal menghapus semua data: ' + result.error);
      }
    } catch (err) {
      alert('Error jaringan: ' + err.message);
    }
  };

  const handleExportCsv = () => {
    if (filteredLeads.length === 0) {
      alert('Tidak ada data untuk diexport.');
      return;
    }

    const rows = [
      ['Nama Bisnis', 'Kategori', 'Alamat', 'Telepon', 'Website', 'Status Website', 'Tanggal Scrape']
    ];

    filteredLeads.forEach(l => {
      rows.push([
        `"${(l.name || '').replace(/"/g, '""')}"`,
        `"${(l.categoryName || '').replace(/"/g, '""')}"`,
        `"${(l.address || '').replace(/"/g, '""')}"`,
        `"${(l.phone || '').replace(/"/g, '""')}"`,
        `"${(l.website || '').replace(/"/g, '""')}"`,
        l.website ? 'Ada' : 'Belum Ada',
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

  const availableCategories = useMemo(() => {
    const cats = new Set(leads.map(l => l.categoryName || 'Tanpa Kategori'));
    return Array.from(cats).sort();
  }, [leads]);

  const totalLeads = filteredLeads.length;
  const noWebsite = filteredLeads.filter(l => !l.website).length;

  return (
    <div className="max-w-7xl mx-auto px-4 pb-12 space-y-8">
      {/* 1. Baris Statistik */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Total Leads Terfilter</h3>
          <p className="text-4xl font-bold text-slate-100">{totalLeads}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Belum Punya Website</h3>
          <p className="text-4xl font-bold text-red-400">{noWebsite}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Total Kategori Bisnis</h3>
          <p className="text-4xl font-bold text-blue-400">{categories.length}</p>
        </div>
      </div>

      {/* 2. Management Toolbar (Filter & Search) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="relative w-full md:w-96">
            <input 
              type="text" 
              className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2.5 px-4 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 transition-colors shadow-inner" 
              placeholder="Cari nama bisnis atau alamat..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-3 w-full md:w-auto mt-4 md:mt-0">
            <button 
              className="flex-1 md:flex-none px-5 py-2.5 bg-slate-100 hover:bg-white text-slate-900 text-sm font-semibold rounded-xl transition-all shadow-sm" 
              onClick={handleExportCsv}
            >
              Export CSV
            </button>
            <button 
              className="flex-1 md:flex-none px-5 py-2.5 bg-transparent border border-red-900/50 text-red-400 hover:bg-red-950/50 hover:text-red-300 text-sm font-semibold rounded-xl transition-colors" 
              onClick={handleDeleteAll}
            >
              Hapus Semua
            </button>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row gap-8">
          <div className="space-y-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Status Website</span>
            <div className="flex flex-wrap gap-2">
              <button 
                className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-colors ${statusFilter === 'ALL' ? 'bg-slate-200 text-slate-900 border-slate-200' : 'bg-transparent text-slate-400 border-slate-700 hover:bg-slate-800'}`} 
                onClick={() => setStatusFilter('ALL')}
              >Semua</button>
              <button 
                className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-colors ${statusFilter === 'NO_WEB' ? 'bg-slate-200 text-slate-900 border-slate-200' : 'bg-transparent text-slate-400 border-slate-700 hover:bg-slate-800'}`} 
                onClick={() => setStatusFilter('NO_WEB')}
              >Belum Punya Web</button>
              <button 
                className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-colors ${statusFilter === 'HAS_WEB' ? 'bg-slate-200 text-slate-900 border-slate-200' : 'bg-transparent text-slate-400 border-slate-700 hover:bg-slate-800'}`} 
                onClick={() => setStatusFilter('HAS_WEB')}
              >Sudah Punya Web</button>
            </div>
          </div>

          <div className="space-y-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Kategori Bisnis</span>
            <div className="flex flex-wrap gap-2">
              <button 
                className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-colors ${categoryFilter === 'ALL' ? 'bg-slate-200 text-slate-900 border-slate-200' : 'bg-transparent text-slate-400 border-slate-700 hover:bg-slate-800'}`} 
                onClick={() => setCategoryFilter('ALL')}
              >Semua Kategori</button>
              {availableCategories.map(cat => (
                <button 
                  key={cat} 
                  className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-colors ${categoryFilter === cat ? 'bg-slate-200 text-slate-900 border-slate-200' : 'bg-transparent text-slate-400 border-slate-700 hover:bg-slate-800'}`} 
                  onClick={() => setCategoryFilter(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Tabel Data */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Nama Bisnis</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Kategori</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Alamat</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Kontak</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Website</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-12 text-center text-slate-500 text-sm">
                    Tidak ada data yang cocok dengan filter / pencarian.
                  </td>
                </tr>
              ) : filteredLeads.map(lead => (
                <tr key={lead.id} className="hover:bg-slate-800/20 transition-colors">
                  <td className="p-4 text-sm font-semibold text-slate-200">{lead.name}</td>
                  <td className="p-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700 whitespace-nowrap">
                      {lead.categoryName || 'Tanpa Kategori'}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-slate-400 max-w-xs" title={lead.address}>
                    <div className="truncate">{lead.address || '-'}</div>
                    <a 
                      href={lead.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((lead.name + ' ' + (lead.address || '')).trim())}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex mt-1 text-[11px] text-emerald-400 hover:text-emerald-300 hover:underline transition-colors font-medium items-center gap-1"
                    >
                      Buka Maps
                    </a>
                  </td>
                  <td className="p-4 text-sm">
                    {lead.phone ? (
                      <a 
                        className="text-slate-300 hover:text-white underline underline-offset-4 decoration-slate-600 hover:decoration-slate-300 transition-colors" 
                        href={`https://wa.me/${lead.phone.replace(/\D/g, '').replace(/^0/, '62')}?text=${encodeURIComponent(
                          `Halo Kak, izin menghubungi ya 🙏\n\nKami menemukan *${lead.name}* saat melihat beberapa usaha lokal di Google Maps. Kami kebetulan bergerak di bidang pembuatan website untuk UMKM dan bisnis lokal.\n\nKami lihat saat ini *${lead.name}* belum memiliki website resmi. Kalau Kakak tertarik, kami bisa bantu buatkan website sederhana untuk menampilkan profil usaha, produk/layanan, lokasi, kontak WhatsApp, dan informasi lainnya.\n\nKalau berkenan, kami juga bisa kirim contoh desainnya terlebih dahulu tanpa komitmen.\n\nKalau belum membutuhkan, tidak apa-apa ya Kak. Terima kasih sebelumnya 🙏`
                        )}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        {lead.phone}
                      </a>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>
                  <td className="p-4">
                    {lead.website ? (
                      <a className="text-slate-300 hover:text-white text-sm underline underline-offset-4 decoration-slate-600 hover:decoration-slate-300 transition-colors" href={lead.website} target="_blank" rel="noopener noreferrer">Kunjungi</a>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
                        Belum Ada
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <button 
                      className="px-3 py-1.5 bg-transparent border border-red-900/50 text-red-400 hover:bg-red-950/50 hover:text-red-300 text-xs font-medium rounded-lg transition-colors" 
                      onClick={() => handleDelete(lead.id, lead.name)}
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
