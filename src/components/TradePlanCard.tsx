import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MinerviniTradeSetup } from '../types';
import { calculatePositionSize, calculateBreakoutProbability, formatCurrency, formatVolume, getCurrencySymbol, calculateDailyVolatilityMetrics } from '../utils/sepaCalculator';
import { exportTradePlansToCsv, exportDetailedTradeParametersToCsv } from '../utils/csvExport';
import { generateSepaPdfReport } from '../utils/pdfExporter';
import { ExitSignals } from './ExitSignals';
import { BreakoutProbabilityEngine } from './BreakoutProbabilityEngine';
import { RuleBasedEntryExitPanel } from './RuleBasedEntryExitPanel';
import { DailyPivotAndVolatilityPanel } from './DailyPivotAndVolatilityPanel';
import { StageIdentifierPanel } from './StageIdentifierPanel';
import { TrailingStopCalculatorPanel } from './TrailingStopCalculatorPanel';
import { Target, ShieldAlert, ArrowUpRight, Droplets, DollarSign, Calculator, Layers, Flame, Zap, Sparkles, TrendingUp, BarChart3, ShieldCheck, FileText, Save, Check, Trash2, Clock, StickyNote, FileSpreadsheet, LogOut, AlertTriangle, ArrowRightCircle, Sliders, CheckCircle2, RefreshCw, Bell, BellRing, BellOff, ChevronDown, ChevronUp, Printer } from 'lucide-react';

