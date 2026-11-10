import { MinerviniTradeSetup, FivePaisaHolding, DailyScanPivotAlertPayload } from '../types';
import { fetchFivePaisaHoldings } from './fivePaisaService';
import { playAlertChime, appendTrackerLog } from './backgroundPriceChecker';
import { formatCurrency, getCurrencySymbol } from './sepaCalculator';

export type { DailyScanPivotAlertPayload } from '../types';

export const DAILY_SCAN_ALERT_SETTINGS_KEY = 'minervini_daily_scan_alert_settings';
export const DAILY_SCAN_ALERT_HISTORY_KEY = 'minervini_daily_scan_alert_history';

export interface DailyScanAlertSettings {
  enabled: boolean;
  monitorFivePaisaHoldings: boolean;
  monitorStage2Setups: boolean;
  pivotProximityThresholdPct: number; // e.g. 1.5% below pivot
  buyZoneMaxPct: number; // e.g. 2.5% above pivot
  soundAlert: boolean;
  nativeBrowserNotification: boolean;
  cooldownMinutes: number; // prevent spamming same ticker within N minutes
}

export const DEFAULT_DAILY_SCAN_ALERT_SETTINGS: DailyScanAlertSettings = {
  enabled: true,
  monitorFivePaisaHoldings: true,
  monitorStage2Setups: true,
  pivotProximityThresholdPct: 1.5,
  buyZoneMaxPct: 2.5,
  soundAlert: true,
  nativeBrowserNotification: true,
  cooldownMinutes: 10,
};

// In-memory cooldown tracker to avoid duplicate alerts within cooldown window
const recentAlertTimestamps = new Map<string, number>();

export function getDailyScanAlertSettings(): DailyScanAlertSettings {
  if (typeof window === 'undefined') return DEFAULT_DAILY_SCAN_ALERT_SETTINGS;
  try {
    const raw = localStorage.getItem(DAILY_SCAN_ALERT_SETTINGS_KEY);
    if (raw) {
      return { ...DEFAULT_DAILY_SCAN_ALERT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.error('Failed to load daily scan alert settings:', e);
  }
  return DEFAULT_DAILY_SCAN_ALERT_SETTINGS;
}

export function saveDailyScanAlertSettings(
  settings: Partial<DailyScanAlertSettings>
): DailyScanAlertSettings {
  if (typeof window === 'undefined') return DEFAULT_DAILY_SCAN_ALERT_SETTINGS;
  try {
    const current = getDailyScanAlertSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(DAILY_SCAN_ALERT_SETTINGS_KEY, JSON.stringify(updated));
    window.dispatchEvent(
      new CustomEvent('minervini_daily_scan_alert_settings_updated', { detail: updated })
    );
    return updated;
  } catch (e) {
    console.error('Failed to save daily scan alert settings:', e);
    return DEFAULT_DAILY_SCAN_ALERT_SETTINGS;
  }
}

export function getDailyScanAlertHistory(): DailyScanPivotAlertPayload[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DAILY_SCAN_ALERT_HISTORY_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load alert history:', e);
  }
  return [];
}

export function saveDailyScanAlertHistory(history: DailyScanPivotAlertPayload[]): void {
  if (typeof window === 'undefined') return;
  try {
    const trimmed = history.slice(0, 50);
    localStorage.setItem(DAILY_SCAN_ALERT_HISTORY_KEY, JSON.stringify(trimmed));
    window.dispatchEvent(
      new CustomEvent('minervini_daily_scan_alert_history_updated', { detail: trimmed })
    );
  } catch (e) {
    console.error('Failed to save alert history:', e);
  }
}

/**
 * Dispatches a pivot breakout zone alert event caught by GlobalNotificationToast
 */
export function dispatchDailyScanPivotAlert(payload: DailyScanPivotAlertPayload): void {
  // Update in-memory cooldown
  recentAlertTimestamps.set(payload.ticker, Date.now());

  // Save to persistent history
  const history = getDailyScanAlertHistory();
  saveDailyScanAlertHistory([payload, ...history]);

  // Log in central tracker
  appendTrackerLog({
    ticker: payload.ticker,
    exchange: payload.exchange || 'NSE',
    previousPrice: payload.currentPrice * 0.99,
    currentPrice: payload.currentPrice,
    targetPrice: payload.pivotPrice,
    targetType: payload.sourceType === '5PAISA_HOLDING' ? '5PAISA_HOLDING_PIVOT_ENTRY' : 'STAGE2_PIVOT_BREAKOUT',
    event: 'PIVOT_CROSSED',
    triggered: true,
  });

  const settings = getDailyScanAlertSettings();

  // Play audio chime if enabled
  if (settings.soundAlert) {
    playAlertChime();
  }

  // Native Web Browser Notification
  if (
    settings.nativeBrowserNotification &&
    typeof window !== 'undefined' &&
    'Notification' in window &&
    Notification.permission === 'granted'
  ) {
    try {
      const is5p = payload.sourceType === '5PAISA_HOLDING';
      const title = is5p
        ? `💼 5paisa Holding Hit Pivot Zone: ${payload.ticker}`
        : `⚡ Stage 2 Setup In Breakout Zone: ${payload.ticker}`;
      const curr = getCurrencySymbol(payload.exchange);
      new Notification(title, {
        body: `${payload.ticker} trading at ${curr}${payload.currentPrice.toFixed(2)} (Pivot: ${curr}${payload.pivotPrice.toFixed(2)}, Distance: ${payload.distanceToPivotPct >= 0 ? '+' : ''}${payload.distanceToPivotPct.toFixed(1)}%). ${payload.actionGuidance}`,
        icon: '/favicon.ico',
      });
    } catch (e) {
      console.warn('Native notification failed:', e);
    }
  }

  // Dispatch custom window event caught by GlobalNotificationToast
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('minervini_daily_scan_breakout_alert', { detail: payload })
    );
  }
}

