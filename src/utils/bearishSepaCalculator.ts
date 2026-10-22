import { MinerviniTradeSetup, PricePoint } from '../types';

export interface BearishTrendTemplateRule {
  id: string;
  ruleNumber: number;
  title: string;
  description: string;
  passed: boolean;
  actualValueStr: string;
  requiredConditionStr: string;
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE';
}

export interface BearishTrendEvaluation {
  rules: BearishTrendTemplateRule[];
  passedCount: number;
  totalCount: number;
  scorePercent: number;
  stageCode: 'STAGE_4_MARKDOWN' | 'STAGE_3_DISTRIBUTION' | 'EARLY_ROLLOVER' | 'RESILIENT_BULLISH';
  convictionLabel: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  actionRecommendation: string;
}

/**
 * Minervini & Stan Weinstein Inverse Bearish Trend Template
 * Evaluates whether a stock meets the 8 cardinal rules of a Stage 4 Downtrend / Short Candidate:
 * 1. Price < 150-day and 200-day SMAs
 * 2. 150-day SMA < 200-day SMA (Active Death Cross)
 * 3. 200-day SMA sloping downward (negative slope over 1 month)
 * 4. 50-day SMA < 150-day and 200-day SMAs (Heavy overhead institutional supply)
 * 5. Price < 50-day SMA (Immediate short-term resistance)
 * 6. Price within 25% of 52-week low (Breakdown territory)
 * 7. Price at least 25% to 50% below 52-week high (Severe structural degradation)
 * 8. Relative Strength (RS) Rating <= 35 (Chronic underperformance / institutional liquidation)
 */
