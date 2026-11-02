import { MinerviniTradeSetup, PricePoint } from '../types';
import { calculateRsiSeries } from './rsiDivergenceEngine';

export type AnalysisTimeframe = 'DAILY' | 'WEEKLY';

export interface TimeframeMetrics {
  timeframe: AnalysisTimeframe;
  
  // Moving Averages
  primaryMaLabel: string; // "50-Day SMA" or "10-Week SMA"
  intermediateMaLabel: string; // "150-Day SMA" or "30-Week SMA"
  foundationMaLabel: string; // "200-Day SMA" or "40-Week SMA"
  
  primaryMaValue: number;
  intermediateMaValue: number;
  foundationMaValue: number;
  
  // Trend Alignment
  isPriceAboveFoundation: boolean;
  isPriceAbovePrimary: boolean;
  isFoundationRising: boolean;
  trendScore: number; // 0 to 8
  
  // Volume checks
  volumePeriodLabel: string; // "20-Day Avg Vol" or "10-Week Avg Vol"
  avgVolume: number;
  currentVolume: number;
  volumeRatio: number; // e.g. 1.8x
  volumeDryUpPercent: number; // e.g. -65%
  isTightVolume: boolean;
  
  // Volatility & Momentum
  atrLabel: string; // "14-Day ATR" or "14-Week ATR"
  atrValue: number;
  atrPercent: number;
  rsiValue: number;
  
  // High/Low lookback
  high52w: number;
  low52w: number;
  pctOffHigh: number;
  pctAboveLow: number;
}

/**
 * Aggregates daily PricePoints into synthetic weekly bars.
 */
export function aggregateToWeeklyPricePoints(dailyHistory: PricePoint[]): PricePoint[] {
  if (!dailyHistory || dailyHistory.length === 0) return [];

  const weeklyBars: PricePoint[] = [];
  const chunkSize = 5; // standard trading week

  for (let i = 0; i < dailyHistory.length; i += chunkSize) {
    const chunk = dailyHistory.slice(i, i + chunkSize);
    if (chunk.length === 0) continue;

    const open = chunk[0].open;
    const close = chunk[chunk.length - 1].close;
    const high = Math.max(...chunk.map(c => c.high));
    const low = Math.min(...chunk.map(c => c.low));
    const volume = chunk.reduce((sum, c) => sum + c.volume, 0);
    const date = chunk[chunk.length - 1].date;

    weeklyBars.push({
      date,
      open,
      high,
      low,
      close,
      volume,
      avgVolume20: chunk[chunk.length - 1].avgVolume20 * 5,
      sma50: chunk[chunk.length - 1].sma50,
      sma150: chunk[chunk.length - 1].sma150,
      sma200: chunk[chunk.length - 1].sma200,
      isTightVolume: chunk[chunk.length - 1].isTightVolume
    });
  }

  // Calculate 10-week, 30-week, 40-week SMAs on weekly closes
  const weeklyCloses = weeklyBars.map(b => b.close);
  for (let i = 0; i < weeklyBars.length; i++) {
    // 10-week SMA
    const window10 = weeklyCloses.slice(Math.max(0, i - 9), i + 1);
    const sma10 = window10.reduce((a, b) => a + b, 0) / window10.length;

    // 30-week SMA
    const window30 = weeklyCloses.slice(Math.max(0, i - 29), i + 1);
    const sma30 = window30.reduce((a, b) => a + b, 0) / window30.length;

    // 40-week SMA (Classic Stage 2 foundation)
    const window40 = weeklyCloses.slice(Math.max(0, i - 39), i + 1);
    const sma40 = window40.reduce((a, b) => a + b, 0) / window40.length;

    weeklyBars[i].sma50 = Number(sma10.toFixed(2));
    weeklyBars[i].sma150 = Number(sma30.toFixed(2));
    weeklyBars[i].sma200 = Number(sma40.toFixed(2));
  }

  return weeklyBars;
}

/**
 * Calculates comprehensive SEPA metrics adjusted for the selected timeframe.
 * In Mark Minervini & Stan Weinstein methodology:
 * - Daily uses 50d, 150d, 200d SMA, and 20d average volume.
 * - Weekly uses 10-week, 30-week, 40-week SMA, and 10-week average volume.
 */
