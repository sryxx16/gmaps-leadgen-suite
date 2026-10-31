// content.js
// GMaps Lead Finder - Clean, Original & Reliable Scraper with Real Rating & Reviews

let isRunning = false;
let shouldStop = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(min, max) {
  return sleep(min + Math.random() * (max - min));
}

function getFeed() {
  return document.querySelector('div[role="feed"]');
}

function getResultCards() {
  const feed = getFeed();
  if (!feed) return [];
  const hfpxzc = Array.from(feed.querySelectorAll('a.hfpxzc[href*="/maps/place/"]'));
  return hfpxzc.length > 0 ? hfpxzc : Array.from(feed.querySelectorAll('a[href*="/maps/place/"]'));
}

async function scrollFeedForMore() {
  const feed = getFeed();
  if (!feed) return;
  feed.scrollTop = feed.scrollHeight;
  await randomDelay(1000, 1600);
}

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

async function waitForDetailPanel(timeoutMs = 5000) {
  const start = Date.now();
  let lastH1 = null;
  while (Date.now() - start < timeoutMs) {
    const h1 = document.querySelector('h1.DUwDvf, [role="main"] h1, h1');
    if (h1 && h1.textContent.trim().length > 0) {
      if (lastH1 === h1.textContent.trim()) {
        return true;
      }
      lastH1 = h1.textContent.trim();
    }
    await sleep(250);
  }
  return !!lastH1;
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

// Cek apakah URL benar website bisnis mandiri (bukan Google, sosmed, atau marketplace)
function isValidWebsiteUrl(rawUrl) {
  if (!rawUrl) return false;
  const lower = rawUrl.toLowerCase().trim();
  if (lower.length < 4 || !lower.includes('.')) return false;

  // Jika tergolong sosmed atau online shop / marketplace, BUKAN website mandiri
  if (isSocialMediaUrl(lower) || isOnlineShopUrl(lower)) return false;

  const banned = [
    'google.', 'business.google.com', 'support.google.com', 'maps.google.com',
    'wa.me', 'whatsapp.com', 'api.whatsapp.com', 'waze.com'
  ];
  return !banned.some((b) => lower.includes(b));
}

function extractDetailFromPanel(fallbackName) {
  const nameEl = document.querySelector('h1.DUwDvf') || document.querySelector('h1');
  let name = (nameEl && nameEl.textContent.trim()) || fallbackName || '(tanpa nama)';
  name = name.replace(/[·\•]\s*(?:Link yang dikunjungi|Visited link|Ditampilkan)\b.*/i, '').trim();

  // Alamat
  let address = '';
  const addrBtn = document.querySelector('[data-item-id="address"]');
  if (addrBtn) {
    const aria = addrBtn.getAttribute('aria-label') || '';
    if (aria) address = stripPrefix(aria, ['Alamat:', 'Address:', 'Salin alamat']);
    if (!address) {
      const inner = addrBtn.querySelector('.Io6YTe, div');
      address = (inner ? inner.textContent : addrBtn.textContent).trim();
    }
  }
  if (!address) {
    const addrMatch = findByAriaPrefixes(['Address:', 'Alamat:']);
    if (addrMatch) address = stripPrefix(addrMatch.label, ['Address:', 'Alamat:']);
  }

  // Telepon
  let phone = '';
  const phoneBtn = document.querySelector('[data-item-id^="phone:tel:"]');
  if (phoneBtn) {
    const dataId = phoneBtn.getAttribute('data-item-id') || '';
    phone = dataId.replace('phone:tel:', '').trim();
    if (!phone) {
      const aria = phoneBtn.getAttribute('aria-label') || '';
      phone = stripPrefix(aria, ['Telepon:', 'Phone:', 'Salin nomor telepon']);
    }
  }
  if (!phone) {
    const phoneMatch = findByAriaPrefixes(['Phone:', 'Telepon:']);
    if (phoneMatch) phone = stripPrefix(phoneMatch.label, ['Phone:', 'Telepon:']);
  }
  if (phone) {
    phone = phone.replace(/[^\d+\-() ]/g, '').trim();
  }

  // Cari link di panel utama: website, sosmed, online shop, wa.me
  let website = '';
  let socialMedia = '';
  let onlineShop = '';
  let whatsapp = '';

  // 1. Periksa authority element (slot website resmi di Maps)
  const authorityEl = document.querySelector('[data-item-id="authority"]');
  let rawAuthority = '';
  if (authorityEl) {
    rawAuthority = (authorityEl.getAttribute('href') || authorityEl.textContent || '').trim();
  }
  if (!rawAuthority) {
    const webMatch = findByAriaPrefixes(['Website:', 'Situs Web:']);
    if (webMatch) {
      rawAuthority = stripPrefix(webMatch.label, ['Website:', 'Situs Web:']).trim();
    }
  }

  if (rawAuthority) {
    if (rawAuthority.toLowerCase().includes('wa.me') || rawAuthority.toLowerCase().includes('whatsapp.com')) {
      const waMatch = rawAuthority.match(/(?:wa\.me\/|phone=)(?:62|0)?(\d+)/);
      if (waMatch) whatsapp = '0' + waMatch[1];
    } else if (isSocialMediaUrl(rawAuthority)) {
      socialMedia = rawAuthority;
    } else if (isOnlineShopUrl(rawAuthority)) {
      onlineShop = rawAuthority;
    } else if (isValidWebsiteUrl(rawAuthority)) {
      website = rawAuthority;
    }
  }

  // 2. Scan semua link anchor di dalam panel detail untuk menangkap Sosmed & Marketplace tambahan
  const allLinks = Array.from(document.querySelectorAll('[role="main"] a[href], .m6QErb a[href]'));
  for (const a of allLinks) {
    const href = (a.getAttribute('href') || '').trim();
    if (!href) continue;

    if (!socialMedia && isSocialMediaUrl(href)) {
      socialMedia = href;
    }
    if (!onlineShop && isOnlineShopUrl(href)) {
      onlineShop = href;
    }
    if (!whatsapp && (href.includes('wa.me') || href.includes('whatsapp.com'))) {
      const waMatch = href.match(/(?:wa\.me\/|phone=)(?:62|0)?(\d+)/);
      if (waMatch) whatsapp = '0' + waMatch[1];
    }
    if (!website && isValidWebsiteUrl(href)) {
      website = href;
    }
  }

  // 3. Fallback WhatsApp dari nomor HP jika nomor lokal (08... atau 628...)
  if (!whatsapp && phone) {
    const digits = phone.replace(/[^\d]/g, '');
    if (digits.startsWith('08') || digits.startsWith('628') || digits.startsWith('8')) {
      whatsapp = phone;
    }
  }

  // Kategori
  let category = '';
  const catBtn = document.querySelector('button[jsaction="pane.rating.category"], button.DkEaL, button[jsaction*="category"]');
  if (catBtn) category = catBtn.textContent.trim();
  if (!category) {
    const sub = document.querySelector('.DkEaL, .fontBodyMedium button');
    if (sub) category = sub.textContent.trim();
  }

  // ------------------------------------------------------------------
  // RATING & ULASAN ASLI DARI GOOGLE MAPS
  // ------------------------------------------------------------------
  let rating = '';
  let reviewCount = '';

  const f7 = document.querySelector('div.F7nice');
  if (f7) {
    // 1. Rating: angka rating desimal (misal: 4.7, 5.0, 3.5)
    const rMatch = f7.textContent.match(/([1-5][\.,]\d)/);
    if (rMatch) {
      rating = rMatch[1].replace(',', '.');
    }

    // 2. Jumlah Ulasan: angka di dalam tanda kurung (misal: "(656)", "(2.000)", "(70)", "(1)")
    const revMatch = f7.textContent.match(/\(([\d\.,]+)\)/);
    if (revMatch) {
      reviewCount = revMatch[1].replace(/[^\d]/g, '');
    }
  }

  return {
    name,
    rating: rating || '',
    reviewCount: reviewCount || '',
    category: category || '',
    address: address || '',
    phone: phone || '',
    whatsapp: whatsapp || '',
    website: website || '',
    socialMedia: socialMedia || '',
    onlineShop: onlineShop || '',
    hasWebsite: !!website,
    mapsUrl: window.location.href,
    scrapedAt: new Date().toISOString(),
  };
}

async function waitForFeedBack(timeoutMs = 7000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (getFeed()) return true;
    await sleep(200);
  }
  return false;
}

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
      history.back();
    }
    const ok = await waitForFeedBack(2500);
    if (ok) return true;
    await sleep(300);
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
    leads[dupIndex] = { ...leads[dupIndex], ...lead };
    isNew = false;
  } else {
    leads.push(lead);
  }
  await chrome.storage.local.set({ 
    leads,
    leads_backup: leads // Auto-backup permanen
  });
  return { total: leads.length, isNew };
}