export function evaluateBearishTrendTemplate(setup: {
  currentPrice: number;
  sma50: number;
  sma150: number;
  sma200: number;
  sma200_1mo_ago: number;
  high52w: number;
  low52w: number;
  rsRating: number;
}): BearishTrendEvaluation {
  const {
    currentPrice,
    sma50,
    sma150,
    sma200,
    sma200_1mo_ago,
    high52w,
    low52w,
    rsRating
  } = setup;

  const pctAboveLow52 = low52w > 0 ? ((currentPrice - low52w) / low52w) * 100 : 0;
  const pctFromHigh52 = high52w > 0 ? ((high52w - currentPrice) / high52w) * 100 : 0;
  const sma200SlopePct = sma200_1mo_ago > 0 ? ((sma200 - sma200_1mo_ago) / sma200_1mo_ago) * 100 : 0;

  const rules: BearishTrendTemplateRule[] = [
    {
      id: 'bear_rule_1',
      ruleNumber: 1,
      title: '1. Price Below 150-day & 200-day SMA',
      description: 'Current price trades below both key institutional moving averages (severe overhead resistance).',
      passed: currentPrice < sma150 && currentPrice < sma200,
      actualValueStr: `Price $${currentPrice.toFixed(2)}`,
      requiredConditionStr: `< 150MA ($${sma150.toFixed(2)}) & 200MA ($${sma200.toFixed(2)})`,
      severity: 'CRITICAL'
    },
    {
      id: 'bear_rule_2',
      ruleNumber: 2,
      title: '2. 150-day SMA Below 200-day SMA (Death Cross)',
      description: 'Intermediate 150MA is positioned below long-term 200MA confirming macro institutional distribution.',
      passed: sma150 < sma200,
      actualValueStr: `150MA $${sma150.toFixed(2)}`,
      requiredConditionStr: `< 200MA $${sma200.toFixed(2)} (Death Cross)`,
      severity: 'CRITICAL'
    },
    {
      id: 'bear_rule_3',
      ruleNumber: 3,
      title: '3. 200-day SMA Trending Downward',
      description: '200-day moving average is actively sloping downward over the past 30 days.',
      passed: sma200 < sma200_1mo_ago,
      actualValueStr: `Slope: ${sma200SlopePct >= 0 ? '+' : ''}${sma200SlopePct.toFixed(2)}%/mo`,
      requiredConditionStr: `Current 200MA < 1 Month Ago ($${sma200_1mo_ago.toFixed(2)})`,
      severity: 'HIGH'
    },
    {
      id: 'bear_rule_4',
      ruleNumber: 4,
      title: '4. 50-day SMA Below 150-day & 200-day SMA',
      description: 'Short-term trendline is submerged below all long-term averages. Trapped supply at every tick.',
      passed: sma50 < sma150 && sma50 < sma200,
      actualValueStr: `50MA $${sma50.toFixed(2)}`,
      requiredConditionStr: `< 150MA ($${sma150.toFixed(2)}) & 200MA ($${sma200.toFixed(2)})`,
      severity: 'HIGH'
    },
    {
      id: 'bear_rule_5',
      ruleNumber: 5,
      title: '5. Price Below 50-day SMA',
      description: 'Current price fails to sustain above the 50-day line; rallies into 50MA are consistently sold.',
      passed: currentPrice < sma50,
      actualValueStr: `Price $${currentPrice.toFixed(2)}`,
      requiredConditionStr: `< 50MA $${sma50.toFixed(2)}`,
      severity: 'MODERATE'
    },
    {
      id: 'bear_rule_6',
      ruleNumber: 6,
      title: '6. Price Within 25% of 52-Week Low',
      description: 'Stock is languishing near multi-month lows, susceptible to fresh breakdown selling.',
      passed: pctAboveLow52 <= 25,
      actualValueStr: `+${pctAboveLow52.toFixed(1)}% above 52W Low ($${low52w.toFixed(2)})`,
      requiredConditionStr: `≤ +25% above 52W Low (≤ $${(low52w * 1.25).toFixed(2)})`,
      severity: 'HIGH'
    },
    {
      id: 'bear_rule_7',
      ruleNumber: 7,
      title: '7. Price at Least 25% Below 52-Week High',
      description: 'Substantial drawdown indicates major institutional abandonment rather than routine pullback.',
      passed: pctFromHigh52 >= 25,
      actualValueStr: `-${pctFromHigh52.toFixed(1)}% off 52W High ($${high52w.toFixed(2)})`,
      requiredConditionStr: `≥ 25% below High (≤ $${(high52w * 0.75).toFixed(2)})`,
      severity: 'MODERATE'
    },
    {
      id: 'bear_rule_8',
      ruleNumber: 8,
      title: '8. Relative Strength (RS) Rating ≤ 35',
      description: 'Severe relative weakness; underperforms 65%+ of all stocks. Prime institutional short target.',
      passed: rsRating <= 35,
      actualValueStr: `RS Rating: ${rsRating}`,
      requiredConditionStr: `RS Rating ≤ 35 (Lagger)`,
      severity: 'HIGH'
    }
  ];

  const passedCount = rules.filter(r => r.passed).length;
  const scorePercent = Math.round((passedCount / rules.length) * 100);

  let stageCode: BearishTrendEvaluation['stageCode'] = 'RESILIENT_BULLISH';
  let convictionLabel = 'Bullish / Resilient (Do Not Short)';
  let badgeBg = 'bg-emerald-900/40 text-emerald-300';
  let badgeText = 'text-emerald-300';
  let badgeBorder = 'border-emerald-500/50';
  let actionRecommendation = 'Stock displays bullish momentum or Stage 2 traits. Strictly avoid shorting.';

  if (passedCount >= 7) {
    stageCode = 'STAGE_4_MARKDOWN';
    convictionLabel = 'Confirmed Stage 4 Markdown (Prime Short Setup)';
    badgeBg = 'bg-rose-950 text-rose-300';
    badgeText = 'text-rose-300';
    badgeBorder = 'border-rose-600';
    actionRecommendation = 'Textbook Stage 4 markdown. Ideal for short sale on breakdown of support or failed retest of declining 50MA.';
  } else if (passedCount >= 5) {
    stageCode = 'STAGE_3_DISTRIBUTION';
    convictionLabel = 'Stage 3 Distribution Breakdown (High Short Watch)';
    badgeBg = 'bg-amber-950 text-amber-300';
    badgeText = 'text-amber-300';
    badgeBorder = 'border-amber-600';
    actionRecommendation = 'Institutional distribution pattern. Watch for support floor rupture or death cross rollover to trigger short.';
  } else if (passedCount >= 3) {
    stageCode = 'EARLY_ROLLOVER';
    convictionLabel = 'Early Trend Fatigue / Rollover (Neutral-Bearish)';
    badgeBg = 'bg-slate-800 text-slate-300';
    badgeText = 'text-slate-300';
    badgeBorder = 'border-slate-600';
    actionRecommendation = 'Cracks appearing in trend. Tighten stops on long positions; not yet a high-conviction short.';
  }

  return {
    rules,
    passedCount,
    totalCount: rules.length,
    scorePercent,
    stageCode,
    convictionLabel,
    badgeBg,
    badgeText,
    badgeBorder,
    actionRecommendation
  };
}

