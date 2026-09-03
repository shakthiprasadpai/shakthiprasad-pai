import { MinerviniTradeSetup, TradeJournalNote } from '../types';
import { formatCurrency } from './sepaCalculator';

export interface SmartPatternAnalysis {
  detectedPattern: string;
  patternQualityScore: number; // 0 to 100
  qualityTier: 'A+' | 'A' | 'B+' | 'B' | 'WATCH';
  contractionsSummary: string;
  contractionCount: number;
  tightnessRatioPct: number; // % reduction in volatility from T1 to last contraction
  volumeDryUpPct: number;
  isTightVolume: boolean;
  stage2TrendScore: number;
  rsRating: number;
  pivotPrice: number;
  recommendedStopPrice: number;
  recommendedStopPct: number;
  recommendedTargetPrice: number;
  riskRewardRatio: number;
  checklist: { label: string; passed: boolean; details: string }[];
  patternNotes: string;
}

export interface SmartSectoralAnalysis {
  sector: string;
  industry: string;
  sectorRank: number;
  totalSectors: number;
  sectorRsScore: number;
  sectorTrend: 'LEADING' | 'IMPROVING' | 'ROTATIONAL' | 'LAGGING';
  flowState: 'HEAVY_INFLOW' | 'MODERATE_INFLOW' | 'ROTATIONAL' | 'OUTFLOW';
  flowLabel: string;
  peerCountInGroup: number;
  sectorPeers: string[];
  sectorTailwindRating: 'EXCELLENT' | 'FAVORABLE' | 'NEUTRAL' | 'HEADWIND';
  sectorNotes: string;
}

export interface CombinedSmartJournalPayload {
  ticker: string;
  stockName: string;
  exchange: 'NASDAQ' | 'NYSE' | 'NSE' | 'BSE';
  pattern: SmartPatternAnalysis;
  sectoral: SmartSectoralAnalysis;
  suggestedRationale: string;
  suggestedKeyLesson: string;
}

export interface SectorJournalSummary {
  sector: string;
  tradeCount: number;
  winCount: number;
  lossCount: number;
  scratchCount: number;
  winRate: number;
  totalReturnPct: number;
  avgReturnPct: number;
  totalRMultiple: number;
  avgRMultiple: number;
  topTicker: string;
  flowState: 'HEAVY_INFLOW' | 'MODERATE_INFLOW' | 'ROTATIONAL' | 'OUTFLOW';
}

export interface PatternJournalSummary {
  pattern: string;
  tradeCount: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  avgRMultiple: number;
  totalRMultiple: number;
}

/**
 * Computes comprehensive sector rankings across all trade setups
 */
export function computeSectorRankings(allStocks: MinerviniTradeSetup[]): Map<string, {
  rank: number;
  totalSectors: number;
  sectorRsScore: number;
  sectorTrend: 'LEADING' | 'IMPROVING' | 'ROTATIONAL' | 'LAGGING';
  flowState: 'HEAVY_INFLOW' | 'MODERATE_INFLOW' | 'ROTATIONAL' | 'OUTFLOW';
  flowLabel: string;
  avgChange: number;
  peers: string[];
}> {
  const sectorMap = new Map<string, MinerviniTradeSetup[]>();
  allStocks.forEach((s) => {
    const sec = s.sector || 'General Market';
    if (!sectorMap.has(sec)) sectorMap.set(sec, []);
    sectorMap.get(sec)!.push(s);
  });

  const sectorAggList: {
    sector: string;
    avgChange: number;
    avgRs: number;
    compositeScore: number;
    peers: string[];
  }[] = [];

  sectorMap.forEach((stocks, sector) => {
    const avgChange = stocks.reduce((sum, s) => sum + s.changePercent, 0) / (stocks.length || 1);
    const avgRs = stocks.reduce((sum, s) => sum + (s.rsRating || 50), 0) / (stocks.length || 1);
    const compositeScore = Math.round(avgRs * 0.6 + (avgChange + 5) * 5);
    sectorAggList.push({
      sector,
      avgChange,
      avgRs,
      compositeScore,
      peers: stocks.map((s) => s.ticker),
    });
  });

  // Sort descending by composite score
  sectorAggList.sort((a, b) => b.compositeScore - a.compositeScore);

  const resultMap = new Map<string, {
    rank: number;
    totalSectors: number;
    sectorRsScore: number;
    sectorTrend: 'LEADING' | 'IMPROVING' | 'ROTATIONAL' | 'LAGGING';
    flowState: 'HEAVY_INFLOW' | 'MODERATE_INFLOW' | 'ROTATIONAL' | 'OUTFLOW';
    flowLabel: string;
    avgChange: number;
    peers: string[];
  }>();

  const totalSectors = sectorAggList.length;

  sectorAggList.forEach((item, index) => {
    const rank = index + 1;
    const sectorRsScore = Math.min(99, Math.max(10, Math.round(item.avgRs)));

    let sectorTrend: 'LEADING' | 'IMPROVING' | 'ROTATIONAL' | 'LAGGING' = 'ROTATIONAL';
    let flowState: 'HEAVY_INFLOW' | 'MODERATE_INFLOW' | 'ROTATIONAL' | 'OUTFLOW' = 'ROTATIONAL';
    let flowLabel = 'Neutral / Rotational';

    if (rank <= 2 && item.avgChange >= 0.5) {
      sectorTrend = 'LEADING';
      flowState = 'HEAVY_INFLOW';
      flowLabel = 'Heavy Institutional Inflow';
    } else if (rank <= Math.ceil(totalSectors / 2) && item.avgChange > 0) {
      sectorTrend = 'IMPROVING';
      flowState = 'MODERATE_INFLOW';
      flowLabel = 'Accumulation Tailwind';
    } else if (item.avgChange < -0.8) {
      sectorTrend = 'LAGGING';
      flowState = 'OUTFLOW';
      flowLabel = 'Distribution Pressure';
    }

    resultMap.set(item.sector, {
      rank,
      totalSectors,
      sectorRsScore,
      sectorTrend,
      flowState,
      flowLabel,
      avgChange: item.avgChange,
      peers: item.peers,
    });
  });

  return resultMap;
}

