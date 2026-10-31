// table.js
// GMaps Lead Finder - 8-Column Controller with AI Web Research & Persistence

const tbody = document.getElementById('tbody');
const summary = document.getElementById('summary');
const emptyState = document.getElementById('emptyState');
const searchInput = document.getElementById('search');
const onlyNoWebsite = document.getElementById('onlyNoWebsite');
const storageBadge = document.getElementById('storageBadge');

const exportCsvBtn = document.getElementById('exportCsvBtn');
const exportJsonBtn = document.getElementById('exportJsonBtn');
const syncDashboardBtn = document.getElementById('syncDashboardBtn');
const syncStatus = document.getElementById('syncStatus');
const clearBtn = document.getElementById('clearBtn');
const addManualBtn = document.getElementById('addManualBtn');
const manualForm = document.getElementById('manualForm');

const bulkAiBtn = document.getElementById('bulkAiBtn');
const aiProgressStatus = document.getElementById('aiProgressStatus');
const aiSettingsBtn = document.getElementById('aiSettingsBtn');

// Modals
const aiDetailModal = document.getElementById('aiDetailModal');
const aiModalCloseBtn = document.getElementById('aiModalCloseBtn');
const aiModalBizName = document.getElementById('aiModalBizName');
const aiModalCategory = document.getElementById('aiModalCategory');
const aiModalQualification = document.getElementById('aiModalQualification');
const aiModalSummary = document.getElementById('aiModalSummary');
const aiModalSocials = document.getElementById('aiModalSocials');
const aiModalOlshop = document.getElementById('aiModalOlshop');
const aiModalContacts = document.getElementById('aiModalContacts');
const aiModalPitchAngle = document.getElementById('aiModalPitchAngle');
const aiModalPitchText = document.getElementById('aiModalPitchText');
const aiModalCopyBtn = document.getElementById('aiModalCopyBtn');
const aiModalWaLink = document.getElementById('aiModalWaLink');

const aiSettingsModal = document.getElementById('aiSettingsModal');
const aiSettingsCloseBtn = document.getElementById('aiSettingsCloseBtn');
const aiProviderSelect = document.getElementById('aiProviderSelect');
const aiApiKeyInput = document.getElementById('aiApiKeyInput');
const aiSaveSettingsBtn = document.getElementById('aiSaveSettingsBtn');
const aiTestBtn = document.getElementById('aiTestBtn');
const aiTestStatus = document.getElementById('aiTestStatus');

// Form manual
const mName = document.getElementById('mName');
const mCategory = document.getElementById('mCategory');
const mRating = document.getElementById('mRating');
const mReviews = document.getElementById('mReviews');
const mAddress = document.getElementById('mAddress');
const mPhone = document.getElementById('mPhone');
const mWebsite = document.getElementById('mWebsite');
const mMapsUrl = document.getElementById('mMapsUrl');
const mSaveBtn = document.getElementById('mSaveBtn');
const mCancelBtn = document.getElementById('mCancelBtn');

let allLeads = [];
let currentFilteredLeads = [];
let analyzingIndexes = new Set();
let isBulkRunning = false;

// Default konfigurasi AI
const DEFAULT_AI_CONFIG = {
  provider: 'deepseek',
  apiKey: 'sk-34bfff0ba1494b3fa81e494b7b2535d1',
  model: 'deepseek-chat'
};
let currentAiConfig = { ...DEFAULT_AI_CONFIG };

// Normalisasi nomor telepon lokal Indonesia ke format wa.me (628...)
function normalizePhoneForWa(phone) {
  if (!phone) return '';
  let digits = phone.replace(/[^\d]/g, '');
  if (digits.startsWith('0')) digits = '62' + digits.slice(1);
  if (!digits.startsWith('62') && digits.length >= 8) digits = '62' + digits;
  return digits;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function updateStorageBadge(text = '💾 Tersimpan Aman di Storage') {
  if (storageBadge) {
    storageBadge.textContent = text;
    storageBadge.style.background = '#dcfce7';
    storageBadge.style.color = '#15803d';
    setTimeout(() => {
      storageBadge.style.background = '#f1f5f9';
      storageBadge.style.color = '#475569';
    }, 2500);
  }
}

// Cek apakah URL adalah sosial media
function isSocialMediaUrl(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    lower.includes('instagram.com') ||
    lower.includes('instagr.am') ||
    lower.includes('ig.me') ||
    lower.includes('facebook.com') ||
    lower.includes('fb.com') ||
    lower.includes('fb.me') ||
    lower.includes('tiktok.com') ||
    lower.includes('twitter.com') ||
    lower.includes('x.com') ||
    lower.includes('youtube.com') ||
    lower.includes('youtu.be') ||
    lower.includes('linktr.ee') ||
    lower.includes('s.id') ||
    lower.includes('bit.ly') ||
    lower.includes('campsite.bio') ||
    lower.includes('beacons.ai') ||
    lower.includes('heylink.me') ||
    lower.includes('bio.link') ||
    lower.includes('taplink.cc') ||
    lower.includes('lynk.id') ||
    lower.includes('msha.ke')
  );
}

