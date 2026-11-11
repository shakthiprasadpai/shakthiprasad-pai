import type { MinerviniTradeSetup } from '../types';

// Shapes a dashboard stock into the series the desk tools and indicators work on.
// Everything is read from the stock's own price history and levels; nothing is invented.
export interface DeskTrade {
  id: string;
  sym: string;
  name: string;
  mode: string;
  setup: string;
  exchange: string;
  close: number;
  closes: number[];
  vols: number[];
  o: number[];
  h: number[];
  l: number[];
  dates: string[];
  pre: number[];
  ma: [number, number, number];
  hi52: number;
  lo52: number;
  checks: [string, string, 'pass' | 'fail'][];
  unchecked: number;
}

const WINDOW = 40;

export function stockToDeskTrade(stock: MinerviniTradeSetup): DeskTrade | null {
  const hist = Array.isArray(stock.priceHistory) ? stock.priceHistory.filter((p) => p && isFinite(p.close) && isFinite(p.open) && isFinite(p.high) && isFinite(p.low)) : [];
  if (hist.length < 12) return null;
  const win = hist.slice(-WINDOW), pre = hist.slice(0, hist.length - win.length);
  const c = stock.currentPrice;
  const rule = (label: string, val: string, ok: boolean): [string, string, 'pass' | 'fail'] => [label, val, ok ? 'pass' : 'fail'];
  const checks = [
    rule('Close above 150 and 200 DMA', `${c.toFixed(2)} vs ${stock.sma150.toFixed(2)} / ${stock.sma200.toFixed(2)}`, c > stock.sma150 && c > stock.sma200),
    rule('150 DMA above 200 DMA', `${stock.sma150.toFixed(2)} vs ${stock.sma200.toFixed(2)}`, stock.sma150 > stock.sma200),
    rule('200 DMA rising for a month', `${stock.sma200.toFixed(2)} vs ${stock.sma200_1mo_ago.toFixed(2)}`, stock.sma200 > stock.sma200_1mo_ago),
    rule('50 DMA above 150 and 200 DMA', stock.sma50.toFixed(2), stock.sma50 > stock.sma150 && stock.sma50 > stock.sma200),
    rule('Close above 50 DMA', `${c.toFixed(2)} vs ${stock.sma50.toFixed(2)}`, c > stock.sma50),
    rule('30%+ above 52-week low', `${((c / stock.low52w - 1) * 100).toFixed(0)}%`, c >= stock.low52w * 1.3),
    rule('Within 25% of 52-week high', `${((c / stock.high52w - 1) * 100).toFixed(0)}%`, c >= stock.high52w * 0.75),
    rule('RS rating 70 or higher', String(stock.rsRating), stock.rsRating >= 70),
  ];
  return {
    id: stock.ticker,
    sym: stock.ticker,
    name: stock.name,
    mode: stock.patternType,
    setup: `${stock.patternType}, ${stock.vcpStage}`,
    exchange: stock.exchange,
    close: c,
    closes: win.map((p) => p.close),
    vols: win.map((p) => p.volume / 1e6), // the tools show volume in millions
    o: win.map((p) => p.open),
    h: win.map((p) => p.high),
    l: win.map((p) => p.low),
    dates: win.map((p) => p.date),
    pre: pre.map((p) => p.close),
    ma: [stock.sma50, stock.sma150, stock.sma200],
    hi52: stock.high52w,
    lo52: stock.low52w,
    checks,
    unchecked: 0,
  };
}

export const stockLevels = (stock: MinerviniTradeSetup) => ({
  entry: String(stock.pivotPrice),
  stop: String(stock.stopLossPrice),
  t1: String(stock.target1Price),
  t2: String(stock.target2Price),
});
