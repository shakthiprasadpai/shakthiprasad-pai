import {
  MinerviniTradeSetup,
  SectorVolatilityMetric,
  SectorVolatilityAlertSettings,
  SectorVolatilityAlertPayload,
  SectorVolCrossoverType,
} from '../types';
import {
  calculateStockAnnualizedHv,
  mapRelativeVolToRank,
  MARKET_INDEX_VOLATILITY,
} from './volatilityRankCalculator';
import { playAlertChime, appendTrackerLog } from './backgroundPriceChecker';

export type {
  SectorVolatilityMetric,
  SectorVolatilityAlertSettings,
  SectorVolatilityAlertPayload,
  SectorVolCrossoverType,
};

export const SECTOR_VOLATILITY_SETTINGS_KEY = 'minervini_sector_volatility_alert_settings';
export const SECTOR_VOLATILITY_HISTORY_KEY = 'minervini_sector_volatility_alert_history';
export const SECTOR_VOLATILITY_PREV_SNAPSHOT_KEY = 'minervini_sector_vol_prev_snapshot';

export const DEFAULT_SECTOR_VOLATILITY_SETTINGS: SectorVolatilityAlertSettings = {
  enabled: true,
  comparisonMode: 'RATIO_VS_MARKET',
  ratioThreshold: 1.50, // Alert when sector volatility is >= 1.50x broader market benchmark
  rankThreshold: 70, // Or when average Volatility Rank >= 70 / 99
  alertDirection: 'CROSS_ABOVE',
  soundAlert: true,
  browserNotification: true,
  cooldownMinutes: 10,
};

// In-memory cooldown tracker to avoid spamming the same sector repeatedly
const recentAlertTimestamps = new Map<string, number>();

/**
 * Reads user settings from localStorage with safe fallback defaults
 */
export function getSectorVolatilityAlertSettings(): SectorVolatilityAlertSettings {
  if (typeof window === 'undefined') return DEFAULT_SECTOR_VOLATILITY_SETTINGS;
  try {
    const raw = localStorage.getItem(SECTOR_VOLATILITY_SETTINGS_KEY);
    if (raw) {
      return { ...DEFAULT_SECTOR_VOLATILITY_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.error('Error reading sector volatility settings:', e);
  }
  return DEFAULT_SECTOR_VOLATILITY_SETTINGS;
}

/**
 * Persists user settings to localStorage
 */
export function saveSectorVolatilityAlertSettings(settings: SectorVolatilityAlertSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SECTOR_VOLATILITY_SETTINGS_KEY, JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent('minervini_sector_volatility_settings_updated', { detail: settings }));
  } catch (e) {
    console.error('Error saving sector volatility settings:', e);
  }
}

/**
 * Reads alert history from localStorage
 */
export function getSectorVolatilityAlertHistory(): SectorVolatilityAlertPayload[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SECTOR_VOLATILITY_HISTORY_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading sector volatility history:', e);
  }
  return [];
}

/**
 * Persists alert history to localStorage (caps at last 50 items)
 */
export function saveSectorVolatilityAlertHistory(history: SectorVolatilityAlertPayload[]): void {
  if (typeof window === 'undefined') return;
  try {
    const trimmed = history.slice(0, 50);
    localStorage.setItem(SECTOR_VOLATILITY_HISTORY_KEY, JSON.stringify(trimmed));
    window.dispatchEvent(new CustomEvent('minervini_sector_volatility_history_updated', { detail: trimmed }));
  } catch (e) {
    console.error('Error saving sector volatility history:', e);
  }
}

/**
 * Computes sector-level historical volatility metrics and comparisons vs broader market benchmark
 */