// Cek apakah URL adalah online shop / marketplace (termasuk shortlink seperti shope.ee / shp.ee)
function isOnlineShopUrl(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    lower.includes('shopee.') ||
    lower.includes('shope.ee') ||
    lower.includes('shp.ee') ||
    lower.includes('tokopedia.') ||
    lower.includes('tkp.me') ||
    lower.includes('lazada.') ||
    lower.includes('lzd.co') ||
    lower.includes('bukalapak.') ||
    lower.includes('bl.id') ||
    lower.includes('blibli.') ||
    lower.includes('blib.li') ||
    lower.includes('grab.com') ||
    lower.includes('gofood.') ||
    lower.includes('shopeefood') ||
    lower.includes('olx.co.id') ||
    lower.includes('carousell.')
  );
}

// BERSINKAN DATA TANPA MEMBUANG SOSMED / ONLINE SHOP
function cleanLead(l) {
  let name = (l.name || '')
    .replace(/[·\•]\s*(?:Link yang dikunjungi|Visited link|Ditampilkan|Promosi|Iklan|Ad)\b.*/i, '')
    .replace(/^(?:Link yang dikunjungi|Visited link)[·\•\s]*/i, '')
    .replace(/\s*[·\•]\s*$/, '')
    .trim();

  let website = (l.website || '').trim();
  let phone = (l.phone || '').trim();
  let whatsapp = (l.whatsapp || '').trim();
  let address = (l.address || '').trim();
  let socialMedia = (l.socialMedia || '').trim();
  let onlineShop = (l.onlineShop || '').trim();
  let aiResearch = l.aiResearch || null;

  // Jika website mengandung link sosmed, pindahkan ke socialMedia
  if (isSocialMediaUrl(website)) {
    if (!socialMedia) socialMedia = website;
    website = '';
  }

  // Jika website mengandung link marketplace (seperti shope.ee / shp.ee), pindahkan ke onlineShop
  if (isOnlineShopUrl(website)) {
    if (!onlineShop) onlineShop = website;
    website = '';
  }

  // Jika website mengandung link wa.me atau whatsapp.com, pindahkan ke nomor whatsapp
  const lowerWeb = website.toLowerCase();
  if (lowerWeb.includes('wa.me') || lowerWeb.includes('whatsapp.com')) {
    const waMatch = website.match(/(?:wa\.me\/|phone=)(?:62|0)?(\d+)/);
    if (waMatch && !whatsapp) whatsapp = '0' + waMatch[1];
    website = '';
  }

  // Jika whatsapp kosong tapi phone adalah nomor HP Indonesia (08... atau 628...), set whatsapp = phone
  if (!whatsapp && phone) {
    const digits = phone.replace(/[^\d]/g, '');
    if (digits.startsWith('08') || digits.startsWith('628') || digits.startsWith('8')) {
      whatsapp = phone;
    }
  }

  // Hapus domain Google dari slot website
  if (lowerWeb.includes('google.') || lowerWeb.includes('gstatic.') || lowerWeb.includes('waze.')) {
    website = '';
  }

  // Bersihkan alamat dari artefak jam buka/tutup
  address = address
    .replace(/[·\s]*(?:Buka|Tutup|Segera)\s*[·\-–—]?\s*(?:Tutup|Buka|Segera)?\s*(?:pukul)?\s*\d{1,2}[\.:]?\d{0,2}(?:\s*[–\-]\s*\d{1,2}[\.:]?\d{0,2})?/gi, '')
    .replace(/[·\s]*(?:Buka|Tutup|Segera)\s*(?:24 jam|sementara|selamanya|permanen)?/gi, '')
    .replace(/(?:Buka|Tutup|Segera)$/gi, '')
    .replace(/\b(?:Buka|Tutup|Segera)\b/gi, '')
    .replace(/^[\s·\-–—,;]+|[\s·\-–—,;]+$/g, '')
    .trim();

  // Validasi rating desimal (1.0 - 5.0)
  let rating = (l.rating || '').toString().trim();
  if (rating) {
    const rVal = parseFloat(rating.replace(',', '.'));
    if (isNaN(rVal) || rVal < 1.0 || rVal > 5.0) rating = '';
    else rating = rVal.toFixed(1);
  }

  let reviewCount = (l.reviewCount || '').toString().trim();

  const hasWebsite = !!website && website.includes('.');

  return {
    ...l,
    name,
    website,
    phone,
    whatsapp,
    address,
    rating,
    reviewCount,
    socialMedia,
    onlineShop,
    aiResearch,
    hasWebsite
  };
}

