import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MinerviniTradeSetup } from '../types';
import { formatCurrency, getCurrencySymbol } from '../utils/sepaCalculator';
import {
  Calculator,
  ShieldAlert,
  Target,
  ArrowUpRight,
  Copy,
  Check,
  Info,
  Layers,
  Sliders,
  Sparkles,
  BookMarked,
  ArrowRight,
  CheckCircle2,
  TrendingDown,
  Scale,
  Percent,
} from 'lucide-react';

interface SimplePositionSizingCalculatorProps {
  stock: MinerviniTradeSetup;
  accountCapital: number;
  onUpdateAccountCapital: (equity: number) => void;
  entryPrice: number;
  stopLossPrice: number;
  onUpdateEntryPrice?: (price: number) => void;
  onUpdateStopLossPrice?: (price: number) => void;
  riskPercent: number;
  onUpdateRiskPercent: (riskPct: number) => void;
  currencySymbol?: string;
  onSaveToJournal?: () => void;
}

export const SimplePositionSizingCalculator: React.FC<SimplePositionSizingCalculatorProps> = ({
  stock,
  accountCapital,
  onUpdateAccountCapital,
  entryPrice,
  stopLossPrice,
  onUpdateEntryPrice,
  onUpdateStopLossPrice,
  riskPercent,
  onUpdateRiskPercent,
  currencySymbol = '₹',
  onSaveToJournal,
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [enforceMinerviniCap, setEnforceMinerviniCap] = useState<boolean>(true);
  const [showFormulaExplanation, setShowFormulaExplanation] = useState<boolean>(true);
  const [showSensitivityTable, setShowSensitivityTable] = useState<boolean>(false);
  const [customRiskMode, setCustomRiskMode] = useState<'PERCENT' | 'FIXED_DOLLAR'>('PERCENT');
  const [fixedDollarRisk, setFixedDollarRisk] = useState<number>(500);

  // Safe numerical calculations
  const safeEquity = Math.max(0, accountCapital || 0);
  const safeEntry = Math.max(0.01, entryPrice || stock.pivotPrice || 1);
  const safeStop = Math.max(0.01, stopLossPrice || stock.stopLossPrice || safeEntry * 0.93);

  // Stop-Loss Distance Calculations
  const stopLossDistance = Math.max(0.01, safeEntry - safeStop);
  const stopLossDistancePercent = safeEntry > 0 ? (stopLossDistance / safeEntry) * 100 : 0;

  // Max Dollar Risk based on selected mode
  const dollarRiskAllowed = useMemo(() => {
    if (customRiskMode === 'FIXED_DOLLAR') {
      return Math.max(1, fixedDollarRisk);
    }
    return safeEquity * (riskPercent / 100);
  }, [customRiskMode, fixedDollarRisk, safeEquity, riskPercent]);

  // Number of Shares Calculation: Math.floor(Dollar Risk / Stop-Loss Distance)
  const rawShares = useMemo(() => {
    if (stopLossDistance <= 0) return 0;
    return Math.floor(dollarRiskAllowed / stopLossDistance);
  }, [dollarRiskAllowed, stopLossDistance]);

  // Max 25% portfolio allocation cap (Minervini rule)
  const maxPortfolioCapShares = useMemo(() => {
    if (safeEntry <= 0) return 0;
    return Math.floor((safeEquity * 0.25) / safeEntry);
  }, [safeEquity, safeEntry]);

  // Final Shares depending on whether 25% concentration cap is enforced
  const finalShares = useMemo(() => {
    if (enforceMinerviniCap && maxPortfolioCapShares > 0) {
      return Math.min(rawShares, maxPortfolioCapShares);
    }
    return rawShares;
  }, [enforceMinerviniCap, rawShares, maxPortfolioCapShares]);

  const isCapped = enforceMinerviniCap && rawShares > maxPortfolioCapShares && maxPortfolioCapShares > 0;

  // Total Position Cost and Allocation
  const totalPositionCost = finalShares * safeEntry;
  const portfolioAllocationPct = safeEquity > 0 ? (totalPositionCost / safeEquity) * 100 : 0;
  const actualDollarRisk = finalShares * stopLossDistance;
  const actualRiskPctOfEquity = safeEquity > 0 ? (actualDollarRisk / safeEquity) * 100 : 0;

  // Pyramiding Tranches (50% Pilot, 25% Add #1, 25% Add #2)
  const pilotShares = Math.floor(finalShares * 0.5);
  const add1Shares = Math.floor(finalShares * 0.25);
  const add2Shares = Math.max(0, finalShares - pilotShares - add1Shares);

  // Quick Account Equity Presets
  const equityPresets = [10000, 25000, 50000, 100000, 250000, 500000];

  // Quick Risk % Presets
  const riskPresets = [
    { label: '0.50%', value: 0.5, desc: 'Conservative' },
    { label: '1.00%', value: 1.0, desc: 'Minervini Standard' },
    { label: '1.50%', value: 1.5, desc: 'Aggressive' },
    { label: '2.00%', value: 2.0, desc: 'Max Limit' },
  ];

  // Quick Stop Distance Presets
  const stopPresets = [
    { label: '-4.0%', pct: 4.0 },
    { label: '-5.0%', pct: 5.0 },
    { label: '-6.5%', pct: 6.5 },
    { label: '-8.0%', pct: 8.0 },
  ];

  const handleCopyShares = () => {
    navigator.clipboard.writeText(finalShares.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleApplyStopPreset = (pct: number) => {
    const newStop = Number((safeEntry * (1 - pct / 100)).toFixed(2));
    if (onUpdateStopLossPrice) {
      onUpdateStopLossPrice(newStop);
    }
  };

  return (
    <div className="bg-white border border-[#e5e4e1] shadow-xs overflow-hidden">
      {/* Header Bar */}
      <div className="bg-[#1a1a1a] text-white px-5 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          <div className="bg-emerald-500/20 text-emerald-400 p-1.5 rounded-none border border-emerald-500/40">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white flex items-center space-x-2">
              <span>Position Sizing Calculator</span>
              <span className="bg-emerald-400 text-black text-[9px] px-2 py-0.5 font-mono font-bold tracking-normal uppercase">
                Stop-Loss Distance Model
              </span>
            </h3>
            <p className="text-[11px] text-gray-300 font-sans mt-0.5">
              Calculates exact share count for <strong className="text-amber-300 font-mono">{stock.ticker}</strong> based on your account equity and distance to stop-loss.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {onSaveToJournal && (
            <button
              onClick={onSaveToJournal}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] uppercase tracking-wider px-3 py-1 font-bold flex items-center space-x-1.5 transition-all shadow-2xs cursor-pointer"
              title="Save this calculated position plan directly to your Trade Journal"
            >
              <BookMarked className="w-3.5 h-3.5" />
              <span>Log to Journal</span>
            </button>
          )}
          <button
            onClick={() => setShowFormulaExplanation(!showFormulaExplanation)}
            className="text-gray-300 hover:text-white text-[10px] uppercase tracking-wider px-2.5 py-1 font-mono flex items-center space-x-1 border border-gray-700 hover:border-gray-500 transition-all cursor-pointer"
          >
            <Info className="w-3 h-3 text-cyan-400" />
            <span>{showFormulaExplanation ? 'Hide Formula' : 'Show Formula'}</span>
          </button>
        </div>
      </div>

      {/* Step-by-Step Mathematical Formula Explanation Banner */}
      <AnimatePresence>
        {showFormulaExplanation && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-[#f9f8f5] border-b border-[#e5e4e1] p-4 text-xs font-mono text-[#1a1a1a]"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#b5a68d] flex items-center space-x-1">
                <Scale className="w-3.5 h-3.5 text-[#1a1a1a]" />
                <span>Mark Minervini SEPA Mathematical Position Sizing Rule</span>
              </span>
              <span className="text-[10px] text-gray-500 font-sans italic">
                Never adjust risk by taking random share sizes. Size strictly to your stop-loss distance.
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 pt-1">
              <div className="bg-white border border-[#e5e4e1] p-2.5">
                <span className="text-[9px] uppercase font-bold text-gray-500 block">Step 1: Max Dollar Risk</span>
                <div className="text-xs font-bold text-red-600 mt-0.5">
                  Equity × Risk % = {formatCurrency(dollarRiskAllowed, currencySymbol)}
                </div>
                <span className="text-[10px] text-gray-500 font-sans block mt-0.5">
                  {formatCurrency(safeEquity, currencySymbol, 0)} × {riskPercent}%
                </span>
              </div>

              <div className="bg-white border border-[#e5e4e1] p-2.5">
                <span className="text-[9px] uppercase font-bold text-gray-500 block">Step 2: Stop Distance</span>
                <div className="text-xs font-bold text-slate-800 mt-0.5">
                  Entry − Stop = {formatCurrency(stopLossDistance, currencySymbol)}
                </div>
                <span className="text-[10px] text-gray-500 font-sans block mt-0.5">
                  -{stopLossDistancePercent.toFixed(2)}% per share
                </span>
              </div>

              <div className="bg-white border border-[#e5e4e1] p-2.5">
                <span className="text-[9px] uppercase font-bold text-gray-500 block">Step 3: Shares to Buy</span>
                <div className="text-xs font-bold text-emerald-700 mt-0.5">
                  Dollar Risk ÷ Stop Distance
                </div>
                <span className="text-[10px] text-gray-500 font-sans block mt-0.5">
                  {formatCurrency(dollarRiskAllowed, currencySymbol)} ÷ {formatCurrency(stopLossDistance, currencySymbol)} = <strong>{rawShares.toLocaleString()} sh</strong>
                </span>
              </div>

              <div className="bg-white border border-[#e5e4e1] p-2.5">
                <span className="text-[9px] uppercase font-bold text-gray-500 block">Step 4: Portfolio Allocation</span>
                <div className="text-xs font-bold text-slate-800 mt-0.5">
                  Cost ÷ Total Equity
                </div>
                <span className="text-[10px] text-gray-500 font-sans block mt-0.5">
                  {formatCurrency(totalPositionCost, currencySymbol)} ({portfolioAllocationPct.toFixed(1)}% of Equity)
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-5 space-y-6">
        {/* Main 2-Column Layout: Inputs on Left, Calculated Shares & Summary on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Interactive Inputs (Equity, Risk %, Stop-Loss Distance) */}
          <div className="lg:col-span-7 space-y-5">
            
            {/* 1. Total Account Equity Input with Quick Presets */}
            <div className="bg-[#f9f8f5] p-4 border border-[#e5e4e1] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#1a1a1a] flex items-center space-x-1.5">
                  <span className="bg-[#1a1a1a] text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-mono">1</span>
                  <span>Total Account Equity ({currencySymbol})</span>
                </label>
                <span className="text-[10px] text-gray-500 font-mono">
                  Active Capital: <strong className="text-[#1a1a1a]">{formatCurrency(safeEquity, currencySymbol, 0)}</strong>
                </span>
              </div>

              {/* Numerical Equity Input */}
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 font-mono text-sm font-bold">
                  {currencySymbol}
                </span>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={accountCapital}
                  onChange={(e) => onUpdateAccountCapital(Math.max(0, Number(e.target.value) || 0))}
                  placeholder="50000"
                  className="w-full bg-white border border-[#e5e4e1] pl-8 pr-4 py-2.5 text-[#1a1a1a] font-mono text-base font-bold focus:border-black focus:outline-none shadow-2xs"
                />
              </div>

              {/* Quick Equity Preset Pills */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
                <span className="text-[9px] uppercase tracking-wider font-bold text-gray-400 mr-1">Presets:</span>
                {equityPresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => onUpdateAccountCapital(preset)}
                    className={`px-2.5 py-1 text-[10px] font-bold border transition-all cursor-pointer ${
                      accountCapital === preset
                        ? 'bg-[#1a1a1a] text-white border-black shadow-2xs'
                        : 'bg-white text-gray-700 border-[#e5e4e1] hover:bg-gray-100'
                    }`}
                  >
                    {formatCurrency(preset, currencySymbol, 0)}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Risk Model (% of Account vs Fixed Dollar) */}
            <div className="bg-[#f9f8f5] p-4 border border-[#e5e4e1] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#1a1a1a] flex items-center space-x-1.5">
                  <span className="bg-[#1a1a1a] text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-mono">2</span>
                  <span>Risk Tolerance Per Trade</span>
                </label>
                
                {/* Mode Selector */}
                <div className="flex items-center space-x-1 bg-white p-0.5 border border-[#e5e4e1] text-[10px] font-mono font-bold">
                  <button
                    type="button"
                    onClick={() => setCustomRiskMode('PERCENT')}
                    className={`px-2 py-0.5 transition-all cursor-pointer ${
                      customRiskMode === 'PERCENT' ? 'bg-[#1a1a1a] text-white' : 'text-gray-600 hover:text-black'
                    }`}
                  >
                    % of Equity
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomRiskMode('FIXED_DOLLAR')}
                    className={`px-2 py-0.5 transition-all cursor-pointer ${
                      customRiskMode === 'FIXED_DOLLAR' ? 'bg-[#1a1a1a] text-white' : 'text-gray-600 hover:text-black'
                    }`}
                  >
                    Fixed {currencySymbol} Risk
                  </button>
                </div>
              </div>

              {customRiskMode === 'PERCENT' ? (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-gray-500 font-sans text-[11px]">Selected Account Risk:</span>
                    <span className="bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 font-bold">
                      {riskPercent.toFixed(2)}% ({formatCurrency(dollarRiskAllowed, currencySymbol)})
                    </span>
                  </div>

                  {/* Slider */}
                  <input
                    type="range"
                    min="0.25"
                    max="2.5"
                    step="0.05"
                    value={riskPercent}
                    onChange={(e) => onUpdateRiskPercent(Number(e.target.value))}
                    className="w-full accent-[#1a1a1a] cursor-pointer"
                  />

                  {/* Quick Risk Presets */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 font-mono text-[10px]">
                    {riskPresets.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => onUpdateRiskPercent(item.value)}
                        className={`p-1.5 border text-center font-bold transition-all cursor-pointer ${
                          Math.abs(riskPercent - item.value) < 0.01
                            ? 'bg-red-600 text-white border-red-700 shadow-2xs'
                            : 'bg-white text-gray-700 border-[#e5e4e1] hover:bg-gray-100'
                        }`}
                      >
                        <span className="block">{item.label}</span>
                        <span className={`text-[8px] font-sans block ${Math.abs(riskPercent - item.value) < 0.01 ? 'text-red-100' : 'text-gray-400'}`}>
                          {item.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 font-mono text-sm font-bold">
                      {currencySymbol}
                    </span>
                    <input
                      type="number"
                      min="1"
                      step="50"
                      value={fixedDollarRisk}
                      onChange={(e) => setFixedDollarRisk(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full bg-white border border-[#e5e4e1] pl-8 pr-4 py-2 text-red-600 font-mono text-sm font-bold focus:border-black focus:outline-none"
                    />
                  </div>
                  <span className="text-[10px] text-gray-500 font-mono block">
                    Equivalent to {safeEquity > 0 ? ((fixedDollarRisk / safeEquity) * 100).toFixed(2) : 0}% of total equity.
                  </span>
                </div>
              )}
            </div>

            {/* 3. Stop-Loss Distance & Price Inputs */}
            <div className="bg-[#f9f8f5] p-4 border border-[#e5e4e1] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#1a1a1a] flex items-center space-x-1.5">
                  <span className="bg-[#1a1a1a] text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-mono">3</span>
                  <span>Entry & Stop-Loss Distance</span>
                </label>
                <div className="text-[10px] font-mono text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 font-bold">
                  Stop Distance: <strong className="text-red-700 font-mono">{formatCurrency(stopLossDistance, currencySymbol)}</strong> (-{stopLossDistancePercent.toFixed(2)}%)
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                {/* Pivot Entry Input */}
                <div className="bg-white p-2.5 border border-[#e5e4e1] space-y-1">
                  <label className="text-[9px] uppercase font-bold text-gray-500 block">
                    Pivot Entry Price ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    value={entryPrice}
                    onChange={(e) => onUpdateEntryPrice && onUpdateEntryPrice(Math.max(0.01, Number(e.target.value) || 0.01))}
                    className="w-full bg-[#f9f8f5] border border-[#e5e4e1] p-1.5 font-bold text-[#1a1a1a] text-sm focus:outline-none focus:border-black"
                  />
                  <div className="text-[9px] text-gray-400 font-sans">
                    Default: {formatCurrency(stock.pivotPrice, currencySymbol)}
                  </div>
                </div>

                {/* Stop Loss Input */}
                <div className="bg-white p-2.5 border border-red-200 space-y-1">
                  <label className="text-[9px] uppercase font-bold text-red-700 block">
                    Stop Loss Price ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    value={stopLossPrice}
                    onChange={(e) => onUpdateStopLossPrice && onUpdateStopLossPrice(Math.max(0.01, Number(e.target.value) || 0.01))}
                    className="w-full bg-[#f9f8f5] border border-red-300 p-1.5 font-bold text-red-700 text-sm focus:outline-none focus:border-red-600"
                  />
                  <div className="text-[9px] text-red-600 font-mono font-bold">
                    Risk Per Share: {formatCurrency(stopLossDistance, currencySymbol)}
                  </div>
                </div>
              </div>

              {/* Quick Stop Distance Preset Chips */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono pt-1">
                <span className="text-[9px] uppercase tracking-wider font-bold text-gray-400 mr-1">Quick Stops:</span>
                {stopPresets.map((sp) => (
                  <button
                    key={sp.pct}
                    type="button"
                    onClick={() => handleApplyStopPreset(sp.pct)}
                    className="px-2 py-0.5 text-[10px] font-bold border border-red-200 bg-red-50/50 hover:bg-red-100 text-red-800 transition-all cursor-pointer"
                  >
                    {sp.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Minervini 25% Concentration Cap Toggle */}
            <div className="bg-white border border-[#e5e4e1] p-3 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center space-x-2">
                <ShieldAlert className={`w-4 h-4 ${enforceMinerviniCap ? 'text-emerald-700' : 'text-gray-400'}`} />
                <div>
                  <span className="font-bold text-[#1a1a1a] block text-xs">
                    Minervini 25% Portfolio Concentration Cap
                  </span>
                  <span className="text-[10px] text-gray-500 font-sans block">
                    Prevents allocating more than 25% of total capital into a single stock.
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEnforceMinerviniCap(!enforceMinerviniCap)}
                className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer font-mono border ${
                  enforceMinerviniCap
                    ? 'bg-emerald-800 text-white border-emerald-900 shadow-2xs'
                    : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'
                }`}
              >
                {enforceMinerviniCap ? 'Cap Active (25%)' : 'Uncapped'}
              </button>
            </div>

          </div>

          {/* Right Column: Hero Share Count Output & Execution Plan */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* Big Hero Result Card */}
            <div className="bg-[#1a1a1a] text-white p-5 border border-black shadow-sm space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-emerald-500 text-black text-[9px] uppercase tracking-[0.15em] px-2.5 py-0.5 font-bold">
                Calculated Size
              </div>

              <div>
                <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#b5a68d] block">
                  Shares to Buy (Position Size)
                </span>
                <div className="mt-2 flex items-baseline justify-between">
                  <div className="text-4xl font-black font-mono text-emerald-400 tracking-tight">
                    {finalShares.toLocaleString()}
                    <span className="text-sm font-normal text-gray-300 ml-1.5">shares</span>
                  </div>

                  {/* Copy Button */}
                  <button
                    onClick={handleCopyShares}
                    className="bg-white/10 hover:bg-white/20 text-white px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider flex items-center space-x-1 transition-all border border-white/20 cursor-pointer"
                    title="Copy share quantity to clipboard"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400 font-bold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 text-gray-300" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {isCapped && (
                <div className="bg-amber-950/80 border border-amber-500/60 p-2 text-[10px] font-sans text-amber-200 space-y-0.5">
                  <span className="font-bold flex items-center space-x-1 text-amber-300">
                    <Info className="w-3 h-3" />
                    <span>25% Portfolio Cap Applied</span>
                  </span>
                  <p>
                    Raw size by stop distance would be <strong>{rawShares.toLocaleString()} shares</strong>, but was capped to <strong>{maxPortfolioCapShares.toLocaleString()} shares</strong> to prevent single-stock overexposure.
                  </p>
                </div>
              )}

              {/* Key Execution Metrics Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono border-t border-gray-800 pt-3">
                <div className="bg-black/40 p-2.5 border border-white/10">
                  <span className="text-[9px] uppercase tracking-wider text-gray-400 block">Total Position Cost</span>
                  <span className="text-sm font-bold text-white block mt-0.5">
                    {formatCurrency(totalPositionCost, currencySymbol)}
                  </span>
                  <span className="text-[10px] text-gray-400 block">
                    {portfolioAllocationPct.toFixed(1)}% of Equity
                  </span>
                </div>

                <div className="bg-black/40 p-2.5 border border-white/10">
                  <span className="text-[9px] uppercase tracking-wider text-red-400 block">Max Dollar Loss</span>
                  <span className="text-sm font-bold text-red-400 block mt-0.5">
                    -{formatCurrency(actualDollarRisk, currencySymbol)}
                  </span>
                  <span className="text-[10px] text-gray-400 block">
                    -{actualRiskPctOfEquity.toFixed(2)}% of Equity
                  </span>
                </div>
              </div>

              {/* Pyramiding Tranche Breakdown */}
              <div className="bg-gray-900/90 p-3 border border-gray-800 space-y-2">
                <span className="text-[10px] uppercase tracking-wider font-bold text-[#b5a68d] block font-mono flex items-center justify-between">
                  <span>Pyramid Scale-In Schedule</span>
                  <span className="text-[9px] text-gray-400 font-sans">Minervini Staged Entry</span>
                </span>

                <div className="space-y-1.5 text-[11px] font-mono">
                  <div className="flex justify-between items-center text-gray-300 bg-black/30 px-2 py-1">
                    <span className="flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      <span>Pilot Buy (50%):</span>
                    </span>
                    <strong className="text-emerald-400">{pilotShares.toLocaleString()} shares ({formatCurrency(pilotShares * safeEntry, currencySymbol)})</strong>
                  </div>

                  <div className="flex justify-between items-center text-gray-300 bg-black/30 px-2 py-1">
                    <span className="flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                      <span>Add #1 at +2% (25%):</span>
                    </span>
                    <strong className="text-white">{add1Shares.toLocaleString()} shares ({formatCurrency(add1Shares * safeEntry, currencySymbol)})</strong>
                  </div>

                  <div className="flex justify-between items-center text-gray-300 bg-black/30 px-2 py-1">
                    <span className="flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                      <span>Add #2 at +4% (25%):</span>
                    </span>
                    <strong className="text-white">{add2Shares.toLocaleString()} shares ({formatCurrency(add2Shares * safeEntry, currencySymbol)})</strong>
                  </div>
                </div>
              </div>

            </div>

            {/* Stop-Loss Distance Sensitivity Drawer / Button */}
            <div className="bg-[#f9f8f5] border border-[#e5e4e1] p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider font-bold text-gray-700 font-mono flex items-center space-x-1">
                  <TrendingDown className="w-3.5 h-3.5 text-[#1a1a1a]" />
                  <span>Stop Distance Sensitivity Matrix</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowSensitivityTable(!showSensitivityTable)}
                  className="text-[10px] text-slate-800 hover:text-black font-bold font-mono underline cursor-pointer"
                >
                  {showSensitivityTable ? 'Hide Table' : 'Compare Stops'}
                </button>
              </div>

              {showSensitivityTable && (
                <div className="overflow-x-auto text-[11px] font-mono pt-1">
                  <table className="w-full border-collapse border border-[#e5e4e1] bg-white text-left">
                    <thead>
                      <tr className="bg-[#f9f8f5] text-[9px] uppercase tracking-wider text-gray-500 border-b border-[#e5e4e1]">
                        <th className="p-2 border-r border-[#e5e4e1]">Stop Loss %</th>
                        <th className="p-2 border-r border-[#e5e4e1]">Stop Price</th>
                        <th className="p-2 border-r border-[#e5e4e1]">Shares</th>
                        <th className="p-2">Position Capital</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[3.0, 5.0, 7.0, 8.0, 10.0].map((sPct) => {
                        const sPrice = safeEntry * (1 - sPct / 100);
                        const sDist = safeEntry - sPrice;
                        const sShares = Math.floor(dollarRiskAllowed / sDist);
                        const sCost = sShares * safeEntry;
                        const isCurrent = Math.abs(stopLossDistancePercent - sPct) < 0.5;

                        return (
                          <tr
                            key={sPct}
                            className={`border-b border-[#e5e4e1] transition-colors ${
                              isCurrent ? 'bg-emerald-50 font-bold' : 'hover:bg-gray-50'
                            }`}
                          >
                            <td className="p-2 border-r border-[#e5e4e1] text-red-700">
                              -{sPct.toFixed(1)}% {isCurrent && '✓ (Active)'}
                            </td>
                            <td className="p-2 border-r border-[#e5e4e1]">
                              {formatCurrency(sPrice, currencySymbol)}
                            </td>
                            <td className="p-2 border-r border-[#e5e4e1] text-emerald-800 font-bold">
                              {sShares.toLocaleString()} sh
                            </td>
                            <td className="p-2 text-gray-700">
                              {formatCurrency(sCost, currencySymbol)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <p className="text-[9px] text-gray-500 font-sans mt-1.5 italic">
                    💡 <em>Notice: A tighter stop (-3% vs -8%) allows 2.6x larger share size while maintaining the exact same dollar risk ({formatCurrency(dollarRiskAllowed, currencySymbol)}).</em>
                  </p>
                </div>
              )}
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};
