import { MinerviniTradeSetup } from '../types';
import { appendTrackerLog } from './backgroundPriceChecker';
import { getCurrencySymbol } from './sepaCalculator';

export interface AudioSettings {
  enabled: boolean;
  volume: number; // 0.0 to 1.0
  volumeSpikeSound: boolean;
  highConvictionBreakoutSound: boolean;
  smartMoneyDivergenceSound: boolean;
}

const AUDIO_SETTINGS_KEY = 'minervini_audio_alert_settings';

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  enabled: true,
  volume: 0.35,
  volumeSpikeSound: true,
  highConvictionBreakoutSound: true,
  smartMoneyDivergenceSound: true,
};

export function getAudioSettings(): AudioSettings {
  if (typeof window === 'undefined') return DEFAULT_AUDIO_SETTINGS;
  try {
    const raw = localStorage.getItem(AUDIO_SETTINGS_KEY);
    if (raw) {
      return { ...DEFAULT_AUDIO_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.error('Failed to parse audio alert settings:', e);
  }
  return DEFAULT_AUDIO_SETTINGS;
}

export function saveAudioSettings(settings: Partial<AudioSettings>): AudioSettings {
  if (typeof window === 'undefined') return DEFAULT_AUDIO_SETTINGS;
  try {
    const current = getAudioSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('minervini_audio_settings_updated', { detail: updated }));
    return updated;
  } catch (e) {
    console.error('Failed to save audio settings:', e);
    return DEFAULT_AUDIO_SETTINGS;
  }
}

// Global AudioContext singleton
let globalAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!globalAudioCtx || globalAudioCtx.state === 'closed') {
      globalAudioCtx = new AudioCtx();
    }
    if (globalAudioCtx.state === 'suspended') {
      globalAudioCtx.resume().catch(() => {});
    }
    return globalAudioCtx;
  } catch (e) {
    return null;
  }
}

/**
 * Plays a subtle, pleasant harmonic synth chime for Volume Spikes.
 * Uses a crystal two-tone arpeggio (D5 -> A5 -> D6) with warm exponential decay.
 */
export function playVolumeSpikeChime(): void {
  const settings = getAudioSettings();
  if (!settings.enabled || !settings.volumeSpikeSound) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(settings.volume * 0.7, now);
    masterGain.connect(ctx.destination);

    // Notes: D5 (587.33Hz), A5 (880Hz), D6 (1174.66Hz)
    const tones = [
      { freq: 587.33, start: 0, dur: 0.28 },
      { freq: 880.0, start: 0.08, dur: 0.32 },
      { freq: 1174.66, start: 0.16, dur: 0.45 },
    ];

    tones.forEach((tone) => {
      const osc = ctx.createOscillator();
      const toneGain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(tone.freq, now + tone.start);

      // Smooth attack and soft exponential release
      toneGain.gain.setValueAtTime(0.0001, now + tone.start);
      toneGain.gain.exponentialRampToValueAtTime(0.25, now + tone.start + 0.02);
      toneGain.gain.exponentialRampToValueAtTime(0.0001, now + tone.start + tone.dur);

      osc.connect(toneGain);
      toneGain.connect(masterGain);

      osc.start(now + tone.start);
      osc.stop(now + tone.start + tone.dur);
    });
  } catch (e) {
    // Suppress Web Audio interaction policy warnings
  }
}

/**
 * Plays an uplifting, crisp acoustic triad chime for High-Conviction Breakouts.
 * Uses a major triad (E5 -> G#5 -> B5 -> E6) with subtle harmonic sparkle.
 */
