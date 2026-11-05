import { MinerviniTradeSetup } from '../types';

export type StockOrTicker =
  | MinerviniTradeSetup
  | { ticker?: string; symbol?: string; exchange?: string }
  | string
  | null
  | undefined;

export const CHARTINK_MINERVINI_SCREENER_URL =
  'https://chartink.com/screener/mark-minervini-trend-template-with-volume';

export const SCREENER_IN_MINERVINI_SCREENER_URL =
  'https://www.screener.in/screens/3778508/pai-minervini/';

/**
 * Generates direct technical chart URL for Chartink / ChartLink.
 * Handles MinerviniTradeSetup stock objects, raw ticker strings (e.g. "RELIANCE", "TCS"),
 * and exchange prefixes (e.g. "NSE:INFY", "NASDAQ:NVDA").
 */
export function getChartLinkUrl(item?: StockOrTicker): string {
  if (!item) {
    return CHARTINK_MINERVINI_SCREENER_URL;
  }

  let ticker = '';
  let exchange: string | undefined = undefined;

  if (typeof item === 'string') {
    ticker = item.trim();
  } else if (typeof item === 'object') {
    ticker = (item as { ticker?: string; symbol?: string }).ticker || (item as { ticker?: string; symbol?: string }).symbol || '';
    exchange = (item as { exchange?: string }).exchange;
  }

  if (!ticker) {
    return CHARTINK_MINERVINI_SCREENER_URL;
  }

  // Strip exchange prefix if present (e.g. "NSE:TATASTEEL" or "BSE:500325")
  if (ticker.includes(':')) {
    const parts = ticker.split(':');
    exchange = exchange || parts[0];
    ticker = parts[1];
  }

  const cleanTicker = ticker.trim().toUpperCase();

  // If US market exchange is explicitly specified, link to TradingView chart
  if (exchange === 'NASDAQ' || exchange === 'NYSE') {
    return `https://www.tradingview.com/chart/?symbol=${exchange}:${cleanTicker}`;
  }

  // Default to Chartink for Indian equities (NSE/BSE)
  return `https://chartink.com/stocks/${cleanTicker.toLowerCase()}.html`;
}

/**
 * Helper to generate TradingView chart URL directly
 */
export function getTradingViewUrl(item?: StockOrTicker): string {
  if (!item) return 'https://www.tradingview.com/chart/';

  let ticker = '';
  let exchange = 'NSE';

  if (typeof item === 'string') {
    ticker = item.trim();
  } else if (typeof item === 'object') {
    ticker = (item as { ticker?: string; symbol?: string }).ticker || (item as { ticker?: string; symbol?: string }).symbol || '';
    if ((item as { exchange?: string }).exchange) {
      exchange = (item as { exchange?: string }).exchange as string;
    }
  }

  if (ticker.includes(':')) {
    const parts = ticker.split(':');
    exchange = parts[0];
    ticker = parts[1];
  }

  const cleanTicker = ticker.trim().toUpperCase();
  return `https://www.tradingview.com/chart/?symbol=${exchange}:${cleanTicker}`;
}

/**
 * Generates direct fundamental analysis URL for Screener.in.
 * Handles Indian equities (NSE/BSE), linking to consolidated company financials.
 */
export function getScreenerInUrl(item?: StockOrTicker): string {
  if (!item) {
    return SCREENER_IN_MINERVINI_SCREENER_URL;
  }

  let ticker = '';
  if (typeof item === 'string') {
    ticker = item.trim();
  } else if (typeof item === 'object') {
    ticker = (item as { ticker?: string; symbol?: string }).ticker || (item as { ticker?: string; symbol?: string }).symbol || '';
  }

  if (!ticker) {
    return SCREENER_IN_MINERVINI_SCREENER_URL;
  }

  // Strip prefix (e.g. "NSE:TRENT" -> "TRENT")
  if (ticker.includes(':')) {
    ticker = ticker.split(':')[1];
  }

  const cleanTicker = ticker.trim().toUpperCase();
  return `https://www.screener.in/company/${cleanTicker}/consolidated/`;
}

/**
 * Generates URL for running a raw query directly on Screener.in's query runner.
 */
export function getScreenerInQueryUrl(query: string): string {
  if (!query || !query.trim()) {
    return SCREENER_IN_MINERVINI_SCREENER_URL;
  }
  return `https://www.screener.in/screen/raw/?sort=&order=&source=&query=${encodeURIComponent(query.trim())}`;
}

export default getChartLinkUrl;

