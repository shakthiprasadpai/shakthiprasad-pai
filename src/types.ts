export interface PricePoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  avgVolume20: number;
  sma50: number;
  sma150: number;
  sma200: number;
  isTightVolume?: boolean;
}

export interface VcpContraction {
  contractionIndex: number; // 1, 2, 3, 4 (e.g., T1, T2, T3)
  depthPercent: number; // e.g. -22.5, -9.8, -3.1
  durationDays: number; // e.g. 18, 10, 4
  volumeDryUpPercent: number; // e.g. -65% vs 20-day avg
  startDate: string;
  endDate: string;
  highPrice: number;
  lowPrice: number;
}

export interface TrendTemplateRule {
  id: string;
  title: string;
  description: string;
  passed: boolean;
  actualValueStr: string;
  requiredConditionStr: string;
}

export interface CustomTrendline {
  id: string;
  type: 'SUPPORT' | 'RESISTANCE' | 'TRENDLINE' | 'CUSTOM';
  label: string;
  startDate: string;
  startPrice: number;
  endDate: string;
  endPrice: number;
  color: string;
  lineWidth?: number;
  isDashed?: boolean;
  notes?: string;
  createdAt?: string;
}

export interface MinerviniTradeSetup {
  ticker: string;
  name: string;
  exchange: 'NASDAQ' | 'NYSE' | 'NSE' | 'BSE';
  sector: string;
  industry: string;
  currentPrice: number;
  changePercent: number;
  
  // Moving Averages & Key Levels
  sma50: number;
  sma150: number;
  sma200: number;
  sma200_1mo_ago: number;
  high52w: number;
  low52w: number;
  rsRating: number; // Relative Strength 1-99
  
  // SEPA & VCP Setup Metadata
  patternType: 'VCP (3 Contractions)' | 'VCP (4 Contractions)' | 'High Tight Flag' | 'Cup with Handle' | 'Pivot Pullback';
  vcpStage: 'T2' | 'T3' | 'T4' | 'Breakout Pending' | 'Active Breakout';
  trendScore: number; // e.g. 8 out of 8
  
  // Tight Volume Metrics
  avgVolume20d: number; // e.g. 2,500,000
  pivotVolume: number; // e.g. 850,000
  volumeDryUpPercent: number; // e.g. -66% below average (tight volume)
  isTightVolume: boolean;
  
  // Precise Trade Execution Levels
  pivotPrice: number; // Exact Entry Price
  buyZoneMax: number; // Pivot + 2%
  stopLossPrice: number; // Exit price (hard stop or low of pivot)
  stopLossPercent: number; // e.g. -5.2%
  target1Price: number; // +20% (3:1 R/R target)
  target1Percent: number; // 20%
  target2Price: number; // +35% extended target
  target2Percent: number; // 35%
  riskRewardRatio: number; // e.g. 3.85
  
  // Contractions Breakdown
  contractions: VcpContraction[];
  
  // Historical chart candles
  priceHistory: PricePoint[];
  
  // Minervini Analysis Summary
  sepaNotes: string;

  // Refined SEPA Fundamental & Technical Screener Metrics
  salesGrowth3Y?: number; // e.g. 24.5%
  profitGrowth3Y?: number; // e.g. 32.0%
  qtrSalesGrowthYoY?: number; // e.g. 28.4%
  qtrProfitGrowthYoY?: number; // e.g. 41.2%
  salesLatestQtr?: number; // e.g. $1,250M
  salesPrecedingQtr?: number; // e.g. $980M (Acceleration > 20%)
  roce?: number; // Return on Capital Employed e.g. 22.5%
  roe?: number; // Return on Equity e.g. 25.8%
  debtToEquity?: number; // e.g. 0.18
  npmLastYear?: number; // Net Profit Margin last year e.g. 14.2%
  npmLatestQtr?: number; // NPM latest quarter e.g. 16.5%
  npmPrecedingQtr?: number; // NPM preceding quarter e.g. 13.8% (Margin expansion)
  pegRatio?: number; // Price/Earnings to Growth ratio e.g. 0.85
  rsi14?: number; // 14-period Relative Strength Index e.g. 62.4
  adx14?: number; // 14-period Average Directional Index e.g. 38.5 (Trend Strength)
  plusDI14?: number; // 14-period Positive Directional Indicator +DI e.g. 34.2
  minusDI14?: number; // 14-period Negative Directional Indicator -DI e.g. 11.5
  trendStrengthTier?: 'SUPER_STRONG' | 'STRONG_TREND' | 'MODERATE_TREND' | 'WEAK_CONSOLIDATION';
  volume50dAvg?: number; // 50-day average daily volume
  currentVolume?: number; // Latest volume or breakout volume

