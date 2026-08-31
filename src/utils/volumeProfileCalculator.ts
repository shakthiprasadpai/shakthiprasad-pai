import { PricePoint, MinerviniTradeSetup } from '../types';

export interface VolumeProfileBin {
  id: string;
  priceLow: number;
  priceHigh: number;
  priceMid: number;
  buyVolume: number;
  sellVolume: number;
  totalVolume: number;
  volumePercent: number; // percentage of max bin volume (0 - 100)
  totalVolumeSharePct: number; // % of total profile volume
  isPoc: boolean; // Point of Control (Highest Volume Node)
  isValueArea: boolean; // Falls inside the 70% Value Area
  isVah: boolean; // Value Area High boundary
  isVal: boolean; // Value Area Low boundary
  nodeType: 'POC' | 'VAH' | 'VAL' | 'HVN' | 'LVN' | 'STANDARD';
}

export interface VolumeProfileResult {
  bins: VolumeProfileBin[];
  totalVolume: number;
  maxBinVolume: number;
  pocPrice: number;
  pocVolume: number;
  vahPrice: number; // Value Area High (Upper Boundary of 70% volume)
  valPrice: number; // Value Area Low (Lower Boundary of 70% volume)
  valueAreaVolume: number;
  valueAreaPercent: number; // Target Value Area % (e.g., 70.0%)
  hvnLevels: { price: number; volume: number; label: string }[];
  lvnLevels: { price: number; volume: number; label: string }[];
  currentPricePosition: 'ABOVE_VAH' | 'INSIDE_VA_UPPER' | 'AT_POC' | 'INSIDE_VA_LOWER' | 'BELOW_VAL';
  supportInsight: {
    status: 'BULLISH_ACCEPTANCE' | 'POC_SUPPORT_TEST' | 'VAL_DEFENSE_ZONE' | 'BELOW_VALUE_DANGER';
    badgeLabel: string;
    badgeBg: string;
    badgeText: string;
    headline: string;
    detail: string;
    immediateSupportPrice: number;
    immediateResistancePrice: number;
  };
  priceMin: number;
  priceMax: number;
  lookbackCount: number;
  rangeType: 'ALL' | 'VCP_BASE' | 'LAST_60D';
}

/**
 * Calculates high-precision Volume Profile (Volume-at-Price Distribution)
 * including Point of Control (POC), Value Area High (VAH), Value Area Low (VAL),
 * and High/Low Volume Nodes to establish institutional support and accumulation zones.
 */
