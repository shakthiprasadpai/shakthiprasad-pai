import { PricePoint, MinerviniTradeSetup, DetectedRsiDivergence, RsiDivergenceAlertPayload } from '../types';
import { playSmartMoneyDivergenceChime } from './audioAlertEngine';
import { appendTrackerLog } from './backgroundPriceChecker';

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

/**
 * Detect RSI Bullish and Bearish divergences across stock price history
 */
export function detectRsiDivergences(
  stock: MinerviniTradeSetup,
  rsiPeriod: number = 14
): DetectedRsiDivergence[] {
  const history = stock.priceHistory || [];
  if (history.length < 15) return [];

  const rsiData = calculateRsiSeries(history, rsiPeriod);
  const divergences: DetectedRsiDivergence[] = [];
  const n = history.length;

  interface SwingPoint {
    idx: number;
    date: string;
    price: number;
    low: number;
    high: number;
    rsi: number;
  }

  const swingLows: SwingPoint[] = [];
  const swingHighs: SwingPoint[] = [];

  for (let i = 2; i < n - 1; i++) {
    const p = history[i];
    const prev = history[i - 1];
    const prev2 = history[i - 2];
    const next = history[i + 1];
    const rsi = rsiData[i]?.rsi ?? 50;

    // Swing Low: price is local trough
    if (p.low <= prev.low && p.low <= prev2.low && p.low <= next.low) {
      swingLows.push({
        idx: i,
        date: p.date,
        price: p.close,
        low: p.low,
        high: p.high,
        rsi
      });
    }

    // Swing High: price is local peak
    if (p.high >= prev.high && p.high >= prev2.high && p.high >= next.high) {
      swingHighs.push({
        idx: i,
        date: p.date,
        price: p.close,
        low: p.low,
        high: p.high,
        rsi
      });
    }
  }

  // Include the latest candle as a tentative swing point if it forms an extreme vs prior 2 days
  const lastBar = history[n - 1];
  const lastRsi = rsiData[n - 1]?.rsi ?? 50;
  if (lastBar && n >= 4) {
    if (lastBar.low <= history[n - 2].low && lastBar.low <= history[n - 3].low) {
      if (!swingLows.length || swingLows[swingLows.length - 1].idx !== n - 1) {
        swingLows.push({ idx: n - 1, date: lastBar.date, price: lastBar.close, low: lastBar.low, high: lastBar.high, rsi: lastRsi });
      }
    }
    if (lastBar.high >= history[n - 2].high && lastBar.high >= history[n - 3].high) {
      if (!swingHighs.length || swingHighs[swingHighs.length - 1].idx !== n - 1) {
        swingHighs.push({ idx: n - 1, date: lastBar.date, price: lastBar.close, low: lastBar.low, high: lastBar.high, rsi: lastRsi });
      }
    }
  }

  // 1. Detect Bullish Divergences between swing low pairs
  for (let j = 1; j < swingLows.length; j++) {
    const s2 = swingLows[j];
    for (let k = j - 1; k >= 0 && j - k <= 5; k--) {
      const s1 = swingLows[k];
      const barsBetween = s2.idx - s1.idx;
      if (barsBetween < 3 || barsBetween > 50) continue;

      const priceDiffPct = ((s2.low - s1.low) / s1.low) * 100;
      const rsiDiff = s2.rsi - s1.rsi;

      // Regular Bullish Divergence: Price made lower low (or double bottom shakeout), RSI made higher low
      if (s2.low < s1.low * 0.998 && rsiDiff >= 1.5 && s1.rsi <= 52) {
        const barsAgo = n - 1 - s2.idx;
        const conviction = Math.min(
          10,
          Math.max(5, Math.round(6 + (s1.rsi < 35 ? 2 : 0) + (rsiDiff >= 4 ? 1 : 0) + (Math.abs(priceDiffPct) > 2 ? 1 : 0)))
        );

        divergences.push({
          id: `rsi-div-bull-${stock.ticker}-${s1.date}-${s2.date}`,
          ticker: stock.ticker,
          type: 'BULLISH',
          kind: 'REGULAR_BULLISH',
          strength: conviction >= 8 ? 'STRONG' : conviction >= 7 ? 'MODERATE' : 'MILD',
          convictionScore: conviction,
          startDate: s1.date,
          endDate: s2.date,
          startPrice: s1.low,
          endPrice: s2.low,
          startRsi: Number(s1.rsi.toFixed(1)),
          endRsi: Number(s2.rsi.toFixed(1)),
          rsiCurrent: Number(lastRsi.toFixed(1)),
          priceDiffPercent: Number(priceDiffPct.toFixed(2)),
          rsiDiff: Number(rsiDiff.toFixed(1)),
          barsAgo,
          isRecent: barsAgo <= 20,
          title: `RSI Bullish Divergence (${s1.rsi.toFixed(1)} ➔ ${s2.rsi.toFixed(1)})`,
          description: `Price reached lower swing low (${s1.low.toFixed(2)} ➔ ${s2.low.toFixed(2)}, ${priceDiffPct.toFixed(1)}%), while RSI formed higher low (${s1.rsi.toFixed(1)} ➔ ${s2.rsi.toFixed(1)}, +${rsiDiff.toFixed(1)} pts). Downward momentum exhausted.`,
          sepaPlaybook: 'Mark Minervini SEPA Rule: Institutional accumulation under the tape. Look for contraction wave volume dry-up and prepare entry on subsequent pivot breakout.'
        });
        break;
      }

      // Hidden Bullish Divergence: Price maintained higher low, RSI made lower low
      if (s2.low > s1.low * 1.01 && rsiDiff <= -2.0 && s2.rsi >= 38) {
        const barsAgo = n - 1 - s2.idx;
        divergences.push({
          id: `rsi-div-hidbull-${stock.ticker}-${s1.date}-${s2.date}`,
          ticker: stock.ticker,
          type: 'BULLISH',
          kind: 'HIDDEN_BULLISH',
          strength: 'MODERATE',
          convictionScore: 7,
          startDate: s1.date,
          endDate: s2.date,
          startPrice: s1.low,
          endPrice: s2.low,
          startRsi: Number(s1.rsi.toFixed(1)),
          endRsi: Number(s2.rsi.toFixed(1)),
          rsiCurrent: Number(lastRsi.toFixed(1)),
          priceDiffPercent: Number(priceDiffPct.toFixed(2)),
          rsiDiff: Number(rsiDiff.toFixed(1)),
          barsAgo,
          isRecent: barsAgo <= 20,
          title: `Hidden Bullish Divergence (${s1.rsi.toFixed(1)} ➔ ${s2.rsi.toFixed(1)})`,
          description: `Price maintained higher low (+${priceDiffPct.toFixed(1)}%) despite RSI resetting to lower low (${rsiDiff.toFixed(1)} pts). Uptrend continuation signal.`,
          sepaPlaybook: 'SEPA Trend Rule: Pullback was absorbed cleanly before structural breach. Favor continuation of Stage 2 uptrend.'
        });
        break;
      }
    }
  }

  // 2. Detect Bearish Divergences between swing high pairs
  for (let j = 1; j < swingHighs.length; j++) {
    const s2 = swingHighs[j];
    for (let k = j - 1; k >= 0 && j - k <= 5; k--) {
      const s1 = swingHighs[k];
      const barsBetween = s2.idx - s1.idx;
      if (barsBetween < 3 || barsBetween > 50) continue;

      const priceDiffPct = ((s2.high - s1.high) / s1.high) * 100;
      const rsiDiff = s2.rsi - s1.rsi;

      // Regular Bearish Divergence: Price made higher high, RSI made lower high
      if (s2.high > s1.high * 1.002 && rsiDiff <= -1.5 && s1.rsi >= 58) {
        const barsAgo = n - 1 - s2.idx;
        const conviction = Math.min(
          10,
          Math.max(5, Math.round(6 + (s1.rsi >= 70 ? 2 : 0) + (Math.abs(rsiDiff) >= 4 ? 1 : 0) + (priceDiffPct > 2 ? 1 : 0)))
        );

        divergences.push({
          id: `rsi-div-bear-${stock.ticker}-${s1.date}-${s2.date}`,
          ticker: stock.ticker,
          type: 'BEARISH',
          kind: 'REGULAR_BEARISH',
          strength: conviction >= 8 ? 'STRONG' : conviction >= 7 ? 'MODERATE' : 'MILD',
          convictionScore: conviction,
          startDate: s1.date,
          endDate: s2.date,
          startPrice: s1.high,
          endPrice: s2.high,
          startRsi: Number(s1.rsi.toFixed(1)),
          endRsi: Number(s2.rsi.toFixed(1)),
          rsiCurrent: Number(lastRsi.toFixed(1)),
          priceDiffPercent: Number(priceDiffPct.toFixed(2)),
          rsiDiff: Number(rsiDiff.toFixed(1)),
          barsAgo,
          isRecent: barsAgo <= 20,
          title: `RSI Bearish Divergence (${s1.rsi.toFixed(1)} ➔ ${s2.rsi.toFixed(1)})`,
          description: `Price pushed higher (${s1.high.toFixed(2)} ➔ ${s2.high.toFixed(2)}, +${priceDiffPct.toFixed(1)}%), but RSI formed lower high (${s1.rsi.toFixed(1)} ➔ ${s2.rsi.toFixed(1)}, ${rsiDiff.toFixed(1)} pts). Upward momentum waning.`,
          sepaPlaybook: 'Mark Minervini Risk Rule: Upward exhaustion / distribution risk. Tighten stop loss, protect profits, and avoid chasing new highs.'
        });
        break;
      }
    }
  }

  // Sort divergences: most recent first, then highest conviction
  return divergences.sort((a, b) => a.barsAgo - b.barsAgo || b.convictionScore - a.convictionScore);
}

