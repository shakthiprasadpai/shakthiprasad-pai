// Minervini SEPA Second Brain - Content Script
(() => {
  // Listen for messages from popup or background script
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'GET_PAGE_DATA') {
        const selection = window.getSelection() ? window.getSelection().toString().trim() : '';
        const title = document.title || '';
        const url = window.location.href;

        // Try extracting ticker from page
        let detectedTicker = '';
        const cashtagMatch = (document.body.innerText || '').match(/\$([A-Za-z]{2,5})/);
        if (cashtagMatch && cashtagMatch[1]) {
          detectedTicker = cashtagMatch[1].toUpperCase();
        }

        sendResponse({
          title,
          url,
          selection,
          detectedTicker
        });
      }
      return true;
    });
  }
})();
