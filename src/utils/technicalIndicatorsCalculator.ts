import { PricePoint, MinerviniTradeSetup } from '../types';

export interface RsiPoint {
  date: string;
  close: number;
  rsi: number;
  gain: number;
  loss: number;
  avgGain: number;
  avgLoss: number;
  status: 'OVERBOUGHT' | 'SEPA_SWEET_SPOT' | 'NEUTRAL' | 'OVERSOLD';
  divergence?: 'BULLISH' | 'BEARISH' | null;
}

export interface TechnicalIndicatorsSummary {
  rsi14: number;
  rsiStatus: 'OVERBOUGHT' | 'SEPA_SWEET_SPOT' | 'NEUTRAL' | 'OVERSOLD';
  rsiZoneLabel: string;
  isSepaSweetSpot: boolean; // 50 <= RSI <= 70
  
  // Moving Averages Current Values
  ema10: number;
  ema21: number;
  sma20: number;
  sma50: number;
  sma150: number;
  sma200: number;

  // MA Alignment & Crosses
  isBullishAlignment: boolean; // Price > 10 EMA > 21 EMA > 50 SMA > 150 SMA > 200 SMA
  alignmentScore: number; // 0 to 100%
  goldenCross: boolean; // 50 SMA > 200 SMA
  priceVsEma10Pct: number;
  priceVsEma21Pct: number;
  priceVsSma50Pct: number;
  priceVsSma200Pct: number;

  // Pivot Points
  pivotPoints: PivotLevelsResult;
}

export type PivotPointModel = 'STANDARD' | 'FIBONACCI' | 'CAMARILLA';

export interface PivotLevel {
  id: string;
  label: string;
  price: number;
  type: 'PIVOT' | 'RESISTANCE' | 'SUPPORT';
  color: string;
  description: string;
  diffPct: number;
  isNearest: boolean;
}

export interface PivotLevelsResult {
  model: PivotPointModel;
  high: number;
  low: number;
  close: number;
  pivot: number;
  r1: number;
  r2: number;
  r3: number;
  s1: number;
  s2: number;
  s3: number;
  levels: PivotLevel[];
}

/**
 * Calculate Exponential Moving Average (EMA) series
 */
export function calculateEmaSeries(prices: number[], period: number): number[] {
  if (prices.length === 0) return [];
  if (period <= 0) return prices;

  const result: number[] = new Array(prices.length);
  const k = 2 / (period + 1);

  // Initial SMA for the first 'period' elements
  let sum = 0;
  const initLength = Math.min(period, prices.length);
  for (let i = 0; i < initLength; i++) {
    sum += prices[i];
    result[i] = Number((sum / (i + 1)).toFixed(2));
  }

  let prevEma = sum / initLength;
  for (let i = initLength; i < prices.length; i++) {
    const currentEma = prices[i] * k + prevEma * (1 - k);
    result[i] = Number(currentEma.toFixed(2));
    prevEma = currentEma;
  }

  return result;
}

/**
 * Calculate Simple Moving Average (SMA) series
 */
export function calculateSmaSeries(prices: number[], period: number): number[] {
  if (prices.length === 0) return [];
  if (period <= 0) return prices;

  const result: number[] = new Array(prices.length);
  for (let i = 0; i < prices.length; i++) {
    const start = Math.max(0, i - period + 1);
    let sum = 0;
    for (let j = start; j <= i; j++) {
      sum += prices[j];
    }
    result[i] = Number((sum / (i - start + 1)).toFixed(2));
  }
  return result;
}

/**
 * Calculate Welles Wilder 14-period RSI (Relative Strength Index) series
 */
