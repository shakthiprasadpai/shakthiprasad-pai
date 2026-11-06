import { RrgQuadrant, RrgSecurityData, QUADRANT_META } from './rrgCalculator';
import { MinerviniTradeSetup } from '../types';
import { playRrgLeadingChime, playRrgWeakeningTone } from './audioAlertEngine';
import { getCurrencySymbol } from './sepaCalculator';

export type RrgLeadingTransitionType = 'ENTERED_LEADING' | 'EXITED_LEADING';

export interface RrgQuadrantNotification {
  id: string;
  ticker: string;
  name: string;
  sector?: string;
  exchange?: string;
  currentPrice?: number;
  transitionType: RrgLeadingTransitionType;
  fromQuadrant: RrgQuadrant;
  toQuadrant: RrgQuadrant;
  rsRatio: number;
  rsMomentum: number;
  timestamp: string; // ISO string
  timeFormatted: string; // e.g. "10:45 AM"
  dateFormatted: string; // e.g. "Nov 6, 2026"
  title: string;
  message: string;
  sepaAction: string;
  read: boolean;
  benchmarkId?: string;
}

export interface RrgNotificationSettings {
  enabled: boolean;
  soundEnabled: boolean;
  browserNotifsEnabled: boolean;
  alertOnEnterLeading: boolean;
  alertOnExitLeading: boolean;
  trackedWatchlistOnly: boolean;
}

export const RRG_NOTIFICATIONS_KEY = 'minervini_rrg_persistent_notifications';
export const RRG_LAST_QUADRANTS_KEY = 'minervini_rrg_tracked_quadrants';
export const RRG_NOTIF_SETTINGS_KEY = 'minervini_rrg_notification_settings';

export const DEFAULT_RRG_NOTIF_SETTINGS: RrgNotificationSettings = {
  enabled: true,
  soundEnabled: true,
  browserNotifsEnabled: true,
  alertOnEnterLeading: true,
  alertOnExitLeading: true,
  trackedWatchlistOnly: true,
};

/**
 * Loads persistent notification preferences from localStorage.
 */
export function getRrgNotificationSettings(): RrgNotificationSettings {
  if (typeof window === 'undefined') return DEFAULT_RRG_NOTIF_SETTINGS;
  try {
    const raw = localStorage.getItem(RRG_NOTIF_SETTINGS_KEY);
    if (raw) {
      return { ...DEFAULT_RRG_NOTIF_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.error('Failed to load RRG notification settings:', e);
  }
  return DEFAULT_RRG_NOTIF_SETTINGS;
}

/**
 * Saves persistent notification preferences to localStorage.
 */
export function saveRrgNotificationSettings(
  settings: Partial<RrgNotificationSettings>
): RrgNotificationSettings {
  if (typeof window === 'undefined') return DEFAULT_RRG_NOTIF_SETTINGS;
  try {
    const current = getRrgNotificationSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(RRG_NOTIF_SETTINGS_KEY, JSON.stringify(updated));
    window.dispatchEvent(
      new CustomEvent('minervini_rrg_notif_settings_updated', { detail: updated })
    );
    return updated;
  } catch (e) {
    console.error('Failed to save RRG notification settings:', e);
    return DEFAULT_RRG_NOTIF_SETTINGS;
  }
}

/**
 * Loads stored RRG quadrant transition notifications from localStorage.
 */
export function getStoredRrgNotifications(): RrgQuadrantNotification[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RRG_NOTIFICATIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load RRG notifications:', e);
  }
  return [];
}

/**
 * Saves RRG quadrant transition notifications to localStorage.
 * Retains the latest 60 records to prevent storage exhaustion.
 */
export function saveStoredRrgNotifications(notifications: RrgQuadrantNotification[]): void {
  if (typeof window === 'undefined') return;
  try {
    const trimmed = notifications.slice(0, 60);
    localStorage.setItem(RRG_NOTIFICATIONS_KEY, JSON.stringify(trimmed));
    window.dispatchEvent(
      new CustomEvent('minervini_rrg_notifications_updated', { detail: trimmed })
    );
  } catch (e) {
    console.error('Failed to save RRG notifications:', e);
  }
}

/**
 * Marks a specific notification as read in persistent storage.
 */
export function markRrgNotificationAsRead(id: string): RrgQuadrantNotification[] {
  const current = getStoredRrgNotifications();
  const updated = current.map((n) => (n.id === id ? { ...n, read: true } : n));
  saveStoredRrgNotifications(updated);
  return updated;
}

/**
 * Marks all persistent notifications as read.
 */
export function markAllRrgNotificationsAsRead(): RrgQuadrantNotification[] {
  const current = getStoredRrgNotifications();
  const updated = current.map((n) => ({ ...n, read: true }));
  saveStoredRrgNotifications(updated);
  return updated;
}

/**
 * Deletes a single persistent notification.
 */
export function deleteRrgNotification(id: string): RrgQuadrantNotification[] {
  const current = getStoredRrgNotifications();
  const updated = current.filter((n) => n.id !== id);
  saveStoredRrgNotifications(updated);
  return updated;
}

/**
 * Clears all persistent notifications from storage.
 */
export function clearAllRrgNotifications(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(RRG_NOTIFICATIONS_KEY);
    window.dispatchEvent(new CustomEvent('minervini_rrg_notifications_updated', { detail: [] }));
  } catch (e) {
    console.error('Failed to clear RRG notifications:', e);
  }
}