/**
 * Returns the most recent and significant active divergence for the stock
 */
export function getLatestActiveDivergence(
  stock: MinerviniTradeSetup,
  rsiPeriod: number = 14
): DetectedRsiDivergence | null {
  const all = detectRsiDivergences(stock, rsiPeriod);
  if (all.length === 0) return null;
  // Return the first recent divergence, or the most recent historical one
  const recent = all.find(d => d.isRecent);
  return recent || all[0];
}

/**
 * Synthesizes a realistic RSI divergence based on the stock's actual data for live testing
 */
export function simulateRsiDivergence(
  stock: MinerviniTradeSetup,
  type: 'BULLISH' | 'BEARISH' = 'BULLISH'
): DetectedRsiDivergence {
  const history = stock.priceHistory || [];
  const currentPrice = stock.currentPrice || stock.pivotPrice || 100;
  const n = history.length;
  const lastDate = n > 0 ? history[n - 1].date : new Date().toISOString().split('T')[0];
  const prevDate = n > 12 ? history[n - 12].date : new Date(Date.now() - 12 * 86400000).toISOString().split('T')[0];

  if (type === 'BULLISH') {
    const startPrice = Number((currentPrice * 1.045).toFixed(2));
    const endPrice = Number(currentPrice.toFixed(2));
    const startRsi = 32.4;
    const endRsi = 45.8;
    return {
      id: `sim-rsi-div-bull-${stock.ticker}-${Date.now()}`,
      ticker: stock.ticker,
      type: 'BULLISH',
      kind: 'REGULAR_BULLISH',
      strength: 'STRONG',
      convictionScore: 9,
      startDate: prevDate,
      endDate: lastDate,
      startPrice,
      endPrice,
      startRsi,
      endRsi,
      rsiCurrent: endRsi,
      priceDiffPercent: Number((((endPrice - startPrice) / startPrice) * 100).toFixed(2)),
      rsiDiff: Number((endRsi - startRsi).toFixed(1)),
      barsAgo: 0,
      isRecent: true,
      title: `RSI Bullish Divergence (${startRsi} ➔ ${endRsi})`,
      description: `Price reached lower swing low (${startPrice} ➔ ${endPrice}, -4.3%) while RSI formed higher low (${startRsi} ➔ ${endRsi}, +13.4 pts). Downside selling pressure exhausted.`,
      sepaPlaybook: 'Mark Minervini SEPA Rule: Institutional accumulation under the tape. Watch for contraction wave volume dry-up and prepare entry on subsequent pivot breakout.'
    };
  } else {
    const startPrice = Number((currentPrice * 0.94).toFixed(2));
    const endPrice = Number(currentPrice.toFixed(2));
    const startRsi = 73.6;
    const endRsi = 61.2;
    return {
      id: `sim-rsi-div-bear-${stock.ticker}-${Date.now()}`,
      ticker: stock.ticker,
      type: 'BEARISH',
      kind: 'REGULAR_BEARISH',
      strength: 'STRONG',
      convictionScore: 8,
      startDate: prevDate,
      endDate: lastDate,
      startPrice,
      endPrice,
      startRsi,
      endRsi,
      rsiCurrent: endRsi,
      priceDiffPercent: Number((((endPrice - startPrice) / startPrice) * 100).toFixed(2)),
      rsiDiff: Number((endRsi - startRsi).toFixed(1)),
      barsAgo: 0,
      isRecent: true,
      title: `RSI Bearish Divergence (${startRsi} ➔ ${endRsi})`,
      description: `Price pushed higher (${startPrice} ➔ ${endPrice}, +6.4%), but RSI dropped from overbought (${startRsi} ➔ ${endRsi}, -12.4 pts). Momentum exhaustion detected.`,
      sepaPlaybook: 'Mark Minervini Risk Rule: Distribution phase warning. Tighten stop loss to breakeven or lock in partial profits at resistance targets.'
    };
  }
}