// Format Pill Sosmed & Olshop (Clean UI, tanpa emoji)
function renderSocialOlshopCell(lead) {
  const pills = [];

  if (lead.socialMedia) {
    const s = lead.socialMedia.toLowerCase();
    if (s.includes('instagram.com')) {
      pills.push(`<a class="pill pill-ig" href="${escapeHtml(lead.socialMedia)}" target="_blank" rel="noopener">Instagram</a>`);
    } else if (s.includes('tiktok.com')) {
      pills.push(`<a class="pill pill-tiktok" href="${escapeHtml(lead.socialMedia)}" target="_blank" rel="noopener">TikTok</a>`);
    } else if (s.includes('facebook.com') || s.includes('fb.')) {
      pills.push(`<a class="pill pill-fb" href="${escapeHtml(lead.socialMedia)}" target="_blank" rel="noopener">Facebook</a>`);
    } else {
      pills.push(`<a class="pill pill-other" href="${escapeHtml(lead.socialMedia)}" target="_blank" rel="noopener">Sosmed</a>`);
    }
  }

  if (lead.onlineShop) {
    const o = lead.onlineShop.toLowerCase();
    if (o.includes('shopee.') || o.includes('shope.ee') || o.includes('shp.ee')) {
      pills.push(`<a class="pill pill-shopee" href="${escapeHtml(lead.onlineShop)}" target="_blank" rel="noopener">Shopee</a>`);
    } else if (o.includes('tokopedia.') || o.includes('tkp.me')) {
      pills.push(`<a class="pill pill-tokped" href="${escapeHtml(lead.onlineShop)}" target="_blank" rel="noopener">Tokopedia</a>`);
    } else if (o.includes('lazada.') || o.includes('lzd.co')) {
      pills.push(`<a class="pill pill-other" href="${escapeHtml(lead.onlineShop)}" target="_blank" rel="noopener">Lazada</a>`);
    } else if (o.includes('tiktok.com') || o.includes('shop.tiktok')) {
      pills.push(`<a class="pill pill-tiktok" href="${escapeHtml(lead.onlineShop)}" target="_blank" rel="noopener">TikTok Shop</a>`);
    } else {
      pills.push(`<a class="pill pill-other" href="${escapeHtml(lead.onlineShop)}" target="_blank" rel="noopener">Olshop</a>`);
    }
  }

  // Jika AI mendeteksi sosmed/olshop tambahan
  if (lead.aiResearch) {
    const aiSoc = lead.aiResearch.socialMedia;
    const aiShop = lead.aiResearch.onlineShop;
    if (aiSoc && aiSoc.instagram && !lead.socialMedia?.includes('instagram.com')) {
      pills.push(`<span class="pill pill-ig" title="Hasil Riset AI">${escapeHtml(aiSoc.instagram)}</span>`);
    }
    if (aiShop && aiShop.shopee && !lead.onlineShop?.includes('shopee.')) {
      pills.push(`<span class="pill pill-shopee" title="Hasil Riset AI">Shopee: ${escapeHtml(aiShop.shopee)}</span>`);
    }
  }

  if (pills.length === 0) {
    return `<span class="disabled">-</span>`;
  }

  return `<div class="pills-wrap">${pills.join('')}</div>`;
}

// Render cell Riset AI (Sleek, sejajar, tanpa emoji tacky)
function renderAiCell(lead, leadIndex) {
  if (analyzingIndexes.has(leadIndex)) {
    return `
      <span class="badge-status badge-analyzing">
        <span class="spinner-dot"></span> Meriset...
      </span>
    `;
  }

  if (lead.aiResearch) {
    const qual = lead.aiResearch.leadQualification || 'WARM LEAD';
    let badgeClass = 'badge-warm';
    if (qual.includes('HOT')) {
      badgeClass = 'badge-hot';
    } else if (qual.includes('COLD')) {
      badgeClass = 'badge-cold';
    }

    return `
      <button class="badge-status ${badgeClass}" onclick="openAiDetail(${leadIndex})" title="Klik untuk lihat detail riset & pitch">
        <span class="status-dot"></span> ${escapeHtml(qual)}
      </button>
    `;
  }

  return `
    <button class="btn-action btn-ai" onclick="runAiResearchSingle(${leadIndex})">
      Riset AI
    </button>
  `;
}

