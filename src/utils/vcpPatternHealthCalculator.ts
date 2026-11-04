import { MinerviniTradeSetup, VcpContraction, PricePoint } from '../types';

export interface VcpCriterionMetric {
  label: string;
  actual: string;
  ideal: string;
  passed: boolean;
  note?: string;
}

export interface VcpCriterionResult {
  id: 'DEPTH' | 'TIMING' | 'VOLUME_DRY_UP';
  title: string;
  shortName: string;
  score: number; // 0 - 100
  weight: number; // e.g. 0.35
  status: 'PASS' | 'WARNING' | 'FAIL';
  summary: string;
  minerviniRule: string;
  metrics: VcpCriterionMetric[];
}

export interface ContractionAnalysisItem {
  index: number;
  label: string;
  depthPercent: number;
  durationDays: number;
  volumeDryUpPercent: number;
  highPrice: number;
  lowPrice: number;
  isDepthProgressive: boolean; // shallower than prior
  depthReductionPercent: number; // % reduction from prior contraction
  isDurationCompressed: boolean; // shorter or equal to prior
  isVduSatisfied: boolean; // volume contracted
  statusBadge: 'EXCELLENT' | 'GOOD' | 'LOOSE' | 'FAILED';
}

export interface VcpHealthConfig {
  maxBaseDepthPercent?: number; // default 45%
  maxFinalContractionDepthPercent?: number; // default 8% (ideal <5%)
  minFinalVduPercent?: number; // default -40% (volume below 20-day avg)
  strictMinerviniMode?: boolean; // if true, enforces strict <5% final pivot & <-50% VDU
}

export interface VcpPatternHealthResult {
  overallScore: number; // 0 - 100
  letterGrade: 'A+' | 'A' | 'B+' | 'B' | 'C' | 'DEFECTIVE';
  healthStatus: 'PRIME_SETUP' | 'CONSTRUCTIVE' | 'DEVELOPING' | 'DEFECTIVE';
  statusColor: string;
  statusBg: string;
  headlineSummary: string;
  actionableRecommendation: string;
  
  // Specific Minervini Pillars
  depthCriterion: VcpCriterionResult;
  timingCriterion: VcpCriterionResult;
  volumeDryUpCriterion: VcpCriterionResult;

  // Granular Wave Breakdown
  contractions: ContractionAnalysisItem[];
  totalBaseDepthPercent: number;
  totalBaseDays: number;
  totalBaseWeeks: number;
  finalContractionDepth: number;
  finalVduPercent: number;
  
  // Quick flags
  meetsAllClassicCriteria: boolean;
  hasProgressiveDepthReduction: boolean;
  hasTightTerminalPivot: boolean;
  hasTerminalDryUp: boolean;
  hasProperBaseDuration: boolean;
}

/**
 * Evaluates a stock's Volatility Contraction Pattern against classic Mark Minervini SEPA rules:
 * 1. Depth of Contractions (Decreasing volatility left to right, tight final pivot <5-8%)
 * 2. Timing & Symmetry (Progressive duration compression, 2-6+ weeks base)
 * 3. Volume Dry-Up (Supply exhaustion on right side, volume < 20-day avg)
 */
