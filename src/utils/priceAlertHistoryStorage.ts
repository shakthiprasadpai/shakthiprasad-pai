import { PriceAlertHistoryRecord, MinerviniTradeSetup, PriceAlert } from '../types';
import { getCurrencySymbol } from './sepaCalculator';

export const PRICE_ALERT_HISTORY_STORAGE_KEY = 'minervini_price_alert_history';
export const PRICE_ALERT_HISTORY_UPDATED_EVENT = 'minervini_price_alert_history_updated';

// Format relative time (e.g. "2m ago", "1h ago", "Yesterday 14:20")
export function getRelativeTimeString(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSec < 45) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return 'Recently';
  }
}

// Generate realistic default alert history for a given stock
function generateStockSeedHistory(stock: MinerviniTradeSetup): PriceAlertHistoryRecord[] {
  const currency = getCurrencySymbol(stock.exchange);
  const now = new Date();

  // Create 4-5 historical volatility events spanning recent trading sessions
  const events: PriceAlertHistoryRecord[] = [];

  // 1. Recent Breakout Pivot Cross / Test
  const d1 = new Date(now.getTime() - 25 * 60 * 1000); // 25 mins ago
  const trigPrice1 = Number((stock.pivotPrice + 0.65).toFixed(2));
  const delta1 = Number((trigPrice1 - stock.pivotPrice).toFixed(2));
  const deltaPct1 = Number(((delta1 / stock.pivotPrice) * 100).toFixed(2));

  events.push({
    id: `hist-${stock.ticker}-pivot-${d1.getTime()}`,
    ticker: stock.ticker,
    stockName: stock.name,
    exchange: stock.exchange,
    timestamp: d1.toISOString(),
    formattedDate: d1.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }),
    formattedTime: d1.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    relativeTime: getRelativeTimeString(d1.toISOString()),
    triggeredPrice: trigPrice1,
    targetPrice: stock.pivotPrice,
    priceDelta: delta1,
    priceDeltaPercent: deltaPct1,
    alertType: 'PIVOT_ENTRY',
    eventTypeLabel: 'Breakout Pivot Crossover',
    volatilityEventType: 'BREAKOUT_SURGE',
    severity: 'SUCCESS',
    volumeAtTrigger: Math.round(stock.avgVolume20d * 1.65),
    avgVolume20d: stock.avgVolume20d,
    volumeRatio: 1.65,
    volatilityRangePercent: 3.2,
    notes: `Surpassed VCP Pivot resistance at ${currency}${stock.pivotPrice.toFixed(2)} with +65% heavy institutional volume surge.`,
    status: 'TRIGGERED',
  });

  // 2. Pre-Breakout Proximity Warning
  const d2 = new Date(now.getTime() - 2 * 60 * 60 * 1000 - 15 * 60 * 1000); // ~2.25 hours ago
  const trigPrice2 = Number((stock.pivotPrice * 0.988).toFixed(2)); // within 1.2%
  const delta2 = Number((trigPrice2 - stock.pivotPrice).toFixed(2));
  const deltaPct2 = Number(((delta2 / stock.pivotPrice) * 100).toFixed(2));

  events.push({
    id: `hist-${stock.ticker}-prox-${d2.getTime()}`,
    ticker: stock.ticker,
    stockName: stock.name,
    exchange: stock.exchange,
    timestamp: d2.toISOString(),
    formattedDate: d2.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }),
    formattedTime: d2.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    relativeTime: getRelativeTimeString(d2.toISOString()),
    triggeredPrice: trigPrice2,
    targetPrice: stock.pivotPrice,
    priceDelta: delta2,
    priceDeltaPercent: deltaPct2,
    alertType: 'PROXIMITY_WARNING',
    eventTypeLabel: 'Pre-Breakout Proximity Alert (≤ 1.5%)',
    volatilityEventType: 'APPROACHING_PIVOT',
    severity: 'WARNING',
    volumeAtTrigger: Math.round(stock.avgVolume20d * 0.95),
    avgVolume20d: stock.avgVolume20d,
    volumeRatio: 0.95,
    volatilityRangePercent: 2.8,
    notes: `Approached within 1.2% of key pivot buy point (${currency}${stock.pivotPrice.toFixed(2)}). Order execution primed.`,
    status: 'ACKNOWLEDGED',
  });

  // 3. Volatility Dry-Up Primed Alert
  const d3 = new Date(now.getTime() - 18 * 60 * 60 * 1000); // 18 hrs ago
  const trigPrice3 = Number((stock.currentPrice * 0.995).toFixed(2));
  events.push({
    id: `hist-${stock.ticker}-vcp-dryup-${d3.getTime()}`,
    ticker: stock.ticker,
    stockName: stock.name,
    exchange: stock.exchange,
    timestamp: d3.toISOString(),
    formattedDate: d3.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }),
    formattedTime: d3.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    relativeTime: getRelativeTimeString(d3.toISOString()),
    triggeredPrice: trigPrice3,
    targetPrice: stock.pivotPrice,
    priceDelta: Number((trigPrice3 - stock.pivotPrice).toFixed(2)),
    priceDeltaPercent: Number((((trigPrice3 - stock.pivotPrice) / stock.pivotPrice) * 100).toFixed(2)),
    alertType: 'VOLATILITY_DRYUP',
    eventTypeLabel: 'VCP Volatility Dry-Up Primed',
    volatilityEventType: 'SUPPLY_SQUEEZE',
    severity: 'INFO',
    volumeAtTrigger: Math.round(stock.avgVolume20d * 0.45),
    avgVolume20d: stock.avgVolume20d,
    volumeRatio: 0.45,
    volatilityRangePercent: Math.abs(stock.volumeDryUpPercent) > 0 ? 3.4 : 4.1,
    notes: `Extreme supply exhaustion detected: Daily volume contracted to ${stock.volumeDryUpPercent}% below 20-day benchmark with price tightness ≤ 4.0%.`,
    status: 'ACKNOWLEDGED',
  });

  // 4. Base Formed / Contraction Complete
  const d4 = new Date(now.getTime() - 42 * 60 * 60 * 1000); // 42 hrs ago
  const trigPrice4 = Number((stock.currentPrice * 0.978).toFixed(2));
  events.push({
    id: `hist-${stock.ticker}-base-${d4.getTime()}`,
    ticker: stock.ticker,
    stockName: stock.name,
    exchange: stock.exchange,
    timestamp: d4.toISOString(),
    formattedDate: d4.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }),
    formattedTime: d4.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    relativeTime: getRelativeTimeString(d4.toISOString()),
    triggeredPrice: trigPrice4,
    targetPrice: stock.pivotPrice,
    priceDelta: Number((trigPrice4 - stock.pivotPrice).toFixed(2)),
    priceDeltaPercent: Number((((trigPrice4 - stock.pivotPrice) / stock.pivotPrice) * 100).toFixed(2)),
    alertType: 'VCP_BASE_FORMED',
    eventTypeLabel: `${stock.vcpStage || 'T3'} Contraction Base Formed`,
    volatilityEventType: 'TIGHTENING_RANGE',
    severity: 'INFO',
    volumeAtTrigger: Math.round(stock.avgVolume20d * 0.52),
    avgVolume20d: stock.avgVolume20d,
    volumeRatio: 0.52,
    volatilityRangePercent: 4.6,
    notes: `Confirmed completion of ${stock.vcpStage || 'Stage 2'} contraction base structure. Volatility envelope tightened sequentially.`,
    status: 'ACKNOWLEDGED',
  });

  return events;
}

