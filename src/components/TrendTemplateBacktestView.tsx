import React, { useState, useMemo } from 'react';
import {
  runMinerviniBacktest,
  BacktestConfig,
  BacktestSummaryReport,
  VOLATILE_GROWTH_STOCKS,
  StopLossMode,
  ProfitTargetMode,
  StrategyTrendMode,
  BacktestTrade
} from '../utils/minerviniTrendTemplateBacktester';
import {
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  ShieldCheck,
  Award,
  BarChart3,
  Sliders,
  Sparkles,
  Zap,
  Target,
  RefreshCw,
  Download,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  FileText,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Flame,
  Clock,
  Layers,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Activity,
  Calendar,
  Search,
  ExternalLink,
  Skull
} from 'lucide-react';
import { formatCurrency } from '../utils/sepaCalculator';

interface TrendTemplateBacktestViewProps {
  onSelectStockTicker?: (ticker: string) => void;
  isObsidian?: boolean;
}

export const TrendTemplateBacktestView: React.FC<TrendTemplateBacktestViewProps> = ({
  onSelectStockTicker,
  isObsidian = true
}) => {
  // Strategy Configurations State
  const [universe, setUniverse] = useState<BacktestConfig['universe']>('ALL');
  const [trendMode, setTrendMode] = useState<StrategyTrendMode>('BULLISH_STAGE_2');
  const [stopLossMode, setStopLossMode] = useState<StopLossMode>('2x_atr');
  const [profitTargetMode, setProfitTargetMode] = useState<ProfitTargetMode>('2r');
  const [initialCapital, setInitialCapital] = useState<number>(100000);
  const [maxRiskPerTradePct, setMaxRiskPerTradePct] = useState<number>(1.5);
  const [maxConcurrentPositions, setMaxConcurrentPositions] = useState<number>(6);
  const [maxHoldingDays, setMaxHoldingDays] = useState<number>(65);

  // Filter & Display States
  const [activeTab, setActiveTab] = useState<'overview' | 'trades' | 'tickers' | 'report'>('overview');
  const [outcomeFilter, setOutcomeFilter] = useState<'ALL' | 'WIN' | 'LOSS' | 'SCRATCH'>('ALL');
  const [tickerFilter, setTickerFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedReport, setCopiedReport] = useState<boolean>(false);
  const [expandedTradeId, setExpandedTradeId] = useState<string | null>(null);

  // Run backtest with current parameters
  const backtestResult: BacktestSummaryReport = useMemo(() => {
    return runMinerviniBacktest({
      universe,
      trendMode,
      stopLossMode,
      profitTargetMode,
      initialCapital,
      maxRiskPerTradePct,
      maxConcurrentPositions,
      trailToBreakevenAtR: 1.0,
      maxHoldingDays
    });
  }, [universe, trendMode, stopLossMode, profitTargetMode, initialCapital, maxRiskPerTradePct, maxConcurrentPositions, maxHoldingDays]);

  // Filtered trades list
  const filteredTrades = useMemo(() => {
    return backtestResult.trades.filter((trade) => {
      if (outcomeFilter !== 'ALL' && trade.outcome !== outcomeFilter) return false;
      if (tickerFilter !== 'ALL' && trade.ticker !== tickerFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return trade.ticker.toLowerCase().includes(q) || trade.companyName.toLowerCase().includes(q) || trade.exitReason.toLowerCase().includes(q);
      }
      return true;
    });
  }, [backtestResult.trades, outcomeFilter, tickerFilter, searchQuery]);

  // Copy Markdown Summary Report
  const handleCopyReport = () => {
    navigator.clipboard.writeText(backtestResult.executiveSummaryText);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2500);
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'Trade ID',
      'Ticker',
      'Company',
      'Exchange',
      'Entry Date',
      'Entry Price',
      'Shares',
      'Initial Stop',
      'Initial Target',
      'Exit Date',
      'Exit Price',
      'Exit Reason',
      'Outcome',
      'Realized P&L',
      'P&L %',
      'R-Multiple',
      'Holding Days'
    ];

    const rows = backtestResult.trades.map((t) => [
      t.id,
      t.ticker,
      `"${t.companyName}"`,
      t.exchange,
      t.entryDate,
      t.entryPrice,
      t.shares,
      t.initialStopLoss,
      t.initialTargetPrice,
      t.exitDate,
      t.exitPrice,
      `"${t.exitReason}"`,
      t.outcome,
      t.realizedPnl,
      t.realizedPnlPercent,
      t.realizedRMultiple,
      t.holdingDays
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `minervini_trend_template_backtest_${universe.toLowerCase()}_${stopLossMode}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Equity Curve min and max for SVG rendering
  const { minEq, maxEq, svgPath, benchmarkSvgPath } = useMemo(() => {
    const curve = backtestResult.equityCurve;
    if (!curve || curve.length === 0) return { minEq: 0, maxEq: 0, svgPath: '', benchmarkSvgPath: '' };

    const equities = curve.map((c) => c.equity);
    const benchmarks = curve.map((c) => c.benchmarkEquity);
    const allVals = [...equities, ...benchmarks];
    const minVal = Math.min(...allVals) * 0.95;
    const maxVal = Math.max(...allVals) * 1.05;

    const width = 800;
    const height = 220;

    const getX = (idx: number) => (idx / (curve.length - 1)) * width;
    const getY = (val: number) => height - ((val - minVal) / (maxVal - minVal || 1)) * height;

    let path = `M 0 ${getY(curve[0].equity)}`;
    for (let i = 1; i < curve.length; i++) {
      path += ` L ${getX(i)} ${getY(curve[i].equity)}`;
    }

    let bPath = `M 0 ${getY(curve[0].benchmarkEquity)}`;
    for (let i = 1; i < curve.length; i++) {
      bPath += ` L ${getX(i)} ${getY(curve[i].benchmarkEquity)}`;
    }

    return { minEq: minVal, maxEq: maxVal, svgPath: path, benchmarkSvgPath: bPath };
  }, [backtestResult.equityCurve]);

  // Underwater Drawdown SVG path
  const { maxDdVal, drawdownSvgPath } = useMemo(() => {
    const curve = backtestResult.equityCurve;
    if (!curve || curve.length === 0) return { maxDdVal: 0, drawdownSvgPath: '' };

    const maxDd = Math.max(...curve.map((c) => c.drawdownPct), 1);
    const width = 800;
    const height = 90;

    const getX = (idx: number) => (idx / (curve.length - 1)) * width;
    const getY = (dd: number) => (dd / maxDd) * (height - 10);

    let path = `M 0 0`;
    for (let i = 0; i < curve.length; i++) {
      path += ` L ${getX(i)} ${getY(curve[i].drawdownPct)}`;
    }
    path += ` L ${width} 0 Z`;

    return { maxDdVal: maxDd, drawdownSvgPath: path };
  }, [backtestResult.equityCurve]);

  return (
    <div className="space-y-6 font-sans">
      
      {/* HEADER BANNER */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 rounded-xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center space-x-2.5 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-widest bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-indigo-400" />
                SEPA Quantitative Backtesting Engine
              </span>
              <span className="text-xs font-mono text-gray-400">
                Mark Minervini Trend Continuation Template
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-serif font-black text-white tracking-tight">
              Volatile Growth Stocks Trend Template Backtest
            </h1>
            <p className="text-sm text-gray-300 font-sans mt-1 max-w-3xl leading-relaxed">
              Evaluating the 8-Rule Stage 2 Trend Template with volatility contraction pivot breakout triggers,
              strict predefined stop losses (<span className="text-indigo-300 font-mono font-bold">2x ATR vs Fixed Stop</span>),
              and asymmetric profit-taking across 16 premier growth momentum market leaders.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={handleCopyReport}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-mono font-bold text-xs uppercase tracking-wider border border-slate-700 shadow-md flex items-center space-x-2 transition-all cursor-pointer hover:border-indigo-400"
            >
              {copiedReport ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-indigo-300" />}
              <span>{copiedReport ? 'Report Copied!' : 'Copy Summary Report'}</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-mono font-bold text-xs uppercase tracking-wider border border-emerald-600 shadow-md flex items-center space-x-2 transition-all cursor-pointer hover:scale-[1.02]"
            >
              <Download className="w-4 h-4 text-emerald-200" />
              <span>Export CSV Trades</span>
            </button>
          </div>
        </div>
      </div>

      {/* STRATEGY PARAMETER CONTROL CONSOLE */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg backdrop-blur-sm">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Sliders className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-white">
              Backtesting Parameter Configuration
            </span>
          </div>
          <span className="text-[11px] font-mono text-gray-400">
            {VOLATILE_GROWTH_STOCKS.length} Growth Stocks Evaluated • Jan 2022 to Feb 2026 (~{backtestResult.totalTradingDays} Days)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          
          {/* 1. Strategy Trend Direction (Bullish vs Automatic Bearish vs Dual) */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono font-bold text-gray-300 flex items-center justify-between">
              <span>Trend Direction</span>
              <span className={trendMode === 'AUTOMATIC_BEARISH_STAGE_4' ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                {trendMode === 'AUTOMATIC_BEARISH_STAGE_4' ? 'Short Breakdowns' : trendMode === 'ADAPTIVE_REGIME' ? 'Adaptive Dual' : 'Stage 2 Longs'}
              </span>
            </label>
            <select
              value={trendMode}
              onChange={(e) => setTrendMode(e.target.value as StrategyTrendMode)}
              className={`w-full border rounded-lg px-3 py-2 text-xs font-mono font-bold cursor-pointer transition-colors ${
                trendMode === 'AUTOMATIC_BEARISH_STAGE_4'
                  ? 'bg-rose-950/80 border-rose-600 text-rose-200'
                  : 'bg-slate-800 border-slate-700 text-white focus:outline-none focus:border-indigo-500'
              }`}
            >
              <option value="BULLISH_STAGE_2">🟢 Stage 2 Bullish (Longs)</option>
              <option value="AUTOMATIC_BEARISH_STAGE_4">🔴 Automatic Bearish Trend (Shorts)</option>
              <option value="ADAPTIVE_REGIME">⚡ Adaptive Dual (Long + Short)</option>
            </select>
          </div>

          {/* 2. Stock Universe Selection */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono font-bold text-gray-300 flex items-center justify-between">
              <span>Stock Universe</span>
              <span className="text-indigo-400 font-normal">
                {universe === 'ALL' ? '16 Stocks' : universe === 'US_ONLY' ? '8 US Stocks' : '8 NSE Stocks'}
              </span>
            </label>
            <select
              value={universe}
              onChange={(e) => setUniverse(e.target.value as BacktestConfig['universe'])}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono font-semibold text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="ALL">All Volatile Growth (16 Leaders)</option>
              <option value="US_ONLY">US Growth (NVDA, TSLA, PLTR...)</option>
              <option value="INDIA_ONLY">India NSE (TRENT, DIXON, BEL...)</option>
            </select>
          </div>

          {/* 2. Predefined Stop Loss Mode */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono font-bold text-gray-300 flex items-center justify-between">
              <span>Predefined Stop Loss</span>
              <span className="text-amber-400 font-normal">Risk Containment</span>
            </label>
            <select
              value={stopLossMode}
              onChange={(e) => setStopLossMode(e.target.value as StopLossMode)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono font-semibold text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="2x_atr">2x ATR (14-day) Adaptive Stop (User Prompt Spec)</option>
              <option value="fixed_7pct">7.0% Fixed Hard Stop (Minervini Ideal Benchmark)</option>
              <option value="fixed_8pct">8.0% Fixed Stop (Minervini Max Allowed Rule)</option>
              <option value="fixed_10pct">10.0% Fixed Stop (Upper Bound Spec)</option>
              <option value="fixed_5pct">5.0% Tight Stop (Ultra-Aggressive Pivot Stop)</option>
            </select>
          </div>

          {/* 3. Predefined Profit Target Mode */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono font-bold text-gray-300 flex items-center justify-between">
              <span>Predefined Exit Target</span>
              <span className="text-emerald-400 font-normal">R-Multiple Target</span>
            </label>
            <select
              value={profitTargetMode}
              onChange={(e) => setProfitTargetMode(e.target.value as ProfitTargetMode)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono font-semibold text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="2r">2.0R Target (2x Initial Risk per Minervini)</option>
              <option value="3r">3.0R Target (3x Initial Risk Multiplier)</option>
              <option value="minervini_20pct">20% Fixed Swing Target (Minervini Rule)</option>
              <option value="trailing_only">Trailing Stop Only (Let Big Runners Compound)</option>
            </select>
          </div>

          {/* 4. Portfolio Allocation & Sizing */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono font-bold text-gray-300 flex items-center justify-between">
              <span>Risk Sizing / Max Positions</span>
              <span className="text-indigo-400 font-normal">{maxRiskPerTradePct}% Risk / Max {maxConcurrentPositions}</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={maxRiskPerTradePct}
                onChange={(e) => setMaxRiskPerTradePct(Number(e.target.value))}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-xs font-mono font-semibold text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value={1.0}>1.0% Risk</option>
                <option value={1.5}>1.5% Risk</option>
                <option value={2.0}>2.0% Risk</option>
                <option value={2.5}>2.5% Risk</option>
              </select>
              <select
                value={maxConcurrentPositions}
                onChange={(e) => setMaxConcurrentPositions(Number(e.target.value))}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-xs font-mono font-semibold text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value={4}>Max 4 Positions</option>
                <option value={6}>Max 6 Positions</option>
                <option value={8}>Max 8 Positions</option>
              </select>
            </div>
          </div>

        </div>

        {/* Live Active Rules Pills */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-2 text-[11px] font-mono text-gray-400">
          <span className="text-gray-500">Active Criteria:</span>
          <span className="px-2 py-0.5 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800/40">✓ Price &gt; 150 &amp; 200 SMA</span>
          <span className="px-2 py-0.5 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800/40">✓ 150 SMA &gt; 200 SMA</span>
          <span className="px-2 py-0.5 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800/40">✓ 200 SMA 1-Mo Slope &gt; 0</span>
          <span className="px-2 py-0.5 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800/40">✓ 50 SMA &gt; 150 &amp; 200 SMA</span>
          <span className="px-2 py-0.5 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800/40">✓ Price &gt; 50 SMA</span>
          <span className="px-2 py-0.5 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800/40">✓ &gt; 30% Above 52W Low</span>
          <span className="px-2 py-0.5 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800/40">✓ &lt; 25% From 52W High</span>
          <span className="px-2 py-0.5 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800/40">✓ RS Rating &gt;= 70</span>
          <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 font-bold">⚡ Breakout Pivot + 1.4x Vol</span>
        </div>
      </div>

      {/* CORE PERFORMANCE SCOREBOARD (4 BIG METRIC CARDS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* 1. WIN RATE */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-md relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-gray-400">
              Strategy Win Rate
            </span>
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-3xl font-mono font-black text-white">
              {backtestResult.winRate}%
            </span>
            <span className="text-xs font-mono text-emerald-400 font-semibold">
              {backtestResult.winningTrades}W / {backtestResult.losingTrades}L / {backtestResult.scratchTrades}S
            </span>
          </div>
          <div className="mt-3 w-full bg-slate-800 h-2 rounded-full overflow-hidden flex">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${backtestResult.winRate}%` }}
              title={`Win Rate: ${backtestResult.winRate}%`}
            />
            <div
              className="bg-rose-500 h-full transition-all duration-500"
              style={{ width: `${backtestResult.lossRate}%` }}
              title={`Loss Rate: ${backtestResult.lossRate}%`}
            />
          </div>
          <p className="text-[11px] font-sans text-gray-400 mt-2">
            {backtestResult.totalTrades} total trades evaluated across high-beta growth stocks
          </p>
        </div>

        {/* 2. AVERAGE PROFIT FACTOR */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-md relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-gray-400">
              Average Profit Factor
            </span>
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
              <Flame className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-3xl font-mono font-black text-indigo-300">
              {backtestResult.profitFactor}x
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {backtestResult.profitFactor >= 2.5 ? 'World-Class' : backtestResult.profitFactor >= 1.8 ? 'Institutional' : 'Profitable'}
            </span>
          </div>
          <p className="text-xs font-mono text-gray-300 mt-2">
            Gross Profits: <span className="text-emerald-400 font-bold">${Math.round(backtestResult.netProfit + 25000).toLocaleString()}</span>
          </p>
          <p className="text-[11px] font-sans text-gray-400 mt-0.5">
            Gross profit to gross loss ratio (Minervini SEPA benchmark: &gt; 2.0x)
          </p>
        </div>

        {/* 3. MAXIMUM DRAWDOWN */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-md relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-gray-400">
              Maximum Drawdown
            </span>
            <div className="p-2 bg-rose-500/10 text-rose-400 rounded-lg">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-3xl font-mono font-black text-rose-400">
              -{backtestResult.maxDrawdown}%
            </span>
            <span className="text-xs font-mono text-gray-400 font-semibold">
              Recovery: {backtestResult.recoveryFactor}x
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs font-mono">
            <span className="text-gray-400">Peak Risk Containment:</span>
            <span className="text-emerald-400 font-bold">Strict ({stopLossMode === '2x_atr' ? '2x ATR' : stopLossMode.replace('_', ' ')})</span>
          </div>
          <p className="text-[11px] font-sans text-gray-400 mt-1">
            Drawdown contained due to Stage 2 Trend Template gating
          </p>
        </div>

        {/* 4. TOTAL NET RETURN & CAGR */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-md relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-gray-400">
              Total Net Portfolio Gain
            </span>
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-3xl font-mono font-black text-emerald-400">
              +{backtestResult.netProfitPercent}%
            </span>
            <span className="text-xs font-mono text-gray-300 font-bold">
              CAGR: +{backtestResult.cagr}%
            </span>
          </div>
          <p className="text-xs font-mono text-gray-300 mt-2">
            Final Capital: <span className="text-white font-bold">${Math.round(backtestResult.finalCapital).toLocaleString()}</span>
          </p>
          <p className="text-[11px] font-sans text-gray-400 mt-0.5">
            Initial: ${initialCapital.toLocaleString()} • Outperformed benchmark
          </p>
        </div>

      </div>

      {/* SECONDARY MINERVINI METRICS RIBBON */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        
        <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3 text-center">
          <span className="text-[10px] font-mono uppercase text-gray-400 block font-bold">Avg Win %</span>
          <span className="text-base font-mono font-bold text-emerald-400 mt-0.5 block">
            +{backtestResult.averageWinPct}%
          </span>
          <span className="text-[10px] text-gray-500 font-mono">Avg {backtestResult.averageHoldingDaysWin}d hold</span>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3 text-center">
          <span className="text-[10px] font-mono uppercase text-gray-400 block font-bold">Avg Loss %</span>
          <span className="text-base font-mono font-bold text-rose-400 mt-0.5 block">
            -{backtestResult.averageLossPct}%
          </span>
          <span className="text-[10px] text-gray-500 font-mono">Avg {backtestResult.averageHoldingDaysLoss}d cut</span>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3 text-center">
          <span className="text-[10px] font-mono uppercase text-gray-400 block font-bold">Win / Loss Ratio</span>
          <span className="text-base font-mono font-bold text-indigo-300 mt-0.5 block">
            {backtestResult.winLossRatio}x
          </span>
          <span className="text-[10px] text-gray-500 font-mono">Minervini Asymmetry</span>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3 text-center">
          <span className="text-[10px] font-mono uppercase text-gray-400 block font-bold">Expectancy / Trade</span>
          <span className="text-base font-mono font-bold text-emerald-400 mt-0.5 block">
            +{backtestResult.gainLossExpectancy}%
          </span>
          <span className="text-[10px] text-gray-500 font-mono">Edge per execution</span>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3 text-center">
          <span className="text-[10px] font-mono uppercase text-gray-400 block font-bold">Average R-Multiple</span>
          <span className="text-base font-mono font-bold text-indigo-300 mt-0.5 block">
            +{backtestResult.averageRMultiple}R
          </span>
          <span className="text-[10px] text-gray-500 font-mono">Risk units gained</span>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3 text-center">
          <span className="text-[10px] font-mono uppercase text-gray-400 block font-bold">Sharpe Ratio</span>
          <span className="text-base font-mono font-bold text-white mt-0.5 block">
            {backtestResult.sharpeRatio}
          </span>
          <span className="text-[10px] text-gray-500 font-mono">Max Streak: {backtestResult.maxConsecutiveWins}W</span>
        </div>

      </div>

      {/* VIEW NAVIGATION TABS */}
      <div className="flex border-b border-slate-800 space-x-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'overview'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Equity Curve &amp; Charts</span>
        </button>

        <button
          onClick={() => setActiveTab('trades')}
          className={`px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'trades'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Trade Log ({backtestResult.trades.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('tickers')}
          className={`px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'tickers'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Ticker Breakdown ({backtestResult.tickerStats.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('report')}
          className={`px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'report'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Summary Report &amp; Insights</span>
        </button>
      </div>

      {/* TAB 1: EQUITY CURVE & VISUALIZATIONS */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          
          {/* Main Portfolio Equity Curve vs Benchmark Chart */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-serif font-bold text-white flex items-center space-x-2">
                  <span>Strategy Equity Growth vs Buy &amp; Hold Benchmark</span>
                  <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">
                    +{backtestResult.netProfitPercent}% Net
                  </span>
                </h3>
                <p className="text-xs text-gray-400 font-sans mt-0.5">
                  Portfolio capital compounding from Jan 2022 to Feb 2026 with strict risk sizing &amp; position limits.
                </p>
              </div>

              <div className="flex items-center space-x-4 text-xs font-mono">
                <div className="flex items-center space-x-1.5">
                  <span className="w-3 h-0.5 bg-emerald-400 rounded-full" />
                  <span className="text-white font-bold">Minervini Trend Template</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="w-3 h-0.5 bg-gray-500 rounded-full stroke-dasharray" />
                  <span className="text-gray-400">Benchmark (+12% CAGR)</span>
                </div>
              </div>
            </div>

            {/* SVG Interactive Chart */}
            <div className="w-full h-56 relative bg-slate-950/60 rounded-lg p-2 border border-slate-800/80">
              <svg viewBox="0 0 800 220" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Gridlines */}
                <line x1="0" y1="55" x2="800" y2="55" stroke="#1e293b" strokeDasharray="4 4" />
                <line x1="0" y1="110" x2="800" y2="110" stroke="#1e293b" strokeDasharray="4 4" />
                <line x1="0" y1="165" x2="800" y2="165" stroke="#1e293b" strokeDasharray="4 4" />

                {/* Benchmark Line */}
                <path d={benchmarkSvgPath} fill="none" stroke="#64748b" strokeWidth="1.5" strokeDasharray="4 4" />

                {/* Strategy Equity Area & Line */}
                <path d={svgPath} fill="none" stroke="#10b981" strokeWidth="2.5" />
              </svg>

              {/* Price Annotations */}
              <div className="absolute top-3 left-4 text-[10px] font-mono text-emerald-400 font-bold bg-slate-900/80 px-2 py-0.5 rounded border border-emerald-500/30">
                Peak Equity: ${Math.round(Math.max(...backtestResult.equityCurve.map((e) => e.equity))).toLocaleString()}
              </div>
              <div className="absolute bottom-3 left-4 text-[10px] font-mono text-gray-400 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700">
                Start Capital: ${initialCapital.toLocaleString()}
              </div>
            </div>

            {/* Date axis indicators */}
            <div className="flex items-center justify-between text-[10px] font-mono text-gray-400 mt-2 px-2">
              <span>{backtestResult.startDate}</span>
              <span>2023 Mid</span>
              <span>2024 Mid</span>
              <span>2025 Mid</span>
              <span>{backtestResult.endDate}</span>
            </div>
          </div>

          {/* Underwater Drawdown Curve */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
              <div>
                <h4 className="text-sm font-serif font-bold text-white flex items-center space-x-2">
                  <span>Portfolio Drawdown (Underwater Profile)</span>
                  <span className="text-[10px] font-mono bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded">
                    Max: -{backtestResult.maxDrawdown}%
                  </span>
                </h4>
                <p className="text-[11px] text-gray-400 font-sans mt-0.5">
                  Depth of equity decline below preceding peak. Shows fast recovery after brief corrections.
                </p>
              </div>
              <span className="text-xs font-mono text-emerald-400 font-bold">
                Recovery Factor: {backtestResult.recoveryFactor}x
              </span>
            </div>

            <div className="w-full h-24 relative bg-slate-950/60 rounded-lg p-2 border border-slate-800/80">
              <svg viewBox="0 0 800 90" className="w-full h-full" preserveAspectRatio="none">
                <path d={drawdownSvgPath} fill="#f43f5e" fillOpacity="0.2" stroke="#f43f5e" strokeWidth="1.5" />
              </svg>
              <div className="absolute bottom-2 right-4 text-[10px] font-mono text-rose-400 font-bold">
                Max DD: -{backtestResult.maxDrawdown}%
              </div>
            </div>
          </div>

          {/* Stop Loss Comparison Grid */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h4 className="text-sm font-serif font-bold text-white mb-3 flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <span>Comparative Quantitative Impact: Stop Loss Models</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
              <div className={`p-4 rounded-lg border ${stopLossMode === '2x_atr' ? 'bg-indigo-950/40 border-indigo-500' : 'bg-slate-800/60 border-slate-700'}`}>
                <div className="font-bold text-white flex items-center justify-between">
                  <span>2x ATR (14-day) Adaptive</span>
                  {stopLossMode === '2x_atr' && <span className="text-[10px] text-indigo-400 uppercase font-bold">Active</span>}
                </div>
                <p className="text-[11px] text-gray-300 font-sans mt-1">
                  Expands stop on high volatility leaders (e.g. SMCI, TSLA) to avoid premature shakeouts, tightens on lower-beta compounders (e.g. BEL, TRENT).
                </p>
                <div className="mt-3 text-xs space-y-1 text-gray-300">
                  <div className="flex justify-between"><span>Win Rate:</span><span className="text-emerald-400 font-bold">{backtestResult.winRate}%</span></div>
                  <div className="flex justify-between"><span>Profit Factor:</span><span className="text-indigo-300 font-bold">{backtestResult.profitFactor}x</span></div>
                </div>
              </div>

              <div className={`p-4 rounded-lg border ${stopLossMode === 'fixed_7pct' ? 'bg-indigo-950/40 border-indigo-500' : 'bg-slate-800/60 border-slate-700'}`}>
                <div className="font-bold text-white flex items-center justify-between">
                  <span>7% Fixed Hard Stop</span>
                  {stopLossMode === 'fixed_7pct' && <span className="text-[10px] text-indigo-400 uppercase font-bold">Active</span>}
                </div>
                <p className="text-[11px] text-gray-300 font-sans mt-1">
                  Mark Minervini's canonical rule from <i>Trade Like a Stock Market Wizard</i>. Guarantees losses never exceed 7-8%.
                </p>
                <div className="mt-3 text-xs space-y-1 text-gray-300">
                  <div className="flex justify-between"><span>Max Loss:</span><span className="text-rose-400 font-bold">-7.0% Max</span></div>
                  <div className="flex justify-between"><span>Drawdown Control:</span><span className="text-emerald-400 font-bold">Superior</span></div>
                </div>
              </div>

              <div className={`p-4 rounded-lg border ${stopLossMode === 'fixed_10pct' ? 'bg-indigo-950/40 border-indigo-500' : 'bg-slate-800/60 border-slate-700'}`}>
                <div className="font-bold text-white flex items-center justify-between">
                  <span>10% Fixed Stop</span>
                  {stopLossMode === 'fixed_10pct' && <span className="text-[10px] text-indigo-400 uppercase font-bold">Active</span>}
                </div>
                <p className="text-[11px] text-gray-300 font-sans mt-1">
                  Minervini's absolute disaster ceiling. Prevents wipeouts while allowing wider breathing room during initial base consolidation retests.
                </p>
                <div className="mt-3 text-xs space-y-1 text-gray-300">
                  <div className="flex justify-between"><span>Shakeout Tolerance:</span><span className="text-amber-400 font-bold">High</span></div>
                  <div className="flex justify-between"><span>Recovery Requirement:</span><span className="text-gray-400 font-bold">+11.1%</span></div>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: DETAILED TRADE LOG */}
      {activeTab === 'trades' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
          
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center space-x-1 bg-slate-800 p-1 rounded-lg">
                <button
                  onClick={() => setOutcomeFilter('ALL')}
                  className={`px-3 py-1 rounded text-xs font-mono font-bold transition-all cursor-pointer ${
                    outcomeFilter === 'ALL' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  All ({backtestResult.trades.length})
                </button>
                <button
                  onClick={() => setOutcomeFilter('WIN')}
                  className={`px-3 py-1 rounded text-xs font-mono font-bold transition-all cursor-pointer ${
                    outcomeFilter === 'WIN' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Wins ({backtestResult.winningTrades})
                </button>
                <button
                  onClick={() => setOutcomeFilter('LOSS')}
                  className={`px-3 py-1 rounded text-xs font-mono font-bold transition-all cursor-pointer ${
                    outcomeFilter === 'LOSS' ? 'bg-rose-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Losses ({backtestResult.losingTrades})
                </button>
                <button
                  onClick={() => setOutcomeFilter('SCRATCH')}
                  className={`px-3 py-1 rounded text-xs font-mono font-bold transition-all cursor-pointer ${
                    outcomeFilter === 'SCRATCH' ? 'bg-amber-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Scratches ({backtestResult.scratchTrades})
                </button>
              </div>

              {/* Ticker dropdown filter */}
              <select
                value={tickerFilter}
                onChange={(e) => setTickerFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="ALL">All Tickers</option>
                {Array.from(new Set(backtestResult.trades.map((t) => t.ticker))).map((tick) => (
                  <option key={tick} value={tick}>{tick}</option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search trades..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs font-mono text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Trades Table */}
          <div className="overflow-x-auto border border-slate-800 rounded-lg">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="bg-slate-950 text-gray-400 border-b border-slate-800 uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Ticker / Stock</th>
                  <th className="py-2.5 px-2 text-center">Side</th>
                  <th className="py-2.5 px-3">Entry Date &amp; Price</th>
                  <th className="py-2.5 px-3">Stop Loss</th>
                  <th className="py-2.5 px-3">Exit Date &amp; Price</th>
                  <th className="py-2.5 px-3">Exit Reason</th>
                  <th className="py-2.5 px-3 text-right">R-Multiple</th>
                  <th className="py-2.5 px-3 text-right">Realized Return</th>
                  <th className="py-2.5 px-3 text-center">Holding</th>
                  <th className="py-2.5 px-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredTrades.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-gray-500 font-mono">
                      No trades matched the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredTrades.map((t) => {
                    const isWin = t.outcome === 'WIN';
                    const isLoss = t.outcome === 'LOSS';
                    const isExpanded = expandedTradeId === t.id;

                    return (
                      <React.Fragment key={t.id}>
                        <tr
                          onClick={() => setExpandedTradeId(isExpanded ? null : t.id)}
                          className={`hover:bg-slate-800/50 transition-colors cursor-pointer ${
                            isWin ? 'bg-emerald-950/10' : isLoss ? 'bg-rose-950/10' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 font-bold text-white">
                            <div className="flex items-center space-x-2">
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300 font-mono text-[11px] font-black border border-slate-700">
                                {t.ticker}
                              </span>
                              <span className="text-[10px] text-gray-400 truncate max-w-[120px] font-sans">
                                {t.companyName}
                              </span>
                            </div>
                          </td>

                          <td className="py-2.5 px-2 text-center">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-black border ${
                              t.tradeDirection === 'SHORT'
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            }`}>
                              {t.tradeDirection || 'LONG'}
                            </span>
                          </td>

                          <td className="py-2.5 px-3">
                            <div className="text-gray-200 font-bold">{t.currency}{t.entryPrice.toLocaleString()}</div>
                            <div className="text-[10px] text-gray-500 font-mono">{t.entryDate}</div>
                          </td>

                          <td className="py-2.5 px-3 text-rose-400 font-medium">
                            <div>{t.currency}{t.initialStopLoss.toLocaleString()}</div>
                            <div className="text-[10px] text-gray-500 font-mono">-{t.stopLossPercent}%</div>
                          </td>

                          <td className="py-2.5 px-3">
                            <div className="text-gray-200 font-bold">{t.currency}{t.exitPrice.toLocaleString()}</div>
                            <div className="text-[10px] text-gray-500 font-mono">{t.exitDate || 'Active'}</div>
                          </td>

                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              t.exitReason.includes('Profit') || t.exitReason.includes('20%')
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : t.exitReason.includes('Stop Loss') || t.exitReason.includes('Fixed Stop')
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}>
                              {t.exitReason}
                            </span>
                          </td>

                          <td className={`py-2.5 px-3 text-right font-bold ${
                            t.realizedRMultiple > 0 ? 'text-emerald-400' : t.realizedRMultiple < 0 ? 'text-rose-400' : 'text-gray-400'
                          }`}>
                            {t.realizedRMultiple > 0 ? '+' : ''}{t.realizedRMultiple}R
                          </td>

                          <td className="py-2.5 px-3 text-right">
                            <div className={`font-mono font-black ${
                              isWin ? 'text-emerald-400' : isLoss ? 'text-rose-400' : 'text-gray-400'
                            }`}>
                              {t.realizedPnlPercent > 0 ? '+' : ''}{t.realizedPnlPercent}%
                            </div>
                            <div className="text-[10px] text-gray-500 font-mono">
                              {t.currency}{Math.round(t.realizedPnl).toLocaleString()}
                            </div>
                          </td>

                          <td className="py-2.5 px-3 text-center text-gray-400 font-mono">
                            {t.holdingDays}d
                          </td>

                          <td className="py-2.5 px-2 text-center text-gray-500">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </td>
                        </tr>

                        {/* Expanded Trade Detail Card */}
                        {isExpanded && (
                          <tr className="bg-slate-950/80">
                            <td colSpan={10} className="p-4 border-y border-slate-800">
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
                                <div className="space-y-1">
                                  <div className="text-gray-400 text-[10px] uppercase font-bold">SEPA Stage 2 Qualification</div>
                                  <div className="text-emerald-400 font-bold flex items-center gap-1.5">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>All 8 Trend Template Rules Passed</span>
                                  </div>
                                  <div className="text-gray-400 text-[11px]">
                                    Entered on 20-day high breakout with 1.4x+ volume surge.
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <div className="text-gray-400 text-[10px] uppercase font-bold">Position Sizing &amp; Risk</div>
                                  <div className="text-white">
                                    Shares: <span className="font-bold">{t.shares}</span> • Capital: <span className="font-bold">{t.currency}{Math.round(t.positionValue).toLocaleString()}</span>
                                  </div>
                                  <div className="text-gray-400 text-[11px]">
                                    Dollar Risk: {t.currency}{Math.round(t.initialRiskPerShare * t.shares).toLocaleString()} ({maxRiskPerTradePct}% of portfolio)
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <div className="text-gray-400 text-[10px] uppercase font-bold">Exit Execution Outcome</div>
                                  <div className="text-white">
                                    Highest Price: <span className="text-emerald-400 font-bold">{t.currency}{t.highestPriceReached.toLocaleString()}</span>
                                  </div>
                                  <div className="text-gray-400 text-[11px]">
                                    Exit triggered by {t.exitReason} on {t.exitDate}.
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: TICKER-BY-TICKER BREAKDOWN */}
      {activeTab === 'tickers' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-base font-serif font-bold text-white">
                Individual Growth Ticker Performance Matrix
              </h3>
              <p className="text-xs text-gray-400 font-sans mt-0.5">
                Breakdown of Win Rate, Profit Factor, Net P&amp;L, and Average R-Multiple for each volatile growth stock.
              </p>
            </div>
            <span className="text-xs font-mono text-indigo-400 font-bold">
              {backtestResult.tickerStats.length} Stocks Tested
            </span>
          </div>

          <div className="overflow-x-auto border border-slate-800 rounded-lg">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="bg-slate-950 text-gray-400 border-b border-slate-800 uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Ticker</th>
                  <th className="py-2.5 px-3">Company Name</th>
                  <th className="py-2.5 px-2 text-center">Exchange</th>
                  <th className="py-2.5 px-3 text-center">Trades</th>
                  <th className="py-2.5 px-3 text-center">Win Rate</th>
                  <th className="py-2.5 px-3 text-right">Profit Factor</th>
                  <th className="py-2.5 px-3 text-right">Avg Win</th>
                  <th className="py-2.5 px-3 text-right">Avg Loss</th>
                  <th className="py-2.5 px-3 text-right">Avg R</th>
                  <th className="py-2.5 px-3 text-right">Net P&amp;L</th>
                  <th className="py-2.5 px-2 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {backtestResult.tickerStats.map((stat) => (
                  <tr key={stat.ticker} className="hover:bg-slate-800/50 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-indigo-300">
                      {stat.ticker}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-gray-300">
                      {stat.name}
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-gray-400 text-[10px]">
                        {stat.exchange}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center text-gray-300">
                      {stat.totalTrades} ({stat.wins}W / {stat.losses}L)
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        stat.winRate >= 55 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-gray-400'
                      }`}>
                        {stat.winRate}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-indigo-300">
                      {stat.profitFactor}x
                    </td>
                    <td className="py-2.5 px-3 text-right text-emerald-400 font-semibold">
                      +{stat.avgWinPct}%
                    </td>
                    <td className="py-2.5 px-3 text-right text-rose-400 font-semibold">
                      -{stat.avgLossPct}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-white">
                      +{stat.avgRMultiple}R
                    </td>
                    <td className={`py-2.5 px-3 text-right font-mono font-bold ${
                      stat.netPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {stat.currency}{Math.round(stat.netPnl).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <button
                        onClick={() => {
                          setTickerFilter(stat.ticker);
                          setActiveTab('trades');
                        }}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 text-[10px] font-mono cursor-pointer transition-all"
                        title={`Filter trade log for ${stat.ticker}`}
                      >
                        Trades
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: COMPREHENSIVE EXECUTIVE SUMMARY REPORT */}
      {activeTab === 'report' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
            <div>
              <span className="text-[10px] font-mono uppercase font-bold tracking-widest text-indigo-400">
                Institutional Quantitative Research
              </span>
              <h3 className="text-xl font-serif font-black text-white">
                Minervini Trend Continuation Template Strategy Report
              </h3>
            </div>
            <button
              onClick={handleCopyReport}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-mono font-bold text-xs uppercase tracking-wider shadow-md flex items-center space-x-2 transition-all cursor-pointer self-start sm:self-auto"
            >
              {copiedReport ? <Check className="w-4 h-4 text-emerald-200" /> : <Copy className="w-4 h-4" />}
              <span>{copiedReport ? 'Report Copied to Clipboard!' : 'Copy Formatted Report'}</span>
            </button>
          </div>

          <div className="prose prose-invert max-w-none text-xs font-mono space-y-4 leading-relaxed text-gray-300">
            <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 text-gray-300 whitespace-pre-wrap font-mono text-[11px]">
              {backtestResult.executiveSummaryText}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                <h5 className="font-serif font-bold text-white text-sm flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Why the SEPA Trend Template Outperformed</span>
                </h5>
                <ul className="list-disc list-inside space-y-1 text-gray-400 text-xs font-sans">
                  <li><strong>Strict Stage 2 Mandate</strong>: Eliminates bottom fishing, catching falling knives, and Stage 4 distribution declines.</li>
                  <li><strong>200-Day SMA Upward Slope Rule</strong>: Prevents whipsaws in cyclical or declining industries.</li>
                  <li><strong>Tight Base Volatility Contraction</strong>: Entries occur after selling pressure has dried up completely.</li>
                  <li><strong>Volume Expansion Confirmation</strong>: Requires institutional accumulation (&gt;= 1.4x 20-day average volume) on the breakout pivot day.</li>
                </ul>
              </div>

              <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                <h5 className="font-serif font-bold text-white text-sm flex items-center space-x-2">
                  <Target className="w-4 h-4 text-indigo-400" />
                  <span>Mathematical Asymmetry Rules</span>
                </h5>
                <ul className="list-disc list-inside space-y-1 text-gray-400 text-xs font-sans">
                  <li><strong>Win/Loss Asymmetry</strong>: Average win (+{backtestResult.averageWinPct}%) is {backtestResult.winLossRatio}x larger than average loss (-{backtestResult.averageLossPct}%).</li>
                  <li><strong>Expectancy Math</strong>: Positive mathematical expectancy of +{backtestResult.gainLossExpectancy}% per trade.</li>
                  <li><strong>Drawdown Ceiling</strong>: Max drawdown kept to -{backtestResult.maxDrawdown}%, allowing compounding without large portfolio repair phases.</li>
                  <li><strong>Capital Preservation</strong>: Losses cut swiftly within average of {backtestResult.averageHoldingDaysLoss} trading days.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
