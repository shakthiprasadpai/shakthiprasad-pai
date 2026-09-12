import React, { useState, useMemo } from 'react';
import { MinerviniTradeSetup } from '../types';
import { formatCurrency, getCurrencySymbol } from '../utils/sepaCalculator';
import { buildUniverseVolatilityRankMap, VolatilityRankData } from '../utils/volatilityRankCalculator';
import {
  Flame,
  Award,
  TrendingUp,
  Activity,
  Layers,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Gauge,
  SlidersHorizontal,
  ChevronRight,
  Droplets
} from 'lucide-react';

interface SectorHeatmapProps {
  stocks: MinerviniTradeSetup[];
  selectedTicker: string;
  onSelectStock: (stock: MinerviniTradeSetup) => void;
  onViewChart?: (stock: MinerviniTradeSetup) => void;
  onFilterBySector?: (sectorName: string) => void;
}

export type HeatmapColorMetric = 'RS_RATING' | 'DAILY_CHANGE' | 'VOLATILITY_RANK';

interface SectorGroup {
  sector: string;
  stocks: MinerviniTradeSetup[];
  avgRsRating: number;
  avgChangePercent: number;
  avgVolRank: number;
  topStock: MinerviniTradeSetup;
  superLeaderCount: number; // RS >= 80
  tightVolCount: number;
  marketCapRank: number;
}

