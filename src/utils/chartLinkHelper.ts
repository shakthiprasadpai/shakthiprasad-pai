import { MinerviniTradeSetup } from '../types';

export type StockOrTicker =
  | MinerviniTradeSetup
  | { ticker?: string; symbol?: string; exchange?: string }
  | string
  | null
  | undefined;

/**
 * Generates direct technical chart URL for Chartink / ChartLink.
 * Handles MinerviniTradeSetup stock objects, raw ticker strings (e.g. "RELIANCE", "TCS"),
 * and exchange prefixes (e.g. "NSE:INFY", "NASDAQ:NVDA").
 */
export function getChartLinkUrl(item?: StockOrTicker): string {
  if (!item) {
    return 'https://chartink.com/stocks/reliance.html';
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
    return 'https://chartink.com';
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

export default getChartLinkUrl;