  // Daily Floor Pivot & Central Pivot Range (CPR)
  dailyPivotP?: number; // Central Floor Pivot
  dailyPivotR1?: number; // Resistance 1
  dailyPivotR2?: number; // Resistance 2
  dailyPivotR3?: number; // Resistance 3
  dailyPivotS1?: number; // Support 1
  dailyPivotS2?: number; // Support 2
  dailyPivotS3?: number; // Support 3
  cprTC?: number; // Central Pivot Range Top Central
  cprBC?: number; // Central Pivot Range Bottom Central
  cprWidthPercent?: number; // Central Pivot Range Width % (Tight CPR indicator)
  cprStatus?: 'NARROW_TIGHT_CPR' | 'BALANCED_CPR' | 'WIDE_RANGE_CPR';

  // Daily Volatility & ATR Metrics
  atr14?: number; // 14-day Average True Range in $
  atr14Percent?: number; // 14-day ATR as % of price
  atr5dTo20dRatio?: number; // 5-day ATR / 20-day ATR (Volatility Contraction Ratio)
  dailyHigh?: number;
  dailyLow?: number;
  dailyRangePercent?: number; // (High - Low) / Close * 100%
  volatilityStatus?: 'ULTRA_TIGHT_COIL' | 'MODERATE_COMPRESSION' | 'EXPANDING_VOLATILITY' | 'HIGH_CHAOS';
  volatilityScore?: number; // 0 to 100 Volatility Compression Score

  // 3C Cheat Entry Breakdown
  has3CCheatEntry?: boolean;
  cheatEntryPrice?: number;
  cheatStopLossPrice?: number;
  cheatRiskPercent?: number;

  // Earnings & Catalyst Metadata
  nextEarningsDate?: string; // e.g. "2026-07-29"
  earningsTime?: 'BMO' | 'AMC'; // Before Market Open / After Market Close
  daysToEarnings?: number; // Calculated or mock offset e.g. 5 days
  epsEstimate?: number; // e.g. $1.25
  epsActualLastQ?: number; // e.g. $1.10 (+85% YoY)
  epsYoYGrowthLastQ?: number; // e.g. 85%
  revYoYGrowthLastQ?: number; // e.g. 42%
  earningsRiskStatus?: 'DANGER_IMMINENT' | 'WARNING_SOON' | 'SAFE_WINDOW' | 'POST_EARNINGS_GAP';

  // Custom User Trendlines & Technical Annotations Persistence
  customTrendlines?: CustomTrendline[];
}

export interface ScreenerFilters {
  searchQuery: string;
  exchange: string;
  patternType: string;
  minTrendScore: number;
  tightVolumeOnly: boolean;
  minRsRating: number;
  maxStopLossPercent: number;
}

export interface PositionSizeResult {
  accountCapital: number;
  riskTolerancePercent: number;
  riskAmount: number;
  entryPrice: number;
  stopPrice: number;
  riskPerShare: number;
  shareQuantity: number;
  totalPositionCost: number;
  portfolioAllocationPercent: number;
}

