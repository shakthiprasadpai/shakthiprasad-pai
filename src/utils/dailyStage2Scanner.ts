import { MinerviniTradeSetup, TrendTemplateRule } from '../types';
import { evaluateTrendTemplate, getCurrencySymbol, formatCurrency } from './sepaCalculator';
import { playHighConvictionBreakoutChime } from './audioAlertEngine';
import { appendTrackerLog } from './backgroundPriceChecker';

export const DAILY_STAGE2_SETTINGS_KEY = 'minervini_daily_stage2_scan_settings';
export const DAILY_STAGE2_HISTORY_KEY = 'minervini_daily_stage2_scan_history';
export const DAILY_STAGE2_SEEN_TICKERS_KEY = 'minervini_daily_stage2_seen_tickers';

export interface DailyStage2ScanSettings {
  enabled: boolean;
  scheduledTime: string; // "09:30" (24h format)
  autoNotify: boolean;
  soundAlert: boolean;
  minTrendScore: number; // 7 or 8
  minRsRating: number; // 70+
  requireTightVolume: boolean;
  notifyNewOnly: boolean;
  lastScanTimestamp?: string;
  lastScanDateStr?: string; // "YYYY-MM-DD"
}

export const DEFAULT_STAGE2_SETTINGS: DailyStage2ScanSettings = {
  enabled: true,
  scheduledTime: '09:30',
  autoNotify: true,
  soundAlert: true,
  minTrendScore: 7,
  minRsRating: 70,
  requireTightVolume: false,
  notifyNewOnly: true,
};

export interface Stage2BreakoutCandidate {
  stock: MinerviniTradeSetup;
  ticker: string;
  stockName: string;
  exchange: string;
  currentPrice: number;
  pivotPrice: number;
  stopLossPrice: number;
  distanceToPivotPct: number;
  rsRating: number;
  trendScore: number;
  passedRules: TrendTemplateRule[];
  failedRules: TrendTemplateRule[];
  breakoutStatus: 'ACTIVE_BREAKOUT' | 'BUY_ZONE_COIL' | 'STAGE_2_LEADER';
  volumeDryUpPercent: number;
  patternType: string;
  isNewCandidate: boolean;
  detectedAt: string;
  sepaVerdict: string;
}

export interface DailyStage2ScanResult {
  scanId: string;
  timestamp: string;
  dateStr: string;
  totalStocksScanned: number;
  qualifiedCount: number;
  newBreakoutsCount: number;
  candidates: Stage2BreakoutCandidate[];
  marketSummary: string;
  isScheduled: boolean;
}

export interface DailyStage2ScanPayload {
  result: DailyStage2ScanResult;
  topCandidates: Stage2BreakoutCandidate[];
  summary: string;
  triggeredAt: string;
}

/**
 * Retrieves user daily scan configuration
 */
