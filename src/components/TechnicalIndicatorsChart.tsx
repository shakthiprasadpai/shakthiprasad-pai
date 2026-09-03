import React, { useState, useMemo } from 'react';
import { MinerviniTradeSetup, PricePoint } from '../types';
import {
  computeTechnicalIndicatorsSummary,
  calculatePivotPoints,
  enrichHistoryWithTechnicalIndicators,
  PivotPointModel,
  PivotLevelsResult
} from '../utils/technicalIndicatorsCalculator';
import { formatCurrency, formatVolume, getCurrencySymbol } from '../utils/sepaCalculator';
import { RsiSubchart } from './RsiSubchart';
import { PivotPointLevelsCard } from './PivotPointLevelsCard';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  CartesianGrid,
  Cell
} from 'recharts';
import {
  Activity,
  Gauge,
  Compass,
  TrendingUp,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  ZoomIn,
  ChevronLeft,
  ChevronRight,
  Layers,
  Sparkles,
  Flame,
  Target,
  ShieldAlert,
  BarChart3,
  HelpCircle
} from 'lucide-react';

interface TechnicalIndicatorsChartProps {
  stock: MinerviniTradeSetup;
  isObsidian?: boolean;
}

export const TechnicalIndicatorsChart: React.FC<TechnicalIndicatorsChartProps> = ({
  stock,
  isObsidian = false
}) => {
  // Indicator Toggles
  const [showRsiSubchart, setShowRsiSubchart] = useState<boolean>(true);
  const [showEma10, setShowEma10] = useState<boolean>(true);
  const [showEma21, setShowEma21] = useState<boolean>(true);
  const [showSma20, setShowSma20] = useState<boolean>(false);
  const [showSma50, setShowSma50] = useState<boolean>(true);
  const [showSma150, setShowSma150] = useState<boolean>(false);
  const [showSma200, setShowSma200] = useState<boolean>(true);
  
  // Pivot Points Model & Toggles
  const [showPivotLines, setShowPivotLines] = useState<boolean>(true);
  const [pivotModel, setPivotModel] = useState<PivotPointModel>('STANDARD');
  const [showPivotTable, setShowPivotTable] = useState<boolean>(true);

  // Volume & Zoom Pan State
  const [zoomMode, setZoomMode] = useState<'ALL' | '120D' | '60D' | '30D'>('60D');
  const [panIndex, setPanIndex] = useState<number>(0);
  const [rsiPeriod, setRsiPeriod] = useState<number>(14);

  const currencySymbol = getCurrencySymbol(stock.exchange);
  const currentPrice = stock.currentPrice || (stock.priceHistory && stock.priceHistory.length > 0
    ? stock.priceHistory[stock.priceHistory.length - 1].close
    : stock.pivotPrice);

  // Compute Full Technical Indicators Summary
  const summary = useMemo(() => {
    return computeTechnicalIndicatorsSummary(stock, pivotModel);
  }, [stock, pivotModel]);

  // Enrich Price History with EMAs, SMAs, RSI
  const enrichedHistory = useMemo(() => {
    return enrichHistoryWithTechnicalIndicators(stock.priceHistory || [], rsiPeriod);
  }, [stock.priceHistory, rsiPeriod]);

  // Zoomed & Panned Slice
  const displayedHistory = useMemo(() => {
    const full = enrichedHistory;
    if (zoomMode === 'ALL') return full;
    const windowSize = zoomMode === '120D' ? 120 : zoomMode === '60D' ? 60 : 30;
    if (full.length <= windowSize) return full;
    const maxStart = Math.max(0, full.length - windowSize);
    const start = Math.max(0, Math.min(maxStart, panIndex));
    return full.slice(start, start + windowSize);
  }, [enrichedHistory, zoomMode, panIndex]);

  // Dynamic Y-Domain for Price Chart
  const { minPrice, maxPrice } = useMemo(() => {
    if (displayedHistory.length === 0) return { minPrice: 0, maxPrice: 100 };
    let min = Infinity;
    let max = -Infinity;

    displayedHistory.forEach(p => {
      if (p.low < min) min = p.low;
      if (p.high > max) max = p.high;
      if (showEma10 && p.ema10) { min = Math.min(min, p.ema10); max = Math.max(max, p.ema10); }
      if (showEma21 && p.ema21) { min = Math.min(min, p.ema21); max = Math.max(max, p.ema21); }
      if (showSma50 && p.sma50) { min = Math.min(min, p.sma50); max = Math.max(max, p.sma50); }
      if (showSma200 && p.sma200) { min = Math.min(min, p.sma200); max = Math.max(max, p.sma200); }
    });

    if (showPivotLines && summary.pivotPoints) {
      summary.pivotPoints.levels.forEach(lvl => {
        // Include P, R1, S1 in bounds
        if (['P', 'R1', 'S1'].includes(lvl.id)) {
          min = Math.min(min, lvl.price);
          max = Math.max(max, lvl.price);
        }
      });
    }

    const padding = (max - min) * 0.06;
    return {
      minPrice: Math.max(0, Math.floor(min - padding)),
      maxPrice: Math.ceil(max + padding)
    };
  }, [displayedHistory, showEma10, showEma21, showSma50, showSma200, showPivotLines, summary.pivotPoints]);

  return (
    <div className={`space-y-4 font-mono transition-colors duration-200 ${
      isObsidian ? 'text-gray-100' : 'text-gray-900'
    }`}>
      {/* Top Intelligence Bar: Live RSI, Moving Average Alignment & Pivot Proximity */}
      <div className={`p-4 border grid grid-cols-1 md:grid-cols-3 gap-4 shadow-xs ${
        isObsidian ? 'bg-[#0e1217] border-[#2d333b]' : 'bg-white border-[#e5e4e1]'
      }`}>
        {/* Metric 1: RSI (14) Momentum */}
        <div className={`p-3 border rounded-xs ${
          isObsidian ? 'bg-[#161b22] border-[#2d333b]' : 'bg-amber-50/50 border-amber-200'
        }`}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="flex items-center space-x-1.5 font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 text-[10px]">
              <Gauge className="w-3.5 h-3.5" />
              <span>RSI ({rsiPeriod}) Momentum</span>
            </span>
            <span className={`px-2 py-0.2 text-[9px] font-extrabold uppercase rounded-xs border ${
              summary.rsiStatus === 'SEPA_SWEET_SPOT'
                ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                : summary.rsiStatus === 'OVERBOUGHT'
                ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                : 'bg-cyan-100 dark:bg-cyan-950/70 text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800'
            }`}>
              {summary.rsiStatus}
            </span>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">
              {summary.rsi14.toFixed(1)}
            </span>
            <span className="text-[11px] text-gray-500 font-sans">
              {summary.rsiZoneLabel}
            </span>
          </div>
          <div className="mt-2 text-[10px] text-gray-500 dark:text-gray-400">
            {summary.isSepaSweetSpot ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center space-x-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>Sweet Spot: Prime Stage 2 breakout momentum with no exhaustion</span>
              </span>
            ) : summary.rsi14 >= 70 ? (
              <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center space-x-1">
                <AlertTriangle className="w-3 h-3" />
                <span>Extended (&gt;70): Wait for pullback to 10/21 EMA before fresh entry</span>
              </span>
            ) : (
              <span>Below 50: Consolidation phase or developing bottom</span>
            )}
          </div>
        </div>

        {/* Metric 2: Moving Average Stage 2 Stack Alignment */}
        <div className={`p-3 border rounded-xs ${
          isObsidian ? 'bg-[#161b22] border-[#2d333b]' : 'bg-blue-50/50 border-blue-200'
        }`}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="flex items-center space-x-1.5 font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 text-[10px]">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>MA Trend Template Stack</span>
            </span>
            <span className={`px-2 py-0.2 text-[9px] font-extrabold uppercase rounded-xs border ${
              summary.isBullishAlignment
                ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                : 'bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800'
            }`}>
              {summary.alignmentScore}% Aligned
            </span>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">
              {summary.isBullishAlignment ? 'Bullish Stack' : 'Mixed Trend'}
            </span>
            {summary.goldenCross && (
              <span className="text-[10px] text-amber-500 font-extrabold">
                [50 &gt; 200 Golden Cross]
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
            <span className={summary.priceVsEma10Pct >= 0 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-rose-600 dark:text-rose-400'}>
              10 EMA: {summary.priceVsEma10Pct >= 0 ? '+' : ''}{summary.priceVsEma10Pct}%
            </span>
            <span className={summary.priceVsEma21Pct >= 0 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-rose-600 dark:text-rose-400'}>
              21 EMA: {summary.priceVsEma21Pct >= 0 ? '+' : ''}{summary.priceVsEma21Pct}%
            </span>
            <span className={summary.priceVsSma50Pct >= 0 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-rose-600 dark:text-rose-400'}>
              50 SMA: {summary.priceVsSma50Pct >= 0 ? '+' : ''}{summary.priceVsSma50Pct}%
            </span>
          </div>
        </div>

        {/* Metric 3: Nearest Pivot Point Proximity */}
        <div className={`p-3 border rounded-xs ${
          isObsidian ? 'bg-[#161b22] border-[#2d333b]' : 'bg-purple-50/50 border-purple-200'
        }`}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="flex items-center space-x-1.5 font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 text-[10px]">
              <Compass className="w-3.5 h-3.5" />
              <span>{pivotModel} Pivot Benchmark</span>
            </span>
            <span className="text-[9px] font-bold text-gray-500">
              Center: {currencySymbol}{summary.pivotPoints.pivot.toFixed(2)}
            </span>
          </div>
          {(() => {
            const nearest = summary.pivotPoints.levels.find(l => l.isNearest) || summary.pivotPoints.levels[0];
            return (
              <>
                <div className="flex items-baseline space-x-2">
                  <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                    {nearest.label}
                  </span>
                  <span className="text-sm font-bold text-purple-600 dark:text-purple-400">
                    {currencySymbol}{nearest.price.toFixed(2)}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px]">
                  <span className={nearest.diffPct >= 0 ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-emerald-600 dark:text-emerald-400 font-bold'}>
                    Distance: {nearest.diffPct >= 0 ? '+' : ''}{nearest.diffPct}% ({currencySymbol}{(nearest.price - currentPrice).toFixed(2)})
                  </span>
                  <span className="text-gray-400">
                    R1: {currencySymbol}{summary.pivotPoints.r1.toFixed(2)} | S1: {currencySymbol}{summary.pivotPoints.s1.toFixed(2)}
                  </span>
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* Main Interactive Controls Toolbar */}
      <div className={`p-2.5 px-3 border flex flex-wrap items-center justify-between gap-3 text-xs ${
        isObsidian ? 'bg-[#161b22] border-[#2d333b]' : 'bg-[#f9f8f5] border-[#e5e4e1]'
      }`}>
        {/* Indicator Toggles */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mr-1">
            Moving Averages:
          </span>

          {/* 10 EMA */}
          <button
            onClick={() => setShowEma10(!showEma10)}
            className={`px-2.5 py-1 text-[10px] font-extrabold uppercase transition border cursor-pointer ${
              showEma10
                ? 'bg-[#ec4899] text-white border-[#db2777]'
                : isObsidian ? 'bg-[#21262d] text-gray-400 border-gray-700' : 'bg-white text-gray-400 border-gray-300'
            }`}
          >
            10 EMA
          </button>

          {/* 21 EMA */}
          <button
            onClick={() => setShowEma21(!showEma21)}
            className={`px-2.5 py-1 text-[10px] font-extrabold uppercase transition border cursor-pointer ${
              showEma21
                ? 'bg-[#f59e0b] text-black border-[#d97706]'
                : isObsidian ? 'bg-[#21262d] text-gray-400 border-gray-700' : 'bg-white text-gray-400 border-gray-300'
            }`}
          >
            21 EMA
          </button>

          {/* 20 SMA */}
          <button
            onClick={() => setShowSma20(!showSma20)}
            className={`px-2.5 py-1 text-[10px] font-extrabold uppercase transition border cursor-pointer ${
              showSma20
                ? 'bg-[#06b6d4] text-black border-[#0891b2]'
                : isObsidian ? 'bg-[#21262d] text-gray-400 border-gray-700' : 'bg-white text-gray-400 border-gray-300'
            }`}
          >
            20 SMA
          </button>

          {/* 50 SMA */}
          <button
            onClick={() => setShowSma50(!showSma50)}
            className={`px-2.5 py-1 text-[10px] font-extrabold uppercase transition border cursor-pointer ${
              showSma50
                ? 'bg-[#2563eb] text-white border-[#1d4ed8]'
                : isObsidian ? 'bg-[#21262d] text-gray-400 border-gray-700' : 'bg-white text-gray-400 border-gray-300'
            }`}
          >
            50 SMA
          </button>

          {/* 150 SMA */}
          <button
            onClick={() => setShowSma150(!showSma150)}
            className={`px-2.5 py-1 text-[10px] font-extrabold uppercase transition border cursor-pointer ${
              showSma150
                ? 'bg-[#d97706] text-white border-[#b45309]'
                : isObsidian ? 'bg-[#21262d] text-gray-400 border-gray-700' : 'bg-white text-gray-400 border-gray-300'
            }`}
          >
            150 SMA
          </button>

          {/* 200 SMA */}
          <button
            onClick={() => setShowSma200(!showSma200)}
            className={`px-2.5 py-1 text-[10px] font-extrabold uppercase transition border cursor-pointer ${
              showSma200
                ? 'bg-[#7c3aed] text-white border-[#6d28d9]'
                : isObsidian ? 'bg-[#21262d] text-gray-400 border-gray-700' : 'bg-white text-gray-400 border-gray-300'
            }`}
          >
            200 SMA
          </button>

          <div className="h-4 w-px bg-gray-300 dark:bg-gray-700 mx-1 hidden sm:block"></div>

          {/* Pivot Points Toggle & Model */}
          <button
            onClick={() => setShowPivotLines(!showPivotLines)}
            className={`px-2.5 py-1 text-[10px] font-extrabold uppercase transition border cursor-pointer flex items-center space-x-1 ${
              showPivotLines
                ? 'bg-purple-600 text-white border-purple-500'
                : isObsidian ? 'bg-[#21262d] text-gray-400 border-gray-700' : 'bg-white text-gray-400 border-gray-300'
            }`}
          >
            <Compass className="w-3 h-3" />
            <span>Pivots {showPivotLines ? 'ON' : 'OFF'}</span>
          </button>

          {/* RSI Toggle */}
          <button
            onClick={() => setShowRsiSubchart(!showRsiSubchart)}
            className={`px-2.5 py-1 text-[10px] font-extrabold uppercase transition border cursor-pointer flex items-center space-x-1 ${
              showRsiSubchart
                ? 'bg-amber-600 text-white border-amber-500'
                : isObsidian ? 'bg-[#21262d] text-gray-400 border-gray-700' : 'bg-white text-gray-400 border-gray-300'
            }`}
          >
            <Gauge className="w-3 h-3" />
            <span>RSI Panel {showRsiSubchart ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center space-x-1 text-[10px]">
          <span className="text-gray-500 mr-1">Zoom:</span>
          {(['ALL', '120D', '60D', '30D'] as const).map(z => (
            <button
              key={z}
              onClick={() => { setZoomMode(z); setPanIndex(0); }}
              className={`px-2 py-0.5 font-bold uppercase transition cursor-pointer ${
                zoomMode === z
                  ? 'bg-amber-500 text-black font-black'
                  : isObsidian ? 'bg-[#21262d] text-gray-300 hover:bg-[#30363d]' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
              }`}
            >
              {z}
            </button>
          ))}
        </div>
      </div>

      {/* Primary Technical Price Chart */}
      <div className={`p-3 border relative ${
        isObsidian ? 'bg-[#0e1217] border-[#2d333b]' : 'bg-white border-[#e5e4e1]'
      }`}>
        <div className="w-full h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={displayedHistory}
              margin={{ top: 15, right: 35, left: 10, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={isObsidian ? '#21262d' : '#e5e7eb'}
                vertical={false}
              />
              <XAxis
                dataKey="date"
                stroke={isObsidian ? '#6e7681' : '#9ca3af'}
                tick={{ fontSize: 10, fill: isObsidian ? '#8b949e' : '#6b7280' }}
              />
              <YAxis
                domain={[minPrice, maxPrice]}
                stroke={isObsidian ? '#6e7681' : '#9ca3af'}
                orientation="right"
                tick={{ fontSize: 10, fill: isObsidian ? '#8b949e' : '#6b7280' }}
                tickFormatter={(v) => `${currencySymbol}${v}`}
              />

              {/* Minervini SEPA VCP Pivot Entry Price Line */}
              <ReferenceLine
                y={stock.pivotPrice}
                stroke="#16a34a"
                strokeWidth={1.5}
                strokeDasharray="4 2"
                label={{
                  value: `VCP PIVOT ${currencySymbol}${stock.pivotPrice.toFixed(2)}`,
                  position: 'insideTopLeft',
                  fill: '#16a34a',
                  fontSize: 10,
                  fontWeight: 'bold'
                }}
              />

              {/* Stop Loss Line */}
              <ReferenceLine
                y={stock.stopLossPrice}
                stroke="#dc2626"
                strokeWidth={1.5}
                strokeDasharray="3 3"
                label={{
                  value: `STOP LOSS ${currencySymbol}${stock.stopLossPrice.toFixed(2)}`,
                  position: 'insideBottomLeft',
                  fill: '#dc2626',
                  fontSize: 10,
                  fontWeight: 'bold'
                }}
              />

              {/* Pivot Point Lines (P, R1, R2, S1, S2) */}
              {showPivotLines && summary.pivotPoints && (
                <>
                  {/* Central Pivot P */}
                  <ReferenceLine
                    y={summary.pivotPoints.pivot}
                    stroke="#3b82f6"
                    strokeWidth={1.5}
                    strokeDasharray="5 3"
                    label={{
                      value: `P ${currencySymbol}${summary.pivotPoints.pivot.toFixed(2)}`,
                      position: 'insideRight',
                      fill: '#3b82f6',
                      fontSize: 9,
                      fontWeight: 'bold'
                    }}
                  />
                  {/* R1 */}
                  <ReferenceLine
                    y={summary.pivotPoints.r1}
                    stroke="#f97316"
                    strokeDasharray="3 3"
                    strokeWidth={1}
                    label={{
                      value: `R1 ${currencySymbol}${summary.pivotPoints.r1.toFixed(2)}`,
                      position: 'insideRight',
                      fill: '#f97316',
                      fontSize: 9
                    }}
                  />
                  {/* R2 */}
                  <ReferenceLine
                    y={summary.pivotPoints.r2}
                    stroke="#ef4444"
                    strokeDasharray="3 3"
                    strokeWidth={1}
                    label={{
                      value: `R2 ${currencySymbol}${summary.pivotPoints.r2.toFixed(2)}`,
                      position: 'insideRight',
                      fill: '#ef4444',
                      fontSize: 9
                    }}
                  />
                  {/* S1 */}
                  <ReferenceLine
                    y={summary.pivotPoints.s1}
                    stroke="#10b981"
                    strokeDasharray="3 3"
                    strokeWidth={1}
                    label={{
                      value: `S1 ${currencySymbol}${summary.pivotPoints.s1.toFixed(2)}`,
                      position: 'insideRight',
                      fill: '#10b981',
                      fontSize: 9
                    }}
                  />
                  {/* S2 */}
                  <ReferenceLine
                    y={summary.pivotPoints.s2}
                    stroke="#059669"
                    strokeDasharray="3 3"
                    strokeWidth={1}
                    label={{
                      value: `S2 ${currencySymbol}${summary.pivotPoints.s2.toFixed(2)}`,
                      position: 'insideRight',
                      fill: '#059669',
                      fontSize: 9
                    }}
                  />
                </>
              )}

              {/* Moving Averages Lines */}
              {showEma10 && (
                <Line
                  type="monotone"
                  dataKey="ema10"
                  name="10 EMA"
                  stroke="#ec4899"
                  strokeWidth={2}
                  dot={false}
                />
              )}
              {showEma21 && (
                <Line
                  type="monotone"
                  dataKey="ema21"
                  name="21 EMA"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                />
              )}
              {showSma20 && (
                <Line
                  type="monotone"
                  dataKey="sma20"
                  name="20 SMA"
                  stroke="#06b6d4"
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                  dot={false}
                />
              )}
              {showSma50 && (
                <Line
                  type="monotone"
                  dataKey="sma50"
                  name="50 SMA"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={false}
                />
              )}
              {showSma150 && (
                <Line
                  type="monotone"
                  dataKey="sma150"
                  name="150 SMA"
                  stroke="#d97706"
                  strokeWidth={1.5}
                  dot={false}
                />
              )}
              {showSma200 && (
                <Line
                  type="monotone"
                  dataKey="sma200"
                  name="200 SMA"
                  stroke="#7c3aed"
                  strokeWidth={2}
                  dot={false}
                />
              )}

              {/* Price Line */}
              <Line
                type="monotone"
                dataKey="close"
                name="Close Price"
                stroke={isObsidian ? '#f1f5f9' : '#0f172a'}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 6, fill: '#f59e0b', stroke: '#ffffff', strokeWidth: 2 }}
              />

              {/* Custom Crosshair Tooltip */}
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null;
                  const d = payload[0]?.payload;
                  if (!d) return null;

                  return (
                    <div className={`p-3 rounded-xs border shadow-xl text-[11px] font-mono ${
                      isObsidian ? 'bg-[#161b22] border-[#30363d] text-gray-200' : 'bg-white border-gray-300 text-gray-900'
                    }`}>
                      <div className="font-bold border-b pb-1 mb-1.5 flex items-center justify-between gap-4">
                        <span>{d.date}</span>
                        <span className="text-emerald-500 font-extrabold">
                          Close: {currencySymbol}{d.close.toFixed(2)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        <div>
                          <span className="text-gray-400">High:</span> {currencySymbol}{d.high.toFixed(2)}
                        </div>
                        <div>
                          <span className="text-gray-400">Low:</span> {currencySymbol}{d.low.toFixed(2)}
                        </div>
                        <div>
                          <span className="text-gray-400">Vol:</span> {formatVolume(d.volume)}
                        </div>
                        <div>
                          <span className="text-amber-500 font-bold">RSI(14):</span> {d.rsi ? d.rsi.toFixed(1) : 'N/A'}
                        </div>
                      </div>

                      <div className="border-t pt-1.5 mt-1.5 space-y-0.5 text-[10px]">
                        {showEma10 && d.ema10 && (
                          <div className="flex justify-between text-[#ec4899]">
                            <span>10 EMA:</span> <span>{currencySymbol}{d.ema10.toFixed(2)}</span>
                          </div>
                        )}
                        {showEma21 && d.ema21 && (
                          <div className="flex justify-between text-[#f59e0b]">
                            <span>21 EMA:</span> <span>{currencySymbol}{d.ema21.toFixed(2)}</span>
                          </div>
                        )}
                        {showSma50 && d.sma50 && (
                          <div className="flex justify-between text-[#2563eb]">
                            <span>50 SMA:</span> <span>{currencySymbol}{d.sma50.toFixed(2)}</span>
                          </div>
                        )}
                        {showSma200 && d.sma200 && (
                          <div className="flex justify-between text-[#7c3aed]">
                            <span>200 SMA:</span> <span>{currencySymbol}{d.sma200.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Chart Legend Footer */}
        <div className={`mt-2 pt-2 border-t flex flex-wrap items-center justify-between text-[10px] gap-2 ${
          isObsidian ? 'border-[#2d333b] text-gray-400' : 'border-gray-200 text-gray-600'
        }`}>
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center space-x-1">
              <span className="w-3 h-0.5 bg-slate-900 dark:bg-white inline-block"></span>
              <span className="font-bold">Close</span>
            </span>
            {showEma10 && (
              <span className="flex items-center space-x-1 text-[#ec4899]">
                <span className="w-3 h-0.5 bg-[#ec4899] inline-block"></span>
                <span>10 EMA</span>
              </span>
            )}
            {showEma21 && (
              <span className="flex items-center space-x-1 text-[#f59e0b]">
                <span className="w-3 h-0.5 bg-[#f59e0b] inline-block"></span>
                <span>21 EMA</span>
              </span>
            )}
            {showSma20 && (
              <span className="flex items-center space-x-1 text-[#06b6d4]">
                <span className="w-3 h-0.5 bg-[#06b6d4] inline-block"></span>
                <span>20 SMA</span>
              </span>
            )}
            {showSma50 && (
              <span className="flex items-center space-x-1 text-[#2563eb]">
                <span className="w-3 h-0.5 bg-[#2563eb] inline-block"></span>
                <span>50 SMA</span>
              </span>
            )}
            {showSma200 && (
              <span className="flex items-center space-x-1 text-[#7c3aed]">
                <span className="w-3 h-0.5 bg-[#7c3aed] inline-block"></span>
                <span>200 SMA</span>
              </span>
            )}
            {showPivotLines && (
              <span className="flex items-center space-x-1 text-blue-500">
                <span className="w-3 h-0.5 bg-blue-500 inline-block border-dashed"></span>
                <span>P &amp; R/S Pivots</span>
              </span>
            )}
          </div>
          <div className="italic text-[9px]">
            *Tip: Minervini buys on breakouts supported by the 10/21 EMA pullback cushion.
          </div>
        </div>
      </div>

      {/* Volume Chart */}
      <div className={`p-2 px-3 border ${
        isObsidian ? 'bg-[#0e1217] border-[#2d333b]' : 'bg-white border-[#e5e4e1]'
      }`}>
        <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
          <span className="font-bold uppercase tracking-wider">Trading Volume &amp; 20D Average</span>
          <span>Latest: {formatVolume(displayedHistory[displayedHistory.length - 1]?.volume || 0)}</span>
        </div>
        <div className="w-full h-[90px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={displayedHistory}
              margin={{ top: 5, right: 35, left: 10, bottom: 0 }}
            >
              <XAxis dataKey="date" hide />
              <YAxis
                orientation="right"
                stroke={isObsidian ? '#6e7681' : '#9ca3af'}
                tick={{ fontSize: 9, fill: isObsidian ? '#8b949e' : '#6b7280' }}
                tickFormatter={formatVolume}
              />
              <Line
                type="monotone"
                dataKey="avgVolume20"
                stroke="#d97706"
                strokeWidth={1}
                dot={false}
              />
              <Bar dataKey="volume">
                {displayedHistory.map((entry, idx) => {
                  const isUp = entry.close >= entry.open;
                  const isSpike = entry.volume >= entry.avgVolume20 * 1.5;
                  return (
                    <Cell
                      key={`vol-${idx}`}
                      fill={isSpike ? (isUp ? '#9333ea' : '#ef4444') : (isUp ? '#16a34a' : '#dc2626')}
                      opacity={isSpike ? 0.95 : 0.65}
                    />
                  );
                })}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Synchronized RSI (14) Subchart */}
      {showRsiSubchart && (
        <RsiSubchart
          history={displayedHistory}
          initialPeriod={rsiPeriod}
          isObsidian={isObsidian}
          height={130}
        />
      )}

      {/* Pivot Point Levels Card & Grid */}
      {showPivotTable && (
        <PivotPointLevelsCard
          stock={stock}
          isObsidian={isObsidian}
          selectedModel={pivotModel}
          onModelChange={(m) => setPivotModel(m)}
        />
      )}
    </div>
  );
};
