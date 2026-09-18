import React, { useState, useEffect } from 'react';
import {
  X,
  Brain,
  Sparkles,
  Cloud,
  CheckCircle2,
  AlertCircle,
  Tag,
  Bookmark,
  ShieldCheck,
  Target,
  Layers,
  ArrowRight,
  Zap,
  Info,
  ExternalLink,
  ChevronDown,
  Bell,
  BellRing,
  Sliders,
  Gauge,
  TrendingUp,
  ShieldAlert,
  Volume2,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MinerviniTradeSetup,
  SecondBrainNote,
  SecondBrainCategory,
  SepaRatingTier,
  PriceAlert
} from '../types';
import { useAuth } from '../context/AuthContext';
import { saveSecondBrainNoteToCloud } from '../lib/firestoreService';
import { getSecondBrainNotes, saveSecondBrainNotes } from '../utils/secondBrainStorage';
import { getStoredAlerts, saveStoredAlerts } from '../utils/backgroundPriceChecker';
import { formatCurrency, getCurrencySymbol } from '../utils/sepaCalculator';

interface QuickInsightModalProps {
  isOpen: boolean;
  onClose: () => void;
  stock?: MinerviniTradeSetup;
  isObsidian?: boolean;
  onSavedNote?: (note: SecondBrainNote) => void;
  onOpenSecondBrainTab?: () => void;
}

const POPULAR_SEPA_TAGS = [
  '#vcp',
  '#pivot-breakout',
  '#pocket-pivot',
  '#stage2-trend',
  '#risk-management',
  '#volume-dry-up',
  '#high-tight-flag',
  '#cup-and-handle',
  '#earnings-catalyst',
  '#relative-strength',
  '#progressive-exposure',
  '#cheat-entry'
];

const TEMPLATES: Record<string, string> = {
  'VCP Setup': `## 🎯 Setup Thesis & Execution
- **Pattern**: Volatility Contraction Pattern (VCP) with constructive contracting swings.
- **Stage**: Confirmed Stage 2 Trend Template. 50 SMA > 150 SMA > 200 SMA.
- **Volume**: Supply drying up significantly on final pullback.
- **Execution**:
  - Pivot Buy Point: $
  - Max Stop Loss: $ (-%)
  - Initial Profit Target: $ (+%)

> [!quote] Minervini Rule
> Buy on the breakout through the pivot point on at least 50% above average daily volume.`,

  'Pocket Pivot': `## ⚡ Pocket Pivot Entry Thesis
- **Trigger**: High-volume up-day greater than the highest down-volume bar of the past 10 days.
- **Support**: Bouncing directly off 10-day EMA or 50-day SMA inside a constructive base.
- **Stop Loss**: Low of the pocket pivot bar or 10 EMA.
- **Risk Ratio**: Asymmetric risk-reward > 3:1.`,

  'Risk Protocol': `## 🛡️ Risk Discipline & Sizing
- **Portfolio Sizing**: Maximum 1.0% account risk.
- **Stop Level**: Strict trailing stop below recent swing low.
- **Progressive Exposure**: Add 25% only if trade moves +3% in profit without violation.
- **Invalidation**: Cut immediately if stock closes below key moving average on heavy volume.`,

  'Post-Mortem': `## 📦 Trade Review & Lesson
- **Setup Type**:
- **Outcome**:
- **What Worked**: Followed SEPA entry criteria with proper volume dry-up.
- **Rule Violation / Improvement**:
- **Key Takeaway**: Preserving mental and financial capital is always priority #1.`
};

