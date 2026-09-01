import React, { useState } from 'react';
import { MinerviniTradeSetup } from '../types';
import {
  calculateVolatilityPriceTargetRanges,
  formatCurrency,
  VolatilityTargetLevel
} from '../utils/sepaCalculator';
import {
  Target,
  Activity,
  Zap,
  TrendingUp,
  Sliders,
  Sparkles,
  Layers,
  Clock,
  Compass,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  HelpCircle,
  BarChart2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface VolatilityPriceTargetsPanelProps {
  stock: MinerviniTradeSetup;
  currencySymbol: string;
  pivotPrice?: number;
  stopLossPrice?: number;
  activeTargetPrice?: number;
  onSelectTargetPrice?: (targetPrice: number) => void;
}

export const VolatilityPriceTargetsPanel: React.FC<VolatilityPriceTargetsPanelProps> = ({
  stock,
  currencySymbol,
  pivotPrice,
  stopLossPrice,
  activeTargetPrice,
  onSelectTargetPrice,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [customAtrMultiplier, setCustomAtrMultiplier] = useState<number>(3.0);
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);
  const [showEducationalTooltip, setShowEducationalTooltip] = useState<boolean>(false);

  const validPivot = pivotPrice && pivotPrice > 0 ? pivotPrice : stock.pivotPrice;
  const validStop = stopLossPrice && stopLossPrice > 0 ? stopLossPrice : stock.stopLossPrice;

  // Calculate volatility-based price target ranges
  const targetData = calculateVolatilityPriceTargetRanges(stock, validPivot, validStop);
  const {
    levels,
    atr14,
    atr14Percent,
    baseDepthPercent,
    baseDepthDollars,
    volatilityContractionRatio,
    volatilityProfileLabel,
    overallTargetRangeLow,
    overallTargetRangeHigh,
    overallMaxGainPercent,
    riskPerShare
  } = targetData;

  const customComputedTarget = targetData.customTargetPrice(customAtrMultiplier);
  const customGainPct = validPivot > 0 ? ((customComputedTarget - validPivot) / validPivot) * 100 : 0;
  const customRRR = riskPerShare > 0 ? (customComputedTarget - validPivot) / riskPerShare : 0;

  const handleApplyTarget = (price: number, tierId?: string) => {
    if (onSelectTargetPrice) {
      onSelectTargetPrice(price);
    }
    if (tierId) {
      setSelectedTierId(tierId);
    }
  };

  return (
    <div className="bg-white border-2 border-[#1a1a1a] shadow-md overflow-hidden rounded-none my-6">
      
      {/* Header */}
      <div className="bg-[#10141d] text-white p-5 border-b border-[#232936] flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 bg-amber-400 text-black font-mono text-[10px] font-black uppercase tracking-widest">
              VOLATILITY-BASED TARGET ENGINE
            </span>
            <span className="text-amber-400 font-serif italic text-xs">
              ATR Volatility &amp; VCP Expansion Model
            </span>
            <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-700 font-mono text-[10px] font-bold">
              {volatilityProfileLabel}
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-serif font-black tracking-tight text-white flex items-center space-x-2">
            <span>Potential Price Target Ranges</span>
            <Target className="w-5 h-5 text-amber-400 shrink-0" />
          </h2>

          <p className="text-xs text-gray-300 font-sans leading-relaxed max-w-3xl">
            Calculated from Pivot Entry (<strong className="font-mono text-white">{formatCurrency(validPivot, currencySymbol)}</strong>) and 14-day ATR (<strong className="font-mono text-amber-300">{formatCurrency(atr14, currencySymbol)} / {atr14Percent.toFixed(1)}%</strong>). Provides dynamic profit objective ranges across conservative, standard, aggressive, and base-depth expansion scenarios.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowEducationalTooltip(!showEducationalTooltip)}
            className="text-[10px] uppercase font-mono font-bold px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-600 flex items-center space-x-1 cursor-pointer transition-all"
            title="Toggle SEPA Volatility Methodology Guide"
          >
            <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>Methodology</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 bg-gray-800 hover:bg-gray-700 text-white border border-gray-600 cursor-pointer transition-all"
            title={isExpanded ? 'Collapse Panel' : 'Expand Panel'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="p-5 sm:p-6 space-y-6"
          >
            {/* Educational Tooltip Banner */}
            {showEducationalTooltip && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-900 text-gray-200 p-4 border border-amber-400/40 text-xs font-sans space-y-2 relative"
              >
                <div className="flex items-center space-x-2 text-amber-300 font-bold uppercase font-mono text-[11px]">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Mark Minervini SEPA Principle: Volatility-Adjusted Target Sizing</span>
                </div>
                <p className="leading-relaxed text-gray-300">
                  Fixed percentage targets (e.g. always selling at +10%) fail to account for the unique volatility and base characteristics of individual stocks. High-compression VCP breakouts often experience <strong>2x to 5x ATR momentum expansion</strong> following a volume dry-up. By measuring targets against 14-day ATR and initial consolidation depth, you optimize risk-to-reward without prematurely cutting Stage 2 champion runners short.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px] font-mono">
                  <div className="bg-slate-800/80 p-2 border border-slate-700">
                    <strong className="text-emerald-300 block">Conservative (1.5x - 2.0x ATR)</strong>
                    <span>Quick profit-taking window. Best for taking 30-50% off and moving stop to breakeven.</span>
                  </div>
                  <div className="bg-slate-800/80 p-2 border border-slate-700">
                    <strong className="text-teal-300 block">SEPA Core (2.5x - 3.5x ATR)</strong>
                    <span>Standard Stage 2 swing objective yielding 3:1+ R-Multiple on defined risk.</span>
                  </div>
                  <div className="bg-slate-800/80 p-2 border border-slate-700">
                    <strong className="text-purple-300 block">Measured Move (100% Depth)</strong>
                    <span>Classic technical projection where breakout gain equals 100% of the VCP base contraction depth.</span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Quick Volatility Metrics Summary Ribbon */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono text-xs">
              <div className="bg-[#f9f8f5] border border-[#e5e4e1] p-3">
                <span className="text-[10px] uppercase font-bold text-gray-500 block">Pivot Entry</span>
                <span className="text-base font-bold text-[#1a1a1a]">
                  {formatCurrency(validPivot, currencySymbol)}
                </span>
                <span className="text-[10px] text-gray-400 block">Reference Base</span>
              </div>

              <div className="bg-[#f9f8f5] border border-[#e5e4e1] p-3">
                <span className="text-[10px] uppercase font-bold text-gray-500 block">14-Day ATR</span>
                <span className="text-base font-bold text-amber-700">
                  {formatCurrency(atr14, currencySymbol)}
                </span>
                <span className="text-[10px] text-gray-600 block">{atr14Percent.toFixed(1)}% of price</span>
              </div>

              <div className="bg-[#f9f8f5] border border-[#e5e4e1] p-3">
                <span className="text-[10px] uppercase font-bold text-gray-500 block">Contraction Ratio (VCR)</span>
                <span className="text-base font-bold text-cyan-700">
                  {volatilityContractionRatio.toFixed(2)}x
                </span>
                <span className="text-[10px] text-gray-600 block">5d vs 20d ATR</span>
              </div>

              <div className="bg-[#f9f8f5] border border-[#e5e4e1] p-3">
                <span className="text-[10px] uppercase font-bold text-gray-500 block">Base Depth (T1)</span>
                <span className="text-base font-bold text-purple-700">
                  -{baseDepthPercent}%
                </span>
                <span className="text-[10px] text-gray-600 block">{formatCurrency(baseDepthDollars, currencySymbol)}</span>
              </div>

              <div className="bg-[#f9f8f5] border border-[#e5e4e1] p-3">
                <span className="text-[10px] uppercase font-bold text-gray-500 block">Target Spectrum</span>
                <span className="text-base font-bold text-emerald-700">
                  +{overallMaxGainPercent}%
                </span>
                <span className="text-[10px] text-gray-600 block">Max Upper Bound</span>
              </div>

              <div className="bg-[#10141d] text-white p-3 border border-black flex flex-col justify-between">
                <span className="text-[10px] uppercase font-bold text-amber-400 block">Active Plan Target</span>
                <span className="text-base font-bold text-emerald-400 font-mono">
                  {activeTargetPrice && activeTargetPrice > 0 ? formatCurrency(activeTargetPrice, currencySymbol) : 'Not Set'}
                </span>
                <span className="text-[10px] text-gray-400 font-sans">
                  {activeTargetPrice && activeTargetPrice > 0 && validPivot > 0
                    ? `+${(((activeTargetPrice - validPivot) / validPivot) * 100).toFixed(1)}%`
                    : 'Select a tier below'}
                </span>
              </div>
            </div>

            {/* Visual Target Range Progression Bar */}
            <div className="bg-[#f9f8f5] border border-[#e5e4e1] p-4 space-y-3 font-mono">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-bold text-[#1a1a1a] uppercase tracking-wider flex items-center space-x-1.5">
                  <BarChart2 className="w-4 h-4 text-emerald-700" />
                  <span>Volatility Price Target Ladder &amp; Spectrum</span>
                </span>
                <span className="text-[11px] text-gray-600 font-sans">
                  Full Range: <strong className="text-emerald-800 font-mono">{formatCurrency(overallTargetRangeLow, currencySymbol)}</strong> to <strong className="text-purple-800 font-mono">{formatCurrency(overallTargetRangeHigh, currencySymbol)}</strong>
                </span>
              </div>

              {/* Multi-step Visual Bar */}
              <div className="relative pt-6 pb-2">
                {/* Horizontal Track */}
                <div className="w-full h-3 bg-gray-200 rounded-full flex overflow-hidden border border-gray-300">
                  <div className="w-[20%] bg-emerald-400" title="Conservative Target Range (1.5x - 2.0x ATR)" />
                  <div className="w-[30%] bg-teal-500" title="SEPA Core Breakout Range (2.5x - 3.5x ATR)" />
                  <div className="w-[25%] bg-indigo-500" title="Aggressive Leader Range (4.0x - 5.5x ATR)" />
                  <div className="w-[25%] bg-purple-500" title="Measured Move Range (100% Base Depth)" />
                </div>

                {/* Markers */}
                <div className="grid grid-cols-5 gap-1 text-center pt-2 text-[10px] text-gray-700 font-bold">
                  <div className="flex flex-col items-center">
                    <span className="text-gray-500">Pivot Entry</span>
                    <span className="text-[#1a1a1a] font-black">{formatCurrency(validPivot, currencySymbol)}</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-emerald-700">1. Conservative</span>
                    <span className="text-emerald-800 font-black">{formatCurrency(levels[0].midTargetPrice, currencySymbol)}</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-teal-700">2. SEPA Core</span>
                    <span className="text-teal-800 font-black">{formatCurrency(levels[1].midTargetPrice, currencySymbol)}</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-indigo-700">3. Aggressive</span>
                    <span className="text-indigo-800 font-black">{formatCurrency(levels[2].midTargetPrice, currencySymbol)}</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-purple-700">4. Measured Move</span>
                    <span className="text-purple-800 font-black">{formatCurrency(levels[3].midTargetPrice, currencySymbol)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Dynamic Grid of Calculated Volatility Target Range Tiers */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-[#1a1a1a] flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-amber-600" />
                  <span>Calculated Target Price Ranges by Volatility Scenario</span>
                </h3>
                <span className="text-xs text-gray-500 font-sans">
                  Click any target price or tier button to immediately set it as your active trade plan target.
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {levels.map((lvl) => {
                  const isActive = activeTargetPrice && Math.abs(activeTargetPrice - lvl.midTargetPrice) < 0.5;
                  const isSelected = selectedTierId === lvl.id;

                  return (
                    <div
                      key={lvl.id}
                      className={`border p-4 transition-all flex flex-col justify-between space-y-4 ${
                        isActive
                          ? 'bg-emerald-50/90 border-2 border-emerald-600 ring-2 ring-emerald-300 shadow-sm'
                          : `${lvl.colorScheme.bg} ${lvl.colorScheme.border} hover:border-gray-400 shadow-2xs`
                      }`}
                    >
                      {/* Top Header of Card */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className={`px-2 py-0.5 font-mono text-[9px] font-black uppercase tracking-wider ${lvl.colorScheme.badgeBg} ${lvl.colorScheme.badgeText} border ${lvl.colorScheme.badgeBorder}`}>
                            {lvl.shortLabel}
                          </span>
                          <span className="text-[10px] font-mono font-bold text-gray-600 flex items-center space-x-1">
                            <Clock className="w-3 h-3 text-gray-400" />
                            <span>{lvl.holdingHorizon}</span>
                          </span>
                        </div>

                        <h4 className="text-sm font-bold text-[#1a1a1a] font-serif leading-tight">
                          {lvl.name}
                        </h4>
                        <p className="text-[11px] text-gray-600 font-sans leading-snug">
                          {lvl.strategyDescription}
                        </p>
                      </div>

                      {/* Primary Midpoint Price & Gain Highlight */}
                      <div className="bg-white p-3 border border-gray-200/80 space-y-2">
                        <div className="flex items-baseline justify-between font-mono">
                          <div>
                            <span className="text-[9px] uppercase font-bold text-gray-500 block">Midpoint Target:</span>
                            <span className="text-2xl font-black text-[#1a1a1a]">
                              {formatCurrency(lvl.midTargetPrice, currencySymbol)}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-black text-emerald-700 block">
                              +{lvl.midGainPercent}%
                            </span>
                            <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 border border-gray-200">
                              {lvl.riskRewardRatio.toFixed(1)}:1 R/R
                            </span>
                          </div>
                        </div>

                        {/* Low & High Range Boundaries (Clickable) */}
                        <div className="pt-2 border-t border-gray-100 grid grid-cols-2 gap-2 text-center text-xs font-mono">
                          <button
                            type="button"
                            onClick={() => handleApplyTarget(lvl.lowTargetPrice, lvl.id)}
                            className="p-1.5 bg-[#f9f8f5] hover:bg-emerald-100 border border-gray-200 text-gray-800 hover:text-emerald-900 transition-all cursor-pointer text-left"
                            title={`Set Lower Range Target: ${formatCurrency(lvl.lowTargetPrice, currencySymbol)} (+${lvl.lowGainPercent}%)`}
                          >
                            <span className="text-[9px] text-gray-500 uppercase block font-bold">Low Bound</span>
                            <span className="font-black text-[11px]">{formatCurrency(lvl.lowTargetPrice, currencySymbol)}</span>
                            <span className="text-[9px] text-emerald-700 block font-bold">+{lvl.lowGainPercent}%</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleApplyTarget(lvl.highTargetPrice, lvl.id)}
                            className="p-1.5 bg-[#f9f8f5] hover:bg-emerald-100 border border-gray-200 text-gray-800 hover:text-emerald-900 transition-all cursor-pointer text-left"
                            title={`Set Upper Range Target: ${formatCurrency(lvl.highTargetPrice, currencySymbol)} (+${lvl.highGainPercent}%)`}
                          >
                            <span className="text-[9px] text-gray-500 uppercase block font-bold">High Bound</span>
                            <span className="font-black text-[11px]">{formatCurrency(lvl.highTargetPrice, currencySymbol)}</span>
                            <span className="text-[9px] text-emerald-700 block font-bold">+{lvl.highGainPercent}%</span>
                          </button>
                        </div>
                      </div>

                      {/* Action Recommendation */}
                      <div className="text-[10px] font-sans text-gray-600 bg-white/60 p-2 border border-gray-200">
                        <strong className="text-[#1a1a1a] block font-mono uppercase text-[9px]">Execution Rule:</strong>
                        <span>{lvl.suggestedAction}</span>
                      </div>

                      {/* Apply Button */}
                      <button
                        type="button"
                        onClick={() => handleApplyTarget(lvl.midTargetPrice, lvl.id)}
                        className={`w-full py-2 px-3 text-[10px] uppercase font-mono font-black tracking-wider transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-2xs ${
                          isActive
                            ? 'bg-emerald-700 text-white border border-emerald-900'
                            : 'bg-[#1a1a1a] hover:bg-black text-white border border-black'
                        }`}
                      >
                        {isActive ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                            <span>Active Plan Target</span>
                          </>
                        ) : (
                          <>
                            <Target className="w-3.5 h-3.5 text-amber-300" />
                            <span>Set as Active Target ({formatCurrency(lvl.midTargetPrice, currencySymbol)})</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Interactive Custom ATR Volatility Multiplier Slider Tool */}
            <div className="bg-[#f9f8f5] border border-[#e5e4e1] p-5 space-y-4 font-mono">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e5e4e1] pb-3">
                <div className="flex items-center space-x-2">
                  <Sliders className="w-4 h-4 text-slate-800" />
                  <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1a1a1a]">
                    Interactive Custom ATR Volatility Target Sizer
                  </h4>
                </div>
                <span className="text-xs text-gray-500 font-sans">
                  Fine-tune volatility multiple based on sector momentum or market tailwinds
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
                {/* Left: Slider & Presets */}
                <div className="lg:col-span-7 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[10px] uppercase font-bold text-gray-500">ATR Multiple Slider:</span>
                    <span className="px-2.5 py-0.5 bg-[#1a1a1a] text-amber-300 font-black text-sm border border-black">
                      {customAtrMultiplier.toFixed(1)}x ATR (+{formatCurrency(customAtrMultiplier * atr14, currencySymbol)})
                    </span>
                  </div>

                  <input
                    type="range"
                    min="1.0"
                    max="7.0"
                    step="0.25"
                    value={customAtrMultiplier}
                    onChange={(e) => setCustomAtrMultiplier(Number(e.target.value))}
                    className="w-full accent-[#1a1a1a] cursor-pointer h-2 bg-gray-300 rounded-lg"
                  />

                  {/* Quick Preset Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] uppercase font-bold text-gray-500 mr-1">Presets:</span>
                    {[
                      { label: '1.5x (Quick)', val: 1.5 },
                      { label: '2.0x (Tight)', val: 2.0 },
                      { label: '3.0x (SEPA)', val: 3.0 },
                      { label: '4.0x (Power)', val: 4.0 },
                      { label: '5.0x (Champion)', val: 5.0 },
                      { label: '6.0x (Extended)', val: 6.0 },
                    ].map((p) => (
                      <button
                        key={p.val}
                        type="button"
                        onClick={() => setCustomAtrMultiplier(p.val)}
                        className={`text-[10px] px-2 py-1 font-bold border transition-all cursor-pointer ${
                          customAtrMultiplier === p.val
                            ? 'bg-[#1a1a1a] text-white border-black'
                            : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-100'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Right: Calculated Custom Target Price Output */}
                <div className="lg:col-span-5 bg-white p-4 border border-[#e5e4e1] flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500">
                      Calculated Target Price:
                    </span>
                    <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 border border-emerald-200">
                      +{customGainPct.toFixed(1)}% Gain
                    </span>
                  </div>

                  <div className="flex items-baseline space-x-2">
                    <span className="text-3xl font-black text-[#1a1a1a]">
                      {formatCurrency(customComputedTarget, currencySymbol)}
                    </span>
                    <span className="text-xs text-gray-600 font-bold">
                      ({customRRR.toFixed(1)}:1 R/R)
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleApplyTarget(customComputedTarget)}
                    className="w-full py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] uppercase font-black tracking-wider border border-emerald-900 flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-2xs"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-300" />
                    <span>Apply Custom Target ({formatCurrency(customComputedTarget, currencySymbol)})</span>
                  </button>
                </div>
              </div>
            </div>

          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
