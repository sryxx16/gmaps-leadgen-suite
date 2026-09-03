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
    <div className="import-box glass">
      <h2>Import Data dari Extension</h2>
      <form onSubmit={handleImport} style={{textAlign: 'left'}}>
        <div className="input-group">
          <label>File JSON Export</label>
          <input type="file" accept=".json" onChange={handleFileChange} />
        </div>
        
        <div className="input-group">
          <label>Kategori Masal (Opsional)</label>
          <input 
            type="text" 
            placeholder="misal: Toko Sepeda" 
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
          />
          <small style={{color: 'var(--text-muted)', fontSize: '0.75rem'}}>
            Jika diisi, semua data di file JSON ini akan masuk ke kategori ini (menimpa kategori otomatis dari maps).
          </small>
        </div>

        <button type="submit" className="btn" style={{width: '100%'}} disabled={loading || !file}>
          {loading ? 'Memproses...' : 'Mulai Import'}
        </button>

        {message && (
          <div style={{marginTop: '1rem', textAlign: 'center', color: message.includes('Berhasil') ? '#86efac' : '#fca5a5'}}>
            {message}
          </div>
        )}
      </form>
    </div>
  );
}
