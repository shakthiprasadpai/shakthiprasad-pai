import JSZip from 'jszip';

// Manifest content
export const EXTENSION_MANIFEST = `{
  "manifest_version": 3,
  "name": "Minervini SEPA Second Brain & Web Clipper",
  "version": "1.0.0",
  "description": "1-Click clip stock charts, tweets, news, and setups from TradingView, Finviz, and Yahoo Finance directly into your Minervini SEPA Second Brain.",
  "permissions": [
    "activeTab",
    "contextMenus",
    "storage",
    "clipboardRead"
  ],
  "action": {
    "default_popup": "popup.html",
    "default_title": "Clip to Minervini Second Brain",
    "default_icon": {
      "16": "icon16.png",
      "48": "icon48.png",
      "128": "icon128.png"
    }
  },
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"]
    }
  ],
  "icons": {
    "16": "icon16.png",
    "48": "icon48.png",
    "128": "icon128.png"
  }
}`;

export const EXTENSION_POPUP_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Minervini SEPA Second Brain Clipper</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { width: 360px; background: #0f1218; color: #f1f5f9; padding: 14px; font-size: 12px; }
    .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #1e2430; padding-bottom: 10px; margin-bottom: 12px; }
    .brand { display: flex; align-items: center; gap: 8px; }
    .brand-icon { width: 26px; height: 26px; background: linear-gradient(135deg, #f59e0b, #d97706); border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: 900; color: #000; font-size: 14px; }
    .brand-title { font-weight: 800; font-size: 13px; color: #fff; }
    .brand-sub { font-size: 9px; color: #f59e0b; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
    .badge-status { font-size: 9px; padding: 2px 6px; border-radius: 4px; background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); font-weight: 700; }
    .field-group { margin-bottom: 10px; }
    label { display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; color: #94a3b8; margin-bottom: 4px; }
    input[type="text"], select, textarea { width: 100%; background: #181d27; border: 1px solid #283244; color: #f8fafc; padding: 7px 9px; border-radius: 5px; font-size: 12px; outline: none; }
    input[type="text"]:focus, select:focus, textarea:focus { border-color: #f59e0b; }
    .row { display: flex; gap: 8px; }
    .para-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; margin-bottom: 10px; }
    .para-btn { background: #181d27; border: 1px solid #283244; color: #94a3b8; padding: 5px 2px; font-size: 9px; font-weight: 700; text-align: center; border-radius: 4px; cursor: pointer; text-transform: uppercase; }
    .para-btn:hover { border-color: #f59e0b; color: #fff; }
    .para-btn.active { background: #f59e0b; color: #000; border-color: #f59e0b; font-weight: 800; }
    textarea { resize: vertical; min-height: 65px; font-family: inherit; }
    .action-btn { width: 100%; background: #f59e0b; color: #000; border: none; padding: 9px; border-radius: 5px; font-size: 12px; font-weight: 800; cursor: pointer; text-transform: uppercase; display: flex; align-items: center; justify-content: center; gap: 6px; }
    .action-btn:hover { background: #fbbf24; }
    .secondary-actions { display: flex; gap: 6px; margin-top: 6px; }
    .sub-btn { flex: 1; background: #181d27; border: 1px solid #283244; color: #cbd5e1; padding: 6px; border-radius: 4px; font-size: 10px; font-weight: 700; cursor: pointer; text-align: center; }
    .sub-btn:hover { background: #232a39; color: #fff; }
    .alert-box { margin-top: 8px; padding: 6px 8px; border-radius: 4px; font-size: 11px; display: none; }
    .alert-success { background: rgba(16, 185, 129, 0.2); border: 1px solid #10b981; color: #34d399; }
    .alert-error { background: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444; color: #f87171; }
    .detected-source { font-size: 10px; color: #94a3b8; display: flex; align-items: center; justify-content: space-between; margin-top: 4px; }
    .detected-source span { color: #f59e0b; font-weight: bold; }
    .footer { margin-top: 10px; padding-top: 8px; border-top: 1px solid #1e2430; display: flex; justify-content: space-between; align-items: center; font-size: 9px; color: #64748b; }
    .footer a { color: #f59e0b; text-decoration: none; font-weight: bold; }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <div class="brand-icon">🧠</div>
      <div>
        <div class="brand-title">SECOND BRAIN</div>
        <div class="brand-sub">Minervini SEPA Web Clipper</div>
      </div>
    </div>
    <div id="connectionStatus" class="badge-status">READY</div>
  </div>

  <div class="detected-source">
    <div>Source: <span id="sourceLabel">Web Article</span></div>
    <div id="urlHostLabel" style="font-size: 9px; color: #64748b;"></div>
  </div>

  <div class="row" style="margin-top: 8px;">
    <div class="field-group" style="flex: 1;">
      <label for="tickerInput">Ticker Symbol</label>
      <input type="text" id="tickerInput" placeholder="e.g. NVDA, TRENT" style="text-transform: uppercase; font-weight: bold; color: #f59e0b;">
    </div>
    <div class="field-group" style="flex: 1.5;">
      <label for="setupSelect">Setup / Pattern</label>
      <select id="setupSelect">
        <option value="VCP Breakout">VCP Breakout</option>
        <option value="Pocket Pivot">Pocket Pivot</option>
        <option value="High Tight Flag">High Tight Flag</option>
        <option value="Cup with Handle">Cup with Handle</option>
        <option value="21 EMA Bounce">21 EMA Bounce</option>
        <option value="Stage 2 Confirmation">Stage 2 Confirmation</option>
        <option value="Earnings Catalyst">Earnings Catalyst</option>
        <option value="General Trade Idea">General Trade Idea</option>
      </select>
    </div>
  </div>

  <div class="field-group">
    <label for="titleInput">Note Title</label>
    <input type="text" id="titleInput" placeholder="Thesis / Headline / Key Takeaway">
  </div>

  <label>P.A.R.A Category</label>
  <div class="para-grid">
    <div class="para-btn active" data-para="PROJECTS">🎯 Projects</div>
    <div class="para-btn" data-para="AREAS">🛡️ Areas</div>
    <div class="para-btn" data-para="RESOURCES">📚 Resources</div>
    <div class="para-btn" data-para="ARCHIVES">📦 Archives</div>
  </div>

  <div class="field-group">
    <label for="contentInput">Clipped Content / Selected Text</label>
    <textarea id="contentInput" placeholder="Paste chart notes, selected tweet, or article insights here..."></textarea>
  </div>

  <button id="clipBtn" class="action-btn">
    <span>🧠 Clip to Minervini Second Brain</span>
  </button>

  <div class="secondary-actions">
    <button id="copyMdBtn" class="sub-btn">📋 Copy Obsidian MD</button>
    <button id="openAppBtn" class="sub-btn">🚀 Open Screener</button>
  </div>

  <div id="alertBox" class="alert-box"></div>

  <div class="footer">
    <span>Minervini SEPA Growth Screener</span>
    <a href="#" id="openOptionsLink">Configure Host</a>
  </div>

  <script src="popup.js"></script>
</body>
</html>`;

export const EXTENSION_POPUP_JS = `document.addEventListener('DOMContentLoaded', async () => {
  let selectedCategory = 'PROJECTS';
  let currentUrl = '';
  let currentTitle = '';
  let serverHost = window.location.origin.includes('chrome-extension') ? 'http://localhost:3000' : window.location.origin;

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['sepaServerHost'], (res) => {
      if (res && res.sepaServerHost) serverHost = res.sepaServerHost;
    });
  }

  const paraBtns = document.querySelectorAll('.para-btn');
  paraBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      paraBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedCategory = btn.getAttribute('data-para') || 'PROJECTS';
    });
  });

  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (!tabs || tabs.length === 0) return;
      const activeTab = tabs[0];
      currentUrl = activeTab.url || '';
      currentTitle = activeTab.title || '';

      try {
        const u = new URL(currentUrl);
        document.getElementById('urlHostLabel').textContent = u.hostname;
      } catch (e) {
        document.getElementById('urlHostLabel').textContent = '';
      }

      document.getElementById('titleInput').value = currentTitle;

      const sourceLabel = document.getElementById('sourceLabel');
      let detectedTicker = '';

      if (currentUrl.includes('tradingview.com')) {
        sourceLabel.textContent = 'TradingView Chart';
        const match = currentUrl.match(/symbol=([A-Za-z0-9_:]+)/) || currentUrl.match(/\\/symbols\\/([A-Za-z0-9_]+)/);
        if (match && match[1]) detectedTicker = match[1].split(':').pop() || '';
      } else if (currentUrl.includes('finviz.com')) {
        sourceLabel.textContent = 'Finviz Screener';
        const match = currentUrl.match(/t=([A-Za-z0-9]+)/);
        if (match && match[1]) detectedTicker = match[1];
      } else if (currentUrl.includes('finance.yahoo.com')) {
        sourceLabel.textContent = 'Yahoo Finance';
        const match = currentUrl.match(/\\/quote\\/([A-Za-z0-9.-]+)/);
        if (match && match[1]) detectedTicker = match[1].split('.')[0];
      } else if (currentUrl.includes('x.com') || currentUrl.includes('twitter.com')) {
        sourceLabel.textContent = 'X / Twitter Post';
        const match = currentTitle.match(/\\$([A-Za-z]{2,5})/);
        if (match && match[1]) detectedTicker = match[1];
      } else {
        sourceLabel.textContent = 'Web Research';
        const match = currentTitle.match(/\\$([A-Za-z]{2,5})/);
        if (match && match[1]) detectedTicker = match[1];
      }

      if (detectedTicker) {
        document.getElementById('tickerInput').value = detectedTicker.toUpperCase();
      }

      try {
        if (chrome.scripting && activeTab.id) {
          const results = await chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            func: () => window.getSelection().toString()
          });
          if (results && results[0] && results[0].result) {
            const selectedText = results[0].result.trim();
            if (selectedText) {
              document.getElementById('contentInput').value = selectedText;
            }
          }
        }
      } catch (err) {
        console.log('Selection extraction not permitted on this page', err);
      }
    });
  }

  document.getElementById('clipBtn').addEventListener('click', async () => {
    const ticker = document.getElementById('tickerInput').value.trim().toUpperCase();
    const setup = document.getElementById('setupSelect').value;
    const title = document.getElementById('titleInput').value.trim() || \`\${ticker || 'Idea'} - \${setup}\`;
    const content = document.getElementById('contentInput').value.trim();
    const source = document.getElementById('sourceLabel').textContent || 'Web';

    if (!content && !title) {
      showAlert('Please enter a title or note content to clip.', 'error');
      return;
    }

    const clipPayload = {
      id: 'clip-' + Date.now(),
      title,
      url: currentUrl,
      ticker: ticker || undefined,
      source,
      content,
      category: selectedCategory,
      tags: [
        \`#\${setup.toLowerCase().replace(/\\s+/g, '-')}\`,
        ticker ? \`#\${ticker.toLowerCase()}\` : '#idea',
        \`#\${source.toLowerCase().replace(/[^a-z0-9]/g, '')}\`,
        '#chrome-extension'
      ],
      timestamp: new Date().toISOString(),
      status: 'UNPROCESSED'
    };

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['sepaClips'], (res) => {
        const list = res.sepaClips || [];
        list.unshift(clipPayload);
        chrome.storage.local.set({ sepaClips: list.slice(0, 100) });
      });
    }

    showAlert('Sending clip to Minervini Second Brain...', 'success');

    try {
      const response = await fetch(\`\${serverHost}/api/second-brain/clip\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clipPayload)
      });

      if (response.ok) {
        showAlert('✓ Successfully clipped to Minervini Second Brain!', 'success');
        setTimeout(() => window.close(), 1500);
      } else {
        showAlert(\`Saved locally in Extension (Server returned \${response.status})\`, 'success');
      }
    } catch (err) {
      showAlert('✓ Saved locally in Extension! (Start screener dev server to sync live)', 'success');
    }
  });

  document.getElementById('copyMdBtn').addEventListener('click', () => {
    const ticker = document.getElementById('tickerInput').value.trim().toUpperCase();
    const setup = document.getElementById('setupSelect').value;
    const title = document.getElementById('titleInput').value.trim() || \`\${ticker || 'Idea'} - \${setup}\`;
    const content = document.getElementById('contentInput').value.trim();
    const source = document.getElementById('sourceLabel').textContent || 'Web';

    const md = \`---
type: second-brain-clip
title: "\${title}"
category: "\${selectedCategory}"
ticker: "\${ticker}"
setup: "\${setup}"
source: "\${source}"
url: "\${currentUrl}"
date: "\${new Date().toISOString()}"
tags:
  - second-brain
  - web-clip
  - \${setup.toLowerCase().replace(/\\s+/g, '-')}
  \${ticker ? \`- \${ticker.toLowerCase()}\` : ''}
---

# 🧠 \${title}

> [!info] Clipped from \${source}
> **URL**: [Link](\${currentUrl})
> **Ticker**: [[\${ticker || 'Watchlist'}]] • **Setup**: [[\${setup}]]

## Notes & Clipped Insights
\${content || 'No text snippet attached.'}

---
*Clipped with Minervini SEPA Second Brain Chrome Extension*\`;

    navigator.clipboard.writeText(md).then(() => {
      showAlert('✓ Copied Obsidian Markdown note to clipboard!', 'success');
    });
  });

  document.getElementById('openAppBtn').addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: serverHost });
    } else {
      window.open(serverHost, '_blank');
    }
  });

  document.getElementById('openOptionsLink').addEventListener('click', (e) => {
    e.preventDefault();
    const newHost = prompt('Enter Minervini Screener Host URL:', serverHost);
    if (newHost && newHost.trim()) {
      serverHost = newHost.trim().replace(/\\/$/, '');
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ sepaServerHost: serverHost });
      }
      showAlert(\`Host set to: \${serverHost}\`, 'success');
    }
  });

  function showAlert(msg, type) {
    const box = document.getElementById('alertBox');
    box.textContent = msg;
    box.className = \`alert-box alert-\${type}\`;
    box.style.display = 'block';
  }
});`;

export const EXTENSION_BACKGROUND_JS = `chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'clip-to-sepa-second-brain',
    title: '🧠 Clip to Minervini Second Brain',
    contexts: ['selection', 'page', 'link']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'clip-to-sepa-second-brain' && tab) {
    const selectedText = info.selectionText || '';
    const pageUrl = info.pageUrl || tab.url || '';
    const pageTitle = tab.title || 'Web Research Note';

    let ticker = '';
    const match = pageTitle.match(/\\$([A-Za-z]{2,5})/) || pageUrl.match(/symbol=([A-Za-z0-9_:]+)/);
    if (match && match[1]) {
      ticker = match[1].split(':').pop() || '';
    }

    const newClip = {
      id: 'clip-' + Date.now(),
      title: \`\${ticker ? '$' + ticker.toUpperCase() + ' - ' : ''}\${pageTitle.slice(0, 60)}\`,
      url: pageUrl,
      ticker: ticker ? ticker.toUpperCase() : undefined,
      source: pageUrl.includes('tradingview.com') ? 'TradingView' : pageUrl.includes('x.com') ? 'Twitter / X' : 'Web Browser',
      content: selectedText || \`Bookmarked page: \${pageTitle}\`,
      category: 'PROJECTS',
      tags: ['#web-clip', ticker ? \`#\${ticker.toLowerCase()}\` : '#research', '#context-menu'],
      timestamp: new Date().toISOString(),
      status: 'UNPROCESSED'
    };

    chrome.storage.local.get(['sepaClips', 'sepaServerHost'], (res) => {
      const list = res.sepaClips || [];
      list.unshift(newClip);
      chrome.storage.local.set({ sepaClips: list.slice(0, 100) });

      const host = res.sepaServerHost || 'http://localhost:3000';
      fetch(\`\${host}/api/second-brain/clip\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newClip)
      }).catch((e) => console.log('Silent background push completed'));
    });
  }
});`;

export const EXTENSION_CONTENT_JS = `(() => {
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'GET_PAGE_DATA') {
        const selection = window.getSelection() ? window.getSelection().toString().trim() : '';
        const title = document.title || '';
        const url = window.location.href;

        let detectedTicker = '';
        const cashtagMatch = (document.body.innerText || '').match(/\\$([A-Za-z]{2,5})/);
        if (cashtagMatch && cashtagMatch[1]) {
          detectedTicker = cashtagMatch[1].toUpperCase();
        }

        sendResponse({ title, url, selection, detectedTicker });
      }
      return true;
    });
  }
})();`;

export const EXTENSION_README_MD = `# Minervini SEPA Second Brain & Web Clipper Chrome Extension

Clip stock charts, tweets, news, and setups from TradingView, Finviz, and Yahoo Finance directly into your Minervini SEPA Second Brain.

## 🚀 How to Install in 3 Easy Steps (Chrome / Brave / Edge)

1. **Extract this ZIP**:
   Extract all contents of this ZIP folder to a directory on your computer (e.g., \`Desktop/minervini-chrome-extension\`).

2. **Open Extensions Page**:
   - In Google Chrome or Brave, navigate to: \`chrome://extensions\`
   - In Microsoft Edge, navigate to: \`edge://extensions\`
   - Toggle **"Developer mode"** in the top-right corner to **ON**.

3. **Load the Extension**:
   - Click the **"Load unpacked"** button in the top-left corner.
   - Select the extracted folder containing \`manifest.json\`.
   - The **Minervini SEPA Second Brain** icon (🧠) will now appear in your browser toolbar!

---

## 🎯 Features
- **Auto Ticker & Source Detection**: Automatically recognizes symbols on TradingView, Finviz, Yahoo Finance, and $TICKER tags on X / Twitter.
- **P.A.R.A Framework**: Categorize clips into Projects, Areas, Resources, or Archives.
- **One-Click Push**: Posts directly to your running Minervini SEPA Screener API (\`/api/second-brain/clip\`).
- **Obsidian Compatible**: Instant "Copy Obsidian Markdown" with YAML frontmatter, tags, and wikilinks.
`;

export const EXTENSION_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#020617" />
    </linearGradient>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fbbf24" />
      <stop offset="100%" stop-color="#d97706" />
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="28" fill="url(#bg)" stroke="#f59e0b" stroke-width="4"/>
  <path d="M40 76c-6-6-8-16-3-24 5-8 15-10 22-5 3-7 11-11 19-9 8 2 13 9 13 17 6 2 11 8 11 15 0 8-6 15-14 16h-42c-3 0-5-2-6-5z" fill="none" stroke="url(#gold)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="64" cy="58" r="4" fill="#fbbf24" />
  <circle cx="48" cy="66" r="3.5" fill="#f59e0b" />
  <circle cx="80" cy="66" r="3.5" fill="#f59e0b" />
  <path d="M48 66 L64 58 L80 66" stroke="#fbbf24" stroke-width="2.5" stroke-dasharray="3,3" />
  <path d="M78 40 L96 22 M86 22 L96 22 L96 32" stroke="#10b981" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
  <text x="64" y="106" fill="#f8fafc" font-size="14" font-weight="900" font-family="sans-serif" text-anchor="middle" letter-spacing="1">SEPA BRAIN</text>
</svg>`;

// Minimal valid PNG 1x1 base64 string
const MINIMAL_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

// Build and trigger download of Chrome Extension ZIP package
export const downloadChromeExtensionZip = async (): Promise<void> => {
  const zip = new JSZip();

  // Root extension folder
  const folder = zip.folder('minervini-sepa-second-brain-extension') || zip;

  folder.file('manifest.json', EXTENSION_MANIFEST);
  folder.file('popup.html', EXTENSION_POPUP_HTML);
  folder.file('popup.js', EXTENSION_POPUP_JS);
  folder.file('background.js', EXTENSION_BACKGROUND_JS);
  folder.file('content.js', EXTENSION_CONTENT_JS);
  folder.file('README.md', EXTENSION_README_MD);
  folder.file('icon.svg', EXTENSION_ICON_SVG);

  // Add icons (base64 binary)
  folder.file('icon16.png', MINIMAL_PNG_BASE64, { base64: true });
  folder.file('icon48.png', MINIMAL_PNG_BASE64, { base64: true });
  folder.file('icon128.png', MINIMAL_PNG_BASE64, { base64: true });

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'minervini-sepa-second-brain-chrome-extension.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
