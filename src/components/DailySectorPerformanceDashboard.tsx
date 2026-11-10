import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MinerviniTradeSetup } from '../types';
import { formatCurrency, getCurrencySymbol } from '../utils/sepaCalculator';
import {
  TrendingUp,
  TrendingDown,
  Layers,
  Zap,
  Target,
  ShieldCheck,
  Award,
  Sparkles,
  Filter,
  Search,
  ArrowUpRight,
  ArrowUpDown,
  BarChart2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
  Download,
  CheckCircle2,
  Activity,
  Flame,
  Building2,
  Play,
  Briefcase,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

export interface DailySectorPerformanceDashboardProps {
  stocks: MinerviniTradeSetup[];
  onSelectStock: (stock: MinerviniTradeSetup) => void;
  onViewChart: (stock: MinerviniTradeSetup) => void;
  onFilterBySector: (sectorName: string) => void;
  onNavigateToFivePaisa?: (stock?: MinerviniTradeSetup) => void;
  isObsidian?: boolean;
}

export interface SectorVcpPerformanceMetric {
  sector: string;
  totalStocks: number;
  avgRsRating: number;
  rsRank: number;
  vcpCount: number;
  vcpDensityPct: number;
  vcpStocks: MinerviniTradeSetup[];
  allStocks: MinerviniTradeSetup[];
  avgChangePercent: number;
  avgVolumeDryUp: number;
  stage2Count: number;
  stage2Ratio: number;
  tightestContractionDepth: number;
  topLeaderStock: MinerviniTradeSetup;
  dailyScanPriority: 'PRIORITY_1' | 'PRIORITY_2' | 'PRIORITY_3' | 'PRIORITY_4';
  priorityLabel: string;
  priorityBadgeBg: string;
  priorityBadgeText: string;
  priorityReason: string;
}

export const DailySectorPerformanceDashboard: React.FC<DailySectorPerformanceDashboardProps> = ({
  stocks,
  onSelectStock,
  onViewChart,
  onFilterBySector,
  onNavigateToFivePaisa,
  isObsidian = true,
}) => {
  const [sortKey, setSortKey] = useState<'RS_RATING' | 'VCP_COUNT' | 'PRIORITY' | 'DAY_CHANGE'>('RS_RATING');
  const [minVcpFilter, setMinVcpFilter] = useState<'ALL' | 'MIN_1' | 'MIN_2'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedSector, setExpandedSector] = useState<string | null>(null);
  const [exportNotice, setExportNotice] = useState<boolean>(false);

  // Compute sector aggregates with RS ranking and VCP analysis
  const sectorMetrics = useMemo<SectorVcpPerformanceMetric[]>(() => {
    const map = new Map<string, MinerviniTradeSetup[]>();
    stocks.forEach((s) => {
      const sec = s.sector || 'General Market';
      if (!map.has(sec)) map.set(sec, []);
      map.get(sec)!.push(s);
    });

    const list: Omit<SectorVcpPerformanceMetric, 'rsRank'>[] = [];

    map.forEach((secStocks, sector) => {
      const totalStocks = secStocks.length;

      // RS Rating Average
      const totalRs = secStocks.reduce((sum, s) => sum + (s.rsRating || 50), 0);
      const avgRsRating = Number((totalRs / (totalStocks || 1)).toFixed(1));

      // Day Change Average
      const totalChange = secStocks.reduce((sum, s) => sum + s.changePercent, 0);
      const avgChangePercent = Number((totalChange / (totalStocks || 1)).toFixed(2));

      // Volume Dry-up Average
      const totalDryUp = secStocks.reduce((sum, s) => sum + (s.volumeDryUpPercent || 0), 0);
      const avgVolumeDryUp = Number((totalDryUp / (totalStocks || 1)).toFixed(1));

      // VCP Stocks Detection: check if patternType indicates VCP or contractions >= 2
      const vcpStocks = secStocks.filter((s) => {
        const isVcpName = Boolean(s.patternType && s.patternType.toLowerCase().includes('vcp'));
        const hasContractions = Boolean(s.contractions && s.contractions.length >= 2);
        const isCoil = s.vcpStage === 'Active Breakout' || s.vcpStage === 'Breakout Pending' || Boolean(s.isTightVolume);
        return isVcpName || hasContractions || isCoil;
      });

      const vcpCount = vcpStocks.length;
      const vcpDensityPct = Number(((vcpCount / (totalStocks || 1)) * 100).toFixed(1));

      // Stage 2 qualification count
      const stage2Stocks = secStocks.filter((s) => s.trendScore >= 7);
      const stage2Count = stage2Stocks.length;
      const stage2Ratio = Number(((stage2Count / (totalStocks || 1)) * 100).toFixed(0));

      // Tightest contraction depth among VCP stocks
      let tightestContractionDepth = 99;
      vcpStocks.forEach((s) => {
        if (s.contractions && s.contractions.length > 0) {
          const lastC = Math.abs(s.contractions[s.contractions.length - 1].depthPercent);
          if (lastC < tightestContractionDepth) tightestContractionDepth = lastC;
        }
      });
      if (tightestContractionDepth === 99) tightestContractionDepth = 4.5;

      // Top leader stock (highest RS + Stage 2 score)
      const sortedStocks = [...secStocks].sort((a, b) => {
        if (b.rsRating !== a.rsRating) return b.rsRating - a.rsRating;
        return b.trendScore - a.trendScore;
      });
      const topLeaderStock = sortedStocks[0];

      // SEPA Daily Scan Priority Scoring Algorithm
      // Priority 1: High RS (>= 85) AND Multiple VCPs (>= 2) OR 1 tight VCP with RS >= 90
      // Priority 2: High RS (>= 80) OR at least 1 prominent VCP setup
      // Priority 3: RS >= 70, emerging setups
      // Priority 4: Low RS (< 70), no tight VCPs
      let dailyScanPriority: SectorVcpPerformanceMetric['dailyScanPriority'] = 'PRIORITY_4';
      let priorityLabel = 'PRIORITY 4: LOW MOMENTUM';
      let priorityBadgeBg = 'bg-slate-500/20 border-slate-500/40 text-slate-300';
      let priorityBadgeText = 'text-slate-400';
      let priorityReason = 'Sub-70 RS; lacking institutional volume dry-up.';

      if ((avgRsRating >= 84 && vcpCount >= 2) || (avgRsRating >= 88 && vcpCount >= 1)) {
        dailyScanPriority = 'PRIORITY_1';
        priorityLabel = 'PRIORITY 1: IMMEDIATE FOCUS';
        priorityBadgeBg = 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300';
        priorityBadgeText = 'text-emerald-400';
        priorityReason = `Elite RS (${avgRsRating}) + ${vcpCount} VCP bases coiling. Institutional accumulation confirmed.`;
      } else if (avgRsRating >= 80 || vcpCount >= 2) {
        dailyScanPriority = 'PRIORITY_2';
        priorityLabel = 'PRIORITY 2: COILING ON RADAR';
        priorityBadgeBg = 'bg-sky-500/20 border-sky-500/50 text-sky-300';
        priorityBadgeText = 'text-sky-400';
        priorityReason = `Strong group momentum (RS ${avgRsRating}) with ${vcpCount} active pattern${vcpCount === 1 ? '' : 's'}. Ready for watchlist.`;
      } else if (avgRsRating >= 72 || vcpCount >= 1) {
        dailyScanPriority = 'PRIORITY_3';
        priorityLabel = 'PRIORITY 3: ROTATIONAL WATCH';
        priorityBadgeBg = 'bg-amber-500/20 border-amber-500/50 text-amber-300';
        priorityBadgeText = 'text-amber-400';
        priorityReason = `Rotational candidate. Monitor for volume contraction before breakout.`;
      }

      list.push({
        sector,
        totalStocks,
        avgRsRating,
        vcpCount,
        vcpDensityPct,
        vcpStocks,
        allStocks: sortedStocks,
        avgChangePercent,
        avgVolumeDryUp,
        stage2Count,
        stage2Ratio,
        tightestContractionDepth,
        topLeaderStock,
        dailyScanPriority,
        priorityLabel,
        priorityBadgeBg,
        priorityBadgeText,
        priorityReason,
      });
    });

    // Rank primarily by avgRsRating descending to determine global RS rank
    list.sort((a, b) => b.avgRsRating - a.avgRsRating);

    return list.map((item, index) => ({
      ...item,
      rsRank: index + 1,
    }));
  }, [stocks]);

  // Filtered and sorted sectors
  const displayedSectors = useMemo(() => {
    let result = [...sectorMetrics];

    // Filter by Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (s) =>
          s.sector.toLowerCase().includes(q) ||
          s.allStocks.some((st) => st.ticker.toLowerCase().includes(q) || st.name.toLowerCase().includes(q))
      );
    }

    // Filter by Min VCP Count
    if (minVcpFilter === 'MIN_1') {
      result = result.filter((s) => s.vcpCount >= 1);
    } else if (minVcpFilter === 'MIN_2') {
      result = result.filter((s) => s.vcpCount >= 2);
    }

    // Sort order
    if (sortKey === 'RS_RATING') {
      result.sort((a, b) => b.avgRsRating - a.avgRsRating);
    } else if (sortKey === 'VCP_COUNT') {
      result.sort((a, b) => {
        if (b.vcpCount !== a.vcpCount) return b.vcpCount - a.vcpCount;
        return b.avgRsRating - a.avgRsRating;
      });
    } else if (sortKey === 'PRIORITY') {
      const order = { PRIORITY_1: 1, PRIORITY_2: 2, PRIORITY_3: 3, PRIORITY_4: 4 };
      result.sort((a, b) => {
        const diff = order[a.dailyScanPriority] - order[b.dailyScanPriority];
        if (diff !== 0) return diff;
        return b.avgRsRating - a.avgRsRating;
      });
    } else if (sortKey === 'DAY_CHANGE') {
      result.sort((a, b) => b.avgChangePercent - a.avgChangePercent);
    }

    return result;
  }, [sectorMetrics, searchQuery, minVcpFilter, sortKey]);

  // Key KPI summary metrics
  const topRsSector = useMemo(() => {
    if (sectorMetrics.length === 0) return null;
    return [...sectorMetrics].sort((a, b) => b.avgRsRating - a.avgRsRating)[0];
  }, [sectorMetrics]);

  const topVcpSector = useMemo(() => {
    if (sectorMetrics.length === 0) return null;
    return [...sectorMetrics].sort((a, b) => b.vcpCount - a.vcpCount)[0];
  }, [sectorMetrics]);

  const totalVcpSetups = useMemo(() => {
    return sectorMetrics.reduce((sum, s) => sum + s.vcpCount, 0);
  }, [sectorMetrics]);

  const immediateFocusCount = useMemo(() => {
    return sectorMetrics.filter((s) => s.dailyScanPriority === 'PRIORITY_1').length;
  }, [sectorMetrics]);

  // Export CSV handler
  const handleExportCsv = () => {
    const headers = [
      'RS Rank',
      'Sector',
      'Average RS Rating',
      'VCP Stocks Count',
      'VCP Density (%)',
      'Total Stocks',
      'Stage 2 Ratio (%)',
      'Avg Day Change (%)',
      'Avg Volume Dry-up (%)',
      'Daily Scan Priority',
      'Top Leader Stock',
      'VCP Setup Tickers',
    ];

    const rows = displayedSectors.map((s) => [
      s.rsRank,
      `"${s.sector}"`,
      s.avgRsRating,
      s.vcpCount,
      `${s.vcpDensityPct}%`,
      s.totalStocks,
      `${s.stage2Ratio}%`,
      `${s.avgChangePercent}%`,
      `${s.avgVolumeDryUp}%`,
      s.priorityLabel,
      s.topLeaderStock.ticker,
      `"${s.vcpStocks.map((st) => st.ticker).join(', ')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `daily_sector_performance_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setExportNotice(true);
    setTimeout(() => setExportNotice(false), 3000);
  };

  return (
    <div
      id="daily-sector-performance-dashboard"
      className={`space-y-6 transition-colors duration-300 font-sans ${
        isObsidian ? 'text-gray-200' : 'text-gray-900'
      }`}
    >
      {/* ========================================================================= */}
      {/* 1. HERO HEADER WITH STATS & DIRECT ACTIONS                                */}
      {/* ========================================================================= */}
      <div
        className={`p-6 border shadow-xl rounded-xl transition-all ${
          isObsidian ? 'bg-[#121620] border-[#222b3d]' : 'bg-white border-gray-200 shadow-sm'
        }`}
      >
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 border-b pb-5 border-white/10">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase font-mono tracking-[0.25em] font-extrabold text-amber-400">
                Institutional Daily Workflow
              </span>
              <span className="px-2 py-0.5 text-[9px] font-mono font-bold uppercase rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                <span>Sector RS Ranking Live</span>
              </span>
              <span className="px-2 py-0.5 text-[9px] font-mono font-bold uppercase rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                {sectorMetrics.length} Sectors Monitored
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-serif font-black tracking-tight mt-1 text-white">
              Daily Sector Performance &amp; VCP Leadership
            </h2>
            <p className="text-xs sm:text-sm text-gray-400 mt-1 max-w-3xl leading-relaxed">
              Ranks market industry groups by institutional Relative Strength (RS Rating) and identifies clusters of stocks forming high-conviction Volatility Contraction Patterns (VCP) to prioritize your daily scanning routines.
            </p>
          </div>

          {/* Quick Header Actions */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {topRsSector && (
              <button
                onClick={() => onFilterBySector(topRsSector.sector)}
                className="px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-md flex items-center space-x-2 active:scale-95"
                title={`Scan top RS sector: ${topRsSector.sector}`}
              >
                <Zap className="w-4 h-4" />
                <span>Scan #1 Sector: {topRsSector.sector}</span>
              </button>
            )}

            <button
              onClick={handleExportCsv}
              className={`px-3.5 py-2.5 rounded-lg border font-mono text-xs font-bold uppercase flex items-center space-x-2 transition-all cursor-pointer ${
                exportNotice
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                  : isObsidian
                  ? 'bg-[#181f2c] border-[#29354a] text-gray-300 hover:text-white hover:border-amber-400'
                  : 'bg-gray-100 border-gray-300 text-gray-800'
              }`}
              title="Download full sector performance and VCP pattern rankings as CSV"
            >
              {exportNotice ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Download className="w-4 h-4" />}
              <span>{exportNotice ? 'Exported ✓' : 'Export CSV'}</span>
            </button>
          </div>
        </div>

        {/* 4 Summary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5 font-mono">
          {/* Card 1: Top RS Sector */}
          <div
            className={`p-4 rounded-xl border relative overflow-hidden ${
              isObsidian ? 'bg-[#161d2a] border-[#253246]' : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/10 rounded-bl-full pointer-events-none" />
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span className="uppercase font-bold text-[10px]">#1 RS Leadership Sector</span>
              <Award className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-xl font-bold font-serif text-white mt-1.5 truncate">
              {topRsSector ? topRsSector.sector : 'Defense & Aerospace'}
            </div>
            <div className="flex items-center space-x-2 mt-2 text-xs">
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                Avg RS: {topRsSector ? topRsSector.avgRsRating : 94.2}
              </span>
              <span className="text-gray-400 text-[11px]">
                Leader: <strong>{topRsSector?.topLeaderStock.ticker || 'HAL'}</strong>
              </span>
            </div>
          </div>

          {/* Card 2: Highest VCP Density */}
          <div
            className={`p-4 rounded-xl border relative overflow-hidden ${
              isObsidian ? 'bg-[#161d2a] border-[#253246]' : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div className="absolute top-0 right-0 w-16 h-16 bg-sky-500/10 rounded-bl-full pointer-events-none" />
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span className="uppercase font-bold text-[10px]">Top VCP Density Cluster</span>
              <Target className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-xl font-bold font-serif text-white mt-1.5 truncate">
              {topVcpSector ? topVcpSector.sector : 'Electronics'}
            </div>
            <div className="flex items-center space-x-2 mt-2 text-xs">
              <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30">
                {topVcpSector ? topVcpSector.vcpCount : 4} VCP Setups
              </span>
              <span className="text-gray-400 text-[11px]">
                {topVcpSector ? `${topVcpSector.vcpDensityPct}% of group` : '42%'}
              </span>
            </div>
          </div>

          {/* Card 3: Total VCP Bases Ready */}
          <div
            className={`p-4 rounded-xl border relative overflow-hidden ${
              isObsidian ? 'bg-[#161d2a] border-[#253246]' : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-bl-full pointer-events-none" />
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span className="uppercase font-bold text-[10px]">Total Active VCP Setups</span>
              <Flame className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-400 mt-1">
              {totalVcpSetups} Setups
            </div>
            <div className="text-[11px] text-gray-400 mt-1">
              Coiling in tight Stage 2 bases across all sectors
            </div>
          </div>

          {/* Card 4: Immediate Focus Sectors */}
          <div
            className={`p-4 rounded-xl border relative overflow-hidden ${
              isObsidian ? 'bg-[#161d2a] border-[#253246]' : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div className="absolute top-0 right-0 w-16 h-16 bg-purple-500/10 rounded-bl-full pointer-events-none" />
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span className="uppercase font-bold text-[10px]">Priority 1 Focus Sectors</span>
              <Sparkles className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-black text-amber-300 mt-1">
              {immediateFocusCount} Sectors
            </div>
            <div className="text-[11px] text-gray-400 mt-1">
              Qualified for immediate daily scanning allocation
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. FILTER, SEARCH & SORT CONTROLS BAR                                     */}
      {/* ========================================================================= */}
      <div
        className={`p-4 rounded-xl border flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 font-mono text-xs ${
          isObsidian ? 'bg-[#121620] border-[#222b3d]' : 'bg-white border-gray-200'
        }`}
      >
        {/* Search Sector or Stock */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sectors or constituent tickers (e.g. Defense, HAL, TRENT)..."
            className={`w-full py-2 pl-9 pr-3 rounded-lg border font-mono text-xs text-white placeholder-gray-500 focus:outline-none transition-all ${
              isObsidian
                ? 'bg-[#181f2c] border-[#29354a] focus:border-amber-400'
                : 'bg-gray-50 border-gray-300 focus:border-amber-500'
            }`}
          />
        </div>

        {/* Filter & Sort Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Min VCP Filter */}
          <div className="flex items-center space-x-1.5">
            <span className="text-[10px] text-gray-400 uppercase font-bold">VCPs:</span>
            <div className="flex items-center rounded border border-white/10 p-0.5 bg-black/20">
              <button
                onClick={() => setMinVcpFilter('ALL')}
                className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase transition-all cursor-pointer ${
                  minVcpFilter === 'ALL'
                    ? 'bg-amber-500 text-slate-950 font-black'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setMinVcpFilter('MIN_1')}
                className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase transition-all cursor-pointer ${
                  minVcpFilter === 'MIN_1'
                    ? 'bg-amber-500 text-slate-950 font-black'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                ≥ 1 VCP
              </button>
              <button
                onClick={() => setMinVcpFilter('MIN_2')}
                className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase transition-all cursor-pointer ${
                  minVcpFilter === 'MIN_2'
                    ? 'bg-amber-500 text-slate-950 font-black'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                ≥ 2 VCPs
              </button>
            </div>
          </div>

          {/* Sort Key Selector */}
          <div className="flex items-center space-x-1.5">
            <span className="text-[10px] text-gray-400 uppercase font-bold">Sort:</span>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as any)}
              className={`py-1.5 px-3 rounded-lg border font-mono text-xs font-bold cursor-pointer ${
                isObsidian
                  ? 'bg-[#181f2c] border-[#29354a] text-amber-300'
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            >
              <option value="RS_RATING">Highest RS Rating (SEPA Rank)</option>
              <option value="VCP_COUNT">Most VCP Formations</option>
              <option value="PRIORITY">Daily Scan Priority (P1 → P4)</option>
              <option value="DAY_CHANGE">Top Day Performance (%)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. SECTOR LEADERBOARD CARDS WITH ACCORDIONS                               */}
      {/* ========================================================================= */}
      <div className="space-y-3">
        {displayedSectors.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-white/10 rounded-xl text-gray-400 font-mono text-xs">
            <Building2 className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="font-bold text-gray-300">No sectors match current filter criteria.</p>
            <p className="text-[11px] text-gray-500 mt-1">Try resetting the VCP filter or search query.</p>
          </div>
        ) : (
          displayedSectors.map((sectorItem) => {
            const isExpanded = expandedSector === sectorItem.sector;
            const rsColor =
              sectorItem.avgRsRating >= 85
                ? 'text-emerald-400'
                : sectorItem.avgRsRating >= 75
                ? 'text-sky-400'
                : sectorItem.avgRsRating >= 65
                ? 'text-amber-400'
                : 'text-rose-400';

            const rsBarWidth = Math.min(100, Math.max(10, sectorItem.avgRsRating));

            return (
              <div
                key={sectorItem.sector}
                className={`rounded-xl border transition-all overflow-hidden ${
                  sectorItem.dailyScanPriority === 'PRIORITY_1'
                    ? isObsidian
                      ? 'bg-[#131a26] border-emerald-500/40 shadow-lg'
                      : 'bg-emerald-50/50 border-emerald-300'
                    : isObsidian
                    ? 'bg-[#121620] border-[#222b3d] hover:border-white/20'
                    : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
              >
                {/* Sector Card Main Header Row */}
                <div className="p-4 sm:p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                  {/* Left: Rank, Name, Priority Badge */}
                  <div className="flex items-start space-x-3 min-w-0 flex-1">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center font-mono font-black text-base shrink-0 border ${
                        sectorItem.rsRank === 1
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                          : sectorItem.rsRank <= 3
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                          : 'bg-black/30 text-gray-400 border-white/10'
                      }`}
                    >
                      #{sectorItem.rsRank}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-serif font-black text-lg text-white tracking-wide truncate">
                          {sectorItem.sector}
                        </h3>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider border ${sectorItem.priorityBadgeBg}`}
                        >
                          {sectorItem.priorityLabel}
                        </span>
                        <span className="text-gray-400 font-mono text-xs">
                          ({sectorItem.totalStocks} stocks)
                        </span>
                      </div>

                      <p className="text-xs text-gray-400 font-sans mt-0.5">
                        {sectorItem.priorityReason}
                      </p>

                      {/* VCP Ticker Pills Preview */}
                      {sectorItem.vcpStocks.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 mt-2 font-mono text-[10px]">
                          <span className="text-gray-500 uppercase font-bold">VCP Coils:</span>
                          {sectorItem.vcpStocks.map((st) => (
                            <button
                              key={st.ticker}
                              onClick={() => {
                                onSelectStock(st);
                                onViewChart(st);
                              }}
                              className="px-2 py-0.5 rounded bg-sky-950/70 border border-sky-500/40 text-sky-300 hover:bg-sky-900/80 hover:text-white transition-all cursor-pointer flex items-center space-x-1"
                              title={`${st.name} • Pivot: ${formatCurrency(st.pivotPrice, getCurrencySymbol(st.exchange))} • RS: ${st.rsRating}`}
                            >
                              <span className="font-bold">{st.ticker}</span>
                              <span className="text-gray-400">({st.patternType.split(' ')[0]})</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Middle: Metrics Gauge Bars */}
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-6 shrink-0 font-mono text-xs w-full lg:w-auto justify-between lg:justify-end">
                    {/* RS Rating Meter */}
                    <div className="w-28 sm:w-32">
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-gray-400">Average RS:</span>
                        <span className={`font-bold ${rsColor}`}>{sectorItem.avgRsRating}</span>
                      </div>
                      <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden border border-white/10">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            sectorItem.avgRsRating >= 85
                              ? 'bg-emerald-400'
                              : sectorItem.avgRsRating >= 75
                              ? 'bg-sky-400'
                              : sectorItem.avgRsRating >= 65
                              ? 'bg-amber-400'
                              : 'bg-rose-400'
                          }`}
                          style={{ width: `${rsBarWidth}%` }}
                        />
                      </div>
                    </div>

                    {/* VCP Formations Count */}
                    <div className="text-center px-3 py-1.5 rounded-lg bg-black/20 border border-white/5">
                      <div className="text-[10px] uppercase text-gray-400">VCP Setups</div>
                      <div className="text-base font-black text-sky-400">
                        {sectorItem.vcpCount}
                        <span className="text-[10px] text-gray-500 font-normal"> / {sectorItem.totalStocks}</span>
                      </div>
                    </div>

                    {/* Stage 2 Ratio */}
                    <div className="text-center px-3 py-1.5 rounded-lg bg-black/20 border border-white/5">
                      <div className="text-[10px] uppercase text-gray-400">Stage 2 Ratio</div>
                      <div className="text-base font-black text-amber-300">
                        {sectorItem.stage2Ratio}%
                      </div>
                    </div>

                    {/* Day Change */}
                    <div className="text-center px-3 py-1.5 rounded-lg bg-black/20 border border-white/5">
                      <div className="text-[10px] uppercase text-gray-400">Day Change</div>
                      <div
                        className={`text-base font-black flex items-center justify-center space-x-0.5 ${
                          sectorItem.avgChangePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {sectorItem.avgChangePercent >= 0 ? (
                          <ArrowUpRight className="w-3.5 h-3.5 inline" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5 inline" />
                        )}
                        <span>
                          {sectorItem.avgChangePercent >= 0 ? '+' : ''}
                          {sectorItem.avgChangePercent}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Actions: Scan Button & Expand Accordion */}
                  <div className="flex items-center space-x-2 shrink-0 self-end lg:self-center">
                    <button
                      onClick={() => onFilterBySector(sectorItem.sector)}
                      className="px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono text-xs font-bold uppercase transition-all cursor-pointer shadow-sm flex items-center space-x-1.5"
                      title={`Filter Screener to ${sectorItem.sector}`}
                    >
                      <Filter className="w-3.5 h-3.5" />
                      <span>Scan Group</span>
                    </button>

                    <button
                      onClick={() => setExpandedSector(isExpanded ? null : sectorItem.sector)}
                      className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer border border-white/10"
                      title={isExpanded ? 'Collapse constituent stocks' : 'Inspect all constituent stocks'}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Constituent Stocks Accordion */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-white/10 bg-black/30 p-4 sm:p-5"
                    >
                      <div className="flex items-center justify-between mb-3 text-xs font-mono">
                        <span className="font-bold text-gray-300 uppercase tracking-wider flex items-center space-x-2">
                          <Layers className="w-4 h-4 text-amber-400" />
                          <span>Constituent Stocks in {sectorItem.sector} ({sectorItem.allStocks.length})</span>
                        </span>
                        <span className="text-[11px] text-gray-500">
                          Sorted by Relative Strength Rating
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left font-mono text-xs">
                          <thead>
                            <tr className="border-b border-white/10 text-[10px] text-gray-400 uppercase tracking-wider">
                              <th className="py-2 pr-3">Ticker / Company</th>
                              <th className="py-2 px-3">Price</th>
                              <th className="py-2 px-3">RS Rating</th>
                              <th className="py-2 px-3">VCP Pattern &amp; Stage</th>
                              <th className="py-2 px-3">Pivot Target</th>
                              <th className="py-2 px-3">Dist to Pivot</th>
                              <th className="py-2 px-3">Vol Dry-Up</th>
                              <th className="py-2 pl-3 text-right">Quick Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {sectorItem.allStocks.map((stock) => {
                              const isVcp =
                                stock.patternType?.toLowerCase().includes('vcp') ||
                                (stock.contractions && stock.contractions.length >= 2);
                              const distToPivot = stock.pivotPrice
                                ? ((stock.currentPrice - stock.pivotPrice) / stock.pivotPrice) * 100
                                : 0;
                              const currSymbol = getCurrencySymbol(stock.exchange);

                              return (
                                <tr
                                  key={stock.ticker}
                                  className={`hover:bg-white/5 transition-colors ${
                                    isVcp ? 'bg-sky-500/5' : ''
                                  }`}
                                >
                                  {/* Ticker & Name */}
                                  <td className="py-2.5 pr-3">
                                    <div className="flex items-center space-x-2">
                                      <span className="font-bold text-white text-sm">
                                        {stock.ticker}
                                      </span>
                                      {isVcp && (
                                        <span className="px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 text-[9px] font-bold uppercase">
                                          VCP Coil
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-gray-400 truncate max-w-[180px]">
                                      {stock.name}
                                    </div>
                                  </td>

                                  {/* Price */}
                                  <td className="py-2.5 px-3">
                                    <div className="font-bold text-gray-200">
                                      {formatCurrency(stock.currentPrice, currSymbol)}
                                    </div>
                                    <div
                                      className={`text-[10px] ${
                                        stock.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                      }`}
                                    >
                                      {stock.changePercent >= 0 ? '+' : ''}
                                      {stock.changePercent}%
                                    </div>
                                  </td>

                                  {/* RS Rating */}
                                  <td className="py-2.5 px-3">
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                        stock.rsRating >= 85
                                          ? 'bg-emerald-500/20 text-emerald-300'
                                          : stock.rsRating >= 75
                                          ? 'bg-sky-500/20 text-sky-300'
                                          : 'bg-amber-500/20 text-amber-300'
                                      }`}
                                    >
                                      RS {stock.rsRating}
                                    </span>
                                  </td>

                                  {/* Pattern Type */}
                                  <td className="py-2.5 px-3">
                                    <div className="text-gray-300 font-bold text-xs truncate max-w-[160px]">
                                      {stock.patternType}
                                    </div>
                                    <div className="text-[10px] text-gray-500">
                                      {stock.vcpStage || 'Stage 2 Continuation'}
                                    </div>
                                  </td>

                                  {/* Pivot Price */}
                                  <td className="py-2.5 px-3 text-gray-300">
                                    {formatCurrency(stock.pivotPrice, currSymbol)}
                                  </td>

                                  {/* Distance to Pivot */}
                                  <td className="py-2.5 px-3">
                                    <span
                                      className={`text-xs font-bold ${
                                        Math.abs(distToPivot) <= 2
                                          ? 'text-emerald-400 animate-pulse'
                                          : distToPivot < 0
                                          ? 'text-sky-300'
                                          : 'text-gray-400'
                                      }`}
                                    >
                                      {distToPivot >= 0 ? '+' : ''}
                                      {distToPivot.toFixed(1)}%
                                    </span>
                                  </td>

                                  {/* Volume Dry-Up */}
                                  <td className="py-2.5 px-3">
                                    <span
                                      className={`text-xs font-bold ${
                                        stock.volumeDryUpPercent <= -40 ? 'text-emerald-400' : 'text-gray-400'
                                      }`}
                                    >
                                      {stock.volumeDryUpPercent}%
                                    </span>
                                  </td>

                                  {/* Quick Actions */}
                                  <td className="py-2.5 pl-3 text-right">
                                    <div className="flex items-center justify-end space-x-1.5">
                                      <button
                                        onClick={() => {
                                          onSelectStock(stock);
                                          onViewChart(stock);
                                        }}
                                        className="px-2.5 py-1 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-[11px] font-bold transition-all cursor-pointer"
                                        title="Inspect in VCP Chart"
                                      >
                                        Chart
                                      </button>
                                      {onNavigateToFivePaisa && (
                                        <button
                                          onClick={() => onNavigateToFivePaisa(stock)}
                                          className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-bold transition-all cursor-pointer"
                                          title="Execute trade on 5paisa"
                                        >
                                          5paisa
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>

      {/* ========================================================================= */}
      {/* 4. INSTITUTIONAL SECTOR PLAYBOOK GUIDE                                     */}
      {/* ========================================================================= */}
      <div
        className={`p-5 rounded-xl border font-mono text-xs space-y-2 ${
          isObsidian ? 'bg-[#121620] border-[#222b3d] text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-700'
        }`}
      >
        <div className="flex items-center space-x-2 text-amber-400 font-bold uppercase tracking-wider text-[11px]">
          <ShieldCheck className="w-4 h-4" />
          <span>Mark Minervini SEPA Principle: Top-Down Industry Group Leadership</span>
        </div>
        <p className="font-sans leading-relaxed text-gray-400">
          "Over 50% of an individual winning stock's movement is driven by the strength of its overall industry group. Never buy a stock in a lagging sector. Always prioritize daily scanning efforts on the top 2-3 leading sectors ranked by average RS rating, specifically where multiple stocks are simultaneously forming tight VCP patterns."
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-[11px]">
          <div className="p-2.5 rounded bg-black/20 border border-white/5">
            <strong className="text-emerald-400 block mb-0.5">1. Rank by RS:</strong>
            Focus on sectors with average RS &gt; 80 (institutions are actively loading tranches).
          </div>
          <div className="p-2.5 rounded bg-black/20 border border-white/5">
            <strong className="text-sky-400 block mb-0.5">2. Find VCP Clusters:</strong>
            Prioritize sectors with 2+ stocks coiling (validates true group leadership).
          </div>
          <div className="p-2.5 rounded bg-black/20 border border-white/5">
            <strong className="text-amber-400 block mb-0.5">3. Strike at Pivots:</strong>
            Execute on the #1 stock that breaks out first with volume expansion.
          </div>
        </div>
      </div>
    </div>
  );
};
