import React, { useState, useEffect } from 'react';
import { MinerviniTradeSetup } from '../types';
import { formatCurrency, calculateDailyVolatilityMetrics } from '../utils/sepaCalculator';
import {
  TrendingDown,
  ShieldCheck,
  Percent,
  Sliders,
  DollarSign,
  AlertCircle,
  ArrowDownRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Target,
  Zap,
  RotateCcw,
  Bell,
  Lock
} from 'lucide-react';

interface TrailingStopCalculatorPanelProps {
  stock: MinerviniTradeSetup;
  currencySymbol?: string;
  entryPrice?: number;
  initialStopLoss?: number;
  activeShares?: number;
  onApplyStopLoss?: (newStopPrice: number) => void;
}

export const TrailingStopCalculatorPanel: React.FC<TrailingStopCalculatorPanelProps> = ({
  stock,
  currencySymbol = '₹',
  entryPrice,
  initialStopLoss,
  activeShares = 100,
  onApplyStopLoss,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  // Defaults
  const validEntry = entryPrice && entryPrice > 0 ? entryPrice : stock.pivotPrice;
  const validStop = initialStopLoss && initialStopLoss > 0 ? initialStopLoss : stock.stopLossPrice;
  const initialRiskPerShare = Math.max(0.01, validEntry - validStop);

  // Volatility metrics
  const volMetrics = calculateDailyVolatilityMetrics(stock);
  const currentAtr14 = volMetrics.atr14 || (validEntry * 0.03);

  // Reference base for trailing stop calculation
  const [refMode, setRefMode] = useState<'CURRENT' | 'HIGH52' | 'ENTRY' | 'CUSTOM'>('CURRENT');
  const [customRefPrice, setCustomRefPrice] = useState<number>(stock.currentPrice);

  // Calculation mode: Percentage vs ATR vs Moving Average
  const [trailType, setTrailType] = useState<'PERCENT' | 'ATR' | 'SMA50'>('PERCENT');

  // Percentage & ATR parameters
  const [customPercent, setCustomPercent] = useState<number>(8.0); // Default 8.0% Minervini standard
  const [atrMult, setAtrMult] = useState<number>(2.0); // Default 2.0x ATR

  // Sync customRefPrice when ticker changes or currentPrice updates
  useEffect(() => {
    if (refMode === 'CURRENT') {
      setCustomRefPrice(stock.currentPrice);
    } else if (refMode === 'HIGH52') {
      setCustomRefPrice(stock.high52w);
    } else if (refMode === 'ENTRY') {
      setCustomRefPrice(validEntry);
    }
  }, [refMode, stock.currentPrice, stock.high52w, validEntry]);

  // Load user saved settings from localStorage if available
  useEffect(() => {
    try {
      const savedPct = localStorage.getItem(`sepa_trail_calc_pct_${stock.ticker}`);
      if (savedPct) setCustomPercent(Number(savedPct) || 8.0);
      const savedRef = localStorage.getItem(`sepa_trail_calc_ref_${stock.ticker}`);
      if (savedRef && ['CURRENT', 'HIGH52', 'ENTRY', 'CUSTOM'].includes(savedRef)) {
        setRefMode(savedRef as any);
      }
    } catch (e) {
      console.error('Failed to read trailing stop calculator local storage:', e);
    }
  }, [stock.ticker]);

  // Handle custom percent updates
  const handlePercentChange = (val: number) => {
    const clamped = Math.max(0.5, Math.min(30, val));
    setCustomPercent(clamped);
    try {
      localStorage.setItem(`sepa_trail_calc_pct_${stock.ticker}`, clamped.toString());
    } catch (e) {}
  };

  const handleRefModeChange = (mode: 'CURRENT' | 'HIGH52' | 'ENTRY' | 'CUSTOM') => {
    setRefMode(mode);
    try {
      localStorage.setItem(`sepa_trail_calc_ref_${stock.ticker}`, mode);
    } catch (e) {}
  };

  // Determine active reference price
  const activeRefPrice = refMode === 'CUSTOM' ? Math.max(0.01, customRefPrice) : (
    refMode === 'HIGH52' ? stock.high52w :
    refMode === 'ENTRY' ? validEntry : stock.currentPrice
  );

  // Calculate trailing stop price based on trailType
  let trailingOffsetDollar = 0;
  if (trailType === 'PERCENT') {
    trailingOffsetDollar = (activeRefPrice * customPercent) / 100;
  } else if (trailType === 'ATR') {
    trailingOffsetDollar = currentAtr14 * atrMult;
  } else {
    // SMA50 mode: stop is at 50-day SMA or offset from it
    trailingOffsetDollar = Math.max(0, activeRefPrice - stock.sma50);
  }

  const trailingStopPrice = Math.max(0.01, activeRefPrice - trailingOffsetDollar);
  const trailingDistancePct = activeRefPrice > 0 ? (trailingOffsetDollar / activeRefPrice) * 100 : customPercent;

  // Outcome metrics relative to initial entry price
  const gainOrLossPerShare = trailingStopPrice - validEntry;
  const isProfitLocked = gainOrLossPerShare > 0;
  const totalLockedDollarAmount = gainOrLossPerShare * activeShares;
  const lockedRMultiple = initialRiskPerShare > 0 ? gainOrLossPerShare / initialRiskPerShare : 0;

  // Comparison benchmark percentage tiers (3%, 5%, 8%, 10%, 12%, 15%)
  const benchmarkTiers = [
    { pct: 3.0, label: '3% Scalp Tight', note: 'Quick profit lock for aggressive momentum trades' },
    { pct: 5.0, label: '5% SEPA Tight', note: 'Minervini tight trailing stop for fast leaders' },
    { pct: 8.0, label: '8% Minervini Standard', note: 'Standard SEPA maximum structural pullback threshold' },
    { pct: 10.0, label: '10% Swing Base', note: 'Allows normal Stage 2 consolidation volatility' },
    { pct: 12.0, label: '12% Trend Rider', note: 'Rides major trend; suitable for market leaders' },
    { pct: 15.0, label: '15% Deep Structural', note: 'Deep stop level for position trading champions' },
  ];

  return (
    <div className="bg-white border border-[#e5e4e1] overflow-hidden font-mono text-xs">
      {/* Header Bar */}
      <div className="bg-slate-900 text-white p-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-amber-400/20 text-amber-300 border border-amber-400/30 rounded shrink-0">
            <TrendingDown className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] uppercase font-bold tracking-widest text-amber-300">
                Minervini SEPA Exit Management
              </span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[9px] font-black uppercase">
                Interactive Trailing Calculator
              </span>
            </div>
            <h3 className="text-base font-extrabold text-white tracking-wide">
              Trailing Stop Exit Level Engine ({stock.ticker})
            </h3>
            <p className="text-[11px] text-gray-400 font-sans">
              Visualize trailing stop levels below market price, 52W high, or custom peak to protect profits and enforce risk rules.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="bg-slate-800 text-amber-300 border border-slate-700 px-3 py-1 font-mono text-xs font-black">
            TRAIL: -{trailingDistancePct.toFixed(1)}% ({formatCurrency(trailingStopPrice, currencySymbol)})
          </span>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded cursor-pointer transition-colors"
            title={isExpanded ? 'Collapse Trailing Stop Calculator' : 'Expand Trailing Stop Calculator'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 space-y-4 bg-[#f9f8f5]">
          {/* Controls Grid: Reference Base & Calculation Method */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Control Box 1: Reference Base Price Selection */}
            <div className="bg-white border border-[#e5e4e1] p-3.5 space-y-2.5">
              <div className="flex justify-between items-center text-[10px]">
                <label className="uppercase font-bold text-slate-900 flex items-center space-x-1">
                  <Target className="w-3.5 h-3.5 text-amber-600" />
                  <span>1. Trailing Reference Base Price:</span>
                </label>
                <span className="text-gray-500 font-sans">Active: {formatCurrency(activeRefPrice, currencySymbol)}</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px]">
                {[
                  { id: 'CURRENT', label: 'Current Price', val: stock.currentPrice },
                  { id: 'HIGH52', label: '52W High', val: stock.high52w },
                  { id: 'ENTRY', label: 'Pivot Entry', val: validEntry },
                  { id: 'CUSTOM', label: 'Custom Peak', val: customRefPrice },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleRefModeChange(item.id as any)}
                    className={`p-2 text-left border cursor-pointer font-mono font-bold transition-all ${
                      refMode === item.id
                        ? 'bg-slate-900 text-white border-black shadow-xs'
                        : 'bg-[#f9f8f5] text-slate-700 border-[#e5e4e1] hover:bg-gray-100'
                    }`}
                  >
                    <div className="text-[9px] uppercase font-sans text-gray-400">{item.label}</div>
                    <div className="text-xs">{formatCurrency(item.val, currencySymbol)}</div>
                  </button>
                ))}
              </div>

              {refMode === 'CUSTOM' && (
                <div className="pt-2 border-t border-gray-100 flex items-center space-x-2">
                  <span className="text-[10px] font-bold text-gray-600 uppercase">Set Custom Peak Price:</span>
                  <div className="relative flex-1">
                    <span className="absolute inset-y-0 left-0 pl-2 flex items-center text-gray-400 text-xs">
                      {currencySymbol}
                    </span>
                    <input
                      type="number"
                      step="0.05"
                      value={customRefPrice}
                      onChange={(e) => setCustomRefPrice(Math.max(0.01, Number(e.target.value) || 0))}
                      className="w-full bg-[#f9f8f5] border border-[#e5e4e1] pl-6 pr-2 py-1 text-slate-900 font-mono font-bold focus:border-black focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Control Box 2: Custom Percentage / Mode Adjustment */}
            <div className="bg-white border border-[#e5e4e1] p-3.5 space-y-2.5">
              <div className="flex justify-between items-center text-[10px]">
                <label className="uppercase font-bold text-slate-900 flex items-center space-x-1">
                  <Sliders className="w-3.5 h-3.5 text-blue-600" />
                  <span>2. Custom Trailing Distance (% or ATR):</span>
                </label>
                <div className="flex items-center space-x-1 bg-gray-100 p-0.5 border border-gray-200">
                  <button
                    type="button"
                    onClick={() => setTrailType('PERCENT')}
                    className={`px-1.5 py-0.5 text-[9px] font-extrabold uppercase cursor-pointer ${
                      trailType === 'PERCENT' ? 'bg-slate-900 text-white' : 'text-gray-600'
                    }`}
                  >
                    % Trail
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrailType('ATR')}
                    className={`px-1.5 py-0.5 text-[9px] font-extrabold uppercase cursor-pointer ${
                      trailType === 'ATR' ? 'bg-slate-900 text-white' : 'text-gray-600'
                    }`}
                  >
                    ATR Trail
                  </button>
                </div>
              </div>

              {trailType === 'PERCENT' ? (
                <div className="space-y-2">
                  <div className="flex items-center space-x-3">
                    <input
                      type="range"
                      min="1.0"
                      max="20.0"
                      step="0.5"
                      value={customPercent}
                      onChange={(e) => handlePercentChange(Number(e.target.value))}
                      className="w-full accent-slate-900 cursor-pointer"
                    />
                    <div className="flex items-center space-x-1 shrink-0">
                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        max="30"
                        value={customPercent}
                        onChange={(e) => handlePercentChange(Number(e.target.value))}
                        className="w-16 bg-[#f9f8f5] border border-[#e5e4e1] px-1.5 py-1 text-right font-mono font-bold text-slate-900 focus:border-black focus:outline-none"
                      />
                      <span className="font-bold text-slate-900">%</span>
                    </div>
                  </div>

                  {/* Preset Quick Percentage Buttons */}
                  <div className="flex flex-wrap gap-1 text-[9px]">
                    <span className="text-gray-400 font-bold uppercase self-center mr-1">Presets:</span>
                    {[3.0, 5.0, 8.0, 10.0, 12.0, 15.0].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => handlePercentChange(pct)}
                        className={`px-2 py-0.5 border font-mono font-bold cursor-pointer transition-colors ${
                          customPercent === pct
                            ? 'bg-slate-900 text-white border-black'
                            : 'bg-[#f9f8f5] text-slate-800 border-[#e5e4e1] hover:bg-gray-200'
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center space-x-3">
                    <span className="text-[10px] font-bold text-gray-600">ATR(14) Multiplier:</span>
                    <input
                      type="range"
                      min="1.0"
                      max="5.0"
                      step="0.25"
                      value={atrMult}
                      onChange={(e) => setAtrMult(Number(e.target.value))}
                      className="w-full accent-slate-900 cursor-pointer"
                    />
                    <span className="font-extrabold text-slate-900 shrink-0">{atrMult}x ATR</span>
                  </div>
                  <div className="text-[10px] font-sans text-gray-500">
                    ATR(14) = {formatCurrency(currentAtr14, currencySymbol)} | Trailing Distance = {formatCurrency(currentAtr14 * atrMult, currencySymbol)} (-{((currentAtr14 * atrMult / activeRefPrice) * 100).toFixed(1)}%)
                  </div>
                </div>
              )}

            </div>

          </div>

          {/* Primary Calculated Trailing Exit Card */}
          <div className="bg-slate-900 text-white border border-slate-800 p-4 space-y-3 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 bg-amber-400 text-slate-950 font-black uppercase text-[10px]">
                  CALCULATED TRAILING EXIT LEVEL
                </span>
                <span className="text-gray-400 text-[10px] font-sans">
                  Based on -{trailingDistancePct.toFixed(1)}% trail from {formatCurrency(activeRefPrice, currencySymbol)}
                </span>
              </div>

              {onApplyStopLoss && (
                <button
                  type="button"
                  onClick={() => onApplyStopLoss(trailingStopPrice)}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase px-3 py-1.5 border border-emerald-400 cursor-pointer transition-all flex items-center space-x-1.5"
                  title="Apply calculated trailing stop as active stop loss in Trade Plan"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Apply {formatCurrency(trailingStopPrice, currencySymbol)} as Active Stop Loss</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              
              {/* Box 1: Trailing Stop Target Price */}
              <div className="bg-slate-950 p-3 border border-slate-800 space-y-1">
                <span className="text-[9px] uppercase font-bold text-gray-400 block">
                  Trailing Exit Price
                </span>
                <div className="text-2xl font-black text-amber-300">
                  {formatCurrency(trailingStopPrice, currencySymbol)}
                </div>
                <div className="text-[10px] text-gray-400 border-t border-slate-800 pt-1">
                  Offset: -{formatCurrency(trailingOffsetDollar, currencySymbol)} (-{trailingDistancePct.toFixed(1)}%)
                </div>
              </div>

              {/* Box 2: Per Share Gain/Loss */}
              <div className="bg-slate-950 p-3 border border-slate-800 space-y-1">
                <span className="text-[9px] uppercase font-bold text-gray-400 block">
                  Outcome vs Entry ({formatCurrency(validEntry, currencySymbol)})
                </span>
                <div className={`text-2xl font-black ${isProfitLocked ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isProfitLocked ? '+' : ''}{formatCurrency(gainOrLossPerShare, currencySymbol)} <span className="text-xs font-normal">/share</span>
                </div>
                <div className="text-[10px] text-gray-400 border-t border-slate-800 pt-1">
                  {isProfitLocked ? '🟢 Profit Locked' : '🔴 Capital Loss at Stop'}
                </div>
              </div>

              {/* Box 3: Total Position P&L at Trailing Stop Trigger */}
              <div className="bg-slate-950 p-3 border border-slate-800 space-y-1">
                <span className="text-[9px] uppercase font-bold text-gray-400 block">
                  Total Position P&L ({activeShares.toLocaleString()} shares)
                </span>
                <div className={`text-2xl font-black ${isProfitLocked ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isProfitLocked ? '+' : ''}{formatCurrency(totalLockedDollarAmount, currencySymbol)}
                </div>
                <div className="text-[10px] text-gray-400 border-t border-slate-800 pt-1">
                  Position Cost: {formatCurrency(activeShares * validEntry, currencySymbol)}
                </div>
              </div>

              {/* Box 4: Locked R-Multiple */}
              <div className="bg-slate-950 p-3 border border-slate-800 space-y-1">
                <span className="text-[9px] uppercase font-bold text-gray-400 block">
                  Locked R-Multiple
                </span>
                <div className={`text-2xl font-black ${lockedRMultiple >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {lockedRMultiple >= 0 ? '+' : ''}{lockedRMultiple.toFixed(2)} R
                </div>
                <div className="text-[10px] text-gray-400 border-t border-slate-800 pt-1">
                  Initial 1R Risk: {formatCurrency(initialRiskPerShare, currencySymbol)}/share
                </div>
              </div>

            </div>

            {/* Visual Level Ladder Bar */}
            <div className="bg-slate-950 p-3 border border-slate-800 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                Visual Price Level Hierarchy:
              </span>

              <div className="relative pt-1 pb-1">
                <div className="flex items-center justify-between text-[10px] font-mono font-bold mb-1">
                  <span className="text-amber-300">Base Peak: {formatCurrency(activeRefPrice, currencySymbol)}</span>
                  <span className="text-amber-400 underline font-black">
                    Trailing Stop: {formatCurrency(trailingStopPrice, currencySymbol)} (-{trailingDistancePct.toFixed(1)}%)
                  </span>
                  <span className="text-gray-300">Entry: {formatCurrency(validEntry, currencySymbol)}</span>
                  <span className="text-red-400">Initial Stop: {formatCurrency(validStop, currencySymbol)}</span>
                </div>

                <div className="h-3 w-full bg-slate-900 border border-slate-800 rounded-none flex overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full transition-all"
                    style={{
                      width: `${Math.max(5, Math.min(100, ((trailingStopPrice - validStop) / Math.max(0.01, activeRefPrice - validStop)) * 100))}%`
                    }}
                    title="Protected Gain Buffer"
                  />
                  <div
                    className="bg-amber-400/80 h-full transition-all flex-1"
                    title="Trailing Distance Range"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* Benchmark Multi-Percentage Exit Levels Matrix */}
          <div className="bg-white border border-[#e5e4e1] p-3.5 space-y-2.5">
            <div className="flex justify-between items-center border-b border-gray-100 pb-2">
              <div className="flex items-center space-x-2">
                <Percent className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-900">
                  Percentage Trail Exit Level Comparison Matrix ({stock.ticker})
                </span>
              </div>
              <span className="text-[9px] font-sans text-gray-500">
                Calculated from base price: <strong className="font-mono text-slate-900">{formatCurrency(activeRefPrice, currencySymbol)}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {benchmarkTiers.map((tier) => {
                const tierOffset = (activeRefPrice * tier.pct) / 100;
                const tierStopPrice = Math.max(0.01, activeRefPrice - tierOffset);
                const tierPerSharePnL = tierStopPrice - validEntry;
                const isTierProfit = tierPerSharePnL > 0;
                const tierTotalPnL = tierPerSharePnL * activeShares;
                const tierRMult = initialRiskPerShare > 0 ? tierPerSharePnL / initialRiskPerShare : 0;
                const isSelected = Math.abs(customPercent - tier.pct) < 0.1 && trailType === 'PERCENT';

                return (
                  <div
                    key={tier.pct}
                    onClick={() => {
                      setTrailType('PERCENT');
                      handlePercentChange(tier.pct);
                    }}
                    className={`p-3 border transition-all cursor-pointer space-y-1.5 ${
                      isSelected
                        ? 'bg-slate-900 text-white border-black shadow-xs ring-1 ring-black'
                        : 'bg-[#f9f8f5] text-slate-800 border-[#e5e4e1] hover:border-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`px-1.5 py-0.5 text-[9px] font-black uppercase ${
                        isSelected ? 'bg-amber-400 text-slate-950' : 'bg-gray-200 text-slate-900'
                      }`}>
                        {tier.label}
                      </span>
                      <span className={`text-[10px] font-mono font-black ${
                        isSelected ? 'text-amber-300' : 'text-slate-900'
                      }`}>
                        {formatCurrency(tierStopPrice, currencySymbol)}
                      </span>
                    </div>

                    <div className="text-[10px] font-sans text-gray-400 line-clamp-1">
                      {tier.note}
                    </div>

                    <div className={`pt-1 border-t text-[10px] font-mono flex items-center justify-between font-bold ${
                      isSelected ? 'border-slate-800' : 'border-gray-200'
                    }`}>
                      <span className="text-gray-400">Offset: -{formatCurrency(tierOffset, currencySymbol)} (-{tier.pct}%)</span>
                      <span className={isTierProfit ? (isSelected ? 'text-emerald-300' : 'text-emerald-700') : (isSelected ? 'text-red-300' : 'text-red-700')}>
                        {isTierProfit ? '+' : ''}{formatCurrency(tierTotalPnL, currencySymbol)} ({tierRMult >= 0 ? '+' : ''}{tierRMult.toFixed(1)}R)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}
    </div>
  );
};
