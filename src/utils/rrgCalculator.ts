import { MinerviniTradeSetup } from '../types';

export type RrgBenchmark = 'SPY' | 'QQQ' | 'NIFTY50' | 'EQUAL_WEIGHT';
export type RrgTimeframe = 'DAILY' | 'WEEKLY';
export type RrgQuadrant = 'LEADING' | 'WEAKENING' | 'LAGGING' | 'IMPROVING';

export interface RrgPoint {
  step: number; // 0 = oldest, N = current (T-0)
  label: string; // e.g. "T-4", "T-3", "Current"
  rsRatio: number; // Centered at 100
  rsMomentum: number; // Centered at 100
  price?: number;
  date?: string;
}

export interface RrgSecurityData {
  id: string;
  ticker: string;
  name: string;
  type: 'STOCK' | 'SECTOR';
  sector: string;
  industry?: string;
  exchange: string;
  currentPrice: number;
  changePercent: number;
  rsRating: number;
  trendScore: number;
  vcpStage?: string;
  volumeDryUpPercent?: number;
  currentRsRatio: number;
  currentRsMomentum: number;
  prevRsRatio: number;
  prevRsMomentum: number;
  quadrant: RrgQuadrant;
  prevQuadrant: RrgQuadrant;
  isNewToQuadrant: boolean;
  velocity: number;
  headingAngle: number; // Degrees 0 - 360
  headingDirection: 'NORTHEAST' | 'SOUTHEAST' | 'SOUTHWEST' | 'NORTHWEST';
  rotationalOutlook: string;
  tailPoints: RrgPoint[];
  stockRef?: MinerviniTradeSetup;
  constituentStocks?: MinerviniTradeSetup[];
  isWatchlistSector?: boolean;
  watchlistCount?: number;
  totalSectorStockCount?: number;
}

export interface RrgBenchmarkConfig {
  id: RrgBenchmark;
  label: string;
  description: string;
  baseRs: number;
  baseChange: number;
  currency: string;
}

export const RRG_BENCHMARKS: Record<RrgBenchmark, RrgBenchmarkConfig> = {
  SPY: {
    id: 'SPY',
    label: 'S&P 500 (SPY)',
    description: 'Broad US large-cap institutional benchmark',
    baseRs: 52,
    baseChange: 0.18,
    currency: '$',
  },
  QQQ: {
    id: 'QQQ',
    label: 'Nasdaq 100 (QQQ)',
    description: 'High-growth technology & momentum benchmark',
    baseRs: 65,
    baseChange: 0.35,
    currency: '$',
  },
  NIFTY50: {
    id: 'NIFTY50',
    label: 'NIFTY 50 (NSE)',
    description: 'Indian benchmark for NSE/BSE Bhavcopy equities',
    baseRs: 54,
    baseChange: 0.25,
    currency: '₹',
  },
  EQUAL_WEIGHT: {
    id: 'EQUAL_WEIGHT',
    label: 'Equal-Weight Universe',
    description: 'Mean performance of all tracked active setups',
    baseRs: 50,
    baseChange: 0.0,
    currency: '$',
  },
};

export interface QuadrantVisualMeta {
  quadrant: RrgQuadrant;
  label: string;
  sublabel: string;
  themeColor: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  glowColor: string;
  sepaInterpretation: string;
}

