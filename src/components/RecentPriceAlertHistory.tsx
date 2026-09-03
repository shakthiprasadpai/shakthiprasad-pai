import React, { useState, useEffect, useMemo } from 'react';
import { MinerviniTradeSetup, PriceAlertHistoryRecord } from '../types';
import { getCurrencySymbol, formatCurrency, formatVolume } from '../utils/sepaCalculator';
import {
  getAlertHistoryForStock,
  logAlertTrigger,
  acknowledgeAlertHistoryItem,
  clearStockAlertHistory,
  exportStockAlertHistoryCsv,
  PRICE_ALERT_HISTORY_UPDATED_EVENT
} from '../utils/priceAlertHistoryStorage';
import { playAlertChime } from '../utils/backgroundPriceChecker';
import {
  History,
  Activity,
  Zap,
  Target,
  ShieldAlert,
  Volume2,
  AlertTriangle,
  CheckCircle2,
  Download,
  Trash2,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  RefreshCw,
  Info,
  Clock,
  Flame,
  Check,
  Search
} from 'lucide-react';

interface RecentPriceAlertHistoryProps {
  stock: MinerviniTradeSetup;
  allStocks?: MinerviniTradeSetup[];
  onSelectStock?: (stock: MinerviniTradeSetup) => void;
  className?: string;
}

