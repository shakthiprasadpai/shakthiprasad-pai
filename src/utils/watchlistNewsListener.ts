import { MinerviniTradeSetup, MajorNewsEventPayload } from '../types';
import { getStoredWatchlists, getFavoriteTickers } from './watchlistStorage';
import { playAlertChime, appendTrackerLog } from './backgroundPriceChecker';

export const MAJOR_NEWS_STORAGE_KEY = 'minervini_major_news_alerts_history';

/**
 * Checks if a ticker symbol is present in the user's active custom watchlists or favorites.
 */
export function isTickerInUserWatchlists(ticker: string): { inWatchlist: boolean; watchlistNames: string[] } {
  if (!ticker) return { inWatchlist: false, watchlistNames: [] };
  const cleanTicker = ticker.trim().toUpperCase();

  const watchlists = getStoredWatchlists();
  const favorites = getFavoriteTickers().map((t) => t.trim().toUpperCase());

  const matchedNames: string[] = [];

  watchlists.forEach((wl) => {
    const hasTicker = wl.tickers.some((t) => t.trim().toUpperCase() === cleanTicker);
    if (hasTicker) {
      matchedNames.push(wl.name);
    }
  });

  if (favorites.includes(cleanTicker) && !matchedNames.includes('Favorites')) {
    matchedNames.push('Starred Favorites');
  }

  return {
    inWatchlist: matchedNames.length > 0,
    watchlistNames: matchedNames,
  };
}

/**
 * Keywords and signals that signify a market-moving 'major news event' or key SEPA catalyst.
 */
const MAJOR_CATALYST_KEYWORDS = [
  'earnings',
  'quarter revenues',
  'guidance',
  'revenue expansion',
  'margin expansion',
  'acquisition',
  'merger',
  'contract win',
  'fda approval',
  'regulatory',
  'breakout catalyst',
  'institutional',
  'block buy',
  'upgrade',
  'price target',
  'patent',
  'partnership',
  'management',
  'dividend increase',
  'buyback',
  'order win',
  'defense order',
];

/**
 * Evaluates whether a headline constitutes a major news event.
 */
export function isMajorNewsEvent(headline: {
  title?: string;
  sentiment?: string;
  catalystType?: string;
  isMajorEvent?: boolean;
  impactLevel?: string;
  snippet?: string;
}): boolean {
  if (!headline) return false;

  // 1. Explicit major flag or high/critical impact
  if (headline.isMajorEvent === true) return true;
  if (headline.impactLevel === 'CRITICAL' || headline.impactLevel === 'HIGH') return true;

  // 2. Catalyst sentiment
  if (headline.sentiment === 'CATALYST') return true;

  // 3. Keyword matching across title, catalystType, and snippet
  const combinedText = `${headline.title || ''} ${headline.catalystType || ''} ${headline.snippet || ''}`.toLowerCase();

  return MAJOR_CATALYST_KEYWORDS.some((kw) => combinedText.includes(kw));
}

/**
 * Get stored history of major news alerts from localStorage.
 */
export function getStoredMajorNewsHistory(): MajorNewsEventPayload[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(MAJOR_NEWS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to load major news alerts history', e);
    return [];
  }
}

/**
 * Save a newly detected major news alert into localStorage.
 */
export function saveMajorNewsAlert(payload: MajorNewsEventPayload): void {
  if (typeof window === 'undefined') return;
  try {
    const history = getStoredMajorNewsHistory();
    // Keep max 40 events
    const updated = [payload, ...history.filter((h) => h.headlineTitle !== payload.headlineTitle)].slice(0, 40);
    localStorage.setItem(MAJOR_NEWS_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save major news alert', e);
  }
}

/**
 * Dispatches a real-time notification event for a detected major news event for a watchlist stock.
 * Triggers audio chime, native notification, tracker log, and custom DOM event for toast display.
 */
export function dispatchMajorNewsToastEvent(payload: MajorNewsEventPayload): void {
  if (typeof window === 'undefined') return;

  // Play audio chime
  playAlertChime();

  // Save to persistent news alerts history
  saveMajorNewsAlert(payload);

  // Append entry to tracker logs
  appendTrackerLog({
    ticker: payload.ticker,
    exchange: payload.exchange || 'NASDAQ',
    previousPrice: 0,
    currentPrice: 0,
    targetPrice: 0,
    targetType: 'MAJOR_NEWS_CATALYST',
    event: 'TICK_CHECK',
    triggered: true,
  });

  // Native browser notification if permitted
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(`⚡ Watchlist Major News: ${payload.ticker}`, {
      body: `[${payload.catalystType || 'Catalyst'}] ${payload.headlineTitle} (${payload.source})`,
      icon: '/favicon.ico',
    });
  }

  // Dispatch custom window event caught by GlobalNotificationToast listener
  window.dispatchEvent(
    new CustomEvent('minervini_major_news_detected', {
      detail: payload,
    })
  );
}