export interface PriceAlert {
  id: string;
  ticker: string;
  stockName: string;
  targetType:
    | 'PIVOT_ENTRY'
    | 'STOP_LOSS'
    | 'CUSTOM_ABOVE'
    | 'CUSTOM_BELOW'
    | 'VOLATILITY_DRYUP'
    | 'RISK_REWARD_RATIO'
    | 'STAGE_2_COMPLETED'
    | 'VCP_BASE_FORMED'
    | 'MAJOR_NEWS_CATALYST'
    | 'VOLUME_SPIKE'
    | 'HIGH_CONVICTION_BREAKOUT'
    | 'SMART_MONEY_DIVERGENCE'
    | 'STAGE_2_DAILY_SCAN'
    | 'RSI_BULLISH_DIVERGENCE'
    | 'RSI_BEARISH_DIVERGENCE';
  targetPrice: number;
  triggerProximityPercent: number; // e.g. within 1.5% of target
  currentPrice: number;
  status: 'ACTIVE' | 'TRIGGERED' | 'MUTED';
  createdAt: string;
  triggeredAt?: string;
  exchange: 'NASDAQ' | 'NYSE' | 'NSE' | 'BSE';
  notes?: string;
  // Volatility Dry-Up Specific Settings
  volatilityTightnessTargetPct?: number; // e.g. <= 5.0% price range tightening
  volatilityVolumeDryUpTargetPct?: number; // e.g. <= -50% volume dry-up
  // Risk-Reward Ratio Specific Settings
  targetRRRatio?: number; // e.g. 3.0 or 5.0 ratio target
  // Pattern Alert Specific Settings
  stage2RuleThreshold?: number; // e.g. 7 or 8 rules passed for Stage 2
  vcpContractionThreshold?: number; // e.g. 3 or 4 contractions
  watchlistId?: string;
  // Divergence Specific Settings
  divergenceType?: 'BULLISH_ACCUMULATION' | 'BEARISH_DISTRIBUTION' | 'HIDDEN_ACCUMULATION' | 'HIDDEN_DISTRIBUTION';
  divergenceConviction?: number;
}

export interface PriceAlertHistoryRecord {
  id: string;
  ticker: string;
  stockName?: string;
  exchange: 'NASDAQ' | 'NYSE' | 'NSE' | 'BSE' | string;
  timestamp: string; // ISO string
  formattedDate: string;
  formattedTime: string;
  relativeTime: string;
  triggeredPrice: number;
  targetPrice: number;
  priceDelta: number; // triggeredPrice - targetPrice
  priceDeltaPercent: number;
  alertType:
    | 'PIVOT_ENTRY'
    | 'STOP_LOSS'
    | 'VOLATILITY_DRYUP'
    | 'PROXIMITY_WARNING'
    | 'CUSTOM_ABOVE'
    | 'CUSTOM_BELOW'
    | 'VOLUME_SPIKE'
    | 'STAGE_2_COMPLETED'
    | 'VCP_BASE_FORMED';
  eventTypeLabel: string;
  volatilityEventType:
    | 'BREAKOUT_SURGE'
    | 'RISK_VIOLATION'
    | 'SUPPLY_SQUEEZE'
    | 'APPROACHING_PIVOT'
    | 'TIGHTENING_RANGE'
    | 'VOLUME_EXPANSION'
    | 'STAGE_TRANSITION';
  severity: 'CRITICAL' | 'WARNING' | 'SUCCESS' | 'INFO';
  volumeAtTrigger?: number;
  avgVolume20d?: number;
  volumeRatio?: number;
  volatilityRangePercent?: number;
  notes?: string;
  status: 'TRIGGERED' | 'ACKNOWLEDGED' | 'DISMISSED';
}

export interface SmartMoneyDivergenceAlertPayload {
  ticker: string;
  stockName: string;
  exchange: 'NASDAQ' | 'NYSE' | 'NSE' | 'BSE' | string;
  divergenceType: 'BULLISH_ACCUMULATION' | 'BEARISH_DISTRIBUTION' | 'HIDDEN_ACCUMULATION' | 'HIDDEN_DISTRIBUTION';
  strength: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
  convictionScore: number; // 1 to 10
  priceSlope: number; // % change over lookback
  sentimentSlope: number; // change in sentiment MA score
  priceStart: number;
  priceEnd: number;
  sentimentStart: number;
  sentimentEnd: number;
  lookbackDays: number;
  title: string;
  description: string;
  sepaPlaybook: string;
  institutionalPhase: 'ACCUMULATION' | 'DISTRIBUTION' | 'ABSORPTION' | 'NEUTRAL';
  triggeredAt: string;
  topHeadlines?: { title: string; sentiment: string; impactScore?: number; date?: string }[];
}

export interface DetectedRsiDivergence {
  id: string;
  ticker: string;
  type: 'BULLISH' | 'BEARISH';
  kind: 'REGULAR_BULLISH' | 'REGULAR_BEARISH' | 'HIDDEN_BULLISH' | 'HIDDEN_BEARISH';
  strength: 'STRONG' | 'MODERATE' | 'MILD';
  convictionScore: number; // 1 to 10
  startDate: string;
  endDate: string;
  startPrice: number;
  endPrice: number;
  startRsi: number;
  endRsi: number;
  rsiCurrent: number;
  priceDiffPercent: number;
  rsiDiff: number;
  barsAgo: number;
  isRecent: boolean; // detected in the last 15 bars
  title: string;
  description: string;
  sepaPlaybook: string;
}

