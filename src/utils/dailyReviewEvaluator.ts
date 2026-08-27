import {
  MinerviniTradeSetup,
  DailyMinerviniCriteriaItem,
  DailyStockEvaluation,
  DailyRankedPick,
  ConvictionTier,
  DailyTradeAction
} from '../types';
import { evaluateTrendTemplate } from './sepaCalculator';

/**
 * Evaluates a single stock against the 8 core Mark Minervini SEPA & VCP criteria.
 */
export function evaluateStockDailyCriteria(stock: MinerviniTradeSetup): DailyStockEvaluation {
  const trendResult = evaluateTrendTemplate({
    currentPrice: stock.currentPrice,
    sma50: stock.sma50,
    sma150: stock.sma150,
    sma200: stock.sma200,
    sma200_1mo_ago: stock.sma200_1mo_ago,
    high52w: stock.high52w,
    low52w: stock.low52w,
    rsRating: stock.rsRating
  });

  const trendPassed = trendResult.passedCount;
  const distanceToPivotPercent = ((stock.currentPrice - stock.pivotPrice) / stock.pivotPrice) * 100;
  const inBuyZone = stock.currentPrice >= stock.pivotPrice && stock.currentPrice <= stock.buyZoneMax;

  let pivotStatus: DailyStockEvaluation['pivotStatus'] = 'BELOW_PIVOT';
  if (stock.vcpStage === 'Active Breakout' || (distanceToPivotPercent > 2.0 && distanceToPivotPercent <= 5.0)) {
    pivotStatus = 'ACTIVE_BREAKOUT';
  } else if (inBuyZone) {
    pivotStatus = 'IN_BUY_ZONE';
  } else if (distanceToPivotPercent >= -4.5 && distanceToPivotPercent < 0) {
    pivotStatus = 'APPROACHING_PIVOT';
  } else if (distanceToPivotPercent > 5.0) {
    pivotStatus = 'EXTENDED';
  } else {
    pivotStatus = 'BELOW_PIVOT';
  }

  // 1. Stage 2 Trend Template
  const rule1Passed = trendPassed >= 6 || (stock.trendScore !== undefined && stock.trendScore >= 6);
  const criterion1: DailyMinerviniCriteriaItem = {
    id: 'crit_trend_template',
    category: 'TREND',
    name: 'Stage 2 Trend Template (6+/8 Rules)',
    shortLabel: 'Stage 2 Trend',
    description: 'Price above rising 150/200 SMAs with 50 SMA above 150 SMA (confirmed Stage 2 advancing phase).',
    passed: rule1Passed,
    actualValueStr: `${trendPassed}/8 Rules (${stock.currentPrice > stock.sma50 ? 'Above 50MA' : 'Below 50MA'})`,
    thresholdStr: '≥ 6 of 8 Trend Template rules passed',
    iconName: 'TrendingUp'
  };

  // 2. Relative Strength (RS) Leadership
  const rule2Passed = stock.rsRating >= 80;
  const criterion2: DailyMinerviniCriteriaItem = {
    id: 'crit_rs_rating',
    category: 'RS',
    name: 'Relative Strength Leadership (RS ≥ 80)',
    shortLabel: 'RS 80+ Leader',
    description: 'IBD/Minervini Relative Strength Rating of 80 to 99, outperforming the vast majority of the market.',
    passed: rule2Passed,
    actualValueStr: `RS Rating: ${stock.rsRating}`,
    thresholdStr: 'RS Rating ≥ 80 (Top 20% Leaders)',
    iconName: 'Zap'
  };

  // 3. Volatility Contraction Pattern (VCP)
  const rule3Passed = (stock.contractions && stock.contractions.length >= 2) ||
    stock.patternType.includes('VCP') ||
    stock.patternType.includes('High Tight Flag') ||
    stock.patternType.includes('Cup with Handle');
  const finalContractionDepth = stock.contractions && stock.contractions.length > 0
    ? stock.contractions[stock.contractions.length - 1].depthPercent
    : 5.0;
  const criterion3: DailyMinerviniCriteriaItem = {
    id: 'crit_vcp_pattern',
    category: 'PATTERN',
    name: 'VCP Multi-Contraction Structure',
    shortLabel: 'VCP Structure',
    description: 'Constructive base showing progressive contraction of price volatility from left to right.',
    passed: rule3Passed,
    actualValueStr: `${stock.patternType} (T${stock.contractions?.length || 2} final ${finalContractionDepth.toFixed(1)}%)`,
    thresholdStr: 'Verified VCP / Base with ≥ 2 Contractions',
    iconName: 'Activity'
  };

  // 4. Volume Dry-Up / Supply Exhaustion
  const rule4Passed = (stock.volumeDryUpPercent !== undefined && stock.volumeDryUpPercent <= -35) ||
    stock.isTightVolume ||
    (stock.pivotVolume && stock.avgVolume20d && stock.pivotVolume < stock.avgVolume20d * 0.65);
  const volDryUpDisplay = stock.volumeDryUpPercent !== undefined
    ? `${stock.volumeDryUpPercent > 0 ? '+' : ''}${stock.volumeDryUpPercent.toFixed(1)}%`
    : '-60.0%';
  const criterion4: DailyMinerviniCriteriaItem = {
    id: 'crit_volume_dryup',
    category: 'VOLUME',
    name: 'Volume Dry-Up (Supply Exhaustion)',
    shortLabel: 'Volume Dry-Up',
    description: 'Volume drying up significantly on pullbacks and pivot handle, demonstrating lack of selling supply.',
    passed: rule4Passed,
    actualValueStr: `${volDryUpDisplay} vs 20d avg (${stock.isTightVolume ? 'Tight Volume' : 'Normal'})`,
    thresholdStr: 'Dry-up ≤ -35% vs 20-day Average',
    iconName: 'Droplets'
  };

  // 5. Asymmetric Risk/Reward Ratio
  const stopLossAbs = Math.abs(stock.stopLossPercent);
  const rule5Passed = stock.riskRewardRatio >= 3.0 && stopLossAbs <= 7.5;
  const criterion5: DailyMinerviniCriteriaItem = {
    id: 'crit_risk_reward',
    category: 'RISK_REWARD',
    name: 'Asymmetric 3:1+ Risk/Reward Profile',
    shortLabel: '3:1+ R/R Ratio',
    description: 'Disciplined stop loss capped at ≤ 7.5% with minimum 3:1 mathematical profit target payoff.',
    passed: rule5Passed,
    actualValueStr: `${stock.riskRewardRatio.toFixed(2)}:1 R/R (Stop -${stopLossAbs.toFixed(1)}%)`,
    thresholdStr: 'R/R ≥ 3.0:1 & Hard Stop Loss ≤ 7.5%',
    iconName: 'ShieldCheck'
  };

  // 6. Pivot Proximity & Actionable Buy Window
  const rule6Passed = distanceToPivotPercent >= -6.0 && stock.currentPrice <= stock.buyZoneMax * 1.02;
  const criterion6: DailyMinerviniCriteriaItem = {
    id: 'crit_pivot_proximity',
    category: 'PROXIMITY',
    name: 'Pivot Entry Proximity (Actionable Window)',
    shortLabel: 'Pivot Window',
    description: 'Price is within stalking distance (≤ 6% below pivot) or inside the optimal +2% Buy Zone.',
    passed: rule6Passed,
    actualValueStr: `${distanceToPivotPercent >= 0 ? '+' : ''}${distanceToPivotPercent.toFixed(1)}% from Pivot (${pivotStatus.replace('_', ' ')})`,
    thresholdStr: 'Within 6% below Pivot to +2% Buy Zone',
    iconName: 'Target'
  };

  // 7. Fundamental Growth Acceleration
  const growthRate = stock.epsYoYGrowthLastQ || stock.qtrProfitGrowthYoY || stock.qtrSalesGrowthYoY || stock.profitGrowth3Y || 0;
  const rule7Passed = growthRate >= 25 || (stock.salesGrowth3Y && stock.salesGrowth3Y >= 20) || (stock.roe && stock.roe >= 15);
  const criterion7: DailyMinerviniCriteriaItem = {
    id: 'crit_fundamentals',
    category: 'FUNDAMENTALS',
    name: 'SEPA Fundamental Growth Acceleration',
    shortLabel: 'Growth Catalyst',
    description: 'Explosive quarterly earnings or sales expansion (Code 33 catalyst) supporting institutional buying.',
    passed: rule7Passed,
    actualValueStr: `Growth: +${growthRate.toFixed(0)}% YoY ${stock.roe ? `(ROE ${stock.roe.toFixed(0)}%)` : ''}`,
    thresholdStr: 'Quarterly EPS/Sales Growth ≥ 25% (or 3Y > 20%)',
    iconName: 'BarChart3'
  };

  // 8. Earnings Risk Safe Window
  const rule8Passed = stock.earningsRiskStatus !== 'DANGER_IMMINENT' &&
    (stock.daysToEarnings === undefined || stock.daysToEarnings > 5 || stock.daysToEarnings < 0);
  const criterion8: DailyMinerviniCriteriaItem = {
    id: 'crit_earnings_safety',
    category: 'EARNINGS_SAFETY',
    name: 'Earnings Safe Window (No Binary Hazard)',
    shortLabel: 'Earnings Safe',
    description: 'Stock is clear of imminent quarterly earnings reporting within 5 days, avoiding overnight gap risk.',
    passed: rule8Passed,
    actualValueStr: stock.daysToEarnings !== undefined
      ? (stock.daysToEarnings < 0 ? 'Post-Earnings Gap Safe' : `${stock.daysToEarnings} Days Until Earnings`)
      : 'Safe Window (No Imminent Hazard)',
    thresholdStr: 'No Earnings Hazard within 5 Days',
    iconName: 'Calendar'
  };

  const criteriaList: DailyMinerviniCriteriaItem[] = [
    criterion1,
    criterion2,
    criterion3,
    criterion4,
    criterion5,
    criterion6,
    criterion7,
    criterion8
  ];

  const criteriaPassedCount = criteriaList.filter(c => c.passed).length;
  const totalCriteriaCount = criteriaList.length;
  const meetsThreePlusCriteria = criteriaPassedCount >= 3;

  // Composite Alpha Score (0 to 100)
  // Base weighted points:
  // - Criteria Count: up to 40 pts
  // - RS Rating: up to 25 pts
  // - Volume Dry-Up: up to 15 pts
  // - R/R Ratio: up to 10 pts
  // - Pivot Proximity: up to 10 pts
  let alphaScore = 0;
  alphaScore += (criteriaPassedCount / totalCriteriaCount) * 40;
  alphaScore += (Math.min(99, Math.max(0, stock.rsRating)) / 99) * 25;
  if (rule4Passed) alphaScore += 15;
  if (rule5Passed) alphaScore += 10;
  if (inBuyZone || (distanceToPivotPercent >= -2.5 && distanceToPivotPercent <= 0)) {
    alphaScore += 10;
  } else if (distanceToPivotPercent >= -5.0) {
    alphaScore += 5;
  }

  const compositeAlphaScore = Math.min(99, Math.round(alphaScore));

  let tierLabel: DailyStockEvaluation['tierLabel'] = 'BELOW_THRESHOLD';
  if (criteriaPassedCount >= 7) {
    tierLabel = 'SUPERPERFORMER_ELITE';
  } else if (criteriaPassedCount >= 5) {
    tierLabel = 'HIGH_CONVICTION_SETUP';
  } else if (criteriaPassedCount >= 3) {
    tierLabel = 'QUALIFIED_SEPA';
  } else {
    tierLabel = 'BELOW_THRESHOLD';
  }

  return {
    stock,
    criteriaPassedCount,
    totalCriteriaCount,
    criteriaList,
    meetsThreePlusCriteria,
    compositeAlphaScore,
    tierLabel,
    distanceToPivotPercent,
    inBuyZone,
    pivotStatus
  };
}

