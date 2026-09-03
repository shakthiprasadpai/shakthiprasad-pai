import { MinerviniTradeSetup, SmartMoneyDivergenceAlertPayload } from '../types';
import { HeadlineItem } from '../components/TickerNewsGrounding';
import { getCurrencySymbol } from './sepaCalculator';
import { appendTrackerLog } from './backgroundPriceChecker';
import { playSmartMoneyDivergenceChime } from './audioAlertEngine';

export type SmartMoneyDivergenceType =
  | 'BULLISH_ACCUMULATION'
  | 'BEARISH_DISTRIBUTION'
  | 'HIDDEN_ACCUMULATION'
  | 'HIDDEN_DISTRIBUTION'
  | 'NEUTRAL_CONVERGENCE';

export interface SmartMoneyDivergenceSignal {
  hasDivergence: boolean;
  ticker: string;
  stockName: string;
  exchange: 'NASDAQ' | 'NYSE' | 'NSE' | 'BSE' | string;
  divergenceType: SmartMoneyDivergenceType;
  strength: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
  convictionScore: number; // 1 to 10
  priceSlopePct: number; // % price change over lookback window
  sentimentSlopeScore: number; // sentiment MA change over lookback window
  priceStart: number;
  priceEnd: number;
  sentimentStart: number;
  sentimentEnd: number;
  lookbackDays: number;
  startDate: string;
  endDate: string;
  title: string;
  description: string;
  sepaPlaybook: string;
  institutionalPhase: 'ACCUMULATION' | 'DISTRIBUTION' | 'ABSORPTION' | 'NEUTRAL';
  detectedAt: string;
  keyHeadlines: HeadlineItem[];
  correlation: number;
}

export interface DivergenceServiceSettings {
  webPushEnabled: boolean;
  inAppToastEnabled: boolean;
  audioChimeEnabled: boolean;
  minConvictionThreshold: number; // e.g. 6.5
  alertCooldownMinutes: number; // e.g. 15 min
  autoScanEnabled: boolean;
}

const DIVERGENCE_SETTINGS_STORAGE_KEY = 'minervini_divergence_service_settings';
const DIVERGENCE_HISTORY_STORAGE_KEY = 'minervini_divergence_alerts_history';

export const DEFAULT_DIVERGENCE_SETTINGS: DivergenceServiceSettings = {
  webPushEnabled: true,
  inAppToastEnabled: true,
  audioChimeEnabled: true,
  minConvictionThreshold: 6.5,
  alertCooldownMinutes: 15,
  autoScanEnabled: true,
};

export function getDivergenceSettings(): DivergenceServiceSettings {
  if (typeof window === 'undefined') return DEFAULT_DIVERGENCE_SETTINGS;
  try {
    const raw = localStorage.getItem(DIVERGENCE_SETTINGS_STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_DIVERGENCE_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.error('Failed to read divergence settings:', e);
  }
  return DEFAULT_DIVERGENCE_SETTINGS;
}

export function saveDivergenceSettings(settings: Partial<DivergenceServiceSettings>): DivergenceServiceSettings {
  if (typeof window === 'undefined') return DEFAULT_DIVERGENCE_SETTINGS;
  try {
    const current = getDivergenceSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(DIVERGENCE_SETTINGS_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('minervini_divergence_settings_updated', { detail: updated }));
    return updated;
  } catch (e) {
    console.error('Failed to save divergence settings:', e);
    return DEFAULT_DIVERGENCE_SETTINGS;
  }
}

export function getDivergenceHistory(): SmartMoneyDivergenceAlertPayload[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DIVERGENCE_HISTORY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to read divergence alert history:', e);
  }
  return [];
}