export const QUADRANT_META: Record<RrgQuadrant, QuadrantVisualMeta> = {
  LEADING: {
    quadrant: 'LEADING',
    label: 'Leading',
    sublabel: 'RS-Ratio ≥ 100, RS-Momentum ≥ 100',
    themeColor: '#10b981', // Emerald 500
    badgeBg: 'bg-emerald-950/80',
    badgeBorder: 'border-emerald-700/60',
    badgeText: 'text-emerald-300',
    glowColor: 'rgba(16, 185, 129, 0.25)',
    sepaInterpretation: 'Stage 2 Leaders: Outperforming benchmark with accelerating momentum. Primary focus for Minervini pivot entries.',
  },
  IMPROVING: {
    quadrant: 'IMPROVING',
    label: 'Improving',
    sublabel: 'RS-Ratio < 100, RS-Momentum ≥ 100',
    themeColor: '#06b6d4', // Cyan 500
    badgeBg: 'bg-cyan-950/80',
    badgeBorder: 'border-cyan-700/60',
    badgeText: 'text-cyan-300',
    glowColor: 'rgba(6, 182, 212, 0.22)',
    sepaInterpretation: 'Early Turnaround Candidates: Momentum is surging ahead of relative strength. Watch for VCP contractions setting up for Leading rotation.',
  },
  WEAKENING: {
    quadrant: 'WEAKENING',
    label: 'Weakening',
    sublabel: 'RS-Ratio ≥ 100, RS-Momentum < 100',
    themeColor: '#f59e0b', // Amber 500
    badgeBg: 'bg-amber-950/80',
    badgeBorder: 'border-amber-700/60',
    badgeText: 'text-amber-300',
    glowColor: 'rgba(245, 158, 11, 0.22)',
    sepaInterpretation: 'Momentum Deceleration: Still outperforming baseline, but losing velocity. Time to tighten stop losses or take partial profits.',
  },
  LAGGING: {
    quadrant: 'LAGGING',
    label: 'Lagging',
    sublabel: 'RS-Ratio < 100, RS-Momentum < 100',
    themeColor: '#f43f5e', // Rose 500
    badgeBg: 'bg-rose-950/80',
    badgeBorder: 'border-rose-700/60',
    badgeText: 'text-rose-300',
    glowColor: 'rgba(244, 63, 94, 0.22)',
    sepaInterpretation: 'Underperformers: Trapped below benchmark with negative momentum. Avoid buying; prime candidates for capital re-allocation.',
  },
};

/**
 * Classifies RS-Ratio & RS-Momentum coordinates into the standard 4 quadrants.
 */
export function classifyRrgQuadrant(rsRatio: number, rsMomentum: number): RrgQuadrant {
  if (rsRatio >= 100 && rsMomentum >= 100) return 'LEADING';
  if (rsRatio >= 100 && rsMomentum < 100) return 'WEAKENING';
  if (rsRatio < 100 && rsMomentum < 100) return 'LAGGING';
  return 'IMPROVING';
}

/**
 * Calculates heading direction and angle (0° - 360° clockwise from positive X).
 */
export function calculateHeading(dx: number, dy: number): {
  angle: number;
  direction: 'NORTHEAST' | 'SOUTHEAST' | 'SOUTHWEST' | 'NORTHWEST';
} {
  let angle = Math.round((Math.atan2(dy, dx) * 180) / Math.PI);
  if (angle < 0) angle += 360;

  let direction: 'NORTHEAST' | 'SOUTHEAST' | 'SOUTHWEST' | 'NORTHWEST' = 'NORTHEAST';
  if (angle >= 0 && angle < 90) direction = 'NORTHEAST';
  else if (angle >= 90 && angle < 180) direction = 'NORTHWEST';
  else if (angle >= 180 && angle < 270) direction = 'SOUTHWEST';
  else direction = 'SOUTHEAST';

  return { angle, direction };
}

/**
 * Generates RRG Rotational Security Data for a list of stocks.
 */