// Render tabel utama 8 kolom
function render() {
  const query = searchInput.value.trim().toLowerCase();
  const filterNoSite = onlyNoWebsite.checked;

  currentFilteredLeads = allLeads.filter((l) => {
    if (filterNoSite && l.hasWebsite) return false;
    if (!query) return true;
    return (
      (l.name || '').toLowerCase().includes(query) ||
      (l.address || '').toLowerCase().includes(query) ||
      (l.category || '').toLowerCase().includes(query) ||
      (l.phone || '').toLowerCase().includes(query) ||
      (l.socialMedia || '').toLowerCase().includes(query) ||
      (l.onlineShop || '').toLowerCase().includes(query)
    );
  });

  summary.textContent = `${currentFilteredLeads.length} data ditampilkan (dari ${allLeads.length} total tersimpan)`;

  tbody.innerHTML = '';

  if (allLeads.length === 0) {
    emptyState.hidden = false;
    emptyState.textContent = 'Belum ada data. Buka Google Maps, cari bisnis, lalu jalankan lewat extension.';
  } else if (currentFilteredLeads.length === 0) {
    emptyState.hidden = false;
    emptyState.innerHTML = `Tidak ada data yang cocok dengan filter.<br><span style="font-size:12px;color:#64748b;">(Ada total ${allLeads.length} data tersimpan. Coba matikan centang "Cuma yang belum punya website" di atas)</span>`;
  } else {
    emptyState.hidden = true;
  }

  for (let i = 0; i < currentFilteredLeads.length; i++) {
    const lead = currentFilteredLeads[i];
    const realIndex = allLeads.indexOf(lead);
    const tr = document.createElement('tr');

    // Website Cell
    const websiteCell = lead.hasWebsite
      ? `<a class="site-link" href="${escapeHtml(lead.website)}" target="_blank" rel="noopener">${escapeHtml(lead.website)}</a>`
      : `<span class="badge no">Belum ada</span>`;

    // Aksi WA
    const waDigits = normalizePhoneForWa(lead.whatsapp || lead.phone);
    const waButton = waDigits
      ? `<a class="btn-action btn-wa" href="https://wa.me/${waDigits}" target="_blank" rel="noopener">Chat WA</a>`
      : `<span class="btn-action btn-disabled">No WA</span>`;

    // Aksi Maps
    const mapsLink = lead.mapsUrl
      ? `<a class="btn-action btn-maps" href="${escapeHtml(lead.mapsUrl)}" target="_blank" rel="noopener">Maps</a>`
      : `<span class="btn-action btn-disabled">Maps</span>`;

    const deleteBtn = `
      <button class="btn-action btn-delete" onclick="deleteLead(${realIndex})" title="Hapus baris ini">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
      </button>
    `;

    // Format jumlah ulasan asli
    let reviewCountFormatted = '';
    if (lead.reviewCount) {
      const num = parseInt(lead.reviewCount, 10);
      reviewCountFormatted = isNaN(num) ? lead.reviewCount : num.toLocaleString('id-ID');
    }

    // Rating Display (Contoh: ★ 4.8 (656))
    const ratingDisplay = lead.rating 
      ? `<span style="color:#d97706;font-weight:600;">★ ${escapeHtml(lead.rating)}</span>${reviewCountFormatted ? ` <span style="color:#64748b;font-size:11.5px;">(${escapeHtml(reviewCountFormatted)})</span>` : ''}`
      : `<span style="color:#94a3b8;">-</span>`;

    tr.innerHTML = `
      <td class="name-cell">
        <div>${escapeHtml(lead.name)}</div>
      </td>
      <td>${ratingDisplay}</td>
      <td>
        <div style="font-weight:500;color:#0f172a;font-size:12px;">${escapeHtml(lead.category || '-')}</div>
        <div class="address-cell" style="font-size:11.5px;color:#64748b;">${escapeHtml(lead.address || '-')}</div>
      </td>
      <td>
        <div style="font-size:12px;">${lead.phone ? escapeHtml(lead.phone) : '<span style="color:#94a3b8;">-</span>'}</div>
        ${lead.whatsapp ? `<div style="font-size:11px;color:#10b981;font-weight:500;">WA: ${escapeHtml(lead.whatsapp)}</div>` : ''}
      </td>
      <td>${websiteCell}</td>
      <td>${renderSocialOlshopCell(lead)}</td>
      <td style="vertical-align:middle;">${renderAiCell(lead, realIndex)}</td>
      <td class="action-cell">
        <div class="action-group">
          ${waButton}
          ${mapsLink}
          ${deleteBtn}
        </div>
      </td>
    `;

    tbody.appendChild(tr);
  }
}

