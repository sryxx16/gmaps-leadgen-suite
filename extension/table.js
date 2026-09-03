const tbody = document.getElementById('tbody');
const summary = document.getElementById('summary');
const emptyState = document.getElementById('emptyState');
const searchInput = document.getElementById('search');
const onlyNoWebsite = document.getElementById('onlyNoWebsite');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const exportJsonBtn = document.getElementById('exportJsonBtn');
const clearBtn = document.getElementById('clearBtn');
const addManualBtn = document.getElementById('addManualBtn');
const manualForm = document.getElementById('manualForm');
const mName = document.getElementById('mName');
const mAddress = document.getElementById('mAddress');
const mPhone = document.getElementById('mPhone');
const mCategory = document.getElementById('mCategory');
const mWebsite = document.getElementById('mWebsite');
const mMapsUrl = document.getElementById('mMapsUrl');
const mSaveBtn = document.getElementById('mSaveBtn');
const mCancelBtn = document.getElementById('mCancelBtn');

let allLeads = [];
let currentFilteredLeads = [];

// Ubah nomor telepon lokal (0812..., 62812..., +62812...) jadi format wa.me (62812...).
function normalizePhoneForWa(phone) {
  if (!phone) return '';
  let digits = phone.replace(/[^\d]/g, '');
  if (digits.startsWith('0')) digits = '62' + digits.slice(1);
  if (!digits.startsWith('62')) digits = '62' + digits;
  return digits;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function render() {
  const query = searchInput.value.trim().toLowerCase();
  const filterNoSite = onlyNoWebsite.checked;

  currentFilteredLeads = allLeads.filter((l) => {
    if (filterNoSite && l.hasWebsite) return false;
    if (!query) return true;
    return (
      l.name.toLowerCase().includes(query) ||
      (l.address || '').toLowerCase().includes(query) ||
      (l.category || '').toLowerCase().includes(query)
    );
  });

  summary.textContent = `${currentFilteredLeads.length} data ditampilkan (dari ${allLeads.length} total)`;

  tbody.innerHTML = '';
  emptyState.hidden = currentFilteredLeads.length > 0;

  for (const lead of currentFilteredLeads) {
    const tr = document.createElement('tr');

    const websiteCell = lead.hasWebsite
      ? `<a class="site-link" href="${escapeHtml(lead.website)}" target="_blank" rel="noopener">${escapeHtml(lead.website)}</a>`
      : `<span class="badge no">Belum ada</span>`;

    const waNumber = normalizePhoneForWa(lead.phone);
    const waLink = waNumber
      ? `<a href="https://wa.me/${waNumber}" target="_blank" rel="noopener">Chat WA</a>`
      : `<span class="disabled">Chat WA</span>`;
    const mapsLink = lead.mapsUrl
      ? `<a href="${escapeHtml(lead.mapsUrl)}" target="_blank" rel="noopener">Buka Maps</a>`
      : `<span class="disabled">Buka Maps</span>`;

    tr.innerHTML = `
      <td class="name-cell">${escapeHtml(lead.name)}</td>
      <td class="muted-cell">${escapeHtml(lead.category || '-')}</td>
      <td class="muted-cell">${escapeHtml(lead.address || '-')}</td>
      <td class="muted-cell">${escapeHtml(lead.phone || '-')}</td>
      <td>${websiteCell}</td>
      <td class="muted-cell">${new Date(lead.scrapedAt).toLocaleString('id-ID')}</td>
      <td><div class="action-links">${mapsLink}${waLink}</div></td>
    `;
    tbody.appendChild(tr);
  }
}

async function loadLeads() {
  const { leads = [] } = await chrome.storage.local.get('leads');
  allLeads = leads.slice().reverse(); // terbaru di atas
  render();
}

function toCsvValue(v) {
  const s = String(v ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function exportCsv() {
  if (currentFilteredLeads.length === 0) {
    alert('Tidak ada data yang tampil untuk di-export.');
    return;
  }
  
  const rows = [
    ['Nama', 'Kategori', 'Alamat', 'Telepon', 'Website', 'Punya Website', 'Diambil'],
    ...currentFilteredLeads.map((l) => [
      l.name,
      l.category || '',
      l.address || '',
      l.phone || '',
      l.website || '',
      l.hasWebsite ? 'Ya' : 'Tidak',
      l.scrapedAt,
    ]),
  ];
  const csv = rows.map((r) => r.map(toCsvValue).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gmaps-leads-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportJson() {
  if (currentFilteredLeads.length === 0) {
    alert('Tidak ada data yang tampil untuk di-export.');
    return;
  }
  // Skema ini yang dipakai kalau mau diproses di website sendiri:
  // { name, address, phone, website, hasWebsite, category, mapsUrl, scrapedAt }
  const json = JSON.stringify(currentFilteredLeads, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gmaps-leads-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

searchInput.addEventListener('input', render);
onlyNoWebsite.addEventListener('change', render);
exportCsvBtn.addEventListener('click', exportCsv);
exportJsonBtn.addEventListener('click', exportJson);
clearBtn.addEventListener('click', async () => {
  if (!confirm('Yakin mau hapus semua data yang sudah tersimpan?')) return;
  await chrome.storage.local.set({ leads: [] });
  loadLeads();
});

addManualBtn.addEventListener('click', () => {
  manualForm.hidden = !manualForm.hidden;
});

mCancelBtn.addEventListener('click', () => {
  manualForm.hidden = true;
  [mName, mCategory, mAddress, mPhone, mWebsite, mMapsUrl].forEach((el) => (el.value = ''));
});

mSaveBtn.addEventListener('click', async () => {
  const name = mName.value.trim();
  if (!name) {
    alert('Nama bisnis wajib diisi.');
    return;
  }
  const website = mWebsite.value.trim();
  const newLead = {
    name,
    address: mAddress.value.trim(),
    phone: mPhone.value.trim(),
    category: mCategory.value.trim(),
    website,
    hasWebsite: !!website,
    mapsUrl: mMapsUrl.value.trim(),
    scrapedAt: new Date().toISOString(),
  };
  const { leads = [] } = await chrome.storage.local.get('leads');
  leads.push(newLead);
  await chrome.storage.local.set({ leads });

  [mName, mCategory, mAddress, mPhone, mWebsite, mMapsUrl].forEach((el) => (el.value = ''));
  manualForm.hidden = true;
  loadLeads();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.leads) {
    loadLeads();
  }
});

loadLeads();