export function appendDivergenceHistory(alert: SmartMoneyDivergenceAlertPayload): void {
  if (typeof window === 'undefined') return;
  try {
    const history = getDivergenceHistory();
    const updated = [alert, ...history.slice(0, 49)]; // Keep latest 50
    localStorage.setItem(DIVERGENCE_HISTORY_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to append divergence history:', e);
  }
}

/**
 * Requests native browser Web Push Notification permission.
 */
export async function requestWebPushPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.warn('Notification permission request failed:', err);
    return 'default';
  }
}

/**
 * Normalizes headline date to timestamp.
 */
function parseDateOffset(dateStr: string | undefined, refNow: number): number {
  if (!dateStr) return refNow;
  const text = dateStr.toLowerCase().trim();
  if (text.includes('today') || text.includes('just now') || text.includes('hour') || text.includes('min') || text === 'recent') {
    return refNow;
  }
  if (text.includes('yesterday') || text.includes('1 day')) {
    return refNow - 24 * 60 * 60 * 1000;
  }
  if (text.includes('day')) {
    const m = text.match(/(\d+)\s*day/);
    const d = m ? parseInt(m[1], 10) : 1;
    return refNow - d * 24 * 60 * 60 * 1000;
  }
  if (text.includes('week')) {
    const m = text.match(/(\d+)\s*week/);
    const w = m ? parseInt(m[1], 10) : 1;
    return refNow - w * 7 * 24 * 60 * 60 * 1000;
  }
  const parsed = Date.parse(dateStr);
  return isNaN(parsed) ? refNow : parsed;
}

/**
 * Computes headline sentiment score (0 to 100).
 */
function computeHeadlineScore(h: HeadlineItem): number {
  const impact = h.impactScore || (h.impactLevel === 'CRITICAL' ? 9.5 : h.impactLevel === 'HIGH' ? 8.0 : h.impactLevel === 'MEDIUM' ? 6.0 : 4.0);
  const factor = Math.min(1.2, Math.max(0.8, impact / 7.5));
  if (h.sentiment === 'BULLISH') return Math.min(100, Math.round(50 + 40 * (impact / 10) * factor));
  if (h.sentiment === 'CATALYST') return Math.min(100, Math.round(50 + 35 * (impact / 10) * factor));
  if (h.sentiment === 'BEARISH') return Math.max(0, Math.round(50 - 45 * (impact / 10) * factor));
  return 50;
}

/**
 * Creates a fallback neutral divergence signal when price action and sentiment are in equilibrium.
 */
export function createNeutralDivergenceSignal(
  stock?: MinerviniTradeSetup | null,
  lookbackDays: number = 20
): SmartMoneyDivergenceSignal {
  const currentPrice = stock?.currentPrice || 0;
  const currency = stock?.exchange ? getCurrencySymbol(stock.exchange) : '$';

  return {
    hasDivergence: false,
    ticker: stock?.ticker || 'UNKNOWN',
    stockName: stock?.name || '',
    exchange: stock?.exchange || 'NASDAQ',
    divergenceType: 'NEUTRAL_CONVERGENCE',
    strength: 'LOW',
    convictionScore: 5.0,
    priceSlopePct: 0,
    sentimentSlopeScore: 0,
    priceStart: currentPrice,
    priceEnd: currentPrice,
    sentimentStart: 50,
    sentimentEnd: 50,
    lookbackDays,
    startDate: '',
    endDate: '',
    title: `Institutional Flow Monitor: ${stock?.ticker || ''} Price/Sentiment In-Sync`,
    description: `Price action and sentiment metrics are in structural equilibrium. No institutional accumulation or distribution divergence identified over the ${lookbackDays}-day window.`,
    sepaPlaybook: `SEPA Strategy: Standard discipline applies. Monitor VCP contractions, volume dry-up, and ${currency}${stock?.pivotPrice || currentPrice} pivot level.`,
    institutionalPhase: 'NEUTRAL',
    detectedAt: new Date().toLocaleTimeString(),
    keyHeadlines: [],
    correlation: 0.5,
  };
}

/**
 * Primary Engine: Evaluates Price Action vs Sentiment Series to detect Smart Money Divergence.
 */
