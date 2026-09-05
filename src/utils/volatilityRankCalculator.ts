import { MinerviniTradeSetup } from '../types';

export type VolatilityTier = 'LOW_VOL' | 'MODERATE_VOL' | 'HIGH_VOL' | 'EXTREME_VOL';

export interface VolatilityRankData {
  stockHvAnnualized: number; // e.g. 26.4%
  marketHvAnnualized: number; // e.g. 14.8% for Nifty, 15.5% for SPY
  marketBenchmark: 'NIFTY 50' | 'S&P 500 (SPY)';
  relativeVolatilityRatio: number; // Stock HV / Market HV (e.g. 1.78x)
  volatilityRank: number; // 1 to 99 relative to broader market index & peer distribution
  volatilityTier: VolatilityTier;
  tierLabel: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  description: string;
}

/**
 * Baseline annualized historical volatility for broader market benchmarks
 */
export const MARKET_INDEX_VOLATILITY: Record<'NSE_BSE' | 'US', { name: 'NIFTY 50' | 'S&P 500 (SPY)'; hvAnnualized: number }> = {
  NSE_BSE: {
    name: 'NIFTY 50',
    hvAnnualized: 14.8, // 14.8% 20-day annualized historical volatility
  },
  US: {
    name: 'S&P 500 (SPY)',
    hvAnnualized: 15.5, // 15.5% 20-day annualized historical volatility
  },
};

/**
 * Calculates raw annualized historical volatility for a single stock
 */
export function calculateStockAnnualizedHv(stock: MinerviniTradeSetup): number {
  const history = stock.priceHistory || [];

  if (history.length >= 5) {
    const lookback = Math.min(history.length, 30);
    const recentPrices = history.slice(history.length - lookback);
    const returns: number[] = [];

    for (let i = 1; i < recentPrices.length; i++) {
      const prevClose = recentPrices[i - 1].close;
      const currClose = recentPrices[i].close;
      if (prevClose > 0 && currClose > 0) {
        returns.push(Math.log(currClose / prevClose));
      }
    }

    if (returns.length >= 4) {
      const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
      const dailyStdDev = Math.sqrt(variance);
      const annualized = dailyStdDev * Math.sqrt(252) * 100;
      if (!isNaN(annualized) && annualized > 0) {
        return Number(annualized.toFixed(2));
      }
    }
  }

  // Fallback if price history has few bars: derive from ATR% and dry-up metrics
  const atrPct = stock.atr14Percent || (stock.currentPrice > 0 ? (stock.atr14 / stock.currentPrice) * 100 : 3.0);
  const fallbackHv = atrPct * Math.sqrt(252) * 0.62;
  return Number(Math.max(8.0, Math.min(85.0, fallbackHv)).toFixed(2));
}

/**
 * Maps a relative volatility ratio (Stock HV / Market HV) into a calibrated 1-99 Volatility Rank
 */
export function mapRelativeVolToRank(ratio: number): number {
  // Calibrated sigmoid curve centered around ratio 1.45 (typical growth stock vs broad market)
  // Ratio <= 0.60 -> Rank 1-15
  // Ratio 1.00 -> Rank ~35-40 (market parity)
  // Ratio 1.50 -> Rank ~65
  // Ratio 2.00 -> Rank ~82
  // Ratio 2.60+ -> Rank 95-99
  const clampedRatio = Math.max(0.3, Math.min(4.0, ratio));
  // Use log ratio mapping for financial returns
  const z = (Math.log(clampedRatio) - Math.log(1.35)) / 0.52;
  const normalCdf = 1 / (1 + Math.exp(-1.702 * z));
  const rank = Math.round(1 + normalCdf * 98);
  return Math.max(1, Math.min(99, rank));
}

/**
 * Calculates a stock's historical volatility relative to the broader market index
 */