/**
 * Retrieves the last known quadrant state for tracked tickers.
 */
export function getStoredRrgLastQuadrants(): Record<string, RrgQuadrant> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(RRG_LAST_QUADRANTS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to load last RRG quadrants:', e);
  }
  return {};
}

/**
 * Saves the latest quadrant state for tracked tickers.
 */
export function saveStoredRrgLastQuadrants(map: Record<string, RrgQuadrant>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(RRG_LAST_QUADRANTS_KEY, JSON.stringify(map));
  } catch (e) {
    console.error('Failed to save last RRG quadrants:', e);
  }
}

/**
 * Core Surveillance Engine:
 * Compares the current RRG quadrant of all watchlist stocks against their last stored state.
 * Generates and stores persistent alerts when a stock moves into or out of the 'Leading' quadrant.
 */
export function evaluateRrgLeadingTransitions(
  currentItems: RrgSecurityData[],
  trackedTickers: string[],
  benchmarkId: string = 'SPY'
): {
  newNotifications: RrgQuadrantNotification[];
  updatedMap: Record<string, RrgQuadrant>;
} {
  const settings = getRrgNotificationSettings();
  if (!settings.enabled) {
    return { newNotifications: [], updatedMap: getStoredRrgLastQuadrants() };
  }

  const lastQuadrants = getStoredRrgLastQuadrants();
  const updatedMap = { ...lastQuadrants };
  const newNotifications: RrgQuadrantNotification[] = [];
  const now = new Date();
  const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateFormatted = now.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

  // Filter candidate items: only watchlist stocks if trackedWatchlistOnly is active
  const targetItems = settings.trackedWatchlistOnly && trackedTickers.length > 0
    ? currentItems.filter((item) => trackedTickers.includes(item.ticker) || (item.stockRef && trackedTickers.includes(item.stockRef.ticker)))
    : currentItems;

  for (const item of targetItems) {
    const ticker = item.ticker;
    const currentQuad = item.quadrant;
    const prevQuad = lastQuadrants[ticker];

    // If we have a recorded previous quadrant and it differs from current:
    if (prevQuad && prevQuad !== currentQuad) {
      const currSymbol = getCurrencySymbol(item.exchange || 'NASDAQ');

      // 1. MOVED INTO LEADING QUADRANT
      if (prevQuad !== 'LEADING' && currentQuad === 'LEADING' && settings.alertOnEnterLeading) {
        const notif: RrgQuadrantNotification = {
          id: `rrg-notif-${ticker}-enter-lead-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          ticker,
          name: item.name,
          sector: item.sector,
          exchange: item.exchange,
          currentPrice: item.currentPrice,
          transitionType: 'ENTERED_LEADING',
          fromQuadrant: prevQuad,
          toQuadrant: 'LEADING',
          rsRatio: item.currentRsRatio,
          rsMomentum: item.currentRsMomentum,
          timestamp: now.toISOString(),
          timeFormatted,
          dateFormatted,
          title: `🚀 LEADING ROTATION: ${ticker} Entered Leading Quadrant`,
          message: `${ticker} (${item.name}) rotated from ${prevQuad} into the LEADING quadrant vs ${benchmarkId}! RS-Ratio: ${item.currentRsRatio.toFixed(1)}, RS-Momentum: ${item.currentRsMomentum.toFixed(1)} @ ${currSymbol}${item.currentPrice.toFixed(2)}.`,
          sepaAction: `SEPA Strategy: High-conviction institutional accumulation. Qualified for primary Stage 2 position sizing. Look for tight VCP pivots or high tight flags.`,
          read: false,
          benchmarkId,
        };
        newNotifications.push(notif);

        // Sound chime
        if (settings.soundEnabled) {
          playRrgLeadingChime();
        }

        // Native Browser Notification
        if (settings.browserNotifsEnabled && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification(notif.title, {
              body: notif.message,
              icon: '/favicon.ico',
            });
          } catch (e) {
            console.warn('Native notification failed:', e);
          }
        }
      }

      // 2. MOVED OUT OF LEADING QUADRANT
      else if (prevQuad === 'LEADING' && currentQuad !== 'LEADING' && settings.alertOnExitLeading) {
        const notif: RrgQuadrantNotification = {
          id: `rrg-notif-${ticker}-exit-lead-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          ticker,
          name: item.name,
          sector: item.sector,
          exchange: item.exchange,
          currentPrice: item.currentPrice,
          transitionType: 'EXITED_LEADING',
          fromQuadrant: 'LEADING',
          toQuadrant: currentQuad,
          rsRatio: item.currentRsRatio,
          rsMomentum: item.currentRsMomentum,
          timestamp: now.toISOString(),
          timeFormatted,
          dateFormatted,
          title: `⚠️ LEADING EXODUS: ${ticker} Exited Leading into ${currentQuad}`,
          message: `${ticker} (${item.name}) slipped out of LEADING into ${currentQuad} vs ${benchmarkId}. RS-Ratio: ${item.currentRsRatio.toFixed(1)}, RS-Momentum: ${item.currentRsMomentum.toFixed(1)} @ ${currSymbol}${item.currentPrice.toFixed(2)}.`,
          sepaAction: `SEPA Defense Protocol: Momentum deceleration detected. Protect profits with trailing stops to 21-Day EMA or breakeven. Avoid buying extended breakouts.`,
          read: false,
          benchmarkId,
        };
        newNotifications.push(notif);

        // Warning Tone
        if (settings.soundEnabled) {
          playRrgWeakeningTone();
        }

        // Native Browser Notification
        if (settings.browserNotifsEnabled && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification(notif.title, {
              body: notif.message,
              icon: '/favicon.ico',
            });
          } catch (e) {
            console.warn('Native notification failed:', e);
          }
        }
      }
    }

    // Always update current quadrant in map
    updatedMap[ticker] = currentQuad;
  }

  // Save updated quadrant map
  saveStoredRrgLastQuadrants(updatedMap);

  // If new notifications were generated, prepend and save to persistent storage
  if (newNotifications.length > 0) {
    const existing = getStoredRrgNotifications();
    const combined = [...newNotifications, ...existing];
    saveStoredRrgNotifications(combined);

    // Dispatch custom event for real-time UI components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('minervini_rrg_leading_transition_event', {
          detail: { notifications: newNotifications },
        })
      );
    }
  }

  return { newNotifications, updatedMap };
}