/**
 * Evaluates all headlines returned from TickerNewsGrounding.
 * If the stock is in a user watchlist and a headline matches major news event criteria,
 * it dispatches the toast notification event.
 */
export function evaluateAndDispatchWatchlistNewsEvents(
  stock: MinerviniTradeSetup,
  newsResponse: {
    headlines?: Array<{
      title: string;
      source: string;
      date: string;
      snippet: string;
      sentiment: string;
      catalystType: string;
      isMajorEvent?: boolean;
      impactLevel?: string;
    }>;
    summary?: string;
    groundingSources?: Array<{ title: string; uri: string }>;
  }
): boolean {
  if (!stock || !newsResponse || !newsResponse.headlines || newsResponse.headlines.length === 0) {
    return false;
  }

  // Check if ticker is in active watchlists
  const wlCheck = isTickerInUserWatchlists(stock.ticker);
  if (!wlCheck.inWatchlist) {
    return false;
  }

  // Find the first major news event
  const majorHeadline = newsResponse.headlines.find((h) => isMajorNewsEvent(h));
  if (!majorHeadline) {
    return false;
  }

  // Check if we've already alerted on this headline recently to avoid spamming
  const history = getStoredMajorNewsHistory();
  const alreadyNotified = history.some(
    (h) => h.ticker === stock.ticker && h.headlineTitle === majorHeadline.title
  );
  if (alreadyNotified) {
    return false;
  }

  const payload: MajorNewsEventPayload = {
    ticker: stock.ticker,
    stockName: stock.name,
    exchange: stock.exchange,
    headlineTitle: majorHeadline.title,
    source: majorHeadline.source,
    date: majorHeadline.date,
    snippet: majorHeadline.snippet,
    sentiment: majorHeadline.sentiment as any,
    catalystType: majorHeadline.catalystType,
    impactLevel: (majorHeadline.impactLevel as any) || 'HIGH',
    isMajorEvent: true,
    summary: newsResponse.summary || `Major catalyst detected for ${stock.ticker}.`,
    groundingSources: newsResponse.groundingSources || [],
    watchlistName: wlCheck.watchlistNames[0] || 'Active Watchlist',
    triggeredAt: new Date().toLocaleTimeString(),
  };

  dispatchMajorNewsToastEvent(payload);
  return true;
}

/**
 * Helper to simulate a real-time major news catalyst alert for a given stock or default watchlist stock.
 */
export function simulateWatchlistMajorNewsAlert(stock?: MinerviniTradeSetup): MajorNewsEventPayload {
  const ticker = stock?.ticker || 'HAL';
  const name = stock?.name || 'Hindustan Aeronautics Ltd';
  const exchange = stock?.exchange || 'NSE';

  const wlCheck = isTickerInUserWatchlists(ticker);
  const wlName = wlCheck.watchlistNames[0] || 'SEPA Stage 2 Leaders';

  const simulatedPayload: MajorNewsEventPayload = {
    ticker,
    stockName: name,
    exchange,
    headlineTitle: `${ticker} Secures Strategic Multi-Billion Growth Contract; Upgrades Annual Revenue & EPS Guidance`,
    source: 'Bloomberg Markets / Wall Street Journal',
    date: 'Just Now (Breaking)',
    snippet: `${name} announced major institutional order pipeline expansion with management upgrading FY revenue guidance by 28%. Institutional block trade accumulation detected at pivot base.`,
    sentiment: 'CATALYST',
    catalystType: 'Earnings & Order Guidance',
    impactLevel: 'CRITICAL',
    isMajorEvent: true,
    summary: `Grounding search confirms high-conviction fundamental breakout catalyst for ${ticker}. Expanding order book and margin acceleration validate SEPA Stage 2 continuation.`,
    groundingUri: `https://www.google.com/search?q=${ticker}+stock+news+financial+catalyst`,
    groundingSources: [
      { title: `${ticker} Press Release & Financial Disclosure`, uri: `https://www.google.com/search?q=${ticker}+earnings` },
      { title: `Investor's Business Daily — ${ticker} Growth Leader Coverage`, uri: `https://www.investors.com` },
    ],
    watchlistName: wlName,
    triggeredAt: new Date().toLocaleTimeString(),
  };

  dispatchMajorNewsToastEvent(simulatedPayload);
  return simulatedPayload;
}
