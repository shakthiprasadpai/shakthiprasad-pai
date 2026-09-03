import React, { useState, useMemo } from 'react';
import { MinerviniTradeSetup, TrendContinuationSetup } from '../types';
import {
  calculateRelativeStrengthRating,
  calculateTrendContinuationSetup,
  filterTrendContinuationSetups,
  formatCurrency,
  getCurrencySymbol,
  formatVolume
} from '../utils/sepaCalculator';
import {
  Zap,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Activity,
  BarChart3,
  SlidersHorizontal,
  ChevronRight,
  Info,
  DollarSign,
  ArrowUpRight,
  Target,
  Flame,
  Volume2,
  Percent,
  Layers,
  Sparkles
} from 'lucide-react';

interface RelativeStrengthContinuationPanelProps {
  stock: MinerviniTradeSetup;
  allStocks?: MinerviniTradeSetup[];
  onSelectStock?: (stock: MinerviniTradeSetup) => void;
}

export const RelativeStrengthContinuationPanel: React.FC<RelativeStrengthContinuationPanelProps> = ({
  stock,
  allStocks = [],
  onSelectStock
}) => {
  // Prerequisite Filter Threshold: 80 (Elite Leadership) | 70 (Minervini Baseline) | 0 (All)
  const [rsFilterThreshold, setRsFilterThreshold] = useState<number>(80);
  const [requireTightVolumeOnly, setRequireTightVolumeOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showFormulaModal, setShowFormulaModal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'selected_breakdown' | 'filtered_setups'>('filtered_setups');

  const currencySymbol = getCurrencySymbol(stock.exchange);

  // Active stock's RS calculation & Trend Continuation setup
  const currentSetup = useMemo(() => {
    return calculateTrendContinuationSetup(stock, allStocks.length > 0 ? allStocks : [stock]);
  }, [stock, allStocks]);

  // Universe filtered setups meeting the RS prerequisite
  const filteredSetups = useMemo(() => {
    const list = allStocks.length > 0 ? allStocks : [stock];
    const setups = filterTrendContinuationSetups(list, rsFilterThreshold, requireTightVolumeOnly);

    if (!searchQuery.trim()) return setups;
    const q = searchQuery.toLowerCase();
    return setups.filter(
      (s) =>
        s.stock.ticker.toLowerCase().includes(q) ||
        s.stock.name.toLowerCase().includes(q) ||
        s.stock.sector.toLowerCase().includes(q)
    );
  }, [allStocks, stock, rsFilterThreshold, requireTightVolumeOnly, searchQuery]);

  // Count metrics for quick filter badges
  const universe = allStocks.length > 0 ? allStocks : [stock];
  const countRs90 = universe.filter((s) => (s.rsRating || 0) >= 90).length;
  const countRs80 = universe.filter((s) => (s.rsRating || 0) >= 80).length;
  const countRs70 = universe.filter((s) => (s.rsRating || 0) >= 70).length;

  return (
    <div className="bg-white border border-[#e5e4e1] p-6 shadow-xs space-y-6">
      {/* Panel Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#e5e4e1] pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-amber-700 bg-amber-50 border border-amber-300 px-2 py-0.5">
              SEPA Prerequisite Engine
            </span>
            <span className="text-[10px] font-mono text-gray-400">Rule 8 Deep Dive</span>
          </div>
          <h3 className="text-xl font-serif font-black text-[#1a1a1a] mt-1 flex items-center space-x-2">
            <span>Relative Strength (RS) Rating & Trend Continuation</span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </h3>
          <p className="text-xs text-gray-600 font-serif italic mt-0.5 max-w-2xl leading-relaxed">
            Mark Minervini’s non-negotiable rule: only buy high Relative Strength market leaders (RS ≥ 70, ideally ≥ 80)
            forming tight consolidation pivots with confirmed volume dry-up.
          </p>
        </div>

        {/* Top Controls: Formula Explanation & Tab Switcher */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setShowFormulaModal(true)}
            className="px-3 py-1.5 bg-[#f9f8f5] hover:bg-[#f0eee9] text-[#1a1a1a] border border-[#d6d4cf] text-xs font-mono font-bold uppercase tracking-wider flex items-center space-x-1.5 transition-all cursor-pointer"
          >
            <Info className="w-3.5 h-3.5 text-amber-600" />
            <span>Minervini RS Formula</span>
          </button>

          <div className="inline-flex border border-[#d6d4cf] p-0.5 bg-[#f9f8f5]">
            <button
              type="button"
              onClick={() => setActiveTab('filtered_setups')}
              className={`px-3 py-1 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'filtered_setups'
                  ? 'bg-[#1a1a1a] text-white shadow-2xs'
                  : 'text-gray-600 hover:text-black'
              }`}
            >
              Filtered Setups ({filteredSetups.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('selected_breakdown')}
              className={`px-3 py-1 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'selected_breakdown'
                  ? 'bg-[#1a1a1a] text-white shadow-2xs'
                  : 'text-gray-600 hover:text-black'
              }`}
            >
              {stock.ticker} RS Breakdown
            </button>
          </div>
        </div>
      </div>

      {/* Selected Stock Banner Overview */}
      <div className="bg-[#0f141c] text-white p-5 border border-gray-800 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="font-mono text-sm font-bold text-amber-400">{stock.ticker}</span>
              <span className="text-xs text-gray-400 font-sans">• {stock.name}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-gray-800 text-gray-300 border border-gray-700">
                {stock.exchange}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-gray-300">
              <span>Price: <strong className="text-white">{currencySymbol}{stock.currentPrice.toFixed(2)}</strong></span>
              <span>•</span>
              <span>Pivot: <strong className="text-amber-300">{currencySymbol}{currentSetup.entryPrices.pivotPrice.toFixed(2)}</strong></span>
              <span>•</span>
              <span>Stop: <strong className="text-rose-400">{currencySymbol}{currentSetup.exitPrices.stopLossPrice.toFixed(2)} ({currentSetup.exitPrices.stopLossPercent.toFixed(1)}%)</strong></span>
              <span>•</span>
              <span>R:R: <strong className="text-emerald-400">{currentSetup.exitPrices.riskRewardRatio}:1</strong></span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* RS Rating Readout */}
            <div className="bg-black/60 border border-gray-700 px-4 py-2 text-center">
              <span className="text-[9px] uppercase font-mono tracking-widest text-gray-400 block">
                Relative Strength
              </span>
              <div className="flex items-baseline justify-center space-x-1">
                <span className="text-2xl font-black text-amber-400 font-mono leading-none">
                  {currentSetup.rsCalculation.calculatedRsRating}
                </span>
                <span className="text-xs text-gray-400 font-bold">/ 99</span>
              </div>
            </div>

            {/* Prerequisite Passed Badge */}
            <div
              className={`px-3.5 py-2 border text-xs font-mono font-bold text-center ${
                currentSetup.rsCalculation.prerequisitePassed80
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-500'
                  : currentSetup.rsCalculation.prerequisitePassed70
                  ? 'bg-amber-950 text-amber-300 border-amber-500'
                  : 'bg-rose-950 text-rose-300 border-rose-500'
              }`}
            >
              <div className="flex items-center space-x-1.5">
                {currentSetup.rsCalculation.prerequisitePassed70 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span>
                  {currentSetup.rsCalculation.prerequisitePassed80
                    ? 'PREREQUISITE PASSED (ELITE RS 80+)'
                    : currentSetup.rsCalculation.prerequisitePassed70
                    ? 'PREREQUISITE PASSED (RS 70+)'
                    : 'FAILS PREREQUISITE (RS < 70)'}
                </span>
              </div>
              <span className="text-[9px] block text-gray-300 mt-0.5">
                {currentSetup.rsCalculation.tierLabel}
              </span>
            </div>
          </div>
        </div>

        {/* RS Line Divergence Alert */}
        <div className="mt-4 pt-3 border-t border-gray-800 flex items-start space-x-2.5 text-xs">
          <TrendingUp className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-amber-300 font-mono">
              {currentSetup.rsCalculation.rsLineTrendLabel}:
            </span>{' '}
            <span className="text-gray-300 font-sans">
              {currentSetup.rsCalculation.rsLineTrendDescription}
            </span>
          </div>
        </div>
      </div>

      {/* VIEW TAB 1: Filtered Setups with Precise Entry, Exit, and Tight Volume Criteria */}
      {activeTab === 'filtered_setups' && (
        <div className="space-y-5">
          {/* Filtering Toolbar */}
          <div className="bg-[#f9f8f5] border border-[#e5e4e1] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Threshold Selection Tabs */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-gray-500 mr-1 flex items-center space-x-1">
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>RS Prerequisite Filter:</span>
                </span>

                <button
                  type="button"
                  onClick={() => setRsFilterThreshold(80)}
                  className={`px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                    rsFilterThreshold === 80
                      ? 'bg-emerald-900 text-amber-300 border-emerald-700 shadow-xs'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                  }`}
                  title="Filter for true market leaders (RS >= 80) — Mark Minervini's highest conviction prerequisite"
                >
                  <span>RS ≥ 80 (Elite Leadership)</span>
                  <span className="ml-1.5 px-1.5 py-0.2 bg-black/20 text-[10px] font-mono rounded-none">
                    {countRs80}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setRsFilterThreshold(70)}
                  className={`px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                    rsFilterThreshold === 70
                      ? 'bg-amber-900 text-amber-200 border-amber-700 shadow-xs'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                  }`}
                  title="Filter for all stocks meeting Minervini Trend Template Rule 8 baseline (RS >= 70)"
                >
                  <span>RS ≥ 70 (Minervini Baseline)</span>
                  <span className="ml-1.5 px-1.5 py-0.2 bg-black/20 text-[10px] font-mono rounded-none">
                    {countRs70}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setRsFilterThreshold(90)}
                  className={`px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                    rsFilterThreshold === 90
                      ? 'bg-purple-900 text-purple-200 border-purple-700 shadow-xs'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                  }`}
                  title="Top 10% superperformers (RS >= 90)"
                >
                  <span>RS ≥ 90 (Top 10% Leaders)</span>
                  <span className="ml-1.5 px-1.5 py-0.2 bg-black/20 text-[10px] font-mono rounded-none">
                    {countRs90}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setRsFilterThreshold(0)}
                  className={`px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                    rsFilterThreshold === 0
                      ? 'bg-[#1a1a1a] text-white border-black shadow-xs'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <span>All Universe ({universe.length})</span>
                </button>
              </div>

              {/* Strict Tight Volume Toggle */}
              <label className="flex items-center space-x-2 cursor-pointer text-xs font-mono text-gray-800 select-none bg-white px-3 py-1.5 border border-gray-300 hover:border-gray-400 transition-colors">
                <input
                  type="checkbox"
                  checked={requireTightVolumeOnly}
                  onChange={(e) => setRequireTightVolumeOnly(e.target.checked)}
                  className="h-3.5 w-3.5 text-emerald-600 rounded-none border-gray-300 focus:ring-emerald-500 cursor-pointer"
                />
                <span className="font-bold uppercase text-[11px] flex items-center space-x-1">
                  <Volume2 className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Require Tight Volume (Dry-Up ≤ -40%)</span>
                </span>
              </label>
            </div>

            {/* Quick Search */}
            <div className="flex items-center justify-between pt-1 border-t border-[#e5e4e1] text-xs">
              <span className="text-gray-500 font-serif italic">
                Surfacing <strong className="text-black font-mono not-italic">{filteredSetups.length}</strong> trend continuation setups meeting{' '}
                <strong className="text-amber-800 font-mono not-italic">RS ≥ {rsFilterThreshold}</strong>
                {requireTightVolumeOnly ? ' with strict volume dry-up' : ''}.
              </span>

              <input
                type="text"
                placeholder="Search ticker, name, or sector..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-3 py-1 text-xs border border-gray-300 bg-white focus:outline-none focus:border-black font-mono w-60"
              />
            </div>
          </div>

          {/* Filtered Setups List */}
          {filteredSetups.length === 0 ? (
            <div className="p-8 text-center bg-gray-50 border border-dashed border-gray-300 space-y-2">
              <AlertTriangle className="w-8 h-8 text-amber-600 mx-auto" />
              <h4 className="text-sm font-bold text-gray-900 font-serif">
                No Setups Qualified Under Current Filter
              </h4>
              <p className="text-xs text-gray-500 font-serif italic max-w-md mx-auto">
                No stocks match the strict prerequisite of RS ≥ {rsFilterThreshold}
                {requireTightVolumeOnly ? ' with tight volume dry-up' : ''}. Try lowering the RS threshold to 70 or unchecking tight volume.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSetups.map((setup) => {
                const isSelected = setup.stock.ticker === stock.ticker;
                const itemCurrency = getCurrencySymbol(setup.stock.exchange);

                return (
                  <div
                    key={setup.stock.ticker}
                    className={`border transition-all ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50/20 shadow-md ring-1 ring-amber-400'
                        : 'border-[#e5e4e1] bg-white hover:border-gray-400'
                    }`}
                  >
                    {/* Setup Card Header */}
                    <div className="p-4 border-b border-[#e5e4e1] bg-[#faf9f6] flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center space-x-2">
                          <span className="text-base font-black font-mono text-[#1a1a1a]">
                            {setup.stock.ticker}
                          </span>
                          <span className="text-xs text-gray-600 font-sans">
                            {setup.stock.name}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-gray-200 text-gray-700">
                            {setup.stock.exchange}
                          </span>
                        </div>

                        <span className="text-xs font-serif text-gray-500 italic">
                          {setup.stock.sector} • {setup.stock.industry}
                        </span>

                        <span className="text-[10px] font-mono px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 font-bold">
                          {setup.stock.patternType} ({setup.stock.vcpStage})
                        </span>
                      </div>

                      {/* RS Badge & Select Button */}
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-1.5 bg-black text-amber-300 px-3 py-1 text-xs font-mono font-bold">
                          <span>RS:</span>
                          <span className="text-sm font-black text-amber-400">
                            {setup.rsCalculation.calculatedRsRating}
                          </span>
                          <span className="text-[10px] text-gray-400">/99</span>
                        </div>

                        <div className="px-2 py-0.5 text-[10px] font-mono font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                          GRADE {setup.setupGrade}
                        </div>

                        {onSelectStock && (
                          <button
                            type="button"
                            onClick={() => onSelectStock(setup.stock)}
                            className={`px-3 py-1 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                              isSelected
                                ? 'bg-amber-600 text-white border-amber-700'
                                : 'bg-[#1a1a1a] hover:bg-black text-white border-black'
                            }`}
                          >
                            {isSelected ? 'Active Stock' : 'Select Stock'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Three-Column Spec Grid: 1. Entry Prices | 2. Exit Prices | 3. Tight Volume Criteria */}
                    <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#e5e4e1] p-4 text-xs font-mono">
                      {/* Column 1: Precise Entry Prices */}
                      <div className="space-y-3 md:pr-4">
                        <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
                          <span className="font-bold text-gray-800 uppercase tracking-wider flex items-center space-x-1">
                            <Target className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Entry Prices</span>
                          </span>
                          <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 border border-emerald-200">
                            Breakout Level
                          </span>
                        </div>

                        <div className="space-y-1.5 text-gray-700">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-500">Pivot Buy Point:</span>
                            <span className="text-sm font-black text-[#1a1a1a]">
                              {itemCurrency}{setup.entryPrices.pivotPrice.toFixed(2)}
                            </span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-gray-500">Optimal Buy Zone (+2%):</span>
                            <span className="font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5">
                              {itemCurrency}{setup.entryPrices.buyZoneMin.toFixed(2)} – {itemCurrency}{setup.entryPrices.buyZoneMax.toFixed(2)}
                            </span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-gray-500" title="Minervini Rule: Never chase more than 5% above the pivot">
                              Max Chase Limit (+5%):
                            </span>
                            <span className="font-bold text-amber-900">
                              {itemCurrency}{setup.entryPrices.maxChasePrice.toFixed(2)}
                            </span>
                          </div>

                          {setup.entryPrices.cheatEntryPrice && (
                            <div className="flex justify-between items-center pt-1 border-t border-gray-100">
                              <span className="text-indigo-700 font-bold">3C Cheat Entry (Inside Base):</span>
                              <span className="font-black text-indigo-900">
                                {itemCurrency}{setup.entryPrices.cheatEntryPrice.toFixed(2)}
                              </span>
                            </div>
                          )}

                          <div className="text-[11px] text-gray-500 font-serif italic pt-1">
                            Trigger: {setup.entryPrices.entryTriggerType}
                          </div>
                        </div>
                      </div>

                      {/* Column 2: Precise Exit Prices */}
                      <div className="space-y-3 py-3 md:py-0 md:px-4">
                        <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
                          <span className="font-bold text-gray-800 uppercase tracking-wider flex items-center space-x-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-rose-700" />
                            <span>Exit Prices</span>
                          </span>
                          <span className="text-[10px] text-amber-800 font-bold bg-amber-50 px-1.5 py-0.5 border border-amber-200">
                            {setup.exitPrices.riskRewardRatio}:1 R:R
                          </span>
                        </div>

                        <div className="space-y-1.5 text-gray-700">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-500">Initial Hard Stop:</span>
                            <span className="text-sm font-black text-rose-700">
                              {itemCurrency}{setup.exitPrices.stopLossPrice.toFixed(2)} ({setup.exitPrices.stopLossPercent.toFixed(1)}%)
                            </span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-gray-500">Risk Per Share:</span>
                            <span className="font-bold text-gray-900">
                              {itemCurrency}{setup.exitPrices.riskAmountDollars.toFixed(2)}
                            </span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-gray-500">Target 1 (3:1 Objective):</span>
                            <span className="font-bold text-emerald-800">
                              {itemCurrency}{setup.exitPrices.target1Price.toFixed(2)} (+{setup.exitPrices.target1Percent.toFixed(1)}%)
                            </span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-gray-500">Target 2 (Runner):</span>
                            <span className="font-bold text-purple-800">
                              {itemCurrency}{setup.exitPrices.target2Price.toFixed(2)} (+{setup.exitPrices.target2Percent.toFixed(1)}%)
                            </span>
                          </div>

                          <div className="flex justify-between items-center pt-1 border-t border-gray-100">
                            <span className="text-gray-500" title="Lock in free trade milestone">
                              Breakeven Trigger (+3R):
                            </span>
                            <span className="font-bold text-blue-900">
                              {itemCurrency}{setup.exitPrices.breakevenTriggerPrice.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Column 3: Tight Volume Criteria */}
                      <div className="space-y-3 md:pl-4">
                        <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
                          <span className="font-bold text-gray-800 uppercase tracking-wider flex items-center space-x-1">
                            <Volume2 className="w-3.5 h-3.5 text-teal-700" />
                            <span>Tight Volume Criteria</span>
                          </span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 border ${
                              setup.tightVolumeCriteria.dryUpStatus === 'EXTREME_DRY_UP'
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                : 'bg-teal-50 text-teal-900 border-teal-200'
                            }`}
                          >
                            {setup.tightVolumeCriteria.volumeDryUpPercent.toFixed(1)}% Dry-Up
                          </span>
                        </div>

                        <div className="space-y-1.5 text-gray-700">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-500">20-Day Avg Volume:</span>
                            <span className="font-bold text-gray-900">
                              {formatVolume(setup.tightVolumeCriteria.avgVolume20d)}
                            </span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-gray-500">Handle / Pivot Volume:</span>
                            <span className="font-bold text-teal-800">
                              {formatVolume(setup.tightVolumeCriteria.pivotVolume)}
                            </span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-gray-500">Breakout Vol Required:</span>
                            <span className="font-bold text-amber-900">
                              ≥ {formatVolume(setup.tightVolumeCriteria.requiredBreakoutVolume)} (+50%)
                            </span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-gray-500">Tight Volume Status:</span>
                            <span
                              className={`font-bold text-[10px] px-1.5 py-0.2 ${
                                setup.tightVolumeCriteria.isTightVolume
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : 'bg-gray-100 text-gray-700 border border-gray-300'
                              }`}
                            >
                              {setup.tightVolumeCriteria.isTightVolume ? 'CONFIRMED TIGHT' : 'MODERATE DRY-UP'}
                            </span>
                          </div>

                          {/* Supply Exhaustion Progress Bar */}
                          <div className="pt-1.5">
                            <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                              <span>Supply Exhaustion:</span>
                              <span className="font-bold text-emerald-700">
                                {setup.tightVolumeCriteria.supplyExhaustionScore}%
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 h-1.5 rounded-none overflow-hidden">
                              <div
                                className="bg-emerald-600 h-full"
                                style={{ width: `${setup.tightVolumeCriteria.supplyExhaustionScore}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer Rationale */}
                    <div className="px-4 py-2.5 bg-[#fcfbf9] border-t border-[#e5e4e1] flex flex-wrap items-center justify-between text-[11px] text-gray-600">
                      <div className="flex items-center space-x-2">
                        <Info className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                        <span className="font-serif italic">{setup.rsCalculation.eligibilityExplanation}</span>
                      </div>
                      <span className="font-mono text-[10px] text-gray-500">
                        {setup.tightVolumeCriteria.volumeSequenceSummary}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW TAB 2: Mathematical 4-Quarter RS Calculation Breakdown for Active Stock */}
      {activeTab === 'selected_breakdown' && (
        <div className="space-y-5">
          {/* Formula Summary Box */}
          <div className="bg-[#10141d] text-white p-5 border border-gray-800 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div className="flex items-center space-x-2">
                <BarChart3 className="w-5 h-5 text-amber-400" />
                <h4 className="text-sm font-serif font-black text-white">
                  {stock.ticker} Relative Strength (RS) 4-Quarter Weighted Decomposition
                </h4>
              </div>
              <span className="px-2.5 py-1 bg-amber-400 text-black font-mono font-black text-xs">
                Score: {currentSetup.rsCalculation.weightedPerformanceScore} | RS {currentSetup.rsCalculation.calculatedRsRating}
              </span>
            </div>

            <p className="text-xs text-gray-300 font-serif italic">
              Minervini evaluates price change over the last 12 months with heavy weighting on the most recent quarter (40%),
              measuring how vigorously institutions are accumulating the stock relative to market averages.
            </p>

            {/* 4 Quarters Breakdown Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-900/90 text-gray-400 border-b border-gray-700 text-[10px] uppercase tracking-wider">
                    <th className="py-2.5 px-3">Quarter</th>
                    <th className="py-2.5 px-3">Period</th>
                    <th className="py-2.5 px-3 text-center">SEPA Weight</th>
                    <th className="py-2.5 px-3 text-right">Stock Return</th>
                    <th className="py-2.5 px-3 text-right">Benchmark Return</th>
                    <th className="py-2.5 px-3 text-right">Excess Return</th>
                    <th className="py-2.5 px-3 text-right">Weighted Contribution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {currentSetup.rsCalculation.quarters.map((q) => (
                    <tr key={q.quarter} className="hover:bg-gray-800/40 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-white flex items-center space-x-1.5">
                        <span className="w-1.5 h-1.5 bg-amber-400 rounded-full"></span>
                        <span>{q.quarter}</span>
                      </td>
                      <td className="py-2.5 px-3 text-gray-400 text-[11px]">{q.periodLabel}</td>
                      <td className="py-2.5 px-3 text-center font-bold text-amber-300">
                        {q.weightPercent}%
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-emerald-400">
                        +{q.stockReturnPercent.toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3 text-right text-gray-400">
                        +{q.benchmarkReturnPercent.toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-teal-300">
                        +{q.excessReturnPercent.toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-amber-400">
                        +{q.weightedContribution.toFixed(2)} pts
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-900 font-bold border-t border-gray-700 text-white">
                    <td colSpan={2} className="py-3 px-3 uppercase tracking-wider text-[11px] text-gray-300">
                      Weighted SEPA Score & RS Rating
                    </td>
                    <td className="py-3 px-3 text-center text-amber-300">100%</td>
                    <td className="py-3 px-3 text-right text-emerald-400">
                      +{currentSetup.rsCalculation.annualReturnPercent.toFixed(1)}% Net
                    </td>
                    <td className="py-3 px-3 text-right text-gray-400">+14.8% Market</td>
                    <td className="py-3 px-3 text-right text-teal-300">
                      +{(currentSetup.rsCalculation.annualReturnPercent - 14.8).toFixed(1)}% Alpha
                    </td>
                    <td className="py-3 px-3 text-right text-amber-400 text-sm font-black">
                      RS {currentSetup.rsCalculation.calculatedRsRating} / 99
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Detailed Criteria Checklist for Active Stock */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            {/* Box 1: Entry & Exit Summary */}
            <div className="bg-[#f9f8f5] border border-[#e5e4e1] p-4 space-y-3">
              <span className="font-bold text-[#1a1a1a] uppercase tracking-wider flex items-center space-x-1.5">
                <Target className="w-4 h-4 text-emerald-700" />
                <span>Active Setup Order Execution Plan</span>
              </span>

              <div className="space-y-2 text-gray-700">
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-500">Pivot Entry Price:</span>
                  <span className="font-black text-[#1a1a1a]">
                    {currencySymbol}{currentSetup.entryPrices.pivotPrice.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-500">Max Buy Zone (+2%):</span>
                  <span className="font-bold text-emerald-800">
                    {currencySymbol}{currentSetup.entryPrices.buyZoneMax.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-500">Hard Stop Loss:</span>
                  <span className="font-black text-rose-700">
                    {currencySymbol}{currentSetup.exitPrices.stopLossPrice.toFixed(2)} (-{currentSetup.exitPrices.stopLossPercent.toFixed(1)}%)
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-500">Target 1 (3:1 Profit):</span>
                  <span className="font-bold text-emerald-800">
                    {currencySymbol}{currentSetup.exitPrices.target1Price.toFixed(2)} (+{currentSetup.exitPrices.target1Percent.toFixed(1)}%)
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-500">Target 2 (Extended Runner):</span>
                  <span className="font-bold text-purple-800">
                    {currencySymbol}{currentSetup.exitPrices.target2Price.toFixed(2)} (+{currentSetup.exitPrices.target2Percent.toFixed(1)}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Box 2: Volume Dry-Up Summary */}
            <div className="bg-[#f9f8f5] border border-[#e5e4e1] p-4 space-y-3">
              <span className="font-bold text-[#1a1a1a] uppercase tracking-wider flex items-center space-x-1.5">
                <Volume2 className="w-4 h-4 text-teal-700" />
                <span>Volume Dry-Up & Liquidity Verification</span>
              </span>

              <div className="space-y-2 text-gray-700">
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-500">20-Day Average Volume:</span>
                  <span className="font-bold text-[#1a1a1a]">
                    {formatVolume(currentSetup.tightVolumeCriteria.avgVolume20d)}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-500">Contraction Dry-Up Volume:</span>
                  <span className="font-bold text-teal-800">
                    {formatVolume(currentSetup.tightVolumeCriteria.pivotVolume)} ({currentSetup.tightVolumeCriteria.volumeDryUpPercent.toFixed(1)}%)
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-500">Required Breakout Day Volume:</span>
                  <span className="font-black text-amber-900">
                    ≥ {formatVolume(currentSetup.tightVolumeCriteria.requiredBreakoutVolume)} (+50% surge)
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-500">Supply Exhaustion Level:</span>
                  <span className="font-black text-emerald-700">
                    {currentSetup.tightVolumeCriteria.dryUpStatusLabel}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Minervini RS Formula Explanation Modal */}
      {showFormulaModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setShowFormulaModal(false)}
        >
          <div
            className="bg-white border-2 border-[#1a1a1a] max-w-xl w-full p-6 shadow-2xl space-y-4 relative text-[#1a1a1a]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#e5e4e1] pb-3">
              <div className="flex items-center space-x-2">
                <span className="p-1 bg-amber-100 text-amber-900 font-mono text-[10px] font-bold uppercase border border-amber-300">
                  SEPA Math
                </span>
                <h3 className="text-base font-serif font-black text-[#1a1a1a]">
                  Minervini Relative Strength (RS) Formula
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFormulaModal(false)}
                className="text-gray-500 hover:text-black text-sm font-mono cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-[#f9f8f5] border border-[#e5e4e1] p-3 text-xs font-mono space-y-1.5">
              <span className="text-amber-800 font-bold block">Weighted Performance Equation:</span>
              <p className="bg-white p-2 border border-gray-300 text-[11px] text-black font-black">
                RS Score = (0.40 × Q1 Return) + (0.20 × Q2 Return) + (0.20 × Q3 Return) + (0.20 × Q4 Return)
              </p>
              <span className="text-[10px] text-gray-500 block mt-1">
                Where Q1 is the most recent 3 months (63 trading days) weighted double vs past quarters.
              </span>
            </div>

            <div className="space-y-2 text-xs text-gray-700 font-sans leading-relaxed">
              <p>
                <strong>Why RS 70/80+ is Mandatory:</strong> In <em>Trade Like a Stock Market Wizard</em>,
                Mark Minervini documents that the biggest stock market winners had an average RS rating of <strong>87</strong>{' '}
                before embarking on their historic Stage 2 runs.
              </p>
              <ul className="list-disc pl-5 space-y-1 font-mono text-[11px]">
                <li><strong>RS 90+:</strong> Top 10% elite market leaders. Superperformer candidates.</li>
                <li><strong>RS 80–89:</strong> Strong institutional accumulation. Ideal breakout candidates.</li>
                <li><strong>RS 70–79:</strong> Baseline acceptable for Minervini Trend Template Rule 8.</li>
                <li><strong>RS &lt; 70:</strong> Disqualified. Lacks necessary institutional velocity.</li>
              </ul>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowFormulaModal(false)}
                className="px-4 py-1.5 bg-[#1a1a1a] text-white text-xs font-mono font-bold uppercase tracking-wider cursor-pointer hover:bg-black"
              >
                Close Explanation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