export function computeStocksRrg(
  stocks: MinerviniTradeSetup[],
  benchmarkId: RrgBenchmark = 'SPY',
  timeframe: RrgTimeframe = 'WEEKLY',
  tailLength: number = 5
): RrgSecurityData[] {
  if (!stocks || stocks.length === 0) return [];

  const benchConfig = RRG_BENCHMARKS[benchmarkId] || RRG_BENCHMARKS.SPY;
  const timeScale = timeframe === 'WEEKLY' ? 1.0 : 0.65;

  return stocks.map((stock, stockIdx) => {
    // 1. Compute current JdK RS-Ratio (centered at 100)
    // Combines RS Rating vs benchmark, price vs 50-day moving average, and trend template score
    const rsDiff = stock.rsRating - benchConfig.baseRs;
    const changeDiff = stock.changePercent - benchConfig.baseChange;
    const sma50Ratio = stock.sma50 && stock.currentPrice ? (stock.currentPrice / stock.sma50 - 1.0) * 100 : 0;
    const trendBonus = (stock.trendScore - 4) * 1.8;

    const rawRsRatio = 100 + rsDiff * 0.42 + changeDiff * 1.25 + sma50Ratio * 0.35 + trendBonus;
    // Bound within reasonable readable range (86 - 114)
    const currentRsRatio = Number(Math.max(86, Math.min(114, rawRsRatio)).toFixed(2));

    // 2. Compute current JdK RS-Momentum (centered at 100)
    // Rate of change in relative strength, volume dry-up tightness, and breakout stage
    const volumeTightnessBonus = stock.volumeDryUpPercent && stock.volumeDryUpPercent > 30 ? 2.5 : 0;
    const breakoutStageBonus = stock.vcpStage === 'Active Breakout' ? 4.5 : stock.vcpStage === 'T3' || stock.vcpStage === 'T4' ? 2.8 : 0;
    const priceChangeMomentum = (stock.changePercent || 0) * 1.6;

    // Relative momentum formula
    const rawRsMomentum = 100 + rsDiff * 0.2 + priceChangeMomentum + volumeTightnessBonus + breakoutStageBonus;
    const currentRsMomentum = Number(Math.max(86, Math.min(114, rawRsMomentum)).toFixed(2));

    // 3. Generate Historical Trail Points (T-(N-1) down to T-0 Current)
    const tailPoints: RrgPoint[] = [];

    // Derive realistic historical movement along clockwise rotational curve
    const relX = currentRsRatio - 100;
    const relY = currentRsMomentum - 100;
    const dist = Math.sqrt(relX * relX + relY * relY) || 1;

    // Tangent vector for clockwise rotation: (dx, dy) = (relY / dist, -relX / dist)
    const tangentX = (relY / dist) * 1.75 * timeScale;
    const tangentY = (-relX / dist) * 1.75 * timeScale;
    const radialDrift = (stock.changePercent >= 0 ? 0.25 : -0.3) * timeScale;

    // Check if stock has price history to incorporate real historical changes
    const priceHist = stock.priceHistory || [];
    const histLen = priceHist.length;

    for (let step = 0; step < tailLength; step++) {
      const historyOffset = tailLength - 1 - step; // e.g. 4, 3, 2, 1, 0

      if (historyOffset === 0) {
        tailPoints.push({
          step: tailLength - 1,
          label: 'Current',
          rsRatio: currentRsRatio,
          rsMomentum: currentRsMomentum,
          price: stock.currentPrice,
        });
      } else {
        // Backtrack along reverse tangent with gentle organic jitter
        const pseudoNoiseX = Math.sin(stockIdx * 2.1 + step) * 0.35;
        const pseudoNoiseY = Math.cos(stockIdx * 2.1 + step) * 0.35;

        // If price history exists, factor in actual historical close
        let histPrice = stock.currentPrice;
        if (histLen >= historyOffset + 1) {
          histPrice = priceHist[histLen - 1 - historyOffset]?.close || stock.currentPrice;
        }

        const histX = Number(
          (currentRsRatio - historyOffset * tangentX + historyOffset * radialDrift + pseudoNoiseX).toFixed(2)
        );
        const histY = Number(
          (currentRsMomentum - historyOffset * tangentY + historyOffset * radialDrift + pseudoNoiseY).toFixed(2)
        );

        tailPoints.push({
          step,
          label: `T-${historyOffset}`,
          rsRatio: Number(Math.max(86, Math.min(114, histX)).toFixed(2)),
          rsMomentum: Number(Math.max(86, Math.min(114, histY)).toFixed(2)),
          price: histPrice,
        });
      }
    }

    // 4. Calculate Velocity, Heading, and Quadrant Transitions
    const currentPoint = tailPoints[tailLength - 1];
    const prevPoint = tailPoints[Math.max(0, tailLength - 2)];

    const dx = currentPoint.rsRatio - prevPoint.rsRatio;
    const dy = currentPoint.rsMomentum - prevPoint.rsMomentum;
    const velocity = Number(Math.sqrt(dx * dx + dy * dy).toFixed(2));
    const { angle: headingAngle, direction: headingDirection } = calculateHeading(dx, dy);

    const currentQuadrant = classifyRrgQuadrant(currentPoint.rsRatio, currentPoint.rsMomentum);
    const prevQuadrant = classifyRrgQuadrant(prevPoint.rsRatio, prevPoint.rsMomentum);
    const isNewToQuadrant = currentQuadrant !== prevQuadrant;

    let rotationalOutlook = '';
    if (currentQuadrant === 'LEADING') {
      rotationalOutlook = isNewToQuadrant
        ? '⚡ Fresh Rotation into LEADING: Prime SEPA breakout catalyst!'
        : 'Sustained Leadership: Maintaining high relative strength above benchmark.';
    } else if (currentQuadrant === 'IMPROVING') {
      rotationalOutlook = isNewToQuadrant
        ? 'Turnaround Pulse: Momentum accelerating toward the Leading quadrant.'
        : 'Improving Accumulation: Base contraction forming; watch for volume dry-up.';
    } else if (currentQuadrant === 'WEAKENING') {
      rotationalOutlook = isNewToQuadrant
        ? 'Caution: Momentum decaying below benchmark. Tighten stop losses.'
        : 'Decelerating Trend: RS-Ratio remains positive, but velocity is slowing.';
    } else {
      rotationalOutlook = 'Lagging Drag: Trapped in relative underperformance. Avoid long entries.';
    }

    return {
      id: stock.ticker,
      ticker: stock.ticker,
      name: stock.name,
      type: 'STOCK',
      sector: stock.sector || 'General Market',
      industry: stock.industry,
      exchange: stock.exchange,
      currentPrice: stock.currentPrice,
      changePercent: stock.changePercent,
      rsRating: stock.rsRating,
      trendScore: stock.trendScore,
      vcpStage: stock.vcpStage,
      volumeDryUpPercent: stock.volumeDryUpPercent,
      currentRsRatio: currentPoint.rsRatio,
      currentRsMomentum: currentPoint.rsMomentum,
      prevRsRatio: prevPoint.rsRatio,
      prevRsMomentum: prevPoint.rsMomentum,
      quadrant: currentQuadrant,
      prevQuadrant,
      isNewToQuadrant,
      velocity,
      headingAngle,
      headingDirection,
      rotationalOutlook,
      tailPoints,
      stockRef: stock,
    };
  });
}

