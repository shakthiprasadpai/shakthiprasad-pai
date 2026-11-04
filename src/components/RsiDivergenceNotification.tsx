import React, { useState, useMemo } from 'react';
import { MinerviniTradeSetup } from '../types';
import {
  detect52WeekHighRsiExhaustion,
  simulate52wHighExhaustion,
  Rsi52wExhaustionResult,
} from '../utils/rsiDivergenceEngine';
import {
  dispatchRsiDivergenceNotification,
  simulateRsiDivergence,
} from '../utils/technicalIndicatorsCalculator';
import { getCurrencySymbol, formatCurrency } from '../utils/sepaCalculator';
import { playAlertChime, appendTrackerLog } from '../utils/backgroundPriceChecker';
import {
  AlertTriangle,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  BellRing,
  Volume2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  X,
  Play,
  RotateCcw,
  Zap,
  Sliders,
  ExternalLink,
  Target,
  Info,
} from 'lucide-react';

interface RsiDivergenceNotificationProps {
  stocks: MinerviniTradeSetup[];
  selectedStock?: MinerviniTradeSetup;
  onSelectStock?: (stock: MinerviniTradeSetup) => void;
  onArmAlert?: (ticker: string, targetType: string, price: number, notes: string) => void;
  soundEnabled?: boolean;
}