export const RecentPriceAlertHistory: React.FC<RecentPriceAlertHistoryProps> = ({
  stock,
  allStocks = [],
  onSelectStock,
  className = ''
}) => {
  const currencySymbol = getCurrencySymbol(stock.exchange);

  // State
  const [history, setHistory] = useState<PriceAlertHistoryRecord[]>(() => {
    return getAlertHistoryForStock(stock.ticker, stock);
  });
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'TRIGGERED' | 'ACKNOWLEDGED'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [simulatingEvent, setSimulatingEvent] = useState<string | null>(null);
  const [showConfirmClear, setShowConfirmClear] = useState<boolean>(false);
  const [selectedRecord, setSelectedRecord] = useState<PriceAlertHistoryRecord | null>(null);

  // Reload history when selected stock changes or when global update event fires
  const refreshHistory = () => {
    const records = getAlertHistoryForStock(stock.ticker, stock);
    setHistory(records);
  };

  useEffect(() => {
    refreshHistory();
  }, [stock.ticker]);

  useEffect(() => {
    const handleHistoryUpdate = () => {
      refreshHistory();
    };

    window.addEventListener(PRICE_ALERT_HISTORY_UPDATED_EVENT, handleHistoryUpdate);
    window.addEventListener('minervini_alerts_updated', handleHistoryUpdate);
    window.addEventListener('storage', handleHistoryUpdate);

    return () => {
      window.removeEventListener(PRICE_ALERT_HISTORY_UPDATED_EVENT, handleHistoryUpdate);
      window.removeEventListener('minervini_alerts_updated', handleHistoryUpdate);
      window.removeEventListener('storage', handleHistoryUpdate);
    };
  }, [stock.ticker]);

  // Filtering
  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      // Event type filter
      if (eventTypeFilter !== 'ALL') {
        if (eventTypeFilter === 'PIVOT' && item.alertType !== 'PIVOT_ENTRY') return false;
        if (eventTypeFilter === 'VOLATILITY' && item.alertType !== 'VOLATILITY_DRYUP') return false;
        if (eventTypeFilter === 'STOP' && item.alertType !== 'STOP_LOSS') return false;
        if (eventTypeFilter === 'PROXIMITY' && item.alertType !== 'PROXIMITY_WARNING') return false;
      }

      // Status filter
      if (statusFilter !== 'ALL' && item.status !== statusFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesLabel = item.eventTypeLabel.toLowerCase().includes(q);
        const matchesNotes = (item.notes || '').toLowerCase().includes(q);
        const matchesPrice = item.triggeredPrice.toString().includes(q);
        if (!matchesLabel && !matchesNotes && !matchesPrice) {
          return false;
        }
      }

      return true;
    });
  }, [history, eventTypeFilter, statusFilter, searchQuery]);

  // Summary Volatility Statistics for currently selected stock
  const stats = useMemo(() => {
    const total = history.length;
    const breakoutCount = history.filter((h) => h.alertType === 'PIVOT_ENTRY').length;
    const volatilityDryUpCount = history.filter((h) => h.alertType === 'VOLATILITY_DRYUP').length;
    const stopCount = history.filter((h) => h.alertType === 'STOP_LOSS').length;

    const prices = history.map((h) => h.triggeredPrice).filter((p) => p > 0);
    const maxTriggered = prices.length > 0 ? Math.max(...prices) : stock.currentPrice;
    const minTriggered = prices.length > 0 ? Math.min(...prices) : stock.currentPrice;
    const volatilitySpread = maxTriggered - minTriggered;
    const volatilitySpreadPct = minTriggered > 0 ? (volatilitySpread / minTriggered) * 100 : 0;

    const latest = history[0];

    return {
      total,
      breakoutCount,
      volatilityDryUpCount,
      stopCount,
      maxTriggered,
      minTriggered,
      volatilitySpread,
      volatilitySpreadPct,
      latest
    };
  }, [history, stock.currentPrice]);

  // Trigger interactive test simulation
  const handleSimulateEvent = (type: 'BREAKOUT_PIVOT' | 'VOLATILITY_DRYUP' | 'PROXIMITY' | 'STOP_LOSS') => {
    setSimulatingEvent(type);
    playAlertChime();

    let record: PriceAlertHistoryRecord;
    const now = new Date();

    if (type === 'BREAKOUT_PIVOT') {
      const triggeredPrice = Number((stock.pivotPrice + 0.85).toFixed(2));
      record = logAlertTrigger({
        ticker: stock.ticker,
        stockName: stock.name,
        exchange: stock.exchange,
        triggeredPrice,
        targetPrice: stock.pivotPrice,
        alertType: 'PIVOT_ENTRY',
        eventTypeLabel: 'Breakout Pivot Crossover (+0.85)',
        volatilityEventType: 'BREAKOUT_SURGE',
        severity: 'SUCCESS',
        volumeAtTrigger: Math.round(stock.avgVolume20d * 1.8),
        avgVolume20d: stock.avgVolume20d,
        volatilityRangePercent: 3.1,
        notes: `Simulated trigger: Price crossed above ${currencySymbol}${stock.pivotPrice.toFixed(2)} breakout pivot with 1.8x institutional volume confirmation.`,
      });
    } else if (type === 'VOLATILITY_DRYUP') {
      record = logAlertTrigger({
        ticker: stock.ticker,
        stockName: stock.name,
        exchange: stock.exchange,
        triggeredPrice: stock.currentPrice,
        targetPrice: stock.pivotPrice,
        alertType: 'VOLATILITY_DRYUP',
        eventTypeLabel: 'VCP Volatility Dry-Up Primed',
        volatilityEventType: 'SUPPLY_SQUEEZE',
        severity: 'INFO',
        volumeAtTrigger: Math.round(stock.avgVolume20d * 0.38),
        avgVolume20d: stock.avgVolume20d,
        volatilityRangePercent: 2.9,
        notes: `Simulated trigger: 3-Week trading range contracted to ≤ 2.9% with volume dry-up reaching -62%. Supply exhaustion confirmed.`,
      });
    } else if (type === 'PROXIMITY') {
      const triggeredPrice = Number((stock.pivotPrice * 0.988).toFixed(2));
      record = logAlertTrigger({
        ticker: stock.ticker,
        stockName: stock.name,
        exchange: stock.exchange,
        triggeredPrice,
        targetPrice: stock.pivotPrice,
        alertType: 'PROXIMITY_WARNING',
        eventTypeLabel: 'Pre-Breakout Proximity Warning (≤ 1.2%)',
        volatilityEventType: 'APPROACHING_PIVOT',
        severity: 'WARNING',
        volumeAtTrigger: Math.round(stock.avgVolume20d * 1.05),
        avgVolume20d: stock.avgVolume20d,
        volatilityRangePercent: 3.4,
        notes: `Simulated trigger: Price reached ${currencySymbol}${triggeredPrice.toFixed(2)}, approaching within 1.2% of breakout trigger point.`,
      });
    } else {
      const triggeredPrice = Number((stock.stopLossPrice - 0.40).toFixed(2));
      record = logAlertTrigger({
        ticker: stock.ticker,
        stockName: stock.name,
        exchange: stock.exchange,
        triggeredPrice,
        targetPrice: stock.stopLossPrice,
        alertType: 'STOP_LOSS',
        eventTypeLabel: 'Stop Loss Defense Trigger (-0.40)',
        volatilityEventType: 'RISK_VIOLATION',
        severity: 'CRITICAL',
        volumeAtTrigger: Math.round(stock.avgVolume20d * 1.3),
        avgVolume20d: stock.avgVolume20d,
        volatilityRangePercent: 5.8,
        notes: `Simulated trigger: Price dipped to ${currencySymbol}${triggeredPrice.toFixed(2)}, violating stop loss threshold at ${currencySymbol}${stock.stopLossPrice.toFixed(2)}. Hard risk defense triggered.`,
      });
    }

    refreshHistory();
    setTimeout(() => setSimulatingEvent(null), 1200);
  };

  const handleAcknowledge = (id: string) => {
    acknowledgeAlertHistoryItem(id);
    refreshHistory();
  };

  const handleClearHistory = () => {
    clearStockAlertHistory(stock.ticker);
    setShowConfirmClear(false);
    refreshHistory();
  };

  const handleExportCsv = () => {
    exportStockAlertHistoryCsv(stock.ticker, stock.name);
  };

  return (
    <div id="recent-price-alert-history-table" className={`bg-white border-2 border-[#1a1a1a] shadow-md p-6 space-y-6 ${className}`}>
      {/* Component Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#e5e4e1] pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-amber-700 bg-amber-50 border border-amber-300 px-2 py-0.5">
              SEPA Volatility Surveillance
            </span>
            <span className="text-[10px] font-mono text-gray-500">Live Timestamp &amp; Price Trigger Log</span>
          </div>
          <h3 className="text-xl font-serif font-black text-[#1a1a1a] mt-1 flex items-center space-x-2">
            <span>Recent Price Alert History: {stock.ticker}</span>
            <History className="w-5 h-5 text-amber-600" />
          </h3>
          <p className="text-xs text-gray-600 font-serif italic mt-0.5 max-w-2xl leading-relaxed">
            Chronological audit log tracking every triggered price level, breakout crossover, and volatility contraction event for{' '}
            <strong className="text-black font-mono not-italic">{stock.name} ({stock.exchange})</strong>.
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Export CSV Button */}
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={history.length === 0}
            className="px-3 py-1.5 bg-[#f9f8f5] hover:bg-[#f0eee9] text-[#1a1a1a] border border-[#d6d4cf] text-xs font-mono font-bold uppercase tracking-wider flex items-center space-x-1.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title={`Export ${stock.ticker} price alert history as CSV`}
          >
            <Download className="w-3.5 h-3.5 text-gray-700" />
            <span>Export CSV</span>
          </button>

          {/* Clear History Button */}
          {showConfirmClear ? (
            <div className="flex items-center space-x-1 bg-rose-50 border border-rose-300 p-1">
              <span className="text-[10px] font-mono font-bold text-rose-800 px-1">Clear {stock.ticker}?</span>
              <button
                type="button"
                onClick={handleClearHistory}
                className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-mono font-bold uppercase cursor-pointer"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setShowConfirmClear(false)}
                className="px-2 py-0.5 bg-gray-200 hover:bg-gray-300 text-gray-800 text-[10px] font-mono font-bold uppercase cursor-pointer"
              >
                No
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowConfirmClear(true)}
              disabled={history.length === 0}
              className="px-2.5 py-1.5 bg-white hover:bg-rose-50 text-rose-700 hover:text-rose-900 border border-rose-200 text-xs font-mono font-bold uppercase tracking-wider flex items-center space-x-1 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Clear logged alert events for this stock"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}

          {/* Refresh button */}
          <button
            type="button"
            onClick={refreshHistory}
            className="p-1.5 bg-[#f9f8f5] hover:bg-[#f0eee9] text-gray-700 border border-[#d6d4cf] transition-all cursor-pointer"
            title="Refresh alert history"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Selected Stock Reference Banner & Quick Simulator Bar */}
      <div className="bg-[#0e131d] text-white p-4 border border-gray-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 bg-amber-400 text-black font-black font-mono text-sm">
                {stock.ticker}
              </span>
              <span className="text-gray-300 font-sans font-medium">{stock.name}</span>
              <span className="text-[10px] bg-gray-800 text-gray-300 px-1.5 py-0.5 border border-gray-700">
                {stock.exchange}
              </span>
            </div>
            <span className="text-gray-600">•</span>
            <span>Current: <strong className="text-white">{currencySymbol}{stock.currentPrice.toFixed(2)}</strong></span>
            <span className="text-gray-600">•</span>
            <span>Pivot: <strong className="text-amber-400">{currencySymbol}{stock.pivotPrice.toFixed(2)}</strong></span>
            <span className="text-gray-600">•</span>
            <span>Stop: <strong className="text-rose-400">{currencySymbol}{stock.stopLossPrice.toFixed(2)}</strong></span>
          </div>

          <div className="flex items-center space-x-2 text-[11px]">
            <span className="text-gray-400 flex items-center space-x-1">
              <Activity className="w-3 h-3 text-emerald-400 animate-pulse" />
              <span>Surveillance Status:</span>
            </span>
            <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-600 font-bold uppercase">
              Active Monitoring
            </span>
          </div>
        </div>

        {/* Quick Simulator Buttons */}
        <div className="pt-2 border-t border-gray-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-1.5 text-xs text-amber-300">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-bold font-mono uppercase text-[11px]">Simulate / Test Trigger:</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleSimulateEvent('BREAKOUT_PIVOT')}
              disabled={simulatingEvent !== null}
              className="px-2.5 py-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-600 text-[11px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer"
            >
              + Breakout Pivot (+{currencySymbol}0.85)
            </button>

            <button
              type="button"
              onClick={() => handleSimulateEvent('VOLATILITY_DRYUP')}
              disabled={simulatingEvent !== null}
              className="px-2.5 py-1 bg-purple-950 hover:bg-purple-900 text-purple-300 border border-purple-600 text-[11px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer"
            >
              ⚡ Volatility Dry-Up Primed
            </button>

            <button
              type="button"
              onClick={() => handleSimulateEvent('PROXIMITY')}
              disabled={simulatingEvent !== null}
              className="px-2.5 py-1 bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-600 text-[11px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer"
            >
              ⏱ Proximity Warning (≤1.2%)
            </button>

            <button
              type="button"
              onClick={() => handleSimulateEvent('STOP_LOSS')}
              disabled={simulatingEvent !== null}
              className="px-2.5 py-1 bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-600 text-[11px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer"
            >
              🛡 Stop Loss Defense Trigger
            </button>
          </div>
        </div>
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
        {/* Card 1: Total Triggered */}
        <div className="bg-[#f9f8f5] border border-[#e5e4e1] p-3 space-y-1">
          <span className="text-[10px] uppercase font-bold text-gray-500 block">
            Total Triggered Alerts
          </span>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-2xl font-black text-[#1a1a1a]">{stats.total}</span>
            <span className="text-[10px] text-gray-500">events</span>
          </div>
          <span className="text-[10px] text-gray-500 block">
            {stats.breakoutCount} Breakouts • {stats.volatilityDryUpCount} Dry-Ups
          </span>
        </div>

        {/* Card 2: Latest Trigger Event */}
        <div className="bg-[#f9f8f5] border border-[#e5e4e1] p-3 space-y-1">
          <span className="text-[10px] uppercase font-bold text-gray-500 block">
            Most Recent Event
          </span>
          {stats.latest ? (
            <>
              <div className="flex items-baseline space-x-1.5">
                <span className="text-base font-black text-amber-700 truncate">
                  {currencySymbol}{stats.latest.triggeredPrice.toFixed(2)}
                </span>
                <span className="text-[10px] font-bold text-gray-600">
                  ({stats.latest.relativeTime})
                </span>
              </div>
              <span className="text-[10px] text-gray-600 block truncate" title={stats.latest.eventTypeLabel}>
                {stats.latest.eventTypeLabel}
              </span>
            </>
          ) : (
            <span className="text-gray-400 italic">No events logged</span>
          )}
        </div>

        {/* Card 3: Volatility Price Corridor */}
        <div className="bg-[#f9f8f5] border border-[#e5e4e1] p-3 space-y-1">
          <span className="text-[10px] uppercase font-bold text-gray-500 block">
            Triggered Price Range
          </span>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-base font-black text-slate-800">
              {currencySymbol}{stats.minTriggered.toFixed(2)} – {currencySymbol}{stats.maxTriggered.toFixed(2)}
            </span>
          </div>
          <span className="text-[10px] text-emerald-700 font-bold block">
            Spread: {currencySymbol}{stats.volatilitySpread.toFixed(2)} ({stats.volatilitySpreadPct.toFixed(1)}%)
          </span>
        </div>

        {/* Card 4: Volatility Tension Status */}
        <div className="bg-[#f9f8f5] border border-[#e5e4e1] p-3 space-y-1">
          <span className="text-[10px] uppercase font-bold text-gray-500 block">
            Volatility Contraction Phase
          </span>
          <div className="flex items-baseline space-x-1">
            <span className="text-sm font-black text-purple-900 uppercase">
              {stock.vcpStage || 'Stage 2'} Base Contraction
            </span>
          </div>
          <span className="text-[10px] text-purple-700 block">
            Dry-up: {stock.volumeDryUpPercent}% vs 20d MA
          </span>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="bg-[#f9f8f5] border border-[#e5e4e1] p-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          {/* Event Type Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[10px] font-bold uppercase text-gray-500 mr-1 flex items-center space-x-1">
              <Filter className="w-3 h-3" />
              <span>Filter:</span>
            </span>

            {[
              { id: 'ALL', label: `All Events (${history.length})` },
              { id: 'PIVOT', label: `Breakout Pivots (${stats.breakoutCount})` },
              { id: 'VOLATILITY', label: `Volatility Dry-Up (${stats.volatilityDryUpCount})` },
              { id: 'PROXIMITY', label: 'Proximity Warnings' },
              { id: 'STOP', label: `Stop Losses (${stats.stopCount})` },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setEventTypeFilter(f.id)}
                className={`px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                  eventTypeFilter === f.id
                    ? 'bg-[#1a1a1a] text-white border-black shadow-2xs'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Status filter pills */}
          <div className="flex items-center space-x-1 text-[11px]">
            {(['ALL', 'TRIGGERED', 'ACKNOWLEDGED'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2 py-0.5 font-bold uppercase cursor-pointer border ${
                  statusFilter === st
                    ? 'bg-amber-100 text-amber-900 border-amber-400'
                    : 'bg-white text-gray-600 border-gray-300 hover:text-black'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Search Input and Counter */}
        <div className="pt-2 border-t border-[#e5e4e1] flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-gray-500 font-serif italic text-[11px]">
            Displaying <strong className="text-black font-mono not-italic">{filteredHistory.length}</strong> of{' '}
            <strong className="text-black font-mono not-italic">{history.length}</strong> logged volatility events for {stock.ticker}.
          </span>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search event label, price, or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1 text-xs border border-gray-300 bg-white focus:outline-none focus:border-black font-mono w-64"
            />
          </div>
        </div>
      </div>

      {/* Main Table Component */}
      <div className="overflow-x-auto border border-[#1a1a1a] shadow-xs">
        <table className="w-full text-left font-mono text-xs border-collapse">
          <thead>
            <tr className="bg-[#10141d] text-gray-300 border-b-2 border-black text-[10px] uppercase tracking-wider">
              <th className="py-3 px-3.5">
                <div className="flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Timestamp</span>
                </div>
              </th>
              <th className="py-3 px-3.5">
                <div className="flex items-center space-x-1">
                  <Target className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Triggered Price Level</span>
                </div>
              </th>
              <th className="py-3 px-3.5">Target &amp; Deviation</th>
              <th className="py-3 px-3.5">Volatility Event &amp; Catalyst</th>
              <th className="py-3 px-3.5 text-center">Volume &amp; Dry-Up</th>
              <th className="py-3 px-3.5 text-center">Status</th>
              <th className="py-3 px-3.5 text-right">Action</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#e5e4e1] bg-white">
            {filteredHistory.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 px-4 text-center">
                  <div className="max-w-md mx-auto space-y-3">
                    <AlertTriangle className="w-8 h-8 text-amber-600 mx-auto" />
                    <h4 className="text-sm font-serif font-black text-gray-900">
                      No Volatility Events Found
                    </h4>
                    <p className="text-xs text-gray-500 font-serif italic">
                      {history.length === 0
                        ? `No price alerts have triggered for ${stock.ticker} yet. Click a simulation button above to generate a test event.`
                        : 'No events match your current filter or search criteria.'}
                    </p>
                    {history.length === 0 && (
                      <button
                        type="button"
                        onClick={() => handleSimulateEvent('BREAKOUT_PIVOT')}
                        className="px-4 py-2 bg-[#1a1a1a] text-white text-xs font-mono font-bold uppercase tracking-wider hover:bg-black transition-all cursor-pointer inline-flex items-center space-x-1.5"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        <span>Simulate Test Breakout Now</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filteredHistory.map((item, idx) => {
                const isPositiveDelta = item.priceDelta >= 0;
                const isBreakout = item.alertType === 'PIVOT_ENTRY';
                const isStop = item.alertType === 'STOP_LOSS';
                const isDryUp = item.alertType === 'VOLATILITY_DRYUP';
                const isProximity = item.alertType === 'PROXIMITY_WARNING';

                return (
                  <tr
                    key={item.id || `hist-row-${idx}`}
                    className={`hover:bg-[#f9f8f5] transition-colors ${
                      idx === 0 ? 'bg-amber-50/20' : ''
                    }`}
                  >
                    {/* Column 1: Timestamp */}
                    <td className="py-3 px-3.5 align-top">
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-bold text-[#1a1a1a]">{item.formattedTime}</span>
                          <span className="px-1.5 py-0.2 bg-gray-100 text-gray-700 text-[9px] font-bold">
                            {item.relativeTime}
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-500 block">{item.formattedDate}</span>
                      </div>
                    </td>

                    {/* Column 2: Triggered Price Level */}
                    <td className="py-3 px-3.5 align-top">
                      <div className="space-y-0.5">
                        <div className="flex items-baseline space-x-1.5">
                          <span className="text-base font-black text-[#1a1a1a]">
                            {currencySymbol}{item.triggeredPrice.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-gray-400 uppercase font-mono">
                            {item.exchange}
                          </span>
                        </div>

                        <div className="flex items-center space-x-1">
                          {isPositiveDelta ? (
                            <ArrowUpRight className="w-3 h-3 text-emerald-600 shrink-0" />
                          ) : (
                            <ArrowDownRight className="w-3 h-3 text-rose-600 shrink-0" />
                          )}
                          <span
                            className={`text-[11px] font-bold ${
                              isPositiveDelta ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {isPositiveDelta ? '+' : ''}{currencySymbol}{item.priceDelta.toFixed(2)} ({isPositiveDelta ? '+' : ''}{item.priceDeltaPercent.toFixed(2)}%)
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Column 3: Target & Deviation */}
                    <td className="py-3 px-3.5 align-top">
                      <div className="space-y-0.5">
                        <div className="text-gray-700 font-medium">
                          <span className="text-gray-400 text-[10px] block">Baseline Target:</span>
                          <strong>{currencySymbol}{item.targetPrice.toFixed(2)}</strong>
                        </div>
                        <span className="text-[10px] text-gray-500 block">
                          {isBreakout
                            ? 'Pivot Buy Point'
                            : isStop
                            ? 'Hard Stop Loss Level'
                            : isDryUp
                            ? 'Contraction Pivot'
                            : 'Proximity Threshold'}
                        </span>
                      </div>
                    </td>

                    {/* Column 4: Volatility Event & Description */}
                    <td className="py-3 px-3.5 align-top max-w-xs">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                              isBreakout
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                : isStop
                                ? 'bg-rose-100 text-rose-900 border-rose-300'
                                : isDryUp
                                ? 'bg-purple-100 text-purple-900 border-purple-300'
                                : isProximity
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : 'bg-gray-100 text-gray-800 border-gray-300'
                            }`}
                          >
                            {item.eventTypeLabel}
                          </span>
                        </div>

                        {item.notes && (
                          <p className="text-[11px] text-gray-600 font-sans leading-relaxed line-clamp-2" title={item.notes}>
                            {item.notes}
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Column 5: Volume & Dry-Up Conditions */}
                    <td className="py-3 px-3.5 align-top text-center">
                      <div className="space-y-0.5 inline-block text-left">
                        {item.volumeAtTrigger ? (
                          <>
                            <div className="text-[11px] font-bold text-gray-800">
                              {formatVolume(item.volumeAtTrigger)}
                            </div>
                            {item.volumeRatio && (
                              <span
                                className={`text-[10px] font-mono px-1 py-0.2 block ${
                                  item.volumeRatio >= 1.5
                                    ? 'text-emerald-700 font-black bg-emerald-50'
                                    : item.volumeRatio <= 0.6
                                    ? 'text-purple-700 font-bold bg-purple-50'
                                    : 'text-gray-600'
                                }`}
                              >
                                {item.volumeRatio >= 1.5 ? '🔥 ' : item.volumeRatio <= 0.6 ? '💧 ' : ''}
                                {item.volumeRatio}x 20d Avg
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-[10px] text-gray-400 italic font-sans">—</span>
                        )}

                        {item.volatilityRangePercent && (
                          <span className="text-[9px] text-gray-500 block font-mono">
                            Range: {item.volatilityRangePercent}%
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Column 6: Status */}
                    <td className="py-3 px-3.5 align-top text-center">
                      <span
                        className={`inline-flex items-center space-x-1 px-2 py-0.5 text-[10px] font-bold uppercase ${
                          item.status === 'TRIGGERED'
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-gray-100 text-gray-700 border border-gray-300'
                        }`}
                      >
                        {item.status === 'TRIGGERED' ? (
                          <>
                            <span className="w-1.5 h-1.5 bg-amber-600 rounded-full animate-pulse" />
                            <span>Triggered</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-3 h-3 text-gray-600" />
                            <span>Logged</span>
                          </>
                        )}
                      </span>
                    </td>

                    {/* Column 7: Actions */}
                    <td className="py-3 px-3.5 align-top text-right">
                      {item.status === 'TRIGGERED' ? (
                        <button
                          type="button"
                          onClick={() => handleAcknowledge(item.id)}
                          className="px-2.5 py-1 bg-[#1a1a1a] hover:bg-black text-white text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer"
                          title="Mark this volatility event as reviewed / acknowledged"
                        >
                          Acknowledge
                        </button>
                      ) : (
                        <span className="text-[10px] text-gray-400 font-sans italic">
                          Reviewed
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Educational Footer: Minervini Execution Rules */}
      <div className="bg-[#f9f8f5] border border-[#e5e4e1] p-4 text-xs font-sans text-gray-700 space-y-2">
        <div className="flex items-center space-x-2 text-[#1a1a1a] font-bold font-mono text-[11px] uppercase">
          <Info className="w-4 h-4 text-amber-700 shrink-0" />
          <span>Mark Minervini SEPA Principle: Why Tracking Triggered Price Levels Matters</span>
        </div>
        <p className="leading-relaxed font-serif italic text-gray-600 text-[11px]">
          "When a stock crosses its pivot, you want to see fast expansion through the price level with immediate volume.
          If a stock triggers an alert at the pivot, logs heavy volume, and holds above that price, it signals true institutional accumulation.
          Tracking previous trigger timestamps reveals whether supply is continually absorbing or if repeated false breakouts are failing."
        </p>
        <div className="flex flex-wrap items-center gap-4 text-[10px] font-mono text-gray-500 pt-1 border-t border-gray-200">
          <span>• Max Chase Rule: Never buy &gt; +5% above pivot level ({currencySymbol}{(stock.pivotPrice * 1.05).toFixed(2)})</span>
          <span>• Strict Hard Stop: Always exit if price triggers below {currencySymbol}{stock.stopLossPrice.toFixed(2)}</span>
          <span>• Real-time updates sync across tabs via LocalStorage event dispatchers</span>
        </div>
      </div>
    </div>
  );
};
