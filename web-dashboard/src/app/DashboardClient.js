'use client';

import { useState, useMemo } from 'react';

export default function DashboardClient({ initialLeads, categories }) {
  const [leads, setLeads] = useState(initialLeads);
  
  // States untuk filter & search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, NO_WEB, HAS_WEB
  const [categoryFilter, setCategoryFilter] = useState('ALL'); // ALL atau categoryName

  // Derived state: hasil filter
  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      // 1. Filter Status Website
      if (statusFilter === 'NO_WEB' && lead.website) return false;
      if (statusFilter === 'HAS_WEB' && !lead.website) return false;

      // 2. Filter Kategori
      const leadCat = lead.categoryName || 'Tanpa Kategori';
      if (categoryFilter !== 'ALL' && leadCat !== categoryFilter) return false;

      // 3. Search Bar
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchName = lead.name?.toLowerCase().includes(query);
        const matchAddress = lead.address?.toLowerCase().includes(query);
        if (!matchName && !matchAddress) return false;
      }

      return true;
    });
  }, [leads, searchQuery, statusFilter, categoryFilter]);

  // Handler Hapus Data
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

  // Handler Hapus Semua Data
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

  // Handler Export CSV
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

  // List unik untuk chip kategori (dari data leads yang ada)
  const availableCategories = useMemo(() => {
    const cats = new Set(leads.map(l => l.categoryName || 'Tanpa Kategori'));
    return Array.from(cats).sort();
  }, [leads]);

  // Statistik Dinamis berdasarkan filter
  const totalLeads = filteredLeads.length;
  const noWebsite = filteredLeads.filter(l => !l.website).length;

  return (
    <div>
      {/* 1. Baris Statistik */}
      <div className="dashboard-grid">
        <div className="stat-card glass">
          <h3>Total Leads Terfilter</h3>
          <p className="value">{totalLeads}</p>
        </div>
        <div className="stat-card glass">
          <h3>Belum Punya Website (Dari Filter)</h3>
          <p className="value" style={{color: '#fca5a5'}}>{noWebsite}</p>
        </div>
        <div className="stat-card glass">
          <h3>Kategori Bisnis Total</h3>
          <p className="value" style={{color: '#93c5fd'}}>{categories.length}</p>
        </div>
      </div>

      {/* 2. Management Toolbar (Filter & Search) */}
      <div className="mgmt-toolbar glass">
        <div className="mgmt-header">
          <input 
            type="text" 
            className="search-bar" 
            placeholder="Cari nama bisnis atau alamat..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div style={{display: 'flex', gap: '1rem'}}>
            <button className="btn" style={{background: '#10b981'}} onClick={handleExportCsv}>
              ⬇️ Export CSV
            </button>
            <button className="btn btn-danger" style={{padding: '0.75rem 1.5rem', fontSize: '1rem'}} onClick={handleDeleteAll}>
              🗑️ Hapus Semua
            </button>
          </div>
        </div>
        
        <div style={{display: 'flex', flexWrap: 'wrap', gap: '2rem'}}>
          <div className="filter-group">
            <span className="filter-label">Filter Status Website:</span>
            <div className="chip-container">
              <div className={`filter-chip ${statusFilter === 'ALL' ? 'active' : ''}`} onClick={() => setStatusFilter('ALL')}>Semua</div>
              <div className={`filter-chip ${statusFilter === 'NO_WEB' ? 'active' : ''}`} onClick={() => setStatusFilter('NO_WEB')}>Belum Punya Web</div>
              <div className={`filter-chip ${statusFilter === 'HAS_WEB' ? 'active' : ''}`} onClick={() => setStatusFilter('HAS_WEB')}>Sudah Punya Web</div>
            </div>
          </div>

          <div className="filter-group">
            <span className="filter-label">Filter Kategori (Deteksi Otomatis):</span>
            <div className="chip-container">
              <div className={`filter-chip ${categoryFilter === 'ALL' ? 'active' : ''}`} onClick={() => setCategoryFilter('ALL')}>Semua Kategori</div>
              {availableCategories.map(cat => (
                <div 
                  key={cat} 
                  className={`filter-chip ${categoryFilter === cat ? 'active' : ''}`} 
                  onClick={() => setCategoryFilter(cat)}
                >
                  {cat}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Tabel Data */}
      <div className="glass table-container">
        <table>
          <thead>
            <tr>
              <th>Nama Bisnis</th>
              <th>Kategori</th>
              <th>Alamat</th>
              <th>Kontak</th>
              <th>Website</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filteredLeads.length === 0 ? (
              <tr>
                <td colSpan="6" style={{textAlign: 'center', color: 'var(--text-muted)', padding: '3rem 1rem'}}>
                  Tidak ada data yang cocok dengan filter / pencarian.
                </td>
              </tr>
            ) : filteredLeads.map(lead => (
              <tr key={lead.id}>
                <td style={{fontWeight: 600}}>{lead.name}</td>
                <td>
                  <span className="badge cat">{lead.categoryName || 'Tanpa Kategori'}</span>
                </td>
                <td style={{color: 'var(--text-muted)'}}>
                  {lead.address || '-'}
                </td>
                <td>
                  {lead.phone ? (
                    <a className="link" href={`https://wa.me/${lead.phone.replace(/\D/g, '').replace(/^0/, '62')}`} target="_blank" rel="noopener noreferrer">
                      {lead.phone}
                    </a>
                  ) : '-'}
                </td>
                <td>
                  {lead.website ? (
                    <a className="link" href={lead.website} target="_blank" rel="noopener noreferrer">Kunjungi</a>
                  ) : (
                    <span className="badge no">Belum Ada</span>
                  )}
                </td>
                <td>
                  <button className="btn btn-danger" onClick={() => handleDelete(lead.id, lead.name)}>
                    Hapus
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