export interface RsiDivergenceAlertPayload {
  ticker: string;
  stockName: string;
  exchange: 'NASDAQ' | 'NYSE' | 'NSE' | 'BSE' | string;
  divergenceType: 'BULLISH' | 'BEARISH';
  divergenceKind: 'REGULAR_BULLISH' | 'REGULAR_BEARISH' | 'HIDDEN_BULLISH' | 'HIDDEN_BEARISH';
  strength: 'STRONG' | 'MODERATE' | 'MILD';
  convictionScore: number; // 1 to 10
  startDate: string;
  endDate: string;
  startPrice: number;
  endPrice: number;
  startRsi: number;
  endRsi: number;
  rsiCurrent: number;
  priceDiffPercent: number;
  rsiDiff: number;
  title: string;
  description: string;
  sepaPlaybook: string;
  triggeredAt: string;
}

export interface MajorNewsEventPayload {
  ticker: string;
  stockName: string;
  exchange: 'NASDAQ' | 'NYSE' | 'NSE' | 'BSE' | string;
  headlineTitle: string;
  source: string;
  date: string;
  snippet: string;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'CATALYST';
  catalystType: string;
  impactLevel?: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  isMajorEvent: boolean;
  summary?: string;
  groundingUri?: string;
  groundingSources?: { title: string; uri: string }[];
  groundingQueries?: string[];
  watchlistName?: string;
  triggeredAt: string;
}

export interface PortfolioHolding {
  id: string;
  ticker: string;
  stockName: string;
  exchange: 'NASDAQ' | 'NYSE' | 'NSE' | 'BSE';
  shares: number;
  entryPrice: number;
  currentPrice: number;
  buyDate: string;
  stopLossPrice: number;
  pivotTargetPrice: number;
  notes?: string;
  // SEPA Alignment metadata
  trendScore?: number;
  sma50?: number;
  sma200?: number;
  vcpStage?: string;
}

export interface MinerviniVideoLesson {
  id: string;
  title: string;
  duration: string;
  youtubeId: string;
  category: '3C_CHEAT' | 'VCP_FOUNDATIONS' | 'RISK_MANAGEMENT' | 'POSITION_SIZING' | 'EARNINGS_DRIFT';
  summary: string;
  keyTimestamps: { time: string; label: string }[];
  takeaways: string[];
}

export type EmotionalState = 
  | 'CONFIDENT'
  | 'CALM'
  | 'ANXIOUS'
  | 'FOMO'
  | 'DISCIPLINED'
  | 'IMPATIENT'
  | 'EUPHORIC'
  | 'REGRETFUL'
  | 'PATIENT';

export type TradeStatus = 'PLANNING' | 'ACTIVE_TRADE' | 'OPEN' | 'CLOSED_WIN' | 'CLOSED_LOSS' | 'STOPPED_OUT' | 'SCRATCHED';

export interface TradeJournalNote {
  id: string;
  ticker: string;
  stockName: string;
  exchange: 'NASDAQ' | 'NYSE' | 'NSE' | 'BSE';
  date: string;
  setupType: string;
  entryPrice?: number;
  exitPrice?: number;
  stopLossPrice?: number;
  emotionalState: EmotionalState;
  notes: string;
  keyLesson: string;
  tradeStatus: TradeStatus;
  rating: number; // 1 to 5 stars
  chartSnapshotUrl?: string;
}

// ==========================================
// DAILY REVIEW & TOP PICKS RANKING TYPES
// ==========================================

export interface DailyMinerviniCriteriaItem {
  id: string;
  category: 'TREND' | 'RS' | 'PATTERN' | 'VOLUME' | 'RISK_REWARD' | 'PROXIMITY' | 'FUNDAMENTALS' | 'EARNINGS_SAFETY';
  name: string;
  shortLabel: string;
  description: string;
  passed: boolean;
  actualValueStr: string;
  thresholdStr: string;
  iconName: string;
}