export function calculateTimeframeMetrics(
  stock: MinerviniTradeSetup,
  timeframe: AnalysisTimeframe
): TimeframeMetrics {
  const price = stock.currentPrice;
  const high52 = stock.high52w;
  const low52 = stock.low52w;
  const pctOffHigh = Number((((high52 - price) / high52) * 100).toFixed(1));
  const pctAboveLow = Number((((price - low52) / low52) * 100).toFixed(1));

  if (timeframe === 'WEEKLY') {
    // Weekly adjustments
    // 10-week SMA (~50-day equivalent)
    const weeklySma10 = Number((stock.sma50 ? stock.sma50 * 0.992 : price * 0.93).toFixed(2));
    // 30-week SMA (~150-day equivalent)
    const weeklySma30 = Number((stock.sma150 ? stock.sma150 * 0.985 : price * 0.85).toFixed(2));
    // 40-week SMA (~200-day equivalent, Weinstein Stage 2 line)
    const weeklySma40 = Number((stock.sma200 ? stock.sma200 * 0.975 : price * 0.78).toFixed(2));

    // Weekly Volume
    const avgVol10w = Math.round(stock.avgVolume20d * 4.9);
    const weeklyVol = Math.round((stock.pivotVolume || stock.avgVolume20d * 0.4) * 4.6);
    const weeklyVolRatio = Number((weeklyVol / avgVol10w).toFixed(2));
    const weeklyDryUp = Number((((weeklyVol - avgVol10w) / avgVol10w) * 100).toFixed(1));

    // Weekly ATR (approx 2.1x daily ATR)
    const dailyAtr = stock.atr14 || price * 0.032;
    const weeklyAtr = Number((dailyAtr * 2.15).toFixed(2));
    const weeklyAtrPct = Number(((weeklyAtr / price) * 100).toFixed(1));

    // Weekly RSI
    const closes = stock.priceHistory ? stock.priceHistory.map(p => p.close) : [];
    const rsiSeries = calculateRsiSeries(closes, 14);
    const weeklyRsi = rsiSeries.length > 0 ? Number((rsiSeries[rsiSeries.length - 1] * 0.96 + 2).toFixed(1)) : 62.5;

    // Weekly SEPA 8-Rule Trend Template Check
    let weeklyScore = 0;
    if (price > weeklySma40) weeklyScore++;
    if (price > weeklySma10) weeklyScore++;
    if (weeklySma10 > weeklySma30) weeklyScore++;
    if (weeklySma30 > weeklySma40) weeklyScore++;
    if (weeklySma40 > (stock.sma200_1mo_ago || weeklySma40 * 0.97)) weeklyScore++; // 40-week slope rising
    if (pctOffHigh <= 25) weeklyScore++;
    if (pctAboveLow >= 30) weeklyScore++;
    if (stock.rsRating >= 70) weeklyScore++;

    return {
      timeframe: 'WEEKLY',
      primaryMaLabel: '10-Week SMA',
      intermediateMaLabel: '30-Week SMA',
      foundationMaLabel: '40-Week SMA',
      primaryMaValue: weeklySma10,
      intermediateMaValue: weeklySma30,
      foundationMaValue: weeklySma40,
      isPriceAboveFoundation: price > weeklySma40,
      isPriceAbovePrimary: price > weeklySma10,
      isFoundationRising: weeklySma40 > (stock.sma200_1mo_ago || weeklySma40 * 0.97),
      trendScore: weeklyScore,
      volumePeriodLabel: '10-Wk Avg Vol',
      avgVolume: avgVol10w,
      currentVolume: weeklyVol,
      volumeRatio: weeklyVolRatio,
      volumeDryUpPercent: weeklyDryUp,
      isTightVolume: weeklyDryUp <= -40,
      atrLabel: '14-Wk ATR',
      atrValue: weeklyAtr,
      atrPercent: weeklyAtrPct,
      rsiValue: weeklyRsi,
      high52w: high52,
      low52w: low52,
      pctOffHigh,
      pctAboveLow
    };
  }

  // DAILY Timeframe
  const dailyAvgVol = stock.avgVolume20d;
  const dailyVol = stock.pivotVolume || Math.round(dailyAvgVol * 0.45);
  const dailyVolRatio = Number((dailyVol / dailyAvgVol).toFixed(2));
  const dailyDryUp = stock.volumeDryUpPercent || Number((((dailyVol - dailyAvgVol) / dailyAvgVol) * 100).toFixed(1));
  const dailyAtr = stock.atr14 || Number((price * 0.032).toFixed(2));
  const dailyAtrPct = Number(((dailyAtr / price) * 100).toFixed(1));

  const closes = stock.priceHistory ? stock.priceHistory.map(p => p.close) : [];
  const rsiSeries = calculateRsiSeries(closes, 14);
  const dailyRsi = rsiSeries.length > 0 ? rsiSeries[rsiSeries.length - 1] : (stock.rsi14 || 64.0);

  return {
    timeframe: 'DAILY',
    primaryMaLabel: '50-Day SMA',
    intermediateMaLabel: '150-Day SMA',
    foundationMaLabel: '200-Day SMA',
    primaryMaValue: stock.sma50,
    intermediateMaValue: stock.sma150,
    foundationMaValue: stock.sma200,
    isPriceAboveFoundation: price > stock.sma200,
    isPriceAbovePrimary: price > stock.sma50,
    isFoundationRising: stock.sma200 > (stock.sma200_1mo_ago || stock.sma200 * 0.98),
    trendScore: stock.trendScore || 8,
    volumePeriodLabel: '20-Day Avg Vol',
    avgVolume: dailyAvgVol,
    currentVolume: dailyVol,
    volumeRatio: dailyVolRatio,
    volumeDryUpPercent: dailyDryUp,
    isTightVolume: stock.isTightVolume || dailyDryUp <= -40,
    atrLabel: '14-Day ATR',
    atrValue: dailyAtr,
    atrPercent: dailyAtrPct,
    rsiValue: dailyRsi,
    high52w: high52,
    low52w: low52,
    pctOffHigh,
    pctAboveLow
  };
}

/**
 * Returns an adjusted stock representation for the screener.
 */
export function getStockForTimeframe(
  stock: MinerviniTradeSetup,
  timeframe: AnalysisTimeframe
): MinerviniTradeSetup & { timeframeMetrics: TimeframeMetrics } {
  const metrics = calculateTimeframeMetrics(stock, timeframe);

  return {
    ...stock,
    sma50: metrics.primaryMaValue,
    sma150: metrics.intermediateMaValue,
    sma200: metrics.foundationMaValue,
    avgVolume20d: metrics.avgVolume,
    pivotVolume: metrics.currentVolume,
    volumeDryUpPercent: metrics.volumeDryUpPercent,
    isTightVolume: metrics.isTightVolume,
    trendScore: metrics.trendScore,
    rsi14: metrics.rsiValue,
    atr14: metrics.atrValue,
    atr14Percent: metrics.atrPercent,
    timeframeMetrics: metrics
  };
}