export function calculateVolumeProfile(
  stock: MinerviniTradeSetup,
  options?: {
    binCount?: number;
    valueAreaRatio?: number; // default 0.70 (70% standard)
    rangeType?: 'ALL' | 'VCP_BASE' | 'LAST_60D';
  }
): VolumeProfileResult {
  const binCount = Math.max(15, Math.min(50, options?.binCount || 28));
  const valueAreaRatio = options?.valueAreaRatio || 0.70;
  const rangeType = options?.rangeType || 'ALL';

  const rawHistory = stock.priceHistory || [];
  if (rawHistory.length === 0) {
    const fallbackPrice = stock.currentPrice || 100;
    return {
      bins: [],
      totalVolume: 0,
      maxBinVolume: 0,
      pocPrice: fallbackPrice,
      pocVolume: 0,
      vahPrice: fallbackPrice * 1.05,
      valPrice: fallbackPrice * 0.95,
      valueAreaVolume: 0,
      valueAreaPercent: 70,
      hvnLevels: [],
      lvnLevels: [],
      currentPricePosition: 'AT_POC',
      supportInsight: {
        status: 'POC_SUPPORT_TEST',
        badgeLabel: 'AT POC',
        badgeBg: 'bg-amber-100',
        badgeText: 'text-amber-900',
        headline: 'Volume Profile Initializing',
        detail: 'Price data is being computed for historical volume levels.',
        immediateSupportPrice: fallbackPrice * 0.95,
        immediateResistancePrice: fallbackPrice * 1.05,
      },
      priceMin: fallbackPrice * 0.9,
      priceMax: fallbackPrice * 1.1,
      lookbackCount: 0,
      rangeType,
    };
  }

  // Filter history based on range type
  let filteredHistory = [...rawHistory];
  if (rangeType === 'LAST_60D') {
    filteredHistory = rawHistory.slice(Math.max(0, rawHistory.length - 60));
  } else if (rangeType === 'VCP_BASE' && stock.contractions && stock.contractions.length > 0) {
    const baseStartDate = stock.contractions[0].startDate;
    const baseStartIndex = rawHistory.findIndex((p) => p.date >= baseStartDate);
    if (baseStartIndex >= 0) {
      filteredHistory = rawHistory.slice(baseStartIndex);
    }
  }

  // Find min and max price across selected history
  let priceMin = Number.POSITIVE_INFINITY;
  let priceMax = Number.NEGATIVE_INFINITY;

  filteredHistory.forEach((p) => {
    const low = p.low || p.close;
    const high = p.high || p.close;
    if (low < priceMin) priceMin = low;
    if (high > priceMax) priceMax = high;
  });

  // Ensure healthy padding
  if (priceMin === priceMax || !Number.isFinite(priceMin) || !Number.isFinite(priceMax)) {
    priceMin = stock.currentPrice * 0.85;
    priceMax = stock.currentPrice * 1.15;
  } else {
    const spread = priceMax - priceMin;
    priceMin = Math.max(0.01, priceMin - spread * 0.02);
    priceMax = priceMax + spread * 0.02;
  }

  const binStep = (priceMax - priceMin) / binCount;

  // Initialize bins
  const bins: VolumeProfileBin[] = [];
  for (let i = 0; i < binCount; i++) {
    const pLow = priceMin + i * binStep;
    const pHigh = pLow + binStep;
    bins.push({
      id: `vp-bin-${i}`,
      priceLow: Number(pLow.toFixed(2)),
      priceHigh: Number(pHigh.toFixed(2)),
      priceMid: Number(((pLow + pHigh) / 2).toFixed(2)),
      buyVolume: 0,
      sellVolume: 0,
      totalVolume: 0,
      volumePercent: 0,
      totalVolumeSharePct: 0,
      isPoc: false,
      isValueArea: false,
      isVah: false,
      isVal: false,
      nodeType: 'STANDARD',
    });
  }

  // Distribute volume into price bins using Typical Price and Range overlap
  let totalVolumeAccum = 0;

  filteredHistory.forEach((p) => {
    const vol = p.volume || 0;
    if (vol <= 0) return;

    totalVolumeAccum += vol;
    const isUpDay = p.close >= p.open;
    const dayLow = Math.max(priceMin, p.low || p.close);
    const dayHigh = Math.min(priceMax, p.high || p.close);
    const typicalPrice = (dayLow + dayHigh + p.close) / 3;

    // Find which bins intersect this bar's range
    const intersectingBins: number[] = [];
    bins.forEach((b, idx) => {
      if (dayHigh >= b.priceLow && dayLow <= b.priceHigh) {
        intersectingBins.push(idx);
      }
    });

    if (intersectingBins.length <= 1) {
      // Allocate to typical price bin
      const targetIdx = Math.min(
        binCount - 1,
        Math.max(0, Math.floor((typicalPrice - priceMin) / binStep))
      );
      if (isUpDay) {
        bins[targetIdx].buyVolume += vol;
      } else {
        bins[targetIdx].sellVolume += vol;
      }
      bins[targetIdx].totalVolume += vol;
    } else {
      // Allocate distributed weight across overlapping bins
      const volPerBin = vol / intersectingBins.length;
      intersectingBins.forEach((bIdx) => {
        if (isUpDay) {
          bins[bIdx].buyVolume += volPerBin;
        } else {
          bins[bIdx].sellVolume += volPerBin;
        }
        bins[bIdx].totalVolume += volPerBin;
      });
    }
  });

  // Identify Point of Control (POC) - bin with maximum total volume
  let maxBinVolume = 0;
  let pocIndex = 0;

  bins.forEach((b, idx) => {
    b.buyVolume = Math.round(b.buyVolume);
    b.sellVolume = Math.round(b.sellVolume);
    b.totalVolume = Math.round(b.totalVolume);

    if (b.totalVolume > maxBinVolume) {
      maxBinVolume = b.totalVolume;
      pocIndex = idx;
    }
  });

  bins[pocIndex].isPoc = true;
  bins[pocIndex].nodeType = 'POC';
  const pocPrice = bins[pocIndex].priceMid;
  const pocVolume = bins[pocIndex].totalVolume;

  // Calculate 70% Value Area expanding outward from the POC
  const targetVaVolume = totalVolumeAccum * valueAreaRatio;
  let currentVaVolume = bins[pocIndex].totalVolume;
  bins[pocIndex].isValueArea = true;

  let upperIdx = pocIndex;
  let lowerIdx = pocIndex;

  while (currentVaVolume < targetVaVolume && (upperIdx < binCount - 1 || lowerIdx > 0)) {
    const nextUpperVol = upperIdx < binCount - 1 ? bins[upperIdx + 1].totalVolume : -1;
    const nextLowerVol = lowerIdx > 0 ? bins[lowerIdx - 1].totalVolume : -1;

    if (nextUpperVol >= nextLowerVol && nextUpperVol > -1) {
      upperIdx++;
      bins[upperIdx].isValueArea = true;
      currentVaVolume += bins[upperIdx].totalVolume;
    } else if (nextLowerVol > -1) {
      lowerIdx--;
      bins[lowerIdx].isValueArea = true;
      currentVaVolume += bins[lowerIdx].totalVolume;
    } else if (upperIdx < binCount - 1) {
      upperIdx++;
      bins[upperIdx].isValueArea = true;
      currentVaVolume += bins[upperIdx].totalVolume;
    } else {
      break;
    }
  }

  // Mark VAH and VAL
  bins[upperIdx].isVah = true;
  if (!bins[upperIdx].isPoc) bins[upperIdx].nodeType = 'VAH';

  bins[lowerIdx].isVal = true;
  if (!bins[lowerIdx].isPoc) bins[lowerIdx].nodeType = 'VAL';

  const vahPrice = bins[upperIdx].priceHigh;
  const valPrice = bins[lowerIdx].priceLow;

  // Calculate percentages and High/Low Volume Nodes
  const avgVolumePerBin = totalVolumeAccum / (binCount || 1);
  const hvnLevels: { price: number; volume: number; label: string }[] = [];
  const lvnLevels: { price: number; volume: number; label: string }[] = [];

  bins.forEach((b) => {
    b.volumePercent = maxBinVolume > 0 ? Math.round((b.totalVolume / maxBinVolume) * 100) : 0;
    b.totalVolumeSharePct = totalVolumeAccum > 0 ? Number(((b.totalVolume / totalVolumeAccum) * 100).toFixed(1)) : 0;

    // High Volume Node (HVN): volume > 1.35x average
    if (b.totalVolume >= avgVolumePerBin * 1.35 && !b.isPoc && !b.isVah && !b.isVal) {
      b.nodeType = 'HVN';
      hvnLevels.push({
        price: b.priceMid,
        volume: b.totalVolume,
        label: `HVN (${b.volumePercent}% Volume)`,
      });
    }

    // Low Volume Node (LVN): volume < 0.45x average
    if (b.totalVolume <= avgVolumePerBin * 0.45 && b.totalVolume > 0) {
      b.nodeType = 'LVN';
      lvnLevels.push({
        price: b.priceMid,
        volume: b.totalVolume,
        label: `LVN (${b.volumePercent}% Volume)`,
      });
    }
  });

  // Evaluate Current Price relative to Value Area
  const currentPrice = stock.currentPrice;
  let currentPricePosition: VolumeProfileResult['currentPricePosition'] = 'AT_POC';

  const pocTolerance = (priceMax - priceMin) * 0.015;
  if (Math.abs(currentPrice - pocPrice) <= pocTolerance) {
    currentPricePosition = 'AT_POC';
  } else if (currentPrice > vahPrice) {
    currentPricePosition = 'ABOVE_VAH';
  } else if (currentPrice > pocPrice && currentPrice <= vahPrice) {
    currentPricePosition = 'INSIDE_VA_UPPER';
  } else if (currentPrice < pocPrice && currentPrice >= valPrice) {
    currentPricePosition = 'INSIDE_VA_LOWER';
  } else {
    currentPricePosition = 'BELOW_VAL';
  }

  // Generate Institutional Minervini Support & Volume Profile Insights
  let supportStatus: VolumeProfileResult['supportInsight']['status'] = 'POC_SUPPORT_TEST';
  let badgeLabel = 'AT POC';
  let badgeBg = 'bg-purple-100 border-purple-300';
  let badgeText = 'text-purple-900';
  let headline = 'Price Balanced at Point of Control';
  let detail = `Price is consolidating directly at the institutional Point of Control (${stock.ticker} @ ${pocPrice.toFixed(2)}), representing the highest volume node of historical accumulation.`;
  let immSupport = valPrice;
  let immResistance = vahPrice;

  if (currentPricePosition === 'ABOVE_VAH') {
    supportStatus = 'BULLISH_ACCEPTANCE';
    badgeLabel = '🚀 ABOVE VAH (VALUE ACCEPTANCE)';
    badgeBg = 'bg-emerald-100 border-emerald-300';
    badgeText = 'text-emerald-900';
    headline = 'Bullish Value Area Breakout';
    detail = `Price has broken above Value Area High (${vahPrice.toFixed(2)}). Buyers are accepting higher prices outside historical value balance. VAH now serves as primary pull-back support.`;
    immSupport = vahPrice;
    immResistance = stock.target1Price || currentPrice * 1.15;
  } else if (currentPricePosition === 'INSIDE_VA_UPPER') {
    supportStatus = 'POC_SUPPORT_TEST';
    badgeLabel = '🟢 UPPER VALUE AREA';
    badgeBg = 'bg-teal-100 border-teal-300';
    badgeText = 'text-teal-900';
    headline = 'Trading in Upper Value Quadrant';
    detail = `Price sits between POC (${pocPrice.toFixed(2)}) and VAH (${vahPrice.toFixed(2)}). Institutional accumulation is supportive with POC acting as solid baseline floor.`;
    immSupport = pocPrice;
    immResistance = vahPrice;
  } else if (currentPricePosition === 'INSIDE_VA_LOWER') {
    supportStatus = 'VAL_DEFENSE_ZONE';
    badgeLabel = '🟡 TESTING VALUE AREA LOW';
    badgeBg = 'bg-amber-100 border-amber-300';
    badgeText = 'text-amber-900';
    headline = 'Testing Lower Value Support Zone';
    detail = `Price is testing the lower half of the value area toward VAL (${valPrice.toFixed(2)}). A bounce off VAL with drying volume offers an asymmetric pivot entry.`;
    immSupport = valPrice;
    immResistance = pocPrice;
  } else if (currentPricePosition === 'BELOW_VAL') {
    supportStatus = 'BELOW_VALUE_DANGER';
    badgeLabel = '🔴 BELOW VAL (REJECTION)';
    badgeBg = 'bg-rose-100 border-rose-300';
    badgeText = 'text-rose-900';
    headline = 'Below Institutional Value Area';
    detail = `Price is currently below Value Area Low (${valPrice.toFixed(2)}). Caution advised; ensure hard stop loss is respected until price reclaims institutional value.`;
    immSupport = stock.stopLossPrice;
    immResistance = valPrice;
  }

  return {
    bins,
    totalVolume: totalVolumeAccum,
    maxBinVolume,
    pocPrice,
    pocVolume,
    vahPrice,
    valPrice,
    valueAreaVolume: currentVaVolume,
    valueAreaPercent: Math.round(valueAreaRatio * 100),
    hvnLevels,
    lvnLevels,
    currentPricePosition,
    supportInsight: {
      status: supportStatus,
      badgeLabel,
      badgeBg,
      badgeText,
      headline,
      detail,
      immediateSupportPrice: immSupport,
      immediateResistancePrice: immResistance,
    },
    priceMin,
    priceMax,
    lookbackCount: filteredHistory.length,
    rangeType,
  };
}
