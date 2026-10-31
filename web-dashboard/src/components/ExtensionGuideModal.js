'use client';

export default function ExtensionGuideModal({ open, onClose }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="clean-card w-full sm:max-w-xl rounded-t-2xl sm:rounded-2xl max-h-[92dvh] flex flex-col shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-start justify-between gap-3 shrink-0">
          <div>
            <h3 className="text-base font-bold text-white">Pasang Ekstensi Chrome Scraper</h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Scraping data bisnis Google Maps bersama tim lalu sinkronkan otomatis ke dashboard ini.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-colors"
            aria-label="Tutup panduan ekstensi"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto text-xs flex-1">
          <div className="p-4 rounded-xl bg-[#18181b] border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-semibold text-white block">Paket Ekstensi Terbaru (ZIP)</span>
              <span className="text-[11px] text-zinc-400">
                Mendukung deteksi Shopee/Sosmed, sinkronisasi Cloud, &amp; OpenRouter Free AI
              </span>
            </div>
            <a
              href="/gmaps-leadgen-extension.zip"
              download="gmaps-leadgen-extension.zip"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-white text-zinc-950 transition-colors shrink-0"
            >
              Download ZIP
            </a>
          </div>

          <div className="space-y-2">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
              Langkah Instalasi di Chrome / Edge / Brave:
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="p-3.5 rounded-xl bg-[#18181b] border border-zinc-800 space-y-1">
                <div className="text-zinc-200 font-semibold text-xs">1. Ekstrak ZIP</div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Unduh paket ZIP di atas lalu klik kanan dan pilih Extract All ke sebuah folder.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-[#18181b] border border-zinc-800 space-y-1">
                <div className="text-zinc-200 font-semibold text-xs">2. Developer Mode</div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Buka <code className="text-zinc-200">chrome://extensions</code> dan aktifkan saklar Developer mode di pojok kanan atas.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-[#18181b] border border-zinc-800 space-y-1">
                <div className="text-zinc-200 font-semibold text-xs">3. Load Unpacked</div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Klik tombol Load unpacked lalu arahkan ke folder hasil ekstraksi tadi.
                </p>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-zinc-300 leading-relaxed">
            <strong className="text-white">Sinkronisasi Tim:</strong> Pada halaman tabel ekstensi, masukkan URL dashboard ini di Pengaturan lalu tekan <strong className="text-white">Sinkron ke Dashboard</strong> agar data langsung masuk ke tabel bersama.
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-zinc-800 bg-[#0e0e11] text-right shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 transition-colors"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
}