export type BearishShortPattern =
  | 'LOW_CHEAT_BREAKDOWN'
  | 'HEAD_AND_SHOULDERS_TOP'
  | 'BEAR_FLAG_BREAKDOWN'
  | 'DEATH_CROSS_ROLLOVER'
  | 'STAGE_4_CAPITULATION'
  | 'FAILED_PULLBACK_REJECTION';

export interface ShortTradePlan {
  stockTicker: string;
  patternType: BearishShortPattern;
  patternLabel: string;
  breakdownTriggerPrice: number; // Short entry point (e.g. support crack)
  sellShortZoneMin: number; // Down to -1.5% below pivot
  buyToCoverStopPrice: number; // Protective stop loss (e.g. +4% to +6% above breakdown)
  coverStopPercent: number; // e.g. +5.2%
  riskAmountPerShare: number;
  downsideTarget1Price: number; // Cover 50% at -15%
  target1Percent: number;
  target1GainPerShare: number;
  downsideTarget2Price: number; // Cover runner at -28%
  target2Percent: number;
  target2GainPerShare: number;
  riskRewardRatio: number; // Downside gain / risk
  shortTactics: string;
}

/**
 * Calculates Minervini Short Trade Execution Levels
 * Rule: Shorting requires quick execution, disciplined buying-to-cover stops (max 4-6%),
 * and scaling out at natural support levels.
 */
export function calculateShortTradePlan(stock: MinerviniTradeSetup): ShortTradePlan {
  const currentPrice = stock.currentPrice;
  // Trigger is either the stock's pivot or recent support low
  const breakdownTriggerPrice = Number((stock.pivotPrice > 0 ? stock.pivotPrice : currentPrice * 0.98).toFixed(2));
  const sellShortZoneMin = Number((breakdownTriggerPrice * 0.985).toFixed(2));

  // Buy-to-Cover Stop: placed 4% to 5.5% above breakdown trigger (above the broken support ceiling)
  const coverStopPercent = 4.8;
  const buyToCoverStopPrice = Number((breakdownTriggerPrice * (1 + coverStopPercent / 100)).toFixed(2));
  const riskAmountPerShare = Number((buyToCoverStopPrice - breakdownTriggerPrice).toFixed(2));

  // Downside Target 1: -16% drop
  const target1Percent = 16.0;
  const downsideTarget1Price = Number((breakdownTriggerPrice * (1 - target1Percent / 100)).toFixed(2));
  const target1GainPerShare = Number((breakdownTriggerPrice - downsideTarget1Price).toFixed(2));

  // Downside Target 2: -28% drop (multi-month capitulation)
  const target2Percent = 28.0;
  const downsideTarget2Price = Number((breakdownTriggerPrice * (1 - target2Percent / 100)).toFixed(2));
  const target2GainPerShare = Number((breakdownTriggerPrice - downsideTarget2Price).toFixed(2));

  const riskRewardRatio = riskAmountPerShare > 0 ? Number((target1GainPerShare / riskAmountPerShare).toFixed(2)) : 3.33;

  let patternType: BearishShortPattern = 'STAGE_4_CAPITULATION';
  let patternLabel = 'Stage 4 Markdown Capitulation';

  if (stock.rsRating < 25 && stock.currentPrice < stock.sma50) {
    patternType = 'LOW_CHEAT_BREAKDOWN';
    patternLabel = 'Low Cheat Breakdown (Roll-over at 50MA)';
  } else if (stock.high52w - stock.currentPrice > stock.currentPrice * 0.4) {
    patternType = 'HEAD_AND_SHOULDERS_TOP';
    patternLabel = 'Head & Shoulders Neckline Rupture';
  } else if (stock.sma50 < stock.sma200) {
    patternType = 'DEATH_CROSS_ROLLOVER';
    patternLabel = 'Death Cross Overhead Trap';
  }

  const shortTactics = `Sell short on breakdown beneath ${breakdownTriggerPrice.toFixed(2)}. Hard cover stop strictly at ${buyToCoverStopPrice.toFixed(2)} (+${coverStopPercent}% max loss). Cover 50% position at Target 1 (${downsideTarget1Price.toFixed(2)}) and lower stop to breakeven.`;

  return {
    stockTicker: stock.ticker,
    patternType,
    patternLabel,
    breakdownTriggerPrice,
    sellShortZoneMin,
    buyToCoverStopPrice,
    coverStopPercent,
    riskAmountPerShare,
    downsideTarget1Price,
    target1Percent,
    target1GainPerShare,
    downsideTarget2Price,
    target2Percent,
    target2GainPerShare,
    riskRewardRatio,
    shortTactics
  };
}

