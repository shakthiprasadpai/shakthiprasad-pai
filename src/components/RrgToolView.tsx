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
} from '../utils/rrgCalculator';
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
} from 'lucide-react';

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
  // Mode: All Setups, Watchlist, or Sectors
  const [universeMode, setUniverseMode] = useState<'SEPA_SETUPS' | 'WATCHLIST' | 'SECTORS'>('SEPA_SETUPS');
  const [benchmark, setBenchmark] = useState<RrgBenchmark>('SPY');
  const [timeframe, setTimeframe] = useState<RrgTimeframe>('WEEKLY');
  const [tailLength, setTailLength] = useState<number>(5); // 3, 5, 8, 10
  const [showTails, setShowTails] = useState<boolean>(true);
  const [labelMode, setLabelMode] = useState<'ALL' | 'LEADING_ONLY' | 'SELECTED_ONLY'>('ALL');
  const [selectedQuadrant, setSelectedQuadrant] = useState<RrgQuadrant | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(selectedStockTicker || null);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

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

  // Filter input stocks according to universe mode
  const targetStocks = useMemo(() => {
    if (universeMode === 'WATCHLIST') {
      return stocks.filter((s) => watchlistTickers.includes(s.ticker));
    }
    return stocks;
  }, [stocks, universeMode, watchlistTickers]);

  // Compute RRG items
  const rrgItems = useMemo<RrgSecurityData[]>(() => {
    if (universeMode === 'SECTORS') {
      return computeSectorsRrg(stocks, benchmark, timeframe, tailLength);
    }
    return computeStocksRrg(targetStocks, benchmark, timeframe, tailLength);
  }, [universeMode, stocks, targetStocks, benchmark, timeframe, tailLength]);

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
        const q = searchQuery.toLowerCase();
        const matchTicker = item.ticker.toLowerCase().includes(q);
        const matchName = item.name.toLowerCase().includes(q);
        const matchSector = item.sector.toLowerCase().includes(q);
        if (!matchTicker && !matchName && !matchSector) return false;
      }
      return true;
    });
  }, [rrgItems, selectedQuadrant, searchQuery]);

  // Active highlighted item
  const activeItemId = hoveredItemId || selectedItemId;
  const activeItem = useMemo(() => {
    return rrgItems.find((item) => item.id === activeItemId) || rrgItems[0] || null;
  }, [rrgItems, activeItemId]);

  // Coordinate Mapping for SVG Canvas
  // Domain: JdK RS-Ratio & RS-Momentum from 86 to 114 (Centered at 100)
  const minVal = 86;
  const maxVal = 114;
  const svgWidth = 820;
  const svgHeight = 620;
  const padLeft = 60;
  const padRight = 50;
  const padTop = 50;
  const padBottom = 50;

  const mapX = (val: number) => {
    const clamped = Math.max(minVal, Math.min(maxVal, val));
    return padLeft + ((clamped - minVal) / (maxVal - minVal)) * (svgWidth - padLeft - padRight);
  };

  const mapY = (val: number) => {
    // Inverted in SVG: higher value = lower Y coordinate
    const clamped = Math.max(minVal, Math.min(maxVal, val));
    return svgHeight - padBottom - ((clamped - minVal) / (maxVal - minVal)) * (svgHeight - padTop - padBottom);
  };

  const originX = mapX(100);
  const originY = mapY(100);

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

          {/* Quick Sound Control Box */}
          <div
            className={`p-3 rounded-lg border flex flex-col sm:flex-row items-center gap-3 shrink-0 ${
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
          <div>
            <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1.5">
              1. Universe Target:
            </label>
            <div className="grid grid-cols-3 border border-white/15 rounded p-0.5 bg-black/20">
              <button
                onClick={() => setUniverseMode('SEPA_SETUPS')}
                className={`py-1.5 px-2 text-center rounded font-bold uppercase transition-all cursor-pointer ${
                  universeMode === 'SEPA_SETUPS'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                SEPA Setups
              </button>
              <button
                onClick={() => setUniverseMode('WATCHLIST')}
                className={`py-1.5 px-2 text-center rounded font-bold uppercase transition-all cursor-pointer ${
                  universeMode === 'WATCHLIST'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Watchlist ({watchlistTickers.length})
              </button>
              <button
                onClick={() => setUniverseMode('SECTORS')}
                className={`py-1.5 px-2 text-center rounded font-bold uppercase transition-all cursor-pointer ${
                  universeMode === 'SECTORS'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Sectors
              </button>
            </div>
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
            </div>
          </div>

          {/* SVG Canvas Area */}
          <div className="relative w-full aspect-[4/3] max-h-[620px] select-none">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-full"
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                {/* Arrow markers for trail directional heads */}
                <marker id="arrow-emerald" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill="#10b981" />
                </marker>
                <marker id="arrow-cyan" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill="#06b6d4" />
                </marker>
                <marker id="arrow-amber" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill="#f59e0b" />
                </marker>
                <marker id="arrow-rose" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill="#f43f5e" />
                </marker>

                {/* Subtle quadrant background gradients */}
                <radialGradient id="grad-leading" cx="80%" cy="20%" r="65%">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.01" />
                </radialGradient>
                <radialGradient id="grad-improving" cx="20%" cy="20%" r="65%">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.01" />
                </radialGradient>
                <radialGradient id="grad-lagging" cx="20%" cy="80%" r="65%">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.01" />
                </radialGradient>
                <radialGradient id="grad-weakening" cx="80%" cy="80%" r="65%">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.01" />
                </radialGradient>
              </defs>

              {/* 1. QUADRANT BACKGROUND FILLS */}
              {/* Top-Right: LEADING */}
              <rect
                x={originX}
                y={padTop}
                width={svgWidth - padRight - originX}
                height={originY - padTop}
                fill="url(#grad-leading)"
              />
              {/* Top-Left: IMPROVING */}
              <rect
                x={padLeft}
                y={padTop}
                width={originX - padLeft}
                height={originY - padTop}
                fill="url(#grad-improving)"
              />
              {/* Bottom-Left: LAGGING */}
              <rect
                x={padLeft}
                y={originY}
                width={originX - padLeft}
                height={svgHeight - padBottom - originY}
                fill="url(#grad-lagging)"
              />
              {/* Bottom-Right: WEAKENING */}
              <rect
                x={originX}
                y={originY}
                width={svgWidth - padRight - originX}
                height={svgHeight - padBottom - originY}
                fill="url(#grad-weakening)"
              />

              {/* 2. QUADRANT WATERMARK LABELS */}
              <text
                x={svgWidth - padRight - 15}
                y={padTop + 24}
                textAnchor="end"
                className="font-mono text-xs font-black tracking-widest uppercase"
                fill="#10b981"
                fillOpacity="0.4"
              >
                LEADING ↗
              </text>
              <text
                x={padLeft + 15}
                y={padTop + 24}
                textAnchor="start"
                className="font-mono text-xs font-black tracking-widest uppercase"
                fill="#06b6d4"
                fillOpacity="0.4"
              >
                ↖ IMPROVING
              </text>
              <text
                x={padLeft + 15}
                y={svgHeight - padBottom - 15}
                textAnchor="start"
                className="font-mono text-xs font-black tracking-widest uppercase"
                fill="#f43f5e"
                fillOpacity="0.4"
              >
                ↙ LAGGING
              </text>
              <text
                x={svgWidth - padRight - 15}
                y={svgHeight - padBottom - 15}
                textAnchor="end"
                className="font-mono text-xs font-black tracking-widest uppercase"
                fill="#f59e0b"
                fillOpacity="0.4"
              >
                WEAKENING ↘
              </text>

              {/* 3. CLOCKWISE ROTATION FLOW INDICATOR (Center Arc) */}
              <circle
                cx={originX}
                cy={originY}
                r="70"
                fill="none"
                stroke="#ffffff"
                strokeOpacity="0.08"
                strokeDasharray="4 4"
              />
              <path
                d={`M ${originX + 70} ${originY} A 70 70 0 0 1 ${originX} ${originY + 70}`}
                fill="none"
                stroke="#f59e0b"
                strokeOpacity="0.25"
                strokeWidth="2"
                strokeDasharray="3 3"
              />
              <path
                d={`M ${originX} ${originY + 70} A 70 70 0 0 1 ${originX - 70} ${originY}`}
                fill="none"
                stroke="#f43f5e"
                strokeOpacity="0.25"
                strokeWidth="2"
                strokeDasharray="3 3"
              />
              <path
                d={`M ${originX - 70} ${originY} A 70 70 0 0 1 ${originX} ${originY - 70}`}
                fill="none"
                stroke="#06b6d4"
                strokeOpacity="0.25"
                strokeWidth="2"
                strokeDasharray="3 3"
              />
              <path
                d={`M ${originX} ${originY - 70} A 70 70 0 0 1 ${originX + 70} ${originY}`}
                fill="none"
                stroke="#10b981"
                strokeOpacity="0.25"
                strokeWidth="2"
                strokeDasharray="3 3"
              />

              {/* 4. GRID LINES & TICKS */}
              {[90, 95, 105, 110].map((val) => (
                <g key={`grid-x-${val}`}>
                  <line
                    x1={mapX(val)}
                    y1={padTop}
                    x2={mapX(val)}
                    y2={svgHeight - padBottom}
                    stroke="#ffffff"
                    strokeOpacity="0.05"
                    strokeDasharray="2 4"
                  />
                  <text
                    x={mapX(val)}
                    y={svgHeight - padBottom + 18}
                    textAnchor="middle"
                    className="font-mono text-[10px]"
                    fill="#888888"
                  >
                    {val}
                  </text>
                </g>
              ))}

              {[90, 95, 105, 110].map((val) => (
                <g key={`grid-y-${val}`}>
                  <line
                    x1={padLeft}
                    y1={mapY(val)}
                    x2={svgWidth - padRight}
                    y2={mapY(val)}
                    stroke="#ffffff"
                    strokeOpacity="0.05"
                    strokeDasharray="2 4"
                  />
                  <text
                    x={padLeft - 10}
                    y={mapY(val) + 3}
                    textAnchor="end"
                    className="font-mono text-[10px]"
                    fill="#888888"
                  >
                    {val}
                  </text>
                </g>
              ))}

              {/* 5. CENTER CROSSHAIR AXES (At 100, 100) */}
              <line
                x1={originX}
                y1={padTop}
                x2={originX}
                y2={svgHeight - padBottom}
                stroke="#ffffff"
                strokeOpacity="0.3"
                strokeWidth="1.5"
              />
              <line
                x1={padLeft}
                y1={originY}
                x2={svgWidth - padRight}
                y2={originY}
                stroke="#ffffff"
                strokeOpacity="0.3"
                strokeWidth="1.5"
              />

              {/* Axis Origin Marker: 100 */}
              <rect
                x={originX - 16}
                y={svgHeight - padBottom + 6}
                width="32"
                height="16"
                rx="3"
                fill="#f59e0b"
              />
              <text
                x={originX}
                y={svgHeight - padBottom + 18}
                textAnchor="middle"
                className="font-mono text-[10px] font-black"
                fill="#000000"
              >
                100
              </text>

              <rect
                x={padLeft - 32}
                y={originY - 8}
                width="26"
                height="16"
                rx="3"
                fill="#f59e0b"
              />
              <text
                x={padLeft - 19}
                y={originY + 4}
                textAnchor="middle"
                className="font-mono text-[10px] font-black"
                fill="#000000"
              >
                100
              </text>

              {/* Axis Titles */}
              <text
                x={svgWidth / 2}
                y={svgHeight - 12}
                textAnchor="middle"
                className="font-mono text-xs font-bold uppercase tracking-wider"
                fill="#b5a68d"
              >
                JdK RS-Ratio™ (Relative Strength Trend vs Benchmark) →
              </text>

              <text
                x={20}
                y={svgHeight / 2}
                textAnchor="middle"
                transform={`rotate(-90 20 ${svgHeight / 2})`}
                className="font-mono text-xs font-bold uppercase tracking-wider"
                fill="#b5a68d"
              >
                JdK RS-Momentum™ (Rate of Change) →
              </text>

              {/* 6. SECURITY TRAIL LINES & NODES */}
              {filteredItems.map((item) => {
                const isSelected = item.id === selectedItemId;
                const isHovered = item.id === hoveredItemId;
                const isProminent = isSelected || isHovered;

                // Points up to current animation step
                const currentTail = item.tailPoints.slice(0, animStep + 1);
                const headPoint = currentTail[currentTail.length - 1] || item.tailPoints[item.tailPoints.length - 1];

                const headX = mapX(headPoint.rsRatio);
                const headY = mapY(headPoint.rsMomentum);

                const quadMeta = QUADRANT_META[item.quadrant];
                const markerId = `arrow-${
                  item.quadrant === 'LEADING'
                    ? 'emerald'
                    : item.quadrant === 'IMPROVING'
                    ? 'cyan'
                    : item.quadrant === 'WEAKENING'
                    ? 'amber'
                    : 'rose'
                }`;

                return (
                  <g
                    key={item.id}
                    className="cursor-pointer transition-opacity"
                    opacity={selectedItemId && !isProminent ? 0.35 : 1}
                    onClick={() => handleItemClick(item)}
                    onMouseEnter={() => setHoveredItemId(item.id)}
                    onMouseLeave={() => setHoveredItemId(null)}
                  >
                    {/* Trajectory Tail Polyline */}
                    {showTails && currentTail.length > 1 && (
                      <polyline
                        points={currentTail.map((p) => `${mapX(p.rsRatio)},${mapY(p.rsMomentum)}`).join(' ')}
                        fill="none"
                        stroke={quadMeta.themeColor}
                        strokeWidth={isProminent ? 3 : 1.75}
                        strokeOpacity={isProminent ? 0.95 : 0.6}
                        markerEnd={`url(#${markerId})`}
                      />
                    )}

                    {/* Historical Tail Dots */}
                    {showTails &&
                      currentTail.slice(0, -1).map((pt, idx) => (
                        <circle
                          key={`${item.id}-step-${idx}`}
                          cx={mapX(pt.rsRatio)}
                          cy={mapY(pt.rsMomentum)}
                          r={isProminent ? 2.5 : 1.8}
                          fill={quadMeta.themeColor}
                          fillOpacity={(idx + 1) / currentTail.length * 0.7}
                        />
                      ))}

                    {/* Pulsing Selection Halo */}
                    {isProminent && (
                      <circle
                        cx={headX}
                        cy={headY}
                        r="12"
                        fill="none"
                        stroke={quadMeta.themeColor}
                        strokeWidth="2"
                        strokeOpacity="0.8"
                        className="animate-ping"
                      />
                    )}

                    {/* Head Node Circle */}
                    <circle
                      cx={headX}
                      cy={headY}
                      r={isProminent ? 6.5 : 4.5}
                      fill={quadMeta.themeColor}
                      stroke="#ffffff"
                      strokeWidth={isProminent ? 2 : 1}
                      className="shadow-sm transition-transform"
                    />

                    {/* Node Ticker Label */}
                    <text
                      x={headX + 7}
                      y={headY + 3.5}
                      className={`font-mono font-black ${isProminent ? 'text-xs' : 'text-[10px]'}`}
                      fill={isProminent ? '#ffffff' : quadMeta.themeColor}
                      stroke="#000000"
                      strokeWidth="2"
                      paintOrder="stroke"
                    >
                      {item.ticker}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

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

              {/* Minervini SEPA Specifics */}
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

          <div className="text-xs font-mono text-gray-400">
            Showing <strong className="text-amber-400">{filteredItems.length}</strong> of {rrgItems.length} securities
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