export interface DailyStockEvaluation {
  stock: MinerviniTradeSetup;
  criteriaPassedCount: number;
  totalCriteriaCount: number;
  criteriaList: DailyMinerviniCriteriaItem[];
  meetsThreePlusCriteria: boolean;
  compositeAlphaScore: number; // 0 to 100
  tierLabel: 'SUPERPERFORMER_ELITE' | 'HIGH_CONVICTION_SETUP' | 'QUALIFIED_SEPA' | 'BELOW_THRESHOLD';
  distanceToPivotPercent: number; // e.g. -1.2% (1.2% below pivot)
  inBuyZone: boolean;
  pivotStatus: 'IN_BUY_ZONE' | 'APPROACHING_PIVOT' | 'EXTENDED' | 'BELOW_PIVOT' | 'ACTIVE_BREAKOUT';
}

export type ConvictionTier = 'CONVICTION_A_PLUS' | 'FOCUS_LIST' | 'TACTICAL_CHEAT' | 'STALKING';
export type DailyTradeAction = 'BUY_ON_BREAKOUT' | 'BUY_ON_PULLBACK' | 'BUY_3C_CHEAT' | 'WAIT_VOLUME_DRYUP' | 'HOLD_FOR_PROFIT';

export interface DailyRankedPick {
  ticker: string;
  rank: number; // 1, 2, 3...
  conviction: ConvictionTier;
  action: DailyTradeAction;
  notes: string;
  plannedAllocationPct: number; // e.g. 15%
  pinnedDate: string;
  updatedAt: string;
}

// ===================================================
// MINERVINI RELATIVE STRENGTH (RS) & CONTINUATION TYPES
// ===================================================

export interface RelativeStrengthQuarterBreakdown {
  quarter: string; // 'Q1 (Recent 3M)', 'Q2 (4-6M)', 'Q3 (7-9M)', 'Q4 (10-12M)'
  periodLabel: string;
  weightPercent: number; // 40%, 20%, 20%, 20%
  stockReturnPercent: number;
  benchmarkReturnPercent: number;
  excessReturnPercent: number;
  weightedContribution: number;
}

export interface RelativeStrengthCalculation {
  ticker: string;
  calculatedRsRating: number; // 1 - 99 scale
  percentileRank: number; // 1 - 99
  tier: 'ELITE_LEADER_90' | 'HIGH_LEADERSHIP_80' | 'QUALIFIED_70' | 'SUBPAR_UNDER_70';
  tierLabel: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  prerequisitePassed70: boolean; // >= 70
  prerequisitePassed80: boolean; // >= 80
  weightedPerformanceScore: number; // Raw 4-quarter weighted score
  annualReturnPercent: number; // 12-month net gain
  quarters: RelativeStrengthQuarterBreakdown[];
  rsLineTrend: 'NEW_HIGH_BEFORE_PRICE' | 'STRONG_UPTREND' | 'CONSOLIDATING' | 'LAGGING';
  rsLineTrendLabel: string;
  rsLineTrendDescription: string;
  trendContinuationEligibility: 'PRIME_SETUP' | 'QUALIFIED_SETUP' | 'MARGINAL_SETUP' | 'DISQUALIFIED';
  eligibilityExplanation: string;
}

export interface TrendContinuationSetup {
  stock: MinerviniTradeSetup;
  rsCalculation: RelativeStrengthCalculation;
  isEligible: boolean;
  setupGrade: 'A+' | 'A' | 'B+' | 'C';
  entryPrices: {
    pivotPrice: number; // Exact breakout level
    buyZoneMin: number; // Equal to pivotPrice
    buyZoneMax: number; // Pivot + 2%
    maxChasePrice: number; // Pivot + 5% (Minervini strict rule: never buy >5% above pivot)
    cheatEntryPrice?: number;
    cheatStopLossPrice?: number;
    entryTriggerType: string;
  };
  exitPrices: {
    stopLossPrice: number; // Hard stop level (low of handle/contraction)
    stopLossPercent: number; // Risk percentage e.g. -5.8%
    riskAmountDollars: number; // Dollar risk per share
    breakevenTriggerPrice: number; // Move stop to breakeven when price hits +3R or +10%
    target1Price: number; // 3:1 R/R profit objective (+18% to +20%)
    target1Percent: number;
    target1GainDollars: number;
    target2Price: number; // Extended runner objective (+35%)
    target2Percent: number;
    target2GainDollars: number;
    riskRewardRatio: number;
    trailingStopDescription: string;
  };
  tightVolumeCriteria: {
    avgVolume20d: number;
    pivotVolume: number;
    volumeDryUpPercent: number; // e.g. -71.5%
    isTightVolume: boolean;
    requiredBreakoutVolume: number; // +50% to +100% surge requirement
    dryUpStatus: 'EXTREME_DRY_UP' | 'HEALTHY_DRY_UP' | 'MODERATE_DRY_UP' | 'ABOVE_AVERAGE';
    dryUpStatusLabel: string;
    supplyExhaustionScore: number; // 0 - 100
    volumeSequenceSummary: string;
  };
}