export interface ShortPositionSizingResult {
  accountCapital: number;
  riskPercent: number;
  maxCapitalRiskDollars: number;
  sharesToShort: number;
  totalShortExposureDollars: number;
  portfolioAllocationPercent: number;
  potentialGainTarget1: number;
  potentialGainTarget2: number;
}

export function calculateShortPositionSize(
  accountCapital: number,
  riskPercent: number,
  breakdownTriggerPrice: number,
  buyToCoverStopPrice: number,
  downsideTarget1Price: number,
  downsideTarget2Price: number
): ShortPositionSizingResult {
  const riskAmountPerShare = Math.max(0.01, buyToCoverStopPrice - breakdownTriggerPrice);
  const maxCapitalRiskDollars = Number(((accountCapital * riskPercent) / 100).toFixed(2));
  
  // Calculate shares based on risk formula: Max Shares = (Account Capital * Risk%) / (Cover Stop - Entry)
  const rawShares = Math.floor(maxCapitalRiskDollars / riskAmountPerShare);
  // Cap at 25% max position sizing for risk defense
  const maxSharesByPortfolioCap = Math.floor((accountCapital * 0.25) / (breakdownTriggerPrice || 1));
  const sharesToShort = Math.max(1, Math.min(rawShares, maxSharesByPortfolioCap));

  const totalShortExposureDollars = Number((sharesToShort * breakdownTriggerPrice).toFixed(2));
  const portfolioAllocationPercent = Number(((totalShortExposureDollars / (accountCapital || 1)) * 100).toFixed(1));

  const potentialGainTarget1 = Number((sharesToShort * (breakdownTriggerPrice - downsideTarget1Price)).toFixed(2));
  const potentialGainTarget2 = Number((sharesToShort * (breakdownTriggerPrice - downsideTarget2Price)).toFixed(2));

  return {
    accountCapital,
    riskPercent,
    maxCapitalRiskDollars,
    sharesToShort,
    totalShortExposureDollars,
    portfolioAllocationPercent,
    potentialGainTarget1,
    potentialGainTarget2
  };
}

export interface MarketDistributionMetrics {
  regime: 'CONFIRMED_UPTREND' | 'UPTREND_UNDER_PRESSURE' | 'DISTRIBUTION_CLUSTER' | 'MARKET_IN_CORRECTION';
  regimeLabel: string;
  regimeColor: string;
  distributionDaysCount: number; // e.g., 5 distribution days in past 20 trading sessions
  recommendedCashPercent: number; // e.g., 75%–100% Cash in Bear Market
  postureAdvice: string;
  stocksBelow200SmaPct: number; // e.g., 68% of universe below 200MA
  downsideVolumeRatio: number; // e.g., 2.4x institutional down-volume
  marketBreadthSignal: 'HEALTHY' | 'DETERIORATING' | 'SEVERELY_DAMAGED';
}