export const QuickInsightModal: React.FC<QuickInsightModalProps> = ({
  isOpen,
  onClose,
  stock,
  isObsidian = true,
  onSavedNote,
  onOpenSecondBrainTab
}) => {
  const { user, signIn } = useAuth();

  const [category, setCategory] = useState<SecondBrainCategory>('PROJECTS');
  const [ticker, setTicker] = useState<string>(stock?.ticker || '');
  const [title, setTitle] = useState<string>('');
  const [patternType, setPatternType] = useState<string>(stock?.patternType || 'VCP (3 Contractions)');
  const [sepaRating, setSepaRating] = useState<SepaRatingTier>(stock?.isMinerviniBuy ? 'ELITE' : 'LEADER');
  const [tags, setTags] = useState<string[]>(['#second-brain']);
  const [tagInput, setTagInput] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [isPinned, setIsPinned] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Price Threshold & Sensitivity Slider States
  const currentPrice = stock?.currentPrice || (stock as any)?.price || 100;
  const [targetPrice, setTargetPrice] = useState<number>(stock?.pivotPrice || currentPrice * 1.03);
  const [stopLossPrice, setStopLossPrice] = useState<number>(stock?.stopLossPrice || currentPrice * 0.95);
  const [targetProfitPrice, setTargetProfitPrice] = useState<number>(stock?.target1Price || currentPrice * 1.20);
  const [sensitivityPct, setSensitivityPct] = useState<number>(1.5);
  const [triggerMode, setTriggerMode] = useState<'SOFT' | 'HARD'>('SOFT');
  const [registerActiveAlert, setRegisterActiveAlert] = useState<boolean>(true);
  const [isAlertSectionExpanded, setIsAlertSectionExpanded] = useState<boolean>(true);

  // Auto-fill defaults when stock prop changes or modal opens
  useEffect(() => {
    if (isOpen) {
      const activeTicker = stock?.ticker || '';
      setTicker(activeTicker);
      const curr = stock?.currentPrice || (stock as any)?.price || 100;
      const piv = stock?.pivotPrice || Number((curr * 1.03).toFixed(2));
      const stp = stock?.stopLossPrice || Number((curr * 0.95).toFixed(2));
      const tgt = stock?.target1Price || Number((curr * 1.20).toFixed(2));
      setTargetPrice(piv);
      setStopLossPrice(stp);
      setTargetProfitPrice(tgt);
      setSensitivityPct(1.5);
      setTriggerMode('SOFT');
      setRegisterActiveAlert(true);

      if (stock) {
        setTitle(`${stock.ticker} — ${stock.name || (stock as any).companyName || 'Growth Setup'} (${stock.patternType || 'VCP Setup'})`);
        setPatternType(stock.patternType || 'VCP (3 Contractions)');
        setSepaRating(stock.trendScore >= 8 ? 'ELITE' : stock.trendScore >= 6 ? 'LEADER' : 'SPECULATIVE');

        const initialTags = ['#second-brain', `#${stock.ticker.toLowerCase()}`];
        if (stock.patternType) initialTags.push(`#${stock.patternType.toLowerCase().replace(/[^a-z0-9]/g, '-')}`);
        if (stock.sector) initialTags.push(`#${stock.sector.toLowerCase().replace(/[^a-z0-9]/g, '-')}`);
        setTags(Array.from(new Set(initialTags)));

        setContent(`## 🎯 ${stock.ticker} SEPA Setup Thesis
- **Company**: ${stock.name || (stock as any).companyName || stock.ticker} (${stock.sector || 'Growth'})
- **Current Price**: $${curr.toFixed(2)}
- **Pattern**: ${stock.patternType || 'VCP'}
- **Trend Score**: ${stock.trendScore || 7}/8 Criteria Passing
- **Volume Dry-Up**: ${stock.volumeDryUpPercent || -48}% below 20-day average
- **Pivot Buy Level**: $${piv.toFixed(2)}
- **Initial Stop Loss**: $${stp.toFixed(2)} (${(((stp - curr) / curr) * 100).toFixed(1)}%)
- **Target 1**: $${tgt.toFixed(2)} (+${(((tgt - curr) / curr) * 100).toFixed(1)}%)

### 🔔 Price Trigger & Sensitivity Specification
- **Trigger Type**: Soft Proximity Alert (±1.5% sensitivity window)
- **Execution Threshold**: $${piv.toFixed(2)}

### 📝 Strategic Trading Notes
- Consolidation is tightening with decreasing volatility.
- Watch for volume expansion > 50% on pivot breakout day.

**Wikilinks**: [[${stock.ticker}]] • [[Trend Template]] • [[${stock.patternType || 'VCP'}]] • [[Risk Management]]`);
      } else {
        setTitle('Market Breadth & SEPA Campaign Analysis');
        setContent(TEMPLATES['VCP Setup']);
        setTags(['#second-brain', '#market-study']);
      }
      setSavedSuccess(false);
      setStatusMessage(null);
    }
  }, [isOpen, stock]);

  if (!isOpen) return null;

  const handleSensitivityChange = (val: number) => {
    setSensitivityPct(val);
    if (val <= 0.5) {
      setTriggerMode('HARD');
    } else {
      setTriggerMode('SOFT');
    }
  };

  const handleAddTag = (newTag: string) => {
    let clean = newTag.trim();
    if (!clean) return;
    if (!clean.startsWith('#')) clean = '#' + clean;
    clean = clean.toLowerCase();
    if (!tags.includes(clean)) {
      setTags([...tags, clean]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleApplyTemplate = (templateName: string) => {
    if (TEMPLATES[templateName]) {
      setContent(TEMPLATES[templateName]);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setStatusMessage('Please provide a title for this insight.');
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);

    const now = new Date().toISOString();
    const noteId = `note-${Date.now()}`;

    // Extract wikilinks from content [[Concept]]
    const wikilinkMatches = content.match(/\[\[(.*?)\]\]/g) || [];
    const extractedWikilinks: string[] = Array.from(new Set<string>(wikilinkMatches));
    if (ticker && !extractedWikilinks.includes(`[[${ticker.toUpperCase()}]]`)) {
      extractedWikilinks.unshift(`[[${ticker.toUpperCase()}]]`);
    }

    const newNote: SecondBrainNote = {
      id: noteId,
      title: title.trim(),
      category,
      ticker: ticker ? ticker.toUpperCase() : undefined,
      patternType: patternType || undefined,
      tags: tags.length > 0 ? tags : ['#second-brain'],
      content: content.trim(),
      createdAt: now,
      updatedAt: now,
      sourceType: 'SCREENER',
      isPinned,
      sepaRating,
      wikilinks: extractedWikilinks
    };

    try {
      // 1. Always update local storage first so offline/guest access works instantaneously
      const existing = getSecondBrainNotes();
      const updatedNotes = [newNote, ...existing];
      saveSecondBrainNotes(updatedNotes);

      // 2. If user is logged into Firebase, save to Firestore-backed vault!
      if (user) {
        await saveSecondBrainNoteToCloud(user.uid, newNote);
        setStatusMessage('Saved to Firestore Cloud Vault & Synced!');
      } else {
        setStatusMessage('Saved locally in Second Brain. Sign in anytime to sync to Cloud!');
      }

      // 3. If registerActiveAlert is selected, register in background price radar
      if (registerActiveAlert && ticker) {
        try {
          const effectiveTicker = ticker.trim().toUpperCase();
          const newAlert: PriceAlert = {
            id: `alert-insight-${effectiveTicker}-${Date.now()}`,
            ticker: effectiveTicker,
            stockName: stock?.name || title,
            targetType: 'PIVOT_ENTRY',
            targetPrice: Number(targetPrice),
            triggerProximityPercent: Number(sensitivityPct),
            currentPrice: Number(currentPrice),
            status: 'ACTIVE',
            createdAt: new Date().toLocaleDateString(),
            exchange: stock?.exchange || 'NASDAQ',
            notes: `${triggerMode === 'HARD' ? '🎯 Hard Price Trigger' : '⚡ Soft Price Proximity Alert'} (±${sensitivityPct}% sensitivity). Stop @ $${Number(stopLossPrice).toFixed(2)}, Target @ $${Number(targetProfitPrice).toFixed(2)}.`,
          };
          const existingAlerts = getStoredAlerts();
          const filtered = existingAlerts.filter(a => !(a.ticker === newAlert.ticker && a.targetType === 'PIVOT_ENTRY'));
          saveStoredAlerts([newAlert, ...filtered]);
          window.dispatchEvent(new Event('minervini_alerts_updated'));
        } catch (alertErr) {
          console.warn('Failed to register active price alert:', alertErr);
        }
      }

      setSavedSuccess(true);
      if (onSavedNote) {
        onSavedNote(newNote);
      }
    } catch (err: any) {
      console.error('Failed to save insight to Firestore:', err);
      setStatusMessage('Saved to local vault. Firestore sync encountered an issue.');
      setSavedSuccess(true);
      if (onSavedNote) onSavedNote(newNote);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      id="quick-insight-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.2 }}
        className={`w-full max-w-2xl rounded-xl border shadow-2xl overflow-hidden font-sans ${
          isObsidian
            ? 'bg-[#131722] border-amber-500/30 text-gray-100'
            : 'bg-white border-gray-300 text-gray-900'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-5 py-4 border-b ${
            isObsidian ? 'border-white/10 bg-[#181f2c]' : 'border-gray-200 bg-gray-50'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Brain className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold tracking-tight">Tag & Save Trading Insight</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  P.A.R.A VAULT
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Capture tactical SEPA theses, entry triggers, and rules to your Firestore vault
              </p>
            </div>
          </div>

          <button
            id="close-quick-insight-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Cloud Sync Status Banner */}
          <div
            className={`p-3 rounded-lg border text-xs font-mono flex items-center justify-between ${
              user
                ? isObsidian
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : isObsidian
                ? 'bg-amber-950/40 border-amber-500/30 text-amber-300'
                : 'bg-amber-50 border-amber-300 text-amber-800'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Cloud className="w-4 h-4 shrink-0" />
              <span>
                {user ? (
                  <>
                    <strong className="font-bold">Firestore Vault Active:</strong> Auto-syncing across Chrome extension & devices for{' '}
                    <span className="underline">{user.email}</span>
                  </>
                ) : (
                  <>
                    <strong className="font-bold">Guest Mode:</strong> Stored locally. Sign in with Google to sync to cloud & Chrome extension.
                  </>
                )}
              </span>
            </div>

            {!user && (
              <button
                onClick={() => signIn()}
                className="ml-2 px-2.5 py-1 rounded bg-amber-500 text-slate-950 font-bold text-[11px] hover:bg-amber-400 active:scale-95 transition-all shrink-0 cursor-pointer"
              >
                Sign In
              </button>
            )}
          </div>

          {/* Category P.A.R.A Tabs */}
          <div>
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-gray-400 mb-2">
              P.A.R.A Taxonomy Category
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
              {(
                [
                  { id: 'PROJECTS', label: 'Projects', desc: 'Active Setups' },
                  { id: 'AREAS', label: 'Areas', desc: 'Risk Disciplines' },
                  { id: 'RESOURCES', label: 'Resources', desc: 'Knowledge Base' },
                  { id: 'ARCHIVES', label: 'Archives', desc: 'Post-Mortem' }
                ] as const
              ).map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                    category === cat.id
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-sm'
                      : isObsidian
                      ? 'bg-[#181f2c] border-white/10 text-gray-300 hover:border-white/20'
                      : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="font-bold">{cat.label}</div>
                  <div className="text-[10px] text-gray-400 truncate">{cat.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Title & Ticker Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                Note Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. NVDA — High Tight Flag with Volume Dry-Up"
                className={`w-full px-3 py-2 rounded-lg border text-sm font-medium focus:outline-none focus:ring-1 focus:ring-amber-400 ${
                  isObsidian
                    ? 'bg-[#181f2c] border-white/10 text-gray-100 placeholder-gray-500'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                Stock Ticker
              </label>
              <input
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder="e.g. NVDA"
                className={`w-full px-3 py-2 rounded-lg border text-sm font-mono font-bold uppercase focus:outline-none focus:ring-1 focus:ring-amber-400 ${
                  isObsidian
                    ? 'bg-[#181f2c] border-white/10 text-amber-400 placeholder-gray-500'
                    : 'bg-white border-gray-300 text-amber-600 placeholder-gray-400'
                }`}
              />
            </div>
          </div>

          {/* Price-Level Alert Radar & Sensitivity Slider Panel */}
          <div className={`p-4 rounded-xl border transition-all ${
            isObsidian ? 'bg-[#181f2c]/80 border-amber-500/30 shadow-inner' : 'bg-amber-50/50 border-amber-200 shadow-xs'
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-amber-500/20">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-md bg-amber-500/20 text-amber-400">
                  <BellRing className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold font-mono uppercase tracking-wider text-amber-400">
                      Price Trigger Radar & Sensitivity
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                      triggerMode === 'HARD'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}>
                      {triggerMode === 'HARD' ? 'HARD TRIGGER' : `SOFT RADAR (±${sensitivityPct.toFixed(1)}%)`}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    Live proximity monitoring with background audio chime & radar log
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAlertSectionExpanded(!isAlertSectionExpanded)}
                className="text-xs font-mono text-gray-400 hover:text-amber-400 transition-colors p-1"
                title="Toggle Alert Parameters"
              >
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isAlertSectionExpanded ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {isAlertSectionExpanded && (
              <div className="mt-4 space-y-4">
                {/* Visual Price Continuum Scale */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[10px] font-mono text-gray-400">
                    <span className="text-rose-400 font-bold">Stop: ${Number(stopLossPrice).toFixed(2)}</span>
                    <span className="text-blue-400 font-bold">Current: ${Number(currentPrice).toFixed(2)}</span>
                    <span className="text-amber-400 font-bold">Target Pivot: ${Number(targetPrice).toFixed(2)}</span>
                    <span className="text-emerald-400 font-bold">Profit: ${Number(targetProfitPrice).toFixed(2)}</span>
                  </div>

                  <div className="relative w-full h-7 bg-slate-900/90 rounded-lg p-1 border border-slate-700/60 overflow-hidden flex items-center">
                    {/* Stop Loss Zone */}
                    <div className="h-full bg-rose-950/70 border-r border-rose-500/50 flex items-center justify-start px-2 text-[9px] font-mono text-rose-400 font-bold w-[22%]">
                      STOP
                    </div>

                    {/* Channel between Stop and Target */}
                    <div className="relative h-full flex-1 bg-slate-800/40 flex items-center justify-center">
                      {/* Sensitivity Band around Pivot */}
                      <div
                        className="absolute right-0 h-full bg-amber-500/25 border-l border-r border-amber-400/60 transition-all"
                        style={{ width: `${Math.min(Math.max(sensitivityPct * 6, 12), 48)}%` }}
                        title={`Proximity Trigger Buffer: ±${sensitivityPct}% around $${Number(targetPrice).toFixed(2)}`}
                      />

                      {/* Current Price Marker */}
                      <div className="absolute left-[38%] flex flex-col items-center z-10">
                        <div className="w-2.5 h-2.5 rounded-full bg-sky-400 ring-2 ring-sky-200 shadow-md animate-pulse" />
                      </div>
                    </div>

                    {/* Target Profit Zone */}
                    <div className="h-full bg-emerald-950/70 border-l border-emerald-500/50 flex items-center justify-end px-2 text-[9px] font-mono text-emerald-400 font-bold w-[25%]">
                      TARGET
                    </div>
                  </div>

                  <div className="flex justify-between text-[9px] font-mono text-gray-500">
                    <span>Risk Containment</span>
                    <span className="text-amber-300">
                      Window: ${(Number(targetPrice) * (1 - sensitivityPct / 100)).toFixed(2)} — ${(Number(targetPrice) * (1 + sensitivityPct / 100)).toFixed(2)}
                    </span>
                    <span>Reward Expansion</span>
                  </div>
                </div>

                {/* Price Input Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-mono font-bold uppercase text-amber-400 mb-1">
                      Pivot Trigger Price ($)
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      value={targetPrice}
                      onChange={(e) => setTargetPrice(parseFloat(e.target.value) || 0)}
                      className={`w-full px-3 py-1.5 rounded-lg border text-xs font-mono font-bold ${
                        isObsidian ? 'bg-[#0f1218] border-amber-500/40 text-amber-300' : 'bg-white border-amber-300 text-amber-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono font-bold uppercase text-rose-400 mb-1">
                      Hard Stop Loss ($)
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      value={stopLossPrice}
                      onChange={(e) => setStopLossPrice(parseFloat(e.target.value) || 0)}
                      className={`w-full px-3 py-1.5 rounded-lg border text-xs font-mono font-bold ${
                        isObsidian ? 'bg-[#0f1218] border-rose-500/40 text-rose-300' : 'bg-white border-rose-300 text-rose-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono font-bold uppercase text-emerald-400 mb-1">
                      Target Profit 1 ($)
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      value={targetProfitPrice}
                      onChange={(e) => setTargetProfitPrice(parseFloat(e.target.value) || 0)}
                      className={`w-full px-3 py-1.5 rounded-lg border text-xs font-mono font-bold ${
                        isObsidian ? 'bg-[#0f1218] border-emerald-500/40 text-emerald-300' : 'bg-white border-emerald-300 text-emerald-900'
                      }`}
                    />
                  </div>
                </div>

                {/* Sensitivity Slider */}
                <div className="space-y-2 pt-2 border-t border-amber-500/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5">
                      <Sliders className="w-3.5 h-3.5 text-amber-400" />
                      <label className="text-xs font-mono font-bold uppercase tracking-wider text-gray-300">
                        Proximity Sensitivity Range
                      </label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => handleSensitivityChange(0.2)}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase transition-all ${
                          triggerMode === 'HARD'
                            ? 'bg-rose-500 text-black'
                            : 'bg-white/10 text-gray-400 hover:text-white'
                        }`}
                      >
                        Hard (0.2%)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSensitivityChange(1.5)}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase transition-all ${
                          triggerMode === 'SOFT' && sensitivityPct === 1.5
                            ? 'bg-amber-400 text-black'
                            : 'bg-white/10 text-gray-400 hover:text-white'
                        }`}
                      >
                        Standard (1.5%)
                      </button>
                      <span className="text-xs font-mono font-bold text-amber-300 px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/30">
                        ±{sensitivityPct.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <input
                    type="range"
                    min="0.1"
                    max="5.0"
                    step="0.1"
                    value={sensitivityPct}
                    onChange={(e) => handleSensitivityChange(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
                  />

                  <div className="flex justify-between text-[10px] font-mono text-gray-400">
                    <span>0.1% (Hard Breakout Touch)</span>
                    <span className="text-gray-300 font-semibold">
                      {triggerMode === 'HARD' ? '🎯 Hard Price Trigger' : '⚡ Proximity Warning Zone'}
                    </span>
                    <span>5.0% (Early Base Radar)</span>
                  </div>
                </div>

                {/* Auto-register background alert checkbox */}
                <label className="flex items-center space-x-2 pt-1 cursor-pointer select-none text-xs font-mono">
                  <input
                    type="checkbox"
                    checked={registerActiveAlert}
                    onChange={(e) => setRegisterActiveAlert(e.target.checked)}
                    className="rounded border-gray-300 text-amber-500 focus:ring-amber-400"
                  />
                  <span className="text-gray-200">
                    Auto-register in <strong className="text-amber-300">Background Price Radar</strong> (Triggers notification &amp; chime on breakout)
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* Pattern & SEPA Rating */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                Pattern / Setup Type
              </label>
              <select
                value={patternType}
                onChange={(e) => setPatternType(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border text-sm font-mono focus:outline-none focus:ring-1 focus:ring-amber-400 ${
                  isObsidian
                    ? 'bg-[#181f2c] border-white/10 text-gray-200'
                    : 'bg-white border-gray-300 text-gray-800'
                }`}
              >
                <option value="VCP (3 Contractions)">VCP (3 Contractions)</option>
                <option value="VCP (4 Contractions)">VCP (4 Contractions)</option>
                <option value="Cup and Handle">Cup and Handle</option>
                <option value="High Tight Flag">High Tight Flag</option>
                <option value="Double Bottom with Handle">Double Bottom with Handle</option>
                <option value="Pocket Pivot Bounce">Pocket Pivot Bounce</option>
                <option value="Cheat / Early Entry">Cheat / Early Entry</option>
                <option value="Stage 2 Base Breakout">Stage 2 Base Breakout</option>
                <option value="General SEPA Discipline">General SEPA Discipline</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                SEPA Rating Tier
              </label>
              <select
                value={sepaRating}
                onChange={(e) => setSepaRating(e.target.value as SepaRatingTier)}
                className={`w-full px-3 py-2 rounded-lg border text-sm font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-400 ${
                  isObsidian
                    ? 'bg-[#181f2c] border-white/10 text-amber-400'
                    : 'bg-white border-gray-300 text-amber-600'
                }`}
              >
                <option value="ELITE">ELITE (A+ Minervini Setup)</option>
                <option value="LEADER">LEADER (A Market Outperformer)</option>
                <option value="SPECULATIVE">SPECULATIVE (B Momentum Swing)</option>
                <option value="WATCHLIST">WATCHLIST (C Early Basing)</option>
                <option value="AVOID">AVOID (D Stage 4 / Laggard)</option>
              </select>
            </div>
          </div>

          {/* Quick Tagging System */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-gray-400">
                Tags & Thematic Labels
              </label>
              <span className="text-[11px] text-gray-400 font-mono">Press Enter or comma to add</span>
            </div>

            {/* Existing tags */}
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30"
                >
                  <span>{tag}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-rose-400 transition-colors ml-1 cursor-pointer"
                  >
                    &times;
                  </button>
                </span>
              ))}

              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    handleAddTag(tagInput);
                  }
                }}
                placeholder="+ Add tag..."
                className={`px-2.5 py-1 rounded-full border text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-400 w-28 ${
                  isObsidian
                    ? 'bg-[#181f2c] border-white/10 text-gray-200'
                    : 'bg-gray-100 border-gray-300 text-gray-800'
                }`}
              />
            </div>

            {/* Popular quick-click tags */}
            <div className="flex flex-wrap gap-1 items-center">
              <span className="text-[10px] text-gray-500 uppercase font-mono mr-1">Quick Suggestions:</span>
              {POPULAR_SEPA_TAGS.slice(0, 7).map((ptag) => (
                <button
                  key={ptag}
                  type="button"
                  onClick={() => handleAddTag(ptag)}
                  className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                    tags.includes(ptag)
                      ? 'bg-amber-500/30 border-amber-400 text-amber-200'
                      : isObsidian
                      ? 'bg-white/5 border-white/10 text-gray-400 hover:text-gray-200 hover:border-white/20'
                      : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {ptag}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Template Picker */}
          <div className="flex items-center space-x-2 pt-1">
            <span className="text-xs font-mono text-gray-400 uppercase font-bold">Template:</span>
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(TEMPLATES).map((tName) => (
                <button
                  key={tName}
                  type="button"
                  onClick={() => handleApplyTemplate(tName)}
                  className={`text-xs px-2.5 py-1 rounded border font-mono transition-colors cursor-pointer ${
                    isObsidian
                      ? 'bg-[#181f2c] border-white/10 text-gray-300 hover:bg-white/10 hover:text-white'
                      : 'bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {tName}
                </button>
              ))}
            </div>
          </div>

          {/* Content Markdown Editor */}
          <div>
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-gray-400 mb-1.5">
              Trading Thesis, Rules & Wikilinks (Markdown)
            </label>
            <textarea
              rows={8}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Record your entry pivot, volume conditions, risk parameters, and [[Wikilinks]]..."
              className={`w-full p-3 rounded-lg border font-mono text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-amber-400 ${
                isObsidian
                  ? 'bg-[#181f2c] border-white/10 text-gray-200 placeholder-gray-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
              }`}
            />
            <div className="flex items-center justify-between text-[11px] text-gray-400 mt-1 font-mono">
              <span>Supports Markdown headings, bullet points, and [[Wikilinks]]</span>
              <span>{content.length} characters</span>
            </div>
          </div>

          {/* Pin option */}
          <label className="flex items-center space-x-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              className="rounded border-gray-300 text-amber-500 focus:ring-amber-400"
            />
            <span className="text-xs font-mono text-gray-300">
              Pin to top of Second Brain Vault
            </span>
          </label>

          {/* Status message */}
          {statusMessage && (
            <div
              className={`p-2.5 rounded-lg text-xs font-mono flex items-center space-x-2 ${
                savedSuccess
                  ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/20 border border-rose-500/30 text-rose-300'
              }`}
            >
              {savedSuccess ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              )}
              <span>{statusMessage}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          className={`flex items-center justify-between px-5 py-3.5 border-t ${
            isObsidian ? 'border-white/10 bg-[#181f2c]' : 'border-gray-200 bg-gray-50'
          }`}
        >
          <div className="flex items-center space-x-2">
            {savedSuccess && onOpenSecondBrainTab && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSecondBrainTab();
                }}
                className="px-3 py-1.5 rounded-lg border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 text-xs font-mono flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <span>View in Second Brain</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              className={`px-3.5 py-1.5 rounded-lg border text-xs font-mono transition-colors cursor-pointer ${
                isObsidian
                  ? 'border-white/10 hover:bg-white/10 text-gray-300'
                  : 'border-gray-300 hover:bg-gray-100 text-gray-700'
              }`}
            >
              {savedSuccess ? 'Close' : 'Cancel'}
            </button>

            <button
              id="save-insight-submit-btn"
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 font-mono font-bold text-xs hover:brightness-110 active:scale-95 transition-all shadow-sm flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Saving to Vault...</span>
                </>
              ) : savedSuccess ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Saved! Save Again</span>
                </>
              ) : (
                <>
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>Save Insight to Vault</span>
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
