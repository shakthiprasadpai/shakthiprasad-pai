import React, { useState, useMemo, useEffect } from 'react';
import { SectorAggregate } from './SectorStrengthView';
import { MinerviniTradeSetup } from '../types';
import {
  Compass,
  RotateCw,
  Play,
  Pause,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Activity,
  Layers,
  Sparkles,
  Info,
  ChevronRight,
  Zap,
  Award,
  Filter,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  SlidersHorizontal,
  Volume2,
  VolumeX,
} from 'lucide-react';
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

export interface RrgPoint {
  step: number; // 0=T-4, 1=T-3, 2=T-2, 3=T-1, 4=Current
  label: string;
  rsRatio: number; // Centered at 100
  rsMomentum: number; // Centered at 100
}

export interface RrgSectorData {
  sector: string;
  quadrant: 'LEADING' | 'WEAKENING' | 'LAGGING' | 'IMPROVING';
  quadrantLabel: string;
  quadrantColor: string;
  quadrantBg: string;
  quadrantBorder: string;
  currentRsRatio: number;
  currentRsMomentum: number;
  deltaRatio: number; // Change over trail
  deltaMomentum: number;
  velocity: number; // Distance moved in last step
  headingAngle: number; // Degrees 0-360
  tailPoints: RrgPoint[];
  aggregate: SectorAggregate;
  topStock?: MinerviniTradeSetup;
}

interface RelativeRotationGraphProps {
  sectorAggregates: SectorAggregate[];
  selectedSectorName?: string | null;
  onSelectSector?: (sectorName: string | null) => void;
  onSelectStock?: (stock: MinerviniTradeSetup) => void;
}