/**
 * Filter all stocks that meet 3+ Minervini criteria and sort by composite alpha score or criteria count.
 */
export function getDailyQualifiedStocks(stocks: MinerviniTradeSetup[], minCriteria = 3): DailyStockEvaluation[] {
  const evaluations = stocks.map(evaluateStockDailyCriteria);
  const qualified = evaluations.filter(e => e.criteriaPassedCount >= minCriteria);
  
  // Sort by composite alpha score descending, then criteria count descending
  qualified.sort((a, b) => {
    if (b.criteriaPassedCount !== a.criteriaPassedCount) {
      return b.criteriaPassedCount - a.criteriaPassedCount;
    }
    return b.compositeAlphaScore - a.compositeAlphaScore;
  });

  return qualified;
}

/**
 * LocalStorage keys & defaults for user's Daily Ranked Top Picks
 */
const STORAGE_KEY_DAILY_TOP_PICKS = 'gsa_daily_ranked_picks_v1';
const STORAGE_KEY_DAILY_CHECKLIST = 'gsa_daily_morning_checklist_v1';

export function loadSavedDailyRankedPicks(): DailyRankedPick[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY_DAILY_TOP_PICKS);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to load saved daily top picks:', err);
    return [];
  }
}

export function saveDailyRankedPicks(picks: DailyRankedPick[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_DAILY_TOP_PICKS, JSON.stringify(picks));
  } catch (err) {
    console.error('Failed to save daily top picks:', err);
  }
}