export function calculateRsiSeries(history: PricePoint[], period: number = 14): RsiPoint[] {
  if (!history || history.length === 0) return [];

  const closes = history.map(p => p.close);
  const n = closes.length;
  const result: RsiPoint[] = [];

  if (n < 2) {
    return history.map(p => ({
      date: p.date,
      close: p.close,
      rsi: 50,
      gain: 0,
      loss: 0,
      avgGain: 0,
      avgLoss: 0,
      status: 'NEUTRAL'
    }));
  }

  const gains: number[] = [0];
  const losses: number[] = [0];

  for (let i = 1; i < n; i++) {
    const diff = closes[i] - closes[i - 1];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? Math.abs(diff) : 0);
  }

  // Initial average gain & loss over 'period'
  let avgGain = 0;
  let avgLoss = 0;
  const firstLen = Math.min(period, n - 1);

  for (let i = 1; i <= firstLen; i++) {
    avgGain += gains[i];
    avgLoss += losses[i];
  }
  avgGain = avgGain / (firstLen || 1);
  avgLoss = avgLoss / (firstLen || 1);

  for (let i = 0; i < n; i++) {
    if (i === 0) {
      result.push({
        date: history[i].date,
        close: history[i].close,
        rsi: 50,
        gain: 0,
        loss: 0,
        avgGain: 0,
        avgLoss: 0,
        status: 'NEUTRAL'
      });
      continue;
    }

    if (i > period) {
      // Wilder's smoothing technique: prevAvg * (period - 1) + current / period
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    }

    let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    let rsiVal = avgLoss === 0 ? 100 : avgGain === 0 ? 0 : 100 - (100 / (1 + rs));
    rsiVal = Number(Math.max(0, Math.min(100, rsiVal)).toFixed(1));

    let status: 'OVERBOUGHT' | 'SEPA_SWEET_SPOT' | 'NEUTRAL' | 'OVERSOLD' = 'NEUTRAL';
    if (rsiVal >= 70) {
      status = 'OVERBOUGHT';
    } else if (rsiVal >= 50 && rsiVal < 70) {
      status = 'SEPA_SWEET_SPOT';
    } else if (rsiVal <= 30) {
      status = 'OVERSOLD';
    } else {
      status = 'NEUTRAL';
    }

    // Divergence check (over rolling 15 days)
    let divergence: 'BULLISH' | 'BEARISH' | null = null;
    if (i >= 15) {
      const pastClose = closes[i - 10];
      const pastRsi = result[i - 10]?.rsi ?? 50;
      // Bullish divergence: price made lower low, but RSI made higher low
      if (closes[i] < pastClose && rsiVal > pastRsi && rsiVal < 50) {
        divergence = 'BULLISH';
      }
      // Bearish divergence: price made higher high, but RSI made lower high
      if (closes[i] > pastClose && rsiVal < pastRsi && rsiVal > 60) {
        divergence = 'BEARISH';
      }
    }

    result.push({
      date: history[i].date,
      close: history[i].close,
      rsi: rsiVal,
      gain: Number(gains[i].toFixed(2)),
      loss: Number(losses[i].toFixed(2)),
      avgGain: Number(avgGain.toFixed(2)),
      avgLoss: Number(avgLoss.toFixed(2)),
      status,
      divergence
    });
  }

  return result;
}

/**
 * Calculate Standard, Fibonacci, and Camarilla Pivot Points
 */