function getArcPath(cx: number, cy: number, r: number, startAngleDeg: number, endAngleDeg: number) {
  const rad1 = (startAngleDeg * Math.PI) / 180;
  const rad2 = (endAngleDeg * Math.PI) / 180;
  const x1 = cx - r * Math.cos(rad1);
  const y1 = cy - r * Math.sin(rad1);
  const x2 = cx - r * Math.cos(rad2);
  const y2 = cy - r * Math.sin(rad2);
  const largeArcFlag = endAngleDeg - startAngleDeg <= 180 ? 0 : 1;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2}`;
}

interface RiskRewardGaugeProps {
  ratio: number;
  pivotEntry: number;
  stopLoss: number;
  targetPrice: number;
  currencySymbol: string;
}

export const RiskRewardGauge: React.FC<RiskRewardGaugeProps> = ({
  ratio,
  pivotEntry,
  stopLoss,
  targetPrice,
  currencySymbol,
}) => {
  const riskPerShare = Math.max(0.01, pivotEntry - stopLoss);
  const rewardPerShare = Math.max(0, targetPrice - pivotEntry);
  const riskPct = pivotEntry > 0 ? ((pivotEntry - stopLoss) / pivotEntry) * 100 : 0;
  const rewardPct = pivotEntry > 0 ? ((targetPrice - pivotEntry) / pivotEntry) * 100 : 0;

  const cx = 120;
  const cy = 110;
  const r = 80;

  const clampedR = Math.min(6, Math.max(0, ratio));
  const needleAngleDeg = (clampedR / 6) * 180;
  const needleRad = (needleAngleDeg * Math.PI) / 180;
  const needleLen = 68;
  const nx = cx - needleLen * Math.cos(needleRad);
  const ny = cy - needleLen * Math.sin(needleRad);

  let statusBadge = {
    label: 'SUBPAR RISK/REWARD',
    sub: 'Under 2:1 ratio — High downside risk relative to potential gain.',
    color: 'bg-red-100 text-red-900 border-red-300',
    textColor: 'text-red-600',
    badgeText: '🔴 High Risk',
  };

  if (ratio >= 5.0) {
    statusBadge = {
      label: 'CHAMPION ASYMMETRIC GRADE',
      sub: '5:1+ ratio — Exceptional reward potential relative to tight risk.',
      color: 'bg-purple-100 text-purple-900 border-purple-300',
      textColor: 'text-purple-600',
      badgeText: '🚀 Champion Grade',
    };
  } else if (ratio >= 3.0) {
    statusBadge = {
      label: 'MINERVINI SEPA STANDARD',
      sub: '3:1 to 5:1 ratio — Optimal Mark Minervini asymmetric entry setup.',
      color: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      textColor: 'text-emerald-600',
      badgeText: '🟢 SEPA Standard',
    };
  } else if (ratio >= 2.0) {
    statusBadge = {
      label: 'ACCEPTABLE MINIMUM THRESHOLD',
      sub: '2:1 ratio — Passable minimum, but 3:1+ preferred for maximum edge.',
      color: 'bg-amber-100 text-amber-900 border-amber-300',
      textColor: 'text-amber-600',
      badgeText: '🟡 Acceptable Min',
    };
  }

  return (
    <div className="bg-white border border-[#e5e4e1] p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e5e4e1] pb-2">
        <div className="flex items-center space-x-2">
          <Target className="w-4 h-4 text-emerald-600" />
          <h5 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1a1a1a]">
            Dynamic Risk / Reward Gauge
          </h5>
        </div>
        <span className={`px-2.5 py-0.5 border text-xs font-mono font-black uppercase ${statusBadge.color}`}>
          {statusBadge.badgeText} ({ratio.toFixed(2)} : 1)
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
        {/* Left Column: Visual Arc Gauge Meter */}
        <div className="md:col-span-5 flex flex-col items-center justify-center p-3 bg-[#f9f8f5] border border-[#e5e4e1]">
          <svg viewBox="0 0 240 145" className="w-full max-w-[220px] overflow-visible">
            {/* Background Arc Track */}
            <path
              d={getArcPath(cx, cy, r, 0, 180)}
              fill="none"
              stroke="#e5e4e1"
              strokeWidth="16"
              strokeLinecap="round"
            />

            {/* Colored Zones */}
            {/* Red: 0:1 to 2:1 */}
            <path
              d={getArcPath(cx, cy, r, 2, 58)}
              fill="none"
              stroke="#ef4444"
              strokeWidth="14"
            />
            {/* Yellow: 2:1 to 3:1 */}
            <path
              d={getArcPath(cx, cy, r, 62, 88)}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="14"
            />
            {/* Green: 3:1 to 5:1 */}
            <path
              d={getArcPath(cx, cy, r, 92, 148)}
              fill="none"
              stroke="#10b981"
              strokeWidth="14"
            />
            {/* Purple: 5:1 to 6:1+ */}
            <path
              d={getArcPath(cx, cy, r, 152, 178)}
              fill="none"
              stroke="#8b5cf6"
              strokeWidth="14"
            />

            {/* Tick Markers */}
            {[
              { rVal: 0, deg: 0, label: '0:1' },
              { rVal: 2, deg: 60, label: '2:1' },
              { rVal: 3, deg: 90, label: '3:1' },
              { rVal: 5, deg: 150, label: '5:1' },
              { rVal: 6, deg: 180, label: '6:1+' },
            ].map((tick) => {
              const tickRad = (tick.deg * Math.PI) / 180;
              const innerX = cx - (r - 12) * Math.cos(tickRad);
              const innerY = cy - (r - 12) * Math.sin(tickRad);
              const outerX = cx - (r + 12) * Math.cos(tickRad);
              const outerY = cy - (r + 12) * Math.sin(tickRad);

              const labelR = r + 22;
              const lx = cx - labelR * Math.cos(tickRad);
              const ly = cy - labelR * Math.sin(tickRad);

              return (
                <g key={tick.label}>
                  <line
                    x1={innerX}
                    y1={innerY}
                    x2={outerX}
                    y2={outerY}
                    stroke="#1a1a1a"
                    strokeWidth="1.5"
                  />
                  <text
                    x={lx}
                    y={ly + 3}
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight="bold"
                    fontFamily="monospace"
                    fill="#4b5563"
                  >
                    {tick.label}
                  </text>
                </g>
              );
            })}

            {/* Dynamic Needle */}
            <line
              x1={cx}
              y1={cy}
              x2={nx}
              y2={ny}
              stroke="#1a1a1a"
              strokeWidth="3.5"
              strokeLinecap="round"
              className="transition-all duration-300"
            />
            <circle cx={cx} cy={cy} r="6" fill="#1a1a1a" stroke="#ffffff" strokeWidth="2" />
            <circle cx={nx} cy={ny} r="3" fill="#10b981" />
          </svg>

          {/* Central Digital Display */}
          <div className="mt-[-10px] text-center space-y-0.5">
            <div className={`text-2xl font-black font-mono tracking-tight ${statusBadge.textColor}`}>
              {ratio.toFixed(2)} : 1
            </div>
            <div className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-widest">
              Risk-to-Reward Ratio
            </div>
          </div>
        </div>

        {/* Right Column: Key Metric Breakdown & Minervini Rule Context */}
        <div className="md:col-span-7 space-y-3 font-mono text-xs">
          <div className="bg-[#f9f8f5] p-2.5 border border-[#e5e4e1] space-y-1">
            <div className="text-[10px] uppercase font-bold text-[#b5a68d] flex justify-between">
              <span>Setup Rating:</span>
              <span className={`font-bold ${statusBadge.textColor}`}>{statusBadge.label}</span>
            </div>
            <p className="text-[11px] text-gray-700 font-sans leading-relaxed">
              {statusBadge.sub}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {/* Risk Box */}
            <div className="bg-red-50/70 border border-red-200 p-2.5 space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-red-700 block">
                Defined Risk (1R)
              </span>
              <div className="text-base font-black text-red-600 font-mono">
                {formatCurrency(riskPerShare, currencySymbol)} <span className="text-[10px] font-normal">/ sh</span>
              </div>
              <div className="text-[10px] text-red-800 font-bold">
                -{riskPct.toFixed(1)}% Stop Loss ({formatCurrency(stopLoss, currencySymbol)})
              </div>
            </div>

            {/* Reward Box */}
            <div className="bg-emerald-50/70 border border-emerald-200 p-2.5 space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-emerald-800 block">
                Expected Reward
              </span>
              <div className="text-base font-black text-emerald-700 font-mono">
                {formatCurrency(rewardPerShare, currencySymbol)} <span className="text-[10px] font-normal">/ sh</span>
              </div>
              <div className="text-[10px] text-emerald-800 font-bold">
                +{rewardPct.toFixed(1)}% Target ({formatCurrency(targetPrice, currencySymbol)})
              </div>
            </div>
          </div>

          {/* Ratio Comparison Progress Bar */}
          <div className="space-y-1 pt-0.5">
            <div className="flex justify-between text-[10px] font-bold">
              <span className="text-red-700">Risk: 1.0 Unit</span>
              <span className="text-emerald-700">Reward: {ratio.toFixed(2)} Units</span>
            </div>
            <div className="w-full bg-gray-200 h-2.5 flex overflow-hidden rounded border border-gray-300">
              <div
                className="bg-red-500 h-full text-[9px] text-white font-bold flex items-center justify-center transition-all"
                style={{ width: `${Math.min(35, (1 / (1 + ratio)) * 100)}%` }}
              >
                1R
              </div>
              <div
                className="bg-emerald-600 h-full text-[9px] text-white font-bold flex items-center justify-center transition-all border-l border-white/40"
                style={{ width: `${Math.max(25, (ratio / (1 + ratio)) * 100)}%` }}
              >
                {ratio.toFixed(2)}R Reward
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

interface SmartStopAdjusterProps {
  stock: MinerviniTradeSetup;
  customStopPrice: number;
  onUpdateStopPrice: (newStopPrice: number) => void;
}

export const SmartStopAdjuster: React.FC<SmartStopAdjusterProps> = ({
  stock,
  customStopPrice,
  onUpdateStopPrice,
}) => {
  const currencySymbol = getCurrencySymbol(stock.exchange);
  const pivotEntry = stock.pivotPrice;
  const currentPrice = stock.currentPrice;

  // 1. Breakeven Stop Level (+8% to +10% Gain Rule)
  const breakevenStop = pivotEntry;
  const breakevenGainPct = ((currentPrice - pivotEntry) / pivotEntry) * 100;
  const isBreakevenEligible = breakevenGainPct >= 8.0;

  // 2. 2.0x ATR Volatility Stop Level
  const estimatedAtr = currentPrice * 0.025;
  const atrStop = Number((currentPrice - 2.0 * estimatedAtr).toFixed(2));

  // 3. 20-Day EMA Trailing Stop
  const ema20Stop = Number((currentPrice * 0.97).toFixed(2));

  // 4. 50% Profit Locking Stop Level
  const profitLockStop = Number((pivotEntry + Math.max(0, currentPrice - pivotEntry) * 0.5).toFixed(2));
  const isProfitLockEligible = breakevenGainPct >= 10.0;

  return (
    <div className="bg-[#f9f8f5] border border-[#e5e4e1] p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e5e4e1] pb-3">
        <div className="flex items-center space-x-2">
          <ShieldAlert className="w-4 h-4 text-amber-600 animate-pulse" />
          <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1a1a1a]">
            ⚡ Smart Stop Loss Adjuster & Dynamic Trailing Traps
          </h4>
        </div>
        <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5">
          Active Stop: {formatCurrency(customStopPrice, currencySymbol)}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
        {/* Option 1: Breakeven Stop */}
        <div
          className={`p-3 border transition-all flex flex-col justify-between ${
            Math.abs(customStopPrice - breakevenStop) < 0.01
              ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500'
              : 'bg-white border-[#e5e4e1] hover:border-emerald-300'
          }`}
        >
          <div>
            <div className="flex items-center justify-between text-[10px] font-bold text-emerald-800 uppercase">
              <span>Breakeven Stop</span>
              {isBreakevenEligible && (
                <span className="bg-emerald-600 text-white px-1 py-0.2 font-mono text-[9px]">
                  RECOMMENDED
                </span>
              )}
            </div>
            <div className="text-xl font-bold font-mono text-[#1a1a1a] mt-1">
              {formatCurrency(breakevenStop, currencySymbol)}
            </div>
            <p className="text-[10px] text-gray-500 font-sans mt-1">
              {isBreakevenEligible
                ? 'Stock gained +8%+! Move stop to entry to eliminate downside risk.'
                : 'Moves stop loss to initial pivot entry price when stock advances +8%+.'}
            </p>
          </div>
          <button
            onClick={() => onUpdateStopPrice(breakevenStop)}
            className="mt-3 w-full py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-[10px] uppercase tracking-wider border border-emerald-900 transition-all cursor-pointer"
          >
            Apply Breakeven Stop
          </button>
        </div>

        {/* Option 2: 2.0x ATR Volatility Stop */}
        <div
          className={`p-3 border transition-all flex flex-col justify-between ${
            Math.abs(customStopPrice - atrStop) < 0.01
              ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500'
              : 'bg-white border-[#e5e4e1] hover:border-blue-300'
          }`}
        >
          <div>
            <div className="flex items-center justify-between text-[10px] font-bold text-blue-800 uppercase">
              <span>2.0x ATR Volatility Stop</span>
              <span className="text-[9px] text-gray-400 font-mono">
                ATR: {formatCurrency(estimatedAtr, currencySymbol)}
              </span>
            </div>
            <div className="text-xl font-bold font-mono text-[#1a1a1a] mt-1">
              {formatCurrency(atrStop, currencySymbol)}
            </div>
            <p className="text-[10px] text-gray-500 font-sans mt-1">
              Trails price with a 2.0x ATR volatility cushion below live price.
            </p>
          </div>
          <button
            onClick={() => onUpdateStopPrice(atrStop)}
            className="mt-3 w-full py-1.5 bg-blue-800 hover:bg-blue-900 text-white font-bold text-[10px] uppercase tracking-wider border border-blue-900 transition-all cursor-pointer"
          >
            Apply ATR Volatility Stop
          </button>
        </div>

        {/* Option 3: 20-Day EMA Trailing Stop */}
        <div
          className={`p-3 border transition-all flex flex-col justify-between ${
            Math.abs(customStopPrice - ema20Stop) < 0.01
              ? 'bg-purple-50 border-purple-500 ring-1 ring-purple-500'
              : 'bg-white border-[#e5e4e1] hover:border-purple-300'
          }`}
        >
          <div>
            <div className="flex items-center justify-between text-[10px] font-bold text-purple-900 uppercase">
              <span>20-Day EMA Stop</span>
              <span className="text-[9px] text-purple-700 font-mono">Trend Line</span>
            </div>
            <div className="text-xl font-bold font-mono text-[#1a1a1a] mt-1">
              {formatCurrency(ema20Stop, currencySymbol)}
            </div>
            <p className="text-[10px] text-gray-500 font-sans mt-1">
              Minervini institutional trend-following stop hugging 20-day EMA.
            </p>
          </div>
          <button
            onClick={() => onUpdateStopPrice(ema20Stop)}
            className="mt-3 w-full py-1.5 bg-purple-900 hover:bg-black text-white font-bold text-[10px] uppercase tracking-wider border border-black transition-all cursor-pointer"
          >
            Apply 20-EMA Stop
          </button>
        </div>

        {/* Option 4: 50% Profit Locking Stop */}
        <div
          className={`p-3 border transition-all flex flex-col justify-between ${
            Math.abs(customStopPrice - profitLockStop) < 0.01
              ? 'bg-amber-50 border-amber-500 ring-1 ring-amber-500'
              : 'bg-white border-[#e5e4e1] hover:border-amber-300'
          }`}
        >
          <div>
            <div className="flex items-center justify-between text-[10px] font-bold text-amber-900 uppercase">
              <span>50% Profit Lock Stop</span>
              {isProfitLockEligible && (
                <span className="bg-amber-500 text-black px-1 py-0.2 font-mono text-[9px] font-bold">
                  50% LOCKED
                </span>
              )}
            </div>
            <div className="text-xl font-bold font-mono text-[#1a1a1a] mt-1">
              {formatCurrency(profitLockStop, currencySymbol)}
            </div>
            <p className="text-[10px] text-gray-500 font-sans mt-1">
              Guarantees locking in at least 50% of peak open unrealized profits.
            </p>
          </div>
          <button
            onClick={() => onUpdateStopPrice(profitLockStop)}
            className="mt-3 w-full py-1.5 bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-[10px] uppercase tracking-wider border border-amber-600 transition-all cursor-pointer"
          >
            Apply Profit Lock Stop
          </button>
        </div>
      </div>
    </div>
  );
};

interface InteractiveRRSliderProps {
  stock: MinerviniTradeSetup;
  accountCapital: number;
  positionShareQuantity: number;
  currentStopPrice: number;
  currentTargetPrice: number;
  onUpdateStopPrice: (newStopPrice: number) => void;
  onUpdateTargetPrice: (newTargetPrice: number) => void;
}

export const InteractiveRRSlider: React.FC<InteractiveRRSliderProps> = ({
  stock,
  accountCapital,
  positionShareQuantity,
  currentStopPrice,
  currentTargetPrice,
  onUpdateStopPrice,
  onUpdateTargetPrice,
}) => {
  const currencySymbol = getCurrencySymbol(stock.exchange);
  const pivotEntry = stock.pivotPrice;

  // Initialize stop loss % state based on currentStopPrice
  const initialStopPct = pivotEntry > 0
    ? Number((((pivotEntry - currentStopPrice) / pivotEntry) * 100).toFixed(1))
    : 5.0;

  const [stopLossPct, setStopLossPct] = useState<number>(Math.max(1.0, Math.min(15.0, initialStopPct || 5.0)));

  // Calculate target R:R ratio based on currentTargetPrice
  const riskPerShareInitial = Math.max(0.01, pivotEntry - currentStopPrice);
  const initialRR = pivotEntry > 0 && riskPerShareInitial > 0
    ? Number(((currentTargetPrice - pivotEntry) / riskPerShareInitial).toFixed(1))
    : 3.0;

  const [rrRatio, setRrRatio] = useState<number>(Math.max(1.0, Math.min(10.0, initialRR || 3.0)));

  // Sync when prop changes
  useEffect(() => {
    if (pivotEntry > 0 && currentStopPrice < pivotEntry) {
      const computedPct = (((pivotEntry - currentStopPrice) / pivotEntry) * 100);
      setStopLossPct(Number(computedPct.toFixed(1)));
    }
  }, [currentStopPrice, pivotEntry]);

  // Derived Calculations
  const calcStopPrice = Number((pivotEntry * (1 - stopLossPct / 100)).toFixed(2));
  const riskPerShare = Math.max(0.01, pivotEntry - calcStopPrice);
  const rewardPerShare = Number((riskPerShare * rrRatio).toFixed(2));
  const calcTargetPrice = Number((pivotEntry + rewardPerShare).toFixed(2));
  const upsidePct = Number(((rewardPerShare / pivotEntry) * 100).toFixed(1));

  const totalDollarRisk = Number((riskPerShare * positionShareQuantity).toFixed(2));
  const totalProjectedProfit = Number((rewardPerShare * positionShareQuantity).toFixed(2));

  const riskPctPortfolio = accountCapital > 0 ? (totalDollarRisk / accountCapital) * 100 : 0;
  const profitPctPortfolio = accountCapital > 0 ? (totalProjectedProfit / accountCapital) * 100 : 0;

  // Required win rate to breakeven at this R:R ratio
  const requiredWinRate = Number(((1 / (1 + rrRatio)) * 100).toFixed(1));

  // Multi-tier Scale-out targets
  const tier1RR = 1.5;
  const tier1RewardPerShare = riskPerShare * tier1RR;
  const tier1Price = Number((pivotEntry + tier1RewardPerShare).toFixed(2));
  const tier1UpsidePct = Number(((tier1RewardPerShare / pivotEntry) * 100).toFixed(1));
  const tier1Shares = Math.floor(positionShareQuantity * 0.33);
  const tier1Profit = Number((tier1RewardPerShare * tier1Shares).toFixed(2));

  const tier2RR = 3.0;
  const tier2RewardPerShare = riskPerShare * tier2RR;
  const tier2Price = Number((pivotEntry + tier2RewardPerShare).toFixed(2));
  const tier2UpsidePct = Number(((tier2RewardPerShare / pivotEntry) * 100).toFixed(1));
  const tier2Shares = Math.floor(positionShareQuantity * 0.33);
  const tier2Profit = Number((tier2RewardPerShare * tier2Shares).toFixed(2));

  const tier3Shares = Math.max(0, positionShareQuantity - tier1Shares - tier2Shares);
  const tier3Profit = Number((rewardPerShare * tier3Shares).toFixed(2));

  const totalScaleOutProfit = Number((tier1Profit + tier2Profit + tier3Profit).toFixed(2));

  return (
    <div className="bg-white border border-[#e5e4e1] p-5 space-y-5 font-sans">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e5e4e1] pb-3">
        <div className="flex items-center space-x-2">
          <Sliders className="w-4 h-4 text-emerald-600" />
          <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1a1a1a]">
            🎯 Interactive R:R Ratio & Variable Stop-Loss Profit Calculator
          </h4>
        </div>
        <div className="flex items-center space-x-2 text-[10px] font-mono">
          <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold px-2 py-0.5">
            R:R Target = {rrRatio.toFixed(1)} : 1
          </span>
          <span className="bg-red-100 text-red-900 border border-red-300 font-bold px-2 py-0.5">
            Stop = -{stopLossPct.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Interactive Sliders Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#f9f8f5] p-4 border border-[#e5e4e1]">
        
        {/* Slider 1: Variable Stop-Loss Percentage */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold uppercase tracking-wider text-[#1a1a1a] flex items-center space-x-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
              <span>Variable Stop-Loss Percentage</span>
            </label>
            <span className="font-mono text-sm font-extrabold text-red-600 bg-white border border-red-200 px-2 py-0.5">
              -{stopLossPct.toFixed(1)}% ({formatCurrency(calcStopPrice, currencySymbol)})
            </span>
          </div>

          <input
            type="range"
            min="1.0"
            max="15.0"
            step="0.1"
            value={stopLossPct}
            onChange={(e) => setStopLossPct(Number(e.target.value))}
            className="w-full accent-red-600 cursor-pointer h-2 bg-gray-200 rounded-none"
          />

          <div className="flex justify-between text-[10px] font-mono text-gray-500">
            <span>1.0% (Ultra Tight)</span>
            <span>5.0% - 8.0% (Minervini Ideal)</span>
            <span>15.0% (Wide)</span>
          </div>

          {/* Quick Preset Buttons for Stop-Loss */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[10px] font-bold text-gray-400 font-mono uppercase mr-1">Presets:</span>
            {[3.0, 5.0, 7.0, 8.0, 10.0].map((preset) => (
              <button
                key={preset}
                onClick={() => setStopLossPct(preset)}
                className={`px-2 py-0.5 text-[10px] font-mono font-bold border transition cursor-pointer ${
                  Math.abs(stopLossPct - preset) < 0.1
                    ? 'bg-red-600 text-white border-red-700'
                    : 'bg-white text-gray-700 border-[#e5e4e1] hover:bg-red-50'
                }`}
              >
                -{preset.toFixed(1)}%
              </button>
            ))}
          </div>

          <div className="text-[11px] font-mono text-gray-600 bg-white p-2 border border-[#e5e4e1] flex justify-between">
            <span>Risk / Share: <strong className="text-red-600">{formatCurrency(riskPerShare, currencySymbol)}</strong></span>
            <span>Total Risk ({positionShareQuantity.toLocaleString()} sh): <strong className="text-red-600">{formatCurrency(totalDollarRisk, currencySymbol)}</strong></span>
          </div>
        </div>

        {/* Slider 2: Target Risk-to-Reward Ratio (R:R) */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold uppercase tracking-wider text-[#1a1a1a] flex items-center space-x-1.5">
              <Target className="w-3.5 h-3.5 text-emerald-600" />
              <span>Target Risk-to-Reward Ratio (R:R)</span>
            </label>
            <span className="font-mono text-sm font-extrabold text-emerald-700 bg-white border border-emerald-200 px-2 py-0.5">
              {rrRatio.toFixed(1)} : 1 (+{upsidePct.toFixed(1)}%)
            </span>
          </div>

          <input
            type="range"
            min="1.0"
            max="10.0"
            step="0.1"
            value={rrRatio}
            onChange={(e) => setRrRatio(Number(e.target.value))}
            className="w-full accent-emerald-600 cursor-pointer h-2 bg-gray-200 rounded-none"
          />

          <div className="flex justify-between text-[10px] font-mono text-gray-500">
            <span>1.0:1 (Minimum)</span>
            <span>3.0:1 (SEPA Target)</span>
            <span>5.0:1 (Champion)</span>
            <span>10.0:1 (Super)</span>
          </div>

          {/* Quick Preset Buttons for R:R Ratio */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[10px] font-bold text-gray-400 font-mono uppercase mr-1">R:R Presets:</span>
            {[1.5, 2.0, 3.0, 4.0, 5.0, 8.0].map((preset) => (
              <button
                key={preset}
                onClick={() => setRrRatio(preset)}
                className={`px-2 py-0.5 text-[10px] font-mono font-bold border transition cursor-pointer ${
                  Math.abs(rrRatio - preset) < 0.1
                    ? 'bg-emerald-700 text-white border-emerald-800'
                    : 'bg-white text-gray-700 border-[#e5e4e1] hover:bg-emerald-50'
                }`}
              >
                {preset.toFixed(1)}:1
              </button>
            ))}
          </div>

          <div className="text-[11px] font-mono text-gray-600 bg-white p-2 border border-[#e5e4e1] flex justify-between">
            <span>Target Price: <strong className="text-emerald-700">{formatCurrency(calcTargetPrice, currencySymbol)}</strong></span>
            <span>Reward / Share: <strong className="text-emerald-700">+{formatCurrency(rewardPerShare, currencySymbol)}</strong></span>
          </div>
        </div>

      </div>

      {/* Projected Profit & Portfolio Impact Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
        {/* Box 1: Projected Total Gross Profit */}
        <div className="bg-emerald-50/70 border border-emerald-300 p-3 space-y-1">
          <span className="text-[10px] text-emerald-800 uppercase font-bold block">
            Projected Total Gross Profit
          </span>
          <div className="text-2xl font-black text-emerald-800">
            +{formatCurrency(totalProjectedProfit, currencySymbol)}
          </div>
          <p className="text-[10px] text-emerald-700 font-sans">
            +{upsidePct.toFixed(1)}% stock gain across {positionShareQuantity.toLocaleString()} shares.
          </p>
        </div>

        {/* Box 2: Portfolio Return Impact */}
        <div className="bg-purple-50/70 border border-purple-300 p-3 space-y-1">
          <span className="text-[10px] text-purple-900 uppercase font-bold block">
            Portfolio Account Return
          </span>
          <div className="text-2xl font-black text-purple-900">
            +{profitPctPortfolio.toFixed(2)}%
          </div>
          <p className="text-[10px] text-purple-800 font-sans">
            Gain on {formatCurrency(accountCapital, currencySymbol)} account capital.
          </p>
        </div>

        {/* Box 3: Max Downside Risk */}
        <div className="bg-red-50/70 border border-red-300 p-3 space-y-1">
          <span className="text-[10px] text-red-800 uppercase font-bold block">
            Defined Max Downside Risk
          </span>
          <div className="text-2xl font-black text-red-700">
            -{formatCurrency(totalDollarRisk, currencySymbol)}
          </div>
          <p className="text-[10px] text-red-800 font-sans">
            -{riskPctPortfolio.toFixed(2)}% portfolio risk cap at -{stopLossPct.toFixed(1)}% stop.
          </p>
        </div>

        {/* Box 4: Required Win Rate */}
        <div className="bg-[#1a1a1a] text-white p-3 space-y-1 border border-black">
          <span className="text-[10px] text-amber-400 uppercase font-bold block">
            Required Win Rate to Breakeven
          </span>
          <div className="text-2xl font-black font-mono text-amber-400">
            {requiredWinRate.toFixed(1)}%
          </div>
          <p className="text-[10px] text-gray-300 font-sans">
            At {rrRatio.toFixed(1)}:1 R:R, you only need to be right {requiredWinRate.toFixed(1)}% of the time!
          </p>
        </div>
      </div>

      {/* Multi-Tier Scale-Out Profit Matrix */}
      <div className="bg-[#f9f8f5] border border-[#e5e4e1] p-4 space-y-3 font-mono text-xs">
        <div className="flex items-center justify-between border-b border-[#e5e4e1] pb-2">
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-4 h-4 text-[#1a1a1a]" />
            <span className="font-bold text-[#1a1a1a] uppercase tracking-wider text-[11px]">
              Multi-Tier Scale-Out Projected Profit Matrix (SEPA Staged Partial Lock)
            </span>
          </div>
          <span className="text-[10px] font-bold text-emerald-800">
            Blended Scale-Out Profit: +{formatCurrency(totalScaleOutProfit, currencySymbol)}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Tier 1: 1.5R Initial Partial Lock */}
          <div className="bg-white border border-[#e5e4e1] p-3 space-y-1">
            <div className="flex justify-between text-[10px] font-bold text-blue-800 uppercase">
              <span>Tier 1: 1.5R Lock (33% Pos)</span>
              <span>{tier1Shares.toLocaleString()} Sh</span>
            </div>
            <div className="text-lg font-bold text-[#1a1a1a]">
              {formatCurrency(tier1Price, currencySymbol)} <span className="text-xs font-normal text-emerald-700">(+{tier1UpsidePct}%)</span>
            </div>
            <div className="text-xs font-bold text-emerald-700">
              +{formatCurrency(tier1Profit, currencySymbol)} Profit
            </div>
          </div>

          {/* Tier 2: 3.0R Core Position Lock */}
          <div className="bg-white border border-[#e5e4e1] p-3 space-y-1">
            <div className="flex justify-between text-[10px] font-bold text-purple-800 uppercase">
              <span>Tier 2: 3.0R Lock (33% Pos)</span>
              <span>{tier2Shares.toLocaleString()} Sh</span>
            </div>
            <div className="text-lg font-bold text-[#1a1a1a]">
              {formatCurrency(tier2Price, currencySymbol)} <span className="text-xs font-normal text-emerald-700">(+{tier2UpsidePct}%)</span>
            </div>
            <div className="text-xs font-bold text-emerald-700">
              +{formatCurrency(tier2Profit, currencySymbol)} Profit
            </div>
          </div>

          {/* Tier 3: Full Custom R:R Runner */}
          <div className="bg-white border border-[#e5e4e1] p-3 space-y-1">
            <div className="flex justify-between text-[10px] font-bold text-emerald-800 uppercase">
              <span>Tier 3: {rrRatio.toFixed(1)}R Runner (34% Pos)</span>
              <span>{tier3Shares.toLocaleString()} Sh</span>
            </div>
            <div className="text-lg font-bold text-[#1a1a1a]">
              {formatCurrency(calcTargetPrice, currencySymbol)} <span className="text-xs font-normal text-emerald-700">(+{upsidePct}%)</span>
            </div>
            <div className="text-xs font-bold text-emerald-700">
              +{formatCurrency(tier3Profit, currencySymbol)} Profit
            </div>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#e5e4e1]">
        <div className="text-xs font-mono text-gray-500">
          Selected Parameters: <strong className="text-[#1a1a1a]">Stop @ {formatCurrency(calcStopPrice, currencySymbol)} (-{stopLossPct}%)</strong> | <strong className="text-[#1a1a1a]">Target @ {formatCurrency(calcTargetPrice, currencySymbol)} (+{upsidePct}%)</strong>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => onUpdateStopPrice(calcStopPrice)}
            className="px-3 py-1.5 bg-red-700 hover:bg-red-800 text-white font-bold text-xs uppercase tracking-wider border border-red-800 transition cursor-pointer"
          >
            Apply Stop Loss ({formatCurrency(calcStopPrice, currencySymbol)})
          </button>
          <button
            onClick={() => onUpdateTargetPrice(calcTargetPrice)}
            className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs uppercase tracking-wider border border-emerald-900 transition cursor-pointer"
          >
            Apply Target Price ({formatCurrency(calcTargetPrice, currencySymbol)})
          </button>
        </div>
      </div>
    </div>
  );
};

interface RiskRewardRatioVisualizerProps {
  entryPrice: number;
  stopLossPrice: number;
  targetPrice: number;
  currencySymbol?: string;
  onUpdateEntryPrice?: (entry: number) => void;
  onUpdateStopLossPrice?: (stop: number) => void;
  onUpdateTargetPrice?: (target: number) => void;
}

export const RiskRewardRatioVisualizer: React.FC<RiskRewardRatioVisualizerProps> = ({
  entryPrice,
  stopLossPrice,
  targetPrice,
  currencySymbol = '$',
  onUpdateEntryPrice,
  onUpdateStopLossPrice,
  onUpdateTargetPrice,
}) => {
  const validEntry = entryPrice > 0 ? entryPrice : 100;
  const validStop = stopLossPrice > 0 && stopLossPrice < validEntry ? stopLossPrice : validEntry * 0.93;
  const validTarget = targetPrice > validEntry ? targetPrice : validEntry * 1.21;

  const riskPerShare = Math.max(0.01, validEntry - validStop);
  const rewardPerShare = Math.max(0, validTarget - validEntry);

  const riskPercent = (riskPerShare / validEntry) * 100;
  const rewardPercent = (rewardPerShare / validEntry) * 100;

  const rrr = riskPerShare > 0 ? rewardPerShare / riskPerShare : 0;
  const breakevenWinRate = (1 / (1 + rrr)) * 100;

  // Proportional bar width calculations
  const totalRangePct = riskPercent + rewardPercent;
  const riskBarWidthPct = totalRangePct > 0 ? (riskPercent / totalRangePct) * 100 : 25;
  const rewardBarWidthPct = totalRangePct > 0 ? (rewardPercent / totalRangePct) * 100 : 75;

  let rrrGradeBadge = 'bg-emerald-600 text-white border-emerald-700';
  let rrrGradeLabel = '⭐ Minervini Standard (≥ 3.0:1 R/R)';
  if (rrr >= 5.0) {
    rrrGradeBadge = 'bg-purple-900 text-purple-100 border-purple-700 animate-pulse';
    rrrGradeLabel = '🚀 Champion Grade (≥ 5.0:1 R/R)';
  } else if (rrr >= 3.0) {
    rrrGradeBadge = 'bg-emerald-600 text-white border-emerald-700';
    rrrGradeLabel = '⭐ Minervini Standard (≥ 3.0:1 R/R)';
  } else if (rrr >= 2.0) {
    rrrGradeBadge = 'bg-amber-100 text-amber-900 border-amber-300';
    rrrGradeLabel = '🟡 Acceptable Minimum (≥ 2.0:1 R/R)';
  } else {
    rrrGradeBadge = 'bg-red-600 text-white border-red-800';
    rrrGradeLabel = '🔴 Subpar Risk-Reward (< 2.0:1 R/R)';
  }

  const handleApplyPresetTargetRRR = (targetRrr: number) => {
    if (onUpdateTargetPrice) {
      const newTarget = validEntry + (riskPerShare * targetRrr);
      onUpdateTargetPrice(parseFloat(newTarget.toFixed(2)));
    }
  };

  const handleApplyPresetStopLoss = (stopPct: number) => {
    if (onUpdateStopLossPrice) {
      const newStop = validEntry * (1 - stopPct / 100);
      onUpdateStopLossPrice(parseFloat(newStop.toFixed(2)));
    }
  };

  return (
    <div className="bg-white border border-[#e5e4e1] p-4 space-y-4 font-mono shadow-2xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-900">
                Dynamic Risk-to-Reward Ratio (RRR) Visualizer
              </span>
              <span className="px-1.5 py-0.5 text-[9px] font-extrabold uppercase bg-emerald-100 text-emerald-900 border border-emerald-300">
                Reward / Risk Engine
              </span>
            </div>
            <p className="text-[10px] text-gray-500 font-sans">
              Dynamic visual comparison of risk per share vs target gain per share based on entry, stop loss, and target exit.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className={`px-2.5 py-1 text-[10px] uppercase font-black border ${rrrGradeBadge}`}>
            {rrrGradeLabel}
          </span>
          <span className="px-2.5 py-1 text-[11px] uppercase font-black bg-slate-900 text-emerald-400 border border-black">
            1 : {rrr.toFixed(2)} R/R
          </span>
        </div>
      </div>

      {/* Proportional Risk vs Reward Bar Visualizer */}
      <div className="space-y-2 bg-[#f9f8f5] p-3 border border-[#e5e4e1]">
        <div className="flex justify-between items-center text-[10px] uppercase font-bold text-gray-600">
          <span className="text-red-700 flex items-center space-x-1">
            <ShieldAlert className="w-3 h-3 text-red-600" />
            <span>Downside Risk (-{riskPercent.toFixed(1)}%)</span>
          </span>
          <span className="text-slate-900 font-bold">
            Pivot Entry ({formatCurrency(validEntry, currencySymbol)})
          </span>
          <span className="text-emerald-700 flex items-center space-x-1">
            <Target className="w-3 h-3 text-emerald-600" />
            <span>Target Reward (+{rewardPercent.toFixed(1)}%)</span>
          </span>
        </div>

        {/* Visual Dual Bar */}
        <div className="w-full h-8 bg-gray-200 flex border border-gray-400 overflow-hidden p-0.5 space-x-0.5">
          {/* Risk Zone Bar */}
          <motion.div
            layout
            initial={{ width: '0%' }}
            animate={{ width: `${Math.max(8, Math.min(92, riskBarWidthPct))}%` }}
            transition={{ duration: 0.3 }}
            className="h-full bg-red-600 text-white font-bold text-[9px] flex items-center justify-between px-2 overflow-hidden shadow-2xs"
          >
            <span className="truncate">Stop: {formatCurrency(validStop, currencySymbol)}</span>
            <span className="bg-black/30 px-1 py-0.2 rounded text-[8px] font-black shrink-0">
              -{formatCurrency(riskPerShare, currencySymbol)}
            </span>
          </motion.div>

          {/* Center Divider Marker */}
          <div className="w-1.5 h-full bg-slate-900 shrink-0 shadow-md" title="Pivot Entry Point" />

          {/* Reward Zone Bar */}
          <motion.div
            layout
            initial={{ width: '0%' }}
            animate={{ width: `${Math.max(8, Math.min(92, rewardBarWidthPct))}%` }}
            transition={{ duration: 0.3 }}
            className="h-full bg-emerald-600 text-white font-bold text-[9px] flex items-center justify-between px-2 overflow-hidden shadow-2xs"
          >
            <span className="bg-black/30 px-1 py-0.2 rounded text-[8px] font-black shrink-0">
              +{formatCurrency(rewardPerShare, currencySymbol)}
            </span>
            <span className="truncate">Target: {formatCurrency(validTarget, currencySymbol)}</span>
          </motion.div>
        </div>

        <div className="flex justify-between text-[9px] font-mono text-gray-500 pt-0.5">
          <span>Stop Loss: <strong>{formatCurrency(validStop, currencySymbol)}</strong> (-{riskPercent.toFixed(1)}%)</span>
          <span className="text-center font-bold text-slate-800">Ratio: 1 : {rrr.toFixed(2)} R/R</span>
          <span>Target Exit: <strong>{formatCurrency(validTarget, currencySymbol)}</strong> (+{rewardPercent.toFixed(1)}%)</span>
        </div>
      </div>

      {/* Quick Adjustment Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        {/* Stop Loss Presets */}
        <div className="bg-slate-50 p-2.5 border border-slate-200 space-y-1.5">
          <div className="flex justify-between items-center text-[10px] text-slate-700 font-bold uppercase">
            <span>Stop Loss Presets:</span>
            <span className="text-red-700 font-extrabold">-{riskPercent.toFixed(1)}%</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {[3, 5, 7, 8, 10].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => handleApplyPresetStopLoss(pct)}
                className={`px-2 py-0.5 text-[9px] font-bold border transition-all cursor-pointer ${
                  Math.abs(riskPercent - pct) < 0.5
                    ? 'bg-red-600 text-white border-red-700'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-red-50'
                }`}
              >
                -{pct}%
              </button>
            ))}
          </div>
        </div>

        {/* Target RRR Presets */}
        <div className="bg-emerald-50/50 p-2.5 border border-emerald-200 space-y-1.5">
          <div className="flex justify-between items-center text-[10px] text-emerald-900 font-bold uppercase">
            <span>Target RRR Presets:</span>
            <span className="text-emerald-700 font-extrabold">1 : {rrr.toFixed(1)}</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {[2.0, 3.0, 4.0, 5.0, 6.0].map((presetRrr) => (
              <button
                key={presetRrr}
                type="button"
                onClick={() => handleApplyPresetTargetRRR(presetRrr)}
                className={`px-2 py-0.5 text-[9px] font-bold border transition-all cursor-pointer ${
                  Math.abs(rrr - presetRrr) < 0.2
                    ? 'bg-emerald-700 text-white border-emerald-800'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-emerald-50'
                }`}
              >
                1:{presetRrr.toFixed(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Required Win Rate Stats */}
        <div className="bg-slate-900 text-white p-2.5 border border-slate-800 space-y-1">
          <span className="text-[9px] uppercase font-bold text-gray-400 block">
            Breakeven Win Rate Required
          </span>
          <div className="text-xl font-black text-amber-300">
            {breakevenWinRate.toFixed(1)}%
          </div>
          <p className="text-[9px] text-gray-400">
            At 1:{rrr.toFixed(1)} R/R, winning &gt;{breakevenWinRate.toFixed(1)}% of trades guarantees net profit.
          </p>
        </div>
      </div>
    </div>
  );
};

interface VcpContractionProgressBarProps {
  stock: MinerviniTradeSetup;
  currencySymbol?: string;
}

export const VcpContractionProgressBar: React.FC<VcpContractionProgressBarProps> = ({
  stock,
  currencySymbol = '$',
}) => {
  const contractionsList = stock.contractions && stock.contractions.length > 0
    ? stock.contractions
    : [
        { contractionIndex: 1, depthPercent: 18.0, durationDays: 14, volumeDryUpPercent: -35, startDate: '', endDate: '', highPrice: stock.pivotPrice, lowPrice: stock.pivotPrice * 0.82 },
        { contractionIndex: 2, depthPercent: 8.5, durationDays: 7, volumeDryUpPercent: -55, startDate: '', endDate: '', highPrice: stock.pivotPrice, lowPrice: stock.pivotPrice * 0.915 },
        { contractionIndex: 3, depthPercent: 3.2, durationDays: 4, volumeDryUpPercent: -72, startDate: '', endDate: '', highPrice: stock.pivotPrice, lowPrice: stock.pivotPrice * 0.968 },
      ];

  const totalDryUp = stock.volumeDryUpPercent || (contractionsList[contractionsList.length - 1]?.volumeDryUpPercent || -65);
  const isExtremeDryUp = Math.abs(totalDryUp) >= 60;

  return (
    <div className="bg-white border border-[#e5e4e1] p-4 space-y-4 font-mono shadow-2xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-cyan-50 text-cyan-700 border border-cyan-200">
            <Droplets className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-900">
                VCP Contraction Phase & Volume Dry-Up Progress Bar
              </span>
              <span className="px-1.5 py-0.5 text-[9px] font-extrabold uppercase bg-cyan-100 text-cyan-900 border border-cyan-300">
                {stock.patternType || 'VCP Pattern'}
              </span>
            </div>
            <p className="text-[10px] text-gray-500 font-sans">
              Visualizing price depth tightening and progressive volume dry-up across contraction phases.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className={`px-2.5 py-1 text-[10px] uppercase font-black border ${
            isExtremeDryUp
              ? 'bg-cyan-950 text-cyan-300 border-cyan-700 animate-pulse'
              : 'bg-blue-50 text-blue-900 border-blue-200'
          }`}>
            💧 {Math.abs(totalDryUp).toFixed(1)}% Volume Dry-Up
          </span>
          <span className="px-2 py-1 text-[10px] uppercase font-bold bg-slate-900 text-white border border-black">
            Stage: {stock.vcpStage || 'Breakout Pending'}
          </span>
        </div>
      </div>

      <div className="space-y-2 bg-[#f9f8f5] p-3 border border-[#e5e4e1]">
        <div className="flex justify-between items-center text-[10px] uppercase font-bold text-gray-600">
          <span>Contraction Phases Progression</span>
          <span className="text-cyan-800 font-mono">
            {contractionsList.length} Contractions ({contractionsList.map(c => `T${c.contractionIndex}`).join(' → ')} → Pivot)
          </span>
        </div>

        <div className="w-full bg-gray-200 h-7 flex overflow-hidden border border-gray-400 p-0.5 space-x-0.5 rounded-2xs">
          {contractionsList.map((c, idx) => {
            const dryUpPct = Math.min(100, Math.max(10, Math.abs(c.volumeDryUpPercent)));
            let barColor = 'bg-blue-500';
            if (dryUpPct >= 70) barColor = 'bg-cyan-600';
            else if (dryUpPct >= 50) barColor = 'bg-teal-500';
            else if (dryUpPct >= 30) barColor = 'bg-sky-500';

            return (
              <motion.div
                key={c.contractionIndex || idx}
                layout
                initial={{ width: '0%' }}
                animate={{ width: `${100 / (contractionsList.length + 1)}%` }}
                transition={{ duration: 0.4, delay: idx * 0.1 }}
                className="h-full relative group cursor-pointer"
              >
                <div className={`w-full h-full ${barColor} flex items-center justify-between px-1.5 text-[9px] text-white font-black overflow-hidden shadow-2xs`}>
                  <span className="truncate">Phase {c.contractionIndex}: {dryUpPct}% dry</span>
                  <span className="text-[8px] bg-black/30 px-1 py-0.2 rounded shrink-0">-{c.depthPercent}% depth</span>
                </div>
              </motion.div>
            );
          })}

          <motion.div
            layout
            initial={{ width: '0%' }}
            animate={{ width: `${100 / (contractionsList.length + 1)}%` }}
            transition={{ duration: 0.4, delay: contractionsList.length * 0.1 }}
            className="h-full relative group cursor-pointer"
          >
            <div className={`w-full h-full ${stock.vcpStage === 'Active Breakout' ? 'bg-emerald-600' : 'bg-amber-500'} flex items-center justify-between px-1.5 text-[9px] text-white font-black overflow-hidden animate-pulse`}>
              <span className="truncate">Pivot Buy ({formatCurrency(stock.pivotPrice, currencySymbol)})</span>
              <span className="text-[8px] bg-black/40 px-1 py-0.2 rounded shrink-0">🎯 BREAKOUT</span>
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-[9px] font-mono text-gray-500 pt-0.5">
          {contractionsList.map((c) => (
            <div key={c.contractionIndex} className="text-left border-l-2 border-cyan-600 pl-1.5">
              <span className="font-bold text-slate-800 block">Phase {c.contractionIndex} (T{c.contractionIndex}):</span>
              <span className="text-cyan-800 font-extrabold">{Math.abs(c.volumeDryUpPercent)}% volume dry-up</span>
              <span className="text-gray-400 block">{c.depthPercent}% depth ({c.durationDays}d)</span>
            </div>
          ))}
          <div className="text-left border-l-2 border-amber-500 pl-1.5">
            <span className="font-bold text-slate-800 block">Pivot Buy Zone:</span>
            <span className="text-amber-700 font-extrabold">Volume Expansion</span>
            <span className="text-gray-400 block">{formatCurrency(stock.pivotPrice, currencySymbol)} Pivot</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
        {contractionsList.map((c) => {
          const dryUpVal = Math.abs(c.volumeDryUpPercent);
          return (
            <div
              key={c.contractionIndex}
              className="bg-white p-2.5 border border-[#e5e4e1] space-y-1.5 relative overflow-hidden group hover:border-cyan-400 transition-all"
            >
              <div className="flex items-center justify-between text-[10px] font-bold">
                <span className="text-slate-900 uppercase">
                  Contraction Phase T{c.contractionIndex}
                </span>
                <span className="bg-cyan-50 text-cyan-900 border border-cyan-200 px-1.5 py-0.2 text-[9px] font-mono font-black">
                  -{c.depthPercent}% Depth
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[9px] text-gray-500">
                  <span>Volume Dry-Up:</span>
                  <strong className="text-cyan-800 font-extrabold">{dryUpVal}% below avg</strong>
                </div>
                <div className="w-full bg-gray-100 h-2 border border-gray-200 overflow-hidden">
                  <motion.div
                    initial={{ width: '0%' }}
                    animate={{ width: `${Math.min(100, dryUpVal)}%` }}
                    transition={{ duration: 0.5 }}
                    className="h-full bg-cyan-600"
                  />
                </div>
              </div>

              <div className="flex justify-between text-[9px] text-gray-500 border-t border-gray-100 pt-1">
                <span>Duration: <strong>{c.durationDays} Days</strong></span>
                <span>Vol: <strong className="text-slate-800">{c.volumeDryUpPercent < 0 ? `${c.volumeDryUpPercent}%` : `-${c.volumeDryUpPercent}%`}</strong></span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-slate-900 text-white p-3 border border-slate-800 text-[10px] font-sans flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <Zap className="w-4 h-4 text-amber-300 shrink-0" />
          <div>
            <span className="font-mono font-bold text-amber-300 uppercase block">Minervini SEPA VCP Rule:</span>
            <span className="text-gray-300">
              Each progressive contraction should tighten in depth (e.g., 20% → 10% → 3%) while volume dries up dramatically to confirm supply absorption before pivot entry.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

interface TradeExpectancyModuleProps {
  stock: MinerviniTradeSetup;
  currencySymbol?: string;
  entryPrice: number;
  stopLossPrice: number;
  targetPrice: number;
}

export const TradeExpectancyModule: React.FC<TradeExpectancyModuleProps> = ({
  stock,
  currencySymbol = '$',
  entryPrice,
  stopLossPrice,
  targetPrice,
}) => {
  const setupGainPct = Math.max(0.1, ((targetPrice - entryPrice) / entryPrice) * 100);
  const setupLossPct = Math.max(0.1, ((entryPrice - stopLossPrice) / entryPrice) * 100);

  const [winRate, setWinRate] = useState<number>(50);
  const [avgWinPercent, setAvgWinPercent] = useState<number>(parseFloat(setupGainPct.toFixed(1)));
  const [avgLossPercent, setAvgLossPercent] = useState<number>(parseFloat(setupLossPct.toFixed(1)));
  const [riskPerTradeDollars, setRiskPerTradeDollars] = useState<number>(1000);

  useEffect(() => {
    const freshGain = Math.max(0.1, ((targetPrice - entryPrice) / entryPrice) * 100);
    const freshLoss = Math.max(0.1, ((entryPrice - stopLossPrice) / entryPrice) * 100);
    setAvgWinPercent(parseFloat(freshGain.toFixed(1)));
    setAvgLossPercent(parseFloat(freshLoss.toFixed(1)));
  }, [entryPrice, stopLossPrice, targetPrice]);

  const lossRate = Math.max(0, 100 - winRate);
  const payoffRatio = avgWinPercent / Math.max(0.1, avgLossPercent);
  
  const expectancyPercent = ((winRate / 100) * avgWinPercent) - ((lossRate / 100) * avgLossPercent);
  const expectancyInR = ((winRate / 100) * payoffRatio) - ((lossRate / 100) * 1.0);
  const expectancy100R = expectancyInR * 100;
  const expectedProfit100TradesDollars = expectancy100R * riskPerTradeDollars;

  const handleApplyPreset = (w: number, winG: number, lossL: number) => {
    setWinRate(w);
    setAvgWinPercent(winG);
    setAvgLossPercent(lossL);
  };

  const handleResetToSetup = () => {
    const freshGain = Math.max(0.1, ((targetPrice - entryPrice) / entryPrice) * 100);
    const freshLoss = Math.max(0.1, ((entryPrice - stopLossPrice) / entryPrice) * 100);
    setWinRate(50);
    setAvgWinPercent(parseFloat(freshGain.toFixed(1)));
    setAvgLossPercent(parseFloat(freshLoss.toFixed(1)));
  };

  let edgeBadgeStyle = 'bg-emerald-600 text-white border-emerald-700';
  let edgeBadgeLabel = '⭐ Elite SEPA Edge';
  if (expectancyInR >= 0.6) {
    edgeBadgeStyle = 'bg-purple-900 text-purple-200 border-purple-700 animate-pulse';
    edgeBadgeLabel = '⭐ Superperformance Edge (>0.60 R)';
  } else if (expectancyInR >= 0.25) {
    edgeBadgeStyle = 'bg-emerald-600 text-white border-emerald-700';
    edgeBadgeLabel = '✅ Solid Positive Edge (>0.25 R)';
  } else if (expectancyInR > 0) {
    edgeBadgeStyle = 'bg-amber-100 text-amber-900 border-amber-300';
    edgeBadgeLabel = '🟡 Marginal Edge (>0.00 R)';
  } else {
    edgeBadgeStyle = 'bg-red-600 text-white border-red-800 animate-bounce';
    edgeBadgeLabel = '🔴 Negative Expectancy (Losing System)';
  }

  return (
    <div className="bg-white border border-[#e5e4e1] p-4 space-y-4 font-mono shadow-2xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-amber-50 text-amber-700 border border-amber-200">
            <Calculator className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-900">
                Mathematical Expectancy & Strategy Edge Engine
              </span>
              <span className="px-1.5 py-0.5 text-[9px] font-extrabold uppercase bg-amber-100 text-amber-900 border border-amber-300">
                SEPA Probability
              </span>
            </div>
            <p className="text-[10px] text-gray-500 font-sans">
              Calculates long-term edge based on Win Rate %, Average Gain %, Average Loss %, and R-Multiple.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className={`px-2.5 py-1 text-[10px] uppercase font-black border ${edgeBadgeStyle}`}>
            {edgeBadgeLabel}
          </span>
          <button
            type="button"
            onClick={handleResetToSetup}
            className="px-2 py-1 text-[9px] uppercase font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 flex items-center space-x-1 cursor-pointer transition-all"
            title="Reset inputs to current trade plan setup parameters"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Reset Setup</span>
          </button>
        </div>
      </div>

      {/* Preset Strategy Scenarios */}
      <div className="flex flex-wrap items-center gap-2 text-[10px] bg-[#f9f8f5] p-2 border border-[#e5e4e1]">
        <span className="font-bold text-gray-600 uppercase text-[9px]">Quick Scenarios:</span>
        <button
          type="button"
          onClick={() => handleResetToSetup()}
          className="px-2 py-0.5 bg-white hover:bg-amber-50 text-slate-900 border border-gray-300 font-semibold text-[9px] cursor-pointer"
        >
          🎯 Active Setup ({setupGainPct.toFixed(1)}% / -{setupLossPct.toFixed(1)}%)
        </button>
        <button
          type="button"
          onClick={() => handleApplyPreset(50, 18, 6)}
          className="px-2 py-0.5 bg-white hover:bg-emerald-50 text-slate-900 border border-gray-300 font-semibold text-[9px] cursor-pointer"
        >
          📈 SEPA Pro (50% Win, 18% Gain, 6% Loss)
        </button>
        <button
          type="button"
          onClick={() => handleApplyPreset(40, 20, 5)}
          className="px-2 py-0.5 bg-white hover:bg-blue-50 text-slate-900 border border-gray-300 font-semibold text-[9px] cursor-pointer"
        >
          🛡️ Low-Win High-Payoff (40% Win, 20% Gain, 5% Loss)
        </button>
        <button
          type="button"
          onClick={() => handleApplyPreset(60, 12, 5)}
          className="px-2 py-0.5 bg-white hover:bg-purple-50 text-slate-900 border border-gray-300 font-semibold text-[9px] cursor-pointer"
        >
          ⚡ High Win Rate (60% Win, 12% Gain, 5% Loss)
        </button>
      </div>

      {/* Inputs Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        {/* Win Rate Input */}
        <div className="space-y-1 bg-slate-50 p-2.5 border border-slate-200">
          <div className="flex justify-between items-center text-[10px] text-slate-700 font-bold uppercase">
            <span>Win Rate %:</span>
            <span className="text-emerald-700 font-black">{winRate}%</span>
          </div>
          <input
            type="range"
            min={10}
            max={90}
            step={1}
            value={winRate}
            onChange={(e) => setWinRate(Number(e.target.value))}
            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
          />
          <div className="flex justify-between text-[9px] text-gray-500 pt-0.5">
            <span>Win: <strong>{winRate}%</strong></span>
            <span>Loss Rate: <strong>{lossRate}%</strong></span>
          </div>
        </div>

        {/* Avg Win Gain % Input */}
        <div className="space-y-1 bg-emerald-50/50 p-2.5 border border-emerald-200">
          <div className="flex justify-between items-center text-[10px] text-emerald-900 font-bold uppercase">
            <span>Avg Gain % (Wins):</span>
            <span className="text-emerald-700 font-black">+{avgWinPercent.toFixed(1)}%</span>
          </div>
          <input
            type="number"
            step="0.5"
            min="0.5"
            max="200"
            value={avgWinPercent}
            onChange={(e) => setAvgWinPercent(Math.max(0.1, parseFloat(e.target.value) || 0))}
            className="w-full bg-white border border-emerald-300 text-xs font-mono font-bold px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <div className="text-[9px] text-emerald-700">
            Target Payoff: <strong>+{avgWinPercent.toFixed(1)}% gain</strong>
          </div>
        </div>

        {/* Avg Loss % Input */}
        <div className="space-y-1 bg-red-50/50 p-2.5 border border-red-200">
          <div className="flex justify-between items-center text-[10px] text-red-900 font-bold uppercase">
            <span>Avg Loss % (Losses):</span>
            <span className="text-red-700 font-black">-{avgLossPercent.toFixed(1)}%</span>
          </div>
          <input
            type="number"
            step="0.5"
            min="0.1"
            max="100"
            value={avgLossPercent}
            onChange={(e) => setAvgLossPercent(Math.max(0.1, parseFloat(e.target.value) || 0))}
            className="w-full bg-white border border-red-300 text-xs font-mono font-bold px-2 py-1 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
          <div className="text-[9px] text-red-700">
            Stop Loss Discipline: <strong>-{avgLossPercent.toFixed(1)}% loss</strong>
          </div>
        </div>

        {/* Risk Per Trade Dollar Input */}
        <div className="space-y-1 bg-slate-900 text-white p-2.5 border border-slate-800">
          <div className="flex justify-between items-center text-[10px] text-gray-300 font-bold uppercase">
            <span>Risk Capital per Trade:</span>
            <span className="text-amber-300 font-black">1R Risk</span>
          </div>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-2 flex items-center text-gray-400 font-mono text-xs">
              {currencySymbol}
            </span>
            <input
              type="number"
              step="100"
              min="100"
              value={riskPerTradeDollars}
              onChange={(e) => setRiskPerTradeDollars(Math.max(10, parseFloat(e.target.value) || 0))}
              className="w-full bg-slate-800 border border-slate-700 text-white font-mono font-bold pl-6 pr-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
          </div>
          <div className="text-[9px] text-gray-400">
            1R Risk Unit = {formatCurrency(riskPerTradeDollars, currencySymbol, 0)}
          </div>
        </div>
      </div>

      {/* Expectancy Output Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        {/* Expectancy in R */}
        <motion.div
          layout
          key={`exp-r-${expectancyInR.toFixed(2)}`}
          initial={{ opacity: 0.8, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          className="bg-slate-900 p-3 border border-slate-800 space-y-1"
        >
          <span className="text-[9px] uppercase font-bold text-gray-400 block">
            Expectancy per Trade (in R)
          </span>
          <div className={`text-2xl font-black ${expectancyInR >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {expectancyInR >= 0 ? `+${expectancyInR.toFixed(2)} R` : `${expectancyInR.toFixed(2)} R`}
          </div>
          <div className="text-[10px] text-gray-400 border-t border-slate-800 pt-1">
            Generates <strong>{expectancyInR >= 0 ? `+${expectancyInR.toFixed(2)}` : expectancyInR.toFixed(2)}</strong> units of risk for every 1R risked.
          </div>
        </motion.div>

        {/* Expectancy in % */}
        <motion.div
          layout
          key={`exp-pct-${expectancyPercent.toFixed(2)}`}
          initial={{ opacity: 0.8, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          className="bg-slate-900 p-3 border border-slate-800 space-y-1"
        >
          <span className="text-[9px] uppercase font-bold text-gray-400 block">
            Net Expectancy per Trade (%)
          </span>
          <div className={`text-2xl font-black ${expectancyPercent >= 0 ? 'text-amber-300' : 'text-red-400'}`}>
            {expectancyPercent >= 0 ? `+${expectancyPercent.toFixed(2)}%` : `${expectancyPercent.toFixed(2)}%`}
          </div>
          <div className="text-[10px] text-gray-400 border-t border-slate-800 pt-1">
            Average net yield per trade position taking win/loss distribution into account.
          </div>
        </motion.div>

        {/* Win/Loss Ratio (Gain-to-Loss Payoff) */}
        <motion.div
          layout
          key={`payoff-${payoffRatio.toFixed(2)}`}
          initial={{ opacity: 0.8, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          className="bg-slate-900 p-3 border border-slate-800 space-y-1"
        >
          <span className="text-[9px] uppercase font-bold text-gray-400 block">
            Gain / Loss Payoff Ratio
          </span>
          <div className="text-2xl font-black text-sky-300">
            {payoffRatio.toFixed(2)} : 1
          </div>
          <div className="text-[10px] text-gray-400 border-t border-slate-800 pt-1">
            Avg Win ({avgWinPercent.toFixed(1)}%) vs Avg Loss ({avgLossPercent.toFixed(1)}%).
          </div>
        </motion.div>

        {/* Projected 100 Trades Return */}
        <motion.div
          layout
          key={`trades100-${expectedProfit100TradesDollars.toFixed(0)}`}
          initial={{ opacity: 0.8, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          className="bg-slate-900 p-3 border border-slate-800 space-y-1"
        >
          <span className="text-[9px] uppercase font-bold text-gray-400 block">
            Projected Return (100 Trades)
          </span>
          <div className={`text-2xl font-black ${expectedProfit100TradesDollars >= 0 ? 'text-emerald-300' : 'text-red-400'}`}>
            {expectedProfit100TradesDollars >= 0
              ? `+${formatCurrency(expectedProfit100TradesDollars, currencySymbol, 0)}`
              : formatCurrency(expectedProfit100TradesDollars, currencySymbol, 0)}
          </div>
          <div className="text-[10px] text-gray-400 border-t border-slate-800 pt-1">
            Net <strong>{expectancy100R >= 0 ? `+${expectancy100R.toFixed(1)}` : expectancy100R.toFixed(1)} R</strong> accrued over 100 sequential trades.
          </div>
        </motion.div>
      </div>

      {/* Visual Proportion Bar */}
      <div className="space-y-1.5 bg-[#f9f8f5] p-3 border border-[#e5e4e1]">
        <div className="flex justify-between items-center text-[10px] font-bold text-gray-700">
          <span>Expected Outcome Distribution (per 100 trades):</span>
          <span>
            {winRate} Winning Trades @ +{avgWinPercent}% | {lossRate} Losing Trades @ -{avgLossPercent}%
          </span>
        </div>
        <div className="w-full bg-gray-200 h-4 flex overflow-hidden border border-gray-300">
          <motion.div
            initial={{ width: '0%' }}
            animate={{ width: `${winRate}%` }}
            transition={{ duration: 0.4 }}
            className="h-full bg-emerald-600 text-[9px] text-white font-bold flex items-center justify-center overflow-hidden"
          >
            {winRate >= 15 ? `Wins (${winRate}%)` : ''}
          </motion.div>
          <motion.div
            initial={{ width: '0%' }}
            animate={{ width: `${lossRate}%` }}
            transition={{ duration: 0.4 }}
            className="h-full bg-red-500 text-[9px] text-white font-bold flex items-center justify-center overflow-hidden"
          >
            {lossRate >= 15 ? `Losses (${lossRate}%)` : ''}
          </motion.div>
        </div>
      </div>

      {/* Minervini SEPA Wisdom Footer */}
      <div className="bg-slate-900 text-white p-3 border border-slate-800 text-[10px] font-sans flex items-start space-x-2">
        <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-mono font-bold text-emerald-400 uppercase block">Mark Minervini SEPA Expectancy Principle:</span>
          <span className="text-gray-300">
            "You do not need an 80% win rate to get rich in stock trading. A trader with a 45% win rate making 3:1 gains relative to losses will far outperform an 80% trader taking 1:1 or negative risk reward!"
          </span>
        </div>
      </div>
    </div>
  );
};


interface InteractiveRMultipleCalculatorToolProps {
  stock: MinerviniTradeSetup;
  currencySymbol: string;
  accountCapital: number;
  entryPrice: number;
  stopLossPrice: number;
  targetPrice: number;
  tradeSizeMode: 'SHARES' | 'DOLLAR';
  tradeSizeValue: number;
  onUpdateEntryPrice: (newEntry: number) => void;
  onUpdateStopLossPrice: (newStop: number) => void;
  onUpdateTargetPrice: (newTarget: number) => void;
  onUpdateTradeSizeMode: (mode: 'SHARES' | 'DOLLAR') => void;
  onUpdateTradeSizeValue: (val: number) => void;
  notes?: string;
  savedStatus?: string | null;
  onNotesChange?: (val: string) => void;
  onClearNotes?: () => void;
  onInsertTemplate?: () => void;
}

export const InteractiveRMultipleCalculatorTool: React.FC<InteractiveRMultipleCalculatorToolProps> = ({
  stock,
  currencySymbol,
  accountCapital,
  entryPrice,
  stopLossPrice,
  targetPrice,
  tradeSizeMode,
  tradeSizeValue,
  onUpdateEntryPrice,
  onUpdateStopLossPrice,
  onUpdateTargetPrice,
  onUpdateTradeSizeMode,
  onUpdateTradeSizeValue,
  notes,
  savedStatus,
  onNotesChange,
  onClearNotes,
  onInsertTemplate,
}) => {
  const validEntry = entryPrice > 0 ? entryPrice : stock.pivotPrice;
  const validStop = stopLossPrice > 0 ? stopLossPrice : stock.stopLossPrice;
  const validTarget = targetPrice > 0 ? targetPrice : stock.target1Price;
  const breakoutProb = calculateBreakoutProbability(stock);

  const riskPerShare = Math.max(0.01, validEntry - validStop);
  const riskPercent = validEntry > 0 ? ((validEntry - validStop) / validEntry) * 100 : 0;

  const rewardPerShare = Math.max(0, validTarget - validEntry);
  const rewardPercent = validEntry > 0 ? ((validTarget - validEntry) / validEntry) * 100 : 0;

  const rMultiple = riskPerShare > 0 ? rewardPerShare / riskPerShare : 0;

  // Derive active trade size in shares and total dollar position cost
  const activeShares = tradeSizeMode === 'SHARES'
    ? Math.max(1, Math.round(tradeSizeValue || 0))
    : Math.max(1, Math.floor((tradeSizeValue || 0) / validEntry));

  const totalPositionCost = activeShares * validEntry;
  const totalDollarRisk = activeShares * riskPerShare;
  const accountRiskPercent = accountCapital > 0 ? (totalDollarRisk / accountCapital) * 100 : 0;

  // 3:1 R-Multiple Target calculations (SEPA Benchmark)
  const target3RPrice = validEntry + (3 * riskPerShare);
  const reward3RPerShare = 3 * riskPerShare;
  const potentialTotalGain3R = activeShares * reward3RPerShare;
  const potential3RGainPercent = validEntry > 0 ? ((target3RPrice - validEntry) / validEntry) * 100 : 0;

  // Dedicated Position Sizing Calculator State
  const [portfolioValue, setPortfolioValue] = useState<number>(accountCapital || 100000);
  const [riskPercentInput, setRiskPercentInput] = useState<number>(1.0); // Default 1% portfolio risk
  const [isPosCalculatorExpanded, setIsPosCalculatorExpanded] = useState<boolean>(true);

  // Sync portfolioValue when accountCapital changes
  useEffect(() => {
    if (accountCapital && accountCapital > 0) {
      setPortfolioValue(accountCapital);
    }
  }, [accountCapital]);

  // Position Sizing Calculations based on Portfolio Value & Risk %
  const allowedDollarRisk = (portfolioValue * riskPercentInput) / 100;
  const rawRecommendedShares = riskPerShare > 0 ? Math.floor(allowedDollarRisk / riskPerShare) : 0;
  const recommendedShares = Math.max(0, rawRecommendedShares);
  const recommendedPositionCost = recommendedShares * validEntry;
  const portfolioAllocPct = portfolioValue > 0 ? (recommendedPositionCost / portfolioValue) * 100 : 0;

  // ATR Volatility & Trailing Stop State & Calculations
  const volMetrics = calculateDailyVolatilityMetrics(stock);
  const currentAtr14 = volMetrics.atr14 || (validEntry * 0.03);

  const [isTrailingStopEnabled, setIsTrailingStopEnabled] = useState<boolean>(false);
  const [trailMode, setTrailMode] = useState<'ATR_MULTIPLIER' | 'PERCENT'>('ATR_MULTIPLIER');
  const [atrMultiplier, setAtrMultiplier] = useState<number>(2.0); // Default 2.0x ATR
  const [trailPercent, setTrailPercent] = useState<number>(5.0); // Default 5.0%

  // Load trailing stop preference from localStorage
  useEffect(() => {
    try {
      const savedToggle = localStorage.getItem(`sepa_trail_stop_enabled_${stock.ticker}`);
      if (savedToggle !== null) setIsTrailingStopEnabled(savedToggle === 'true');
      const savedMode = localStorage.getItem(`sepa_trail_stop_mode_${stock.ticker}`);
      if (savedMode === 'PERCENT' || savedMode === 'ATR_MULTIPLIER') setTrailMode(savedMode);
      const savedMult = localStorage.getItem(`sepa_trail_stop_mult_${stock.ticker}`);
      if (savedMult) setAtrMultiplier(Number(savedMult) || 2.0);
      const savedPct = localStorage.getItem(`sepa_trail_stop_pct_${stock.ticker}`);
      if (savedPct) setTrailPercent(Number(savedPct) || 5.0);
    } catch (err) {
      console.error('Failed to load trailing stop setting:', err);
    }
  }, [stock.ticker]);

  const handleToggleTrailingStop = (checked: boolean) => {
    setIsTrailingStopEnabled(checked);
    try {
      localStorage.setItem(`sepa_trail_stop_enabled_${stock.ticker}`, checked ? 'true' : 'false');
    } catch (e) {}
  };

  const handleUpdateTrailMode = (mode: 'ATR_MULTIPLIER' | 'PERCENT') => {
    setTrailMode(mode);
    try {
      localStorage.setItem(`sepa_trail_stop_mode_${stock.ticker}`, mode);
    } catch (e) {}
  };

  const handleUpdateAtrMultiplier = (mult: number) => {
    const val = Math.max(0.5, Math.min(10, Number(mult) || 1));
    setAtrMultiplier(val);
    try {
      localStorage.setItem(`sepa_trail_stop_mult_${stock.ticker}`, val.toString());
    } catch (e) {}
  };

  const handleUpdateTrailPercent = (pct: number) => {
    const val = Math.max(0.5, Math.min(30, Number(pct) || 1));
    setTrailPercent(val);
    try {
      localStorage.setItem(`sepa_trail_stop_pct_${stock.ticker}`, val.toString());
    } catch (e) {}
  };

  // Trailing Distance calculation
  const trailingDistanceDollar = trailMode === 'ATR_MULTIPLIER'
    ? atrMultiplier * currentAtr14
    : (trailPercent / 100) * stock.currentPrice;

  const trailingDistancePercent = stock.currentPrice > 0
    ? (trailingDistanceDollar / stock.currentPrice) * 100
    : trailPercent;

  const projectedTrailPrice = Math.max(0.01, Number((stock.currentPrice - trailingDistanceDollar).toFixed(2)));

  const trailingStopParamStr = trailMode === 'ATR_MULTIPLIER'
    ? `${atrMultiplier}x ATR (${formatCurrency(currentAtr14, currencySymbol)})`
    : `${trailPercent}% Fixed Trail`;

  // Automated Price Alert state for 3:1 R Target
  const [is3RAlertEnabled, setIs3RAlertEnabled] = useState<boolean>(false);
  const [alertTriggered, setAlertTriggered] = useState<boolean>(false);
  const [alertBannerMessage, setAlertBannerMessage] = useState<string | null>(null);

  // Trade Entry Date & Time in Trade (Duration) State
  const [tradeEntryDate, setTradeEntryDate] = useState<string>('');

  // Load saved trade entry date
  useEffect(() => {
    try {
      const savedDate = localStorage.getItem(`sepa_trade_entry_date_${stock.ticker}`);
      if (savedDate) setTradeEntryDate(savedDate);
      else setTradeEntryDate('');
    } catch (err) {
      console.error('Failed to load saved trade entry date:', err);
    }
  }, [stock.ticker]);

  const handleUpdateTradeEntryDate = (newDate: string) => {
    setTradeEntryDate(newDate);
    try {
      if (newDate) {
        localStorage.setItem(`sepa_trade_entry_date_${stock.ticker}`, newDate);
      } else {
        localStorage.removeItem(`sepa_trade_entry_date_${stock.ticker}`);
      }
    } catch (err) {
      console.error('Failed to save trade entry date:', err);
    }
  };

  const calculateDaysInTrade = (dateStr: string): number | null => {
    if (!dateStr) return null;
    const entryDateObj = new Date(dateStr + 'T00:00:00');
    if (isNaN(entryDateObj.getTime())) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diffTime = now.getTime() - entryDateObj.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const daysInTrade = calculateDaysInTrade(tradeEntryDate);

  const getStallingAnalysis = (days: number | null) => {
    if (days === null) {
      return {
        statusKey: 'UNSET',
        badgeLabel: '🗓️ Set Entry Date',
        badgeClass: 'bg-gray-100 text-gray-700 border-gray-300 font-bold',
        textColor: 'text-gray-600',
        title: 'Time in Trade Not Specified',
        advice: 'Select your trade entry date to track holding duration (days held) and monitor for stalling breakouts.',
      };
    }
    if (days <= 5) {
      return {
        statusKey: 'FRESH',
        badgeLabel: `🟢 Fresh Entry (${days}d)`,
        badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold',
        textColor: 'text-emerald-700',
        title: 'Initial Breakout Window (0-5 Days)',
        advice: 'Position is within the initial 3-5 day breakout window. SEPA rules expect prompt price expansion and above-average volume follow-through.',
      };
    }
    if (days <= 15) {
      return {
        statusKey: 'DEVELOPING',
        badgeLabel: `🔵 Progress Window (${days}d)`,
        badgeClass: 'bg-blue-100 text-blue-900 border-blue-300 font-bold',
        textColor: 'text-blue-700',
        title: 'Developing Progress Window (6-15 Days / ~2 Weeks)',
        advice: '1 to 2 weeks in trade. Stock should be trending higher toward Target 1 (2R-3R) or building a tight, higher support shelf.',
      };
    }
    if (days <= 30) {
      return {
        statusKey: 'STALLING_WARNING',
        badgeLabel: `🟡 Stalling Warning (${days}d)`,
        badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 font-bold animate-pulse',
        textColor: 'text-amber-800',
        title: 'Caution: Extended Consolidation / Stalling (16-30 Days)',
        advice: 'Held for over 2 weeks without reaching profit targets. Monitor closely for sideways churn and consider raising stop loss to break-even.',
      };
    }
    return {
      statusKey: 'TIME_STOP_TRIGGERED',
      badgeLabel: `🔴 Stalled Setup (Time Stop: ${days}d)`,
      badgeClass: 'bg-red-600 text-white font-black',
      textColor: 'text-red-700',
      title: 'Alert: Stalled Breakout — Time Stop Protocol Triggered (>30 Days)',
      advice: 'Position held for over 30 days without reaching profit targets. Mark Minervini recommends evaluating a "Time Stop" (trimming or exiting stalled setups to reallocate capital to fresher momentum leaders).',
    };
  };

  const stallingInfo = getStallingAnalysis(daysInTrade);

  const getPresetDateString = (daysAgo: number): string => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split('T')[0];
  };

  // Load alert preference from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`sepa_3r_alert_${stock.ticker}`);
      setIs3RAlertEnabled(saved === 'true');
    } catch (err) {
      console.error(err);
      setIs3RAlertEnabled(false);
    }
  }, [stock.ticker]);

  // Handle price alert checkbox toggle
  const handleToggle3RAlert = async (checked: boolean) => {
    setIs3RAlertEnabled(checked);
    setAlertTriggered(false);
    setAlertBannerMessage(null);

    try {
      localStorage.setItem(`sepa_3r_alert_${stock.ticker}`, checked ? 'true' : 'false');
    } catch (err) {
      console.error('Failed to save alert preference', err);
    }

    if (checked) {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'default') {
          const perm = await Notification.requestPermission();
          if (perm === 'granted') {
            setAlertBannerMessage(`🔔 Automated 3:1 R Alert active! Browser notifications enabled for ${stock.ticker} at ${formatCurrency(target3RPrice, currencySymbol)}.`);
          } else {
            setAlertBannerMessage(`⚠️ Browser notifications restricted. In-app alert active for ${stock.ticker} at ${formatCurrency(target3RPrice, currencySymbol)}.`);
          }
        } else if (Notification.permission === 'granted') {
          setAlertBannerMessage(`🔔 Automated 3:1 R Alert active! Watching for ${stock.ticker} >= ${formatCurrency(target3RPrice, currencySymbol)}.`);
        } else {
          setAlertBannerMessage(`⚠️ Browser notifications blocked. In-app price alert active for ${stock.ticker} at ${formatCurrency(target3RPrice, currencySymbol)}.`);
        }
      } else {
        setAlertBannerMessage(`🔔 In-app 3:1 R Price Alert active for ${stock.ticker} at ${formatCurrency(target3RPrice, currencySymbol)}.`);
      }
    }
  };

  // Monitor live price against 3:1 R Target Price
  useEffect(() => {
    if (!is3RAlertEnabled || alertTriggered) return;

    if (stock.currentPrice >= target3RPrice) {
      setAlertTriggered(true);
      const title = `🎯 3:1 R-Multiple Target Hit: ${stock.ticker}!`;
      const body = `${stock.ticker} reached ${formatCurrency(stock.currentPrice, currencySymbol)} (Target: ${formatCurrency(target3RPrice, currencySymbol)}). Potential gain: +${potential3RGainPercent.toFixed(1)}% (${formatCurrency(potentialTotalGain3R, currencySymbol)}).`;

      setAlertBannerMessage(`🎯 3:1 R TARGET HIT! ${stock.ticker} reached ${formatCurrency(stock.currentPrice, currencySymbol)}.`);

      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(title, {
            body,
            icon: '/favicon.ico',
          });
        } catch (e) {
          console.error('Error firing browser notification:', e);
        }
      }
    }
  }, [is3RAlertEnabled, alertTriggered, stock.currentPrice, stock.ticker, target3RPrice, currencySymbol, potential3RGainPercent, potentialTotalGain3R]);

  // Test notification helper
  const triggerTestNotification = () => {
    const title = `🎯 TEST ALERT: 3:1 R Target for ${stock.ticker}`;
    const body = `${stock.ticker} 3:1 R Target is ${formatCurrency(target3RPrice, currencySymbol)}. Potential gain: +${potential3RGainPercent.toFixed(1)}% (${formatCurrency(potentialTotalGain3R, currencySymbol)}).`;
    setAlertBannerMessage(`🔔 Test Price Alert Fired for ${stock.ticker} at ${formatCurrency(target3RPrice, currencySymbol)}!`);

    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(title, { body });
      } else if (Notification.permission === 'default') {
        Notification.requestPermission().then((perm) => {
          if (perm === 'granted') {
            new Notification(title, { body });
          }
        });
      }
    }
  };

  const breakevenWinRate = rMultiple > 0 ? (1 / (1 + rMultiple)) * 100 : 0;

  const rLevels = [
    { label: '1.0 R Cushion', rVal: 1.0 },
    { label: '1.5 R Scale-out', rVal: 1.5 },
    { label: '2.0 R Passable', rVal: 2.0 },
    { label: '3.0 R SEPA Ideal', rVal: 3.0 },
    { label: '4.0 R Power Move', rVal: 4.0 },
    { label: '5.0 R Champion', rVal: 5.0 },
    { label: '8.0 R Home Run', rVal: 8.0 },
  ];

  return (
    <div className="bg-[#f9f8f5] border border-[#e5e4e1] p-5 space-y-5">
      {/* Alert Banner Message */}
      {alertBannerMessage && (
        <div className={`p-2.5 text-xs font-mono flex items-center justify-between border ${
          alertTriggered
            ? 'bg-amber-100 text-amber-950 border-amber-400 font-bold'
            : 'bg-emerald-50 text-emerald-900 border-emerald-300'
        }`}>
          <div className="flex items-center space-x-2">
            <BellRing className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{alertBannerMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setAlertBannerMessage(null)}
            className="text-[10px] uppercase font-bold text-gray-500 hover:text-black px-1 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e5e4e1] pb-3">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-[#1a1a1a] text-white">
            <Calculator className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1a1a1a]">
              R-Multiple & Trade Sizing Interactive Auto-Calculator Tool
            </h4>
            <p className="text-[10px] text-gray-500 font-mono">
              Adjust entry, stop loss, and trade size (shares / dollar amount) to compute position risk and potential gains.
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2 font-mono">
          <button
            type="button"
            onClick={() => {
              onUpdateEntryPrice(stock.pivotPrice);
              onUpdateStopLossPrice(stock.stopLossPrice);
              const autoRisk = Math.max(0.01, stock.pivotPrice - stock.stopLossPrice);
              const target3R = Number((stock.pivotPrice + 3 * autoRisk).toFixed(2));
              onUpdateTargetPrice(target3R);
              if (accountCapital > 0 && autoRisk > 0) {
                const recShares = Math.floor((accountCapital * 0.01) / autoRisk);
                onUpdateTradeSizeMode('SHARES');
                onUpdateTradeSizeValue(Math.max(10, recShares));
              }
            }}
            className="bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] uppercase font-black px-3 py-1.5 border border-emerald-900 cursor-pointer shadow-2xs flex items-center space-x-1 transition-all"
            title="Auto-populate pivot entry, 1R stop loss, 3R target price & recommended 1% account risk position size"
          >
            <Zap className="w-3.5 h-3.5 text-amber-300" />
            <span>⚡ Auto-Populate Exit Levels</span>
          </button>
          <button
            type="button"
            onClick={() => {
              exportDetailedTradeParametersToCsv({
                stock,
                entryPrice: validEntry,
                stopLossPrice: validStop,
                targetPrice: validTarget,
                shares: activeShares,
                totalPositionCost,
                riskPerShare,
                totalDollarRisk,
                rMultiple,
                target3RPrice,
                potentialTotalGain3R,
                isTrailingStopEnabled,
                trailingStopPrice: projectedTrailPrice,
                trailingStopParamStr,
                entryDate: tradeEntryDate,
                daysInTrade,
              });
            }}
            className="bg-[#1a1a1a] hover:bg-black text-amber-300 border border-black text-[10px] uppercase font-bold px-2.5 py-1.5 flex items-center space-x-1.5 transition-all cursor-pointer shadow-2xs group"
            title="Export current trade parameters (entry, stop loss, position size, R-Multiple) to CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400 group-hover:text-amber-400" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => {
              generateSepaPdfReport(stock, {
                accountCapital: portfolioValue,
                riskPercent: parseFloat(riskPercentInput) || 1.0,
                notes: `${stock.companyName} (${stock.ticker}) - ${stock.setupType} setup with ${stock.vcpStage} stage pattern.`,
              });
            }}
            className="bg-[#1a1a1a] hover:bg-black text-amber-300 border border-black text-[10px] uppercase font-bold px-2.5 py-1.5 flex items-center space-x-1.5 transition-all cursor-pointer shadow-2xs group"
            title="Generate clean, simplified print-ready PDF trade report for sharing or printing"
          >
            <Printer className="w-3.5 h-3.5 text-sky-400 group-hover:text-amber-400" />
            <span>Print / PDF</span>
          </button>
          <span className="text-[10px] text-gray-500 uppercase font-bold">R-Multiple:</span>
          <motion.span
            layout
            key={`rmult-${rMultiple.toFixed(2)}`}
            initial={{ scale: 0.92, opacity: 0.8 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2, type: 'spring', stiffness: 300, damping: 20 }}
            className={`px-3 py-1 font-mono text-sm font-black border ${
              rMultiple >= 5.0
                ? 'bg-purple-900 text-white border-purple-950'
                : rMultiple >= 3.0
                ? 'bg-emerald-600 text-white border-emerald-700'
                : rMultiple >= 2.0
                ? 'bg-amber-100 text-amber-900 border-amber-300'
                : 'bg-red-100 text-red-900 border-red-300'
            }`}
          >
            {rMultiple.toFixed(2)} R
          </motion.span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 font-mono text-xs">
        
        {/* Entry Price Input */}
        <div className="bg-white p-3.5 border border-[#e5e4e1] space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-[10px] uppercase font-bold text-gray-700 flex items-center space-x-1">
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-800" />
              <span>1. Entry Price ({currencySymbol}):</span>
            </label>
            <span className="text-[10px] text-emerald-800 font-bold bg-emerald-50 px-1.5 py-0.5 border border-emerald-200">
              Active Setup
            </span>
          </div>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-gray-500 font-mono text-xs">
              {currencySymbol}
            </span>
            <input
              type="number"
              step="0.05"
              value={validEntry}
              onChange={(e) => onUpdateEntryPrice(Math.max(0.01, Number(e.target.value) || stock.pivotPrice))}
              className="w-full bg-[#f9f8f5] border border-[#e5e4e1] pl-7 pr-3 py-2 text-[#1a1a1a] font-mono text-sm font-black focus:border-black focus:outline-none"
            />
          </div>
          <div className="space-y-1 pt-1 border-t border-gray-100">
            <span className="text-[9px] uppercase font-bold text-gray-400 block">Entry Presets:</span>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => onUpdateEntryPrice(stock.pivotPrice)}
                className="px-2 py-0.5 text-[9px] bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300 cursor-pointer font-semibold"
              >
                Pivot ({formatCurrency(stock.pivotPrice, currencySymbol)})
              </button>
              <button
                type="button"
                onClick={() => onUpdateEntryPrice(stock.currentPrice)}
                className="px-2 py-0.5 text-[9px] bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 cursor-pointer font-semibold"
              >
                Live ({formatCurrency(stock.currentPrice, currencySymbol)})
              </button>
            </div>
          </div>
        </div>

        {/* Stop Loss Input */}
        <div className="bg-white p-3.5 border border-[#e5e4e1] space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-[10px] uppercase font-bold text-red-700 flex items-center space-x-1">
              <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
              <span>2. Stop Loss Price ({currencySymbol}):</span>
            </label>
            <motion.span
              layout
              key={`stoprisk-${riskPercent.toFixed(2)}`}
              initial={{ opacity: 0.7, y: -2 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
              className="text-[10px] text-red-700 font-bold bg-red-50 px-1.5 py-0.5 border border-red-200"
            >
              Risk: -{riskPercent.toFixed(2)}%
            </motion.span>
          </div>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-gray-500 font-mono text-xs">
              {currencySymbol}
            </span>
            <input
              type="number"
              step="0.05"
              value={validStop}
              onChange={(e) => onUpdateStopLossPrice(Math.max(0.01, Number(e.target.value) || stock.stopLossPrice))}
              className="w-full bg-red-50/30 border border-red-200 pl-7 pr-3 py-2 text-red-600 font-mono text-sm font-black focus:border-red-600 focus:outline-none"
            />
          </div>
          <div className="space-y-1 pt-1 border-t border-gray-100">
            <span className="text-[9px] uppercase font-bold text-gray-400 block">Stop % Presets:</span>
            <div className="flex flex-wrap gap-1">
              {[3, 5, 7, 8].map((pct) => {
                const presetStop = Number((validEntry * (1 - pct / 100)).toFixed(2));
                return (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => onUpdateStopLossPrice(presetStop)}
                    className="px-1.5 py-0.5 text-[9px] bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 cursor-pointer font-semibold"
                  >
                    -{pct}%
                  </button>
                );
              })}
            </div>
          </div>

          {/* ATR Trailing Stop Sub-Panel */}
          <div className="mt-3 pt-2.5 border-t border-red-200 space-y-2 font-mono">
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isTrailingStopEnabled}
                  onChange={(e) => handleToggleTrailingStop(e.target.checked)}
                  className="w-3.5 h-3.5 accent-red-600 rounded cursor-pointer"
                />
                <ShieldCheck className={`w-3.5 h-3.5 ${isTrailingStopEnabled ? 'text-red-600 animate-pulse' : 'text-gray-400'}`} />
                <span>ATR Trailing Stop</span>
              </label>
              <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                isTrailingStopEnabled ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-500'
              }`}>
                {isTrailingStopEnabled ? '🟢 Trailing ON' : '⚪ OFF'}
              </span>
            </div>

            {isTrailingStopEnabled && (
              <div className="bg-red-50/70 p-2.5 border border-red-200 space-y-2 text-xs">
                {/* Mode Selector Tabs */}
                <div className="flex items-center justify-between text-[9px] font-bold">
                  <span className="text-gray-600 uppercase">Calculation Mode:</span>
                  <div className="flex rounded overflow-hidden border border-red-300 text-[9px]">
                    <button
                      type="button"
                      onClick={() => handleUpdateTrailMode('ATR_MULTIPLIER')}
                      className={`px-2 py-0.5 font-extrabold uppercase cursor-pointer transition-colors ${
                        trailMode === 'ATR_MULTIPLIER'
                          ? 'bg-red-700 text-white'
                          : 'bg-white text-gray-700 hover:bg-red-100'
                      }`}
                    >
                      ATR Multiplier
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateTrailMode('PERCENT')}
                      className={`px-2 py-0.5 font-extrabold uppercase cursor-pointer transition-colors ${
                        trailMode === 'PERCENT'
                          ? 'bg-red-700 text-white'
                          : 'bg-white text-gray-700 hover:bg-red-100'
                      }`}
                    >
                      Fixed %
                    </button>
                  </div>
                </div>

                {/* Multiplier or Percentage Controls & Quick Presets */}
                {trailMode === 'ATR_MULTIPLIER' ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-red-950 font-bold">
                        Multiplier (14D ATR: {formatCurrency(currentAtr14, currencySymbol)}):
                      </span>
                      <div className="flex items-center space-x-1">
                        <input
                          type="number"
                          step="0.1"
                          min="0.5"
                          max="10"
                          value={atrMultiplier}
                          onChange={(e) => handleUpdateAtrMultiplier(Number(e.target.value))}
                          className="w-16 bg-white border border-red-300 px-1.5 py-0.5 text-right font-black text-red-900 text-xs focus:outline-none focus:border-red-600"
                        />
                        <span className="text-[10px] font-bold text-red-900">x ATR</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {[1.5, 2.0, 2.5, 3.0].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => handleUpdateAtrMultiplier(m)}
                          className={`px-1.5 py-0.5 text-[9px] font-extrabold border cursor-pointer ${
                            atrMultiplier === m
                              ? 'bg-red-700 text-white border-red-800'
                              : 'bg-white text-red-900 border-red-200 hover:bg-red-100'
                          }`}
                        >
                          {m}x ATR
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-red-950 font-bold">
                        Trailing Distance %:
                      </span>
                      <div className="flex items-center space-x-1">
                        <input
                          type="number"
                          step="0.5"
                          min="1"
                          max="30"
                          value={trailPercent}
                          onChange={(e) => handleUpdateTrailPercent(Number(e.target.value))}
                          className="w-16 bg-white border border-red-300 px-1.5 py-0.5 text-right font-black text-red-900 text-xs focus:outline-none focus:border-red-600"
                        />
                        <span className="text-[10px] font-bold text-red-900">%</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {[3.0, 5.0, 7.5, 10.0].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => handleUpdateTrailPercent(pct)}
                          className={`px-1.5 py-0.5 text-[9px] font-extrabold border cursor-pointer ${
                            trailPercent === pct
                              ? 'bg-red-700 text-white border-red-800'
                              : 'bg-white text-red-900 border-red-200 hover:bg-red-100'
                          }`}
                        >
                          -{pct}%
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Projected Trail Price Label & Apply Action */}
                <div className="pt-2 border-t border-red-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <span className="text-[9px] uppercase font-bold text-gray-500 block">
                      Projected Trail Price ({trailingStopParamStr}):
                    </span>
                    <div className="text-base font-black text-red-700 font-mono">
                      {formatCurrency(projectedTrailPrice, currencySymbol)}
                    </div>
                    <div className="text-[9px] text-red-800 font-sans">
                      Distance: -{formatCurrency(trailingDistanceDollar, currencySymbol)} (-{trailingDistancePercent.toFixed(1)}% from {formatCurrency(stock.currentPrice, currencySymbol)})
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onUpdateStopLossPrice(projectedTrailPrice)}
                    className="bg-red-700 hover:bg-red-800 text-white text-[9px] uppercase font-black px-2 py-1 border border-red-900 cursor-pointer shadow-2xs transition-colors"
                    title="Apply projected trailing stop price directly as current active stop loss"
                  >
                    Set Stop to {formatCurrency(projectedTrailPrice, currencySymbol)}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Target Exit Price Input */}
        <div className="bg-white p-3.5 border border-[#e5e4e1] space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-[10px] uppercase font-bold text-emerald-800 flex items-center space-x-1">
              <Target className="w-3.5 h-3.5 text-emerald-600" />
              <span>3. Target Exit Price ({currencySymbol}):</span>
            </label>
            <span className="text-[10px] text-emerald-800 font-bold bg-emerald-50 px-1.5 py-0.5 border border-emerald-200">
              Gain: +{rewardPercent.toFixed(2)}%
            </span>
          </div>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-gray-500 font-mono text-xs">
              {currencySymbol}
            </span>
            <input
              type="number"
              step="0.10"
              value={validTarget}
              onChange={(e) => onUpdateTargetPrice(Math.max(validEntry + 0.01, Number(e.target.value) || stock.target1Price))}
              className="w-full bg-emerald-50/30 border border-emerald-200 pl-7 pr-3 py-2 text-emerald-800 font-mono text-sm font-black focus:border-emerald-700 focus:outline-none"
            />
          </div>
          <div className="space-y-1 pt-1 border-t border-gray-100">
            <span className="text-[9px] uppercase font-bold text-gray-400 block">Preset Target R:</span>
            <div className="flex flex-wrap gap-1">
              {[2.0, 3.0, 5.0].map((rTarget) => {
                const presetTarget = Number((validEntry + riskPerShare * rTarget).toFixed(2));
                return (
                  <button
                    key={rTarget}
                    type="button"
                    onClick={() => onUpdateTargetPrice(presetTarget)}
                    className="px-1.5 py-0.5 text-[9px] bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 cursor-pointer font-semibold"
                  >
                    {rTarget}R
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Persistent Trade Size Input (Shares or Dollar Amount) */}
        <div className="bg-white p-3.5 border border-slate-300 shadow-2xs space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-[10px] uppercase font-bold text-slate-900 flex items-center space-x-1">
              <DollarSign className="w-3.5 h-3.5 text-slate-800" />
              <span>4. Persistent Trade Size:</span>
            </label>
            <div className="flex rounded overflow-hidden border border-[#e5e4e1] text-[9px]">
              <button
                type="button"
                onClick={() => onUpdateTradeSizeMode('SHARES')}
                className={`px-1.5 py-0.5 font-bold uppercase transition-colors cursor-pointer ${
                  tradeSizeMode === 'SHARES' ? 'bg-[#1a1a1a] text-white' : 'bg-[#f9f8f5] text-gray-600 hover:bg-gray-200'
                }`}
              >
                Shares (#)
              </button>
              <button
                type="button"
                onClick={() => onUpdateTradeSizeMode('DOLLAR')}
                className={`px-1.5 py-0.5 font-bold uppercase transition-colors cursor-pointer ${
                  tradeSizeMode === 'DOLLAR' ? 'bg-[#1a1a1a] text-white' : 'bg-[#f9f8f5] text-gray-600 hover:bg-gray-200'
                }`}
              >
                Cost ({currencySymbol})
              </button>
            </div>
          </div>

          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-gray-500 font-mono text-xs font-bold">
              {tradeSizeMode === 'DOLLAR' ? currencySymbol : '#'}
            </span>
            <input
              type="number"
              step={tradeSizeMode === 'SHARES' ? "10" : "500"}
              value={tradeSizeValue}
              onChange={(e) => onUpdateTradeSizeValue(Math.max(1, Number(e.target.value) || 0))}
              className="w-full bg-[#f9f8f5] border border-black pl-7 pr-3 py-2 text-[#1a1a1a] font-mono text-sm font-black focus:bg-white focus:outline-none"
            />
          </div>

          <div className="space-y-1 pt-1 border-t border-gray-100 text-[10px]">
            <div className="flex justify-between text-gray-600">
              <span>Sized Position:</span>
              <motion.strong
                layout
                key={`sizedpos-${activeShares}-${validStop}`}
                initial={{ opacity: 0.7, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.15 }}
                className="text-slate-900 font-bold"
              >
                {activeShares.toLocaleString()} sh ({formatCurrency(totalPositionCost, currencySymbol)})
              </motion.strong>
            </div>
            <div className="flex flex-wrap gap-1 pt-0.5">
              <button
                type="button"
                onClick={() => {
                  const ruleShares = Math.floor((accountCapital * 0.01) / riskPerShare);
                  onUpdateTradeSizeMode('SHARES');
                  onUpdateTradeSizeValue(Math.max(10, ruleShares));
                }}
                className="px-1.5 py-0.5 text-[9px] bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 cursor-pointer font-semibold"
                title="Auto-set trade size based on 1% total account risk rule"
              >
                1% Risk Rule
              </button>
              <button
                type="button"
                onClick={() => {
                  const dollar20Pct = accountCapital * 0.20;
                  onUpdateTradeSizeMode('DOLLAR');
                  onUpdateTradeSizeValue(Math.round(dollar20Pct));
                }}
                className="px-1.5 py-0.5 text-[9px] bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 cursor-pointer font-semibold"
                title="Auto-set position size to 20% max portfolio allocation"
              >
                20% Cap
              </button>
            </div>
          </div>
        </div>

        {/* 5. Trade Entry Date & Time in Trade Duration */}
        <div className="bg-white p-3.5 border border-[#e5e4e1] space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-[10px] uppercase font-bold text-gray-700 flex items-center space-x-1">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>5. Trade Entry Date:</span>
            </label>
            <span className={`text-[9px] px-1.5 py-0.5 border ${stallingInfo.badgeClass}`}>
              {stallingInfo.badgeLabel}
            </span>
          </div>

          <div className="relative">
            <input
              type="date"
              value={tradeEntryDate}
              max={new Date().toISOString().split('T')[0]}
              onChange={(e) => handleUpdateTradeEntryDate(e.target.value)}
              className="w-full bg-[#f9f8f5] border border-[#e5e4e1] px-2.5 py-2 text-[#1a1a1a] font-mono text-xs font-black focus:border-black focus:outline-none"
            />
          </div>

          <div className="space-y-1 pt-1 border-t border-gray-100">
            <span className="text-[9px] uppercase font-bold text-gray-400 block">Quick Date Presets:</span>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => handleUpdateTradeEntryDate(getPresetDateString(0))}
                className="px-1.5 py-0.5 text-[9px] bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 cursor-pointer font-semibold"
                title="Set entry date to Today"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handleUpdateTradeEntryDate(getPresetDateString(7))}
                className="px-1.5 py-0.5 text-[9px] bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300 cursor-pointer font-semibold"
                title="Set entry date to 7 days ago (-1 Wk)"
              >
                -1 Wk
              </button>
              <button
                type="button"
                onClick={() => handleUpdateTradeEntryDate(getPresetDateString(14))}
                className="px-1.5 py-0.5 text-[9px] bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300 cursor-pointer font-semibold"
                title="Set entry date to 14 days ago (-2 Wks)"
              >
                -2 Wks
              </button>
              <button
                type="button"
                onClick={() => handleUpdateTradeEntryDate(getPresetDateString(30))}
                className="px-1.5 py-0.5 text-[9px] bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 cursor-pointer font-semibold"
                title="Set entry date to 30 days ago (-1 Mo)"
              >
                -1 Mo
              </button>
              {tradeEntryDate && (
                <button
                  type="button"
                  onClick={() => handleUpdateTradeEntryDate('')}
                  className="px-1.5 py-0.5 text-[9px] bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 cursor-pointer font-semibold"
                  title="Clear entry date"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-gray-100 space-y-1 text-[10px]">
            <div className="flex justify-between text-gray-600">
              <span>Time in Trade:</span>
              <strong className="text-slate-900 font-bold font-mono">
                {daysInTrade !== null ? `${daysInTrade} Day${daysInTrade === 1 ? '' : 's'} (${(daysInTrade / 7).toFixed(1)} wks)` : 'Unset'}
              </strong>
            </div>
            {daysInTrade !== null && (
              <div className="flex justify-between text-gray-600">
                <span>P&L Velocity:</span>
                <strong className={stock.currentPrice >= validEntry ? 'text-emerald-700 font-bold' : 'text-red-600 font-bold'}>
                  {daysInTrade > 0
                    ? `${(((stock.currentPrice - validEntry) / validEntry) * 100 / daysInTrade).toFixed(2)}% / day`
                    : `${(((stock.currentPrice - validEntry) / validEntry) * 100).toFixed(2)}% (Day 0)`}
                </strong>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* SEPA Time-in-Trade & Stalling Setup Monitor Sub-Panel */}
      <div className="bg-white border border-[#e5e4e1] p-4 space-y-3 font-mono shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-blue-50 text-blue-700 border border-blue-200">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-900">
                  SEPA Time-in-Trade & Breakout Stalling Monitor ({stock.ticker})
                </span>
                <span className="px-1.5 py-0.5 text-[9px] font-extrabold uppercase bg-blue-100 text-blue-900 border border-blue-300">
                  Minervini Time Stop Rules
                </span>
              </div>
              <p className="text-[10px] text-gray-500 font-sans">
                Track holding duration (days in trade) to prevent capital tie-up in stalling, sideways setups.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className={`px-2 py-1 text-[10px] uppercase font-bold border ${stallingInfo.badgeClass}`}>
              {stallingInfo.badgeLabel}
            </span>
          </div>
        </div>

        {/* Visual Duration Phase Progress Bar */}
        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between text-[9px] uppercase font-bold text-gray-500">
            <span className={daysInTrade !== null && daysInTrade <= 5 ? 'text-emerald-700 font-black' : ''}>0-5d: Fresh Breakout</span>
            <span className={daysInTrade !== null && daysInTrade > 5 && daysInTrade <= 15 ? 'text-blue-700 font-black' : ''}>6-15d: Progress Window</span>
            <span className={daysInTrade !== null && daysInTrade > 15 && daysInTrade <= 30 ? 'text-amber-700 font-black' : ''}>16-30d: Stalling Warning</span>
            <span className={daysInTrade !== null && daysInTrade > 30 ? 'text-red-700 font-black' : ''}>30d+: Time Stop Trigger</span>
          </div>
          <div className="w-full bg-gray-100 h-3 flex overflow-hidden border border-gray-300">
            <div
              className={`h-full text-[8px] text-white font-bold flex items-center justify-center transition-all ${
                daysInTrade !== null && daysInTrade <= 5 ? 'bg-emerald-600 ring-2 ring-emerald-800 z-10' : 'bg-emerald-200 text-emerald-800'
              }`}
              style={{ width: '20%' }}
              title="Fresh Breakout Window (0-5 Days)"
            >
              0-5d
            </div>
            <div
              className={`h-full text-[8px] text-white font-bold flex items-center justify-center transition-all border-l border-white/40 ${
                daysInTrade !== null && daysInTrade > 5 && daysInTrade <= 15 ? 'bg-blue-600 ring-2 ring-blue-800 z-10' : 'bg-blue-200 text-blue-800'
              }`}
              style={{ width: '30%' }}
              title="Developing Progress Window (6-15 Days)"
            >
              6-15d
            </div>
            <div
              className={`h-full text-[8px] text-white font-bold flex items-center justify-center transition-all border-l border-white/40 ${
                daysInTrade !== null && daysInTrade > 15 && daysInTrade <= 30 ? 'bg-amber-500 ring-2 ring-amber-800 z-10' : 'bg-amber-200 text-amber-800'
              }`}
              style={{ width: '30%' }}
              title="Stalling Warning Window (16-30 Days)"
            >
              16-30d
            </div>
            <div
              className={`h-full text-[8px] text-white font-bold flex items-center justify-center transition-all border-l border-white/40 ${
                daysInTrade !== null && daysInTrade > 30 ? 'bg-red-600 ring-2 ring-red-900 z-10' : 'bg-red-200 text-red-800'
              }`}
              style={{ width: '20%' }}
              title="Time Stop Protocol (>30 Days)"
            >
              30d+
            </div>
          </div>
        </div>

        {/* Phase Guidance Card */}
        <div className={`p-3 border space-y-1 font-sans text-xs ${stallingInfo.badgeClass}`}>
          <div className="font-bold uppercase tracking-wider text-[11px] font-mono flex items-center space-x-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{stallingInfo.title}</span>
          </div>
          <p className="leading-relaxed text-[11px]">
            {stallingInfo.advice}
          </p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono pt-1">
          <div className="bg-[#f9f8f5] p-2 border border-[#e5e4e1]">
            <span className="text-[9px] uppercase text-gray-500 block">Trade Entry Date</span>
            <strong className="text-slate-900 text-xs block mt-0.5">{tradeEntryDate || 'Not set'}</strong>
          </div>
          <div className="bg-[#f9f8f5] p-2 border border-[#e5e4e1]">
            <span className="text-[9px] uppercase text-gray-500 block">Time in Trade (Days)</span>
            <strong className="text-slate-900 text-xs block mt-0.5">
              {daysInTrade !== null ? `${daysInTrade} Days` : 'N/A'}
            </strong>
          </div>
          <div className="bg-[#f9f8f5] p-2 border border-[#e5e4e1]">
            <span className="text-[9px] uppercase text-gray-500 block">Duration in Weeks</span>
            <strong className="text-slate-900 text-xs block mt-0.5">
              {daysInTrade !== null ? `~${(daysInTrade / 7).toFixed(1)} Wks` : 'N/A'}
            </strong>
          </div>
          <div className="bg-[#f9f8f5] p-2 border border-[#e5e4e1]">
            <span className="text-[9px] uppercase text-gray-500 block">Stalling Risk Level</span>
            <strong className={`text-xs block mt-0.5 ${stallingInfo.textColor}`}>
              {daysInTrade === null ? 'Unspecified' : daysInTrade <= 15 ? 'Low (Optimal Momentum)' : daysInTrade <= 30 ? 'Medium (Watch Break-even)' : 'High (Time Stop)'}
            </strong>
          </div>
        </div>
      </div>

      {/* SEPA Risk & Portfolio Value Position Sizing Calculator Sub-Panel */}
      <div className="bg-slate-900 text-white border border-slate-800 p-4 font-mono space-y-3.5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                  SEPA Position Sizing Calculator Engine
                </span>
                <span className="px-1.5 py-0.5 text-[9px] font-extrabold uppercase bg-emerald-950 text-emerald-300 border border-emerald-800">
                  Risk-Based Share Sizing
                </span>
              </div>
              <p className="text-[10px] text-gray-400 font-sans">
                Calculate recommended share quantity based on total account portfolio value and maximum risk tolerance (1R).
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsPosCalculatorExpanded(!isPosCalculatorExpanded)}
            className="text-[10px] uppercase font-bold text-gray-400 hover:text-white flex items-center space-x-1 cursor-pointer"
          >
            <span>{isPosCalculatorExpanded ? 'Collapse' : 'Expand Calculator'}</span>
            {isPosCalculatorExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {isPosCalculatorExpanded && (
          <div className="space-y-3.5">
            {/* Input Controls Grid: Portfolio Value & Risk % */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Portfolio Value Input */}
              <div className="bg-slate-950/80 p-3 border border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-[10px]">
                  <label className="uppercase font-bold text-gray-300 flex items-center space-x-1">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Total Portfolio Capital ({currencySymbol}):</span>
                  </label>
                  <span className="text-gray-400 text-[9px]">Account Equity</span>
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-gray-400 font-mono text-xs">
                    {currencySymbol}
                  </span>
                  <input
                    type="number"
                    step="1000"
                    min="100"
                    value={portfolioValue}
                    onChange={(e) => setPortfolioValue(Math.max(100, Number(e.target.value) || 0))}
                    className="w-full bg-slate-900 border border-slate-700 pl-7 pr-3 py-1.5 text-white font-mono text-sm font-black focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-800 text-[9px]">
                  <span className="text-gray-400 uppercase font-bold self-center mr-1">Presets:</span>
                  {[25000, 50000, 100000, 250000, 500000].map((cap) => (
                    <button
                      key={cap}
                      type="button"
                      onClick={() => setPortfolioValue(cap)}
                      className={`px-1.5 py-0.5 border cursor-pointer font-extrabold ${
                        portfolioValue === cap
                          ? 'bg-amber-400 text-slate-950 border-amber-500'
                          : 'bg-slate-900 text-gray-300 border-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      {formatCurrency(cap, currencySymbol, 0)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Max Risk Percentage Input */}
              <div className="bg-slate-950/80 p-3 border border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-[10px]">
                  <label className="uppercase font-bold text-red-400 flex items-center space-x-1">
                    <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                    <span>Account Risk Tolerance (% per Trade):</span>
                  </label>
                  <span className="text-red-300 font-bold bg-red-950/80 px-1.5 py-0.5 border border-red-800 text-[9px]">
                    1R Max Risk: -{formatCurrency(allowedDollarRisk, currencySymbol)}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="10"
                    value={riskPercentInput}
                    onChange={(e) => setRiskPercentInput(Math.max(0.1, Math.min(10, Number(e.target.value) || 0.1)))}
                    className="w-24 bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-white font-mono text-sm font-black focus:border-red-400 focus:outline-none text-right"
                  />
                  <span className="text-xs font-bold text-red-400">% Account</span>
                  <input
                    type="range"
                    min="0.25"
                    max="3.0"
                    step="0.25"
                    value={riskPercentInput}
                    onChange={(e) => setRiskPercentInput(Number(e.target.value))}
                    className="w-full accent-red-500 cursor-pointer"
                  />
                </div>
                <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-800 text-[9px]">
                  <span className="text-gray-400 uppercase font-bold self-center mr-1">Strategy Presets:</span>
                  {[
                    { pct: 0.5, label: '0.5% Conserv' },
                    { pct: 1.0, label: '1.0% SEPA Std' },
                    { pct: 1.5, label: '1.5% Moderate' },
                    { pct: 2.0, label: '2.0% Aggressive' },
                  ].map((preset) => (
                    <button
                      key={preset.pct}
                      type="button"
                      onClick={() => setRiskPercentInput(preset.pct)}
                      className={`px-1.5 py-0.5 border cursor-pointer font-extrabold ${
                        riskPercentInput === preset.pct
                          ? 'bg-red-600 text-white border-red-500'
                          : 'bg-slate-900 text-gray-300 border-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* Sizing Engine Output Results Panel */}
            <div className="bg-slate-950 p-3.5 border border-slate-800 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                
                {/* Result 1: Recommended Share Count */}
                <motion.div
                  layout
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  className="bg-slate-900 p-3 border border-slate-800 space-y-1"
                >
                  <span className="text-[9px] uppercase font-bold text-gray-400 block">
                    Recommended Share Sizing
                  </span>
                  <motion.div
                    key={`rec-shares-${recommendedShares}`}
                    initial={{ opacity: 0.8, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.15 }}
                    className="text-2xl font-black text-amber-300"
                  >
                    {recommendedShares.toLocaleString()} <span className="text-xs font-normal text-gray-400">shares</span>
                  </motion.div>
                  <div className="text-[10px] text-gray-400 border-t border-slate-800 pt-1">
                    Risk per share: <strong className="text-red-400">-{formatCurrency(riskPerShare, currencySymbol)}</strong> (-{riskPercent.toFixed(1)}%)
                  </div>
                </motion.div>

                {/* Result 2: Dollar Risk Budget */}
                <motion.div
                  layout
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  className="bg-slate-900 p-3 border border-slate-800 space-y-1"
                >
                  <span className="text-[9px] uppercase font-bold text-gray-400 block">
                    Max Dollar Risk (1R Loss)
                  </span>
                  <motion.div
                    key={`risk-dollar-${allowedDollarRisk}`}
                    initial={{ opacity: 0.8, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.15 }}
                    className="text-2xl font-black text-red-400"
                  >
                    -{formatCurrency(allowedDollarRisk, currencySymbol)}
                  </motion.div>
                  <div className="text-[10px] text-gray-400 border-t border-slate-800 pt-1">
                    Exactly <strong>{riskPercentInput}%</strong> of {formatCurrency(portfolioValue, currencySymbol, 0)}
                  </div>
                </motion.div>

                {/* Result 3: Total Position Cost */}
                <motion.div
                  layout
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  className="bg-slate-900 p-3 border border-slate-800 space-y-1"
                >
                  <span className="text-[9px] uppercase font-bold text-gray-400 block">
                    Total Position Capital
                  </span>
                  <motion.div
                    key={`pos-cost-${recommendedPositionCost}`}
                    initial={{ opacity: 0.8, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.15 }}
                    className="text-2xl font-black text-white"
                  >
                    {formatCurrency(recommendedPositionCost, currencySymbol)}
                  </motion.div>
                  <div className="text-[10px] text-gray-400 border-t border-slate-800 pt-1">
                    Entry Price: <strong>{formatCurrency(validEntry, currencySymbol)}</strong>
                  </div>
                </motion.div>

                {/* Result 4: Portfolio Allocation % & SEPA Guidance */}
                <motion.div
                  layout
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  className="bg-slate-900 p-3 border border-slate-800 space-y-1 flex flex-col justify-between"
                >
                  <div>
                    <span className="text-[9px] uppercase font-bold text-gray-400 block">
                      Portfolio Allocation %
                    </span>
                    <motion.div
                      key={`alloc-pct-${portfolioAllocPct.toFixed(1)}`}
                      initial={{ opacity: 0.8, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.15 }}
                      className="text-2xl font-black text-emerald-400"
                    >
                      {portfolioAllocPct.toFixed(1)}% <span className="text-xs font-normal text-gray-400">of capital</span>
                    </motion.div>
                  </div>
                  <div className="text-[9px] border-t border-slate-800 pt-1">
                    {portfolioAllocPct <= 20 ? (
                      <span className="text-emerald-400 font-bold flex items-center space-x-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>SEPA Optimal (&lt;=20%)</span>
                      </span>
                    ) : portfolioAllocPct <= 25 ? (
                      <span className="text-amber-300 font-bold flex items-center space-x-1">
                        <Zap className="w-3 h-3 text-amber-300" />
                        <span>Upper SEPA Cap (20-25%)</span>
                      </span>
                    ) : (
                      <span className="text-red-400 font-bold flex items-center space-x-1">
                        <AlertTriangle className="w-3 h-3 text-red-400" />
                        <span>Over-Concentrated (&gt;25%)</span>
                      </span>
                    )}
                  </div>
                </motion.div>

              </div>

              {/* Action Bar: Apply Sized Shares to Trade Plan */}
              <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="text-[10px] text-gray-400 font-sans">
                  {portfolioAllocPct > 25 ? (
                    <span className="text-amber-300 font-semibold flex items-center space-x-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                      <span>
                        Note: Tight {riskPercent.toFixed(1)}% stop loss requires {portfolioAllocPct.toFixed(1)}% position size to risk {riskPercentInput}%. Consider capping allocation to 20% max ({Math.floor((portfolioValue * 0.20) / validEntry).toLocaleString()} shares).
                      </span>
                    </span>
                  ) : (
                    <span className="text-emerald-300 flex items-center space-x-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>
                        Optimal risk-adjusted position size calculated using Entry {formatCurrency(validEntry, currencySymbol)} and Stop Loss {formatCurrency(validStop, currencySymbol)}.
                      </span>
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onUpdateTradeSizeMode('SHARES');
                    onUpdateTradeSizeValue(recommendedShares);
                  }}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black uppercase px-4 py-2 border border-emerald-400 cursor-pointer shadow-xs transition-all flex items-center space-x-2 shrink-0"
                  title="Apply calculated recommended shares to the active trade execution plan"
                >
                  <Calculator className="w-4 h-4" />
                  <span>Apply {recommendedShares.toLocaleString()} Shares to Trade Plan</span>
                </button>
              </div>

            </div>
          </div>
        )}
      </div>

      {/* Auto-Populated SEPA Exit Levels Matrix Sub-Panel */}
      <div className="bg-white border border-[#e5e4e1] p-4 space-y-3 font-mono">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2">
          <div className="flex items-center space-x-2">
            <Target className="w-4 h-4 text-emerald-600" />
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Auto-Populated SEPA Exit Levels Matrix ({stock.ticker})
            </h5>
          </div>
          <button
            type="button"
            onClick={() => {
              onUpdateEntryPrice(stock.pivotPrice);
              onUpdateStopLossPrice(stock.stopLossPrice);
              const autoRisk = Math.max(0.01, stock.pivotPrice - stock.stopLossPrice);
              const target3R = Number((stock.pivotPrice + 3 * autoRisk).toFixed(2));
              onUpdateTargetPrice(target3R);
              if (accountCapital > 0 && autoRisk > 0) {
                const recShares = Math.floor((accountCapital * 0.01) / autoRisk);
                onUpdateTradeSizeMode('SHARES');
                onUpdateTradeSizeValue(Math.max(10, recShares));
              }
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] uppercase font-black px-2.5 py-1 border border-emerald-800 cursor-pointer shadow-2xs flex items-center space-x-1 transition-all"
            title="Auto-fill pivot entry, 1R stop loss, 3R target price & recommended 1% position size"
          >
            <Zap className="w-3.5 h-3.5 text-amber-300" />
            <span>Auto-Populate Into Trade Plan</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="bg-[#f9f8f5] border-b border-[#e5e4e1] text-[10px] text-gray-500 uppercase">
                <th className="py-2 px-2.5 font-bold">Exit Level</th>
                <th className="py-2 px-2.5 font-bold">Price Level</th>
                <th className="py-2 px-2.5 font-bold">Gain / Risk %</th>
                <th className="py-2 px-2.5 font-bold">R-Multiple</th>
                <th className="py-2 px-2.5 font-bold">Est. Position P&L</th>
                <th className="py-2 px-2.5 text-right font-bold">Quick Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-[11px]">
              {/* Row 1: Initial Stop Loss (1R) */}
              <tr className="hover:bg-red-50/40">
                <td className="py-2 px-2.5 font-bold text-red-700 flex items-center space-x-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  <span>1. Initial Stop Loss (1R Risk)</span>
                </td>
                <td className="py-2 px-2.5 font-black text-red-600">
                  {formatCurrency(validStop, currencySymbol)}
                </td>
                <td className="py-2 px-2.5 text-red-700 font-bold">
                  -{riskPercent.toFixed(2)}%
                </td>
                <td className="py-2 px-2.5">
                  <span className="bg-red-100 text-red-900 px-1.5 py-0.5 border border-red-300 font-bold text-[10px]">-1.0 R</span>
                </td>
                <td className="py-2 px-2.5 text-red-600 font-bold">
                  -{formatCurrency(totalDollarRisk, currencySymbol)}
                </td>
                <td className="py-2 px-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => onUpdateStopLossPrice(validStop)}
                    className="bg-red-50 hover:bg-red-100 text-red-900 border border-red-200 px-2 py-0.5 text-[9px] font-extrabold uppercase cursor-pointer"
                  >
                    Apply as Active Stop
                  </button>
                </td>
              </tr>

              {/* Row 2: 1R Break-Even Level */}
              <tr className="hover:bg-blue-50/40">
                <td className="py-2 px-2.5 font-bold text-blue-900 flex items-center space-x-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>2. Break-Even Stop (+1R)</span>
                </td>
                <td className="py-2 px-2.5 font-black text-blue-900">
                  {formatCurrency(validEntry + riskPerShare, currencySymbol)}
                </td>
                <td className="py-2 px-2.5 text-blue-800 font-bold">
                  +{riskPercent.toFixed(2)}%
                </td>
                <td className="py-2 px-2.5">
                  <span className="bg-blue-100 text-blue-900 px-1.5 py-0.5 border border-blue-300 font-bold text-[10px]">+1.0 R</span>
                </td>
                <td className="py-2 px-2.5 text-blue-800 font-bold">
                  +{formatCurrency(totalDollarRisk, currencySymbol)} (Stop at {formatCurrency(validEntry, currencySymbol)})
                </td>
                <td className="py-2 px-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => onUpdateStopLossPrice(validEntry)}
                    className="bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 px-2 py-0.5 text-[9px] font-extrabold uppercase cursor-pointer"
                    title="Move stop loss to entry price to eliminate risk"
                  >
                    Set Stop to Break-Even
                  </button>
                </td>
              </tr>

              {/* Row 3: Target 1 (2R Partial Take) */}
              <tr className="hover:bg-emerald-50/40">
                <td className="py-2 px-2.5 font-bold text-emerald-800 flex items-center space-x-1.5">
                  <Target className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>3. Target 1 (2R Partial Scale-Out)</span>
                </td>
                <td className="py-2 px-2.5 font-black text-emerald-800">
                  {formatCurrency(validEntry + (2 * riskPerShare), currencySymbol)}
                </td>
                <td className="py-2 px-2.5 text-emerald-800 font-bold">
                  +{(riskPercent * 2).toFixed(2)}%
                </td>
                <td className="py-2 px-2.5">
                  <span className="bg-emerald-100 text-emerald-900 px-1.5 py-0.5 border border-emerald-300 font-bold text-[10px]">+2.0 R</span>
                </td>
                <td className="py-2 px-2.5 text-emerald-700 font-bold">
                  +{formatCurrency(totalDollarRisk * 2, currencySymbol)}
                </td>
                <td className="py-2 px-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => onUpdateTargetPrice(Number((validEntry + 2 * riskPerShare).toFixed(2)))}
                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 px-2 py-0.5 text-[9px] font-extrabold uppercase cursor-pointer"
                  >
                    Set Target to 2R
                  </button>
                </td>
              </tr>

              {/* Row 4: Target 2 (3R SEPA Benchmark) */}
              <tr className="hover:bg-emerald-50/60 font-bold">
                <td className="py-2 px-2.5 text-emerald-900 flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>4. Target 2 (3R SEPA Benchmark)</span>
                </td>
                <td className="py-2 px-2.5 font-black text-emerald-900 text-sm">
                  {formatCurrency(target3RPrice, currencySymbol)}
                </td>
                <td className="py-2 px-2.5 text-emerald-900 font-black">
                  +{potential3RGainPercent.toFixed(2)}%
                </td>
                <td className="py-2 px-2.5">
                  <span className="bg-emerald-600 text-white px-2 py-0.5 font-black text-[10px]">+3.0 R</span>
                </td>
                <td className="py-2 px-2.5 text-emerald-900 font-black">
                  +{formatCurrency(potentialTotalGain3R, currencySymbol)}
                </td>
                <td className="py-2 px-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => onUpdateTargetPrice(target3RPrice)}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white border border-emerald-900 px-2 py-0.5 text-[9px] font-black uppercase cursor-pointer shadow-2xs"
                  >
                    Set Target to 3R
                  </button>
                </td>
              </tr>

              {/* Row 5: Target 3 (5R Champion Target) */}
              <tr className="hover:bg-purple-50/40">
                <td className="py-2 px-2.5 font-bold text-purple-900 flex items-center space-x-1.5">
                  <Flame className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                  <span>5. Target 3 (5R Champion Runner)</span>
                </td>
                <td className="py-2 px-2.5 font-black text-purple-900">
                  {formatCurrency(validEntry + (5 * riskPerShare), currencySymbol)}
                </td>
                <td className="py-2 px-2.5 text-purple-900 font-bold">
                  +{(riskPercent * 5).toFixed(2)}%
                </td>
                <td className="py-2 px-2.5">
                  <span className="bg-purple-900 text-white px-1.5 py-0.5 font-bold text-[10px]">+5.0 R</span>
                </td>
                <td className="py-2 px-2.5 text-purple-900 font-bold">
                  +{formatCurrency(totalDollarRisk * 5, currencySymbol)}
                </td>
                <td className="py-2 px-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => onUpdateTargetPrice(Number((validEntry + 5 * riskPerShare).toFixed(2)))}
                    className="bg-purple-100 hover:bg-purple-200 text-purple-900 border border-purple-300 px-2 py-0.5 text-[9px] font-extrabold uppercase cursor-pointer"
                  >
                    Set Target to 5R
                  </button>
                </td>
              </tr>

              {/* Row 6: Trailing Stop Level */}
              <tr className="hover:bg-red-50/30">
                <td className="py-2 px-2.5 font-bold text-gray-800 flex items-center space-x-1.5">
                  <Sliders className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  <span>6. Trailing Stop ({trailingStopParamStr})</span>
                </td>
                <td className="py-2 px-2.5 font-black text-red-700">
                  {formatCurrency(projectedTrailPrice, currencySymbol)}
                </td>
                <td className="py-2 px-2.5 text-red-700 font-bold">
                  -{trailingDistancePercent.toFixed(2)}%
                </td>
                <td className="py-2 px-2.5">
                  <span className="bg-gray-100 text-gray-800 px-1.5 py-0.5 border border-gray-300 font-bold text-[10px]">Trail</span>
                </td>
                <td className="py-2 px-2.5 text-gray-700 font-bold">
                  {projectedTrailPrice >= validEntry ? '+' : ''}{formatCurrency(activeShares * (projectedTrailPrice - validEntry), currencySymbol)}
                </td>
                <td className="py-2 px-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => onUpdateStopLossPrice(projectedTrailPrice)}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-900 border border-gray-300 px-2 py-0.5 text-[9px] font-extrabold uppercase cursor-pointer"
                  >
                    Apply Trail Stop
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Notes (Pivot Thesis Points) Sub-Panel */}
      {onNotesChange && (
        <div className="bg-white border border-[#e5e4e1] p-3.5 space-y-2 font-mono">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2">
            <div className="flex items-center space-x-2">
              <FileText className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-900">
                Trade Notes & Auto-Populated SEPA Thesis ({stock.ticker})
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[9px]">
              {savedStatus && (
                <span className="text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 font-bold flex items-center space-x-1">
                  <Check className="w-2.5 h-2.5 text-emerald-600" />
                  <span>{savedStatus}</span>
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  const dateStr = new Date().toISOString().split('T')[0];
                  const autoNotes = `=== SEPA TRADE PLAN THESIS: ${stock.ticker} (${stock.name}) ===
📅 Date: ${dateStr}

[1] SETUP & TECHNICAL CATALYST
• Sector / Industry: ${stock.sector} / ${stock.industry}
• RS Rating: ${stock.rsRating} (Relative Strength Leader)
• VCP Contraction: Tight Squeeze | Vol Dry-Up: ${stock.volumeDryUpPercent}% vs 20D Avg Vol
• Stage 2 Trend Template: ${breakoutProb?.factors?.trendScore || 8}/8 Rules Passed

[2] AUTO-POPULATED EXECUTION & EXIT LEVELS
• Pivot Entry: ${formatCurrency(validEntry, currencySymbol)} (Buy Zone: ${formatCurrency(validEntry, currencySymbol)} - ${formatCurrency(validEntry * 1.05, currencySymbol)})
• Initial Stop Loss (1R): ${formatCurrency(validStop, currencySymbol)} (-${riskPercent.toFixed(2)}% Risk)
• 1R Break-Even Level: ${formatCurrency(validEntry + riskPerShare, currencySymbol)} (+${riskPercent.toFixed(2)}%)
• Target 1 (2R Partial Take): ${formatCurrency(validEntry + (2 * riskPerShare), currencySymbol)} (+${(riskPercent * 2).toFixed(2)}%)
• Target 2 (3R SEPA Standard): ${formatCurrency(target3RPrice, currencySymbol)} (+${potential3RGainPercent.toFixed(2)}%)
• Target 3 (5R Champion Target): ${formatCurrency(validEntry + (5 * riskPerShare), currencySymbol)} (+${(riskPercent * 5).toFixed(2)}%)
• Trailing Stop Exit (-2x ATR): ${formatCurrency(projectedTrailPrice, currencySymbol)}

[3] POSITION SIZING & CAPITAL RISK
• Portfolio Equity: ${formatCurrency(accountCapital, currencySymbol)} | Max Risk Cap (1%): ${formatCurrency(accountCapital * 0.01, currencySymbol)}
• Sized Position: ${activeShares.toLocaleString()} shares (${formatCurrency(totalPositionCost, currencySymbol)} total cost)
• Maximum Dollar Loss at 1R Stop: -${formatCurrency(totalDollarRisk, currencySymbol)}

[4] SEPA EXECUTION & DISCIPLINE RULES
1. Do NOT chase past +5% of pivot entry (${formatCurrency(validEntry * 1.05, currencySymbol)}).
2. Move stop loss to entry price (${formatCurrency(validEntry, currencySymbol)}) once price reaches +1R (+${riskPercent.toFixed(2)}%).
3. Sell 50% position at Target 1 (${formatCurrency(validEntry + 2 * riskPerShare, currencySymbol)}) and trail runner with 50-day SMA or 8% trailing stop.
4. Hard exit if price breaks below initial stop loss (${formatCurrency(validStop, currencySymbol)}).`;
                  onNotesChange(autoNotes);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-800 px-2 py-0.5 font-black uppercase cursor-pointer shadow-2xs flex items-center space-x-1"
                title="Auto-fill complete SEPA trade thesis, exit levels, position sizing & execution rules"
              >
                <Zap className="w-2.5 h-2.5 text-amber-300" />
                <span>Auto-Generate SEPA Notes</span>
              </button>
              {onInsertTemplate && (
                <button
                  type="button"
                  onClick={onInsertTemplate}
                  className="bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 px-2 py-0.5 font-extrabold uppercase cursor-pointer"
                  title="Insert structured pivot thesis template"
                >
                  + Post-Mortem Template
                </button>
              )}
            </div>
          </div>

          <textarea
            value={notes || ''}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder={`Jot down pivot thesis points, catalyst triggers, volume dry-up notes, or key execution rules for ${stock.ticker}... Click 'Auto-Generate SEPA Notes' to populate automatically.`}
            rows={4}
            className="w-full bg-[#f9f8f5] border border-[#e5e4e1] p-2.5 text-xs text-[#1a1a1a] font-mono focus:border-black focus:outline-none placeholder:text-gray-400 placeholder:font-sans resize-y"
          />

          <div className="flex flex-wrap items-center justify-between text-[9px] text-gray-500 font-mono">
            <span className="italic font-sans">Notes are saved locally in your browser specifically for <strong className="font-mono text-[#1a1a1a]">{stock.ticker}</strong>.</span>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => {
                  if (notes) {
                    navigator.clipboard.writeText(notes);
                  }
                }}
                className="text-gray-700 hover:text-black uppercase font-bold flex items-center space-x-1 cursor-pointer"
                title="Copy notes to clipboard"
              >
                <span>Copy Notes</span>
              </button>
              <span className="text-gray-400 font-mono">{(notes || '').length} chars</span>
              {notes && onClearNotes && (
                <button
                  type="button"
                  onClick={onClearNotes}
                  className="text-red-600 hover:text-red-800 uppercase font-bold flex items-center space-x-1 cursor-pointer"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                  <span>Clear Notes</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* R-Multiple Live Calculation & Position Sizing Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
        
        {/* Card 1: Calculated R-Multiple */}
        <div className="bg-[#1a1a1a] text-white p-3.5 border border-black space-y-1">
          <span className="text-[10px] uppercase font-bold text-[#b5a68d] block tracking-wider">
            Calculated R-Multiple
          </span>
          <div className="text-3xl font-black text-emerald-400">
            {rMultiple.toFixed(2)} <span className="text-sm font-normal text-gray-300">R</span>
          </div>
          <div className="text-[10px] text-gray-300 font-sans border-t border-gray-800 pt-1">
            {rMultiple >= 5.0 ? '🚀 Champion Grade asymmetric payout.' : rMultiple >= 3.0 ? '🟢 Meets Minervini SEPA 3:1+ benchmark.' : rMultiple >= 2.0 ? '🟡 Minimum acceptable risk/reward ratio.' : '🔴 Subpar payout ratio.'}
          </div>
        </div>

        {/* Card 2: Total Position Sizing */}
        <div className="bg-white border border-[#e5e4e1] p-3.5 space-y-1">
          <div className="flex justify-between text-slate-800 text-[10px] font-bold uppercase">
            <span>Trade Size & Capital</span>
            <span>{accountCapital > 0 ? ((totalPositionCost / accountCapital) * 100).toFixed(1) : 0}% Portfolio</span>
          </div>
          <div className="text-2xl font-black text-slate-900">
            {activeShares.toLocaleString()} <span className="text-xs text-gray-500 font-normal">shares</span>
          </div>
          <div className="text-[10px] text-gray-600 border-t border-[#e5e4e1] pt-1 flex justify-between font-bold">
            <span>Total Position Value:</span>
            <span className="text-slate-900">{formatCurrency(totalPositionCost, currencySymbol)}</span>
          </div>
        </div>

        {/* Card 3: Dynamic Total Risk (1R) */}
        <div className="bg-red-50/60 border border-red-200 p-3.5 space-y-1">
          <div className="flex justify-between text-red-700 text-[10px] font-bold uppercase">
            <span>Total Risk (1R Loss)</span>
            <span>-{accountRiskPercent.toFixed(2)}% Account</span>
          </div>
          <div className="text-2xl font-black text-red-600">
            -{formatCurrency(totalDollarRisk, currencySymbol)}
          </div>
          <div className="text-[10px] text-red-800 border-t border-red-200 pt-1 flex justify-between font-bold">
            <span>Per-Share Risk:</span>
            <span>-{formatCurrency(riskPerShare, currencySymbol)} (-{riskPercent.toFixed(2)}%)</span>
          </div>
        </div>

        {/* Card 4: Potential Total Gain at 3:1 R-Multiple Target & Auto-Alert Checkbox */}
        <div className="bg-emerald-950 text-white border border-emerald-900 p-3.5 space-y-2 shadow-xs flex flex-col justify-between">
          <div className="space-y-1">
            <div className="flex justify-between text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
              <span>Potential Gain at 3:1 R Target</span>
              <span className="bg-emerald-500 text-black px-1 rounded text-[9px] font-black">SEPA 3R</span>
            </div>
            <div className="text-2xl font-black text-emerald-300">
              +{formatCurrency(potentialTotalGain3R, currencySymbol)}
            </div>
            <div className="text-[10px] text-emerald-200 border-t border-emerald-800/80 pt-1 flex justify-between font-mono">
              <span>Target Price ({formatCurrency(target3RPrice, currencySymbol)}):</span>
              <span className="font-bold text-emerald-400">+{potential3RGainPercent.toFixed(1)}% Return</span>
            </div>
          </div>

          {/* Automated Price Alert Checkbox Control */}
          <div className="pt-2 border-t border-emerald-800/80 space-y-1.5">
            <label className="flex items-center space-x-2 text-[10px] font-bold cursor-pointer text-emerald-200 hover:text-white transition-colors">
              <input
                type="checkbox"
                checked={is3RAlertEnabled}
                onChange={(e) => handleToggle3RAlert(e.target.checked)}
                className="w-3.5 h-3.5 accent-emerald-500 rounded cursor-pointer"
              />
              <span className="flex items-center space-x-1">
                <BellRing className={`w-3.5 h-3.5 ${is3RAlertEnabled ? 'text-emerald-400 animate-pulse' : 'text-gray-400'}`} />
                <span>3:1 R Price Auto-Alert</span>
              </span>
            </label>

            <div className="flex items-center justify-between text-[9px] font-mono">
              <span className={`px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                alertTriggered
                  ? 'bg-amber-400 text-black font-black'
                  : is3RAlertEnabled
                  ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
                  : 'bg-emerald-900/40 text-emerald-400/60'
              }`}>
                {alertTriggered ? '🎯 Target Reached!' : is3RAlertEnabled ? '🟢 Alert Active' : '⚪ Alert Off'}
              </span>

              {is3RAlertEnabled && (
                <button
                  type="button"
                  onClick={triggerTestNotification}
                  className="text-[9px] text-emerald-300 hover:text-white underline cursor-pointer font-sans"
                >
                  Test Alert
                </button>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* R-Multiple Target Matrix Table */}
      <div className="bg-white border border-[#e5e4e1] p-4 space-y-3 font-mono">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e5e4e1] pb-2">
          <span className="text-[11px] font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
            <Layers className="w-4 h-4 text-slate-800" />
            <span>R-Multiple Target Matrix ({activeShares.toLocaleString()} sh @ {formatCurrency(validEntry, currencySymbol)} Entry)</span>
          </span>
          <span className="text-[10px] text-gray-500 font-sans">
            Click any R-level to set target exit price
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2 text-xs">
          {rLevels.map((lvl) => {
            const targetP = Number((validEntry + riskPerShare * lvl.rVal).toFixed(2));
            const pctGain = ((targetP - validEntry) / validEntry) * 100;
            const totalProfitForLevel = activeShares * (targetP - validEntry);
            const isCurrentTarget = Math.abs(validTarget - targetP) < 0.05;

            return (
              <div
                key={lvl.rVal}
                onClick={() => onUpdateTargetPrice(targetP)}
                className={`p-2.5 border transition-all cursor-pointer flex flex-col justify-between space-y-1.5 ${
                  isCurrentTarget
                    ? 'bg-[#1a1a1a] text-white border-black shadow-md ring-2 ring-emerald-400'
                    : 'bg-[#f9f8f5] hover:bg-gray-100 text-slate-900 border-[#e5e4e1]'
                }`}
              >
                <div className="flex justify-between items-center text-[9px] uppercase font-bold tracking-wider">
                  <span className={isCurrentTarget ? 'text-emerald-400' : 'text-gray-500'}>{lvl.label}</span>
                  <span className={isCurrentTarget ? 'bg-emerald-500 text-black px-1 rounded font-black' : 'text-slate-800 font-extrabold'}>
                    {lvl.rVal}R
                  </span>
                </div>
                <div>
                  <span className={`text-base font-black block font-mono ${isCurrentTarget ? 'text-white' : 'text-slate-900'}`}>
                    {formatCurrency(targetP, currencySymbol)}
                  </span>
                  <span className={`text-[10px] font-bold block ${isCurrentTarget ? 'text-emerald-400' : 'text-emerald-700'}`}>
                    +{pctGain.toFixed(1)}% ({formatCurrency(totalProfitForLevel, currencySymbol)})
                  </span>
                </div>
                <button
                  type="button"
                  className={`w-full py-0.5 text-[9px] font-bold uppercase tracking-wider rounded transition-colors ${
                    isCurrentTarget
                      ? 'bg-emerald-500 text-black font-black'
                      : 'bg-white hover:bg-gray-200 text-slate-800 border border-gray-300'
                  }`}
                >
                  {isCurrentTarget ? 'Active Target' : 'Set Target'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};

interface TradePlanCardProps {
  stock: MinerviniTradeSetup;
}

export const TradePlanCard: React.FC<TradePlanCardProps> = ({ stock }) => {
  const [accountCapital, setAccountCapital] = useState<number>(50000);
  const [riskPercent, setRiskPercent] = useState<number>(1.0); // 1% account risk default
  const [desiredRRR, setDesiredRRR] = useState<number>(3.0); // User-defined RRR target (e.g. 1:2, 1:3)
  const [customEntryPrice, setCustomEntryPrice] = useState<number>(stock.pivotPrice);
  const [customStopPrice, setCustomStopPrice] = useState<number>(stock.stopLossPrice);

  // Persistent Trade Size State (Shares or Dollar Amount)
  const [tradeSizeMode, setTradeSizeMode] = useState<'SHARES' | 'DOLLAR'>('SHARES');
  const [tradeSizeValue, setTradeSizeValue] = useState<number>(0);

  // Sync custom inputs and load persisted trade size when stock changes
  useEffect(() => {
    setCustomEntryPrice(stock.pivotPrice);
    setCustomStopPrice(stock.stopLossPrice);

    try {
      const savedMode = localStorage.getItem(`sepa_trade_size_mode_${stock.ticker}`) as 'SHARES' | 'DOLLAR' | null;
      const savedVal = localStorage.getItem(`sepa_trade_size_val_${stock.ticker}`);

      if (savedMode && (savedMode === 'SHARES' || savedMode === 'DOLLAR')) {
        setTradeSizeMode(savedMode);
      } else {
        setTradeSizeMode('SHARES');
      }

      if (savedVal !== null && !isNaN(Number(savedVal)) && Number(savedVal) > 0) {
        setTradeSizeValue(Number(savedVal));
      } else {
        // Initial default: 1% risk rule calculation based on pivot entry & stop
        const validE = stock.pivotPrice;
        const validS = stock.stopLossPrice;
        const riskS = Math.max(0.01, validE - validS);
        const defaultShares = Math.floor((accountCapital * (riskPercent / 100)) / riskS);
        setTradeSizeValue(Math.max(10, defaultShares));
      }
    } catch (err) {
      console.error('Failed to load trade size settings from localStorage', err);
    }
  }, [stock.ticker, stock.pivotPrice, stock.stopLossPrice]);

  const handleUpdateTradeSizeMode = (newMode: 'SHARES' | 'DOLLAR') => {
    setTradeSizeMode(newMode);
    try {
      localStorage.setItem(`sepa_trade_size_mode_${stock.ticker}`, newMode);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateTradeSizeValue = (newVal: number) => {
    const val = Math.max(1, newVal);
    setTradeSizeValue(val);
    try {
      localStorage.setItem(`sepa_trade_size_val_${stock.ticker}`, val.toString());
    } catch (err) {
      console.error(err);
    }
  };

  // Exit Strategy Scenario Simulator State
  const [currentTradeStage, setCurrentTradeStage] = useState<'JUST_ENTERED' | 'IN_PROFIT_8' | 'HIT_TARGET1' | 'EXTENDED_30' | 'THREATENED'>('JUST_ENTERED');
  const [customCurrentPrice, setCustomCurrentPrice] = useState<number>(stock.currentPrice);

  useEffect(() => {
    setCustomCurrentPrice(stock.currentPrice);
  }, [stock.currentPrice, stock.ticker]);

  // User Trade Insights & Post-Mortem Notes state with LocalStorage persistence
  const [notes, setNotes] = useState<string>('');
  const [savedStatus, setSavedStatus] = useState<string | null>(null);

  const currencySymbol = getCurrencySymbol(stock.exchange);

  // Load persisted notes for ticker from LocalStorage on mount or ticker change
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`sepa_trade_notes_${stock.ticker}`);
      if (saved !== null) {
        setNotes(saved);
        setSavedStatus('Loaded saved insights');
      } else {
        setNotes('');
        setSavedStatus(null);
      }
    } catch (err) {
      console.error('Failed to read notes from localStorage', err);
    }
  }, [stock.ticker]);

  const handleSaveNotes = (textToSave?: string) => {
    const content = textToSave !== undefined ? textToSave : notes;
    try {
      localStorage.setItem(`sepa_trade_notes_${stock.ticker}`, content);
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setSavedStatus(`Saved at ${timeStr}`);
    } catch (err) {
      console.error('Failed to save notes to localStorage', err);
      setSavedStatus('Error saving');
    }
  };

  const handleClearNotes = () => {
    try {
      localStorage.removeItem(`sepa_trade_notes_${stock.ticker}`);
      setNotes('');
      setSavedStatus('Cleared');
    } catch (err) {
      console.error('Failed to clear notes', err);
    }
  };

  const handleInsertTemplate = () => {
    const pEntry = customEntryPrice > 0 ? customEntryPrice : stock.pivotPrice;
    const pStop = customStopPrice > 0 ? customStopPrice : stock.stopLossPrice;
    const pRisk = Math.max(0.01, pEntry - pStop);
    const pRiskPct = ((pEntry - pStop) / pEntry) * 100;

    const template = `=== SEPA POST-MORTEM & EXECUTION JOURNAL: ${stock.ticker} (${stock.name}) ===
• Pivot Entry: ${formatCurrency(pEntry, currencySymbol)} | Initial Stop (1R): ${formatCurrency(pStop, currencySymbol)} (-${pRiskPct.toFixed(2)}%)
• Auto Exit Levels: 1R Break-Even: ${formatCurrency(pEntry + pRisk, currencySymbol)} | 2R Target: ${formatCurrency(pEntry + 2 * pRisk, currencySymbol)} | 3R Target: ${formatCurrency(pEntry + 3 * pRisk, currencySymbol)}
• Trade Thesis Rationale: Tight VCP contraction with volume dry-up near pivot level.
• Post-Mortem Analysis & Self-Audit:
  - What went well (Execution & Discipline):
  - Slip-ups / Emotional mistakes:
  - Execution Grade: [ A+ / A / B / C / F ]
  - Key Takeaway for Future Trades:`;

    const newNotes = notes ? `${notes}\n\n${template}` : template;
    setNotes(newNotes);
    handleSaveNotes(newNotes);
  };

  // Breakout Probability Score Calculation
  const breakoutProb = calculateBreakoutProbability(stock);

  // Dynamic Risk-Reward calculations based on Pivot Entry, Target & Stop Loss
  const pivotEntry = customEntryPrice > 0 ? customEntryPrice : stock.pivotPrice;
  const currentStopLoss = customStopPrice > 0 ? customStopPrice : stock.stopLossPrice;
  const riskPerShare = Math.max(0.01, pivotEntry - currentStopLoss);
  const riskPercentFromPivot = ((pivotEntry - currentStopLoss) / pivotEntry) * 100;

  // Computed Target Price based on user-defined RRR
  const computedTargetPriceFromRRR = pivotEntry + (riskPerShare * desiredRRR);
  const [customTargetPrice, setCustomTargetPrice] = useState<number>(computedTargetPriceFromRRR);

  // Sync customTargetPrice when desiredRRR changes via quick buttons
  useEffect(() => {
    setCustomTargetPrice(Number((pivotEntry + (riskPerShare * desiredRRR)).toFixed(2)));
  }, [desiredRRR, pivotEntry, riskPerShare]);

  // Target 1 Dynamic R/R
  const rewardT1 = Math.max(0, stock.target1Price - pivotEntry);
  const dynamicRRRatioT1 = riskPerShare > 0 ? rewardT1 / riskPerShare : 0;

  // Target 2 Dynamic R/R
  const rewardT2 = Math.max(0, stock.target2Price - pivotEntry);
  const dynamicRRRatioT2 = riskPerShare > 0 ? rewardT2 / riskPerShare : 0;

  // Custom Target Dynamic R/R
  const rewardCustom = Math.max(0, customTargetPrice - pivotEntry);
  const dynamicCustomRRRatio = riskPerShare > 0 ? rewardCustom / riskPerShare : 0;

  const posSizeDefault = calculatePositionSize(
    accountCapital,
    riskPercent,
    pivotEntry,
    currentStopLoss
  );

  const activeTradeSizeShares = tradeSizeValue > 0
    ? (tradeSizeMode === 'SHARES' ? Math.round(tradeSizeValue) : Math.floor(tradeSizeValue / pivotEntry))
    : posSizeDefault.shareQuantity;

  const posSize = {
    ...posSizeDefault,
    shareQuantity: Math.max(1, activeTradeSizeShares),
    totalPositionCost: Math.max(1, activeTradeSizeShares) * pivotEntry,
    riskAmount: Math.max(1, activeTradeSizeShares) * riskPerShare,
    portfolioAllocationPercent: accountCapital > 0 ? ((Math.max(1, activeTradeSizeShares) * pivotEntry) / accountCapital) * 100 : 0,
  };

  return (
    <div className="bg-white border border-[#e5e4e1] p-6 shadow-xs space-y-6">
      
      {/* Title Header - Editorial Style */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e4e1] pb-4">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-[#1a1a1a] text-white flex items-center justify-center font-serif italic font-bold">
            P
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#b5a68d]">Execution Protocol</span>
            <h3 className="text-lg font-serif font-black text-[#1a1a1a] leading-tight">
              Trade Execution Plan — {stock.ticker}
            </h3>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => generateSepaPdfReport(stock, { accountCapital, riskPercent })}
            className="bg-[#1a1a1a] hover:bg-black text-amber-300 border border-black text-[10px] uppercase tracking-[0.15em] px-3 py-1 font-bold flex items-center space-x-1.5 transition-all shadow-2xs cursor-pointer group"
            title="Export full SEPA Trade Setup blueprint & position size report to PDF"
          >
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            <span>Export PDF Report</span>
          </button>

          <button
            onClick={() => {
              let savedEntryDate = '';
              try {
                savedEntryDate = localStorage.getItem(`sepa_trade_entry_date_${stock.ticker}`) || '';
              } catch (e) {}
              let daysHeld: number | null = null;
              if (savedEntryDate) {
                const ed = new Date(savedEntryDate + 'T00:00:00');
                if (!isNaN(ed.getTime())) {
                  const now = new Date();
                  now.setHours(0, 0, 0, 0);
                  daysHeld = Math.max(0, Math.floor((now.getTime() - ed.getTime()) / (1000 * 60 * 60 * 24)));
                }
              }

              let isTrailOn = false;
              let tStopPrice: number | undefined = undefined;
              let tParamStr: string | undefined = undefined;
              try {
                isTrailOn = localStorage.getItem(`sepa_trail_stop_enabled_${stock.ticker}`) === 'true';
                const savedMode = localStorage.getItem(`sepa_trail_stop_mode_${stock.ticker}`);
                const savedMult = localStorage.getItem(`sepa_trail_stop_mult_${stock.ticker}`);
                const savedPct = localStorage.getItem(`sepa_trail_stop_pct_${stock.ticker}`);
                const volM = calculateDailyVolatilityMetrics(stock);
                const atr = volM.atr14 || (pivotEntry * 0.03);
                if (savedMode === 'PERCENT' && savedPct) {
                  const pct = Number(savedPct) || 5;
                  const dist = (pct / 100) * stock.currentPrice;
                  tStopPrice = Math.max(0.01, Number((stock.currentPrice - dist).toFixed(2)));
                  tParamStr = `${pct}% Fixed Trail`;
                } else {
                  const mult = Number(savedMult) || 2;
                  const dist = mult * atr;
                  tStopPrice = Math.max(0.01, Number((stock.currentPrice - dist).toFixed(2)));
                  tParamStr = `${mult}x ATR (${formatCurrency(atr, currencySymbol)})`;
                }
              } catch (e) {}

              exportDetailedTradeParametersToCsv({
                stock,
                entryPrice: pivotEntry,
                stopLossPrice: currentStopLoss,
                targetPrice: customTargetPrice,
                shares: posSize.shareQuantity,
                totalPositionCost: posSize.totalPositionCost,
                riskPerShare,
                totalDollarRisk: posSize.riskAmount,
                rMultiple: dynamicCustomRRRatio,
                target3RPrice: pivotEntry + (3 * riskPerShare),
                potentialTotalGain3R: posSize.shareQuantity * (3 * riskPerShare),
                isTrailingStopEnabled: isTrailOn,
                trailingStopPrice: tStopPrice,
                trailingStopParamStr: tParamStr,
                notes,
                entryDate: savedEntryDate,
                daysInTrade: daysHeld,
              });
            }}
            className="bg-[#f9f8f5] hover:bg-black hover:text-white text-[#1a1a1a] border border-[#e5e4e1] text-[10px] uppercase tracking-[0.15em] px-3 py-1 font-bold flex items-center space-x-1.5 transition-all shadow-2xs cursor-pointer group"
            title="Export this stock's trade plan parameters (entry, stop, position size, R-Multiple) & saved insights to CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 group-hover:text-amber-400" />
            <span>Export Plan CSV</span>
          </button>

          {/* Tight Volume Badge */}
          {stock.isTightVolume ? (
            <div className="bg-[#1a1a1a] text-white text-[10px] uppercase tracking-[0.2em] px-3 py-1 font-semibold flex items-center space-x-1.5">
              <Droplets className="w-3.5 h-3.5 text-cyan-300" />
              <span>Volume Dry-Up ({stock.volumeDryUpPercent}%)</span>
            </div>
          ) : (
            <div className="bg-[#1a1a1a] text-white text-[10px] uppercase tracking-[0.2em] px-3 py-1 font-semibold flex items-center space-x-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-300" />
              <span>Breakout Pending</span>
            </div>
          )}
        </div>
      </div>

      {/* Grid of Key Execution Levels */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* 1. Pivot Entry Price & Buy Zone */}
        <div className="bg-[#f9f8f5] border border-[#e5e4e1] p-4 relative group">
          <div className="absolute top-0 right-0 bg-[#1a1a1a] text-white text-[9px] uppercase tracking-[0.15em] px-2 py-0.5 font-semibold">
            Pivot
          </div>
          <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#b5a68d] flex items-center space-x-1">
            <ArrowUpRight className="w-3.5 h-3.5 text-[#1a1a1a]" />
            <span>Pivot Entry</span>
          </p>
          <div className="mt-2 flex items-baseline space-x-1">
            <span className="text-3xl font-mono font-bold text-[#1a1a1a]">
              {formatCurrency(stock.pivotPrice, currencySymbol)}
            </span>
          </div>
          <div className="mt-3 text-[11px] text-gray-500 border-t border-[#e5e4e1] pt-2 font-mono">
            Buy Zone: <strong className="text-[#1a1a1a]">{formatCurrency(stock.pivotPrice, currencySymbol)} - {formatCurrency(stock.buyZoneMax, currencySymbol)}</strong>
          </div>
        </div>

        {/* 2. Stop Loss Exit Price */}
        <div className="bg-red-50/40 border border-red-200 p-4 relative group">
          <div className="absolute top-0 right-0 bg-red-600 text-white text-[9px] uppercase tracking-[0.15em] px-2 py-0.5 font-semibold">
            Tight Stop
          </div>
          <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-red-700 flex items-center space-x-1">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Exit Stop Loss</span>
          </p>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-3xl font-mono font-bold text-red-600">
              {formatCurrency(stock.stopLossPrice, currencySymbol)}
            </span>
            <span className="text-xs font-bold text-red-700 font-mono">
              (-{stock.stopLossPercent}%)
            </span>
          </div>
          <div className="mt-3 text-[11px] text-red-700/80 border-t border-red-200 pt-2 font-mono">
            Risk Per Share: <strong>{formatCurrency(stock.pivotPrice - stock.stopLossPrice, currencySymbol)}</strong>
          </div>
        </div>

        {/* 3. Profit Target 1 (3:1 R/R) */}
        <div className="bg-emerald-50/40 border border-emerald-200 p-4 relative group">
          <div className="absolute top-0 right-0 bg-emerald-800 text-white text-[9px] uppercase tracking-[0.15em] px-2 py-0.5 font-semibold">
            Target 1 (R/R {dynamicRRRatioT1.toFixed(1)}:1)
          </div>
          <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-emerald-800 flex items-center space-x-1">
            <Target className="w-3.5 h-3.5" />
            <span>Profit Target 1</span>
          </p>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-3xl font-mono font-bold text-emerald-800">
              {formatCurrency(stock.target1Price, currencySymbol)}
            </span>
            <span className="text-xs font-bold text-emerald-800 font-mono">
              (+{stock.target1Percent}%)
            </span>
          </div>
          <div className="mt-3 text-[11px] text-emerald-800/80 border-t border-emerald-200 pt-2 font-mono flex justify-between">
            <span>Dynamic R/R Ratio:</span>
            <strong className="text-emerald-900 font-extrabold">{dynamicRRRatioT1.toFixed(2)} : 1</strong>
          </div>
        </div>

        {/* 4. Profit Target 2 (Extended / Runner) */}
        <div className="bg-[#f9f8f5] border border-[#e5e4e1] p-4 relative group">
          <div className="absolute top-0 right-0 bg-[#1a1a1a] text-white text-[9px] uppercase tracking-[0.15em] px-2 py-0.5 font-semibold">
            Extended (R/R {dynamicRRRatioT2.toFixed(1)}:1)
          </div>
          <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#b5a68d] flex items-center space-x-1">
            <Layers className="w-3.5 h-3.5 text-[#1a1a1a]" />
            <span>Target 2 (Runner)</span>
          </p>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-3xl font-mono font-bold text-[#1a1a1a]">
              {formatCurrency(stock.target2Price, currencySymbol)}
            </span>
            <span className="text-xs font-bold text-gray-600 font-mono">
              (+{stock.target2Percent}%)
            </span>
          </div>
          <div className="mt-3 text-[11px] text-gray-500 border-t border-[#e5e4e1] pt-2 font-mono flex justify-between">
            <span>Dynamic R/R Ratio:</span>
            <strong className="text-[#1a1a1a] font-extrabold">{dynamicRRRatioT2.toFixed(2)} : 1</strong>
          </div>
        </div>

      </div>

      {/* Visual Progress Bar for VCP Pattern Contraction Phases & Volume Dry-Up */}
      <VcpContractionProgressBar stock={stock} currencySymbol={currencySymbol} />

      {/* Dynamic Risk-to-Reward Ratio (RRR) Visualizer Bar */}
      <RiskRewardRatioVisualizer
        entryPrice={pivotEntry}
        stopLossPrice={currentStopLoss}
        targetPrice={customTargetPrice}
        currencySymbol={currencySymbol}
        onUpdateEntryPrice={(newEntry) => setCustomEntryPrice(newEntry)}
        onUpdateStopLossPrice={(newStop) => setCustomStopPrice(newStop)}
        onUpdateTargetPrice={(newTarget) => setCustomTargetPrice(newTarget)}
      />

      {/* SEPA Mathematical Expectancy & Strategy Edge Module */}
      <TradeExpectancyModule
        stock={stock}
        currencySymbol={currencySymbol}
        entryPrice={pivotEntry}
        stopLossPrice={currentStopLoss}
        targetPrice={customTargetPrice}
      />

      {/* R-Multiple Risk/Reward Ratio Interactive Calculator Tool */}
      <InteractiveRMultipleCalculatorTool
        stock={stock}
        currencySymbol={currencySymbol}
        accountCapital={accountCapital}
        entryPrice={pivotEntry}
        stopLossPrice={currentStopLoss}
        targetPrice={customTargetPrice}
        tradeSizeMode={tradeSizeMode}
        tradeSizeValue={tradeSizeValue}
        onUpdateEntryPrice={(newEntry) => setCustomEntryPrice(newEntry)}
        onUpdateStopLossPrice={(newStop) => setCustomStopPrice(newStop)}
        onUpdateTargetPrice={(newTarget) => setCustomTargetPrice(newTarget)}
        onUpdateTradeSizeMode={handleUpdateTradeSizeMode}
        onUpdateTradeSizeValue={handleUpdateTradeSizeValue}
        notes={notes}
        savedStatus={savedStatus}
        onNotesChange={(newText) => {
          setNotes(newText);
          handleSaveNotes(newText);
        }}
        onClearNotes={handleClearNotes}
        onInsertTemplate={handleInsertTemplate}
      />

      {/* Dynamic Risk-Reward Ratio Engine & Visual Upside vs. Stop Loss Calculator */}
      <div className="bg-[#f9f8f5] border border-[#e5e4e1] p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e5e4e1] pb-3">
          <div className="flex items-center space-x-2">
            <Calculator className="w-4 h-4 text-[#1a1a1a]" />
            <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1a1a1a]">
              Visual Risk / Reward Ratio (RRR) Calculator & Potential Upside Engine
            </h4>
          </div>
          <div className="flex items-center space-x-2">
            <span className={`px-2.5 py-0.5 rounded font-mono text-xs font-extrabold ${
              dynamicCustomRRRatio >= 5.0
                ? 'bg-emerald-600 text-white'
                : dynamicCustomRRRatio >= 3.0
                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                : dynamicCustomRRRatio >= 2.0
                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                : 'bg-red-100 text-red-900 border border-red-300'
            }`}>
              {dynamicCustomRRRatio >= 5.0
                ? '🚀 CHAMPION GRADE (>= 5:1 R/R)'
                : dynamicCustomRRRatio >= 3.0
                ? '🟢 MINERVINI STANDARD (>= 3:1 R/R)'
                : dynamicCustomRRRatio >= 2.0
                ? '🟡 ACCEPTABLE MINIMUM (>= 2:1 R/R)'
                : '🔴 SUBPAR RISK-REWARD (< 2:1 R/R)'}
            </span>
          </div>
        </div>

        {/* Dynamic Interactive Risk/Reward Ratio Visual Gauge Dial */}
        <RiskRewardGauge
          ratio={dynamicCustomRRRatio}
          pivotEntry={pivotEntry}
          stopLoss={currentStopLoss}
          targetPrice={customTargetPrice}
          currencySymbol={currencySymbol}
        />

        {/* Quick RRR Preset Buttons & Slider */}
        <div className="space-y-3 bg-white p-4 border border-[#e5e4e1]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#b5a68d] flex items-center space-x-1">
              <Sliders className="w-3.5 h-3.5 text-slate-800" />
              <span>Select Desired Risk-Reward Ratio (RRR) Target Preset:</span>
            </span>
            <span className="text-xs font-mono font-bold text-[#1a1a1a] bg-emerald-50 border border-emerald-200 px-2.5 py-0.5">
              Active Ratio: <strong className="text-emerald-800 text-sm">1 : {desiredRRR.toFixed(1)}</strong>
            </span>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 font-mono text-xs">
            {[1.5, 2.0, 2.5, 3.0, 4.0, 5.0].map((ratio) => (
              <button
                key={ratio}
                onClick={() => setDesiredRRR(ratio)}
                className={`py-2 px-3 border font-bold transition-all cursor-pointer flex flex-col items-center justify-center ${
                  desiredRRR === ratio
                    ? 'bg-[#1a1a1a] text-white border-black shadow-sm'
                    : 'bg-[#f9f8f5] text-slate-800 border-[#e5e4e1] hover:bg-gray-100'
                }`}
              >
                <span className="text-[10px] text-gray-400 uppercase">Target RRR</span>
                <span className="text-sm">1 : {ratio}</span>
              </button>
            ))}
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono border-t border-gray-100">
            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <span className="text-[10px] uppercase font-bold text-gray-500 whitespace-nowrap">Custom RRR Slider:</span>
              <input
                type="range"
                min="1.0"
                max="6.0"
                step="0.25"
                value={desiredRRR}
                onChange={(e) => setDesiredRRR(Number(e.target.value))}
                className="w-48 accent-[#1a1a1a] cursor-pointer"
              />
              <span className="font-bold text-slate-900 bg-[#f9f8f5] px-2 py-0.5 border border-[#e5e4e1]">
                1:{desiredRRR.toFixed(2)}
              </span>
            </div>
            <div className="text-[11px] text-emerald-800 font-bold bg-emerald-50 px-3 py-1 border border-emerald-200">
              Computed Target Price: <span className="text-sm font-black font-mono">{formatCurrency(pivotEntry + (riskPerShare * desiredRRR), currencySymbol)}</span> (+{(((pivotEntry + (riskPerShare * desiredRRR) - pivotEntry) / pivotEntry) * 100).toFixed(1)}%)
            </div>
          </div>
        </div>

        {/* Dynamic Inputs & Live Calculation Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
          
          {/* Custom Target Price Input */}
          <div className="bg-white p-3 border border-[#e5e4e1] space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-gray-500 block">
              Adjust Target Price ({currencySymbol}):
            </label>
            <input
              type="number"
              step="0.10"
              value={customTargetPrice}
              onChange={(e) => setCustomTargetPrice(Number(e.target.value) || stock.target1Price)}
              className="w-full bg-[#f9f8f5] border border-[#e5e4e1] p-1.5 font-bold text-slate-900 text-sm focus:outline-none focus:border-slate-800"
            />
            <div className="flex justify-between text-[11px] text-gray-500 pt-1">
              <span>Target Gain:</span>
              <span className="font-bold text-emerald-700">
                +{(((customTargetPrice - pivotEntry) / pivotEntry) * 100).toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Custom Stop Loss Price Input */}
          <div className="bg-white p-3 border border-[#e5e4e1] space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-gray-500 block">
              Adjust Stop Loss ({currencySymbol}):
            </label>
            <input
              type="number"
              step="0.10"
              value={customStopPrice}
              onChange={(e) => setCustomStopPrice(Number(e.target.value) || stock.stopLossPrice)}
              className="w-full bg-[#f9f8f5] border border-[#e5e4e1] p-1.5 font-bold text-red-600 text-sm focus:outline-none focus:border-slate-800"
            />
            <div className="flex justify-between text-[11px] text-gray-500 pt-1">
              <span>Risk Per Share:</span>
              <span className="font-bold text-red-600">
                -{riskPercentFromPivot.toFixed(1)}% ({formatCurrency(riskPerShare, currencySymbol)})
              </span>
            </div>
          </div>

          {/* Calculated Dynamic R/R Ratio Display */}
          <div className="bg-[#1a1a1a] text-white p-3 border border-black flex flex-col justify-between">
            <span className="text-[10px] uppercase tracking-wider text-[#b5a68d] font-bold">
              Dynamic Risk-Reward Ratio:
            </span>
            <div className="text-3xl font-bold font-mono text-emerald-400 my-1">
              {dynamicCustomRRRatio.toFixed(2)} : 1
            </div>
            <p className="text-[10px] text-gray-400 leading-tight font-sans">
              Expected Reward: <strong className="text-white">{formatCurrency(rewardCustom, currencySymbol)}</strong> vs Risk: <strong className="text-red-400">{formatCurrency(riskPerShare, currencySymbol)}</strong> per share.
            </p>
          </div>

        </div>

        {/* Visual Upside Potential vs Defined Downside Risk Comparison Breakdown */}
        <div className="bg-white border border-[#e5e4e1] p-4 space-y-4 font-mono">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e5e4e1] pb-2">
            <span className="text-[11px] font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span>Potential Upside vs Defined Stop Loss Risk Matrix ({posSize.shareQuantity.toLocaleString()} shares)</span>
            </span>
            <span className="text-[10px] text-gray-500 font-sans">
              Quantifying dollar return per $1 dollar risked
            </span>
          </div>

          {/* 3 Metric Upside Cards vs Risk */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            
            {/* Downside Risk Card */}
            <div className="bg-red-50/50 border border-red-200 p-3 space-y-1.5">
              <div className="flex justify-between items-center text-red-700 text-[10px] uppercase font-bold">
                <span className="flex items-center space-x-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                  <span>Defined Stop Loss Risk</span>
                </span>
                <span className="bg-red-100 text-red-800 px-1.5 py-0.5 border border-red-300 text-[9px]">1.0x (1R)</span>
              </div>
              <div>
                <span className="text-2xl font-black text-red-600 block">
                  -{formatCurrency(posSize.riskAmount, currencySymbol)}
                </span>
                <span className="text-[11px] text-red-700 block font-bold">
                  -{riskPercentFromPivot.toFixed(1)}% Downside ({formatCurrency(riskPerShare, currencySymbol)}/sh)
                </span>
              </div>
              <p className="text-[10px] text-gray-600 font-sans border-t border-red-200 pt-1">
                Max account loss capped at <strong>{riskPercent}%</strong> of portfolio capital.
              </p>
            </div>

            {/* Target 1 Upside Card */}
            <div className="bg-emerald-50/50 border border-emerald-200 p-3 space-y-1.5">
              <div className="flex justify-between items-center text-emerald-800 text-[10px] uppercase font-bold">
                <span className="flex items-center space-x-1">
                  <Target className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Target 1 Potential Upside</span>
                </span>
                <span className="bg-emerald-100 text-emerald-900 px-1.5 py-0.5 border border-emerald-300 text-[9px] font-black">
                  {dynamicRRRatioT1.toFixed(1)}x ({dynamicRRRatioT1.toFixed(1)}R)
                </span>
              </div>
              <div>
                <span className="text-2xl font-black text-emerald-700 block">
                  +{formatCurrency(rewardT1 * posSize.shareQuantity, currencySymbol)}
                </span>
                <span className="text-[11px] text-emerald-800 block font-bold">
                  +{stock.target1Percent}% Upside ({formatCurrency(rewardT1, currencySymbol)}/sh)
                </span>
              </div>
              <p className="text-[10px] text-gray-600 font-sans border-t border-emerald-200 pt-1">
                50% partial scale-out target price at <strong className="text-emerald-800">{formatCurrency(stock.target1Price, currencySymbol)}</strong>.
              </p>
            </div>

            {/* Target 2 / Custom Upside Card */}
            <div className="bg-purple-50/50 border border-purple-200 p-3 space-y-1.5">
              <div className="flex justify-between items-center text-purple-900 text-[10px] uppercase font-bold">
                <span className="flex items-center space-x-1">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  <span>Target 2 / Custom Upside</span>
                </span>
                <span className="bg-purple-100 text-purple-900 px-1.5 py-0.5 border border-purple-300 text-[9px] font-black">
                  {dynamicCustomRRRatio.toFixed(1)}x ({dynamicCustomRRRatio.toFixed(1)}R)
                </span>
              </div>
              <div>
                <span className="text-2xl font-black text-purple-900 block">
                  +{formatCurrency(rewardCustom * posSize.shareQuantity, currencySymbol)}
                </span>
                <span className="text-[11px] text-purple-900 block font-bold">
                  +{(((customTargetPrice - pivotEntry) / pivotEntry) * 100).toFixed(1)}% Upside ({formatCurrency(rewardCustom, currencySymbol)}/sh)
                </span>
              </div>
              <p className="text-[10px] text-gray-600 font-sans border-t border-purple-200 pt-1">
                Target exit price set at <strong className="text-purple-900">{formatCurrency(customTargetPrice, currencySymbol)}</strong>.
              </p>
            </div>

          </div>

          {/* Visual Progress / Ratio Comparison Bar */}
          <div className="space-y-1.5 pt-1 font-mono text-xs">
            <div className="flex justify-between text-[11px]">
              <span className="text-red-700 font-bold">Downside Risk: {formatCurrency(posSize.riskAmount, currencySymbol)} (-1.0R)</span>
              <span className="text-emerald-700 font-bold">Target 1 Upside: +{formatCurrency(rewardT1 * posSize.shareQuantity, currencySymbol)} (+{dynamicRRRatioT1.toFixed(1)}R)</span>
              <span className="text-purple-900 font-bold">Custom Upside: +{formatCurrency(rewardCustom * posSize.shareQuantity, currencySymbol)} (+{dynamicCustomRRRatio.toFixed(1)}R)</span>
            </div>
            <div className="w-full bg-gray-200 h-4 flex overflow-hidden rounded border border-gray-300">
              <div
                className="bg-red-600 h-full text-[10px] text-white font-bold flex items-center justify-center transition-all"
                style={{ width: `${Math.min(25, (1 / (1 + dynamicCustomRRRatio)) * 100)}%` }}
                title={`Max Downside Risk: ${formatCurrency(posSize.riskAmount, currencySymbol)}`}
              >
                1R Risk
              </div>
              <div
                className="bg-emerald-600 h-full text-[10px] text-white font-bold flex items-center justify-center transition-all border-l border-white/30"
                style={{ width: `${Math.min(45, (dynamicRRRatioT1 / (1 + dynamicCustomRRRatio)) * 100)}%` }}
                title={`Target 1 Reward: +${formatCurrency(rewardT1 * posSize.shareQuantity, currencySymbol)}`}
              >
                {dynamicRRRatioT1.toFixed(1)}R T1
              </div>
              <div
                className="bg-purple-700 h-full text-[10px] text-white font-bold flex items-center justify-center transition-all border-l border-white/30"
                style={{ width: `${Math.max(30, (dynamicCustomRRRatio / (1 + dynamicCustomRRRatio)) * 100)}%` }}
                title={`Custom Target Reward: +${formatCurrency(rewardCustom * posSize.shareQuantity, currencySymbol)}`}
              >
                {dynamicCustomRRRatio.toFixed(1)}R Custom Upside
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Volume Contraction Analysis Box */}
      <div className="bg-[#f9f8f5] border border-[#e5e4e1] p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center space-x-2">
            <Droplets className="w-4 h-4 text-[#1a1a1a]" />
            <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1a1a1a]">
              VCP Contraction Contractions & Volume Contraction Timeline
            </h4>
          </div>
          <div className="text-xs text-gray-500 font-mono">
            Pivot Vol: <span className="text-[#1a1a1a] font-bold">{formatVolume(stock.pivotVolume)}</span> vs 20D Avg: <span className="text-gray-700 font-bold">{formatVolume(stock.avgVolume20d)}</span>
          </div>
        </div>

        {/* Contraction Steps Timeline */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {stock.contractions.map((c) => (
            <div
              key={c.contractionIndex}
              className="bg-white border border-[#e5e4e1] p-3 text-xs flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="font-serif italic font-bold text-[#1a1a1a]">
                  Contraction T{c.contractionIndex}
                </span>
                <span className="text-[10px] font-mono text-gray-500">
                  {c.durationDays} Days
                </span>
              </div>
              <div className="my-2 flex items-baseline space-x-2">
                <span className="text-xl font-serif font-black text-[#1a1a1a]">
                  -{c.depthPercent}%
                </span>
                <span className="text-[10px] text-gray-400 uppercase tracking-wider">Depth</span>
              </div>
              <div className="text-[10px] text-gray-500 border-t border-[#e5e4e1] pt-1.5 flex justify-between font-mono">
                <span>Vol Dry-up:</span>
                <strong className={c.volumeDryUpPercent < -50 ? 'text-cyan-800 font-bold' : 'text-gray-700'}>
                  {c.volumeDryUpPercent}%
                </strong>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Smart Stop Loss Adjuster & Dynamic Trailing Traps */}
      <SmartStopAdjuster
        stock={stock}
        customStopPrice={customStopPrice}
        onUpdateStopPrice={(newStop) => setCustomStopPrice(newStop)}
      />

      {/* Interactive R:R Ratio & Variable Stop-Loss Profit Calculator Component */}
      <InteractiveRRSlider
        stock={stock}
        accountCapital={accountCapital}
        positionShareQuantity={posSize.shareQuantity}
        currentStopPrice={customStopPrice}
        currentTargetPrice={customTargetPrice}
        onUpdateStopPrice={(newStop) => setCustomStopPrice(newStop)}
        onUpdateTargetPrice={(newTarget) => setCustomTargetPrice(newTarget)}
      />

      {/* Position Sizing Calculator Module */}
      <div className="bg-white border border-[#e5e4e1] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e5e4e1] pb-3">
          <div className="flex items-center space-x-2">
            <Calculator className="w-4 h-4 text-[#1a1a1a]" />
            <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1a1a1a]">
              Minervini Position Sizing Calculator (1% - 2% Account Risk Rule)
            </h4>
          </div>
          <span className="text-[11px] font-mono text-gray-500">
            Account Risk Cap: <strong className="text-red-600">{formatCurrency(posSize.riskAmount, currencySymbol)}</strong>
          </span>
        </div>

        {/* Capital Presets Bar */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#b5a68d] mr-1">
            Quick Capital Presets:
          </span>
          {[10000, 25000, 50000, 100000, 250000].map((preset) => (
            <button
              key={preset}
              onClick={() => setAccountCapital(preset)}
              className={`px-2.5 py-1 text-[11px] font-bold border transition ${
                accountCapital === preset
                  ? 'bg-[#1a1a1a] text-white border-black'
                  : 'bg-[#f9f8f5] text-slate-800 border-[#e5e4e1] hover:bg-gray-200'
              }`}
            >
              {formatCurrency(preset, currencySymbol, 0)}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 text-xs">
          
          {/* Inputs Column */}
          <div className="space-y-3 bg-[#f9f8f5] p-4 border border-[#e5e4e1]">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#b5a68d] mb-1">
                Total Portfolio Capital ({currencySymbol})
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-gray-500 font-mono text-xs">
                  {currencySymbol}
                </span>
                <input
                  type="number"
                  value={accountCapital}
                  onChange={(e) => setAccountCapital(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full bg-white border border-[#e5e4e1] rounded-none pl-7 pr-3 py-1.5 text-[#1a1a1a] font-mono text-xs font-bold focus:border-black focus:outline-none"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#b5a68d]">
                  Risk Per Trade (%)
                </label>
                <span className="font-mono text-[#1a1a1a] font-extrabold bg-white px-2 py-0.5 border border-[#e5e4e1] text-[11px]">
                  {riskPercent.toFixed(2)}%
                </span>
              </div>
              <input
                type="range"
                min="0.25"
                max="2.5"
                step="0.25"
                value={riskPercent}
                onChange={(e) => setRiskPercent(Number(e.target.value))}
                className="w-full accent-[#1a1a1a] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-gray-400 font-mono mt-0.5">
                <span>0.25% (Conservative)</span>
                <span>1.0% (Standard)</span>
                <span>2.5% (Max Champion)</span>
              </div>
            </div>

            <div className="pt-2 border-t border-[#e5e4e1] text-[11px] font-mono space-y-1 text-gray-600">
              <div className="flex justify-between">
                <span>Entry Price:</span>
                <strong className="text-slate-900">{formatCurrency(pivotEntry, currencySymbol)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Stop Loss Price:</span>
                <strong className="text-red-600">{formatCurrency(currentStopLoss, currencySymbol)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Distance to Stop:</span>
                <strong className="text-red-600">-{riskPercentFromPivot.toFixed(2)}%</strong>
              </div>
            </div>
          </div>

          {/* Capital Risk Breakdown */}
          <div className="bg-[#f9f8f5] p-4 border border-[#e5e4e1] flex flex-col justify-between space-y-3 font-mono">
            <div>
              <span className="text-gray-500 block text-[10px] uppercase tracking-wider font-bold">
                Max Dollar Risk Allowed ({riskPercent}%):
              </span>
              <span className="text-2xl font-bold text-red-600 block mt-1">
                {formatCurrency(posSize.riskAmount, currencySymbol)}
              </span>
            </div>

            <div>
              <span className="text-gray-500 block text-[10px] uppercase tracking-wider font-bold">
                Risk Per Share:
              </span>
              <span className="text-sm font-bold text-[#1a1a1a] block">
                {formatCurrency(posSize.riskPerShare, currencySymbol)}
              </span>
            </div>

            <div className="pt-2 border-t border-[#e5e4e1]">
              <span className="text-gray-500 block text-[10px] uppercase tracking-wider font-bold">
                Portfolio Allocation:
              </span>
              <span className="text-sm font-bold text-slate-900">
                {posSize.portfolioAllocationPercent.toFixed(1)}% of Capital
              </span>
              {posSize.portfolioAllocationPercent > 25 && (
                <div className="mt-1 text-[10px] text-amber-900 bg-amber-100 p-1.5 rounded font-sans border border-amber-300">
                  ⚠️ <strong>Over-allocation Notice:</strong> Minervini rules suggest capping any single position at 20%-25% maximum of total equity.
                </div>
              )}
            </div>
          </div>

          {/* Exact Shares & Pyramiding Execution */}
          <div className="bg-[#1a1a1a] text-white p-4 border border-black flex flex-col justify-between space-y-3 font-mono">
            <div>
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#b5a68d] block">
                Calculated Share Quantity:
              </span>
              <span className="text-3xl font-bold text-emerald-400 mt-1 block">
                {posSize.shareQuantity.toLocaleString()} <span className="text-xs font-normal text-gray-300">shares</span>
              </span>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-gray-800 text-[11px]">
              <div className="flex justify-between">
                <span className="text-gray-400">Total Position Capital:</span>
                <strong className="text-white">{formatCurrency(posSize.totalPositionCost, currencySymbol)}</strong>
              </div>

              {/* Minervini Pyramid Plan (50% Pilot, 25% Add, 25% Add) */}
              <div className="bg-gray-900/80 p-2 rounded border border-gray-800 text-[10px] space-y-1 font-sans">
                <span className="font-bold text-[#b5a68d] block font-mono">Pyramid Sizing Execution:</span>
                <div className="flex justify-between text-gray-300 font-mono">
                  <span>• Pilot Entry (50%):</span>
                  <strong className="text-emerald-400">{Math.floor(posSize.shareQuantity * 0.5).toLocaleString()} sh</strong>
                </div>
                <div className="flex justify-between text-gray-300 font-mono">
                  <span>• Add #1 at +2% (25%):</span>
                  <strong className="text-white">{Math.floor(posSize.shareQuantity * 0.25).toLocaleString()} sh</strong>
                </div>
                <div className="flex justify-between text-gray-300 font-mono">
                  <span>• Add #2 at +4% (25%):</span>
                  <strong className="text-white">{Math.floor(posSize.shareQuantity * 0.25).toLocaleString()} sh</strong>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Estimated Breakout Probability Score Module */}
      <div className="bg-[#f9f8f5] border border-[#e5e4e1] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e5e4e1] pb-3">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1a1a1a]">
              Estimated Breakout Probability Engine
            </h4>
          </div>
          <span className={`px-2.5 py-0.5 rounded font-mono text-[11px] font-extrabold uppercase ${
            breakoutProb.score >= 88
              ? 'bg-emerald-600 text-white'
              : breakoutProb.score >= 75
              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
              : 'bg-amber-100 text-amber-900 border border-amber-300'
          }`}>
            {breakoutProb.rating}
          </span>
        </div>

        {/* Big Meter & Breakdown Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          
          {/* Main Score Gauge */}
          <div className="lg:col-span-4 bg-white p-4 border border-[#e5e4e1] flex flex-col items-center justify-center text-center space-y-2">
            <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-gray-500">
              Breakout Probability Score
            </span>
            <div className="relative flex items-center justify-center">
              <div className="text-4xl font-extrabold font-mono text-slate-900 tracking-tight">
                {breakoutProb.score}<span className="text-xl text-amber-600">%</span>
              </div>
            </div>

            {/* Score Bar */}
            <div className="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden mt-1">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  breakoutProb.score >= 88
                    ? 'bg-emerald-600'
                    : breakoutProb.score >= 75
                    ? 'bg-emerald-500'
                    : breakoutProb.score >= 60
                    ? 'bg-amber-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${breakoutProb.score}%` }}
              />
            </div>
            <p className="text-[10px] text-gray-500 font-sans leading-tight">
              Calculated based on VCP final tightness, volume dry-up, RS percentile & Trend Template rules.
            </p>
          </div>

          {/* 4 Factor Cards Grid */}
          <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
            
            {/* Factor 1: VCP Tightness */}
            <div className="bg-white p-3 border border-[#e5e4e1] space-y-1">
              <div className="flex justify-between items-center text-gray-500 text-[10px] uppercase font-bold">
                <span className="flex items-center space-x-1">
                  <Zap className="w-3 h-3 text-amber-600" />
                  <span>VCP Tightness</span>
                </span>
                <strong className="text-slate-900">{breakoutProb.vcpTightnessScore} / 35 pts</strong>
              </div>
              <div className="text-sm font-bold text-slate-900">
                -{breakoutProb.factors.finalContractionDepth}% Final Depth
              </div>
              <div className="text-[10px] text-gray-500">
                Squeeze Compression: <strong className="text-emerald-700">-{breakoutProb.factors.squeezeCompressionPercent}%</strong> reduction from T1 base.
              </div>
            </div>

            {/* Factor 2: Volume Dry-up */}
            <div className="bg-white p-3 border border-[#e5e4e1] space-y-1">
              <div className="flex justify-between items-center text-gray-500 text-[10px] uppercase font-bold">
                <span className="flex items-center space-x-1">
                  <Droplets className="w-3 h-3 text-cyan-600" />
                  <span>Volume Dry-Up Trend</span>
                </span>
                <strong className="text-slate-900">{breakoutProb.volumeDryUpScore} / 30 pts</strong>
              </div>
              <div className="text-sm font-bold text-slate-900">
                {breakoutProb.factors.volumeDryUpPercent}% vs 20d Avg
              </div>
              <div className="text-[10px] text-gray-500">
                Status: <strong className={stock.isTightVolume ? "text-cyan-700 font-bold" : "text-gray-700"}>
                  {stock.isTightVolume ? '💧 Tight Volume Confirmed' : 'Standard Contraction'}
                </strong>
              </div>
            </div>

            {/* Factor 3: Relative Strength */}
            <div className="bg-white p-3 border border-[#e5e4e1] space-y-1">
              <div className="flex justify-between items-center text-gray-500 text-[10px] uppercase font-bold">
                <span className="flex items-center space-x-1">
                  <TrendingUp className="w-3 h-3 text-emerald-600" />
                  <span>RS Leadership</span>
                </span>
                <strong className="text-slate-900">{breakoutProb.rsLeadershipScore} / 20 pts</strong>
              </div>
              <div className="text-sm font-bold text-slate-900">
                RS {breakoutProb.factors.rsRating} Percentile
              </div>
              <div className="text-[10px] text-gray-500">
                {breakoutProb.factors.rsRating >= 90 ? '🔥 Top 10% Market Leader' : 'Solid Relative Strength'}
              </div>
            </div>

            {/* Factor 4: Trend Alignment */}
            <div className="bg-white p-3 border border-[#e5e4e1] space-y-1">
              <div className="flex justify-between items-center text-gray-500 text-[10px] uppercase font-bold">
                <span className="flex items-center space-x-1">
                  <ShieldCheck className="w-3 h-3 text-blue-600" />
                  <span>SEPA Trend Rules</span>
                </span>
                <strong className="text-slate-900">{breakoutProb.trendAlignmentScore} / 15 pts</strong>
              </div>
              <div className="text-sm font-bold text-slate-900">
                {breakoutProb.factors.trendScore} / 8 Rules Passed
              </div>
              <div className="text-[10px] text-gray-500">
                Moving Averages Stage 2 Uptrend Alignment
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* Upcoming Earnings Release & Minervini Gap Risk Warning */}
      {stock.nextEarningsDate && (
        <div className={`p-4 rounded-lg border text-xs flex items-start space-x-3 ${
          stock.daysToEarnings !== undefined && stock.daysToEarnings <= 5
            ? 'bg-red-50 border-red-300 text-red-900'
            : stock.daysToEarnings !== undefined && stock.daysToEarnings <= 14
            ? 'bg-amber-50 border-amber-300 text-amber-900'
            : 'bg-emerald-50 border-emerald-300 text-emerald-900'
        }`}>
          <div className="p-2 rounded bg-white shadow-xs shrink-0 font-extrabold text-xs">
            {stock.daysToEarnings !== undefined && stock.daysToEarnings <= 5 ? '🔴 HAZARD' : stock.daysToEarnings !== undefined && stock.daysToEarnings <= 14 ? '🟡 CAUTION' : '🟢 SAFE'}
          </div>
          <div className="space-y-1">
            <div className="font-bold text-sm flex items-center space-x-2">
              <span>Next Earnings Release: {stock.nextEarningsDate} ({stock.earningsTime || 'AMC'})</span>
              <span className="px-2 py-0.5 rounded bg-white/80 font-mono text-[11px] font-extrabold">
                {stock.daysToEarnings !== undefined && stock.daysToEarnings < 0
                  ? `Reported ${Math.abs(stock.daysToEarnings)}d Ago`
                  : stock.daysToEarnings === 0
                  ? 'TODAY'
                  : `In ${stock.daysToEarnings} Days`}
              </span>
            </div>
            <p className="leading-relaxed">
              <strong>Minervini SEPA Earnings Guard:</strong>{' '}
              {stock.daysToEarnings !== undefined && stock.daysToEarnings <= 5
                ? 'High danger of overnight gap volatility. Minervini rule forbids new pivot purchases <5 days before earnings unless you already hold a >10% profit cushion.'
                : stock.daysToEarnings !== undefined && stock.daysToEarnings <= 14
                ? 'Quarterly report approaching in 1 to 2 weeks. Maintain tight stop loss management and lock partial profits quickly if breakout surges.'
                : 'Earnings report is comfortably far in the future. Safe window to trade the VCP breakout pattern.'}
            </p>
          </div>
        </div>
      )}

      {/* Stan Weinstein & Mark Minervini 4-Stage Identifier Panel */}
      <StageIdentifierPanel stock={stock} currencySymbol={currencySymbol} />

      {/* Interactive Trailing Stop Exit Calculator Panel */}
      <TrailingStopCalculatorPanel
        stock={stock}
        currencySymbol={currencySymbol}
        entryPrice={pivotEntry}
        initialStopLoss={currentStopLoss}
        activeShares={posSize.shareQuantity}
        onApplyStopLoss={(newStop) => {
          setCustomStopPrice(newStop);
        }}
      />

      {/* Daily Floor Pivots & ATR Volatility Matrix */}
      <DailyPivotAndVolatilityPanel stock={stock} />

      {/* Rule-Based Persistent Entry & Exit Signals Engine */}
      <RuleBasedEntryExitPanel stock={stock} />

      {/* Mark Minervini Exit Signals Component */}
      <ExitSignals stock={stock} />

      {/* Breakout Success Probability Engine */}
      <BreakoutProbabilityEngine stock={stock} />

      {/* Trade Insights & Post-Mortem Notes (Saved to Local Storage) */}
      <div className="bg-[#f9f8f5] border border-[#e5e4e1] p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e5e4e1] pb-3">
          <div className="flex items-center space-x-2">
            <FileText className="w-4 h-4 text-[#1a1a1a]" />
            <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1a1a1a]">
              Trader Insights & Post-Mortem Journal ({stock.ticker})
            </h4>
          </div>
          <div className="flex items-center space-x-2 font-mono text-xs">
            {savedStatus && (
              <span className="text-emerald-800 bg-emerald-50 px-2 py-0.5 border border-emerald-200 text-[10px] font-bold flex items-center space-x-1">
                <Check className="w-3 h-3 text-emerald-600" />
                <span>{savedStatus}</span>
              </span>
            )}
            <button
              onClick={handleInsertTemplate}
              type="button"
              className="bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-bold px-2.5 py-1 text-[10px] uppercase tracking-wider flex items-center space-x-1 transition-all cursor-pointer"
            >
              <StickyNote className="w-3 h-3 text-amber-700" />
              <span>+ Post-Mortem Template</span>
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <textarea
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              handleSaveNotes(e.target.value);
            }}
            placeholder={`Record your trade setup rationale, key catalyst observations, or post-mortem lessons for ${stock.ticker} here... (Auto-saved to local storage)`}
            rows={5}
            className="w-full bg-white border border-[#e5e4e1] p-3 font-mono text-xs text-[#1a1a1a] focus:border-black focus:outline-none placeholder:text-gray-400 placeholder:font-sans"
          />

          <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-gray-500 pt-1">
            <span className="italic font-sans">
              Notes are automatically persisted in your browser's local storage specifically for <strong className="font-mono text-[#1a1a1a]">{stock.ticker}</strong>.
            </span>
            <div className="flex items-center space-x-2">
              {notes && (
                <button
                  type="button"
                  onClick={handleClearNotes}
                  className="text-red-600 hover:text-red-800 text-[10px] uppercase font-bold flex items-center space-x-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear Notes</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => handleSaveNotes()}
                className="bg-[#1a1a1a] hover:bg-black text-white px-3 py-1 text-[10px] font-bold uppercase tracking-wider flex items-center space-x-1 shadow-xs transition-all cursor-pointer"
              >
                <Save className="w-3 h-3 text-emerald-400" />
                <span>Save Notes</span>
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