// Read all alert history records from localStorage
export function getAllAlertHistory(): PriceAlertHistoryRecord[] {
  try {
    const raw = localStorage.getItem(PRICE_ALERT_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Failed to read price alert history:', e);
    return [];
  }
}

// Get alert history specifically for a stock
export function getAlertHistoryForStock(ticker: string, fallbackStock?: MinerviniTradeSetup): PriceAlertHistoryRecord[] {
  const all = getAllAlertHistory();
  const filtered = all.filter((item) => item.ticker.toUpperCase() === ticker.toUpperCase());

  if (filtered.length > 0) {
    // Refresh relative times
    return filtered
      .map((item) => ({
        ...item,
        relativeTime: getRelativeTimeString(item.timestamp),
      }))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  // If no history exists for this stock yet, seed it automatically if fallbackStock is provided
  if (fallbackStock) {
    const seed = generateStockSeedHistory(fallbackStock);
    const updated = [...seed, ...all];
    saveAllAlertHistory(updated);
    return seed;
  }

  return [];
}

// Save alert history records to localStorage
export function saveAllAlertHistory(records: PriceAlertHistoryRecord[]): void {
  try {
    // Keep last 250 history records
    const trimmed = records.slice(0, 250);
    localStorage.setItem(PRICE_ALERT_HISTORY_STORAGE_KEY, JSON.stringify(trimmed));
    window.dispatchEvent(new CustomEvent(PRICE_ALERT_HISTORY_UPDATED_EVENT));
  } catch (e) {
    console.error('Failed to save alert history:', e);
  }
}

// Initialize seed data for all initial stocks
export function initializeAlertHistory(stocks: MinerviniTradeSetup[]): PriceAlertHistoryRecord[] {
  const existing = getAllAlertHistory();
  if (existing.length > 0) {
    return existing;
  }

  // Generate seed history across the initial stocks
  const allSeeds: PriceAlertHistoryRecord[] = [];
  stocks.forEach((stock) => {
    allSeeds.push(...generateStockSeedHistory(stock));
  });

  allSeeds.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  saveAllAlertHistory(allSeeds);
  return allSeeds;
}

// Append a single triggered price alert to history
export function logAlertTrigger(
  data: {
    ticker: string;
    stockName?: string;
    exchange?: string;
    triggeredPrice: number;
    targetPrice: number;
    alertType: PriceAlertHistoryRecord['alertType'];
    eventTypeLabel?: string;
    volatilityEventType?: PriceAlertHistoryRecord['volatilityEventType'];
    severity?: PriceAlertHistoryRecord['severity'];
    volumeAtTrigger?: number;
    avgVolume20d?: number;
    volatilityRangePercent?: number;
    notes?: string;
    timestamp?: string;
  }
): PriceAlertHistoryRecord {
  const now = data.timestamp ? new Date(data.timestamp) : new Date();
  const isoTime = now.toISOString();

  const priceDelta = Number((data.triggeredPrice - data.targetPrice).toFixed(2));
  const priceDeltaPercent = data.targetPrice > 0
    ? Number(((priceDelta / data.targetPrice) * 100).toFixed(2))
    : 0;

  // Infer defaults if not supplied
  let eventTypeLabel = data.eventTypeLabel;
  let volatilityEventType = data.volatilityEventType;
  let severity = data.severity;

  if (!eventTypeLabel) {
    switch (data.alertType) {
      case 'PIVOT_ENTRY':
        eventTypeLabel = 'Breakout Pivot Crossover';
        volatilityEventType = 'BREAKOUT_SURGE';
        severity = 'SUCCESS';
        break;
      case 'STOP_LOSS':
        eventTypeLabel = 'Stop Loss Defense Trigger';
        volatilityEventType = 'RISK_VIOLATION';
        severity = 'CRITICAL';
        break;
      case 'VOLATILITY_DRYUP':
        eventTypeLabel = 'VCP Volatility Dry-Up Primed';
        volatilityEventType = 'SUPPLY_SQUEEZE';
        severity = 'INFO';
        break;
      case 'PROXIMITY_WARNING':
        eventTypeLabel = 'Pre-Breakout Proximity Warning';
        volatilityEventType = 'APPROACHING_PIVOT';
        severity = 'WARNING';
        break;
      case 'VOLUME_SPIKE':
        eventTypeLabel = 'Volume Surge Expansion';
        volatilityEventType = 'VOLUME_EXPANSION';
        severity = 'SUCCESS';
        break;
      default:
        eventTypeLabel = 'Price Level Triggered';
        volatilityEventType = 'BREAKOUT_SURGE';
        severity = 'INFO';
    }
  }

  const volumeRatio = data.avgVolume20d && data.volumeAtTrigger && data.avgVolume20d > 0
    ? Number((data.volumeAtTrigger / data.avgVolume20d).toFixed(2))
    : undefined;

  const newRecord: PriceAlertHistoryRecord = {
    id: `alert-hist-${data.ticker}-${now.getTime()}-${Math.random().toString(36).substring(2, 6)}`,
    ticker: data.ticker,
    stockName: data.stockName,
    exchange: data.exchange || 'NASDAQ',
    timestamp: isoTime,
    formattedDate: now.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }),
    formattedTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    relativeTime: 'Just now',
    triggeredPrice: Number(data.triggeredPrice.toFixed(2)),
    targetPrice: Number(data.targetPrice.toFixed(2)),
    priceDelta,
    priceDeltaPercent,
    alertType: data.alertType,
    eventTypeLabel: eventTypeLabel || 'Price Alert Triggered',
    volatilityEventType: volatilityEventType || 'BREAKOUT_SURGE',
    severity: severity || 'INFO',
    volumeAtTrigger: data.volumeAtTrigger,
    avgVolume20d: data.avgVolume20d,
    volumeRatio,
    volatilityRangePercent: data.volatilityRangePercent,
    notes: data.notes,
    status: 'TRIGGERED',
  };

  const current = getAllAlertHistory();
  const updated = [newRecord, ...current];
  saveAllAlertHistory(updated);

  return newRecord;
}