export function detectSmartMoneyDivergence(
  stock: MinerviniTradeSetup,
  headlines: HeadlineItem[] = [],
  options?: {
    lookbackDays?: number;
    maPeriod?: number;
  } | number
): SmartMoneyDivergenceSignal {
  const lookbackDays = typeof options === 'number' ? options : options?.lookbackDays || 20;
  const maPeriod = typeof options === 'number' ? 5 : options?.maPeriod || 5;

  if (!stock || !stock.priceHistory || stock.priceHistory.length < 5) {
    return createNeutralDivergenceSignal(stock, lookbackDays);
  }

  const sortedPrices = [...stock.priceHistory].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const lookbackPrices = sortedPrices.slice(-lookbackDays);
  if (lookbackPrices.length < 5) {
    return createNeutralDivergenceSignal(stock, lookbackDays);
  }

  const refNow = new Date(lookbackPrices[lookbackPrices.length - 1].date).getTime() || Date.now();

  // Map headlines with scores and dates
  const mappedHeadlines = (headlines || []).map((h, i) => {
    let ts = parseDateOffset(h.date, refNow);
    if (h.date === 'Recent' && headlines.length > 1) {
      ts = refNow - (i / headlines.length) * 14 * 24 * 60 * 60 * 1000;
    }
    return {
      ...h,
      timestamp: ts,
      score: computeHeadlineScore(h),
    };
  });

  // Calculate daily price and raw sentiment
  const dailyData = lookbackPrices.map((p, idx) => {
    const pTime = new Date(p.date).getTime();
    const dayHeadlines = mappedHeadlines.filter((h) => Math.abs(h.timestamp - pTime) <= 1.3 * 24 * 60 * 60 * 1000);

    let rawScore = 50;
    if (dayHeadlines.length > 0) {
      const sum = dayHeadlines.reduce((acc, h) => acc + h.score, 0);
      rawScore = Math.round(sum / dayHeadlines.length);
    } else {
      const prevClose = idx > 0 ? lookbackPrices[idx - 1].close : p.open;
      const changePct = ((p.close - prevClose) / prevClose) * 100;
      rawScore = Math.min(75, Math.max(30, Math.round(50 + changePct * 2.8)));
    }

    return {
      date: p.date,
      price: p.close,
      rawSentiment: rawScore,
      headlines: dayHeadlines,
    };
  });

  // Calculate smoothed moving average sentiment
  const series = dailyData.map((d, i, arr) => {
    const windowStart = Math.max(0, i - maPeriod + 1);
    const slice = arr.slice(windowStart, i + 1);
    const avg = slice.reduce((sum, item) => sum + item.rawSentiment, 0) / slice.length;
    return {
      ...d,
      maSentiment: Number(avg.toFixed(1)),
    };
  });

  const n = series.length;
  const startPoint = series[0];
  const endPoint = series[n - 1];

  // Compare midpoint/early window vs recent window (last 5-8 days)
  const recentWindow = series.slice(-Math.min(7, Math.floor(n / 2)));
  const earlyWindow = series.slice(0, Math.floor(n / 2));

  const startPrice = startPoint.price;
  const endPrice = endPoint.price;
  const priceSlopePct = Number((((endPrice - startPrice) / startPrice) * 100).toFixed(2));

  const startSentiment = earlyWindow.reduce((acc, d) => acc + d.maSentiment, 0) / earlyWindow.length;
  const endSentiment = recentWindow.reduce((acc, d) => acc + d.maSentiment, 0) / recentWindow.length;
  const sentimentSlopeScore = Number((endSentiment - startSentiment).toFixed(1));

  // Compute correlation
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  series.forEach((d) => {
    sumX += d.maSentiment;
    sumY += d.price;
    sumXY += d.maSentiment * d.price;
    sumX2 += d.maSentiment * d.maSentiment;
    sumY2 += d.price * d.price;
  });
  const num = n * sumXY - sumX * sumY;
  const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  const correlation = den !== 0 ? Number((num / den).toFixed(2)) : 0.5;

  const currency = getCurrencySymbol(stock.exchange);
  const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // 1. Check for BULLISH DIVERGENCE (Smart Money Accumulation)
  // Price is consolidating tight (-4% to +1.8%) or declining, while Sentiment MA is surging (+6 to +30 pts)
  const isBullishAccumulation =
    (priceSlopePct <= 1.8 && sentimentSlopeScore >= 6.5) ||
    (priceSlopePct <= -2.5 && endSentiment >= 62);

  // 2. Check for BEARISH DIVERGENCE (Smart Money Distribution)
  // Price is rallying/making new highs (+3.5% to +20%) while Sentiment MA is deteriorating (-7 to -30 pts)
  const isBearishDistribution =
    (priceSlopePct >= 3.5 && sentimentSlopeScore <= -6.5) ||
    (priceSlopePct >= 7.0 && endSentiment <= 46);

  // 3. Check for HIDDEN ACCUMULATION (Negative news absorption)
  // Price holds support/tight (-1% to +1%) despite a flood of bad sentiment (sentiment drop <= -8)
  const isHiddenAccumulation =
    priceSlopePct >= -1.2 && priceSlopePct <= 2.0 && sentimentSlopeScore <= -8.5 && stock.trendScore >= 6;

  // 4. Check for HIDDEN DISTRIBUTION (Positive news failed rally)
  // Price fails to advance (<= 0.5%) despite bullish hype (sentiment surge >= +10)
  const isHiddenDistribution =
    priceSlopePct <= 0.5 && sentimentSlopeScore >= 10.0 && stock.rsRating < 75;

  if (!isBullishAccumulation && !isBearishDistribution && !isHiddenAccumulation && !isHiddenDistribution) {
    const neutralSignal = createNeutralDivergenceSignal(stock, lookbackDays);
    return {
      ...neutralSignal,
      hasDivergence: false,
      priceSlopePct,
      sentimentSlopeScore,
      priceStart: Number(startPrice.toFixed(2)),
      priceEnd: Number(endPrice.toFixed(2)),
      sentimentStart: Number(startSentiment.toFixed(1)),
      sentimentEnd: Number(endSentiment.toFixed(1)),
      startDate: startPoint.date,
      endDate: endPoint.date,
      correlation,
      detectedAt: nowStr,
    };
  }

  let divergenceType: SmartMoneyDivergenceType = 'NEUTRAL_CONVERGENCE';
  let strength: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW' = 'MODERATE';
  let convictionScore = 7.0;
  let title = '';
  let description = '';
  let sepaPlaybook = '';
  let institutionalPhase: 'ACCUMULATION' | 'DISTRIBUTION' | 'ABSORPTION' | 'NEUTRAL' = 'NEUTRAL';

  if (isBullishAccumulation) {
    divergenceType = 'BULLISH_ACCUMULATION';
    institutionalPhase = 'ACCUMULATION';

    // Calculate conviction based on RS rating, Trend Score, VCP tightness, and divergence gap
    const gap = sentimentSlopeScore - priceSlopePct;
    convictionScore = Math.min(9.8, Math.max(6.8, Number((7.0 + (gap / 10) * 0.8 + (stock.rsRating >= 80 ? 0.8 : 0) + (stock.trendScore >= 7 ? 0.7 : 0)).toFixed(1))));
    strength = convictionScore >= 8.8 ? 'CRITICAL' : convictionScore >= 7.8 ? 'HIGH' : 'MODERATE';

    title = `🔥 Smart Money Accumulation Divergence: ${stock.ticker}`;
    description = `Bullish Divergence Detected: ${stock.ticker} price has moved ${priceSlopePct > 0 ? '+' : ''}${priceSlopePct}% while News Sentiment MA surged +${sentimentSlopeScore} pts to ${endSentiment.toFixed(1)}/100. Institutional buyers are quietly soaking up float supply into the ${currency}${stock.pivotPrice} pivot.`;
    sepaPlaybook = `SEPA Strategy: High probability of explosive Stage 2 breakout. Monitor for 3-week tight volume dry-up (≤ -40%). Prepare buy-stop order at pivot ${currency}${stock.pivotPrice} with a max 5% stop loss @ ${currency}${stock.stopLossPrice}.`;
  } else if (isBearishDistribution) {
    divergenceType = 'BEARISH_DISTRIBUTION';
    institutionalPhase = 'DISTRIBUTION';

    const gap = Math.abs(sentimentSlopeScore) + priceSlopePct;
    convictionScore = Math.min(9.8, Math.max(6.8, Number((7.2 + (gap / 12) * 0.8).toFixed(1))));
    strength = convictionScore >= 8.8 ? 'CRITICAL' : convictionScore >= 7.8 ? 'HIGH' : 'MODERATE';

    title = `⚠️ Smart Money Distribution Divergence: ${stock.ticker}`;
    description = `Bearish Divergence Detected: ${stock.ticker} price climbed +${priceSlopePct}% while News Catalyst Sentiment dropped ${sentimentSlopeScore} pts to ${endSentiment.toFixed(1)}/100. Smart money institutions are offloading into retail euphoria.`;
    sepaPlaybook = `SEPA Strategy: Protect gains. Tighten trailing stops to 2.5-3% below current price. Refrain from initiating fresh breakout buys as overhead institutional supply increases risk of false breakouts.`;
  } else if (isHiddenAccumulation) {
    divergenceType = 'HIDDEN_ACCUMULATION';
    institutionalPhase = 'ABSORPTION';
    convictionScore = 8.2;
    strength = 'HIGH';
    title = `🛡️ Hidden Institutional Absorption: ${stock.ticker}`;
    description = `${stock.ticker} held rock-solid support (${priceSlopePct}%) despite heavy negative news sentiment drop (${sentimentSlopeScore} pts). Strong institutional hands are absorbing market supply.`;
    sepaPlaybook = `SEPA Strategy: 'Bad news that fails to drop a stock is inherently bullish.' Watch for a rapid sentiment mean-reversion snapback and pivot reclaim.`;
  } else if (isHiddenDistribution) {
    divergenceType = 'HIDDEN_DISTRIBUTION';
    institutionalPhase = 'DISTRIBUTION';
    convictionScore = 7.6;
    strength = 'MODERATE';
    title = `🚨 Hidden Exhaustion Divergence: ${stock.ticker}`;
    description = `${stock.ticker} price failed to rally (${priceSlopePct}%) despite massive positive headline hype (+${sentimentSlopeScore} pts). Indicates heavy institutional profit-taking into news.`;
    sepaPlaybook = `SEPA Strategy: Do not buy into the hype. Wait for a constructive multi-contraction VCP reset before considering any entries.`;
  }

  return {
    hasDivergence: true,
    ticker: stock.ticker,
    stockName: stock.name,
    exchange: stock.exchange,
    divergenceType,
    strength,
    convictionScore,
    priceSlopePct,
    sentimentSlopeScore,
    priceStart: Number(startPrice.toFixed(2)),
    priceEnd: Number(endPrice.toFixed(2)),
    sentimentStart: Number(startSentiment.toFixed(1)),
    sentimentEnd: Number(endSentiment.toFixed(1)),
    lookbackDays,
    startDate: startPoint.date,
    endDate: endPoint.date,
    title,
    description,
    sepaPlaybook,
    institutionalPhase,
    detectedAt: nowStr,
    keyHeadlines: mappedHeadlines.slice(0, 3),
    correlation,
  };
}