/**
 * Creates a simulated Leading transition notification for instant testing and verification.
 */
export function simulateLeadingTransition(
  target: MinerviniTradeSetup | RrgSecurityData,
  type: RrgLeadingTransitionType,
  benchmarkId: string = 'SPY'
): RrgQuadrantNotification {
  const now = new Date();
  const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateFormatted = now.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  const currSymbol = getCurrencySymbol(target.exchange || 'NASDAQ');
  const price = target.currentPrice || 100;

  const isEntered = type === 'ENTERED_LEADING';
  const fromQuad: RrgQuadrant = isEntered ? 'IMPROVING' : 'LEADING';
  const toQuad: RrgQuadrant = isEntered ? 'LEADING' : 'WEAKENING';
  const rsRatio = isEntered ? 103.5 : 101.2;
  const rsMomentum = isEntered ? 104.8 : 98.4;

  const notif: RrgQuadrantNotification = {
    id: `rrg-sim-${target.ticker}-${type}-${Date.now()}`,
    ticker: target.ticker,
    name: target.name,
    sector: target.sector,
    exchange: target.exchange,
    currentPrice: price,
    transitionType: type,
    fromQuadrant: fromQuad,
    toQuadrant: toQuad,
    rsRatio,
    rsMomentum,
    timestamp: now.toISOString(),
    timeFormatted,
    dateFormatted,
    title: isEntered
      ? `🚀 LEADING ROTATION: ${target.ticker} Entered Leading Quadrant`
      : `⚠️ LEADING EXODUS: ${target.ticker} Exited Leading into WEAKENING`,
    message: isEntered
      ? `${target.ticker} (${target.name}) just rotated from ${fromQuad} into the LEADING quadrant! RS-Ratio: ${rsRatio}, RS-Momentum: ${rsMomentum} @ ${currSymbol}${price.toFixed(2)}.`
      : `${target.ticker} (${target.name}) rotated out of LEADING into WEAKENING. RS-Ratio: ${rsRatio}, RS-Momentum: ${rsMomentum} @ ${currSymbol}${price.toFixed(2)}.`,
    sepaAction: isEntered
      ? `SEPA Strategy: High-conviction institutional accumulation. Buy signal confirmed on relative strength and momentum.`
      : `SEPA Defense: Momentum deceleration. Tighten stops to 21-Day EMA or breakeven; scale partial profits.`,
    read: false,
    benchmarkId,
  };

  const existing = getStoredRrgNotifications();
  saveStoredRrgNotifications([notif, ...existing]);

  // Update quadrant state
  const lastQuadrants = getStoredRrgLastQuadrants();
  lastQuadrants[target.ticker] = toQuad;
  saveStoredRrgLastQuadrants(lastQuadrants);

  // Play appropriate sound
  if (isEntered) {
    playRrgLeadingChime();
  } else {
    playRrgWeakeningTone();
  }

  // Trigger browser notification if allowed
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(notif.title, {
        body: notif.message,
        icon: '/favicon.ico',
      });
    } catch (e) {
      console.warn('Native notification failed:', e);
    }
  }

  // Dispatch custom event
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('minervini_rrg_leading_transition_event', {
        detail: { notifications: [notif] },
      })
    );
  }

  return notif;
}
