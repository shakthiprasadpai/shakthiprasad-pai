import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MinerviniTradeSetup,
  DailyStockEvaluation,
  DailyRankedPick,
  ConvictionTier,
  DailyTradeAction,
  DailyMinerviniCriteriaItem
} from '../types';
import {
  evaluateStockDailyCriteria,
  getDailyQualifiedStocks,
  loadSavedDailyRankedPicks,
  saveDailyRankedPicks,
  loadSavedMorningChecklist,
  saveMorningChecklist,
  DEFAULT_MORNING_CHECKLIST,
  DailyMorningChecklistState,
  generateDailyBriefingReport
} from '../utils/dailyReviewEvaluator';
import { formatCurrency, getCurrencySymbol } from '../utils/sepaCalculator';
import {
  Award,
  TrendingUp,
  Zap,
  Activity,
  Droplets,
  ShieldCheck,
  Target,
  BarChart3,
  Calendar,
  CheckCircle2,
  XCircle,
  ChevronUp,
  ChevronDown,
  Star,
  Sparkles,
  ClipboardCopy,
  Check,
  Filter,
  Search,
  SlidersHorizontal,
  ArrowUpRight,
  Flame,
  Layers,
  BookOpen,
  Info,
  RefreshCw,
  Clock,
  ArrowRight,
  CheckSquare,
  AlertTriangle,
  FileText,
  Trash2,
  Crosshair,
  ListOrdered,
  LayoutGrid,
  Table as TableIcon
} from 'lucide-react';

interface DailyReviewProps {
  stocks: MinerviniTradeSetup[];
  onSelectStock: (stock: MinerviniTradeSetup) => void;
  onViewChart: (stock: MinerviniTradeSetup) => void;
  onViewTradePlan: (stock: MinerviniTradeSetup) => void;
}