// In-memory cooldown cache
const divergenceAlertCooldownCache = new Map<string, number>();

/**
 * Triggers a Web Push Notification and In-App Alert for a detected divergence signal.
 */
/**
 * Dispatches Push Notification, Web Audio Chime, In-App Custom Event, and audit logs.
 */
export function triggerSmartMoneyPushNotification(
  arg1: MinerviniTradeSetup | SmartMoneyDivergenceSignal,
  arg2?: SmartMoneyDivergenceSignal | { force?: boolean; forceChime?: boolean; onCustomClick?: () => void },
  arg3?: { force?: boolean; forceChime?: boolean; onCustomClick?: () => void }
): boolean {
  if (typeof window === 'undefined') return false;

  let signal: SmartMoneyDivergenceSignal;
  let options: { force?: boolean; forceChime?: boolean; onCustomClick?: () => void } | undefined;

  if ('divergenceType' in arg1) {
    signal = arg1 as SmartMoneyDivergenceSignal;
    options = arg2 as any;
  } else {
    signal = arg2 as SmartMoneyDivergenceSignal;
    options = arg3;
  }

  if (!signal) return false;

  const settings = getDivergenceSettings();
  const cacheKey = `${signal.ticker}_${signal.divergenceType}`;
  const lastAlertTime = divergenceAlertCooldownCache.get(cacheKey);
  const now = Date.now();
  const cooldownMs = (settings.alertCooldownMinutes || 15) * 60 * 1000;

  if (!options?.force && !options?.forceChime && lastAlertTime && now - lastAlertTime < cooldownMs) {
    return false; // Suppressed by cooldown
  }

  if (signal.convictionScore < settings.minConvictionThreshold && !options?.force && !options?.forceChime) {
    return false; // Below user sensitivity threshold
  }

  divergenceAlertCooldownCache.set(cacheKey, now);

  const isBullish =
    signal.divergenceType === 'BULLISH_ACCUMULATION' || signal.divergenceType === 'HIDDEN_ACCUMULATION';

  // 1. Play Audio Chime
  if (settings.audioChimeEnabled || options?.forceChime) {
    playSmartMoneyDivergenceChime(isBullish ? 'BULLISH' : 'BEARISH');
  }

  // 2. Web Push Notification (Native Browser Notification API)
  if (settings.webPushEnabled && 'Notification' in window && Notification.permission === 'granted') {
    try {
      const notif = new Notification(signal.title, {
        body: `${signal.description}\n\n💡 ${signal.sepaPlaybook}`,
        icon: '/favicon.ico',
        tag: `divergence-${signal.ticker}-${Date.now()}`,
        requireInteraction: true,
      });

      notif.onclick = () => {
        window.focus();
        if (options?.onCustomClick) {
          options.onCustomClick();
        }
      };
    } catch (e) {
      console.warn('Native web push notification failed:', e);
    }
  }

  // 3. Append to Local Storage History & Audit Log
  const payload: SmartMoneyDivergenceAlertPayload = {
    ticker: signal.ticker,
    stockName: signal.stockName,
    exchange: signal.exchange,
    divergenceType: signal.divergenceType as any,
    strength: signal.strength,
    convictionScore: signal.convictionScore,
    priceSlope: signal.priceSlopePct,
    sentimentSlope: signal.sentimentSlopeScore,
    priceStart: signal.priceStart,
    priceEnd: signal.priceEnd,
    sentimentStart: signal.sentimentStart,
    sentimentEnd: signal.sentimentEnd,
    lookbackDays: signal.lookbackDays,
    title: signal.title,
    description: signal.description,
    sepaPlaybook: signal.sepaPlaybook,
    institutionalPhase: signal.institutionalPhase,
    triggeredAt: signal.detectedAt || new Date().toLocaleTimeString(),
    topHeadlines: (signal.keyHeadlines || []).map((h) => ({
      title: h.title,
      sentiment: h.sentiment,
      impactScore: h.impactScore,
      date: h.date,
    })),
  };

  appendDivergenceHistory(payload);

  appendTrackerLog({
    ticker: signal.ticker,
    exchange: signal.exchange,
    previousPrice: signal.priceStart,
    currentPrice: signal.priceEnd,
    targetPrice: signal.priceEnd,
    targetType: 'SMART_MONEY_DIVERGENCE',
    event: 'TICK_CHECK',
    triggered: true,
  });

  // 4. Dispatch In-App Custom Window Event for Toast and UI components
  window.dispatchEvent(
    new CustomEvent('minervini_sentiment_divergence_alert', {
      detail: payload,
    })
  );

  return true;
}

