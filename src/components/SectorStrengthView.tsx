import React, { useState, useMemo, useEffect } from 'react';
import {
  MinerviniTradeSetup,
  SectorVolatilityAlertSettings,
  SectorVolatilityAlertPayload,
} from '../types';
import { formatCurrency, getCurrencySymbol } from '../utils/sepaCalculator';
import { SectorPerformanceWidget } from './SectorPerformanceWidget';
import { SectorCorrelationMatrix } from './SectorCorrelationMatrix';
import { SectorRadarChart } from './SectorRadarChart';
import { RelativeRotationGraph } from './RelativeRotationGraph';
import { DailySectorPerformanceDashboard } from './DailySectorPerformanceDashboard';
import {
  getSectorVolatilityAlertSettings,
  saveSectorVolatilityAlertSettings,
  getSectorVolatilityAlertHistory,
  saveSectorVolatilityAlertHistory,
  simulateSectorVolatilitySurgeAlert,
  evaluateSectorVolatilityAlerts,
  DEFAULT_SECTOR_VOLATILITY_SETTINGS,
} from '../utils/sectorVolatilityAlertEngine';
import {
  calculateStockAnnualizedHv,
  mapRelativeVolToRank,
  MARKET_INDEX_VOLATILITY,
} from '../utils/volatilityRankCalculator';
import {
  Layers,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  Flame,
  ShieldCheck,
  ChevronRight,
  Activity,
  BarChart2,
  Filter,
  Search,
  Award,
  Zap,
  Gauge,
  ArrowDownRight,
  Eye,
  SlidersHorizontal,
  DollarSign,
  Building2,
  ChevronDown,
  ChevronUp,
  ListFilter,
  Compass,
  Star,
  BellRing,
  AlertTriangle,
  Settings,
  RefreshCw,
  History,
  Info,
  Volume2,
  CheckCircle2,
  ShieldAlert,
  X,
  VolumeX,
} from 'lucide-react';

interface SectorStrengthViewProps {
  stocks: MinerviniTradeSetup[];
  onSelectStock: (stock: MinerviniTradeSetup) => void;
  onViewChart: (stock: MinerviniTradeSetup) => void;
  onFilterBySector: (sectorName: string) => void;
  onNavigateToFivePaisa?: () => void;
}

export type HeatmapMetric = 'AVG_CHANGE' | 'MONEY_FLOW' | 'RS_SCORE' | 'DRY_UP' | 'VOLATILITY_RATING';

export interface SectorAggregate {
  sector: string;
  stockCount: number;
  avgChange: number;
  avgDryUp: number;
  avgSepaScore: number;
  avgRsRating: number;
  qualifiedCount: number;
  topStock: MinerviniTradeSetup;
  allStocks: MinerviniTradeSetup[];
  rsScore: number; // 0 - 99
  moneyFlowIndex: number; // 0 - 100
  flowState: 'HEAVY_INFLOW' | 'MODERATE_INFLOW' | 'ROTATIONAL' | 'OUTFLOW';
  flowLabel: string;
  heatmapColorBg: string;
  heatmapText: string;
  heatmapBorder: string;
  rank: number;
  // Volatility vs Broader Market
  avgSectorHvAnnualized: number;
  marketBenchmark: string;
  marketHvAnnualized: number;
  relativeVolatilityRatio: number;
  avgVolatilityRank: number;
  volatilityTier: 'LOW_VOL' | 'MODERATE_VOL' | 'HIGH_VOL' | 'EXTREME_VOL';
  isVolatilityThresholdBreached: boolean;
}

