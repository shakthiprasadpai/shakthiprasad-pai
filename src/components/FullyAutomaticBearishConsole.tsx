import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  TrendingDown,
  ShieldAlert,
  AlertTriangle,
  Play,
  Pause,
  RotateCcw,
  RefreshCw,
  Zap,
  Target,
  Calculator,
  SlidersHorizontal,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ChevronRight,
  Flame,
  ArrowDownRight,
  Clock,
  Layers,
  Terminal,
  Activity,
  Award,
  DollarSign,
  Lock,
  Skull,
  ShieldCheck,
  Compass
} from 'lucide-react';
import { MinerviniTradeSetup } from '../types';
import {
  AutonomousEngineState,
  AutonomousBearishTrade,
  AutonomousLogEvent,
  loadAutonomousEngineState,
  saveAutonomousEngineState,
  runAutonomousBearishCycle,
  manuallyCloseAutonomousTrade,
  calculateAutonomousPerformance
} from '../utils/fullyAutomaticBearishEngine';
import { formatCurrency, getCurrencySymbol } from '../utils/sepaCalculator';
import { getChartLinkUrl } from '../utils/chartLinkHelper';

interface FullyAutomaticBearishConsoleProps {
  stocks: MinerviniTradeSetup[];
  onSelectStock?: (stock: MinerviniTradeSetup) => void;
  onViewChart?: (stock: MinerviniTradeSetup) => void;
  isObsidian?: boolean;
}

