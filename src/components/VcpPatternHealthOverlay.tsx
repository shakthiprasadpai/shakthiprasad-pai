import React, { useState, useMemo } from 'react';
import { MinerviniTradeSetup } from '../types';
import {
  calculateVcpPatternHealth,
  VcpPatternHealthResult,
  VcpCriterionResult,
  ContractionAnalysisItem
} from '../utils/vcpPatternHealthCalculator';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  TrendingDown,
  Clock,
  Droplets,
  Zap,
  Target,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  Sliders,
  Info,
  Check,
  Flame,
  ArrowRight
} from 'lucide-react';

interface VcpPatternHealthOverlayProps {
  stock: MinerviniTradeSetup;
  isOpen: boolean;
  onToggle: () => void;
  isObsidian?: boolean;
}

export const VcpPatternHealthOverlay: React.FC<VcpPatternHealthOverlayProps> = ({
  stock,
  isOpen,
  onToggle,
  isObsidian = true
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [strictMode, setStrictMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'DEPTH' | 'TIMING' | 'VOLUME' | 'RULES'>('OVERVIEW');
  const [customMaxPivotDepth, setCustomMaxPivotDepth] = useState<number>(8);
  const [customVduThreshold, setCustomVduThreshold] = useState<number>(-35);

  // Compute pattern health in real-time
  const healthResult: VcpPatternHealthResult = useMemo(() => {
    return calculateVcpPatternHealth(stock, {
      strictMinerviniMode: strictMode,
      maxFinalContractionDepthPercent: customMaxPivotDepth,
      minFinalVduPercent: customVduThreshold,
    });
  }, [stock, strictMode, customMaxPivotDepth, customVduThreshold]);

  if (!isOpen) return null;

  return (
    <div
      className={`absolute top-3 right-3 z-30 transition-all duration-200 select-none shadow-xl border rounded-lg overflow-hidden font-mono ${
        isExpanded ? 'w-[420px] max-w-[95vw]' : 'w-72'
      } ${
        isObsidian
          ? 'bg-slate-950/95 border-slate-700/80 text-slate-100 backdrop-blur-md'
          : 'bg-white/95 border-gray-300 text-gray-900 backdrop-blur-md'
      }`}
      style={{
        boxShadow: healthResult.letterGrade === 'A+' || healthResult.letterGrade === 'A'
          ? '0 10px 25px -5px rgba(16, 185, 129, 0.25), 0 8px 10px -6px rgba(16, 185, 129, 0.2)'
          : '0 10px 25px -5px rgba(0, 0, 0, 0.4)'
      }}
    >
      {/* 1. COMPACT HUD BAR HEADER */}
      <div className={`p-2.5 flex items-center justify-between border-b ${
        isObsidian ? 'border-slate-800 bg-slate-900/90' : 'border-gray-200 bg-gray-50'
      }`}>
        <div className="flex items-center space-x-2">
          <div className="relative">
            <span
              className={`inline-flex items-center justify-center w-7 h-7 rounded font-black text-xs border ${
                healthResult.letterGrade === 'A+' || healthResult.letterGrade === 'A'
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                  : healthResult.letterGrade === 'B+' || healthResult.letterGrade === 'B'
                  ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                  : healthResult.letterGrade === 'C'
                  ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                  : 'bg-rose-500/20 border-rose-500 text-rose-400'
              }`}
            >
              {healthResult.letterGrade}
            </span>
            {(healthResult.letterGrade === 'A+' || healthResult.letterGrade === 'A') && (
              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            )}
          </div>

          <div>
            <div className="flex items-center space-x-1.5">
              <span className="text-[11px] font-black tracking-wider uppercase text-amber-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                VCP Pattern Health
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700 text-slate-300">
                {healthResult.overallScore}%
              </span>
            </div>
            <div className="text-[9px] text-slate-400 font-sans truncate max-w-[150px]">
              {healthResult.healthStatus === 'PRIME_SETUP'
                ? 'Prime Institutional VCP'
                : healthResult.healthStatus === 'CONSTRUCTIVE'
                ? 'Constructive Structure'
                : healthResult.healthStatus === 'DEVELOPING'
                ? 'Developing Contractions'
                : 'Defective Structure'}
            </div>
          </div>
        </div>

        {/* Controls: Expand/Collapse & Close */}
        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
            title={isExpanded ? 'Collapse Health Overlay' : 'Expand Detailed Diagnostics'}
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={onToggle}
            className="p-1 rounded hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 transition"
            title="Close Pattern Health Overlay"
          >
            <XCircle className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. COMPACT SUMMARY TRAFFIC LIGHTS (Always visible) */}
      <div className={`p-2.5 grid grid-cols-3 gap-1.5 text-center border-b ${
        isObsidian ? 'border-slate-850 bg-slate-950/70' : 'border-gray-100 bg-white'
      }`}>
        {/* Depth Pillar Badge */}
        <div
          onClick={() => { setIsExpanded(true); setActiveTab('DEPTH'); }}
          className={`p-1.5 rounded border cursor-pointer transition hover:scale-[1.02] ${
            healthResult.depthCriterion.status === 'PASS'
              ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
              : healthResult.depthCriterion.status === 'WARNING'
              ? 'bg-amber-950/30 border-amber-800/60 text-amber-300'
              : 'bg-rose-950/30 border-rose-800/60 text-rose-300'
          }`}
          title="Click to inspect Depth Contractions"
        >
          <div className="flex items-center justify-center space-x-1 text-[9px] font-bold uppercase tracking-wider">
            <TrendingDown className="w-3 h-3" />
            <span>Depth</span>
            {healthResult.depthCriterion.status === 'PASS' ? (
              <Check className="w-2.5 h-2.5 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
            )}
          </div>
          <div className="text-[11px] font-black mt-0.5">
            -{healthResult.finalContractionDepth}%
          </div>
          <div className="text-[8px] text-slate-400 truncate">
            {healthResult.hasTightTerminalPivot ? 'Tight Pivot' : 'Loose Pivot'}
          </div>
        </div>

        {/* Timing Pillar Badge */}
        <div
          onClick={() => { setIsExpanded(true); setActiveTab('TIMING'); }}
          className={`p-1.5 rounded border cursor-pointer transition hover:scale-[1.02] ${
            healthResult.timingCriterion.status === 'PASS'
              ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
              : healthResult.timingCriterion.status === 'WARNING'
              ? 'bg-amber-950/30 border-amber-800/60 text-amber-300'
              : 'bg-rose-950/30 border-rose-800/60 text-rose-300'
          }`}
          title="Click to inspect Timing & Base Symmetry"
        >
          <div className="flex items-center justify-center space-x-1 text-[9px] font-bold uppercase tracking-wider">
            <Clock className="w-3 h-3" />
            <span>Timing</span>
            {healthResult.timingCriterion.status === 'PASS' ? (
              <Check className="w-2.5 h-2.5 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
            )}
          </div>
          <div className="text-[11px] font-black mt-0.5">
            {healthResult.totalBaseWeeks}w
          </div>
          <div className="text-[8px] text-slate-400 truncate">
            {healthResult.contractions.length} Waves
          </div>
        </div>

        {/* Volume Dry-Up Pillar Badge */}
        <div
          onClick={() => { setIsExpanded(true); setActiveTab('VOLUME'); }}
          className={`p-1.5 rounded border cursor-pointer transition hover:scale-[1.02] ${
            healthResult.volumeDryUpCriterion.status === 'PASS'
              ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
              : healthResult.volumeDryUpCriterion.status === 'WARNING'
              ? 'bg-amber-950/30 border-amber-800/60 text-amber-300'
              : 'bg-rose-950/30 border-rose-800/60 text-rose-300'
          }`}
          title="Click to inspect Volume Dry-Up (VDU)"
        >
          <div className="flex items-center justify-center space-x-1 text-[9px] font-bold uppercase tracking-wider">
            <Droplets className="w-3 h-3" />
            <span>VDU</span>
            {healthResult.volumeDryUpCriterion.status === 'PASS' ? (
              <Check className="w-2.5 h-2.5 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
            )}
          </div>
          <div className="text-[11px] font-black mt-0.5">
            {healthResult.finalVduPercent > 0 ? '+' : ''}{healthResult.finalVduPercent}%
          </div>
          <div className="text-[8px] text-slate-400 truncate">
            {healthResult.hasTerminalDryUp ? 'Supply Dry' : 'Supply Heavy'}
          </div>
        </div>
      </div>

      {/* QUICK STATUS BAR (Compact View Bottom) */}
      {!isExpanded && (
        <div className="px-2.5 py-1.5 flex items-center justify-between text-[9px] bg-slate-900/80">
          <span className="text-slate-400">
            Pivot: <strong className="text-emerald-400">${stock.pivotPrice.toFixed(2)}</strong>
          </span>
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-0.5 cursor-pointer"
          >
            Full Audit <ArrowRight className="w-2.5 h-2.5" />
          </button>
        </div>
      )}

      {/* 3. EXPANDED DETAILED INSPECTION DRAWER */}
      {isExpanded && (
        <div className="p-3 space-y-3 max-h-[460px] overflow-y-auto text-xs">
          {/* Sub Navigation Tabs */}
          <div className="flex items-center space-x-1 border-b border-slate-800 pb-1.5 text-[10px]">
            <button
              type="button"
              onClick={() => setActiveTab('OVERVIEW')}
              className={`px-2 py-1 rounded font-bold uppercase ${
                activeTab === 'OVERVIEW'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('DEPTH')}
              className={`px-2 py-1 rounded font-bold uppercase flex items-center gap-1 ${
                activeTab === 'DEPTH'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              Depth ({healthResult.depthCriterion.score})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('TIMING')}
              className={`px-2 py-1 rounded font-bold uppercase flex items-center gap-1 ${
                activeTab === 'TIMING'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              Timing ({healthResult.timingCriterion.score})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('VOLUME')}
              className={`px-2 py-1 rounded font-bold uppercase flex items-center gap-1 ${
                activeTab === 'VOLUME'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              VDU ({healthResult.volumeDryUpCriterion.score})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('RULES')}
              className={`px-2 py-1 rounded font-bold uppercase ${
                activeTab === 'RULES'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              Tuner
            </button>
          </div>

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'OVERVIEW' && (
            <div className="space-y-3">
              {/* Headline Diagnostic */}
              <div className={`p-2.5 rounded border text-[11px] ${healthResult.statusBg}`}>
                <div className="font-bold flex items-center gap-1.5 mb-1">
                  {healthResult.meetsAllClassicCriteria ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  <span>{healthResult.headlineSummary}</span>
                </div>
                <p className="text-[10px] text-slate-300 font-sans leading-relaxed">
                  {healthResult.actionableRecommendation}
                </p>
              </div>

              {/* Contraction Progression Sequence Visualizer */}
              <div className="bg-slate-900/90 border border-slate-800 rounded p-2.5 space-y-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Contraction Volatility Compression Sequence</span>
                  <span className="text-amber-400">Total Base: -{healthResult.totalBaseDepthPercent}%</span>
                </div>

                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  {healthResult.contractions.map((c, idx) => (
                    <div
                      key={c.label}
                      className={`p-1.5 rounded border text-center ${
                        idx === healthResult.contractions.length - 1
                          ? 'border-amber-500/70 bg-amber-500/10'
                          : 'border-slate-800 bg-slate-950'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[9px] font-bold">
                        <span className="text-slate-400">{c.label}</span>
                        {c.isDepthProgressive ? (
                          <span className="text-emerald-400 text-[8px]">✓</span>
                        ) : (
                          <span className="text-rose-400 text-[8px]">✗</span>
                        )}
                      </div>
                      <div className="text-xs font-black mt-1 text-slate-200">
                        -{c.depthPercent}%
                      </div>
                      <div className="text-[9px] text-slate-400 mt-0.5">
                        {c.durationDays}d
                      </div>
                      <div className={`text-[8px] mt-0.5 font-bold ${
                        c.volumeDryUpPercent <= -35 ? 'text-cyan-400' : 'text-slate-400'
                      }`}>
                        VDU: {c.volumeDryUpPercent}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3 Pillars Score Bars */}
              <div className="bg-slate-900/90 border border-slate-800 rounded p-2.5 space-y-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Minervini Pillar Diagnostics
                </div>

                {/* Depth */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-300 flex items-center gap-1">
                      <TrendingDown className="w-3 h-3 text-emerald-400" />
                      1. Contraction Depth Compression
                    </span>
                    <span className="font-bold text-slate-200">{healthResult.depthCriterion.score}/100</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        healthResult.depthCriterion.score >= 80 ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${healthResult.depthCriterion.score}%` }}
                    />
                  </div>
                </div>

                {/* Timing */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-300 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-blue-400" />
                      2. Timing & Base Gestation
                    </span>
                    <span className="font-bold text-slate-200">{healthResult.timingCriterion.score}/100</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        healthResult.timingCriterion.score >= 80 ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${healthResult.timingCriterion.score}%` }}
                    />
                  </div>
                </div>

                {/* Volume Dry-Up */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-300 flex items-center gap-1">
                      <Droplets className="w-3 h-3 text-cyan-400" />
                      3. Terminal Volume Dry-Up (VDU)
                    </span>
                    <span className="font-bold text-slate-200">{healthResult.volumeDryUpCriterion.score}/100</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        healthResult.volumeDryUpCriterion.score >= 80 ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${healthResult.volumeDryUpCriterion.score}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DEPTH CRITERION */}
          {activeTab === 'DEPTH' && (
            <div className="space-y-2.5">
              <div className="p-2 rounded bg-slate-900 border border-slate-800 text-[11px]">
                <div className="font-bold text-amber-400 mb-1">
                  Minervini Depth Rule
                </div>
                <p className="text-[10px] text-slate-300 italic font-serif">
                  {healthResult.depthCriterion.minerviniRule}
                </p>
              </div>

              <div className="space-y-1.5">
                {healthResult.depthCriterion.metrics.map((m) => (
                  <div
                    key={m.label}
                    className="p-2 rounded bg-slate-900/80 border border-slate-800 flex flex-col gap-1 text-[10px]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-300">{m.label}</span>
                      <span className={`px-1.5 py-0.2 rounded font-bold text-[9px] ${
                        m.passed ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700' : 'bg-rose-900/60 text-rose-300 border border-rose-700'
                      }`}>
                        {m.passed ? 'PASSED' : 'CAUTION'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[9px] text-slate-400">
                      <span>Actual: <strong className="text-slate-200">{m.actual}</strong></span>
                      <span>Target: <strong className="text-slate-300">{m.ideal}</strong></span>
                    </div>
                    {m.note && <div className="text-[8px] text-slate-400 italic">{m.note}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: TIMING CRITERION */}
          {activeTab === 'TIMING' && (
            <div className="space-y-2.5">
              <div className="p-2 rounded bg-slate-900 border border-slate-800 text-[11px]">
                <div className="font-bold text-blue-400 mb-1">
                  Minervini Timing Rule
                </div>
                <p className="text-[10px] text-slate-300 italic font-serif">
                  {healthResult.timingCriterion.minerviniRule}
                </p>
              </div>

              <div className="space-y-1.5">
                {healthResult.timingCriterion.metrics.map((m) => (
                  <div
                    key={m.label}
                    className="p-2 rounded bg-slate-900/80 border border-slate-800 flex flex-col gap-1 text-[10px]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-300">{m.label}</span>
                      <span className={`px-1.5 py-0.2 rounded font-bold text-[9px] ${
                        m.passed ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700' : 'bg-rose-900/60 text-rose-300 border border-rose-700'
                      }`}>
                        {m.passed ? 'PASSED' : 'CAUTION'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[9px] text-slate-400">
                      <span>Actual: <strong className="text-slate-200">{m.actual}</strong></span>
                      <span>Target: <strong className="text-slate-300">{m.ideal}</strong></span>
                    </div>
                    {m.note && <div className="text-[8px] text-slate-400 italic">{m.note}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: VOLUME DRY-UP CRITERION */}
          {activeTab === 'VOLUME' && (
            <div className="space-y-2.5">
              <div className="p-2 rounded bg-slate-900 border border-slate-800 text-[11px]">
                <div className="font-bold text-cyan-400 mb-1">
                  Minervini Volume Dry-Up (VDU) Rule
                </div>
                <p className="text-[10px] text-slate-300 italic font-serif">
                  {healthResult.volumeDryUpCriterion.minerviniRule}
                </p>
              </div>

              <div className="space-y-1.5">
                {healthResult.volumeDryUpCriterion.metrics.map((m) => (
                  <div
                    key={m.label}
                    className="p-2 rounded bg-slate-900/80 border border-slate-800 flex flex-col gap-1 text-[10px]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-300">{m.label}</span>
                      <span className={`px-1.5 py-0.2 rounded font-bold text-[9px] ${
                        m.passed ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700' : 'bg-rose-900/60 text-rose-300 border border-rose-700'
                      }`}>
                        {m.passed ? 'PASSED' : 'CAUTION'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[9px] text-slate-400">
                      <span>Actual: <strong className="text-slate-200">{m.actual}</strong></span>
                      <span>Target: <strong className="text-slate-300">{m.ideal}</strong></span>
                    </div>
                    {m.note && <div className="text-[8px] text-slate-400 italic">{m.note}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: REAL-TIME TUNER & PARAMETERS */}
          {activeTab === 'RULES' && (
            <div className="space-y-3">
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800 space-y-2.5">
                <div className="text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-amber-400" />
                  Real-Time Threshold Tuner
                </div>

                {/* Strict Minervini Toggle */}
                <label className="flex items-center justify-between cursor-pointer p-1.5 rounded hover:bg-slate-800 text-[10px]">
                  <div>
                    <span className="font-bold text-slate-200">Strict Minervini Mode</span>
                    <p className="text-[8px] text-slate-400">Enforces &le;5% final pivot &amp; &le;-50% terminal VDU</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={strictMode}
                    onChange={(e) => setStrictMode(e.target.checked)}
                    className="w-4 h-4 accent-amber-500 rounded"
                  />
                </label>

                {/* Custom Max Pivot Depth Slider */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-300">Max Terminal Pivot Depth:</span>
                    <strong className="text-amber-400">-{customMaxPivotDepth}%</strong>
                  </div>
                  <input
                    type="range"
                    min="3"
                    max="15"
                    step="0.5"
                    value={customMaxPivotDepth}
                    onChange={(e) => setCustomMaxPivotDepth(parseFloat(e.target.value))}
                    className="w-full accent-amber-500 h-1 bg-slate-700 rounded cursor-pointer"
                  />
                  <div className="flex justify-between text-[8px] text-slate-500">
                    <span>3% (Super Tight)</span>
                    <span>8% (Classic)</span>
                    <span>15% (Loose)</span>
                  </div>
                </div>

                {/* Custom VDU Threshold Slider */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-300">Min Volume Dry-Up (VDU):</span>
                    <strong className="text-cyan-400">{customVduThreshold}% vs avg</strong>
                  </div>
                  <input
                    type="range"
                    min="-70"
                    max="-15"
                    step="5"
                    value={customVduThreshold}
                    onChange={(e) => setCustomVduThreshold(parseFloat(e.target.value))}
                    className="w-full accent-cyan-500 h-1 bg-slate-700 rounded cursor-pointer"
                  />
                  <div className="flex justify-between text-[8px] text-slate-500">
                    <span>-70% (Extreme)</span>
                    <span>-40% (Standard)</span>
                    <span>-15% (Light)</span>
                  </div>
                </div>
              </div>

              {/* Reset to defaults */}
              <button
                type="button"
                onClick={() => {
                  setStrictMode(false);
                  setCustomMaxPivotDepth(8);
                  setCustomVduThreshold(-35);
                }}
                className="w-full py-1 text-[9px] font-bold text-slate-400 hover:text-slate-200 border border-slate-800 rounded hover:bg-slate-800 uppercase"
              >
                Reset Classic Minervini Parameters
              </button>
            </div>
          )}

          {/* Quick Action Footer */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px]">
            <span className="text-slate-400">
              Pivot Buy: <strong className="text-emerald-400">${stock.pivotPrice.toFixed(2)}</strong>
            </span>
            <span className="text-slate-400">
              Stop Loss: <strong className="text-rose-400">${stock.stopLossPrice.toFixed(2)}</strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