export function getDailyStage2ScanSettings(): DailyStage2ScanSettings {
  if (typeof window === 'undefined') return DEFAULT_STAGE2_SETTINGS;
  try {
    const raw = localStorage.getItem(DAILY_STAGE2_SETTINGS_KEY);
    if (raw) {
      return { ...DEFAULT_STAGE2_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.error('Failed to parse Stage 2 scan settings:', e);
  }
  return DEFAULT_STAGE2_SETTINGS;
}

/**
 * Saves user daily scan configuration
 */
export function saveDailyStage2ScanSettings(settings: Partial<DailyStage2ScanSettings>): DailyStage2ScanSettings {
  if (typeof window === 'undefined') return DEFAULT_STAGE2_SETTINGS;
  try {
    const current = getDailyStage2ScanSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(DAILY_STAGE2_SETTINGS_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('minervini_stage2_settings_updated', { detail: updated }));
    return updated;
  } catch (e) {
    console.error('Failed to save Stage 2 scan settings:', e);
    return DEFAULT_STAGE2_SETTINGS;
  }
}

/**
 * Retrieves historical scan results
 */
export function getDailyStage2ScanHistory(): DailyStage2ScanResult[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DAILY_STAGE2_HISTORY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to read scan history:', e);
  }
  return [];
}

/**
 * Saves scan result into history (keeps last 20 runs)
 */
export function appendDailyStage2ScanHistory(result: DailyStage2ScanResult): void {
  if (typeof window === 'undefined') return;
  try {
    const history = getDailyStage2ScanHistory();
    const updated = [result, ...history.filter(h => h.scanId !== result.scanId)].slice(0, 20);
    localStorage.setItem(DAILY_STAGE2_HISTORY_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save scan history:', e);
  }
}

/**
 * Gets previously identified Stage 2 breakout tickers to determine "new" breakouts
 */
function getSeenStage2Tickers(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(DAILY_STAGE2_SEEN_TICKERS_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch (e) {
    // fallback
  }
  return new Set();
}

function updateSeenStage2Tickers(tickers: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getSeenStage2Tickers();
    tickers.forEach(t => current.add(t));
    localStorage.setItem(DAILY_STAGE2_SEEN_TICKERS_KEY, JSON.stringify(Array.from(current)));
  } catch (e) {
    console.error('Failed to save seen tickers:', e);
  }
}

/**
 * Executes a full scan across the stocks list to identify Stage 2 breakouts.
 */
export function runDailyStage2Scan(
  stocks: MinerviniTradeSetup[],
  options?: { isScheduled?: boolean; force?: boolean }
): DailyStage2ScanResult {
  const settings = getDailyStage2ScanSettings();
  const seenTickers = getSeenStage2Tickers();
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toLocaleTimeString();

  const candidates: Stage2BreakoutCandidate[] = [];

  stocks.forEach((stock) => {
    // Evaluate Trend Template (all 8 rules)
    const { rules, passedCount } = evaluateTrendTemplate({
      currentPrice: stock.currentPrice,
      sma50: stock.sma50,
      sma150: stock.sma150,
      sma200: stock.sma200,
      sma200_1mo_ago: stock.sma200_1mo_ago,
      high52w: stock.high52w,
      low52w: stock.low52w,
      rsRating: stock.rsRating,
    });

    const meetsTrendThreshold = passedCount >= settings.minTrendScore;
    const meetsRsThreshold = stock.rsRating >= settings.minRsRating;
    const meetsVolumeThreshold = !settings.requireTightVolume || stock.volumeDryUpPercent <= -35;

    if (meetsTrendThreshold && meetsRsThreshold && meetsVolumeThreshold) {
      const distanceToPivotPct = Number((((stock.currentPrice - stock.pivotPrice) / stock.pivotPrice) * 100).toFixed(2));
      
      let breakoutStatus: 'ACTIVE_BREAKOUT' | 'BUY_ZONE_COIL' | 'STAGE_2_LEADER' = 'STAGE_2_LEADER';
      if (stock.currentPrice >= stock.pivotPrice) {
        breakoutStatus = 'ACTIVE_BREAKOUT';
      } else if (Math.abs(distanceToPivotPct) <= 2.5) {
        breakoutStatus = 'BUY_ZONE_COIL';
      }

      const passedRules = rules.filter(r => r.passed);
      const failedRules = rules.filter(r => !r.passed);
      const isNewCandidate = !seenTickers.has(stock.ticker);

      let sepaVerdict = `${passedCount}/8 Trend Template rules satisfied. RS Rating ${stock.rsRating}. Trading in verified Stage 2 uptrend.`;
      if (breakoutStatus === 'ACTIVE_BREAKOUT') {
        sepaVerdict = `⚡ ACTIVE PIVOT BREAKOUT: Cleared ${getCurrencySymbol(stock.exchange)}${stock.pivotPrice} on confirming structure. Passed ${passedCount}/8 rules.`;
      } else if (breakoutStatus === 'BUY_ZONE_COIL') {
        sepaVerdict = `🎯 PRIMED AT PIVOT: Coiled within ${Math.abs(distanceToPivotPct)}% of pivot ${getCurrencySymbol(stock.exchange)}${stock.pivotPrice} with ${stock.volumeDryUpPercent}% volume dry-up.`;
      }

      candidates.push({
        stock,
        ticker: stock.ticker,
        stockName: stock.name,
        exchange: stock.exchange,
        currentPrice: stock.currentPrice,
        pivotPrice: stock.pivotPrice,
        stopLossPrice: stock.stopLossPrice,
        distanceToPivotPct,
        rsRating: stock.rsRating,
        trendScore: passedCount,
        passedRules,
        failedRules,
        breakoutStatus,
        volumeDryUpPercent: stock.volumeDryUpPercent,
        patternType: stock.patternType,
        isNewCandidate,
        detectedAt: timeStr,
        sepaVerdict,
      });
    }
  });

  // Sort candidates: Active breakouts first, then closest to pivot, then highest RS rating
  candidates.sort((a, b) => {
    if (a.breakoutStatus === 'ACTIVE_BREAKOUT' && b.breakoutStatus !== 'ACTIVE_BREAKOUT') return -1;
    if (b.breakoutStatus === 'ACTIVE_BREAKOUT' && a.breakoutStatus !== 'ACTIVE_BREAKOUT') return 1;
    return b.rsRating - a.rsRating;
  });

  const newBreakouts = candidates.filter(c => c.isNewCandidate);
  const newBreakoutTickers = newBreakouts.map(c => c.ticker);
  
  if (newBreakoutTickers.length > 0) {
    updateSeenStage2Tickers(newBreakoutTickers);
  }

  const result: DailyStage2ScanResult = {
    scanId: `scan-${Date.now()}`,
    timestamp: `${dateStr} ${timeStr}`,
    dateStr,
    totalStocksScanned: stocks.length,
    qualifiedCount: candidates.length,
    newBreakoutsCount: newBreakouts.length,
    candidates,
    marketSummary: `Identified ${candidates.length} Stage 2 leaders (${newBreakouts.length} new) from ${stocks.length} scanned equities.`,
    isScheduled: !!options?.isScheduled,
  };

  // Update last scan in settings
  saveDailyStage2ScanSettings({
    lastScanTimestamp: result.timestamp,
    lastScanDateStr: dateStr,
  });

  appendDailyStage2ScanHistory(result);

  return result;
}

/**
 * Checks if the scheduled daily scan is due and triggers it.
 */
export function checkAndRunScheduledScan(stocks: MinerviniTradeSetup[]): DailyStage2ScanResult | null {
  const settings = getDailyStage2ScanSettings();
  if (!settings.enabled || stocks.length === 0) return null;

  const now = new Date();
  const todayDateStr = now.toISOString().split('T')[0];

  // If already scanned today, skip unless scheduled time matches and hasn't run in last hour
  if (settings.lastScanDateStr === todayDateStr) {
    return null;
  }

  // Parse scheduled time e.g. "09:30"
  const [scheduledHours, scheduledMinutes] = (settings.scheduledTime || '09:30').split(':').map(Number);
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();

  // If current time is past or equal to scheduled time
  const isTimeDue = (currentHours > scheduledHours) || (currentHours === scheduledHours && currentMinutes >= scheduledMinutes);

  if (isTimeDue) {
    const result = runDailyStage2Scan(stocks, { isScheduled: true });
    
    // Dispatch notification if enabled
    if (settings.autoNotify && result.candidates.length > 0) {
      dispatchStage2DailyScanNotification(result);
    }
    
    return result;
  }

  return null;
}

/**
 * Dispatches a rich notification via the existing notification system
 */
export function dispatchStage2DailyScanNotification(result: DailyStage2ScanResult): void {
  if (typeof window === 'undefined') return;

  const settings = getDailyStage2ScanSettings();
  if (settings.soundAlert) {
    playHighConvictionBreakoutChime();
  }

  const topCandidates = result.candidates.slice(0, 4);
  const newBreakouts = result.candidates.filter(c => c.isNewCandidate);

  // Trigger web browser native notification if permitted
  if ('Notification' in window && Notification.permission === 'granted') {
    const countDesc = result.newBreakoutsCount > 0 
      ? `${result.newBreakoutsCount} NEW Stage 2 Breakouts Found!` 
      : `${result.qualifiedCount} Stage 2 Candidates Confirmed`;
    
    const tickerList = topCandidates.map(c => c.ticker).join(', ');

    new Notification(`🎯 Daily Stage 2 Scan: ${countDesc}`, {
      body: `Leaders: ${tickerList}. All pass 7+ Trend Template rules with top Relative Strength.`,
      icon: '/favicon.ico',
    });
  }

  // Append tracker log for auditing
  if (topCandidates.length > 0) {
    const leader = topCandidates[0];
    appendTrackerLog({
      ticker: leader.ticker,
      exchange: leader.exchange || 'NASDAQ',
      previousPrice: leader.currentPrice,
      currentPrice: leader.currentPrice,
      targetPrice: leader.pivotPrice,
      targetType: 'STAGE_2_COMPLETED',
      event: 'STAGE_2_COMPLETED',
      triggered: true,
    });
  }

  const payload: DailyStage2ScanPayload = {
    result,
    topCandidates,
    summary: result.marketSummary,
    triggeredAt: new Date().toLocaleTimeString(),
  };

  // Dispatch custom window event caught by GlobalNotificationToast.tsx
  window.dispatchEvent(new CustomEvent('minervini_stage2_daily_scan_alert', { detail: payload }));
}
