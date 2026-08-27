import React, { useState, useMemo } from 'react';
import { MinerviniTradeSetup } from '../types';
import { formatCurrency, formatVolume, getCurrencySymbol } from '../utils/sepaCalculator';
import {
  Activity,
  Sliders,
  TrendingDown,
  Zap,
  Target,
  BarChart3,
  Layers,
  Info,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Flame
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  ReferenceDot,
  Cell
} from 'recharts';

export interface VolatilityContractionRatioPoint {
  date: string;
  close: number;
  high: number;
  low: number;
  volume: number;
  avgVolume20?: number;
  dailySpreadPct: number;
  rollingFluctuationPct: number;
  baseAnchorVolatilityPct: number;
  contractionRatioPct: number;
  squeezeCompressionPct: number;
  tighteningPhase: 'EXPANDED' | 'MODERATE' | 'TIGHTENING' | 'TERMINAL_COIL';
  isTightCoil: boolean;
  isVolumeDryUp: boolean;
  isVcpTighteningTrigger: boolean;
  contractionWaveIndex?: number;
}

interface VolatilityContractionRatioSubchartProps {
  stock: MinerviniTradeSetup;
  rollingWindow?: number;
  onSelectDate?: (date: string) => void;
  selectedDate?: string | null;
}

export const VolatilityContractionRatioSubchart: React.FC<VolatilityContractionRatioSubchartProps> = ({
  stock,
  rollingWindow: initialRollingWindow = 10,
  onSelectDate,
  selectedDate
}) => {
  const currencySymbol = getCurrencySymbol(stock?.exchange);
  const priceHistory = stock?.priceHistory || [];
  const contractions = stock?.contractions || [];

  const [rollingWindow, setRollingWindow] = useState<number>(initialRollingWindow);
  const [displayMode, setDisplayMode] = useState<'RATIO_AREA' | 'SPREAD_LINE' | 'BOTH'>('BOTH');
  const [showThresholdZones, setShowThresholdZones] = useState<boolean>(true);
  const [showTighteningSignals, setShowTighteningSignals] = useState<boolean>(true);

  // 1. Calculate Base Anchor Volatility (initial wide base swing depth e.g. T1 depth)
  const baseAnchorVolatilityPct = useMemo(() => {
    if (contractions.length > 0 && contractions[0].depthPercent > 0) {
      return contractions[0].depthPercent;
    }
    // Fallback: estimate from the first 25 trading sessions
    if (priceHistory.length >= 10) {
      const initialSlice = priceHistory.slice(0, Math.min(30, priceHistory.length));
      const maxH = Math.max(...initialSlice.map((p) => p.high));
      const minL = Math.min(...initialSlice.map((p) => p.low));
      if (maxH > 0 && minL > 0) {
        return Number((((maxH - minL) / maxH) * 100).toFixed(1));
      }
    }
    return 25.0; // Default reference baseline
  }, [contractions, priceHistory]);

  // 2. Compute Volatility Contraction Ratio series over time
  const contractionRatioData: VolatilityContractionRatioPoint[] = useMemo(() => {
    if (!priceHistory || priceHistory.length === 0) return [];

    return priceHistory.map((pt, idx) => {
      const dailySpread = pt.high > 0 && pt.low > 0
        ? ((pt.high - pt.low) / pt.close) * 100
        : 0;

      // Slice rolling window for fluctuation spread
      const startIdx = Math.max(0, idx - rollingWindow + 1);
      const windowSlice = priceHistory.slice(startIdx, idx + 1);

      const maxHighInWindow = Math.max(...windowSlice.map((p) => p.high));
      const minLowInWindow = Math.min(...windowSlice.map((p) => p.low));

      const rollingFluctuationPct = minLowInWindow > 0
        ? ((maxHighInWindow - minLowInWindow) / minLowInWindow) * 100
        : dailySpread;

      // Volatility Contraction Ratio (%) = (Rolling Fluctuation / Base Anchor) * 100
      const ratioRaw = baseAnchorVolatilityPct > 0
        ? (rollingFluctuationPct / baseAnchorVolatilityPct) * 100
        : 100;
      const contractionRatioPct = Number(Math.min(150, Math.max(1, ratioRaw)).toFixed(1));
      const squeezeCompressionPct = Number(Math.max(0, 100 - contractionRatioPct).toFixed(1));

      // Classify VCP Tightening Phase
      let tighteningPhase: 'EXPANDED' | 'MODERATE' | 'TIGHTENING' | 'TERMINAL_COIL' = 'EXPANDED';
      if (contractionRatioPct <= 18 || rollingFluctuationPct <= 4.0) {
        tighteningPhase = 'TERMINAL_COIL';
      } else if (contractionRatioPct <= 35 || rollingFluctuationPct <= 8.0) {
        tighteningPhase = 'TIGHTENING';
      } else if (contractionRatioPct <= 65 || rollingFluctuationPct <= 15.0) {
        tighteningPhase = 'MODERATE';
      } else {
        tighteningPhase = 'EXPANDED';
      }

      const isTightCoil = contractionRatioPct <= 30 || rollingFluctuationPct <= 5.0;
      const avgVol = pt.avgVolume20 || pt.volumeAverage || 1000000;
      const isVolumeDryUp = pt.volume < avgVol * 0.65;

      // VCP Trigger Signal: Tight coil combined with volume dry-up or price near pivot
      const isVcpTighteningTrigger = isTightCoil && (isVolumeDryUp || contractionRatioPct <= 20);

      // Match which contraction wave this date falls into
      const matchedContraction = contractions.find(
        (c) => pt.date >= c.startDate && pt.date <= c.endDate
      );

      return {
        date: pt.date,
        close: pt.close,
        high: pt.high,
        low: pt.low,
        volume: pt.volume,
        avgVolume20: avgVol,
        dailySpreadPct: Number(dailySpread.toFixed(1)),
        rollingFluctuationPct: Number(rollingFluctuationPct.toFixed(1)),
        baseAnchorVolatilityPct,
        contractionRatioPct,
        squeezeCompressionPct,
        tighteningPhase,
        isTightCoil,
        isVolumeDryUp,
        isVcpTighteningTrigger,
        contractionWaveIndex: matchedContraction?.contractionIndex,
      };
    });
  }, [priceHistory, contractions, rollingWindow, baseAnchorVolatilityPct]);

  // 3. Statistical summary of Volatility Contraction
  const summaryStats = useMemo(() => {
    if (contractionRatioData.length === 0) {
      return {
        currentRatio: 100,
        currentPhase: 'EXPANDED' as const,
        currentSpread: 0,
        compressionPct: 0,
        tightDaysCount: 0,
        terminalCoilCount: 0,
        minRatio: 100,
        isCoilActive: false,
      };
    }

    const latest = contractionRatioData[contractionRatioData.length - 1];
    const minRatio = Math.min(...contractionRatioData.map((d) => d.contractionRatioPct));

    // Calculate consecutive tight days leading into the current bar
    let tightDaysCount = 0;
    for (let i = contractionRatioData.length - 1; i >= 0; i--) {
      if (contractionRatioData[i].isTightCoil) {
        tightDaysCount++;
      } else {
        break;
      }
    }

    const terminalCoilCount = contractionRatioData.filter((d) => d.tighteningPhase === 'TERMINAL_COIL').length;

    return {
      currentRatio: latest.contractionRatioPct,
      currentPhase: latest.tighteningPhase,
      currentSpread: latest.rollingFluctuationPct,
      compressionPct: latest.squeezeCompressionPct,
      tightDaysCount,
      terminalCoilCount,
      minRatio,
      isCoilActive: latest.tighteningPhase === 'TERMINAL_COIL' || latest.tighteningPhase === 'TIGHTENING',
    };
  }, [contractionRatioData]);

  return (
    <div id="vcp-volatility-contraction-ratio-subchart" className="pt-3 border-t border-[#e5e4e1] space-y-3 font-mono text-xs text-[#1a1a1a]">
      {/* Header & Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#f9f8f5] p-3 border border-[#e5e4e1]">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
            <Zap className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-black uppercase tracking-wider text-[#1a1a1a]">
                Volatility Contraction Ratio (VCR) & Tightening Index
              </span>
              <span
                className={`px-2 py-0.5 text-[9px] font-extrabold uppercase border rounded-xs ${
                  summaryStats.currentPhase === 'TERMINAL_COIL'
                    ? 'bg-emerald-100 text-emerald-950 border-emerald-400 animate-pulse'
                    : summaryStats.currentPhase === 'TIGHTENING'
                    ? 'bg-amber-100 text-amber-950 border-amber-400'
                    : summaryStats.currentPhase === 'MODERATE'
                    ? 'bg-blue-100 text-blue-950 border-blue-300'
                    : 'bg-rose-100 text-rose-950 border-rose-300'
                }`}
              >
                {summaryStats.currentPhase === 'TERMINAL_COIL' && '🔥 TERMINAL COIL — PIVOT READY'}
                {summaryStats.currentPhase === 'TIGHTENING' && '⚡ VCP CONTRACTION TIGHTENING'}
                {summaryStats.currentPhase === 'MODERATE' && '📐 MODERATE CONSOLIDATION'}
                {summaryStats.currentPhase === 'EXPANDED' && '🌊 EXPANDED BASE SWINGS'}
              </span>
            </div>
            <p className="text-[10px] text-gray-500 font-sans mt-0.5">
              Tracks the ratio of current price swing amplitude vs. initial base anchor (-{baseAnchorVolatilityPct.toFixed(1)}%). Lower ratio = tighter coil!
            </p>
          </div>
        </div>

        {/* Configuration Controls */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Rolling Window Selector */}
          <div className="flex items-center space-x-1 bg-white border border-[#e5e4e1] px-2 py-1">
            <span className="text-[10px] text-gray-500">Window:</span>
            <button
              onClick={() => setRollingWindow(5)}
              className={`px-1.5 py-0.5 text-[10px] font-bold cursor-pointer transition ${
                rollingWindow === 5 ? 'bg-[#1a1a1a] text-amber-300' : 'text-gray-600 hover:text-black'
              }`}
            >
              5D
            </button>
            <button
              onClick={() => setRollingWindow(10)}
              className={`px-1.5 py-0.5 text-[10px] font-bold cursor-pointer transition ${
                rollingWindow === 10 ? 'bg-[#1a1a1a] text-amber-300' : 'text-gray-600 hover:text-black'
              }`}
            >
              10D
            </button>
            <button
              onClick={() => setRollingWindow(15)}
              className={`px-1.5 py-0.5 text-[10px] font-bold cursor-pointer transition ${
                rollingWindow === 15 ? 'bg-[#1a1a1a] text-amber-300' : 'text-gray-600 hover:text-black'
              }`}
            >
              15D
            </button>
          </div>

          {/* Display Mode */}
          <div className="flex items-center space-x-1 bg-white border border-[#e5e4e1] px-2 py-1">
            <button
              onClick={() => setDisplayMode('RATIO_AREA')}
              className={`px-1.5 py-0.5 text-[10px] font-bold cursor-pointer transition ${
                displayMode === 'RATIO_AREA' ? 'bg-[#1a1a1a] text-amber-300' : 'text-gray-600 hover:text-black'
              }`}
            >
              VCR % Area
            </button>
            <button
              onClick={() => setDisplayMode('SPREAD_LINE')}
              className={`px-1.5 py-0.5 text-[10px] font-bold cursor-pointer transition ${
                displayMode === 'SPREAD_LINE' ? 'bg-[#1a1a1a] text-amber-300' : 'text-gray-600 hover:text-black'
              }`}
            >
              Swing % Line
            </button>
            <button
              onClick={() => setDisplayMode('BOTH')}
              className={`px-1.5 py-0.5 text-[10px] font-bold cursor-pointer transition ${
                displayMode === 'BOTH' ? 'bg-[#1a1a1a] text-amber-300' : 'text-gray-600 hover:text-black'
              }`}
            >
              Both
            </button>
          </div>

          {/* Zones & Signals Toggles */}
          <button
            onClick={() => setShowThresholdZones(!showThresholdZones)}
            className={`px-2 py-1 text-[10px] font-bold uppercase border cursor-pointer transition ${
              showThresholdZones ? 'bg-amber-600 text-white border-amber-700' : 'bg-white text-gray-500 border-gray-300'
            }`}
            title="Toggle VCP Threshold Zone Bands (Terminal Coil < 18%, Tightening < 35%)"
          >
            Zones {showThresholdZones ? 'ON' : 'OFF'}
          </button>

          <button
            onClick={() => setShowTighteningSignals(!showTighteningSignals)}
            className={`px-2 py-1 text-[10px] font-bold uppercase border cursor-pointer transition ${
              showTighteningSignals ? 'bg-emerald-700 text-white border-emerald-800' : 'bg-white text-gray-500 border-gray-300'
            }`}
            title="Toggle VCP Tightening Marker Dots with Volume Dry-Up"
          >
            Signals {showTighteningSignals ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {/* Metric 1: Current VCR */}
        <div className="bg-white border border-[#e5e4e1] p-2.5 space-y-1">
          <span className="text-[10px] uppercase font-bold text-gray-500 flex items-center space-x-1">
            <Activity className="w-3 h-3 text-amber-600" />
            <span>Contraction Ratio</span>
          </span>
          <div className="flex items-baseline space-x-1.5">
            <strong className="text-xl font-black text-[#1a1a1a]">{summaryStats.currentRatio}%</strong>
            <span className="text-[10px] text-gray-500 font-mono">of Base Anchor</span>
          </div>
          <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                summaryStats.currentRatio <= 20
                  ? 'bg-emerald-600'
                  : summaryStats.currentRatio <= 40
                  ? 'bg-amber-500'
                  : 'bg-rose-500'
              }`}
              style={{ width: `${Math.min(100, summaryStats.currentRatio)}%` }}
            />
          </div>
        </div>

        {/* Metric 2: Squeeze Compression */}
        <div className="bg-white border border-[#e5e4e1] p-2.5 space-y-1">
          <span className="text-[10px] uppercase font-bold text-emerald-800 flex items-center space-x-1">
            <TrendingDown className="w-3 h-3 text-emerald-600" />
            <span>Volatility Compression</span>
          </span>
          <div className="flex items-baseline space-x-1.5">
            <strong className="text-xl font-black text-emerald-800">+{summaryStats.compressionPct}%</strong>
            <span className="text-[10px] text-emerald-700">Dampened</span>
          </div>
          <p className="text-[10px] font-sans text-gray-500 leading-tight">
            Base anchor: -{baseAnchorVolatilityPct.toFixed(1)}% &rarr; Current: {summaryStats.currentSpread}%
          </p>
        </div>

        {/* Metric 3: Tight Coil Streak */}
        <div className="bg-white border border-[#e5e4e1] p-2.5 space-y-1">
          <span className="text-[10px] uppercase font-bold text-blue-800 flex items-center space-x-1">
            <Flame className="w-3 h-3 text-blue-600" />
            <span>Tight Coil Streak</span>
          </span>
          <div className="flex items-baseline space-x-1.5">
            <strong className="text-xl font-black text-blue-900">{summaryStats.tightDaysCount}</strong>
            <span className="text-[10px] text-blue-700">Days Consecutive</span>
          </div>
          <p className="text-[10px] font-sans text-gray-500 leading-tight">
            {summaryStats.tightDaysCount >= 3 ? '✅ Supply dry-up confirmed' : 'Developing contraction'}
          </p>
        </div>

        {/* Metric 4: Minervini Setup Grade */}
        <div className="bg-white border border-[#e5e4e1] p-2.5 space-y-1">
          <span className="text-[10px] uppercase font-bold text-purple-900 flex items-center space-x-1">
            <Target className="w-3 h-3 text-purple-700" />
            <span>VCP Coil Status</span>
          </span>
          <div className="flex items-baseline space-x-1.5">
            <strong className={`text-base font-black ${
              summaryStats.currentPhase === 'TERMINAL_COIL' ? 'text-emerald-700' : 'text-[#1a1a1a]'
            }`}>
              {summaryStats.currentPhase === 'TERMINAL_COIL' ? 'PIVOT READY' : `${contractions.length}T WAVE STAGE`}
            </strong>
          </div>
          <p className="text-[10px] font-sans text-gray-500 leading-tight">
            Target Buy: {currencySymbol}{stock.pivotPrice.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Main Interactive Recharts Chart for Volatility Contraction Ratio */}
      <div className="w-full h-[180px] bg-[#f9f8f5] p-2 border border-[#e5e4e1] relative">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={contractionRatioData}
            margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
            onClick={(e) => {
              if (e && e.activeLabel && onSelectDate) {
                onSelectDate(e.activeLabel);
              }
            }}
          >
            <defs>
              <linearGradient id="vcrRatioGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                <stop offset="45%" stopColor="#3b82f6" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="2 2" stroke="#e5e4e1" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="#888888"
              tick={{ fontSize: 9, fill: '#666666' }}
              tickFormatter={(val) => val.substring(5)}
            />
            <YAxis
              yAxisId="ratio"
              stroke="#888888"
              orientation="right"
              domain={[0, (dataMax: number) => Math.max(100, Math.ceil(dataMax / 10) * 10)]}
              tick={{ fontSize: 9, fill: '#666666' }}
              tickFormatter={(val) => `${val}%`}
            />

            {/* Optional Second Y-Axis for Price Fluctuation Spread % */}
            {displayMode === 'BOTH' && (
              <YAxis
                yAxisId="spread"
                stroke="#6366f1"
                orientation="left"
                domain={[0, (dataMax: number) => Math.max(20, Math.ceil(dataMax / 5) * 5)]}
                tick={{ fontSize: 9, fill: '#6366f1' }}
                tickFormatter={(val) => `${val}%`}
              />
            )}

            {/* Threshold Reference Bands */}
            {showThresholdZones && (
              <>
                {/* Terminal Coil Band (0% - 18% Ratio) */}
                <ReferenceArea
                  {...({
                    yAxisId: 'ratio',
                    y1: 0,
                    y2: 18,
                    fill: '#10b981',
                    fillOpacity: 0.12,
                    stroke: '#10b981',
                    strokeOpacity: 0.3,
                    strokeDasharray: '2 2',
                    label: {
                      value: 'TERMINAL COIL (<18% VCR)',
                      fill: '#047857',
                      fontSize: 8,
                      fontWeight: 'bold',
                      position: 'insideTopLeft'
                    }
                  } as any)}
                />

                {/* VCP Tightening Band (18% - 35% Ratio) */}
                <ReferenceArea
                  {...({
                    yAxisId: 'ratio',
                    y1: 18,
                    y2: 35,
                    fill: '#f59e0b',
                    fillOpacity: 0.08,
                    stroke: '#f59e0b',
                    strokeOpacity: 0.25,
                    strokeDasharray: '2 2',
                    label: {
                      value: 'VCP TIGHTENING (18-35%)',
                      fill: '#b45309',
                      fontSize: 8,
                      fontWeight: 'bold',
                      position: 'insideTopLeft'
                    }
                  } as any)}
                />
              </>
            )}

            {/* 100% Baseline (Equal to Initial Base Anchor) */}
            <ReferenceLine
              yAxisId="ratio"
              y={100}
              stroke="#94a3b8"
              strokeDasharray="3 3"
              strokeWidth={1}
              label={{ value: '100% Base Anchor', fill: '#64748b', fontSize: 8, position: 'insideBottomRight' }}
            />

            {/* 30% Critical Contraction Boundary */}
            <ReferenceLine
              yAxisId="ratio"
              y={30}
              stroke="#d97706"
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />

            {/* Tooltip */}
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const pt = payload[0].payload as VolatilityContractionRatioPoint;
                  return (
                    <div className="bg-[#1a1a1a] border border-[#333] p-3 text-xs font-mono text-white shadow-xl space-y-1.5 rounded-xs">
                      <div className="flex items-center justify-between border-b border-gray-700 pb-1">
                        <span className="font-bold text-amber-400">{pt.date}</span>
                        <span
                          className={`px-1.5 py-0.2 text-[9px] font-extrabold uppercase rounded-xs ${
                            pt.tighteningPhase === 'TERMINAL_COIL'
                              ? 'bg-emerald-500 text-black'
                              : pt.tighteningPhase === 'TIGHTENING'
                              ? 'bg-amber-500 text-black'
                              : 'bg-gray-700 text-white'
                          }`}
                        >
                          {pt.tighteningPhase}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                        <div>
                          <span className="text-gray-400">Contraction Ratio:</span>{' '}
                          <strong className="text-amber-300 font-bold">{pt.contractionRatioPct}%</strong>
                        </div>
                        <div>
                          <span className="text-gray-400">Compression:</span>{' '}
                          <strong className="text-emerald-400 font-bold">+{pt.squeezeCompressionPct}%</strong>
                        </div>
                        <div>
                          <span className="text-gray-400">{rollingWindow}D Swing Spread:</span>{' '}
                          <strong className="text-indigo-300">{pt.rollingFluctuationPct}%</strong>
                        </div>
                        <div>
                          <span className="text-gray-400">Daily Spread:</span>{' '}
                          <strong className="text-gray-200">{pt.dailySpreadPct}%</strong>
                        </div>
                        <div>
                          <span className="text-gray-400">Close Price:</span>{' '}
                          <strong className="text-white">{currencySymbol}{pt.close.toFixed(2)}</strong>
                        </div>
                        <div>
                          <span className="text-gray-400">Volume:</span>{' '}
                          <strong className={pt.isVolumeDryUp ? 'text-purple-400' : 'text-gray-300'}>
                            {formatVolume(pt.volume)} {pt.isVolumeDryUp ? '(Dry-Up)' : ''}
                          </strong>
                        </div>
                      </div>

                      {pt.isVcpTighteningTrigger && (
                        <div className="mt-1 pt-1 border-t border-gray-700 text-[10px] text-emerald-300 font-bold flex items-center space-x-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>VCP Squeeze & Tightening Condition Fulfilled!</span>
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />

            {/* Area / Line for Contraction Ratio % */}
            {(displayMode === 'RATIO_AREA' || displayMode === 'BOTH') && (
              <Area
                yAxisId="ratio"
                type="monotone"
                dataKey="contractionRatioPct"
                name="Volatility Contraction Ratio %"
                stroke="#d97706"
                strokeWidth={2}
                fill="url(#vcrRatioGradient)"
                activeDot={{ r: 5, fill: '#f59e0b', stroke: '#ffffff', strokeWidth: 2 }}
              />
            )}

            {/* Line for Rolling Fluctuation Spread % */}
            {(displayMode === 'SPREAD_LINE' || displayMode === 'BOTH') && (
              <Line
                yAxisId={displayMode === 'BOTH' ? 'spread' : 'ratio'}
                type="monotone"
                dataKey="rollingFluctuationPct"
                name={`${rollingWindow}D Price Swing Spread %`}
                stroke="#6366f1"
                strokeWidth={1.75}
                dot={false}
                strokeDasharray={displayMode === 'BOTH' ? '3 3' : undefined}
                activeDot={{ r: 4, fill: '#6366f1', stroke: '#ffffff', strokeWidth: 2 }}
              />
            )}

            {/* Signal Dots for Tight Coil Events */}
            {showTighteningSignals &&
              contractionRatioData
                .filter((d) => d.isVcpTighteningTrigger)
                .map((pt, idx) => (
                  <ReferenceDot
                    key={`vcr-dot-${idx}`}
                    yAxisId="ratio"
                    x={pt.date}
                    y={pt.contractionRatioPct}
                    r={4}
                    fill="#10b981"
                    stroke="#ffffff"
                    strokeWidth={1.5}
                    isFront={true}
                  />
                ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend & Principle Guidelines */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-gray-600 bg-white p-2 border border-[#e5e4e1]">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center space-x-1 font-bold text-amber-900">
            <span className="w-2.5 h-2.5 bg-amber-500 rounded-full"></span>
            <span>VCR % = (Current Fluctuation / Base Anchor) &times; 100</span>
          </span>
          <span className="flex items-center space-x-1 font-bold text-indigo-900">
            <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full"></span>
            <span>Indigo Dashed = {rollingWindow}D High-Low Spread %</span>
          </span>
          <span className="flex items-center space-x-1 font-bold text-emerald-800">
            <span className="w-2 h-2 bg-emerald-600 rounded-full"></span>
            <span>Green Dots = Squeeze & Volume Dry-Up</span>
          </span>
        </div>

        <span className="italic text-gray-500">
          Mark Minervini Principle: Look for VCR &le; 20% near the pivot trigger.
        </span>
      </div>
    </div>
  );
};