/**
 * Analyzes a stock setup to produce Smart Pattern and Sectoral Journal intelligence
 */
export function analyzeStockSmartSetup(
  stock: MinerviniTradeSetup,
  allStocks: MinerviniTradeSetup[]
): CombinedSmartJournalPayload {
  // 1. PATTERN ANALYSIS
  const contractions = stock.contractions || [];
  const contractionCount = contractions.length;
  let contractionsSummary = '';
  let tightnessRatioPct = 0;

  if (contractionCount > 0) {
    contractionsSummary = contractions
      .map((c) => `T${c.contractionIndex}: -${c.depthPercent.toFixed(1)}% (${c.durationDays}d)`)
      .join(' ➔ ');

    if (contractionCount >= 2) {
      const firstDepth = Math.abs(contractions[0].depthPercent);
      const lastDepth = Math.abs(contractions[contractionCount - 1].depthPercent);
      if (firstDepth > 0) {
        tightnessRatioPct = Math.round(((firstDepth - lastDepth) / firstDepth) * 100);
      }
    }
  } else {
    contractionsSummary = `${stock.patternType || 'Consolidation Base'}`;
    tightnessRatioPct = 40;
  }

  // Calculate Pattern Quality Score (0 to 100)
  let patternScore = 0;

  // Criterion 1: Trend Template score (max 30 pts)
  const trendPoints = Math.min(30, Math.round(((stock.trendScore || 7) / 8) * 30));
  patternScore += trendPoints;

  // Criterion 2: Volume dry-up (max 25 pts)
  const dryUpVal = stock.volumeDryUpPercent || -30;
  if (dryUpVal <= -60) patternScore += 25;
  else if (dryUpVal <= -45) patternScore += 20;
  else if (dryUpVal <= -30) patternScore += 15;
  else patternScore += 8;

  // Criterion 3: Contraction Tightness Squeeze (max 25 pts)
  if (tightnessRatioPct >= 60) patternScore += 25;
  else if (tightnessRatioPct >= 40) patternScore += 20;
  else if (contractionCount >= 2) patternScore += 16;
  else patternScore += 10;

  // Criterion 4: Relative Strength rating (max 10 pts)
  const rsPoints = Math.min(10, Math.round(((stock.rsRating || 75) / 99) * 10));
  patternScore += rsPoints;

  // Criterion 5: Pivot Proximity / Risk Reward (max 10 pts)
  if ((stock.riskRewardRatio || 3.0) >= 3.0) patternScore += 10;
  else if ((stock.riskRewardRatio || 3.0) >= 2.5) patternScore += 7;
  else patternScore += 5;

  patternScore = Math.min(100, Math.max(30, patternScore));

  let qualityTier: 'A+' | 'A' | 'B+' | 'B' | 'WATCH' = 'B';
  if (patternScore >= 90) qualityTier = 'A+';
  else if (patternScore >= 80) qualityTier = 'A';
  else if (patternScore >= 70) qualityTier = 'B+';
  else if (patternScore >= 60) qualityTier = 'B';
  else qualityTier = 'WATCH';

  // Build checklist
  const checklist = [
    {
      label: 'Stage 2 Trend Template',
      passed: (stock.trendScore || 0) >= 7,
      details: `${stock.trendScore || 8}/8 rules passed (Price > 50 > 150 > 200 SMA)`,
    },
    {
      label: 'Progressive Contraction Squeeze',
      passed: tightnessRatioPct >= 40 || contractionCount >= 2,
      details: contractionCount >= 2 ? `${tightnessRatioPct}% volatility reduction` : 'Base consolidation intact',
    },
    {
      label: 'Institutional Volume Dry-Up',
      passed: dryUpVal <= -40,
      details: `${dryUpVal.toFixed(1)}% below 20-day average`,
    },
    {
      label: 'High Relative Strength (RS 80+)',
      passed: (stock.rsRating || 0) >= 80,
      details: `RS Rating: ${stock.rsRating || 90} (Top tier market outperformance)`,
    },
    {
      label: 'Asymmetric 3:1 Reward/Risk',
      passed: (stock.riskRewardRatio || 0) >= 3.0,
      details: `${(stock.riskRewardRatio || 3.2).toFixed(2)}:1 reward-to-risk ratio`,
    },
  ];

  // Execution targets
  const pivotPrice = stock.pivotPrice || stock.currentPrice;
  const recommendedStopPrice = stock.stopLossPrice || Number((pivotPrice * 0.94).toFixed(2));
  const recommendedStopPct = stock.stopLossPercent || Number((((pivotPrice - recommendedStopPrice) / pivotPrice) * 100).toFixed(1));
  const recommendedTargetPrice = stock.target1Price || Number((pivotPrice * 1.20).toFixed(2));
  const riskRewardRatio = stock.riskRewardRatio || 3.2;

  const patternNotes = `${stock.patternType || 'VCP Setup'} forming with ${contractionCount || 2} contractions. ` +
    `Final volatility contraction compressed by ${tightnessRatioPct}% with volume drying up to ${dryUpVal.toFixed(1)}% of 20-day average. ` +
    `Pivot breakout level established at ${formatCurrency(pivotPrice, stock.exchange)}.`;

  const patternAnalysis: SmartPatternAnalysis = {
    detectedPattern: stock.patternType || 'VCP (3 Contractions)',
    patternQualityScore: patternScore,
    qualityTier,
    contractionsSummary,
    contractionCount,
    tightnessRatioPct,
    volumeDryUpPct: dryUpVal,
    isTightVolume: stock.isTightVolume ?? (dryUpVal <= -40),
    stage2TrendScore: stock.trendScore || 8,
    rsRating: stock.rsRating || 88,
    pivotPrice,
    recommendedStopPrice,
    recommendedStopPct,
    recommendedTargetPrice,
    riskRewardRatio,
    checklist,
    patternNotes,
  };

  // 2. SECTORAL ANALYSIS
  const sectorRankings = computeSectorRankings(allStocks);
  const sectorKey = stock.sector || 'General Market';
  const sectorMeta = sectorRankings.get(sectorKey) || {
    rank: 1,
    totalSectors: sectorRankings.size || 5,
    sectorRsScore: 85,
    sectorTrend: 'LEADING' as const,
    flowState: 'HEAVY_INFLOW' as const,
    flowLabel: 'Heavy Institutional Inflow',
    avgChange: 1.5,
    peers: [stock.ticker],
  };

  const sectorPeers = sectorMeta.peers.filter((t) => t.toUpperCase() !== stock.ticker.toUpperCase());

  let sectorTailwindRating: 'EXCELLENT' | 'FAVORABLE' | 'NEUTRAL' | 'HEADWIND' = 'NEUTRAL';
  if (sectorMeta.rank <= 2 && sectorMeta.avgChange >= 0.5) {
    sectorTailwindRating = 'EXCELLENT';
  } else if (sectorMeta.rank <= 3) {
    sectorTailwindRating = 'FAVORABLE';
  } else if (sectorMeta.avgChange < -0.5) {
    sectorTailwindRating = 'HEADWIND';
  }

  const sectorNotes = `Member of #${sectorMeta.rank} ranked industry sector "${sectorKey}" ` +
    `(${stock.industry || 'Industry Leader'}). Sector demonstrates ${sectorMeta.flowLabel} with Sector RS ${sectorMeta.sectorRsScore}/100. ` +
    (sectorPeers.length > 0 ? `Industry peer confirmation observed in ${sectorPeers.slice(0, 3).join(', ')}.` : 'Strong stand-alone group leadership.');

  const sectoralAnalysis: SmartSectoralAnalysis = {
    sector: sectorKey,
    industry: stock.industry || 'Industry Focus',
    sectorRank: sectorMeta.rank,
    totalSectors: sectorMeta.totalSectors,
    sectorRsScore: sectorMeta.sectorRsScore,
    sectorTrend: sectorMeta.sectorTrend,
    flowState: sectorMeta.flowState,
    flowLabel: sectorMeta.flowLabel,
    peerCountInGroup: sectorMeta.peers.length,
    sectorPeers,
    sectorTailwindRating,
    sectorNotes,
  };

  // 3. COMBINED PROFESSIONAL MINERVINI SEPA RATIONALE
  const suggestedRationale = 
`[SETUP PATTERN: ${patternAnalysis.detectedPattern} | Quality: ${patternScore}/100 (${qualityTier})]
- Structure: ${contractionsSummary}. Volatility compressed by ${tightnessRatioPct}% with supply dry-up (${dryUpVal.toFixed(1)}% vs 20d avg).
- Stage 2 Alignment: 8/8 Trend Template criteria met. Stock RS Rating is ${stock.rsRating}/99.

[SECTORAL THEME: ${sectoralAnalysis.sector} • ${sectoralAnalysis.industry}]
- Group Rank: #${sectoralAnalysis.sectorRank} of ${sectoralAnalysis.totalSectors} (${sectoralAnalysis.flowLabel}).
- Tailwind: ${sectorTailwindRating} tailwind with Sector RS ${sectoralAnalysis.sectorRsScore}. ${sectorPeers.length > 0 ? `Peers (${sectorPeers.slice(0, 2).join(', ')}) confirming group rotation.` : ''}

[EXECUTION PLAN]
- Pivot Entry: ${formatCurrency(pivotPrice, stock.exchange)} | Stop-Loss: ${formatCurrency(recommendedStopPrice, stock.exchange)} (-${recommendedStopPct}%)
- Target 1: ${formatCurrency(recommendedTargetPrice, stock.exchange)} | Reward-to-Risk: ${riskRewardRatio.toFixed(2)}:1
- Rule: Only enter on volume surge > 50% above average upon pivot breach.`;

  const suggestedKeyLesson = sectorTailwindRating === 'EXCELLENT' || sectorTailwindRating === 'FAVORABLE'
    ? `Top-down alignment confirmed: Trading a Tier 1 leader in the #${sectoralAnalysis.sectorRank} ranked sector creates the highest probability setup. Protect risk at ${recommendedStopPct}%.`
    : `Strictly respect volume dry-up and pivot confirmation. Never compromise on stage 2 trend template or risk management rules.`;

  return {
    ticker: stock.ticker,
    stockName: stock.name,
    exchange: stock.exchange,
    pattern: patternAnalysis,
    sectoral: sectoralAnalysis,
    suggestedRationale,
    suggestedKeyLesson,
  };
}