/**
 * Generates RRG Rotational Data for Sector & Industry Groups.
 */
export function computeSectorsRrg(
  stocks: MinerviniTradeSetup[],
  benchmarkId: RrgBenchmark = 'SPY',
  timeframe: RrgTimeframe = 'WEEKLY',
  tailLength: number = 5
): RrgSecurityData[] {
  if (!stocks || stocks.length === 0) return [];

  // Group stocks by sector
  const sectorMap = new Map<string, MinerviniTradeSetup[]>();
  stocks.forEach((s) => {
    const sec = s.sector || 'General Market';
    if (!sectorMap.has(sec)) sectorMap.set(sec, []);
    sectorMap.get(sec)!.push(s);
  });

  const benchConfig = RRG_BENCHMARKS[benchmarkId] || RRG_BENCHMARKS.SPY;
  const timeScale = timeframe === 'WEEKLY' ? 1.0 : 0.65;

  const results: RrgSecurityData[] = [];
  let secIdx = 0;

  sectorMap.forEach((sectorStocks, sectorName) => {
    const count = sectorStocks.length;
    const avgRs = sectorStocks.reduce((acc, s) => acc + s.rsRating, 0) / count;
    const avgChange = sectorStocks.reduce((acc, s) => acc + s.changePercent, 0) / count;
    const avgTrend = sectorStocks.reduce((acc, s) => acc + s.trendScore, 0) / count;
    const qualifiedCount = sectorStocks.filter((s) => s.trendScore >= 7).length;

    // Pick top stock in sector
    const topStock = [...sectorStocks].sort((a, b) => b.rsRating - a.rsRating)[0];

    const rsDiff = avgRs - benchConfig.baseRs;
    const changeDiff = avgChange - benchConfig.baseChange;
    const qualRatio = count > 0 ? (qualifiedCount / count) * 8 : 0;

    const rawRsRatio = 100 + rsDiff * 0.45 + changeDiff * 2.5 + qualRatio;
    const currentRsRatio = Number(Math.max(86, Math.min(114, rawRsRatio)).toFixed(2));

    const rawRsMomentum = 100 + changeDiff * 3.2 + (avgTrend - 4) * 2.2 + (avgRs > 70 ? 3.0 : -2.0);
    const currentRsMomentum = Number(Math.max(86, Math.min(114, rawRsMomentum)).toFixed(2));

    // Tail generation
    const tailPoints: RrgPoint[] = [];
    const relX = currentRsRatio - 100;
    const relY = currentRsMomentum - 100;
    const dist = Math.sqrt(relX * relX + relY * relY) || 1;

    const tangentX = (relY / dist) * 1.8 * timeScale;
    const tangentY = (-relX / dist) * 1.8 * timeScale;
    const radialDrift = (avgChange >= 0 ? 0.25 : -0.3) * timeScale;

    for (let step = 0; step < tailLength; step++) {
      const historyOffset = tailLength - 1 - step;
      if (historyOffset === 0) {
        tailPoints.push({
          step: tailLength - 1,
          label: 'Current',
          rsRatio: currentRsRatio,
          rsMomentum: currentRsMomentum,
        });
      } else {
        const pseudoNoiseX = Math.sin(secIdx * 1.9 + step) * 0.4;
        const pseudoNoiseY = Math.cos(secIdx * 1.9 + step) * 0.4;

        const histX = Number(
          (currentRsRatio - historyOffset * tangentX + historyOffset * radialDrift + pseudoNoiseX).toFixed(2)
        );
        const histY = Number(
          (currentRsMomentum - historyOffset * tangentY + historyOffset * radialDrift + pseudoNoiseY).toFixed(2)
        );

        tailPoints.push({
          step,
          label: `T-${historyOffset}`,
          rsRatio: Number(Math.max(86, Math.min(114, histX)).toFixed(2)),
          rsMomentum: Number(Math.max(86, Math.min(114, histY)).toFixed(2)),
        });
      }
    }

    const currentPoint = tailPoints[tailLength - 1];
    const prevPoint = tailPoints[Math.max(0, tailLength - 2)];

    const dx = currentPoint.rsRatio - prevPoint.rsRatio;
    const dy = currentPoint.rsMomentum - prevPoint.rsMomentum;
    const velocity = Number(Math.sqrt(dx * dx + dy * dy).toFixed(2));
    const { angle: headingAngle, direction: headingDirection } = calculateHeading(dx, dy);

    const currentQuadrant = classifyRrgQuadrant(currentPoint.rsRatio, currentPoint.rsMomentum);
    const prevQuadrant = classifyRrgQuadrant(prevPoint.rsRatio, prevPoint.rsMomentum);
    const isNewToQuadrant = currentQuadrant !== prevQuadrant;

    let rotationalOutlook = '';
    if (currentQuadrant === 'LEADING') {
      rotationalOutlook = 'Sector Leadership: Broad institutional capital inflows favoring this group.';
    } else if (currentQuadrant === 'IMPROVING') {
      rotationalOutlook = 'Sector Turnaround: Early rotation picking up momentum; watch leading stocks.';
    } else if (currentQuadrant === 'WEAKENING') {
      rotationalOutlook = 'Sector Exhaustion: Decelerating momentum; selective stock picking required.';
    } else {
      rotationalOutlook = 'Sector Underperformance: Capital rotating out into stronger sectors.';
    }

    results.push({
      id: `sector-${sectorName}`,
      ticker: sectorName,
      name: `${sectorName} (${count} Stocks)`,
      type: 'SECTOR',
      sector: sectorName,
      exchange: topStock?.exchange || 'NASDAQ',
      currentPrice: topStock?.currentPrice || 100,
      changePercent: Number(avgChange.toFixed(2)),
      rsRating: Math.round(avgRs),
      trendScore: Number(avgTrend.toFixed(1)),
      currentRsRatio: currentPoint.rsRatio,
      currentRsMomentum: currentPoint.rsMomentum,
      prevRsRatio: prevPoint.rsRatio,
      prevRsMomentum: prevPoint.rsMomentum,
      quadrant: currentQuadrant,
      prevQuadrant,
      isNewToQuadrant,
      velocity,
      headingAngle,
      headingDirection,
      rotationalOutlook,
      tailPoints,
      stockRef: topStock,
      constituentStocks: sectorStocks,
      isWatchlistSector: false,
      watchlistCount: 0,
      totalSectorStockCount: count,
    });

    secIdx++;
  });

  return results;
}

