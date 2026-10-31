'use client';

import { useState, useMemo } from 'react';

export default function CleanupRecommendationsModal({
  groups = [],
  onClose,
  onConfirmDelete,
}) {
  const [selectedIds, setSelectedIds] = useState(() => {
    const initial = new Set();
    for (const g of groups) {
      for (const lead of g.leads) {
        if (lead.id !== undefined && lead.id !== null) {
          initial.add(String(lead.id));
        }
      }
    }
    return initial;
  });
  const [expandedCode, setExpandedCode] = useState(() => groups[0]?.code || null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const selectedArray = useMemo(() => Array.from(selectedIds), [selectedIds]);

  const toggleGroup = (groupLeads, shouldSelect) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const lead of groupLeads) {
        const key = String(lead.id);
        if (shouldSelect) next.add(key);
        else next.delete(key);
      }
      return next;
    });
  };

  const toggleSingle = (id) => {
    const key = String(id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const executeBatchDelete = async () => {
    if (isDeleting || selectedArray.length === 0) return;
    setIsDeleting(true);
    setErrorMsg('');

    try {
      await onConfirmDelete(selectedArray);
    } catch (err) {
      setErrorMsg(err?.message || 'Gagal menghapus daftar rekomendasi dari database.');
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDeleting) onClose();
      }}
    >
      <div className="clean-card w-full sm:max-w-xl rounded-t-2xl sm:rounded-2xl max-h-[92dvh] flex flex-col shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-start justify-between gap-3 shrink-0">
          <div>
            <h2 className="text-base font-bold text-white">
              Rekomendasi Hapus Prospek Tidak Layak
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Pilih kategori data yang ingin dibersihkan agar tabel hanya menyisakan target usaha tanpa website resmi.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-colors disabled:opacity-40"
            aria-label="Tutup modal pembersihan"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-3 overflow-y-auto text-xs flex-1">
          {groups.length === 0 ? (
            <div className="p-6 text-center text-zinc-400">
              Tidak ada prospek yang masuk kategori rekomendasi hapus saat ini.
            </div>
          ) : (
            groups.map((group) => {
              const groupIds = group.leads.map((l) => String(l.id));
              const checkedCount = groupIds.filter((id) => selectedIds.has(id)).length;
              const allChecked = checkedCount === groupIds.length && groupIds.length > 0;
              const isExpanded = expandedCode === group.code;

              return (
                <div
                  key={group.code}
                  className="rounded-xl bg-[#18181b] border border-zinc-800 overflow-hidden"
                >
                  <div className="p-3.5 flex items-start justify-between gap-3">
                    <label className="flex items-start gap-2.5 cursor-pointer flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={allChecked}
                        onChange={(e) => toggleGroup(group.leads, e.target.checked)}
                        disabled={isDeleting}
                        className="mt-0.5 rounded border-zinc-700 bg-zinc-900 shrink-0"
                      />
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-zinc-100">{group.title}</span>
                          <span className="px-2 py-0.5 rounded-md bg-rose-950/60 border border-rose-900/70 text-rose-200 font-mono text-[10px]">
                            {checkedCount}/{groupIds.length} dipilih
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 leading-relaxed">
                          {group.description}
                        </p>
                      </div>
                    </label>

                    <button
                      type="button"
                      onClick={() => setExpandedCode(isExpanded ? null : group.code)}
                      className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-[11px] shrink-0 transition-colors"
                    >
                      {isExpanded ? 'Tutup Daftar' : 'Lihat Nama'}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-zinc-800/80 bg-[#121215] max-h-48 overflow-y-auto divide-y divide-zinc-800/60">
                      {group.leads.map((item) => {
                        const itemId = String(item.id);
                        const checked = selectedIds.has(itemId);
                        return (
                          <label
                            key={itemId}
                            className="px-3.5 py-2 flex items-center justify-between gap-3 hover:bg-zinc-900/60 cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleSingle(itemId)}
                                disabled={isDeleting}
                                className="rounded border-zinc-700 bg-zinc-900 shrink-0"
                              />
                              <div className="min-w-0">
                                <div className="text-zinc-200 font-medium truncate">
                                  {item.name}
                                </div>
                                <div className="text-[11px] text-zinc-500 truncate">
                                  {item.website || item.categoryName || item.address || 'Tanpa detail tambahan'}
                                </div>
                              </div>
                            </div>
                            {item.phone && (
                              <span className="text-[11px] font-mono text-zinc-500 shrink-0">
                                {item.phone}
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {errorMsg && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-rose-950/40 border border-rose-900/70 text-rose-200 flex items-center justify-between gap-2"
            >
              <span>{errorMsg}</span>
              <button
                type="button"
                onClick={executeBatchDelete}
                disabled={isDeleting || selectedArray.length === 0}
                className="px-3 py-1 rounded-lg bg-rose-900/60 hover:bg-rose-900 text-rose-100 font-semibold shrink-0"
              >
                Coba Lagi
              </button>
            </div>
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-zinc-800 bg-[#0e0e11] flex items-center justify-between gap-3 shrink-0">
          <span className="text-xs text-zinc-400">
            Total dipilih: <strong className="text-white">{selectedArray.length}</strong> prospek
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="px-3.5 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white transition-colors disabled:opacity-40"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={executeBatchDelete}
              disabled={isDeleting || selectedArray.length === 0}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-colors shadow-sm disabled:opacity-40 inline-flex items-center gap-2"
            >
              {isDeleting && (
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              <span>
                {isDeleting
                  ? 'Menghapus...'
                  : `Hapus yang Dipilih (${selectedArray.length})`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