export function getMarketDistributionStatus(benchmarkDistributionDays: number = 5): MarketDistributionMetrics {
  if (benchmarkDistributionDays >= 6) {
    return {
      regime: 'MARKET_IN_CORRECTION',
      regimeLabel: 'Stage 4 Bear Market / Severe Correction',
      regimeColor: 'bg-rose-600 text-white',
      distributionDaysCount: benchmarkDistributionDays,
      recommendedCashPercent: 85,
      postureAdvice: 'Capital Preservation Alert: Cash is a king position. Avoid long breakouts. Execute selective Stage 4 short setups with tight stops.',
      stocksBelow200SmaPct: 74.2,
      downsideVolumeRatio: 3.1,
      marketBreadthSignal: 'SEVERELY_DAMAGED'
    };
  } else if (benchmarkDistributionDays >= 4) {
    return {
      regime: 'DISTRIBUTION_CLUSTER',
      regimeLabel: 'Distribution Day Cluster (Institutional Selling)',
      regimeColor: 'bg-amber-600 text-white',
      distributionDaysCount: benchmarkDistributionDays,
      recommendedCashPercent: 65,
      postureAdvice: 'Elevated Institutional Selling: Raise stop losses on existing longs. Reduce position sizing. Screen for vulnerable distribution leaders.',
      stocksBelow200SmaPct: 56.4,
      downsideVolumeRatio: 2.1,
      marketBreadthSignal: 'DETERIORATING'
    };
  } else if (benchmarkDistributionDays >= 2) {
    return {
      regime: 'UPTREND_UNDER_PRESSURE',
      regimeLabel: 'Uptrend Under Pressure (Early Caution)',
      regimeColor: 'bg-amber-500 text-black',
      distributionDaysCount: benchmarkDistributionDays,
      recommendedCashPercent: 35,
      postureAdvice: 'Early institutional profit-taking. Require stricter VCP volume dry-ups on long setups. Keep short watchlist primed.',
      stocksBelow200SmaPct: 38.0,
      downsideVolumeRatio: 1.3,
      marketBreadthSignal: 'DETERIORATING'
    };
  } else {
    return {
      regime: 'CONFIRMED_UPTREND',
      regimeLabel: 'Confirmed Uptrend (Stage 2 Green Light)',
      regimeColor: 'bg-emerald-600 text-white',
      distributionDaysCount: benchmarkDistributionDays,
      recommendedCashPercent: 10,
      postureAdvice: 'Green light for Stage 2 breakouts. Low distribution count. Prioritize Tier-1 market leaders.',
      stocksBelow200SmaPct: 22.5,
      downsideVolumeRatio: 0.7,
      marketBreadthSignal: 'HEALTHY'
    };
  }
}

/**
 * Realistic Mock Stage 3 / Stage 4 Breakdown Stocks for testing Bearish Market analysis
 */