/**
 * Triggers audio chime, logs to tracker, and dispatches custom DOM event for toast notification
 */
export function dispatchRsiDivergenceNotification(
  stock: MinerviniTradeSetup,
  divergence: DetectedRsiDivergence
): RsiDivergenceAlertPayload {
  const payload: RsiDivergenceAlertPayload = {
    ticker: stock.ticker,
    stockName: stock.name,
    exchange: stock.exchange || 'NASDAQ',
    divergenceType: divergence.type,
    divergenceKind: divergence.kind,
    strength: divergence.strength,
    convictionScore: divergence.convictionScore,
    startDate: divergence.startDate,
    endDate: divergence.endDate,
    startPrice: divergence.startPrice,
    endPrice: divergence.endPrice,
    startRsi: divergence.startRsi,
    endRsi: divergence.endRsi,
    rsiCurrent: divergence.rsiCurrent,
    priceDiffPercent: divergence.priceDiffPercent,
    rsiDiff: divergence.rsiDiff,
    title: divergence.title,
    description: divergence.description,
    sepaPlaybook: divergence.sepaPlaybook,
    triggeredAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  };

  // Play audio chime
  try {
    playSmartMoneyDivergenceChime(divergence.type);
  } catch (e) {
    // Ignore audio context errors
  }

  // Log to background tracker log
  try {
    appendTrackerLog({
      ticker: stock.ticker,
      exchange: stock.exchange,
      previousPrice: divergence.startPrice,
      currentPrice: divergence.endPrice,
      targetPrice: divergence.endPrice,
      targetType: divergence.type === 'BULLISH' ? 'RSI_BULLISH_DIVERGENCE' : 'RSI_BEARISH_DIVERGENCE',
      event: 'TICK_CHECK',
      triggered: true
    });
  } catch (e) {
    // Ignore tracker log errors
  }

  // Dispatch custom DOM event for GlobalNotificationToast
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('minervini_rsi_divergence_alert', {
        detail: payload
      })
    );
  }

  return payload;
}

const NOTIFIED_DIVERGENCES_KEY = 'minervini_notified_rsi_divergences';

export function hasDivergenceBeenAlerted(stockTicker: string, divergenceId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = sessionStorage.getItem(NOTIFIED_DIVERGENCES_KEY);
    if (!raw) return false;
    const map = JSON.parse(raw);
    return Boolean(map[`${stockTicker}_${divergenceId}`]);
  } catch (e) {
    return false;
  }
}

export function markDivergenceAsAlerted(stockTicker: string, divergenceId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = sessionStorage.getItem(NOTIFIED_DIVERGENCES_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[`${stockTicker}_${divergenceId}`] = Date.now();
    sessionStorage.setItem(NOTIFIED_DIVERGENCES_KEY, JSON.stringify(map));
  } catch (e) {
    // Ignore storage errors
  }
}
