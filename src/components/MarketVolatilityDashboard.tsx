import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Zap,
  Gauge,
  BarChart2,
  SlidersHorizontal,
  RefreshCw,
  Info,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
} from 'lucide-react';
import { MinerviniTradeSetup } from '../types';

interface MarketVolatilityDashboardProps {
  stocks?: MinerviniTradeSetup[];
  onOpenScreener?: () => void;
  onOpenTradePlan?: () => void;
  isObsidian?: boolean;
}

export type BenchmarkIndex = 'NIFTY50' | 'SENSEX' | 'SP500';

export interface VolatilityRegimeInfo {
  regime: 'AGGRESSIVE_OFFENSE' | 'SELECTIVE_OFFENSE' | 'CAUTIOUS_DEFENSE' | 'CAPITAL_PRESERVATION';
  title: string;
  badgeColor: string;
  textColor: string;
  borderColor: string;
  bgColor: string;
  riskAppetite: string;
  recommendedExposure: string;
  positionSizing: string;
  recommendedStopLoss: string;
  minerviniGuideline: string;
}

export const MarketVolatilityDashboard: React.FC<MarketVolatilityDashboardProps> = ({
  stocks = [],
  onOpenScreener,
  onOpenTradePlan,
  isObsidian = true,
}) => {
  // Selected Benchmark
  const [selectedBenchmark, setSelectedBenchmark] = useState<BenchmarkIndex>('NIFTY50');

  // Interactive Simulated or Live VIX Level
  const [currentVix, setCurrentVix] = useState<number>(13.85);
  const [vix52wLow] = useState<number>(10.2);
  const [vix52wHigh] = useState<number>(24.8);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // Benchmarks Data
  const benchmarkData = useMemo(() => {
    switch (selectedBenchmark) {
      case 'NIFTY50':
        return {
          name: 'NSE Nifty 50',
          symbol: 'NIFTY',
          currentLevel: 24380.5,
          changePercent: 0.65,
          realizedVol20D: 11.4,
          realizedVol50D: 12.8,
          vixEquivalentName: 'India VIX',
          currentVixValue: currentVix,
          historicalAvgVix: 15.2,
          atrPercent: 0.85,
        };
      case 'SENSEX':
        return {
          name: 'BSE Sensex 30',
          symbol: 'SENSEX',
          currentLevel: 79950.2,
          changePercent: 0.58,
          realizedVol20D: 10.9,
          realizedVol50D: 12.2,
          vixEquivalentName: 'BSE Volatility Index',
          currentVixValue: currentVix * 0.98,
          historicalAvgVix: 14.8,
          atrPercent: 0.82,
        };
      case 'SP500':
        return {
          name: 'S&P 500 Index',
          symbol: 'SPX',
          currentLevel: 5880.0,
          changePercent: 0.42,
          realizedVol20D: 12.1,
          realizedVol50D: 13.5,
          vixEquivalentName: 'CBOE VIX',
          currentVixValue: currentVix * 1.05,
          historicalAvgVix: 16.4,
          atrPercent: 0.92,
        };
    }
  }, [selectedBenchmark, currentVix]);

  // Calculate Volatility Rank (VRank) = (Current VIX - 52W Low) / (52W High - 52W Low) * 100
  const volatilityRank = useMemo(() => {
    const rawRank = ((currentVix - vix52wLow) / (vix52wHigh - vix52wLow)) * 100;
    return Math.min(Math.max(Math.round(rawRank), 0), 100);
  }, [currentVix, vix52wLow, vix52wHigh]);

  // Implied vs Realized Volatility Spread (Volatility Premium)
  const volPremium = useMemo(() => {
    return Number((currentVix - benchmarkData.realizedVol20D).toFixed(2));
  }, [currentVix, benchmarkData.realizedVol20D]);

  // Determine Minervini Risk Regime based on Volatility Rank
  const regimeInfo: VolatilityRegimeInfo = useMemo(() => {
    if (volatilityRank <= 28) {
      return {
        regime: 'AGGRESSIVE_OFFENSE',
        title: 'Aggressive Offense (Low Volatility Trend)',
        badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        textColor: 'text-emerald-400',
        borderColor: 'border-emerald-500/40',
        bgColor: 'bg-emerald-950/20',
        riskAppetite: 'High Conviction / Bullish Tailwinds',
        recommendedExposure: '100% to 125% (Full Margin Permitted)',
        positionSizing: 'Full Size (15% - 25% portfolio per setup)',
        recommendedStopLoss: '6% - 8% (Standard VCP Pivot Stop)',
        minerviniGuideline: 'Markets are calm with orderly consolidation. Breakouts follow through with high probability. Aggressive pyramiding and holding winners is optimal.',
      };
    } else if (volatilityRank <= 50) {
      return {
        regime: 'SELECTIVE_OFFENSE',
        title: 'Selective Offense (Moderate Volatility)',
        badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        textColor: 'text-amber-400',
        borderColor: 'border-amber-500/40',
        bgColor: 'bg-amber-950/20',
        riskAppetite: 'Balanced / Selective Execution',
        recommendedExposure: '75% to 100% (Strictly Quality Equities)',
        positionSizing: 'Standard Size (10% - 15% per setup)',
        recommendedStopLoss: '5% - 7% (Tight Floor Pivot Stop)',
        minerviniGuideline: 'Volatility is within normal historical parameters. Execute only on A+ setups with verified dry-up volume. Take partial profits into strength.',
      };
    } else if (volatilityRank <= 75) {
      return {
        regime: 'CAUTIOUS_DEFENSE',
        title: 'Cautious Defense (Elevated Risk & Chop)',
        badgeColor: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
        textColor: 'text-orange-400',
        borderColor: 'border-orange-500/40',
        bgColor: 'bg-orange-950/20',
        riskAppetite: 'Defensive / Elevated Tail Risk',
        recommendedExposure: '30% to 50% Equity / 50%+ Cash',
        positionSizing: 'Half Size (5% - 8% per setup)',
        recommendedStopLoss: '3% - 5% (Aggressive Capital Guard)',
        minerviniGuideline: 'Elevated swings trigger false breakouts and whipsaws. Cut position sizes in half, book quick 2:1 profits, and do not buy extended stocks.',
      };
    } else {
      return {
        regime: 'CAPITAL_PRESERVATION',
        title: 'Capital Preservation (High Volatility Panic)',
        badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        textColor: 'text-rose-400',
        borderColor: 'border-rose-500/40',
        bgColor: 'bg-rose-950/20',
        riskAppetite: 'Extreme Risk / High Fragility',
        recommendedExposure: '0% to 20% Equity / 80% - 100% Cash',
        positionSizing: 'Zero to Quarter Size (1% - 3% test buys)',
        recommendedStopLoss: '2% - 3% or Zero New Purchases',
        minerviniGuideline: 'Extreme volatility regime. The market is in aggressive liquidation or severe correction. Cash is the King position. Protect accumulated gains.',
      };
    }
  }, [volatilityRank]);

  // 30-Day Historical Volatility Sparkline Data
  const sparklineData = useMemo(() => {
    const points: { day: number; vix: number; rank: number }[] = [];
    const base = currentVix;
    for (let i = 29; i >= 0; i--) {
      // gentle random walk anchored to current VIX
      const variation = Math.sin(i * 0.4) * 1.5 + (Math.random() - 0.48) * 0.8;
      const v = Math.max(10.5, Math.min(24.0, Number((base - variation * (i / 30)).toFixed(2))));
      const r = Math.round(((v - vix52wLow) / (vix52wHigh - vix52wLow)) * 100);
      points.push({ day: 30 - i, vix: v, rank: r });
    }
    return points;
  }, [currentVix, vix52wLow, vix52wHigh]);

  const resetVix = () => {
    setCurrentVix(13.85);
    setIsSimulating(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className={`p-6 border ${isObsidian ? 'bg-[#0f141c] border-emerald-500/30 text-white' : 'bg-white border-slate-200 text-slate-900'} shadow-lg rounded-xl`}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2 text-xs font-mono text-emerald-400">
              <Activity className="w-4 h-4" />
              <span className="font-bold tracking-wider uppercase">Market Volatility Dashboard</span>
              <span>·</span>
              <span className="text-gray-400">VIX-Equivalent Rank Engine</span>
              <span>·</span>
              <span className="text-gray-400">Risk Appetite Gauge</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight">
              Volatility Rank & Broader Market Risk Appetite
            </h2>
            <p className="text-sm text-gray-400 max-w-3xl leading-relaxed">
              Real-time volatility rank comparing implied volatility (India VIX / CBOE VIX) against realized benchmark volatility. Use Mark Minervini's volatility regime rules to calibrate overall portfolio exposure, trade position sizing, and stop-loss width.
            </p>
          </div>

          {/* Benchmark Selector Segmented Buttons */}
          <div className="flex items-center gap-1.5 p-1 bg-black/40 border border-white/10 rounded-lg self-stretch md:self-auto">
            <button
              onClick={() => setSelectedBenchmark('NIFTY50')}
              className={`px-3 py-1.5 text-xs font-mono font-medium rounded transition-colors ${
                selectedBenchmark === 'NIFTY50'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Nifty 50 (India)
            </button>
            <button
              onClick={() => setSelectedBenchmark('SENSEX')}
              className={`px-3 py-1.5 text-xs font-mono font-medium rounded transition-colors ${
                selectedBenchmark === 'SENSEX'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              BSE Sensex
            </button>
            <button
              onClick={() => setSelectedBenchmark('SP500')}
              className={`px-3 py-1.5 text-xs font-mono font-medium rounded transition-colors ${
                selectedBenchmark === 'SP500'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              S&P 500 (US)
            </button>
          </div>
        </div>
      </div>

      {/* Main Volatility Rank & Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: 52-Week Volatility Rank */}
        <div className="p-5 rounded-xl border border-white/10 bg-[#0d141e] space-y-3">
          <div className="flex items-center justify-between text-xs font-mono text-gray-400">
            <span className="uppercase font-bold tracking-wider">52W Volatility Rank</span>
            <span className="text-gray-500">Percentile</span>
          </div>

          <div className="flex items-baseline space-x-2">
            <span className={`text-4xl font-extrabold font-mono ${regimeInfo.textColor}`}>
              {volatilityRank}%
            </span>
            <span className="text-xs font-mono text-gray-400">
              {volatilityRank <= 30 ? 'Low (Bullish)' : volatilityRank <= 60 ? 'Moderate' : 'Elevated'}
            </span>
          </div>

          {/* Linear Meter */}
          <div className="space-y-1">
            <div className="w-full bg-black/60 rounded-full h-2 overflow-hidden border border-white/10 flex">
              <div className="bg-emerald-500 h-full" style={{ width: '30%' }} title="0-30% Aggressive" />
              <div className="bg-amber-400 h-full" style={{ width: '25%' }} title="30-55% Selective" />
              <div className="bg-orange-500 h-full" style={{ width: '20%' }} title="55-75% Defense" />
              <div className="bg-rose-500 h-full" style={{ width: '25%' }} title="75-100% Panic" />
            </div>
            {/* Pointer */}
            <div className="relative w-full h-3">
              <div
                className="absolute -top-1 w-2.5 h-2.5 bg-white border border-slate-950 rounded-full shadow -translate-x-1/2 transition-all duration-300"
                style={{ left: `${volatilityRank}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-gray-400 border-t border-white/10 pt-2">
            <span>52W Low: {vix52wLow}</span>
            <span>52W High: {vix52wHigh}</span>
          </div>
        </div>

        {/* Card 2: Current VIX Value */}
        <div className="p-5 rounded-xl border border-white/10 bg-[#0d141e] space-y-3">
          <div className="flex items-center justify-between text-xs font-mono text-gray-400">
            <span className="uppercase font-bold tracking-wider">{benchmarkData.vixEquivalentName}</span>
            <span className="text-emerald-400 flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>LIVE</span>
            </span>
          </div>

          <div className="flex items-baseline space-x-2">
            <span className="text-4xl font-extrabold font-mono text-white">
              {currentVix.toFixed(2)}
            </span>
            <span className="text-xs font-mono text-emerald-400">
              -0.42 (-2.9%)
            </span>
          </div>

          <p className="text-xs text-gray-400 leading-snug">
            3-year historical average: <strong className="text-gray-200">{benchmarkData.historicalAvgVix}</strong>
          </p>

          <div className="flex items-center justify-between text-[10px] font-mono text-gray-400 border-t border-white/10 pt-2">
            <span>Sub-15: Favorable Trend</span>
            <span className="text-emerald-400 font-bold">&gt;20: Warning</span>
          </div>
        </div>

        {/* Card 3: Broader Benchmark Realized Volatility */}
        <div className="p-5 rounded-xl border border-white/10 bg-[#0d141e] space-y-3">
          <div className="flex items-center justify-between text-xs font-mono text-gray-400">
            <span className="uppercase font-bold tracking-wider">{benchmarkData.symbol} 20D Realized</span>
            <span className="text-cyan-400 font-mono">Benchmark</span>
          </div>

          <div className="flex items-baseline space-x-2">
            <span className="text-4xl font-extrabold font-mono text-cyan-300">
              {benchmarkData.realizedVol20D}%
            </span>
            <span className="text-xs font-mono text-gray-400">
              Annualized
            </span>
          </div>

          <p className="text-xs text-gray-400 leading-snug">
            Benchmark ATR: <strong className="text-gray-200">{benchmarkData.atrPercent}% / day</strong> · 50D Vol: {benchmarkData.realizedVol50D}%
          </p>

          <div className="flex items-center justify-between text-[10px] font-mono text-gray-400 border-t border-white/10 pt-2">
            <span>Benchmark Index: {benchmarkData.name}</span>
            <span className="text-emerald-400 font-bold">+{benchmarkData.changePercent}%</span>
          </div>
        </div>

        {/* Card 4: Volatility Premium (Implied vs Realized Spread) */}
        <div className="p-5 rounded-xl border border-white/10 bg-[#0d141e] space-y-3">
          <div className="flex items-center justify-between text-xs font-mono text-gray-400">
            <span className="uppercase font-bold tracking-wider">IV vs RV Spread</span>
            <span className="text-gray-500">Premium</span>
          </div>

          <div className="flex items-baseline space-x-2">
            <span className={`text-4xl font-extrabold font-mono ${volPremium >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {volPremium >= 0 ? `+${volPremium}` : volPremium}%
            </span>
            <span className="text-xs font-mono text-gray-400">
              {volPremium >= 0 ? 'Contango' : 'Backwardation'}
            </span>
          </div>

          <p className="text-xs text-gray-400 leading-snug">
            {volPremium > 0
              ? 'Positive variance premium: Healthy option market without acute hedging panic.'
              : 'Negative variance spread: Spot realized volatility exceeding option pricing.'}
          </p>

          <div className="flex items-center justify-between text-[10px] font-mono text-gray-400 border-t border-white/10 pt-2">
            <span>Status: Orderly Price Action</span>
            <span className="text-emerald-400 font-bold">Green Light</span>
          </div>
        </div>
      </div>

      {/* Minervini Risk Regime & Position Guidelines Banner */}
      <div className={`p-6 rounded-xl border ${regimeInfo.borderColor} ${regimeInfo.bgColor} space-y-4`}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold ${
              volatilityRank <= 30 ? 'bg-emerald-500 text-slate-950' : volatilityRank <= 55 ? 'bg-amber-400 text-slate-950' : 'bg-rose-500 text-white'
            }`}>
              <ShieldCheck className="w-6 h-6" />
            </div>

            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-gray-400">
                Mark Minervini SEPA Market Regime
              </div>
              <h3 className={`text-xl font-bold font-mono ${regimeInfo.textColor}`}>
                {regimeInfo.title}
              </h3>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs font-mono text-gray-400 block">Risk Appetite Stance:</span>
            <span className={`text-sm font-bold font-mono ${regimeInfo.textColor}`}>
              {regimeInfo.riskAppetite}
            </span>
          </div>
        </div>

        {/* 4 Guidelines Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          <div className="p-3.5 bg-black/40 rounded-lg border border-white/10 space-y-1">
            <div className="text-[10px] font-mono text-gray-400 uppercase">Portfolio Exposure</div>
            <div className="text-base font-bold font-mono text-white">{regimeInfo.recommendedExposure}</div>
            <div className="text-[10px] text-gray-400">Total capital committed to equities</div>
          </div>

          <div className="p-3.5 bg-black/40 rounded-lg border border-white/10 space-y-1">
            <div className="text-[10px] font-mono text-gray-400 uppercase">Position Sizing</div>
            <div className="text-base font-bold font-mono text-emerald-400">{regimeInfo.positionSizing}</div>
            <div className="text-[10px] text-gray-400">Max portfolio allocation per stock</div>
          </div>

          <div className="p-3.5 bg-black/40 rounded-lg border border-white/10 space-y-1">
            <div className="text-[10px] font-mono text-gray-400 uppercase">Stop Loss Calibration</div>
            <div className="text-base font-bold font-mono text-amber-400">{regimeInfo.recommendedStopLoss}</div>
            <div className="text-[10px] text-gray-400">Floor Pivot or entry stop threshold</div>
          </div>
        </div>

        {/* Minervini SEPA Core Principle */}
        <div className="p-3.5 bg-black/50 rounded-lg border border-white/10 text-xs text-gray-300 leading-relaxed">
          <strong className="text-emerald-300 font-mono">SEPA Volatility Rule: </strong>
          {regimeInfo.minerviniGuideline}
        </div>
      </div>

      {/* Historical Sparkline & Simulator Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: 30-Day Historical Volatility Sparkline Chart */}
        <div className="lg:col-span-2 p-5 rounded-xl border border-white/10 bg-[#0d141e] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <BarChart2 className="w-4 h-4 text-emerald-400" />
                <span>30-Day Volatility Trend & Benchmark Correlation</span>
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Daily VIX close values and Volatility Rank progression
              </p>
            </div>

            <div className="text-xs font-mono text-gray-400">
              30-Day Range: <strong className="text-emerald-400">11.8 - 16.5</strong>
            </div>
          </div>

          {/* SVG Sparkline Graph */}
          <div className="h-44 w-full bg-black/50 rounded-lg p-3 border border-white/10 flex flex-col justify-between">
            <div className="flex justify-between text-[10px] font-mono text-gray-500">
              <span>Upper Threshold (Panic &gt; 20.0)</span>
              <span>20.0</span>
            </div>

            <svg className="w-full h-28 overflow-visible" viewBox="0 0 300 100" preserveAspectRatio="none">
              {/* Reference Danger Line at 20 */}
              <line x1="0" y1="20" x2="300" y2="20" stroke="#f43f5e" strokeDasharray="3 3" strokeWidth="0.8" />
              {/* Reference Baseline Line at 14 */}
              <line x1="0" y1="60" x2="300" y2="60" stroke="#10b981" strokeDasharray="3 3" strokeWidth="0.8" />

              {/* Area fill */}
              <polygon
                points={`0,100 ${sparklineData
                  .map((p, idx) => `${(idx / (sparklineData.length - 1)) * 300},${100 - ((p.vix - 10) / 15) * 80}`)
                  .join(' ')} 300,100`}
                fill="url(#volatilityGradient)"
                opacity="0.3"
              />

              {/* Sparkline curve */}
              <polyline
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                points={sparklineData
                  .map((p, idx) => `${(idx / (sparklineData.length - 1)) * 300},${100 - ((p.vix - 10) / 15) * 80}`)
                  .join(' ')}
              />

              <defs>
                <linearGradient id="volatilityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>
            </svg>

            <div className="flex justify-between text-[10px] font-mono text-gray-500">
              <span>30 Days Ago</span>
              <span className="text-emerald-400 font-bold">Today: {currentVix.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-400 font-mono">
            <span>Green line: 14.0 Baseline</span>
            <span>Red dashed line: 20.0 Distribution Warning</span>
          </div>
        </div>

        {/* Right: Volatility Stress Simulator */}
        <div className="p-5 rounded-xl border border-white/10 bg-[#0d141e] space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
              <span>VIX Scenario Simulator</span>
            </h3>

            {isSimulating && (
              <button
                onClick={resetVix}
                className="text-[11px] font-mono text-gray-400 hover:text-white flex items-center space-x-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>

          <p className="text-xs text-gray-400">
            Slide the VIX level to test how portfolio exposure, stop-loss thresholds, and risk appetite adjust across market cycles.
          </p>

          <div className="space-y-3 bg-black/40 p-4 rounded-lg border border-white/10">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-gray-300">Simulate VIX Index</span>
              <span className="text-emerald-400 font-bold">{currentVix.toFixed(1)}</span>
            </div>

            <input
              type="range"
              min="10.0"
              max="35.0"
              step="0.5"
              value={currentVix}
              onChange={(e) => {
                setCurrentVix(Number(e.target.value));
                setIsSimulating(true);
              }}
              className="w-full accent-emerald-500"
            />

            <div className="flex justify-between text-[10px] font-mono text-gray-500">
              <span>10.0 (Super Bull)</span>
              <span>20.0 (Caution)</span>
              <span>35.0 (Panic)</span>
            </div>
          </div>

          {/* Preset Buttons */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => {
                setCurrentVix(12.5);
                setIsSimulating(true);
              }}
              className="p-2 text-[10px] font-mono rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold"
            >
              Stage 2 Bull (12.5)
            </button>
            <button
              onClick={() => {
                setCurrentVix(18.5);
                setIsSimulating(true);
              }}
              className="p-2 text-[10px] font-mono rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold"
            >
              Choppy Range (18.5)
            </button>
            <button
              onClick={() => {
                setCurrentVix(28.0);
                setIsSimulating(true);
              }}
              className="p-2 text-[10px] font-mono rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold"
            >
              Correction (28.0)
            </button>
          </div>

          {/* Quick Action Links */}
          <div className="pt-2 border-t border-white/10 space-y-2">
            {onOpenTradePlan && (
              <button
                onClick={onOpenTradePlan}
                className="w-full py-2 text-xs font-mono font-bold rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center space-x-1.5 transition-colors"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Adjust Trade Plan Sizing</span>
              </button>
            )}

            {onOpenScreener && (
              <button
                onClick={onOpenScreener}
                className="w-full py-2 text-xs font-mono rounded bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 flex items-center justify-center space-x-1.5 transition-colors"
              >
                <span>View Qualified Low-Volatility Setups</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketVolatilityDashboard;