export interface DailyMorningChecklistState {
  marketTrendConfirmed: boolean;
  leadersReviewed: boolean;
  stopsAudited: boolean;
  pivotOrdersStaged: boolean;
  positionSizingCalculated: boolean;
  emotionalMindsetDisciplined: boolean;
}

export const DEFAULT_MORNING_CHECKLIST: DailyMorningChecklistState = {
  marketTrendConfirmed: true,
  leadersReviewed: true,
  stopsAudited: false,
  pivotOrdersStaged: false,
  positionSizingCalculated: false,
  emotionalMindsetDisciplined: true
};

export function loadSavedMorningChecklist(): DailyMorningChecklistState {
  try {
    const data = localStorage.getItem(STORAGE_KEY_DAILY_CHECKLIST);
    if (!data) return DEFAULT_MORNING_CHECKLIST;
    return JSON.parse(data);
  } catch (err) {
    return DEFAULT_MORNING_CHECKLIST;
  }
}

export function saveMorningChecklist(checklist: DailyMorningChecklistState): void {
  try {
    localStorage.setItem(STORAGE_KEY_DAILY_CHECKLIST, JSON.stringify(checklist));
  } catch (err) {
    console.error('Failed to save daily checklist:', err);
  }
}

/**
 * Generate a clean, editorial Markdown daily top picks briefing report for clipboard/export.
 */