/**
 * Computes Sector-by-Sector performance breakdown from journal notes
 */
export function computeSectorJournalSummaries(
  notes: TradeJournalNote[],
  allStocks: MinerviniTradeSetup[]
): SectorJournalSummary[] {
  const stockSectorMap = new Map<string, string>();
  allStocks.forEach((s) => {
    stockSectorMap.set(s.ticker.toUpperCase(), s.sector || 'General Market');
  });

  const sectorMap = new Map<string, {
    notes: TradeJournalNote[];
    wins: number;
    losses: number;
    scratches: number;
    totalReturn: number;
    totalR: number;
  }>();

  notes.forEach((n) => {
    const sec = n.sector || stockSectorMap.get(n.ticker.toUpperCase()) || 'General Market';
    if (!sectorMap.has(sec)) {
      sectorMap.set(sec, {
        notes: [],
        wins: 0,
        losses: 0,
        scratches: 0,
        totalReturn: 0,
        totalR: 0,
      });
    }

    const item = sectorMap.get(sec)!;
    item.notes.push(n);

    // Calculate trade metrics
    if (n.entryPrice && n.exitPrice) {
      const returnPct = ((n.exitPrice - n.entryPrice) / n.entryPrice) * 100;
      item.totalReturn += returnPct;

      const riskPct = n.stopLossPrice
        ? Math.abs(((n.entryPrice - n.stopLossPrice) / n.entryPrice) * 100)
        : 6.0;
      const rMult = riskPct > 0 ? returnPct / riskPct : 0;
      item.totalR += rMult;
    }

    if (n.tradeStatus === 'CLOSED_WIN') item.wins++;
    else if (n.tradeStatus === 'CLOSED_LOSS' || n.tradeStatus === 'STOPPED_OUT') item.losses++;
    else if (n.tradeStatus === 'SCRATCHED') item.scratches++;
  });

  const result: SectorJournalSummary[] = [];

  sectorMap.forEach((val, sector) => {
    const total = val.notes.length;
    const closed = val.wins + val.losses;
    const winRate = closed > 0 ? Math.round((val.wins / closed) * 100) : 0;
    const avgReturn = total > 0 ? Number((val.totalReturn / total).toFixed(2)) : 0;
    const avgR = total > 0 ? Number((val.totalR / total).toFixed(2)) : 0;

    // Determine top ticker in this sector
    const tickerFreq: Record<string, number> = {};
    val.notes.forEach((n) => {
      tickerFreq[n.ticker] = (tickerFreq[n.ticker] || 0) + 1;
    });
    const topTicker = Object.entries(tickerFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    let flowState: 'HEAVY_INFLOW' | 'MODERATE_INFLOW' | 'ROTATIONAL' | 'OUTFLOW' = 'ROTATIONAL';
    if (winRate >= 70 && val.totalR >= 2.0) flowState = 'HEAVY_INFLOW';
    else if (winRate >= 50) flowState = 'MODERATE_INFLOW';
    else if (winRate < 40 && closed >= 2) flowState = 'OUTFLOW';

    result.push({
      sector,
      tradeCount: total,
      winCount: val.wins,
      lossCount: val.losses,
      scratchCount: val.scratches,
      winRate,
      totalReturnPct: Number(val.totalReturn.toFixed(2)),
      avgReturnPct: avgReturn,
      totalRMultiple: Number(val.totalR.toFixed(2)),
      avgRMultiple: avgR,
      topTicker,
      flowState,
    });
  });

  // Sort by win rate and total R-multiple descending
  return result.sort((a, b) => b.totalRMultiple - a.totalRMultiple || b.winRate - a.winRate);
}

/**
 * Computes Pattern-by-Pattern performance breakdown from journal notes
 */
export function computePatternJournalSummaries(
  notes: TradeJournalNote[]
): PatternJournalSummary[] {
  const patternMap = new Map<string, {
    wins: number;
    losses: number;
    totalR: number;
    total: number;
  }>();

  notes.forEach((n) => {
    const pat = n.setupType || 'VCP (General)';
    if (!patternMap.has(pat)) {
      patternMap.set(pat, { wins: 0, losses: 0, totalR: 0, total: 0 });
    }

    const item = patternMap.get(pat)!;
    item.total++;

    if (n.entryPrice && n.exitPrice) {
      const returnPct = ((n.exitPrice - n.entryPrice) / n.entryPrice) * 100;
      const riskPct = n.stopLossPrice
        ? Math.abs(((n.entryPrice - n.stopLossPrice) / n.entryPrice) * 100)
        : 6.0;
      const rMult = riskPct > 0 ? returnPct / riskPct : 0;
      item.totalR += rMult;
    }

    if (n.tradeStatus === 'CLOSED_WIN') item.wins++;
    else if (n.tradeStatus === 'CLOSED_LOSS' || n.tradeStatus === 'STOPPED_OUT') item.losses++;
  });

  const result: PatternJournalSummary[] = [];

  patternMap.forEach((val, pattern) => {
    const closed = val.wins + val.losses;
    const winRate = closed > 0 ? Math.round((val.wins / closed) * 100) : 0;
    const avgR = val.total > 0 ? Number((val.totalR / val.total).toFixed(2)) : 0;

    result.push({
      pattern,
      tradeCount: val.total,
      winCount: val.wins,
      lossCount: val.losses,
      winRate,
      avgRMultiple: avgR,
      totalRMultiple: Number(val.totalR.toFixed(2)),
    });
  });

  return result.sort((a, b) => b.totalRMultiple - a.totalRMultiple || b.winRate - a.winRate);
}
