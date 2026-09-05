import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MinerviniTradeSetup } from '../types';
import {
  RrgBenchmark,
  RrgTimeframe,
  RrgQuadrant,
  RrgSecurityData,
  RRG_BENCHMARKS,
  QUADRANT_META,
  computeStocksRrg,
  computeSectorsRrg,
  computeWatchlistSectorsRrg,
} from '../utils/rrgCalculator';
import { D3RrgChart } from './D3RrgChart';
import { getStoredWatchlists, CustomWatchlist } from '../utils/watchlistStorage';
import {
  playRrgLeadingChime,
  playRrgImprovingChime,
  playRrgWeakeningTone,
  playRrgLaggingTone,
  playRrgStepChime,
  playRrgQuadrantSound,
  getAudioSettings,
  saveAudioSettings,
} from '../utils/audioAlertEngine';
import { formatCurrency, getCurrencySymbol } from '../utils/sepaCalculator';
import { exportRrgStateToCsv } from '../utils/csvExport';
import {
  Compass,
  Play,
  Pause,
  RotateCw,
  Volume2,
  VolumeX,
  Sparkles,
  SlidersHorizontal,
  Search,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Bookmark,
  ExternalLink,
  Info,
  CheckCircle2,
  Activity,
  Layers,
  Award,
  Zap,
  Target,
  BarChart3,
  HelpCircle,
  Eye,
  RefreshCw,
  Clock,
  Music,
  Download,
  Check,
  Grid,
  Tag,
  Sliders,
  X,
  RotateCcw,
} from 'lucide-react';

export type RrgUniverseMode = 'WATCHLIST_SECTORS' | 'WATCHLIST_STOCKS' | 'SECTORS' | 'SEPA_SETUPS';

interface RrgToolViewProps {
  stocks: MinerviniTradeSetup[];
  watchlistTickers?: string[];
  selectedStockTicker?: string;
  onSelectStock: (stock: MinerviniTradeSetup) => void;
  onViewChart: (stock: MinerviniTradeSetup) => void;
  onToggleWatchlist?: (ticker: string) => void;
  isObsidian?: boolean;
}

