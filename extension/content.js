// content.js
// Jalan di halaman google.com/maps. Bertugas:
// 1. Membaca daftar hasil pencarian (feed) yang sedang tampil di sidebar.
// 2. Klik satu-satu tiap hasil, baca panel detail (alamat, telepon, website).
// 3. Simpan ke chrome.storage.local, lapor progress ke popup.
//
// CATATAN: Google sering mengganti nama class internal mereka (mis. "Nv2PK", "DUwDvf").
// Supaya lebih tahan perubahan, script ini SEUTAMANYA mengandalkan atribut
// `aria-label` dan `data-item-id`, yang jauh lebih stabil dibanding nama class,
// karena dipakai juga untuk aksesibilitas (pembaca layar).

let isRunning = false;
let shouldStop = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(min, max) {
  return sleep(min + Math.random() * (max - min));
}

// Ambil elemen container daftar hasil pencarian di sidebar kiri.
function getFeed() {
  return document.querySelector('div[role="feed"]');
}

// Ambil semua "kartu" hasil pencarian yang punya link ke sebuah tempat.
function getResultCards() {
  const feed = getFeed();
  if (!feed) return [];
  const anchors = Array.from(feed.querySelectorAll('a[href*="/maps/place/"]'));
  // dedupe berdasarkan href, dan bungkus jadi objek {anchor, href}
  const seen = new Set();
  const cards = [];
  for (const a of anchors) {
    if (seen.has(a.href)) continue;
    seen.add(a.href);
    cards.push(a);
  }
  return cards;
}

// Scroll daftar hasil ke bawah supaya Google Maps memuat hasil tambahan (lazy-load).
async function scrollFeedForMore() {
  const feed = getFeed();
  if (!feed) return;
  feed.scrollTop = feed.scrollHeight;
  await randomDelay(900, 1400);
}

// Cari elemen di panel detail yang aria-label-nya diawali salah satu prefix
// (mendukung UI bahasa Indonesia maupun Inggris).
function findByAriaPrefixes(prefixes) {
  const all = document.querySelectorAll('[aria-label]');
  for (const el of all) {
    const label = el.getAttribute('aria-label') || '';
    for (const p of prefixes) {
      if (label.toLowerCase().startsWith(p.toLowerCase())) {
        return { el, label };
      }
    }
  }
  return null;
}

function stripPrefix(label, prefixes) {
  for (const p of prefixes) {
    if (label.toLowerCase().startsWith(p.toLowerCase())) {
      return label.slice(p.length).trim();
    }
  }
  return label.trim();
}

// Tunggu sampai panel detail nampak berubah (heuristik: h1 muncul dan stabil sesaat).
async function waitForDetailPanel(timeoutMs = 5000) {
  const start = Date.now();
  let lastH1 = null;
  while (Date.now() - start < timeoutMs) {
    const h1 = document.querySelector('h1');
    if (h1 && h1.textContent.trim().length > 0) {
      if (lastH1 === h1.textContent.trim()) {
        // sudah stabil 1 tick, anggap sudah load
        return true;
      }
      lastH1 = h1.textContent.trim();
    }
    await sleep(250);
  }
  return !!lastH1;
}

function extractDetailFromPanel(fallbackName) {
  // PENTING: pakai nama dari aria-label kartu hasil pencarian (fallbackName) sebagai
  // sumber utama, BUKAN document.querySelector('h1'). Google Maps kadang nyisain
  // h1 lama ("Hasil"/"Results") tetap ada di DOM meski udah nggak keliatan, jadi
  // querySelector('h1') bisa salah ambil elemen yang bukan nama bisnis.
  const nameEl = document.querySelector('h1');
  const name = fallbackName || (nameEl && nameEl.textContent.trim()) || '(tanpa nama)';

  const addressMatch = findByAriaPrefixes(['Address:', 'Alamat:']);
  const address = addressMatch ? stripPrefix(addressMatch.label, ['Address:', 'Alamat:']) : '';

  const phoneMatch = findByAriaPrefixes(['Phone:', 'Telepon:']);
  const phone = phoneMatch ? stripPrefix(phoneMatch.label, ['Phone:', 'Telepon:']) : '';

  // Website: cari elemen dengan data-item-id="authority" (link keluar ke situs resmi),
  // atau fallback ke aria-label "Website:".
  let website = '';
  const authorityEl = document.querySelector('[data-item-id="authority"]');
  if (authorityEl) {
    website = authorityEl.getAttribute('href') || authorityEl.textContent.trim();
  } else {
    const webMatch = findByAriaPrefixes(['Website:']);
    if (webMatch) website = stripPrefix(webMatch.label, ['Website:']);
  }

  let category = '';
  const catBtn = document.querySelector('button[jsaction="pane.rating.category"]') || document.querySelector('button.DkEaL');
  if (catBtn) {
    category = catBtn.textContent.trim();
  } else {
    // Fallback: look for button inside .fontBodyMedium
    const fallbackBtn = document.querySelector('.fontBodyMedium button');
    if (fallbackBtn) category = fallbackBtn.textContent.trim();
  }

  return {
    name,
    address,
    phone,
    website: website || '',
    hasWebsite: !!website,
    category,
    mapsUrl: window.location.href,
    scrapedAt: new Date().toISOString(),
  };
}