export const RsiDivergenceNotification: React.FC<RsiDivergenceNotificationProps> = ({
  stocks,
  selectedStock,
  onSelectStock,
  onArmAlert,
  soundEnabled = true,
}) => {
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [simulatedResult, setSimulatedResult] = useState<Rsi52wExhaustionResult | null>(null);
  const [armedMap, setArmedMap] = useState<Record<string, boolean>>({});
  const [lastNotificationStatus, setLastNotificationStatus] = useState<string | null>(null);

  // Scan all stocks in universe for 52W High RSI Exhaustion
  const exhaustionScanList = useMemo(() => {
    return stocks.map((stock) => {
      const res = detect52WeekHighRsiExhaustion(stock);
      return {
        stock,
        result: res,
      };
    });
  }, [stocks]);

  // Candidates that actively meet 52W High Exhaustion criteria
  const activeExhaustionCandidates = useMemo(() => {
    return exhaustionScanList.filter((item) => item.result.hasExhaustion);
  }, [exhaustionScanList]);

  // Active target stock to display
  const currentTargetStock = selectedStock || (activeExhaustionCandidates.length > 0 ? activeExhaustionCandidates[0].stock : stocks[0]);
  
  // Active calculation result: either the live simulation or detected result
  const activeResult: Rsi52wExhaustionResult = useMemo(() => {
    if (simulatedResult && simulatedResult.ticker === currentTargetStock?.ticker) {
      return simulatedResult;
    }
    return detect52WeekHighRsiExhaustion(currentTargetStock);
  }, [currentTargetStock, simulatedResult]);

  const currencySymbol = getCurrencySymbol(currentTargetStock?.exchange);

  // Dispatches web notification and audio chime
  const handleTriggerNotification = (res: Rsi52wExhaustionResult) => {
    if (soundEnabled) {
      playAlertChime();
    }

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`🚨 52W High Exhaustion: ${res.ticker}`, {
        body: `${res.ticker} printed a 52W high (${currencySymbol}${res.currentPrice.toFixed(2)}) on a lower RSI high (${res.currentRsi} vs ${res.priorPeakRsi}). Minervini warning: tighten trailing stop & scale out.`,
        icon: '/favicon.ico',
      });
    }

    appendTrackerLog({
      ticker: res.ticker,
      exchange: res.exchange,
      previousPrice: res.priorPeakPrice,
      currentPrice: res.currentPrice,
      targetPrice: res.high52w,
      targetType: 'RSI_BEARISH_DIVERGENCE',
      event: 'STOP_LOSS_HIT',
      triggered: true,
    });

    const targetStock = stocks.find((s) => s.ticker === res.ticker) || currentTargetStock;
    const simDiv = simulateRsiDivergence(targetStock, 'BEARISH');
    dispatchRsiDivergenceNotification(targetStock, simDiv);

    setLastNotificationStatus(`Alert dispatched for ${res.ticker} @ ${new Date().toLocaleTimeString()}`);
    setTimeout(() => setLastNotificationStatus(null), 4000);
  };

  // Simulates 52W High Exhaustion on current stock
  const handleSimulateExhaustion = () => {
    const sim = simulate52wHighExhaustion(currentTargetStock);
    setSimulatedResult(sim);
    setIsDismissed(false);
    setIsExpanded(true);
    handleTriggerNotification(sim);
  };

  // Arms an alert in PriceAlertSystem
  const handleArmExhaustionAlert = () => {
    setArmedMap((prev) => ({ ...prev, [activeResult.ticker]: true }));
    if (onArmAlert) {
      onArmAlert(
        activeResult.ticker,
        'RSI_BEARISH_DIVERGENCE',
        activeResult.currentPrice,
        `🚨 52W High RSI Exhaustion: Price at 52W High (${currencySymbol}${activeResult.currentPrice}) with Lower RSI High (${activeResult.currentRsi} vs ${activeResult.priorPeakRsi})`
      );
    }
    setLastNotificationStatus(`Active 52W High RSI Exhaustion surveillance armed for ${activeResult.ticker}`);
    setTimeout(() => setLastNotificationStatus(null), 4000);
  };

  // Reset simulation back to real market scan
  const handleResetSimulation = () => {
    setSimulatedResult(null);
  };

  if (isDismissed) {
    return (
      <div className="bg-[#1f1610] border border-amber-800/80 px-4 py-2.5 flex items-center justify-between text-xs font-mono text-amber-200">
        <div className="flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span>
            RSI 52-Week High Exhaustion Sentinel is monitoring in background ({activeExhaustionCandidates.length} candidate{activeExhaustionCandidates.length === 1 ? '' : 's'} detected).
          </span>
        </div>
        <button
          onClick={() => setIsDismissed(false)}
          className="bg-amber-500 hover:bg-amber-400 text-black px-3 py-1 font-bold uppercase text-[10px] tracking-wider transition-colors cursor-pointer"
        >
          Restore Banner
        </button>
      </div>
    );
  }

  const isSevere = activeResult.severity === 'CRITICAL' || activeResult.severity === 'HIGH';

  return (
    <div
      id="rsi-52w-exhaustion-notification"
      className={`border transition-all font-mono text-xs shadow-md ${
        isSevere
          ? 'bg-[#18090f] border-rose-800/90 text-rose-100'
          : 'bg-[#12151f] border-cyan-800/80 text-cyan-100'
      }`}
    >
      {/* Top Banner Header Bar */}
      <div
        className={`px-4 py-3 flex flex-wrap items-center justify-between gap-3 border-b ${
          isSevere ? 'border-rose-900/80 bg-[#240c16]' : 'border-cyan-900/80 bg-[#161c2c]'
        }`}
      >
        <div className="flex items-center space-x-3">
          <div
            className={`w-8 h-8 flex items-center justify-center font-bold ${
              isSevere
                ? 'bg-rose-950 border border-rose-600 text-rose-300'
                : 'bg-cyan-950 border border-cyan-600 text-cyan-300'
            }`}
          >
            <ShieldAlert className={`w-4 h-4 ${isSevere ? 'text-rose-400 animate-pulse' : 'text-cyan-400'}`} />
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-amber-400">
                Minervini SEPA Sentinel
              </span>
              <span
                className={`text-[9px] font-black uppercase px-2 py-0.5 border ${
                  activeResult.hasExhaustion
                    ? 'bg-rose-950 border-rose-500 text-rose-200'
                    : 'bg-slate-900 border-slate-700 text-slate-300'
                }`}
              >
                {activeResult.hasExhaustion ? '⚠️ 52W High RSI Exhaustion Detected' : 'Monitoring Momentum'}
              </span>
              {simulatedResult && (
                <span className="bg-amber-950 border border-amber-600 text-amber-300 text-[9px] px-2 py-0.5 font-bold uppercase">
                  SIMULATION ACTIVE
                </span>
              )}
            </div>

            <h4 className="text-sm font-serif font-black text-white tracking-tight mt-0.5">
              RSI Divergence Notification: 52-Week High Trend Exhaustion
            </h4>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          {activeExhaustionCandidates.length > 0 && (
            <div className="flex items-center space-x-1 bg-black/40 border border-rose-900 px-2 py-1 text-[10px]">
              <span className="text-rose-400 font-bold">{activeExhaustionCandidates.length} Active in Universe:</span>
              <div className="flex items-center space-x-1">
                {activeExhaustionCandidates.map((c) => (
                  <button
                    key={c.stock.ticker}
                    onClick={() => {
                      if (onSelectStock) onSelectStock(c.stock);
                      setSimulatedResult(null);
                    }}
                    className={`px-1.5 py-0.5 text-[9px] font-bold border transition cursor-pointer ${
                      currentTargetStock.ticker === c.stock.ticker
                        ? 'bg-rose-600 text-white border-rose-400'
                        : 'bg-rose-950/60 text-rose-300 border-rose-800 hover:bg-rose-900'
                    }`}
                  >
                    {c.stock.ticker}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Collapse Alert Panel' : 'Expand Alert Panel'}
            className="p-1.5 bg-black/40 border border-gray-700 hover:border-gray-500 text-gray-300 transition-colors cursor-pointer"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setIsDismissed(true)}
            title="Dismiss Alert"
            className="p-1.5 bg-black/40 border border-gray-700 hover:border-gray-500 text-gray-300 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expanded Content Body */}
      {isExpanded && (
        <div className="p-4 sm:p-5 space-y-4">
          
          {/* Main Stock Diagnosis Card */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            
            {/* Left Column: Ticker & Metric Comparison (7 cols) */}
            <div className="lg:col-span-7 space-y-3 bg-black/30 border border-rose-900/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rose-900/40 pb-2.5">
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-400">Inspected Candidate</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-base font-black text-white">{activeResult.ticker}</span>
                    <span className="text-xs text-gray-400 font-sans truncate max-w-[200px]">{activeResult.stockName}</span>
                    <span className="text-[10px] text-gray-400 border border-gray-700 px-1.5 py-0.2">
                      {activeResult.exchange}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-gray-400">Current Price</span>
                  <div className="text-base font-black text-white">
                    {currencySymbol}{activeResult.currentPrice.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Side-by-Side Metric Contrast Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                
                {/* Metric 1: Price 52-Week High Action */}
                <div className="bg-rose-950/40 border border-rose-900/60 p-3 space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-rose-300 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 text-rose-400" />
                    Price Action (Higher High)
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-gray-400 text-[11px]">52-Wk High:</span>
                    <strong className="text-white font-mono">{currencySymbol}{activeResult.high52w.toFixed(2)}</strong>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-gray-400 text-[11px]">Current Peak:</span>
                    <strong className="text-amber-300 font-mono">
                      {currencySymbol}{activeResult.currentPrice.toFixed(2)} ({activeResult.distanceFrom52wHighPct >= 0 ? '+' : ''}{activeResult.distanceFrom52wHighPct}%)
                    </strong>
                  </div>
                  <div className="text-[10px] text-rose-300/80 pt-1 border-t border-rose-900/40">
                    {activeResult.isNew52wHigh ? '🔥 Making Brand New 52-Week High' : '📌 Coiling within 2% of 52-Week High'}
                  </div>
                </div>

                {/* Metric 2: 14-Period RSI Lower High (Divergence) */}
                <div className="bg-rose-950/40 border border-rose-900/60 p-3 space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-amber-300 flex items-center gap-1">
                    <TrendingDown className="w-3.5 h-3.5 text-amber-400" />
                    RSI Momentum (Lower High)
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-gray-400 text-[11px]">Prior Peak RSI:</span>
                    <strong className="text-cyan-400 font-mono">{activeResult.priorPeakRsi.toFixed(1)}</strong>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-gray-400 text-[11px]">Current Peak RSI:</span>
                    <strong className="text-rose-400 font-mono">{activeResult.currentRsi.toFixed(1)}</strong>
                  </div>
                  <div className="text-[10px] text-amber-300 font-bold pt-1 border-t border-rose-900/40 flex justify-between">
                    <span>Momentum Drop:</span>
                    <span>{activeResult.rsiDelta} pts over {activeResult.lookbackBars} bars</span>
                  </div>
                </div>
              </div>

              {/* Diagnostic Description */}
              <div className="text-[11px] leading-relaxed text-gray-300 bg-black/40 p-2.5 border-l-2 border-rose-500 font-sans">
                <strong>Technical Analysis:</strong> {activeResult.diagnostic}
              </div>
            </div>

            {/* Right Column: Minervini Playbook & Severity Score (5 cols) */}
            <div className="lg:col-span-5 space-y-3 bg-black/30 border border-rose-900/60 p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-rose-900/40 pb-2">
                  <span className="text-[10px] uppercase font-bold text-gray-400">Exhaustion Risk Score</span>
                  <span className={`px-2 py-0.5 text-[10px] font-black uppercase border ${
                    activeResult.severity === 'CRITICAL'
                      ? 'bg-rose-900 text-rose-100 border-rose-500'
                      : activeResult.severity === 'HIGH'
                      ? 'bg-amber-900 text-amber-100 border-amber-500'
                      : 'bg-slate-800 text-slate-200 border-slate-600'
                  }`}>
                    {activeResult.severity} RISK
                  </span>
                </div>

                {/* Score Bar Meter */}
                <div className="mt-2.5 space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-gray-400">Institutional Distribution Risk:</span>
                    <strong className="text-rose-400">{activeResult.exhaustionScore}/100</strong>
                  </div>
                  <div className="w-full bg-black/60 h-2 border border-gray-800 overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        activeResult.exhaustionScore >= 80
                          ? 'bg-rose-600'
                          : activeResult.exhaustionScore >= 60
                          ? 'bg-amber-500'
                          : 'bg-cyan-500'
                      }`}
                      style={{ width: `${Math.max(5, activeResult.exhaustionScore)}%` }}
                    />
                  </div>
                </div>

                {/* Minervini SEPA Rules Checklist */}
                <div className="mt-3.5 space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-amber-400 block">
                    Minervini Exhaustion Checklist:
                  </span>
                  {activeResult.rules.map((ruleItem, idx) => (
                    <div key={idx} className="flex items-start space-x-2 text-[10px]">
                      <span className={`mt-0.5 ${ruleItem.status === 'ALERT' ? 'text-rose-400 font-bold' : 'text-gray-500'}`}>
                        {ruleItem.status === 'ALERT' ? '⚠️' : '✓'}
                      </span>
                      <span className="text-gray-300 leading-tight">
                        <strong className="text-white">{ruleItem.rule}:</strong> {ruleItem.detail}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Minervini Action Recommendation */}
              <div className="bg-[#240c16] border border-rose-700/80 p-2.5 mt-2">
                <span className="text-[10px] font-bold text-amber-300 block uppercase">
                  Minervini Trading Action:
                </span>
                <p className="text-[11px] text-rose-200 mt-0.5 leading-snug font-sans">
                  {activeResult.minerviniAction}
                </p>
              </div>
            </div>
          </div>

          {/* Action Button Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-rose-900/40">
            <div className="flex flex-wrap items-center gap-2">
              {/* Arm Exhaustion Alert */}
              <button
                onClick={handleArmExhaustionAlert}
                className={`px-3.5 py-2 text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer ${
                  armedMap[activeResult.ticker]
                    ? 'bg-emerald-900 text-emerald-200 border border-emerald-600'
                    : 'bg-rose-800 hover:bg-rose-700 text-white border border-rose-600'
                }`}
              >
                <Target className="w-3.5 h-3.5" />
                <span>
                  {armedMap[activeResult.ticker]
                    ? '✓ Exhaustion Alert Armed'
                    : `Arm Exhaustion Alert (${activeResult.ticker})`}
                </span>
              </button>

              {/* Trigger Notification & Chime */}
              <button
                onClick={() => handleTriggerNotification(activeResult)}
                className="bg-amber-600 hover:bg-amber-500 text-black px-3.5 py-2 text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer border border-amber-400"
              >
                <BellRing className="w-3.5 h-3.5" />
                <span>Trigger Audio &amp; Push Alert</span>
              </button>

              {/* Simulate 52W High Exhaustion */}
              <button
                onClick={handleSimulateExhaustion}
                className="bg-[#121212] hover:bg-black text-rose-300 hover:text-white px-3.5 py-2 text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5 transition-all border border-rose-800 shadow-xs cursor-pointer"
                title="Simulate 52W High Exhaustion Divergence on current stock"
              >
                <Play className="w-3.5 h-3.5 text-amber-400" />
                <span>Simulate 52W High Exhaustion</span>
              </button>

              {/* Reset Simulation */}
              {simulatedResult && (
                <button
                  onClick={handleResetSimulation}
                  className="bg-gray-800 hover:bg-gray-700 text-gray-200 px-3 py-2 text-xs font-bold uppercase flex items-center space-x-1 transition cursor-pointer"
                  title="Reset simulation to live scan"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Scan</span>
                </button>
              )}
            </div>

            {/* Notification Feedback Status */}
            {lastNotificationStatus && (
              <div className="flex items-center space-x-1.5 text-emerald-400 text-[11px] font-bold animate-fadeIn">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{lastNotificationStatus}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