export const DailyReview: React.FC<DailyReviewProps> = ({
  stocks,
  onSelectStock,
  onViewChart,
  onViewTradePlan
}) => {
  // 1. Core State
  const [minCriteriaCount, setMinCriteriaCount] = useState<number>(3);
  const [activeFilterTab, setActiveFilterTab] = useState<'ALL_QUALIFIED' | 'TOP_PICKS_ONLY' | 'IN_BUY_ZONE' | 'VOLUME_DRYUP' | 'ACTIVE_BREAKOUT'>('ALL_QUALIFIED');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedExchange, setSelectedExchange] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'alpha_score' | 'criteria_count' | 'rs_rating' | 'pivot_distance' | 'risk_reward'>('alpha_score');
  const [viewMode, setViewMode] = useState<'CARDS' | 'TABLE'>('CARDS');
  const [showChecklist, setShowChecklist] = useState<boolean>(false);
  const [copiedReport, setCopiedReport] = useState<boolean>(false);
  const [inspectedStock, setInspectedStock] = useState<DailyStockEvaluation | null>(null);

  // 2. Persistent State
  const [rankedPicks, setRankedPicks] = useState<DailyRankedPick[]>(() => loadSavedDailyRankedPicks());
  const [morningChecklist, setMorningChecklist] = useState<DailyMorningChecklistState>(() => loadSavedMorningChecklist());

  // Save to localStorage when state changes
  useEffect(() => {
    saveDailyRankedPicks(rankedPicks);
  }, [rankedPicks]);

  useEffect(() => {
    saveMorningChecklist(morningChecklist);
  }, [morningChecklist]);

  // Today's date formatted nicely
  const todayFormatted = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }, []);

  // 3. Evaluate all stocks
  const allEvaluations = useMemo<DailyStockEvaluation[]>(() => {
    return stocks.map(evaluateStockDailyCriteria);
  }, [stocks]);

  // Map of ranked picks for fast lookup
  const rankedPicksMap = useMemo(() => {
    const map = new Map<string, DailyRankedPick>();
    rankedPicks.forEach(p => map.set(p.ticker, p));
    return map;
  }, [rankedPicks]);

  // Filtered evaluations based on criteria threshold and active filters
  const filteredEvaluations = useMemo(() => {
    let list = allEvaluations.filter(e => e.criteriaPassedCount >= minCriteriaCount);

    // Filter tab
    if (activeFilterTab === 'TOP_PICKS_ONLY') {
      list = list.filter(e => rankedPicksMap.has(e.stock.ticker));
    } else if (activeFilterTab === 'IN_BUY_ZONE') {
      list = list.filter(e => e.inBuyZone || (e.distanceToPivotPercent >= -2.0 && e.distanceToPivotPercent <= 2.0));
    } else if (activeFilterTab === 'VOLUME_DRYUP') {
      list = list.filter(e => (e.stock.volumeDryUpPercent !== undefined && e.stock.volumeDryUpPercent <= -50) || e.stock.isTightVolume);
    } else if (activeFilterTab === 'ACTIVE_BREAKOUT') {
      list = list.filter(e => e.stock.vcpStage === 'Active Breakout' || e.pivotStatus === 'ACTIVE_BREAKOUT');
    }

    // Exchange filter
    if (selectedExchange !== 'ALL') {
      list = list.filter(e => e.stock.exchange === selectedExchange);
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(e =>
        e.stock.ticker.toLowerCase().includes(q) ||
        e.stock.name.toLowerCase().includes(q) ||
        e.stock.sector.toLowerCase().includes(q) ||
        e.stock.industry.toLowerCase().includes(q)
      );
    }

    // Sorting
    list.sort((a, b) => {
      // If filtering by TOP_PICKS_ONLY, sort primarily by user assigned rank
      if (activeFilterTab === 'TOP_PICKS_ONLY') {
        const rankA = rankedPicksMap.get(a.stock.ticker)?.rank ?? 999;
        const rankB = rankedPicksMap.get(b.stock.ticker)?.rank ?? 999;
        if (rankA !== rankB) return rankA - rankB;
      }

      if (sortBy === 'alpha_score') {
        return b.compositeAlphaScore - a.compositeAlphaScore;
      }
      if (sortBy === 'criteria_count') {
        return b.criteriaPassedCount - a.criteriaPassedCount;
      }
      if (sortBy === 'rs_rating') {
        return b.stock.rsRating - a.stock.rsRating;
      }
      if (sortBy === 'pivot_distance') {
        return Math.abs(a.distanceToPivotPercent) - Math.abs(b.distanceToPivotPercent);
      }
      if (sortBy === 'risk_reward') {
        return b.stock.riskRewardRatio - a.stock.riskRewardRatio;
      }
      return 0;
    });

    return list;
  }, [allEvaluations, minCriteriaCount, activeFilterTab, selectedExchange, searchQuery, sortBy, rankedPicksMap]);

  // Statistics
  const qualified3PlusCount = useMemo(() => {
    return allEvaluations.filter(e => e.criteriaPassedCount >= 3).length;
  }, [allEvaluations]);

  const topPickEvaluations = useMemo(() => {
    return allEvaluations
      .filter(e => rankedPicksMap.has(e.stock.ticker))
      .sort((a, b) => {
        const rankA = rankedPicksMap.get(a.stock.ticker)?.rank ?? 999;
        const rankB = rankedPicksMap.get(b.stock.ticker)?.rank ?? 999;
        return rankA - rankB;
      });
  }, [allEvaluations, rankedPicksMap]);

  const avgRsOfTopPicks = useMemo(() => {
    if (topPickEvaluations.length === 0) return 0;
    const sum = topPickEvaluations.reduce((acc, curr) => acc + curr.stock.rsRating, 0);
    return Math.round(sum / topPickEvaluations.length);
  }, [topPickEvaluations]);

  const topConvictionLeader = useMemo(() => {
    if (topPickEvaluations.length > 0) return topPickEvaluations[0].stock;
    const sorted = [...allEvaluations].sort((a, b) => b.compositeAlphaScore - a.compositeAlphaScore);
    return sorted.length > 0 ? sorted[0].stock : null;
  }, [topPickEvaluations, allEvaluations]);

  // 4. Ranking Management Functions
  const handleToggleRankStock = (ticker: string) => {
    const existingIndex = rankedPicks.findIndex(p => p.ticker === ticker);
    if (existingIndex >= 0) {
      // Remove from ranked picks and re-normalize ranks
      const updated = rankedPicks.filter(p => p.ticker !== ticker);
      const reNormalized = updated.map((p, idx) => ({ ...p, rank: idx + 1 }));
      setRankedPicks(reNormalized);
    } else {
      // Add as next rank
      const newRank: DailyRankedPick = {
        ticker,
        rank: rankedPicks.length + 1,
        conviction: 'CONVICTION_A_PLUS',
        action: 'BUY_ON_BREAKOUT',
        notes: 'Priority focus for today session. Order stop-limit at pivot.',
        plannedAllocationPct: 15,
        pinnedDate: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString()
      };
      setRankedPicks([...rankedPicks, newRank]);
    }
  };

  const handleMoveRank = (ticker: string, direction: 'UP' | 'DOWN') => {
    const currentIndex = rankedPicks.findIndex(p => p.ticker === ticker);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'UP' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= rankedPicks.length) return;

    const copy = [...rankedPicks];
    const temp = copy[currentIndex];
    copy[currentIndex] = copy[targetIndex];
    copy[targetIndex] = temp;

    // Re-index ranks 1, 2, 3...
    const normalized = copy.map((p, idx) => ({ ...p, rank: idx + 1 }));
    setRankedPicks(normalized);
  };

  const handleUpdatePickDetails = (ticker: string, updates: Partial<DailyRankedPick>) => {
    setRankedPicks(prev =>
      prev.map(p => {
        if (p.ticker === ticker) {
          return { ...p, ...updates, updatedAt: new Date().toISOString() };
        }
        return p;
      })
    );
  };

  const handleAutoRankAllByAlpha = () => {
    // Take top 5 qualified setups and auto-assign ranks 1..5
    const topCandidates = getDailyQualifiedStocks(stocks, 3).slice(0, 5);
    const newPicks: DailyRankedPick[] = topCandidates.map((evalItem, idx) => ({
      ticker: evalItem.stock.ticker,
      rank: idx + 1,
      conviction: idx === 0 ? 'CONVICTION_A_PLUS' : idx <= 2 ? 'FOCUS_LIST' : 'TACTICAL_CHEAT',
      action: evalItem.stock.vcpStage === 'Active Breakout' ? 'HOLD_FOR_PROFIT' : 'BUY_ON_BREAKOUT',
      notes: `Ranked #${idx + 1} with ${evalItem.criteriaPassedCount}/8 Minervini criteria passed (Alpha Score ${evalItem.compositeAlphaScore}/100).`,
      plannedAllocationPct: idx === 0 ? 20 : idx <= 2 ? 15 : 10,
      pinnedDate: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString()
    }));
    setRankedPicks(newPicks);
  };

  const handleResetRankings = () => {
    if (window.confirm('Are you sure you want to clear all ranked top picks for today?')) {
      setRankedPicks([]);
    }
  };

  const handleCopyReport = async () => {
    const reportText = generateDailyBriefingReport(allEvaluations, rankedPicks, todayFormatted);
    try {
      await navigator.clipboard.writeText(reportText);
      setCopiedReport(true);
      setTimeout(() => setCopiedReport(false), 2500);
    } catch (err) {
      console.error('Failed to copy daily report:', err);
    }
  };

  const getCriteriaIcon = (iconName: string) => {
    switch (iconName) {
      case 'TrendingUp': return <TrendingUp className="w-3 h-3" />;
      case 'Zap': return <Zap className="w-3 h-3" />;
      case 'Activity': return <Activity className="w-3 h-3" />;
      case 'Droplets': return <Droplets className="w-3 h-3" />;
      case 'ShieldCheck': return <ShieldCheck className="w-3 h-3" />;
      case 'Target': return <Target className="w-3 h-3" />;
      case 'BarChart3': return <BarChart3 className="w-3 h-3" />;
      case 'Calendar': return <Calendar className="w-3 h-3" />;
      default: return <CheckCircle2 className="w-3 h-3" />;
    }
  };

  return (
    <div className="space-y-8 font-sans">
      
      {/* 1. TOP HEADER & COMMAND CENTER BANNER */}
      <div className="bg-white border border-[#e5e4e1] p-6 sm:p-8 shadow-xs relative overflow-hidden">
        {/* Subtle decorative watermark */}
        <div className="absolute -right-8 -bottom-10 opacity-[0.03] select-none pointer-events-none font-serif italic text-9xl font-black text-black">
          SEPA
        </div>

        <div className="relative z-10 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#e5e4e1]">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center space-x-1.5 bg-[#1a1a1a] text-white text-[10px] px-2.5 py-0.5 uppercase tracking-[0.2em] font-mono font-bold">
                  <Star className="w-3 h-3 text-amber-400 fill-current" />
                  <span>Daily Morning Routine</span>
                </span>
                <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#b5a68d] font-mono">
                  {todayFormatted}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-serif font-black text-[#1a1a1a] tracking-tight">
                Daily Review & Top Picks Ranking Engine
              </h2>
              <p className="text-xs sm:text-sm font-serif italic text-gray-600 max-w-3xl">
                Automatically screens your watchlist against Mark Minervini's 8 SEPA criteria (Stage 2 Trend, RS Leadership, VCP Compression, Volume Dry-Up, Risk/Reward, Pivot Proximity, Fundamentals, and Earnings Safety) to curate and rank today's highest conviction trade setups.
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={handleAutoRankAllByAlpha}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-mono text-xs font-bold uppercase tracking-wider px-3.5 py-2 flex items-center space-x-1.5 shadow-sm cursor-pointer transition-colors"
                title="Automatically ranks the top 5 highest composite SEPA setups for today"
              >
                <Sparkles className="w-3.5 h-3.5 text-slate-950 fill-current" />
                <span>Auto-Rank Top 5</span>
              </button>

              <button
                onClick={handleCopyReport}
                className="bg-[#f4f2ec] hover:bg-[#eae7df] border border-[#d5d4d0] text-[#1a1a1a] font-mono text-xs font-bold uppercase tracking-wider px-3.5 py-2 flex items-center space-x-1.5 cursor-pointer transition-colors"
                title="Copy formatted Markdown briefing report to clipboard"
              >
                {copiedReport ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Copied Briefing!</span>
                  </>
                ) : (
                  <>
                    <ClipboardCopy className="w-3.5 h-3.5 text-gray-600" />
                    <span>Copy Briefing</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setShowChecklist(!showChecklist)}
                className={`border font-mono text-xs font-bold uppercase tracking-wider px-3.5 py-2 flex items-center space-x-1.5 cursor-pointer transition-colors ${
                  showChecklist
                    ? 'bg-[#1a1a1a] text-white border-black'
                    : 'bg-white border-[#d5d4d0] text-gray-700 hover:bg-gray-100'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5 text-amber-500" />
                <span>{showChecklist ? 'Hide Routine' : 'Morning Routine'}</span>
              </button>
            </div>
          </div>

          {/* Key Daily Review Summary Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
            <div className="bg-[#f9f8f5] border border-[#e5e4e1] p-3.5 space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-gray-500 font-sans block">
                Qualified Setups (3+ Criteria)
              </span>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-black text-emerald-700 font-serif">
                  {qualified3PlusCount}
                </span>
                <span className="text-[10px] text-gray-400 font-mono">/ {stocks.length} Total</span>
              </div>
              <span className="text-[10px] text-emerald-800 font-bold block">
                {Math.round((qualified3PlusCount / Math.max(1, stocks.length)) * 100)}% Pass Minervini Gate
              </span>
            </div>

            <div className="bg-[#f9f8f5] border border-[#e5e4e1] p-3.5 space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-gray-500 font-sans block">
                Active Ranked Top Picks
              </span>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-black text-amber-600 font-serif">
                  {rankedPicks.length}
                </span>
                <span className="text-[10px] text-gray-400 font-mono">Setups</span>
              </div>
              <span className="text-[10px] text-amber-800 font-bold block">
                {rankedPicks.length > 0 ? `Focus Ranked #${1} to #${rankedPicks.length}` : 'None Assigned Yet'}
              </span>
            </div>

            <div className="bg-[#f9f8f5] border border-[#e5e4e1] p-3.5 space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-gray-500 font-sans block">
                Avg RS of Top Picks
              </span>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-black text-[#1a1a1a] font-serif">
                  {avgRsOfTopPicks > 0 ? avgRsOfTopPicks : '96'}
                </span>
                <span className="text-[10px] text-emerald-600 font-bold font-mono">/ 99 RS</span>
              </div>
              <span className="text-[10px] text-gray-500 block">
                Top Decile Market Leadership
              </span>
            </div>

            <div className="bg-[#f9f8f5] border border-[#e5e4e1] p-3.5 space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-gray-500 font-sans block">
                #1 Alpha Pick Today
              </span>
              <div className="flex items-center justify-between">
                <span className="text-xl font-black text-[#1a1a1a] font-serif">
                  {topConvictionLeader?.ticker || 'TRENT'}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300">
                  {topConvictionLeader?.rsRating || 99} RS
                </span>
              </div>
              <span className="text-[10px] text-gray-500 block truncate">
                {topConvictionLeader?.patternType || 'High Tight Flag'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. OPTIONAL EXPANDABLE PRE-MARKET ROUTINE CHECKLIST */}
      <AnimatePresence>
        {showChecklist && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden bg-[#fbfaf8] border border-[#e5e4e1] p-6 shadow-xs space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#e5e4e1]">
              <div className="flex items-center space-x-2">
                <BookOpen className="w-4 h-4 text-amber-600" />
                <h3 className="font-serif font-black text-sm uppercase tracking-wider text-[#1a1a1a]">
                  Mark Minervini's Pre-Market Trading Discipline Checklist
                </h3>
              </div>
              <span className="text-[10px] font-mono text-gray-500 uppercase">
                {Object.values(morningChecklist).filter(Boolean).length} / 6 Steps Completed
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs font-mono">
              {[
                {
                  key: 'marketTrendConfirmed' as const,
                  title: '1. General Market Health',
                  desc: 'Confirm major indexes (S&P 500 / Nifty 50) are holding 21/50 EMAs with no distribution day clusters.'
                },
                {
                  key: 'leadersReviewed' as const,
                  title: '2. Industry Leadership Scan',
                  desc: 'Verify that top focus picks are within top 20% leading industry groups with expanding relative strength.'
                },
                {
                  key: 'stopsAudited' as const,
                  title: '3. Stop Loss Hard Audit',
                  desc: 'Review all existing open positions. Ensure initial and trailing stop loss orders are actively registered.'
                },
                {
                  key: 'pivotOrdersStaged' as const,
                  title: '4. Stage Pivot Buy Limit Orders',
                  desc: 'Pre-calculate exact pivot entry lines and staged stop-limit orders (Pivot to +2% Max Buy Zone).'
                },
                {
                  key: 'positionSizingCalculated' as const,
                  title: '5. Position Size & Risk Budget',
                  desc: 'Calculate exact share quantities so account risk is capped at strictly 0.5% - 1.25% of total capital.'
                },
                {
                  key: 'emotionalMindsetDisciplined' as const,
                  title: '6. Emotional Composure',
                  desc: 'Commit to zero FOMO, no chasing extended stocks > 2% past pivot, and immediate stop loss execution.'
                }
              ].map(item => (
                <label
                  key={item.key}
                  className={`p-3 border cursor-pointer select-none transition-all flex items-start space-x-3 ${
                    morningChecklist[item.key]
                      ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
                      : 'bg-white border-[#e5e4e1] text-gray-700 hover:border-gray-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={morningChecklist[item.key]}
                    onChange={(e) => setMorningChecklist({ ...morningChecklist, [item.key]: e.target.checked })}
                    className="mt-0.5 w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                  />
                  <div className="space-y-0.5">
                    <span className="font-bold text-xs block">{item.title}</span>
                    <p className="font-sans text-[11px] text-gray-600 leading-normal">{item.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. RANKED TOP PICKS PODIUM (IF ANY STOCKS ARE RANKED) */}
      {topPickEvaluations.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[#e5e4e1]">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
              <h3 className="text-lg font-serif font-black text-[#1a1a1a] tracking-tight">
                Today's Ranked Top Picks ({topPickEvaluations.length} Active)
              </h3>
              <span className="text-[10px] font-mono bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 font-bold uppercase">
                Priority Execution Queue
              </span>
            </div>

            <div className="flex items-center space-x-2 text-xs font-mono">
              <button
                onClick={handleResetRankings}
                className="text-rose-700 hover:text-rose-900 text-[11px] font-bold uppercase underline cursor-pointer flex items-center space-x-1"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear All Rankings</span>
              </button>
            </div>
          </div>

          {/* Ranked Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {topPickEvaluations.map((item, idx) => {
              const stock = item.stock;
              const rankInfo = rankedPicksMap.get(stock.ticker)!;
              const currency = getCurrencySymbol(stock.exchange);
              const isFirst = idx === 0;

              return (
                <motion.div
                  key={`ranked-${stock.ticker}`}
                  layout
                  className={`bg-white border p-5 shadow-xs space-y-4 relative transition-all ${
                    isFirst
                      ? 'border-amber-400 ring-2 ring-amber-400/30'
                      : 'border-[#e5e4e1] hover:border-gray-400'
                  }`}
                >
                  {/* Rank Header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <span className={`w-7 h-7 flex items-center justify-center font-mono font-black text-xs rounded-full shadow-xs ${
                        rankInfo.rank === 1
                          ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-300'
                          : rankInfo.rank === 2
                          ? 'bg-slate-300 text-slate-900'
                          : rankInfo.rank === 3
                          ? 'bg-amber-700 text-white'
                          : 'bg-[#1a1a1a] text-white'
                      }`}>
                        #{rankInfo.rank}
                      </span>
                      <div>
                        <h4 className="font-serif font-black text-base text-[#1a1a1a] tracking-tight flex items-center space-x-1.5">
                          <span>{stock.ticker}</span>
                          <span className="text-[10px] font-mono text-gray-500 font-normal">({stock.exchange})</span>
                        </h4>
                        <p className="text-[11px] font-sans text-gray-500 truncate max-w-[170px]">{stock.name}</p>
                      </div>
                    </div>

                    {/* Move Up / Down Buttons */}
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleMoveRank(stock.ticker, 'UP')}
                        disabled={idx === 0}
                        title="Promote Priority Rank"
                        className="p-1 text-gray-400 hover:text-black disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleMoveRank(stock.ticker, 'DOWN')}
                        disabled={idx === topPickEvaluations.length - 1}
                        title="Demote Priority Rank"
                        className="p-1 text-gray-400 hover:text-black disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleRankStock(stock.ticker)}
                        title="Remove from Top Picks"
                        className="p-1 text-rose-400 hover:text-rose-700 cursor-pointer ml-1"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Pricing and Pivot Badges */}
                  <div className="grid grid-cols-2 gap-2 bg-[#f9f8f5] p-2.5 border border-[#e5e4e1] font-mono text-xs">
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-gray-500 block">Current Price</span>
                      <span className="font-bold text-sm text-[#1a1a1a]">
                        {formatCurrency(stock.currentPrice, currency)}
                      </span>
                      <span className={`text-[10px] ml-1 font-bold ${stock.changePercent >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                      </span>
                    </div>

                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-gray-500 block">Pivot Entry</span>
                      <span className="font-bold text-sm text-amber-700">
                        {formatCurrency(stock.pivotPrice, currency)}
                      </span>
                      <span className="text-[10px] text-gray-500 ml-1 font-sans">
                        ({item.distanceToPivotPercent >= 0 ? '+' : ''}{item.distanceToPivotPercent.toFixed(1)}%)
                      </span>
                    </div>
                  </div>

                  {/* Conviction & Action Controls */}
                  <div className="space-y-2 font-mono text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] uppercase text-gray-500 font-bold">Conviction Tier:</span>
                      <select
                        value={rankInfo.conviction}
                        onChange={(e) => handleUpdatePickDetails(stock.ticker, { conviction: e.target.value as ConvictionTier })}
                        className="bg-white border border-[#d5d4d0] px-2 py-0.5 text-[10px] font-bold uppercase focus:outline-none"
                      >
                        <option value="CONVICTION_A_PLUS">⭐ Conviction A+ (Full Size)</option>
                        <option value="FOCUS_LIST">🎯 Focus List (Standard)</option>
                        <option value="TACTICAL_CHEAT">⚡ Tactical 3C (Half Size)</option>
                        <option value="STALKING">⏳ Stalking Pivot</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] uppercase text-gray-500 font-bold">Action Plan:</span>
                      <select
                        value={rankInfo.action}
                        onChange={(e) => handleUpdatePickDetails(stock.ticker, { action: e.target.value as DailyTradeAction })}
                        className="bg-white border border-[#d5d4d0] px-2 py-0.5 text-[10px] font-bold uppercase focus:outline-none"
                      >
                        <option value="BUY_ON_BREAKOUT">🚀 Buy on Breakout (Pivot)</option>
                        <option value="BUY_ON_PULLBACK">📉 Buy on 50MA Pullback</option>
                        <option value="BUY_3C_CHEAT">⚡ Buy 3C Cheat Entry</option>
                        <option value="WAIT_VOLUME_DRYUP">💧 Wait for Vol Dry-Up</option>
                        <option value="HOLD_FOR_PROFIT">🏆 Hold & Trail 20MA</option>
                      </select>
                    </div>

                    {/* Trader notes inline edit */}
                    <div className="pt-1">
                      <input
                        type="text"
                        value={rankInfo.notes}
                        onChange={(e) => handleUpdatePickDetails(stock.ticker, { notes: e.target.value })}
                        placeholder="Add execution note (e.g. stop limit at pivot, trail 20EMA)..."
                        className="w-full text-[11px] font-sans bg-gray-50 border border-[#e5e4e1] px-2.5 py-1 text-gray-800 placeholder-gray-400 focus:outline-none focus:bg-white"
                      />
                    </div>
                  </div>

                  {/* Actions footer */}
                  <div className="flex items-center justify-between pt-2 border-t border-[#e5e4e1] text-xs font-mono">
                    <span className="text-[10px] text-gray-500">
                      Criteria: <strong className="text-emerald-700">{item.criteriaPassedCount}/8 Passed</strong>
                    </span>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => onViewTradePlan(stock)}
                        className="text-[10px] font-bold text-gray-700 hover:text-black uppercase underline cursor-pointer"
                      >
                        Trade Plan
                      </button>
                      <button
                        onClick={() => onViewChart(stock)}
                        className="bg-[#1a1a1a] hover:bg-black text-white text-[10px] font-bold uppercase px-2.5 py-1 flex items-center space-x-1 cursor-pointer"
                      >
                        <span>VCP Chart</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. FILTERING & CONTROLS TOOLBAR */}
      <div className="bg-white border border-[#e5e4e1] p-4 shadow-xs space-y-3 font-mono text-xs">
        {/* Row 1: Minervini Criteria Threshold Buttons + Search */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          
          {/* Criteria Threshold Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase text-gray-500 mr-1 flex items-center space-x-1">
              <SlidersHorizontal className="w-3 h-3 text-amber-600" />
              <span>Minervini Filter:</span>
            </span>

            {[
              { count: 3, label: '3+ Criteria (Default)' },
              { count: 4, label: '4+ Criteria' },
              { count: 5, label: '5+ High Conviction' },
              { count: 7, label: '7+ Pristine Elite' },
              { count: 1, label: 'All Watchlist' }
            ].map(tier => (
              <button
                key={tier.count}
                onClick={() => setMinCriteriaCount(tier.count)}
                className={`px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider border cursor-pointer transition-all ${
                  minCriteriaCount === tier.count
                    ? 'bg-[#1a1a1a] text-white border-black shadow-xs'
                    : 'bg-white text-gray-700 border-[#d5d4d0] hover:bg-gray-100'
                }`}
              >
                {tier.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ticker, company, sector..."
              className="w-full bg-[#fbfaf8] border border-[#d5d4d0] pl-8 pr-3 py-1.5 text-xs text-[#1a1a1a] placeholder-gray-400 focus:outline-none focus:bg-white"
            />
          </div>
        </div>

        {/* Row 2: Secondary View Filters & Sort */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#e5e4e1]">
          {/* Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'ALL_QUALIFIED' as const, label: `Qualified List (${filteredEvaluations.length})` },
              { id: 'TOP_PICKS_ONLY' as const, label: `⭐ Top Picks (${rankedPicks.length})` },
              { id: 'IN_BUY_ZONE' as const, label: '🎯 In Buy Zone (<2%)' },
              { id: 'VOLUME_DRYUP' as const, label: '💧 Extreme Vol Dry-Up' },
              { id: 'ACTIVE_BREAKOUT' as const, label: '🚀 Active Breakouts' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveFilterTab(tab.id)}
                className={`px-2 py-0.5 text-[10px] font-bold uppercase cursor-pointer border ${
                  activeFilterTab === tab.id
                    ? 'bg-amber-500 text-slate-950 border-amber-500'
                    : 'bg-[#f4f2ec] text-gray-600 border-[#d5d4d0] hover:bg-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Sort & Exchange & View Switch */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] text-gray-500 uppercase font-bold">Exchange:</span>
              <select
                value={selectedExchange}
                onChange={(e) => setSelectedExchange(e.target.value)}
                className="bg-white border border-[#d5d4d0] px-2 py-1 text-[10px] font-bold uppercase focus:outline-none"
              >
                <option value="ALL">All Exchanges</option>
                <option value="NSE">NSE (India)</option>
                <option value="BSE">BSE (India)</option>
                <option value="NASDAQ">NASDAQ (US)</option>
                <option value="NYSE">NYSE (US)</option>
              </select>
            </div>

            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] text-gray-500 uppercase font-bold">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-white border border-[#d5d4d0] px-2 py-1 text-[10px] font-bold uppercase focus:outline-none"
              >
                <option value="alpha_score">Highest Alpha Score</option>
                <option value="criteria_count">Most Criteria Passed</option>
                <option value="rs_rating">Highest RS Rating</option>
                <option value="pivot_distance">Closest to Pivot Entry</option>
                <option value="risk_reward">Best Risk/Reward Ratio</option>
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center border border-[#d5d4d0]">
              <button
                onClick={() => setViewMode('CARDS')}
                title="Cards View"
                className={`p-1 cursor-pointer ${viewMode === 'CARDS' ? 'bg-[#1a1a1a] text-white' : 'bg-white text-gray-500 hover:text-black'}`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('TABLE')}
                title="Matrix Table View"
                className={`p-1 cursor-pointer ${viewMode === 'TABLE' ? 'bg-[#1a1a1a] text-white' : 'bg-white text-gray-500 hover:text-black'}`}
              >
                <TableIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 5. QUALIFIED STOCKS LIST / GRID VIEW */}
      {filteredEvaluations.length === 0 ? (
        <div className="bg-white border border-[#e5e4e1] p-12 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
          <h4 className="font-serif font-bold text-lg text-[#1a1a1a]">No Setups Meet Current Filter Threshold</h4>
          <p className="font-sans text-xs text-gray-600 max-w-md mx-auto">
            Try adjusting the Minervini criteria threshold to 3+ or clearing the search query to view all available setups.
          </p>
          <button
            onClick={() => {
              setMinCriteriaCount(3);
              setActiveFilterTab('ALL_QUALIFIED');
              setSearchQuery('');
              setSelectedExchange('ALL');
            }}
            className="bg-[#1a1a1a] text-white px-4 py-2 font-mono text-xs uppercase font-bold tracking-wider cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : viewMode === 'CARDS' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredEvaluations.map((item) => {
            const stock = item.stock;
            const currency = getCurrencySymbol(stock.exchange);
            const isRanked = rankedPicksMap.has(stock.ticker);
            const rankData = rankedPicksMap.get(stock.ticker);

            return (
              <motion.div
                key={stock.ticker}
                layout
                className={`bg-white border p-5 shadow-xs space-y-4 relative transition-all ${
                  isRanked
                    ? 'border-amber-400 bg-gradient-to-b from-amber-50/20 to-white'
                    : item.criteriaPassedCount >= 7
                    ? 'border-emerald-300'
                    : 'border-[#e5e4e1] hover:border-gray-400'
                }`}
              >
                {/* Header: Ticker, Name, Criteria Count, Alpha Score */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-serif font-black text-xl text-[#1a1a1a] tracking-tight">
                        {stock.ticker}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 bg-gray-100 text-gray-700 border border-gray-300 uppercase font-bold">
                        {stock.exchange}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 bg-emerald-100 text-emerald-900 border border-emerald-300 font-black">
                        RS {stock.rsRating}
                      </span>

                      {isRanked && (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-amber-500 text-slate-950 font-mono text-[10px] font-black uppercase tracking-wide">
                          <Star className="w-3 h-3 fill-current" />
                          <span>TOP PICK #{rankData?.rank}</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-sans text-gray-600 font-medium">
                      {stock.name} &bull; <span className="italic text-gray-500">{stock.industry}</span>
                    </p>
                  </div>

                  {/* Alpha Score & Criteria Passed Badges */}
                  <div className="flex items-center space-x-2 text-right">
                    <div className="bg-[#f9f8f5] border border-[#e5e4e1] px-2.5 py-1 text-center font-mono">
                      <span className="text-[8px] uppercase text-gray-500 block">SEPA Criteria</span>
                      <span className={`text-base font-black font-serif ${
                        item.criteriaPassedCount >= 7
                          ? 'text-emerald-700'
                          : item.criteriaPassedCount >= 5
                          ? 'text-amber-700'
                          : 'text-gray-800'
                      }`}>
                        {item.criteriaPassedCount}/8
                      </span>
                    </div>

                    <div className="bg-[#1a1a1a] text-white px-2.5 py-1 text-center font-mono">
                      <span className="text-[8px] uppercase text-amber-400 block font-bold">Alpha Score</span>
                      <span className="text-base font-black font-serif text-white">
                        {item.compositeAlphaScore}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Key Metrics Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#f9f8f5] p-2.5 border border-[#e5e4e1] font-mono text-xs">
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-gray-500 block">Current Price</span>
                    <span className="font-bold text-[#1a1a1a]">
                      {formatCurrency(stock.currentPrice, currency)}
                    </span>
                    <span className={`text-[10px] ml-1 font-bold ${stock.changePercent >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-gray-500 block">Pivot Entry</span>
                    <span className="font-bold text-amber-700">
                      {formatCurrency(stock.pivotPrice, currency)}
                    </span>
                    <span className="text-[9px] text-gray-500 block truncate font-sans">
                      {item.distanceToPivotPercent >= 0 ? '+' : ''}{item.distanceToPivotPercent.toFixed(1)}% to entry
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-gray-500 block">Stop Loss (Risk)</span>
                    <span className="font-bold text-rose-700">
                      {formatCurrency(stock.stopLossPrice, currency)}
                    </span>
                    <span className="text-[9px] text-rose-600 block">
                      -{Math.abs(stock.stopLossPercent).toFixed(1)}% (Hard Stop)
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-gray-500 block">Target 1 (R/R)</span>
                    <span className="font-bold text-emerald-700">
                      {formatCurrency(stock.target1Price, currency)}
                    </span>
                    <span className="text-[9px] text-emerald-800 font-bold block">
                      {stock.riskRewardRatio.toFixed(2)}:1 Payoff
                    </span>
                  </div>
                </div>

                {/* Minervini 8-Criteria Pass/Fail Badges Matrix */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-mono font-bold text-gray-600 uppercase">
                    <span>Minervini Criteria Evaluation ({item.criteriaPassedCount} Passed):</span>
                    <button
                      onClick={() => setInspectedStock(item)}
                      className="text-amber-800 hover:text-black underline cursor-pointer"
                    >
                      Inspect Rules & Conditionals &rarr;
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 font-mono text-[10px]">
                    {item.criteriaList.map((crit) => (
                      <div
                        key={crit.id}
                        title={`${crit.name}: ${crit.passed ? 'PASSED' : 'FAILED'} — ${crit.actualValueStr} (${crit.thresholdStr})`}
                        className={`px-2 py-1 border flex items-center space-x-1.5 truncate cursor-help ${
                          crit.passed
                            ? 'bg-emerald-50 text-emerald-950 border-emerald-200'
                            : 'bg-rose-50/50 text-rose-800 border-rose-200 opacity-65'
                        }`}
                      >
                        {crit.passed ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                        ) : (
                          <XCircle className="w-3 h-3 text-rose-500 shrink-0" />
                        )}
                        <span className="truncate font-medium">{crit.shortLabel}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pattern & Dry-up Takeaway */}
                <p className="text-[11px] font-sans text-gray-600 leading-normal italic border-l-2 border-amber-400 pl-2">
                  &ldquo;{stock.sepaNotes}&rdquo;
                </p>

                {/* Actions Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#e5e4e1] font-mono text-xs">
                  {/* Toggle Rank Button */}
                  <button
                    onClick={() => handleToggleRankStock(stock.ticker)}
                    className={`px-3 py-1.5 font-bold uppercase tracking-wider flex items-center space-x-1.5 cursor-pointer transition-all ${
                      isRanked
                        ? 'bg-amber-500 text-slate-950 border border-amber-500 shadow-xs'
                        : 'bg-white hover:bg-gray-100 text-gray-800 border border-[#d5d4d0]'
                    }`}
                  >
                    <Star className={`w-3.5 h-3.5 ${isRanked ? 'fill-current text-slate-950' : 'text-amber-500'}`} />
                    <span>{isRanked ? `Ranked #${rankData?.rank}` : 'Rank as Top Pick'}</span>
                  </button>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => onViewTradePlan(stock)}
                      className="px-2.5 py-1 text-gray-700 hover:text-black border border-[#d5d4d0] hover:bg-gray-50 uppercase text-[11px] font-bold cursor-pointer"
                    >
                      Trade Plan
                    </button>

                    <button
                      onClick={() => onViewChart(stock)}
                      className="bg-[#1a1a1a] hover:bg-black text-white px-3 py-1 text-[11px] font-bold uppercase flex items-center space-x-1 cursor-pointer"
                    >
                      <span>VCP Chart</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-white border border-[#e5e4e1] overflow-x-auto shadow-xs">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-[#f9f8f5] border-b border-[#e5e4e1] text-[10px] font-bold uppercase tracking-wider text-gray-600">
              <tr>
                <th className="py-3 px-4">Rank / Ticker</th>
                <th className="py-3 px-4">Company & Sector</th>
                <th className="py-3 px-4">RS Rating</th>
                <th className="py-3 px-4">SEPA Criteria</th>
                <th className="py-3 px-4">Alpha Score</th>
                <th className="py-3 px-4">Current Price</th>
                <th className="py-3 px-4">Pivot Entry</th>
                <th className="py-3 px-4">Stop Loss</th>
                <th className="py-3 px-4">R/R Ratio</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e4e1]">
              {filteredEvaluations.map((item) => {
                const stock = item.stock;
                const isRanked = rankedPicksMap.has(stock.ticker);
                const rankData = rankedPicksMap.get(stock.ticker);
                const currency = getCurrencySymbol(stock.exchange);

                return (
                  <tr key={stock.ticker} className="hover:bg-[#fcfbf9] transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        {isRanked ? (
                          <span className="w-5 h-5 flex items-center justify-center rounded-full bg-amber-500 text-slate-950 font-black text-[10px]">
                            {rankData?.rank}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-[10px]">-</span>
                        )}
                        <span className="font-bold text-sm text-[#1a1a1a] font-serif">{stock.ticker}</span>
                        <span className="text-[9px] px-1 bg-gray-100 text-gray-600 border border-gray-300 font-bold">
                          {stock.exchange}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="max-w-[180px]">
                        <span className="font-sans font-medium text-xs text-gray-900 block truncate">{stock.name}</span>
                        <span className="text-[10px] text-gray-500 block truncate">{stock.sector}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 border border-emerald-200">
                        {stock.rsRating}
                      </span>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`font-bold px-2 py-0.5 border ${
                        item.criteriaPassedCount >= 7
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          : 'bg-amber-50 text-amber-900 border-amber-200'
                      }`}>
                        {item.criteriaPassedCount} / 8 Rules
                      </span>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-black text-slate-950 bg-amber-400 px-2 py-0.5">
                        {item.compositeAlphaScore}/100
                      </span>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-bold">{formatCurrency(stock.currentPrice, currency)}</span>
                      <span className={`text-[10px] ml-1 ${stock.changePercent >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                      </span>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-bold text-amber-800">{formatCurrency(stock.pivotPrice, currency)}</span>
                      <span className="text-[9px] text-gray-500 block">
                        {item.distanceToPivotPercent >= 0 ? '+' : ''}{item.distanceToPivotPercent.toFixed(1)}%
                      </span>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-bold text-rose-700">{formatCurrency(stock.stopLossPrice, currency)}</span>
                      <span className="text-[9px] text-rose-600 block">-{Math.abs(stock.stopLossPercent).toFixed(1)}%</span>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap font-bold text-emerald-700">
                      {stock.riskRewardRatio.toFixed(2)}:1
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap text-right space-x-2">
                      <button
                        onClick={() => handleToggleRankStock(stock.ticker)}
                        className={`px-2 py-1 text-[10px] font-bold uppercase cursor-pointer border ${
                          isRanked
                            ? 'bg-amber-500 text-slate-950 border-amber-500'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                        }`}
                      >
                        {isRanked ? `Rank #${rankData?.rank}` : 'Rank'}
                      </button>

                      <button
                        onClick={() => onViewChart(stock)}
                        className="bg-[#1a1a1a] hover:bg-black text-white px-2 py-1 text-[10px] font-bold uppercase cursor-pointer"
                      >
                        Chart
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 6. DETAILED MINERVINI CRITERIA INSPECTION MODAL */}
      <AnimatePresence>
        {inspectedStock && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-[#e5e4e1] shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto font-sans p-6 sm:p-8 space-y-6"
            >
              <div className="flex items-start justify-between pb-4 border-b border-[#e5e4e1]">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-serif font-black text-2xl text-[#1a1a1a]">
                      {inspectedStock.stock.ticker}
                    </span>
                    <span className="text-xs font-mono bg-gray-100 text-gray-700 px-2 py-0.5 border border-gray-300 font-bold">
                      {inspectedStock.stock.exchange}
                    </span>
                    <span className="text-xs font-mono bg-emerald-100 text-emerald-900 px-2 py-0.5 border border-emerald-300 font-black">
                      RS {inspectedStock.stock.rsRating}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{inspectedStock.stock.name}</p>
                </div>

                <button
                  onClick={() => setInspectedStock(null)}
                  className="p-1 text-gray-400 hover:text-black cursor-pointer"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              {/* Score breakdown banner */}
              <div className="bg-[#f9f8f5] border border-[#e5e4e1] p-4 flex items-center justify-between font-mono text-xs">
                <div>
                  <span className="text-[10px] text-gray-500 uppercase block font-sans">Minervini SEPA Compliance</span>
                  <span className="text-xl font-serif font-black text-emerald-800">
                    {inspectedStock.criteriaPassedCount} of 8 Core Pillars Passed
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-gray-500 uppercase block font-sans">Composite Alpha Score</span>
                  <span className="text-2xl font-serif font-black text-[#1a1a1a]">
                    {inspectedStock.compositeAlphaScore} / 100
                  </span>
                </div>
              </div>

              {/* 8 Rules List */}
              <div className="space-y-3 font-mono text-xs">
                <h4 className="font-serif font-bold text-sm text-[#1a1a1a] uppercase tracking-wider">
                  Full 8-Point Criteria Breakdown
                </h4>

                <div className="space-y-2.5">
                  {inspectedStock.criteriaList.map((crit, idx) => (
                    <div
                      key={crit.id}
                      className={`p-3 border space-y-1 ${
                        crit.passed
                          ? 'bg-emerald-50/60 border-emerald-300'
                          : 'bg-rose-50/40 border-rose-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 font-bold">
                          {crit.passed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          )}
                          <span className={crit.passed ? 'text-emerald-950' : 'text-rose-950'}>
                            {idx + 1}. {crit.name}
                          </span>
                        </div>

                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 border ${
                          crit.passed
                            ? 'bg-emerald-200 text-emerald-900 border-emerald-400'
                            : 'bg-rose-200 text-rose-900 border-rose-400'
                        }`}>
                          {crit.passed ? 'PASSED' : 'FAILED'}
                        </span>
                      </div>

                      <p className="font-sans text-[11px] text-gray-600 leading-normal pl-6">
                        {crit.description}
                      </p>

                      <div className="pl-6 pt-1 text-[10px] flex flex-wrap items-center gap-x-4 text-gray-700">
                        <span><strong>Actual Value:</strong> {crit.actualValueStr}</span>
                        <span><strong>Required Threshold:</strong> {crit.thresholdStr}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-[#e5e4e1] font-mono text-xs">
                <button
                  onClick={() => handleToggleRankStock(inspectedStock.stock.ticker)}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold uppercase px-4 py-2 flex items-center space-x-1.5 cursor-pointer"
                >
                  <Star className="w-4 h-4 fill-current" />
                  <span>
                    {rankedPicksMap.has(inspectedStock.stock.ticker) ? 'Remove from Top Picks' : 'Rank as Top Pick'}
                  </span>
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      onViewChart(inspectedStock.stock);
                      setInspectedStock(null);
                    }}
                    className="bg-[#1a1a1a] text-white hover:bg-black font-bold uppercase px-4 py-2 cursor-pointer"
                  >
                    Open VCP Chart
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