// Hapus lead tunggal
window.deleteLead = async function(index) {
  if (confirm(`Hapus "${allLeads[index]?.name}"?`)) {
    allLeads.splice(index, 1);
    await chrome.storage.local.set({ leads: allLeads, leads_backup: allLeads });
    updateStorageBadge('💾 Data Terhapus & Tersimpan');
    render();
  }
};

// Panggil API AI untuk riset mendalam web/browser
async function callAiResearchApi(lead, config) {
  const systemPrompt = `Kamu adalah AI Web Intelligence & Research Assistant untuk agensi pembuatan website.
Tugas kamu adalah menganalisis jejak digital bisnis/toko di internet/browser di luar Google Maps:
- Nama Toko: "${lead.name}"
- Kategori: "${lead.category || '-'}"
- Alamat/Kota: "${lead.address || '-'}"
- Nomor Telepon: "${lead.phone || '-'}"
- Data Maps saat ini: Website: "${lead.website || 'BELUM ADA'}", Sosmed: "${lead.socialMedia || 'BELUM ADA'}", Olshop: "${lead.onlineShop || 'BELUM ADA'}"

Berikan analisis jejak online toko ini dalam format JSON MURNI tanpa markdown/backticks:
{
  "hasOfficialWebsite": false,
  "detectedWebsite": null,
  "socialMedia": {
    "instagram": "@nama_toko / null",
    "tiktok": "@nama_toko / null",
    "facebook": "nama / null"
  },
  "onlineShop": {
    "shopee": "nama_toko / null",
    "tokopedia": "nama_toko / null"
  },
  "additionalContact": {
    "email": "email_toko / null",
    "adminWa": "nomor_lain / null"
  },
  "digitalPresenceSummary": "Jelaskan status toko di internet (1-2 kalimat). Misal: Toko aktif di Shopee dan Instagram namun belum memiliki website katalog resmi.",
  "leadQualification": "HOT LEAD" | "WARM LEAD" | "COLD LEAD",
  "pitchAngle": "Sudut penawaran website paling pas (misal: buat landing page katalog agar tidak terkena potongan fee marketplace).",
  "pitchDraft": "Halo kak [Nama Toko], salam kenal dari tim Web Dev. Kami lihat toko kakak di [Alamat] sudah ramai ulasan dan aktif di [Sosmed/Shopee]. Apakah tertarik dibuatkan website katalog resmi mandiri agar pelanggan lebih mudah order dan hemat komisi marketplace? Boleh kami kirimkan contoh demonya kak?"
}`;

  if (config.provider === 'deepseek') {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model || 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Lakukan riset web dan kualifikasi untuk toko: ${lead.name} di ${lead.address}` }
        ],
        temperature: 0.3
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`DeepSeek Error (${res.status}): ${errText}`);
    }
    const data = await res.json();
    let text = data.choices?.[0]?.message?.content || '{}';
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(text);
  } else if (config.provider === 'gemini') {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${config.apiKey}`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: systemPrompt + `\n\nLakukan riset untuk toko: ${lead.name} di ${lead.address}` }
            ]
          }
        ]
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini Error (${res.status}): ${errText}`);
    }
    const data = await res.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(text);
  } else {
    throw new Error('Provider tidak didukung');
  }
}

// Jalankan Riset AI untuk 1 lead
window.runAiResearchSingle = async function(index) {
  const lead = allLeads[index];
  if (!lead) return;

  if (!currentAiConfig.apiKey) {
    alert('API Key AI belum diisi! Silakan buka tombol ⚙️ Pengaturan AI di atas.');
    aiSettingsModal.hidden = false;
    return;
  }

  analyzingIndexes.add(index);
  render();

  try {
    const research = await callAiResearchApi(lead, currentAiConfig);
    lead.aiResearch = research;
    allLeads[index] = lead;

    // KUNCI LANGSUNG KE CHROME STORAGE LOKAL
    await chrome.storage.local.set({ leads: allLeads, leads_backup: allLeads });
    updateStorageBadge('💾 Hasil Riset AI Tersimpan Permanen');
  } catch (err) {
    alert(`Gagal riset AI untuk "${lead.name}":\n${err.message}`);
  } finally {
    analyzingIndexes.delete(index);
    render();
  }
};

// Buka Modal Detail Hasil Riset AI
window.openAiDetail = function(index) {
  const lead = allLeads[index];
  if (!lead || !lead.aiResearch) return;

  const res = lead.aiResearch;

  aiModalBizName.textContent = lead.name;
  aiModalCategory.textContent = `${lead.category || '-'} • ${lead.address || '-'}`;

  const qual = res.leadQualification || 'WARM LEAD';
  aiModalQualification.textContent = `Kualifikasi: ${qual}`;
  if (qual.includes('HOT')) {
    aiModalQualification.style.background = '#fee2e2';
    aiModalQualification.style.color = '#b91c1c';
  } else if (qual.includes('COLD')) {
    aiModalQualification.style.background = '#f1f5f9';
    aiModalQualification.style.color = '#475569';
  } else {
    aiModalQualification.style.background = '#fef3c7';
    aiModalQualification.style.color = '#b45309';
  }

  aiModalSummary.textContent = res.digitalPresenceSummary || 'Tidak ada ringkasan.';

  const socParts = [];
  if (res.socialMedia?.instagram) socParts.push(`IG: ${res.socialMedia.instagram}`);
  if (res.socialMedia?.tiktok) socParts.push(`TikTok: ${res.socialMedia.tiktok}`);
  if (res.socialMedia?.facebook) socParts.push(`FB: ${res.socialMedia.facebook}`);
  aiModalSocials.textContent = socParts.length > 0 ? socParts.join(' | ') : (lead.socialMedia || '-');

  const shopParts = [];
  if (res.onlineShop?.shopee) shopParts.push(`Shopee: ${res.onlineShop.shopee}`);
  if (res.onlineShop?.tokopedia) shopParts.push(`Tokopedia: ${res.onlineShop.tokopedia}`);
  aiModalOlshop.textContent = shopParts.length > 0 ? shopParts.join(' | ') : (lead.onlineShop || '-');

  const contParts = [];
  if (res.additionalContact?.email) contParts.push(`Email: ${res.additionalContact.email}`);
  if (res.additionalContact?.adminWa) contParts.push(`WA Admin: ${res.additionalContact.adminWa}`);
  aiModalContacts.textContent = contParts.length > 0 ? contParts.join(' | ') : '-';

  aiModalPitchAngle.textContent = res.pitchAngle || '-';
  aiModalPitchText.value = res.pitchDraft || `Halo kak ${lead.name}, kami lihat toko kakak sangat potensial...`;

  const waDigits = normalizePhoneForWa(res.additionalContact?.adminWa || lead.whatsapp || lead.phone);
  if (waDigits) {
    const textEncoded = encodeURIComponent(aiModalPitchText.value);
    aiModalWaLink.href = `https://wa.me/${waDigits}?text=${textEncoded}`;
    aiModalWaLink.style.display = 'inline-block';
  } else {
    aiModalWaLink.style.display = 'none';
  }

  aiDetailModal.hidden = false;
};

