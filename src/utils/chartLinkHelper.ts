import { MinerviniTradeSetup } from '../types';

/**
 * Generates direct ChartLink / Chartink URL for any given stock or ticker.
 * For NSE/BSE Indian stocks, Chartink URL format: https://chartink.com/stocks/{symbol}.html
 * For US/Global stocks, uses Chartink screener search or direct symbol resolution.
 */
export function getChartLinkUrl(stockOrTicker?: MinerviniTradeSetup | string | null, exchange?: string): string {
  if (!stockOrTicker) {
    return 'https://chartink.com/';
  }

  const ticker = typeof stockOrTicker === 'string' ? stockOrTicker : stockOrTicker.ticker;
  const ex = typeof stockOrTicker === 'string' ? (exchange || 'NSE') : (stockOrTicker.exchange || 'NSE');
  const cleanTicker = ticker.replace(/[^a-zA-Z0-9]/g, '').trim();

  if (!cleanTicker) {
    return 'https://chartink.com/';
  }

  // NSE & BSE Indian Equities have direct stock chart pages on Chartink / ChartLink
  if (ex === 'NSE' || ex === 'BSE' || !['NASDAQ', 'NYSE'].includes(ex)) {
    return `https://chartink.com/stocks/${cleanTicker.toLowerCase()}.html`;
  }

  // US & Global equities fallback to Chartink search/chart
  return `https://chartink.com/stocks/${cleanTicker.toLowerCase()}.html`;
}
