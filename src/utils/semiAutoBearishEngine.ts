import { MinerviniTradeSetup } from '../types';
import { evaluateBearishTrendTemplate } from './bearishSepaCalculator';
import { classifyStockAutomaticTrend } from './automaticTrendClassifier';

export type SemiAutoStatus = 
  | 'AUTO_DETECTED'    // Detected by algorithm, awaiting trader review
  | 'ARMED_WATCH'      // Trader approved & armed alert on breakdown trigger
  | 'STAGED_ORDER'     // Trader approved and staged into execution queue
  | 'DISQUALIFIED'     // Trader dismissed (e.g. false breakdown / near earnings)
  | 'EXECUTED';        // Trade triggered and active

export interface SemiAutoBearishSetup {
  id: string;
  ticker: string;
  name: string;
  exchange: string;
  currency: string;
  currentPrice: number;
  status: SemiAutoStatus;
  
  // Algorithmic Detection Metrics
  bearishRulesPassed: number;
  stageCode: 'STAGE_4_MARKDOWN' | 'STAGE_3_DISTRIBUTION' | 'EARLY_ROLLOVER';
  detectionTimestamp: string;
  distanceToBreakdownPct: number; // e.g. -1.2% (close to breakdown floor)
  volumeDistributionRatio: number; // e.g. 1.65x average volume
  
  // Staged Order Execution Parameters (Trader Editable)
  breakdownTriggerPrice: number;
  buyToCoverStopPrice: number;
  coverStopPercent: number;
  target1Price: number; // -12% to -15%
  target2Price: number; // -20% to -28%
  riskRewardRatio: number;
  
  // Risk Sizing
  accountCapital: number;
  riskPercent: number; // 1.0% default
  calculatedShares: number;
  positionValue: number;
  
  // Rationale & Evidence
  catalysts: string[];
  traderNotes?: string;
  isUserOverridden: boolean;
}

const STORAGE_KEY = 'minervini_semi_auto_bearish_v1';

/**
 * Reads trader-stored semi-automatic bearish setups from localStorage.
 */
export function getStoredSemiAutoSetups(): Record<string, Partial<SemiAutoBearishSetup>> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to read semi-auto setups from localStorage', e);
    return {};
  }
}

/**
 * Saves or updates a semi-automatic bearish setup state.
 */
