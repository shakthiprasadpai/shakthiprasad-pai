import { MinerviniTradeSetup } from '../types';

export interface ChartlinkScannerPreset {
  id: string;
  name: string;
  category: 'STAGE_2' | 'VCP_DRYUP' | 'PIVOT_BREAKOUT' | 'POCKET_PIVOT' | 'SUPERPERFORMANCE' | 'BEARISH_STAGE_4';
  tag: string;
  badgeColor: string;
  description: string;
  chartinkFormula: string;
  chartinkUrl: string;
  filterFn: (stock: MinerviniTradeSetup) => boolean;
}

export const CHARTLINK_SCANNER_PRESETS: ChartlinkScannerPreset[] = [
  {
    id: 'stage2_trend_template',
    name: 'Minervini Stage 2 Trend Template (8 Criteria)',
    category: 'STAGE_2',
    tag: 'STAGE 2 UPTREND',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    description: 'Filters Indian NSE cash equities trading above rising 50, 150, and 200 daily SMAs, at least 25% off 52-week lows, and within 25% of 52-week highs.',
    chartinkFormula: '( {cash} ( latest close > latest sma( latest close , 50 ) and latest sma( latest close , 50 ) > latest sma( latest close , 150 ) and latest sma( latest close , 150 ) > latest sma( latest close , 200 ) and latest sma( latest close , 200 ) > 20 days ago sma( latest close , 200 ) and latest close >= 1.25 * 52 week low and latest close >= 0.75 * 52 week high and latest volume > 100000 ) )',
    chartinkUrl: 'https://chartink.com/screener',
    filterFn: (stock) => {
      return stock.trendScore >= 6 && stock.currentPrice > stock.stopLossPrice;
    },
  },
  {
    id: 'vcp_volatility_dryup',
    name: 'VCP Volatility Contraction & Volume Dry-Up (T3/T4)',
    category: 'VCP_DRYUP',
    tag: 'VCP DRY-UP PRIMED',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    description: 'Pinpoints stocks undergoing narrow 3-day contraction (< 3.8% depth) with daily volume drying up by -40% to -65% compared to 50-day average volume.',
    chartinkFormula: '( {cash} ( latest close > latest sma( latest close , 50 ) and latest volume < 0.5 * latest sma( latest volume , 50 ) and ( ( latest high - latest low ) / latest close * 100 ) < 3.8 and latest close > 0.95 * latest max( 20 , latest high ) ) )',
    chartinkUrl: 'https://chartink.com/screener',
    filterFn: (stock) => {
      const volDry = stock.volumeDryUpPercent < -35;
      const tight = stock.isTightVolume || (stock.contractions && stock.contractions.length >= 2);
      return volDry || tight;
    },
  },
  {
    id: 'pivot_point_breakout',
    name: 'Minervini Pivot Point Breakout (200%+ Volume Surge)',
    category: 'PIVOT_BREAKOUT',
    tag: 'PIVOT BREAKOUT',
    badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    description: 'Detects stocks crossing above their 20-day resistance pivot level with volume surging at least 200% above 50-day average volume.',
    chartinkFormula: '( {cash} ( latest close > 1 day ago max( 20 , latest high ) and latest volume > 2 * latest sma( latest volume , 50 ) and latest close > latest open ) )',
    chartinkUrl: 'https://chartink.com/screener',
    filterFn: (stock) => {
      const isAboveOrAtPivot = stock.currentPrice >= stock.pivotPrice * 0.985;
      const strongVolume = (stock.volumeDryUpPercent && stock.volumeDryUpPercent < -20) || stock.rsRating >= 85;
      return isAboveOrAtPivot && strongVolume;
    },
  },
  {
    id: 'pocket_pivot_surge',
    name: 'Pocket Pivot (Aspray / Minervini) Surge Filter',
    category: 'POCKET_PIVOT',
    tag: 'POCKET PIVOT',
    badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    description: 'Volume on an up-day is higher than the single largest down-volume day in the prior 10 sessions while price hugs the rising 10 EMA / 21 EMA.',
    chartinkFormula: '( {cash} ( latest close > latest ema( latest close , 10 ) and latest close > 1 day ago close and latest volume > 100000 and latest volume > 1 day ago max( 10 , [ if latest close < 1 day ago close then latest volume else 0 ] ) ) )',
    chartinkUrl: 'https://chartink.com/screener',
    filterFn: (stock) => {
      return stock.rsRating >= 80 && stock.trendScore >= 7;
    },
  },
  {
    id: 'superperformance_leader',
    name: '52-Week High Superperformance Market Leader',
    category: 'SUPERPERFORMANCE',
    tag: '52W HIGH LEADER',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    description: 'Stocks printing brand new 52-week highs with top decile Relative Strength (RS Rating > 85), exhibiting classic Minervini momentum leadership.',
    chartinkFormula: '( {cash} ( latest close >= 52 week high and latest volume > 1.5 * latest sma( latest volume , 50 ) and latest close > latest sma( latest close , 50 ) and latest rsi( 14 ) > 60 ) )',
    chartinkUrl: 'https://chartink.com/screener',
    filterFn: (stock) => {
      const near52w = stock.currentPrice >= stock.pivotPrice * 0.97;
      return stock.rsRating >= 88 && near52w;
    },
  },
  {
    id: 'bearish_stage4_breakdown',
    name: 'Stage 4 Distribution Breakdown (Short Screener)',
    category: 'BEARISH_STAGE_4',
    tag: 'STAGE 4 BREAKDOWN',
    badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    description: 'Identifies institutional distribution breakdown setups where price slices below the declining 200 SMA on heavy selling volume.',
    chartinkFormula: '( {cash} ( latest close < latest sma( latest close , 200 ) and latest sma( latest close , 50 ) < latest sma( latest close , 200 ) and latest volume > 1.3 * latest sma( latest volume , 50 ) and latest close < latest open ) )',
    chartinkUrl: 'https://chartink.com/screener',
    filterFn: (stock) => {
      return stock.trendScore < 6;
    },
  },
];