export function generateDailyBriefingReport(
  evaluations: DailyStockEvaluation[],
  rankedPicks: DailyRankedPick[],
  selectedDate: string
): string {
  const rankedMap = new Map<string, DailyRankedPick>();
  rankedPicks.forEach(p => rankedMap.set(p.ticker, p));

  const rankedItems = evaluations
    .filter(e => rankedMap.has(e.stock.ticker))
    .sort((a, b) => {
      const rankA = rankedMap.get(a.stock.ticker)?.rank || 999;
      const rankB = rankedMap.get(b.stock.ticker)?.rank || 999;
      return rankA - rankB;
    });

  let text = `# 🏆 MARK MINERVINI SEPA — DAILY REVIEW & TOP PICKS BRIEFING\n`;
  text += `**Date:** ${selectedDate} | **Market Trend:** Confirmed Stage 2 Uptrend\n`;
  text += `**Qualified Setups (3+ Criteria):** ${evaluations.length} Stocks | **Active Ranked Top Picks:** ${rankedItems.length} Focus Setups\n\n`;
  text += `---\n\n`;

  text += `## 🎯 DAILY RANKED TOP PICKS (PRIORITY EXECUTION ORDER)\n\n`;
  if (rankedItems.length === 0) {
    text += `*No stocks manually assigned to top picks rank yet. Review the qualified list below to rank today's setups.*\n\n`;
  } else {
    rankedItems.forEach(item => {
      const rankInfo = rankedMap.get(item.stock.ticker)!;
      const stock = item.stock;
      text += `### #${rankInfo.rank} | **${stock.ticker}** — ${stock.name} (${stock.exchange})\n`;
      text += `- **Conviction:** ${rankInfo.conviction.replace(/_/g, ' ')} | **Action Plan:** ${rankInfo.action.replace(/_/g, ' ')}\n`;
      text += `- **Current Price:** ₹${stock.currentPrice.toFixed(2)} (${stock.changePercent >= 0 ? '+' : ''}${stock.changePercent.toFixed(2)}%)\n`;
      text += `- **Pivot Entry Price:** ₹${stock.pivotPrice.toFixed(2)} (Buy Zone: ₹${stock.pivotPrice.toFixed(2)} – ₹${stock.buyZoneMax.toFixed(2)})\n`;
      text += `- **Stop Loss:** ₹${stock.stopLossPrice.toFixed(2)} (-${Math.abs(stock.stopLossPercent).toFixed(1)}%) | **Target (3:1 R/R):** ₹${stock.target1Price.toFixed(2)} (+${stock.target1Percent}%)\n`;
      text += `- **RS Rating:** ${stock.rsRating} | **SEPA Criteria Passed:** ${item.criteriaPassedCount}/${item.totalCriteriaCount} Criteria | **Alpha Score:** ${item.compositeAlphaScore}/100\n`;
      text += `- **Pattern & Base:** ${stock.patternType} (${stock.vcpStage}) with ${stock.volumeDryUpPercent?.toFixed(1)}% Volume Dry-Up\n`;
      if (rankInfo.notes) {
        text += `- **Trader Execution Notes:** "${rankInfo.notes}"\n`;
      }
      text += `\n`;
    });
  }

  text += `---\n\n`;
  text += `## 📊 COMPLETE QUALIFIED UNIVERSE (MEETING 3+ MINERVINI CRITERIA)\n\n`;
  text += `| Rank / Ticker | Company | Exchange | RS Rating | Criteria Passed | Alpha Score | Pivot Entry | Stop Loss | Status |\n`;
  text += `|---|---|---|---|---|---|---|---|---|\n`;
  evaluations.forEach((item, idx) => {
    const isRanked = rankedMap.has(item.stock.ticker);
    const rankLabel = isRanked ? `#${rankedMap.get(item.stock.ticker)!.rank} ⭐` : `${idx + 1}`;
    text += `| ${rankLabel} **${item.stock.ticker}** | ${item.stock.name} | ${item.stock.exchange} | ${item.stock.rsRating} | ${item.criteriaPassedCount}/8 | ${item.compositeAlphaScore}/100 | ₹${item.stock.pivotPrice.toFixed(2)} | ₹${item.stock.stopLossPrice.toFixed(2)} (-${Math.abs(item.stock.stopLossPercent).toFixed(1)}%) | ${item.pivotStatus.replace(/_/g, ' ')} |\n`;
  });

  text += `\n---\n`;
  text += `*Generated automatically by Mark Minervini SEPA Engine • Growth Stock Alpha*\n`;
  return text;
}