export function calculateVcpPatternHealth(
  stock: MinerviniTradeSetup,
  config?: VcpHealthConfig
): VcpPatternHealthResult {
  const strict = config?.strictMinerviniMode ?? false;
  const maxFinalDepthAllowed = strict ? 5.0 : (config?.maxFinalContractionDepthPercent ?? 8.0);
  const vduThreshold = strict ? -50.0 : (config?.minFinalVduPercent ?? -35.0);
  const maxBaseDepth = config?.maxBaseDepthPercent ?? 45.0;

  const rawContractions = stock.contractions || [];
  const history = stock.priceHistory || [];

  // 1. Build contraction wave analysis
  const contractionItems: ContractionAnalysisItem[] = [];
  let progressiveDepthPass = true;
  let allDurationCompressed = true;

  rawContractions.forEach((c, idx) => {
    const prior = idx > 0 ? rawContractions[idx - 1] : null;
    const depthAbs = Math.abs(c.depthPercent);
    const priorDepthAbs = prior ? Math.abs(prior.depthPercent) : depthAbs;

    // Is depth strictly or roughly shallower than prior?
    const isShallower = prior ? depthAbs < priorDepthAbs : true;
    if (prior && !isShallower) {
      progressiveDepthPass = false;
    }

    const depthReduction = prior
      ? Number((((priorDepthAbs - depthAbs) / priorDepthAbs) * 100).toFixed(1))
      : 0;

    const isDurationShorter = prior ? c.durationDays <= prior.durationDays : true;
    if (prior && !isDurationShorter) {
      allDurationCompressed = false;
    }

    // Volume dry up for this contraction
    const vduVal = c.volumeDryUpPercent;
    const isVdu = vduVal <= -25;

    let badge: 'EXCELLENT' | 'GOOD' | 'LOOSE' | 'FAILED' = 'GOOD';
    if (idx === rawContractions.length - 1) {
      if (depthAbs <= 4.5 && vduVal <= -45) badge = 'EXCELLENT';
      else if (depthAbs <= maxFinalDepthAllowed && isVdu) badge = 'GOOD';
      else if (depthAbs > 12) badge = 'FAILED';
      else badge = 'LOOSE';
    } else {
      if (isShallower && depthReduction >= 30) badge = 'EXCELLENT';
      else if (isShallower) badge = 'GOOD';
      else badge = 'FAILED';
    }

    contractionItems.push({
      index: c.contractionIndex || idx + 1,
      label: `T${c.contractionIndex || idx + 1}`,
      depthPercent: depthAbs,
      durationDays: c.durationDays || 5,
      volumeDryUpPercent: vduVal,
      highPrice: c.highPrice,
      lowPrice: c.lowPrice,
      isDepthProgressive: isShallower,
      depthReductionPercent: depthReduction,
      isDurationCompressed: isDurationShorter,
      isVduSatisfied: isVdu,
      statusBadge: badge,
    });
  });

  // Calculate Base Metrics
  const baseHigh = rawContractions.length > 0
    ? Math.max(...rawContractions.map((c) => c.highPrice))
    : (stock.high52w || stock.pivotPrice);
  const baseLow = rawContractions.length > 0
    ? Math.min(...rawContractions.map((c) => c.lowPrice))
    : (stock.stopLossPrice || stock.currentPrice * 0.85);

  const totalBaseDepthPercent = Number((((baseHigh - baseLow) / (baseHigh || 1)) * 100).toFixed(1));
  const totalBaseDays = rawContractions.reduce((acc, c) => acc + (c.durationDays || 5), 0);
  const totalBaseWeeks = Math.max(1, Number((totalBaseDays / 5).toFixed(1)));

  const finalContraction = contractionItems[contractionItems.length - 1];
  const finalContractionDepth = finalContraction ? finalContraction.depthPercent : 6.0;
  const finalVduPercent = finalContraction ? finalContraction.volumeDryUpPercent : stock.volumeDryUpPercent || -30;

  // ==========================================
  // PILLAR 1: DEPTH OF CONTRACTIONS (Weight: 35%)
  // ==========================================
  let depthScore = 0;
  const depthMetrics: VcpCriterionMetric[] = [];

  // A. Progressive Contraction Volatility Reduction (T1 > T2 > T3...)
  const numContractions = rawContractions.length;
  let depthProgressionScore = 0;
  if (numContractions >= 2) {
    if (progressiveDepthPass) {
      depthProgressionScore = 100;
      depthMetrics.push({
        label: 'Progressive Shrinkage',
        actual: rawContractions.map((c) => `-${Math.abs(c.depthPercent)}%`).join(' → '),
        ideal: 'T1 > T2 > T3 (Decaying)',
        passed: true,
        note: 'Each pullback is strictly shallower than the preceding contraction.',
      });
    } else {
      depthProgressionScore = 40;
      depthMetrics.push({
        label: 'Progressive Shrinkage',
        actual: rawContractions.map((c) => `-${Math.abs(c.depthPercent)}%`).join(' → '),
        ideal: 'T1 > T2 > T3 (Decaying)',
        passed: false,
        note: 'Volatile re-expansion: a later contraction was deeper than an earlier one.',
      });
    }
  } else {
    depthProgressionScore = 70;
    depthMetrics.push({
      label: 'Contraction Stages',
      actual: `${numContractions} Contraction`,
      ideal: '2 to 4 Contractions',
      passed: true,
      note: 'Early base or single tight cup handle.',
    });
  }

  // B. Terminal Contraction Depth (The Pivot / Buy-Cheat area)
  let finalDepthScore = 0;
  if (finalContractionDepth <= 4.0) {
    finalDepthScore = 100;
  } else if (finalContractionDepth <= 6.0) {
    finalDepthScore = 90;
  } else if (finalContractionDepth <= maxFinalDepthAllowed) {
    finalDepthScore = 75;
  } else if (finalContractionDepth <= 11.0) {
    finalDepthScore = 50;
  } else {
    finalDepthScore = 20;
  }

  depthMetrics.push({
    label: 'Terminal Pivot Depth',
    actual: `-${finalContractionDepth}%`,
    ideal: strict ? '≤ 5.0% (Strict)' : '≤ 8.0% (Classic)',
    passed: finalContractionDepth <= maxFinalDepthAllowed,
    note: finalContractionDepth <= 5.0
      ? 'Flawless tight pivot: minimal overhead risk, tight stop.'
      : finalContractionDepth <= maxFinalDepthAllowed
      ? 'Acceptable contraction depth for low-risk entry.'
      : 'Defectively loose pivot: elevated risk of shakeout.',
  });

  // C. Total Base Correction Depth
  let totalBaseScore = 0;
  if (totalBaseDepthPercent <= 25.0) {
    totalBaseScore = 100;
  } else if (totalBaseDepthPercent <= 35.0) {
    totalBaseScore = 88;
  } else if (totalBaseDepthPercent <= maxBaseDepth) {
    totalBaseScore = 70;
  } else {
    totalBaseScore = 35;
  }

  depthMetrics.push({
    label: 'Total Base Depth',
    actual: `${totalBaseDepthPercent}%`,
    ideal: '10% - 35% (Max 45%)',
    passed: totalBaseDepthPercent <= maxBaseDepth,
    note: totalBaseDepthPercent <= 35
      ? 'Constructive institutional base depth.'
      : 'Deep base: excessive institutional supply must be absorbed.',
  });

  depthScore = Math.round(depthProgressionScore * 0.4 + finalDepthScore * 0.4 + totalBaseScore * 0.2);
  const depthStatus: 'PASS' | 'WARNING' | 'FAIL' =
    depthScore >= 80 ? 'PASS' : depthScore >= 60 ? 'WARNING' : 'FAIL';

  const depthCriterion: VcpCriterionResult = {
    id: 'DEPTH',
    title: 'Contraction Depth Compression',
    shortName: 'Depth',
    score: depthScore,
    weight: 0.35,
    status: depthStatus,
    summary:
      depthScore >= 85
        ? 'Superb progressive volatility contraction with a tightly coiled pivot.'
        : depthScore >= 65
        ? 'Constructive depth shrinkage, though pivot is slightly wider than ideal.'
        : 'Irregular or excessively loose contraction depths; elevated shakeout risk.',
    minerviniRule:
      '"The most important characteristic of a sound VCP is the progressive decrease in volatility from left to right. Each pullback should be shallower than the previous one, culminating in a very tight final contraction of 3% to 8%." — Mark Minervini',
    metrics: depthMetrics,
  };

  // ==========================================
  // PILLAR 2: TIMING & WAVE SYMMETRY (Weight: 0.30)
  // ==========================================
  let timingScore = 0;
  const timingMetrics: VcpCriterionMetric[] = [];

  // A. Number of Contractions (2-4 is classic)
  let stageCountScore = 0;
  if (numContractions === 3 || numContractions === 4) {
    stageCountScore = 100;
  } else if (numContractions === 2) {
    stageCountScore = 85;
  } else if (numContractions >= 5) {
    stageCountScore = 65;
  } else {
    stageCountScore = 50;
  }

  timingMetrics.push({
    label: 'Contraction Waves',
    actual: `${numContractions} Contractions (${stock.vcpStage || 'Active'})`,
    ideal: '2 to 4 Stages (T2-T4)',
    passed: numContractions >= 2 && numContractions <= 4,
    note: 'Classic Minervini VCPs undergo 2 to 4 progressively tighter waves.',
  });

  // B. Base Duration in Weeks
  let durationWeeksScore = 0;
  if (totalBaseWeeks >= 3 && totalBaseWeeks <= 16) {
    durationWeeksScore = 100;
  } else if (totalBaseWeeks >= 2 && totalBaseWeeks <= 26) {
    durationWeeksScore = 80;
  } else if (totalBaseWeeks < 2) {
    durationWeeksScore = 40; // Too short / V-shaped
  } else {
    durationWeeksScore = 60; // Very long base
  }

  timingMetrics.push({
    label: 'Base Duration',
    actual: `${totalBaseWeeks} Weeks (${totalBaseDays} Days)`,
    ideal: '3 to 12 Weeks (Min 2 wks)',
    passed: totalBaseWeeks >= 2 && totalBaseWeeks <= 35,
    note: totalBaseWeeks < 2
      ? 'Premature formation: insufficient time for institutional consolidation.'
      : 'Sufficient base gestation to clear overhead supply.',
  });

  // C. Duration Compression Check
  let timeCompressionScore = 0;
  if (numContractions >= 2) {
    if (allDurationCompressed) {
      timeCompressionScore = 100;
      timingMetrics.push({
        label: 'Duration Compression',
        actual: rawContractions.map((c) => `${c.durationDays}d`).join(' → '),
        ideal: 'D1 ≥ D2 ≥ D3 (Tightening)',
        passed: true,
        note: 'Pullback cycles are compressing in time as well as price.',
      });
    } else {
      timeCompressionScore = 65;
      timingMetrics.push({
        label: 'Duration Compression',
        actual: rawContractions.map((c) => `${c.durationDays}d`).join(' → '),
        ideal: 'D1 ≥ D2 ≥ D3 (Tightening)',
        passed: false,
        note: 'Minor time asymmetry, but within acceptable volatility envelope.',
      });
    }
  } else {
    timeCompressionScore = 80;
  }

  timingScore = Math.round(stageCountScore * 0.35 + durationWeeksScore * 0.4 + timeCompressionScore * 0.25);
  const timingStatus: 'PASS' | 'WARNING' | 'FAIL' =
    timingScore >= 80 ? 'PASS' : timingScore >= 60 ? 'WARNING' : 'FAIL';

  const timingCriterion: VcpCriterionResult = {
    id: 'TIMING',
    title: 'Timing & Base Symmetry',
    shortName: 'Timing',
    score: timingScore,
    weight: 0.30,
    status: timingStatus,
    summary:
      timingScore >= 85
        ? 'Well-developed base timing with textbook contraction compression waves.'
        : timingScore >= 65
        ? 'Adequate base duration; meets minimum gestation criteria for Stage 2 breakout.'
        : 'Irregular duration or premature base; overhead supply may not be fully absorbed.',
    minerviniRule:
      '"A proper base typically takes between 2 to 6 weeks, or several months for large cups. As the pattern matures, each consolidation wave should take less time than the prior one as supply dries up." — Mark Minervini',
    metrics: timingMetrics,
  };

  // ==========================================
  // PILLAR 3: VOLUME DRY-UP (VDU) (Weight: 0.35)
  // ==========================================
  let vduScore = 0;
  const vduMetrics: VcpCriterionMetric[] = [];

  // A. Terminal Volume Dry-Up vs 20-Day Average
  let terminalVduScore = 0;
  if (finalVduPercent <= -55) {
    terminalVduScore = 100;
  } else if (finalVduPercent <= -40) {
    terminalVduScore = 90;
  } else if (finalVduPercent <= vduThreshold) {
    terminalVduScore = 75;
  } else if (finalVduPercent <= -15) {
    terminalVduScore = 55;
  } else if (finalVduPercent <= 0) {
    terminalVduScore = 40;
  } else {
    terminalVduScore = 15; // Volume increased on contraction!
  }

  vduMetrics.push({
    label: 'Terminal VDU vs 20D Avg',
    actual: `${finalVduPercent > 0 ? '+' : ''}${finalVduPercent}%`,
    ideal: strict ? '≤ -50% (Severe VDU)' : '≤ -35% to -50%',
    passed: finalVduPercent <= vduThreshold,
    note: finalVduPercent <= -45
      ? 'Severe volume dry-up: supply has evaporated, liquidity is tightly restricted.'
      : finalVduPercent <= vduThreshold
      ? 'Constructive volume contraction prior to pivot buy-point.'
      : 'Supply still active: volume failed to contract significantly.',
  });

  // B. Supply Absorption on Down-Sessions in Base
  // Check recent 15 bars in price history for down-day volume vs avg
  let downDayQuietnessScore = 80;
  if (history.length >= 10) {
    const recentBars = history.slice(-15);
    const downBars = recentBars.filter((b, idx, arr) => {
      const prev = idx > 0 ? arr[idx - 1] : null;
      return prev ? b.close < prev.close : false;
    });

    if (downBars.length > 0) {
      const heavyDownBars = downBars.filter((b) => b.volume > (b.avgVolume20 || b.volume) * 1.3);
      if (heavyDownBars.length === 0) {
        downDayQuietnessScore = 100;
        vduMetrics.push({
          label: 'Down-Day Supply Pressure',
          actual: 'Zero Distribution Bars',
          ideal: 'Light Volume on Pullbacks',
          passed: true,
          note: 'No heavy institutional selling occurred during recent contractions.',
        });
      } else if (heavyDownBars.length === 1) {
        downDayQuietnessScore = 70;
        vduMetrics.push({
          label: 'Down-Day Supply Pressure',
          actual: '1 Elevated Selling Bar',
          ideal: 'Light Volume on Pullbacks',
          passed: true,
          note: 'Minor selling pressure, but well-contained within the base.',
        });
      } else {
        downDayQuietnessScore = 40;
        vduMetrics.push({
          label: 'Down-Day Supply Pressure',
          actual: `${heavyDownBars.length} Heavy Selling Bars`,
          ideal: 'Light Volume on Pullbacks',
          passed: false,
          note: 'Warning: multiple above-average volume down days indicate distribution.',
        });
      }
    }
  }

  // C. Pocket Pivot / Institutional Accumulation Support
  const hasPocketPivotOrTightFlag = Boolean(stock.isTightVolume || (stock.pivotVolume && stock.pivotVolume < (stock.avgVolume20d || 1) * 0.7));
  let accumulationScore = hasPocketPivotOrTightFlag ? 95 : 75;

  vduMetrics.push({
    label: 'Pivot Supply Exhaustion',
    actual: stock.isTightVolume ? 'Tight Volume Confirmed' : `${finalVduPercent}% below avg`,
    ideal: 'Supply Squeeze / Pocket Dry-Up',
    passed: hasPocketPivotOrTightFlag || finalVduPercent <= -35,
    note: 'Volume exhaustion confirms sellers have vacated the order book.',
  });

  vduScore = Math.round(terminalVduScore * 0.5 + downDayQuietnessScore * 0.3 + accumulationScore * 0.2);
  const vduStatus: 'PASS' | 'WARNING' | 'FAIL' =
    vduScore >= 80 ? 'PASS' : vduScore >= 60 ? 'WARNING' : 'FAIL';

  const volumeDryUpCriterion: VcpCriterionResult = {
    id: 'VOLUME_DRY_UP',
    title: 'Volume Dry-Up (Supply Exhaustion)',
    shortName: 'Volume Dry-Up',
    score: vduScore,
    weight: 0.35,
    status: vduStatus,
    summary:
      vduScore >= 85
        ? 'Classic Minervini VDU: dramatic supply evaporation in the final contraction.'
        : vduScore >= 65
        ? 'Satisfactory volume dry-up; supply is contracting constructively.'
        : 'Volume remains elevated or erratic; lack of supply exhaustion increases failure rate.',
    minerviniRule:
      '"Volume must contract substantially as the stock forms each contraction, culminating in extreme volume dry-up (VDU) in the final pivot. If volume expands on pullbacks, the pattern is defective." — Mark Minervini',
    metrics: vduMetrics,
  };

  // ==========================================
  // COMPOSITE PATTERN HEALTH CALCULATION
  // ==========================================
  const overallScore = Math.round(
    depthCriterion.score * depthCriterion.weight +
    timingCriterion.score * timingCriterion.weight +
    volumeDryUpCriterion.score * volumeDryUpCriterion.weight
  );

  let letterGrade: 'A+' | 'A' | 'B+' | 'B' | 'C' | 'DEFECTIVE' = 'B';
  let healthStatus: 'PRIME_SETUP' | 'CONSTRUCTIVE' | 'DEVELOPING' | 'DEFECTIVE' = 'CONSTRUCTIVE';
  let statusColor = '#10b981'; // emerald-500
  let statusBg = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';

  if (overallScore >= 92 && progressiveDepthPass && finalContractionDepth <= 6.0) {
    letterGrade = 'A+';
    healthStatus = 'PRIME_SETUP';
    statusColor = '#10b981';
    statusBg = 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300';
  } else if (overallScore >= 83) {
    letterGrade = 'A';
    healthStatus = 'PRIME_SETUP';
    statusColor = '#059669';
    statusBg = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
  } else if (overallScore >= 75) {
    letterGrade = 'B+';
    healthStatus = 'CONSTRUCTIVE';
    statusColor = '#3b82f6';
    statusBg = 'bg-blue-500/10 border-blue-500/30 text-blue-400';
  } else if (overallScore >= 65) {
    letterGrade = 'B';
    healthStatus = 'CONSTRUCTIVE';
    statusColor = '#f59e0b';
    statusBg = 'bg-amber-500/10 border-amber-500/30 text-amber-400';
  } else if (overallScore >= 52) {
    letterGrade = 'C';
    healthStatus = 'DEVELOPING';
    statusColor = '#f97316';
    statusBg = 'bg-orange-500/10 border-orange-500/30 text-orange-400';
  } else {
    letterGrade = 'DEFECTIVE';
    healthStatus = 'DEFECTIVE';
    statusColor = '#ef4444';
    statusBg = 'bg-rose-500/10 border-rose-500/30 text-rose-400';
  }

  // Summary & Recommendation
  let headlineSummary = '';
  let actionableRecommendation = '';

  if (healthStatus === 'PRIME_SETUP') {
    headlineSummary = `Textbook Minervini ${stock.patternType || 'VCP'}: All 3 classic pillars (Depth, Timing, Volume Dry-Up) fully satisfied.`;
    actionableRecommendation = `Setup is primed for breakout. Place buy-stop at pivot entry price $${stock.pivotPrice.toFixed(2)} with strict stop-loss at $${stock.stopLossPrice.toFixed(2)} (-${Math.abs(stock.stopLossPercent || 5).toFixed(1)}%). Look for breakout volume >+100% vs 20-day average.`;
  } else if (healthStatus === 'CONSTRUCTIVE') {
    headlineSummary = `Constructive VCP structure: Good volatility compression and acceptable volume dry-up.`;
    actionableRecommendation = `Tradeable setup. Allow pattern to complete final tight consolidation. Enter strictly on high-volume pivot trigger ($${stock.pivotPrice.toFixed(2)}). Keep initial risk capped at 5-7%.`;
  } else if (healthStatus === 'DEVELOPING') {
    headlineSummary = `Developing VCP: Contraction depth or volume dry-up is still forming and has not reached optimal tightness.`;
    actionableRecommendation = `Do not anticipate entry prematurely. Wait for another contraction (T${numContractions + 1}) to shrink below 6% with volume falling below 20-day average before placing buy orders.`;
  } else {
    headlineSummary = `Defective VCP: Structure fails Minervini's rules due to erratic depth, wide pivot (-${finalContractionDepth}%), or elevated distribution volume.`;
    actionableRecommendation = `Avoid or remove from active watchlist until a clean new base structure forms. Entering a defective pattern carries a high probability of whipsaw or breakdown.`;
  }

  const meetsAllClassicCriteria =
    depthCriterion.status === 'PASS' &&
    timingCriterion.status === 'PASS' &&
    volumeDryUpCriterion.status === 'PASS';

  return {
    overallScore,
    letterGrade,
    healthStatus,
    statusColor,
    statusBg,
    headlineSummary,
    actionableRecommendation,
    depthCriterion,
    timingCriterion,
    volumeDryUpCriterion,
    contractions: contractionItems,
    totalBaseDepthPercent,
    totalBaseDays,
    totalBaseWeeks,
    finalContractionDepth,
    finalVduPercent,
    meetsAllClassicCriteria,
    hasProgressiveDepthReduction: progressiveDepthPass,
    hasTightTerminalPivot: finalContractionDepth <= maxFinalDepthAllowed,
    hasTerminalDryUp: finalVduPercent <= vduThreshold,
    hasProperBaseDuration: totalBaseWeeks >= 2 && totalBaseWeeks <= 35,
  };
}