// Tunggu sampai daftar hasil (feed) muncul lagi di DOM, dipakai setelah
// klik tombol kembali dari halaman detail balik ke halaman list.
async function waitForFeedBack(timeoutMs = 7000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (getFeed()) return true;
    await sleep(200);
  }
  return false;
}

// Cari tombol panah kembali (←) yang beneran ada di UI Google Maps.
// Lebih reliable dibanding manipulasi history.back() lewat JS, karena ini
// persis aksi yang di-expect sama React punya Google Maps.
function findBackButton() {
  return document.querySelector(
    'button[aria-label="Back"], button[aria-label="Kembali"], button[aria-label^="Back to"], button[aria-label^="Kembali ke"]'
  );
}

async function goBackToList() {
  for (let attempt = 0; attempt < 3; attempt++) {
    const backBtn = findBackButton();
    if (backBtn) {
      backBtn.click();
    } else if (attempt === 0) {
      // fallback kalau tombolnya nggak ketemu sama sekali
      history.back();
    }
    const ok = await waitForFeedBack(2500);
    if (ok) return true;
  }
  return false;
}

async function saveLead(lead) {
  const { leads = [] } = await chrome.storage.local.get('leads');
  const dupIndex = leads.findIndex(
    (l) => l.name === lead.name && l.address === lead.address
  );
  let isNew = true;
  if (dupIndex >= 0) {
    leads[dupIndex] = lead; // update kalau sudah ada, tapi tidak dihitung sebagai data baru
    isNew = false;
  } else {
    leads.push(lead);
  }
  await chrome.storage.local.set({ leads });
  return { total: leads.length, isNew };
}

function reportProgress(count, target, status) {
  chrome.runtime.sendMessage({
    type: 'SCRAPE_PROGRESS',
    count,
    target,
    status,
  }).catch(() => {});
}

async function runScrape(target) {
  isRunning = true;
  shouldStop = false;

  if (!getFeed()) {
    // Ini kejadian kalau user lagi di halaman DETAIL satu bisnis
    // (google.com/maps/place/...), bukan di halaman LIST hasil pencarian.
    reportProgress(0, target, 'no_feed');
    isRunning = false;
    return;
  }

  const processedHrefs = new Set();
  // PENTING: target dihitung dari data BARU yang berhasil diambil di sesi ini,
  // bukan dari total data yang sudah pernah tersimpan sebelumnya. Kalau dihitung
  // dari total, target kecil (mis. 2) akan langsung dianggap "tercapai" ketika
  // sudah ada 20 data lama tersimpan, padahal belum ambil apa-apa di sesi ini.
  let sessionCount = 0;
  let finishStatus = null;

  reportProgress(sessionCount, target, 'jalan');

  let stagnantScrolls = 0;

  while (isRunning && !shouldStop && sessionCount < target) {
    const cards = getResultCards();
    const unprocessed = cards.filter((c) => !processedHrefs.has(c.href));

    if (unprocessed.length === 0) {
      await scrollFeedForMore();
      stagnantScrolls += 1;
      if (stagnantScrolls > 6) {
        finishStatus = 'habis'; // sudah nggak ada hasil baru lagi
        break;
      }
      continue;
    }
    stagnantScrolls = 0;

    const card = unprocessed[0];
    processedHrefs.add(card.href);

    const fallbackName = card.getAttribute('aria-label') || '';

    card.scrollIntoView({ block: 'center' });
    card.click();

    await waitForDetailPanel();
    await randomDelay(500, 900); // beri waktu render tambahan

    const lead = extractDetailFromPanel(fallbackName);
    const { isNew } = await saveLead(lead);
    if (isNew) sessionCount += 1;
    reportProgress(sessionCount, target, 'jalan');

    // PENTING: klik ke bisnis tadi membuat Google Maps benar-benar pindah
    // halaman ke /maps/place/..., bukan cuma buka panel di atas list — jadi
    // daftar hasil (feed) hilang dari DOM. Harus balik dulu (klik tombol
    // panah kembali beneran) sebelum bisa lanjut ke bisnis berikutnya.
    const backOk = await goBackToList();
    if (!backOk) {
      // Kalau gagal balik ke list (jarang terjadi), hentikan biar nggak nyasar.
      finishStatus = 'habis';
      break;
    }

    await randomDelay(1000, 1800); // jeda supaya nggak terlalu agresif
  }

  isRunning = false;
  // Cuma kirim SATU laporan akhir. Sebelumnya di sini selalu dikirim ulang status
  // 'selesai' walau sebelumnya udah sempat kirim 'habis', jadi pesannya ketimpa
  // dan user lihat "Selesai! Target tercapai" padahal sebenarnya nggak dapat apa-apa.
  if (!finishStatus) {
    finishStatus = shouldStop ? 'berhenti' : 'selesai';
  }
  reportProgress(sessionCount, target, finishStatus);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'START_SCRAPE') {
    if (!isRunning) {
      runScrape(msg.target || 20);
    }
    sendResponse({ ok: true });
  } else if (msg.type === 'STOP_SCRAPE') {
    shouldStop = true;
    sendResponse({ ok: true });
  } else if (msg.type === 'GET_STATUS') {
    sendResponse({ isRunning });
  } else if (msg.type === 'PING') {
    sendResponse({ ok: true });
  }
  return true;
});