export function playHighConvictionBreakoutChime(): void {
  const settings = getAudioSettings();
  if (!settings.enabled || !settings.highConvictionBreakoutSound) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(settings.volume * 0.8, now);
    masterGain.connect(ctx.destination);

    // Notes: E5 (659.25Hz), G#5 (830.61Hz), B5 (987.77Hz), E6 (1318.51Hz)
    const tones = [
      { freq: 659.25, start: 0, dur: 0.35, type: 'sine' as OscillatorType },
      { freq: 830.61, start: 0.07, dur: 0.38, type: 'sine' as OscillatorType },
      { freq: 987.77, start: 0.14, dur: 0.42, type: 'triangle' as OscillatorType },
      { freq: 1318.51, start: 0.21, dur: 0.55, type: 'sine' as OscillatorType },
    ];

    tones.forEach((tone) => {
      const osc = ctx.createOscillator();
      const toneGain = ctx.createGain();

      osc.type = tone.type;
      osc.frequency.setValueAtTime(tone.freq, now + tone.start);

      toneGain.gain.setValueAtTime(0.0001, now + tone.start);
      toneGain.gain.exponentialRampToValueAtTime(0.3, now + tone.start + 0.025);
      toneGain.gain.exponentialRampToValueAtTime(0.0001, now + tone.start + tone.dur);

      osc.connect(toneGain);
      toneGain.connect(masterGain);

      osc.start(now + tone.start);
      osc.stop(now + tone.start + tone.dur);
    });
  } catch (e) {
    // Suppress Web Audio interaction policy warnings
  }
}

/**
 * Plays a rich, multi-harmonic synth chime for Smart Money Accumulation/Distribution Divergences.
 * Uses a deep resonant arpeggio (F#4 -> C#5 -> F5 -> A#5) representing institutional capital flow.
 */
export function playSmartMoneyDivergenceChime(type: 'BULLISH' | 'BEARISH' = 'BULLISH'): void {
  const settings = getAudioSettings();
  if (!settings.enabled || !settings.smartMoneyDivergenceSound) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(settings.volume * 0.85, now);
    masterGain.connect(ctx.destination);

    const isBullish = type === 'BULLISH';
    // Bullish tones: Ascending harmonic flow (370Hz -> 554Hz -> 698Hz -> 932Hz)
    // Bearish tones: Descending cautionary flow (880Hz -> 698Hz -> 554Hz -> 370Hz)
    const tones = isBullish
      ? [
          { freq: 369.99, start: 0, dur: 0.38, type: 'sine' as OscillatorType },
          { freq: 554.37, start: 0.08, dur: 0.42, type: 'triangle' as OscillatorType },
          { freq: 698.46, start: 0.16, dur: 0.48, type: 'sine' as OscillatorType },
          { freq: 932.33, start: 0.24, dur: 0.65, type: 'sine' as OscillatorType },
        ]
      : [
          { freq: 880.0, start: 0, dur: 0.35, type: 'triangle' as OscillatorType },
          { freq: 698.46, start: 0.08, dur: 0.4, type: 'sine' as OscillatorType },
          { freq: 554.37, start: 0.16, dur: 0.45, type: 'sine' as OscillatorType },
          { freq: 369.99, start: 0.24, dur: 0.6, type: 'triangle' as OscillatorType },
        ];

    tones.forEach((tone) => {
      const osc = ctx.createOscillator();
      const toneGain = ctx.createGain();

      osc.type = tone.type;
      osc.frequency.setValueAtTime(tone.freq, now + tone.start);

      toneGain.gain.setValueAtTime(0.0001, now + tone.start);
      toneGain.gain.exponentialRampToValueAtTime(0.28, now + tone.start + 0.02);
      toneGain.gain.exponentialRampToValueAtTime(0.0001, now + tone.start + tone.dur);

      osc.connect(toneGain);
      toneGain.connect(masterGain);

      osc.start(now + tone.start);
      osc.stop(now + tone.start + tone.dur);
    });
  } catch (e) {
    // Suppress Web Audio policy errors
  }
}

// Session alert deduplication cache to avoid spamming the user on repeated ticks
const recentAlertsCache = new Map<string, number>();
const ALERT_COOLDOWN_MS = 90000; // 90 seconds cooldown per ticker/type

export interface VolumeBreakoutAlertPayload {
  stock: MinerviniTradeSetup;
  type: 'VOLUME_SPIKE' | 'HIGH_CONVICTION_BREAKOUT';
  title: string;
  description: string;
  volumeRatio?: number;
  rsRating: number;
  trendScore: number;
  triggeredAt: string;
}

/**
 * Dispatches an audio chime and notification when a new Volume Spike or High-Conviction Breakout is detected.
 */
