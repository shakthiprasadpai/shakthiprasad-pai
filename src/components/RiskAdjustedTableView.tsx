import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MinerviniTradeSetup } from '../types';
import {
  calculateRiskAdjustedMetrics,
  formatCurrency,
  getCurrencySymbol,
  RiskAdjustedMetrics,
} from '../utils/sepaCalculator';
import { generateSepaPdfReport, exportRiskAdjustedScreenerPdf } from '../utils/pdfExporter';
import { exportDetailedTradeParametersToCsv } from '../utils/csvExport';
import {
  ShieldAlert,
  ShieldCheck,
  Target,
  FileText,
  Download,
  TrendingUp,
  Award,
  Zap,
  SlidersHorizontal,
  ChevronRight,
  Info,
  DollarSign,
  Layers,
  Sparkles,
  ArrowUpRight,
  Calculator,
  RefreshCw,
  Search,
  CheckCircle2,
} from 'lucide-react';

interface RiskAdjustedTableViewProps {
  stocks: MinerviniTradeSetup[];
  selectedTicker: string;
  onSelectStock: (stock: MinerviniTradeSetup) => void;
  onViewChart: (stock: MinerviniTradeSetup) => void;
}

export type RiskSortKey = 'EXPECTANCY' | 'RR_RATIO' | 'ALPHA_SCORE' | 'TIGHTEST_STOP' | 'WIN_RATE' | 'PRICE';