/**
 * Evaluates 5paisa holdings and Stage 2 setups to identify stocks hitting the pivot breakout zone.
 */
export async function runDailyScanAlertsEvaluation(
  stocks: MinerviniTradeSetup[],
  holdings?: FivePaisaHolding[]
): Promise<DailyScanPivotAlertPayload[]> {
  const settings = getDailyScanAlertSettings();
  if (!settings.enabled) return [];

  const activeHoldings = holdings || (await fetchFivePaisaHoldings());
  const triggeredAlerts: DailyScanPivotAlertPayload[] = [];
  const now = Date.now();
  const cooldownMs = settings.cooldownMinutes * 60 * 1000;

  // 1. MONITOR 5PAISA HOLDINGS
  if (settings.monitorFivePaisaHoldings && activeHoldings && activeHoldings.length > 0) {
    for (const h of activeHoldings) {
      const lastAlert = recentAlertTimestamps.get(h.symbol);
      if (lastAlert && now - lastAlert < cooldownMs) continue;

      // Find matching setup
      const match = stocks.find((s) => s.ticker.toUpperCase() === h.symbol.toUpperCase());
      const currentPrice = match ? match.currentPrice : h.currentPrice;
      const pivotPrice = match ? match.pivotPrice : (h.averagePrice ? h.averagePrice * 1.05 : currentPrice);
      const buyZoneMax = match ? match.buyZoneMax : pivotPrice * 1.02;

      // Calculate distance to pivot percentage
      const distanceToPivotPct = Number((((currentPrice - pivotPrice) / pivotPrice) * 100).toFixed(2));

      // Condition: stock hits pivot breakout zone
      // (within proximity below pivot, or within buy zone above pivot)
      const isHittingPivotZone =
        (distanceToPivotPct >= -settings.pivotProximityThresholdPct && distanceToPivotPct <= settings.buyZoneMaxPct) ||
        (currentPrice >= pivotPrice && currentPrice <= buyZoneMax);

      if (isHittingPivotZone) {
        const payload: DailyScanPivotAlertPayload = {
          ticker: h.symbol,
          stockName: h.companyName,
          exchange: h.exchange || 'NSE',
          currentPrice,
          pivotPrice,
          buyZoneMax,
          distanceToPivotPct,
          sourceType: '5PAISA_HOLDING',
          holdingShares: h.quantity,
          holdingPnl: h.pnl,
          vcpStage: match?.vcpStage || 'Breakout Zone',
          patternType: match?.patternType || 'VCP Coil',
          rsRating: match?.rsRating || h.rsRating || 85,
          volumeDryUpPercent: match?.volumeDryUpPercent || -42,
          triggeredAt: new Date().toLocaleTimeString(),
          actionGuidance: `5paisa Holding in Action Zone: ${h.quantity} shares held. At ${distanceToPivotPct >= 0 ? '+' : ''}${distanceToPivotPct}% from pivot. SEPA suggests adding follow-up tranche or locking partial gains if extended.`,
        };

        triggeredAlerts.push(payload);
        dispatchDailyScanPivotAlert(payload);
      }
    }
  }

  // 2. MONITOR NEW STAGE 2 SETUPS
  if (settings.monitorStage2Setups && stocks && stocks.length > 0) {
    // Filter for strong Stage 2 setups (trendScore >= 7 and rsRating >= 70)
    const stage2Candidates = stocks.filter(
      (s) => (s.trendScore >= 7 || s.vcpStage === 'Active Breakout' || s.isTightVolume) && s.rsRating >= 70
    );

    for (const s of stage2Candidates) {
      // Skip if already in 5paisa holdings to avoid double alert
      const isAlreadyHolding = activeHoldings.some((h) => h.symbol.toUpperCase() === s.ticker.toUpperCase());
      if (isAlreadyHolding) continue;

      const lastAlert = recentAlertTimestamps.get(s.ticker);
      if (lastAlert && now - lastAlert < cooldownMs) continue;

      const currentPrice = s.currentPrice;
      const pivotPrice = s.pivotPrice;
      const buyZoneMax = s.buyZoneMax || pivotPrice * 1.025;
      const distanceToPivotPct = Number((((currentPrice - pivotPrice) / pivotPrice) * 100).toFixed(2));

      // Condition: stock hits pivot breakout zone
      const isHittingPivotZone =
        (distanceToPivotPct >= -settings.pivotProximityThresholdPct && distanceToPivotPct <= settings.buyZoneMaxPct) ||
        (currentPrice >= pivotPrice && currentPrice <= buyZoneMax);

      if (isHittingPivotZone) {
        const payload: DailyScanPivotAlertPayload = {
          ticker: s.ticker,
          stockName: s.name,
          exchange: s.exchange || 'NSE',
          currentPrice,
          pivotPrice,
          buyZoneMax,
          distanceToPivotPct,
          sourceType: 'STAGE_2_SETUP',
          vcpStage: s.vcpStage || 'Pivot Breakout',
          patternType: s.patternType || 'VCP (3 Contractions)',
          rsRating: s.rsRating,
          volumeDryUpPercent: s.volumeDryUpPercent,
          triggeredAt: new Date().toLocaleTimeString(),
          actionGuidance: `Stage 2 Breakout Alert: ${s.ticker} hit pivot zone at ${distanceToPivotPct >= 0 ? '+' : ''}${distanceToPivotPct}%. Passing ${s.trendScore}/8 Trend Template rules. SEPA Rule: Execute initial buy tranche within 2% of pivot.`,
        };

        triggeredAlerts.push(payload);
        dispatchDailyScanPivotAlert(payload);
      }
    }
  }

  return triggeredAlerts;
}

