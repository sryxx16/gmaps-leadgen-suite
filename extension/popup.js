// popup.js
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

// Pastikan content script aktif di tab Maps (force-inject jika belum ada)
async function ensureContentScript(tabId) {
  try {
    const res = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    if (res && res.version) {
      return true;
    }
  } catch (e) {
    // Tab belum ada script
  }

  // Suntikkan script versi baru ke tab
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    await new Promise((r) => setTimeout(r, 250));
    return true;
  } catch (err) {
    return false;
  }
}

function setRunningUI(running) {
  startBtn.disabled = running;
  stopBtn.disabled = !running;
  targetInput.disabled = running;
}

function updateProgress(count, target, status, businessName = '', newCount = 0) {
  progressWrap.hidden = false;
  const pct = target > 0 ? Math.min(100, Math.round((count / target) * 100)) : 0;
  progressFill.style.width = pct + '%';
  progressLabel.textContent = `${count} / ${target}`;

  let statusText = '';
  if (status === 'jalan') {
    statusText = businessName ? `Proses: ${businessName}` : 'Sedang mengambil data...';
  } else if (status === 'selesai') {
    statusText = `Selesai! ${count} toko diproses (${newCount || count} data baru tersimpan).`;
  } else if (status === 'berhenti') {
    statusText = `Dihentikan manual pada ${count} data.`;
  } else if (status === 'habis') {
    statusText = `Semua hasil pencarian Maps sudah terambil (${count} data).`;
  } else if (status === 'no_feed') {
    statusText = 'Belum ada hasil pencarian. Ketik pencarian di Google Maps (misal "toko sepatu depok"), tekan Enter, lalu klik Mulai.';
  }

  if (statusText) statusEl.textContent = statusText;

  if (status === 'selesai' || status === 'berhenti' || status === 'habis' || status === 'no_feed') {
    setRunningUI(false);
  } else if (status === 'jalan') {
    setRunningUI(true);
  }
}

startBtn.addEventListener('click', async () => {
  const tab = await getActiveMapsTab();
  if (!tab) {
    statusEl.textContent = 'Buka tab Google Maps (google.com/maps), cari bisnis, lalu tekan Mulai.';
    return;
  }

  statusEl.textContent = 'Menghubungkan ke Google Maps...';
  const ready = await ensureContentScript(tab.id);
  if (!ready) {
    statusEl.textContent = 'Gagal memuat scraper. Refresh tab Maps kamu (F5), lalu tekan Mulai.';
    return;
  }

  const target = parseInt(targetInput.value, 10) || 20;

  chrome.tabs.sendMessage(tab.id, { type: 'START_SCRAPE', target }, (res) => {
    if (chrome.runtime.lastError) {
      statusEl.textContent = 'Error: ' + chrome.runtime.lastError.message + '. Silakan refresh tab Maps (F5).';
      setRunningUI(false);
      return;
    }
    setRunningUI(true);
    if (res && res.alreadyRunning) {
      updateProgress(res.count, res.target, 'jalan');
    } else {
      updateProgress(0, target, 'jalan', 'Memulai...');
    }
  });
});

stopBtn.addEventListener('click', async () => {
  const tab = await getActiveMapsTab();
  if (tab) chrome.tabs.sendMessage(tab.id, { type: 'STOP_SCRAPE' });
  statusEl.textContent = 'Menghentikan proses...';
});

openTableBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'OPEN_TABLE' });
});

// Listener progress real-time dari content script
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SCRAPE_PROGRESS') {
    updateProgress(msg.count, msg.target, msg.status, msg.businessName, msg.newCount);
  }
});

// Sinkronisasi otomatis dari storage
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.scrapeProgress) {
    const p = changes.scrapeProgress.newValue;
    if (p) updateProgress(p.count, p.target, p.status, p.businessName, p.newCount);
  }
});

// Inisialisasi tampilan saat popup dibuka
(async () => {
  const { leads = [], scrapeProgress } = await chrome.storage.local.get(['leads', 'scrapeProgress']);

  const tab = await getActiveMapsTab();
  if (tab) {
    chrome.tabs.sendMessage(tab.id, { type: 'GET_STATUS' }, (res) => {
      if (!chrome.runtime.lastError && res) {
        if (res.isRunning) {
          setRunningUI(true);
          updateProgress(res.count, res.target, res.status, res.currentBusiness, res.newCount);
          return;
        }
      }
      
      if (scrapeProgress && scrapeProgress.status === 'jalan') {
        setRunningUI(true);
        updateProgress(scrapeProgress.count, scrapeProgress.target, scrapeProgress.status, scrapeProgress.businessName, scrapeProgress.newCount);
      } else if (leads.length > 0) {
        statusEl.textContent = `Tersimpan ${leads.length} data bisnis. Tekan Mulai untuk menambah data baru.`;
      }
    });
  } else if (leads.length > 0) {
    statusEl.textContent = `Tersimpan ${leads.length} data bisnis. Buka Google Maps untuk mulai scraping.`;
  }
})();