// Modal Detail Events
aiModalCloseBtn.addEventListener('click', () => {
  aiDetailModal.hidden = true;
});

aiModalCopyBtn.addEventListener('click', () => {
  aiModalPitchText.select();
  document.execCommand('copy');
  aiModalCopyBtn.textContent = '✅ Berhasil Disalin!';
  setTimeout(() => {
    aiModalCopyBtn.textContent = '📋 Salin Pesan';
  }, 2000);
});

// Bulk AI Research
bulkAiBtn.addEventListener('click', async () => {
  if (isBulkRunning) {
    alert('Riset AI sedang berjalan!');
    return;
  }

  const unresearched = allLeads.filter((l) => !l.aiResearch);
  if (unresearched.length === 0) {
    alert('Semua toko yang ada sudah selesai di-riset oleh AI!');
    return;
  }

  if (!confirm(`Mulai riset AI otomatis untuk ${unresearched.length} toko yang belum di-riset?`)) {
    return;
  }

  isBulkRunning = true;
  aiProgressStatus.style.display = 'block';
  aiProgressStatus.style.background = '#e0e7ff';
  aiProgressStatus.style.color = '#3730a3';

  let doneCount = 0;
  for (let i = 0; i < allLeads.length; i++) {
    const lead = allLeads[i];
    if (lead.aiResearch) continue;

    aiProgressStatus.textContent = `⏳ Meriset [${doneCount + 1}/${unresearched.length}]: ${lead.name}... (Data tersimpan otomatis setiap toko)`;
    analyzingIndexes.add(i);
    render();

    try {
      const research = await callAiResearchApi(lead, currentAiConfig);
      lead.aiResearch = research;
      allLeads[i] = lead;
      doneCount += 1;

      // SIMPAN KE STORAGE SETIAP SELESAI 1 TOKO (ANTI HILANG)
      await chrome.storage.local.set({ leads: allLeads, leads_backup: allLeads });
      updateStorageBadge(`💾 Tersimpan Otomatis (${doneCount}/${unresearched.length})`);
    } catch (err) {
      console.error(`Error riset ${lead.name}:`, err);
    } finally {
      analyzingIndexes.delete(i);
      render();
    }

    // Delay santai agar tidak terkena rate-limit API
    await new Promise((r) => setTimeout(r, 600));
  }

  isBulkRunning = false;
  aiProgressStatus.style.background = '#dcfce7';
  aiProgressStatus.style.color = '#15803d';
  aiProgressStatus.textContent = `✅ Selesai! Berhasil meriset ${doneCount} toko dan tersimpan aman di storage.`;
  setTimeout(() => {
    aiProgressStatus.style.display = 'none';
  }, 5000);
});