// Mark an alert as acknowledged
export function acknowledgeAlertHistoryItem(id: string): void {
  const current = getAllAlertHistory();
  const updated = current.map((item) =>
    item.id === id ? { ...item, status: 'ACKNOWLEDGED' as const } : item
  );
  saveAllAlertHistory(updated);
}

// Clear history for a specific stock
export function clearStockAlertHistory(ticker: string): void {
  const current = getAllAlertHistory();
  const updated = current.filter((item) => item.ticker.toUpperCase() !== ticker.toUpperCase());
  saveAllAlertHistory(updated);
}

// Clear all history
export function clearAllAlertHistory(): void {
  try {
    localStorage.removeItem(PRICE_ALERT_HISTORY_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(PRICE_ALERT_HISTORY_UPDATED_EVENT));
  } catch (e) {
    console.error(e);
  }
}

// Export history as CSV
export function exportStockAlertHistoryCsv(ticker: string, stockName?: string): void {
  const history = getAlertHistoryForStock(ticker);
  if (history.length === 0) return;

  const headers = [
    'Timestamp',
    'Date',
    'Time',
    'Ticker',
    'Exchange',
    'Event Type',
    'Volatility Event',
    'Triggered Price',
    'Target Price',
    'Price Delta',
    'Price Delta %',
    'Severity',
    'Volume at Trigger',
    'Volume Ratio',
    'Volatility Range %',
    'Status',
    'Notes',
  ];

  const rows = history.map((item) => [
    `"${item.timestamp}"`,
    `"${item.formattedDate}"`,
    `"${item.formattedTime}"`,
    `"${item.ticker}"`,
    `"${item.exchange}"`,
    `"${item.eventTypeLabel}"`,
    `"${item.volatilityEventType}"`,
    item.triggeredPrice,
    item.targetPrice,
    item.priceDelta,
    `${item.priceDeltaPercent}%`,
    `"${item.severity}"`,
    item.volumeAtTrigger || '',
    item.volumeRatio ? `${item.volumeRatio}x` : '',
    item.volatilityRangePercent ? `${item.volatilityRangePercent}%` : '',
    `"${item.status}"`,
    `"${(item.notes || '').replace(/"/g, '""')}"`,
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `${ticker}_Price_Alert_History_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
