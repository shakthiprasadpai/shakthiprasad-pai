import { MinerviniTradeSetup } from '../types';
import { evaluateBearishTrendTemplate, BearishTrendEvaluation } from './bearishSepaCalculator';
import { evaluateTrendTemplate } from './sepaCalculator';

export type MinerviniStage = 
  | 'STAGE_1_ACCUMULATION' 
  | 'STAGE_2_MARKUP' 
  | 'STAGE_3_DISTRIBUTION' 
  | 'STAGE_4_MARKDOWN';

export type AutomaticMarketRegime = 
  | 'CONFIRMED_STAGE_2_BULLISH'
  | 'UPTREND_UNDER_DISTRIBUTION_PRESSURE'
  | 'AUTOMATIC_STAGE_4_BEARISH_MARKDOWN'
  | 'MARKET_BOTTOM_BASE_BUILDING';

export interface StockAutomaticTrend {
  ticker: string;
  name: string;
  exchange: string;
  currentPrice: number;
  stage: MinerviniStage;
  stageLabel: string;
  isAutoBearish: boolean;
  isAutoBullish: boolean;
  bullishTrendScore: number; // 0 - 8
  bearishTrendScore: number; // 0 - 8
  breakdownTriggerPrice: number;
  buyToCoverStopPrice: number;
  coverStopPercent: number;
  riskRating: 'EXTREME_RISK_LONG' | 'HIGH_SHORT_WATCH' | 'HEALTHY_STAGE_2' | 'NEUTRAL';
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  actionNote: string;
  keyViolations: string[];
}

export interface MarketAutomaticTrendSummary {
  regime: AutomaticMarketRegime;
  regimeTitle: string;
  regimeSubtitle: string;
  regimeBadgeColor: string;
  isMarketBearish: boolean;
  bearishDominanceScore: number; // 0 - 100%
  totalStocksEvaluated: number;
  stage4BearishCount: number;
  stage3DistributionCount: number;
  stage2BullishCount: number;
  stage1BaseCount: number;
  below200SmaPercent: number;
  below50SmaPercent: number;
  deathCrossPercent: number; // 150 SMA < 200 SMA
  averageRelativeStrength: number;
  recommendedAllocation: {
    cashPercent: number;
    longExposurePercent: number;
    shortHedgingPercent: number;
    posture: 'FULL OFFENSE' | 'SELECTIVE / TIGHT STOPS' | 'CAPITAL PRESERVATION / DEFENSE' | 'AGGRESSIVE SHORTING / MAX CASH';
  };
  keyMarketWarnings: string[];
}

/**
 * Automatically evaluates whether a single stock is in an Automatic Bearish Trend (Stage 4)
 * or Bullish Trend (Stage 2) using Mark Minervini's canonical moving average and price metrics.
 */
