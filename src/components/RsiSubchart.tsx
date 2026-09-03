import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ReferenceArea
} from 'recharts';
import { PricePoint } from '../types';
import { calculateRsiSeries, RsiPoint } from '../utils/technicalIndicatorsCalculator';
import { Gauge, Sparkles, TrendingUp, AlertTriangle, SlidersHorizontal, CheckCircle2 } from 'lucide-react';

interface RsiSubchartProps {
  history: PricePoint[];
  initialPeriod?: number;
  isObsidian?: boolean;
  onHoverDate?: (date: string | null) => void;
  height?: number;
}

export const RsiSubchart: React.FC<RsiSubchartProps> = ({
  history,
  initialPeriod = 14,
  isObsidian = false,
  onHoverDate,
  height = 140
}) => {
  const [period, setPeriod] = useState<number>(initialPeriod);
  const [overboughtThreshold, setOverboughtThreshold] = useState<number>(70);
  const [oversoldThreshold, setOversoldThreshold] = useState<number>(30);
  const [showSepaZone, setShowSepaZone] = useState<boolean>(true);

  const rsiData = useMemo(() => {
    return calculateRsiSeries(history || [], period);
  }, [history, period]);

  const latestPoint: RsiPoint | undefined = rsiData[rsiData.length - 1];
  const currentRsi = latestPoint?.rsi ?? 50;

  // Detect recent divergences in the last 15 bars
  const recentDivergence = useMemo(() => {
    const slice = rsiData.slice(Math.max(0, rsiData.length - 15));
    return slice.find(p => p.divergence !== null)?.divergence ?? null;
  }, [rsiData]);

  const statusColor = useMemo(() => {
    if (currentRsi >= overboughtThreshold) return 'text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800';
    if (currentRsi >= 50 && currentRsi < overboughtThreshold) return 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800';
    if (currentRsi <= oversoldThreshold) return 'text-cyan-600 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-950/60 border-cyan-300 dark:border-cyan-800';
    return 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800';
  }, [currentRsi, overboughtThreshold, oversoldThreshold]);

  const statusText = useMemo(() => {
    if (currentRsi >= overboughtThreshold) return 'Overbought (>70)';
    if (currentRsi >= 50 && currentRsi < overboughtThreshold) return 'SEPA Momentum Sweet Spot (50–70)';
    if (currentRsi <= oversoldThreshold) return 'Oversold (<30)';
    return 'Neutral (30–50)';
  }, [currentRsi, overboughtThreshold, oversoldThreshold]);

  return (
    <div className={`border font-mono transition-colors duration-200 ${
      isObsidian ? 'bg-[#0e1217] border-[#2d333b]' : 'bg-[#f9f8f5] border-[#e5e4e1]'
    }`}>
      {/* Indicator Header Bar */}
      <div className={`p-2.5 px-3 flex flex-wrap items-center justify-between gap-2 border-b text-xs ${
        isObsidian ? 'bg-[#161b22] border-[#2d333b]' : 'bg-white border-[#e5e4e1]'
      }`}>
        {/* Title and Current RSI Value */}
        <div className="flex items-center space-x-2.5">
          <div className="flex items-center space-x-1.5 text-amber-500 font-bold uppercase tracking-wider text-[11px]">
            <Gauge className="w-3.5 h-3.5 text-amber-500" />
            <span>RSI ({period}):</span>
          </div>

          <span className="text-sm font-extrabold font-mono text-slate-900 dark:text-white">
            {currentRsi.toFixed(1)}
          </span>

          <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-tight rounded-xs border ${statusColor}`}>
            {statusText}
          </span>

          {currentRsi >= 50 && currentRsi <= 70 && (
            <span className="hidden sm:inline-flex items-center space-x-1 text-[9px] font-extrabold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-3 h-3" />
              <span>Minervini Pass</span>
            </span>
          )}

          {recentDivergence && (
            <span className={`px-1.5 py-0.5 text-[9px] font-black uppercase rounded-xs border ${
              recentDivergence === 'BULLISH'
                ? 'bg-purple-900/60 text-purple-200 border-purple-500 animate-pulse'
                : 'bg-orange-900/60 text-orange-200 border-orange-500 animate-pulse'
            }`}>
              ⚡ {recentDivergence} Divergence
            </span>
          )}
        </div>

        {/* Quick Config Controls */}
        <div className="flex items-center space-x-2 text-[10px]">
          <div className="flex items-center space-x-1">
            <span className="text-gray-500 dark:text-gray-400">Length:</span>
            {[9, 14, 21].map(len => (
              <button
                key={len}
                onClick={() => setPeriod(len)}
                className={`px-1.5 py-0.5 font-bold uppercase transition cursor-pointer ${
                  period === len
                    ? 'bg-amber-500 text-black font-extrabold'
                    : isObsidian ? 'bg-[#21262d] text-gray-300 hover:bg-[#30363d]' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {len}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowSepaZone(!showSepaZone)}
            className={`px-2 py-0.5 font-bold uppercase transition border cursor-pointer ${
              showSepaZone
                ? 'bg-emerald-600 text-white border-emerald-500'
                : isObsidian ? 'bg-[#21262d] text-gray-400 border-gray-700' : 'bg-gray-100 text-gray-400 border-gray-300'
            }`}
            title="Toggle SEPA 50-70 Momentum Sweet Spot Shaded Zone"
          >
            50-70 Band {showSepaZone ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div style={{ height: `${height}px` }} className="w-full p-2 relative">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={rsiData}
            margin={{ top: 8, right: 20, left: 10, bottom: 0 }}
            onMouseMove={(e: any) => {
              if (onHoverDate && e?.activeLabel) {
                onHoverDate(e.activeLabel);
              }
            }}
            onMouseLeave={() => {
              if (onHoverDate) onHoverDate(null);
            }}
          >
            <XAxis dataKey="date" hide />
            <YAxis
              domain={[0, 100]}
              ticks={[30, 50, 70]}
              stroke={isObsidian ? '#484f58' : '#888888'}
              orientation="right"
              tick={{ fontSize: 9, fill: isObsidian ? '#8b949e' : '#666666' }}
            />

            {/* SEPA Momentum Sweet Spot Zone 50 - 70 */}
            {showSepaZone && (
              <ReferenceArea
                {...({
                  y1: 50,
                  y2: 70,
                  fill: '#10b981',
                  fillOpacity: isObsidian ? 0.12 : 0.1,
                  stroke: '#10b981',
                  strokeOpacity: 0.25,
                  strokeDasharray: '2 2',
                } as any)}
              />
            )}

            {/* Overbought 70 Line */}
            <ReferenceLine
              y={overboughtThreshold}
              stroke="#ef4444"
              strokeDasharray="3 3"
              strokeWidth={1}
              label={{
                value: `OB ${overboughtThreshold}`,
                position: 'insideTopLeft',
                fill: '#ef4444',
                fontSize: 9,
                fontWeight: 'bold'
              }}
            />

            {/* Centerline 50 */}
            <ReferenceLine
              y={50}
              stroke={isObsidian ? '#6e7681' : '#9ca3af'}
              strokeDasharray="2 2"
              strokeWidth={1}
            />

            {/* Oversold 30 Line */}
            <ReferenceLine
              y={oversoldThreshold}
              stroke="#06b6d4"
              strokeDasharray="3 3"
              strokeWidth={1}
              label={{
                value: `OS ${oversoldThreshold}`,
                position: 'insideBottomLeft',
                fill: '#06b6d4',
                fontSize: 9,
                fontWeight: 'bold'
              }}
            />

            {/* Custom Interactive Tooltip */}
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) return null;
                const pt = payload[0].payload as RsiPoint;
                if (!pt) return null;

                const isSepa = pt.rsi >= 50 && pt.rsi <= 70;
                return (
                  <div className={`p-2.5 rounded-sm border shadow-lg text-[10px] font-mono ${
                    isObsidian ? 'bg-[#161b22] border-[#30363d] text-gray-200' : 'bg-white border-gray-300 text-gray-900'
                  }`}>
                    <div className="font-bold border-b pb-1 mb-1.5 flex items-center justify-between gap-3">
                      <span>{pt.date}</span>
                      <span className={`px-1.5 py-0.2 rounded-xs text-[9px] font-extrabold ${
                        isSepa ? 'bg-emerald-600 text-white' : pt.rsi >= 70 ? 'bg-rose-600 text-white' : pt.rsi <= 30 ? 'bg-cyan-600 text-white' : 'bg-gray-600 text-white'
                      }`}>
                        {pt.status}
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex justify-between gap-4">
                        <span className="text-gray-400">Close Price:</span>
                        <span className="font-bold">${pt.close.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-amber-500 font-bold">RSI ({period}):</span>
                        <span className="font-extrabold text-amber-400">{pt.rsi.toFixed(1)}</span>
                      </div>
                      {pt.divergence && (
                        <div className="text-purple-400 font-bold pt-1 border-t mt-1">
                          ⚠️ {pt.divergence} Divergence Detected
                        </div>
                      )}
                    </div>
                  </div>
                );
              }}
            />

            {/* RSI Line with Dynamic Gradient Glow */}
            <Line
              type="monotone"
              dataKey="rsi"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5, fill: '#f59e0b', stroke: '#ffffff', strokeWidth: 1.5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Footer Legend Bar */}
      <div className={`px-3 py-1.5 border-t flex flex-wrap items-center justify-between text-[9px] text-gray-500 dark:text-gray-400 ${
        isObsidian ? 'bg-[#12161c] border-[#2d333b]' : 'bg-[#faf8f5] border-[#e5e4e1]'
      }`}>
        <div className="flex items-center space-x-3">
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>50-70 SEPA Momentum Sweet Spot</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            <span>&gt;70 Overbought</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
            <span>&lt;30 Oversold</span>
          </span>
        </div>
        <div className="italic">
          Minervini Rule: Top Stage 2 leaders typically consolidate with RSI oscillating in the 50–70 sweet spot.
        </div>
      </div>
    </div>
  );
};