function reportProgress(count, target, status, businessName = '') {
  const progressData = {
    count,
    target,
    status,
    businessName,
    updatedAt: Date.now()
  };

  chrome.runtime.sendMessage({
    type: 'SCRAPE_PROGRESS',
    ...progressData
  }).catch(() => {});

  // Kunci progres di storage agar saat tab atau popup tertutup, progres tetap ada
  chrome.storage.local.set({ scrapeProgress: progressData }).catch(() => {});
}

async function runScrape(target) {
  if (isRunning) return;
  isRunning = true;
  shouldStop = false;

  if (!getFeed()) {
    reportProgress(0, target, 'no_feed');
    isRunning = false;
    return;
  }

  const processedHrefs = new Set();
  let sessionCount = 0;
  let finishStatus = null;
  let stagnantScrolls = 0;

  reportProgress(sessionCount, target, 'jalan', 'Memulai...');

  while (isRunning && !shouldStop && sessionCount < target) {
    const cards = getResultCards();
    const unprocessed = cards.filter((c) => !processedHrefs.has(c.href));

    if (unprocessed.length === 0) {
      await scrollFeedForMore();
      stagnantScrolls += 1;
      if (stagnantScrolls > 6) {
        finishStatus = 'habis';
        break;
      }
      continue;
    }
    stagnantScrolls = 0;

    const card = unprocessed[0];
    processedHrefs.add(card.href);

    const fallbackName = card.getAttribute('aria-label') || '';
    reportProgress(sessionCount, target, 'jalan', fallbackName || 'Membuka toko...');

    card.scrollIntoView({ block: 'center' });
    card.click();

    await waitForDetailPanel(5000);
    await randomDelay(400, 800);

    const lead = extractDetailFromPanel(fallbackName);
    const { isNew } = await saveLead(lead);
    if (isNew) sessionCount += 1;
    reportProgress(sessionCount, target, 'jalan', `${lead.name} (${sessionCount}/${target})`);

    const backOk = await goBackToList();
    if (!backOk) {
      finishStatus = 'habis';
      break;
    }

    await randomDelay(600, 1200);
  }

  isRunning = false;
  if (!finishStatus) {
    finishStatus = shouldStop ? 'berhenti' : 'selesai';
  }
  reportProgress(sessionCount, target, finishStatus, `Selesai (${sessionCount} data tersimpan)`);
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