export const SectorStrengthView: React.FC<SectorStrengthViewProps> = ({
  stocks,
  onSelectStock,
  onViewChart,
  onFilterBySector,
  onNavigateToFivePaisa
}) => {
  const [heatmapMetric, setHeatmapMetric] = useState<HeatmapMetric>('AVG_CHANGE');
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [sectorSearch, setSectorSearch] = useState<string>('');
  const [displayMode, setDisplayMode] = useState<
    | 'DAILY_SECTOR_PERFORMANCE'
    | 'COMBINED'
    | 'HEATMAP_ONLY'
    | 'LEADERBOARD_ONLY'
    | 'RRG_ROTATION'
    | 'RADAR_ANALYSIS'
    | 'CORRELATION_MATRIX'
  >('DAILY_SECTOR_PERFORMANCE');

  // Real-time Sector Volatility Alert System States
  const [alertSettings, setAlertSettings] = useState<SectorVolatilityAlertSettings>(getSectorVolatilityAlertSettings());
  const [tempSettings, setTempSettings] = useState<SectorVolatilityAlertSettings>(getSectorVolatilityAlertSettings());
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState<boolean>(false);
  const [alertHistory, setAlertHistory] = useState<SectorVolatilityAlertPayload[]>(getSectorVolatilityAlertHistory());
  const [alertMessageNotice, setAlertMessageNotice] = useState<string | null>(null);

  useEffect(() => {
    const handleAlert = (e: Event) => {
      const customEvt = e as CustomEvent<SectorVolatilityAlertPayload>;
      if (customEvt.detail) {
        setAlertHistory(getSectorVolatilityAlertHistory());
        setAlertMessageNotice(
          `⚡ ${customEvt.detail.sector} crossed threshold (${customEvt.detail.relativeVolatilityRatio}x vs ${customEvt.detail.marketBenchmark})`
        );
        setTimeout(() => setAlertMessageNotice(null), 9000);
      }
    };
    const handleHistoryUpdate = () => {
      setAlertHistory(getSectorVolatilityAlertHistory());
    };
    const handleSettingsUpdate = (e: Event) => {
      const customEvt = e as CustomEvent<SectorVolatilityAlertSettings>;
      if (customEvt.detail) {
        setAlertSettings(customEvt.detail);
        setTempSettings(customEvt.detail);
      }
    };

    window.addEventListener('minervini_sector_volatility_alert', handleAlert);
    window.addEventListener('minervini_sector_volatility_history_updated', handleHistoryUpdate);
    window.addEventListener('minervini_sector_volatility_settings_updated', handleSettingsUpdate);

    return () => {
      window.removeEventListener('minervini_sector_volatility_alert', handleAlert);
      window.removeEventListener('minervini_sector_volatility_history_updated', handleHistoryUpdate);
      window.removeEventListener('minervini_sector_volatility_settings_updated', handleSettingsUpdate);
    };
  }, []);

  // Compute aggregated sector metrics
  const sectorAggregates = useMemo(() => {
    const map = new Map<string, MinerviniTradeSetup[]>();
    stocks.forEach((s) => {
      const sec = s.sector || 'General Market';
      if (!map.has(sec)) map.set(sec, []);
      map.get(sec)!.push(s);
    });

    const result: SectorAggregate[] = [];
    
    map.forEach((secStocks, sector) => {
      const stockCount = secStocks.length;
      const totalChange = secStocks.reduce((sum, s) => sum + s.changePercent, 0);
      const avgChange = totalChange / (stockCount || 1);

      const totalDryUp = secStocks.reduce((sum, s) => sum + s.volumeDryUpPercent, 0);
      const avgDryUp = totalDryUp / (stockCount || 1);

      const totalSepa = secStocks.reduce((sum, s) => sum + s.trendScore, 0);
      const avgSepaScore = totalSepa / (stockCount || 1);

      const totalRs = secStocks.reduce((sum, s) => sum + (s.rsRating || 50), 0);
      const avgRsRating = totalRs / (stockCount || 1);

      const qualifiedCount = secStocks.filter((s) => s.trendScore === 8 || s.isTightVolume).length;

      // Find top performing stock in sector by changePercent & RS rating
      const sortedByPerformance = [...secStocks].sort((a, b) => b.changePercent - a.changePercent);
      const topStock = sortedByPerformance[0];

      // Relative strength score calculation (0 - 99)
      const rsScore = Math.min(99, Math.max(10, Math.round(50 + avgChange * 4 + (qualifiedCount * 5) + (avgRsRating - 50) * 0.4)));

      // Institutional Money Flow Index (0 - 100)
      const dryUpFactor = Math.min(30, Math.max(0, Math.abs(avgDryUp) * 0.5));
      const sepaFactor = (avgSepaScore / 8) * 20;
      const changeFactor = Math.min(30, Math.max(-20, avgChange * 6));
      const rsFactor = (avgRsRating / 99) * 20;

      const moneyFlowIndex = Math.min(100, Math.max(0, Math.round(30 + changeFactor + dryUpFactor + sepaFactor + rsFactor)));

      // Money Flow State
      let flowState: 'HEAVY_INFLOW' | 'MODERATE_INFLOW' | 'ROTATIONAL' | 'OUTFLOW' = 'ROTATIONAL';
      let flowLabel = 'Rotational / In-Line';

      if (moneyFlowIndex >= 75 || avgChange >= 2.0) {
        flowState = 'HEAVY_INFLOW';
        flowLabel = 'Heavy Accumulation';
      } else if (moneyFlowIndex >= 55 || avgChange > 0.3) {
        flowState = 'MODERATE_INFLOW';
        flowLabel = 'Institutional Inflow';
      } else if (moneyFlowIndex >= 38 || avgChange >= -0.8) {
        flowState = 'ROTATIONAL';
        flowLabel = 'Neutral / Rotational';
      } else {
        flowState = 'OUTFLOW';
        flowLabel = 'Distribution / Outflow';
      }

      // Sector Volatility vs Broader Market Benchmark
      const isIndia = secStocks.some((s) => s.exchange === 'NSE' || s.exchange === 'BSE');
      const marketInfo = isIndia ? MARKET_INDEX_VOLATILITY.NSE_BSE : MARKET_INDEX_VOLATILITY.US;
      const totalStockHv = secStocks.reduce((sum, s) => sum + calculateStockAnnualizedHv(s), 0);
      const avgSectorHvAnnualized = Number((totalStockHv / (stockCount || 1)).toFixed(2));
      const marketHvAnnualized = marketInfo.hvAnnualized;
      const relativeVolatilityRatio = Number((avgSectorHvAnnualized / (marketHvAnnualized || 1)).toFixed(2));
      const avgVolatilityRank = mapRelativeVolToRank(relativeVolatilityRatio);

      let volatilityTier: 'LOW_VOL' | 'MODERATE_VOL' | 'HIGH_VOL' | 'EXTREME_VOL' = 'MODERATE_VOL';
      if (avgVolatilityRank <= 35 || relativeVolatilityRatio < 1.05) volatilityTier = 'LOW_VOL';
      else if (avgVolatilityRank >= 90 || relativeVolatilityRatio >= 2.40) volatilityTier = 'EXTREME_VOL';
      else if (avgVolatilityRank >= 71 || relativeVolatilityRatio >= 1.65) volatilityTier = 'HIGH_VOL';

      const isVolatilityThresholdBreached =
        alertSettings.comparisonMode === 'RATIO_VS_MARKET'
          ? relativeVolatilityRatio >= alertSettings.ratioThreshold
          : avgVolatilityRank >= alertSettings.rankThreshold;

      // Heatmap Color Assignment based on active metric
      let heatmapColorBg = 'bg-slate-800';
      let heatmapText = 'text-white';
      let heatmapBorder = 'border-slate-700';

      if (heatmapMetric === 'AVG_CHANGE') {
        if (avgChange >= 2.0) {
          heatmapColorBg = 'bg-emerald-900/90 hover:bg-emerald-800';
          heatmapText = 'text-emerald-200';
          heatmapBorder = 'border-emerald-600';
        } else if (avgChange >= 0.5) {
          heatmapColorBg = 'bg-teal-900/90 hover:bg-teal-800';
          heatmapText = 'text-teal-200';
          heatmapBorder = 'border-teal-600';
        } else if (avgChange >= -0.5) {
          heatmapColorBg = 'bg-slate-800 hover:bg-slate-700';
          heatmapText = 'text-slate-200';
          heatmapBorder = 'border-slate-600';
        } else if (avgChange >= -2.0) {
          heatmapColorBg = 'bg-amber-950/90 hover:bg-amber-900';
          heatmapText = 'text-amber-200';
          heatmapBorder = 'border-amber-600';
        } else {
          heatmapColorBg = 'bg-rose-950/90 hover:bg-rose-900';
          heatmapText = 'text-rose-200';
          heatmapBorder = 'border-rose-600';
        }
      } else if (heatmapMetric === 'MONEY_FLOW') {
        if (moneyFlowIndex >= 75) {
          heatmapColorBg = 'bg-emerald-900/90 hover:bg-emerald-800';
          heatmapText = 'text-emerald-200';
          heatmapBorder = 'border-emerald-500';
        } else if (moneyFlowIndex >= 55) {
          heatmapColorBg = 'bg-teal-900/90 hover:bg-teal-800';
          heatmapText = 'text-teal-200';
          heatmapBorder = 'border-teal-500';
        } else if (moneyFlowIndex >= 38) {
          heatmapColorBg = 'bg-slate-800 hover:bg-slate-700';
          heatmapText = 'text-slate-200';
          heatmapBorder = 'border-slate-600';
        } else {
          heatmapColorBg = 'bg-rose-950/90 hover:bg-rose-900';
          heatmapText = 'text-rose-200';
          heatmapBorder = 'border-rose-600';
        }
      } else if (heatmapMetric === 'RS_SCORE') {
        if (rsScore >= 75) {
          heatmapColorBg = 'bg-emerald-900/90 hover:bg-emerald-800';
          heatmapText = 'text-emerald-200';
          heatmapBorder = 'border-emerald-500';
        } else if (rsScore >= 55) {
          heatmapColorBg = 'bg-teal-900/90 hover:bg-teal-800';
          heatmapText = 'text-teal-200';
          heatmapBorder = 'border-teal-500';
        } else {
          heatmapColorBg = 'bg-amber-950/90 hover:bg-amber-900';
          heatmapText = 'text-amber-200';
          heatmapBorder = 'border-amber-600';
        }
      } else if (heatmapMetric === 'DRY_UP') {
        if (avgDryUp <= -50) {
          heatmapColorBg = 'bg-emerald-900/90 hover:bg-emerald-800';
          heatmapText = 'text-emerald-200';
          heatmapBorder = 'border-emerald-500';
        } else if (avgDryUp <= -35) {
          heatmapColorBg = 'bg-teal-900/90 hover:bg-teal-800';
          heatmapText = 'text-teal-200';
          heatmapBorder = 'border-teal-500';
        } else {
          heatmapColorBg = 'bg-slate-800 hover:bg-slate-700';
          heatmapText = 'text-slate-200';
          heatmapBorder = 'border-slate-600';
        }
      } else if (heatmapMetric === 'VOLATILITY_RATING') {
        if (relativeVolatilityRatio >= 2.2 || avgVolatilityRank >= 88) {
          heatmapColorBg = 'bg-rose-950/90 hover:bg-rose-900';
          heatmapText = 'text-rose-200';
          heatmapBorder = 'border-rose-500 shadow-lg shadow-rose-950/50';
        } else if (relativeVolatilityRatio >= 1.65 || avgVolatilityRank >= 71) {
          heatmapColorBg = 'bg-amber-950/90 hover:bg-amber-900';
          heatmapText = 'text-amber-200';
          heatmapBorder = 'border-amber-500 shadow-md shadow-amber-950/40';
        } else if (relativeVolatilityRatio >= 1.05) {
          heatmapColorBg = 'bg-teal-950/90 hover:bg-teal-900';
          heatmapText = 'text-teal-200';
          heatmapBorder = 'border-teal-600';
        } else {
          heatmapColorBg = 'bg-emerald-950/90 hover:bg-emerald-900';
          heatmapText = 'text-emerald-200';
          heatmapBorder = 'border-emerald-500';
        }
      }

      result.push({
        sector,
        stockCount,
        avgChange: Number(avgChange.toFixed(2)),
        avgDryUp: Number(avgDryUp.toFixed(1)),
        avgSepaScore: Number(avgSepaScore.toFixed(1)),
        avgRsRating: Number(avgRsRating.toFixed(1)),
        qualifiedCount,
        topStock,
        allStocks: sortedByPerformance,
        rsScore,
        moneyFlowIndex,
        flowState,
        flowLabel,
        heatmapColorBg,
        heatmapText,
        heatmapBorder,
        rank: 0,
        avgSectorHvAnnualized,
        marketBenchmark: marketInfo.name,
        marketHvAnnualized,
        relativeVolatilityRatio,
        avgVolatilityRank,
        volatilityTier,
        isVolatilityThresholdBreached,
      });
    });

    // Sort by selected metric descending for initial ranking
    const sorted = result.sort((a, b) => {
      if (heatmapMetric === 'VOLATILITY_RATING') {
        return b.relativeVolatilityRatio - a.relativeVolatilityRatio;
      }
      return b.moneyFlowIndex - a.moneyFlowIndex || b.avgChange - a.avgChange;
    });
    
    // Assign numerical ranks
    sorted.forEach((item, index) => {
      item.rank = index + 1;
    });

    return sorted;
  }, [stocks, heatmapMetric, alertSettings]);

  // Filtered sectors list for search
  const filteredSectors = useMemo(() => {
    if (!sectorSearch.trim()) return sectorAggregates;
    return sectorAggregates.filter((sec) =>
      sec.sector.toLowerCase().includes(sectorSearch.toLowerCase()) ||
      sec.allStocks.some((s) => s.ticker.toLowerCase().includes(sectorSearch.toLowerCase()) || s.name.toLowerCase().includes(sectorSearch.toLowerCase()))
    );
  }, [sectorAggregates, sectorSearch]);

  // Top Sector Inflow Leader & Overall Breadth Ratio
  const topInflowSector = sectorAggregates[0];
  const totalSectorsCount = sectorAggregates.length;
  const positiveSectorsCount = sectorAggregates.filter((s) => s.avgChange > 0).length;
  const positiveSectorBreadthPct = Math.round((positiveSectorsCount / (totalSectorsCount || 1)) * 100);

  // Selected Sector Object
  const selectedSectorObj = useMemo(() => {
    if (!selectedSector) return null;
    return sectorAggregates.find((s) => s.sector.toLowerCase() === selectedSector.toLowerCase()) || null;
  }, [selectedSector, sectorAggregates]);

  // Sectors currently crossing predefined volatility threshold vs broader market
  const breachedSectors = useMemo(() => {
    return sectorAggregates.filter((s) => s.isVolatilityThresholdBreached);
  }, [sectorAggregates]);

  return (
    <div className="space-y-6">
      
      {/* SEPA Sector Performance Summary Widget */}
      <SectorPerformanceWidget
        stocks={stocks}
        onSelectStock={onSelectStock}
        onFilterSector={onFilterBySector}
      />

      {/* Sector Performance Dashboard Header & Institutional Summary Banner */}
      <div className="bg-[#161b22] border border-[#30363d] p-6 text-[#1a1a1a] space-y-5 shadow-xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-[#30363d] pb-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shrink-0">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] uppercase font-mono tracking-[0.25em] text-purple-400 font-bold block">
                  Institutional Capital Flow Engine
                </span>
                <span className="bg-purple-950/80 border border-purple-700/60 text-purple-300 text-[9px] font-mono px-2 py-0.5 font-bold uppercase">
                  Real-time Sector Heatmap
                </span>
              </div>
              <h3 className="text-xl font-serif font-black tracking-tight text-white mt-0.5">
                Sector Performance & Money Flow Dashboard
              </h3>
            </div>
          </div>

          {/* Quick Stats Summary Pills */}
          <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
            <div className="bg-[#0e1117] border border-[#30363d] px-3.5 py-2 space-y-0.5">
              <span className="text-gray-400 text-[10px] uppercase block">Industry Groups:</span>
              <strong className="text-emerald-400 font-bold text-sm">{totalSectorsCount} Sectors</strong>
            </div>
            <div className="bg-[#0e1117] border border-[#30363d] px-3.5 py-2 space-y-0.5">
              <span className="text-gray-400 text-[10px] uppercase block">Market Breadth:</span>
              <strong className={positiveSectorBreadthPct >= 50 ? 'text-emerald-400 font-bold text-sm' : 'text-rose-400 font-bold text-sm'}>
                {positiveSectorBreadthPct}% Positive ({positiveSectorsCount}/{totalSectorsCount})
              </strong>
            </div>
            {topInflowSector && (
              <div className="bg-[#0e1117] border border-purple-800/60 px-3.5 py-2 space-y-0.5">
                <span className="text-purple-400 text-[10px] uppercase block flex items-center space-x-1">
                  <Flame className="w-3 h-3 text-amber-400" />
                  <span>Top Money Inflow:</span>
                </span>
                <strong className="text-amber-300 font-bold text-sm truncate max-w-[180px] block">
                  #{topInflowSector.rank} {topInflowSector.sector}
                </strong>
              </div>
            )}
          </div>
        </div>

        {/* Real-time Sector Volatility Surveillance & Alert Threshold Bar */}
        <div className="bg-[#0e1117] border border-amber-500/40 p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs font-mono shadow-inner">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-none bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-400 shrink-0">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider flex items-center">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block mr-1.5" />
                  Real-Time Volatility Surveillance
                </span>
                <span className="bg-amber-950 text-amber-300 border border-amber-500/50 text-[9px] px-1.5 py-0.5 font-bold uppercase">
                  vs {sectorAggregates[0]?.marketBenchmark || 'Broader Market'}
                </span>
                {alertSettings.soundAlert && (
                  <span className="text-emerald-400 text-[10px]" title="Audio alerts enabled">
                    🔔
                  </span>
                )}
              </div>
              <div className="text-gray-300 text-xs mt-0.5 flex flex-wrap items-center gap-1.5">
                <span>
                  Threshold: <strong className="text-white">
                    {alertSettings.comparisonMode === 'RATIO_VS_MARKET'
                      ? `≥ ${alertSettings.ratioThreshold.toFixed(2)}x Market HV`
                      : `≥ Volatility Rank ${alertSettings.rankThreshold}/99`}
                  </strong>
                </span>
                <span className="text-gray-600">•</span>
                <span>
                  Status:{' '}
                  {breachedSectors.length > 0 ? (
                    <span className="text-rose-400 font-bold">
                      ⚠️ {breachedSectors.length} {breachedSectors.length === 1 ? 'Sector' : 'Sectors'} Exceeding ({breachedSectors.map((s) => `${s.sector} ${s.relativeVolatilityRatio}x`).join(', ')})
                    </span>
                  ) : (
                    <span className="text-emerald-400 font-bold">
                      ✓ All Sectors Calm (&lt; {alertSettings.ratioThreshold.toFixed(2)}x Threshold)
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-stretch md:self-auto justify-end">
            <button
              onClick={() => {
                simulateSectorVolatilitySurgeAlert(stocks);
              }}
              title="Test real-time alert toast notification"
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider flex items-center space-x-1.5 transition-all shadow-sm cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Simulate Surge Alert</span>
            </button>

            <button
              onClick={() => setIsHistoryDrawerOpen(!isHistoryDrawerOpen)}
              className="bg-[#1f242d] hover:bg-[#28303d] text-gray-300 hover:text-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider flex items-center space-x-1.5 border border-gray-700 transition-all cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-purple-400" />
              <span>History ({alertHistory.length})</span>
            </button>

            <button
              onClick={() => {
                setTempSettings(alertSettings);
                setIsSettingsModalOpen(true);
              }}
              className="bg-[#1f242d] hover:bg-[#28303d] text-amber-300 hover:text-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider flex items-center space-x-1.5 border border-amber-600/50 transition-all cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-amber-400" />
              <span>Configure Threshold</span>
            </button>
          </div>
        </div>

        {alertMessageNotice && (
          <div className="bg-amber-950/80 border border-amber-400 p-2.5 text-amber-200 text-xs font-mono flex items-center justify-between animate-fade-in shadow-md">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 animate-bounce" />
              <span>{alertMessageNotice}</span>
            </div>
            <button
              onClick={() => setAlertMessageNotice(null)}
              className="text-gray-400 hover:text-white text-xs font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Control Bar: Metric Selector, Search, Display Layout Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
          
          {/* Heatmap Metric Selector Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-gray-400 uppercase text-[10px] font-bold tracking-wider mr-1 flex items-center space-x-1">
              <SlidersHorizontal className="w-3.5 h-3.5 text-purple-400" />
              <span>Heatmap Metric:</span>
            </span>
            <button
              onClick={() => setHeatmapMetric('AVG_CHANGE')}
              className={`px-3 py-1.5 text-xs font-bold uppercase transition-all cursor-pointer border ${
                heatmapMetric === 'AVG_CHANGE'
                  ? 'bg-purple-900 text-white border-purple-500 shadow-md'
                  : 'bg-[#0e1117] text-gray-400 border-[#30363d] hover:text-white hover:bg-[#1f242d]'
              }`}
            >
              Avg Change %
            </button>
            <button
              onClick={() => setHeatmapMetric('MONEY_FLOW')}
              className={`px-3 py-1.5 text-xs font-bold uppercase transition-all cursor-pointer border ${
                heatmapMetric === 'MONEY_FLOW'
                  ? 'bg-purple-900 text-white border-purple-500 shadow-md'
                  : 'bg-[#0e1117] text-gray-400 border-[#30363d] hover:text-white hover:bg-[#1f242d]'
              }`}
            >
              Money Flow Index
            </button>
            <button
              onClick={() => setHeatmapMetric('RS_SCORE')}
              className={`px-3 py-1.5 text-xs font-bold uppercase transition-all cursor-pointer border ${
                heatmapMetric === 'RS_SCORE'
                  ? 'bg-purple-900 text-white border-purple-500 shadow-md'
                  : 'bg-[#0e1117] text-gray-400 border-[#30363d] hover:text-white hover:bg-[#1f242d]'
              }`}
            >
              Industry RS Rating
            </button>
            <button
              onClick={() => setHeatmapMetric('DRY_UP')}
              className={`px-3 py-1.5 text-xs font-bold uppercase transition-all cursor-pointer border ${
                heatmapMetric === 'DRY_UP'
                  ? 'bg-purple-900 text-white border-purple-500 shadow-md'
                  : 'bg-[#0e1117] text-gray-400 border-[#30363d] hover:text-white hover:bg-[#1f242d]'
              }`}
            >
              VCP Base Dry-Up
            </button>
            <button
              onClick={() => setHeatmapMetric('VOLATILITY_RATING')}
              className={`px-3 py-1.5 text-xs font-bold uppercase transition-all cursor-pointer border flex items-center space-x-1.5 ${
                heatmapMetric === 'VOLATILITY_RATING'
                  ? 'bg-amber-600 text-black border-amber-400 shadow-md font-black'
                  : 'bg-[#0e1117] text-amber-400 border-[#30363d] hover:text-white hover:bg-[#1f242d]'
              }`}
              title="Visualize relative volatility vs broader market index"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Vol vs Market</span>
            </button>
          </div>

          {/* Search Box & Display Mode Toggle */}
          <div className="flex items-center space-x-3 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:flex-initial">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={sectorSearch}
                onChange={(e) => setSectorSearch(e.target.value)}
                placeholder="Search sector or ticker..."
                className="bg-[#0e1117] border border-[#30363d] text-white placeholder-gray-500 pl-8 pr-3 py-1.5 text-xs w-full sm:w-48 focus:outline-none focus:border-purple-500"
              />
              {sectorSearch && (
                <button
                  onClick={() => setSectorSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Display Mode Selector */}
            <div className="flex flex-wrap border border-[#30363d] bg-[#0e1117] p-0.5 gap-0.5">
              <button
                onClick={() => setDisplayMode('DAILY_SECTOR_PERFORMANCE')}
                className={`px-2.5 py-1 text-[11px] font-bold uppercase transition-all flex items-center space-x-1 ${
                  displayMode === 'DAILY_SECTOR_PERFORMANCE'
                    ? 'bg-amber-500 text-black font-black shadow-md'
                    : 'text-amber-400 hover:text-white hover:bg-[#1f242d]'
                }`}
                title="Daily Sector Performance dashboard ranked by average RS rating & VCP pattern count"
              >
                <Award className="w-3 h-3" />
                <span>Daily Sector Rank</span>
              </button>
              <button
                onClick={() => setDisplayMode('COMBINED')}
                className={`px-2.5 py-1 text-[11px] font-bold uppercase transition-all ${
                  displayMode === 'COMBINED' ? 'bg-purple-900 text-white' : 'text-gray-400 hover:text-white'
                }`}
                title="View Heatmap and Leaderboard Table together"
              >
                Combined
              </button>
              <button
                onClick={() => setDisplayMode('HEATMAP_ONLY')}
                className={`px-2.5 py-1 text-[11px] font-bold uppercase transition-all ${
                  displayMode === 'HEATMAP_ONLY' ? 'bg-purple-900 text-white' : 'text-gray-400 hover:text-white'
                }`}
                title="View Heatmap Grid only"
              >
                Heatmap
              </button>
              <button
                onClick={() => setDisplayMode('LEADERBOARD_ONLY')}
                className={`px-2.5 py-1 text-[11px] font-bold uppercase transition-all ${
                  displayMode === 'LEADERBOARD_ONLY' ? 'bg-purple-900 text-white' : 'text-gray-400 hover:text-white'
                }`}
                title="View Leaderboard Table only"
              >
                Leaderboard
              </button>
              <button
                onClick={() => setDisplayMode('RRG_ROTATION')}
                className={`px-2.5 py-1 text-[11px] font-bold uppercase transition-all flex items-center space-x-1 ${
                  displayMode === 'RRG_ROTATION' ? 'bg-amber-600 text-black font-black' : 'text-amber-400 hover:text-white'
                }`}
                title="View Relative Rotation Graph (RRG) JdK Rotation Analysis"
              >
                <Compass className="w-3 h-3" />
                <span>RRG Rotation</span>
              </button>
              <button
                onClick={() => setDisplayMode('RADAR_ANALYSIS')}
                className={`px-2.5 py-1 text-[11px] font-bold uppercase transition-all ${
                  displayMode === 'RADAR_ANALYSIS' ? 'bg-purple-900 text-white' : 'text-gray-400 hover:text-white'
                }`}
                title="View D3 Sector Relative Strength Radar Chart vs Major Market Indices"
              >
                D3 Radar
              </button>
              <button
                onClick={() => setDisplayMode('CORRELATION_MATRIX')}
                className={`px-2.5 py-1 text-[11px] font-bold uppercase transition-all ${
                  displayMode === 'CORRELATION_MATRIX' ? 'bg-purple-900 text-white' : 'text-gray-400 hover:text-white'
                }`}
                title="View Sector ETF Correlation Matrix & Harmony Score"
              >
                ETF Correlation
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* DAILY SECTOR PERFORMANCE DASHBOARD (RS Ranking & VCP Pattern Count) */}
      {(displayMode === 'DAILY_SECTOR_PERFORMANCE' || displayMode === 'COMBINED') && (
        <DailySectorPerformanceDashboard
          stocks={stocks}
          onSelectStock={onSelectStock}
          onViewChart={onViewChart}
          onFilterBySector={onFilterBySector}
          onNavigateToFivePaisa={onNavigateToFivePaisa}
        />
      )}

      {/* HEATMAP VISUALIZATION GRID */}
      {(displayMode === 'COMBINED' || displayMode === 'HEATMAP_ONLY') && (
        <div className="bg-[#161b22] border border-[#30363d] p-5 space-y-4 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#30363d] pb-3 font-mono text-xs">
            <div className="flex items-center space-x-2">
              <BarChart2 className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs font-bold uppercase text-white tracking-wider">
                Sector Heatmap Grid ({filteredSectors.length} Sectors Visualized)
              </h4>
            </div>

            {/* Heatmap Legend Ramp */}
            <div className="flex flex-wrap items-center gap-2 text-[10px]">
              <span className="text-gray-400 uppercase font-bold">Intensity Legend:</span>
              {heatmapMetric === 'VOLATILITY_RATING' ? (
                <>
                  <div className="flex items-center space-x-1">
                    <span className="w-3 h-3 bg-rose-950 border border-rose-500 inline-block" />
                    <span className="text-rose-300 font-bold">Extreme Vol (&gt;2.2x)</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="w-3 h-3 bg-amber-950 border border-amber-500 inline-block" />
                    <span className="text-amber-300 font-bold">High Beta (1.65x+)</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="w-3 h-3 bg-teal-950 border border-teal-500 inline-block" />
                    <span className="text-teal-300">Market Parity (1.05x-1.65x)</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="w-3 h-3 bg-emerald-950 border border-emerald-500 inline-block" />
                    <span className="text-emerald-300 font-bold">Ultra-Tight (&lt;1.05x)</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center space-x-1">
                    <span className="w-3 h-3 bg-emerald-900 border border-emerald-500 inline-block" />
                    <span className="text-emerald-300 font-bold">Heavy Inflow / Strong (+2%+)</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="w-3 h-3 bg-teal-900 border border-teal-500 inline-block" />
                    <span className="text-teal-300">Moderate (+0.5%+)</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="w-3 h-3 bg-slate-800 border border-slate-600 inline-block" />
                    <span className="text-slate-300">Neutral / Flat</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="w-3 h-3 bg-rose-950 border border-rose-600 inline-block" />
                    <span className="text-rose-300">Outflow / Decline</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Dynamic Treemap / Bento Heatmap Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5 font-mono">
            {filteredSectors.map((sec) => {
              const isSelected = selectedSector?.toLowerCase() === sec.sector.toLowerCase();
              const currency = getCurrencySymbol(sec.topStock?.exchange || 'NSE');

              let metricDisplay = '';
              let metricSubDisplay = sec.flowLabel;
              if (heatmapMetric === 'AVG_CHANGE') {
                metricDisplay = `${sec.avgChange >= 0 ? '+' : ''}${sec.avgChange}%`;
              } else if (heatmapMetric === 'MONEY_FLOW') {
                metricDisplay = `${sec.moneyFlowIndex} Flow`;
              } else if (heatmapMetric === 'RS_SCORE') {
                metricDisplay = `RS ${sec.rsScore}`;
              } else if (heatmapMetric === 'DRY_UP') {
                metricDisplay = `${sec.avgDryUp}% Dry`;
              } else if (heatmapMetric === 'VOLATILITY_RATING') {
                metricDisplay = `${sec.relativeVolatilityRatio}x`;
                metricSubDisplay = `Rank ${sec.avgVolatilityRank} vs ${sec.marketBenchmark}`;
              }

              return (
                <div
                  key={sec.sector}
                  onClick={() => setSelectedSector(isSelected ? null : sec.sector)}
                  className={`p-4 border transition-all cursor-pointer relative flex flex-col justify-between group min-h-[145px] ${sec.heatmapColorBg} ${sec.heatmapBorder} ${
                    isSelected ? 'ring-2 ring-purple-400 ring-offset-2 ring-offset-[#161b22] scale-[1.02] z-10' : ''
                  }`}
                >
                  <div>
                    {/* Header: Rank Badge & Constituent Count */}
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <span className="text-[10px] font-bold bg-black/60 text-white px-2 py-0.5 border border-white/20">
                        #{sec.rank}
                      </span>
                      <span className="text-[10px] text-gray-300 font-sans">
                        {sec.stockCount} {sec.stockCount === 1 ? 'Stock' : 'Stocks'}
                      </span>
                    </div>

                    {/* Sector Title */}
                    <h5 className="text-sm font-serif font-bold text-white leading-tight mb-2 truncate group-hover:text-amber-300">
                      {sec.sector}
                    </h5>

                    {/* Prominent Metric Display */}
                    <div className="flex items-baseline space-x-2 my-1">
                      <span className={`text-xl font-black font-mono tracking-tight ${sec.heatmapText}`}>
                        {metricDisplay}
                      </span>
                      <span className="text-[9px] text-gray-300 uppercase tracking-wider">
                        {metricSubDisplay}
                      </span>
                    </div>

                    {/* Volatility Threshold Breach Badge */}
                    {sec.isVolatilityThresholdBreached && (
                      <div className="mt-1 flex items-center space-x-1 bg-rose-600 text-white text-[9px] font-black px-1.5 py-0.5 border border-rose-300 animate-pulse">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        <span>VOL SURGE ({sec.relativeVolatilityRatio}x)</span>
                      </div>
                    )}
                  </div>

                  {/* Leader Stock Quick Badge & Action trigger */}
                  <div className="pt-2 border-t border-white/10 mt-2 text-[10px] flex items-center justify-between text-gray-300">
                    <span className="truncate">
                      Leader: <strong className="text-white">{sec.topStock?.ticker}</strong> ({sec.topStock?.changePercent >= 0 ? '+' : ''}{sec.topStock?.changePercent.toFixed(1)}%)
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onFilterBySector(sec.sector);
                      }}
                      className="bg-black/40 hover:bg-black text-emerald-300 hover:text-emerald-200 px-1.5 py-0.5 text-[9px] uppercase border border-white/20 flex items-center space-x-1 shrink-0 ml-1"
                      title="Filter main screener to this sector"
                    >
                      <span>Filter</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* EXPANDED SECTOR DETAIL CONSTITUENT DRAWER / MODAL */}
      {selectedSectorObj && (
        <div className="bg-[#161b22] border-2 border-purple-500 p-5 space-y-4 shadow-2xl font-mono">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#30363d] pb-3">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-purple-900 text-white flex items-center justify-center font-bold text-sm">
                #{selectedSectorObj.rank}
              </div>
              <div>
                <span className="text-[10px] text-purple-400 uppercase font-bold tracking-wider block">
                  Sector Constituent Breakdown & Strategy Signals
                </span>
                <h4 className="text-lg font-serif font-black text-white">
                  {selectedSectorObj.sector} ({selectedSectorObj.stockCount} Stocks Monitored)
                </h4>
              </div>
            </div>

            <div className="flex items-center space-x-3 text-xs">
              <button
                onClick={() => onFilterBySector(selectedSectorObj.sector)}
                className="bg-purple-900 hover:bg-purple-800 text-white px-3.5 py-1.5 font-bold uppercase tracking-wider flex items-center space-x-1.5 border border-purple-500 transition-all cursor-pointer"
              >
                <Filter className="w-3.5 h-3.5 text-amber-400" />
                <span>Filter Main Screener by {selectedSectorObj.sector}</span>
              </button>
              <button
                onClick={() => setSelectedSector(null)}
                className="bg-[#0e1117] hover:bg-slate-800 text-gray-400 hover:text-white px-3 py-1.5 font-bold uppercase border border-[#30363d]"
              >
                Close Breakdown ✕
              </button>
            </div>
          </div>

          {/* Sector Aggregated Metrics Summary Row */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-[#0e1117] p-3 border border-[#30363d] text-center text-xs">
            <div>
              <span className="text-[9px] text-gray-400 uppercase block">Money Flow Index</span>
              <strong className="text-emerald-400 font-bold text-sm">{selectedSectorObj.moneyFlowIndex}/100 ({selectedSectorObj.flowLabel})</strong>
            </div>
            <div>
              <span className="text-[9px] text-gray-400 uppercase block">Avg Price Change</span>
              <strong className={`font-bold text-sm ${selectedSectorObj.avgChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {selectedSectorObj.avgChange >= 0 ? '+' : ''}{selectedSectorObj.avgChange}%
              </strong>
            </div>
            <div>
              <span className="text-[9px] text-gray-400 uppercase block">Avg Industry RS</span>
              <strong className="text-amber-400 font-bold text-sm">RS {selectedSectorObj.rsScore}</strong>
            </div>
            <div>
              <span className="text-[9px] text-gray-400 uppercase block">Avg Vol Dry-Up</span>
              <strong className="text-teal-400 font-bold text-sm">{selectedSectorObj.avgDryUp}%</strong>
            </div>
            <div>
              <span className="text-[9px] text-gray-400 uppercase block">8/8 SEPA Score</span>
              <strong className="text-purple-300 font-bold text-sm">{selectedSectorObj.qualifiedCount}/{selectedSectorObj.stockCount} Stocks</strong>
            </div>
          </div>

          {/* Constituent Stocks Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#30363d] text-[10px] uppercase text-gray-400 font-bold bg-[#0e1117]">
                  <th className="py-2.5 px-3">Stock Ticker</th>
                  <th className="py-2.5 px-3">Company Name</th>
                  <th className="py-2.5 px-3">Current Price</th>
                  <th className="py-2.5 px-3 text-right">Today %</th>
                  <th className="py-2.5 px-3 text-center">RS Rating</th>
                  <th className="py-2.5 px-3 text-center">SEPA Score</th>
                  <th className="py-2.5 px-3 text-center">VCP Contraction</th>
                  <th className="py-2.5 px-3 text-right">Pivot Price</th>
                  <th className="py-2.5 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#30363d]">
                {selectedSectorObj.allStocks.map((stock) => {
                  const currency = getCurrencySymbol(stock.exchange);
                  return (
                    <tr
                      key={stock.ticker}
                      onClick={() => onSelectStock(stock)}
                      className="hover:bg-[#1f242d] transition-colors cursor-pointer"
                    >
                      <td className="py-2.5 px-3 font-bold text-amber-300">
                        {stock.ticker}
                      </td>
                      <td className="py-2.5 px-3 text-white truncate max-w-[180px]">
                        {stock.name}
                      </td>
                      <td className="py-2.5 px-3 text-gray-200">
                        {formatCurrency(stock.currentPrice, currency)}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-bold ${stock.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="bg-purple-950 text-purple-300 px-1.5 py-0.5 text-[10px] font-bold border border-purple-700">
                          RS {stock.rsRating}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-1.5 py-0.5 text-[10px] font-bold border ${
                          stock.trendScore === 8 ? 'bg-emerald-950 text-emerald-300 border-emerald-700' : 'bg-slate-800 text-gray-300 border-gray-700'
                        }`}>
                          {stock.trendScore}/8
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center text-teal-300">
                        {stock.vcpStage} ({stock.volumeDryUpPercent}%)
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-white">
                        {formatCurrency(stock.pivotPrice, currency)}
                      </td>
                      <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onViewChart(stock)}
                          className="bg-[#21262d] hover:bg-purple-900 text-emerald-300 hover:text-white px-2 py-1 text-[10px] font-bold uppercase border border-gray-700 flex items-center space-x-1 mx-auto"
                        >
                          <span>View Chart</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* INSTITUTIONAL MONEY FLOW SECTOR LEADERBOARD TABLE */}
      {(displayMode === 'COMBINED' || displayMode === 'LEADERBOARD_ONLY') && (
        <div className="bg-[#161b22] border border-[#30363d] p-5 space-y-4 shadow-lg font-mono">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#30363d] pb-3">
            <div className="flex items-center space-x-2">
              <Award className="w-4 h-4 text-amber-400" />
              <h4 className="text-xs font-bold uppercase text-white tracking-wider">
                Institutional Sector Leadership Leaderboard & Ranking Matrix
              </h4>
            </div>
            <span className="text-[10px] text-gray-400">
              Ranked by Institutional Money Flow Index (0 - 100)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#30363d] text-[10px] uppercase text-gray-400 font-bold bg-[#0e1117]">
                  <th className="py-3 px-3 text-center">Rank</th>
                  <th className="py-3 px-3">Industry Group / Sector</th>
                  <th className="py-3 px-3 text-center">Constituents</th>
                  <th className="py-3 px-3 text-right">Avg Change %</th>
                  <th className="py-3 px-3 text-center">Vol vs Mkt</th>
                  <th className="py-3 px-3 text-center">Money Flow Index</th>
                  <th className="py-3 px-3 text-center">Industry RS Rating</th>
                  <th className="py-3 px-3 text-center">Avg Vol Dry-Up</th>
                  <th className="py-3 px-3 text-center">SEPA 8/8 Ratio</th>
                  <th className="py-3 px-3">Sector Leader</th>
                  <th className="py-3 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#30363d]">
                {filteredSectors.map((sec) => {
                  const currency = getCurrencySymbol(sec.topStock?.exchange || 'NSE');
                  const isSelected = selectedSector?.toLowerCase() === sec.sector.toLowerCase();

                  return (
                    <tr
                      key={sec.sector}
                      onClick={() => setSelectedSector(isSelected ? null : sec.sector)}
                      className={`hover:bg-[#1f242d] transition-colors cursor-pointer ${
                        isSelected ? 'bg-purple-950/40 border-l-4 border-l-purple-500' : ''
                      }`}
                    >
                      {/* Rank */}
                      <td className="py-3 px-3 text-center font-bold">
                        <span className={`inline-block w-6 h-6 leading-6 text-center text-[10px] border ${
                          sec.rank === 1
                            ? 'bg-amber-500 text-black border-amber-400 font-black'
                            : sec.rank === 2
                            ? 'bg-slate-300 text-black border-slate-200 font-bold'
                            : sec.rank === 3
                            ? 'bg-amber-800 text-amber-100 border-amber-600 font-bold'
                            : 'bg-[#0e1117] text-gray-400 border-gray-800'
                        }`}>
                          #{sec.rank}
                        </span>
                      </td>

                      {/* Sector Name */}
                      <td className="py-3 px-3 font-serif font-bold text-white">
                        <div>
                          <span className="text-sm block">{sec.sector}</span>
                          <span className="text-[10px] font-mono text-gray-400 font-normal">
                            {sec.flowLabel}
                          </span>
                        </div>
                      </td>

                      {/* Stocks count */}
                      <td className="py-3 px-3 text-center text-gray-300">
                        {sec.stockCount} Stocks
                      </td>

                      {/* Avg Change */}
                      <td className={`py-3 px-3 text-right font-bold text-sm ${sec.avgChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {sec.avgChange >= 0 ? '+' : ''}{sec.avgChange}%
                      </td>

                      {/* Vol vs Broader Market Benchmark */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex flex-col items-center">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold border uppercase flex items-center space-x-1 ${
                              sec.isVolatilityThresholdBreached
                                ? 'bg-rose-950 text-rose-300 border-rose-500 animate-pulse font-black'
                                : sec.relativeVolatilityRatio >= 1.65
                                ? 'bg-amber-950 text-amber-300 border-amber-600 font-bold'
                                : sec.relativeVolatilityRatio <= 1.05
                                ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                                : 'bg-slate-800 text-gray-300 border-gray-700'
                            }`}
                          >
                            {sec.isVolatilityThresholdBreached && (
                              <AlertTriangle className="w-2.5 h-2.5 text-rose-400" />
                            )}
                            <span>{sec.relativeVolatilityRatio}x</span>
                          </span>
                          <span className="text-[9px] text-gray-400 font-mono mt-0.5">
                            Rank {sec.avgVolatilityRank}
                          </span>
                        </div>
                      </td>

                      {/* Money Flow Index */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex flex-col items-center">
                          <span className={`px-2 py-0.5 text-[10px] font-bold border uppercase ${
                            sec.moneyFlowIndex >= 75
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                              : sec.moneyFlowIndex >= 55
                              ? 'bg-teal-950 text-teal-300 border-teal-700'
                              : sec.moneyFlowIndex >= 38
                              ? 'bg-slate-800 text-gray-300 border-gray-700'
                              : 'bg-rose-950 text-rose-300 border-rose-800'
                          }`}>
                            {sec.moneyFlowIndex} / 100
                          </span>
                        </div>
                      </td>

                      {/* Industry RS Rating */}
                      <td className="py-3 px-3 text-center font-bold text-amber-300">
                        RS {sec.rsScore}
                      </td>

                      {/* Vol Dry-Up */}
                      <td className="py-3 px-3 text-center text-teal-300">
                        {sec.avgDryUp}%
                      </td>

                      {/* Qualified Count */}
                      <td className="py-3 px-3 text-center text-purple-300">
                        {sec.qualifiedCount}/{sec.stockCount}
                      </td>

                      {/* Sector Leader */}
                      <td className="py-3 px-3">
                        {sec.topStock && (
                          <div className="text-[11px]">
                            <strong className="text-white block">{sec.topStock.ticker}</strong>
                            <span className="text-emerald-400 font-bold text-[10px]">
                              {formatCurrency(sec.topStock.currentPrice, currency)} (+{sec.topStock.changePercent.toFixed(1)}%)
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Action Button */}
                      <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onFilterBySector(sec.sector)}
                          className="bg-[#21262d] hover:bg-emerald-900 text-emerald-300 hover:text-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border border-gray-700 flex items-center space-x-1 mx-auto transition-all cursor-pointer"
                        >
                          <span>Filter Screener</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RELATIVE ROTATION GRAPH (RRG) SECTION */}
      {(displayMode === 'COMBINED' || displayMode === 'RRG_ROTATION') && (
        <RelativeRotationGraph
          sectorAggregates={filteredSectors}
          selectedSectorName={selectedSector}
          onSelectSector={(sectorName) => setSelectedSector(sectorName)}
          onSelectStock={onSelectStock}
        />
      )}

      {/* D3 SECTOR RELATIVE STRENGTH RADAR CHART SECTION */}
      {(displayMode === 'COMBINED' || displayMode === 'RADAR_ANALYSIS') && (
        <SectorRadarChart
          sectorAggregates={filteredSectors}
          selectedSectorName={selectedSector}
          onSelectSector={(sectorName) => setSelectedSector(sectorName)}
        />
      )}

      {/* SECTOR ETF CORRELATION MATRIX SECTION */}
      {(displayMode === 'COMBINED' || displayMode === 'CORRELATION_MATRIX') && (
        <SectorCorrelationMatrix
          stocks={stocks}
          onSelectStock={onSelectStock}
        />
      )}

      {/* SECTOR VOLATILITY ALERT THRESHOLD CONFIGURATION MODAL */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161b22] border-2 border-amber-500/60 max-w-xl w-full p-6 text-white font-mono shadow-2xl space-y-5 animate-scale-up">
            <div className="flex items-center justify-between border-b border-[#30363d] pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-400">
                  <Settings className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white uppercase tracking-wider">
                    Sector Volatility Alert Threshold
                  </h4>
                  <span className="text-[10px] text-gray-400 block font-sans">
                    Real-time monitoring against broader market index benchmark ({sectorAggregates[0]?.marketBenchmark || 'NIFTY 50'})
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsSettingsModalOpen(false)}
                className="text-gray-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Threshold Configuration Inputs */}
            <div className="space-y-4 text-xs">
              {/* Surveillance Toggle */}
              <div className="flex items-center justify-between bg-[#0e1117] p-3 border border-[#30363d]">
                <div>
                  <span className="font-bold text-white block">Real-Time Surveillance Engine</span>
                  <span className="text-[11px] text-gray-400 font-sans">
                    Continuously evaluate sector historical volatility in background
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={tempSettings.enabled}
                  onChange={(e) => setTempSettings({ ...tempSettings, enabled: e.target.checked })}
                  className="w-4 h-4 accent-amber-500 cursor-pointer"
                />
              </div>

              {/* Comparison Mode */}
              <div className="bg-[#0e1117] p-3 border border-[#30363d] space-y-2">
                <span className="font-bold text-gray-300 block uppercase text-[10px]">
                  Comparison Metric Mode:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setTempSettings({ ...tempSettings, comparisonMode: 'RATIO_VS_MARKET' })}
                    className={`p-2 text-left border cursor-pointer ${
                      tempSettings.comparisonMode === 'RATIO_VS_MARKET'
                        ? 'bg-amber-950/60 border-amber-400 text-amber-200 font-bold'
                        : 'bg-[#161b22] border-[#30363d] text-gray-400 hover:text-white'
                    }`}
                  >
                    <span className="block text-xs">Relative Volatility Ratio</span>
                    <span className="text-[10px] text-gray-400 block font-sans">
                      e.g. Sector HV / Market Index HV (1.50x)
                    </span>
                  </button>
                  <button
                    onClick={() => setTempSettings({ ...tempSettings, comparisonMode: 'VOLATILITY_RANK' })}
                    className={`p-2 text-left border cursor-pointer ${
                      tempSettings.comparisonMode === 'VOLATILITY_RANK'
                        ? 'bg-amber-950/60 border-amber-400 text-amber-200 font-bold'
                        : 'bg-[#161b22] border-[#30363d] text-gray-400 hover:text-white'
                    }`}
                  >
                    <span className="block text-xs">Calibrated Volatility Rank</span>
                    <span className="text-[10px] text-gray-400 block font-sans">
                      Standardized curve 1 to 99 (e.g. Rank 70)
                    </span>
                  </button>
                </div>
              </div>

              {/* Threshold Slider */}
              <div className="bg-[#0e1117] p-3.5 border border-[#30363d] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-300 uppercase text-[10px]">
                    Alert Threshold Value:
                  </span>
                  <span className="text-amber-400 font-black text-sm">
                    {tempSettings.comparisonMode === 'RATIO_VS_MARKET'
                      ? `${tempSettings.ratioThreshold.toFixed(2)}x Broader Market HV`
                      : `Rank ${tempSettings.rankThreshold} / 99`}
                  </span>
                </div>

                {tempSettings.comparisonMode === 'RATIO_VS_MARKET' ? (
                  <div>
                    <input
                      type="range"
                      min="1.10"
                      max="2.50"
                      step="0.05"
                      value={tempSettings.ratioThreshold}
                      onChange={(e) =>
                        setTempSettings({ ...tempSettings, ratioThreshold: parseFloat(e.target.value) })
                      }
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-gray-500 mt-1 font-mono">
                      <span>1.10x (Calm)</span>
                      <span>1.50x (Typical Growth)</span>
                      <span>2.00x (High Beta)</span>
                      <span>2.50x (Extreme)</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <input
                      type="range"
                      min="50"
                      max="90"
                      step="1"
                      value={tempSettings.rankThreshold}
                      onChange={(e) =>
                        setTempSettings({ ...tempSettings, rankThreshold: parseInt(e.target.value, 10) })
                      }
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-gray-500 mt-1 font-mono">
                      <span>Rank 50 (Median)</span>
                      <span>Rank 70 (Elevated)</span>
                      <span>Rank 80 (High)</span>
                      <span>Rank 90 (Hyper)</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Alert Direction & Options */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#0e1117] p-3 border border-[#30363d] space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block">
                    Trigger Condition:
                  </span>
                  <select
                    value={tempSettings.alertDirection}
                    onChange={(e) =>
                      setTempSettings({
                        ...tempSettings,
                        alertDirection: e.target.value as any,
                      })
                    }
                    className="bg-[#161b22] border border-[#30363d] text-white p-1.5 text-xs w-full focus:outline-none focus:border-amber-400 cursor-pointer"
                  >
                    <option value="CROSS_ABOVE">Crosses Above (Surge)</option>
                    <option value="CROSS_BELOW">Crosses Below (Coil)</option>
                    <option value="BOTH">Both Crossover Directions</option>
                  </select>
                </div>

                <div className="bg-[#0e1117] p-3 border border-[#30363d] space-y-2">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block">
                    Notification Sound & Popups:
                  </span>
                  <div className="flex items-center space-x-3 text-xs">
                    <label className="flex items-center space-x-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tempSettings.soundAlert}
                        onChange={(e) =>
                          setTempSettings({ ...tempSettings, soundAlert: e.target.checked })
                        }
                        className="accent-amber-500"
                      />
                      <span>Chime</span>
                    </label>
                    <label className="flex items-center space-x-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tempSettings.browserNotification}
                        onChange={(e) => {
                          if (e.target.checked && 'Notification' in window) {
                            Notification.requestPermission();
                          }
                          setTempSettings({ ...tempSettings, browserNotification: e.target.checked });
                        }}
                        className="accent-amber-500"
                      />
                      <span>Browser Push</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Live Preview of Affected Sectors */}
              <div className="bg-amber-950/30 border border-amber-600/40 p-3 text-[11px] font-mono">
                <div className="flex items-center justify-between text-amber-300 font-bold mb-1">
                  <span>LIVE PREVIEW WITH THIS THRESHOLD:</span>
                  <span>
                    {
                      sectorAggregates.filter((s) =>
                        tempSettings.comparisonMode === 'RATIO_VS_MARKET'
                          ? s.relativeVolatilityRatio >= tempSettings.ratioThreshold
                          : s.avgVolatilityRank >= tempSettings.rankThreshold
                      ).length
                    }{' '}
                    Sectors Crossing
                  </span>
                </div>
                <div className="text-gray-300 text-[10px] flex flex-wrap gap-1.5">
                  {sectorAggregates
                    .filter((s) =>
                      tempSettings.comparisonMode === 'RATIO_VS_MARKET'
                        ? s.relativeVolatilityRatio >= tempSettings.ratioThreshold
                        : s.avgVolatilityRank >= tempSettings.rankThreshold
                    )
                    .map((s) => (
                      <span
                        key={s.sector}
                        className="bg-black/60 border border-amber-500/50 px-1.5 py-0.5 text-amber-200"
                      >
                        {s.sector}: {s.relativeVolatilityRatio}x (Rank {s.avgVolatilityRank})
                      </span>
                    ))}
                  {sectorAggregates.filter((s) =>
                    tempSettings.comparisonMode === 'RATIO_VS_MARKET'
                      ? s.relativeVolatilityRatio >= tempSettings.ratioThreshold
                      : s.avgVolatilityRank >= tempSettings.rankThreshold
                  ).length === 0 && (
                    <span className="text-gray-400 italic">No sectors currently cross this threshold level.</span>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between border-t border-[#30363d] pt-3">
              <button
                onClick={() => {
                  setTempSettings(DEFAULT_SECTOR_VOLATILITY_SETTINGS);
                }}
                className="text-gray-400 hover:text-white text-xs underline cursor-pointer"
              >
                Reset to Defaults
              </button>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsSettingsModalOpen(false)}
                  className="bg-white/10 hover:bg-white/20 text-gray-200 px-3 py-1.5 text-xs font-bold uppercase cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    saveSectorVolatilityAlertSettings(tempSettings);
                    setAlertSettings(tempSettings);
                    setIsSettingsModalOpen(false);
                    evaluateSectorVolatilityAlerts(stocks, tempSettings, false);
                  }}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-1.5 text-xs font-black uppercase shadow-md cursor-pointer"
                >
                  Save Alert Threshold
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTOR VOLATILITY ALERT HISTORY DRAWER */}
      {isHistoryDrawerOpen && (
        <div className="bg-[#161b22] border-2 border-purple-800/60 p-5 space-y-4 font-mono shadow-2xl animate-fade-in">
          <div className="flex items-center justify-between border-b border-[#30363d] pb-3">
            <div className="flex items-center space-x-2">
              <History className="w-5 h-5 text-purple-400" />
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                Sector Volatility Crossover Alert History ({alertHistory.length} Events)
              </h4>
            </div>
            <div className="flex items-center space-x-2">
              {alertHistory.length > 0 && (
                <button
                  onClick={() => {
                    saveSectorVolatilityAlertHistory([]);
                    setAlertHistory([]);
                  }}
                  className="text-xs text-rose-400 hover:text-rose-300 underline cursor-pointer mr-2"
                >
                  Clear History
                </button>
              )}
              <button
                onClick={() => setIsHistoryDrawerOpen(false)}
                className="text-gray-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {alertHistory.length === 0 ? (
            <div className="p-6 text-center text-gray-500 text-xs border border-dashed border-gray-700">
              No sector volatility crossover alerts logged yet. When a sector crosses the {alertSettings.ratioThreshold}x threshold, it will be automatically recorded here and notified in real-time.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {alertHistory.map((item) => (
                <div
                  key={item.id}
                  className="bg-[#0e1117] border border-[#30363d] p-3 text-xs space-y-1 hover:border-amber-400 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-white text-sm">{item.sector}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 font-bold uppercase border ${
                        item.crossoverType === 'SURGE_ABOVE_THRESHOLD'
                          ? 'bg-rose-950 text-rose-300 border-rose-600'
                          : 'bg-emerald-950 text-emerald-300 border-emerald-600'
                      }`}>
                        {item.crossoverType.replace('_', ' ')}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-400">{item.triggeredAt}</span>
                  </div>

                  <div className="text-[11px] text-gray-300 flex flex-wrap items-center gap-2">
                    <span>
                      Relative Ratio: <strong className="text-amber-400">{item.relativeVolatilityRatio}x</strong> vs {item.marketBenchmark}
                    </span>
                    <span>•</span>
                    <span>
                      Sector HV: <strong className="text-white">{item.avgSectorHvAnnualized}%</strong> (Market: {item.marketHvAnnualized}%)
                    </span>
                    <span>•</span>
                    <span>
                      Vol Rank: <strong className="text-purple-300">{item.avgVolatilityRank}/99</strong>
                    </span>
                  </div>

                  <p className="text-[10px] text-gray-400 font-sans leading-tight">
                    {item.headline}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
};