/**
 * Manually trigger simulated 5paisa Holding pivot alert for user testing
 */
export function simulate5paisaHoldingPivotAlert(
  customStock?: MinerviniTradeSetup,
  customHolding?: FivePaisaHolding
): DailyScanPivotAlertPayload {
  const ticker = customHolding?.symbol || customStock?.ticker || 'HAL';
  const name = customHolding?.companyName || customStock?.name || 'Hindustan Aeronautics Ltd';
  const pivot = customStock?.pivotPrice || 4850.0;
  const current = Number((pivot * 1.008).toFixed(2));
  const buyZoneMax = Number((pivot * 1.025).toFixed(2));
  const dist = Number((((current - pivot) / pivot) * 100).toFixed(2));

  const payload: DailyScanPivotAlertPayload = {
    ticker,
    stockName: name,
    exchange: customStock?.exchange || 'NSE',
    currentPrice: current,
    pivotPrice: pivot,
    buyZoneMax,
    distanceToPivotPct: dist,
    sourceType: '5PAISA_HOLDING',
    holdingShares: customHolding?.quantity || 45,
    holdingPnl: customHolding?.pnl || 18500,
    vcpStage: 'Active Pivot Breakout',
    patternType: 'VCP (3 Contractions, -58% Vol)',
    rsRating: customStock?.rsRating || 94,
    volumeDryUpPercent: -58,
    triggeredAt: new Date().toLocaleTimeString(),
    actionGuidance: `5paisa Holding Pivot Breakout: ${ticker} trading at ${dist >= 0 ? '+' : ''}${dist}% above pivot ₹${pivot.toFixed(2)}. Qualified for high-conviction follow-up position or bracket order on 5paisa!`,
  };

  dispatchDailyScanPivotAlert(payload);
  return payload;
}

/**
 * Manually trigger simulated new Stage 2 breakout alert for user testing
 */
export function simulateStage2BreakoutAlert(
  customStock?: MinerviniTradeSetup
): DailyScanPivotAlertPayload {
  const ticker = customStock?.ticker || 'DIXON';
  const name = customStock?.name || 'Dixon Technologies Ltd';
  const pivot = customStock?.pivotPrice || 14200.0;
  const current = Number((pivot * 1.005).toFixed(2));
  const buyZoneMax = Number((pivot * 1.02).toFixed(2));
  const dist = Number((((current - pivot) / pivot) * 100).toFixed(2));

  const payload: DailyScanPivotAlertPayload = {
    ticker,
    stockName: name,
    exchange: customStock?.exchange || 'NSE',
    currentPrice: current,
    pivotPrice: pivot,
    buyZoneMax,
    distanceToPivotPct: dist,
    sourceType: 'STAGE_2_SETUP',
    vcpStage: 'VCP Pivot Coil',
    patternType: 'VCP High Tight Flag',
    rsRating: customStock?.rsRating || 92,
    volumeDryUpPercent: -48,
    triggeredAt: new Date().toLocaleTimeString(),
    actionGuidance: `New Stage 2 Setup at Pivot: ${ticker} crossed pivot target ₹${pivot.toFixed(2)} with volume dry-up of -48%. Trend score 8/8. Primary SEPA buy signal active!`,
  };

  dispatchDailyScanPivotAlert(payload);
  return payload;
}
