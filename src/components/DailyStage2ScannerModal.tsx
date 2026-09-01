import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  Zap,
  Target,
  CheckCircle2,
  XCircle,
  Clock,
  Settings,
  History,
  TrendingUp,
  BarChart3,
  Volume2,
  X,
  Play,
  RotateCcw,
  Check,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  AlertTriangle,
  Flame,
  Search,
  SlidersHorizontal,
  Bell,
  Radio,
  ExternalLink,
} from 'lucide-react';
import { MinerviniTradeSetup } from '../types';
import {
  DailyStage2ScanSettings,
  DailyStage2ScanResult,
  Stage2BreakoutCandidate,
  getDailyStage2ScanSettings,
  saveDailyStage2ScanSettings,
  getDailyStage2ScanHistory,
  runDailyStage2Scan,
  dispatchStage2DailyScanNotification,
} from '../utils/dailyStage2Scanner';
import { getCurrencySymbol, formatCurrency } from '../utils/sepaCalculator';
import { playHighConvictionBreakoutChime } from '../utils/audioAlertEngine';

interface DailyStage2ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  stocks: MinerviniTradeSetup[];
  onSelectStock: (stock: MinerviniTradeSetup) => void;
  onViewChart: (stock: MinerviniTradeSetup) => void;
  onNavigateToTab?: (tab: 'screener' | 'chart' | 'calculator' | 'daily_review') => void;
}