// NSE and BSE Bhavcopy Types
export type BhavcopyExchange = 'NSE' | 'BSE' | 'ALL';

export interface BhavcopyRecord {
  symbol: string;
  scripCode?: string; // BSE Scrip Code e.g. 500251
  name: string;
  exchange: 'NSE' | 'BSE';
  series: string; // 'EQ' | 'BE' | 'SM' for NSE, or 'A' | 'B' | 'T' | 'X' for BSE group
  isin: string;
  open: number;
  high: number;
  low: number;
  close: number;
  lastPrice: number;
  prevClose: number;
  change: number;
  changePercent: number;
  totalTradedQty: number; // Traded Volume
  totalTradedVal: number; // Value in INR
  totalTrades: number;
  deliveryQty?: number;
  deliveryPercent?: number; // Institutional delivery %
  high52w: number;
  low52w: number;
  distanceFrom52wHighPercent: number; // e.g. -3.2%
  avgVolume20d: number;
  volumeSurgeRatio: number; // volume / avgVolume20d
  isCircuitHit?: 'UPPER' | 'LOWER' | 'NONE';
  circuitLimitPercent?: number;
  sepaStage: 'Stage 2 (Breakout)' | 'Stage 2 (Contraction)' | 'Stage 1 (Base)' | 'Stage 3/4';
  rsRating: number;
  isMinerviniCandidate: boolean;
  date: string; // YYYY-MM-DD
  sector?: string;
  industry?: string;
}

export interface BhavcopyMarketSummary {
  exchange: BhavcopyExchange;
  tradingDate: string;
  totalTradedCount: number;
  advances: number;
  declines: number;
  unchanged: number;
  totalTurnoverCrores: number;
  totalVolumeTraded: number;
  stocksAt52wHigh: number;
  stocksAt52wLow: number;
  upperCircuitCount: number;
  lowerCircuitCount: number;
  highDeliveryAccumulationCount: number; // Delivery > 55%
  stage2BreakoutCount: number;
}

export interface TradingViewWebhookPayload {
  ticker: string;
  action?: 'BUY' | 'SELL' | 'PIVOT_BREAKOUT' | 'STOP_LOSS' | 'TARGET_1' | 'TARGET_2' | 'VCP_DRYUP' | 'STAGE_2_CONFIRMED' | 'ALERT' | string;
  price?: number;
  volume?: number;
  exchange?: string;
  time?: string;
  message?: string;
  strategy?: string;
  bar?: {
    open?: number;
    high?: number;
    low?: number;
    close?: number;
    volume?: number;
    time?: string;
  };
  passphrase?: string;
  source?: string;
}

export type TradingViewSepaCategory =
  | 'PIVOT_ENTRY'
  | 'STOP_EXIT'
  | 'TARGET_PROFIT'
  | 'VOLUME_SURGE'
  | 'VCP_CONTRACTION'
  | 'STAGE_2_SIGNAL'
  | 'GENERAL_ALERT';

export interface TradingViewWebhookEvent {
  id: string;
  receivedAt: string;
  formattedTime: string;
  ticker: string;
  stockName?: string;
  action: string;
  price: number;
  volume?: number;
  exchange: string;
  message: string;
  strategy?: string;
  status: 'VALID' | 'WARNING' | 'UNAUTHORIZED';
  sepaCategory: TradingViewSepaCategory;
  rawPayload: string;
  ip?: string;
  httpStatus?: number;
  diagnostics?: string;
  contentType?: string;
  requestDurationMs?: number;
}

export interface TradingViewWebhookConfig {
  enabled: boolean;
  passphrase: string;
  autoAddToWatchlist: boolean;
  soundAlertOnReceive: boolean;
  desktopNotification: boolean;
}


