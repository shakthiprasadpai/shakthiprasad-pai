import React, { useState, useEffect } from 'react';
import { MinerviniTradeSetup } from '../types';
import { calculatePositionSize, calculateBreakoutProbability, formatCurrency, formatVolume, getCurrencySymbol } from '../utils/sepaCalculator';
import { exportTradePlansToCsv } from '../utils/csvExport';
import { generateSepaPdfReport } from '../utils/pdfExporter';
import { ExitSignals } from './ExitSignals';
import { BreakoutProbabilityEngine } from './BreakoutProbabilityEngine';
import { RuleBasedEntryExitPanel } from './RuleBasedEntryExitPanel';
import { DailyPivotAndVolatilityPanel } from './DailyPivotAndVolatilityPanel';
import { Target, ShieldAlert, ArrowUpRight, Droplets, DollarSign, Calculator, Layers, Flame, Zap, Sparkles, TrendingUp, BarChart3, ShieldCheck, FileText, Save, Check, Trash2, Clock, StickyNote, FileSpreadsheet, LogOut, AlertTriangle, ArrowRightCircle, Sliders, CheckCircle2, RefreshCw, Bell, BellRing, BellOff } from 'lucide-react';

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
}) => {
  const validEntry = entryPrice > 0 ? entryPrice : stock.pivotPrice;
  const validStop = stopLossPrice > 0 ? stopLossPrice : stock.stopLossPrice;
  const validTarget = targetPrice > 0 ? targetPrice : stock.target1Price;

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

  // Automated Price Alert state for 3:1 R Target
  const [is3RAlertEnabled, setIs3RAlertEnabled] = useState<boolean>(false);
  const [alertTriggered, setAlertTriggered] = useState<boolean>(false);
  const [alertBannerMessage, setAlertBannerMessage] = useState<string | null>(null);

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
          <span className="text-[10px] text-gray-500 uppercase font-bold">R-Multiple:</span>
          <span className={`px-3 py-1 font-mono text-sm font-black border ${
            rMultiple >= 5.0
              ? 'bg-purple-900 text-white border-purple-950'
              : rMultiple >= 3.0
              ? 'bg-emerald-600 text-white border-emerald-700'
              : rMultiple >= 2.0
              ? 'bg-amber-100 text-amber-900 border-amber-300'
              : 'bg-red-100 text-red-900 border-red-300'
          }`}>
            {rMultiple.toFixed(2)} R
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
        
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
            <span className="text-[10px] text-red-700 font-bold bg-red-50 px-1.5 py-0.5 border border-red-200">
              Risk: -{riskPercent.toFixed(2)}%
            </span>
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
              <strong className="text-slate-900 font-bold">
                {activeShares.toLocaleString()} sh ({formatCurrency(totalPositionCost, currencySymbol)})
              </strong>
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

      </div>

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
    const template = `• Entry Setup Hypothesis: Tight VCP contraction near ${currencySymbol}${stock.pivotPrice.toFixed(2)} with volume dry-up.
• Risk Management: Stop loss set at ${currencySymbol}${stock.stopLossPrice.toFixed(2)} (-${stock.stopLossPercent}%).
• Post-Mortem Analysis:
  - What went well:
  - Execution Grade: A / B / C
  - Key Lessons:`;

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
            onClick={() => exportTradePlansToCsv([stock])}
            className="bg-[#f9f8f5] hover:bg-black hover:text-white text-[#1a1a1a] border border-[#e5e4e1] text-[10px] uppercase tracking-[0.15em] px-3 py-1 font-bold flex items-center space-x-1.5 transition-all shadow-2xs cursor-pointer group"
            title="Export this stock's trade plan parameters & saved insights to CSV"
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