export const DailyStage2ScannerModal: React.FC<DailyStage2ScannerModalProps> = ({
  isOpen,
  onClose,
  stocks,
  onSelectStock,
  onViewChart,
  onNavigateToTab,
}) => {
  const [activeTab, setActiveTab] = useState<'results' | 'settings' | 'history'>('results');
  const [settings, setSettings] = useState<DailyStage2ScanSettings>(() => getDailyStage2ScanSettings());
  const [history, setHistory] = useState<DailyStage2ScanResult[]>(() => getDailyStage2ScanHistory());
  const [currentResult, setCurrentResult] = useState<DailyStage2ScanResult | null>(() => {
    const hist = getDailyStage2ScanHistory();
    return hist.length > 0 ? hist[0] : null;
  });
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [expandedCandidateTicker, setExpandedCandidateTicker] = useState<string | null>(null);
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setSettings(getDailyStage2ScanSettings());
      const hist = getDailyStage2ScanHistory();
      setHistory(hist);
      if (hist.length > 0 && !currentResult) {
        setCurrentResult(hist[0]);
      }

      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };

      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleRunManualScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      const res = runDailyStage2Scan(stocks, { isScheduled: false });
      setCurrentResult(res);
      setHistory(getDailyStage2ScanHistory());
      setIsScanning(false);
      if (settings.autoNotify) {
        dispatchStage2DailyScanNotification(res);
      } else if (settings.soundAlert) {
        playHighConvictionBreakoutChime();
      }
    }, 600);
  };

  const handleSaveSettings = (updated: Partial<DailyStage2ScanSettings>) => {
    const res = saveDailyStage2ScanSettings(updated);
    setSettings(res);
    setSavedSuccessMsg('Settings saved successfully!');
    setTimeout(() => setSavedSuccessMsg(''), 2500);
  };

  const filteredCandidates = (currentResult?.candidates || []).filter((c) => {
    if (!searchFilter) return true;
    const q = searchFilter.toLowerCase();
    return (
      c.ticker.toLowerCase().includes(q) ||
      c.stockName.toLowerCase().includes(q) ||
      c.patternType.toLowerCase().includes(q) ||
      c.breakoutStatus.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="bg-[#0e121b] border-2 border-amber-500/70 text-white w-full max-w-5xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col font-mono"
      >
        {/* Modal Header */}
        <div className="bg-[#141926] border-b border-gray-800 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-amber-500 text-slate-950 flex items-center justify-center font-black rounded-xs shadow-md">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 uppercase tracking-wider font-extrabold">
                  Mark Minervini SEPA Engine
                </span>
                <span className="flex items-center space-x-1 text-[10px] text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5">
                  <Radio className="w-2.5 h-2.5 animate-pulse text-emerald-400" />
                  <span>
                    Schedule: {settings.enabled ? `Active (${settings.scheduledTime})` : 'Paused'}
                  </span>
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-serif font-black text-white leading-tight mt-0.5">
                Scheduled Daily Stage 2 Breakout Scanner
              </h2>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <div className="hidden sm:flex items-center space-x-1 bg-black/40 border border-gray-700/80 px-2 py-1 text-[10px] text-gray-300">
              <span className="text-gray-400">Toggle:</span>
              <kbd className="bg-gray-800 border border-gray-600 px-1 py-0.5 text-amber-300 font-mono font-bold rounded-xs">
                ⌘K
              </kbd>
              <span className="text-gray-500">/</span>
              <kbd className="bg-gray-800 border border-gray-600 px-1 py-0.5 text-amber-300 font-mono font-bold rounded-xs">
                Ctrl+K
              </kbd>
            </div>

            <button
              onClick={handleRunManualScan}
              disabled={isScanning}
              className="bg-amber-500 hover:bg-amber-400 disabled:bg-gray-700 text-slate-950 font-black px-4 py-2 text-xs uppercase tracking-wider flex items-center space-x-1.5 transition-all shadow-md cursor-pointer"
            >
              {isScanning ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                  <span>Scanning {stocks.length} Equities...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Run Daily Scan Now</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors cursor-pointer"
              title="Close Scanner"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between border-b border-gray-800 bg-[#10141f] px-4 sm:px-5">
          <div className="flex space-x-4 text-xs font-bold uppercase tracking-wider">
            <button
              onClick={() => setActiveTab('results')}
              className={`py-3 border-b-2 flex items-center space-x-1.5 transition-colors cursor-pointer ${
                activeTab === 'results'
                  ? 'border-amber-400 text-amber-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <Target className="w-4 h-4" />
              <span>
                Scan Results {currentResult ? `(${currentResult.candidates.length})` : ''}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`py-3 border-b-2 flex items-center space-x-1.5 transition-colors cursor-pointer ${
                activeTab === 'settings'
                  ? 'border-amber-400 text-amber-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Schedule & Filter Settings</span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`py-3 border-b-2 flex items-center space-x-1.5 transition-colors cursor-pointer ${
                activeTab === 'history'
                  ? 'border-amber-400 text-amber-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <History className="w-4 h-4" />
              <span>Scan History ({history.length})</span>
            </button>
          </div>

          {currentResult && (
            <span className="text-[10px] text-gray-400 hidden sm:inline">
              Last Scan: <strong className="text-gray-200">{currentResult.timestamp}</strong>
            </span>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* TAB 1: RESULTS */}
          {activeTab === 'results' && (
            <div className="space-y-4">
              {/* Scan Summary Banner */}
              {currentResult ? (
                <div className="bg-white/5 border border-white/10 p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-amber-400 uppercase">
                        {currentResult.isScheduled ? 'Automated Scheduled Scan' : 'On-Demand Daily Scan'}
                      </span>
                      <span className="text-gray-400">•</span>
                      <span className="text-gray-300">{currentResult.timestamp}</span>
                    </div>
                    <p className="text-gray-200 font-sans text-xs">
                      {currentResult.marketSummary}
                    </p>
                  </div>

                  <div className="flex items-center space-x-3 text-center">
                    <div className="bg-black/40 px-3 py-1.5 border border-gray-800">
                      <span className="text-[9px] text-gray-400 uppercase block">Scanned</span>
                      <span className="font-black text-white">{currentResult.totalStocksScanned}</span>
                    </div>
                    <div className="bg-black/40 px-3 py-1.5 border border-gray-800">
                      <span className="text-[9px] text-gray-400 uppercase block">Qualified</span>
                      <span className="font-black text-emerald-400">{currentResult.qualifiedCount}</span>
                    </div>
                    <div className="bg-black/40 px-3 py-1.5 border border-emerald-500/40 bg-emerald-950/30">
                      <span className="text-[9px] text-emerald-300 uppercase block">New Breakouts</span>
                      <span className="font-black text-amber-300">{currentResult.newBreakoutsCount}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 bg-white/5 border border-dashed border-gray-700 p-6">
                  <p className="text-gray-400 text-xs mb-3">No scan has been executed yet today.</p>
                  <button
                    onClick={handleRunManualScan}
                    className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-4 py-2 text-xs uppercase"
                  >
                    Run First Scan Now
                  </button>
                </div>
              )}

              {/* Filter Search Input */}
              {currentResult && currentResult.candidates.length > 0 && (
                <div className="flex items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Filter by ticker, company, pattern..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      className="w-full bg-black/40 border border-gray-800 text-xs text-white pl-8 pr-3 py-1.5 focus:border-amber-400 focus:outline-hidden"
                    />
                  </div>
                  <span className="text-[11px] text-gray-400">
                    Showing {filteredCandidates.length} of {currentResult.candidates.length} leaders
                  </span>
                </div>
              )}

              {/* Candidates Grid */}
              <div className="space-y-3">
                {filteredCandidates.map((candidate) => {
                  const isExpanded = expandedCandidateTicker === candidate.ticker;
                  const currencySymbol = getCurrencySymbol(candidate.exchange);

                  return (
                    <motion.div
                      key={candidate.ticker}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-[#121722] border border-gray-800 hover:border-amber-500/50 transition-all p-4 space-y-3 shadow-md"
                    >
                      {/* Top Row */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 pb-2.5">
                        <div className="flex items-center space-x-2">
                          <span className="text-base font-black text-white font-mono">
                            {candidate.ticker}
                          </span>
                          <span className="text-[9px] bg-[#1a1a1a] text-gray-300 px-1.5 py-0.5 uppercase font-bold">
                            {candidate.exchange}
                          </span>
                          <span className="text-xs text-gray-300 font-sans font-medium">
                            {candidate.stockName}
                          </span>

                          {candidate.isNewCandidate && (
                            <span className="bg-emerald-500 text-black text-[9px] font-black uppercase px-2 py-0.5 animate-pulse">
                              ✨ NEW BREAKOUT
                            </span>
                          )}

                          <span
                            className={`text-[9px] font-bold uppercase px-2 py-0.5 ${
                              candidate.breakoutStatus === 'ACTIVE_BREAKOUT'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                                : candidate.breakoutStatus === 'BUY_ZONE_COIL'
                                ? 'bg-amber-950 text-amber-300 border border-amber-700'
                                : 'bg-blue-950 text-blue-300 border border-blue-700'
                            }`}
                          >
                            {candidate.breakoutStatus.replace('_', ' ')}
                          </span>
                        </div>

                        {/* Trend Score & RS Badge */}
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] bg-black/60 px-2 py-1 border border-gray-800 text-gray-300">
                            Trend Score:{' '}
                            <strong className="text-emerald-400 font-bold font-mono">
                              {candidate.trendScore}/8
                            </strong>
                          </span>
                          <span className="text-[10px] bg-emerald-950/80 text-emerald-300 px-2 py-1 border border-emerald-700/80 font-bold font-mono">
                            RS Rating: {candidate.rsRating}
                          </span>
                        </div>
                      </div>

                      {/* Middle Data Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="bg-black/30 p-2 border border-gray-800/80">
                          <span className="text-[9px] text-gray-400 uppercase block">Current Price</span>
                          <span className="font-extrabold text-white font-mono">
                            {formatCurrency(candidate.currentPrice, currencySymbol)}
                          </span>
                        </div>

                        <div className="bg-black/30 p-2 border border-gray-800/80">
                          <span className="text-[9px] text-gray-400 uppercase block">Pivot Target</span>
                          <span className="font-extrabold text-amber-400 font-mono">
                            {formatCurrency(candidate.pivotPrice, currencySymbol)}
                          </span>
                        </div>

                        <div className="bg-black/30 p-2 border border-gray-800/80">
                          <span className="text-[9px] text-gray-400 uppercase block">Distance to Pivot</span>
                          <span
                            className={`font-extrabold font-mono ${
                              candidate.distanceToPivotPct >= 0 ? 'text-emerald-400' : 'text-amber-400'
                            }`}
                          >
                            {candidate.distanceToPivotPct >= 0 ? '+' : ''}
                            {candidate.distanceToPivotPct}%
                          </span>
                        </div>

                        <div className="bg-black/30 p-2 border border-gray-800/80">
                          <span className="text-[9px] text-gray-400 uppercase block">Pattern / Tightness</span>
                          <span className="font-bold text-gray-300 font-sans truncate block">
                            {candidate.patternType} ({candidate.volumeDryUpPercent}% vol)
                          </span>
                        </div>
                      </div>

                      {/* SEPA Verdict */}
                      <div className="bg-black/40 p-2.5 border-l-2 border-amber-400 text-xs font-sans text-gray-200">
                        <strong className="text-amber-300 font-serif">Minervini SEPA Verdict: </strong>
                        {candidate.sepaVerdict}
                      </div>

                      {/* Expandable 8-Rule Checklist */}
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="bg-black/50 p-3 border border-gray-800 space-y-2 text-[11px]"
                        >
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block border-b border-gray-800 pb-1">
                            Minervini 8-Rule Stage 2 Trend Template Audit:
                          </span>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {candidate.passedRules.map((rule) => (
                              <div key={rule.id} className="flex items-start space-x-1.5 text-emerald-300">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                <span className="leading-tight">
                                  <strong>{rule.title}</strong> — {rule.actualValueStr}
                                </span>
                              </div>
                            ))}

                            {candidate.failedRules.map((rule) => (
                              <div key={rule.id} className="flex items-start space-x-1.5 text-rose-400">
                                <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                                <span className="leading-tight">
                                  <strong>{rule.title}</strong> (Req: {rule.requiredConditionStr})
                                </span>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}

                      {/* Action Bar */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedCandidateTicker(isExpanded ? null : candidate.ticker)
                          }
                          className="text-[10px] text-gray-400 hover:text-amber-300 flex items-center space-x-1 cursor-pointer"
                        >
                          <span>{isExpanded ? 'Hide Trend Template Rules' : 'Inspect 8-Rule Checklist'}</span>
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>

                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => {
                              onSelectStock(candidate.stock);
                              onViewChart(candidate.stock);
                              onClose();
                            }}
                            className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider flex items-center space-x-1 transition-all cursor-pointer shadow-xs"
                          >
                            <BarChart3 className="w-3.5 h-3.5" />
                            <span>Scan VCP Chart</span>
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="bg-[#121722] border border-gray-800 p-5 space-y-5 text-xs">
              <div className="border-b border-gray-800 pb-3">
                <h3 className="text-sm font-serif font-black text-amber-300 uppercase tracking-wider">
                  Automated Daily Scan Configuration
                </h3>
                <p className="text-gray-400 font-sans text-xs mt-0.5">
                  Configure automated scanning schedule, trend score strictness, and audio/toast notifications.
                </p>
              </div>

              {savedSuccessMsg && (
                <div className="bg-emerald-950/80 border border-emerald-600 text-emerald-300 p-2.5 text-xs flex items-center space-x-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>{savedSuccessMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Enable Scheduled Scan */}
                <div className="bg-black/30 p-3 border border-gray-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-200 uppercase">Enable Daily Automated Scan:</span>
                    <button
                      onClick={() => handleSaveSettings({ enabled: !settings.enabled })}
                      className={`px-3 py-1 text-xs font-bold uppercase cursor-pointer ${
                        settings.enabled
                          ? 'bg-emerald-500 text-black'
                          : 'bg-gray-800 text-gray-400 border border-gray-700'
                      }`}
                    >
                      {settings.enabled ? 'ACTIVE' : 'DISABLED'}
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400 font-sans">
                    When active, the scanner runs automatically in the background at your scheduled time.
                  </p>
                </div>

                {/* Scheduled Time */}
                <div className="bg-black/30 p-3 border border-gray-800 space-y-2">
                  <span className="font-bold text-gray-200 uppercase block">Daily Scheduled Scan Time:</span>
                  <div className="flex items-center space-x-2">
                    <input
                      type="time"
                      value={settings.scheduledTime}
                      onChange={(e) => handleSaveSettings({ scheduledTime: e.target.value })}
                      className="bg-black border border-gray-700 text-amber-300 px-3 py-1 text-xs font-mono font-bold focus:border-amber-400 focus:outline-hidden"
                    />
                    <div className="flex space-x-1">
                      <button
                        onClick={() => handleSaveSettings({ scheduledTime: '09:30' })}
                        className="text-[10px] bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 cursor-pointer"
                      >
                        09:30 AM (Market Open)
                      </button>
                      <button
                        onClick={() => handleSaveSettings({ scheduledTime: '16:00' })}
                        className="text-[10px] bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 cursor-pointer"
                      >
                        04:00 PM (Close)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Minimum Trend Score */}
                <div className="bg-black/30 p-3 border border-gray-800 space-y-2">
                  <span className="font-bold text-gray-200 uppercase block">
                    Min Trend Template Score:
                  </span>
                  <div className="flex space-x-2">
                    {[7, 8].map((score) => (
                      <button
                        key={score}
                        onClick={() => handleSaveSettings({ minTrendScore: score })}
                        className={`flex-1 py-1.5 font-bold uppercase text-xs cursor-pointer border ${
                          settings.minTrendScore === score
                            ? 'bg-amber-500 text-black border-amber-400'
                            : 'bg-black/50 text-gray-400 border-gray-700 hover:border-gray-500'
                        }`}
                      >
                        {score}/8 Rules Passed {score === 8 ? '(Strict Leader)' : '(High Readiness)'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Minimum RS Rating */}
                <div className="bg-black/30 p-3 border border-gray-800 space-y-2">
                  <span className="font-bold text-gray-200 uppercase block">
                    Min Relative Strength (RS Rating):
                  </span>
                  <div className="flex space-x-2">
                    {[70, 75, 80, 85].map((rs) => (
                      <button
                        key={rs}
                        onClick={() => handleSaveSettings({ minRsRating: rs })}
                        className={`flex-1 py-1.5 font-bold uppercase text-xs cursor-pointer border ${
                          settings.minRsRating === rs
                            ? 'bg-emerald-500 text-black border-emerald-400'
                            : 'bg-black/50 text-gray-400 border-gray-700 hover:border-gray-500'
                        }`}
                      >
                        &ge; {rs}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notification Toast Toggle */}
                <div className="bg-black/30 p-3 border border-gray-800 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-gray-200 uppercase block">Global Notification Toast:</span>
                    <span className="text-[11px] text-gray-400 font-sans">
                      Display toast banner when daily scan finishes
                    </span>
                  </div>
                  <button
                    onClick={() => handleSaveSettings({ autoNotify: !settings.autoNotify })}
                    className={`px-3 py-1 font-bold uppercase cursor-pointer ${
                      settings.autoNotify ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-400'
                    }`}
                  >
                    {settings.autoNotify ? 'ON' : 'OFF'}
                  </button>
                </div>

                {/* Sound Alert Toggle */}
                <div className="bg-black/30 p-3 border border-gray-800 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-gray-200 uppercase block">Audio Setup Chime:</span>
                    <span className="text-[11px] text-gray-400 font-sans">
                      Play acoustic triad chime on daily breakout detection
                    </span>
                  </div>
                  <button
                    onClick={() => handleSaveSettings({ soundAlert: !settings.soundAlert })}
                    className={`px-3 py-1 font-bold uppercase cursor-pointer ${
                      settings.soundAlert ? 'bg-purple-500 text-white' : 'bg-gray-800 text-gray-400'
                    }`}
                  >
                    {settings.soundAlert ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: HISTORY */}
          {activeTab === 'history' && (
            <div className="bg-[#121722] border border-gray-800 p-5 space-y-3 text-xs">
              <div className="border-b border-gray-800 pb-2">
                <h3 className="text-sm font-serif font-black text-amber-300 uppercase tracking-wider">
                  Past Daily Scan Logs
                </h3>
              </div>

              {history.length === 0 ? (
                <p className="text-gray-400 text-xs py-4 text-center">No scan history recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {history.map((item, idx) => (
                    <div
                      key={item.scanId || idx}
                      onClick={() => {
                        setCurrentResult(item);
                        setActiveTab('results');
                      }}
                      className="bg-black/40 hover:bg-black/80 border border-gray-800 p-3 flex items-center justify-between cursor-pointer transition-colors"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-amber-400">{item.timestamp}</span>
                          <span className="text-[9px] bg-gray-800 text-gray-300 px-1.5 py-0.5 uppercase">
                            {item.isScheduled ? 'Scheduled' : 'Manual'}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-300 font-sans">{item.marketSummary}</p>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className="bg-emerald-950 text-emerald-300 border border-emerald-700 px-2 py-1 font-mono font-bold text-[11px]">
                          {item.qualifiedCount} Leaders
                        </span>
                        <span className="text-gray-400 text-xs">&rarr;</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-[#141926] border-t border-gray-800 p-3 sm:p-4 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400">
          <div className="flex items-center space-x-2">
            <span>
              Scans evaluated against all 8 Mark Minervini SEPA Trend Template criteria.
            </span>
            <span className="hidden md:inline-flex items-center space-x-1 text-[11px] text-gray-400 bg-black/40 border border-gray-700/60 px-2 py-0.5">
              <span>Press</span>
              <kbd className="bg-gray-800 border border-gray-600 px-1 py-0.2 text-amber-300 font-mono text-[10px] font-bold">ESC</kbd>
              <span>to close</span>
            </span>
          </div>
          <button
            onClick={onClose}
            className="bg-gray-800 hover:bg-gray-700 text-white font-bold px-4 py-1.5 uppercase tracking-wider cursor-pointer"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
};
