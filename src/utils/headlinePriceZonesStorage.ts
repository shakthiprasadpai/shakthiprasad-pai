export interface HeadlineProfitTarget {
  id: string;
  label: string;
  price: number;
  percentGain: number;
  catalystRationale?: string;
  associatedHeadlineTitle?: string;
  status: 'ACTIVE' | 'HIT' | 'ADJUSTED';
}

export interface HeadlineStopLoss {
  price: number;
  percentRisk: number;
  riskType: 'HARD_STOP' | 'TRAILING_PIVOT' | 'EARNINGS_LOW' | 'CONSOLIDATION_LOW' | 'CUSTOM';
  invalidationThesis?: string;
  associatedHeadlineTitle?: string;
}

export interface HeadlinePriceZonePlan {
  ticker: string;
  entryPrice: number;
  profitTargets: HeadlineProfitTarget[];
  stopLoss: HeadlineStopLoss;
  notes?: string;
  headlineTags?: Record<string, 'BULLISH_CATALYST' | 'BEARISH_RISK' | 'TARGET_DRIVER' | 'STOP_INVALIDATION' | 'NEUTRAL_NOISE'>;
  updatedAt: string;
}

const STORAGE_PREFIX = 'sepa_headline_price_zones_';

/**
 * Creates default Minervini SEPA Price Zone Plan for a stock based on its current / pivot price
 */
export function getDefaultPriceZonePlan(
  ticker: string,
  currentPrice: number,
  pivotPrice?: number,
  defaultStopLoss?: number
): HeadlinePriceZonePlan {
  const baseEntry = pivotPrice && pivotPrice > 0 ? pivotPrice : currentPrice > 0 ? currentPrice : 100;
  
  // Default Stop Loss: 5% below entry or user's defined stop loss
  const stopPrice = defaultStopLoss && defaultStopLoss > 0 && defaultStopLoss < baseEntry
    ? defaultStopLoss
    : Number((baseEntry * 0.95).toFixed(2));
  
  const stopPercent = Number((((baseEntry - stopPrice) / baseEntry) * 100).toFixed(1));

  // Default Target 1: 20% Minervini standard partial take-profit
  const t1Price = Number((baseEntry * 1.20).toFixed(2));
  
  // Default Target 2: 35% Minervini multi-week runner target
  const t2Price = Number((baseEntry * 1.35).toFixed(2));

  return {
    ticker: ticker.toUpperCase(),
    entryPrice: Number(baseEntry.toFixed(2)),
    profitTargets: [
      {
        id: 'target-1',
        label: 'Target 1 (Base Breakout 20%)',
        price: t1Price,
        percentGain: 20.0,
        catalystRationale: 'Minervini 20-25% standard partial profit taking into initial momentum strength.',
        status: 'ACTIVE',
      },
      {
        id: 'target-2',
        label: 'Target 2 (Catalyst Extension 35%)',
        price: t2Price,
        percentGain: 35.0,
        catalystRationale: 'Institutional accumulation multi-week runner powered by fundamental catalyst beat.',
        status: 'ACTIVE',
      },
    ],
    stopLoss: {
      price: stopPrice,
      percentRisk: stopPercent > 0 ? stopPercent : 5.0,
      riskType: 'HARD_STOP',
      invalidationThesis: 'Loss of pivot support or 5% maximum capital risk containment.',
    },
    notes: 'Price zones derived from recent news headlines and SEPA technical structure.',
    headlineTags: {},
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Loads the saved price zone plan for a ticker from localStorage
 */
export function loadPriceZonePlan(
  ticker: string,
  currentPrice: number,
  pivotPrice?: number,
  defaultStopLoss?: number
): HeadlinePriceZonePlan {
  if (typeof window === 'undefined') {
    return getDefaultPriceZonePlan(ticker, currentPrice, pivotPrice, defaultStopLoss);
  }

  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${ticker.toUpperCase()}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.ticker === ticker.toUpperCase() && Array.isArray(parsed.profitTargets)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error(`Error loading price zone plan for ${ticker}:`, err);
  }

  return getDefaultPriceZonePlan(ticker, currentPrice, pivotPrice, defaultStopLoss);
}

/**
 * Saves a price zone plan to localStorage
 */
export function savePriceZonePlan(plan: HeadlinePriceZonePlan): void {
  if (typeof window === 'undefined') return;
  try {
    const sanitized: HeadlinePriceZonePlan = {
      ...plan,
      ticker: plan.ticker.toUpperCase(),
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(`${STORAGE_PREFIX}${plan.ticker.toUpperCase()}`, JSON.stringify(sanitized));
    
    // Dispatch custom event so other components (e.g. alerts or portfolio) can react
    window.dispatchEvent(new CustomEvent('sepa_headline_price_zones_updated', {
      detail: { ticker: plan.ticker.toUpperCase(), plan: sanitized }
    }));
  } catch (err) {
    console.error(`Error saving price zone plan for ${plan.ticker}:`, err);
  }
}

/**
 * Calculates Reward-to-Risk ratio for a given target and stop loss
 */
export function calculateRewardToRisk(
  entryPrice: number,
  targetPrice: number,
  stopPrice: number
): { ratio: number; rewardDollar: number; riskDollar: number; isValidSEPA: boolean } {
  if (entryPrice <= 0 || targetPrice <= entryPrice || stopPrice >= entryPrice) {
    return { ratio: 0, rewardDollar: 0, riskDollar: 0, isValidSEPA: false };
  }

  const rewardDollar = targetPrice - entryPrice;
  const riskDollar = entryPrice - stopPrice;
  const ratio = riskDollar > 0 ? Number((rewardDollar / riskDollar).toFixed(2)) : 0;

  // Minervini Rule: Must offer at least 2.5:1 or 3:1 Reward-to-Risk ratio
  const isValidSEPA = ratio >= 2.5;

  return { ratio, rewardDollar, riskDollar, isValidSEPA };
}