export interface ChartlinkScanResult {
  scannerId: string;
  scannerName: string;
  matchedStocks: MinerviniTradeSetup[];
  scannedAt: string;
  totalUniverseCount: number;
}

/**
 * Execute scan against current in-memory universe
 */
export function runChartlinkScanOnUniverse(
  preset: ChartlinkScannerPreset,
  universe: MinerviniTradeSetup[]
): ChartlinkScanResult {
  const matched = universe.filter(preset.filterFn);
  return {
    scannerId: preset.id,
    scannerName: preset.name,
    matchedStocks: matched,
    scannedAt: new Date().toLocaleTimeString() + ' IST',
    totalUniverseCount: universe.length,
  };
}

/**
 * Parses user-pasted text from Chartink (comma-separated, newline-separated, or raw paste)
 * and resolves matching stocks from the known universe or creates synthetic SEPA setups.
 */
export function parseChartlinkImportText(
  rawText: string,
  universe: MinerviniTradeSetup[]
): {
  recognized: MinerviniTradeSetup[];
  rawCount: number;
} {
  if (!rawText.trim()) return { recognized: [], rawCount: 0 };

  // Split by comma, newline, spaces, or tabs
  const tokens = rawText
    .split(/[\n,\t\r\s]+/)
    .map((t) => t.trim().toUpperCase().replace(/[^A-Z0-9&_-]/g, ''))
    .filter((t) => t.length >= 2 && !['THE', 'LTD', 'LIMITED', 'NSE', 'BSE', 'SR', 'NO', 'STOCK', 'SYMBOL'].includes(t));

  const uniqueTickers = Array.from(new Set(tokens));

  const matched: MinerviniTradeSetup[] = [];

  for (const t of uniqueTickers) {
    const existing = universe.find(
      (s) => s.ticker.toUpperCase() === t || s.name.toUpperCase().includes(t)
    );
    if (existing) {
      if (!matched.some((m) => m.ticker === existing.ticker)) {
        matched.push(existing);
      }
    } else {
      // Create synthetic candidate setup for imported Chartink ticker
      const baseStock = universe[0];
      const syntheticSetup: MinerviniTradeSetup = {
        ...(baseStock || {}),
        ticker: t,
        name: `${t} (Chartink Imported)`,
        sector: 'NSE Equities',
        industry: 'Chartink Scanned',
        currentPrice: 850.0,
        changePercent: 2.4,
        sma50: 810.0,
        sma150: 760.0,
        sma200: 710.0,
        sma200_1mo_ago: 695.0,
        high52w: 875.0,
        low52w: 520.0,
        pivotPrice: 865.0,
        buyZoneMax: 882.3,
        stopLossPrice: 812.0,
        stopLossPercent: -6.1,
        target1Price: 1038.0,
        target1Percent: 20.0,
        target2Price: 1167.0,
        target2Percent: 35.0,
        riskRewardRatio: 3.28,
        rsRating: 88,
        trendScore: 8,
        avgVolume20d: 2500000,
        pivotVolume: 950000,
        volumeDryUpPercent: -48,
        isTightVolume: true,
        patternType: 'VCP (3 Contractions)',
        vcpStage: 'Breakout Pending',
        exchange: 'NSE',
        priceHistory: baseStock?.priceHistory || [],
        contractions: [
          {
            contractionIndex: 1,
            depthPercent: -14.2,
            durationDays: 20,
            volumeDryUpPercent: -25,
            startDate: '2025-01-01',
            endDate: '2025-01-20',
            highPrice: 865.0,
            lowPrice: 742.0,
          },
          {
            contractionIndex: 2,
            depthPercent: -7.1,
            durationDays: 10,
            volumeDryUpPercent: -42,
            startDate: '2025-01-21',
            endDate: '2025-01-31',
            highPrice: 855.0,
            lowPrice: 794.0,
          },
          {
            contractionIndex: 3,
            depthPercent: -3.2,
            durationDays: 5,
            volumeDryUpPercent: -58,
            startDate: '2025-02-01',
            endDate: '2025-02-06',
            highPrice: 850.0,
            lowPrice: 823.0,
          },
        ],
        sepaNotes: 'Imported from Chartink.com custom technical screener.',
      };
      matched.push(syntheticSetup);
    }
  }

  return {
    recognized: matched,
    rawCount: uniqueTickers.length,
  };
}