export const FullyAutomaticBearishConsole: React.FC<FullyAutomaticBearishConsoleProps> = ({
  stocks,
  onSelectStock,
  onViewChart,
  isObsidian = true
}) => {
  // Autonomous engine state loaded from persistence
  const [engineState, setEngineState] = useState<AutonomousEngineState>(() => loadAutonomousEngineState());
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  const [logFilter, setLogFilter] = useState<'ALL' | 'TRIGGERS_ONLY' | 'EXITS_ONLY'>('ALL');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [autoSimulateInterval, setAutoSimulateInterval] = useState<boolean>(true);

  // Settings drawer
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [capitalInput, setCapitalInput] = useState<number>(engineState.accountCapital);
  const [riskInput, setRiskInput] = useState<number>(engineState.riskPerTradePct);
  const [maxPositionsInput, setMaxPositionsInput] = useState<number>(engineState.maxConcurrentShorts);

  // Listen for storage events from other components/windows
  useEffect(() => {
    const handleSync = (e: any) => {
      if (e.detail) {
        setEngineState(e.detail);
      } else {
        setEngineState(loadAutonomousEngineState());
      }
    };
    window.addEventListener('minervini_fully_auto_updated', handleSync);
    return () => window.removeEventListener('minervini_fully_auto_updated', handleSync);
  }, []);

  // Run autonomous cycle on interval when engine is active
  useEffect(() => {
    if (!engineState.isEngineRunning || !autoSimulateInterval) return;

    // Run periodic evaluation every 8 seconds
    const interval = setInterval(() => {
      setEngineState(prevState => {
        return runAutonomousBearishCycle(stocks, prevState);
      });
    }, 8000);

    return () => clearInterval(interval);
  }, [engineState.isEngineRunning, autoSimulateInterval, stocks]);

  // Initial scan if active trades are empty
  useEffect(() => {
    if (engineState.isEngineRunning && engineState.activeTrades.length === 0) {
      const next = runAutonomousBearishCycle(stocks, engineState);
      setEngineState(next);
    }
  }, []);

  // Manual Trigger of Full Autonomous Cycle
  const handleRunImmediateCycle = () => {
    setIsScanning(true);
    setTimeout(() => {
      const next = runAutonomousBearishCycle(stocks, engineState);
      setEngineState(next);
      setIsScanning(false);
    }, 600);
  };

  // Toggle Master Engine Running state
  const handleToggleEngine = () => {
    const updated: AutonomousEngineState = {
      ...engineState,
      isEngineRunning: !engineState.isEngineRunning,
      eventLogs: [
        {
          id: `log-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          ticker: 'SYSTEM',
          type: 'ENGINE_STATUS',
          message: !engineState.isEngineRunning
            ? '▶ Fully Automatic Bearish SEPA Engine Resumed. Autonomous surveillance active.'
            : '⏸ Fully Automatic Bearish SEPA Engine Paused by Trader.'
        },
        ...engineState.eventLogs
      ].slice(0, 50)
    };
    setEngineState(updated);
    saveAutonomousEngineState(updated);
  };

  // Emergency Manual Exit
  const handleEmergencyExit = (tradeId: string) => {
    const next = manuallyCloseAutonomousTrade(tradeId, engineState);
    setEngineState(next);
  };

  // Reset Engine
  const handleResetEngine = () => {
    if (window.confirm('Reset all autonomous trades and start a fresh SEPA cycle?')) {
      const fresh: AutonomousEngineState = {
        ...engineState,
        activeTrades: [],
        closedTrades: [],
        eventLogs: [
          {
            id: `log-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString(),
            ticker: 'SYSTEM',
            type: 'ENGINE_STATUS',
            message: 'Autonomous engine ledger cleared. Scanning for fresh Stage 4 breakdowns.'
          }
        ]
      };
      setEngineState(fresh);
      saveAutonomousEngineState(fresh);
    }
  };

  // Save Config
  const handleSaveSettings = () => {
    const updated: AutonomousEngineState = {
      ...engineState,
      accountCapital: capitalInput,
      riskPerTradePct: riskInput,
      maxConcurrentShorts: maxPositionsInput
    };
    setEngineState(updated);
    saveAutonomousEngineState(updated);
    setShowSettings(false);
  };

  // Calculate live portfolio stats
  const performance = useMemo(() => {
    return calculateAutonomousPerformance(engineState.closedTrades);
  }, [engineState.closedTrades]);

  // Aggregate unrealized P&L
  const aggregateUnrealized = useMemo(() => {
    let totalDollars = 0;
    engineState.activeTrades.forEach(t => {
      totalDollars += t.unrealizedPnL;
    });
    return Number(totalDollars.toFixed(2));
  }, [engineState.activeTrades]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    if (logFilter === 'TRIGGERS_ONLY') {
      return engineState.eventLogs.filter(l => l.type === 'AUTO_TRIGGER' || l.type === 'AUTO_SCALE_OUT');
    }
    if (logFilter === 'EXITS_ONLY') {
      return engineState.eventLogs.filter(l => l.type === 'AUTO_EXIT');
    }
    return engineState.eventLogs;
  }, [engineState.eventLogs, logFilter]);

  return (
    <div className={`space-y-6 ${isObsidian ? 'text-gray-100' : 'text-[#1a1a1a]'}`}>
      
      {/* 1. MASTER AUTONOMOUS ENGINE CONTROLLER BANNER */}
      <div
        className={`border p-6 rounded-lg shadow-sm transition-all relative overflow-hidden ${
          isObsidian
            ? 'bg-gradient-to-r from-red-950/40 via-slate-900 to-slate-950 border-red-500/40'
            : 'bg-gradient-to-r from-rose-50 via-slate-50 to-white border-rose-300'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-3 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center space-x-1.5 px-3 py-1 text-[11px] font-mono font-black uppercase tracking-wider rounded ${
                engineState.isEngineRunning
                  ? 'bg-rose-600 text-white animate-pulse'
                  : 'bg-slate-700 text-gray-300'
              }`}>
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                <span>{engineState.isEngineRunning ? '● Fully Automatic SEPA Engine Active' : '⏸ Engine Suspended'}</span>
              </span>

              <span className="px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded border bg-amber-500/20 text-amber-400 border-amber-500/30">
                Stage 4 Autonomous Execution
              </span>

              <span className="text-xs font-mono text-gray-400">
                Last Scan: {engineState.lastScanTimestamp}
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-serif font-black tracking-tight">
              Fully Automatic Bearish Stock Engine
            </h2>

            <p className={`text-xs leading-relaxed ${isObsidian ? 'text-gray-300' : 'text-gray-700'}`}>
              <strong>Mark Minervini SEPA Autonomous Architecture:</strong> Continuously screens the market universe for Stage 4 distribution rollovers and institutional death crosses. When criteria are met, the engine <strong>automatically executes simulated short orders</strong>, sizes risk to 1R capital cap, attaches 2x ATR cover stops, and executes dual scale-outs (50% scale at 2R target with breakeven stop-trail, final cover at 3.5R capitulation).
            </p>
          </div>

          {/* Master Control Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleToggleEngine}
              className={`px-5 py-3 rounded font-mono font-bold text-xs uppercase tracking-wider flex items-center space-x-2 transition-all cursor-pointer shadow-md ${
                engineState.isEngineRunning
                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                  : 'bg-rose-600 hover:bg-rose-500 text-white animate-bounce'
              }`}
            >
              {engineState.isEngineRunning ? (
                <>
                  <Pause className="w-4 h-4" />
                  <span>Pause Engine</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>Resume Auto-Pilot</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleRunImmediateCycle}
              disabled={isScanning}
              className="px-4 py-3 rounded font-mono font-bold text-xs uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-500/30 flex items-center space-x-2 transition-all cursor-pointer"
              title="Force immediate universe evaluation cycle"
            >
              <RefreshCw className={`w-4 h-4 text-rose-400 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Scanning...' : 'Cycle Now'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className="p-3 rounded bg-slate-800 hover:bg-slate-700 text-gray-300 border border-slate-700 cursor-pointer"
              title="Engine Risk Configuration"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleResetEngine}
              className="p-3 rounded bg-slate-800 hover:bg-slate-700 text-gray-400 hover:text-rose-400 border border-slate-700 cursor-pointer"
              title="Clear & Reset Engine State"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Real-time KPI Barometer */}
        <div className="mt-6 pt-6 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono text-center">
          
          <div className={`p-3 rounded border ${isObsidian ? 'bg-slate-950/60 border-slate-800' : 'bg-white border-gray-200'}`}>
            <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Active Shorts</span>
            <strong className="text-xl font-black text-rose-400 block mt-0.5">
              {engineState.activeTrades.length} / {engineState.maxConcurrentShorts}
            </strong>
            <span className="text-[9px] text-gray-500">Auto slots filled</span>
          </div>

          <div className={`p-3 rounded border ${isObsidian ? 'bg-slate-950/60 border-slate-800' : 'bg-white border-gray-200'}`}>
            <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Unrealized P&amp;L</span>
            <strong className={`text-xl font-black block mt-0.5 ${aggregateUnrealized >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
              {aggregateUnrealized >= 0 ? '+' : ''}${aggregateUnrealized.toLocaleString()}
            </strong>
            <span className="text-[9px] text-gray-500">Live positions</span>
          </div>

          <div className={`p-3 rounded border ${isObsidian ? 'bg-slate-950/60 border-slate-800' : 'bg-white border-gray-200'}`}>
            <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Win Rate</span>
            <strong className="text-xl font-black text-emerald-400 block mt-0.5">
              {performance.totalTrades > 0 ? `${performance.winRatePct}%` : 'N/A'}
            </strong>
            <span className="text-[9px] text-gray-500">{performance.winningTrades}W / {performance.losingTrades}L</span>
          </div>

          <div className={`p-3 rounded border ${isObsidian ? 'bg-slate-950/60 border-slate-800' : 'bg-white border-gray-200'}`}>
            <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Profit Factor</span>
            <strong className="text-xl font-black text-amber-400 block mt-0.5">
              {performance.profitFactor > 0 ? `${performance.profitFactor}x` : '—'}
            </strong>
            <span className="text-[9px] text-gray-500">Gross Win / Loss</span>
          </div>

          <div className={`p-3 rounded border ${isObsidian ? 'bg-slate-950/60 border-slate-800' : 'bg-white border-gray-200'}`}>
            <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Realized Gain</span>
            <strong className={`text-xl font-black block mt-0.5 ${performance.totalRealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
              {performance.totalRealizedPnL >= 0 ? '+' : ''}${performance.totalRealizedPnL.toLocaleString()}
            </strong>
            <span className="text-[9px] text-gray-500">Closed ledger</span>
          </div>

        </div>
      </div>

      {/* OPTIONAL SETTINGS DRAWER */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={`p-6 rounded-lg border font-mono text-xs ${
              isObsidian ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <span className="font-bold uppercase tracking-wider text-sm flex items-center space-x-2">
                <SlidersHorizontal className="w-4 h-4 text-amber-400" />
                <span>Autonomous Engine Parameter Configuration</span>
              </span>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="text-gray-400 hover:text-white"
              >
                &times; Close
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-gray-400 block mb-1">Account Sizing Capital ($)</label>
                <input
                  type="number"
                  value={capitalInput}
                  onChange={(e) => setCapitalInput(Math.max(5000, Number(e.target.value)))}
                  className={`w-full p-2 rounded border font-bold ${
                    isObsidian ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-gray-300'
                  }`}
                />
              </div>

              <div>
                <label className="text-gray-400 block mb-1">Max 1R Risk % Per Trade</label>
                <input
                  type="number"
                  step="0.25"
                  value={riskInput}
                  onChange={(e) => setRiskInput(Math.max(0.25, Number(e.target.value)))}
                  className={`w-full p-2 rounded border font-bold ${
                    isObsidian ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-gray-300'
                  }`}
                />
              </div>

              <div>
                <label className="text-gray-400 block mb-1">Max Concurrent Active Shorts</label>
                <input
                  type="number"
                  min="1"
                  max="6"
                  value={maxPositionsInput}
                  onChange={(e) => setMaxPositionsInput(Math.max(1, Math.min(6, Number(e.target.value))))}
                  className={`w-full p-2 rounded border font-bold ${
                    isObsidian ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-gray-300'
                  }`}
                />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="px-3 py-1.5 rounded text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSettings}
                className="px-4 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold"
              >
                Apply Parameters
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. ACTIVE AUTONOMOUS SHORT POSITIONS BOARD */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-5 h-5 text-rose-500" />
            <h3 className="text-base font-serif font-black tracking-tight">
              Live Autonomous Short Positions ({engineState.activeTrades.length})
            </h3>
          </div>
          <span className="text-xs font-mono text-gray-400">
            Automated Bracket Trailing • 2x ATR Stops • 2R Scale
          </span>
        </div>

        {engineState.activeTrades.length === 0 ? (
          <div
            className={`p-10 text-center rounded-lg border ${
              isObsidian ? 'bg-slate-900 border-slate-800 text-gray-400' : 'bg-gray-50 border-gray-200 text-gray-600'
            }`}
          >
            <ShieldCheck className="w-10 h-10 mx-auto mb-2 text-emerald-400 opacity-80" />
            <p className="font-mono text-sm font-bold">No active automated short positions currently triggered.</p>
            <p className="text-xs font-sans text-gray-500 mt-1 max-w-md mx-auto">
              The engine is scanning for stocks breaking below institutional 200 SMA support floors. When an undercut occurs, positions are automatically entered.
            </p>
            <button
              type="button"
              onClick={handleRunImmediateCycle}
              className="mt-4 px-4 py-2 rounded font-mono text-xs font-bold uppercase bg-rose-600 hover:bg-rose-500 text-white shadow-sm inline-flex items-center space-x-1.5 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Force Immediate Universe Scan</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {engineState.activeTrades.map((trade) => {
              const isProfit = trade.unrealizedPnL >= 0;
              const sym = trade.currency;

              return (
                <div
                  key={trade.id}
                  className={`p-5 rounded-lg border transition-all relative flex flex-col justify-between ${
                    isObsidian
                      ? 'bg-slate-900/90 border-slate-800 hover:border-rose-500/60 shadow-lg'
                      : 'bg-white border-gray-200 hover:border-rose-300 shadow-sm'
                  }`}
                >
                  <div>
                    {/* Header: Ticker, Status, R-Multiple */}
                    <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-black text-lg text-white">
                            {trade.ticker}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 bg-slate-800 text-gray-300 rounded border border-slate-700">
                            {trade.exchange}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400 block truncate max-w-[160px]">
                          {trade.name}
                        </span>
                      </div>

                      {/* Live R-Multiple Badge */}
                      <div className="text-right font-mono">
                        <span
                          className={`text-base font-black px-2 py-0.5 rounded border inline-block ${
                            isProfit
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          }`}
                        >
                          {trade.unrealizedRMultiple >= 0 ? '+' : ''}{trade.unrealizedRMultiple}R
                        </span>
                        <span className="text-[9px] text-gray-400 block uppercase mt-0.5">
                          Unrealized R
                        </span>
                      </div>
                    </div>

                    {/* Price and Live P&L Metric */}
                    <div className="grid grid-cols-2 gap-3 py-3 font-mono">
                      <div>
                        <span className="text-[10px] text-gray-400 block uppercase">Short Entry</span>
                        <strong className="text-sm font-bold text-gray-200">
                          {formatCurrency(trade.entryPrice, sym)}
                        </strong>
                        <span className="text-[9px] text-gray-500 block">{trade.shares} shares</span>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-gray-400 block uppercase">Current Price</span>
                        <strong className="text-sm font-bold text-gray-200">
                          {formatCurrency(trade.currentPrice, sym)}
                        </strong>
                        <span className={`text-[10px] font-bold block ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isProfit ? '+' : ''}{trade.unrealizedPnLPct}% ({formatCurrency(trade.unrealizedPnL, sym)})
                        </span>
                      </div>
                    </div>

                    {/* Active Bracket Levels Grid */}
                    <div className="p-3 bg-slate-950/80 rounded border border-slate-800 space-y-2 font-mono text-xs">
                      
                      {/* Dynamic Cover Stop */}
                      <div className="flex items-center justify-between">
                        <span className="text-rose-400 flex items-center space-x-1 text-[11px]">
                          <Lock className="w-3 h-3 text-rose-400" />
                          <span>Stop Loss:</span>
                        </span>
                        <div className="text-right">
                          <strong className="text-rose-400 font-bold">
                            {formatCurrency(trade.coverStopPrice, sym)}
                          </strong>
                          <span className="text-[9px] text-gray-400 block">
                            {trade.stopType === 'BREAKEVEN_GUARD' && '✓ Breakeven Guard'}
                            {trade.stopType === 'INITIAL_2X_ATR' && '2x ATR Cover'}
                            {trade.stopType === 'TRAILING_20EMA' && 'Trailing 20 EMA'}
                          </span>
                        </div>
                      </div>

                      {/* Target 1 (2R) */}
                      <div className="flex items-center justify-between border-t border-slate-800/60 pt-1.5">
                        <span className="text-emerald-400 flex items-center space-x-1 text-[11px]">
                          <Target className="w-3 h-3 text-emerald-400" />
                          <span>Target 1 (2R):</span>
                        </span>
                        <div className="text-right">
                          <strong className="text-emerald-400 font-bold">
                            {formatCurrency(trade.target1Price, sym)}
                          </strong>
                          <span className="text-[9px] text-gray-400 block">
                            {trade.status === 'TARGET_1_HIT' ? '✓ 50% Booked' : 'Scale 50%'}
                          </span>
                        </div>
                      </div>

                      {/* Target 2 (3.5R Capitulation) */}
                      <div className="flex items-center justify-between border-t border-slate-800/60 pt-1.5">
                        <span className="text-emerald-400 flex items-center space-x-1 text-[11px]">
                          <Flame className="w-3 h-3 text-emerald-400" />
                          <span>Target 2 (3.5R):</span>
                        </span>
                        <div className="text-right">
                          <strong className="text-emerald-400 font-bold">
                            {formatCurrency(trade.target2Price, sym)}
                          </strong>
                          <span className="text-[9px] text-gray-400 block">Capitulation</span>
                        </div>
                      </div>
                    </div>

                    {/* Catalysts Summary */}
                    <div className="mt-3 text-[10px] font-mono text-gray-400 space-y-1">
                      <span className="uppercase text-gray-500 block font-bold">SEPA Triggers:</span>
                      {trade.catalysts.slice(0, 2).map((c, i) => (
                        <div key={i} className="truncate text-rose-300">
                          • {c}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions: Emergency Exit & Chart Link */}
                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                    <a
                      href={getChartLinkUrl(trade.ticker)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 rounded text-[10px] font-mono font-bold uppercase bg-slate-800 hover:bg-slate-700 text-blue-300 border border-blue-500/30 flex items-center space-x-1"
                    >
                      <span>ChartLink</span>
                      <ExternalLink className="w-3 h-3 text-blue-400" />
                    </a>

                    <button
                      type="button"
                      onClick={() => handleEmergencyExit(trade.id)}
                      className="px-3 py-1.5 rounded text-[10px] font-mono font-bold uppercase bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800 flex items-center space-x-1 transition-all cursor-pointer"
                      title="Immediately cover short at current market price"
                    >
                      <XCircle className="w-3 h-3 text-rose-400" />
                      <span>Emergency Cover</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. TWO-COLUMN LAYOUT: AUTONOMOUS LOG STREAM (LEFT) + CLOSED PERFORMANCE LEDGER (RIGHT) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: AUTONOMOUS EXECUTION AUDIT STREAM (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Terminal className="w-4 h-4 text-rose-400" />
              <h3 className="text-base font-serif font-black tracking-tight">
                Autonomous Execution Audit Stream
              </h3>
            </div>

            <div className="flex items-center space-x-1 font-mono text-[10px]">
              {(['ALL', 'TRIGGERS_ONLY', 'EXITS_ONLY'] as const).map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setLogFilter(f)}
                  className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                    logFilter === f
                      ? 'bg-rose-600 text-white font-bold'
                      : 'bg-slate-800 text-gray-400 hover:text-white'
                  }`}
                >
                  {f.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <div
            className={`p-4 rounded-lg border font-mono text-xs max-h-[460px] overflow-y-auto space-y-2 ${
              isObsidian ? 'bg-slate-950/90 border-slate-800 text-gray-300' : 'bg-gray-900 border-gray-800 text-gray-200'
            }`}
          >
            {filteredLogs.length === 0 ? (
              <div className="p-4 text-center text-gray-500">No events matching this filter.</div>
            ) : (
              filteredLogs.map((log) => {
                const isTrigger = log.type === 'AUTO_TRIGGER';
                const isExit = log.type === 'AUTO_EXIT';
                const isScale = log.type === 'AUTO_SCALE_OUT';

                return (
                  <div
                    key={log.id}
                    className={`p-2.5 rounded border transition-all text-xs flex items-start space-x-2.5 ${
                      isTrigger
                        ? 'bg-rose-950/20 border-rose-800/40 text-rose-200'
                        : isScale
                        ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-200'
                        : isExit
                        ? 'bg-amber-950/20 border-amber-800/40 text-amber-200'
                        : 'bg-slate-900/50 border-slate-800/60 text-gray-300'
                    }`}
                  >
                    <span className="text-[10px] text-gray-500 shrink-0 mt-0.5">{log.timestamp}</span>

                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded shrink-0 uppercase ${
                        isTrigger
                          ? 'bg-rose-600 text-white'
                          : isScale
                          ? 'bg-emerald-600 text-white'
                          : isExit
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-800 text-gray-300'
                      }`}
                    >
                      {log.type.replace('AUTO_', '')}
                    </span>

                    <div className="flex-1">
                      <span className="font-bold text-white mr-1.5">{log.ticker}:</span>
                      <span>{log.message}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: CLOSED TRADES & PERFORMANCE LEDGER (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Award className="w-4 h-4 text-amber-400" />
              <h3 className="text-base font-serif font-black tracking-tight">
                Closed Trades Ledger ({engineState.closedTrades.length})
              </h3>
            </div>
            <span className="text-xs font-mono text-gray-400">
              Total Realized: {formatCurrency(performance.totalRealizedPnL, '$')}
            </span>
          </div>

          <div
            className={`border rounded-lg overflow-hidden max-h-[460px] overflow-y-auto ${
              isObsidian ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200'
            }`}
          >
            {engineState.closedTrades.length === 0 ? (
              <div className="p-8 text-center text-gray-500 font-mono text-xs">
                No closed trades yet in current session.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-[10px] uppercase text-gray-400">
                    <th className="p-2.5 pl-3">Stock</th>
                    <th className="p-2.5">Entry/Exit</th>
                    <th className="p-2.5">Result</th>
                    <th className="p-2.5 text-right pr-3">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {engineState.closedTrades.map((t) => {
                    const isWin = (t.realizedPnL || 0) > 0;
                    return (
                      <tr key={t.id} className="hover:bg-slate-800/40">
                        <td className="p-2.5 pl-3">
                          <strong className="text-white block">{t.ticker}</strong>
                          <span className="text-[9px] text-gray-500">{t.originalShares} shs</span>
                        </td>
                        <td className="p-2.5">
                          <div className="text-gray-300">${t.entryPrice}</div>
                          <div className="text-[10px] text-gray-500">→ ${t.exitPrice || t.currentPrice}</div>
                        </td>
                        <td className="p-2.5">
                          <strong className={isWin ? 'text-emerald-400' : 'text-rose-500'}>
                            {isWin ? '+' : ''}${t.realizedPnL}
                          </strong>
                        </td>
                        <td className="p-2.5 text-right pr-3 text-[10px] text-gray-400 truncate max-w-[120px]">
                          {t.exitReason || t.status}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
