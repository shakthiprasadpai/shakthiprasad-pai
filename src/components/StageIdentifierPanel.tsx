import React, { useState } from 'react';
import { MinerviniTradeSetup } from '../types';
import { determineStageAnalysis, formatCurrency, getCurrencySymbol } from '../utils/sepaCalculator';
import { Layers, ShieldCheck, AlertTriangle, CheckCircle2, TrendingUp, Info, ChevronDown, ChevronUp, Zap } from 'lucide-react';

interface StageIdentifierPanelProps {
  stock: MinerviniTradeSetup;
  currencySymbol?: string;
}

export const StageIdentifierPanel: React.FC<StageIdentifierPanelProps> = ({
  stock,
  currencySymbol = '$',
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const stage = determineStageAnalysis({
    currentPrice: stock.currentPrice,
    sma50: stock.sma50,
    sma150: stock.sma150,
    sma200: stock.sma200,
    sma200_1mo_ago: stock.sma200_1mo_ago,
    high52w: stock.high52w,
    low52w: stock.low52w,
    rsRating: stock.rsRating,
  });

  const stagesList = [
    { num: 1, label: 'Stage 1: Base', desc: 'Sideways / Consolidation', color: 'bg-blue-600' },
    { num: 2, label: 'Stage 2: Markup', desc: 'Sustained Uptrend (Buy Zone)', color: 'bg-emerald-600' },
    { num: 3, label: 'Stage 3: Top', desc: 'Distribution & High Volatility', color: 'bg-amber-600' },
    { num: 4, label: 'Stage 4: Markdown', desc: 'Downtrend (Capital Loss Risk)', color: 'bg-rose-600' },
  ];

  return (
    <div className="bg-white border border-[#e5e4e1] overflow-hidden font-mono text-xs">
      {/* Panel Header Bar */}
      <div className={`p-4 flex flex-wrap items-center justify-between gap-3 ${stage.headerBg}`}>
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded bg-white/10 border border-white/20 text-amber-300 shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] uppercase font-bold tracking-widest text-amber-300">
                Stan Weinstein / Mark Minervini 4-Stage Analysis
              </span>
              <span className="px-2 py-0.5 rounded bg-white/20 text-white font-mono text-[9px] font-black uppercase">
                {stage.confidenceScore}% Confidence
              </span>
            </div>
            <h3 className="text-base font-extrabold text-white tracking-wide flex items-center space-x-2">
              <span>{stage.stageName}</span>
            </h3>
            <p className="text-[11px] text-gray-300 font-sans">
              {stage.stageSubtitle} — {stock.ticker} @ {formatCurrency(stock.currentPrice, currencySymbol)}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className={`px-3 py-1 text-xs font-black uppercase tracking-wider border shadow-xs ${stage.badgeBg}`}>
            {stage.stageCode.replace('_', ' ')} ACTIVE
          </span>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded cursor-pointer transition-colors"
            title={isExpanded ? 'Collapse Stage Identifier' : 'Expand Stage Identifier'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 space-y-4 bg-[#f9f8f5]">
          {/* 4-Stage Progression Visual Tracker */}
          <div className="bg-white border border-[#e5e4e1] p-3 space-y-2">
            <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500 block">
              Lifecycle Stage Progression
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {stagesList.map((stg) => {
                const isActive = stage.stageNumber === stg.num;
                return (
                  <div
                    key={stg.num}
                    className={`p-2.5 border transition-all text-left space-y-1 relative ${
                      isActive
                        ? 'bg-slate-900 text-white border-black ring-1 ring-black shadow-xs'
                        : 'bg-[#f9f8f5] text-gray-700 border-[#e5e4e1] opacity-75'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-black px-1.5 py-0.5 ${
                        isActive ? stg.color + ' text-white' : 'bg-gray-200 text-gray-700'
                      }`}>
                        Stage {stg.num}
                      </span>
                      {isActive && (
                        <span className="flex h-2 w-2 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-300"></span>
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-xs">
                      {stg.label.split(': ')[1]}
                    </div>
                    <div className="text-[9px] font-sans text-gray-400 leading-tight">
                      {stg.desc}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Minervini Action Guidance Callout */}
          <div className={`p-3 border font-sans text-xs flex items-start space-x-2.5 ${
            stage.stageCode === 'STAGE_2'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
              : stage.stageCode === 'STAGE_3'
              ? 'bg-amber-50 border-amber-300 text-amber-950'
              : stage.stageCode === 'STAGE_4'
              ? 'bg-rose-50 border-rose-300 text-rose-950'
              : 'bg-blue-50 border-blue-300 text-blue-950'
          }`}>
            <Zap className={`w-4 h-4 shrink-0 mt-0.5 ${
              stage.stageCode === 'STAGE_2' ? 'text-emerald-700' : 'text-amber-700'
            }`} />
            <div className="space-y-1">
              <div className="font-mono font-bold text-xs uppercase tracking-wide">
                Minervini SEPA Execution Protocol:
              </div>
              <div className="font-semibold">{stage.minerviniAction}</div>
              <p className="text-[11px] opacity-90 leading-relaxed font-sans">
                {stage.stageDescription}
              </p>
            </div>
          </div>

          {/* Moving Average Hierarchy Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white border border-[#e5e4e1] p-3 space-y-1">
              <span className="text-[9px] uppercase font-bold text-gray-400 block">Current Price</span>
              <div className="text-base font-black text-slate-900">
                {formatCurrency(stock.currentPrice, currencySymbol)}
              </div>
              <div className="text-[10px] text-gray-500">
                52W High: {formatCurrency(stock.high52w, currencySymbol)}
              </div>
            </div>

            <div className="bg-white border border-[#e5e4e1] p-3 space-y-1">
              <span className="text-[9px] uppercase font-bold text-gray-400 block">50-Day SMA</span>
              <div className="text-base font-black text-slate-900">
                {formatCurrency(stock.sma50, currencySymbol)}
              </div>
              <div className={`text-[10px] font-bold ${
                stock.currentPrice >= stock.sma50 ? 'text-emerald-700' : 'text-rose-700'
              }`}>
                {stock.currentPrice >= stock.sma50 ? 'Above 50MA (+)' : 'Below 50MA (-)'}
              </div>
            </div>

            <div className="bg-white border border-[#e5e4e1] p-3 space-y-1">
              <span className="text-[9px] uppercase font-bold text-gray-400 block">150-Day SMA</span>
              <div className="text-base font-black text-slate-900">
                {formatCurrency(stock.sma150, currencySymbol)}
              </div>
              <div className={`text-[10px] font-bold ${
                stock.sma50 >= stock.sma150 ? 'text-emerald-700' : 'text-rose-700'
              }`}>
                {stock.sma50 >= stock.sma150 ? '50MA > 150MA (+)' : '50MA < 150MA (-)'}
              </div>
            </div>

            <div className="bg-white border border-[#e5e4e1] p-3 space-y-1">
              <span className="text-[9px] uppercase font-bold text-gray-400 block">200-Day SMA & Slope</span>
              <div className="text-base font-black text-slate-900">
                {formatCurrency(stock.sma200, currencySymbol)}
              </div>
              <div className={`text-[10px] font-bold ${
                stage.sma200SlopePct > 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}>
                {stage.sma200SlopePct >= 0 ? '+' : ''}{stage.sma200SlopePct}% Slope (30D)
              </div>
            </div>
          </div>

          {/* Technical Criteria Checklist Matrix */}
          <div className="bg-white border border-[#e5e4e1] p-3.5 space-y-2">
            <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500 block">
              Stage Confirmation Checklist
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {stage.indicators.map((ind, idx) => (
                <div
                  key={idx}
                  className="bg-[#f9f8f5] border border-[#e5e4e1] p-2.5 flex items-start justify-between gap-2"
                >
                  <div className="space-y-0.5">
                    <div className="font-bold text-[#1a1a1a] text-[11px]">{ind.name}</div>
                    <div className="text-[10px] font-mono text-gray-500 leading-snug">{ind.detail}</div>
                  </div>
                  <span
                    className={`px-1.5 py-0.5 text-[9px] font-extrabold uppercase shrink-0 ${
                      ind.status === 'CONFIRMED'
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        : ind.status === 'FAIL'
                        ? 'bg-rose-100 text-rose-900 border border-rose-300'
                        : 'bg-amber-100 text-amber-900 border border-amber-300'
                    }`}
                  >
                    {ind.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