/**
 * Simulates a Smart Money Divergence Alert for quick user testing.
 */
export function simulateSmartMoneyDivergenceAlert(
  stock: MinerviniTradeSetup,
  type: SmartMoneyDivergenceType = 'BULLISH_ACCUMULATION'
): SmartMoneyDivergenceSignal {
  const isBullish = type === 'BULLISH_ACCUMULATION' || type === 'HIDDEN_ACCUMULATION';
  const currency = getCurrencySymbol(stock.exchange);

  const signal: SmartMoneyDivergenceSignal = {
    hasDivergence: true,
    ticker: stock.ticker,
    stockName: stock.name,
    exchange: stock.exchange,
    divergenceType: type,
    strength: 'CRITICAL',
    convictionScore: 9.4,
    priceSlopePct: isBullish ? -1.8 : 8.5,
    sentimentSlopeScore: isBullish ? 24.5 : -22.0,
    priceStart: isBullish ? Number((stock.currentPrice * 1.02).toFixed(2)) : Number((stock.currentPrice * 0.92).toFixed(2)),
    priceEnd: stock.currentPrice,
    sentimentStart: isBullish ? 42.0 : 78.0,
    sentimentEnd: isBullish ? 66.5 : 56.0,
    lookbackDays: 20,
    startDate: '20 days ago',
    endDate: 'Today',
    title: isBullish
      ? `⚡ Smart Money Accumulation Divergence: ${stock.ticker}`
      : `⚠️ Smart Money Distribution Divergence: ${stock.ticker}`,
    description: isBullish
      ? `Mark Minervini SEPA Divergence: Price consolidated -1.8% while news sentiment rocketed +24.5 pts. Institutional accumulation stealth absorption phase detected.`
      : `Mark Minervini SEPA Warning: Price surged +8.5% on deteriorating news sentiment (-22.0 pts). Smart money distribution into retail FOMO detected.`,
    sepaPlaybook: isBullish
      ? `High-probability institutional positioning. Watch for VCP contraction completion and place buy-stop order at pivot ${currency}${stock.pivotPrice}.`
      : `Caution: Negative divergence. Tighten stop-losses to protect profits; avoid chasing extended breakouts.`,
    institutionalPhase: isBullish ? 'ACCUMULATION' : 'DISTRIBUTION',
    detectedAt: new Date().toLocaleTimeString(),
    keyHeadlines: [],
    correlation: 0.72,
  };

  triggerSmartMoneyPushNotification(stock, signal, { force: true, forceChime: true });
  return signal;
}

/**
 * Scans an entire list of stocks against their headlines for divergence alerts.
 */
export function scanWatchlistForDivergences(
  stocks: MinerviniTradeSetup[],
  headlinesMap: Record<string, HeadlineItem[]> = {}
): SmartMoneyDivergenceSignal[] {
  if (!stocks || stocks.length === 0) return [];

  const signals: SmartMoneyDivergenceSignal[] = [];

  stocks.forEach((stock) => {
    const headlines = headlinesMap[stock.ticker] || [];
    const signal = detectSmartMoneyDivergence(stock, headlines);
    if (signal && signal.hasDivergence && signal.convictionScore >= 6.5) {
      signals.push(signal);
      triggerSmartMoneyPushNotification(stock, signal);
    }
  });

  return signals;
}