export function computeSectorVolatilityMetrics(
  stocks: MinerviniTradeSetup[],
  settings?: SectorVolatilityAlertSettings
): SectorVolatilityMetric[] {
  const currentSettings = settings || getSectorVolatilityAlertSettings();
  const sectorMap = new Map<string, MinerviniTradeSetup[]>();

  stocks.forEach((s) => {
    const sec = s.sector || 'General Market';
    if (!sectorMap.has(sec)) sectorMap.set(sec, []);
    sectorMap.get(sec)!.push(s);
  });

  const results: SectorVolatilityMetric[] = [];

  sectorMap.forEach((secStocks, sector) => {
    const stockCount = secStocks.length;
    if (stockCount === 0) return;

    // Detect exchange to pick relevant broader market benchmark
    const isIndia = secStocks.some((s) => s.exchange === 'NSE' || s.exchange === 'BSE');
    const marketInfo = isIndia ? MARKET_INDEX_VOLATILITY.NSE_BSE : MARKET_INDEX_VOLATILITY.US;
    const marketHvAnnualized = marketInfo.hvAnnualized;

    // Compute annualized HV for each stock in sector
    const stockHvList = secStocks.map((s) => {
      const hv = calculateStockAnnualizedHv(s);
      const ratio = hv / (marketHvAnnualized || 1);
      const rank = mapRelativeVolToRank(ratio);
      return {
        ticker: s.ticker,
        name: s.name,
        hvAnnualized: hv,
        volatilityRank: rank,
        currentPrice: s.currentPrice,
      };
    });

    const totalSectorHv = stockHvList.reduce((sum, item) => sum + item.hvAnnualized, 0);
    const avgSectorHvAnnualized = Number((totalSectorHv / stockCount).toFixed(2));
    const relativeVolatilityRatio = Number((avgSectorHvAnnualized / marketHvAnnualized).toFixed(2));
    const avgVolatilityRank = mapRelativeVolToRank(relativeVolatilityRatio);

    // Determine Volatility Tier
    let volatilityTier: SectorVolatilityMetric['volatilityTier'] = 'MODERATE_VOL';
    if (avgVolatilityRank <= 35 || relativeVolatilityRatio < 1.05) {
      volatilityTier = 'LOW_VOL';
    } else if (avgVolatilityRank >= 90 || relativeVolatilityRatio >= 2.40) {
      volatilityTier = 'EXTREME_VOL';
    } else if (avgVolatilityRank >= 71 || relativeVolatilityRatio >= 1.65) {
      volatilityTier = 'HIGH_VOL';
    }

    // Sort to find highest and lowest volatility stocks
    const sortedByHv = [...stockHvList].sort((a, b) => b.hvAnnualized - a.hvAnnualized);
    const highestVolStock = sortedByHv[0];
    const lowestVolStock = sortedByHv[sortedByHv.length - 1];

    const avgChangePercent = Number(
      (secStocks.reduce((sum, s) => sum + s.changePercent, 0) / stockCount).toFixed(2)
    );
    const avgDryUpPercent = Number(
      (secStocks.reduce((sum, s) => sum + (s.volumeDryUpPercent || 0), 0) / stockCount).toFixed(1)
    );

    // Threshold breach check based on active mode
    const isThresholdCrossed =
      currentSettings.comparisonMode === 'RATIO_VS_MARKET'
        ? relativeVolatilityRatio >= currentSettings.ratioThreshold
        : avgVolatilityRank >= currentSettings.rankThreshold;

    results.push({
      sector,
      stockCount,
      avgSectorHvAnnualized,
      marketBenchmark: marketInfo.name,
      marketHvAnnualized,
      relativeVolatilityRatio,
      avgVolatilityRank,
      volatilityTier,
      highestVolStock,
      lowestVolStock,
      avgChangePercent,
      avgDryUpPercent,
      isThresholdCrossed,
    });
  });

  // Sort by highest relative volatility ratio descending
  return results.sort((a, b) => b.relativeVolatilityRatio - a.relativeVolatilityRatio);
}

/**
 * Dispatches a sector volatility alert event and handles notification, sound, and history logging
 */
