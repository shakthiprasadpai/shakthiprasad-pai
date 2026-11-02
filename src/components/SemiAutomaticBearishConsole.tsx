import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  TrendingDown,
  ShieldAlert,
  AlertTriangle,
  Zap,
  Target,
  Calculator,
  SlidersHorizontal,
  CheckCircle2,
  XCircle,
  Eye,
  Check,
  RotateCcw,
  ExternalLink,
  ChevronRight,
  Flame,
  Search,
  ArrowDownRight,
  Clock,
  Layers,
  Edit3,
  Copy,
  Download,
  AlertCircle,
  ShieldCheck
} from 'lucide-react';
import { MinerviniTradeSetup } from '../types';
import {
  SemiAutoBearishSetup,
  SemiAutoStatus,
  generateSemiAutoBearishCandidates,
  saveSemiAutoSetupState,
  getStoredSemiAutoSetups
} from '../utils/semiAutoBearishEngine';
import { formatCurrency, getCurrencySymbol } from '../utils/sepaCalculator';
import { getChartLinkUrl } from '../utils/chartLinkHelper';

interface SemiAutomaticBearishConsoleProps {
  stocks: MinerviniTradeSetup[];
  onSelectStock?: (stock: MinerviniTradeSetup) => void;
  onViewChart?: (stock: MinerviniTradeSetup) => void;
  isObsidian?: boolean;
}