export function calculatePivotPoints(
  high: number,
  low: number,
  close: number,
  currentPrice: number,
  model: PivotPointModel = 'STANDARD'
): PivotLevelsResult {
  const range = Math.max(0.01, high - low);
  let pivot = 0;
  let r1 = 0, r2 = 0, r3 = 0;
  let s1 = 0, s2 = 0, s3 = 0;

  if (model === 'STANDARD') {
    // Floor / Classic Pivot Points
    pivot = (high + low + close) / 3;
    r1 = 2 * pivot - low;
    s1 = 2 * pivot - high;
    r2 = pivot + (high - low);
    s2 = pivot - (high - low);
    r3 = high + 2 * (pivot - low);
    s3 = low - 2 * (high - pivot);
  } else if (model === 'FIBONACCI') {
    // Fibonacci Pivot Points
    pivot = (high + low + close) / 3;
    r1 = pivot + 0.382 * range;
    r2 = pivot + 0.618 * range;
    r3 = pivot + 1.000 * range;
    s1 = pivot - 0.382 * range;
    s2 = pivot - 0.618 * range;
    s3 = pivot - 1.000 * range;
  } else {
    // Camarilla Pivot Points
    pivot = (high + low + close) / 3;
    r3 = close + range * (1.1 / 4); // Reversal short resistance
    r2 = close + range * (1.1 / 6);
    r1 = close + range * (1.1 / 12);
    s1 = close - range * (1.1 / 12);
    s2 = close - range * (1.1 / 6);
    s3 = close - range * (1.1 / 4); // Reversal long support
    // Extended breakout levels
    r2 = Number((close + range * 1.1 / 2).toFixed(2)); // R4 Breakout Long
    s2 = Number((close - range * 1.1 / 2).toFixed(2)); // S4 Breakdown Short
  }

  // Format and round
  pivot = Number(pivot.toFixed(2));
  r1 = Number(r1.toFixed(2));
  r2 = Number(r2.toFixed(2));
  r3 = Number(r3.toFixed(2));
  s1 = Number(s1.toFixed(2));
  s2 = Number(s2.toFixed(2));
  s3 = Number(s3.toFixed(2));

  const rawLevels = [
    { id: 'R3', label: model === 'CAMARILLA' ? 'R4 (Breakout Long)' : 'R3 (Major Resistance)', price: r3, type: 'RESISTANCE' as const, color: '#dc2626', description: 'Institutional profit-taking barrier / extreme extension' },
    { id: 'R2', label: 'R2 (Target 2)', price: r2, type: 'RESISTANCE' as const, color: '#ef4444', description: 'Secondary upside target and structural resistance' },
    { id: 'R1', label: 'R1 (Target 1)', price: r1, type: 'RESISTANCE' as const, color: '#f97316', description: 'First overhead pivot resistance test' },
    { id: 'P', label: 'P (Central Pivot)', price: pivot, type: 'PIVOT' as const, color: '#3b82f6', description: 'Central pivot equilibrium baseline — bullish bias above' },
    { id: 'S1', label: 'S1 (Support 1)', price: s1, type: 'SUPPORT' as const, color: '#10b981', description: 'Initial institutional dip-buying pullback zone' },
    { id: 'S2', label: 'S2 (Support 2)', price: s2, type: 'SUPPORT' as const, color: '#059669', description: 'Strong structural swing floor / shakeout retest' },
    { id: 'S3', label: model === 'CAMARILLA' ? 'S4 (Breakdown Stop)' : 'S3 (Major Support)', price: s3, type: 'SUPPORT' as const, color: '#047857', description: 'Critical trend boundary / maximum downside limit' },
  ];

  // Find nearest level to current price
  let minDiff = Infinity;
  let nearestId = 'P';
  rawLevels.forEach(lvl => {
    const diff = Math.abs(currentPrice - lvl.price);
    if (diff < minDiff) {
      minDiff = diff;
      nearestId = lvl.id;
    }
  });

  const levels: PivotLevel[] = rawLevels.map(lvl => ({
    ...lvl,
    diffPct: Number((((lvl.price - currentPrice) / currentPrice) * 100).toFixed(1)),
    isNearest: lvl.id === nearestId
  }));

  return {
    model,
    high,
    low,
    close,
    pivot,
    r1,
    r2,
    r3,
    s1,
    s2,
    s3,
    levels
  };
}

/**
 * Enriches PricePoint array with Moving Averages (10 EMA, 21 EMA, 20 SMA, 50 SMA, 150 SMA, 200 SMA) and RSI(14)
 */
export function enrichHistoryWithTechnicalIndicators(
  history: PricePoint[],
  rsiPeriod: number = 14
): Array<PricePoint & {
  ema10: number;
  ema21: number;
  sma20: number;
  rsi: number;
  rsiStatus: string;
}> {
  if (!history || history.length === 0) return [];

  const closes = history.map(p => p.close);
  const ema10Series = calculateEmaSeries(closes, 10);
  const ema21Series = calculateEmaSeries(closes, 21);
  const sma20Series = calculateSmaSeries(closes, 20);
  const rsiSeries = calculateRsiSeries(history, rsiPeriod);

  return history.map((point, i) => ({
    ...point,
    ema10: ema10Series[i] ?? point.close,
    ema21: ema21Series[i] ?? point.close,
    sma20: sma20Series[i] ?? point.close,
    rsi: rsiSeries[i]?.rsi ?? 50,
    rsiStatus: rsiSeries[i]?.status ?? 'NEUTRAL'
  }));
}