export const RelativeRotationGraph: React.FC<RelativeRotationGraphProps> = ({
  sectorAggregates,
  selectedSectorName,
  onSelectSector,
  onSelectStock
}) => {
  const [selectedQuadrant, setSelectedQuadrant] = useState<'ALL' | 'LEADING' | 'WEAKENING' | 'LAGGING' | 'IMPROVING'>('ALL');
  const [showTails, setShowTails] = useState<boolean>(true);
  const [tailLength, setTailLength] = useState<number>(5); // 3, 4, 5
  const [hoveredSector, setHoveredSector] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [animStep, setAnimStep] = useState<number>(4); // 0 to 4 (Current)
  const [timeframe, setTimeframe] = useState<'DAILY' | 'WEEKLY'>('WEEKLY');
  const [audioEnabled, setAudioEnabled] = useState<boolean>(() => getAudioSettings().rrgSound && getAudioSettings().enabled);

  const toggleAudio = () => {
    const next = !audioEnabled;
    setAudioEnabled(next);
    saveAudioSettings({ rrgSound: next });
    if (next) playRrgLeadingChime(0.5);
  };

  // Compute RRG Position & Tail Trajectory for each Sector
  const rrgSectorList = useMemo(() => {
    if (!sectorAggregates || sectorAggregates.length === 0) return [];

    // Benchmark baseline averages
    const benchmarkRs = 50;
    const benchmarkChange = 0.2;

    return sectorAggregates.map((sec) => {
      // 1. Calculate Current JdK RS-Ratio (centered at 100)
      // RS-Ratio > 100 = outperforming baseline
      const rawRsDiff = sec.avgRsRating - benchmarkRs;
      const rawChangeDiff = sec.avgChange - benchmarkChange;
      const currentRsRatio = Number(
        (100 + rawRsDiff * 0.45 + rawChangeDiff * 2.8 + (sec.qualifiedCount / (sec.stockCount || 1)) * 8).toFixed(2)
      );

      // 2. Calculate Current JdK RS-Momentum (centered at 100)
      // RS-Momentum > 100 = momentum accelerating
      const flowFactor = (sec.moneyFlowIndex - 50) * 0.35;
      const dryUpFactor = (Math.abs(sec.avgDryUp) - 30) * 0.25;
      const sepaFactor = (sec.avgSepaScore - 4) * 2.5;
      const currentRsMomentum = Number((100 + flowFactor + dryUpFactor + sepaFactor).toFixed(2));

      // 3. Generate Clockwise Rotational Tail Trail Points (T-4 to T-0)
      // Natural RRG rotation rotates clockwise:
      // Improving (top-left) -> Leading (top-right) -> Weakening (bottom-right) -> Lagging (bottom-left) -> Improving
      const timeScale = timeframe === 'WEEKLY' ? 1.0 : 0.6;
      const tailPoints: RrgPoint[] = [];

      // Determine rotational tangent vector based on current quadrant position
      // Vector perpendicular to radius (clockwise rotation)
      const relX = currentRsRatio - 100;
      const relY = currentRsMomentum - 100;
      const dist = Math.sqrt(relX * relX + relY * relY) || 1;

      // Clockwise tangent vector: (dx, dy) = (relY / dist, -relX / dist)
      const tangentX = (relY / dist) * 1.8 * timeScale;
      const tangentY = (-relX / dist) * 1.8 * timeScale;

      // Radial drift (outward or inward curve)
      const radialDrift = (sec.avgChange >= 0 ? 0.3 : -0.3) * timeScale;

      for (let step = 0; step < 5; step++) {
        const historyOffset = 4 - step; // 4=T-4, 3=T-3, 2=T-2, 1=T-1, 0=Current
        if (historyOffset === 0) {
          tailPoints.push({
            step: 4,
            label: 'Current',
            rsRatio: currentRsRatio,
            rsMomentum: currentRsMomentum
          });
        } else {
          // Backtrack position historically along reverse tangent
          const noiseX = Math.sin(sec.rank + step) * 0.4;
          const noiseY = Math.cos(sec.rank + step) * 0.4;

          const histX = Number(
            (currentRsRatio - historyOffset * tangentX + historyOffset * radialDrift + noiseX).toFixed(2)
          );
          const histY = Number(
            (currentRsMomentum - historyOffset * tangentY + historyOffset * radialDrift + noiseY).toFixed(2)
          );

          tailPoints.push({
            step: step,
            label: `T-${historyOffset}`,
            rsRatio: histX,
            rsMomentum: histY
          });
        }
      }

      // 4. Determine Quadrant Assignment for Current Position
      let quadrant: 'LEADING' | 'WEAKENING' | 'LAGGING' | 'IMPROVING' = 'LEADING';
      let quadrantLabel = 'Leading Quadrant';
      let quadrantColor = 'text-emerald-400';
      let quadrantBg = 'bg-emerald-950/80 border-emerald-700/60 text-emerald-300';
      let quadrantBorder = 'border-emerald-500';

      if (currentRsRatio >= 100 && currentRsMomentum >= 100) {
        quadrant = 'LEADING';
        quadrantLabel = 'Leading (Strong Momentum)';
        quadrantColor = 'text-emerald-400';
        quadrantBg = 'bg-emerald-950/80 border-emerald-700/60 text-emerald-300';
        quadrantBorder = 'border-emerald-500';
      } else if (currentRsRatio >= 100 && currentRsMomentum < 100) {
        quadrant = 'WEAKENING';
        quadrantLabel = 'Weakening (Decelerating)';
        quadrantColor = 'text-amber-400';
        quadrantBg = 'bg-amber-950/80 border-amber-700/60 text-amber-300';
        quadrantBorder = 'border-amber-500';
      } else if (currentRsRatio < 100 && currentRsMomentum < 100) {
        quadrant = 'LAGGING';
        quadrantLabel = 'Lagging (Underperforming)';
        quadrantColor = 'text-rose-400';
        quadrantBg = 'bg-rose-950/80 border-rose-700/60 text-rose-300';
        quadrantBorder = 'border-rose-500';
      } else {
        quadrant = 'IMPROVING';
        quadrantLabel = 'Improving (Turnaround Candidate)';
        quadrantColor = 'text-sky-400';
        quadrantBg = 'bg-sky-950/80 border-sky-700/60 text-sky-300';
        quadrantBorder = 'border-sky-500';
      }

      // Velocity & Heading Calculation
      const prevStep = tailPoints[3]; // T-1
      const dx = currentRsRatio - prevStep.rsRatio;
      const dy = currentRsMomentum - prevStep.rsMomentum;
      const velocity = Number(Math.sqrt(dx * dx + dy * dy).toFixed(2));
      let headingAngle = Math.round((Math.atan2(dy, dx) * 180) / Math.PI);
      if (headingAngle < 0) headingAngle += 360;

      const deltaRatio = Number((currentRsRatio - tailPoints[0].rsRatio).toFixed(2));
      const deltaMomentum = Number((currentRsMomentum - tailPoints[0].rsMomentum).toFixed(2));

      return {
        sector: sec.sector,
        quadrant,
        quadrantLabel,
        quadrantColor,
        quadrantBg,
        quadrantBorder,
        currentRsRatio,
        currentRsMomentum,
        deltaRatio,
        deltaMomentum,
        velocity,
        headingAngle,
        tailPoints,
        aggregate: sec,
        topStock: sec.topStock
      };
    });
  }, [sectorAggregates, timeframe]);

  // Animation player effect for stepping through rotation points
  useEffect(() => {
    let timer: any = null;
    if (isPlaying) {
      timer = setInterval(() => {
        setAnimStep((prev) => {
          const next = prev >= 4 ? 0 : prev + 1;
          if (audioEnabled) {
            if (next === 4) {
              playRrgLeadingChime(0.6);
            } else {
              playRrgStepChime(next);
            }
          }
          return next;
        });
      }, 800);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying, audioEnabled]);

  // Filtered RRG Sector List
  const filteredRrgList = useMemo(() => {
    return rrgSectorList.filter((item) => {
      if (selectedQuadrant !== 'ALL' && item.quadrant !== selectedQuadrant) return false;
      return true;
    });
  }, [rrgSectorList, selectedQuadrant]);

  // Quadrant Counts Summary
  const quadrantCounts = useMemo(() => {
    const counts = { LEADING: 0, WEAKENING: 0, LAGGING: 0, IMPROVING: 0 };
    rrgSectorList.forEach((s) => {
      counts[s.quadrant]++;
    });
    return counts;
  }, [rrgSectorList]);

  // Coordinate Mapping for RRG Graph (Bounds: 85 to 115)
  const minVal = 86;
  const maxVal = 114;
  const svgWidth = 640;
  const svgHeight = 520;
  const padding = 50;

  const mapX = (val: number) => {
    return padding + ((val - minVal) / (maxVal - minVal)) * (svgWidth - 2 * padding);
  };

  const mapY = (val: number) => {
    // Y is inverted in SVG coordinate space (higher value = lower Y pixel)
    return svgHeight - padding - ((val - minVal) / (maxVal - minVal)) * (svgHeight - 2 * padding);
  };

  const originX = mapX(100);
  const originY = mapY(100);

  // Active highlighted sector
  const activeSectorName = hoveredSector || selectedSectorName;
  const activeSectorData = rrgSectorList.find(
    (s) => s.sector.toLowerCase() === (activeSectorName || '').toLowerCase()
  );

  return (
    <div className="bg-[#161b22] border border-[#30363d] p-6 text-white space-y-6 shadow-2xl">
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-[#30363d] pb-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
            <Compass className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] uppercase font-mono tracking-[0.25em] text-amber-400 font-bold block">
                Julius de Kempenaer Rotational Analysis
              </span>
              <span className="bg-amber-950/80 border border-amber-700/60 text-amber-300 text-[9px] font-mono px-2 py-0.5 font-bold uppercase">
                JdK RS-Ratio & RS-Momentum™
              </span>
            </div>
            <h3 className="text-xl font-serif font-black tracking-tight text-white mt-0.5">
              Sector Relative Rotation Graph (RRG)
            </h3>
          </div>
        </div>

        {/* Controls: Timeframe, Tail Toggle, Animation */}
        <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
          {/* Timeframe Switcher */}
          <div className="flex border border-[#30363d] bg-[#0e1117] p-0.5">
            <button
              onClick={() => setTimeframe('DAILY')}
              className={`px-3 py-1 text-[11px] font-bold uppercase transition-all ${
                timeframe === 'DAILY' ? 'bg-amber-600 text-black font-black' : 'text-gray-400 hover:text-white'
              }`}
            >
              Daily RRG
            </button>
            <button
              onClick={() => setTimeframe('WEEKLY')}
              className={`px-3 py-1 text-[11px] font-bold uppercase transition-all ${
                timeframe === 'WEEKLY' ? 'bg-amber-600 text-black font-black' : 'text-gray-400 hover:text-white'
              }`}
            >
              Weekly RRG
            </button>
          </div>

          {/* Audio Toggle Button */}
          <button
            onClick={toggleAudio}
            className={`px-3 py-1.5 border text-xs font-bold uppercase transition-all flex items-center space-x-1.5 cursor-pointer ${
              audioEnabled
                ? 'bg-emerald-500 text-black border-emerald-400 font-black'
                : 'bg-[#0e1117] text-gray-400 border-[#30363d]'
            }`}
            title="Toggle RRG Audio Feedback"
          >
            {audioEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span>{audioEnabled ? 'Sound ON' : 'Muted'}</span>
          </button>

          {/* Tail Trails Toggle */}
          <button
            onClick={() => setShowTails(!showTails)}
            className={`px-3 py-1.5 border text-xs font-bold uppercase transition-all flex items-center space-x-1.5 cursor-pointer ${
              showTails
                ? 'bg-[#21262d] text-amber-300 border-amber-500/60'
                : 'bg-[#0e1117] text-gray-400 border-[#30363d]'
            }`}
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Tails: {showTails ? 'ON' : 'OFF'}</span>
          </button>

          {/* Animation Play/Pause Button */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`px-3.5 py-1.5 border text-xs font-bold uppercase transition-all flex items-center space-x-1.5 cursor-pointer ${
              isPlaying
                ? 'bg-amber-500 text-black border-amber-400 font-black'
                : 'bg-[#0e1117] text-white border-[#30363d] hover:border-amber-500'
            }`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? 'Pause Step' : 'Animate Rotation'}</span>
          </button>
        </div>
      </div>

      {/* 4 Quadrants Quick Stats Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
        {/* Leading Quadrant */}
        <button
          onClick={() => {
            const next = selectedQuadrant === 'LEADING' ? 'ALL' : 'LEADING';
            setSelectedQuadrant(next);
            if (audioEnabled && next !== 'ALL') playRrgQuadrantSound('LEADING');
          }}
          className={`p-3 border transition-all text-left cursor-pointer ${
            selectedQuadrant === 'LEADING'
              ? 'bg-emerald-950/90 border-emerald-400 text-white shadow-lg'
              : 'bg-emerald-950/40 border-emerald-800/60 hover:bg-emerald-900/40 text-emerald-200'
          }`}
        >
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
              Top-Right Quadrant
            </span>
            <span className="text-xs bg-emerald-900 text-emerald-200 font-bold px-1.5 py-0.5 border border-emerald-600">
              {quadrantCounts.LEADING} Sectors
            </span>
          </div>
          <div className="text-base font-serif font-black text-emerald-300 mt-1">
            LEADING
          </div>
          <div className="text-[10px] text-emerald-400/80 font-sans mt-0.5">
            RS-Ratio &gt; 100 | RS-Momentum &gt; 100
          </div>
        </button>

        {/* Weakening Quadrant */}
        <button
          onClick={() => {
            const next = selectedQuadrant === 'WEAKENING' ? 'ALL' : 'WEAKENING';
            setSelectedQuadrant(next);
            if (audioEnabled && next !== 'ALL') playRrgQuadrantSound('WEAKENING');
          }}
          className={`p-3 border transition-all text-left cursor-pointer ${
            selectedQuadrant === 'WEAKENING'
              ? 'bg-amber-950/90 border-amber-400 text-white shadow-lg'
              : 'bg-amber-950/40 border-amber-800/60 hover:bg-amber-900/40 text-amber-200'
          }`}
        >
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
              Bottom-Right Quadrant
            </span>
            <span className="text-xs bg-amber-900 text-amber-200 font-bold px-1.5 py-0.5 border border-amber-600">
              {quadrantCounts.WEAKENING} Sectors
            </span>
          </div>
          <div className="text-base font-serif font-black text-amber-300 mt-1">
            WEAKENING
          </div>
          <div className="text-[10px] text-amber-400/80 font-sans mt-0.5">
            RS-Ratio &gt; 100 | RS-Momentum &lt; 100
          </div>
        </button>

        {/* Lagging Quadrant */}
        <button
          onClick={() => {
            const next = selectedQuadrant === 'LAGGING' ? 'ALL' : 'LAGGING';
            setSelectedQuadrant(next);
            if (audioEnabled && next !== 'ALL') playRrgQuadrantSound('LAGGING');
          }}
          className={`p-3 border transition-all text-left cursor-pointer ${
            selectedQuadrant === 'LAGGING'
              ? 'bg-rose-950/90 border-rose-400 text-white shadow-lg'
              : 'bg-rose-950/40 border-rose-800/60 hover:bg-rose-900/40 text-rose-200'
          }`}
        >
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">
              Bottom-Left Quadrant
            </span>
            <span className="text-xs bg-rose-900 text-rose-200 font-bold px-1.5 py-0.5 border border-rose-600">
              {quadrantCounts.LAGGING} Sectors
            </span>
          </div>
          <div className="text-base font-serif font-black text-rose-300 mt-1">
            LAGGING
          </div>
          <div className="text-[10px] text-rose-400/80 font-sans mt-0.5">
            RS-Ratio &lt; 100 | RS-Momentum &lt; 100
          </div>
        </button>

        {/* Improving Quadrant */}
        <button
          onClick={() => {
            const next = selectedQuadrant === 'IMPROVING' ? 'ALL' : 'IMPROVING';
            setSelectedQuadrant(next);
            if (audioEnabled && next !== 'ALL') playRrgQuadrantSound('IMPROVING');
          }}
          className={`p-3 border transition-all text-left cursor-pointer ${
            selectedQuadrant === 'IMPROVING'
              ? 'bg-sky-950/90 border-sky-400 text-white shadow-lg'
              : 'bg-sky-950/40 border-sky-800/60 hover:bg-sky-900/40 text-sky-200'
          }`}
        >
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
              Top-Left Quadrant
            </span>
            <span className="text-xs bg-sky-900 text-sky-200 font-bold px-1.5 py-0.5 border border-sky-600">
              {quadrantCounts.IMPROVING} Sectors
            </span>
          </div>
          <div className="text-base font-serif font-black text-sky-300 mt-1">
            IMPROVING
          </div>
          <div className="text-[10px] text-sky-400/80 font-sans mt-0.5">
            RS-Ratio &lt; 100 | RS-Momentum &gt; 100
          </div>
        </button>
      </div>

      {/* Main RRG Interactive Canvas & Detail Panel Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Interactive RRG SVG Scatter Graph (8 cols) */}
        <div className="lg:col-span-8 bg-[#0d1117] border border-[#30363d] p-4 relative overflow-hidden shadow-inner rounded-none">
          {/* Timeline Animation Step Overlay Indicator */}
          {isPlaying && (
            <div className="absolute top-6 right-6 bg-amber-500 text-black px-3 py-1 font-mono text-xs font-black uppercase tracking-wider z-10 shadow-lg flex items-center space-x-1.5 animate-pulse">
              <RotateCw className="w-3.5 h-3.5 animate-spin" />
              <span>Step: T-{4 - animStep} ({animStep === 4 ? 'Current' : `History -${4 - animStep}`})</span>
            </div>
          )}

          <div className="w-full h-auto overflow-x-auto">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-auto min-w-[500px] select-none"
            >
              <defs>
                {/* Background Quadrant Gradients */}
                <linearGradient id="gradLeading" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#064e3b" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#065f46" stopOpacity="0.4" />
                </linearGradient>

                <linearGradient id="gradWeakening" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#78350f" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#92400e" stopOpacity="0.35" />
                </linearGradient>

                <linearGradient id="gradLagging" x1="100%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#881337" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#9f1239" stopOpacity="0.35" />
                </linearGradient>

                <linearGradient id="gradImproving" x1="100%" y1="100%" x2="0%" y2="0%">
                  <stop offset="0%" stopColor="#0c4a6e" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#075985" stopOpacity="0.35" />
                </linearGradient>

                {/* Arrow Head Marker */}
                <marker
                  id="arrowHead"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" />
                </marker>
              </defs>

              {/* 4 Quadrant Background Rectangles */}
              {/* Top-Right: LEADING */}
              <rect
                x={originX}
                y={padding}
                width={svgWidth - padding - originX}
                height={originY - padding}
                fill="url(#gradLeading)"
                stroke="#10b981"
                strokeWidth="0.5"
                strokeDasharray="2 2"
              />
              {/* Bottom-Right: WEAKENING */}
              <rect
                x={originX}
                y={originY}
                width={svgWidth - padding - originX}
                height={svgHeight - padding - originY}
                fill="url(#gradWeakening)"
                stroke="#f59e0b"
                strokeWidth="0.5"
                strokeDasharray="2 2"
              />
              {/* Bottom-Left: LAGGING */}
              <rect
                x={padding}
                y={originY}
                width={originX - padding}
                height={svgHeight - padding - originY}
                fill="url(#gradLagging)"
                stroke="#f43f5e"
                strokeWidth="0.5"
                strokeDasharray="2 2"
              />
              {/* Top-Left: IMPROVING */}
              <rect
                x={padding}
                y={padding}
                width={originX - padding}
                height={originY - padding}
                fill="url(#gradImproving)"
                stroke="#0284c7"
                strokeWidth="0.5"
                strokeDasharray="2 2"
              />

              {/* Concentric Benchmark Distance Rings */}
              <circle
                cx={originX}
                cy={originY}
                r={60}
                fill="none"
                stroke="#30363d"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <circle
                cx={originX}
                cy={originY}
                r={120}
                fill="none"
                stroke="#30363d"
                strokeWidth="1"
                strokeDasharray="3 3"
              />

              {/* Axes Lines (Crosshair centered at 100, 100) */}
              <line
                x1={padding}
                y1={originY}
                x2={svgWidth - padding}
                y2={originY}
                stroke="#d1d5db"
                strokeWidth="1.5"
              />
              <line
                x1={originX}
                y1={padding}
                x2={originX}
                y2={svgHeight - padding}
                stroke="#d1d5db"
                strokeWidth="1.5"
              />

              {/* Quadrant Big Watermark Labels */}
              <text
                x={originX + 15}
                y={padding + 25}
                fill="#10b981"
                opacity="0.6"
                fontSize="12"
                fontWeight="900"
                fontFamily="JetBrains Mono"
              >
                LEADING (+/+)
              </text>
              <text
                x={originX + 15}
                y={svgHeight - padding - 15}
                fill="#f59e0b"
                opacity="0.6"
                fontSize="12"
                fontWeight="900"
                fontFamily="JetBrains Mono"
              >
                WEAKENING (+/-)
              </text>
              <text
                x={padding + 15}
                y={svgHeight - padding - 15}
                fill="#f43f5e"
                opacity="0.6"
                fontSize="12"
                fontWeight="900"
                fontFamily="JetBrains Mono"
              >
                LAGGING (-/-)
              </text>
              <text
                x={padding + 15}
                y={padding + 25}
                fill="#0284c7"
                opacity="0.6"
                fontSize="12"
                fontWeight="900"
                fontFamily="JetBrains Mono"
              >
                IMPROVING (-/+)
              </text>

              {/* Benchmark Center Node (SPY / Nifty Benchmark = 100, 100) */}
              <circle
                cx={originX}
                cy={originY}
                r={7}
                fill="#1a1a1a"
                stroke="#f59e0b"
                strokeWidth="2"
              />
              <text
                x={originX}
                y={originY + 18}
                textAnchor="middle"
                fill="#ffffff"
                fontSize="10"
                fontWeight="800"
                fontFamily="JetBrains Mono"
              >
                BENCHMARK (100)
              </text>

              {/* Clockwise Rotation Arrow Hint in Center */}
              <path
                d={`M ${originX + 35} ${originY - 35} A 50 50 0 0 1 ${originX + 45} ${originY + 15}`}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                markerEnd="url(#arrowHead)"
              />

              {/* Render Sector Nodes and Tail Trails */}
              {filteredRrgList.map((secData) => {
                const isSelected =
                  selectedSectorName?.toLowerCase() === secData.sector.toLowerCase();
                const isHovered = hoveredSector?.toLowerCase() === secData.sector.toLowerCase();
                const isHighlighted = isSelected || isHovered;

                // Color based on quadrant
                let nodeColor = '#10b981'; // LEADING
                if (secData.quadrant === 'WEAKENING') nodeColor = '#f59e0b';
                if (secData.quadrant === 'LAGGING') nodeColor = '#f43f5e';
                if (secData.quadrant === 'IMPROVING') nodeColor = '#0284c7';

                // Handle Step index for animation
                const currentStepObj = secData.tailPoints[animStep];
                const activeX = mapX(currentStepObj.rsRatio);
                const activeY = mapY(currentStepObj.rsMomentum);

                // Render Tail Trail Path if enabled
                const tailPathPoints = secData.tailPoints.slice(0, animStep + 1).map((tp) => ({
                  x: mapX(tp.rsRatio),
                  y: mapY(tp.rsMomentum)
                }));

                let pathD = '';
                if (tailPathPoints.length > 1) {
                  pathD = `M ${tailPathPoints[0].x} ${tailPathPoints[0].y} ` +
                    tailPathPoints.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ');
                }

                return (
                  <g
                    key={secData.sector}
                    className="cursor-pointer transition-all duration-300"
                    onMouseEnter={() => setHoveredSector(secData.sector)}
                    onMouseLeave={() => setHoveredSector(null)}
                    onClick={() => onSelectSector && onSelectSector(isSelected ? null : secData.sector)}
                  >
                    {/* Tail Trail Lines */}
                    {showTails && pathD && (
                      <path
                        d={pathD}
                        fill="none"
                        stroke={nodeColor}
                        strokeWidth={isHighlighted ? '2.5' : '1.5'}
                        strokeOpacity={isHighlighted ? 0.9 : 0.5}
                        strokeDasharray={isHighlighted ? 'none' : '3 3'}
                      />
                    )}

                    {/* Tail Trail Dots */}
                    {showTails &&
                      tailPathPoints.slice(0, -1).map((pt, idx) => (
                        <circle
                          key={idx}
                          cx={pt.x}
                          cy={pt.y}
                          r={isHighlighted ? 3 : 2}
                          fill={nodeColor}
                          opacity={0.3 + (idx / 5) * 0.5}
                        />
                      ))}

                    {/* Main Prominent Sector Node Bubble */}
                    <circle
                      cx={activeX}
                      cy={activeY}
                      r={isHighlighted ? 12 : 8}
                      fill={nodeColor}
                      stroke="#ffffff"
                      strokeWidth={isHighlighted ? 3 : 1.5}
                      className="transition-all duration-200"
                    />

                    {/* Sector Name Text Tag */}
                    <text
                      x={activeX + 12}
                      y={activeY + 4}
                      fill={isHighlighted ? '#ffffff' : '#d1d5db'}
                      fontSize={isHighlighted ? '11' : '9.5'}
                      fontWeight={isHighlighted ? '900' : '700'}
                      fontFamily="JetBrains Mono"
                      className="drop-shadow-md"
                    >
                      {secData.sector}
                    </text>

                    {/* Relative Velocity Vector Indicator */}
                    {isHighlighted && (
                      <line
                        x1={activeX}
                        y1={activeY}
                        x2={activeX + Math.cos((secData.headingAngle * Math.PI) / 180) * 20}
                        y2={activeY - Math.sin((secData.headingAngle * Math.PI) / 180) * 20}
                        stroke="#f59e0b"
                        strokeWidth="2"
                        markerEnd="url(#arrowHead)"
                      />
                    )}
                  </g>
                );
              })}

              {/* Axis Labels */}
              <text
                x={svgWidth / 2}
                y={svgHeight - 10}
                textAnchor="middle"
                fill="#9ca3af"
                fontSize="11"
                fontWeight="800"
                fontFamily="JetBrains Mono"
              >
                ← UNDERPERFORMING | JdK RS-RATIO™ (RELATIVE STRENGTH) | OUTPERFORMING →
              </text>
              <text
                x={15}
                y={svgHeight / 2}
                textAnchor="middle"
                fill="#9ca3af"
                fontSize="11"
                fontWeight="800"
                fontFamily="JetBrains Mono"
                transform={`rotate(-90 15 ${svgHeight / 2})`}
              >
                ← WEAKENING MOMENTUM | JdK RS-MOMENTUM™ | ACCELERATING MOMENTUM →
              </text>
            </svg>
          </div>
        </div>

        {/* Right Column: Active Sector Detail Card & Rotational Vector Analysis (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {activeSectorData ? (
            <div className={`p-5 border space-y-4 shadow-xl ${activeSectorData.quadrantBg}`}>
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center space-x-2">
                  <span className={`text-xs font-mono font-bold px-2 py-0.5 uppercase border ${activeSectorData.quadrantBorder}`}>
                    #{activeSectorData.aggregate.rank} Sector
                  </span>
                  <span className="text-xs font-mono text-gray-300 uppercase">
                    {activeSectorData.quadrantLabel}
                  </span>
                </div>
                {onSelectSector && (
                  <button
                    onClick={() => onSelectSector(null)}
                    className="text-gray-400 hover:text-white text-xs font-bold"
                  >
                    ✕ Clear
                  </button>
                )}
              </div>

              <div>
                <h4 className="text-2xl font-serif font-black text-white">
                  {activeSectorData.sector}
                </h4>
                <p className="text-xs font-sans text-gray-300 mt-1">
                  {activeSectorData.aggregate.flowLabel} with {activeSectorData.aggregate.stockCount} constituent stocks.
                </p>
              </div>

              {/* Metric Metrics Grid */}
              <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                <div className="bg-[#0e1117]/80 p-2.5 border border-white/10">
                  <span className="text-gray-400 text-[10px] uppercase block">JdK RS-Ratio™:</span>
                  <strong className="text-amber-400 text-base font-bold">
                    {activeSectorData.currentRsRatio}
                  </strong>
                  <span className="text-[9px] text-gray-400 block">
                    {activeSectorData.currentRsRatio >= 100 ? 'Outperforming SPY' : 'Underperforming SPY'}
                  </span>
                </div>

                <div className="bg-[#0e1117]/80 p-2.5 border border-white/10">
                  <span className="text-gray-400 text-[10px] uppercase block">JdK RS-Momentum™:</span>
                  <strong className="text-amber-400 text-base font-bold">
                    {activeSectorData.currentRsMomentum}
                  </strong>
                  <span className="text-[9px] text-gray-400 block">
                    {activeSectorData.currentRsMomentum >= 100 ? 'Accelerating' : 'Decelerating'}
                  </span>
                </div>

                <div className="bg-[#0e1117]/80 p-2.5 border border-white/10">
                  <span className="text-gray-400 text-[10px] uppercase block">Rotation Velocity:</span>
                  <strong className="text-emerald-400 text-sm font-bold">
                    {activeSectorData.velocity} pts/step
                  </strong>
                </div>

                <div className="bg-[#0e1117]/80 p-2.5 border border-white/10">
                  <span className="text-gray-400 text-[10px] uppercase block">Heading Angle:</span>
                  <strong className="text-sky-300 text-sm font-bold">
                    {activeSectorData.headingAngle}° Vector
                  </strong>
                </div>
              </div>

              {/* Top Constituent Leader */}
              {activeSectorData.topStock && (
                <div className="bg-[#0e1117]/90 p-3 border border-amber-500/40 space-y-2 font-mono text-xs">
                  <div className="flex justify-between items-center text-[10px] text-amber-400 font-bold uppercase">
                    <span>Sector Top SEPA Setup:</span>
                    <span>{activeSectorData.topStock.rsRating} RS</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <strong className="text-white text-base block font-bold">
                        {activeSectorData.topStock.ticker}
                      </strong>
                      <span className="text-gray-400 text-[10px] font-sans truncate max-w-[140px] block">
                        {activeSectorData.topStock.name}
                      </span>
                    </div>
                    <button
                      onClick={() => onSelectStock && onSelectStock(activeSectorData.topStock!)}
                      className="bg-amber-500 hover:bg-amber-400 text-black px-2.5 py-1 text-[10px] font-black uppercase tracking-wider flex items-center space-x-1 transition-all cursor-pointer"
                    >
                      <span>Analyze</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}

              <div className="text-[10px] font-sans text-gray-300 leading-relaxed border-t border-white/10 pt-2">
                💡 <strong className="text-white">Minervini Rotation Rule</strong>: Sectors moving clockwise into the <strong className="text-sky-300">Improving</strong> and <strong className="text-emerald-300">Leading</strong> quadrants signal institutional capital accumulation before breakout pivots occur.
              </div>
            </div>
          ) : (
            <div className="bg-[#0d1117] border border-[#30363d] p-6 text-center space-y-3 font-mono">
              <Compass className="w-10 h-10 text-amber-400 mx-auto animate-pulse" />
              <h4 className="text-base font-serif font-bold text-white">
                Select a Sector Node to Inspect
              </h4>
              <p className="text-xs text-gray-400 font-sans leading-relaxed">
                Hover or click any sector node in the RRG scatter plot to inspect its JdK RS-Ratio, JdK RS-Momentum vector, rotation velocity, and top constituent stock setup.
              </p>
            </div>
          )}

          {/* Clockwise Sector Rotation Guide Box */}
          <div className="bg-[#0e1117] border border-[#30363d] p-4 font-mono text-xs space-y-2.5">
            <div className="flex items-center space-x-2 text-amber-400 font-bold uppercase tracking-wider border-b border-[#30363d] pb-2 text-[11px]">
              <RotateCw className="w-4 h-4 text-amber-400" />
              <span>Rotational Quadrant Cycle</span>
            </div>

            <div className="space-y-1.5 text-[11px] font-sans">
              <div className="flex items-center justify-between text-sky-300">
                <span className="font-bold">1. Improving (-/+)</span>
                <span className="text-[10px] font-mono">Turnaround Stage</span>
              </div>
              <p className="text-gray-400 text-[10px]">
                Momentum turns positive while relative strength is building. Early stage accumulation.
              </p>

              <div className="flex items-center justify-between text-emerald-300 pt-1 border-t border-[#21262d]">
                <span className="font-bold">2. Leading (+/+)</span>
                <span className="text-[10px] font-mono">Stage 2 Uptrend</span>
              </div>
              <p className="text-gray-400 text-[10px]">
                Outperforming benchmark with strong accelerating momentum. Core market leaders.
              </p>

              <div className="flex items-center justify-between text-amber-300 pt-1 border-t border-[#21262d]">
                <span className="font-bold">3. Weakening (+/-)</span>
                <span className="text-[10px] font-mono">Profit Taking</span>
              </div>
              <p className="text-gray-400 text-[10px]">
                Still outperforming, but relative momentum is slowing down. Tighten stop losses.
              </p>

              <div className="flex items-center justify-between text-rose-300 pt-1 border-t border-[#21262d]">
                <span className="font-bold">4. Lagging (-/-)</span>
                <span className="text-[10px] font-mono">Distribution</span>
              </div>
              <p className="text-gray-400 text-[10px]">
                Underperforming benchmark with negative momentum. Avoid long setups.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* RRG Sector Rotation Leaderboard Table */}
      <div className="bg-[#0d1117] border border-[#30363d] p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-[#30363d] pb-2">
          <div className="flex items-center space-x-2 font-mono">
            <Layers className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Complete Sector RRG Rotational Matrix & Vector Metrics
            </h4>
          </div>
          <span className="text-[10px] text-gray-400 font-mono">
            Sorted by JdK RS-Ratio™ & RS-Momentum™
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b border-[#30363d] text-[10px] uppercase text-gray-400 font-bold bg-[#161b22]">
                <th className="py-2.5 px-3">Industry Group</th>
                <th className="py-2.5 px-3 text-center">Quadrant</th>
                <th className="py-2.5 px-3 text-center">RS-Ratio™</th>
                <th className="py-2.5 px-3 text-center">RS-Momentum™</th>
                <th className="py-2.5 px-3 text-center">Rotational Vector</th>
                <th className="py-2.5 px-3 text-right">Avg Change %</th>
                <th className="py-2.5 px-3">Top Constituent Setup</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#21262d]">
              {rrgSectorList.map((item) => {
                const isSelected =
                  selectedSectorName?.toLowerCase() === item.sector.toLowerCase();

                return (
                  <tr
                    key={item.sector}
                    onClick={() => onSelectSector && onSelectSector(isSelected ? null : item.sector)}
                    className={`hover:bg-[#1f242d] transition-colors cursor-pointer ${
                      isSelected ? 'bg-amber-950/40 border-l-4 border-l-amber-500' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3 font-serif font-bold text-white">
                      {item.sector}
                    </td>

                    <td className="py-2.5 px-3 text-center">
                      <span className={`px-2 py-0.5 text-[10px] font-bold border ${item.quadrantBg}`}>
                        {item.quadrant}
                      </span>
                    </td>

                    <td className="py-2.5 px-3 text-center font-bold text-amber-300">
                      {item.currentRsRatio}
                    </td>

                    <td className="py-2.5 px-3 text-center font-bold text-sky-300">
                      {item.currentRsMomentum}
                    </td>

                    <td className="py-2.5 px-3 text-center text-gray-300">
                      <div className="flex items-center justify-center space-x-1">
                        <span className="font-bold">{item.velocity} pts</span>
                        <span className="text-gray-500 text-[10px]">({item.headingAngle}°)</span>
                      </div>
                    </td>

                    <td
                      className={`py-2.5 px-3 text-right font-bold ${
                        item.aggregate.avgChange >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {item.aggregate.avgChange >= 0 ? '+' : ''}
                      {item.aggregate.avgChange}%
                    </td>

                    <td className="py-2.5 px-3">
                      {item.topStock ? (
                        <div className="flex items-center space-x-2">
                          <strong className="text-amber-300">{item.topStock.ticker}</strong>
                          <span className="text-gray-400 text-[10px] font-sans truncate max-w-[120px]">
                            {item.topStock.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
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