export const RiskAdjustedTableView: React.FC<RiskAdjustedTableViewProps> = ({
  stocks,
  selectedTicker,
  onSelectStock,
  onViewChart,
}) => {
  // Sizing controls
  const [accountCapital, setAccountCapital] = useState<number>(100000);
  const [riskPercent, setRiskPercent] = useState<number>(1.0);
  
  // Filtering & Sorting
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [tierFilter, setTierFilter] = useState<'ALL' | 'CHAMPION' | 'SEPA_STANDARD' | 'ACCEPTABLE'>('ALL');
  const [maxRiskFilter, setMaxRiskFilter] = useState<'ALL' | 'TIGHT_4' | 'NORMAL_6' | 'MAX_8'>('ALL');
  const [sortKey, setSortKey] = useState<RiskSortKey>('EXPECTANCY');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);

  // Compute metrics for all stocks
  const enrichedStocks = useMemo(() => {
    return stocks.map((s) => {
      const metrics = calculateRiskAdjustedMetrics(s);
      const sizing = metrics.recommendedPosition(accountCapital, riskPercent);
      const currency = getCurrencySymbol(s.exchange);
      return { stock: s, metrics, sizing, currency };
    });
  }, [stocks, accountCapital, riskPercent]);

  // Aggregate high-level statistics
  const stats = useMemo(() => {
    if (enrichedStocks.length === 0) {
      return { topRR: null, topExpectancy: null, tightestStop: null, avgRR: 0, avgRiskPct: 0 };
    }
    const sortedByRR = [...enrichedStocks].sort((a, b) => b.metrics.riskRewardRatio - a.metrics.riskRewardRatio);
    const sortedByExp = [...enrichedStocks].sort((a, b) => b.metrics.expectancyR - a.metrics.expectancyR);
    const sortedByStop = [...enrichedStocks].sort((a, b) => a.metrics.riskPct - b.metrics.riskPct);

    const totalRR = enrichedStocks.reduce((sum, item) => sum + item.metrics.riskRewardRatio, 0);
    const totalRisk = enrichedStocks.reduce((sum, item) => sum + item.metrics.riskPct, 0);

    return {
      topRR: sortedByRR[0],
      topExpectancy: sortedByExp[0],
      tightestStop: sortedByStop[0],
      avgRR: (totalRR / enrichedStocks.length).toFixed(2),
      avgRiskPct: (totalRisk / enrichedStocks.length).toFixed(1),
    };
  }, [enrichedStocks]);

  // Filter and Sort
  const filteredAndSorted = useMemo(() => {
    return enrichedStocks
      .filter(({ stock, metrics }) => {
        // Search filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTicker = stock.ticker.toLowerCase().includes(q);
          const matchName = stock.name.toLowerCase().includes(q);
          const matchSector = (stock.sector || '').toLowerCase().includes(q);
          if (!matchTicker && !matchName && !matchSector) return false;
        }

        // Tier filter
        if (tierFilter === 'CHAMPION' && metrics.riskTier !== 'CHAMPION_ASYMMETRIC') return false;
        if (tierFilter === 'SEPA_STANDARD' && metrics.riskTier !== 'SEPA_STANDARD' && metrics.riskTier !== 'CHAMPION_ASYMMETRIC') return false;
        if (tierFilter === 'ACCEPTABLE' && metrics.riskRewardRatio < 2.0) return false;

        // Max Risk Filter
        if (maxRiskFilter === 'TIGHT_4' && metrics.riskPct > 4.5) return false;
        if (maxRiskFilter === 'NORMAL_6' && metrics.riskPct > 6.5) return false;
        if (maxRiskFilter === 'MAX_8' && metrics.riskPct > 8.0) return false;

        return true;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortKey === 'EXPECTANCY') diff = b.metrics.expectancyR - a.metrics.expectancyR;
        else if (sortKey === 'RR_RATIO') diff = b.metrics.riskRewardRatio - a.metrics.riskRewardRatio;
        else if (sortKey === 'ALPHA_SCORE') diff = b.metrics.riskQualityScore - a.metrics.riskQualityScore;
        else if (sortKey === 'TIGHTEST_STOP') diff = a.metrics.riskPct - b.metrics.riskPct;
        else if (sortKey === 'WIN_RATE') diff = b.metrics.breakoutScore - a.metrics.breakoutScore;
        else if (sortKey === 'PRICE') diff = b.stock.currentPrice - a.stock.currentPrice;

        return sortOrder === 'desc' ? diff : -diff;
      });
  }, [enrichedStocks, searchQuery, tierFilter, maxRiskFilter, sortKey, sortOrder]);

  const handleExportFullScreenerPdf = () => {
    const listToExport = filteredAndSorted.map((item) => item.stock);
    exportRiskAdjustedScreenerPdf(listToExport, {
      accountCapital,
      riskPercent,
      filterName: tierFilter === 'ALL' ? 'All SEPA Setups' : `${tierFilter} Setups`,
      currency: enrichedStocks[0]?.currency || '$',
    });
  };

  const handleExportSingleStockPdf = (stock: MinerviniTradeSetup, currency: string) => {
    generateSepaPdfReport(stock, {
      accountCapital,
      riskPercent,
      currency,
    });
  };

  return (
    <div className="space-y-4 font-mono">
      {/* ------------------------------------------------------------------------- */}
      {/* 1. Header Toolbar & Sizing Settings */}
      {/* ------------------------------------------------------------------------- */}
      <div className="bg-white border-2 border-[#1a1a1a] p-4 shadow-sm space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[#e5e4e1] pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-[#1a1a1a] text-white">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#1a1a1a]">
                  Risk-Adjusted Trade Setup Matrix
                </h3>
                <span className="bg-purple-100 text-purple-900 border border-purple-300 text-[10px] font-bold px-2 py-0.5 uppercase">
                  Asymmetric Alpha Model
                </span>
              </div>
              <p className="text-[11px] text-gray-500 font-sans mt-0.5">
                Evaluates Reward-to-Risk asymmetry, mathematical expectancy (+EV), tight invalidation stops, and disciplined capital allocation.
              </p>
            </div>
          </div>

          {/* Quick PDF and CSV Export buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportFullScreenerPdf}
              className="bg-[#1a1a1a] hover:bg-black text-amber-400 border border-black px-3.5 py-1.5 text-xs font-bold uppercase flex items-center space-x-1.5 shadow-2xs transition-all cursor-pointer"
              title="Generate a multi-page printable Risk-Adjusted PDF Report"
            >
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              <span>Export Screener to PDF</span>
            </button>

            <button
              onClick={() => exportDetailedTradeParametersToCsv(stocks)}
              className="bg-white hover:bg-gray-50 text-gray-800 border border-[#d5d4d0] px-3 py-1.5 text-xs font-bold uppercase flex items-center space-x-1.5 shadow-2xs transition-all cursor-pointer"
              title="Export complete mathematical risk metrics to CSV"
            >
              <Download className="w-3.5 h-3.5 text-gray-600" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* ------------------------------------------------------------------------- */}
        {/* Sizing & Capital Controls Bar */}
        {/* ------------------------------------------------------------------------- */}
        <div className="bg-[#f9f8f5] border border-[#e5e4e1] p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <span className="text-gray-500 font-bold uppercase tracking-wider text-[10px] flex items-center space-x-1">
                <DollarSign className="w-3 h-3 text-emerald-600" />
                <span>Account Capital:</span>
              </span>
              <div className="relative">
                <input
                  type="number"
                  min={1000}
                  step={5000}
                  value={accountCapital}
                  onChange={(e) => setAccountCapital(Math.max(1000, Number(e.target.value) || 1000))}
                  className="w-28 bg-white border border-[#d5d4d0] px-2 py-1 text-xs font-bold text-gray-900 focus:outline-none focus:border-black"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-gray-500 font-bold uppercase tracking-wider text-[10px] flex items-center space-x-1">
                <ShieldAlert className="w-3 h-3 text-rose-600" />
                <span>Risk Budget / Trade:</span>
              </span>
              <div className="flex items-center space-x-1">
                {[0.5, 1.0, 1.5, 2.0].map((r) => (
                  <button
                    key={r}
                    onClick={() => setRiskPercent(r)}
                    className={`px-2 py-0.5 text-[10px] font-bold border transition-all cursor-pointer ${
                      riskPercent === r
                        ? 'bg-black text-amber-400 border-black'
                        : 'bg-white text-gray-700 border-[#d5d4d0] hover:bg-gray-100'
                    }`}
                  >
                    {r}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="text-[11px] text-gray-600 font-sans">
            Max Dollar Risk per Setup (1R):{' '}
            <strong className="text-rose-700 font-mono font-bold">
              {formatCurrency(accountCapital * (riskPercent / 100), enrichedStocks[0]?.currency || '$')}
            </strong>
          </div>
        </div>

        {/* ------------------------------------------------------------------------- */}
        {/* Top 4 KPI Summary Cards */}
        {/* ------------------------------------------------------------------------- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Top Asymmetry */}
          <div className="bg-white border border-[#e5e4e1] p-2.5 shadow-2xs">
            <div className="text-[10px] font-bold uppercase text-gray-500 flex items-center justify-between">
              <span>Top Asymmetric Setup</span>
              <Award className="w-3 h-3 text-purple-600" />
            </div>
            {stats.topRR ? (
              <div className="mt-1">
                <div className="flex items-baseline justify-between">
                  <span className="font-bold text-sm text-gray-900">{stats.topRR.stock.ticker}</span>
                  <span className="text-xs font-black text-purple-700 font-mono">
                    {stats.topRR.metrics.riskRewardRatio.toFixed(2)} : 1
                  </span>
                </div>
                <div className="text-[10px] text-gray-500 truncate">
                  Stop: -{stats.topRR.metrics.riskPct.toFixed(1)}% • EV: +{stats.topRR.metrics.expectancyR.toFixed(2)}R
                </div>
              </div>
            ) : (
              <div className="text-xs text-gray-400 mt-1">No data</div>
            )}
          </div>

          {/* Highest Expectancy */}
          <div className="bg-white border border-[#e5e4e1] p-2.5 shadow-2xs">
            <div className="text-[10px] font-bold uppercase text-gray-500 flex items-center justify-between">
              <span>Highest Expectancy (+EV)</span>
              <Sparkles className="w-3 h-3 text-emerald-600" />
            </div>
            {stats.topExpectancy ? (
              <div className="mt-1">
                <div className="flex items-baseline justify-between">
                  <span className="font-bold text-sm text-gray-900">{stats.topExpectancy.stock.ticker}</span>
                  <span className="text-xs font-black text-emerald-700 font-mono">
                    +{stats.topExpectancy.metrics.expectancyR.toFixed(2)} R
                  </span>
                </div>
                <div className="text-[10px] text-gray-500 truncate">
                  Win Prob: {stats.topExpectancy.metrics.breakoutScore}% ({stats.topExpectancy.metrics.breakoutRating})
                </div>
              </div>
            ) : (
              <div className="text-xs text-gray-400 mt-1">No data</div>
            )}
          </div>

          {/* Tightest Stop Loss */}
          <div className="bg-white border border-[#e5e4e1] p-2.5 shadow-2xs">
            <div className="text-[10px] font-bold uppercase text-gray-500 flex items-center justify-between">
              <span>Tightest Stop Invalidation</span>
              <ShieldAlert className="w-3 h-3 text-blue-600" />
            </div>
            {stats.tightestStop ? (
              <div className="mt-1">
                <div className="flex items-baseline justify-between">
                  <span className="font-bold text-sm text-gray-900">{stats.tightestStop.stock.ticker}</span>
                  <span className="text-xs font-black text-blue-700 font-mono">
                    -{stats.tightestStop.metrics.riskPct.toFixed(1)}%
                  </span>
                </div>
                <div className="text-[10px] text-gray-500 truncate">
                  Stop Price: {formatCurrency(stats.tightestStop.metrics.stopLossPrice, stats.tightestStop.currency)}
                </div>
              </div>
            ) : (
              <div className="text-xs text-gray-400 mt-1">No data</div>
            )}
          </div>

          {/* Screener Averages */}
          <div className="bg-white border border-[#e5e4e1] p-2.5 shadow-2xs">
            <div className="text-[10px] font-bold uppercase text-gray-500 flex items-center justify-between">
              <span>Screener Risk Averages</span>
              <Calculator className="w-3 h-3 text-amber-600" />
            </div>
            <div className="mt-1">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-bold text-gray-700">Avg R:R / Stop</span>
                <span className="text-xs font-black text-amber-700 font-mono">
                  {stats.avgRR}:1 / -{stats.avgRiskPct}%
                </span>
              </div>
              <div className="text-[10px] text-gray-500">
                {enrichedStocks.length} Setups Analyzed
              </div>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------------------- */}
        {/* Search, Filter & Sorting Bar */}
        {/* ------------------------------------------------------------------------- */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pt-1">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search ticker, company or sector..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#f9f8f5] border border-[#d5d4d0] hover:border-gray-400 focus:border-black pl-8 pr-3 py-1.5 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none transition-colors"
            />
          </div>

          {/* Tier Filters */}
          <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
            <span className="text-gray-500 font-bold uppercase mr-1">R:R Tier:</span>
            {[
              { id: 'ALL', label: 'All' },
              { id: 'CHAMPION', label: '🚀 Champion (5:1+)' },
              { id: 'SEPA_STANDARD', label: '🟢 SEPA (3:1+)' },
              { id: 'ACCEPTABLE', label: '🟡 2:1+' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTierFilter(t.id as any)}
                className={`px-2 py-1 font-bold uppercase border transition-all cursor-pointer ${
                  tierFilter === t.id
                    ? 'bg-black text-amber-400 border-black'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Max Risk Filter */}
          <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
            <span className="text-gray-500 font-bold uppercase mr-1">Max Stop:</span>
            {[
              { id: 'ALL', label: 'Any Stop' },
              { id: 'TIGHT_4', label: '≤ 4.5% Tight' },
              { id: 'NORMAL_6', label: '≤ 6.5%' },
              { id: 'MAX_8', label: '≤ 8.0%' },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setMaxRiskFilter(m.id as any)}
                className={`px-2 py-1 font-bold uppercase border transition-all cursor-pointer ${
                  maxRiskFilter === m.id
                    ? 'bg-blue-900 text-white border-blue-900'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------------- */}
      {/* 2. Master Risk-Adjusted Table */}
      {/* ------------------------------------------------------------------------- */}
      <div className="bg-white border-2 border-[#1a1a1a] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#1a1a1a] text-white uppercase text-[10px] tracking-wider select-none">
                <th className="p-3 border-r border-[#333]">Stock / Setup</th>
                <th
                  onClick={() => {
                    if (sortKey === 'PRICE') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    else { setSortKey('PRICE'); setSortOrder('desc'); }
                  }}
                  className="p-3 border-r border-[#333] cursor-pointer hover:bg-neutral-800 text-right"
                >
                  Price & Pivot {sortKey === 'PRICE' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
                <th
                  onClick={() => {
                    if (sortKey === 'TIGHTEST_STOP') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    else { setSortKey('TIGHTEST_STOP'); setSortOrder('asc'); }
                  }}
                  className="p-3 border-r border-[#333] cursor-pointer hover:bg-neutral-800 text-right"
                >
                  Stop & Risk % {sortKey === 'TIGHTEST_STOP' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
                <th className="p-3 border-r border-[#333] text-right">Targets (T1 / T2)</th>
                <th
                  onClick={() => {
                    if (sortKey === 'RR_RATIO') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    else { setSortKey('RR_RATIO'); setSortOrder('desc'); }
                  }}
                  className="p-3 border-r border-[#333] cursor-pointer hover:bg-neutral-800 text-center"
                >
                  R:R Ratio {sortKey === 'RR_RATIO' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
                <th
                  onClick={() => {
                    if (sortKey === 'EXPECTANCY') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    else { setSortKey('EXPECTANCY'); setSortOrder('desc'); }
                  }}
                  className="p-3 border-r border-[#333] cursor-pointer hover:bg-neutral-800 text-right"
                >
                  Expectancy (+R) {sortKey === 'EXPECTANCY' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
                <th className="p-3 border-r border-[#333] text-right">Position Sizing</th>
                <th
                  onClick={() => {
                    if (sortKey === 'ALPHA_SCORE') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    else { setSortKey('ALPHA_SCORE'); setSortOrder('desc'); }
                  }}
                  className="p-3 border-r border-[#333] cursor-pointer hover:bg-neutral-800 text-center"
                >
                  Alpha Score {sortKey === 'ALPHA_SCORE' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
                <th className="p-3 text-center">PDF & Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e4e1]">
              {filteredAndSorted.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-gray-500 font-sans">
                    No setups match the active risk filters. Try loosening your criteria.
                  </td>
                </tr>
              ) : (
                filteredAndSorted.map(({ stock, metrics, sizing, currency }) => {
                  const isSelected = selectedTicker === stock.ticker;
                  const isChamp = metrics.riskRewardRatio >= 5.0;
                  const isStandard = metrics.riskRewardRatio >= 3.0 && metrics.riskRewardRatio < 5.0;

                  return (
                    <tr
                      key={stock.ticker}
                      onClick={() => onSelectStock(stock)}
                      className={`hover:bg-amber-50/60 transition-colors cursor-pointer ${
                        isSelected ? 'bg-amber-100/70 border-l-4 border-l-black' : ''
                      }`}
                    >
                      {/* Stock / Setup */}
                      <td className="p-3 border-r border-[#e5e4e1]">
                        <div className="flex items-center space-x-2">
                          <div>
                            <div className="flex items-center space-x-1.5">
                              <span className="font-bold text-sm text-gray-900">{stock.ticker}</span>
                              <span className="text-[10px] text-gray-500">({stock.exchange})</span>
                              {stock.isTightVolume && (
                                <span className="bg-emerald-100 text-emerald-950 text-[9px] font-bold px-1 rounded-2xs border border-emerald-300">
                                  TIGHT
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-gray-500 truncate max-w-[140px] font-sans">
                              {stock.name}
                            </div>
                            <div className="text-[9px] text-gray-400 mt-0.5">
                              {stock.vcpStage} • RS {stock.rsRating}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Price & Pivot */}
                      <td className="p-3 border-r border-[#e5e4e1] text-right font-mono">
                        <div className="font-bold text-gray-900">{formatCurrency(stock.currentPrice, currency)}</div>
                        <div className="text-[11px] text-emerald-700 font-bold mt-0.5">
                          Pivot: {formatCurrency(stock.pivotPrice, currency)}
                        </div>
                        <div className="text-[9px] text-gray-400">
                          Max Buy: {formatCurrency(stock.buyZoneMax || stock.pivotPrice * 1.02, currency)}
                        </div>
                      </td>

                      {/* Stop & Risk % */}
                      <td className="p-3 border-r border-[#e5e4e1] text-right font-mono">
                        <div className="font-bold text-rose-700">
                          {formatCurrency(stock.stopLossPrice, currency)}
                        </div>
                        <div className={`text-[11px] font-bold mt-0.5 ${
                          metrics.riskPct <= 4.5 ? 'text-emerald-600' : metrics.riskPct <= 6.5 ? 'text-amber-600' : 'text-rose-600'
                        }`}>
                          -{metrics.riskPct.toFixed(1)}% Risk
                        </div>
                        <div className="text-[9px] text-gray-400">
                          ATR: {metrics.dailyAtrPct.toFixed(1)}%
                        </div>
                      </td>

                      {/* Targets */}
                      <td className="p-3 border-r border-[#e5e4e1] text-right font-mono">
                        <div className="font-bold text-purple-700">
                          T1: {formatCurrency(stock.target1Price, currency)}
                          <span className="text-[10px] text-purple-600 ml-1">(+{metrics.rewardPct.toFixed(0)}%)</span>
                        </div>
                        <div className="text-[10px] text-gray-600 mt-0.5">
                          T2: {formatCurrency(stock.target2Price, currency)}
                        </div>
                      </td>

                      {/* R:R Ratio Badge */}
                      <td className="p-3 border-r border-[#e5e4e1] text-center font-mono">
                        <div className={`inline-block px-2 py-1 text-xs font-black border ${
                          isChamp
                            ? 'bg-purple-100 text-purple-950 border-purple-300'
                            : isStandard
                            ? 'bg-emerald-100 text-emerald-950 border-emerald-300'
                            : metrics.riskRewardRatio >= 2.0
                            ? 'bg-amber-100 text-amber-950 border-amber-300'
                            : 'bg-rose-100 text-rose-950 border-rose-300'
                        }`}>
                          {metrics.riskRewardRatio.toFixed(2)} : 1
                        </div>
                        <div className="text-[9px] text-gray-500 mt-1 uppercase font-sans font-bold">
                          {isChamp ? '🚀 Champion' : isStandard ? '🟢 SEPA Std' : metrics.riskRewardRatio >= 2 ? '🟡 Minimum' : '🔴 Subpar'}
                        </div>
                      </td>

                      {/* Expectancy */}
                      <td className="p-3 border-r border-[#e5e4e1] text-right font-mono">
                        <div className={`font-black text-sm ${
                          metrics.expectancyR >= 2.0 ? 'text-emerald-700' : metrics.expectancyR >= 1.0 ? 'text-blue-700' : 'text-amber-700'
                        }`}>
                          +{metrics.expectancyR.toFixed(2)} R
                        </div>
                        <div className="text-[10px] text-gray-500 mt-0.5">
                          Win: {metrics.breakoutScore}%
                        </div>
                      </td>

                      {/* Position Sizing */}
                      <td className="p-3 border-r border-[#e5e4e1] text-right font-mono">
                        <div className="font-bold text-gray-900">
                          {sizing.shareQuantity.toLocaleString()} Shares
                        </div>
                        <div className="text-[10px] text-gray-600 mt-0.5">
                          {formatCurrency(sizing.totalPositionCost, currency)}
                        </div>
                        <div className="text-[9px] text-gray-400">
                          {sizing.portfolioAllocationPercent.toFixed(1)}% Weight
                        </div>
                      </td>

                      {/* Alpha Score */}
                      <td className="p-3 border-r border-[#e5e4e1] text-center font-mono">
                        <div className="flex items-center justify-center space-x-1">
                          <span className="font-black text-sm text-gray-900">{metrics.riskQualityScore}</span>
                          <span className="text-[10px] text-gray-400">/100</span>
                        </div>
                        <div className="w-16 h-1.5 bg-gray-200 mx-auto mt-1 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              metrics.riskQualityScore >= 80 ? 'bg-emerald-600' : metrics.riskQualityScore >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                            }`}
                            style={{ width: `${metrics.riskQualityScore}%` }}
                          />
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="p-3 text-center font-mono" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center space-x-1.5">
                          {/* Single Stock PDF Dossier */}
                          <button
                            onClick={() => handleExportSingleStockPdf(stock, currency)}
                            title={`Export ${stock.ticker} Risk-Adjusted Dossier (PDF)`}
                            className="p-1.5 bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 rounded-xs cursor-pointer transition-colors shadow-2xs"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>

                          {/* View Chart */}
                          <button
                            onClick={() => onViewChart(stock)}
                            title={`Open Interactive Chart for ${stock.ticker}`}
                            className="p-1.5 bg-gray-100 hover:bg-black hover:text-white text-gray-700 border border-gray-300 rounded-xs cursor-pointer transition-colors"
                          >
                            <TrendingUp className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer with Summary Notes */}
        <div className="bg-[#f9f8f5] border-t border-[#e5e4e1] p-3 text-[11px] text-gray-600 flex flex-col md:flex-row md:items-center justify-between gap-2 font-sans">
          <div className="flex items-center space-x-2">
            <Info className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Mathematical Expectancy (+R)</strong> calculates the expected statistical gain per trade relative to a 1R risk unit: <code className="bg-gray-100 px-1 font-mono text-[10px]">EV = (Win% × R:R) - (Loss% × 1.0)</code>.
            </span>
          </div>
          <div className="text-gray-500 font-mono text-[10px] shrink-0">
            Showing {filteredAndSorted.length} of {stocks.length} SEPA Trade Setups
          </div>
        </div>
      </div>
    </div>
  );
};