export function classifyStockAutomaticTrend(stock: MinerviniTradeSetup): StockAutomaticTrend {
  const currentPrice = stock.currentPrice;
  const sma50 = stock.sma50;
  const sma150 = stock.sma150;
  const sma200 = stock.sma200;
  const sma200_1mo_ago = stock.sma200_1mo_ago || sma200 * 0.99;
  const high52w = stock.high52w;
  const low52w = stock.low52w;
  const rsRating = stock.rsRating || 50;

  // Evaluate Inverse Bearish 8-Rule Template
  const bearEval: BearishTrendEvaluation = evaluateBearishTrendTemplate({
    currentPrice,
    sma50,
    sma150,
    sma200,
    sma200_1mo_ago,
    high52w,
    low52w,
    rsRating
  });

  // Evaluate Bullish 8-Rule Template
  const bullEval = evaluateTrendTemplate(stock);

  const bullishScore = bullEval.passedCount;
  const bearishScore = bearEval.passedCount;

  // Track critical structural violations
  const keyViolations: string[] = [];
  if (currentPrice < sma200) keyViolations.push('Price < 200 SMA');
  if (sma150 < sma200) keyViolations.push('Death Cross (150 < 200 SMA)');
  if (sma200 < sma200_1mo_ago) keyViolations.push('200 SMA Sloping Down');
  if (currentPrice < sma50) keyViolations.push('Price < 50 SMA');
  if (rsRating <= 40) keyViolations.push(`Weak RS Rating (${rsRating})`);

  let stage: MinerviniStage = 'STAGE_1_ACCUMULATION';
  let stageLabel = 'Stage 1 Consolidation / Neutral';
  let isAutoBearish = false;
  let isAutoBullish = false;
  let riskRating: StockAutomaticTrend['riskRating'] = 'NEUTRAL';
  let badgeBg = 'bg-slate-800';
  let badgeText = 'text-slate-200';
  let badgeBorder = 'border-slate-700';
  let actionNote = 'Sideways base structure. Awaiting clear Stage 2 breakout or Stage 4 breakdown.';

  // Classification Logic strictly adhering to Minervini Stage Analysis:
  if (bearishScore >= 6 || (currentPrice < sma200 && sma50 < sma200 && currentPrice < sma50)) {
    stage = 'STAGE_4_MARKDOWN';
    stageLabel = 'Stage 4 Automatic Bearish Markdown';
    isAutoBearish = true;
    riskRating = 'EXTREME_RISK_LONG';
    badgeBg = 'bg-rose-950/80';
    badgeText = 'text-rose-300';
    badgeBorder = 'border-rose-600/60';
    actionNote = `Automatic Bearish Trend Confirmed (${bearishScore}/8 rules). Severe overhead supply. Prime short or liquidation candidate.`;
  } else if (bearishScore >= 4 || (currentPrice < sma50 && currentPrice < sma150)) {
    stage = 'STAGE_3_DISTRIBUTION';
    stageLabel = 'Stage 3 Institutional Distribution';
    isAutoBearish = true;
    riskRating = 'HIGH_SHORT_WATCH';
    badgeBg = 'bg-amber-950/80';
    badgeText = 'text-amber-300';
    badgeBorder = 'border-amber-600/60';
    actionNote = `Early Bearish Trend Breakdown (${bearishScore}/8 bearish rules). Institutional selling taking control. Avoid new long entries.`;
  } else if (bullishScore >= 6 && currentPrice > sma50 && currentPrice > sma200) {
    stage = 'STAGE_2_MARKUP';
    stageLabel = 'Stage 2 Bullish Continuation';
    isAutoBullish = true;
    riskRating = 'HEALTHY_STAGE_2';
    badgeBg = 'bg-emerald-950/80';
    badgeText = 'text-emerald-300';
    badgeBorder = 'border-emerald-600/60';
    actionNote = `Healthy Stage 2 Uptrend (${bullishScore}/8 bullish rules). Price sustained above moving averages.`;
  } else {
    stage = 'STAGE_1_ACCUMULATION';
    stageLabel = 'Stage 1 Base / Transition';
    riskRating = 'NEUTRAL';
    badgeBg = 'bg-slate-800/80';
    badgeText = 'text-slate-300';
    badgeBorder = 'border-slate-600';
    actionNote = 'Mixed indicators. Price testing moving average convergence zone.';
  }

  // Predefined Short Entry & Stop Loss levels for automatic bearish setup
  const breakdownTriggerPrice = Number((Math.min(stock.currentPrice * 0.985, stock.pivotPrice * 0.95)).toFixed(2));
  const buyToCoverStopPrice = Number((Math.max(stock.currentPrice * 1.05, stock.sma50 * 1.02)).toFixed(2));
  const coverStopPercent = Number((((buyToCoverStopPrice - currentPrice) / currentPrice) * 100).toFixed(1));

  return {
    ticker: stock.ticker,
    name: stock.name,
    exchange: stock.exchange,
    currentPrice,
    stage,
    stageLabel,
    isAutoBearish,
    isAutoBullish,
    bullishTrendScore: bullishScore,
    bearishTrendScore: bearishScore,
    breakdownTriggerPrice,
    buyToCoverStopPrice,
    coverStopPercent,
    riskRating,
    badgeBg,
    badgeText,
    badgeBorder,
    actionNote,
    keyViolations
  };
}

/**
 * Computes market-wide automatic trend regime across the active universe of stocks.
 */
