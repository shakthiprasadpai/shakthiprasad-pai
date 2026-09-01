import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MinerviniTradeSetup } from '../types';
import { formatCurrency, getCurrencySymbol } from '../utils/sepaCalculator';
import { exportDetailedTradeParametersToCsv } from '../utils/csvExport';
import {
  Calculator,
  ShieldCheck,
  Target,
  ArrowUpRight,
  TrendingDown,
  Copy,
  Check,
  Info,
  Sliders,
  DollarSign,
  Layers,
  Sparkles,
  Percent,
  Download,
  Activity,
  Award,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  ChevronRight,
  BookOpen,
  PieChart
} from 'lucide-react';

interface PositionRiskCalculatorProps {
  stock: MinerviniTradeSetup;
  allStocks?: MinerviniTradeSetup[];
  onSelectStock?: (stock: MinerviniTradeSetup) => void;
  onViewChart?: (stock: MinerviniTradeSetup) => void;
  onNavigateToJournal?: () => void;
}

export const PositionRiskCalculator: React.FC<PositionRiskCalculatorProps> = ({
  stock,
  allStocks = [],
  onSelectStock,
  onViewChart,
  onNavigateToJournal,
}) => {
  // Account & Risk Parameters State
  const [accountCapital, setAccountCapital] = useState<number>(100000);
  const [riskPercent, setRiskPercent] = useState<number>(1.0); // 1% risk per trade default
  const [entryPrice, setEntryPrice] = useState<number>(stock.pivotPrice || stock.currentPrice);
  const [stopLossPrice, setStopLossPrice] = useState<number>(stock.stopLossPrice || (stock.pivotPrice * 0.94));
  const [target1Price, setTarget1Price] = useState<number>(stock.target1Price || (stock.pivotPrice * 1.20));
  const [target2Price, setTarget2Price] = useState<number>(stock.target2Price || (stock.pivotPrice * 1.35));
  
  // Advanced Controls
  const [enforceMaxAllocationCap, setEnforceMaxAllocationCap] = useState<boolean>(true); // 25% max position size
  const [maxAllocationPercent, setMaxAllocationPercent] = useState<number>(25);
  const [customRiskMode, setCustomRiskMode] = useState<'PERCENT' | 'FIXED_DOLLAR'>('PERCENT');
  const [fixedDollarRisk, setFixedDollarRisk] = useState<number>(1000);
  const [copiedPlan, setCopiedPlan] = useState<boolean>(false);
  const [copiedTicker, setCopiedTicker] = useState<boolean>(false);
  const [pyramidPlan, setPyramidPlan] = useState<'STANDARD_50_30_20' | 'SINGLE_BULLET' | 'HALF_HALF'>('STANDARD_50_30_20');
  const [winRateInput, setWinRateInput] = useState<number>(50); // 50% win rate for expectancy simulation
  const [showPyramidingDetails, setShowPyramidingDetails] = useState<boolean>(true);
  const [showExpectancyModel, setShowExpectancyModel] = useState<boolean>(true);

  // Sync state when stock prop changes
  React.useEffect(() => {
    setEntryPrice(stock.pivotPrice || stock.currentPrice);
    setStopLossPrice(stock.stopLossPrice || (stock.pivotPrice ? stock.pivotPrice * 0.94 : stock.currentPrice * 0.94));
    setTarget1Price(stock.target1Price || (stock.pivotPrice ? stock.pivotPrice * 1.20 : stock.currentPrice * 1.20));
    setTarget2Price(stock.target2Price || (stock.pivotPrice ? stock.pivotPrice * 1.35 : stock.currentPrice * 1.35));
  }, [stock.ticker, stock.pivotPrice, stock.stopLossPrice, stock.target1Price, stock.target2Price, stock.currentPrice]);

  const currency = getCurrencySymbol(stock.exchange);

  // Core Math Calculations
  const safeCapital = Math.max(0, accountCapital || 0);
  const safeEntry = Math.max(0.01, entryPrice || 1);
  const safeStop = Math.max(0.01, stopLossPrice || (safeEntry * 0.94));
  const safeTarget1 = Math.max(safeEntry, target1Price || (safeEntry * 1.20));
  const safeTarget2 = Math.max(safeTarget1, target2Price || (safeEntry * 1.35));

  // Risk per share and risk %
  const riskPerShare = Math.max(0.001, safeEntry - safeStop);
  const riskPercentFromEntry = (riskPerShare / safeEntry) * 100;
  
  // Total dollar risk allowed
  const maxDollarRiskAllowed = useMemo(() => {
    if (customRiskMode === 'FIXED_DOLLAR') {
      return Math.max(1, fixedDollarRisk);
    }
    return (safeCapital * riskPercent) / 100;
  }, [customRiskMode, fixedDollarRisk, safeCapital, riskPercent]);

  // Uncapped shares based strictly on Dollar Risk / Risk per share
  const rawShares = Math.floor(maxDollarRiskAllowed / riskPerShare);

  // Max shares capped by Portfolio Allocation Rule (e.g. 25% max concentration)
  const maxPortfolioAllocationDollars = (safeCapital * maxAllocationPercent) / 100;
  const maxCapShares = Math.floor(maxPortfolioAllocationDollars / safeEntry);

  // Final executed shares
  const finalShares = enforceMaxAllocationCap && maxCapShares > 0
    ? Math.min(rawShares, maxCapShares)
    : rawShares;

  const isPositionCapped = enforceMaxAllocationCap && rawShares > maxCapShares && maxCapShares > 0;

  // Total Position Size & Allocation
  const totalPositionCost = finalShares * safeEntry;
  const actualPortfolioAllocationPercent = safeCapital > 0 ? (totalPositionCost / safeCapital) * 100 : 0;
  const actualTotalDollarRisk = finalShares * riskPerShare;
  const actualRiskOfPortfolioPercent = safeCapital > 0 ? (actualTotalDollarRisk / safeCapital) * 100 : 0;

  // Reward Math
  const rewardPerShareT1 = Math.max(0, safeTarget1 - safeEntry);
  const rewardPercentT1 = (rewardPerShareT1 / safeEntry) * 100;
  const totalDollarRewardT1 = finalShares * rewardPerShareT1;
  const rrRatioT1 = riskPerShare > 0 ? rewardPerShareT1 / riskPerShare : 0;

  const rewardPerShareT2 = Math.max(0, safeTarget2 - safeEntry);
  const rewardPercentT2 = (rewardPerShareT2 / safeEntry) * 100;
  const totalDollarRewardT2 = finalShares * rewardPerShareT2;
  const rrRatioT2 = riskPerShare > 0 ? rewardPerShareT2 / riskPerShare : 0;

  // R-Multiple Milestones
  const rMultiples = useMemo(() => {
    return [
      { label: '1R Breakeven / Min Risk', r: 1, price: safeEntry + riskPerShare, gainPct: riskPercentFromEntry, profitDollar: actualTotalDollarRisk },
      { label: '2R Minervini Standard Target', r: 2, price: safeEntry + (riskPerShare * 2), gainPct: riskPercentFromEntry * 2, profitDollar: actualTotalDollarRisk * 2 },
      { label: '3R Asymmetric Champion Target', r: 3, price: safeEntry + (riskPerShare * 3), gainPct: riskPercentFromEntry * 3, profitDollar: actualTotalDollarRisk * 3 },
      { label: '5R Outlier Superperformance', r: 5, price: safeEntry + (riskPerShare * 5), gainPct: riskPercentFromEntry * 5, profitDollar: actualTotalDollarRisk * 5 },
    ];
  }, [safeEntry, riskPerShare, riskPercentFromEntry, actualTotalDollarRisk]);

  // Pyramiding Staged Entry Plan
  const pyramidStages = useMemo(() => {
    if (pyramidPlan === 'SINGLE_BULLET') {
      return [
        { stage: 'Initial Entry (100%)', pct: 100, shares: finalShares, price: safeEntry, cost: finalShares * safeEntry, stopPrice: safeStop, note: 'Full position opened on pivot breakout' }
      ];
    }
    if (pyramidPlan === 'HALF_HALF') {
      const halfShares = Math.floor(finalShares * 0.5);
      const remainingShares = finalShares - halfShares;
      const addPrice = safeEntry * 1.025; // +2.5% follow-through
      return [
        { stage: '1st Tranche (50% Pilot)', pct: 50, shares: halfShares, price: safeEntry, cost: halfShares * safeEntry, stopPrice: safeStop, note: 'Pilot position on pivot breakout' },
        { stage: '2nd Tranche (50% Add)', pct: 50, shares: remainingShares, price: addPrice, cost: remainingShares * addPrice, stopPrice: safeEntry, note: 'Add on confirmed strength (+2.5%), stop raised to initial entry' }
      ];
    }
    // STANDARD_50_30_20
    const tranche1 = Math.floor(finalShares * 0.50);
    const tranche2 = Math.floor(finalShares * 0.30);
    const tranche3 = finalShares - tranche1 - tranche2;
    const addPrice1 = safeEntry * 1.025; // +2.5%
    const addPrice2 = safeEntry * 1.050; // +5.0%

    return [
      { stage: 'Tranche 1: Pilot Buy (50%)', pct: 50, shares: tranche1, price: safeEntry, cost: tranche1 * safeEntry, stopPrice: safeStop, note: 'Execute exactly at pivot price' },
      { stage: 'Tranche 2: Add on Strength (30%)', pct: 30, shares: tranche2, price: addPrice1, cost: tranche2 * addPrice1, stopPrice: safeEntry, note: 'Add at +2.5% gain, raise stop to breakeven' },
      { stage: 'Tranche 3: Power Add (20%)', pct: 20, shares: tranche3, price: addPrice2, cost: tranche3 * addPrice2, stopPrice: addPrice1 * 0.98, note: 'Add at +5.0% gain, lock in profit with trailing stop' }
    ];
  }, [pyramidPlan, finalShares, safeEntry, safeStop]);

  // Asymmetric Expectancy Calculation: Expectancy = (WinRate% * AvgGain) - (LossRate% * AvgLoss)
  const expectancyResult = useMemo(() => {
    const wr = winRateInput / 100;
    const lr = 1 - wr;
    const avgGain = rewardPercentT1;
    const avgLoss = riskPercentFromEntry;
    const netExpectancyPct = (wr * avgGain) - (lr * avgLoss);
    const gainToLossRatio = avgLoss > 0 ? avgGain / avgLoss : 0;
    const profitFactor = (lr * avgLoss) > 0 ? (wr * avgGain) / (lr * avgLoss) : 99;

    return {
      netExpectancyPct,
      gainToLossRatio,
      profitFactor,
      isPositiveEdge: netExpectancyPct > 0,
      expectedDollarPerTrade: (safeCapital * actualRiskOfPortfolioPercent / 100) * (gainToLossRatio * wr - lr)
    };
  }, [winRateInput, rewardPercentT1, riskPercentFromEntry, safeCapital, actualRiskOfPortfolioPercent]);

  // Copy trade plan text to clipboard
  const handleCopyPlan = () => {
    const text = `
🎯 MINERVINI SEPA POSITION RISK PLAN: ${stock.ticker} (${stock.name})
--------------------------------------------------
• Exchange: ${stock.exchange} | Sector: ${stock.sector}
• Account Capital: ${formatCurrency(safeCapital, currency)}
• Planned Risk Per Trade: ${riskPercent}% (${formatCurrency(actualTotalDollarRisk, currency)})
• Execution Entry Price: ${formatCurrency(safeEntry, currency)}
• Hard Stop Loss: ${formatCurrency(safeStop, currency)} (-${riskPercentFromEntry.toFixed(2)}%)
• Target 1 (+20%): ${formatCurrency(safeTarget1, currency)} (+${rewardPercentT1.toFixed(1)}% | ${rrRatioT1.toFixed(2)}:1 R/R)
• Target 2 (+35%): ${formatCurrency(safeTarget2, currency)} (+${rewardPercentT2.toFixed(1)}% | ${rrRatioT2.toFixed(2)}:1 R/R)
• Position Sizing: ${finalShares.toLocaleString()} Shares (${formatCurrency(totalPositionCost, currency)} | ${actualPortfolioAllocationPercent.toFixed(1)}% Portfolio)
• 3:1 R-Multiple Target: ${formatCurrency(safeEntry + (riskPerShare * 3), currency)}
--------------------------------------------------
Generated via Growth Stock Alpha SEPA Engine
    `.trim();

    navigator.clipboard.writeText(text);
    setCopiedPlan(true);
    setTimeout(() => setCopiedPlan(false), 2500);
  };

  const handleCopyTicker = () => {
    navigator.clipboard.writeText(stock.ticker);
    setCopiedTicker(true);
    setTimeout(() => setCopiedTicker(false), 2000);
  };

  const handleExportCsv = () => {
    exportDetailedTradeParametersToCsv({
      stock,
      entryPrice: safeEntry,
      stopLossPrice: safeStop,
      targetPrice: safeTarget1,
      shares: finalShares,
      totalPositionCost,
      riskPerShare,
      totalDollarRisk: actualTotalDollarRisk,
      rMultiple: rrRatioT1,
      target3RPrice: safeEntry + (riskPerShare * 3),
      potentialTotalGain3R: actualTotalDollarRisk * 3,
      notes: `SEPA Position Risk Calculation for ${stock.ticker}. Risk: ${riskPercent}%, Allocation: ${actualPortfolioAllocationPercent.toFixed(1)}%`
    });
  };

  return (
    <div className="bg-white border border-[#e5e4e1] shadow-sm space-y-6">
      {/* Header Banner */}
      <div className="bg-[#10141d] text-white p-5 border-b border-gray-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-sm">
            <Calculator className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] uppercase tracking-[0.25em] font-mono font-bold text-amber-400">
                Mark Minervini Risk Management Model
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-mono px-2 py-0.5 font-bold uppercase">
                Asymmetric Risk-to-Reward
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-black text-white flex items-center space-x-2 mt-0.5">
              <span>Position Sizing & Trade Risk Calculator</span>
            </h2>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <button
            onClick={handleCopyPlan}
            className="px-3.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-amber-300 border border-gray-700 hover:border-amber-500/60 font-bold uppercase tracking-wider flex items-center space-x-1.5 transition-all cursor-pointer shadow-xs"
          >
            {copiedPlan ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-amber-400" />}
            <span>{copiedPlan ? 'Plan Copied!' : 'Copy Trade Plan'}</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold uppercase tracking-wider flex items-center space-x-1.5 transition-all cursor-pointer shadow-xs"
            title="Export full risk calculation and trade parameters to CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          {onViewChart && (
            <button
              onClick={() => onViewChart(stock)}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold uppercase tracking-wider flex items-center space-x-1.5 transition-all cursor-pointer shadow-xs"
            >
              <span>View Chart</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Stock Selection Bar & Quick Ticker Copy */}
      <div className="px-6 pt-2">
        <div className="bg-[#f9f8f5] border border-[#e5e4e1] p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1.5 bg-white border border-[#e5e4e1] px-3 py-1.5">
              <span className="font-mono font-black text-lg text-[#1a1a1a]">{stock.ticker}</span>
              <button
                onClick={handleCopyTicker}
                className="p-1 hover:bg-gray-100 text-gray-500 hover:text-black transition-colors rounded cursor-pointer"
                title={`Copy ticker symbol "${stock.ticker}"`}
              >
                {copiedTicker ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <span className="text-[10px] bg-[#1a1a1a] text-white px-1.5 py-0.5 font-mono font-bold uppercase">
                {stock.exchange}
              </span>
            </div>
            <div>
              <div className="text-sm font-bold text-[#1a1a1a]">{stock.name}</div>
              <div className="text-xs text-gray-500 font-sans">
                {stock.sector} • {stock.industry} | Current: <strong className="text-[#1a1a1a] font-mono">{formatCurrency(stock.currentPrice, currency)}</strong>
              </div>
            </div>
          </div>

          {/* Quick Stock Selector Dropdown */}
          {allStocks.length > 0 && onSelectStock && (
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono text-gray-500 uppercase font-bold">Select Setup:</span>
              <select
                value={stock.ticker}
                onChange={(e) => {
                  const found = allStocks.find(s => s.ticker === e.target.value);
                  if (found) onSelectStock(found);
                }}
                className="bg-white border border-[#e5e4e1] text-xs font-mono px-3 py-1.5 font-bold text-[#1a1a1a] focus:outline-none focus:border-black cursor-pointer"
              >
                {allStocks.map((s) => (
                  <option key={s.ticker} value={s.ticker}>
                    {s.ticker} - {s.name} ({formatCurrency(s.currentPrice, getCurrencySymbol(s.exchange))})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Main Grid: Inputs (Left) vs Output Metrics & Cards (Right) */}
      <div className="px-6 pb-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Interactive Parameter Inputs */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-[#f9f8f5] border border-[#e5e4e1] p-5 space-y-4">
            <h3 className="text-xs font-mono font-black uppercase tracking-wider text-gray-700 flex items-center space-x-1.5 border-b border-[#e5e4e1] pb-2">
              <Sliders className="w-3.5 h-3.5 text-amber-600" />
              <span>1. Account Capital & Risk Budget</span>
            </h3>

            {/* Total Account Capital */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center justify-between">
                <span>Account Capital ({currency})</span>
                <span className="text-[10px] text-gray-500 font-mono">Portfolio Equity</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold text-gray-400">{currency}</span>
                <input
                  type="number"
                  value={accountCapital}
                  onChange={(e) => setAccountCapital(Number(e.target.value) || 0)}
                  min={1000}
                  step={5000}
                  className="w-full pl-8 pr-3 py-2 bg-white border border-[#e5e4e1] font-mono text-sm font-bold text-[#1a1a1a] focus:outline-none focus:border-black"
                />
              </div>
              <div className="flex gap-1.5 mt-1.5">
                {[25000, 50000, 100000, 250000, 500000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setAccountCapital(amt)}
                    className="px-2 py-0.5 text-[10px] font-mono bg-white border border-[#e5e4e1] hover:border-gray-400 text-gray-700 transition-all cursor-pointer"
                  >
                    {amt >= 100000 ? `${amt / 100000}L` : `${amt / 1000}k`}
                  </button>
                ))}
              </div>
            </div>

            {/* Risk Mode Switcher (Percentage vs Dollar) */}
            <div className="space-y-2 pt-2 border-t border-[#e5e4e1]">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-700">Risk Mode</label>
                <div className="inline-flex border border-[#e5e4e1] bg-white p-0.5 text-[10px] font-mono font-bold">
                  <button
                    type="button"
                    onClick={() => setCustomRiskMode('PERCENT')}
                    className={`px-2 py-0.5 ${customRiskMode === 'PERCENT' ? 'bg-[#1a1a1a] text-white' : 'text-gray-600 hover:text-black'}`}
                  >
                    % Portfolio Risk
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomRiskMode('FIXED_DOLLAR')}
                    className={`px-2 py-0.5 ${customRiskMode === 'FIXED_DOLLAR' ? 'bg-[#1a1a1a] text-white' : 'text-gray-600 hover:text-black'}`}
                  >
                    Fixed {currency} Risk
                  </button>
                </div>
              </div>

              {customRiskMode === 'PERCENT' ? (
                <div>
                  <div className="flex justify-between items-center text-xs font-mono mb-1">
                    <span className="text-gray-600 font-bold">Risk Per Trade:</span>
                    <span className="text-amber-700 font-black text-sm">{riskPercent}%</span>
                  </div>
                  <input
                    type="range"
                    min={0.25}
                    max={3.0}
                    step={0.25}
                    value={riskPercent}
                    onChange={(e) => setRiskPercent(Number(e.target.value))}
                    className="w-full accent-amber-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-gray-500 font-mono mt-1">
                    <span>Conservative (0.5%)</span>
                    <span>Standard (1.0%)</span>
                    <span>Aggressive (2.0%+)</span>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Fixed Dollar Risk Allowed ({currency})
                  </label>
                  <input
                    type="number"
                    value={fixedDollarRisk}
                    onChange={(e) => setFixedDollarRisk(Number(e.target.value) || 0)}
                    min={100}
                    step={250}
                    className="w-full px-3 py-2 bg-white border border-[#e5e4e1] font-mono text-sm font-bold text-[#1a1a1a] focus:outline-none focus:border-black"
                  />
                </div>
              )}
            </div>

            {/* Minervini 25% Concentration Cap */}
            <div className="pt-2 border-t border-[#e5e4e1] space-y-2">
              <label className="inline-flex items-center space-x-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={enforceMaxAllocationCap}
                  onChange={(e) => setEnforceMaxAllocationCap(e.target.checked)}
                  className="accent-black w-3.5 h-3.5"
                />
                <span className="text-xs font-bold text-gray-800">
                  Enforce Max Position Concentration Cap ({maxAllocationPercent}%)
                </span>
              </label>
              <p className="text-[10px] text-gray-500 font-sans leading-relaxed">
                Minervini Rule: Never allocate more than 20-25% of total portfolio equity into a single position to prevent catastrophic portfolio drawdowns.
              </p>
            </div>
          </div>

          {/* Execution Entry, Stop Loss & Targets Input Form */}
          <div className="bg-[#f9f8f5] border border-[#e5e4e1] p-5 space-y-4">
            <h3 className="text-xs font-mono font-black uppercase tracking-wider text-gray-700 flex items-center space-x-1.5 border-b border-[#e5e4e1] pb-2">
              <Target className="w-3.5 h-3.5 text-emerald-600" />
              <span>2. Execution Levels & Exit Strategy</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Entry Price */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                  Pivot Entry Price ({currency})
                </label>
                <input
                  type="number"
                  value={entryPrice}
                  onChange={(e) => setEntryPrice(Number(e.target.value) || 0)}
                  step={0.5}
                  className="w-full px-3 py-1.5 bg-white border border-[#e5e4e1] font-mono text-xs font-bold text-[#1a1a1a] focus:outline-none focus:border-black"
                />
              </div>

              {/* Stop Loss Price */}
              <div>
                <label className="block text-[11px] font-bold text-red-600 mb-1">
                  Hard Stop Loss ({currency})
                </label>
                <input
                  type="number"
                  value={stopLossPrice}
                  onChange={(e) => setStopLossPrice(Number(e.target.value) || 0)}
                  step={0.5}
                  className="w-full px-3 py-1.5 bg-white border border-red-300 font-mono text-xs font-bold text-red-700 focus:outline-none focus:border-red-600"
                />
              </div>

              {/* Target 1 */}
              <div>
                <label className="block text-[11px] font-bold text-emerald-700 mb-1">
                  Profit Target 1 (+20%)
                </label>
                <input
                  type="number"
                  value={target1Price}
                  onChange={(e) => setTarget1Price(Number(e.target.value) || 0)}
                  step={0.5}
                  className="w-full px-3 py-1.5 bg-white border border-emerald-300 font-mono text-xs font-bold text-emerald-800 focus:outline-none focus:border-emerald-600"
                />
              </div>

              {/* Target 2 */}
              <div>
                <label className="block text-[11px] font-bold text-purple-700 mb-1">
                  Profit Target 2 (+35%)
                </label>
                <input
                  type="number"
                  value={target2Price}
                  onChange={(e) => setTarget2Price(Number(e.target.value) || 0)}
                  step={0.5}
                  className="w-full px-3 py-1.5 bg-white border border-purple-300 font-mono text-xs font-bold text-purple-800 focus:outline-none focus:border-purple-600"
                />
              </div>
            </div>

            {/* Quick Stop Loss Presets */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] text-gray-500 font-mono uppercase font-bold">Stop Presets:</span>
              {[
                { label: '-4% Tight', pct: 0.04 },
                { label: '-6% Standard', pct: 0.06 },
                { label: '-8% Max Stop', pct: 0.08 }
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setStopLossPrice(Number((safeEntry * (1 - preset.pct)).toFixed(2)))}
                  className="px-2 py-0.5 text-[10px] font-mono bg-white border border-red-200 text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Calculated Outputs, Sizing Cards & R-Multiple Roadmap */}
        <div className="lg:col-span-7 space-y-5">
          
          {/* Key Output Metrics Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Position Size (Shares) */}
            <div className="bg-[#10141d] text-white p-4 border border-black shadow-xs">
              <div className="text-[10px] font-mono uppercase text-amber-400 font-bold tracking-wider">
                Position Size
              </div>
              <div className="font-mono text-2xl font-black text-white mt-1">
                {finalShares.toLocaleString()}
              </div>
              <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                Shares to Buy
              </div>
            </div>

            {/* Total Cost ($) */}
            <div className="bg-[#f9f8f5] p-4 border border-[#e5e4e1] shadow-xs">
              <div className="text-[10px] font-mono uppercase text-gray-500 font-bold tracking-wider">
                Capital Required
              </div>
              <div className="font-mono text-xl font-bold text-[#1a1a1a] mt-1">
                {formatCurrency(totalPositionCost, currency)}
              </div>
              <div className="text-[10px] text-gray-600 font-mono mt-0.5">
                {actualPortfolioAllocationPercent.toFixed(1)}% of Portfolio
              </div>
            </div>

            {/* Total Dollar Risk ($) */}
            <div className="bg-red-50/70 p-4 border border-red-200 shadow-xs">
              <div className="text-[10px] font-mono uppercase text-red-700 font-bold tracking-wider">
                Max Dollar Risk
              </div>
              <div className="font-mono text-xl font-black text-red-600 mt-1">
                -{formatCurrency(actualTotalDollarRisk, currency)}
              </div>
              <div className="text-[10px] text-red-800/80 font-mono mt-0.5">
                -{actualRiskOfPortfolioPercent.toFixed(2)}% Portfolio Risk
              </div>
            </div>

            {/* Reward-to-Risk (R/R) */}
            <div className="bg-emerald-50/70 p-4 border border-emerald-200 shadow-xs">
              <div className="text-[10px] font-mono uppercase text-emerald-800 font-bold tracking-wider">
                Reward / Risk
              </div>
              <div className="font-mono text-2xl font-black text-emerald-700 mt-1">
                {rrRatioT1.toFixed(2)}x
              </div>
              <div className="text-[10px] text-emerald-900 font-mono mt-0.5">
                +{formatCurrency(totalDollarRewardT1, currency)} at Target 1
              </div>
            </div>
          </div>

          {/* Allocation Warning / Cap Notification */}
          {isPositionCapped && (
            <div className="p-3 bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start space-x-2 font-sans">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Minervini Concentration Cap Applied:</strong> Position size was reduced from {rawShares.toLocaleString()} to {finalShares.toLocaleString()} shares to ensure maximum portfolio allocation does not exceed {maxAllocationPercent}% ({formatCurrency(maxPortfolioAllocationDollars, currency)}).
              </div>
            </div>
          )}

          {/* R-Multiple Roadmap Table */}
          <div className="bg-white border border-[#e5e4e1] p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-[#e5e4e1] pb-2">
              <h4 className="text-xs font-mono font-black uppercase tracking-wider text-[#1a1a1a] flex items-center space-x-1.5">
                <Target className="w-3.5 h-3.5 text-amber-600" />
                <span>R-Multiple Asymmetric Payoff Ladder</span>
              </h4>
              <span className="text-[10px] font-mono text-gray-500">1R Risk Unit = {formatCurrency(actualTotalDollarRisk, currency)}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono border-collapse">
                <thead>
                  <tr className="bg-[#f9f8f5] text-gray-500 uppercase text-[9px] border-b border-[#e5e4e1]">
                    <th className="py-2 px-3 text-left">Multiple</th>
                    <th className="py-2 px-3 text-left">Description</th>
                    <th className="py-2 px-3 text-right">Target Price</th>
                    <th className="py-2 px-3 text-right">Gain %</th>
                    <th className="py-2 px-3 text-right">Dollar Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e5e4e1]">
                  {rMultiples.map((rm) => (
                    <tr key={rm.r} className="hover:bg-gray-50">
                      <td className="py-2 px-3 font-bold text-amber-700">{rm.r}R</td>
                      <td className="py-2 px-3 text-gray-700 font-sans">{rm.label}</td>
                      <td className="py-2 px-3 text-right font-bold text-[#1a1a1a]">{formatCurrency(rm.price, currency)}</td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-700">+{rm.gainPct.toFixed(1)}%</td>
                      <td className="py-2 px-3 text-right font-black text-emerald-800">+{formatCurrency(rm.profitDollar, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pyramiding & Staged Execution Hub */}
          <div className="bg-[#f9f8f5] border border-[#e5e4e1] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e5e4e1] pb-2">
              <div className="flex items-center space-x-1.5">
                <Layers className="w-3.5 h-3.5 text-purple-600" />
                <h4 className="text-xs font-mono font-black uppercase tracking-wider text-[#1a1a1a]">
                  Pyramiding Staged Buying Blueprint
                </h4>
              </div>

              <div className="inline-flex border border-[#e5e4e1] bg-white p-0.5 text-[10px] font-mono">
                <button
                  type="button"
                  onClick={() => setPyramidPlan('STANDARD_50_30_20')}
                  className={`px-2 py-0.5 ${pyramidPlan === 'STANDARD_50_30_20' ? 'bg-[#1a1a1a] text-white font-bold' : 'text-gray-600'}`}
                >
                  50 / 30 / 20 Scale
                </button>
                <button
                  type="button"
                  onClick={() => setPyramidPlan('HALF_HALF')}
                  className={`px-2 py-0.5 ${pyramidPlan === 'HALF_HALF' ? 'bg-[#1a1a1a] text-white font-bold' : 'text-gray-600'}`}
                >
                  50 / 50 Split
                </button>
                <button
                  type="button"
                  onClick={() => setPyramidPlan('SINGLE_BULLET')}
                  className={`px-2 py-0.5 ${pyramidPlan === 'SINGLE_BULLET' ? 'bg-[#1a1a1a] text-white font-bold' : 'text-gray-600'}`}
                >
                  100% Single Entry
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {pyramidStages.map((stage, idx) => (
                <div key={idx} className="bg-white border border-[#e5e4e1] p-3 text-xs font-mono flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div>
                    <div className="font-bold text-[#1a1a1a] flex items-center space-x-2">
                      <span>{stage.stage}</span>
                      <span className="text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.2 font-bold">{stage.shares.toLocaleString()} Shares</span>
                    </div>
                    <div className="text-[11px] text-gray-500 font-sans mt-0.5">{stage.note}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-[#1a1a1a]">Buy: {formatCurrency(stage.price, currency)}</div>
                    <div className="text-[10px] text-red-600">Stop: {formatCurrency(stage.stopPrice, currency)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Asymmetric Expectancy Model Simulator */}
          <div className="bg-[#10141d] text-white p-4 border border-black space-y-3 font-mono">
            <div className="flex items-center justify-between border-b border-gray-800 pb-2">
              <div className="flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-bold text-amber-300 uppercase">
                  Statistical Expectancy Edge Simulator
                </span>
              </div>
              <span className="text-[10px] text-gray-400">Win Rate: {winRateInput}%</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-gray-900/80 p-2.5 border border-gray-800">
                <span className="text-[10px] text-gray-400 uppercase block">Gain/Loss Ratio:</span>
                <span className="text-base font-bold text-white">{expectancyResult.gainToLossRatio.toFixed(2)}:1</span>
              </div>
              <div className="bg-gray-900/80 p-2.5 border border-gray-800">
                <span className="text-[10px] text-gray-400 uppercase block">Profit Factor:</span>
                <span className="text-base font-bold text-emerald-400">{expectancyResult.profitFactor.toFixed(2)}</span>
              </div>
              <div className="bg-gray-900/80 p-2.5 border border-gray-800">
                <span className="text-[10px] text-gray-400 uppercase block">Net Expectancy:</span>
                <span className={`text-base font-black ${expectancyResult.isPositiveEdge ? 'text-emerald-400' : 'text-red-400'}`}>
                  {expectancyResult.netExpectancyPct >= 0 ? '+' : ''}{expectancyResult.netExpectancyPct.toFixed(2)}% / trade
                </span>
              </div>
            </div>

            <div className="text-[10px] text-gray-400 font-sans italic">
              Minervini Rule: Even with only a 40-50% win rate, maintaining a 3:1 reward-to-risk ratio yields profound mathematical alpha and capital compounding over 100+ executed setups.
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
