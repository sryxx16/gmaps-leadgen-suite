'use client';

import { useState } from 'react';

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
        throw new Error('Format JSON tidak valid (harus berupa array).');
      }

      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, categoryName })
      });

      const result = await res.json();
      
      if (result.success) {
        setMessage(`Berhasil import ${result.inserted} data!`);
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
    <div className="max-w-xl mx-auto mt-12 p-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
      <h2 className="text-2xl font-bold text-slate-100 mb-6 text-center">Import Data dari Extension</h2>
      <form onSubmit={handleImport} className="space-y-6">
        
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2">File JSON Export</label>
          <div className="relative">
            <input 
              type="file" 
              accept=".json" 
              onChange={handleFileChange}
              className="block w-full text-sm text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-slate-800 file:text-slate-300 hover:file:bg-slate-700 cursor-pointer bg-slate-950 border border-slate-800 rounded-xl"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2">Kategori Masal (Opsional)</label>
          <input 
            type="text" 
            placeholder="misal: Toko Sepeda" 
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
          />
          <p className="mt-2 text-xs text-slate-500">
            Jika diisi, semua data di file JSON ini akan masuk ke kategori ini (menimpa kategori otomatis dari maps).
          </p>
        </div>

        <button 
          type="submit" 
          disabled={loading || !file}
          className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center"
        >
          {loading ? (
            <span className="animate-pulse">Memproses...</span>
          ) : (
            'Mulai Import ➔'
          )}
        </button>

        {message && (
          <div className={`mt-4 p-4 rounded-xl text-center text-sm border ${message.includes('Berhasil') ? 'bg-emerald-950/30 text-emerald-400 border-emerald-900/50' : 'bg-red-950/30 text-red-400 border-red-900/50'}`}>
            {message}
          </div>
        )}
      </form>
    </div>
  );
}