export function saveSemiAutoSetupState(ticker: string, updates: Partial<SemiAutoBearishSetup>) {
  try {
    const existing = getStoredSemiAutoSetups();
    existing[ticker] = {
      ...(existing[ticker] || {}),
      ...updates
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    window.dispatchEvent(new CustomEvent('minervini_semi_auto_updated', { detail: { ticker, updates } }));
  } catch (e) {
    console.error('Failed to save semi-auto setup', e);
  }
}

/**
 * Automatically evaluates candidate stocks using Minervini's Bearish Trend Template
 * and produces a list of actionable Semi-Automatic setups for trader review.
 */
export function generateSemiAutoBearishCandidates(
  stocks: MinerviniTradeSetup[],
  accountCapital: number = 100000,
  defaultRiskPct: number = 1.0
): SemiAutoBearishSetup[] {
  const stored = getStoredSemiAutoSetups();
  const setups: SemiAutoBearishSetup[] = [];

  stocks.forEach((stock) => {
    const autoTrend = classifyStockAutomaticTrend(stock);

    // Only process stocks showing Bearish Trend / Stage 4 / Stage 3 characteristics
    if (!autoTrend.isAutoBearish && autoTrend.bearishTrendScore < 4) {
      return;
    }

    const currentPrice = stock.currentPrice;
    const currency = stock.exchange === 'NSE' || stock.exchange === 'BSE' ? '₹' : '$';

    // 1. Calculate Breakdown Trigger (e.g. 20-day support floor undercut or pivot -2.5%)
    const defaultTrigger = Number((Math.min(currentPrice * 0.985, stock.pivotPrice * 0.96)).toFixed(2));
    
    // 2. Calculate 2x ATR Protective Cover Stop (or 5.5% above breakdown)
    const atr = stock.atr14 || currentPrice * 0.035;
    const defaultStop = Number((Math.max(currentPrice * 1.055, currentPrice + 2 * atr)).toFixed(2));
    const coverStopPct = Number((((defaultStop - defaultTrigger) / defaultTrigger) * 100).toFixed(1));

    // 3. Downside Targets (2R and 3.5R downside)
    const riskPerShare = defaultStop - defaultTrigger;
    const defaultTarget1 = Number((Math.max(1, defaultTrigger - 2 * riskPerShare)).toFixed(2));
    const defaultTarget2 = Number((Math.max(1, defaultTrigger - 3.5 * riskPerShare)).toFixed(2));
    const rrr = riskPerShare > 0 ? Number(((defaultTrigger - defaultTarget1) / riskPerShare).toFixed(2)) : 2.5;

    // 4. Position Sizing
    const riskDollars = accountCapital * (defaultRiskPct / 100);
    const shares = riskPerShare > 0 ? Math.max(1, Math.floor(riskDollars / riskPerShare)) : 10;
    const posVal = Number((shares * defaultTrigger).toFixed(2));

    const distanceToBreakdown = Number((((currentPrice - defaultTrigger) / currentPrice) * 100).toFixed(1));

    // Catalysts / Evidence Checklist
    const catalysts: string[] = [];
    if (stock.currentPrice < stock.sma200) catalysts.push('Price trading below 200-day institutional MA');
    if (stock.sma150 < stock.sma200) catalysts.push('Active Death Cross (150MA submerged below 200MA)');
    if (stock.sma200 < (stock.sma200_1mo_ago || stock.sma200)) catalysts.push('Declining 200MA slope for > 30 days');
    if (stock.currentPrice < stock.sma50) catalysts.push('Price rejected below 50-day short-term MA');
    if (stock.rsRating <= 35) catalysts.push(`Chronic institutional underperformance (RS ${stock.rsRating})`);
    if (stock.pivotVolume && stock.avgVolume20d && stock.pivotVolume > stock.avgVolume20d * 1.3) {
      catalysts.push('Heavy distribution volume expansion on down-thrust');
    }

    const savedState = stored[stock.ticker] || {};

    const setup: SemiAutoBearishSetup = {
      id: `semi-auto-${stock.ticker}`,
      ticker: stock.ticker,
      name: stock.name,
      exchange: stock.exchange,
      currency,
      currentPrice,
      status: savedState.status || (distanceToBreakdown <= 1.5 ? 'ARMED_WATCH' : 'AUTO_DETECTED'),
      bearishRulesPassed: autoTrend.bearishTrendScore,
      stageCode: autoTrend.stage === 'STAGE_4_MARKDOWN' ? 'STAGE_4_MARKDOWN' : 'STAGE_3_DISTRIBUTION',
      detectionTimestamp: savedState.detectionTimestamp || 'Live Auto Scan',
      distanceToBreakdownPct: distanceToBreakdown,
      volumeDistributionRatio: stock.pivotVolume && stock.avgVolume20d ? Number((stock.pivotVolume / stock.avgVolume20d).toFixed(2)) : 1.45,
      breakdownTriggerPrice: savedState.breakdownTriggerPrice || defaultTrigger,
      buyToCoverStopPrice: savedState.buyToCoverStopPrice || defaultStop,
      coverStopPercent: savedState.coverStopPercent || coverStopPct,
      target1Price: savedState.target1Price || defaultTarget1,
      target2Price: savedState.target2Price || defaultTarget2,
      riskRewardRatio: savedState.riskRewardRatio || rrr,
      accountCapital,
      riskPercent: savedState.riskPercent || defaultRiskPct,
      calculatedShares: savedState.calculatedShares || shares,
      positionValue: savedState.positionValue || posVal,
      catalysts,
      traderNotes: savedState.traderNotes,
      isUserOverridden: savedState.isUserOverridden || false
    };

    setups.push(setup);
  });

  // Sort: Armed first, then by closest distance to breakdown trigger
  return setups.sort((a, b) => {
    if (a.status === 'ARMED_WATCH' && b.status !== 'ARMED_WATCH') return -1;
    if (b.status === 'ARMED_WATCH' && a.status !== 'ARMED_WATCH') return 1;
    return a.distanceToBreakdownPct - b.distanceToBreakdownPct;
  });
}