/**
 * Generates high-level technical summary for a stock
 */
export function computeTechnicalIndicatorsSummary(
  stock: MinerviniTradeSetup,
  pivotModel: PivotPointModel = 'STANDARD'
): TechnicalIndicatorsSummary {
  const history = stock.priceHistory || [];
  const currentPrice = stock.currentPrice || (history.length > 0 ? history[history.length - 1].close : stock.pivotPrice);

  const closes = history.map(p => p.close);
  const ema10Series = calculateEmaSeries(closes, 10);
  const ema21Series = calculateEmaSeries(closes, 21);
  const sma20Series = calculateSmaSeries(closes, 20);
  const rsiSeries = calculateRsiSeries(history, 14);

  const lastIdx = Math.max(0, history.length - 1);
  const ema10 = ema10Series[lastIdx] ?? currentPrice;
  const ema21 = ema21Series[lastIdx] ?? currentPrice;
  const sma20 = sma20Series[lastIdx] ?? currentPrice;
  const sma50 = stock.sma50 || (history[lastIdx]?.sma50 ?? currentPrice);
  const sma150 = stock.sma150 || (history[lastIdx]?.sma150 ?? currentPrice);
  const sma200 = stock.sma200 || (history[lastIdx]?.sma200 ?? currentPrice);

  const latestRsi = rsiSeries[lastIdx]?.rsi ?? (stock.rsi14 ?? 58.4);
  let rsiStatus: 'OVERBOUGHT' | 'SEPA_SWEET_SPOT' | 'NEUTRAL' | 'OVERSOLD' = 'NEUTRAL';
  let rsiZoneLabel = 'Neutral Momentum (40–50)';

  if (latestRsi >= 70) {
    rsiStatus = 'OVERBOUGHT';
    rsiZoneLabel = 'Overbought (>70) — Extended';
  } else if (latestRsi >= 50 && latestRsi < 70) {
    rsiStatus = 'SEPA_SWEET_SPOT';
    rsiZoneLabel = 'SEPA Momentum Sweet Spot (50–70)';
  } else if (latestRsi <= 30) {
    rsiStatus = 'OVERSOLD';
    rsiZoneLabel = 'Oversold (<30) — Deep Shakeout';
  }

  // Alignment checks
  const c1 = currentPrice > ema10;
  const c2 = ema10 > ema21;
  const c3 = ema21 > sma50;
  const c4 = sma50 > sma150;
  const c5 = sma150 > sma200;

  const passedCount = [c1, c2, c3, c4, c5].filter(Boolean).length;
  const alignmentScore = Math.round((passedCount / 5) * 100);
  const isBullishAlignment = passedCount === 5;
  const goldenCross = sma50 > sma200;

  // Pivot Point calculation from recent 20-day high, low, close
  let pHigh = stock.high52w || currentPrice * 1.1;
  let pLow = stock.low52w || currentPrice * 0.9;
  let pClose = currentPrice;

  if (history.length >= 5) {
    const recentSlice = history.slice(Math.max(0, history.length - 20));
    pHigh = Math.max(...recentSlice.map(p => p.high));
    pLow = Math.min(...recentSlice.map(p => p.low));
    pClose = recentSlice[recentSlice.length - 1].close;
  }

  const pivotPoints = calculatePivotPoints(pHigh, pLow, pClose, currentPrice, pivotModel);

  return {
    rsi14: latestRsi,
    rsiStatus,
    rsiZoneLabel,
    isSepaSweetSpot: latestRsi >= 50 && latestRsi <= 70,
    ema10,
    ema21,
    sma20,
    sma50,
    sma150,
    sma200,
    isBullishAlignment,
    alignmentScore,
    goldenCross,
    priceVsEma10Pct: Number((((currentPrice - ema10) / ema10) * 100).toFixed(1)),
    priceVsEma21Pct: Number((((currentPrice - ema21) / ema21) * 100).toFixed(1)),
    priceVsSma50Pct: Number((((currentPrice - sma50) / sma50) * 100).toFixed(1)),
    priceVsSma200Pct: Number((((currentPrice - sma200) / sma200) * 100).toFixed(1)),
    pivotPoints
  };
}