export function calculateStockVolatilityRank(
  stock: MinerviniTradeSetup,
  peerRatios?: number[]
): VolatilityRankData {
  const isIndia = stock.exchange === 'NSE' || stock.exchange === 'BSE';
  const marketInfo = isIndia ? MARKET_INDEX_VOLATILITY.NSE_BSE : MARKET_INDEX_VOLATILITY.US;
  
  const stockHv = calculateStockAnnualizedHv(stock);
  const marketHv = marketInfo.hvAnnualized;
  const relativeRatio = Number((stockHv / marketHv).toFixed(2));

  let volatilityRank: number;

  if (peerRatios && peerRatios.length > 3) {
    // Percentile rank within peer universe
    const countBelow = peerRatios.filter((r) => r < relativeRatio).length;
    const peerPercentile = Math.round(1 + (countBelow / (peerRatios.length - 1)) * 98);
    // Blend peer percentile (65%) with calibrated market ratio curve (35%)
    const curveRank = mapRelativeVolToRank(relativeRatio);
    volatilityRank = Math.round(peerPercentile * 0.65 + curveRank * 0.35);
  } else {
    volatilityRank = mapRelativeVolToRank(relativeRatio);
  }

  volatilityRank = Math.max(1, Math.min(99, volatilityRank));

  // Determine Volatility Tier
  let volatilityTier: VolatilityTier = 'MODERATE_VOL';
  let tierLabel = 'Moderate Volatility (1.0x-1.6x Mkt)';
  let badgeBg = 'bg-blue-50';
  let badgeText = 'text-blue-800';
  let badgeBorder = 'border-blue-300';
  let description = `Moving in line with ${marketInfo.name} (${relativeRatio}x market volatility). Stable growth profile.`;

  if (volatilityRank <= 35 || relativeRatio < 1.05) {
    volatilityTier = 'LOW_VOL';
    tierLabel = 'Low Volatility / Coiled (<1.0x Mkt)';
    badgeBg = 'bg-emerald-50';
    badgeText = 'text-emerald-800';
    badgeBorder = 'border-emerald-300';
    description = `Calmer than ${marketInfo.name} (${relativeRatio}x market index). Tight consolidation base with low drawdown risk.`;
  } else if (volatilityRank >= 90 || relativeRatio >= 2.40) {
    volatilityTier = 'EXTREME_VOL';
    tierLabel = 'Extreme Volatility (>2.4x Mkt)';
    badgeBg = 'bg-purple-950 text-amber-300';
    badgeText = 'text-amber-300';
    badgeBorder = 'border-purple-600 font-bold';
    description = `Hyper-volatility vs ${marketInfo.name} (${relativeRatio}x market index). Requires tighter risk management & reduced position sizing.`;
  } else if (volatilityRank >= 71 || relativeRatio >= 1.65) {
    volatilityTier = 'HIGH_VOL';
    tierLabel = 'High-Beta Growth (1.6x-2.4x Mkt)';
    badgeBg = 'bg-amber-50';
    badgeText = 'text-amber-900';
    badgeBorder = 'border-amber-300';
    description = `Elevated volatility vs ${marketInfo.name} (${relativeRatio}x market index). Dynamic upside momentum with wider normal swings.`;
  }

  return {
    stockHvAnnualized: stockHv,
    marketHvAnnualized: marketHv,
    marketBenchmark: marketInfo.name,
    relativeVolatilityRatio: relativeRatio,
    volatilityRank,
    volatilityTier,
    tierLabel,
    badgeBg,
    badgeText,
    badgeBorder,
    description,
  };
}

/**
 * Pre-computes volatility metrics for all stocks in the universe for high-performance sorting & filtering
 */
export function buildUniverseVolatilityRankMap(stocks: MinerviniTradeSetup[]): Map<string, VolatilityRankData> {
  const stockHvs = stocks.map((s) => ({
    ticker: s.ticker,
    ratio: Number((calculateStockAnnualizedHv(s) / (s.exchange === 'NSE' || s.exchange === 'BSE' ? 14.8 : 15.5)).toFixed(2)),
  }));

  const allRatios = stockHvs.map((item) => item.ratio);
  const map = new Map<string, VolatilityRankData>();

  stocks.forEach((stock) => {
    map.set(stock.ticker, calculateStockVolatilityRank(stock, allRatios));
  });

  return map;
}
