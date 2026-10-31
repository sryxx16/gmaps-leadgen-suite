'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';

export default function ImportPage() {
  const [file, setFile] = useState(null);
  const [parsedPreviewCount, setParsedPreviewCount] = useState(null);
  const [categoryName, setCategoryName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', text: string }
  const fileInputRef = useRef(null);

  const inspectSelectedFile = async (selected) => {
    setFeedback(null);
    if (!selected) {
      setFile(null);
      setParsedPreviewCount(null);
      return;
    }

    setFile(selected);
    try {
      const text = await selected.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        setParsedPreviewCount(null);
        setFeedback({
          type: 'error',
          text: 'Format JSON tidak sesuai: isi file harus berupa array daftar bisnis ([...]).',
        });
        return;
      }
      setParsedPreviewCount(parsed.length);
    } catch {
      setParsedPreviewCount(null);
      setFeedback({
        type: 'error',
        text: 'File bukan JSON yang valid atau rusak. Pastikan berasal dari tombol Export JSON ekstensi.',
      });
    }
  };

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0] || null;
    inspectSelectedFile(selected);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer?.files?.[0] || null;
    if (dropped) inspectSelectedFile(dropped);
  };

  const runImport = async () => {
    if (!file || loading) return;

    setLoading(true);
    setFeedback(null);

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!Array.isArray(data)) {
        throw new Error('Format JSON tidak valid (harus berupa array data).');
      }

      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, categoryName: categoryName.trim() }),
      });

      const result = await res.json().catch(() => ({}));

      if (res.ok && result.success) {
        setFeedback({
          type: 'success',
          text: `Sinkronisasi selesai: ${result.inserted ?? 0} data baru ditambahkan, ${result.updated ?? 0} data diperbarui.`,
        });
        setFile(null);
        setParsedPreviewCount(null);
        setCategoryName('');
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        throw new Error(result.error || `Server menolak permintaan (HTTP ${res.status}).`);
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err.message || 'Gagal mengunggah data ke database.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    runImport();
  };

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="clean-card rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 text-xs font-medium text-zinc-400">
            <Link href="/" className="hover:text-white transition-colors">
              Dashboard
            </Link>
            <span>/</span>
            <span className="text-zinc-200">Import JSON</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Import Data Prospek
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
            Unggah file JSON hasil export dari ekstensi Chrome GMaps Lead Finder untuk disimpan dan digabungkan ke database Cloud.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              File Export JSON
            </label>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`rounded-xl border border-dashed p-6 text-center cursor-pointer transition-colors ${
                isDragging
                  ? 'border-zinc-300 bg-zinc-800/50'
                  : 'border-zinc-700/90 bg-[#18181b]/70 hover:border-zinc-500 hover:bg-[#18181b]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-3 text-zinc-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>

              {file ? (
                <div className="space-y-1">
                  <p className="text-xs sm:text-sm font-semibold text-white truncate max-w-xs mx-auto">
                    {file.name}
                  </p>
                  <p className="text-xs text-zinc-400">
                    {parsedPreviewCount !== null
                      ? `${parsedPreviewCount} baris bisnis siap disinkronkan`
                      : 'Klik untuk mengganti file'}
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-xs sm:text-sm font-medium text-zinc-200">
                    Klik untuk pilih file JSON atau tarik file ke area ini
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    Mendukung deduplikasi otomatis berdasarkan Nama Bisnis &amp; Alamat
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="bulk-category"
              className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider"
            >
              Timpa Kategori Masal (Opsional)
            </label>
            <input
              id="bulk-category"
              type="text"
              placeholder="Contoh: Klinik Gigi Jakarta, Bengkel Mobil, Cafe..."
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              className="w-full px-3.5 py-2.5 clean-input rounded-xl text-xs sm:text-sm"
            />
            <p className="text-[11px] text-zinc-500">
              Kosongkan jika ingin mempertahankan kategori asli per bisnis dari Google Maps.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !file || parsedPreviewCount === null}
            className="w-full py-2.5 px-4 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs sm:text-sm rounded-xl shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin" />
                <span>Menyimpan ke Database...</span>
              </>
            ) : (
              <span>
                Simpan ke Database
                {parsedPreviewCount !== null ? ` (${parsedPreviewCount} Prospek)` : ''}
              </span>
            )}
          </button>

          {feedback && (
            <div
              role="status"
              className={`p-3.5 rounded-xl text-xs border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                feedback.type === 'success'
                  ? 'bg-emerald-950/40 text-emerald-200 border-emerald-900/70'
                  : 'bg-rose-950/40 text-rose-200 border-rose-900/70'
              }`}
            >
              <span>{feedback.text}</span>
              {feedback.type === 'success' ? (
                <Link
                  href="/"
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-900/50 hover:bg-emerald-900 text-emerald-100 font-semibold text-center transition-colors"
                >
                  Lihat di Dashboard
                </Link>
              ) : file ? (
                <button
                  type="button"
                  onClick={runImport}
                  disabled={loading}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-rose-900/50 hover:bg-rose-900 text-rose-100 font-semibold transition-colors"
                >
                  Coba Lagi
                </button>
              ) : null}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
