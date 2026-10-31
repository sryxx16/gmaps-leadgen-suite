'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ImportPage() {
  const [file, setFile] = useState(null);
  const [categoryName, setCategoryName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleImport = async (e) => {
    e.preventDefault();
    if (!file) {
      setMessage('Silakan pilih file JSON hasil export.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!Array.isArray(data)) {
        throw new Error('Format JSON tidak valid (harus berupa array data).');
      }

      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, categoryName })
      });

      const result = await res.json();
      
      if (result.success) {
        setMessage(`Berhasil menyimpan ${result.inserted} data ke database!`);
        setFile(null);
        setCategoryName('');
      } else {
        setMessage(`Gagal: ${result.error}`);
      }
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto mt-10 px-4">
      <div className="glass-card rounded-3xl p-8 border border-white/[0.08] shadow-2xl space-y-6">
        
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mx-auto shadow-lg shadow-indigo-500/20">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">Import Data JSON Ekstensi</h2>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Upload file export JSON dari ekstensi Google Maps LeadGen ke database Neon.
          </p>
        </div>

        <form onSubmit={handleImport} className="space-y-5">
          
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">File JSON Ekstensi</label>
            <div className="relative">
              <input 
                type="file" 
                accept=".json" 
                onChange={handleFileChange}
                className="block w-full text-xs text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 file:cursor-pointer cursor-pointer bg-slate-950/70 border border-white/[0.09] rounded-xl p-2 transition-all"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Kategori Masal (Opsional)</label>
            <input 
              type="text" 
              placeholder="misal: Toko Sepatu, Cafe, Toko Kue..." 
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-950/70 border border-white/[0.09] rounded-xl text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
            <p className="mt-1.5 text-[11px] text-slate-500">
              Jika diisi, semua data di file JSON ini akan dimasukkan ke kategori tersebut.
            </p>
          </div>

          <button 
            type="submit" 
            disabled={loading || !file}
            className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="animate-pulse">Sedang Memproses Data...</span>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>Mulai Simpan ke Database</span>
              </>
            )}
          </button>

          {message && (
            <div className={`p-3.5 rounded-xl text-center text-xs border font-medium ${message.includes('Berhasil') ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/15 text-rose-300 border-rose-500/30'}`}>
              {message}
            </div>
          )}
        </form>

        <div className="pt-4 border-t border-white/[0.06] text-center">
          <Link href="/" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
            ← Kembali ke Dashboard
          </Link>
        </div>

      </div>
    </div>
  );
}