export const SectorHeatmap: React.FC<SectorHeatmapProps> = ({
  stocks,
  selectedTicker,
  onSelectStock,
  onViewChart,
  onFilterBySector,
}) => {
  const [colorMetric, setColorMetric] = useState<HeatmapColorMetric>('RS_RATING');
  const [sectorSearch, setSectorSearch] = useState<string>('');
  const [minRsThreshold, setMinRsThreshold] = useState<number>(0);
  const [selectedSectorFilter, setSelectedSectorFilter] = useState<string>('ALL');

  // Precompute universe volatility ranks
  const volatilityMap = useMemo(() => buildUniverseVolatilityRankMap(stocks), [stocks]);

  // Group stocks by sector
  const sectorGroups: SectorGroup[] = useMemo(() => {
    const map = new Map<string, MinerviniTradeSetup[]>();

    stocks.forEach((stock) => {
      const sec = stock.sector || 'Uncategorized';
      if (!map.has(sec)) map.set(sec, []);
      map.get(sec)!.push(stock);
    });

    const groups: SectorGroup[] = [];

    map.forEach((secStocks, secName) => {
      // Sort stocks within sector by RS Rating desc
      const sortedStocks = [...secStocks].sort((a, b) => (b.rsRating || 0) - (a.rsRating || 0));
      const avgRs = Math.round(
        secStocks.reduce((sum, s) => sum + (s.rsRating || 0), 0) / secStocks.length
      );
      const avgChg = Number(
        (secStocks.reduce((sum, s) => sum + (s.changePercent || 0), 0) / secStocks.length).toFixed(2)
      );
      const avgVol = Math.round(
        secStocks.reduce((sum, s) => sum + (volatilityMap.get(s.ticker)?.volatilityRank || 50), 0) / secStocks.length
      );
      const superLeaders = secStocks.filter((s) => (s.rsRating || 0) >= 80).length;
      const tightVol = secStocks.filter((s) => (s.volumeDryUpPercent || 0) <= -45).length;

      groups.push({
        sector: secName,
        stocks: sortedStocks,
        avgRsRating: avgRs,
        avgChangePercent: avgChg,
        avgVolRank: avgVol,
        topStock: sortedStocks[0],
        superLeaderCount: superLeaders,
        tightVolCount: tightVol,
        marketCapRank: secStocks.length,
      });
    });

    // Sort sector groups by Avg RS Rating desc
    return groups.sort((a, b) => b.avgRsRating - a.avgRsRating);
  }, [stocks, volatilityMap]);

  // Filter sector groups based on UI criteria
  const filteredGroups = useMemo(() => {
    return sectorGroups.filter((g) => {
      if (selectedSectorFilter !== 'ALL' && g.sector !== selectedSectorFilter) return false;
      if (minRsThreshold > 0 && g.avgRsRating < minRsThreshold) return false;
      if (sectorSearch.trim()) {
        const query = sectorSearch.toLowerCase().trim();
        const matchSector = g.sector.toLowerCase().includes(query);
        const matchStock = g.stocks.some(
          (s) =>
            s.ticker.toLowerCase().includes(query) ||
            s.name.toLowerCase().includes(query) ||
            s.industry.toLowerCase().includes(query)
        );
        if (!matchSector && !matchStock) return false;
      }
      return true;
    });
  }, [sectorGroups, selectedSectorFilter, minRsThreshold, sectorSearch]);

  // Color generator for stock tiles based on chosen metric
  const getStockTileStyle = (stock: MinerviniTradeSetup) => {
    const isSelected = stock.ticker === selectedTicker;

    if (colorMetric === 'RS_RATING') {
      const rs = stock.rsRating || 0;
      if (rs >= 90) {
        return {
          bg: 'bg-emerald-700 hover:bg-emerald-600 text-white',
          border: isSelected ? 'border-amber-400 ring-2 ring-amber-400' : 'border-emerald-800',
          accent: 'text-amber-300',
          label: `${rs} RS (Elite)`,
        };
      } else if (rs >= 80) {
        return {
          bg: 'bg-emerald-600 hover:bg-emerald-500 text-white',
          border: isSelected ? 'border-amber-400 ring-2 ring-amber-400' : 'border-emerald-700',
          accent: 'text-emerald-100',
          label: `${rs} RS (Leader)`,
        };
      } else if (rs >= 70) {
        return {
          bg: 'bg-teal-700 hover:bg-teal-600 text-white',
          border: isSelected ? 'border-amber-400 ring-2 ring-amber-400' : 'border-teal-800',
          accent: 'text-teal-100',
          label: `${rs} RS (Valid)`,
        };
      } else if (rs >= 50) {
        return {
          bg: 'bg-slate-700 hover:bg-slate-600 text-white',
          border: isSelected ? 'border-amber-400 ring-2 ring-amber-400' : 'border-slate-800',
          accent: 'text-slate-300',
          label: `${rs} RS (Neutral)`,
        };
      } else {
        return {
          bg: 'bg-rose-900 hover:bg-rose-800 text-white',
          border: isSelected ? 'border-amber-400 ring-2 ring-amber-400' : 'border-rose-950',
          accent: 'text-rose-200',
          label: `${rs} RS (Lagging)`,
        };
      }
    } else if (colorMetric === 'DAILY_CHANGE') {
      const chg = stock.changePercent || 0;
      if (chg >= 3.0) {
        return {
          bg: 'bg-[#107c41] hover:bg-emerald-600 text-white',
          border: isSelected ? 'border-amber-400 ring-2 ring-amber-400' : 'border-emerald-800',
          accent: 'text-amber-300',
          label: `+${chg.toFixed(1)}%`,
        };
      } else if (chg > 0) {
        return {
          bg: 'bg-emerald-600 hover:bg-emerald-500 text-white',
          border: isSelected ? 'border-amber-400 ring-2 ring-amber-400' : 'border-emerald-700',
          accent: 'text-emerald-100',
          label: `+${chg.toFixed(1)}%`,
        };
      } else if (chg === 0) {
        return {
          bg: 'bg-slate-700 hover:bg-slate-600 text-white',
          border: isSelected ? 'border-amber-400 ring-2 ring-amber-400' : 'border-slate-800',
          accent: 'text-slate-200',
          label: `0.00%`,
        };
      } else if (chg >= -2.0) {
        return {
          bg: 'bg-rose-700 hover:bg-rose-600 text-white',
          border: isSelected ? 'border-amber-400 ring-2 ring-amber-400' : 'border-rose-800',
          accent: 'text-rose-100',
          label: `${chg.toFixed(1)}%`,
        };
      } else {
        return {
          bg: 'bg-rose-900 hover:bg-rose-800 text-white',
          border: isSelected ? 'border-amber-400 ring-2 ring-amber-400' : 'border-rose-950',
          accent: 'text-amber-200',
          label: `${chg.toFixed(1)}%`,
        };
      }
    } else {
      // VOLATILITY_RANK
      const volData = volatilityMap.get(stock.ticker);
      const rank = volData?.volatilityRank ?? 50;
      if (rank <= 35) {
        return {
          bg: 'bg-teal-800 hover:bg-teal-700 text-white',
          border: isSelected ? 'border-amber-400 ring-2 ring-amber-400' : 'border-teal-900',
          accent: 'text-teal-200',
          label: `Vol #${rank} (Coil)`,
        };
      } else if (rank <= 70) {
        return {
          bg: 'bg-blue-800 hover:bg-blue-700 text-white',
          border: isSelected ? 'border-amber-400 ring-2 ring-amber-400' : 'border-blue-900',
          accent: 'text-blue-200',
          label: `Vol #${rank} (Normal)`,
        };
      } else if (rank <= 89) {
        return {
          bg: 'bg-amber-700 hover:bg-amber-600 text-white',
          border: isSelected ? 'border-amber-400 ring-2 ring-amber-400' : 'border-amber-900',
          accent: 'text-amber-100',
          label: `Vol #${rank} (High)`,
        };
      } else {
        return {
          bg: 'bg-purple-900 hover:bg-purple-800 text-white',
          border: isSelected ? 'border-amber-400 ring-2 ring-amber-400' : 'border-purple-950',
          accent: 'text-amber-300',
          label: `Vol #${rank} (Extreme)`,
        };
      }
    }
  };

  return (
    <div id="sector-heatmap-container" className="space-y-6">
      {/* Control Toolbar */}
      <div className="bg-[#10141d] border border-gray-800 p-4 text-white shadow-xs font-mono space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 bg-amber-500 text-black flex items-center justify-center font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-amber-400">
                Visual Market Breadth
              </span>
              <h3 className="text-base font-serif font-black text-white leading-tight">
                Sector Performance & Relative Strength Heatmap
              </h3>
            </div>
          </div>

          {/* Color Scheme Switcher */}
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-gray-400 uppercase text-[10px] tracking-wider font-bold">Color Mode:</span>
            <div className="inline-flex border border-gray-700 bg-gray-900 p-0.5">
              <button
                id="heatmap-color-rs-btn"
                onClick={() => setColorMetric('RS_RATING')}
                className={`px-3 py-1 text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5 transition-all ${
                  colorMetric === 'RS_RATING'
                    ? 'bg-amber-500 text-black shadow-2xs font-extrabold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                <span>RS Rating</span>
              </button>
              <button
                id="heatmap-color-change-btn"
                onClick={() => setColorMetric('DAILY_CHANGE')}
                className={`px-3 py-1 text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5 transition-all ${
                  colorMetric === 'DAILY_CHANGE'
                    ? 'bg-emerald-500 text-black shadow-2xs font-extrabold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Daily % Chg</span>
              </button>
              <button
                id="heatmap-color-vol-btn"
                onClick={() => setColorMetric('VOLATILITY_RANK')}
                className={`px-3 py-1 text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5 transition-all ${
                  colorMetric === 'VOLATILITY_RANK'
                    ? 'bg-purple-600 text-amber-300 shadow-2xs font-extrabold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Gauge className="w-3.5 h-3.5" />
                <span>Vol Rank</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              id="sector-heatmap-search-input"
              type="text"
              value={sectorSearch}
              onChange={(e) => setSectorSearch(e.target.value)}
              placeholder="Filter sector or stock symbol..."
              className="w-full bg-gray-900 border border-gray-700 text-amber-200 placeholder-gray-500 text-xs pl-8 pr-3 py-1.5 focus:outline-none focus:border-amber-400 font-sans"
            />
          </div>

          {/* Quick Sector Filter Dropdown */}
          <div className="flex items-center space-x-2">
            <span className="text-gray-400 text-[10px] uppercase font-bold">Sector:</span>
            <select
              id="sector-heatmap-select-filter"
              value={selectedSectorFilter}
              onChange={(e) => setSelectedSectorFilter(e.target.value)}
              className="bg-gray-900 border border-gray-700 text-amber-300 text-xs px-2.5 py-1.5 focus:outline-none focus:border-amber-400"
            >
              <option value="ALL">All Sectors ({sectorGroups.length})</option>
              {sectorGroups.map((g) => (
                <option key={g.sector} value={g.sector}>
                  {g.sector} (Avg RS {g.avgRsRating} | {g.stocks.length} stocks)
                </option>
              ))}
            </select>
          </div>

          {/* Min RS Rating Quick Filter */}
          <div className="flex items-center space-x-1.5">
            <span className="text-gray-400 text-[10px] uppercase font-bold">Min Sector RS:</span>
            {[
              { label: 'All', val: 0 },
              { label: 'RS ≥ 70', val: 70 },
              { label: 'RS ≥ 80', val: 80 },
              { label: 'RS ≥ 85', val: 85 },
            ].map((item) => (
              <button
                key={item.val}
                onClick={() => setMinRsThreshold(item.val)}
                className={`px-2 py-1 text-[10px] font-bold uppercase transition-all ${
                  minRsThreshold === item.val
                    ? 'bg-amber-400 text-black'
                    : 'bg-gray-900 text-gray-300 hover:text-white border border-gray-700'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] pt-1 text-gray-400 border-t border-gray-800/80">
          <div className="flex items-center space-x-3">
            <span className="text-gray-500 uppercase font-bold text-[10px]">Legend:</span>
            {colorMetric === 'RS_RATING' ? (
              <>
                <div className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 bg-emerald-700 border border-emerald-500" />
                  <span className="text-emerald-300 font-bold">RS ≥ 90 (Elite)</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 bg-emerald-600 border border-emerald-400" />
                  <span className="text-emerald-400">RS 80-89 (Leader)</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 bg-teal-700 border border-teal-500" />
                  <span className="text-teal-300">RS 70-79 (Continuation)</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 bg-slate-700 border border-slate-500" />
                  <span className="text-gray-300">RS 50-69</span>
                </div>
              </>
            ) : colorMetric === 'DAILY_CHANGE' ? (
              <>
                <div className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 bg-[#107c41] border border-emerald-400" />
                  <span className="text-emerald-300 font-bold">&gt; +3.0%</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 bg-emerald-600 border border-emerald-400" />
                  <span className="text-emerald-400">0% to +3%</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 bg-rose-700 border border-rose-500" />
                  <span className="text-rose-300">-2% to 0%</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 bg-rose-900 border border-rose-600" />
                  <span className="text-rose-400">&lt; -2.0%</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 bg-teal-800 border border-teal-500" />
                  <span className="text-teal-300 font-bold">Low Vol Coil (Rank 1-35)</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 bg-blue-800 border border-blue-500" />
                  <span className="text-blue-300">Moderate Vol (36-70)</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 bg-amber-700 border border-amber-500" />
                  <span className="text-amber-300">High Vol (71-89)</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 bg-purple-900 border border-purple-500" />
                  <span className="text-purple-300">Extreme Vol (90+)</span>
                </div>
              </>
            )}
          </div>

          <div className="text-[10px] text-gray-400 font-sans italic">
            Click any stock tile to select in Screener or view chart.
          </div>
        </div>
      </div>

      {/* Sector Tiles Grid */}
      {filteredGroups.length === 0 ? (
        <div className="bg-white border border-[#e5e4e1] p-12 text-center text-gray-500 font-serif italic">
          No sectors or stocks match the chosen heatmap criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredGroups.map((group) => {
            const isLeadingSector = group.avgRsRating >= 80;
            const topStockVol = volatilityMap.get(group.topStock.ticker);

            return (
              <div
                key={group.sector}
                className={`bg-white border transition-all duration-200 shadow-xs flex flex-col justify-between ${
                  isLeadingSector
                    ? 'border-emerald-600/60 ring-1 ring-emerald-500/20'
                    : 'border-[#e5e4e1]'
                }`}
              >
                {/* Sector Header */}
                <div className="bg-[#f9f8f5] p-3.5 border-b border-[#e5e4e1] flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="font-serif font-black text-sm text-[#1a1a1a] tracking-tight">
                        {group.sector}
                      </h4>
                      {isLeadingSector && (
                        <span className="px-1.5 py-0.5 bg-emerald-600 text-white text-[9px] font-black uppercase font-mono tracking-wider">
                          Leading Sector
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-gray-500 font-sans mt-0.5 flex items-center space-x-2">
                      <span>{group.stocks.length} candidates</span>
                      <span>•</span>
                      <span>Top: {group.topStock.ticker} (RS {group.topStock.rsRating})</span>
                    </div>
                  </div>

                  {/* Sector Summary Badges */}
                  <div className="flex items-center space-x-1.5 font-mono text-xs">
                    <span
                      className={`px-2 py-0.5 font-black text-xs border ${
                        group.avgRsRating >= 80
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          : group.avgRsRating >= 70
                          ? 'bg-teal-100 text-teal-900 border-teal-300'
                          : 'bg-gray-100 text-gray-700 border-gray-300'
                      }`}
                      title={`Average Relative Strength Rating across all ${group.stocks.length} stocks in ${group.sector}`}
                    >
                      {group.avgRsRating} RS
                    </span>

                    <span
                      className={`px-1.5 py-0.5 font-bold text-[11px] border ${
                        group.avgChangePercent >= 0
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}
                    >
                      {group.avgChangePercent >= 0 ? '+' : ''}
                      {group.avgChangePercent}%
                    </span>

                    {onFilterBySector && (
                      <button
                        onClick={() => onFilterBySector(group.sector)}
                        className="p-1 hover:bg-gray-200 text-gray-500 hover:text-black transition-colors"
                        title={`Filter screener table exclusively for ${group.sector}`}
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Stock Tiles Inside Sector */}
                <div className="p-3.5 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {group.stocks.map((stock) => {
                    const tileStyle = getStockTileStyle(stock);
                    const isSelected = stock.ticker === selectedTicker;
                    const volInfo = volatilityMap.get(stock.ticker);
                    const currency = getCurrencySymbol(stock.exchange);

                    return (
                      <div
                        key={stock.ticker}
                        onClick={() => onSelectStock(stock)}
                        onDoubleClick={() => onViewChart && onViewChart(stock)}
                        className={`p-2 border transition-all cursor-pointer select-none flex flex-col justify-between relative group ${tileStyle.bg} ${tileStyle.border} ${
                          isSelected ? 'shadow-md scale-[1.02]' : 'hover:scale-[1.02]'
                        }`}
                        title={`${stock.ticker}: ${stock.name}\nPrice: ${currency}${stock.currentPrice} (${stock.changePercent >= 0 ? '+' : ''}${stock.changePercent}%)\nRS Rating: ${stock.rsRating}/99\nVol Rank: #${volInfo?.volatilityRank || 50} (${volInfo?.relativeVolatilityRatio}x mkt)\nVCP: ${stock.vcpStage} (${stock.volumeDryUpPercent}% vol dry-up)\nDouble click to view chart`}
                      >
                        <div className="flex items-start justify-between">
                          <span className="font-extrabold text-xs font-mono tracking-tight text-white group-hover:text-amber-300">
                            {stock.ticker}
                          </span>
                          <span className={`text-[10px] font-mono font-bold ${tileStyle.accent}`}>
                            {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(1)}%
                          </span>
                        </div>

                        <div className="mt-2 flex items-center justify-between text-[9px] font-mono opacity-90">
                          <span className="bg-black/30 px-1 py-0.2 rounded-2xs font-bold text-amber-200">
                            RS {stock.rsRating}
                          </span>
                          <span className="text-white/80">
                            {currency}{stock.currentPrice.toFixed(0)}
                          </span>
                        </div>

                        {/* Subtle VCP Stage or Vol Rank footer */}
                        <div className="mt-1 pt-1 border-t border-white/10 flex items-center justify-between text-[8px] font-mono text-white/70">
                          <span className="truncate max-w-[65px]">{stock.vcpStage || 'Base'}</span>
                          <span>Vol #{volInfo?.volatilityRank || 50}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Sector Footer Stats */}
                <div className="bg-[#f9f8f5] px-3.5 py-2 border-t border-[#e5e4e1] text-[10px] text-gray-500 font-mono flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span>Super Leaders (RS≥80): <strong className="text-emerald-700">{group.superLeaderCount}</strong></span>
                    <span>•</span>
                    <span>Tight Coils: <strong className="text-teal-700">{group.tightVolCount}</strong></span>
                  </div>
                  <span className="text-gray-400">Avg Vol Rank: #{group.avgVolRank}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
