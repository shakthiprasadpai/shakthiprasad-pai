import React, { useState } from 'react';
import { MinerviniTradeSetup } from '../types';
import {
  CombinedSmartJournalPayload,
  analyzeStockSmartSetup,
} from '../utils/smartJournalEngine';
import { formatCurrency, getCurrencySymbol } from '../utils/sepaCalculator';
import {
  Sparkles,
  Layers,
  TrendingUp,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Award,
  Zap,
  Building2,
  Activity,
  SlidersHorizontal,
} from 'lucide-react';

interface SmartPatternSectorAssistantProps {
  currentStock: MinerviniTradeSetup | undefined;
  allStocks: MinerviniTradeSetup[];
  exchange: 'NASDAQ' | 'NYSE' | 'NSE' | 'BSE';
  onApplySmartData: (data: {
    setupType: string;
    entryPrice?: number;
    stopLossPrice?: number;
    targetPrice?: number;
    riskRewardRatio?: number;
    notes: string;
    keyLesson: string;
    sector: string;
    industry: string;
    sectorRank: number;
    sectorRsScore: number;
    sectorTrend: 'LEADING' | 'IMPROVING' | 'ROTATIONAL' | 'LAGGING';
    sectorTailwindNotes: string;
    patternQualityScore: number;
    patternTightnessRatio: number;
    volumeDryUpRatio: number;
    contractionsSummary: string;
    patternChecklistPassed: string[];
  }) => void;
}