export function dispatchSectorVolatilityAlert(payload: SectorVolatilityAlertPayload): void {
  if (typeof window === 'undefined') return;

  // Save to persistent history
  const history = getSectorVolatilityAlertHistory();
  saveSectorVolatilityAlertHistory([payload, ...history]);

  // Log in price alert tracker logs
  appendTrackerLog({
    ticker: payload.sector,
    exchange: payload.marketBenchmark,
    previousPrice: payload.marketHvAnnualized,
    currentPrice: payload.avgSectorHvAnnualized,
    targetPrice: payload.thresholdValue,
    targetType: 'SECTOR_VOLATILITY',
    event: 'VOLATILITY_DRYUP_PRIMED',
    triggered: true,
  });

  const settings = getSectorVolatilityAlertSettings();

  // Play audio chime if enabled
  if (settings.soundAlert) {
    playAlertChime();
  }

  // Native Web Browser Notification
  if (
    settings.browserNotification &&
    'Notification' in window &&
    Notification.permission === 'granted'
  ) {
    try {
      new Notification(`⚡ Sector Volatility Alert: ${payload.sector}`, {
        body: payload.headline,
        icon: '/favicon.ico',
      });
    } catch (e) {
      console.warn('Could not display native notification:', e);
    }
  }

  // Broadcast window event for toast & UI listeners
  window.dispatchEvent(
    new CustomEvent<SectorVolatilityAlertPayload>('minervini_sector_volatility_alert', {
      detail: payload,
    })
  );
}

/**
 * Real-time evaluator that inspects sector volatility against the predefined threshold.
 * Detects threshold crossover transitions and fires alerts.
 */