export const MOCK_BEARISH_STOCKS: MinerviniTradeSetup[] = [
  {
    ticker: 'PAYTM',
    name: 'One97 Communications Ltd',
    exchange: 'NSE',
    sector: 'Financial Technology',
    industry: 'Digital Payments & Wallets',
    currentPrice: 382.40,
    changePercent: -3.85,
    sma50: 412.50,
    sma150: 485.00,
    sma200: 540.20,
    sma200_1mo_ago: 562.00,
    high52w: 998.30,
    low52w: 310.00,
    rsRating: 18,
    patternType: 'Pivot Pullback',
    vcpStage: 'T2',
    trendScore: 0,
    avgVolume20d: 9800000,
    pivotVolume: 12400000,
    volumeDryUpPercent: 26.5,
    isTightVolume: false,
    pivotPrice: 395.00,
    buyZoneMax: 402.90,
    stopLossPrice: 418.00,
    stopLossPercent: 5.8,
    target1Price: 320.00,
    target1Percent: -18.9,
    target2Price: 260.00,
    target2Percent: -34.1,
    riskRewardRatio: 3.25,
    contractions: [
      { contractionIndex: 1, depthPercent: 32.0, durationDays: 35, volumeDryUpPercent: 15, startDate: '2026-04-01', endDate: '2026-05-15', highPrice: 520, lowPrice: 350 }
    ],
    priceHistory: generateBearishPriceHistory(540, 382, -30),
    sepaNotes: 'Confirmed Stage 4 Markdown. Heavy institutional dumping post-regulatory scrutiny. Consecutive lower highs below declining 50MA and 200MA. Fails all 8 Bullish rules, passes all 8 Bearish Breakdown rules.',
    salesGrowth3Y: -12.4,
    roePercent: -18.6
  },
  {
    ticker: 'ZEEL',
    name: 'Zee Entertainment Enterprises',
    exchange: 'NSE',
    sector: 'Media & Entertainment',
    industry: 'Broadcasting & Cable TV',
    currentPrice: 124.60,
    changePercent: -2.40,
    sma50: 138.20,
    sma150: 165.40,
    sma200: 192.00,
    sma200_1mo_ago: 204.00,
    high52w: 299.70,
    low52w: 118.00,
    rsRating: 22,
    patternType: 'Pivot Pullback',
    vcpStage: 'T2',
    trendScore: 1,
    avgVolume20d: 14200000,
    pivotVolume: 16500000,
    volumeDryUpPercent: 16.2,
    isTightVolume: false,
    pivotPrice: 128.00,
    buyZoneMax: 130.56,
    stopLossPrice: 135.00,
    stopLossPercent: 5.4,
    target1Price: 105.00,
    target1Percent: -17.9,
    target2Price: 85.00,
    target2Percent: -33.5,
    riskRewardRatio: 3.3,
    contractions: [
      { contractionIndex: 1, depthPercent: 28.0, durationDays: 28, volumeDryUpPercent: 20, startDate: '2026-04-10', endDate: '2026-05-20', highPrice: 175, lowPrice: 126 }
    ],
    priceHistory: generateBearishPriceHistory(200, 124.6, -38),
    sepaNotes: 'Stage 4 capitulation following failed corporate restructuring. Stock in multi-month freefall with active Death Cross (150MA < 200MA). High distribution volume.',
    salesGrowth3Y: -5.2,
    roePercent: 3.1
  },
  {
    ticker: 'IDEA',
    name: 'Vodafone Idea Ltd',
    exchange: 'NSE',
    sector: 'Communication Services',
    industry: 'Telecom Infrastructure',
    currentPrice: 7.45,
    changePercent: -4.10,
    sma50: 8.80,
    sma150: 10.50,
    sma200: 12.10,
    sma200_1mo_ago: 12.80,
    high52w: 19.10,
    low52w: 6.90,
    rsRating: 15,
    patternType: 'Pivot Pullback',
    vcpStage: 'T2',
    trendScore: 0,
    avgVolume20d: 45000000,
    pivotVolume: 52000000,
    volumeDryUpPercent: 15.5,
    isTightVolume: false,
    pivotPrice: 7.80,
    buyZoneMax: 7.95,
    stopLossPrice: 8.25,
    stopLossPercent: 5.7,
    target1Price: 6.10,
    target1Percent: -21.8,
    target2Price: 4.80,
    target2Percent: -38.5,
    riskRewardRatio: 3.8,
    contractions: [
      { contractionIndex: 1, depthPercent: 35.0, durationDays: 45, volumeDryUpPercent: 18, startDate: '2026-03-15', endDate: '2026-05-10', highPrice: 13, lowPrice: 8.4 }
    ],
    priceHistory: generateBearishPriceHistory(12.5, 7.45, -40),
    sepaNotes: 'Chronic Stage 4 lagger. Extreme dilution and debt overhang. Fails every technical and fundamental test. Severe institutional liquidation.',
    salesGrowth3Y: -1.8,
    roePercent: -42.0
  },
  {
    ticker: 'YESBANK',
    name: 'Yes Bank Ltd',
    exchange: 'NSE',
    sector: 'Financial Services',
    industry: 'Private Commercial Banks',
    currentPrice: 18.20,
    changePercent: -1.85,
    sma50: 20.40,
    sma150: 22.80,
    sma200: 24.10,
    sma200_1mo_ago: 24.90,
    high52w: 32.80,
    low52w: 16.50,
    rsRating: 24,
    patternType: 'Pivot Pullback',
    vcpStage: 'T2',
    trendScore: 1,
    avgVolume20d: 85000000,
    pivotVolume: 92000000,
    volumeDryUpPercent: 8.2,
    isTightVolume: false,
    pivotPrice: 18.90,
    buyZoneMax: 19.28,
    stopLossPrice: 19.90,
    stopLossPercent: 5.3,
    target1Price: 15.20,
    target1Percent: -19.5,
    target2Price: 12.80,
    target2Percent: -32.3,
    riskRewardRatio: 3.7,
    contractions: [
      { contractionIndex: 1, depthPercent: 24.0, durationDays: 30, volumeDryUpPercent: 12, startDate: '2026-04-01', endDate: '2026-05-01', highPrice: 24, lowPrice: 18.2 }
    ],
    priceHistory: generateBearishPriceHistory(24.5, 18.2, -26),
    sepaNotes: 'Stage 3 top turned Stage 4 breakdown. Massive overhead trapped float prevents sustainable rallies. High volume selling at 50MA resistance.',
    salesGrowth3Y: 8.4,
    roePercent: 3.8
  },
  {
    ticker: 'RIVN',
    name: 'Rivian Automotive Inc',
    exchange: 'NASDAQ',
    sector: 'Consumer Discretionary',
    industry: 'Electric Vehicles',
    currentPrice: 10.45,
    changePercent: -4.80,
    sma50: 12.10,
    sma150: 13.90,
    sma200: 15.80,
    sma200_1mo_ago: 16.90,
    high52w: 24.60,
    low52w: 8.25,
    rsRating: 21,
    patternType: 'Pivot Pullback',
    vcpStage: 'T2',
    trendScore: 0,
    avgVolume20d: 28000000,
    pivotVolume: 34000000,
    volumeDryUpPercent: 21.4,
    isTightVolume: false,
    pivotPrice: 11.20,
    buyZoneMax: 11.42,
    stopLossPrice: 11.85,
    stopLossPercent: 5.8,
    target1Price: 8.90,
    target1Percent: -20.5,
    target2Price: 7.10,
    target2Percent: -36.6,
    riskRewardRatio: 3.5,
    contractions: [
      { contractionIndex: 1, depthPercent: 30.0, durationDays: 32, volumeDryUpPercent: 14, startDate: '2026-04-01', endDate: '2026-05-15', highPrice: 16.5, lowPrice: 11.5 }
    ],
    priceHistory: generateBearishPriceHistory(16.5, 10.45, -37),
    sepaNotes: 'Severe cash burn and margin pressure. Price collapsed through key horizontal support at $11.00. 200MA trending steeply downward.',
    salesGrowth3Y: 28.0,
    roePercent: -45.0
  },
  {
    ticker: 'PTON',
    name: 'Peloton Interactive Inc',
    exchange: 'NASDAQ',
    sector: 'Consumer Discretionary',
    industry: 'Fitness Equipment & Apps',
    currentPrice: 3.25,
    changePercent: -3.55,
    sma50: 3.85,
    sma150: 4.40,
    sma200: 5.20,
    sma200_1mo_ago: 5.65,
    high52w: 9.80,
    low52w: 2.70,
    rsRating: 19,
    patternType: 'Pivot Pullback',
    vcpStage: 'T2',
    trendScore: 0,
    avgVolume20d: 12000000,
    pivotVolume: 14500000,
    volumeDryUpPercent: 20.8,
    isTightVolume: false,
    pivotPrice: 3.50,
    buyZoneMax: 3.57,
    stopLossPrice: 3.72,
    stopLossPercent: 6.2,
    target1Price: 2.75,
    target1Percent: -21.4,
    target2Price: 2.10,
    target2Percent: -40.0,
    riskRewardRatio: 3.4,
    contractions: [
      { contractionIndex: 1, depthPercent: 25.0, durationDays: 20, volumeDryUpPercent: 10, startDate: '2026-04-10', endDate: '2026-05-10', highPrice: 4.8, lowPrice: 3.6 }
    ],
    priceHistory: generateBearishPriceHistory(5.4, 3.25, -40),
    sepaNotes: 'Multi-year post-bubble Stage 4 markdown channel. Declining subscriber base. Every rally into 50MA is sold aggressively by institutional holders.',
    salesGrowth3Y: -15.0,
    roePercent: -38.0
  }
];

