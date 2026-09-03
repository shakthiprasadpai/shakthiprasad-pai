import React, { useState } from 'react';
import { MinerviniTradeSetup } from '../types';
import { calculatePivotPoints, PivotPointModel, PivotLevelsResult } from '../utils/technicalIndicatorsCalculator';
import { formatCurrency, getCurrencySymbol } from '../utils/sepaCalculator';
import { Target, Layers, ArrowUpRight, ArrowDownRight, Compass, ShieldAlert, Sparkles, CheckCircle2 } from 'lucide-react';

interface PivotPointLevelsCardProps {
  stock: MinerviniTradeSetup;
  isObsidian?: boolean;
  selectedModel?: PivotPointModel;
  onModelChange?: (model: PivotPointModel) => void;
}

export const PivotPointLevelsCard: React.FC<PivotPointLevelsCardProps> = ({
  stock,
  isObsidian = false,
  selectedModel = 'STANDARD',
  onModelChange
}) => {
  const [model, setModel] = useState<PivotPointModel>(selectedModel);

  const handleModelSelect = (m: PivotPointModel) => {
    setModel(m);
    if (onModelChange) onModelChange(m);
  };

  const currencySymbol = getCurrencySymbol(stock.exchange);
  const currentPrice = stock.currentPrice || (stock.priceHistory && stock.priceHistory.length > 0
    ? stock.priceHistory[stock.priceHistory.length - 1].close
    : stock.pivotPrice);

  const history = stock.priceHistory || [];
  let pHigh = stock.high52w || currentPrice * 1.08;
  let pLow = stock.low52w || currentPrice * 0.92;
  let pClose = currentPrice;

  if (history.length >= 5) {
    const recentSlice = history.slice(Math.max(0, history.length - 20));
    pHigh = Math.max(...recentSlice.map(p => p.high));
    pLow = Math.min(...recentSlice.map(p => p.low));
    pClose = recentSlice[recentSlice.length - 1].close;
  }

  const pivotResult: PivotLevelsResult = calculatePivotPoints(pHigh, pLow, pClose, currentPrice, model);
  const isAboveCentralPivot = currentPrice >= pivotResult.pivot;

  return (
    <div className={`border font-mono transition-colors duration-200 ${
      isObsidian ? 'bg-[#0e1217] border-[#2d333b]' : 'bg-white border-[#e5e4e1]'
    }`}>
      {/* Header Bar */}
      <div className={`p-3 border-b flex flex-wrap items-center justify-between gap-3 ${
        isObsidian ? 'bg-[#161b22] border-[#2d333b]' : 'bg-[#f9f8f5] border-[#e5e4e1]'
      }`}>
        <div className="flex items-center space-x-2">
          <Compass className="w-4 h-4 text-blue-500" />
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                Pivot Point Levels & Targets
              </span>
              <span className={`px-2 py-0.5 text-[9px] font-extrabold uppercase border ${
                isAboveCentralPivot
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800'
                  : 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-800'
              }`}>
                {isAboveCentralPivot ? 'Bullish Bias (Above P)' : 'Defensive (Below P)'}
              </span>
            </div>
            <p className="text-[10px] text-gray-500 font-sans">
              Dynamic multi-level support & resistance grid benchmarked against 20-day high/low extremes.
            </p>
          </div>
        </div>

        {/* Model Tabs: Standard, Fibonacci, Camarilla */}
        <div className="flex items-center space-x-1 bg-[#10141d]/10 dark:bg-[#10141d] p-1 border border-gray-300 dark:border-[#30363d] rounded-xs text-[10px]">
          {(['STANDARD', 'FIBONACCI', 'CAMARILLA'] as PivotPointModel[]).map((m) => (
            <button
              key={m}
              onClick={() => handleModelSelect(m)}
              className={`px-2.5 py-1 font-bold uppercase transition cursor-pointer ${
                model === m
                  ? 'bg-blue-600 text-white shadow-xs'
                  : isObsidian ? 'text-gray-400 hover:text-white hover:bg-[#21262d]' : 'text-gray-600 hover:text-black hover:bg-gray-100'
              }`}
            >
              {m === 'STANDARD' ? 'Floor / Classic' : m === 'FIBONACCI' ? 'Fibonacci' : 'Camarilla'}
            </button>
          ))}
        </div>
      </div>

      {/* Minervini SEPA VCP Comparison Banner */}
      <div className={`px-3 py-2 border-b flex flex-wrap items-center justify-between gap-2 text-xs ${
        isObsidian ? 'bg-[#121721] border-[#2d333b]' : 'bg-amber-50/70 border-amber-200'
      }`}>
        <div className="flex items-center space-x-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span className="font-bold text-amber-900 dark:text-amber-300 text-[11px] uppercase">
            SEPA VCP Pivot Trigger:
          </span>
          <span className="font-extrabold text-slate-900 dark:text-white">
            {currencySymbol}{stock.pivotPrice.toFixed(2)}
          </span>
          <span className="text-[10px] text-gray-500">
            ({(((stock.pivotPrice - currentPrice) / currentPrice) * 100).toFixed(1)}% from current)
          </span>
        </div>

        <div className="flex items-center space-x-3 text-[10px]">
          <span>
            Current Close: <strong className="text-slate-900 dark:text-white">{currencySymbol}{currentPrice.toFixed(2)}</strong>
          </span>
          <span>
            Stop Loss: <strong className="text-rose-600 dark:text-rose-400">{currencySymbol}{stock.stopLossPrice.toFixed(2)}</strong>
          </span>
        </div>
      </div>

      {/* Levels Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className={`border-b text-[10px] uppercase text-gray-500 dark:text-gray-400 ${
              isObsidian ? 'bg-[#161b22] border-[#2d333b]' : 'bg-[#faf9f6] border-[#e5e4e1]'
            }`}>
              <th className="py-2 px-3">Level Name</th>
              <th className="py-2 px-3">Price Target</th>
              <th className="py-2 px-3">Distance (%)</th>
              <th className="py-2 px-3 hidden sm:table-cell">Distance ($)</th>
              <th className="py-2 px-3">Status</th>
              <th className="py-2 px-3 hidden md:table-cell">Technical Role</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-[#2d333b]">
            {pivotResult.levels.map((lvl) => {
              const diffDollars = lvl.price - currentPrice;
              const isPositive = diffDollars >= 0;

              return (
                <tr
                  key={lvl.id}
                  className={`transition-colors ${
                    lvl.isNearest
                      ? isObsidian ? 'bg-blue-950/30 font-bold' : 'bg-blue-50/70 font-bold'
                      : isObsidian ? 'hover:bg-[#161b22]/50' : 'hover:bg-gray-50'
                  }`}
                >
                  {/* Level Name */}
                  <td className="py-2 px-3 flex items-center space-x-2">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: lvl.color }}
                    />
                    <span className="font-extrabold text-slate-900 dark:text-white">
                      {lvl.label}
                    </span>
                    {lvl.isNearest && (
                      <span className="bg-blue-600 text-white text-[8px] font-black uppercase px-1.5 py-0.2 rounded-xs">
                        Nearest
                      </span>
                    )}
                  </td>

                  {/* Price */}
                  <td className="py-2 px-3 font-mono font-bold text-slate-900 dark:text-white">
                    {currencySymbol}{lvl.price.toFixed(2)}
                  </td>

                  {/* Distance % */}
                  <td className="py-2 px-3 font-mono">
                    <span className={`flex items-center space-x-0.5 ${
                      isPositive ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                    }`}>
                      {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      <span>{Math.abs(lvl.diffPct)}%</span>
                    </span>
                  </td>

                  {/* Distance $ */}
                  <td className="py-2 px-3 font-mono text-gray-500 hidden sm:table-cell">
                    {diffDollars >= 0 ? '+' : ''}{diffDollars.toFixed(2)}
                  </td>

                  {/* Status Tag */}
                  <td className="py-2 px-3">
                    <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-xs border ${
                      lvl.type === 'RESISTANCE'
                        ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900'
                        : lvl.type === 'SUPPORT'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900'
                        : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900'
                    }`}>
                      {lvl.type}
                    </span>
                  </td>

                  {/* Technical Role */}
                  <td className="py-2 px-3 text-[10px] text-gray-500 dark:text-gray-400 font-sans hidden md:table-cell">
                    {lvl.description}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer Info */}
      <div className={`p-2.5 px-3 border-t flex flex-wrap items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 ${
        isObsidian ? 'bg-[#161b22] border-[#2d333b]' : 'bg-[#faf9f6] border-[#e5e4e1]'
      }`}>
        <div className="flex items-center space-x-3">
          <span>• <strong>Standard:</strong> Classic floor trader equation</span>
          <span>• <strong>Fibonacci:</strong> 38.2%, 61.8%, 100% extensions</span>
          <span>• <strong>Camarilla:</strong> High-probability intraday mean-reversion</span>
        </div>
        <div className="italic">
          Levels dynamically update as rolling price range expands.
        </div>
      </div>
    </div>
  );
};