export function evaluateSectorVolatilityAlerts(
  stocks: MinerviniTradeSetup[],
  customSettings?: SectorVolatilityAlertSettings,
  forceAllTriggers: boolean = false
): SectorVolatilityAlertPayload[] {
  const settings = customSettings || getSectorVolatilityAlertSettings();
  if (!settings.enabled && !forceAllTriggers) return [];

  const metrics = computeSectorVolatilityMetrics(stocks, settings);
  const now = Date.now();
  const cooldownMs = settings.cooldownMinutes * 60 * 1000;

  // Retrieve previous snapshot from localStorage to detect crossover transitions
  let prevSnapshot: Record<string, { ratio: number; rank: number }> = {};
  try {
    const raw = localStorage.getItem(SECTOR_VOLATILITY_PREV_SNAPSHOT_KEY);
    if (raw) prevSnapshot = JSON.parse(raw);
  } catch (e) {
    prevSnapshot = {};
  }

  const triggeredAlerts: SectorVolatilityAlertPayload[] = [];
  const currentSnapshot: Record<string, { ratio: number; rank: number }> = {};

  metrics.forEach((sec) => {
    currentSnapshot[sec.sector] = {
      ratio: sec.relativeVolatilityRatio,
      rank: sec.avgVolatilityRank,
    };

    const prev = prevSnapshot[sec.sector];
    const lastAlert = recentAlertTimestamps.get(sec.sector);
    const inCooldown = lastAlert && now - lastAlert < cooldownMs;

    let crossoverDetected = false;
    let crossoverType: SectorVolCrossoverType = 'SURGE_ABOVE_THRESHOLD';

    if (settings.comparisonMode === 'RATIO_VS_MARKET') {
      const currentVal = sec.relativeVolatilityRatio;
      const prevVal = prev ? prev.ratio : currentVal;
      const threshold = settings.ratioThreshold;

      // Condition 1: Crossed above threshold
      if ((prevVal < threshold && currentVal >= threshold) || (forceAllTriggers && currentVal >= threshold)) {
        if (settings.alertDirection === 'CROSS_ABOVE' || settings.alertDirection === 'BOTH') {
          crossoverDetected = true;
          crossoverType = 'SURGE_ABOVE_THRESHOLD';
        }
      }
      // Condition 2: Crossed below threshold (Volatility compression / VCP calming)
      else if (prevVal >= threshold && currentVal < threshold) {
        if (settings.alertDirection === 'CROSS_BELOW' || settings.alertDirection === 'BOTH') {
          crossoverDetected = true;
          crossoverType = 'COMPRESSION_BELOW_THRESHOLD';
        }
      }
    } else {
      // VOLATILITY_RANK comparison mode
      const currentVal = sec.avgVolatilityRank;
      const prevVal = prev ? prev.rank : currentVal;
      const threshold = settings.rankThreshold;

      if ((prevVal < threshold && currentVal >= threshold) || (forceAllTriggers && currentVal >= threshold)) {
        if (settings.alertDirection === 'CROSS_ABOVE' || settings.alertDirection === 'BOTH') {
          crossoverDetected = true;
          crossoverType = 'SURGE_ABOVE_THRESHOLD';
        }
      } else if (prevVal >= threshold && currentVal < threshold) {
        if (settings.alertDirection === 'CROSS_BELOW' || settings.alertDirection === 'BOTH') {
          crossoverDetected = true;
          crossoverType = 'COMPRESSION_BELOW_THRESHOLD';
        }
      }
    }

    if (crossoverDetected && (!inCooldown || forceAllTriggers)) {
      recentAlertTimestamps.set(sec.sector, now);

      const thresholdStr =
        settings.comparisonMode === 'RATIO_VS_MARKET'
          ? `${settings.ratioThreshold.toFixed(2)}x Market HV`
          : `Rank ${settings.rankThreshold}/99`;

      const isSurge = crossoverType === 'SURGE_ABOVE_THRESHOLD';
      const headline = isSurge
        ? `${sec.sector} volatility expanded to ${sec.relativeVolatilityRatio}x vs ${sec.marketBenchmark} (HV ${sec.avgSectorHvAnnualized}% vs ${sec.marketHvAnnualized}%), crossing predefined threshold ${thresholdStr}!`
        : `${sec.sector} volatility cooled down to ${sec.relativeVolatilityRatio}x vs ${sec.marketBenchmark}, compressing below threshold ${thresholdStr}.`;

      let sepaRiskPlaybook = '';
      if (isSurge) {
        if (sec.relativeVolatilityRatio >= 2.0) {
          sepaRiskPlaybook = `HIGH-BETA EXPANSION: Sector volatility is ${sec.relativeVolatilityRatio}x broader market. Mark Minervini SEPA Principle: Tighten stop-losses to 4-5% max, trim lagging positions into strength, and reduce position sizes on new breakouts to accommodate wider normal swings.`;
        } else {
          sepaRiskPlaybook = `ELEVATED ROTATIONAL RISK: Sector volatility crossed ${thresholdStr}. Monitor constituent leaders like ${sec.highestVolStock.ticker} for high-volume pivot breakouts versus false thrusts.`;
        }
      } else {
        sepaRiskPlaybook = `VOLATILITY COMPRESSION (VCP COIL): Sector volatility normalized below ${thresholdStr}. Constructive base-building environment. Ideal for spotting tight multi-contraction VCP breakouts with low risk-reward ratios.`;
      }

      const topConstituents = stocks
        .filter((s) => (s.sector || 'General Market') === sec.sector)
        .slice(0, 3)
        .map((s) => s.ticker);

      const payload: SectorVolatilityAlertPayload = {
        id: `sec-vol-${sec.sector.toLowerCase().replace(/\s+/g, '-')}-${now}`,
        sector: sec.sector,
        avgVolatilityRank: sec.avgVolatilityRank,
        relativeVolatilityRatio: sec.relativeVolatilityRatio,
        marketBenchmark: sec.marketBenchmark,
        marketHvAnnualized: sec.marketHvAnnualized,
        avgSectorHvAnnualized: sec.avgSectorHvAnnualized,
        thresholdValue:
          settings.comparisonMode === 'RATIO_VS_MARKET' ? settings.ratioThreshold : settings.rankThreshold,
        comparisonMode: settings.comparisonMode,
        crossoverType,
        triggeredAt: new Date().toLocaleTimeString(),
        stockCount: sec.stockCount,
        highestVolStock: {
          ticker: sec.highestVolStock.ticker,
          name: sec.highestVolStock.name,
          hvAnnualized: sec.highestVolStock.hvAnnualized,
          volatilityRank: sec.highestVolStock.volatilityRank,
        },
        topConstituents,
        sepaRiskPlaybook,
        severity: sec.relativeVolatilityRatio >= 2.0 ? 'CRITICAL' : 'WARNING',
        headline,
      };

      triggeredAlerts.push(payload);
      dispatchSectorVolatilityAlert(payload);
    }
  });

  // Save current snapshot for next comparison cycle
  try {
    localStorage.setItem(SECTOR_VOLATILITY_PREV_SNAPSHOT_KEY, JSON.stringify(currentSnapshot));
  } catch (e) {
    // ignore
  }

  return triggeredAlerts;
}