export const SemiAutomaticBearishConsole: React.FC<SemiAutomaticBearishConsoleProps> = ({
  stocks,
  onSelectStock,
  onViewChart,
  isObsidian = true
}) => {
  // Global account sizing parameters
  const [accountCapital, setAccountCapital] = useState<number>(100000);
  const [defaultRiskPct, setDefaultRiskPct] = useState<number>(1.0);

  // Tab filter: ALL, ARMED_WATCH, STAGED_ORDER, AUTO_DETECTED, DISQUALIFIED
  const [activeFilter, setActiveFilter] = useState<'ALL' | SemiAutoStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSetupId, setSelectedSetupId] = useState<string | null>(null);

  // Parameter editing modal state
  const [editingSetup, setEditingSetup] = useState<SemiAutoBearishSetup | null>(null);
  const [editTrigger, setEditTrigger] = useState<number>(0);
  const [editStop, setEditStop] = useState<number>(0);
  const [editRiskPct, setEditRiskPct] = useState<number>(1.0);
  const [editNotes, setEditNotes] = useState<string>('');

  // Toast / Feedback message
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Refresh trigger for localStorage sync
  const [refreshKey, setRefreshKey] = useState<number>(0);

  useEffect(() => {
    const handleSync = () => setRefreshKey((k) => k + 1);
    window.addEventListener('minervini_semi_auto_updated', handleSync);
    return () => window.removeEventListener('minervini_semi_auto_updated', handleSync);
  }, []);

  // Generate candidates
  const candidates: SemiAutoBearishSetup[] = useMemo(() => {
    // Depend on refreshKey, stocks, accountCapital, defaultRiskPct
    return generateSemiAutoBearishCandidates(stocks, accountCapital, defaultRiskPct);
  }, [stocks, accountCapital, defaultRiskPct, refreshKey]);

  // Counts by status
  const counts = useMemo(() => {
    const res = {
      ALL: candidates.length,
      AUTO_DETECTED: 0,
      ARMED_WATCH: 0,
      STAGED_ORDER: 0,
      DISQUALIFIED: 0,
      EXECUTED: 0
    };
    candidates.forEach((c) => {
      res[c.status] = (res[c.status] || 0) + 1;
    });
    return res;
  }, [candidates]);

  // Filtered candidate list
  const filteredCandidates = useMemo(() => {
    return candidates.filter((item) => {
      if (activeFilter !== 'ALL' && item.status !== activeFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          item.ticker.toLowerCase().includes(q) ||
          item.name.toLowerCase().includes(q) ||
          item.exchange.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [candidates, activeFilter, searchQuery]);

  // Select first setup if none selected
  useEffect(() => {
    if (filteredCandidates.length > 0 && !selectedSetupId) {
      setSelectedSetupId(filteredCandidates[0].id);
    }
  }, [filteredCandidates, selectedSetupId]);

  const activeSetup = useMemo(() => {
    return candidates.find((c) => c.id === selectedSetupId) || candidates[0] || null;
  }, [candidates, selectedSetupId]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Status transition handlers
  const handleUpdateStatus = (ticker: string, newStatus: SemiAutoStatus) => {
    saveSemiAutoSetupState(ticker, { status: newStatus });
    setRefreshKey((k) => k + 1);

    const labels: Record<SemiAutoStatus, string> = {
      AUTO_DETECTED: 'Restored to Auto-Detected Queue',
      ARMED_WATCH: '⚡ Setup Armed on Breakdown Watch!',
      STAGED_ORDER: '🛡️ Short Order Staged for Execution!',
      DISQUALIFIED: '❌ Setup Disqualified / Dismissed',
      EXECUTED: '🚀 Trade Marked as Executed'
    };
    showToast(`${ticker}: ${labels[newStatus]}`);
  };

  const handleOpenEditModal = (setup: SemiAutoBearishSetup) => {
    setEditingSetup(setup);
    setEditTrigger(setup.breakdownTriggerPrice);
    setEditStop(setup.buyToCoverStopPrice);
    setEditRiskPct(setup.riskPercent);
    setEditNotes(setup.traderNotes || '');
  };

  const handleSaveEdit = () => {
    if (!editingSetup) return;

    const riskPerShare = editStop - editTrigger;
    const riskDollars = accountCapital * (editRiskPct / 100);
    const shares = riskPerShare > 0 ? Math.max(1, Math.floor(riskDollars / riskPerShare)) : 10;
    const posVal = Number((shares * editTrigger).toFixed(2));
    const coverPct = Number((((editStop - editTrigger) / editTrigger) * 100).toFixed(1));

    const t1 = Number((Math.max(1, editTrigger - 2 * riskPerShare)).toFixed(2));
    const t2 = Number((Math.max(1, editTrigger - 3.5 * riskPerShare)).toFixed(2));
    const rrr = riskPerShare > 0 ? Number(((editTrigger - t1) / riskPerShare).toFixed(2)) : 2.5;

    saveSemiAutoSetupState(editingSetup.ticker, {
      breakdownTriggerPrice: editTrigger,
      buyToCoverStopPrice: editStop,
      coverStopPercent: coverPct,
      target1Price: t1,
      target2Price: t2,
      riskRewardRatio: rrr,
      riskPercent: editRiskPct,
      calculatedShares: shares,
      positionValue: posVal,
      traderNotes: editNotes,
      isUserOverridden: true
    });

    setEditingSetup(null);
    setRefreshKey((k) => k + 1);
    showToast(`Saved customized short parameters for ${editingSetup.ticker}`);
  };

  const handleResetToAlgoDefaults = (ticker: string) => {
    saveSemiAutoSetupState(ticker, {
      isUserOverridden: false,
      breakdownTriggerPrice: undefined,
      buyToCoverStopPrice: undefined,
      coverStopPercent: undefined,
      target1Price: undefined,
      target2Price: undefined,
      traderNotes: undefined
    });
    setRefreshKey((k) => k + 1);
    showToast(`Reset ${ticker} to default algorithmic parameters`);
  };

  // Copy Staged Orders to Clipboard
  const handleCopyStagedOrders = () => {
    const staged = candidates.filter((c) => c.status === 'STAGED_ORDER');
    if (staged.length === 0) {
      showToast('No staged orders in queue to export.');
      return;
    }
    const lines = staged.map(
      (c) =>
        `SELL SHORT ${c.calculatedShares} ${c.ticker} @ STOP LIMIT ${c.breakdownTriggerPrice} | COVER STOP: ${c.buyToCoverStopPrice} | TARGET 1: ${c.target1Price} | RISK: $${(
          (c.buyToCoverStopPrice - c.breakdownTriggerPrice) *
          c.calculatedShares
        ).toFixed(0)}`
    );
    navigator.clipboard.writeText(lines.join('\n'));
    showToast(`Copied ${staged.length} staged order instructions to clipboard!`);
  };

  return (
    <div className={`space-y-6 ${isObsidian ? 'text-gray-100' : 'text-[#1a1a1a]'}`}>
      
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-6 z-50 px-4 py-3 bg-rose-600 text-white rounded-lg shadow-xl font-mono text-xs flex items-center space-x-2 border border-rose-400"
          >
            <Zap className="w-4 h-4 text-amber-300 animate-pulse" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER BANNER: SEMI-AUTOMATIC MINERVINI ARCHITECTURE */}
      <div
        className={`border p-6 rounded-lg ${
          isObsidian
            ? 'bg-gradient-to-r from-slate-900 via-rose-950/30 to-slate-900 border-rose-500/30'
            : 'bg-gradient-to-r from-rose-50 via-slate-50 to-white border-rose-200'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 text-[10px] font-mono font-black uppercase tracking-wider bg-rose-600 text-white rounded flex items-center space-x-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                <span>Semi-Automatic Bearish Protocol</span>
              </span>
              <span
                className={`px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded border ${
                  counts.ARMED_WATCH > 0
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/30 animate-pulse'
                    : 'bg-slate-700 text-gray-300 border-slate-600'
                }`}
              >
                {counts.ARMED_WATCH} Setups Armed on Trigger Watch
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-serif font-black tracking-tight">
              Semi-Automatic Bearish Trend Console
            </h2>

            <p className={`text-xs leading-relaxed ${isObsidian ? 'text-gray-300' : 'text-gray-700'}`}>
              <strong>Mark Minervini SEPA Principle:</strong> Never execute short positions blindly on raw automated triggers. The algorithm continuously identifies Stage 4 markdown and distribution roll-overs, calculates asymmetric downside risk brackets (2x ATR stop loss &amp; 2R/3.5R downside targets), and awaits your review to <strong>Arm</strong>, <strong>Fine-Tune</strong>, or <strong>Disqualify</strong> before order staging.
            </p>
          </div>

          {/* Account Risk Control & Quick Staged Export */}
          <div className="flex flex-wrap items-center gap-3">
            <div
              className={`p-3 rounded border font-mono text-xs ${
                isObsidian ? 'bg-slate-900/80 border-slate-700' : 'bg-white border-gray-200'
              }`}
            >
              <div className="text-[10px] uppercase text-gray-400 block font-sans">
                Portfolio Sizing Engine
              </div>
              <div className="flex items-center space-x-2 mt-1">
                <div className="flex items-center space-x-1">
                  <span className="text-gray-400">$</span>
                  <input
                    type="number"
                    value={accountCapital}
                    onChange={(e) => setAccountCapital(Math.max(5000, Number(e.target.value)))}
                    className={`w-20 p-1 text-xs font-bold rounded border ${
                      isObsidian ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-gray-300'
                    }`}
                    title="Account Equity"
                  />
                </div>
                <span className="text-gray-500">|</span>
                <div className="flex items-center space-x-1">
                  <input
                    type="number"
                    step="0.25"
                    value={defaultRiskPct}
                    onChange={(e) => setDefaultRiskPct(Math.max(0.25, Number(e.target.value)))}
                    className={`w-12 p-1 text-xs font-bold rounded border ${
                      isObsidian ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-gray-300'
                    }`}
                    title="Risk % per Trade"
                  />
                  <span className="text-gray-400">%</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopyStagedOrders}
              className="px-4 py-3 rounded text-xs font-mono font-bold uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-500/40 flex items-center space-x-2 transition-all cursor-pointer shadow-sm"
              title="Copy staged short orders to clipboard"
            >
              <Copy className="w-4 h-4 text-rose-400" />
              <span>Copy Staged ({counts.STAGED_ORDER})</span>
            </button>
          </div>
        </div>

        {/* STATUS PIPELINE TABS */}
        <div className="mt-6 pt-6 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'ALL', label: 'All Candidates', count: counts.ALL, icon: Layers },
              { id: 'ARMED_WATCH', label: 'Armed on Watch', count: counts.ARMED_WATCH, icon: Zap },
              { id: 'STAGED_ORDER', label: 'Staged Orders', count: counts.STAGED_ORDER, icon: ShieldAlert },
              { id: 'AUTO_DETECTED', label: 'Auto-Detected', count: counts.AUTO_DETECTED, icon: Eye },
              { id: 'DISQUALIFIED', label: 'Disqualified', count: counts.DISQUALIFIED, icon: XCircle }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveFilter(tab.id as any)}
                  className={`px-3 py-1.5 rounded text-xs font-mono font-bold flex items-center space-x-1.5 transition-all cursor-pointer border ${
                    isActive
                      ? 'bg-rose-600 text-white border-rose-500 shadow-sm'
                      : isObsidian
                      ? 'bg-slate-900 text-gray-400 hover:text-white border-slate-800'
                      : 'bg-white text-gray-600 hover:text-black border-gray-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] ${
                      isActive ? 'bg-black/30 text-white' : 'bg-slate-800 text-gray-300'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search bar */}
          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search ticker, name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-8 pr-3 py-1.5 rounded text-xs font-mono border focus:outline-none ${
                isObsidian
                  ? 'bg-slate-900 border-slate-700 text-white placeholder-gray-500'
                  : 'bg-white border-gray-300 text-black placeholder-gray-400'
              }`}
            />
          </div>
        </div>
      </div>

      {/* MAIN TWO-PANE COCKPIT: CANDIDATE QUEUE (LEFT) + INSPECTION & EXECUTION CARD (RIGHT) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: CANDIDATE QUEUE LIST (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between text-xs font-mono text-gray-400 px-1">
            <span>Filtered Setups ({filteredCandidates.length})</span>
            <span>Sorted: Armed &gt; Proximity</span>
          </div>

          <div className="space-y-2.5 max-h-[720px] overflow-y-auto pr-1">
            {filteredCandidates.length === 0 ? (
              <div
                className={`p-8 text-center rounded border ${
                  isObsidian ? 'bg-slate-900 border-slate-800 text-gray-400' : 'bg-gray-50 border-gray-200 text-gray-600'
                }`}
              >
                <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-emerald-400 opacity-80" />
                <p className="font-mono text-xs font-bold">No setups found matching this filter.</p>
                <p className="text-[11px] font-sans mt-1 text-gray-500">
                  Switch filters above or adjust risk parameters.
                </p>
              </div>
            ) : (
              filteredCandidates.map((setup) => {
                const isSelected = selectedSetupId === setup.id;
                const dist = setup.distanceToBreakdownPct;
                const isVeryClose = dist <= 1.5 && dist >= -1.0;

                return (
                  <div
                    key={setup.id}
                    onClick={() => {
                      setSelectedSetupId(setup.id);
                      const matchingStock = stocks.find((s) => s.ticker === setup.ticker);
                      if (matchingStock && onSelectStock) onSelectStock(matchingStock);
                    }}
                    className={`p-4 rounded-lg border transition-all cursor-pointer relative ${
                      isSelected
                        ? isObsidian
                          ? 'bg-slate-800/90 border-rose-500 shadow-md ring-1 ring-rose-500/50'
                          : 'bg-rose-50/80 border-rose-400 shadow-sm ring-1 ring-rose-400'
                        : isObsidian
                        ? 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {/* Top Row: Ticker, Status, Rules */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-black text-sm text-gray-100">
                          {setup.ticker}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 bg-slate-800 text-gray-300 rounded border border-slate-700">
                          {setup.exchange}
                        </span>
                        {setup.isUserOverridden && (
                          <span
                            className="text-[9px] font-mono px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded border border-amber-500/30"
                            title="Trader customized parameters"
                          >
                            Custom
                          </span>
                        )}
                      </div>

                      {/* Status Badge */}
                      <span
                        className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded uppercase border flex items-center space-x-1 ${
                          setup.status === 'ARMED_WATCH'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : setup.status === 'STAGED_ORDER'
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            : setup.status === 'DISQUALIFIED'
                            ? 'bg-gray-700/50 text-gray-400 border-gray-600'
                            : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                        }`}
                      >
                        {setup.status === 'ARMED_WATCH' && <Zap className="w-2.5 h-2.5 text-amber-400" />}
                        {setup.status === 'STAGED_ORDER' && <ShieldAlert className="w-2.5 h-2.5 text-rose-400" />}
                        {setup.status === 'DISQUALIFIED' && <XCircle className="w-2.5 h-2.5 text-gray-400" />}
                        {setup.status === 'AUTO_DETECTED' && <Eye className="w-2.5 h-2.5 text-blue-400" />}
                        <span>{setup.status.replace('_', ' ')}</span>
                      </span>
                    </div>

                    {/* Stock Name & Stage */}
                    <div className="text-xs text-gray-400 truncate mt-1">
                      {setup.name} • <span className="text-rose-400 font-bold">{setup.stageCode.replace(/_/g, ' ')}</span>
                    </div>

                    {/* Price and Proximity */}
                    <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                      <div>
                        <span className="text-gray-400 text-[10px] block">Current</span>
                        <strong className="text-gray-200">
                          {formatCurrency(setup.currentPrice, setup.currency)}
                        </strong>
                      </div>

                      <div className="text-right">
                        <span className="text-gray-400 text-[10px] block">Breakdown Trigger</span>
                        <strong className="text-rose-400 font-bold">
                          {formatCurrency(setup.breakdownTriggerPrice, setup.currency)}
                        </strong>
                      </div>

                      <div className="text-right">
                        <span className="text-gray-400 text-[10px] block">Distance</span>
                        <span
                          className={`font-black text-xs px-1.5 py-0.5 rounded ${
                            isVeryClose
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse'
                              : 'text-gray-300'
                          }`}
                        >
                          {dist > 0 ? `-${dist}%` : `+${Math.abs(dist)}%`}
                        </span>
                      </div>
                    </div>

                    {/* Quick Arm / Stage Button */}
                    <div className="mt-2.5 pt-2 flex items-center justify-end space-x-2 text-[10px] font-mono">
                      {setup.status === 'AUTO_DETECTED' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateStatus(setup.ticker, 'ARMED_WATCH');
                          }}
                          className="px-2 py-1 rounded bg-amber-600/30 hover:bg-amber-600 text-amber-200 border border-amber-500/40 font-bold transition-all"
                        >
                          ⚡ Arm Watch
                        </button>
                      )}

                      {setup.status === 'ARMED_WATCH' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateStatus(setup.ticker, 'STAGED_ORDER');
                          }}
                          className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold transition-all"
                        >
                          🛡️ Stage Order
                        </button>
                      )}

                      {setup.status !== 'DISQUALIFIED' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateStatus(setup.ticker, 'DISQUALIFIED');
                          }}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-gray-400 font-bold transition-all"
                          title="Disqualify this setup"
                        >
                          Pass
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: DETAILED INSPECTION, EVIDENCE & ORDER STAGING PANEL (7 cols) */}
        <div className="lg:col-span-7">
          {activeSetup ? (
            <div
              className={`border p-6 rounded-lg space-y-6 ${
                isObsidian ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200'
              }`}
            >
              {/* Header: Active Stock & Status Cockpit */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded bg-rose-950 text-rose-300 border border-rose-800 flex flex-col items-center justify-center font-mono">
                    <span className="text-base font-bold">{activeSetup.ticker}</span>
                    <span className="text-[8px] text-rose-400 uppercase">{activeSetup.exchange}</span>
                  </div>

                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-lg font-serif font-black">{activeSetup.name}</h3>
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${
                          activeSetup.status === 'ARMED_WATCH'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : activeSetup.status === 'STAGED_ORDER'
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                        }`}
                      >
                        {activeSetup.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="text-xs font-mono text-gray-400 mt-0.5 flex items-center space-x-3">
                      <span>{activeSetup.stageCode.replace(/_/g, ' ')}</span>
                      <span>•</span>
                      <span>{activeSetup.bearishRulesPassed}/8 Bearish Rules Passed</span>
                    </div>
                  </div>
                </div>

                {/* External ChartLink & View Chart */}
                <div className="flex items-center space-x-2">
                  <a
                    href={getChartLinkUrl(activeSetup.ticker)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded text-xs font-mono font-bold uppercase bg-slate-800 hover:bg-slate-700 text-blue-300 border border-blue-500/30 flex items-center space-x-1"
                  >
                    <span>ChartLink</span>
                    <ExternalLink className="w-3 h-3 text-blue-400" />
                  </a>

                  {onViewChart && (
                    <button
                      type="button"
                      onClick={() => {
                        const matching = stocks.find((s) => s.ticker === activeSetup.ticker);
                        if (matching) onViewChart(matching);
                      }}
                      className="px-3 py-1.5 rounded text-xs font-mono font-bold uppercase bg-rose-600 hover:bg-rose-500 text-white flex items-center space-x-1 cursor-pointer"
                    >
                      <TrendingDown className="w-3 h-3" />
                      <span>Chart</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Execution Parameters Grid (Editable) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-gray-400 flex items-center space-x-1.5">
                    <Target className="w-4 h-4 text-rose-400" />
                    <span>Calculated Short Execution Bracket:</span>
                  </span>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(activeSetup)}
                      className="text-[11px] font-mono text-amber-400 hover:underline flex items-center space-x-1"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Fine-Tune Parameters</span>
                    </button>
                    {activeSetup.isUserOverridden && (
                      <button
                        type="button"
                        onClick={() => handleResetToAlgoDefaults(activeSetup.ticker)}
                        className="text-[11px] font-mono text-gray-400 hover:text-white flex items-center space-x-1"
                        title="Reset to algorithmic calculations"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reset Defaults</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center font-mono">
                  {/* Breakdown Trigger */}
                  <div
                    className={`p-3 rounded border ${
                      isObsidian ? 'bg-slate-950 border-slate-800' : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <span className="text-[10px] text-gray-400 uppercase tracking-wider block">
                      Short Trigger
                    </span>
                    <strong className="text-base font-black text-rose-500 block mt-0.5">
                      {formatCurrency(activeSetup.breakdownTriggerPrice, activeSetup.currency)}
                    </strong>
                    <span className="text-[9px] text-gray-400">Under support</span>
                  </div>

                  {/* 2x ATR Cover Stop */}
                  <div
                    className={`p-3 rounded border ${
                      isObsidian ? 'bg-rose-950/20 border-rose-800/40' : 'bg-rose-50 border-rose-200'
                    }`}
                  >
                    <span className="text-[10px] text-rose-400 uppercase tracking-wider block">
                      Cover Stop Loss
                    </span>
                    <strong className="text-base font-black text-rose-400 block mt-0.5">
                      {formatCurrency(activeSetup.buyToCoverStopPrice, activeSetup.currency)}
                    </strong>
                    <span className="text-[9px] text-rose-400 font-bold">
                      +{activeSetup.coverStopPercent}% Risk
                    </span>
                  </div>

                  {/* Downside Target 1 (2R) */}
                  <div
                    className={`p-3 rounded border ${
                      isObsidian ? 'bg-emerald-950/20 border-emerald-800/40' : 'bg-emerald-50 border-emerald-200'
                    }`}
                  >
                    <span className="text-[10px] text-emerald-400 uppercase tracking-wider block">
                      Target 1 (2R)
                    </span>
                    <strong className="text-base font-black text-emerald-400 block mt-0.5">
                      {formatCurrency(activeSetup.target1Price, activeSetup.currency)}
                    </strong>
                    <span className="text-[9px] text-emerald-400 font-bold">Cover 50%</span>
                  </div>

                  {/* Downside Target 2 (3.5R) */}
                  <div
                    className={`p-3 rounded border ${
                      isObsidian ? 'bg-emerald-950/20 border-emerald-800/40' : 'bg-emerald-50 border-emerald-200'
                    }`}
                  >
                    <span className="text-[10px] text-emerald-400 uppercase tracking-wider block">
                      Target 2 (3.5R)
                    </span>
                    <strong className="text-base font-black text-emerald-400 block mt-0.5">
                      {formatCurrency(activeSetup.target2Price, activeSetup.currency)}
                    </strong>
                    <span className="text-[9px] text-emerald-400 font-bold">Full Cover</span>
                  </div>
                </div>
              </div>

              {/* Calculated Sizing & Risk Protection Card */}
              <div
                className={`p-4 rounded-lg border space-y-3 font-mono text-xs ${
                  isObsidian ? 'bg-slate-950/80 border-slate-800' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between text-gray-400">
                  <span className="uppercase text-[10px] font-bold">Minervini Sizing Guard:</span>
                  <span className="text-amber-400 font-bold">
                    Risk {activeSetup.riskPercent}% of ${accountCapital.toLocaleString()}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center pt-1 border-t border-slate-800/60">
                  <div>
                    <span className="text-[10px] text-gray-500 block">Position Shares</span>
                    <strong className="text-base font-black text-rose-400">
                      {activeSetup.calculatedShares.toLocaleString()}
                    </strong>
                  </div>

                  <div>
                    <span className="text-[10px] text-gray-500 block">Short Capital</span>
                    <strong className="text-base font-black text-gray-200">
                      {formatCurrency(activeSetup.positionValue, activeSetup.currency)}
                    </strong>
                  </div>

                  <div>
                    <span className="text-[10px] text-gray-500 block">1R Hard Risk</span>
                    <strong className="text-base font-black text-rose-500">
                      {formatCurrency(
                        (activeSetup.buyToCoverStopPrice - activeSetup.breakdownTriggerPrice) *
                          activeSetup.calculatedShares,
                        activeSetup.currency
                      )}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Bearish Technical Evidence & Catalysts Checklist */}
              <div className="space-y-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-gray-400 block">
                  Algorithmic Catalysts &amp; Evidence ({activeSetup.catalysts.length})
                </span>

                <div className="space-y-1.5">
                  {activeSetup.catalysts.map((cat, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded border border-rose-900/30 bg-rose-950/10 text-xs font-mono flex items-start space-x-2 text-rose-300"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                      <span>{cat}</span>
                    </div>
                  ))}
                  {activeSetup.catalysts.length === 0 && (
                    <div className="p-3 text-xs text-gray-400 font-mono">
                      No critical distribution flags triggered yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Trader Notes if any */}
              {activeSetup.traderNotes && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded text-xs font-mono text-amber-300">
                  <span className="text-amber-400 font-bold block mb-1">Trader Observation:</span>
                  <p>{activeSetup.traderNotes}</p>
                </div>
              )}

              {/* ACTION COCKPIT CONTROLS: ARM, STAGE, DISQUALIFY */}
              <div className="pt-4 border-t border-slate-800 space-y-3">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-gray-400 block">
                  Semi-Automatic Action Gate:
                </span>

                <div className="flex flex-wrap items-center gap-3">
                  {/* ARM WATCH BUTTON */}
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(activeSetup.ticker, 'ARMED_WATCH')}
                    className={`px-4 py-2.5 rounded font-mono font-bold text-xs uppercase tracking-wider flex items-center space-x-2 transition-all cursor-pointer ${
                      activeSetup.status === 'ARMED_WATCH'
                        ? 'bg-amber-600 text-white shadow-md'
                        : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40'
                    }`}
                  >
                    <Zap className="w-4 h-4 text-amber-300" />
                    <span>{activeSetup.status === 'ARMED_WATCH' ? '✓ Armed on Watch' : 'Arm Breakdown Watch'}</span>
                  </button>

                  {/* STAGE ORDER BUTTON */}
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(activeSetup.ticker, 'STAGED_ORDER')}
                    className={`px-4 py-2.5 rounded font-mono font-bold text-xs uppercase tracking-wider flex items-center space-x-2 transition-all cursor-pointer ${
                      activeSetup.status === 'STAGED_ORDER'
                        ? 'bg-rose-600 text-white shadow-md'
                        : 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40'
                    }`}
                  >
                    <ShieldAlert className="w-4 h-4 text-rose-300" />
                    <span>{activeSetup.status === 'STAGED_ORDER' ? '✓ Order Staged' : 'Stage Short Order'}</span>
                  </button>

                  {/* DISQUALIFY / PASS BUTTON */}
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(activeSetup.ticker, 'DISQUALIFIED')}
                    className={`px-4 py-2.5 rounded font-mono font-bold text-xs uppercase tracking-wider flex items-center space-x-2 transition-all cursor-pointer ${
                      activeSetup.status === 'DISQUALIFIED'
                        ? 'bg-gray-700 text-white'
                        : 'bg-slate-800 hover:bg-slate-700 text-gray-400 border border-slate-700'
                    }`}
                  >
                    <XCircle className="w-4 h-4 text-gray-400" />
                    <span>{activeSetup.status === 'DISQUALIFIED' ? '✓ Disqualified' : 'Disqualify / Pass'}</span>
                  </button>

                  {/* RESTORE TO AUTO-DETECTED */}
                  {activeSetup.status !== 'AUTO_DETECTED' && (
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(activeSetup.ticker, 'AUTO_DETECTED')}
                      className="px-3 py-2.5 rounded font-mono text-xs text-gray-400 hover:text-white underline cursor-pointer"
                    >
                      Reset to Auto-Detected
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-gray-500 font-mono text-xs">
              Select a candidate from the queue to view setup details.
            </div>
          )}
        </div>
      </div>

      {/* PARAMETER FINE-TUNING MODAL */}
      <AnimatePresence>
        {editingSetup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`max-w-md w-full p-6 rounded-lg shadow-2xl border ${
                isObsidian ? 'bg-slate-900 border-slate-700 text-gray-100' : 'bg-white border-gray-300 text-gray-900'
              }`}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center space-x-2">
                  <Edit3 className="w-4 h-4 text-amber-400" />
                  <h4 className="font-serif font-black text-base">
                    Fine-Tune Short Parameters: {editingSetup.ticker}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingSetup(null)}
                  className="text-gray-400 hover:text-white text-lg font-bold"
                >
                  &times;
                </button>
              </div>

              <div className="space-y-4 my-4 font-mono text-xs">
                <div>
                  <label className="text-gray-400 block mb-1">
                    Breakdown Trigger Price ({editingSetup.currency})
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    value={editTrigger}
                    onChange={(e) => setEditTrigger(Number(e.target.value))}
                    className={`w-full p-2 rounded border font-bold ${
                      isObsidian ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-gray-300'
                    }`}
                  />
                  <span className="text-[10px] text-gray-500">
                    Current Price: {editingSetup.currentPrice}
                  </span>
                </div>

                <div>
                  <label className="text-gray-400 block mb-1">
                    Buy-to-Cover Stop Loss ({editingSetup.currency})
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    value={editStop}
                    onChange={(e) => setEditStop(Number(e.target.value))}
                    className={`w-full p-2 rounded border font-bold ${
                      isObsidian ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-gray-300'
                    }`}
                  />
                  <span className="text-[10px] text-rose-400">
                    Stop Distance: +{(((editStop - editTrigger) / editTrigger) * 100).toFixed(1)}%
                  </span>
                </div>

                <div>
                  <label className="text-gray-400 block mb-1">Risk % of Portfolio</label>
                  <input
                    type="number"
                    step="0.25"
                    value={editRiskPct}
                    onChange={(e) => setEditRiskPct(Number(e.target.value))}
                    className={`w-full p-2 rounded border font-bold ${
                      isObsidian ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-gray-300'
                    }`}
                  />
                </div>

                <div>
                  <label className="text-gray-400 block mb-1">Trader Notes / Breakdown Thesis</label>
                  <textarea
                    rows={3}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="e.g. Broken ascending wedge, earnings due next month, heavy volume on down days"
                    className={`w-full p-2 rounded border font-sans text-xs ${
                      isObsidian ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-gray-300'
                    }`}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingSetup(null)}
                  className="px-4 py-2 rounded text-xs font-mono text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="px-4 py-2 rounded text-xs font-mono font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-sm"
                >
                  Save Parameters
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