function generateBearishPriceHistory(startPrice: number, endPrice: number, pctChange: number): PricePoint[] {
  const points: PricePoint[] = [];
  const days = 60;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  let p = startPrice;
  const baseVol = 5000000;

  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);

    // Persistent downward drift with occasional failed bull-traps
    const isBullTrap = i % 12 === 0;
    const dailyDrift = isBullTrap ? 0.025 : -0.012 + (Math.random() - 0.5) * 0.02;
    p = Math.max(endPrice * 0.85, p * (1 + dailyDrift));

    // High volume on down days, lower volume on dead-cat bounces
    const isDownDay = dailyDrift < 0;
    const vol = isDownDay ? baseVol * (1.3 + Math.random() * 0.9) : baseVol * (0.6 + Math.random() * 0.4);

    points.push({
      date: d.toISOString().split('T')[0],
      open: Number((p * 1.01).toFixed(2)),
      high: Number((p * 1.025).toFixed(2)),
      low: Number((p * 0.985).toFixed(2)),
      close: Number(p.toFixed(2)),
      volume: Math.round(vol),
      avgVolume20: baseVol,
      sma50: Number((p * 1.12).toFixed(2)),
      sma150: Number((p * 1.25).toFixed(2)),
      sma200: Number((p * 1.35).toFixed(2)),
      isTightVolume: false
    });
  }

  // Ensure last candle matches endPrice
  if (points.length > 0) {
    points[points.length - 1].close = endPrice;
  }

  return points;
}
