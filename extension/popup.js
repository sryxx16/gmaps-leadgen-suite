const targetInput = document.getElementById('target');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusEl = document.getElementById('status');
const progressWrap = document.getElementById('progressWrap');
const progressFill = document.getElementById('progressFill');
const progressLabel = document.getElementById('progressLabel');
const openTableBtn = document.getElementById('openTableBtn');

async function getActiveMapsTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url && tab.url.includes('google.com/maps')) return tab;
  return null;
}

// Content script cuma nyuntik otomatis kalau tab-nya dimuat SETELAH extension
// terpasang/di-reload. Kalau tab udah kebuka duluan (atau reload manual gagal
// ke-detect), PING bakal gagal (nggak ada yang dengerin) — di situ kita suntik
// manual pakai chrome.scripting, biar user nggak perlu refresh tab sendiri.
async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    return true;
  } catch (e) {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
      await new Promise((r) => setTimeout(r, 150)); // beri waktu script daftar listener
      return true;
    } catch (err) {
      return false;
    }
  }
}

function setRunningUI(running) {
  startBtn.disabled = running;
  stopBtn.disabled = !running;
  targetInput.disabled = running;
}

function updateProgress(count, target, status) {
  progressWrap.hidden = false;
  const pct = target > 0 ? Math.min(100, Math.round((count / target) * 100)) : 0;
  progressFill.style.width = pct + '%';
  progressLabel.textContent = `${count} / ${target}`;

  const statusText = {
    jalan: 'Lagi ambil data...',
    selesai: 'Selesai! Target tercapai.',
    berhenti: 'Dihentikan manual.',
    habis: 'Sudah nggak ada hasil baru dari Google Maps untuk diambil.',
    no_feed: 'Nggak ketemu daftar hasil pencarian. Pastikan lu ada di halaman LIST hasil pencarian (banyak bisnis kelihatan di sidebar), bukan halaman detail satu bisnis. Klik tombol panah kembali (←) di Maps kalau perlu, lalu coba lagi.',
  }[status] || '';

  if (statusText) statusEl.textContent = statusText;

  if (status === 'selesai' || status === 'berhenti' || status === 'habis' || status === 'no_feed') {
    setRunningUI(false);
  }
}

startBtn.addEventListener('click', async () => {
  const tab = await getActiveMapsTab();
  if (!tab) {
    statusEl.textContent = 'Buka tab Google Maps dulu (google.com/maps) dan lakukan pencarian, baru tekan Mulai.';
    return;
  }

  // Deteksi dini: kalau URL-nya /maps/place/... berarti lagi di halaman DETAIL
  // satu bisnis (biasanya gara-gara klik saran autocomplete pas nyari), bukan
  // di halaman daftar (/maps/search/...) yang isinya banyak bisnis.
  if (tab.url.includes('/maps/place/')) {
    statusEl.textContent = 'Lu lagi di halaman DETAIL satu bisnis, bukan daftar hasil pencarian. Klik panah kembali (←) di sidebar Maps sampai URL-nya berubah jadi .../maps/search/... dan sidebar nampilin banyak bisnis, baru tekan Mulai lagi.';
    return;
  }

  statusEl.textContent = 'Menyiapkan...';
  const ready = await ensureContentScript(tab.id);
  if (!ready) {
    statusEl.textContent = 'Gagal menghubungkan ke tab Maps. Coba refresh tab Maps manual (Ctrl+R), lalu tekan Mulai lagi.';
    return;
  }

  const target = parseInt(targetInput.value, 10) || 20;
  setRunningUI(true);
  statusEl.textContent = 'Memulai...';
  progressWrap.hidden = false;
  progressFill.style.width = '0%';
  progressLabel.textContent = `0 / ${target}`;

  chrome.tabs.sendMessage(tab.id, { type: 'START_SCRAPE', target }, () => {
    if (chrome.runtime.lastError) {
      statusEl.textContent = 'Gagal memulai scraping: ' + chrome.runtime.lastError.message + '. Coba refresh tab Maps.';
      setRunningUI(false);
    }
  });
});

stopBtn.addEventListener('click', async () => {
  const tab = await getActiveMapsTab();
  if (tab) chrome.tabs.sendMessage(tab.id, { type: 'STOP_SCRAPE' });
  statusEl.textContent = 'Menghentikan...';
});

openTableBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'OPEN_TABLE' });
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SCRAPE_PROGRESS') {
    updateProgress(msg.count, msg.target, msg.status);
  }
});

// Saat popup dibuka, cek status berjalan atau tidak, dan tampilkan jumlah data tersimpan.
(async () => {
  const { leads = [] } = await chrome.storage.local.get('leads');
  if (leads.length > 0) {
    statusEl.textContent = `Ada ${leads.length} data tersimpan. Tekan Mulai buat nambah, atau buka tabel buat lihat hasil.`;
  }

  const tab = await getActiveMapsTab();
  if (tab) {
    chrome.tabs.sendMessage(tab.id, { type: 'GET_STATUS' }, (res) => {
      if (chrome.runtime.lastError) return; // content script belum siap, biarkan
      if (res && res.isRunning) {
        setRunningUI(true);
        statusEl.textContent = 'Lagi ambil data...';
      }
    });
  }
})();