// AI Settings Modal
aiSettingsBtn.addEventListener('click', () => {
  aiProviderSelect.value = currentAiConfig.provider || 'deepseek';
  aiApiKeyInput.value = currentAiConfig.apiKey || '';
  aiTestStatus.style.display = 'none';
  aiSettingsModal.hidden = false;
});

aiSettingsCloseBtn.addEventListener('click', () => {
  aiSettingsModal.hidden = true;
});

aiSaveSettingsBtn.addEventListener('click', async () => {
  currentAiConfig.provider = aiProviderSelect.value;
  currentAiConfig.apiKey = aiApiKeyInput.value.trim();
  currentAiConfig.model = currentAiConfig.provider === 'deepseek' ? 'deepseek-chat' : 'gemini-1.5-flash';

  await chrome.storage.local.set({ aiConfig: currentAiConfig });
  alert('Pengaturan AI berhasil disimpan!');
  aiSettingsModal.hidden = true;
});

aiTestBtn.addEventListener('click', async () => {
  const provider = aiProviderSelect.value;
  const apiKey = aiApiKeyInput.value.trim();

  if (!apiKey) {
    aiTestStatus.style.display = 'block';
    aiTestStatus.style.color = '#dc2626';
    aiTestStatus.textContent = 'Masukkan API Key terlebih dahulu!';
    return;
  }

  aiTestStatus.style.display = 'block';
  aiTestStatus.style.color = '#4338ca';
  aiTestStatus.textContent = '⏳ Menguji koneksi ke server AI...';

  try {
    const dummy = { name: 'Toko Sepatu Berkah', category: 'Toko Sepatu', address: 'Bogor', phone: '08123456789' };
    const res = await callAiResearchApi(dummy, { provider, apiKey, model: provider === 'deepseek' ? 'deepseek-chat' : 'gemini-1.5-flash' });
    if (res && res.leadQualification) {
      aiTestStatus.style.color = '#15803d';
      aiTestStatus.textContent = `✅ Berhasil terhubung! Kualifikasi uji coba: ${res.leadQualification}`;
    } else {
      throw new Error('Format respon tidak sesuai');
    }
  } catch (err) {
    aiTestStatus.style.color = '#dc2626';
    aiTestStatus.textContent = `❌ Gagal: ${err.message}`;
  }
});

// Muat data dari storage saat tab dibuka
async function load() {
  const { leads = [], aiConfig, tableFilters } = await chrome.storage.local.get(['leads', 'aiConfig', 'tableFilters']);
  
  if (aiConfig) {
    currentAiConfig = { ...DEFAULT_AI_CONFIG, ...aiConfig };
  } else {
    await chrome.storage.local.set({ aiConfig: DEFAULT_AI_CONFIG });
  }

  // Ingat preferensi filter pengguna
  if (tableFilters && typeof tableFilters.onlyNoWebsite === 'boolean') {
    onlyNoWebsite.checked = tableFilters.onlyNoWebsite;
  } else {
    onlyNoWebsite.checked = false; // Tampilkan semua data secara default!
  }

  allLeads = (leads || []).map(cleanLead);
  // Simpan kembali data yang sudah dinormalisasi dan backup
  await chrome.storage.local.set({ leads: allLeads, leads_backup: allLeads });
  updateStorageBadge('💾 Data Tersimpan Aman');
  render();
}

// Event Listeners
searchInput.addEventListener('input', render);
onlyNoWebsite.addEventListener('change', async () => {
  await chrome.storage.local.set({ tableFilters: { onlyNoWebsite: onlyNoWebsite.checked } });
  render();
});

// Tambah manual
addManualBtn.addEventListener('click', () => {
  manualForm.hidden = !manualForm.hidden;
  if (!manualForm.hidden) mName.focus();
});

mCancelBtn.addEventListener('click', () => {
  manualForm.hidden = true;
});

