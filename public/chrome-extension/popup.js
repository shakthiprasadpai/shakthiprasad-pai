// Minervini SEPA Second Brain - Chrome Extension Popup Script
document.addEventListener('DOMContentLoaded', async () => {
  let selectedCategory = 'PROJECTS';
  let currentUrl = '';
  let currentTitle = '';
  let serverHost = 'http://localhost:3000';

  // Load configured host from storage if available
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['sepaServerHost'], (res) => {
      if (res && res.sepaServerHost) serverHost = res.sepaServerHost;
    });
  }

  // Setup PARA button listeners
  const paraBtns = document.querySelectorAll('.para-btn');
  paraBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      paraBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedCategory = btn.getAttribute('data-para') || 'PROJECTS';
    });
  });

  // Query active tab to extract URL, Title, and Selected text
  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (!tabs || tabs.length === 0) return;
      const activeTab = tabs[0];
      currentUrl = activeTab.url || '';
      currentTitle = activeTab.title || '';

      // Set host label
      try {
        const u = new URL(currentUrl);
        document.getElementById('urlHostLabel').textContent = u.hostname;
      } catch (e) {
        document.getElementById('urlHostLabel').textContent = '';
      }

      // Title default
      document.getElementById('titleInput').value = currentTitle;

      // Detect Source
      const sourceLabel = document.getElementById('sourceLabel');
      let detectedTicker = '';

      if (currentUrl.includes('tradingview.com')) {
        sourceLabel.textContent = 'TradingView Chart';
        // Extract symbol from TradingView URL: /chart/?symbol=... or /symbols/XYZ/
        const match = currentUrl.match(/symbol=([A-Za-z0-9_:]+)/) || currentUrl.match(/\/symbols\/([A-Za-z0-9_]+)/);
        if (match && match[1]) {
          detectedTicker = match[1].split(':').pop() || '';
        }
      } else if (currentUrl.includes('finviz.com')) {
        sourceLabel.textContent = 'Finviz Screener';
        const match = currentUrl.match(/t=([A-Za-z0-9]+)/);
        if (match && match[1]) detectedTicker = match[1];
      } else if (currentUrl.includes('finance.yahoo.com')) {
        sourceLabel.textContent = 'Yahoo Finance';
        const match = currentUrl.match(/\/quote\/([A-Za-z0-9.-]+)/);
        if (match && match[1]) detectedTicker = match[1].split('.')[0];
      } else if (currentUrl.includes('x.com') || currentUrl.includes('twitter.com')) {
        sourceLabel.textContent = 'X / Twitter Post';
        // Check for $TICKER in title
        const match = currentTitle.match(/\$([A-Za-z]{2,5})/);
        if (match && match[1]) detectedTicker = match[1];
      } else if (currentUrl.includes('youtube.com')) {
        sourceLabel.textContent = 'YouTube Analysis';
      } else {
        sourceLabel.textContent = 'Web Research';
        // General cashtag scan in title
        const match = currentTitle.match(/\$([A-Za-z]{2,5})/);
        if (match && match[1]) detectedTicker = match[1];
      }

      if (detectedTicker) {
        document.getElementById('tickerInput').value = detectedTicker.toUpperCase();
      }

      // Extract highlighted text from page if scripting available
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

  // Clip Button Action
  document.getElementById('clipBtn').addEventListener('click', async () => {
    const ticker = document.getElementById('tickerInput').value.trim().toUpperCase();
    const setup = document.getElementById('setupSelect').value;
    const title = document.getElementById('titleInput').value.trim() || `${ticker || 'Idea'} - ${setup}`;
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
        `#${setup.toLowerCase().replace(/\s+/g, '-')}`,
        ticker ? `#${ticker.toLowerCase()}` : '#idea',
        `#${source.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
        '#chrome-extension'
      ],
      timestamp: new Date().toISOString(),
      status: 'UNPROCESSED'
    };

    // 1. Save in local chrome storage
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['sepaClips'], (res) => {
        const list = res.sepaClips || [];
        list.unshift(clipPayload);
        chrome.storage.local.set({ sepaClips: list.slice(0, 100) });
      });
    }

    // 2. Post to Screener Second Brain Endpoint
    showAlert('Sending clip to Minervini Second Brain...', 'success');

    try {
      const response = await fetch(`${serverHost}/api/second-brain/clip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clipPayload)
      });

      if (response.ok) {
        showAlert('✓ Successfully clipped to Minervini Second Brain!', 'success');
        setTimeout(() => window.close(), 1500);
      } else {
        showAlert(`Saved locally in Extension (Server returned ${response.status})`, 'success');
      }
    } catch (err) {
      showAlert('✓ Saved locally in Extension! (Start screener dev server to sync live)', 'success');
    }
  });

  // Copy Obsidian Markdown Action
  document.getElementById('copyMdBtn').addEventListener('click', () => {
    const ticker = document.getElementById('tickerInput').value.trim().toUpperCase();
    const setup = document.getElementById('setupSelect').value;
    const title = document.getElementById('titleInput').value.trim() || `${ticker || 'Idea'} - ${setup}`;
    const content = document.getElementById('contentInput').value.trim();
    const source = document.getElementById('sourceLabel').textContent || 'Web';

    const md = `---
type: second-brain-clip
title: "${title}"
category: "${selectedCategory}"
ticker: "${ticker}"
setup: "${setup}"
source: "${source}"
url: "${currentUrl}"
date: "${new Date().toISOString()}"
tags:
  - second-brain
  - web-clip
  - ${setup.toLowerCase().replace(/\s+/g, '-')}
  ${ticker ? `- ${ticker.toLowerCase()}` : ''}
---

# 🧠 ${title}

> [!info] Clipped from ${source}
> **URL**: [Link](${currentUrl})
> **Ticker**: [[${ticker || 'Watchlist'}]] • **Setup**: [[${setup}]]

## Notes & Clipped Insights
${content || 'No text snippet attached.'}

---
*Clipped with Minervini SEPA Second Brain Chrome Extension*`;

    navigator.clipboard.writeText(md).then(() => {
      showAlert('✓ Copied Obsidian Markdown note to clipboard!', 'success');
    });
  });

  // Open Screener App Button
  document.getElementById('openAppBtn').addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: serverHost });
    } else {
      window.open(serverHost, '_blank');
    }
  });

  // Configure Host Link
  document.getElementById('openOptionsLink').addEventListener('click', (e) => {
    e.preventDefault();
    const newHost = prompt('Enter Minervini Screener Host URL:', serverHost);
    if (newHost && newHost.trim()) {
      serverHost = newHost.trim().replace(/\/$/, '');
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ sepaServerHost: serverHost });
      }
      showAlert(`Host set to: ${serverHost}`, 'success');
    }
  });

  function showAlert(msg, type) {
    const box = document.getElementById('alertBox');
    box.textContent = msg;
    box.className = `alert-box alert-${type}`;
    box.style.display = 'block';
  }
});
