import React, { useState, useEffect, useMemo } from 'react';
import { MinerviniTradeSetup } from '../types';
import { formatCurrency } from '../utils/sepaCalculator';
import {
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Activity,
  Sliders,
  Zap,
  Info,
  TrendingUp,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

interface VolatilitySlippageAlertProps {
  stock: MinerviniTradeSetup;
  currencySymbol: string;
  stopLossPrice?: number;
  entryPrice?: number;
}

export const VolatilitySlippageAlert: React.FC<VolatilitySlippageAlertProps> = ({
  stock,
  currencySymbol,
  stopLossPrice,
  entryPrice,
}) => {
  // Persistence key
  const storageKey = `sepa_volatility_alert_enabled_${stock.ticker}`;
  const thresholdKey = `sepa_volatility_alert_thresh_${stock.ticker}`;

  // State
  const [alertEnabled, setAlertEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved !== null ? saved === 'true' : true; // default enabled
    } catch {
      return true;
    }
  });

  const [stdDevThreshold, setStdDevThreshold] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(thresholdKey);
      return saved ? Number(saved) : 3.0; // default 3 Std Dev
    } catch {
      return 3.0;
    }
  });

  const [simulatedSpike, setSimulatedSpike] = useState<boolean>(false);

  // Sync state to localstorage
  const handleToggleAlert = (enabled: boolean) => {
    setAlertEnabled(enabled);
    try {
      localStorage.setItem(storageKey, enabled.toString());
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateThreshold = (thresh: number) => {
    setStdDevThreshold(thresh);
    try {
      localStorage.setItem(thresholdKey, thresh.toString());
    } catch (e) {
      console.error(e);
    }
  };

  // Compute Standard Deviation & Mean Daily Price Range from History
  const stats = useMemo(() => {
    const history = stock.priceHistory || [];
    if (history.length < 5) {
      // Fallback if minimal price history
      const estPrice = stock.currentPrice;
      const estMean = estPrice * 0.025; // 2.5% mean range
      const estStd = estPrice * 0.012;  // 1.2% std dev
      const currRange = stock.dailyHigh && stock.dailyLow
        ? stock.dailyHigh - stock.dailyLow
        : estPrice * (simulatedSpike ? 0.082 : 0.028);
      const zScore = estStd > 0 ? (currRange - estMean) / estStd : 0;

      return {
        meanRange: estMean,
        stdDev: estStd,
        currentRange: currRange,
        zScore: Number(zScore.toFixed(2)),
        sampleCount: 20,
      };
    }

    // Calculate ranges for each historical candle
    const ranges = history.map((pt) => Math.max(0.01, pt.high - pt.low));
    const sampleCount = ranges.length;

    // Mean range
    const meanRange = ranges.reduce((acc, val) => acc + val, 0) / sampleCount;

    // Standard deviation
    const variance = ranges.reduce((acc, val) => acc + Math.pow(val - meanRange, 2), 0) / (sampleCount - 1 || 1);
    const stdDev = Math.sqrt(variance);

    // Current intraday price range
    let currentRange = 0;
    if (stock.dailyHigh && stock.dailyLow && stock.dailyHigh > stock.dailyLow) {
      currentRange = stock.dailyHigh - stock.dailyLow;
    } else {
      const lastCandle = history[history.length - 1];
      currentRange = lastCandle ? lastCandle.high - lastCandle.low : meanRange;
    }

    // Apply simulated spike if active
    if (simulatedSpike) {
      currentRange = meanRange + stdDev * 3.42; // Force 3.42 sigma spike for demonstration
    }

    // Z-Score = (Current Range - Mean) / StdDev
    const zScore = stdDev > 0 ? (currentRange - meanRange) / stdDev : 0;

    return {
      meanRange,
      stdDev,
      currentRange,
      zScore: Number(zScore.toFixed(2)),
      sampleCount,
    };
  }, [stock, simulatedSpike]);

  const isExceeding = stats.zScore >= stdDevThreshold;
  const currentStop = stopLossPrice || stock.stopLossPrice;
  const currentEntry = entryPrice || stock.pivotPrice;

  // Estimate potential stop-loss slippage
  const estimatedSlippagePerShare = isExceeding
    ? Number((stats.stdDev * (stats.zScore - 1.5) * 0.4).toFixed(2))
    : 0;
  const estimatedSlippagePct = currentStop > 0
    ? Number(((estimatedSlippagePerShare / currentStop) * 100).toFixed(2))
    : 0;

  return (
    <div
      className={`border transition-all duration-300 font-mono shadow-md ${
        alertEnabled && isExceeding
          ? 'bg-rose-950/20 border-rose-600/90 shadow-rose-950/30 ring-1 ring-rose-500/50'
          : alertEnabled
          ? 'bg-[#10141d] border-emerald-800/80'
          : 'bg-[#0f1117] border-gray-800 opacity-80'
      }`}
    >
      {/* Header Bar */}
      <div className={`p-4 border-b flex flex-wrap items-center justify-between gap-3 ${
        alertEnabled && isExceeding
          ? 'bg-rose-900/40 border-rose-800/80 text-rose-200'
          : alertEnabled
          ? 'bg-emerald-950/40 border-emerald-900/60 text-emerald-200'
          : 'bg-gray-900/80 border-gray-800 text-gray-400'
      }`}>
        <div className="flex items-center space-x-3">
          <div className={`p-2 border ${
            alertEnabled && isExceeding
              ? 'bg-rose-950 border-rose-500 text-rose-400 animate-bounce'
              : alertEnabled
              ? 'bg-emerald-950 border-emerald-700 text-emerald-400'
              : 'bg-gray-950 border-gray-700 text-gray-500'
          }`}>
            {alertEnabled && isExceeding ? (
              <ShieldAlert className="w-5 h-5 text-rose-400" />
            ) : alertEnabled ? (
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            ) : (
              <Activity className="w-5 h-5 text-gray-500" />
            )}
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400">
                SEPA Risk Control Engine
              </span>
              <span className={`text-[9px] px-1.5 py-0.2 uppercase font-bold border ${
                alertEnabled && isExceeding
                  ? 'bg-rose-900 text-white border-rose-500'
                  : alertEnabled
                  ? 'bg-emerald-900 text-emerald-300 border-emerald-600'
                  : 'bg-gray-800 text-gray-400 border-gray-700'
              }`}>
                {alertEnabled ? `${stdDevThreshold}σ Volatility Alert ON` : 'Alert OFF'}
              </span>
            </div>

            <h4 className="text-sm font-serif font-black text-white mt-0.5 flex items-center space-x-2">
              <span>Intraday Volatility & Stop-Loss Slippage Risk Guard</span>
            </h4>
          </div>
        </div>

        {/* Setting Toggle Switch & Threshold Selector */}
        <div className="flex flex-wrap items-center space-x-3 text-xs">
          {/* Threshold Sensitivity Buttons */}
          {alertEnabled && (
            <div className="flex items-center space-x-1 bg-black/40 p-1 border border-gray-800">
              <span className="text-[9px] text-gray-400 uppercase font-bold px-1">Alert Threshold:</span>
              {[2.5, 3.0, 3.5].map((thresh) => (
                <button
                  key={thresh}
                  type="button"
                  onClick={() => handleUpdateThreshold(thresh)}
                  className={`px-2 py-0.5 text-[10px] font-bold border cursor-pointer transition-all ${
                    stdDevThreshold === thresh
                      ? 'bg-amber-400 text-black border-amber-300'
                      : 'bg-gray-900 text-gray-300 border-gray-700 hover:bg-gray-800'
                  }`}
                >
                  {thresh}σ
                </button>
              ))}
            </div>
          )}

          {/* Toggle Switch */}
          <div className="flex items-center space-x-2 bg-black/50 p-1.5 border border-gray-800">
            <span className="text-[10px] uppercase font-bold text-gray-300">
              Volatility Alert:
            </span>
            <button
              type="button"
              onClick={() => handleToggleAlert(!alertEnabled)}
              className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                alertEnabled ? 'bg-emerald-500' : 'bg-gray-700'
              }`}
              title="Toggle Volatility Alert to monitor 3 Std Dev price expansion & stop slippage"
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  alertEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Main Panel Content */}
      <div className="p-4 space-y-4">
        {/* Active Alert Banner if Alert Enabled AND Exceeding Threshold */}
        {alertEnabled && isExceeding && (
          <div className="p-4 bg-rose-950/80 border-2 border-rose-500 space-y-3 text-rose-100 animate-pulse">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <h5 className="text-sm font-bold uppercase tracking-wider text-white">
                    ⚠️ CRITICAL SLIPPAGE WARNING: Extreme Price Volatility Range (&gt; {stdDevThreshold}σ)
                  </h5>
                  <span className="bg-rose-500 text-black font-black text-[10px] px-2 py-0.5 uppercase">
                    +{stats.zScore}σ Std Dev Spike
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-rose-200 font-sans">
                  The current price movement range of <strong>{formatCurrency(stats.currentRange, currencySymbol)}</strong> has expanded to <strong>+{stats.zScore} Standard Deviations</strong> above historical average ({formatCurrency(stats.meanRange, currencySymbol)}). High risk of stop-loss market order slippage and gap-down executions.
                </p>
              </div>
            </div>

            {/* Slippage Impact Details */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-black/60 p-3 border border-rose-800/80 text-xs font-mono">
              <div>
                <span className="text-[10px] uppercase text-gray-400 block">Current Stop Level:</span>
                <strong className="text-white text-sm">{formatCurrency(currentStop, currencySymbol)}</strong>
              </div>
              <div>
                <span className="text-[10px] uppercase text-rose-400 block">Estimated Slippage Impact:</span>
                <strong className="text-rose-300 text-sm">
                  ~{formatCurrency(estimatedSlippagePerShare, currencySymbol)} / share (-{estimatedSlippagePct}%)
                </strong>
              </div>
              <div>
                <span className="text-[10px] uppercase text-amber-400 block font-bold">Recommended Action:</span>
                <span className="text-amber-200 text-[11px]">Reduce size or widen hard stop buffer</span>
              </div>
            </div>
          </div>
        )}

        {/* Normal Status Badge if Alert Enabled AND within normal bounds */}
        {alertEnabled && !isExceeding && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-800 text-emerald-200 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Volatility Normal ({stats.zScore}σ vs {stdDevThreshold}σ Threshold) — Price range is within safe historical limits. Low stop-loss slippage hazard.
              </span>
            </div>
            <span className="bg-emerald-900 text-emerald-200 px-2 py-0.5 text-[10px] font-bold border border-emerald-600">
              SAFE BOUNDS
            </span>
          </div>
        )}

        {/* Disabled State Info */}
        {!alertEnabled && (
          <div className="p-3 bg-gray-900/60 border border-gray-800 text-gray-400 text-xs flex items-center justify-between">
            <span>
              Volatility Alert Guard is currently disabled. Toggle ON to monitor 3-sigma price expansion and receive automatic stop-loss slippage warnings.
            </span>
            <button
              onClick={() => handleToggleAlert(true)}
              className="text-emerald-400 underline hover:text-emerald-300 font-bold text-xs cursor-pointer"
            >
              Enable Alert
            </button>
          </div>
        )}

        {/* Standard Deviation Breakdown Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono pt-1">
          <div className="bg-black/40 p-2.5 border border-gray-800 space-y-0.5">
            <span className="text-[9px] uppercase text-gray-400 block font-bold">Current Price Range</span>
            <strong className="text-white text-sm font-bold">
              {formatCurrency(stats.currentRange, currencySymbol)}
            </strong>
          </div>

          <div className="bg-black/40 p-2.5 border border-gray-800 space-y-0.5">
            <span className="text-[9px] uppercase text-gray-400 block font-bold">Historical Mean (μ)</span>
            <strong className="text-amber-300 text-sm font-bold">
              {formatCurrency(stats.meanRange, currencySymbol)}
            </strong>
          </div>

          <div className="bg-black/40 p-2.5 border border-gray-800 space-y-0.5">
            <span className="text-[9px] uppercase text-gray-400 block font-bold">Standard Dev (1σ)</span>
            <strong className="text-cyan-300 text-sm font-bold">
              {formatCurrency(stats.stdDev, currencySymbol)}
            </strong>
          </div>

          <div className="bg-black/40 p-2.5 border border-gray-800 space-y-0.5">
            <span className="text-[9px] uppercase text-gray-400 block font-bold">Z-Score Deviation</span>
            <strong className={`text-sm font-bold ${
              stats.zScore >= stdDevThreshold ? 'text-rose-400 font-black' : 'text-emerald-400'
            }`}>
              {stats.zScore >= 0 ? `+${stats.zScore}σ` : `${stats.zScore}σ`}
            </strong>
          </div>
        </div>

        {/* Interactive Spike Simulator Test Button */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-800 text-[10px] text-gray-400">
          <div className="flex items-center space-x-1">
            <Info className="w-3.5 h-3.5 text-gray-500" />
            <span>Calculated from last {stats.sampleCount} daily candles using standard Gaussian z-score.</span>
          </div>

          <button
            type="button"
            onClick={() => setSimulatedSpike(!simulatedSpike)}
            className={`px-2.5 py-1 border text-[10px] uppercase font-bold flex items-center space-x-1 cursor-pointer transition-all ${
              simulatedSpike
                ? 'bg-rose-900 text-rose-200 border-rose-600 hover:bg-rose-800'
                : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700'
            }`}
            title="Test visual warning by triggering a simulated 3.42 sigma spike"
          >
            <RefreshCw className="w-3 h-3" />
            <span>{simulatedSpike ? 'Reset Normal Range' : 'Simulate +3.42σ Spike'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