/**
 * Simulates a sector volatility surge alert for testing and user demonstration
 */
export function simulateSectorVolatilitySurgeAlert(
  stocks: MinerviniTradeSetup[],
  targetSector?: string
): SectorVolatilityAlertPayload {
  const settings = getSectorVolatilityAlertSettings();
  const metrics = computeSectorVolatilityMetrics(stocks, settings);

  const selected = targetSector
    ? metrics.find((m) => m.sector.toLowerCase() === targetSector.toLowerCase()) || metrics[0]
    : metrics[0] || {
        sector: 'Capital Goods',
        stockCount: 6,
        avgSectorHvAnnualized: 27.8,
        marketBenchmark: 'NIFTY 50' as const,
        marketHvAnnualized: 14.8,
        relativeVolatilityRatio: 1.88,
        avgVolatilityRank: 84,
        volatilityTier: 'HIGH_VOL' as const,
        highestVolStock: {
          ticker: 'DIXON',
          name: 'Dixon Technologies',
          hvAnnualized: 34.2,
          volatilityRank: 92,
          currentPrice: 12540,
        },
        lowestVolStock: {
          ticker: 'SIEMENS',
          name: 'Siemens India',
          hvAnnualized: 21.4,
          volatilityRank: 62,
          currentPrice: 6850,
        },
        avgChangePercent: 2.45,
        avgDryUpPercent: -42,
        isThresholdCrossed: true,
      };

  const payload: SectorVolatilityAlertPayload = {
    id: `sec-vol-sim-${Date.now()}`,
    sector: selected.sector,
    avgVolatilityRank: Math.max(selected.avgVolatilityRank, 78),
    relativeVolatilityRatio: Math.max(selected.relativeVolatilityRatio, 1.76),
    marketBenchmark: selected.marketBenchmark,
    marketHvAnnualized: selected.marketHvAnnualized,
    avgSectorHvAnnualized: selected.avgSectorHvAnnualized,
    thresholdValue:
      settings.comparisonMode === 'RATIO_VS_MARKET' ? settings.ratioThreshold : settings.rankThreshold,
    comparisonMode: settings.comparisonMode,
    crossoverType: 'SURGE_ABOVE_THRESHOLD',
    triggeredAt: new Date().toLocaleTimeString(),
    stockCount: selected.stockCount,
    highestVolStock: {
      ticker: selected.highestVolStock.ticker,
      name: selected.highestVolStock.name,
      hvAnnualized: selected.highestVolStock.hvAnnualized,
      volatilityRank: selected.highestVolStock.volatilityRank,
    },
    topConstituents: ['DIXON', 'HAL', 'BEL'],
    sepaRiskPlaybook: `ELEVATED SECTOR VOLATILITY (${Math.max(selected.relativeVolatilityRatio, 1.76)}x vs ${selected.marketBenchmark}): Mark Minervini SEPA Principle: When a sector expands volatility significantly above the broader market index, tighten trailing stops, look for high-volume volume dry-up pullbacks to the 20-day SMA, and avoid chase orders on gap-ups.`,
    severity: 'WARNING',
    headline: `🚨 REAL-TIME ALERT: ${selected.sector} average volatility rating crossed predefined threshold (${settings.comparisonMode === 'RATIO_VS_MARKET' ? `${settings.ratioThreshold}x Market HV` : `Rank ${settings.rankThreshold}/99`}) vs broader market ${selected.marketBenchmark}!`,
  };

  dispatchSectorVolatilityAlert(payload);
  return payload;
}