export const RrgToolView: React.FC<RrgToolViewProps> = ({
  stocks,
  watchlistTickers = [],
  selectedStockTicker,
  onSelectStock,
  onViewChart,
  onToggleWatchlist,
  isObsidian = true,
}) => {
  // Mode: Watchlist Sectors, Watchlist Stocks, All Sectors, or All Setups
  const [universeMode, setUniverseMode] = useState<RrgUniverseMode>('WATCHLIST_SECTORS');

  // Watchlist source selection
  const [availableWatchlists] = useState<CustomWatchlist[]>(() => getStoredWatchlists());
  const [activeWatchlistId, setActiveWatchlistId] = useState<string>(() => availableWatchlists[0]?.id || 'wl-stage2-leaders');

  const [benchmark, setBenchmark] = useState<RrgBenchmark>('SPY');
  const [timeframe, setTimeframe] = useState<RrgTimeframe>('WEEKLY');
  const [tailLength, setTailLength] = useState<number>(5); // 3, 5, 8, 10
  const [showTails, setShowTails] = useState<boolean>(true);
  const [labelMode, setLabelMode] = useState<'ALL' | 'LEADING_ONLY' | 'SELECTED_ONLY'>('ALL');
  const [selectedQuadrant, setSelectedQuadrant] = useState<RrgQuadrant | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(selectedStockTicker || null);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

  // Chart Display & Visibility Configuration state (Grid lines, Axis labels, and panel visibility)
  const [showGridLines, setShowGridLines] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('rrg_show_grid_lines');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [showAxisLabels, setShowAxisLabels] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('rrg_show_axis_labels');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [showConfigPanel, setShowConfigPanel] = useState<boolean>(false);

  const handleToggleGridLines = () => {
    setShowGridLines((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('rrg_show_grid_lines', String(next));
      } catch {}
      return next;
    });
  };

  const handleToggleAxisLabels = () => {
    setShowAxisLabels((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('rrg_show_axis_labels', String(next));
      } catch {}
      return next;
    });
  };

  const handleResetDisplayConfig = () => {
    setShowGridLines(true);
    setShowAxisLabels(true);
    setShowTails(true);
    setLabelMode('ALL');
    setSearchQuery('');
    try {
      localStorage.setItem('rrg_show_grid_lines', 'true');
      localStorage.setItem('rrg_show_axis_labels', 'true');
    } catch {}
  };

  // Audio settings state
  const [audioEnabled, setAudioEnabled] = useState<boolean>(() => getAudioSettings().rrgSound && getAudioSettings().enabled);
  const [volume, setVolume] = useState<number>(() => getAudioSettings().volume);
  const [showAudioSoundboard, setShowAudioSoundboard] = useState<boolean>(true);
  const [recentSoundPlayed, setRecentSoundPlayed] = useState<string | null>(null);

  // Playback Animation state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [animStep, setAnimStep] = useState<number>(tailLength - 1); // 0 (oldest) to tailLength - 1 (current)
  const animIntervalRef = useRef<any>(null);

  // Keep animStep in bounds when tailLength changes
  useEffect(() => {
    setAnimStep(tailLength - 1);
  }, [tailLength]);

  // Audio setting sync
  const toggleAudio = () => {
    const next = !audioEnabled;
    setAudioEnabled(next);
    saveAudioSettings({ rrgSound: next });
    if (next) {
      playRrgLeadingChime(0.5);
      setRecentSoundPlayed('Audio Enabled - Leading Chime');
      setTimeout(() => setRecentSoundPlayed(null), 2500);
    }
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    saveAudioSettings({ volume: newVol });
  };

  // Determine active watchlist configuration and tickers
  const selectedWatchlist = useMemo(() => {
    if (activeWatchlistId === 'ALL_COMBINED') {
      const combined = Array.from(new Set([...availableWatchlists.flatMap((w) => w.tickers), ...watchlistTickers]));
      return {
        id: 'ALL_COMBINED',
        name: 'All Combined Watchlists',
        tickers: combined,
      };
    }
    return availableWatchlists.find((w) => w.id === activeWatchlistId) || availableWatchlists[0];
  }, [availableWatchlists, activeWatchlistId, watchlistTickers]);

  const effectiveWatchlistTickers = useMemo(() => {
    if (selectedWatchlist && selectedWatchlist.tickers && selectedWatchlist.tickers.length > 0) {
      return selectedWatchlist.tickers;
    }
    if (watchlistTickers && watchlistTickers.length > 0) {
      return watchlistTickers;
    }
    return ['HAL', 'TRENT', 'POLYCAB', 'DIXON', 'KAYNES'];
  }, [selectedWatchlist, watchlistTickers]);

  // Compute RRG items
  const rrgItems = useMemo<RrgSecurityData[]>(() => {
    if (universeMode === 'WATCHLIST_SECTORS') {
      return computeWatchlistSectorsRrg(stocks, effectiveWatchlistTickers, benchmark, timeframe, tailLength);
    }
    if (universeMode === 'SECTORS') {
      return computeSectorsRrg(stocks, benchmark, timeframe, tailLength);
    }
    if (universeMode === 'WATCHLIST_STOCKS') {
      const wlStocks = stocks.filter((s) => effectiveWatchlistTickers.includes(s.ticker));
      const target = wlStocks.length > 0 ? wlStocks : stocks.slice(0, 8);
      return computeStocksRrg(target, benchmark, timeframe, tailLength);
    }
    return computeStocksRrg(stocks, benchmark, timeframe, tailLength);
  }, [universeMode, stocks, effectiveWatchlistTickers, benchmark, timeframe, tailLength]);

  // Set default selected item if none
  useEffect(() => {
    if (!selectedItemId && rrgItems.length > 0) {
      // Prefer a leading stock or the first item
      const leadingItem = rrgItems.find((item) => item.quadrant === 'LEADING') || rrgItems[0];
      setSelectedItemId(leadingItem.id);
    }
  }, [rrgItems, selectedItemId]);

  // Animation Playback Loop
  useEffect(() => {
    if (isPlaying) {
      animIntervalRef.current = setInterval(() => {
        setAnimStep((prev) => {
          const next = prev >= tailLength - 1 ? 0 : prev + 1;
          if (audioEnabled) {
            if (next === tailLength - 1) {
              // Current step reached: play leading chime
              playRrgLeadingChime(0.6);
            } else {
              playRrgStepChime(next);
            }
          }
          return next;
        });
      }, 750);
    } else {
      if (animIntervalRef.current) clearInterval(animIntervalRef.current);
    }

    return () => {
      if (animIntervalRef.current) clearInterval(animIntervalRef.current);
    };
  }, [isPlaying, tailLength, audioEnabled]);

  // Quadrant Counts
  const quadrantCounts = useMemo(() => {
    const counts: Record<RrgQuadrant, number> = {
      LEADING: 0,
      IMPROVING: 0,
      WEAKENING: 0,
      LAGGING: 0,
    };
    rrgItems.forEach((item) => {
      counts[item.quadrant]++;
    });
    return counts;
  }, [rrgItems]);

  // Filtered RRG items for table and display
  const filteredItems = useMemo(() => {
    return rrgItems.filter((item) => {
      if (selectedQuadrant !== 'ALL' && item.quadrant !== selectedQuadrant) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTicker = item.ticker.toLowerCase().includes(q);
        const matchName = item.name.toLowerCase().includes(q);
        const matchSector = item.sector.toLowerCase().includes(q);
        if (!matchTicker && !matchName && !matchSector) return false;
      }
      return true;
    });
  }, [rrgItems, selectedQuadrant, searchQuery]);

  // Unique sector names available in current dataset for quick chips
  const availableSectors = useMemo(() => {
    const set = new Set<string>();
    rrgItems.forEach((item) => {
      if (item.type === 'SECTOR') {
        if (item.name) set.add(item.name);
      } else {
        if (item.sector) set.add(item.sector);
      }
    });
    return Array.from(set).filter(Boolean);
  }, [rrgItems]);

  // Active highlighted item
  const activeItemId = hoveredItemId || selectedItemId;
  const activeItem = useMemo(() => {
    const fromFiltered = filteredItems.find((item) => item.id === activeItemId);
    if (fromFiltered) return fromFiltered;
    if (filteredItems.length > 0) return filteredItems[0];
    return rrgItems.find((item) => item.id === activeItemId) || rrgItems[0] || null;
  }, [filteredItems, rrgItems, activeItemId]);

  // Trigger Sound for Quadrant
  const handlePlayQuadrantSound = (quadrant: RrgQuadrant, label: string) => {
    playRrgQuadrantSound(quadrant, 1.0);
    setRecentSoundPlayed(`Played ${label} Sound`);
    setTimeout(() => setRecentSoundPlayed(null), 2500);
  };

  // Quadrant Filter Click Handler with Audio
  const handleSelectQuadrantFilter = (q: RrgQuadrant | 'ALL') => {
    setSelectedQuadrant(q);
    if (q !== 'ALL') {
      playRrgQuadrantSound(q, 0.8);
      setRecentSoundPlayed(`Filtered by ${QUADRANT_META[q].label} (Sound Triggered)`);
      setTimeout(() => setRecentSoundPlayed(null), 2500);
    } else {
      playRrgStepChime(2);
    }
  };

  // Select security on click
  const handleItemClick = (item: RrgSecurityData) => {
    setSelectedItemId(item.id);
    playRrgQuadrantSound(item.quadrant, 0.7);
    if (item.stockRef) {
      onSelectStock(item.stockRef);
    }
  };

  // CSV Export State & Handler
  const [isExported, setIsExported] = useState<boolean>(false);

  const handleExportCsv = (scope: 'ALL' | 'FILTERED' | 'AUTO' = 'AUTO') => {
    try {
      const targetItems =
        scope === 'ALL'
          ? rrgItems
          : scope === 'FILTERED'
          ? filteredItems
          : filteredItems.length < rrgItems.length
          ? filteredItems
          : rrgItems;

      let filterDesc = '';
      if (targetItems.length < rrgItems.length) {
        if (selectedQuadrant !== 'ALL') {
          filterDesc += `Quadrant: ${selectedQuadrant}`;
        }
        if (searchQuery.trim()) {
          filterDesc += (filterDesc ? ' | ' : '') + `Search: "${searchQuery.trim()}"`;
        }
      }

      exportRrgStateToCsv({
        universeMode,
        watchlistName:
          universeMode === 'WATCHLIST_SECTORS' || universeMode === 'WATCHLIST_STOCKS'
            ? selectedWatchlist?.name
            : undefined,
        benchmark,
        benchmarkLabel: RRG_BENCHMARKS[benchmark].label,
        timeframe,
        tailLength,
        filterDescription: filterDesc || undefined,
        quadrantCounts,
        totalCount: rrgItems.length,
        items: targetItems,
      });

      setIsExported(true);
      if (audioEnabled) {
        playRrgStepChime(tailLength - 1);
      }
      setRecentSoundPlayed('RRG State & Quadrant Distribution CSV Exported');
      setTimeout(() => setIsExported(false), 2500);
      setTimeout(() => setRecentSoundPlayed(null), 3000);
    } catch (err) {
      console.error('Failed to export RRG CSV:', err);
    }
  };

  return (
    <div
      id="rrg-tool-container"
      className={`space-y-6 transition-colors duration-300 font-sans ${
        isObsidian ? 'text-gray-200' : 'text-gray-900'
      }`}
    >
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & MAIN CONTROLS BAR                                         */}
      {/* ========================================================================= */}
      <div
        className={`p-6 border shadow-xl rounded-xl transition-all ${
          isObsidian
            ? 'bg-[#121620] border-[#222b3d]'
            : 'bg-white border-[#e5e4e1] shadow-[0_4px_24px_rgba(0,0,0,0.04)]'
        }`}
      >
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 border-b pb-5 border-white/10">
          {/* Brand Identity */}
          <div className="flex items-center space-x-4">
            <div
              className={`w-12 h-12 rounded-lg flex items-center justify-center border shrink-0 shadow-inner ${
                isObsidian
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                  : 'bg-amber-100 border-amber-300 text-amber-700'
              }`}
            >
              <Compass className="w-7 h-7 animate-spin-slow" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`text-[10px] uppercase font-mono tracking-[0.25em] font-extrabold ${
                    isObsidian ? 'text-amber-400' : 'text-amber-700'
                  }`}
                >
                  Relative Rotation Graph (RRG®)
                </span>
                <span className="px-2 py-0.5 text-[9px] font-mono font-bold uppercase rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Audio Sonification Active
                </span>
                <span
                  className={`px-2 py-0.5 text-[9px] font-mono font-bold uppercase rounded ${
                    isObsidian ? 'bg-slate-800 text-gray-300' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  Benchmark: {RRG_BENCHMARKS[benchmark].label}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-serif font-black tracking-tight mt-1">
                JdK RS-Ratio™ &amp; RS-Momentum™ Trajectory Engine
              </h2>
              <p className="text-xs sm:text-sm text-gray-400 mt-1 max-w-2xl leading-relaxed">
                Track how growth stocks and industry groups rotate clockwise through the 4 institutional market phases:
                <strong className="text-emerald-400"> Leading</strong>,
                <strong className="text-amber-400"> Weakening</strong>,
                <strong className="text-rose-400"> Lagging</strong>, and
                <strong className="text-sky-400"> Improving</strong>.
              </p>
            </div>
          </div>

          {/* Top Actions & Sound Controls */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* CSV Download Button */}
            <button
              id="rrg-export-csv-btn-header"
              onClick={() => handleExportCsv('AUTO')}
              className={`px-3.5 py-2.5 rounded-lg border text-xs font-mono font-bold uppercase flex items-center space-x-2 transition-all cursor-pointer shadow-sm active:scale-95 ${
                isExported
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black shadow-emerald-500/20 shadow-md'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-400 hover:shadow-md'
              }`}
              title="Download current RRG state, quadrant distribution breakdown, and rotational metrics as CSV for offline analysis"
            >
              {isExported ? <Check className="w-4 h-4" /> : <Download className="w-4 h-4" />}
              <span>{isExported ? 'CSV Exported ✓' : 'Export RRG CSV'}</span>
            </button>

            {/* Quick Sound Control Box */}
            <div
              className={`p-2.5 rounded-lg border flex flex-col sm:flex-row items-center gap-2.5 shrink-0 ${
                isObsidian ? 'bg-[#181f2c] border-[#29354a]' : 'bg-gray-50 border-gray-200'
              }`}
            >
            <div className="flex items-center space-x-2">
              <button
                onClick={toggleAudio}
                className={`p-2 rounded-lg border text-xs font-mono font-bold uppercase flex items-center space-x-1.5 transition-all cursor-pointer ${
                  audioEnabled
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black shadow-md'
                    : 'bg-gray-700/50 text-gray-400 border-gray-600'
                }`}
                title="Toggle RRG Audio Alerts & Sounds"
              >
                {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                <span>{audioEnabled ? 'Sound ON' : 'Muted'}</span>
              </button>

              {/* Volume Slider */}
              {audioEnabled && (
                <div className="flex items-center space-x-1 px-2">
                  <input
                    type="range"
                    min="0.05"
                    max="1.0"
                    step="0.05"
                    value={volume}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    className="w-16 h-1.5 accent-emerald-400 cursor-pointer bg-gray-600 rounded-lg"
                    title={`Volume: ${Math.round(volume * 100)}%`}
                  />
                  <span className="text-[10px] font-mono text-gray-400">{Math.round(volume * 100)}%</span>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowAudioSoundboard(!showAudioSoundboard)}
              className={`px-2.5 py-1.5 rounded border text-[11px] font-mono font-bold flex items-center space-x-1 cursor-pointer transition-all ${
                showAudioSoundboard
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-transparent text-gray-400 border-gray-600 hover:text-white'
              }`}
            >
              <Music className="w-3.5 h-3.5" />
              <span>Soundboard</span>
            </button>
          </div>
        </div>
      </div>

        {/* ========================================================================= */}
        {/* INTERACTIVE SOUNDBOARD STRIP (Test Quadrant Sonification)                 */}
        {/* ========================================================================= */}
        <AnimatePresence>
          {showAudioSoundboard && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-b border-white/10 py-3 mt-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                <div className="flex items-center space-x-2 text-gray-400">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">
                    Harmonic Quadrant Synthesizer Preview:
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Leading Chime */}
                  <button
                    onClick={() => handlePlayQuadrantSound('LEADING', 'Leading')}
                    className="px-2.5 py-1 rounded bg-emerald-950/90 border border-emerald-600 text-emerald-300 hover:bg-emerald-900/90 flex items-center space-x-1.5 transition-transform hover:scale-105 cursor-pointer shadow-xs"
                    title="Ascending pentatonic arpeggio (F#5, A#5, C#6, F#6)"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>🟢 Leading Chime</span>
                  </button>

                  {/* Improving Chime */}
                  <button
                    onClick={() => handlePlayQuadrantSound('IMPROVING', 'Improving')}
                    className="px-2.5 py-1 rounded bg-cyan-950/90 border border-cyan-600 text-cyan-300 hover:bg-cyan-900/90 flex items-center space-x-1.5 transition-transform hover:scale-105 cursor-pointer shadow-xs"
                    title="Optimistic D major bounce (D5, G5, B5)"
                  >
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    <span>🔵 Improving Chime</span>
                  </button>

                  {/* Weakening Tone */}
                  <button
                    onClick={() => handlePlayQuadrantSound('WEAKENING', 'Weakening')}
                    className="px-2.5 py-1 rounded bg-amber-950/90 border border-amber-600 text-amber-300 hover:bg-amber-900/90 flex items-center space-x-1.5 transition-transform hover:scale-105 cursor-pointer shadow-xs"
                    title="Mellow descending caution chord (A5, F#5, D5)"
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span>🟡 Weakening Tone</span>
                  </button>

                  {/* Lagging Tone */}
                  <button
                    onClick={() => handlePlayQuadrantSound('LAGGING', 'Lagging')}
                    className="px-2.5 py-1 rounded bg-rose-950/90 border border-rose-600 text-rose-300 hover:bg-rose-900/90 flex items-center space-x-1.5 transition-transform hover:scale-105 cursor-pointer shadow-xs"
                    title="Deep grounding warning pulse (Eb4, Bb3)"
                  >
                    <span className="w-2 h-2 rounded-full bg-rose-400" />
                    <span>🔴 Lagging Tone</span>
                  </button>

                  {/* Historical Step Tick */}
                  <button
                    onClick={() => {
                      playRrgStepChime(3);
                      setRecentSoundPlayed('Trail Step Tick');
                      setTimeout(() => setRecentSoundPlayed(null), 2000);
                    }}
                    className="px-2.5 py-1 rounded bg-slate-800 border border-slate-600 text-gray-300 hover:bg-slate-700 flex items-center space-x-1 cursor-pointer"
                  >
                    <span>⏱️ Step Tick</span>
                  </button>
                </div>

                {recentSoundPlayed && (
                  <span className="text-[10px] text-amber-400 font-mono animate-pulse">
                    🔊 {recentSoundPlayed}
                  </span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ========================================================================= */}
        {/* CONFIGURATION & FILTER CONTROLS                                           */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-5 font-mono text-xs">
          {/* 1. Universe Mode Selector */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-400">
                1. Universe Target:
              </label>
              {(universeMode === 'WATCHLIST_SECTORS' || universeMode === 'WATCHLIST_STOCKS') && (
                <span className="text-[10px] text-amber-400 font-bold">
                  {effectiveWatchlistTickers.length} Watchlist Stocks Active
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 border border-white/15 rounded p-1 bg-black/20">
              <button
                onClick={() => setUniverseMode('WATCHLIST_SECTORS')}
                className={`py-1.5 px-2 text-center rounded text-[11px] font-bold uppercase transition-all cursor-pointer flex items-center justify-center space-x-1 ${
                  universeMode === 'WATCHLIST_SECTORS'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
                title="Plot rotational strength of the sectors represented in your watchlist"
              >
                <span>⭐ Watchlist Sectors</span>
              </button>
              <button
                onClick={() => setUniverseMode('WATCHLIST_STOCKS')}
                className={`py-1.5 px-2 text-center rounded text-[11px] font-bold uppercase transition-all cursor-pointer ${
                  universeMode === 'WATCHLIST_STOCKS'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
                title="Plot individual stocks in your watchlist"
              >
                Watchlist Stocks
              </button>
              <button
                onClick={() => setUniverseMode('SECTORS')}
                className={`py-1.5 px-2 text-center rounded text-[11px] font-bold uppercase transition-all cursor-pointer ${
                  universeMode === 'SECTORS'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
                title="Plot all macro market sectors"
              >
                All Sectors
              </button>
              <button
                onClick={() => setUniverseMode('SEPA_SETUPS')}
                className={`py-1.5 px-2 text-center rounded text-[11px] font-bold uppercase transition-all cursor-pointer ${
                  universeMode === 'SEPA_SETUPS'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
                title="Plot top SEPA setup stocks"
              >
                SEPA Setups
              </button>
            </div>

            {/* Active Watchlist Selector dropdown when in Watchlist modes */}
            {(universeMode === 'WATCHLIST_SECTORS' || universeMode === 'WATCHLIST_STOCKS') && (
              <div className="mt-2 flex items-center space-x-2">
                <span className="text-[10px] text-gray-400 uppercase font-bold shrink-0">Source List:</span>
                <select
                  value={activeWatchlistId}
                  onChange={(e) => setActiveWatchlistId(e.target.value)}
                  className={`flex-1 py-1 px-2.5 rounded border font-mono text-[11px] cursor-pointer ${
                    isObsidian
                      ? 'bg-[#181f2c] border-amber-500/30 text-amber-300'
                      : 'bg-white border-amber-400 text-gray-800'
                  }`}
                >
                  {availableWatchlists.map((wl) => (
                    <option key={wl.id} value={wl.id}>
                      {wl.name} ({wl.tickers.length} stocks)
                    </option>
                  ))}
                  <option value="ALL_COMBINED">All Watchlists Combined ({Array.from(new Set([...availableWatchlists.flatMap(w => w.tickers), ...watchlistTickers])).length} stocks)</option>
                </select>
              </div>
            )}
          </div>

          {/* 2. Benchmark Selector */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1.5">
              2. Baseline Benchmark:
            </label>
            <select
              value={benchmark}
              onChange={(e) => setBenchmark(e.target.value as RrgBenchmark)}
              className={`w-full py-1.5 px-3 rounded border font-mono text-xs uppercase cursor-pointer ${
                isObsidian
                  ? 'bg-[#181f2c] border-[#29354a] text-amber-300'
                  : 'bg-white border-gray-300 text-gray-800'
              }`}
            >
              {Object.values(RRG_BENCHMARKS).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Timeframe & Tail Length */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1.5">
              3. Timeframe &amp; Trail:
            </label>
            <div className="flex items-center space-x-2">
              {/* Daily / Weekly */}
              <div className="flex border border-white/15 rounded p-0.5 bg-black/20 shrink-0">
                <button
                  onClick={() => setTimeframe('DAILY')}
                  className={`px-2 py-1 text-[11px] font-bold uppercase rounded cursor-pointer ${
                    timeframe === 'DAILY' ? 'bg-amber-500 text-slate-950' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Daily
                </button>
                <button
                  onClick={() => setTimeframe('WEEKLY')}
                  className={`px-2 py-1 text-[11px] font-bold uppercase rounded cursor-pointer ${
                    timeframe === 'WEEKLY' ? 'bg-amber-500 text-slate-950' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Weekly
                </button>
              </div>

              {/* Tail Length */}
              <select
                value={tailLength}
                onChange={(e) => setTailLength(parseInt(e.target.value, 10))}
                className={`py-1.5 px-2 rounded border font-mono text-[11px] uppercase cursor-pointer ${
                  isObsidian ? 'bg-[#181f2c] border-[#29354a] text-gray-200' : 'bg-white border-gray-300'
                }`}
                title="Number of historical periods in tail"
              >
                <option value={3}>Trail: 3 bars</option>
                <option value={5}>Trail: 5 bars</option>
                <option value={8}>Trail: 8 bars</option>
                <option value={10}>Trail: 10 bars</option>
              </select>

              {/* Tails Toggle */}
              <button
                onClick={() => setShowTails(!showTails)}
                className={`px-2 py-1.5 rounded border text-[11px] font-bold uppercase cursor-pointer ${
                  showTails ? 'bg-amber-500/20 text-amber-300 border-amber-500/50' : 'bg-black/20 text-gray-500'
                }`}
                title="Toggle visual tail paths"
              >
                {showTails ? 'Tails ON' : 'Tails OFF'}
              </button>
            </div>
          </div>

          {/* 4. Playback Animation Controls */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1.5">
              4. Rotational Playback:
            </label>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className={`px-3 py-1.5 rounded border text-xs font-bold uppercase flex items-center space-x-1.5 transition-all cursor-pointer ${
                  isPlaying
                    ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-md'
                    : 'bg-slate-800 text-white border-slate-600 hover:border-amber-400'
                }`}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isPlaying ? 'Pause' : 'Animate'}</span>
              </button>

              {/* Scrubber slider */}
              <div className="flex-1 flex flex-col justify-center">
                <input
                  type="range"
                  min="0"
                  max={tailLength - 1}
                  step="1"
                  value={animStep}
                  onChange={(e) => {
                    const step = parseInt(e.target.value, 10);
                    setAnimStep(step);
                    if (audioEnabled) playRrgStepChime(step);
                  }}
                  className="w-full h-1.5 accent-amber-400 cursor-pointer bg-gray-700 rounded"
                />
                <div className="flex justify-between text-[9px] text-gray-400 mt-1">
                  <span>T-{tailLength - 1}</span>
                  <span className="font-bold text-amber-400">
                    {animStep === tailLength - 1 ? 'Current (T-0)' : `T-${tailLength - 1 - animStep}`}
                  </span>
                  <span>T-0</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 5. Quick Display Preferences Strip */}
        <div className="mt-3.5 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between text-xs font-mono text-gray-400 gap-2">
          <div className="flex items-center space-x-2.5">
            <span className="text-[10px] uppercase font-bold text-gray-400">5. Display Overlays:</span>
            <button
              id="rrg-top-toggle-grid-btn"
              onClick={handleToggleGridLines}
              className={`px-2 py-1 rounded text-[11px] font-bold uppercase flex items-center space-x-1.5 border transition-colors cursor-pointer ${
                showGridLines
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                  : 'bg-black/25 text-gray-500 border-white/10 hover:text-gray-300'
              }`}
              title="Toggle RRG background grid lines"
            >
              <Grid className="w-3 h-3" />
              <span>Grid: {showGridLines ? 'ON' : 'OFF'}</span>
            </button>
            <button
              id="rrg-top-toggle-labels-btn"
              onClick={handleToggleAxisLabels}
              className={`px-2 py-1 rounded text-[11px] font-bold uppercase flex items-center space-x-1.5 border transition-colors cursor-pointer ${
                showAxisLabels
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                  : 'bg-black/25 text-gray-500 border-white/10 hover:text-gray-300'
              }`}
              title="Toggle RRG axis titles and coordinate scale labels"
            >
              <Tag className="w-3 h-3" />
              <span>Labels: {showAxisLabels ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          <button
            id="rrg-top-open-config-btn"
            onClick={() => setShowConfigPanel((prev) => !prev)}
            className="text-[11px] font-bold uppercase text-amber-400 hover:text-amber-300 flex items-center space-x-1.5 cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>{showConfigPanel ? 'Close Configuration Panel' : 'Chart Configuration Panel'}</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. FOUR QUADRANTS FILTER RIBBON                                           */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 font-mono text-xs">
        {/* LEADING */}
        <button
          onClick={() => handleSelectQuadrantFilter(selectedQuadrant === 'LEADING' ? 'ALL' : 'LEADING')}
          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
            selectedQuadrant === 'LEADING'
              ? 'bg-emerald-950 border-emerald-400 text-white ring-2 ring-emerald-500/40 shadow-lg'
              : 'bg-emerald-950/40 border-emerald-800/60 hover:bg-emerald-950/70 text-emerald-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Leading (Top-Right)</span>
            </span>
            <span className="px-2 py-0.5 rounded text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              {quadrantCounts.LEADING}
            </span>
          </div>
          <div className="text-base font-black tracking-tight text-white mt-1">
            RS-Ratio ≥ 100 • Momentum ≥ 100
          </div>
          <p className="text-[11px] text-emerald-300/80 font-sans mt-0.5 leading-snug">
            Strongest market leaders outperforming benchmark with accelerating volume.
          </p>
        </button>

        {/* IMPROVING */}
        <button
          onClick={() => handleSelectQuadrantFilter(selectedQuadrant === 'IMPROVING' ? 'ALL' : 'IMPROVING')}
          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
            selectedQuadrant === 'IMPROVING'
              ? 'bg-cyan-950 border-cyan-400 text-white ring-2 ring-cyan-500/40 shadow-lg'
              : 'bg-cyan-950/40 border-cyan-800/60 hover:bg-cyan-950/70 text-cyan-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span>Improving (Top-Left)</span>
            </span>
            <span className="px-2 py-0.5 rounded text-xs font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
              {quadrantCounts.IMPROVING}
            </span>
          </div>
          <div className="text-base font-black tracking-tight text-white mt-1">
            RS-Ratio &lt; 100 • Momentum ≥ 100
          </div>
          <p className="text-[11px] text-cyan-300/80 font-sans mt-0.5 leading-snug">
            Turnaround candidates gaining momentum before crossing into Leading.
          </p>
        </button>

        {/* WEAKENING */}
        <button
          onClick={() => handleSelectQuadrantFilter(selectedQuadrant === 'WEAKENING' ? 'ALL' : 'WEAKENING')}
          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
            selectedQuadrant === 'WEAKENING'
              ? 'bg-amber-950 border-amber-400 text-white ring-2 ring-amber-500/40 shadow-lg'
              : 'bg-amber-950/40 border-amber-800/60 hover:bg-amber-950/70 text-amber-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>Weakening (Bottom-Right)</span>
            </span>
            <span className="px-2 py-0.5 rounded text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
              {quadrantCounts.WEAKENING}
            </span>
          </div>
          <div className="text-base font-black tracking-tight text-white mt-1">
            RS-Ratio ≥ 100 • Momentum &lt; 100
          </div>
          <p className="text-[11px] text-amber-300/80 font-sans mt-0.5 leading-snug">
            Decelerating leaders; tighten stops and look for consolidation re-tests.
          </p>
        </button>

        {/* LAGGING */}
        <button
          onClick={() => handleSelectQuadrantFilter(selectedQuadrant === 'LAGGING' ? 'ALL' : 'LAGGING')}
          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
            selectedQuadrant === 'LAGGING'
              ? 'bg-rose-950 border-rose-400 text-white ring-2 ring-rose-500/40 shadow-lg'
              : 'bg-rose-950/40 border-rose-800/60 hover:bg-rose-950/70 text-rose-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-400" />
              <span>Lagging (Bottom-Left)</span>
            </span>
            <span className="px-2 py-0.5 rounded text-xs font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">
              {quadrantCounts.LAGGING}
            </span>
          </div>
          <div className="text-base font-black tracking-tight text-white mt-1">
            RS-Ratio &lt; 100 • Momentum &lt; 100
          </div>
          <p className="text-[11px] text-rose-300/80 font-sans mt-0.5 leading-snug">
            Underperformers trapped in downtrends. Avoid purchasing.
          </p>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 3. MAIN INTERACTIVE RRG CHART CANVAS & INSPECTION DRAWER                  */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* SVG Chart Canvas (2 Cols) */}
        <div
          className={`xl:col-span-2 p-5 rounded-xl border shadow-xl relative overflow-hidden ${
            isObsidian ? 'bg-[#0f131c] border-[#222b3d]' : 'bg-white border-[#e5e4e1]'
          }`}
        >
          {/* Canvas Toolbar & Search */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 font-mono text-xs border-b border-white/10 pb-3">
            <div className="flex items-center space-x-2">
              <span className="text-gray-400 font-bold uppercase text-[11px]">Active Focus:</span>
              <span className="text-amber-400 font-black font-mono">
                {selectedQuadrant === 'ALL' ? `ALL (${rrgItems.length})` : `${selectedQuadrant} (${filteredItems.length})`}
              </span>
            </div>

            <div className="flex items-center space-x-3">
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter ticker or sector..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`pl-8 pr-3 py-1 rounded text-xs font-mono border focus:outline-none focus:border-amber-400 ${
                    isObsidian ? 'bg-[#181f2c] border-[#29354a] text-gray-200' : 'bg-gray-50 border-gray-300'
                  }`}
                />
              </div>

              {/* Reset filter */}
              {(selectedQuadrant !== 'ALL' || searchQuery) && (
                <button
                  onClick={() => {
                    setSelectedQuadrant('ALL');
                    setSearchQuery('');
                  }}
                  className="text-xs text-amber-400 hover:underline cursor-pointer"
                >
                  Reset
                </button>
              )}

              {/* Active Search Filter Badge in Canvas Toolbar */}
              {searchQuery.trim() !== '' && (
                <div
                  id="rrg-active-search-badge"
                  className={`px-2 py-1 rounded text-xs font-mono font-bold flex items-center space-x-1.5 border transition-all ${
                    isObsidian
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-amber-100 text-amber-800 border-amber-300'
                  }`}
                  title={`Active sector filter: "${searchQuery}"`}
                >
                  <Search className="w-3 h-3 text-amber-400" />
                  <span className="truncate max-w-[110px]">"{searchQuery}"</span>
                  <button
                    id="rrg-clear-search-pill-btn"
                    onClick={() => setSearchQuery('')}
                    className="p-0.5 rounded hover:bg-black/20 text-amber-300 hover:text-white cursor-pointer"
                    title="Clear sector search filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Quick toggles for Grid & Axis Labels, and Config Panel Opener */}
              <div className="flex items-center space-x-1.5">
                <button
                  id="rrg-quick-toggle-grid-btn"
                  onClick={handleToggleGridLines}
                  className={`px-2 py-1 rounded text-xs font-mono font-bold flex items-center space-x-1 border transition-all cursor-pointer ${
                    showGridLines
                      ? isObsidian
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                        : 'bg-amber-100 text-amber-800 border-amber-300'
                      : isObsidian
                      ? 'bg-slate-800/60 text-gray-500 border-slate-700/60 hover:text-gray-300'
                      : 'bg-gray-100 text-gray-400 border-gray-200'
                  }`}
                  title={showGridLines ? 'Click to hide background grid lines in RRG chart' : 'Click to show background grid lines in RRG chart'}
                >
                  <Grid className="w-3 h-3" />
                  <span>Grid: {showGridLines ? 'ON' : 'OFF'}</span>
                </button>

                <button
                  id="rrg-quick-toggle-labels-btn"
                  onClick={handleToggleAxisLabels}
                  className={`px-2 py-1 rounded text-xs font-mono font-bold flex items-center space-x-1 border transition-all cursor-pointer ${
                    showAxisLabels
                      ? isObsidian
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                        : 'bg-amber-100 text-amber-800 border-amber-300'
                      : isObsidian
                      ? 'bg-slate-800/60 text-gray-500 border-slate-700/60 hover:text-gray-300'
                      : 'bg-gray-100 text-gray-400 border-gray-200'
                  }`}
                  title={showAxisLabels ? 'Click to hide axis titles and numeric labels' : 'Click to show axis titles and numeric labels'}
                >
                  <Tag className="w-3 h-3" />
                  <span>Labels: {showAxisLabels ? 'ON' : 'OFF'}</span>
                </button>

                <button
                  id="rrg-config-panel-toggle-btn"
                  onClick={() => setShowConfigPanel((prev) => !prev)}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-bold flex items-center space-x-1.5 border transition-all cursor-pointer ${
                    showConfigPanel
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-md'
                      : isObsidian
                      ? 'bg-[#181f2c] hover:bg-[#20293a] text-gray-200 border-[#2b384e]'
                      : 'bg-white hover:bg-gray-100 text-gray-700 border-gray-300'
                  }`}
                  title="Toggle RRG Chart Display & Visibility Configuration Panel"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Config</span>
                  {(!showGridLines || !showAxisLabels || searchQuery.trim() !== '') && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  )}
                </button>
              </div>

              {/* Canvas Toolbar CSV Export */}
              <button
                id="rrg-export-csv-btn-canvas"
                onClick={() => handleExportCsv('AUTO')}
                className={`px-2.5 py-1 rounded text-xs font-mono font-bold flex items-center space-x-1.5 border transition-all cursor-pointer ${
                  isExported
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black'
                    : isObsidian
                    ? 'bg-[#181f2c] hover:bg-[#20293a] text-amber-300 border-amber-500/40 hover:border-amber-400'
                    : 'bg-white hover:bg-gray-100 text-amber-700 border-amber-300'
                }`}
                title="Export current RRG state and quadrant distribution to CSV"
              >
                {isExported ? <Check className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
                <span>CSV</span>
              </button>
            </div>
          </div>

          {/* Interactive Chart Display Configuration Panel */}
          <AnimatePresence>
            {showConfigPanel && (
              <motion.div
                id="rrg-chart-display-config-panel"
                initial={{ opacity: 0, height: 0, scale: 0.99 }}
                animate={{ opacity: 1, height: 'auto', scale: 1 }}
                exit={{ opacity: 0, height: 0, scale: 0.99 }}
                transition={{ duration: 0.2 }}
                className={`p-4 rounded-xl border mb-4 shadow-xl overflow-hidden ${
                  isObsidian
                    ? 'bg-[#131926] border-[#29354a] text-gray-200'
                    : 'bg-slate-50 border-gray-300 text-gray-800'
                }`}
              >
                {/* Panel Header */}
                <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      <SlidersHorizontal className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-amber-400 flex items-center space-x-2">
                        <span>RRG Chart Display Configuration</span>
                        <span className="text-[10px] font-normal px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                          Visibility Controls
                        </span>
                      </h4>
                      <p className="text-[11px] text-gray-400">
                        Customize chart canvas grid guides, coordinate scale labels, and rotational matrix density.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      id="rrg-reset-display-config-btn"
                      onClick={handleResetDisplayConfig}
                      className={`px-2.5 py-1 rounded text-[11px] font-mono flex items-center space-x-1.5 border transition-all cursor-pointer ${
                        isObsidian
                          ? 'bg-slate-800/80 hover:bg-slate-700 text-gray-300 border-slate-600'
                          : 'bg-white hover:bg-gray-100 text-gray-600 border-gray-300'
                      }`}
                      title="Reset chart display visibility settings to default values"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset Defaults</span>
                    </button>

                    <button
                      id="rrg-close-config-panel-btn"
                      onClick={() => setShowConfigPanel(false)}
                      className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
                      title="Close Configuration Panel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Sector / Security Search Filter Bar */}
                <div
                  id="rrg-config-search-filter-section"
                  className={`p-3.5 rounded-lg border mb-3 transition-all ${
                    searchQuery.trim()
                      ? isObsidian
                        ? 'bg-[#182236] border-amber-500/50 shadow-sm'
                        : 'bg-amber-50/80 border-amber-300 shadow-sm'
                      : isObsidian
                      ? 'bg-[#101522] border-[#222c3d]'
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex-1 w-full relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className={`w-4 h-4 ${searchQuery.trim() ? 'text-amber-400' : 'text-gray-400'}`} />
                      </div>
                      <input
                        id="rrg-config-sector-search-input"
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search & filter visible sectors by name or symbol (e.g. Defense, Tech, Auto, FMCG)..."
                        className={`w-full pl-9 pr-9 py-2 rounded-lg text-xs font-mono transition-all border outline-none ${
                          isObsidian
                            ? 'bg-[#0b0e14] text-white border-[#2b374c] focus:border-amber-400 placeholder-gray-500'
                            : 'bg-gray-50 text-gray-900 border-gray-300 focus:border-amber-500 placeholder-gray-400'
                        }`}
                      />
                      {searchQuery.trim() && (
                        <button
                          id="rrg-config-clear-search-btn"
                          onClick={() => setSearchQuery('')}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white transition-colors cursor-pointer"
                          title="Clear sector search filter"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 shrink-0 font-mono text-[11px]">
                      <span
                        className={`px-2.5 py-1 rounded border font-bold flex items-center space-x-1.5 ${
                          searchQuery.trim()
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : isObsidian
                            ? 'bg-slate-800/60 text-gray-400 border-slate-700/60'
                            : 'bg-gray-100 text-gray-600 border-gray-200'
                        }`}
                      >
                        <span className="text-gray-400 font-normal">Visible on Chart:</span>
                        <strong className="text-amber-400">{filteredItems.length}</strong>
                        <span className="text-gray-400">/ {rrgItems.length}</span>
                      </span>

                      {searchQuery.trim() && (
                        <button
                          id="rrg-config-clear-search-text-btn"
                          onClick={() => setSearchQuery('')}
                          className="text-[10px] font-bold text-amber-400 hover:text-amber-300 underline cursor-pointer px-1 py-0.5"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Quick Sector Suggestion Chips */}
                  {availableSectors.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-white/5 flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
                      <span className="text-gray-400 uppercase tracking-wider text-[9px] mr-1 flex items-center space-x-1">
                        <span>Quick Sectors:</span>
                      </span>
                      {availableSectors.map((sectorName) => {
                        const isActive = searchQuery.toLowerCase().trim() === sectorName.toLowerCase().trim();
                        return (
                          <button
                            key={sectorName}
                            onClick={() => setSearchQuery(isActive ? '' : sectorName)}
                            className={`px-2.5 py-0.5 rounded-full border transition-all cursor-pointer ${
                              isActive
                                ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-xs scale-105'
                                : isObsidian
                                ? 'bg-[#151c28] hover:bg-[#1f293b] text-gray-300 border-[#2a374c]'
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300'
                            }`}
                            title={`Filter visible chart nodes by "${sectorName}"`}
                          >
                            {sectorName}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Empty state alert if no sectors match search */}
                  {searchQuery.trim() !== '' && filteredItems.length === 0 && (
                    <div className="mt-2.5 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center justify-between">
                      <span className="flex items-center space-x-1.5">
                        <Info className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                        <span>No visible sectors match "{searchQuery}". The RRG chart is currently empty.</span>
                      </span>
                      <button
                        onClick={() => setSearchQuery('')}
                        className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 text-[10px] font-bold cursor-pointer transition-colors"
                      >
                        Reset &amp; Show All
                      </button>
                    </div>
                  )}
                </div>

                {/* Grid of Controls */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 font-mono">
                  {/* Toggle 1: Grid Lines Visibility */}
                  <div
                    id="rrg-config-grid-card"
                    className={`p-3 rounded-lg border transition-all ${
                      showGridLines
                        ? isObsidian
                          ? 'bg-[#182133] border-amber-500/40 shadow-sm'
                          : 'bg-white border-amber-400 shadow-sm'
                        : isObsidian
                        ? 'bg-[#10141e] border-[#222b3d] opacity-75'
                        : 'bg-gray-100 border-gray-200 opacity-75'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Grid className={`w-4 h-4 ${showGridLines ? 'text-amber-400' : 'text-gray-500'}`} />
                        <span className="text-xs font-bold uppercase tracking-wider">Grid Lines</span>
                      </div>
                      <button
                        id="rrg-config-toggle-grid-switch"
                        role="switch"
                        aria-checked={showGridLines}
                        onClick={handleToggleGridLines}
                        className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors cursor-pointer ${
                          showGridLines ? 'bg-amber-500' : 'bg-gray-700'
                        }`}
                        title={showGridLines ? 'Hide grid lines' : 'Show grid lines'}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-slate-950 transition-transform ${
                            showGridLines ? 'translate-x-5' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-400 mb-2 leading-relaxed">
                      Background RS-Ratio &amp; RS-Momentum tick lines, division markers, and concentric circular guides.
                    </p>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-gray-400">Current State:</span>
                      <span
                        className={`font-bold px-1.5 py-0.5 rounded text-[9px] uppercase ${
                          showGridLines
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        }`}
                      >
                        {showGridLines ? 'Visible (ON)' : 'Hidden (OFF)'}
                      </span>
                    </div>
                  </div>

                  {/* Toggle 2: Axis Labels Visibility */}
                  <div
                    id="rrg-config-labels-card"
                    className={`p-3 rounded-lg border transition-all ${
                      showAxisLabels
                        ? isObsidian
                          ? 'bg-[#182133] border-amber-500/40 shadow-sm'
                          : 'bg-white border-amber-400 shadow-sm'
                        : isObsidian
                        ? 'bg-[#10141e] border-[#222b3d] opacity-75'
                        : 'bg-gray-100 border-gray-200 opacity-75'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Tag className={`w-4 h-4 ${showAxisLabels ? 'text-amber-400' : 'text-gray-500'}`} />
                        <span className="text-xs font-bold uppercase tracking-wider">Axis Labels</span>
                      </div>
                      <button
                        id="rrg-config-toggle-labels-switch"
                        role="switch"
                        aria-checked={showAxisLabels}
                        onClick={handleToggleAxisLabels}
                        className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors cursor-pointer ${
                          showAxisLabels ? 'bg-amber-500' : 'bg-gray-700'
                        }`}
                        title={showAxisLabels ? 'Hide axis labels' : 'Show axis labels'}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-slate-950 transition-transform ${
                            showAxisLabels ? 'translate-x-5' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-400 mb-2 leading-relaxed">
                      Horizontal JdK RS-Ratio™ &amp; vertical JdK RS-Momentum™ titles, numeric scale ticks, &amp; 100 origin badges.
                    </p>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-gray-400">Current State:</span>
                      <span
                        className={`font-bold px-1.5 py-0.5 rounded text-[9px] uppercase ${
                          showAxisLabels
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        }`}
                      >
                        {showAxisLabels ? 'Visible (ON)' : 'Hidden (OFF)'}
                      </span>
                    </div>
                  </div>

                  {/* Setting 3: Node Label Clutter Mode */}
                  <div
                    id="rrg-config-nodelabels-card"
                    className={`p-3 rounded-lg border ${
                      isObsidian ? 'bg-[#182133] border-[#29354a]' : 'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Eye className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-bold uppercase tracking-wider">Node Labels</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-400 mb-2 leading-relaxed">
                      Control ticker labels displayed next to coordinates on the chart canvas.
                    </p>
                    <div className="flex flex-col space-y-1 mt-1">
                      {(['ALL', 'LEADING_ONLY', 'SELECTED_ONLY'] as const).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setLabelMode(mode)}
                          className={`px-2 py-1 rounded text-[10px] font-bold uppercase text-left transition-colors cursor-pointer flex items-center justify-between ${
                            labelMode === mode
                              ? 'bg-amber-500 text-slate-950 font-black'
                              : isObsidian
                              ? 'bg-slate-800/60 text-gray-400 hover:text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          <span>{mode === 'ALL' ? 'All Tickers' : mode === 'LEADING_ONLY' ? 'Leading Only' : 'Selected Only'}</span>
                          {labelMode === mode && <Check className="w-3 h-3" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Setting 4: Trail Vectors */}
                  <div
                    id="rrg-config-tails-card"
                    className={`p-3 rounded-lg border ${
                      isObsidian ? 'bg-[#182133] border-[#29354a]' : 'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Compass className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-bold uppercase tracking-wider">Trail Vectors</span>
                      </div>
                      <button
                        id="rrg-config-toggle-tails-switch"
                        role="switch"
                        aria-checked={showTails}
                        onClick={() => setShowTails(!showTails)}
                        className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors cursor-pointer ${
                          showTails ? 'bg-amber-500' : 'bg-gray-700'
                        }`}
                        title={showTails ? 'Hide trail vectors' : 'Show trail vectors'}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-slate-950 transition-transform ${
                            showTails ? 'translate-x-5' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-400 mb-2 leading-relaxed">
                      Historical trajectory lines displaying rotation velocity over the past {tailLength} bars.
                    </p>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-gray-400">Current State:</span>
                      <span
                        className={`font-bold px-1.5 py-0.5 rounded text-[9px] uppercase ${
                          showTails
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-gray-700 text-gray-300'
                        }`}
                      >
                        {showTails ? `Active (${tailLength} bars)` : 'Hidden'}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* D3 Relative Rotation Graph Visualization */}
          <D3RrgChart
            items={filteredItems}
            selectedItemId={selectedItemId}
            hoveredItemId={hoveredItemId}
            onSelectItem={handleItemClick}
            onHoverItem={(id) => setHoveredItemId(id)}
            animStep={animStep}
            tailLength={tailLength}
            showTails={showTails}
            benchmark={benchmark}
            isObsidian={isObsidian}
            universeMode={universeMode}
            labelMode={labelMode}
            showGridLines={showGridLines}
            showAxisLabels={showAxisLabels}
          />

          {/* Canvas Footer Indicators */}
          <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-gray-400 mt-2 pt-2 border-t border-white/10">
            <div className="flex items-center space-x-3">
              <span className="flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Leading</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                <span>Improving</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span>Weakening</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                <span>Lagging</span>
              </span>
            </div>

            <div className="text-[10px] text-gray-400">
              💡 Tip: Click any security to inspect details and play its quadrant sound.
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* INSPECTION DRAWER / SELECTED SECURITY DETAIL                              */}
        {/* ========================================================================= */}
        <div className="space-y-4">
          {activeItem ? (
            <div
              className={`p-5 rounded-xl border shadow-xl relative overflow-hidden transition-all ${
                isObsidian ? 'bg-[#121620] border-[#222b3d]' : 'bg-white border-[#e5e4e1]'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between border-b border-white/10 pb-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xl font-mono font-black text-amber-400">
                      {activeItem.ticker}
                    </span>
                    <span
                      className={`text-[9px] font-mono px-2 py-0.5 font-bold uppercase rounded border ${
                        QUADRANT_META[activeItem.quadrant].badgeBg
                      } ${QUADRANT_META[activeItem.quadrant].badgeBorder} ${
                        QUADRANT_META[activeItem.quadrant].badgeText
                      }`}
                    >
                      {activeItem.quadrant} PHASE
                    </span>
                  </div>
                  <h3 className="text-sm font-serif font-bold text-white mt-0.5">
                    {activeItem.name}
                  </h3>
                  <div className="text-[11px] font-mono text-gray-400">
                    {activeItem.sector} • {activeItem.exchange}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-lg font-mono font-bold text-white">
                    {getCurrencySymbol(activeItem.exchange)}
                    {activeItem.currentPrice.toFixed(2)}
                  </div>
                  <div
                    className={`text-xs font-mono font-bold ${
                      activeItem.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {activeItem.changePercent >= 0 ? '+' : ''}
                    {activeItem.changePercent.toFixed(2)}%
                  </div>
                </div>
              </div>

              {/* Rotational Outlook Banner */}
              <div
                className={`p-3 rounded-lg border my-3 text-xs ${
                  QUADRANT_META[activeItem.quadrant].badgeBg
                } ${QUADRANT_META[activeItem.quadrant].badgeBorder}`}
              >
                <div className="font-bold font-mono text-[10px] uppercase text-amber-300 flex items-center space-x-1.5 mb-1">
                  <Compass className="w-3.5 h-3.5" />
                  <span>Rotational Cycle Outlook</span>
                </div>
                <p className="font-sans text-gray-200 text-[11px] leading-relaxed">
                  {activeItem.rotationalOutlook}
                </p>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-2.5 font-mono text-xs my-3">
                <div className="p-2.5 rounded bg-black/20 border border-white/10">
                  <span className="text-[10px] text-gray-400 uppercase block">JdK RS-Ratio:</span>
                  <span
                    className={`text-base font-bold ${
                      activeItem.currentRsRatio >= 100 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {activeItem.currentRsRatio.toFixed(2)}
                  </span>
                  <span className="text-[9px] text-gray-400 block">
                    {activeItem.currentRsRatio >= 100 ? 'Outperforming' : 'Underperforming'}
                  </span>
                </div>

                <div className="p-2.5 rounded bg-black/20 border border-white/10">
                  <span className="text-[10px] text-gray-400 uppercase block">JdK RS-Momentum:</span>
                  <span
                    className={`text-base font-bold ${
                      activeItem.currentRsMomentum >= 100 ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {activeItem.currentRsMomentum.toFixed(2)}
                  </span>
                  <span className="text-[9px] text-gray-400 block">
                    {activeItem.currentRsMomentum >= 100 ? 'Accelerating' : 'Decelerating'}
                  </span>
                </div>

                <div className="p-2.5 rounded bg-black/20 border border-white/10">
                  <span className="text-[10px] text-gray-400 uppercase block">Trajectory Heading:</span>
                  <span className="text-sm font-bold text-white flex items-center space-x-1">
                    <span>{activeItem.headingAngle}°</span>
                    <span className="text-[10px] text-amber-400 font-normal">({activeItem.headingDirection})</span>
                  </span>
                  <span className="text-[9px] text-gray-400 block">Clockwise Vector</span>
                </div>

                <div className="p-2.5 rounded bg-black/20 border border-white/10">
                  <span className="text-[10px] text-gray-400 uppercase block">Velocity (Speed):</span>
                  <span className="text-sm font-bold text-white">
                    {activeItem.velocity.toFixed(2)} pts/bar
                  </span>
                  <span className="text-[9px] text-gray-400 block">Rate of Rotation</span>
                </div>
              </div>

              {/* Minervini SEPA Specifics (For Stocks) */}
              {activeItem.stockRef && (
                <div className="p-3 rounded bg-black/30 border border-white/10 text-xs font-mono my-3 space-y-1.5">
                  <div className="flex justify-between items-center text-[10px] text-gray-400 uppercase font-bold">
                    <span>SEPA Metric</span>
                    <span>Status</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Trend Template Score:</span>
                    <span className="font-bold text-amber-400">
                      {activeItem.trendScore}/8 Rules
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Minervini RS Rating:</span>
                    <span className="font-bold text-emerald-400">
                      {activeItem.rsRating}th Percentile
                    </span>
                  </div>
                  {activeItem.vcpStage && (
                    <div className="flex justify-between">
                      <span className="text-gray-300">VCP Contraction:</span>
                      <span className="font-bold text-amber-300">
                        {activeItem.vcpStage}
                      </span>
                    </div>
                  )}
                  {activeItem.volumeDryUpPercent && (
                    <div className="flex justify-between">
                      <span className="text-gray-300">Volume Dry-Up:</span>
                      <span className="font-bold text-emerald-400">
                        -{activeItem.volumeDryUpPercent}%
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Constituent Watchlist Stocks (For Sectors) */}
              {activeItem.constituentStocks && activeItem.constituentStocks.length > 0 && (
                <div className="p-3 rounded bg-black/30 border border-white/10 text-xs font-mono my-3 space-y-2">
                  <div className="flex justify-between items-center text-[10px] text-amber-400 uppercase font-bold border-b border-white/10 pb-1.5">
                    <span>Constituent Watchlist Stocks ({activeItem.constituentStocks.length})</span>
                    <span className="text-gray-400">Action</span>
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {activeItem.constituentStocks.map((stk) => (
                      <div
                        key={stk.ticker}
                        className="flex items-center justify-between p-1.5 rounded bg-black/25 hover:bg-black/40 border border-white/5 transition-colors"
                      >
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-white text-xs">{stk.ticker}</span>
                          <span className={`text-[10px] ${stk.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {stk.changePercent >= 0 ? '+' : ''}{stk.changePercent.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] font-bold text-amber-300">RS {stk.rsRating}</span>
                          <button
                            onClick={() => {
                              onSelectStock(stk);
                              onViewChart(stk);
                            }}
                            className="px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[9px] uppercase cursor-pointer transition-all shadow-xs"
                            title={`Inspect ${stk.ticker} VCP Chart`}
                          >
                            Chart
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 mt-4 font-mono text-xs">
                {/* Play Sound Button */}
                <button
                  onClick={() => handlePlayQuadrantSound(activeItem.quadrant, `${activeItem.ticker} (${activeItem.quadrant})`)}
                  className="py-2 px-3 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center space-x-1.5 border border-slate-600 cursor-pointer shadow-xs"
                >
                  <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Play Sound</span>
                </button>

                {/* Inspect VCP Chart Button */}
                {activeItem.stockRef ? (
                  <button
                    onClick={() => onViewChart(activeItem.stockRef!)}
                    className="py-2 px-3 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-black flex items-center justify-center space-x-1.5 border border-amber-400 cursor-pointer shadow-md"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>VCP Chart</span>
                  </button>
                ) : (
                  <button
                    disabled
                    className="py-2 px-3 rounded bg-gray-800 text-gray-500 font-mono text-[10px]"
                  >
                    Sector Summary
                  </button>
                )}

                {/* Toggle Watchlist Button */}
                {activeItem.stockRef && onToggleWatchlist && (
                  <button
                    onClick={() => onToggleWatchlist(activeItem.ticker)}
                    className="col-span-2 py-2 px-3 rounded bg-black/40 hover:bg-black/60 text-gray-300 hover:text-white font-bold flex items-center justify-center space-x-1.5 border border-white/10 cursor-pointer"
                  >
                    <Bookmark className="w-3.5 h-3.5 text-amber-400" />
                    <span>
                      {watchlistTickers.includes(activeItem.ticker)
                        ? 'Remove from Watchlist'
                        : 'Add to Watchlist'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-xl border border-white/10 bg-black/20 text-center text-gray-400 font-mono text-xs">
              Select a security on the chart or in the table to inspect details.
            </div>
          )}

          {/* ========================================================================= */}
          {/* MINERVINI SEPA RRG TRADING PLAYBOOK GUIDE                                 */}
          {/* ========================================================================= */}
          <div
            className={`p-4 rounded-xl border text-xs ${
              isObsidian ? 'bg-[#121620] border-[#222b3d]' : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div className="flex items-center space-x-2 font-mono font-bold text-amber-400 uppercase text-[11px] mb-2 border-b border-white/10 pb-2">
              <Award className="w-4 h-4" />
              <span>Minervini SEPA &amp; RRG Playbook</span>
            </div>

            <ul className="space-y-2 text-[11px] text-gray-300 font-sans leading-relaxed">
              <li className="flex items-start space-x-1.5">
                <span className="text-emerald-400 font-bold font-mono">1.</span>
                <span>
                  <strong>Buy the Turn (Improving ↗ Leading):</strong> Enter setups exhibiting Stage 2 VCP contractions as they rotate upward from the Improving into the Leading quadrant before broad institutional coverage.
                </span>
              </li>
              <li className="flex items-start space-x-1.5">
                <span className="text-amber-400 font-bold font-mono">2.</span>
                <span>
                  <strong>Defend Gains (Weakening ↘):</strong> When a stock enters Weakening (RS-Ratio &gt; 100 but Momentum &lt; 100), avoid adding. Trail your stop-loss tighter to the 20-day or 50-day moving average.
                </span>
              </li>
              <li className="flex items-start space-x-1.5">
                <span className="text-rose-400 font-bold font-mono">3.</span>
                <span>
                  <strong>Avoid Value Traps (Lagging ↙):</strong> Underperforming benchmark with negative momentum. Minervini discipline prohibits holding or buying stocks stuck in the Lagging quadrant.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. SEARCHABLE & SORTABLE ROTATIONAL RANKINGS TABLE                        */}
      {/* ========================================================================= */}
      <div
        className={`p-6 rounded-xl border shadow-xl ${
          isObsidian ? 'bg-[#121620] border-[#222b3d]' : 'bg-white border-[#e5e4e1]'
        }`}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-serif font-black text-white">
                Rotational Quadrant Rankings &amp; Leadership Table
              </h3>
            </div>
            <p className="text-xs text-gray-400 font-sans mt-0.5">
              Ranked list showing JdK RS-Ratio, RS-Momentum, Heading Angle, and Minervini SEPA metrics.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="text-xs font-mono text-gray-400">
              Showing <strong className="text-amber-400">{filteredItems.length}</strong> of {rrgItems.length} securities
            </div>

            {/* Table Download CSV Button */}
            <button
              id="rrg-export-csv-btn-table"
              onClick={() => handleExportCsv('AUTO')}
              className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold uppercase flex items-center space-x-1.5 transition-all cursor-pointer shadow-xs active:scale-95 ${
                isExported
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black shadow-emerald-500/20 shadow-md'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-400'
              }`}
              title="Download complete RRG state and quadrant distribution data as CSV for offline analysis"
            >
              {isExported ? <Check className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
              <span>{isExported ? 'CSV Exported ✓' : 'Download RRG CSV'}</span>
            </button>
          </div>
        </div>

        {/* Responsive Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-white/15 text-[10px] text-gray-400 uppercase tracking-wider">
                <th className="pb-3 pr-4">Security</th>
                <th className="pb-3 px-3">Quadrant</th>
                <th className="pb-3 px-3 text-right">JdK RS-Ratio</th>
                <th className="pb-3 px-3 text-right">JdK RS-Momentum</th>
                <th className="pb-3 px-3 text-right">Velocity</th>
                <th className="pb-3 px-3 text-right">Heading</th>
                <th className="pb-3 px-3 text-right">RS Rating</th>
                <th className="pb-3 pl-3 text-center">Audio &amp; Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredItems.map((item) => {
                const isSelected = item.id === selectedItemId;
                const quadMeta = QUADRANT_META[item.quadrant];

                return (
                  <tr
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/15 text-white font-bold'
                        : 'hover:bg-white/5 text-gray-300'
                    }`}
                  >
                    {/* Security */}
                    <td className="py-3 pr-4">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-amber-400 font-mono text-sm">
                          {item.ticker}
                        </span>
                        <span className="text-[10px] text-gray-400 truncate max-w-[160px]">
                          {item.name}
                        </span>
                      </div>
                      <div className="text-[9px] text-gray-500">
                        {item.sector} • {item.exchange}
                      </div>
                    </td>

                    {/* Quadrant */}
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center space-x-1 text-[9px] font-bold uppercase px-2 py-0.5 rounded border ${
                          quadMeta.badgeBg
                        } ${quadMeta.badgeBorder} ${quadMeta.badgeText}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            item.quadrant === 'LEADING'
                              ? 'bg-emerald-400 animate-pulse'
                              : item.quadrant === 'IMPROVING'
                              ? 'bg-cyan-400'
                              : item.quadrant === 'WEAKENING'
                              ? 'bg-amber-400'
                              : 'bg-rose-400'
                          }`}
                        />
                        <span>{item.quadrant}</span>
                      </span>
                    </td>

                    {/* RS-Ratio */}
                    <td className="py-3 px-3 text-right font-bold">
                      <span
                        className={item.currentRsRatio >= 100 ? 'text-emerald-400' : 'text-rose-400'}
                      >
                        {item.currentRsRatio.toFixed(2)}
                      </span>
                    </td>

                    {/* RS-Momentum */}
                    <td className="py-3 px-3 text-right font-bold">
                      <span
                        className={item.currentRsMomentum >= 100 ? 'text-emerald-400' : 'text-amber-400'}
                      >
                        {item.currentRsMomentum.toFixed(2)}
                      </span>
                    </td>

                    {/* Velocity */}
                    <td className="py-3 px-3 text-right text-gray-300">
                      {item.velocity.toFixed(2)}
                    </td>

                    {/* Heading */}
                    <td className="py-3 px-3 text-right">
                      <span className="text-gray-300 font-mono">
                        {item.headingAngle}°
                      </span>
                      <span className="text-[9px] text-amber-400 block font-sans">
                        {item.headingDirection}
                      </span>
                    </td>

                    {/* RS Rating */}
                    <td className="py-3 px-3 text-right font-bold">
                      <span
                        className={
                          item.rsRating >= 85
                            ? 'text-emerald-400'
                            : item.rsRating >= 70
                            ? 'text-amber-400'
                            : 'text-gray-400'
                        }
                      >
                        {item.rsRating}
                      </span>
                    </td>

                    {/* Audio & Action */}
                    <td className="py-3 pl-3 text-center">
                      <div className="flex items-center justify-center space-x-1.5">
                        {/* Audio Trigger */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePlayQuadrantSound(item.quadrant, `${item.ticker} (${item.quadrant})`);
                          }}
                          className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-600 transition-transform hover:scale-110 cursor-pointer"
                          title={`Play ${item.quadrant} sound`}
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Chart Jump */}
                        {item.stockRef && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewChart(item.stockRef!);
                            }}
                            className="p-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-transform hover:scale-110 cursor-pointer shadow-xs"
                            title="Open in VCP Chart"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
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
      </div>
    </div>
  );
};