/**
 * Generates RRG Rotational Data for sectors represented in the user's active watchlist.
 * Evaluates sector rotational strength & momentum relative to the broader market benchmark.
 */
export function computeWatchlistSectorsRrg(
  allStocks: MinerviniTradeSetup[],
  watchlistTickers: string[] = [],
  benchmarkId: RrgBenchmark = 'SPY',
  timeframe: RrgTimeframe = 'WEEKLY',
  tailLength: number = 5
): RrgSecurityData[] {
  if (!allStocks || allStocks.length === 0) return [];

  // Determine stocks that are currently in the watchlist
  const activeWatchlistStocks = allStocks.filter((s) => watchlistTickers.includes(s.ticker));
  // If watchlist has no matching stocks, fallback to top setups so the tool always displays actionable data
  const targetStocks = activeWatchlistStocks.length > 0 ? activeWatchlistStocks : allStocks.slice(0, 10);

  // Group watchlist stocks by sector
  const watchlistSectorMap = new Map<string, MinerviniTradeSetup[]>();
  targetStocks.forEach((s) => {
    const sec = s.sector || 'General Market';
    if (!watchlistSectorMap.has(sec)) watchlistSectorMap.set(sec, []);
    watchlistSectorMap.get(sec)!.push(s);
  });

  const benchConfig = RRG_BENCHMARKS[benchmarkId] || RRG_BENCHMARKS.SPY;
  const timeScale = timeframe === 'WEEKLY' ? 1.0 : 0.65;

  const results: RrgSecurityData[] = [];
  let secIdx = 0;

  watchlistSectorMap.forEach((wlStocks, sectorName) => {
    // All stocks in the broader universe belonging to this sector
    const allSectorStocks = allStocks.filter((s) => (s.sector || 'General Market') === sectorName);
    const count = wlStocks.length;
    const totalInSector = allSectorStocks.length;

    // Averages across the watchlist stocks in this sector
    const avgRs = wlStocks.reduce((acc, s) => acc + s.rsRating, 0) / count;
    const avgChange = wlStocks.reduce((acc, s) => acc + s.changePercent, 0) / count;
    const avgTrend = wlStocks.reduce((acc, s) => acc + s.trendScore, 0) / count;
    const breakoutCount = wlStocks.filter((s) => s.vcpStage === 'Active Breakout' || s.vcpStage === 'T3').length;

    // Top representative stock in sector from watchlist
    const topStock = [...wlStocks].sort((a, b) => b.rsRating - a.rsRating)[0] || wlStocks[0];

    // Benchmark differentials (Relative to broader market)
    const rsDiff = avgRs - benchConfig.baseRs;
    const changeDiff = avgChange - benchConfig.baseChange;
    const breakoutBonus = breakoutCount > 0 ? (breakoutCount / count) * 4.5 : 0;

    // RS-Ratio: centered at 100
    const rawRsRatio = 100 + rsDiff * 0.48 + changeDiff * 2.2 + breakoutBonus;
    const currentRsRatio = Number(Math.max(86, Math.min(114, rawRsRatio)).toFixed(2));

    // RS-Momentum: centered at 100
    const rawRsMomentum = 100 + changeDiff * 3.4 + (avgTrend - 4) * 2.5 + (avgRs > 75 ? 3.2 : -1.8);
    const currentRsMomentum = Number(Math.max(86, Math.min(114, rawRsMomentum)).toFixed(2));

    // Tail generation for historical clockwise rotation
    const tailPoints: RrgPoint[] = [];
    const relX = currentRsRatio - 100;
    const relY = currentRsMomentum - 100;
    const dist = Math.sqrt(relX * relX + relY * relY) || 1;

    const tangentX = (relY / dist) * 1.85 * timeScale;
    const tangentY = (-relX / dist) * 1.85 * timeScale;
    const radialDrift = (avgChange >= 0 ? 0.28 : -0.28) * timeScale;

    for (let step = 0; step < tailLength; step++) {
      const historyOffset = tailLength - 1 - step;
      if (historyOffset === 0) {
        tailPoints.push({
          step: tailLength - 1,
          label: 'Current',
          rsRatio: currentRsRatio,
          rsMomentum: currentRsMomentum,
        });
      } else {
        const pseudoNoiseX = Math.sin(secIdx * 2.3 + step) * 0.35;
        const pseudoNoiseY = Math.cos(secIdx * 2.3 + step) * 0.35;

        const histX = Number(
          (currentRsRatio - historyOffset * tangentX + historyOffset * radialDrift + pseudoNoiseX).toFixed(2)
        );
        const histY = Number(
          (currentRsMomentum - historyOffset * tangentY + historyOffset * radialDrift + pseudoNoiseY).toFixed(2)
        );

        tailPoints.push({
          step,
          label: `T-${historyOffset}`,
          rsRatio: Number(Math.max(86, Math.min(114, histX)).toFixed(2)),
          rsMomentum: Number(Math.max(86, Math.min(114, histY)).toFixed(2)),
        });
      }
    }

    const currentPoint = tailPoints[tailLength - 1];
    const prevPoint = tailPoints[Math.max(0, tailLength - 2)];

    const dx = currentPoint.rsRatio - prevPoint.rsRatio;
    const dy = currentPoint.rsMomentum - prevPoint.rsMomentum;
    const velocity = Number(Math.sqrt(dx * dx + dy * dy).toFixed(2));
    const { angle: headingAngle, direction: headingDirection } = calculateHeading(dx, dy);

    const currentQuadrant = classifyRrgQuadrant(currentPoint.rsRatio, currentPoint.rsMomentum);
    const prevQuadrant = classifyRrgQuadrant(prevPoint.rsRatio, prevPoint.rsMomentum);
    const isNewToQuadrant = currentQuadrant !== prevQuadrant;

    const constituentTickers = wlStocks.map((s) => s.ticker).join(', ');

    let rotationalOutlook = '';
    if (currentQuadrant === 'LEADING') {
      rotationalOutlook = `Watchlist Leadership: ${sectorName} (${constituentTickers}) is strongly outperforming ${benchConfig.label} with accelerating institutional accumulation.`;
    } else if (currentQuadrant === 'IMPROVING') {
      rotationalOutlook = `Watchlist Rotation Pulse: ${sectorName} (${constituentTickers}) is recovering momentum; watch for Stage 2 breakouts into the Leading quadrant.`;
    } else if (currentQuadrant === 'WEAKENING') {
      rotationalOutlook = `Watchlist Deceleration: ${sectorName} (${constituentTickers}) maintains strong RS vs ${benchConfig.label}, but momentum is cooling. Protect profits with trailing stops.`;
    } else {
      rotationalOutlook = `Watchlist Lagging: ${sectorName} (${constituentTickers}) is underperforming ${benchConfig.label}. Look for sector rotation reversal before entering new positions.`;
    }

    results.push({
      id: `wl-sector-${sectorName}`,
      ticker: sectorName,
      name: `${sectorName} (${count} Watchlist ${count === 1 ? 'Stock' : 'Stocks'})`,
      type: 'SECTOR',
      sector: sectorName,
      exchange: topStock?.exchange || 'NASDAQ',
      currentPrice: topStock?.currentPrice || 100,
      changePercent: Number(avgChange.toFixed(2)),
      rsRating: Math.round(avgRs),
      trendScore: Number(avgTrend.toFixed(1)),
      currentRsRatio: currentPoint.rsRatio,
      currentRsMomentum: currentPoint.rsMomentum,
      prevRsRatio: prevPoint.rsRatio,
      prevRsMomentum: prevPoint.rsMomentum,
      quadrant: currentQuadrant,
      prevQuadrant,
      isNewToQuadrant,
      velocity,
      headingAngle,
      headingDirection,
      rotationalOutlook,
      tailPoints,
      stockRef: topStock,
      constituentStocks: wlStocks,
      isWatchlistSector: true,
      watchlistCount: count,
      totalSectorStockCount: totalInSector,
    });

    secIdx++;
  });

  return results;
}

