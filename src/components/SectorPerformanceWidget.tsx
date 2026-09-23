import React, { useState, useMemo } from 'react';
import { MinerviniTradeSetup } from '../types';
import { getCurrencySymbol, formatCurrency } from '../utils/sepaCalculator';
import {
  Layers,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  Flame,
  Award,
  Filter,
  ChevronDown,
  ChevronUp,
  Zap,
  Sparkles
} from 'lucide-react';

export interface SectorPerformanceWidgetProps {
  stocks: MinerviniTradeSetup[];
  onSelectStock?: (stock: MinerviniTradeSetup) => void;
  onFilterSector?: (sector: string) => void;
}

interface SectorStat {
  sector: string;
  totalStocks: number;
  qualifiedLeaders: number; // RS >= 80 & trendScore >= 7
  tightVolCount: number;
  avgRsRating: number;
  avgChangePercent: number;
  avgVolumeDryUp: number;
  topStock: MinerviniTradeSetup;
  allStocks: MinerviniTradeSetup[];
  flowState: 'HEAVY_INFLOW' | 'MODERATE_INFLOW' | 'ACCUMULATION' | 'LAGGING';
}

export const SectorPerformanceWidget: React.FC<SectorPerformanceWidgetProps> = ({
  stocks,
  onSelectStock,
  onFilterSector,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [sortBy, setSortBy] = useState<'RS' | 'CHANGE' | 'LEADERS'>('RS');
  const [activeSectorFilter, setActiveSectorFilter] = useState<string | null>(null);

  const sectorStats: SectorStat[] = useMemo(() => {
    const map = new Map<string, MinerviniTradeSetup[]>();

    stocks.forEach((stock) => {
      const sec = (stock.sector || 'Unassigned').trim();
      if (!map.has(sec)) {
        map.set(sec, []);
      }
      map.get(sec)!.push(stock);
    });

    const stats: SectorStat[] = [];

    map.forEach((secStocks, sector) => {
      const totalStocks = secStocks.length;
      const qualifiedLeaders = secStocks.filter(
        (s) => s.rsRating >= 80 && (s.trendScore ?? 7) >= 7
      ).length;
      const tightVolCount = secStocks.filter((s) => s.isTightVolume).length;

      const avgRs =
        secStocks.reduce((sum, s) => sum + (s.rsRating || 50), 0) / totalStocks;

      const avgChange =
        secStocks.reduce((sum, s) => {
          const chg = s.changePercent ?? 0;
          return sum + chg;
        }, 0) / totalStocks;

      const avgDryUp =
        secStocks.reduce((sum, s) => sum + (s.volumeDryUpPercent || 0), 0) /
        totalStocks;

      // Top stock sorted by RS Rating and trendScore
      const sortedByStrength = [...secStocks].sort((a, b) => {
        if ((b.rsRating || 0) !== (a.rsRating || 0)) {
          return (b.rsRating || 0) - (a.rsRating || 0);
        }
        return (b.trendScore || 0) - (a.trendScore || 0);
      });

      const topStock = sortedByStrength[0];

      let flowState: SectorStat['flowState'] = 'ACCUMULATION';
      if (avgRs >= 85 && avgChange >= 1.0) {
        flowState = 'HEAVY_INFLOW';
      } else if (avgRs >= 78 || avgChange >= 0.5) {
        flowState = 'MODERATE_INFLOW';
      } else if (avgRs < 65 && avgChange < 0) {
        flowState = 'LAGGING';
      }

      stats.push({
        sector,
        totalStocks,
        qualifiedLeaders,
        tightVolCount,
        avgRsRating: Math.round(avgRs),
        avgChangePercent: Number(avgChange.toFixed(2)),
        avgVolumeDryUp: Math.round(avgDryUp),
        topStock,
        allStocks: secStocks,
        flowState,
      });
    });

    // Sort
    return stats.sort((a, b) => {
      if (sortBy === 'RS') {
        return b.avgRsRating - a.avgRsRating;
      }
      if (sortBy === 'CHANGE') {
        return b.avgChangePercent - a.avgChangePercent;
      }
      return b.qualifiedLeaders - a.qualifiedLeaders || b.totalStocks - a.totalStocks;
    });
  }, [stocks, sortBy]);

  const handleSectorClick = (sector: string) => {
    if (activeSectorFilter === sector) {
      setActiveSectorFilter(null);
      if (onFilterSector) onFilterSector('');
    } else {
      setActiveSectorFilter(sector);
      if (onFilterSector) onFilterSector(sector);
    }
  };

  if (!stocks || stocks.length === 0) return null;

  return (
    <div className="bg-[#121720] border border-[#263246] text-white shadow-lg overflow-hidden">
      {/* Header Bar */}
      <div className="px-4 py-3 bg-[#182130] border-b border-[#263246] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-bold">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400">
                Sector Performance & Leadership Matrix
              </span>
              <span className="bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-[9px] font-mono px-2 py-0.5 font-bold uppercase">
                SEPA Rotation
              </span>
            </div>
            <p className="text-[11px] text-gray-400 font-mono">
              {sectorStats.length} active sectors • Ranked by institutional relative strength &amp; capital flow
            </p>
          </div>
        </div>

        {/* Sort & Toggle Controls */}
        <div className="flex items-center space-x-2 font-mono text-xs">
          <div className="flex items-center bg-[#0d1117] border border-[#263246] p-0.5 text-[10px]">
            <button
              type="button"
              onClick={() => setSortBy('RS')}
              className={`px-2 py-1 font-bold transition-colors cursor-pointer ${
                sortBy === 'RS' ? 'bg-amber-500 text-black' : 'text-gray-400 hover:text-white'
              }`}
            >
              Top RS
            </button>
            <button
              type="button"
              onClick={() => setSortBy('CHANGE')}
              className={`px-2 py-1 font-bold transition-colors cursor-pointer ${
                sortBy === 'CHANGE' ? 'bg-amber-500 text-black' : 'text-gray-400 hover:text-white'
              }`}
            >
              Top 1D %
            </button>
            <button
              type="button"
              onClick={() => setSortBy('LEADERS')}
              className={`px-2 py-1 font-bold transition-colors cursor-pointer ${
                sortBy === 'LEADERS' ? 'bg-amber-500 text-black' : 'text-gray-400 hover:text-white'
              }`}
            >
              Leaders
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 bg-[#0d1117] border border-[#263246] hover:border-amber-400/50 text-gray-300 transition cursor-pointer"
            title={isExpanded ? 'Collapse Sector Grid' : 'Expand Sector Grid'}
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Grid Content */}
      {isExpanded && (
        <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
          {sectorStats.map((sec) => {
            const isSelected = activeSectorFilter === sec.sector;
            const currency = getCurrencySymbol(sec.topStock?.exchange);

            return (
              <div
                key={sec.sector}
                onClick={() => handleSectorClick(sec.sector)}
                className={`p-3 border transition-all cursor-pointer select-none relative ${
                  isSelected
                    ? 'bg-[#1b263b] border-amber-400 shadow-md ring-1 ring-amber-400'
                    : 'bg-[#151c28] border-[#222d3d] hover:border-amber-500/50 hover:bg-[#182233]'
                }`}
              >
                {/* Sector Header */}
                <div className="flex items-start justify-between gap-1 mb-2">
                  <div>
                    <h4 className="font-bold text-xs font-mono text-white truncate max-w-[170px]" title={sec.sector}>
                      {sec.sector}
                    </h4>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {sec.totalStocks} stocks • {sec.qualifiedLeaders} leaders
                    </span>
                  </div>

                  {/* Flow Badge */}
                  <span
                    className={`text-[9px] font-mono font-bold px-1.5 py-0.5 uppercase shrink-0 border ${
                      sec.flowState === 'HEAVY_INFLOW'
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                        : sec.flowState === 'MODERATE_INFLOW'
                        ? 'bg-teal-950 text-teal-300 border-teal-600'
                        : sec.flowState === 'LAGGING'
                        ? 'bg-rose-950 text-rose-300 border-rose-600'
                        : 'bg-slate-900 text-gray-300 border-slate-700'
                    }`}
                  >
                    {sec.flowState === 'HEAVY_INFLOW'
                      ? '⚡ INFLOW'
                      : sec.flowState === 'MODERATE_INFLOW'
                      ? 'ACCUM'
                      : sec.flowState === 'LAGGING'
                      ? 'LAG'
                      : 'NEUTRAL'}
                  </span>
                </div>

                {/* Metrics Row */}
                <div className="grid grid-cols-2 gap-2 py-1.5 border-y border-[#263246]/60 text-xs font-mono mb-2">
                  <div>
                    <span className="text-[9px] text-gray-400 block uppercase">Avg RS Rating</span>
                    <span
                      className={`font-bold ${
                        sec.avgRsRating >= 85
                          ? 'text-amber-300'
                          : sec.avgRsRating >= 75
                          ? 'text-emerald-300'
                          : 'text-gray-300'
                      }`}
                    >
                      {sec.avgRsRating} / 99
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] text-gray-400 block uppercase">Avg 1D Change</span>
                    <span
                      className={`font-bold flex items-center ${
                        sec.avgChangePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {sec.avgChangePercent >= 0 ? (
                        <TrendingUp className="w-3 h-3 mr-0.5 inline" />
                      ) : (
                        <TrendingDown className="w-3 h-3 mr-0.5 inline" />
                      )}
                      {sec.avgChangePercent >= 0 ? '+' : ''}
                      {sec.avgChangePercent.toFixed(2)}%
                    </span>
                  </div>
                </div>

                {/* Top Stock in Sector */}
                {sec.topStock && (
                  <div className="flex items-center justify-between pt-0.5">
                    <div className="flex items-center space-x-1.5 text-[11px] font-mono">
                      <Award className="w-3 h-3 text-amber-400" />
                      <span className="text-gray-400 text-[10px]">Top:</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onSelectStock) onSelectStock(sec.topStock);
                        }}
                        className="font-bold text-amber-300 hover:underline hover:text-amber-200 cursor-pointer"
                        title={`View ${sec.topStock.name} trade plan`}
                      >
                        {sec.topStock.ticker}
                      </button>
                    </div>

                    <span className="text-[10px] font-mono text-gray-300">
                      {formatCurrency(sec.topStock.currentPrice, currency)}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
