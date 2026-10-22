import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  TrendingDown,
  ShieldAlert,
  AlertTriangle,
  ArrowDownRight,
  Flame,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Calculator,
  BarChart3,
  Search,
  Filter,
  Layers,
  ArrowRight,
  DollarSign,
  Lock,
  Zap,
  Target,
  Info,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  TrendingUp,
  Skull
} from 'lucide-react';
import { MinerviniTradeSetup } from '../types';
import {
  evaluateBearishTrendTemplate,
  calculateShortTradePlan,
  calculateShortPositionSize,
  getMarketDistributionStatus,
  MOCK_BEARISH_STOCKS,
  BearishShortPattern
} from '../utils/bearishSepaCalculator';
import { formatCurrency, getCurrencySymbol } from '../utils/sepaCalculator';
import { getChartLinkUrl } from '../utils/chartLinkHelper';

interface BearishMarketDashboardProps {
  allStocks?: MinerviniTradeSetup[];
  selectedStock?: MinerviniTradeSetup;
  onSelectStock?: (stock: MinerviniTradeSetup) => void;
  onViewChart?: (stock: MinerviniTradeSetup) => void;
  onSwitchToBullishMode?: () => void;
  isObsidian?: boolean;
}

export const BearishMarketDashboard: React.FC<BearishMarketDashboardProps> = ({
  allStocks = [],
  selectedStock,
  onSelectStock,
  onViewChart,
  onSwitchToBullishMode,
  isObsidian = false,
}) => {
  // Combine custom universe with dedicated bearish breakdown stocks
  const combinedBearishUniverse = useMemo(() => {
    const existingTickers = new Set(MOCK_BEARISH_STOCKS.map(s => s.ticker));
    const extraLaggers = allStocks.filter(s => s.rsRating < 40 || s.currentPrice < s.sma200);
    const deduplicated = extraLaggers.filter(s => !existingTickers.has(s.ticker));
    return [...MOCK_BEARISH_STOCKS, ...deduplicated];
  }, [allStocks]);

  // Current active stock for detailed breakdown analysis
  const [activeBearStock, setActiveBearStock] = useState<MinerviniTradeSetup>(
    selectedStock && (selectedStock.rsRating < 50 || selectedStock.currentPrice < selectedStock.sma200)
      ? selectedStock
      : MOCK_BEARISH_STOCKS[0]
  );

  // Distribution days count on benchmark
  const [distributionDays, setDistributionDays] = useState<number>(5);

  // Filter state for screener
  const [patternFilter, setPatternFilter] = useState<'ALL' | BearishShortPattern>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [exchangeFilter, setExchangeFilter] = useState<'ALL' | 'NSE' | 'NASDAQ' | 'NYSE'>('ALL');

  // Position Sizing Calculator state
  const [accountCapital, setAccountCapital] = useState<number>(100000);
  const [riskPercent, setRiskPercent] = useState<number>(1.0);
  const [customCoverStopPct, setCustomCoverStopPct] = useState<number>(4.8);

  const currencySymbol = getCurrencySymbol(activeBearStock);

  // Run evaluation
  const bearishEval = useMemo(() => {
    return evaluateBearishTrendTemplate({
      currentPrice: activeBearStock.currentPrice,
      sma50: activeBearStock.sma50,
      sma150: activeBearStock.sma150,
      sma200: activeBearStock.sma200,
      sma200_1mo_ago: activeBearStock.sma200_1mo_ago,
      high52w: activeBearStock.high52w,
      low52w: activeBearStock.low52w,
      rsRating: activeBearStock.rsRating
    });
  }, [activeBearStock]);

  const shortTradePlan = useMemo(() => {
    return calculateShortTradePlan(activeBearStock);
  }, [activeBearStock]);

  const marketStatus = useMemo(() => {
    return getMarketDistributionStatus(distributionDays);
  }, [distributionDays]);

  // Position Sizing Result
  const positionSize = useMemo(() => {
    const entry = shortTradePlan.breakdownTriggerPrice;
    const stop = Number((entry * (1 + customCoverStopPct / 100)).toFixed(2));
    return calculateShortPositionSize(
      accountCapital,
      riskPercent,
      entry,
      stop,
      shortTradePlan.downsideTarget1Price,
      shortTradePlan.downsideTarget2Price
    );
  }, [accountCapital, riskPercent, customCoverStopPct, shortTradePlan]);

  // Filtered screener stocks
  const filteredBearishStocks = useMemo(() => {
    return combinedBearishUniverse.filter(stock => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match = stock.ticker.toLowerCase().includes(q) || stock.name.toLowerCase().includes(q) || stock.sector.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (exchangeFilter !== 'ALL' && stock.exchange !== exchangeFilter) {
        return false;
      }
      if (patternFilter !== 'ALL') {
        const plan = calculateShortTradePlan(stock);
        if (plan.patternType !== patternFilter) return false;
      }
      return true;
    });
  }, [combinedBearishUniverse, searchQuery, exchangeFilter, patternFilter]);

  const handleSelectStock = (stock: MinerviniTradeSetup) => {
    setActiveBearStock(stock);
    if (onSelectStock) {
      onSelectStock(stock);
    }
  };

  return (
    <div className={`space-y-8 font-sans ${isObsidian ? 'text-gray-100' : 'text-[#1a1a1a]'}`}>
      
      {/* 1. TOP HEADER & DEFENSIVE REGIME HERO BANNER */}
      <div className={`border p-6 sm:p-8 rounded-lg shadow-sm transition-all ${
        isObsidian
          ? 'bg-gradient-to-r from-red-950/40 via-slate-900 to-slate-950 border-red-500/30'
          : 'bg-gradient-to-r from-rose-50 via-slate-50 to-white border-rose-200'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 text-[11px] font-mono font-black uppercase tracking-wider bg-rose-600 text-white rounded">
                <Skull className="w-3.5 h-3.5" />
                <span>Stage 4 Markdown &amp; Short Selling Engine</span>
              </span>
              <span className={`px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded border ${
                distributionDays >= 4
                  ? 'bg-red-500/20 text-red-400 border-red-500/30'
                  : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
              }`}>
                Institutional Distribution Alert
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-serif font-black tracking-tight leading-tight">
              Bear Market Defense &amp; Short Screener
            </h1>

            <p className={`text-sm leading-relaxed ${isObsidian ? 'text-gray-300' : 'text-gray-700'}`}>
              Mark Minervini &amp; Stan Weinstein principles for protecting capital during market corrections. Identifies Stage 4 markdown stocks, failed 50MA rallies, death crosses, and institutional distribution breakdowns.
            </p>
          </div>

          {/* Quick Action Switching & Status Pills */}
          <div className="flex flex-wrap items-center gap-3">
            {onSwitchToBullishMode && (
              <button
                type="button"
                onClick={onSwitchToBullishMode}
                className="px-4 py-2.5 rounded font-mono font-bold text-xs uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white shadow-md flex items-center space-x-2 transition-all cursor-pointer"
              >
                <TrendingUp className="w-4 h-4" />
                <span>Switch to Stage 2 Bullish</span>
              </button>
            )}

            <div className={`p-3 rounded border text-left min-w-[140px] font-mono ${
              isObsidian ? 'bg-slate-900/80 border-slate-700' : 'bg-white border-[#e5e4e1]'
            }`}>
              <span className="text-[10px] uppercase text-gray-500 tracking-wider block font-sans">
                Cash Recommendation
              </span>
              <span className="text-xl font-black text-rose-500">
                {marketStatus.recommendedCashPercent}% CASH
              </span>
            </div>
          </div>
        </div>

        {/* Market Distribution Days Interactive Barometer */}
        <div className={`mt-6 pt-6 border-t ${isObsidian ? 'border-slate-800' : 'border-rose-100'} grid grid-cols-1 md:grid-cols-3 gap-4`}>
          
          {/* Distribution Days Controller */}
          <div className={`p-4 rounded border ${
            isObsidian ? 'bg-slate-900/60 border-slate-800' : 'bg-white/80 border-[#e5e4e1]'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-rose-500 flex items-center space-x-1.5">
                <Flame className="w-4 h-4 text-rose-500" />
                <span>Distribution Day Count (20D):</span>
              </span>
              <span className="text-base font-mono font-black text-rose-500 px-2 py-0.5 bg-rose-500/10 rounded border border-rose-500/20">
                {distributionDays} Days
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="8"
              step="1"
              value={distributionDays}
              onChange={(e) => setDistributionDays(Number(e.target.value))}
              className="w-full accent-rose-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono text-gray-400 mt-1">
              <span>0 (Bullish)</span>
              <span>4 (Warning)</span>
              <span>8 (Severe Bear)</span>
            </div>
          </div>

          {/* Current Regime Badge */}
          <div className={`p-4 rounded border flex flex-col justify-between ${
            isObsidian ? 'bg-slate-900/60 border-slate-800' : 'bg-white/80 border-[#e5e4e1]'
          }`}>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500 block">
                Market Regime State
              </span>
              <div className="text-sm font-black mt-1 flex items-center space-x-2">
                <span className={`w-2.5 h-2.5 rounded-full ${distributionDays >= 4 ? 'bg-rose-500 animate-ping' : 'bg-amber-400'}`} />
                <span className={distributionDays >= 4 ? 'text-rose-400' : 'text-amber-400'}>
                  {marketStatus.regimeLabel}
                </span>
              </div>
            </div>
            <div className="text-[11px] text-gray-400 font-sans mt-2">
              {marketStatus.postureAdvice}
            </div>
          </div>

          {/* Breadth Deterioration Metrics */}
          <div className={`p-4 rounded border ${
            isObsidian ? 'bg-slate-900/60 border-slate-800' : 'bg-white/80 border-[#e5e4e1]'
          }`}>
            <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500 block">
              Market Breadth Degradation
            </span>
            <div className="grid grid-cols-2 gap-2 mt-2 font-mono">
              <div>
                <span className="text-[10px] text-gray-400 block">&lt; 200-Day SMA</span>
                <strong className="text-base font-bold text-rose-500">
                  {marketStatus.stocksBelow200SmaPct}%
                </strong>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 block">Downside Vol Ratio</span>
                <strong className="text-base font-bold text-rose-400">
                  {marketStatus.downsideVolumeRatio}x
                </strong>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* 2. SELECTED BEARISH STOCK OVERVIEW RIBBON */}
      <div className={`border p-6 flex flex-wrap items-center justify-between gap-4 shadow-xs rounded-lg ${
        isObsidian ? 'bg-slate-900 border-slate-800' : 'bg-white border-[#e5e4e1]'
      }`}>
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 bg-rose-950 text-rose-300 border border-rose-800/60 flex flex-col items-center justify-center font-mono rounded">
            <span className="text-lg font-bold">{activeBearStock.ticker}</span>
            <span className="text-[9px] text-rose-400 uppercase tracking-widest">{activeBearStock.exchange}</span>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-serif font-black flex items-center space-x-2">
                <span>{activeBearStock.name}</span>
              </h2>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${bearishEval.badgeBg} ${bearishEval.badgeBorder}`}>
                {bearishEval.stageCode} ({bearishEval.passedCount}/8 Bear Rules)
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs font-mono mt-1 text-gray-400">
              <span>{activeBearStock.sector} / {activeBearStock.industry}</span>
              <span>•</span>
              <span className="font-bold text-gray-200">
                Price: {formatCurrency(activeBearStock.currentPrice, currencySymbol)}
              </span>
              <span className="text-rose-500 font-bold">
                {activeBearStock.changePercent}%
              </span>
              <span>•</span>
              <span className="bg-rose-950 text-rose-300 border border-rose-800 px-2 py-0.5 text-[10px] font-bold rounded">
                RS Weakness: {activeBearStock.rsRating} (Underperformer)
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <a
            href={getChartLinkUrl(activeBearStock.ticker)}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded text-xs font-mono font-bold uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-blue-300 border border-blue-500/30 flex items-center space-x-1.5 transition-all"
            title="Open Live ChartLink Breakdown"
          >
            <BarChart3 className="w-4 h-4 text-blue-400" />
            <span>ChartLink</span>
            <ExternalLink className="w-3 h-3 text-blue-400" />
          </a>

          {onViewChart && (
            <button
              type="button"
              onClick={() => onViewChart(activeBearStock)}
              className="px-4 py-2 rounded text-xs font-mono font-bold uppercase tracking-wider bg-rose-700 hover:bg-rose-600 text-white border border-rose-600 flex items-center space-x-1.5 shadow-sm transition-all cursor-pointer"
            >
              <TrendingDown className="w-4 h-4" />
              <span>Inspect Breakdown Chart</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. TWO-COLUMN LAYOUT: INVERSE BEARISH TREND TEMPLATE & SHORT TRADE PLAN */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* PANEL A: 8-RULE INVERSE BEARISH TREND TEMPLATE */}
        <div className={`border p-6 rounded-lg space-y-6 ${
          isObsidian ? 'bg-slate-900 border-slate-800' : 'bg-white border-[#e5e4e1]'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-rose-600/20 text-rose-400 rounded border border-rose-500/30">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-serif font-black tracking-tight">
                  Bearish Trend Template (Stage 4 Checklist)
                </h3>
                <p className="text-xs text-gray-500 font-sans">
                  Minervini &amp; Weinstein 8-rule inverse breakdown protocol
                </p>
              </div>
            </div>

            {/* Score Ring / Badge */}
            <div className="text-right font-mono">
              <span className="text-2xl font-black text-rose-500">
                {bearishEval.passedCount}/8
              </span>
              <span className="text-[10px] uppercase text-gray-400 block">
                {bearishEval.scorePercent}% Confirmed
              </span>
            </div>
          </div>

          {/* Breakdown Status Banner */}
          <div className={`p-3.5 rounded border text-xs font-mono flex items-start space-x-3 ${bearishEval.badgeBg} ${bearishEval.badgeBorder}`}>
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <div>
              <div className="font-bold uppercase tracking-wider text-rose-300">
                {bearishEval.convictionLabel}
              </div>
              <div className="text-gray-300 text-[11px] font-sans mt-1">
                {bearishEval.actionRecommendation}
              </div>
            </div>
          </div>

          {/* 8 Rules List */}
          <div className="space-y-2.5">
            {bearishEval.rules.map((rule) => (
              <div
                key={rule.id}
                className={`p-3 rounded border text-xs transition-all ${
                  rule.passed
                    ? isObsidian
                      ? 'bg-rose-950/20 border-rose-800/40'
                      : 'bg-rose-50/70 border-rose-200'
                    : isObsidian
                    ? 'bg-slate-950/40 border-slate-800/60 opacity-60'
                    : 'bg-gray-50 border-gray-200 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start space-x-2">
                    {rule.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <span className={`font-mono font-bold text-[11px] block ${
                        rule.passed ? 'text-rose-400' : 'text-gray-400'
                      }`}>
                        {rule.title}
                      </span>
                      <p className="text-[11px] text-gray-400 font-sans mt-0.5">
                        {rule.description}
                      </p>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 text-[9px] font-mono font-bold uppercase rounded border shrink-0 ${
                    rule.passed
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                      : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                  }`}>
                    {rule.passed ? 'PASSED' : 'NOT MET'}
                  </span>
                </div>

                <div className="mt-2 pt-2 border-t border-dashed border-gray-700/40 flex flex-wrap justify-between text-[10px] font-mono text-gray-400">
                  <span>Actual: <strong className="text-gray-200">{rule.actualValueStr}</strong></span>
                  <span>Required: <strong className="text-rose-400/90">{rule.requiredConditionStr}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PANEL B: SHORT TRADE EXECUTION & RISK CALCULATOR */}
        <div className={`border p-6 rounded-lg space-y-6 ${
          isObsidian ? 'bg-slate-900 border-slate-800' : 'bg-white border-[#e5e4e1]'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-amber-600/20 text-amber-400 rounded border border-amber-500/30">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-serif font-black tracking-tight">
                  Short Trade Plan &amp; Risk Calculator
                </h3>
                <p className="text-xs text-gray-500 font-sans">
                  Asymmetric downside risk-reward &amp; stop-cover levels
                </p>
              </div>
            </div>

            <span className="px-2.5 py-1 text-[10px] font-mono font-black uppercase rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
              R:R {shortTradePlan.riskRewardRatio} : 1
            </span>
          </div>

          {/* Pattern Classification */}
          <div className={`p-3 rounded border text-xs font-mono flex items-center justify-between ${
            isObsidian ? 'bg-slate-950/60 border-slate-800' : 'bg-[#fbfaf8] border-[#e5e4e1]'
          }`}>
            <span className="text-gray-400 uppercase text-[10px]">Short Setup Pattern:</span>
            <span className="font-bold text-rose-400">
              {shortTradePlan.patternLabel}
            </span>
          </div>

          {/* Execution Key Levels Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center font-mono">
            
            {/* Short Trigger */}
            <div className={`p-3 rounded border ${
              isObsidian ? 'bg-slate-950 border-slate-800' : 'bg-white border-gray-200'
            }`}>
              <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Short Pivot</span>
              <strong className="text-base font-black text-rose-500 block mt-0.5">
                {formatCurrency(shortTradePlan.breakdownTriggerPrice, currencySymbol)}
              </strong>
              <span className="text-[9px] text-gray-500">Breakdown trigger</span>
            </div>

            {/* Buy-to-Cover Stop */}
            <div className={`p-3 rounded border ${
              isObsidian ? 'bg-rose-950/30 border-rose-800/40' : 'bg-rose-50 border-rose-200'
            }`}>
              <span className="text-[10px] text-rose-400 uppercase tracking-wider block">Cover Stop</span>
              <strong className="text-base font-black text-rose-400 block mt-0.5">
                {formatCurrency(shortTradePlan.buyToCoverStopPrice, currencySymbol)}
              </strong>
              <span className="text-[9px] text-rose-400 font-bold">+{shortTradePlan.coverStopPercent}% Max Risk</span>
            </div>

            {/* Target 1 */}
            <div className={`p-3 rounded border ${
              isObsidian ? 'bg-emerald-950/30 border-emerald-800/40' : 'bg-emerald-50 border-emerald-200'
            }`}>
              <span className="text-[10px] text-emerald-400 uppercase tracking-wider block">Target 1 (-16%)</span>
              <strong className="text-base font-black text-emerald-400 block mt-0.5">
                {formatCurrency(shortTradePlan.downsideTarget1Price, currencySymbol)}
              </strong>
              <span className="text-[9px] text-emerald-400 font-bold">Cover 50%</span>
            </div>

            {/* Target 2 */}
            <div className={`p-3 rounded border ${
              isObsidian ? 'bg-emerald-950/30 border-emerald-800/40' : 'bg-emerald-50 border-emerald-200'
            }`}>
              <span className="text-[10px] text-emerald-400 uppercase tracking-wider block">Target 2 (-28%)</span>
              <strong className="text-base font-black text-emerald-400 block mt-0.5">
                {formatCurrency(shortTradePlan.downsideTarget2Price, currencySymbol)}
              </strong>
              <span className="text-[9px] text-emerald-400 font-bold">Capitulation</span>
            </div>
          </div>

          {/* Short Tactical Execution Advice */}
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-300 font-mono leading-relaxed">
            <span className="font-bold text-amber-400 block mb-0.5">Tactical Execution:</span>
            {shortTradePlan.shortTactics}
          </div>

          {/* Position Sizing Interactive Inputs */}
          <div className={`p-4 rounded border space-y-4 ${
            isObsidian ? 'bg-slate-950/70 border-slate-800' : 'bg-[#fbfaf8] border-[#e5e4e1]'
          }`}>
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-gray-400 block">
              Short Position Sizing &amp; Risk Guard
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
              <div>
                <label className="text-gray-400 block mb-1">Account Equity ({currencySymbol})</label>
                <input
                  type="number"
                  value={accountCapital}
                  onChange={(e) => setAccountCapital(Math.max(1000, Number(e.target.value)))}
                  className={`w-full p-2 rounded border font-bold ${
                    isObsidian ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-gray-300'
                  }`}
                />
              </div>

              <div>
                <label className="text-gray-400 block mb-1">Max Risk per Short (% of Equity)</label>
                <div className="flex items-center space-x-2">
                  {[0.5, 1.0, 1.5, 2.0].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRiskPercent(r)}
                      className={`px-2.5 py-1.5 rounded text-xs font-bold transition-all ${
                        riskPercent === r
                          ? 'bg-rose-600 text-white shadow-xs'
                          : isObsidian
                          ? 'bg-slate-900 text-gray-400 hover:text-white border border-slate-700'
                          : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                      }`}
                    >
                      {r}%
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Computed Sizing Results */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-gray-700/40 text-center font-mono">
              <div>
                <span className="text-[10px] text-gray-400 uppercase block">Max Short Shares</span>
                <strong className="text-lg font-black text-rose-400 block">
                  {positionSize.sharesToShort.toLocaleString()}
                </strong>
              </div>

              <div>
                <span className="text-[10px] text-gray-400 uppercase block">Total Exposure</span>
                <strong className="text-base font-bold text-gray-200 block">
                  {formatCurrency(positionSize.totalShortExposureDollars, currencySymbol)}
                </strong>
                <span className="text-[9px] text-gray-400">({positionSize.portfolioAllocationPercent}% port)</span>
              </div>

              <div>
                <span className="text-[10px] text-gray-400 uppercase block">1R Capital at Risk</span>
                <strong className="text-base font-bold text-rose-500 block">
                  {formatCurrency(positionSize.maxCapitalRiskDollars, currencySymbol)}
                </strong>
                <span className="text-[9px] text-gray-400">Hard stop loss</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. BEARISH SCREENER TABLE */}
      <div className={`border rounded-lg overflow-hidden shadow-sm ${
        isObsidian ? 'bg-slate-900 border-slate-800' : 'bg-white border-[#e5e4e1]'
      }`}>
        <div className={`p-4 sm:p-6 border-b flex flex-col md:flex-row md:items-center justify-between gap-4 ${
          isObsidian ? 'border-slate-800 bg-slate-950/40' : 'border-[#e5e4e1] bg-[#fbfaf8]'
        }`}>
          <div>
            <h3 className="text-base font-serif font-black tracking-tight flex items-center space-x-2">
              <TrendingDown className="w-5 h-5 text-rose-500" />
              <span>Bearish Setups &amp; Stage 4 Short Screener</span>
            </h3>
            <p className="text-xs text-gray-500 font-sans">
              Screening {filteredBearishStocks.length} vulnerable stocks in distribution or markdown stages
            </p>
          </div>

          {/* Screener Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search ticker, name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`pl-8 pr-3 py-1.5 rounded text-xs font-mono border focus:outline-none ${
                  isObsidian
                    ? 'bg-slate-900 border-slate-700 text-white placeholder-gray-500'
                    : 'bg-white border-gray-300 text-black placeholder-gray-400'
                }`}
              />
            </div>

            {/* Pattern Filter */}
            <select
              value={patternFilter}
              onChange={(e) => setPatternFilter(e.target.value as any)}
              className={`py-1.5 px-3 rounded text-xs font-mono border focus:outline-none ${
                isObsidian ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-gray-300 text-black'
              }`}
            >
              <option value="ALL">All Short Patterns</option>
              <option value="LOW_CHEAT_BREAKDOWN">Low Cheat Breakdown</option>
              <option value="HEAD_AND_SHOULDERS_TOP">Head &amp; Shoulders Top</option>
              <option value="DEATH_CROSS_ROLLOVER">Death Cross Rollover</option>
              <option value="STAGE_4_CAPITULATION">Stage 4 Capitulation</option>
            </select>

            {/* Exchange Filter */}
            <select
              value={exchangeFilter}
              onChange={(e) => setExchangeFilter(e.target.value as any)}
              className={`py-1.5 px-3 rounded text-xs font-mono border focus:outline-none ${
                isObsidian ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-gray-300 text-black'
              }`}
            >
              <option value="ALL">All Exchanges</option>
              <option value="NSE">NSE (India)</option>
              <option value="NASDAQ">NASDAQ (US)</option>
              <option value="NYSE">NYSE (US)</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className={`text-[10px] uppercase tracking-wider font-semibold border-b ${
              isObsidian ? 'bg-slate-950 text-gray-400 border-slate-800' : 'bg-gray-50 text-gray-600 border-gray-200'
            }`}>
              <tr>
                <th className="py-3 px-4">Stock</th>
                <th className="py-3 px-4">Exchange</th>
                <th className="py-3 px-4">Price</th>
                <th className="py-3 px-4">Change</th>
                <th className="py-3 px-4">RS Weakness</th>
                <th className="py-3 px-4">Short Pattern</th>
                <th className="py-3 px-4">Short Trigger</th>
                <th className="py-3 px-4">Cover Stop</th>
                <th className="py-3 px-4">Target 1 (-16%)</th>
                <th className="py-3 px-4">R:R</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isObsidian ? 'divide-slate-800' : 'divide-gray-100'}`}>
              {filteredBearishStocks.map((stock) => {
                const plan = calculateShortTradePlan(stock);
                const isSelected = stock.ticker === activeBearStock.ticker;
                const sym = getCurrencySymbol(stock);

                return (
                  <tr
                    key={stock.ticker}
                    onClick={() => handleSelectStock(stock)}
                    className={`transition-colors cursor-pointer ${
                      isSelected
                        ? isObsidian
                          ? 'bg-rose-950/40 border-l-4 border-l-rose-500'
                          : 'bg-rose-50 border-l-4 border-l-rose-600'
                        : isObsidian
                        ? 'hover:bg-slate-800/60'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm text-rose-400">{stock.ticker}</span>
                        <span className="text-[10px] text-gray-500 truncate max-w-[120px] font-sans">
                          {stock.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-400">
                      <span className="px-1.5 py-0.5 text-[9px] rounded bg-slate-800 text-gray-300 border border-slate-700">
                        {stock.exchange}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-gray-200">
                      {formatCurrency(stock.currentPrice, sym)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-rose-500 font-bold">
                        {stock.changePercent}%
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
                        RS {stock.rsRating}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-300 font-sans text-[11px]">
                      {plan.patternLabel}
                    </td>
                    <td className="py-3 px-4 font-bold text-rose-400">
                      {formatCurrency(plan.breakdownTriggerPrice, sym)}
                    </td>
                    <td className="py-3 px-4 text-rose-300 font-mono">
                      {formatCurrency(plan.buyToCoverStopPrice, sym)}
                    </td>
                    <td className="py-3 px-4 text-emerald-400 font-bold">
                      {formatCurrency(plan.downsideTarget1Price, sym)}
                    </td>
                    <td className="py-3 px-4 font-bold text-amber-400">
                      {plan.riskRewardRatio}:1
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectStock(stock);
                          if (onViewChart) onViewChart(stock);
                        }}
                        className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase rounded bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-xs"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. MINERVINI BEAR MARKET PLAYBOOK (CARDINAL RULES) */}
      <div className={`border p-6 rounded-lg space-y-4 ${
        isObsidian ? 'bg-slate-900 border-slate-800' : 'bg-white border-[#e5e4e1]'
      }`}>
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-rose-600/20 text-rose-400 rounded border border-rose-500/30">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-serif font-black tracking-tight">
              Mark Minervini Bear Market Playbook &amp; Capital Defense
            </h3>
            <p className="text-xs text-gray-500 font-sans">
              Timeless survival rules for managing risk when market breadth collapses
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono pt-2">
          
          <div className={`p-4 rounded border ${
            isObsidian ? 'bg-slate-950/60 border-slate-800' : 'bg-[#fbfaf8] border-gray-200'
          }`}>
            <span className="font-bold text-rose-400 block mb-1">Rule 1: Cash is an Active Position</span>
            <p className="text-gray-400 font-sans text-[11px] leading-relaxed">
              In a bear market, sitting in 70%–100% cash is not being passive — it is an active decision that protects your psychological capital and ensures 100% purchasing power when the new bull cycle emerges.
            </p>
          </div>

          <div className={`p-4 rounded border ${
            isObsidian ? 'bg-slate-950/60 border-slate-800' : 'bg-[#fbfaf8] border-gray-200'
          }`}>
            <span className="font-bold text-amber-400 block mb-1">Rule 2: Never Average Down</span>
            <p className="text-gray-400 font-sans text-[11px] leading-relaxed">
              Amateurs buy more shares of declining stocks because they "look cheap." Minervini rule: Stage 4 stocks can drop 80% to 90% and take years to recover. Cut losses immediately at 4%–7% without hesitation.
            </p>
          </div>

          <div className={`p-4 rounded border ${
            isObsidian ? 'bg-slate-950/60 border-slate-800' : 'bg-[#fbfaf8] border-gray-200'
          }`}>
            <span className="font-bold text-emerald-400 block mb-1">Rule 3: Shorting is Fast &amp; Violent</span>
            <p className="text-gray-400 font-sans text-[11px] leading-relaxed">
              Downside moves happen 3x faster than bull trends, but bear market rallies are sharp and vicious. When shorting, lock in 50% partial gains at +15% to +20% and trail cover stops tightly.
            </p>
          </div>

        </div>
      </div>

    </div>
  );
};
