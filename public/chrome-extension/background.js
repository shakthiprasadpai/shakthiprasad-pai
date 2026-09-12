// Minervini SEPA Second Brain - Background Service Worker
chrome.runtime.onInstalled.addListener(() => {
  // Create context menu for quick right-click clipping
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

    // Auto detect ticker from title or url
    let ticker = '';
    const match = pageTitle.match(/\$([A-Za-z]{2,5})/) || pageUrl.match(/symbol=([A-Za-z0-9_:]+)/);
    if (match && match[1]) {
      ticker = match[1].split(':').pop() || '';
    }

    const newClip = {
      id: 'clip-' + Date.now(),
      title: `${ticker ? '$' + ticker.toUpperCase() + ' - ' : ''}${pageTitle.slice(0, 60)}`,
      url: pageUrl,
      ticker: ticker ? ticker.toUpperCase() : undefined,
      source: pageUrl.includes('tradingview.com') ? 'TradingView' : pageUrl.includes('x.com') ? 'Twitter / X' : 'Web Browser',
      content: selectedText || `Bookmarked page: ${pageTitle}`,
      category: 'PROJECTS',
      tags: ['#web-clip', ticker ? `#${ticker.toLowerCase()}` : '#research', '#context-menu'],
      timestamp: new Date().toISOString(),
      status: 'UNPROCESSED'
    };

    // Save to local storage
    chrome.storage.local.get(['sepaClips', 'sepaServerHost'], (res) => {
      const list = res.sepaClips || [];
      list.unshift(newClip);
      chrome.storage.local.set({ sepaClips: list.slice(0, 100) });

      // Forward to backend API if available
      const host = res.sepaServerHost || 'http://localhost:3000';
      fetch(`${host}/api/second-brain/clip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newClip)
      }).catch((e) => console.log('Silent background push completed'));
    });
  }
});