mSaveBtn.addEventListener('click', async () => {
  const name = mName.value.trim();
  if (!name) {
    alert('Nama bisnis wajib diisi');
    return;
  }
  const lead = cleanLead({
    name,
    category: mCategory.value.trim(),
    rating: mRating.value.trim(),
    reviewCount: mReviews.value.trim(),
    address: mAddress.value.trim(),
    phone: mPhone.value.trim(),
    website: mWebsite.value.trim(),
    mapsUrl: mMapsUrl.value.trim(),
    hasWebsite: !!mWebsite.value.trim(),
    scrapedAt: new Date().toISOString()
  });

  allLeads.unshift(lead);
  await chrome.storage.local.set({ leads: allLeads, leads_backup: allLeads });
  updateStorageBadge('💾 Toko Manual Tersimpan');
  render();

  mName.value = '';
  mCategory.value = '';
  mRating.value = '';
  mReviews.value = '';
  mAddress.value = '';
  mPhone.value = '';
  mWebsite.value = '';
  mMapsUrl.value = '';
  manualForm.hidden = true;
});

// Hapus semua data
clearBtn.addEventListener('click', async () => {
  if (confirm('Yakin ingin menghapus semua data yang tersimpan di ekstensi?')) {
    allLeads = [];
    await chrome.storage.local.set({ leads: [] });
    updateStorageBadge('🗑️ Semua Data Dikosongkan');
    render();
  }
});

// Export CSV
exportCsvBtn.addEventListener('click', () => {
  if (currentFilteredLeads.length === 0) {
    alert('Tidak ada data untuk diekspor');
    return;
  }

  const headers = ['Nama Bisnis', 'Rating', 'Jumlah Ulasan', 'Kategori', 'Alamat', 'Telepon', 'WhatsApp', 'Website Resmi', 'Sosmed', 'Online Shop', 'Kualifikasi AI', 'Riset AI Web', 'Pitch AI', 'Maps URL'];
  const rows = currentFilteredLeads.map((l) => [
    `"${(l.name || '').replace(/"/g, '""')}"`,
    `"${(l.rating || '').replace(/"/g, '""')}"`,
    `"${(l.reviewCount || '').replace(/"/g, '""')}"`,
    `"${(l.category || '').replace(/"/g, '""')}"`,
    `"${(l.address || '').replace(/"/g, '""')}"`,
    `"${(l.phone || '').replace(/"/g, '""')}"`,
    `"${(l.whatsapp || l.phone || '').replace(/"/g, '""')}"`,
    `"${(l.website || '').replace(/"/g, '""')}"`,
    `"${(l.socialMedia || '').replace(/"/g, '""')}"`,
    `"${(l.onlineShop || '').replace(/"/g, '""')}"`,
    `"${(l.aiResearch?.leadQualification || '').replace(/"/g, '""')}"`,
    `"${(l.aiResearch?.digitalPresenceSummary || '').replace(/"/g, '""')}"`,
    `"${(l.aiResearch?.pitchDraft || '').replace(/"/g, '""')}"`,
    `"${(l.mapsUrl || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `leads-gmaps-ai-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

// Export JSON
exportJsonBtn.addEventListener('click', () => {
  if (currentFilteredLeads.length === 0) {
    alert('Tidak ada data untuk diekspor');
    return;
  }
  const jsonContent = JSON.stringify(currentFilteredLeads, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `leads-gmaps-ai-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

// Sinkron ke Web Dashboard
syncDashboardBtn.addEventListener('click', async () => {
  if (allLeads.length === 0) {
    alert('Tidak ada data yang bisa disinkronkan.');
    return;
  }

  syncStatus.style.display = 'block';
  syncStatus.style.background = '#e0f2fe';
  syncStatus.style.color = '#0369a1';
  syncStatus.textContent = '⏳ Sedang mengirim data ke Web Dashboard...';

  try {
    // Coba endpoint standar /api/import (Next.js dashboard)
    const res = await fetch('http://localhost:3000/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: allLeads })
    });

    if (res.ok) {
      const data = await res.json();
      syncStatus.style.background = '#dcfce7';
      syncStatus.style.color = '#15803d';
      syncStatus.textContent = `✅ Berhasil sinkron ${data.inserted || allLeads.length} data ke Web Dashboard!`;
    } else {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch (err) {
    syncStatus.style.background = '#fee2e2';
    syncStatus.style.color = '#b91c1c';
    syncStatus.textContent = `⚠️ Gagal sinkron ke localhost:3000 (${err.message}). Pastikan server dashboard menyala.`;
  }

  setTimeout(() => {
    syncStatus.style.display = 'none';
  }, 6000);
});

// Update otomatis jika ada data scraping masuk saat tabel terbuka
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.leads) {
    allLeads = (changes.leads.newValue || []).map(cleanLead);
    updateStorageBadge('💾 Data Baru Masuk & Tersimpan');
    render();
  }
});

load();
