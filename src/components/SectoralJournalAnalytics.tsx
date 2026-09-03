import React from 'react';
import { MinerviniTradeSetup, TradeJournalNote } from '../types';
import {
  computeSectorJournalSummaries,
  computePatternJournalSummaries,
  SectorJournalSummary,
  PatternJournalSummary,
} from '../utils/smartJournalEngine';
import {
  Building2,
  TrendingUp,
  Layers,
  Award,
  Filter,
  Flame,
  ArrowUpRight,
  ShieldCheck,
  Zap,
  Compass,
  PieChart,
  BarChart2,
} from 'lucide-react';

interface SectoralJournalAnalyticsProps {
  notes: TradeJournalNote[];
  allStocks: MinerviniTradeSetup[];
  onFilterBySector: (sectorName: string) => void;
  onFilterByPattern: (patternName: string) => void;
}

export const SectoralJournalAnalytics: React.FC<SectoralJournalAnalyticsProps> = ({
  notes,
  allStocks,
  onFilterBySector,
  onFilterByPattern,
}) => {
  const sectorSummaries: SectorJournalSummary[] = computeSectorJournalSummaries(notes, allStocks);
  const patternSummaries: PatternJournalSummary[] = computePatternJournalSummaries(notes);

  const totalTrades = notes.length;
  const bestSector = sectorSummaries[0];
  const bestPattern = patternSummaries[0];

  const getFlowBadge = (state: string) => {
    switch (state) {
      case 'HEAVY_INFLOW':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300';
      case 'MODERATE_INFLOW':
        return 'bg-blue-100 text-blue-900 border-blue-300';
      case 'ROTATIONAL':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      default:
        return 'bg-red-100 text-red-900 border-red-300';
    }
  };

  return (
    <div className="space-y-6 font-mono">
      {/* Top Banner & Minervini Principle */}
      <div className="bg-[#1a1a1a] text-white p-5 border border-black space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-amber-500 text-black">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-serif font-black uppercase tracking-wider text-amber-400">
                Sectoral & Pattern Performance Matrix
              </h3>
              <p className="text-xs text-gray-400 font-sans mt-0.5">
                Top-down performance audit: Measuring edge by industry group tailwinds and SEPA pattern geometry
              </p>
            </div>
          </div>
          <div className="text-right text-xs">
            <span className="text-gray-400 block text-[10px] uppercase">Logged Sample</span>
            <strong className="text-white text-sm">{totalTrades} Trades Across {sectorSummaries.length} Sectors</strong>
          </div>
        </div>

        {/* Minervini Quote */}
        <div className="bg-black/50 p-3 border border-gray-800 text-xs font-serif italic text-amber-200/90 leading-relaxed">
          "According to empirical studies, over 50% of a winning stock's price appreciation is directly propelled by the momentum of its broad market and industry group. Never fight group distribution—always align your capital with leading stocks in top-ranked sectors."
          <span className="block text-[10px] text-gray-400 font-sans font-bold uppercase not-italic mt-1">
            — Mark Minervini, Trade Like a Stock Market Wizard
          </span>
        </div>
      </div>

      {/* Highlights Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#f9f8f5] p-4 border border-[#e5e4e1]">
          <span className="text-[10px] uppercase font-bold text-gray-500 block mb-1">
            Top Performing Sector
          </span>
          <div className="text-base font-bold text-[#1a1a1a] flex items-center justify-between">
            <span>{bestSector ? bestSector.sector : 'N/A'}</span>
            {bestSector && (
              <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 border border-emerald-200">
                {bestSector.winRate}% Win Rate
              </span>
            )}
          </div>
          <p className="text-[11px] text-gray-500 font-mono mt-1">
            {bestSector ? `+${bestSector.totalRMultiple}R Total Generated` : 'No data logged'}
          </p>
        </div>

        <div className="bg-[#f9f8f5] p-4 border border-[#e5e4e1]">
          <span className="text-[10px] uppercase font-bold text-gray-500 block mb-1">
            Top Performing Pattern
          </span>
          <div className="text-base font-bold text-[#1a1a1a] flex items-center justify-between">
            <span>{bestPattern ? bestPattern.pattern : 'N/A'}</span>
            {bestPattern && (
              <span className="text-xs text-purple-700 bg-purple-50 px-2 py-0.5 border border-purple-200">
                {bestPattern.winRate}% Win Rate
              </span>
            )}
          </div>
          <p className="text-[11px] text-gray-500 font-mono mt-1">
            {bestPattern ? `+${bestPattern.totalRMultiple}R Across ${bestPattern.tradeCount} Trades` : 'No data logged'}
          </p>
        </div>

        <div className="bg-[#f9f8f5] p-4 border border-[#e5e4e1]">
          <span className="text-[10px] uppercase font-bold text-gray-500 block mb-1">
            Sectoral Concentration
          </span>
          <div className="text-base font-bold text-[#1a1a1a]">
            {sectorSummaries.length} Active Industry Themes
          </div>
          <p className="text-[11px] text-gray-500 font-mono mt-1">
            Minervini rule: Limit portfolio to 3-4 top leading groups
          </p>
        </div>
      </div>

      {/* Sector Performance Table */}
      <div className="bg-white border border-[#e5e4e1] overflow-hidden">
        <div className="p-4 border-b border-[#e5e4e1] bg-[#fdfcf9] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <Building2 className="w-4 h-4 text-purple-700" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#1a1a1a]">
              Sectoral P&L & Win Rate Breakdown
            </h4>
          </div>
          <span className="text-[10px] text-gray-500">
            Click any sector row to filter trade diary by that industry
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#f2efe9] text-gray-600 uppercase text-[9px] tracking-wider border-b border-[#e5e4e1]">
                <th className="p-3">Sector</th>
                <th className="p-3 text-center">Flow Status</th>
                <th className="p-3 text-center">Trades</th>
                <th className="p-3 text-center">Win / Loss</th>
                <th className="p-3 text-right">Win Rate</th>
                <th className="p-3 text-right">Total Net Return</th>
                <th className="p-3 text-right">Total R-Multiple</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e4e1]">
              {sectorSummaries.map((s) => (
                <tr
                  key={s.sector}
                  className="hover:bg-amber-50/50 transition-colors group cursor-pointer"
                  onClick={() => onFilterBySector(s.sector)}
                >
                  <td className="p-3 font-bold text-[#1a1a1a]">
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                      <span>{s.sector}</span>
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    <span className={`text-[9px] font-bold px-2 py-0.5 border uppercase ${getFlowBadge(s.flowState)}`}>
                      {s.flowState.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-3 text-center font-bold text-gray-700">{s.tradeCount}</td>
                  <td className="p-3 text-center text-gray-600 text-[11px]">
                    <span className="text-emerald-700 font-bold">{s.winCount}W</span>
                    <span className="text-gray-400 mx-1">/</span>
                    <span className="text-red-600 font-bold">{s.lossCount}L</span>
                    {s.scratchCount > 0 && (
                      <span className="text-gray-500 ml-1">({s.scratchCount}S)</span>
                    )}
                  </td>
                  <td className="p-3 text-right font-bold">
                    <span className={s.winRate >= 60 ? 'text-emerald-700' : s.winRate >= 45 ? 'text-amber-700' : 'text-red-700'}>
                      {s.winRate}%
                    </span>
                  </td>
                  <td className="p-3 text-right font-bold">
                    <span className={s.totalReturnPct >= 0 ? 'text-emerald-700' : 'text-red-700'}>
                      {s.totalReturnPct >= 0 ? '+' : ''}{s.totalReturnPct}%
                    </span>
                  </td>
                  <td className="p-3 text-right font-bold">
                    <span className={s.totalRMultiple >= 0 ? 'text-emerald-700 font-black' : 'text-red-700'}>
                      {s.totalRMultiple >= 0 ? '+' : ''}{s.totalRMultiple}R
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onFilterBySector(s.sector);
                      }}
                      className="text-[10px] font-bold text-purple-700 hover:text-purple-900 border border-purple-200 bg-purple-50 hover:bg-purple-100 px-2 py-1 uppercase tracking-wider flex items-center space-x-1 mx-auto"
                    >
                      <Filter className="w-3 h-3" />
                      <span>Filter</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pattern Performance Table */}
      <div className="bg-white border border-[#e5e4e1] overflow-hidden">
        <div className="p-4 border-b border-[#e5e4e1] bg-[#fdfcf9] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-emerald-700" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#1a1a1a]">
              Pattern Geometry Performance Matrix
            </h4>
          </div>
          <span className="text-[10px] text-gray-500">
            Compare win rates and expectancy between VCP, Flags, and Pullbacks
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#f2efe9] text-gray-600 uppercase text-[9px] tracking-wider border-b border-[#e5e4e1]">
                <th className="p-3">Pattern Type</th>
                <th className="p-3 text-center">Trade Count</th>
                <th className="p-3 text-center">Wins / Losses</th>
                <th className="p-3 text-right">Win Rate</th>
                <th className="p-3 text-right">Avg R / Trade</th>
                <th className="p-3 text-right">Total R-Multiple</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e4e1]">
              {patternSummaries.map((p) => (
                <tr
                  key={p.pattern}
                  className="hover:bg-emerald-50/40 transition-colors group cursor-pointer"
                  onClick={() => onFilterByPattern(p.pattern)}
                >
                  <td className="p-3 font-bold text-[#1a1a1a]">
                    <div className="flex items-center space-x-2">
                      <Zap className="w-3.5 h-3.5 text-amber-600" />
                      <span>{p.pattern}</span>
                    </div>
                  </td>
                  <td className="p-3 text-center font-bold text-gray-700">{p.tradeCount}</td>
                  <td className="p-3 text-center text-gray-600 text-[11px]">
                    <span className="text-emerald-700 font-bold">{p.winCount}W</span>
                    <span className="text-gray-400 mx-1">/</span>
                    <span className="text-red-600 font-bold">{p.lossCount}L</span>
                  </td>
                  <td className="p-3 text-right font-bold">
                    <span className={p.winRate >= 60 ? 'text-emerald-700' : p.winRate >= 45 ? 'text-amber-700' : 'text-red-700'}>
                      {p.winRate}%
                    </span>
                  </td>
                  <td className="p-3 text-right font-bold text-gray-700">
                    {p.avgRMultiple >= 0 ? '+' : ''}{p.avgRMultiple}R
                  </td>
                  <td className="p-3 text-right font-bold">
                    <span className={p.totalRMultiple >= 0 ? 'text-emerald-700 font-black' : 'text-red-700'}>
                      {p.totalRMultiple >= 0 ? '+' : ''}{p.totalRMultiple}R
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onFilterByPattern(p.pattern);
                      }}
                      className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 uppercase tracking-wider flex items-center space-x-1 mx-auto"
                    >
                      <Filter className="w-3 h-3" />
                      <span>Filter</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
