import React, { useState, useMemo } from 'react';
import { MinerviniTradeSetup } from '../types';
import {
  SECTOR_BENCHMARK_ETFS,
  calculatePearsonCorrelation,
  calculateBeta,
  deriveStockDailyReturns,
  SectorEtfBenchmark,
} from './SectorCorrelationMatrix';
import {
  Layers,
  Activity,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  BarChart2,
  Zap,
  Info,
  CheckCircle2,
  XCircle,
  SlidersHorizontal,
  Compass,
  Award,
  Target,
  Users,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';

interface SectorCorrelationLeadershipCardProps {
  stock: MinerviniTradeSetup;
  allStocks?: MinerviniTradeSetup[];
  onSelectStock?: (stock: MinerviniTradeSetup) => void;
}

export const SectorCorrelationLeadershipCard: React.FC<SectorCorrelationLeadershipCardProps> = ({
  stock,
  allStocks = [],
  onSelectStock,
}) => {
  const [timeframe, setTimeframe] = useState<'20D' | '50D' | '60D'>('20D');
  const [overrideEtfKey, setOverrideEtfKey] = useState<string | null>(null);

  // Determine matched Sector ETF benchmark
  const defaultEtfKey = useMemo(() => {
    const matchedKey = Object.keys(SECTOR_BENCHMARK_ETFS).find(
      (k) => k.toLowerCase() === (stock.sector || '').toLowerCase()
    );
    return matchedKey || 'Broad Market';
  }, [stock.sector]);

  const activeEtfKey = overrideEtfKey || defaultEtfKey;
  const benchmarkEtf: SectorEtfBenchmark =
    SECTOR_BENCHMARK_ETFS[activeEtfKey] || SECTOR_BENCHMARK_ETFS['Broad Market'];

  // Base daily returns streams
  const baseStockReturns = useMemo(() => deriveStockDailyReturns(stock), [stock]);
  const baseEtfReturns = benchmarkEtf.dailyReturns;

  // Timeframe slice count
  const sliceCount = timeframe === '20D' ? 20 : timeframe === '50D' ? 15 : 20;

  const stockReturns = useMemo(
    () => baseStockReturns.slice(-sliceCount),
    [baseStockReturns, sliceCount]
  );
  const etfReturns = useMemo(
    () => baseEtfReturns.slice(-sliceCount),
    [baseEtfReturns, sliceCount]
  );

  // Correlation Coefficient r and Beta coefficient
  const correlationR = useMemo(
    () => calculatePearsonCorrelation(stockReturns, etfReturns),
    [stockReturns, etfReturns]
  );

  const betaVal = useMemo(
    () => calculateBeta(stockReturns, etfReturns),
    [stockReturns, etfReturns]
  );

  // Cumulative performance series for Recharts
  const chartData = useMemo(() => {
    let cumStock = 0;
    let cumEtf = 0;
    const data = [];

    const now = new Date();
    for (let i = 0; i < stockReturns.length; i++) {
      const dayOffset = stockReturns.length - 1 - i;
      const d = new Date(now);
      d.setDate(d.getDate() - dayOffset);
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      cumStock += stockReturns[i];
      cumEtf += etfReturns[i];

      data.push({
        day: `T-${dayOffset}`,
        date: dateStr,
        stockDaily: stockReturns[i],
        etfDaily: etfReturns[i],
        stockCum: Number(cumStock.toFixed(2)),
        etfCum: Number(cumEtf.toFixed(2)),
        alphaGap: Number((cumStock - cumEtf).toFixed(2)),
      });
    }
    return data;
  }, [stockReturns, etfReturns]);

  const stockTotalReturn = chartData.length > 0 ? chartData[chartData.length - 1].stockCum : 0;
  const etfTotalReturn = chartData.length > 0 ? chartData[chartData.length - 1].etfCum : 0;
  const excessAlpha = Number((stockTotalReturn - etfTotalReturn).toFixed(2));
  const rsDiff = stock.rsRating - benchmarkEtf.rsRating;

  // Minervini Trend Leadership Validation Rules (4 Checks)
  const rule1RsDominance = stock.rsRating >= benchmarkEtf.rsRating;
  const rule2ExcessAlpha = excessAlpha > 0;
  const rule3BetaSensitivity = betaVal >= 0.9;
  const rule4SectorAlignment = correlationR >= 0.35 || stock.rsRating >= 90;

  const passedRulesCount = [
    rule1RsDominance,
    rule2ExcessAlpha,
    rule3BetaSensitivity,
    rule4SectorAlignment,
  ].filter(Boolean).length;

  // Correlation status interpretation
  const getCorrelationCategory = (r: number) => {
    if (r >= 0.70) {
      return {
        label: 'HIGH SECTOR SYNCHRONY',
        desc: 'Stock moves in tight lockstep with industry wave.',
        colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-300',
        badgeBg: 'bg-emerald-600 text-white',
        barBg: 'bg-emerald-500',
      };
    } else if (r >= 0.35) {
      return {
        label: 'MODERATE SECTOR CO-MOVEMENT',
        desc: 'Healthy correlation with room for individual stock outperformance.',
        colorClass: 'text-amber-800 bg-amber-50 border-amber-300',
        badgeBg: 'bg-amber-600 text-white',
        barBg: 'bg-amber-500',
      };
    } else if (r >= 0.0) {
      return {
        label: 'IDIOSYNCRATIC / INDEPENDENT ALPHA',
        desc: 'Stock moves independently of sector tide (solo breakout candidate).',
        colorClass: 'text-sky-800 bg-sky-50 border-sky-300',
        badgeBg: 'bg-sky-600 text-white',
        barBg: 'bg-sky-500',
      };
    } else {
      return {
        label: 'INVERSE SECTOR DIVERGENCE',
        desc: 'Stock trends oppositely to its sector index.',
        colorClass: 'text-rose-800 bg-rose-50 border-rose-300',
        badgeBg: 'bg-rose-600 text-white',
        barBg: 'bg-rose-500',
      };
    }
  };

  const correlationInfo = getCorrelationCategory(correlationR);

  // Same-Sector Peers
  const sectorPeers = useMemo(() => {
    if (!allStocks || allStocks.length === 0) return [];
    return allStocks
      .filter((s) => s.sector === stock.sector && s.ticker !== stock.ticker)
      .slice(0, 5);
  }, [allStocks, stock.sector, stock.ticker]);

  return (
    <div className="bg-white border border-[#e5e4e1] p-6 shadow-xs space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e5e4e1] pb-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <Layers className="w-5 h-5 text-amber-600" />
            <h3 className="text-lg font-serif font-black text-[#1a1a1a] uppercase tracking-wide">
              Sector Correlation & Trend Leadership Validator
            </h3>
            <span className="bg-[#1a1a1a] text-amber-300 text-[10px] font-mono px-2 py-0.5 font-bold uppercase tracking-widest">
              SEPA Leader Check
            </span>
          </div>
          <p className="text-xs text-gray-600 font-sans">
            Evaluates Pearson Correlation Coefficient ($r$), Beta sensitivity ($\beta$), and excess return alpha ($\alpha$) against sector benchmark <strong className="font-mono text-black">{benchmarkEtf.symbol} ({benchmarkEtf.name})</strong> to confirm true institutional trend leadership.
          </p>
        </div>

        {/* Controls: Sector ETF Switcher & Timeframe */}
        <div className="flex flex-wrap items-center gap-3">
          {/* ETF Override Dropdown */}
          <div className="flex items-center space-x-1.5 text-xs font-mono">
            <span className="text-gray-500 uppercase text-[10px] font-bold">Benchmark ETF:</span>
            <select
              value={activeEtfKey}
              onChange={(e) => setOverrideEtfKey(e.target.value)}
              className="bg-gray-50 border border-gray-300 p-1.5 text-xs font-bold text-black focus:outline-none cursor-pointer font-mono"
            >
              {Object.keys(SECTOR_BENCHMARK_ETFS).map((etfKey) => {
                const etf = SECTOR_BENCHMARK_ETFS[etfKey];
                return (
                  <option key={etfKey} value={etfKey}>
                    {etf.symbol} — {etf.sectorName} {etfKey === defaultEtfKey ? '(Auto Matched)' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Timeframe Buttons */}
          <div className="inline-flex border border-gray-300 bg-gray-100 p-0.5 font-mono text-xs">
            {(['20D', '50D', '60D'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer ${
                  timeframe === tf
                    ? 'bg-[#1a1a1a] text-white shadow-2xs'
                    : 'text-gray-600 hover:text-black'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Top 4 KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Pearson Correlation Coefficient r */}
        <div className={`p-4 border ${correlationInfo.colorClass} space-y-2 relative overflow-hidden`}>
          <div className="flex justify-between items-start text-xs">
            <span className="font-mono font-bold uppercase tracking-wider text-[10px] opacity-80">
              Correlation ($r$) vs {benchmarkEtf.symbol}
            </span>
            <Activity className="w-4 h-4 opacity-70" />
          </div>

          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-mono font-black text-[#1a1a1a]">
              {correlationR >= 0 ? `+${correlationR.toFixed(2)}` : correlationR.toFixed(2)}
            </span>
            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 ${correlationInfo.badgeBg}`}>
              {correlationR >= 0 ? `${(correlationR * 100).toFixed(0)}% Synced` : 'Inverse'}
            </span>
          </div>

          {/* Correlation Bar Scale (-1.0 to +1.0) */}
          <div className="space-y-1">
            <div className="w-full h-2 bg-gray-200 relative rounded-none overflow-hidden border border-gray-300">
              <div
                className={`h-full ${correlationInfo.barBg} transition-all duration-500`}
                style={{
                  width: `${Math.max(0, Math.min(100, ((correlationR + 1) / 2) * 100))}%`,
                }}
              />
            </div>
            <div className="flex justify-between text-[9px] font-mono text-gray-500">
              <span>-1.0 (Inverse)</span>
              <span>0.0</span>
              <span>+1.0 (Lockstep)</span>
            </div>
          </div>

          <p className="text-[11px] font-bold font-sans line-clamp-1">
            {correlationInfo.label}
          </p>
        </div>

        {/* KPI 2: Sector ETF Benchmark Profile */}
        <div className="p-4 bg-gray-50 border border-gray-200 space-y-2 font-mono">
          <div className="flex justify-between items-start text-xs">
            <span className="text-gray-500 font-bold uppercase text-[10px]">
              Sector Index ETF
            </span>
            <Compass className="w-4 h-4 text-gray-500" />
          </div>

          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-black text-[#1a1a1a]">{benchmarkEtf.symbol}</span>
            <span className="text-xs text-gray-600 font-bold">{benchmarkEtf.sectorName}</span>
          </div>

          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-gray-200">
            <div>
              <span className="text-gray-500 text-[10px]">ETF RS: </span>
              <strong className="text-black">{benchmarkEtf.rsRating}</strong>
            </div>
            <div>
              <span className="text-gray-500 text-[10px]">1D Chg: </span>
              <strong className={benchmarkEtf.changePercent >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                {benchmarkEtf.changePercent >= 0 ? '+' : ''}{benchmarkEtf.changePercent}%
              </strong>
            </div>
          </div>

          <div className="text-[10px] text-amber-800 bg-amber-100/70 px-1.5 py-0.5 font-bold text-center">
            {benchmarkEtf.stage}
          </div>
        </div>

        {/* KPI 3: Stock vs Sector Beta & Excess Alpha */}
        <div className="p-4 bg-gray-50 border border-gray-200 space-y-2 font-mono">
          <div className="flex justify-between items-start text-xs">
            <span className="text-gray-500 font-bold uppercase text-[10px]">
              Beta ($\beta$) & Alpha ($\alpha$)
            </span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>

          <div className="flex items-baseline space-x-3">
            <div>
              <span className="text-2xl font-black text-[#1a1a1a]">{betaVal.toFixed(2)}x</span>
              <span className="text-[9px] text-gray-500 block uppercase">Sector Beta</span>
            </div>
            <div className="border-l border-gray-300 pl-3">
              <span className={`text-2xl font-black ${excessAlpha >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                {excessAlpha >= 0 ? `+${excessAlpha}%` : `${excessAlpha}%`}
              </span>
              <span className="text-[9px] text-gray-500 block uppercase">Excess Alpha</span>
            </div>
          </div>

          <p className="text-[10px] font-sans text-gray-600 pt-1 border-t border-gray-200">
            {betaVal > 1.1
              ? `High Upside Beta (${((betaVal - 1) * 100).toFixed(0)}% higher sensitivity than ${benchmarkEtf.symbol}).`
              : betaVal >= 0.9
              ? `In-Line Volatility with ${benchmarkEtf.symbol}.`
              : `Defensive Low Beta relative to ${benchmarkEtf.symbol}.`}
          </p>
        </div>

        {/* KPI 4: Minervini Trend Leadership Status */}
        <div className="p-4 bg-[#10141d] text-white border border-black space-y-2 font-mono">
          <div className="flex justify-between items-start text-xs">
            <span className="text-amber-400 font-bold uppercase text-[10px] tracking-wider">
              SEPA Leadership Status
            </span>
            <Award className="w-4 h-4 text-amber-400" />
          </div>

          <div className="pt-0.5">
            {passedRulesCount === 4 ? (
              <div className="flex items-center space-x-1.5 text-emerald-400 font-serif font-black text-sm">
                <Award className="w-4 h-4 shrink-0" />
                <span>CONFIRMED SECTOR LEADER</span>
              </div>
            ) : passedRulesCount === 3 ? (
              <div className="flex items-center space-x-1.5 text-amber-300 font-serif font-black text-sm">
                <TrendingUp className="w-4 h-4 shrink-0" />
                <span>STRONG ALPHA OUTPERFORMER</span>
              </div>
            ) : passedRulesCount === 2 ? (
              <div className="flex items-center space-x-1.5 text-sky-300 font-serif font-black text-sm">
                <Activity className="w-4 h-4 shrink-0" />
                <span>IN-LINE SECTOR SYNCED</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1.5 text-rose-400 font-serif font-black text-sm">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>SECTOR LAGGARD / UNCONFIRMED</span>
              </div>
            )}
            <span className="text-[10px] text-gray-400 block font-sans mt-0.5">
              Passed {passedRulesCount} of 4 Minervini Leadership Validation Rules
            </span>
          </div>

          {/* Micro Rules Indicators */}
          <div className="grid grid-cols-2 gap-1 text-[9px] pt-1.5 border-t border-gray-800">
            <div className={`flex items-center space-x-1 ${rule1RsDominance ? 'text-emerald-400' : 'text-gray-500'}`}>
              {rule1RsDominance ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
              <span>RS Dominance</span>
            </div>
            <div className={`flex items-center space-x-1 ${rule2ExcessAlpha ? 'text-emerald-400' : 'text-gray-500'}`}>
              {rule2ExcessAlpha ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
              <span>Excess Alpha</span>
            </div>
            <div className={`flex items-center space-x-1 ${rule3BetaSensitivity ? 'text-emerald-400' : 'text-gray-500'}`}>
              {rule3BetaSensitivity ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
              <span>Upside Beta</span>
            </div>
            <div className={`flex items-center space-x-1 ${rule4SectorAlignment ? 'text-emerald-400' : 'text-gray-500'}`}>
              {rule4SectorAlignment ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
              <span>Sector Alignment</span>
            </div>
          </div>
        </div>
      </div>

      {/* Middle Section: Dual Line Comparison Chart (Stock vs Sector ETF Index) */}
      <div className="bg-gray-50 border border-gray-200 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-2">
          <div className="flex items-center space-x-2">
            <BarChart2 className="w-4 h-4 text-amber-600" />
            <h4 className="text-xs font-mono font-bold text-[#1a1a1a] uppercase tracking-wider">
              {timeframe} Cumulative Return Trajectory: {stock.ticker} vs. {benchmarkEtf.symbol} ({benchmarkEtf.sectorName})
            </h4>
          </div>

          <div className="flex items-center space-x-4 text-xs font-mono">
            <div className="flex items-center space-x-1.5">
              <div className="w-3 h-3 bg-amber-500 border border-amber-600" />
              <span className="font-bold text-black">{stock.ticker} Cumulative ({stockTotalReturn >= 0 ? '+' : ''}{stockTotalReturn}%)</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <div className="w-3 h-3 bg-sky-600 border border-sky-700" />
              <span className="font-bold text-gray-700">{benchmarkEtf.symbol} ETF ({etfTotalReturn >= 0 ? '+' : ''}{etfTotalReturn}%)</span>
            </div>
          </div>
        </div>

        {/* Recharts Line Component */}
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <XAxis
                dataKey="date"
                stroke="#6b7280"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: '#d1d5db' }}
              />
              <YAxis
                stroke="#6b7280"
                fontSize={10}
                tickFormatter={(v) => `${v}%`}
                tickLine={false}
                axisLine={{ stroke: '#d1d5db' }}
              />
              <Tooltip content={<CustomCorrelationTooltip stockTicker={stock.ticker} etfSymbol={benchmarkEtf.symbol} />} />
              <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />
              <Line
                type="monotone"
                dataKey="stockCum"
                name={stock.ticker}
                stroke="#d97706"
                strokeWidth={3}
                dot={{ r: 3, fill: '#d97706', stroke: '#ffffff', strokeWidth: 1 }}
                activeDot={{ r: 6, fill: '#b45309' }}
              />
              <Line
                type="monotone"
                dataKey="etfCum"
                name={benchmarkEtf.symbol}
                stroke="#0284c7"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={{ r: 2, fill: '#0284c7' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Section: Sector Peers & Minervini Leadership Guidance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Same Sector Peers Correlation Leaderboard */}
        <div className="lg:col-span-2 space-y-3 bg-white border border-[#e5e4e1] p-4">
          <div className="flex items-center justify-between border-b border-gray-200 pb-2">
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-amber-600" />
              <h4 className="text-xs font-mono font-bold text-[#1a1a1a] uppercase tracking-wider">
                Same-Sector Peer Group Correlation Leaderboard ({stock.sector})
              </h4>
            </div>
            <span className="text-[10px] text-gray-500 font-sans italic">
              Comparing RS, Beta, and $r$ across peer setups
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="bg-gray-100 text-gray-600 border-b border-gray-200 uppercase text-[10px]">
                  <th className="p-2">Ticker / Name</th>
                  <th className="p-2 text-center">RS Rating</th>
                  <th className="p-2 text-center">Correlation ($r$)</th>
                  <th className="p-2 text-center">Beta ($\beta$)</th>
                  <th className="p-2 text-right">1D Change %</th>
                  <th className="p-2 text-center">SEPA Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {/* Currently Selected Stock Row */}
                <tr className="bg-amber-50 font-bold border-l-4 border-amber-500">
                  <td className="p-2">
                    <div className="flex items-center space-x-1.5">
                      <span className="bg-[#1a1a1a] text-amber-300 text-[10px] px-1 py-0.5 font-bold">
                        {stock.ticker}
                      </span>
                      <span className="text-gray-900 font-sans truncate max-w-[120px]">
                        {stock.name} (Active)
                      </span>
                    </div>
                  </td>
                  <td className="p-2 text-center">
                    <span className="bg-amber-600 text-white text-[10px] px-1.5 py-0.5 font-bold">
                      {stock.rsRating} RS
                    </span>
                  </td>
                  <td className="p-2 text-center font-bold text-amber-900">
                    +{correlationR.toFixed(2)}
                  </td>
                  <td className="p-2 text-center text-gray-800">{betaVal.toFixed(2)}x</td>
                  <td
                    className={`p-2 text-right ${
                      stock.changePercent >= 0 ? 'text-emerald-700' : 'text-rose-600'
                    }`}
                  >
                    {stock.changePercent >= 0 ? '+' : ''}
                    {stock.changePercent}%
                  </td>
                  <td className="p-2 text-center">
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.5">
                      ACTIVE SEPA
                    </span>
                  </td>
                </tr>

                {/* Peer Stock Rows */}
                {sectorPeers.length > 0 ? (
                  sectorPeers.map((peer) => {
                    const peerReturns = deriveStockDailyReturns(peer);
                    const peerR = calculatePearsonCorrelation(peerReturns, etfReturns);
                    const peerBeta = calculateBeta(peerReturns, etfReturns);
                    return (
                      <tr
                        key={peer.ticker}
                        onClick={() => onSelectStock && onSelectStock(peer)}
                        className="hover:bg-gray-50 transition-all cursor-pointer"
                      >
                        <td className="p-2">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-bold text-[#1a1a1a]">{peer.ticker}</span>
                            <span className="text-gray-500 text-[10px] font-sans truncate max-w-[120px]">
                              {peer.name}
                            </span>
                          </div>
                        </td>
                        <td className="p-2 text-center">
                          <span
                            className={`text-[10px] px-1.5 py-0.5 font-bold ${
                              peer.rsRating >= 85
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {peer.rsRating} RS
                          </span>
                        </td>
                        <td className="p-2 text-center text-gray-700">
                          {peerR >= 0 ? `+${peerR.toFixed(2)}` : peerR.toFixed(2)}
                        </td>
                        <td className="p-2 text-center text-gray-600">{peerBeta.toFixed(2)}x</td>
                        <td
                          className={`p-2 text-right ${
                            peer.changePercent >= 0 ? 'text-emerald-700' : 'text-rose-600'
                          }`}
                        >
                          {peer.changePercent >= 0 ? '+' : ''}
                          {peer.changePercent}%
                        </td>
                        <td className="p-2 text-center">
                          <span className="text-[10px] bg-gray-100 text-gray-600 border border-gray-200 px-1 py-0.5">
                            {peer.patternType || 'Candidate'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-gray-400 font-sans italic">
                      No other setups in {stock.sector} sector currently loaded in watchlists.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Minervini Trend Leadership Insights Box */}
        <div className="bg-[#10141d] text-white p-4 border border-black space-y-3 font-mono text-xs flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center space-x-1.5 text-amber-400 font-serif font-bold border-b border-gray-800 pb-2">
              <Target className="w-4 h-4 text-amber-400" />
              <span className="uppercase tracking-wider">Minervini Sector Leadership Law</span>
            </div>

            <p className="text-[11px] font-sans text-gray-300 leading-relaxed">
              In SEPA trading, <strong className="text-white">industry sector confirmation is mandatory</strong>. True market leaders hold high Relative Strength ($RS &ge; 85$) AND demonstrate high sector synchrony ($r &ge; 0.50$).
            </p>

            <div className="bg-gray-900/90 p-2.5 border border-amber-500/30 space-y-1.5 text-[10px]">
              <div className="text-amber-300 font-bold uppercase tracking-wider">
                Actionable Correlation Takeaway:
              </div>
              {correlationR >= 0.70 ? (
                <p className="text-gray-300 font-sans">
                  ✅ <strong className="text-emerald-300">High Synergy ($r = +{correlationR.toFixed(2)})$</strong>: {stock.ticker} is riding a strong institutional sector wave in {benchmarkEtf.sectorName}. High probability of explosive follow-through upon pivot breakout.
                </p>
              ) : correlationR >= 0.35 ? (
                <p className="text-gray-300 font-sans">
                  ⚡ <strong className="text-amber-300">Moderate Synergy ($r = +{correlationR.toFixed(2)})$</strong>: Solid balance between sector tide and idiosyncratic strength. Watch for {benchmarkEtf.symbol} ETF breaking key resistance levels.
                </p>
              ) : (
                <p className="text-gray-300 font-sans">
                  ⚠️ <strong className="text-sky-300">Decoupled Outperformer ($r = +{correlationR.toFixed(2)})$</strong>: Moving independently of {benchmarkEtf.symbol}. Ensure strict stop loss as sector tailwinds are absent.
                </p>
              )}
            </div>
          </div>

          <div className="text-[9px] text-gray-500 pt-2 border-t border-gray-800 font-sans italic">
            Pearson Correlation formula: r = Σ((x - x̄)(y - ȳ)) / √(Σ(x - x̄)² * Σ(y - ȳ)²)
          </div>
        </div>
      </div>
    </div>
  );
};

// Custom Tooltip for Recharts Line Chart
const CustomCorrelationTooltip = ({ active, payload, label, stockTicker, etfSymbol }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-[#10141d] border border-amber-500/50 p-3 text-white text-xs font-mono shadow-xl space-y-1.5">
        <div className="text-amber-400 font-bold text-[11px] border-b border-gray-800 pb-1 flex justify-between">
          <span>{data.date} ({data.day})</span>
          <span className="text-gray-400 font-normal text-[10px]">Cumulative Returns</span>
        </div>
        <div className="flex justify-between space-x-4">
          <span className="text-amber-300 font-bold">{stockTicker}:</span>
          <span className="font-bold">{data.stockCum >= 0 ? '+' : ''}{data.stockCum}%</span>
        </div>
        <div className="flex justify-between space-x-4">
          <span className="text-sky-300 font-bold">{etfSymbol}:</span>
          <span className="font-bold">{data.etfCum >= 0 ? '+' : ''}{data.etfCum}%</span>
        </div>
        <div className="flex justify-between space-x-4 pt-1 border-t border-gray-800 text-[10px]">
          <span className="text-gray-400">Excess Alpha Gap:</span>
          <span className={`font-bold ${data.alphaGap >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {data.alphaGap >= 0 ? '+' : ''}{data.alphaGap}%
          </span>
        </div>
      </div>
    );
  }
  return null;
};