export function calculateMarketAutomaticTrend(stocks: MinerviniTradeSetup[]): MarketAutomaticTrendSummary {
  if (!stocks || stocks.length === 0) {
    return {
      regime: 'CONFIRMED_STAGE_2_BULLISH',
      regimeTitle: 'Confirmed Stage 2 Bullish Uptrend',
      regimeSubtitle: 'Broad market trend aligns with Minervini Stage 2 criteria.',
      regimeBadgeColor: 'bg-emerald-500 text-black',
      isMarketBearish: false,
      bearishDominanceScore: 10,
      totalStocksEvaluated: 0,
      stage4BearishCount: 0,
      stage3DistributionCount: 0,
      stage2BullishCount: 0,
      stage1BaseCount: 0,
      below200SmaPercent: 0,
      below50SmaPercent: 0,
      deathCrossPercent: 0,
      averageRelativeStrength: 75,
      recommendedAllocation: {
        cashPercent: 0,
        longExposurePercent: 100,
        shortHedgingPercent: 0,
        posture: 'FULL OFFENSE'
      },
      keyMarketWarnings: []
    };
  }

  const evaluations = stocks.map((s) => classifyStockAutomaticTrend(s));

  const total = evaluations.length;
  const stage4Count = evaluations.filter((e) => e.stage === 'STAGE_4_MARKDOWN').length;
  const stage3Count = evaluations.filter((e) => e.stage === 'STAGE_3_DISTRIBUTION').length;
  const stage2Count = evaluations.filter((e) => e.stage === 'STAGE_2_MARKUP').length;
  const stage1Count = evaluations.filter((e) => e.stage === 'STAGE_1_ACCUMULATION').length;

  const below200Count = stocks.filter((s) => s.currentPrice < s.sma200).length;
  const below50Count = stocks.filter((s) => s.currentPrice < s.sma50).length;
  const deathCrossCount = stocks.filter((s) => s.sma150 < s.sma200).length;

  const below200SmaPercent = Math.round((below200Count / total) * 100);
  const below50SmaPercent = Math.round((below50Count / total) * 100);
  const deathCrossPercent = Math.round((deathCrossCount / total) * 100);

  const avgRs = Math.round(stocks.reduce((acc, s) => acc + (s.rsRating || 50), 0) / total);

  // Bearish Dominance Score (0 to 100)
  const bearishScoreRaw = (stage4Count * 3 + stage3Count * 1.8 + below200Count * 1.5 + deathCrossCount * 1.2) / (total * 3);
  const bearishDominanceScore = Math.min(100, Math.round(bearishScoreRaw * 100));

  const keyMarketWarnings: string[] = [];
  if (below200SmaPercent >= 40) keyMarketWarnings.push(`${below200SmaPercent}% of stocks trade below their 200-day institutional moving average.`);
  if (deathCrossPercent >= 35) keyMarketWarnings.push(`${deathCrossPercent}% of universe displays an active Death Cross (150MA < 200MA).`);
  if (stage4Count >= Math.ceil(total * 0.3)) keyMarketWarnings.push(`${stage4Count} leaders have crossed into confirmed Stage 4 Markdown.`);

  let regime: AutomaticMarketRegime = 'CONFIRMED_STAGE_2_BULLISH';
  let regimeTitle = 'Confirmed Bullish Uptrend';
  let regimeSubtitle = 'Market conditions favorable for Stage 2 breakouts. Offense mode active.';
  let regimeBadgeColor = 'bg-emerald-500 text-black';
  let isMarketBearish = false;

  let recommendedAllocation: MarketAutomaticTrendSummary['recommendedAllocation'] = {
    cashPercent: 10,
    longExposurePercent: 90,
    shortHedgingPercent: 0,
    posture: 'FULL OFFENSE'
  };

  if (bearishDominanceScore >= 50 || stage4Count >= Math.ceil(total * 0.45) || below200SmaPercent >= 55) {
    regime = 'AUTOMATIC_STAGE_4_BEARISH_MARKDOWN';
    regimeTitle = 'Automatic Bearish Trend (Stage 4 Markdown)';
    regimeSubtitle = 'System detected macro deterioration below 200 SMA. Heavy institutional distribution.';
    regimeBadgeColor = 'bg-rose-600 text-white animate-pulse';
    isMarketBearish = true;
    recommendedAllocation = {
      cashPercent: 75,
      longExposurePercent: 10,
      shortHedgingPercent: 15,
      posture: 'CAPITAL PRESERVATION / DEFENSE'
    };
  } else if (bearishDominanceScore >= 30 || stage3Count + stage4Count >= Math.ceil(total * 0.35)) {
    regime = 'UPTREND_UNDER_DISTRIBUTION_PRESSURE';
    regimeTitle = 'Trend Under Distribution Pressure';
    regimeSubtitle = 'Cracks emerging in growth leaders. Selective setups only with tightened stops.';
    regimeBadgeColor = 'bg-amber-400 text-black';
    isMarketBearish = false;
    recommendedAllocation = {
      cashPercent: 40,
      longExposurePercent: 55,
      shortHedgingPercent: 5,
      posture: 'SELECTIVE / TIGHT STOPS'
    };
  }

  return {
    regime,
    regimeTitle,
    regimeSubtitle,
    regimeBadgeColor,
    isMarketBearish,
    bearishDominanceScore,
    totalStocksEvaluated: total,
    stage4BearishCount: stage4Count,
    stage3DistributionCount: stage3Count,
    stage2BullishCount: stage2Count,
    stage1BaseCount: stage1Count,
    below200SmaPercent,
    below50SmaPercent,
    deathCrossPercent,
    averageRelativeStrength: avgRs,
    recommendedAllocation,
    keyMarketWarnings
  };
}