export const SmartPatternSectorAssistant: React.FC<SmartPatternSectorAssistantProps> = ({
  currentStock,
  allStocks,
  exchange,
  onApplySmartData,
}) => {
  const [showChecklist, setShowChecklist] = useState(false);
  const [appliedNotice, setAppliedNotice] = useState(false);

  if (!currentStock) {
    return (
      <div className="bg-amber-50 border border-amber-200 p-3 rounded-none font-mono text-xs text-amber-900 flex items-center space-x-2">
        <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
        <span>Custom ticker entered. Select a tracked stock to activate Smart Pattern & Sectoral Intelligence.</span>
      </div>
    );
  }

  const smartAnalysis: CombinedSmartJournalPayload = analyzeStockSmartSetup(currentStock, allStocks);
  const { pattern, sectoral, suggestedRationale, suggestedKeyLesson } = smartAnalysis;

  const handleApply = () => {
    onApplySmartData({
      setupType: pattern.detectedPattern,
      entryPrice: pattern.pivotPrice,
      stopLossPrice: pattern.recommendedStopPrice,
      targetPrice: pattern.recommendedTargetPrice,
      riskRewardRatio: pattern.riskRewardRatio,
      notes: suggestedRationale,
      keyLesson: suggestedKeyLesson,
      sector: sectoral.sector,
      industry: sectoral.industry,
      sectorRank: sectoral.sectorRank,
      sectorRsScore: sectoral.sectorRsScore,
      sectorTrend: sectoral.sectorTrend,
      sectorTailwindNotes: sectoral.sectorNotes,
      patternQualityScore: pattern.patternQualityScore,
      patternTightnessRatio: pattern.tightnessRatioPct,
      volumeDryUpRatio: pattern.volumeDryUpPct,
      contractionsSummary: pattern.contractionsSummary,
      patternChecklistPassed: pattern.checklist.filter((c) => c.passed).map((c) => c.label),
    });

    setAppliedNotice(true);
    setTimeout(() => setAppliedNotice(false), 3500);
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'A+':
        return 'bg-emerald-800 text-emerald-100 border-emerald-900';
      case 'A':
        return 'bg-emerald-700 text-emerald-100 border-emerald-800';
      case 'B+':
        return 'bg-blue-800 text-blue-100 border-blue-900';
      default:
        return 'bg-amber-800 text-amber-100 border-amber-900';
    }
  };

  const getFlowBadge = (trend: string) => {
    switch (trend) {
      case 'LEADING':
        return 'bg-purple-100 text-purple-900 border-purple-300';
      case 'IMPROVING':
        return 'bg-blue-100 text-blue-900 border-blue-300';
      case 'ROTATIONAL':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      default:
        return 'bg-red-100 text-red-900 border-red-300';
    }
  };

  return (
    <div className="bg-[#111827] text-white border-2 border-amber-500/60 p-4 font-mono text-xs space-y-3.5 shadow-md">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-700 pb-2.5">
        <div className="flex items-center space-x-2">
          <span className="p-1.5 bg-amber-500/20 text-amber-400 border border-amber-500/40">
            <Sparkles className="w-4 h-4" />
          </span>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold uppercase tracking-wider text-amber-400 text-xs">
                Smart Pattern & Sectoral Intelligence
              </span>
              <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 border border-slate-700">
                Minervini SEPA Engine
              </span>
            </div>
            <p className="text-[11px] text-gray-400 font-sans mt-0.5">
              Live algorithmic scan of {currentStock.ticker} pattern geometry and industry leadership
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleApply}
          className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-3.5 py-1.5 uppercase text-[11px] tracking-wider transition-all flex items-center space-x-1.5 shadow-sm active:scale-95 cursor-pointer"
          title="Auto-fill setup pattern, pivot entry, stop-loss, sectoral ranking, and structured SEPA trade notes"
        >
          <Zap className="w-3.5 h-3.5 fill-current" />
          <span>Auto-Fill Pattern & Sector</span>
        </button>
      </div>

      {appliedNotice && (
        <div className="bg-emerald-900/90 text-emerald-200 border border-emerald-500 p-2 text-[11px] font-sans flex items-center space-x-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            Successfully populated Smart Pattern metrics, Sectoral context, entry/stop levels, and SEPA trade rationale!
          </span>
        </div>
      )}

      {/* Grid of Pattern & Sectoral Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Card 1: Pattern Intelligence */}
        <div className="bg-gray-900/80 p-3 border border-gray-700 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5 text-gray-400 uppercase text-[10px] font-bold">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>Pattern Blueprint</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className={`text-[10px] font-bold px-2 py-0.5 border uppercase ${getTierColor(pattern.qualityTier)}`}>
                {pattern.qualityTier} Quality
              </span>
              <span className="text-[11px] font-bold text-amber-400 bg-amber-950/80 px-2 py-0.5 border border-amber-800">
                {pattern.patternQualityScore}/100
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-sm font-bold text-white flex items-center space-x-2">
              <span>{pattern.detectedPattern}</span>
              {pattern.isTightVolume && (
                <span className="text-[9px] font-normal bg-emerald-950 text-emerald-300 px-1.5 py-0.2 border border-emerald-700">
                  Tight Volume
                </span>
              )}
            </div>
            <div className="text-[11px] text-gray-300 font-sans">
              Contractions: <strong className="text-emerald-300 font-mono">{pattern.contractionsSummary}</strong>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5 pt-1 text-[10px] border-t border-gray-800">
            <div>
              <span className="text-gray-400 block text-[9px]">Squeeze Ratio</span>
              <span className="font-bold text-white">+{pattern.tightnessRatioPct}%</span>
            </div>
            <div>
              <span className="text-gray-400 block text-[9px]">Volume Dry-Up</span>
              <span className="font-bold text-emerald-400">{pattern.volumeDryUpPct.toFixed(1)}%</span>
            </div>
            <div>
              <span className="text-gray-400 block text-[9px]">Stage 2 Trend</span>
              <span className="font-bold text-white">{pattern.stage2TrendScore}/8 Rules</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] bg-black/40 px-2.5 py-1.5 border border-gray-800 mt-1">
            <span>Pivot: <strong className="text-amber-400">{formatCurrency(pattern.pivotPrice, exchange)}</strong></span>
            <span>Stop: <strong className="text-red-400">{formatCurrency(pattern.recommendedStopPrice, exchange)} (-{pattern.recommendedStopPct}%)</strong></span>
            <span>Target: <strong className="text-emerald-400">{formatCurrency(pattern.recommendedTargetPrice, exchange)}</strong></span>
          </div>
        </div>

        {/* Card 2: Sectoral Intelligence */}
        <div className="bg-gray-900/80 p-3 border border-gray-700 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5 text-gray-400 uppercase text-[10px] font-bold">
              <Building2 className="w-3.5 h-3.5 text-purple-400" />
              <span>Sectoral & Industry Group</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className={`text-[10px] font-bold px-2 py-0.5 border uppercase ${getFlowBadge(sectoral.sectorTrend)}`}>
                {sectoral.sectorTrend}
              </span>
              <span className="text-[11px] font-bold text-purple-300 bg-purple-950/80 px-2 py-0.5 border border-purple-800">
                Rank #{sectoral.sectorRank} of {sectoral.totalSectors}
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-sm font-bold text-white flex items-center space-x-2">
              <span>{sectoral.sector}</span>
              <span className="text-xs text-gray-400 font-normal">• {sectoral.industry}</span>
            </div>
            <div className="text-[11px] text-gray-300 font-sans">
              Flow State: <strong className="text-purple-300 font-mono">{sectoral.flowLabel}</strong> (RS {sectoral.sectorRsScore}/100)
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 text-[10px] border-t border-gray-800">
            <div>
              <span className="text-gray-400 block text-[9px]">Tailwind Assessment</span>
              <span className="font-bold text-emerald-400">{sectoral.sectorTailwindRating} Tailwind</span>
            </div>
            <div>
              <span className="text-gray-400 block text-[9px]">Group Peers</span>
              <span className="font-bold text-gray-200">
                {sectoral.sectorPeers.length > 0 ? sectoral.sectorPeers.slice(0, 3).join(', ') : 'Theme Pioneer'}
              </span>
            </div>
          </div>

          <div className="text-[10px] bg-black/40 px-2.5 py-1.5 border border-gray-800 text-gray-300 font-sans leading-relaxed">
            {sectoral.sectorNotes}
          </div>
        </div>
      </div>

      {/* Minervini Checklist Accordion Toggle */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setShowChecklist(!showChecklist)}
          className="text-[11px] text-gray-400 hover:text-white flex items-center space-x-1.5 transition-colors cursor-pointer"
        >
          <span>{showChecklist ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}</span>
          <span className="font-bold uppercase tracking-wider text-[10px]">
            {showChecklist ? 'Hide SEPA Validation Criteria' : 'Inspect SEPA 5-Point Setup Checklist'}
          </span>
        </button>

        {showChecklist && (
          <div className="mt-2.5 bg-black/50 p-3 border border-gray-800 space-y-2 animate-fadeIn">
            <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
              Mark Minervini SEPA Setup Quality Verification
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {pattern.checklist.map((c, idx) => (
                <div key={idx} className="flex items-start space-x-2 bg-gray-900/50 p-2 border border-gray-800">
                  {c.passed ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="text-[11px] font-bold text-white">{c.label}</div>
                    <div className="text-[10px] text-gray-400 font-sans">{c.details}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