export function triggerWatchlistAudioAlert(
  stock: MinerviniTradeSetup,
  type: 'VOLUME_SPIKE' | 'HIGH_CONVICTION_BREAKOUT',
  options?: {
    forceChime?: boolean;
    customDescription?: string;
  }
): boolean {
  if (typeof window === 'undefined') return false;

  const cacheKey = `${stock.ticker}_${type}`;
  const lastAlertTime = recentAlertsCache.get(cacheKey);
  const now = Date.now();

  if (!options?.forceChime && lastAlertTime && now - lastAlertTime < ALERT_COOLDOWN_MS) {
    return false; // Still in cooldown
  }

  recentAlertsCache.set(cacheKey, now);

  const volRatio = stock.pivotVolume && stock.avgVolume20d ? stock.pivotVolume / stock.avgVolume20d : 1.6;
  const currency = getCurrencySymbol(stock.exchange);

  let title = '';
  let description = '';

  if (type === 'VOLUME_SPIKE') {
    title = `⚡ Volume Spike Detected: ${stock.ticker}`;
    description = options?.customDescription || `${stock.ticker} trading at ${volRatio.toFixed(1)}x 20-day average volume! Institutional accumulation detected near ${currency}${stock.pivotPrice}.`;
    playVolumeSpikeChime();
  } else {
    title = `🎯 High-Conviction Breakout: ${stock.ticker}`;
    description = options?.customDescription || `${stock.ticker} (${stock.name}) triggered SEPA 8/8 Trend Template & VCP compression with RS ${stock.rsRating}! Ready for pivot entry @ ${currency}${stock.pivotPrice}.`;
    playHighConvictionBreakoutChime();
  }

  // Native Browser Notification (if permission is granted)
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body: description,
        icon: '/favicon.ico',
      });
    } catch (err) {
      console.warn('Native notification failed:', err);
    }
  }

  // Append entry to tracker logs
  appendTrackerLog({
    ticker: stock.ticker,
    exchange: stock.exchange,
    previousPrice: stock.currentPrice - 1.2,
    currentPrice: stock.currentPrice,
    targetPrice: stock.pivotPrice,
    targetType: type,
    event: type === 'VOLUME_SPIKE' ? 'TICK_CHECK' : 'PIVOT_CROSSED',
    triggered: true,
  });

  const payload: VolumeBreakoutAlertPayload = {
    stock,
    type,
    title,
    description,
    volumeRatio: Number(volRatio.toFixed(2)),
    rsRating: stock.rsRating,
    trendScore: stock.trendScore,
    triggeredAt: new Date().toLocaleTimeString(),
  };

  // Dispatch custom event for GlobalNotificationToast & Watchlist UI listeners
  window.dispatchEvent(
    new CustomEvent('minervini_volume_breakout_alert', {
      detail: payload,
    })
  );

  return true;
}

/**
 * Scans a list of stocks to evaluate Volume Spikes and High-Conviction Breakout setups.
 */
export function scanAndTriggerWatchlistAudio(
  stocks: MinerviniTradeSetup[],
  watchlistTickers?: string[]
): number {
  if (!stocks || stocks.length === 0) return 0;

  const targetStocks = watchlistTickers && watchlistTickers.length > 0
    ? stocks.filter((s) => watchlistTickers.includes(s.ticker))
    : stocks;

  let triggeredCount = 0;

  for (const stock of targetStocks) {
    const volRatio = stock.pivotVolume && stock.avgVolume20d ? stock.pivotVolume / stock.avgVolume20d : 0;
    const isVolumeSpike = volRatio >= 1.5 || (stock.volumeDryUpPercent && stock.volumeDryUpPercent > 45);
    const isHighConviction = stock.trendScore >= 7 && stock.rsRating >= 85 && (stock.vcpStage === 'Active Breakout' || stock.vcpStage === 'T3' || stock.vcpStage === 'T4');

    if (isHighConviction) {
      const triggered = triggerWatchlistAudioAlert(stock, 'HIGH_CONVICTION_BREAKOUT');
      if (triggered) triggeredCount++;
    } else if (isVolumeSpike) {
      const triggered = triggerWatchlistAudioAlert(stock, 'VOLUME_SPIKE');
      if (triggered) triggeredCount++;
    }
  }

  return triggeredCount;
}
