import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MinerviniTradeSetup } from '../types';
import { evaluateAndDispatchWatchlistNewsEvents } from '../utils/watchlistNewsListener';
import {
  HeadlinePriceZonePlan,
  HeadlineProfitTarget,
  HeadlineStopLoss,
  loadPriceZonePlan,
  savePriceZonePlan,
  getDefaultPriceZonePlan,
  calculateRewardToRisk,
} from '../utils/headlinePriceZonesStorage';
import {
  Newspaper,
  Globe,
  ExternalLink,
  RefreshCw,
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  AlertTriangle,
  Search,
  ShieldCheck,
  Tag,
  Share2,
  Copy,
  Check,
  Download,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  X,
  Zap,
  Clock,
  Filter,
  CheckCircle2,
  FileText,
  FileDown,
  Flame,
  ArrowUpRight,
  Maximize2,
  Minimize2,
  Activity,
  Gauge,
  Info,
  Target,
  Crosshair,
  ShieldAlert,
  Scale,
  BookmarkCheck,
  Sliders,
  Pencil,
  RotateCcw,
  Save,
  Percent,
  Layers,
  Calendar,
  Building2,
  ListFilter,
  CheckSquare,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Square,
  Radio,
} from 'lucide-react';
import { NewsSentimentD3Chart } from './NewsSentimentD3Chart';
import { exportNewsSentimentToPdf } from '../utils/exportNewsPdf';
import { SentimentResearchPanel } from './SentimentResearchPanel';

interface TickerNewsGroundingProps {
  stock: MinerviniTradeSetup;
}

/**
 * Highlights matches of a search query in a text string for visual prominence
 */
export function highlightMatchedText(text: string | undefined, query: string): React.ReactNode {
  if (!text) return '';
  if (!query || !query.trim()) return text;
  const trimmed = query.trim();
  // Safe escaping for regex
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);
  if (parts.length === 1) return text;
  return (
    <>
      {parts.map((part, idx) =>
        part.toLowerCase() === trimmed.toLowerCase() ? (
          <mark key={idx} className="bg-amber-200 text-amber-950 font-bold px-0.5 rounded-2xs">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

export interface HeadlineItem {
  title: string;
  source: string;
  date: string;
  snippet: string;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'CATALYST';
  catalystType: string;
  isMajorEvent?: boolean;
  impactLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  impactScore?: number;
  sepaContext?: string;
}

/**
 * Checks whether a headline date string falls within a specified recency window.
 */
export function isHeadlineWithinRecency(
  dateStr: string | undefined,
  window: 'ALL' | '24H' | '3D' | '7D' | '30D'
): boolean {
  if (window === 'ALL' || !dateStr) return true;

  const text = dateStr.toLowerCase().trim();
  const now = Date.now();

  // Relative time checks
  if (
    text.includes('min') ||
    text.includes('hour') ||
    text.includes('today') ||
    text.includes('just now') ||
    text.includes('sec')
  ) {
    return true; // within 24h, 3d, 7d, 30d
  }

  if (text.includes('day')) {
    const daysMatch = text.match(/(\d+)\s*day/);
    const days = daysMatch ? parseInt(daysMatch[1], 10) : 1;
    if (window === '24H') return days <= 1;
    if (window === '3D') return days <= 3;
    if (window === '7D') return days <= 7;
    if (window === '30D') return days <= 30;
    return true;
  }

  if (text.includes('week')) {
    const weeksMatch = text.match(/(\d+)\s*week/);
    const weeks = weeksMatch ? parseInt(weeksMatch[1], 10) : 1;
    if (window === '24H' || window === '3D') return false;
    if (window === '7D') return weeks <= 1;
    if (window === '30D') return weeks <= 4;
    return true;
  }

  if (text.includes('month')) {
    const monthsMatch = text.match(/(\d+)\s*month/);
    const months = monthsMatch ? parseInt(monthsMatch[1], 10) : 1;
    if (window === '24H' || window === '3D' || window === '7D') return false;
    if (window === '30D') return months <= 1;
    return false;
  }

  // Parse absolute dates
  try {
    const parsedTime = Date.parse(dateStr);
    if (!isNaN(parsedTime)) {
      const diffMs = now - parsedTime;
      const diffHours = diffMs / (1000 * 60 * 60);
      const diffDays = diffHours / 24;
      if (window === '24H') return diffHours <= 24;
      if (window === '3D') return diffDays <= 3;
      if (window === '7D') return diffDays <= 7;
      if (window === '30D') return diffDays <= 30;
    }
  } catch {
    return true;
  }

  return true;
}

/**
 * Extracts key volatility trigger keywords from headline and snippet
 * to explain the catalyst driver (e.g., Earnings Beat, FDA Approval, Major Contract).
 */
export function getHeadlineVolatilityTriggers(headline: HeadlineItem): string[] {
  const text = `${headline.title} ${headline.snippet} ${headline.catalystType || ''}`.toLowerCase();
  const triggers: string[] = [];

  if (/earnings beat|beats eps|beats revenue|blowout|tripled profit|profit surged|record quarterly/i.test(text)) {
    triggers.push('Earnings Beat');
  } else if (/guidance raise|raises guidance|boosts guidance|raises outlook|boosts full-year|hikes forecast/i.test(text)) {
    triggers.push('Guidance Hike');
  } else if (/fda approv|fda clear|breakthrough therap|fast track|phase 3 success/i.test(text)) {
    triggers.push('FDA Catalyst');
  } else if (/acquisition|to acquire|acquired by|buyout|takeover bid|tender offer|merger agreement|spin-off/i.test(text)) {
    triggers.push('M&A / Buyout');
  } else if (/sec investigat|subpoena|accounting fraud|lawsuit filed|slashes guidance|profit warning|misses estimates|ceo resign/i.test(text)) {
    triggers.push('Risk Shock / Warning');
  } else if (/multi-billion|billion-dollar|defense contract|massive deal|pentagon contract/i.test(text)) {
    triggers.push('Mega Contract');
  } else if (/analyst upgrade|upgraded to buy|price target raised|outperform rating/i.test(text)) {
    triggers.push('Analyst Upgrade');
  } else if (/all-time high|52-week high|breakout|volume surge|heavy volume|short squeeze/i.test(text)) {
    triggers.push('Breakout Momentum');
  } else if (/strategic partnership|supply agreement|commercial launch|expanded deal/i.test(text)) {
    triggers.push('Strategic Deal');
  } else if (/share buyback|dividend hike|dividend increase/i.test(text)) {
    triggers.push('Capital Return');
  }

  return triggers;
}

/**
 * Calculates a standardized 1.0 to 10.0 impact score for a headline
 * based on comprehensive sentiment analysis and high-volatility keyword extraction
 * to quantify anticipated market volatility and catalyst magnitude for SEPA setups.
 */
export function getHeadlineImpactScore(headline: HeadlineItem): number {
  if (typeof headline.impactScore === 'number' && headline.impactScore > 0) {
    return headline.impactScore > 10
      ? Number((headline.impactScore / 10).toFixed(1))
      : Number(headline.impactScore.toFixed(1));
  }

  // 1. Base score rooted in Sentiment Analysis
  let baseScore = 5.0;
  if (headline.sentiment === 'CATALYST') {
    baseScore = 6.8;
  } else if (headline.sentiment === 'BULLISH') {
    baseScore = 6.2;
  } else if (headline.sentiment === 'BEARISH') {
    baseScore = 6.4; // Downside volatility shocks can be violent
  } else if (headline.sentiment === 'NEUTRAL') {
    baseScore = 4.2;
  }

  // 2. Pre-set impact level calibration
  if (headline.impactLevel === 'CRITICAL') baseScore = Math.max(baseScore, 9.0);
  else if (headline.impactLevel === 'HIGH') baseScore = Math.max(baseScore, 7.8);
  else if (headline.impactLevel === 'MEDIUM') baseScore = Math.max(baseScore, 5.8);
  else if (headline.impactLevel === 'LOW') baseScore = Math.min(baseScore, 3.8);

  // 3. Major event flag
  if (headline.isMajorEvent) {
    baseScore = Math.min(9.9, baseScore + 1.2);
  }

  // 4. Comprehensive Keyword & Volatility Pattern Analysis
  const fullText = `${headline.title} ${headline.snippet} ${headline.catalystType || ''}`.toLowerCase();

  // Tier A: Critical Volatility Keywords (+2.0 to +3.0)
  if (
    /earnings beat|beats eps|beats revenue|blowout earnings|record revenue|record profit|record quarterly|profit surged|revenue surged|tripled profit|raises guidance|boosts guidance|hikes guidance|raises outlook|boosts full-year/i.test(
      fullText
    )
  ) {
    baseScore = Math.min(9.9, baseScore + 2.2);
  } else if (
    /fda approv|fda clear|phase 3 success|breakthrough therap|fast track designation|orphan drug|patent granted/i.test(
      fullText
    )
  ) {
    baseScore = Math.min(9.9, baseScore + 2.4);
  } else if (
    /acquisition|to acquire|acquired by|buyout|takeover bid|tender offer|merger agreement|spin-off|divestiture/i.test(
      fullText
    )
  ) {
    baseScore = Math.min(9.8, baseScore + 2.0);
  } else if (
    /sec investigat|subpoena|accounting fraud|lawsuit filed|slashes guidance|cuts outlook|profit warning|misses estimates|ceo resign|cfo resign|delisting warning|short squeeze/i.test(
      fullText
    )
  ) {
    baseScore = Math.min(9.9, baseScore + 2.5);
  } else if (/multi-billion|billion-dollar|defense contract|massive deal|pentagon contract|block trade/i.test(fullText)) {
    baseScore = Math.min(9.7, baseScore + 2.1);
  }

  // Tier B: High Volatility Keywords (+1.0 to +1.6)
  else if (
    /analyst upgrade|upgraded to buy|price target raised|outperform rating|all-time high|52-week high|breakout|volume surge|heavy volume|strategic partnership|supply deal|commercial agreement|dividend increase|share buyback|accelerated buyback|expansion plan/i.test(
      fullText
    )
  ) {
    baseScore = Math.min(9.5, baseScore + 1.5);
  }

  // Tier C: Moderate Volatility Keywords (+0.5 to +0.8)
  else if (
    /investor day|conference presentation|annual meeting|appoints new|joint venture|product launch|expansion|new feature|pilot program/i.test(
      fullText
    )
  ) {
    baseScore = Math.min(7.5, baseScore + 0.6);
  }

  // Tier D: Low Volatility / Routine Notices (-0.8 to -1.5)
  else if (
    /routine filing|form 8-k|form 4|schedule 13|proxy statement|general statement|regular dividend|notice of meeting|commentary/i.test(
      fullText
    )
  ) {
    baseScore = Math.max(1.5, baseScore - 1.2);
  }

  // Ensure strict bounding between 1.0 and 10.0
  const finalScore = Math.min(10.0, Math.max(1.0, baseScore));
  return Number(finalScore.toFixed(1));
}

/**
 * Returns color tokens, labels, badges, and icons according to the Impact Score magnitude.
 */
export function getImpactScoreConfig(score: number) {
  if (score >= 8.5) {
    return {
      tier: 'CRITICAL',
      tierLabel: 'Critical Volatility',
      label: 'Critical Volatility',
      shortLabel: 'Critical',
      description: 'High-velocity catalyst (earnings beat, FDA clearance, major M&A) triggering explosive volume and breakout continuation.',
      bgColor: 'bg-rose-50',
      textColor: 'text-rose-950',
      borderColor: 'border-rose-400',
      leftBorderColor: 'border-l-rose-600',
      iconColor: 'text-rose-600',
      badgeBg: 'bg-rose-100/90 border-rose-400 text-rose-950 font-black shadow-xs',
      titlePillBg: 'bg-rose-600 text-white font-black shadow-xs border-rose-700',
      badgeHover: 'hover:bg-rose-200/90 hover:border-rose-500',
      pillBg: 'bg-rose-600 text-white',
      accentColor: 'text-rose-600',
      barColor: 'bg-rose-600',
      pulseDot: 'bg-rose-500',
      icon: Flame,
      tooltip: 'Critical Volatility Catalyst: Highest probability of massive institutional volume expansion and rapid price displacement.',
    };
  }
  if (score >= 7.0) {
    return {
      tier: 'HIGH',
      tierLabel: 'High Volatility',
      label: 'High Impact',
      shortLabel: 'High Vol',
      description: 'Strong fundamental driver (major commercial contract, patent grant, analyst upgrade) supporting aggressive accumulation.',
      bgColor: 'bg-amber-50',
      textColor: 'text-amber-950',
      borderColor: 'border-amber-400',
      leftBorderColor: 'border-l-amber-500',
      iconColor: 'text-amber-600',
      badgeBg: 'bg-amber-100/90 border-amber-400 text-amber-950 font-black shadow-xs',
      titlePillBg: 'bg-amber-600 text-white font-black shadow-xs border-amber-700',
      badgeHover: 'hover:bg-amber-200/90 hover:border-amber-500',
      pillBg: 'bg-amber-600 text-white',
      accentColor: 'text-amber-600',
      barColor: 'bg-amber-500',
      pulseDot: 'bg-amber-500',
      icon: Zap,
      tooltip: 'High Volatility Catalyst: Strong fundamental driver supporting institutional accumulation or pivot breakout continuation.',
    };
  }
  if (score >= 5.0) {
    return {
      tier: 'MODERATE',
      tierLabel: 'Moderate Impact',
      label: 'Moderate Impact',
      shortLabel: 'Moderate',
      description: 'Standard operational or industry updates providing baseline context during base consolidation.',
      bgColor: 'bg-sky-50',
      textColor: 'text-sky-950',
      borderColor: 'border-sky-300',
      leftBorderColor: 'border-l-sky-500',
      iconColor: 'text-sky-600',
      badgeBg: 'bg-sky-100/80 border-sky-300 text-sky-950 font-bold shadow-xs',
      titlePillBg: 'bg-sky-600 text-white font-bold shadow-xs border-sky-700',
      badgeHover: 'hover:bg-sky-200/90 hover:border-sky-400',
      pillBg: 'bg-sky-600 text-white',
      accentColor: 'text-sky-700',
      barColor: 'bg-sky-500',
      pulseDot: 'bg-sky-500',
      icon: TrendingUp,
      tooltip: 'Moderate Impact: Routine business developments, product updates, or standard analyst notes.',
    };
  }
  return {
    tier: 'LOW',
    tierLabel: 'Low Impact',
    label: 'Low Impact',
    shortLabel: 'Minor',
    description: 'Routine informational notice or low-impact news with minimal effect on VCP technical pattern.',
    bgColor: 'bg-slate-50',
    textColor: 'text-slate-800',
    borderColor: 'border-slate-300',
    leftBorderColor: 'border-l-slate-400',
    iconColor: 'text-slate-500',
    badgeBg: 'bg-slate-100 border-slate-300 text-slate-800 font-bold shadow-xs',
    titlePillBg: 'bg-slate-600 text-white font-bold shadow-xs border-slate-700',
    badgeHover: 'hover:bg-slate-200 hover:border-slate-400',
    pillBg: 'bg-slate-500 text-white',
    accentColor: 'text-slate-500',
    barColor: 'bg-slate-400',
    pulseDot: 'bg-slate-400',
    icon: Activity,
    tooltip: 'Low Volatility: Minor informational update with minimal immediate impact on price action.',
  };
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface NewsResponse {
  summary: string;
  headlines: HeadlineItem[];
  groundingSources: GroundingSource[];
  groundingQueries: string[];
  fetchedAt?: string;
}

// In-memory cache for ticker news so switching between tickers is instantaneous while allowing manual refresh
const newsCache: Record<string, { data: NewsResponse; timestamp: number }> = {};

export const TickerNewsGrounding: React.FC<TickerNewsGroundingProps> = ({ stock }) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [newsData, setNewsData] = useState<NewsResponse | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<'off' | '60s' | '300s'>('off');

  // Currency symbol helper ($ for US exchanges, ₹ for Indian exchanges)
  const currencySymbol = stock.exchange === 'NSE' || stock.exchange === 'BSE' ? '₹' : '$';

  // Manual Profit Target & Stop Loss Price Zones State
  const [priceZonePlan, setPriceZonePlan] = useState<HeadlinePriceZonePlan>(() =>
    loadPriceZonePlan(stock.ticker, stock.currentPrice, stock.pivotPrice, stock.stopLossPrice)
  );
  const [isZonePlannerOpen, setIsZonePlannerOpen] = useState<boolean>(false);
  const [activeHeadlineZoneCardIdx, setActiveHeadlineZoneCardIdx] = useState<number | null>(null);
  const [zoneSaveFeedback, setZoneSaveFeedback] = useState<string | null>(null);

  // Sync / reload price zone plan when ticker changes
  useEffect(() => {
    setPriceZonePlan(loadPriceZonePlan(stock.ticker, stock.currentPrice, stock.pivotPrice, stock.stopLossPrice));
    setActiveHeadlineZoneCardIdx(null);
  }, [stock.ticker, stock.currentPrice, stock.pivotPrice, stock.stopLossPrice]);

  // Filtering states
  const [activeSentiment, setActiveSentiment] = useState<'ALL' | 'BULLISH' | 'CATALYST' | 'BEARISH' | 'NEUTRAL'>('ALL');
  const [selectedCatalystType, setSelectedCatalystType] = useState<string>('ALL');
  const [selectedImpactTier, setSelectedImpactTier] = useState<'ALL' | 'CRITICAL' | 'HIGH_PLUS' | 'MODERATE_PLUS' | 'MINOR'>('ALL');
  const [selectedSource, setSelectedSource] = useState<string>('ALL');
  const [selectedZoneMapping, setSelectedZoneMapping] = useState<'ALL' | 'MAPPED_ONLY' | 'TARGET_1' | 'TARGET_2' | 'STOP_LOSS' | 'UNMAPPED'>('ALL');
  const [selectedRecency, setSelectedRecency] = useState<'ALL' | '24H' | '3D' | '7D' | '30D'>('ALL');
  const [strategyPreset, setStrategyPreset] = useState<'ALL' | 'CRITICAL_VOLATILITY' | 'BREAKOUT' | 'EARNINGS' | 'MAPPED_PLANS' | 'RISK_SHOCKS'>('ALL');
  const [majorOnly, setMajorOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'impact' | 'recent' | 'oldest' | 'sentiment' | 'alpha'>('impact');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);
  const [showImpactLegend, setShowImpactLegend] = useState<boolean>(false);

  // Sentiment Research states
  const [showSentimentResearch, setShowSentimentResearch] = useState<boolean>(true);
  const [researchTargetKeyword, setResearchTargetKeyword] = useState<string>('');

  // Animated expansion states
  const [expandedHeadlines, setExpandedHeadlines] = useState<Record<number, boolean>>({});
  const [isAllExpanded, setIsAllExpanded] = useState<boolean>(false);
  const [isGroundingDrawerOpen, setIsGroundingDrawerOpen] = useState<boolean>(false);

  // Sharing & Copy notification feedback
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [copiedHeadlineIdx, setCopiedHeadlineIdx] = useState<number | null>(null);

  // Timer reference for auto-refresh
  const autoRefreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Web Speech API Read Aloud state
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isSpeechPaused, setIsSpeechPaused] = useState<boolean>(false);
  const [speechRate, setSpeechRate] = useState<number>(1.0);
  const [activeSpeechTitle, setActiveSpeechTitle] = useState<string | null>(null);

  // Stop speech when ticker changes or component unmounts
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [stock.ticker]);

  const handleSpeakText = (text: string, titleLabel: string = 'Executive Summary') => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setShareFeedback('Web Speech API is not supported in this browser.');
      setTimeout(() => setShareFeedback(null), 3000);
      return;
    }

    // Toggle pause/resume if already active on same item
    if (isSpeaking && activeSpeechTitle === titleLabel && !isSpeechPaused) {
      window.speechSynthesis.pause();
      setIsSpeechPaused(true);
      return;
    }
    if (isSpeaking && activeSpeechTitle === titleLabel && isSpeechPaused) {
      window.speechSynthesis.resume();
      setIsSpeechPaused(false);
      return;
    }

    window.speechSynthesis.cancel(); // Stop any other speech

    const cleanText = text.replace(/[*#_`]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = speechRate;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(
      (v) => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Enhanced'))
    );
    if (englishVoice) {
      utterance.voice = englishVoice;
    }

    utterance.onstart = () => {
      setIsSpeaking(true);
      setIsSpeechPaused(false);
      setActiveSpeechTitle(titleLabel);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setIsSpeechPaused(false);
      setActiveSpeechTitle(null);
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setIsSpeechPaused(false);
      setActiveSpeechTitle(null);
    };

    window.speechSynthesis.speak(utterance);
  };

  const handleStopSpeech = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setIsSpeechPaused(false);
      setActiveSpeechTitle(null);
    }
  };

  // Computed entry price, target 1, target 2, stop loss
  const entryPrice = useMemo(() => {
    return priceZonePlan.entryPrice > 0
      ? priceZonePlan.entryPrice
      : stock.pivotPrice > 0
      ? stock.pivotPrice
      : stock.currentPrice > 0
      ? stock.currentPrice
      : 100;
  }, [priceZonePlan.entryPrice, stock.pivotPrice, stock.currentPrice]);

  const target1 = useMemo(() => {
    return (
      priceZonePlan.profitTargets[0] || {
        id: 'target-1',
        label: 'Target 1 (Base Breakout 20%)',
        price: Number((entryPrice * 1.2).toFixed(2)),
        percentGain: 20.0,
        catalystRationale: 'Standard Minervini 20-25% momentum partial take-profit.',
        status: 'ACTIVE' as const,
      }
    );
  }, [priceZonePlan.profitTargets, entryPrice]);

  const target2 = useMemo(() => {
    return (
      priceZonePlan.profitTargets[1] || {
        id: 'target-2',
        label: 'Target 2 (Catalyst Extension 35%)',
        price: Number((entryPrice * 1.35).toFixed(2)),
        percentGain: 35.0,
        catalystRationale: 'Institutional multi-week runner powered by fundamental catalyst beat.',
        status: 'ACTIVE' as const,
      }
    );
  }, [priceZonePlan.profitTargets, entryPrice]);

  const stopLoss = useMemo(() => {
    return (
      priceZonePlan.stopLoss || {
        price: Number((entryPrice * 0.95).toFixed(2)),
        percentRisk: 5.0,
        riskType: 'HARD_STOP' as const,
        invalidationThesis: 'Loss of pivot support or 5% maximum capital risk containment.',
      }
    );
  }, [priceZonePlan.stopLoss, entryPrice]);

  // Reward-to-Risk calculations
  const rewardRiskT1 = useMemo(() => {
    return calculateRewardToRisk(entryPrice, target1.price, stopLoss.price);
  }, [entryPrice, target1.price, stopLoss.price]);

  const rewardRiskT2 = useMemo(() => {
    return calculateRewardToRisk(entryPrice, target2.price, stopLoss.price);
  }, [entryPrice, target2.price, stopLoss.price]);

  // Handlers for Target / Stop Loss modifications
  const handleUpdateTarget1ByPrice = (price: number) => {
    if (price <= 0) return;
    const cleanPrice = Number(price.toFixed(2));
    const percent = Number((((cleanPrice - entryPrice) / entryPrice) * 100).toFixed(1));
    const updatedTargets = [...priceZonePlan.profitTargets];
    updatedTargets[0] = {
      ...target1,
      price: cleanPrice,
      percentGain: percent,
    };
    const updatedPlan: HeadlinePriceZonePlan = {
      ...priceZonePlan,
      profitTargets: updatedTargets,
    };
    setPriceZonePlan(updatedPlan);
    savePriceZonePlan(updatedPlan);
  };

  const handleUpdateTarget1ByPercent = (percent: number) => {
    if (percent <= 0) return;
    const cleanPercent = Number(percent.toFixed(1));
    const newPrice = Number((entryPrice * (1 + cleanPercent / 100)).toFixed(2));
    const updatedTargets = [...priceZonePlan.profitTargets];
    updatedTargets[0] = {
      ...target1,
      price: newPrice,
      percentGain: cleanPercent,
    };
    const updatedPlan: HeadlinePriceZonePlan = {
      ...priceZonePlan,
      profitTargets: updatedTargets,
    };
    setPriceZonePlan(updatedPlan);
    savePriceZonePlan(updatedPlan);
  };

  const handleUpdateTarget2ByPrice = (price: number) => {
    if (price <= 0) return;
    const cleanPrice = Number(price.toFixed(2));
    const percent = Number((((cleanPrice - entryPrice) / entryPrice) * 100).toFixed(1));
    const updatedTargets = [...priceZonePlan.profitTargets];
    if (!updatedTargets[1]) {
      updatedTargets[1] = {
        id: 'target-2',
        label: 'Target 2 (Catalyst Extension)',
        price: cleanPrice,
        percentGain: percent,
        status: 'ACTIVE',
      };
    } else {
      updatedTargets[1] = {
        ...updatedTargets[1],
        price: cleanPrice,
        percentGain: percent,
      };
    }
    const updatedPlan: HeadlinePriceZonePlan = {
      ...priceZonePlan,
      profitTargets: updatedTargets,
    };
    setPriceZonePlan(updatedPlan);
    savePriceZonePlan(updatedPlan);
  };

  const handleUpdateTarget2ByPercent = (percent: number) => {
    if (percent <= 0) return;
    const cleanPercent = Number(percent.toFixed(1));
    const newPrice = Number((entryPrice * (1 + cleanPercent / 100)).toFixed(2));
    const updatedTargets = [...priceZonePlan.profitTargets];
    if (!updatedTargets[1]) {
      updatedTargets[1] = {
        id: 'target-2',
        label: 'Target 2 (Catalyst Extension)',
        price: newPrice,
        percentGain: cleanPercent,
        status: 'ACTIVE',
      };
    } else {
      updatedTargets[1] = {
        ...updatedTargets[1],
        price: newPrice,
        percentGain: cleanPercent,
      };
    }
    const updatedPlan: HeadlinePriceZonePlan = {
      ...priceZonePlan,
      profitTargets: updatedTargets,
    };
    setPriceZonePlan(updatedPlan);
    savePriceZonePlan(updatedPlan);
  };

  const handleUpdateStopLossByPrice = (price: number) => {
    if (price <= 0) return;
    const cleanPrice = Number(price.toFixed(2));
    const percent = Number((((entryPrice - cleanPrice) / entryPrice) * 100).toFixed(1));
    const updatedStop: HeadlineStopLoss = {
      ...stopLoss,
      price: cleanPrice,
      percentRisk: percent > 0 ? percent : 0,
    };
    const updatedPlan: HeadlinePriceZonePlan = {
      ...priceZonePlan,
      stopLoss: updatedStop,
    };
    setPriceZonePlan(updatedPlan);
    savePriceZonePlan(updatedPlan);
  };

  const handleUpdateStopLossByPercent = (percent: number) => {
    if (percent <= 0) return;
    const cleanPercent = Number(percent.toFixed(1));
    const newPrice = Number((entryPrice * (1 - cleanPercent / 100)).toFixed(2));
    const updatedStop: HeadlineStopLoss = {
      ...stopLoss,
      price: newPrice,
      percentRisk: cleanPercent,
    };
    const updatedPlan: HeadlinePriceZonePlan = {
      ...priceZonePlan,
      stopLoss: updatedStop,
    };
    setPriceZonePlan(updatedPlan);
    savePriceZonePlan(updatedPlan);
  };

  const handleApplyPreset = (preset: 'MINERVINI_STANDARD' | 'CATALYST_POWER' | 'TIGHT_DEFENSE' | 'EARNINGS_SURGE') => {
    let t1Pct = 20;
    let t2Pct = 35;
    let stopPct = 5;
    let rationale = '';
    let invalidation = '';

    if (preset === 'MINERVINI_STANDARD') {
      t1Pct = 20;
      t2Pct = 35;
      stopPct = 5;
      rationale = 'Standard Minervini 20-25% partial profit rule with 5% risk containment.';
      invalidation = 'Loss of pivot high support level or max 5% loss.';
    } else if (preset === 'CATALYST_POWER') {
      t1Pct = 25;
      t2Pct = 45;
      stopPct = 6;
      rationale = 'High-velocity catalyst beat warranting multi-week power runner extension.';
      invalidation = 'Breakdown below pre-catalyst base low.';
    } else if (preset === 'TIGHT_DEFENSE') {
      t1Pct = 15;
      t2Pct = 25;
      stopPct = 3.5;
      rationale = 'Tight coil breakout with strict 3.5% stop to maximize Reward/Risk asymmetry.';
      invalidation = 'Breach of 20-day SMA or contraction low.';
    } else if (preset === 'EARNINGS_SURGE') {
      t1Pct = 30;
      t2Pct = 55;
      stopPct = 7;
      rationale = 'Major institutional earnings gap continuation thesis.';
      invalidation = 'Closing below earnings gap-up day low.';
    }

    const t1Price = Number((entryPrice * (1 + t1Pct / 100)).toFixed(2));
    const t2Price = Number((entryPrice * (1 + t2Pct / 100)).toFixed(2));
    const stopPrice = Number((entryPrice * (1 - stopPct / 100)).toFixed(2));

    const updatedPlan: HeadlinePriceZonePlan = {
      ...priceZonePlan,
      profitTargets: [
        {
          id: 'target-1',
          label: `Target 1 (+${t1Pct}%)`,
          price: t1Price,
          percentGain: t1Pct,
          catalystRationale: rationale,
          status: 'ACTIVE',
        },
        {
          id: 'target-2',
          label: `Target 2 (+${t2Pct}%)`,
          price: t2Price,
          percentGain: t2Pct,
          catalystRationale: `${rationale} (Runner)`,
          status: 'ACTIVE',
        },
      ],
      stopLoss: {
        price: stopPrice,
        percentRisk: stopPct,
        riskType: 'HARD_STOP',
        invalidationThesis: invalidation,
      },
      updatedAt: new Date().toISOString(),
    };

    setPriceZonePlan(updatedPlan);
    savePriceZonePlan(updatedPlan);
    setZoneSaveFeedback(`Applied ${preset.replace('_', ' ')} Preset!`);
    setTimeout(() => setZoneSaveFeedback(null), 2500);
  };

  // Map specific headline as catalyst driver for Target 1, Target 2, or Stop Loss
  const handleTagHeadlineToZone = (
    headline: HeadlineItem,
    tagType: 'TARGET_1' | 'TARGET_2' | 'STOP_LOSS' | 'CLEAR',
    customGainOrRiskPercent?: number
  ) => {
    const headlineKey = headline.title;
    const currentTags = { ...(priceZonePlan.headlineTags || {}) };

    if (tagType === 'CLEAR') {
      delete currentTags[headlineKey];
      const updatedPlan: HeadlinePriceZonePlan = {
        ...priceZonePlan,
        headlineTags: currentTags,
      };
      setPriceZonePlan(updatedPlan);
      savePriceZonePlan(updatedPlan);
      setZoneSaveFeedback('Cleared headline zone mapping');
      setTimeout(() => setZoneSaveFeedback(null), 2000);
      return;
    }

    const updatedTargets = [...priceZonePlan.profitTargets];
    let updatedStop = { ...priceZonePlan.stopLoss };

    if (tagType === 'TARGET_1') {
      const pct = customGainOrRiskPercent || target1.percentGain || 20;
      const price = Number((entryPrice * (1 + pct / 100)).toFixed(2));
      updatedTargets[0] = {
        ...target1,
        price,
        percentGain: pct,
        associatedHeadlineTitle: headline.title,
        catalystRationale: `Justified by headline: "${headline.title}" (${headline.catalystType} - ${headline.sentiment})`,
      };
      currentTags[headlineKey] = 'TARGET_DRIVER';
      setZoneSaveFeedback(`Mapped headline to Target 1 (+${pct}%)`);
    } else if (tagType === 'TARGET_2') {
      const pct = customGainOrRiskPercent || target2.percentGain || 35;
      const price = Number((entryPrice * (1 + pct / 100)).toFixed(2));
      updatedTargets[1] = {
        ...target2,
        price,
        percentGain: pct,
        associatedHeadlineTitle: headline.title,
        catalystRationale: `Runner justified by catalyst: "${headline.title}" (${headline.catalystType})`,
      };
      currentTags[headlineKey] = 'BULLISH_CATALYST';
      setZoneSaveFeedback(`Mapped headline to Target 2 (+${pct}%)`);
    } else if (tagType === 'STOP_LOSS') {
      const pct = customGainOrRiskPercent || stopLoss.percentRisk || 5;
      const price = Number((entryPrice * (1 - pct / 100)).toFixed(2));
      updatedStop = {
        ...stopLoss,
        price,
        percentRisk: pct,
        associatedHeadlineTitle: headline.title,
        invalidationThesis: `Risk containment conditioned on headline: "${headline.title}"`,
      };
      currentTags[headlineKey] = 'STOP_INVALIDATION';
      setZoneSaveFeedback(`Mapped headline as Stop Loss Invalidation factor (-${pct}%)`);
    }

    const updatedPlan: HeadlinePriceZonePlan = {
      ...priceZonePlan,
      profitTargets: updatedTargets,
      stopLoss: updatedStop,
      headlineTags: currentTags,
      updatedAt: new Date().toISOString(),
    };

    setPriceZonePlan(updatedPlan);
    savePriceZonePlan(updatedPlan);
    setTimeout(() => setZoneSaveFeedback(null), 3000);
  };

  const handleResetZonesToDefault = () => {
    const defaultPlan = getDefaultPriceZonePlan(stock.ticker, stock.currentPrice, stock.pivotPrice, stock.stopLossPrice);
    setPriceZonePlan(defaultPlan);
    savePriceZonePlan(defaultPlan);
    setZoneSaveFeedback('Reset price zones to SEPA standard defaults.');
    setTimeout(() => setZoneSaveFeedback(null), 2500);
  };

  // Fetch or refresh news data
  const fetchTickerHeadlines = async (forceRefresh = false) => {
    const cacheKey = stock.ticker.toUpperCase();
    const now = Date.now();

    // Use cached data if available and not forced (cache valid for 3 minutes)
    if (!forceRefresh && newsCache[cacheKey] && now - newsCache[cacheKey].timestamp < 180000) {
      setNewsData(newsCache[cacheKey].data);
      setLastUpdated(newsCache[cacheKey].data.fetchedAt || new Date().toLocaleTimeString());
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ticker-news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: stock.ticker,
          name: stock.name,
          exchange: stock.exchange,
          sector: stock.sector,
          forceRefresh,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data: NewsResponse = await res.json();
      const timestampStr = new Date().toLocaleTimeString();
      data.fetchedAt = timestampStr;

      newsCache[cacheKey] = { data, timestamp: now };
      setNewsData(data);
      setLastUpdated(timestampStr);

      // Trigger watchlist news listener to evaluate if any major catalyst should alert user
      if (data && data.headlines) {
        evaluateAndDispatchWatchlistNewsEvents(stock, data);
      }
    } catch (err: any) {
      console.error('Failed to fetch ticker news grounding', err);
      setError('Unable to fetch live search-grounded headlines at this moment. Please check your network connection.');
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch on ticker change
  useEffect(() => {
    setExpandedHeadlines({});
    setIsAllExpanded(false);
    setSearchQuery('');
    setActiveSentiment('ALL');
    setSelectedCatalystType('ALL');
    setSelectedImpactTier('ALL');
    setSelectedSource('ALL');
    setSelectedZoneMapping('ALL');
    setSelectedRecency('ALL');
    setStrategyPreset('ALL');
    setMajorOnly(false);
    fetchTickerHeadlines(false);
  }, [stock.ticker]);

  // Auto-refresh interval handler
  useEffect(() => {
    if (autoRefreshTimerRef.current) {
      clearInterval(autoRefreshTimerRef.current);
      autoRefreshTimerRef.current = null;
    }

    if (autoRefreshInterval === '60s') {
      autoRefreshTimerRef.current = setInterval(() => {
        fetchTickerHeadlines(true);
      }, 60000);
    } else if (autoRefreshInterval === '300s') {
      autoRefreshTimerRef.current = setInterval(() => {
        fetchTickerHeadlines(true);
      }, 300000);
    }

    return () => {
      if (autoRefreshTimerRef.current) {
        clearInterval(autoRefreshTimerRef.current);
      }
    };
  }, [autoRefreshInterval, stock.ticker]);

  // Extract unique catalyst types for filter pills
  const availableCatalystTypes = useMemo(() => {
    if (!newsData?.headlines) return [];
    const types = new Set<string>();
    newsData.headlines.forEach((h) => {
      if (h.catalystType) types.add(h.catalystType);
    });
    return Array.from(types);
  }, [newsData]);

  // Extract unique publishing sources for filter dropdown/pills
  const availableSources = useMemo(() => {
    if (!newsData?.headlines) return [];
    const sources = new Set<string>();
    newsData.headlines.forEach((h) => {
      if (h.source && h.source.trim()) {
        sources.add(h.source.trim());
      }
    });
    return Array.from(sources);
  }, [newsData]);

  // Strategy preset applicator
  const applyStrategyPreset = (preset: 'ALL' | 'CRITICAL_VOLATILITY' | 'BREAKOUT' | 'EARNINGS' | 'MAPPED_PLANS' | 'RISK_SHOCKS') => {
    setStrategyPreset(preset);
    if (preset === 'ALL') {
      resetAllFilters();
      return;
    }

    // Clear orthogonal filters
    setSelectedCatalystType('ALL');
    setSelectedSource('ALL');
    setSelectedRecency('ALL');
    setSelectedZoneMapping('ALL');
    setSearchQuery('');
    setMajorOnly(false);

    if (preset === 'CRITICAL_VOLATILITY') {
      setSelectedImpactTier('CRITICAL');
      setActiveSentiment('ALL');
    } else if (preset === 'BREAKOUT') {
      setSelectedImpactTier('HIGH_PLUS');
      setActiveSentiment('CATALYST');
    } else if (preset === 'EARNINGS') {
      setSelectedImpactTier('ALL');
      setActiveSentiment('ALL');
      setSearchQuery('earnings');
    } else if (preset === 'MAPPED_PLANS') {
      setSelectedImpactTier('ALL');
      setActiveSentiment('ALL');
      setSelectedZoneMapping('MAPPED_ONLY');
    } else if (preset === 'RISK_SHOCKS') {
      setSelectedImpactTier('ALL');
      setActiveSentiment('BEARISH');
    }
  };

  // Sentiment counts
  const sentimentCounts = useMemo(() => {
    const counts = { ALL: 0, BULLISH: 0, CATALYST: 0, BEARISH: 0, NEUTRAL: 0 };
    if (!newsData?.headlines) return counts;
    counts.ALL = newsData.headlines.length;
    newsData.headlines.forEach((h) => {
      if (h.sentiment in counts) {
        counts[h.sentiment]++;
      }
    });
    return counts;
  }, [newsData]);

  // Filter and sort headlines
  const filteredHeadlines = useMemo(() => {
    if (!newsData?.headlines) return [];

    let list = newsData.headlines.filter((item) => {
      // 1. Sentiment filter
      if (activeSentiment !== 'ALL' && item.sentiment !== activeSentiment) {
        return false;
      }

      // 2. Catalyst Type filter
      if (selectedCatalystType !== 'ALL' && item.catalystType !== selectedCatalystType) {
        return false;
      }

      // 3. Impact Tier filter
      if (selectedImpactTier !== 'ALL') {
        const score = getHeadlineImpactScore(item);
        if (selectedImpactTier === 'CRITICAL' && score < 8.5) return false;
        if (selectedImpactTier === 'HIGH_PLUS' && score < 7.0) return false;
        if (selectedImpactTier === 'MODERATE_PLUS' && score < 5.0) return false;
        if (selectedImpactTier === 'MINOR' && score >= 5.0) return false;
      }

      // 4. Source Publisher filter
      if (selectedSource !== 'ALL' && item.source?.trim().toLowerCase() !== selectedSource.trim().toLowerCase()) {
        return false;
      }

      // 5. Zone Mapping filter
      if (selectedZoneMapping !== 'ALL') {
        const headlineTag = priceZonePlan.headlineTags?.[item.title];
        const isTarget1 = headlineTag === 'TARGET_DRIVER' || target1.associatedHeadlineTitle === item.title;
        const isTarget2 = headlineTag === 'BULLISH_CATALYST' || target2.associatedHeadlineTitle === item.title;
        const isStop = headlineTag === 'STOP_INVALIDATION' || stopLoss.associatedHeadlineTitle === item.title;
        const isMapped = isTarget1 || isTarget2 || isStop || !!headlineTag;

        if (selectedZoneMapping === 'MAPPED_ONLY' && !isMapped) return false;
        if (selectedZoneMapping === 'TARGET_1' && !isTarget1) return false;
        if (selectedZoneMapping === 'TARGET_2' && !isTarget2) return false;
        if (selectedZoneMapping === 'STOP_LOSS' && !isStop) return false;
        if (selectedZoneMapping === 'UNMAPPED' && isMapped) return false;
      }

      // 6. Recency / Date filter
      if (selectedRecency !== 'ALL' && !isHeadlineWithinRecency(item.date, selectedRecency)) {
        return false;
      }

      // 7. Major / High Impact Only filter
      if (majorOnly && !item.isMajorEvent && item.impactLevel !== 'CRITICAL' && item.impactLevel !== 'HIGH' && getHeadlineImpactScore(item) < 7.0) {
        return false;
      }

      // 8. Keyword search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchTitle = item.title?.toLowerCase().includes(query);
        const matchSnippet = item.snippet?.toLowerCase().includes(query);
        const matchSource = item.source?.toLowerCase().includes(query);
        const matchType = item.catalystType?.toLowerCase().includes(query);
        const triggers = getHeadlineVolatilityTriggers(item).map((t) => t.toLowerCase());
        const matchTrigger = triggers.some((t) => t.includes(query));
        if (!matchTitle && !matchSnippet && !matchSource && !matchType && !matchTrigger) {
          return false;
        }
      }

      return true;
    });

    // Sort headlines
    if (sortBy === 'impact') {
      list.sort((a, b) => {
        const scoreA = getHeadlineImpactScore(a);
        const scoreB = getHeadlineImpactScore(b);
        return scoreB - scoreA;
      });
    } else if (sortBy === 'recent') {
      list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    } else if (sortBy === 'oldest') {
      list.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    } else if (sortBy === 'sentiment') {
      const sentimentOrder: Record<string, number> = { CATALYST: 4, BULLISH: 3, NEUTRAL: 2, BEARISH: 1 };
      list.sort((a, b) => (sentimentOrder[b.sentiment] || 0) - (sentimentOrder[a.sentiment] || 0));
    } else if (sortBy === 'alpha') {
      list.sort((a, b) => a.title.localeCompare(b.title));
    }

    return list;
  }, [
    newsData,
    activeSentiment,
    selectedCatalystType,
    selectedImpactTier,
    selectedSource,
    selectedZoneMapping,
    selectedRecency,
    majorOnly,
    searchQuery,
    sortBy,
    target1.associatedHeadlineTitle,
    target2.associatedHeadlineTitle,
    stopLoss.associatedHeadlineTitle,
    priceZonePlan.headlineTags,
  ]);

  // Toggle single card expansion
  const toggleHeadlineExpand = (index: number) => {
    setExpandedHeadlines((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  // Toggle all cards expansion
  const toggleExpandAll = () => {
    if (isAllExpanded) {
      setExpandedHeadlines({});
      setIsAllExpanded(false);
    } else {
      const newExpanded: Record<number, boolean> = {};
      filteredHeadlines.forEach((_, idx) => {
        newExpanded[idx] = true;
      });
      setExpandedHeadlines(newExpanded);
      setIsAllExpanded(true);
    }
  };

  // Generate formatted Markdown/plain-text report for sharing
  const generateShareReport = () => {
    if (!newsData) return '';
    const dateStr = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    let report = `📰 SEPA Catalyst Intelligence Briefing: ${stock.ticker} (${stock.name})\n`;
    report += `Exchange: ${stock.exchange} | Price: ${currencySymbol}${stock.currentPrice} | Date: ${dateStr}\n`;
    report += `Trend Score: ${stock.trendScore}/8 | VCP Stage: ${stock.vcpStage} | RS Rating: ${stock.rsRating}\n\n`;

    // Defined Profit Targets & Stop Loss Zones
    report += `🎯 SEPA Profit Target & Risk Containment Zones:\n`;
    report += `• Entry/Pivot: ${currencySymbol}${entryPrice.toFixed(2)}\n`;
    report += `• Target 1: ${currencySymbol}${target1.price.toFixed(2)} (+${target1.percentGain}%) | Reward/Risk: ${rewardRiskT1.ratio}:1\n`;
    if (target1.associatedHeadlineTitle) report += `  Catalyst Driver: "${target1.associatedHeadlineTitle}"\n`;
    report += `• Target 2: ${currencySymbol}${target2.price.toFixed(2)} (+${target2.percentGain}%) | Reward/Risk: ${rewardRiskT2.ratio}:1\n`;
    if (target2.associatedHeadlineTitle) report += `  Catalyst Driver: "${target2.associatedHeadlineTitle}"\n`;
    report += `• Stop Loss: ${currencySymbol}${stopLoss.price.toFixed(2)} (-${stopLoss.percentRisk}%) [${stopLoss.riskType}]\n`;
    if (stopLoss.invalidationThesis) report += `  Invalidation Thesis: ${stopLoss.invalidationThesis}\n`;
    report += `\n`;

    if (newsData.summary) {
      report += `⚡ Catalyst Synthesis:\n${newsData.summary}\n\n`;
    }

    report += `🎯 Key Grounded Headlines (${filteredHeadlines.length}):\n`;
    filteredHeadlines.forEach((h, i) => {
      const score = getHeadlineImpactScore(h);
      const config = getImpactScoreConfig(score);
      report += `${i + 1}. [Impact: ${score}/10 ${config.shortLabel} | ${h.sentiment}] ${h.title}\n`;
      report += `   Source: ${h.source} (${h.date}) | Type: ${h.catalystType}\n`;
      report += `   Takeaway: "${h.snippet}"\n\n`;
    });

    if (newsData.groundingSources && newsData.groundingSources.length > 0) {
      report += `🔗 Google Search Grounded Citations:\n`;
      newsData.groundingSources.slice(0, 3).forEach((s) => {
        report += `• ${s.title}: ${s.uri}\n`;
      });
    }

    report += `\nGenerated via Mark Minervini SEPA & VCP Master Platform.`;
    return report;
  };

  // Handle Share button (Web Share API or Clipboard Fallback)
  const handleShareBriefing = async () => {
    const reportText = generateShareReport();
    if (!reportText) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${stock.ticker} SEPA News Catalyst Report`,
          text: reportText,
        });
        setShareFeedback('Shared successfully!');
        setTimeout(() => setShareFeedback(null), 3000);
        return;
      } catch (err) {
        // Fallback to clipboard if share was dismissed or unsupported
      }
    }

    // Clipboard fallback
    try {
      await navigator.clipboard.writeText(reportText);
      setShareFeedback('Briefing copied to clipboard!');
      setTimeout(() => setShareFeedback(null), 3000);
    } catch (err) {
      console.error('Failed to copy to clipboard', err);
      setShareFeedback('Failed to copy. Please try again.');
      setTimeout(() => setShareFeedback(null), 3000);
    }
  };

  // Copy single headline
  const handleCopySingleHeadline = async (headline: HeadlineItem, idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const score = getHeadlineImpactScore(headline);
    const config = getImpactScoreConfig(score);
    const text = `[Impact: ${score}/10 (${config.shortLabel}) | ${headline.sentiment} - ${headline.catalystType}] ${headline.title}\nSource: ${headline.source} (${headline.date})\n"${headline.snippet}"\n(Ticker: ${stock.ticker})`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedHeadlineIdx(idx);
      setTimeout(() => setCopiedHeadlineIdx(null), 2500);
    } catch (err) {
      console.error('Failed to copy headline', err);
    }
  };

  // Download comprehensive news & trade plan report as JSON file
  const handleDownloadReport = () => {
    const timestamp = new Date().toISOString();
    const dateFormatted = timestamp.slice(0, 10);

    const reportJson = {
      metadata: {
        reportType: 'SEPA_NEWS_AND_TRADE_PLAN_REPORT',
        exportedAt: timestamp,
        platform: 'Mark Minervini SEPA & VCP Master Platform',
        version: '2.0.0',
      },
      stock: {
        ticker: stock.ticker,
        name: stock.name,
        exchange: stock.exchange,
        currency: currencySymbol,
        currentPrice: stock.currentPrice,
        pivotPrice: stock.pivotPrice,
        stopLossPrice: stock.stopLossPrice,
        volumeRatio: stock.volumeRatio,
        volumeDryUpPercent: stock.volumeDryUpPercent,
        breakoutProbability: stock.breakoutProbability,
        trendScore: stock.trendScore,
        rsRating: stock.rsRating,
        vcpStage: stock.vcpStage,
        contractionPattern: stock.contractionPattern,
        patternType: stock.patternType,
        sector: stock.sector,
        industry: stock.industry,
      },
      tradePlan: {
        entryPivotPrice: entryPrice,
        livePrice: stock.currentPrice,
        percentFromPivot: Number((((stock.currentPrice - entryPrice) / entryPrice) * 100).toFixed(2)),
        profitTargets: priceZonePlan.profitTargets.map((t, idx) => {
          const rr = calculateRewardToRisk(entryPrice, t.price, stopLoss.price);
          return {
            targetIndex: idx + 1,
            label: t.label,
            targetPrice: t.price,
            percentGain: t.percentGain,
            rewardDollar: rr.rewardDollar,
            rewardRiskRatio: rr.ratio,
            isValidSEPAAsymmetry: rr.isValidSEPA,
            catalystRationale: t.catalystRationale || '',
            associatedHeadlineTitle: t.associatedHeadlineTitle || null,
            status: t.status,
          };
        }),
        stopLoss: {
          stopPrice: stopLoss.price,
          percentRisk: stopLoss.percentRisk,
          riskDollar: Number((entryPrice - stopLoss.price).toFixed(2)),
          riskType: stopLoss.riskType,
          invalidationThesis: stopLoss.invalidationThesis || '',
          associatedHeadlineTitle: stopLoss.associatedHeadlineTitle || null,
        },
        rewardToRiskSummary: {
          target1Ratio: rewardRiskT1.ratio,
          target2Ratio: rewardRiskT2.ratio,
          isSEPACompliant: rewardRiskT1.isValidSEPA,
          minerviniCriterion: 'Minimum 2.5:1 to 3:1 Reward-to-Risk ratio with strict stop loss containment',
        },
        headlineTagMappings: priceZonePlan.headlineTags || {},
        tradePlanNotes: priceZonePlan.notes || '',
        lastPlanUpdate: priceZonePlan.updatedAt,
      },
      newsAndCatalysts: {
        query: newsData?.query || `${stock.ticker} stock news earnings catalyst`,
        lastRefreshed: newsData?.lastRefreshed || timestamp,
        catalystSummary: newsData?.summary || '',
        sentimentOverview: sentimentCounts,
        totalHeadlinesCount: newsData?.headlines.length || 0,
        headlines: (newsData?.headlines || []).map((h, i) => {
          const impactScore = getHeadlineImpactScore(h);
          const impactConfig = getImpactScoreConfig(impactScore);
          const isTarget1 = target1.associatedHeadlineTitle === h.title;
          const isTarget2 = target2.associatedHeadlineTitle === h.title;
          const isStop = stopLoss.associatedHeadlineTitle === h.title;
          return {
            id: i + 1,
            title: h.title,
            snippet: h.snippet,
            source: h.source,
            date: h.date,
            sentiment: h.sentiment,
            catalystType: h.catalystType,
            impactScore,
            impactTier: impactConfig.shortLabel,
            tradePlanAssociation: isTarget1
              ? 'PROFIT_TARGET_1_DRIVER'
              : isTarget2
              ? 'PROFIT_TARGET_2_RUNNER'
              : isStop
              ? 'STOP_LOSS_INVALIDATION'
              : 'GENERAL_CONTEXT',
          };
        }),
        groundingSources: newsData?.groundingSources || [],
      },
    };

    const jsonString = JSON.stringify(reportJson, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${stock.ticker}_SEPA_News_TradePlan_Report_${dateFormatted}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setShareFeedback(`Downloaded ${stock.ticker} News & Trade Plan (JSON)`);
    setTimeout(() => setShareFeedback(null), 3000);
  };

  // Export comprehensive news, sentiment, and trade plan as a formatted PDF report
  const handleExportPdf = () => {
    if (!newsData) return;

    const total = newsData.headlines.length || 0;
    const bullishAndCatalyst = (sentimentCounts.BULLISH || 0) + (sentimentCounts.CATALYST || 0);
    const bullishRatio = total > 0 ? Math.round((bullishAndCatalyst / total) * 100) : 50;

    exportNewsSentimentToPdf({
      stock,
      summary: newsData.summary,
      headlines: filteredHeadlines.length > 0 ? filteredHeadlines : newsData.headlines,
      priceZonePlan,
      groundingSources: newsData.groundingSources,
      currencySymbol,
      sentimentOverview: {
        bullish: sentimentCounts.BULLISH || 0,
        catalyst: sentimentCounts.CATALYST || 0,
        neutral: sentimentCounts.NEUTRAL || 0,
        bearish: sentimentCounts.BEARISH || 0,
        total,
        bullishRatio,
      },
    });

    setShareFeedback(`Generated & Exported ${stock.ticker} PDF Catalyst Report`);
    setTimeout(() => setShareFeedback(null), 3000);
  };

  const isFiltersActive =
    activeSentiment !== 'ALL' ||
    selectedCatalystType !== 'ALL' ||
    selectedImpactTier !== 'ALL' ||
    selectedSource !== 'ALL' ||
    selectedZoneMapping !== 'ALL' ||
    selectedRecency !== 'ALL' ||
    strategyPreset !== 'ALL' ||
    majorOnly ||
    searchQuery.trim().length > 0;

  const resetAllFilters = () => {
    setActiveSentiment('ALL');
    setSelectedCatalystType('ALL');
    setSelectedImpactTier('ALL');
    setSelectedSource('ALL');
    setSelectedZoneMapping('ALL');
    setSelectedRecency('ALL');
    setStrategyPreset('ALL');
    setMajorOnly(false);
    setSearchQuery('');
  };

  return (
    <div id="ticker-news-grounding-section" className="bg-white border border-[#e5e4e1] p-6 shadow-xs space-y-6">
      
      {/* Module Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e5e4e1] pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="bg-[#1a1a1a] text-white text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider font-mono">
              Google Search Grounding
            </span>
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#b5a68d]">
              Live Catalyst Intelligence
            </span>
            {lastUpdated && (
              <span className="text-[10px] text-gray-500 font-mono flex items-center space-x-1">
                <Clock className="w-3 h-3 text-gray-400" />
                <span>Updated: {lastUpdated}</span>
              </span>
            )}
          </div>
          <h3 className="text-xl font-serif font-black text-[#1a1a1a] mt-1 flex items-center space-x-2">
            <span>Financial Headlines & Context — {stock.ticker}</span>
          </h3>
          <p className="text-xs font-serif italic text-gray-500 mt-0.5">
            Real-time web headlines grounded by Google Search to explain price consolidation and breakout drivers for {stock.name}.
          </p>
        </div>

        {/* Action Controls: Refresh, Share, Expand All, Filter Toggle */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          
          {/* Share Briefing Button */}
          <button
            onClick={handleShareBriefing}
            disabled={!newsData || loading}
            title="Share or Copy full SEPA Catalyst briefing"
            className="bg-[#f9f8f5] hover:bg-[#1a1a1a] hover:text-white text-gray-800 border border-[#e5e4e1] hover:border-black px-3 py-2 text-[11px] font-bold uppercase tracking-wider flex items-center space-x-1.5 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5 text-amber-700" />
            <span>Share Briefing</span>
          </button>

          {/* Export PDF Report Button */}
          <button
            onClick={handleExportPdf}
            disabled={!newsData || loading}
            title="Export summarized news, sentiment intelligence, and SEPA trade plan as a formatted PDF report"
            className="bg-[#f9f8f5] hover:bg-rose-900 hover:text-white text-rose-950 border border-rose-200 hover:border-rose-900 px-3 py-2 text-[11px] font-bold uppercase tracking-wider flex items-center space-x-1.5 transition-all disabled:opacity-50 cursor-pointer shadow-2xs"
          >
            <FileDown className="w-3.5 h-3.5 text-rose-700 group-hover:text-white" />
            <span>Export PDF</span>
            <span className="text-[9px] bg-rose-100 text-rose-800 border border-rose-300 px-1 py-0.2 font-mono">
              PDF
            </span>
          </button>

          {/* Download Report Button (JSON) */}
          <button
            onClick={handleDownloadReport}
            disabled={!newsData || loading}
            title="Download full news and trade plan report as JSON file"
            className="bg-[#f9f8f5] hover:bg-[#1a1a1a] hover:text-white text-gray-800 border border-[#e5e4e1] hover:border-black px-3 py-2 text-[11px] font-bold uppercase tracking-wider flex items-center space-x-1.5 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-emerald-700" />
            <span>Download Report</span>
            <span className="text-[9px] bg-emerald-100 text-emerald-900 border border-emerald-300 px-1 py-0.2 font-mono">
              JSON
            </span>
          </button>

          {/* Expand / Collapse All Toggle */}
          {newsData && newsData.headlines.length > 0 && (
            <button
              onClick={toggleExpandAll}
              disabled={loading}
              className="bg-[#f9f8f5] hover:bg-gray-200 text-gray-700 border border-[#e5e4e1] px-3 py-2 text-[11px] font-bold uppercase tracking-wider flex items-center space-x-1.5 transition-all cursor-pointer"
            >
              {isAllExpanded ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-gray-600" />
                  <span>Collapse All</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-gray-600" />
                  <span>Expand All</span>
                </>
              )}
            </button>
          )}

          {/* Refresh Data Button */}
          <button
            onClick={() => fetchTickerHeadlines(true)}
            disabled={loading}
            className="bg-[#1a1a1a] hover:bg-black text-white px-4 py-2 text-[11px] font-bold uppercase tracking-wider flex items-center space-x-2 shadow-xs transition-all disabled:opacity-50 cursor-pointer border border-black"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Grounding News...' : 'Refresh Data'}</span>
          </button>
        </div>
      </div>

      {/* Share / Copy Feedback Toast Notification */}
      <AnimatePresence>
        {shareFeedback && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            className="bg-emerald-900 text-emerald-100 border border-emerald-600 px-4 py-2.5 flex items-center justify-between text-xs font-mono shadow-md"
          >
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="font-bold">{shareFeedback}</span>
            </div>
            <button
              onClick={() => setShareFeedback(null)}
              className="text-emerald-300 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Interactive Filtering Bar */}
      {newsData && !loading && (
        <div className="space-y-3">
          {/* Main Filter & Search Control Center */}
          <div className="bg-[#f9f8f5] p-3.5 border border-[#e5e4e1] space-y-3">
            
            {/* Top Row: Search Input Field & Primary Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
              
              {/* Full Featured Search Input Field with Instant Keyword Highlighting */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-amber-700 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder={`Search & filter ${stock.ticker} headlines by keywords (e.g. 'Buyback', 'Expansion', 'FDA', 'Earnings', 'Guidance', 'M&A')...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-[#d5d4d0] hover:border-gray-400 focus:border-black pl-9 pr-32 py-2 text-xs font-mono text-gray-900 placeholder:text-gray-400 focus:outline-none transition-colors shadow-2xs"
                />
                
                {/* Right controls inside search field: Match count & Clear button & Quick Research trigger */}
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1.5 font-mono text-[10px]">
                  {searchQuery && (
                    <span className="text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-xs border border-gray-200">
                      {filteredHeadlines.length} match{filteredHeadlines.length === 1 ? '' : 'es'}
                    </span>
                  )}
                  {searchQuery && (
                    <button
                      onClick={() => {
                        setResearchTargetKeyword(searchQuery);
                        setShowSentimentResearch(true);
                        const el = document.getElementById('sentiment-research-center');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }}
                      title={`Run Deep Sentiment Research on "${searchQuery}"`}
                      className="bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold px-1.5 py-0.5 border border-amber-300 cursor-pointer flex items-center space-x-0.5"
                    >
                      <Sparkles className="w-2.5 h-2.5 text-amber-700" />
                      <span>Audit</span>
                    </button>
                  )}
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      title="Clear keyword search"
                      className="text-gray-400 hover:text-black p-0.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Primary Action Buttons: Sentiment Research & Advanced Filters */}
              <div className="flex items-center space-x-2 shrink-0">
                {/* Dedicated Sentiment Research Center Toggle */}
                <button
                  onClick={() => {
                    setShowSentimentResearch(!showSentimentResearch);
                    if (!showSentimentResearch) {
                      setTimeout(() => {
                        const el = document.getElementById('sentiment-research-center');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }, 100);
                    }
                  }}
                  className={`px-3 py-2 text-[11px] font-mono font-bold uppercase border flex items-center space-x-1.5 cursor-pointer transition-all shadow-2xs ${
                    showSentimentResearch
                      ? 'bg-black text-amber-400 border-black ring-1 ring-amber-400/30'
                      : 'bg-white text-gray-900 border-[#d5d4d0] hover:bg-gray-100'
                  }`}
                  title="Toggle Deep Sentiment Research & Keyword Intelligence Panel"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Sentiment Research</span>
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block animate-pulse" />
                </button>

                {/* Filters Toggle Button */}
                <button
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className={`px-3 py-2 text-[11px] font-mono font-bold uppercase border flex items-center space-x-1.5 cursor-pointer transition-all shadow-2xs ${
                    showAdvancedFilters || isFiltersActive
                      ? 'bg-amber-100 text-amber-950 border-amber-300'
                      : 'bg-white text-gray-700 border-[#d5d4d0] hover:bg-gray-100'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-amber-700" />
                  <span>Filters</span>
                  {isFiltersActive && (
                    <span className="w-2 h-2 rounded-full bg-amber-600 inline-block animate-pulse" />
                  )}
                </button>

                {isFiltersActive && (
                  <button
                    onClick={resetAllFilters}
                    title="Reset all active search queries and filter dimensions"
                    className="px-2.5 py-2 text-[10px] font-mono font-bold uppercase bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100 cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>

            {/* Strategy Presets Bar */}
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono border-t border-[#e5e4e1] pt-2">
              <span className="text-gray-500 font-bold uppercase tracking-wider flex items-center space-x-1 mr-1">
                <Sparkles className="w-3 h-3 text-amber-600" />
                <span>Presets:</span>
              </span>
              {[
                { id: 'ALL', label: 'All News' },
                { id: 'CRITICAL_VOLATILITY', label: '⚡ Critical Volatility (8.5+)' },
                { id: 'BREAKOUT', label: '🚀 Breakout Catalysts' },
                { id: 'EARNINGS', label: '📊 Earnings & Guidance' },
                { id: 'MAPPED_PLANS', label: '🎯 Mapped Trade Plans' },
                { id: 'RISK_SHOCKS', label: '⚠️ Risk & Invalidation' },
              ].map((preset) => {
                const isActive = strategyPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => applyStrategyPreset(preset.id as any)}
                    className={`px-2 py-0.5 text-[9px] font-bold uppercase border transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#1a1a1a] text-white border-black shadow-xs'
                        : 'bg-white hover:bg-gray-100 text-gray-700 border-gray-300'
                    }`}
                  >
                    <span>{preset.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Quick Stock-Related Keyword Search Chips with High-Impact Catalyst Focus */}
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
              <span className="text-gray-500 font-bold uppercase tracking-wider flex items-center space-x-1 mr-1">
                <Zap className="w-3 h-3 text-amber-600" />
                <span>Catalyst Keywords:</span>
              </span>
              {[
                { label: '🔥 Buyback', query: 'buyback', isHighlight: true },
                { label: '🚀 Expansion', query: 'expansion', isHighlight: true },
                { label: '💊 FDA', query: 'fda', isHighlight: true },
                { label: 'Earnings', query: 'earnings' },
                { label: 'Beat / Surge', query: 'beat' },
                { label: 'Guidance', query: 'guidance' },
                { label: 'Acquisition / M&A', query: 'acquisition' },
                { label: 'Contract', query: 'contract' },
                { label: 'Upgrade', query: 'upgrade' },
                { label: 'Breakout', query: 'breakout' },
                { label: 'Revenue', query: 'revenue' },
                { label: 'Margin', query: 'margin' },
                { label: 'Dividend', query: 'dividend' },
              ].map((chip) => {
                const isActive = searchQuery.toLowerCase().trim() === chip.query;
                return (
                  <button
                    key={chip.query}
                    onClick={() => {
                      setStrategyPreset('ALL');
                      setSearchQuery(isActive ? '' : chip.query);
                      setResearchTargetKeyword(isActive ? '' : chip.query);
                    }}
                    className={`px-2 py-0.5 text-[9px] font-bold uppercase border transition-all cursor-pointer ${
                      isActive
                        ? 'bg-amber-900 text-white border-amber-900 shadow-xs'
                        : chip.isHighlight
                        ? 'bg-amber-50/80 hover:bg-amber-100 text-amber-950 border-amber-300'
                        : 'bg-white hover:bg-gray-100 text-gray-700 border-gray-300'
                    }`}
                  >
                    <span>{chip.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Bottom Row: Sentiment Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#e5e4e1]">
              <span className="text-[10px] text-gray-500 uppercase font-bold mr-1 flex items-center space-x-1 font-mono">
                <Filter className="w-3 h-3" />
                <span>Sentiment:</span>
              </span>

              {(['ALL', 'BULLISH', 'CATALYST', 'BEARISH', 'NEUTRAL'] as const).map((sentiment) => {
                const count = sentimentCounts[sentiment] || 0;
                const isSelected = activeSentiment === sentiment;

                return (
                  <button
                    key={sentiment}
                    onClick={() => {
                      setStrategyPreset('ALL');
                      setActiveSentiment(sentiment);
                    }}
                    className={`px-2.5 py-1 text-[10px] font-mono font-bold uppercase transition-all cursor-pointer border flex items-center space-x-1.5 ${
                      isSelected
                        ? 'bg-[#1a1a1a] text-white border-black shadow-xs'
                        : 'bg-white text-gray-700 border-[#e5e4e1] hover:bg-gray-100'
                    }`}
                  >
                    <span>{sentiment}</span>
                    <span
                      className={`text-[9px] px-1 py-0.2 rounded-xs ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

          </div>

          {/* Animated Advanced Filter Drawer */}
          <AnimatePresence>
            {showAdvancedFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-[#f2efe9] border border-[#e5e4e1] p-4 space-y-4 font-mono text-xs shadow-inner">
                  {/* Grid of Multi-Dimensional Filters */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-3 border-b border-[#e5e4e1]">
                    
                    {/* 1. Catalyst Category Pill Filter */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold uppercase text-gray-700 flex items-center space-x-1">
                        <Layers className="w-3 h-3 text-amber-700" />
                        <span>Catalyst Category:</span>
                      </span>
                      <div className="flex flex-wrap items-center gap-1">
                        <button
                          onClick={() => {
                            setStrategyPreset('ALL');
                            setSelectedCatalystType('ALL');
                          }}
                          className={`px-2 py-0.5 text-[9px] font-bold uppercase border cursor-pointer ${
                            selectedCatalystType === 'ALL'
                              ? 'bg-[#1a1a1a] text-white border-black'
                              : 'bg-white text-gray-700 border-[#d5d4d0] hover:bg-gray-100'
                          }`}
                        >
                          All Categories
                        </button>
                        {availableCatalystTypes.map((type) => (
                          <button
                            key={type}
                            onClick={() => {
                              setStrategyPreset('ALL');
                              setSelectedCatalystType(type);
                            }}
                            className={`px-2 py-0.5 text-[9px] font-bold uppercase border cursor-pointer ${
                              selectedCatalystType === type
                                ? 'bg-[#1a1a1a] text-white border-black'
                                : 'bg-white text-gray-700 border-[#d5d4d0] hover:bg-gray-100'
                            }`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 2. Impact Score Tier Filter */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase text-gray-700 flex items-center space-x-1">
                          <Activity className="w-3 h-3 text-amber-700" />
                          <span>SEPA Impact Tier:</span>
                        </span>
                        <button
                          onClick={() => setShowImpactLegend(!showImpactLegend)}
                          className="text-[9px] text-amber-800 hover:text-black font-bold uppercase underline cursor-pointer"
                        >
                          {showImpactLegend ? 'Hide Legend' : 'Score Legend'}
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        {[
                          { id: 'ALL', label: 'All Scores' },
                          { id: 'CRITICAL', label: 'Critical (8.5+)' },
                          { id: 'HIGH_PLUS', label: 'High (7.0+)' },
                          { id: 'MODERATE_PLUS', label: 'Moderate (5.0+)' },
                          { id: 'MINOR', label: 'Minor (<5.0)' },
                        ].map((tier) => (
                          <button
                            key={tier.id}
                            onClick={() => {
                              setStrategyPreset('ALL');
                              setSelectedImpactTier(tier.id as any);
                            }}
                            className={`px-2 py-0.5 text-[9px] font-bold uppercase border cursor-pointer ${
                              selectedImpactTier === tier.id
                                ? 'bg-[#1a1a1a] text-white border-black'
                                : 'bg-white text-gray-700 border-[#d5d4d0] hover:bg-gray-100'
                            }`}
                          >
                            <span>{tier.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 3. Trade Plan Zone Mapping Filter */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold uppercase text-gray-700 flex items-center space-x-1">
                        <Target className="w-3 h-3 text-emerald-700" />
                        <span>Trade Plan Binding:</span>
                      </span>
                      <div className="flex flex-wrap items-center gap-1">
                        {[
                          { id: 'ALL', label: 'All Headlines' },
                          { id: 'MAPPED_ONLY', label: 'Mapped Only' },
                          { id: 'TARGET_1', label: 'Target 1 Driver' },
                          { id: 'TARGET_2', label: 'Target 2 Runner' },
                          { id: 'STOP_LOSS', label: 'Stop Invalidation' },
                          { id: 'UNMAPPED', label: 'Unmapped' },
                        ].map((z) => (
                          <button
                            key={z.id}
                            onClick={() => {
                              setStrategyPreset('ALL');
                              setSelectedZoneMapping(z.id as any);
                            }}
                            className={`px-2 py-0.5 text-[9px] font-bold uppercase border cursor-pointer ${
                              selectedZoneMapping === z.id
                                ? 'bg-[#1a1a1a] text-white border-black'
                                : 'bg-white text-gray-700 border-[#d5d4d0] hover:bg-gray-100'
                            }`}
                          >
                            <span>{z.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 4. Date Recency Window Filter */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold uppercase text-gray-700 flex items-center space-x-1">
                        <Calendar className="w-3 h-3 text-blue-700" />
                        <span>Date Recency Window:</span>
                      </span>
                      <div className="flex flex-wrap items-center gap-1">
                        {[
                          { id: 'ALL', label: 'All Dates' },
                          { id: '24H', label: 'Past 24h' },
                          { id: '3D', label: 'Past 3 Days' },
                          { id: '7D', label: 'Past 7 Days' },
                          { id: '30D', label: 'Past 30 Days' },
                        ].map((r) => (
                          <button
                            key={r.id}
                            onClick={() => {
                              setStrategyPreset('ALL');
                              setSelectedRecency(r.id as any);
                            }}
                            className={`px-2 py-0.5 text-[9px] font-bold uppercase border cursor-pointer ${
                              selectedRecency === r.id
                                ? 'bg-[#1a1a1a] text-white border-black'
                                : 'bg-white text-gray-700 border-[#d5d4d0] hover:bg-gray-100'
                            }`}
                          >
                            <span>{r.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 5. Publisher / Source Filter */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold uppercase text-gray-700 flex items-center space-x-1">
                        <Building2 className="w-3 h-3 text-indigo-700" />
                        <span>News Publisher Source:</span>
                      </span>
                      <select
                        value={selectedSource}
                        onChange={(e) => {
                          setStrategyPreset('ALL');
                          setSelectedSource(e.target.value);
                        }}
                        className="w-full bg-white border border-[#d5d4d0] px-2 py-1 text-[10px] font-mono font-bold uppercase focus:outline-none"
                      >
                        <option value="ALL">All Publishers ({availableSources.length} sources)</option>
                        {availableSources.map((source) => (
                          <option key={source} value={source}>
                            {source}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 6. Sorting Order */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold uppercase text-gray-700 flex items-center space-x-1">
                        <ListFilter className="w-3 h-3 text-purple-700" />
                        <span>Sort Headlines By:</span>
                      </span>
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="w-full bg-white border border-[#d5d4d0] px-2 py-1 text-[10px] font-mono font-bold uppercase focus:outline-none"
                      >
                        <option value="impact">Highest SEPA Impact Score (10.0 → 1.0)</option>
                        <option value="recent">Most Recent Date</option>
                        <option value="oldest">Oldest Date</option>
                        <option value="sentiment">Sentiment (Catalysts First)</option>
                        <option value="alpha">Alphabetical (A → Z)</option>
                      </select>
                    </div>

                  </div>

                  {/* Impact Legend Accordion */}
                  {showImpactLegend && (
                    <div className="bg-white p-3 border border-[#e5e4e1] space-y-2 text-[10px] font-sans">
                      <div className="font-mono font-bold text-gray-800 uppercase tracking-wider text-[10px]">
                        Mark Minervini SEPA Volatility Impact Score Methodology (1 - 10)
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 font-mono">
                        <div className="p-2 bg-rose-50 border border-rose-200">
                          <div className="font-black text-rose-800 flex items-center space-x-1">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            <span>8.5 – 10.0: CRITICAL</span>
                          </div>
                          <p className="font-sans text-gray-600 text-[11px] mt-0.5">
                            High-velocity catalysts (earnings beats/guidance, FDA approval, M&A) that trigger immediate institutional accumulation or multi-week breakouts.
                          </p>
                        </div>
                        <div className="p-2 bg-amber-50 border border-amber-200">
                          <div className="font-black text-amber-800 flex items-center space-x-1">
                            <Zap className="w-3 h-3 text-amber-600" />
                            <span>7.0 – 8.4: HIGH IMPACT</span>
                          </div>
                          <p className="font-sans text-gray-600 text-[11px] mt-0.5">
                            Major contract wins, product launches, analyst upgrades, or sector leadership shifts with strong volume expansion potential.
                          </p>
                        </div>
                        <div className="p-2 bg-blue-50 border border-blue-200">
                          <div className="font-black text-blue-800 flex items-center space-x-1">
                            <TrendingUp className="w-3 h-3 text-blue-600" />
                            <span>5.0 – 6.9: MODERATE</span>
                          </div>
                          <p className="font-sans text-gray-600 text-[11px] mt-0.5">
                            Industry updates, macro commentary, or regular quarterly presentations supporting background consolidation.
                          </p>
                        </div>
                        <div className="p-2 bg-gray-50 border border-gray-200">
                          <div className="font-black text-gray-700 flex items-center space-x-1">
                            <Activity className="w-3 h-3 text-gray-500" />
                            <span>1.0 – 4.9: MINOR</span>
                          </div>
                          <p className="font-sans text-gray-600 text-[11px] mt-0.5">
                            Routine PR, standard filing notices, or low-significance trading noise with minimal impact on VCP pattern formation.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Bottom Controls: Major Only & Auto-refresh & Clear */}
                  <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                    <div className="flex flex-wrap items-center gap-4">
                      {/* High-Impact / Major Only Toggle */}
                      <label className="flex items-center space-x-2 cursor-pointer select-none bg-white px-2.5 py-1 border border-[#d5d4d0]">
                        <input
                          type="checkbox"
                          checked={majorOnly}
                          onChange={(e) => {
                            setStrategyPreset('ALL');
                            setMajorOnly(e.target.checked);
                          }}
                          className="accent-amber-600"
                        />
                        <span className="text-[10px] font-bold uppercase text-amber-900 flex items-center space-x-1">
                          <Flame className="w-3 h-3 text-amber-600" />
                          <span>High-Impact Only (7.0+)</span>
                        </span>
                      </label>

                      {/* Auto-Refresh Frequency */}
                      <div className="flex items-center space-x-1.5">
                        <span className="text-[10px] text-gray-600 font-bold uppercase">Auto-Refresh:</span>
                        <select
                          value={autoRefreshInterval}
                          onChange={(e) => setAutoRefreshInterval(e.target.value as any)}
                          className="bg-white border border-[#d5d4d0] px-2 py-1 text-[10px] font-mono font-bold uppercase focus:outline-none"
                        >
                          <option value="off">Off (Manual)</option>
                          <option value="60s">Every 60s</option>
                          <option value="300s">Every 5m</option>
                        </select>
                      </div>
                    </div>

                    {/* Reset Button */}
                    {isFiltersActive && (
                      <button
                        onClick={resetAllFilters}
                        className="text-[10px] text-rose-700 hover:text-rose-900 font-bold uppercase underline cursor-pointer"
                      >
                        Reset All Filters
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Active Filter Tags Bar (Shows individual dismissible chips when filters are engaged) */}
          {isFiltersActive && (
            <div className="bg-amber-50/70 border border-amber-200/80 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-bold text-amber-900 uppercase flex items-center space-x-1">
                  <Filter className="w-3 h-3 text-amber-700" />
                  <span>Active Filters:</span>
                </span>

                {searchQuery.trim() && (
                  <span className="bg-white text-gray-900 border border-amber-300 px-2 py-0.5 rounded-xs flex items-center space-x-1 font-bold">
                    <span>Search: "{searchQuery}"</span>
                    <button onClick={() => setSearchQuery('')} className="hover:text-rose-600 cursor-pointer">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {activeSentiment !== 'ALL' && (
                  <span className="bg-white text-gray-900 border border-amber-300 px-2 py-0.5 rounded-xs flex items-center space-x-1 font-bold">
                    <span>Sentiment: {activeSentiment}</span>
                    <button onClick={() => setActiveSentiment('ALL')} className="hover:text-rose-600 cursor-pointer">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {selectedCatalystType !== 'ALL' && (
                  <span className="bg-white text-gray-900 border border-amber-300 px-2 py-0.5 rounded-xs flex items-center space-x-1 font-bold">
                    <span>Category: {selectedCatalystType}</span>
                    <button onClick={() => setSelectedCatalystType('ALL')} className="hover:text-rose-600 cursor-pointer">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {selectedImpactTier !== 'ALL' && (
                  <span className="bg-white text-gray-900 border border-amber-300 px-2 py-0.5 rounded-xs flex items-center space-x-1 font-bold">
                    <span>Impact: {selectedImpactTier}</span>
                    <button onClick={() => setSelectedImpactTier('ALL')} className="hover:text-rose-600 cursor-pointer">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {selectedSource !== 'ALL' && (
                  <span className="bg-white text-gray-900 border border-amber-300 px-2 py-0.5 rounded-xs flex items-center space-x-1 font-bold">
                    <span>Source: {selectedSource}</span>
                    <button onClick={() => setSelectedSource('ALL')} className="hover:text-rose-600 cursor-pointer">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {selectedZoneMapping !== 'ALL' && (
                  <span className="bg-white text-gray-900 border border-amber-300 px-2 py-0.5 rounded-xs flex items-center space-x-1 font-bold">
                    <span>Zone: {selectedZoneMapping}</span>
                    <button onClick={() => setSelectedZoneMapping('ALL')} className="hover:text-rose-600 cursor-pointer">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {selectedRecency !== 'ALL' && (
                  <span className="bg-white text-gray-900 border border-amber-300 px-2 py-0.5 rounded-xs flex items-center space-x-1 font-bold">
                    <span>Recency: {selectedRecency}</span>
                    <button onClick={() => setSelectedRecency('ALL')} className="hover:text-rose-600 cursor-pointer">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {majorOnly && (
                  <span className="bg-white text-gray-900 border border-amber-300 px-2 py-0.5 rounded-xs flex items-center space-x-1 font-bold">
                    <span>High Impact Only (7.0+)</span>
                    <button onClick={() => setMajorOnly(false)} className="hover:text-rose-600 cursor-pointer">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <span className="text-gray-600">
                  {filteredHeadlines.length} of {newsData.headlines.length} shown
                </span>
                <button
                  onClick={resetAllFilters}
                  className="text-rose-800 hover:text-black font-bold uppercase underline cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>
          )}

          {/* Active Filter Metrics Ribbon */}
          <div className="flex items-center justify-between text-[10px] font-mono text-gray-500 px-1">
            <div>
              <span>Displaying </span>
              <strong className="text-black">{filteredHeadlines.length}</strong>
              <span> of {newsData.headlines.length} grounded headlines</span>
              {isFiltersActive && (
                <span className="text-amber-800 font-bold ml-1">
                  ({newsData.headlines.length - filteredHeadlines.length} filtered out)
                </span>
              )}
            </div>

            {newsData.groundingQueries && newsData.groundingQueries.length > 0 && (
              <button
                onClick={() => setIsGroundingDrawerOpen(!isGroundingDrawerOpen)}
                className="flex items-center space-x-1.5 text-gray-600 hover:text-black cursor-pointer"
              >
                <Search className="w-3 h-3 text-amber-700" />
                <span>Grounded Query: "{newsData.groundingQueries[0]}"</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${isGroundingDrawerOpen ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Expandable Grounding Logs Drawer */}
      <AnimatePresence>
        {isGroundingDrawerOpen && newsData?.groundingQueries && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-[#1a1a1a] text-white p-4 font-mono text-xs space-y-2 border border-black">
              <div className="flex items-center justify-between pb-1 border-b border-white/20">
                <span className="text-[10px] uppercase font-bold text-amber-400 flex items-center space-x-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Google GenAI Live Search Grounding Logs</span>
                </span>
                <button
                  onClick={() => setIsGroundingDrawerOpen(false)}
                  className="text-gray-400 hover:text-white text-[10px] uppercase"
                >
                  Close
                </button>
              </div>
              <div className="space-y-1 text-[11px] text-gray-300">
                <div className="font-bold text-white">Search Queries Executed:</div>
                <ul className="list-disc list-inside space-y-0.5 text-amber-200">
                  {newsData.groundingQueries.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading State */}
      {loading && (
        <div className="p-8 text-center space-y-3 bg-[#f9f8f5] border border-[#e5e4e1]">
          <RefreshCw className="w-6 h-6 animate-spin text-[#1a1a1a] mx-auto" />
          <p className="text-xs font-mono font-bold text-[#1a1a1a] uppercase tracking-wider">
            Fetching latest Google Search grounded headlines for {stock.ticker}...
          </p>
          <p className="text-xs font-serif italic text-gray-500 max-w-md mx-auto">
            Analyzing current press releases, earnings releases, and Wall Street coverage to evaluate price catalyst alignment.
          </p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-mono flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => fetchTickerHeadlines(true)}
            className="underline font-bold text-rose-900 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Headlines Content */}
      {newsData && !loading && (
        <div className="space-y-5">
          
          {/* Executive Catalyst Summary Banner with Web Speech API Read Aloud */}
          {newsData.summary && (
            <div className="p-4 bg-amber-50/80 border border-amber-200/90 rounded-none space-y-2 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center space-x-2 text-xs font-bold text-amber-950 font-mono uppercase tracking-wider">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>Mark Minervini SEPA Price Catalyst Synthesis</span>
                </div>
                
                {/* Audio Read Aloud & Copy Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Read Aloud Button */}
                  <div className="flex items-center space-x-1 border border-amber-300 bg-white px-2 py-1 text-[10px] font-mono">
                    <button
                      onClick={() => handleSpeakText(newsData.summary, 'Executive Catalyst Synthesis')}
                      className="text-amber-900 hover:text-black font-bold uppercase flex items-center space-x-1 cursor-pointer"
                      title={isSpeaking && activeSpeechTitle === 'Executive Catalyst Synthesis' ? (isSpeechPaused ? 'Resume Speech' : 'Pause Speech') : 'Read summary aloud using Web Speech API'}
                    >
                      {isSpeaking && activeSpeechTitle === 'Executive Catalyst Synthesis' ? (
                        isSpeechPaused ? (
                          <>
                            <Play className="w-3.5 h-3.5 text-amber-600" />
                            <span>Resume</span>
                          </>
                        ) : (
                          <>
                            <Pause className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                            <span className="text-amber-700 font-bold">Listening...</span>
                          </>
                        )
                      ) : (
                        <>
                          <Volume2 className="w-3.5 h-3.5 text-amber-600" />
                          <span>Read Aloud</span>
                        </>
                      )}
                    </button>

                    {/* Stop button if currently playing */}
                    {isSpeaking && activeSpeechTitle === 'Executive Catalyst Synthesis' && (
                      <button
                        onClick={handleStopSpeech}
                        className="text-rose-700 hover:text-rose-900 pl-1.5 border-l border-amber-200 cursor-pointer"
                        title="Stop Audio"
                      >
                        <Square className="w-3 h-3 fill-rose-600 text-rose-600" />
                      </button>
                    )}

                    {/* Speech Speed Rate */}
                    <select
                      value={speechRate}
                      onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                      className="text-[9px] bg-amber-50 text-amber-900 border border-amber-200 ml-1 px-1 py-0.2 font-mono font-bold focus:outline-none cursor-pointer"
                      title="Speech Playback Speed"
                    >
                      <option value={0.8}>0.8x</option>
                      <option value={1.0}>1.0x</option>
                      <option value={1.2}>1.2x</option>
                    </select>
                  </div>

                  {/* Copy Button */}
                  <button
                    onClick={handleShareBriefing}
                    className="text-[10px] font-mono text-amber-800 hover:text-black font-bold uppercase flex items-center space-x-1 cursor-pointer bg-white px-2 py-1 border border-amber-300"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </button>
                </div>
              </div>

              <p className="text-xs font-serif text-gray-800 leading-relaxed italic">
                "{newsData.summary}"
              </p>
            </div>
          )}

          {/* ========================================================================= */}
          {/* FEATURE: D3 30-Day News Sentiment Moving Average vs Price Action Visualization */}
          {/* ========================================================================= */}
          <NewsSentimentD3Chart
            stock={stock}
            headlines={newsData.headlines}
            onSelectDate={(dateStr) => {
              setSearchQuery(dateStr);
            }}
          />

          {/* ========================================================================= */}
          {/* FEATURE: In-Depth Sentiment Research & Keyword Intelligence Panel */}
          {/* ========================================================================= */}
          <AnimatePresence>
            {showSentimentResearch && (
              <motion.div
                id="sentiment-research-center"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
              >
                <SentimentResearchPanel
                  stock={stock}
                  headlines={newsData.headlines}
                  currentSearchQuery={researchTargetKeyword || searchQuery}
                  currencySymbol={currencySymbol}
                  onFilterByKeyword={(kw) => {
                    setSearchQuery(kw);
                    // scroll to headlines grid
                    const el = document.getElementById('headlines-grid-container');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* ========================================================================= */}
          {/* FEATURE: Mark Minervini SEPA Catalyst Profit Target & Stop Loss Zone Spectrum */}
          {/* ========================================================================= */}
          <div className="bg-[#fcfbf9] border-2 border-[#1a1a1a] p-4 shadow-sm space-y-3.5 font-mono">
            {/* Header row with Title & Interactive Adjuster Toggle */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e5e4e1] pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-black text-amber-400">
                  <Target className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-black uppercase text-[#1a1a1a] tracking-wider">
                      Catalyst Price Zone Architecture
                    </span>
                    <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-bold px-1.5 py-0.2">
                      SEPA Discipline
                    </span>
                  </div>
                  <p className="text-[11px] font-serif italic text-gray-600">
                    Define manual profit targets & stop loss invalidation price zones derived from recent news catalysts.
                  </p>
                </div>
              </div>

              {/* Action Buttons: Adjust Drawer Toggle, Reset, and Save status */}
              <div className="flex items-center space-x-2 text-xs">
                {zoneSaveFeedback && (
                  <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-1 flex items-center space-x-1 animate-pulse">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{zoneSaveFeedback}</span>
                  </span>
                )}

                <button
                  onClick={() => setIsZonePlannerOpen(!isZonePlannerOpen)}
                  className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider flex items-center space-x-1.5 transition-all cursor-pointer border ${
                    isZonePlannerOpen
                      ? 'bg-black text-white border-black shadow-inner'
                      : 'bg-white hover:bg-gray-100 text-black border-black shadow-xs'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5 text-amber-600" />
                  <span>{isZonePlannerOpen ? 'Close Zone Builder' : 'Adjust Zones & Targets'}</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${isZonePlannerOpen ? 'rotate-180' : ''}`} />
                </button>

                <button
                  onClick={handleResetZonesToDefault}
                  title="Reset price zones to default 20% target & 5% stop"
                  className="bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 p-1.5 text-[11px] transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Visual Multi-Zone Price Spectrum Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1 text-xs">
              
              {/* ZONE 1: STOP LOSS INVALIDATION ZONE */}
              <div className="p-3 bg-rose-50/90 border-2 border-rose-300 flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase text-rose-900 flex items-center space-x-1">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                    <span>Stop Loss Zone</span>
                  </span>
                  <span className="text-[10px] font-bold bg-rose-200/80 text-rose-950 px-1.5 py-0.2">
                    -{stopLoss.percentRisk}% Max Risk
                  </span>
                </div>

                <div className="space-y-0.5">
                  <div className="text-xl font-black text-rose-950 font-mono tracking-tight">
                    {currencySymbol}{stopLoss.price.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-rose-800 font-sans">
                    Max capital risk: -{currencySymbol}{(entryPrice - stopLoss.price).toFixed(2)} / share
                  </div>
                </div>

                {stopLoss.associatedHeadlineTitle ? (
                  <div className="text-[9px] bg-white/80 p-1.5 border border-rose-200 text-rose-900 truncate">
                    <span className="font-bold">Invalidation News: </span>
                    <span className="italic">"{stopLoss.associatedHeadlineTitle}"</span>
                  </div>
                ) : (
                  <div className="text-[9px] text-rose-700/80 italic">
                    {stopLoss.invalidationThesis || 'Hard stop under pivot support'}
                  </div>
                )}
              </div>

              {/* ZONE 2: ENTRY / LIVE PIVOT ANCHOR */}
              <div className="p-3 bg-slate-900 text-white border-2 border-black flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase text-amber-400 flex items-center space-x-1">
                    <Crosshair className="w-3.5 h-3.5 text-amber-400" />
                    <span>Pivot / Entry Anchor</span>
                  </span>
                  <span className="text-[10px] font-bold bg-white/10 text-gray-300 px-1.5 py-0.2">
                    Base Reference
                  </span>
                </div>

                <div className="space-y-0.5">
                  <div className="text-xl font-black text-white font-mono tracking-tight">
                    {currencySymbol}{entryPrice.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-gray-300 font-sans">
                    Live Market Price: <span className="text-amber-300 font-bold">{currencySymbol}{stock.currentPrice.toFixed(2)}</span>
                  </div>
                </div>

                <div className="text-[9px] text-gray-400 font-sans">
                  {stock.currentPrice >= entryPrice ? (
                    <span className="text-emerald-400 font-bold">
                      Trading +{(((stock.currentPrice - entryPrice) / entryPrice) * 100).toFixed(1)}% above pivot
                    </span>
                  ) : (
                    <span className="text-amber-400 font-bold">
                      Coiling {(((entryPrice - stock.currentPrice) / entryPrice) * 100).toFixed(1)}% below breakout pivot
                    </span>
                  )}
                </div>
              </div>

              {/* ZONE 3: PROFIT TARGET 1 (BASE BREAKOUT) */}
              <div className="p-3 bg-emerald-50/90 border-2 border-emerald-300 flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase text-emerald-900 flex items-center space-x-1">
                    <Target className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Profit Target 1</span>
                  </span>
                  <span className="text-[10px] font-bold bg-emerald-200/80 text-emerald-950 px-1.5 py-0.2">
                    +{target1.percentGain}% ({rewardRiskT1.ratio}:1 R/R)
                  </span>
                </div>

                <div className="space-y-0.5">
                  <div className="text-xl font-black text-emerald-950 font-mono tracking-tight">
                    {currencySymbol}{target1.price.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-emerald-800 font-sans">
                    Potential gain: +{currencySymbol}{(target1.price - entryPrice).toFixed(2)} / share
                  </div>
                </div>

                {target1.associatedHeadlineTitle ? (
                  <div className="text-[9px] bg-white/80 p-1.5 border border-emerald-200 text-emerald-900 truncate">
                    <span className="font-bold">Catalyst Driver: </span>
                    <span className="italic">"{target1.associatedHeadlineTitle}"</span>
                  </div>
                ) : (
                  <div className="text-[9px] text-emerald-700/80 italic">
                    Minervini 20-25% standard momentum partial take-profit
                  </div>
                )}
              </div>

              {/* ZONE 4: PROFIT TARGET 2 (CATALYST RUNNER) */}
              <div className="p-3 bg-cyan-50/90 border-2 border-cyan-300 flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase text-cyan-900 flex items-center space-x-1">
                    <Flame className="w-3.5 h-3.5 text-cyan-600" />
                    <span>Profit Target 2 (Runner)</span>
                  </span>
                  <span className="text-[10px] font-bold bg-cyan-200/80 text-cyan-950 px-1.5 py-0.2">
                    +{target2.percentGain}% ({rewardRiskT2.ratio}:1 R/R)
                  </span>
                </div>

                <div className="space-y-0.5">
                  <div className="text-xl font-black text-cyan-950 font-mono tracking-tight">
                    {currencySymbol}{target2.price.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-cyan-800 font-sans">
                    Potential gain: +{currencySymbol}{(target2.price - entryPrice).toFixed(2)} / share
                  </div>
                </div>

                {target2.associatedHeadlineTitle ? (
                  <div className="text-[9px] bg-white/80 p-1.5 border border-cyan-200 text-cyan-900 truncate">
                    <span className="font-bold">Catalyst Driver: </span>
                    <span className="italic">"{target2.associatedHeadlineTitle}"</span>
                  </div>
                ) : (
                  <div className="text-[9px] text-cyan-700/80 italic">
                    Multi-week institutional runner powered by fundamental beat
                  </div>
                )}
              </div>

            </div>

            {/* SEPA Asymmetric Discipline Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-white border border-[#e5e4e1] text-[11px]">
              <div className="flex items-center space-x-2">
                <Scale className="w-4 h-4 text-amber-700" />
                <span className="font-bold text-gray-800 uppercase">SEPA Risk/Reward Asymmetry:</span>
                <span className="font-black text-black">
                  Target 1: <strong className="text-emerald-700">{rewardRiskT1.ratio} : 1</strong> | Target 2: <strong className="text-cyan-700">{rewardRiskT2.ratio} : 1</strong>
                </span>
              </div>

              <div className="flex items-center space-x-2">
                {rewardRiskT1.isValidSEPA ? (
                  <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 font-bold uppercase text-[10px] flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                    <span>Valid SEPA Asymmetric R/R (≥ 2.5:1)</span>
                  </span>
                ) : (
                  <span className="bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 font-bold uppercase text-[10px] flex items-center space-x-1">
                    <AlertTriangle className="w-3 h-3 text-amber-700" />
                    <span>Sub-optimal R/R (&lt; 2.5:1) — Tighten Stop or Extend Target</span>
                  </span>
                )}
              </div>
            </div>

            {/* ============================================================= */}
            {/* EXPANDABLE INTERACTIVE ZONE BUILDER & SLIDER WORKBENCH */}
            {/* ============================================================= */}
            <AnimatePresence>
              {isZonePlannerOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden pt-2 space-y-3.5 border-t border-dashed border-gray-300 font-mono"
                >
                  <div className="p-4 bg-white border border-gray-300 space-y-4 shadow-2xs">
                    
                    {/* Presets Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-black uppercase text-black flex items-center space-x-1.5">
                        <SlidersHorizontal className="w-3.5 h-3.5 text-amber-600" />
                        <span>Quick Mark Minervini Setup Presets:</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                        <button
                          onClick={() => handleApplyPreset('MINERVINI_STANDARD')}
                          className="bg-[#f9f8f5] hover:bg-black hover:text-white text-gray-800 border border-gray-300 px-2.5 py-1 font-bold uppercase transition-all cursor-pointer"
                        >
                          ⚡ Standard (+20% / -5%)
                        </button>
                        <button
                          onClick={() => handleApplyPreset('CATALYST_POWER')}
                          className="bg-[#f9f8f5] hover:bg-black hover:text-white text-gray-800 border border-gray-300 px-2.5 py-1 font-bold uppercase transition-all cursor-pointer"
                        >
                          🚀 Catalyst Power (+25% / +45%)
                        </button>
                        <button
                          onClick={() => handleApplyPreset('TIGHT_DEFENSE')}
                          className="bg-[#f9f8f5] hover:bg-black hover:text-white text-gray-800 border border-gray-300 px-2.5 py-1 font-bold uppercase transition-all cursor-pointer"
                        >
                          🛡️ Tight Defense (+15% / -3.5%)
                        </button>
                        <button
                          onClick={() => handleApplyPreset('EARNINGS_SURGE')}
                          className="bg-[#f9f8f5] hover:bg-black hover:text-white text-gray-800 border border-gray-300 px-2.5 py-1 font-bold uppercase transition-all cursor-pointer"
                        >
                          💥 Earnings Surge (+30% / +55%)
                        </button>
                      </div>
                    </div>

                    {/* Interactive Inputs & Sliders Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                      
                      {/* STOP LOSS CONFIGURATION */}
                      <div className="p-3 bg-rose-50/60 border border-rose-200 space-y-2.5">
                        <div className="flex items-center justify-between text-xs font-bold text-rose-950 uppercase">
                          <span className="flex items-center space-x-1">
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                            <span>Stop Loss</span>
                          </span>
                          <span className="font-mono text-rose-800">
                            -{stopLoss.percentRisk}%
                          </span>
                        </div>

                        {/* Price Input & Percent Slider */}
                        <div className="space-y-1.5">
                          <div className="flex items-center space-x-1">
                            <span className="text-xs text-gray-500 font-bold">{currencySymbol}</span>
                            <input
                              type="number"
                              step="0.10"
                              value={stopLoss.price}
                              onChange={(e) => handleUpdateStopLossByPrice(parseFloat(e.target.value) || 0)}
                              className="w-full bg-white border border-rose-300 px-2 py-1 text-xs font-mono font-bold text-rose-950 focus:outline-none"
                            />
                          </div>

                          <div className="flex items-center space-x-2 pt-1">
                            <span className="text-[9px] text-gray-500">Risk %:</span>
                            <input
                              type="range"
                              min="1"
                              max="15"
                              step="0.5"
                              value={stopLoss.percentRisk}
                              onChange={(e) => handleUpdateStopLossByPercent(parseFloat(e.target.value))}
                              className="w-full accent-rose-600 h-1.5 bg-rose-200 cursor-pointer"
                            />
                            <span className="text-[10px] font-bold text-rose-900 w-8 text-right">
                              {stopLoss.percentRisk}%
                            </span>
                          </div>
                        </div>

                        {/* Invalidation notes input */}
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase text-gray-600">Invalidation Thesis:</label>
                          <input
                            type="text"
                            value={stopLoss.invalidationThesis || ''}
                            placeholder="e.g. Violation of 20-day SMA or base low"
                            onChange={(e) => {
                              const updated: HeadlinePriceZonePlan = {
                                ...priceZonePlan,
                                stopLoss: { ...stopLoss, invalidationThesis: e.target.value },
                              };
                              setPriceZonePlan(updated);
                              savePriceZonePlan(updated);
                            }}
                            className="w-full bg-white border border-rose-200 px-2 py-1 text-[10px] font-sans text-gray-800 focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* PROFIT TARGET 1 CONFIGURATION */}
                      <div className="p-3 bg-emerald-50/60 border border-emerald-200 space-y-2.5">
                        <div className="flex items-center justify-between text-xs font-bold text-emerald-950 uppercase">
                          <span className="flex items-center space-x-1">
                            <Target className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Target 1 (Base)</span>
                          </span>
                          <span className="font-mono text-emerald-800">
                            +{target1.percentGain}%
                          </span>
                        </div>

                        {/* Price Input & Percent Slider */}
                        <div className="space-y-1.5">
                          <div className="flex items-center space-x-1">
                            <span className="text-xs text-gray-500 font-bold">{currencySymbol}</span>
                            <input
                              type="number"
                              step="0.10"
                              value={target1.price}
                              onChange={(e) => handleUpdateTarget1ByPrice(parseFloat(e.target.value) || 0)}
                              className="w-full bg-white border border-emerald-300 px-2 py-1 text-xs font-mono font-bold text-emerald-950 focus:outline-none"
                            />
                          </div>

                          <div className="flex items-center space-x-2 pt-1">
                            <span className="text-[9px] text-gray-500">Gain %:</span>
                            <input
                              type="range"
                              min="5"
                              max="80"
                              step="1"
                              value={target1.percentGain}
                              onChange={(e) => handleUpdateTarget1ByPercent(parseFloat(e.target.value))}
                              className="w-full accent-emerald-600 h-1.5 bg-emerald-200 cursor-pointer"
                            />
                            <span className="text-[10px] font-bold text-emerald-900 w-8 text-right">
                              {target1.percentGain}%
                            </span>
                          </div>
                        </div>

                        {/* Catalyst rationale input */}
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase text-gray-600">Catalyst Rationale:</label>
                          <input
                            type="text"
                            value={target1.catalystRationale || ''}
                            placeholder="e.g. Standard 20% momentum take profit"
                            onChange={(e) => {
                              const updatedTargets = [...priceZonePlan.profitTargets];
                              updatedTargets[0] = { ...target1, catalystRationale: e.target.value };
                              const updated: HeadlinePriceZonePlan = { ...priceZonePlan, profitTargets: updatedTargets };
                              setPriceZonePlan(updated);
                              savePriceZonePlan(updated);
                            }}
                            className="w-full bg-white border border-emerald-200 px-2 py-1 text-[10px] font-sans text-gray-800 focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* PROFIT TARGET 2 CONFIGURATION */}
                      <div className="p-3 bg-cyan-50/60 border border-cyan-200 space-y-2.5">
                        <div className="flex items-center justify-between text-xs font-bold text-cyan-950 uppercase">
                          <span className="flex items-center space-x-1">
                            <Flame className="w-3.5 h-3.5 text-cyan-600" />
                            <span>Target 2 (Runner)</span>
                          </span>
                          <span className="font-mono text-cyan-800">
                            +{target2.percentGain}%
                          </span>
                        </div>

                        {/* Price Input & Percent Slider */}
                        <div className="space-y-1.5">
                          <div className="flex items-center space-x-1">
                            <span className="text-xs text-gray-500 font-bold">{currencySymbol}</span>
                            <input
                              type="number"
                              step="0.10"
                              value={target2.price}
                              onChange={(e) => handleUpdateTarget2ByPrice(parseFloat(e.target.value) || 0)}
                              className="w-full bg-white border border-cyan-300 px-2 py-1 text-xs font-mono font-bold text-cyan-950 focus:outline-none"
                            />
                          </div>

                          <div className="flex items-center space-x-2 pt-1">
                            <span className="text-[9px] text-gray-500">Gain %:</span>
                            <input
                              type="range"
                              min="10"
                              max="150"
                              step="1"
                              value={target2.percentGain}
                              onChange={(e) => handleUpdateTarget2ByPercent(parseFloat(e.target.value))}
                              className="w-full accent-cyan-600 h-1.5 bg-cyan-200 cursor-pointer"
                            />
                            <span className="text-[10px] font-bold text-cyan-900 w-8 text-right">
                              {target2.percentGain}%
                            </span>
                          </div>
                        </div>

                        {/* Catalyst rationale input */}
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase text-gray-600">Runner Catalyst:</label>
                          <input
                            type="text"
                            value={target2.catalystRationale || ''}
                            placeholder="e.g. Multi-month institutional accumulation"
                            onChange={(e) => {
                              const updatedTargets = [...priceZonePlan.profitTargets];
                              if (!updatedTargets[1]) {
                                updatedTargets[1] = {
                                  id: 'target-2',
                                  label: 'Target 2',
                                  price: target2.price,
                                  percentGain: target2.percentGain,
                                  catalystRationale: e.target.value,
                                  status: 'ACTIVE',
                                };
                              } else {
                                updatedTargets[1] = { ...updatedTargets[1], catalystRationale: e.target.value };
                              }
                              const updated: HeadlinePriceZonePlan = { ...priceZonePlan, profitTargets: updatedTargets };
                              setPriceZonePlan(updated);
                              savePriceZonePlan(updated);
                            }}
                            className="w-full bg-white border border-cyan-200 px-2 py-1 text-[10px] font-sans text-gray-800 focus:outline-none"
                          />
                        </div>
                      </div>

                    </div>

                    {/* Footer advice */}
                    <div className="text-[10px] text-gray-500 font-sans italic border-t border-gray-200 pt-2 flex flex-wrap items-center justify-between gap-2">
                      <span>
                        Tip: Click <strong>"Map Target/Stop Zones"</strong> on any headline card below to instantly bind that specific news event as the primary catalyst driver.
                      </span>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={handleDownloadReport}
                          title="Export current news and trade plan as JSON"
                          className="bg-white hover:bg-gray-100 text-gray-800 border border-gray-300 px-2.5 py-1 text-[10px] font-bold uppercase font-mono cursor-pointer flex items-center space-x-1"
                        >
                          <Download className="w-3 h-3 text-emerald-700" />
                          <span>Export JSON</span>
                        </button>
                        <button
                          onClick={() => {
                            savePriceZonePlan(priceZonePlan);
                            setZoneSaveFeedback('Saved Price Zone Plan!');
                            setTimeout(() => setZoneSaveFeedback(null), 2500);
                          }}
                          className="bg-black hover:bg-gray-800 text-white px-3 py-1 text-[10px] font-bold uppercase font-mono cursor-pointer flex items-center space-x-1"
                        >
                          <Save className="w-3 h-3 text-amber-400" />
                          <span>Save Plan</span>
                        </button>
                      </div>
                    </div>

                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Animated Headlines Grid with motion layout */}
          <motion.div layout id="headlines-grid-container" className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatePresence mode="popLayout">
              {filteredHeadlines.map((headline, idx) => {
                const isBullish = headline.sentiment === 'BULLISH';
                const isCatalyst = headline.sentiment === 'CATALYST';
                const isBearish = headline.sentiment === 'BEARISH';
                const isExpanded = !!expandedHeadlines[idx] || isAllExpanded;
                const isCopied = copiedHeadlineIdx === idx;

                const impactScore = getHeadlineImpactScore(headline);
                const impactConfig = getImpactScoreConfig(impactScore);
                const impactPercentage = Math.min(100, Math.max(10, (impactScore / 10) * 100));
                const volatilityTriggers = getHeadlineVolatilityTriggers(headline);
                const isHighVolatilityEvent = impactScore >= 7.0 || headline.isMajorEvent;

                // Check if this headline has been tagged to a specific zone
                const headlineTag = priceZonePlan.headlineTags?.[headline.title];
                const isTarget1Driver = headlineTag === 'TARGET_DRIVER' || target1.associatedHeadlineTitle === headline.title;
                const isTarget2Driver = headlineTag === 'BULLISH_CATALYST' || target2.associatedHeadlineTitle === headline.title;
                const isStopInvalidation = headlineTag === 'STOP_INVALIDATION' || stopLoss.associatedHeadlineTitle === headline.title;

                const isZoneCardOpen = activeHeadlineZoneCardIdx === idx;

                return (
                  <motion.div
                    key={`${headline.title}-${idx}`}
                    layout
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.2 }}
                    className={`bg-[#f9f8f5] border border-l-4 transition-all shadow-2xs flex flex-col justify-between ${
                      impactConfig.leftBorderColor
                    } ${
                      isTarget1Driver
                        ? 'border-emerald-500 bg-emerald-50/20 ring-1 ring-emerald-500/20'
                        : isTarget2Driver
                        ? 'border-cyan-500 bg-cyan-50/20 ring-1 ring-cyan-500/20'
                        : isStopInvalidation
                        ? 'border-rose-500 bg-rose-50/20 ring-1 ring-rose-500/20'
                        : isHighVolatilityEvent
                        ? 'border-[#e5e4e1] hover:border-black ring-1 ring-rose-500/10'
                        : isExpanded
                        ? 'border-[#1a1a1a] bg-white ring-1 ring-black/5'
                        : 'border-[#e5e4e1] hover:border-black'
                    }`}
                  >
                    {/* Card Top Area */}
                    <div className="p-4 space-y-2.5">
                      
                      {/* Meta header: Source, Date, Copy Icon, Expand Icon */}
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-bold text-gray-700 uppercase tracking-wider flex items-center space-x-1">
                            <Globe className="w-3 h-3 text-gray-400" />
                            <span>{headline.source}</span>
                          </span>
                          <span className="text-gray-300">·</span>
                          <span className={`px-1.5 py-0.2 text-[9px] font-extrabold uppercase border ${
                            isBullish
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : isCatalyst
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : isBearish
                              ? 'bg-rose-50 text-rose-800 border-rose-200'
                              : 'bg-gray-100 text-gray-700 border-gray-200'
                          }`}>
                            {headline.sentiment}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          {/* Run Sentiment Research on this specific headline / catalyst */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const queryTerm = headline.catalystType || headline.title.split(' ')[0] || stock.ticker;
                              setResearchTargetKeyword(queryTerm);
                              setShowSentimentResearch(true);
                              const el = document.getElementById('sentiment-research-center');
                              if (el) el.scrollIntoView({ behavior: 'smooth' });
                            }}
                            title="Run Sentiment Research on this headline topic"
                            className="text-[9px] text-amber-800 hover:text-black font-bold uppercase flex items-center space-x-0.5 cursor-pointer bg-amber-50 px-1.5 py-0.5 border border-amber-200"
                          >
                            <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                            <span>Audit</span>
                          </button>

                          <span className="text-gray-400">{headline.date}</span>
                          
                          {/* Read Aloud Single Headline */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSpeakText(`${headline.title}. Published by ${headline.source}. ${headline.snippet}`, `Headline ${idx + 1}`);
                            }}
                            title={isSpeaking && activeSpeechTitle === `Headline ${idx + 1}` ? 'Pause / Stop Audio' : 'Read headline aloud'}
                            className={`p-0.5 transition-colors cursor-pointer ${
                              isSpeaking && activeSpeechTitle === `Headline ${idx + 1}`
                                ? 'text-amber-600 animate-pulse'
                                : 'text-gray-400 hover:text-amber-700'
                            }`}
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Copy single button */}
                          <button
                            onClick={(e) => handleCopySingleHeadline(headline, idx, e)}
                            title="Copy headline takeaway and impact score"
                            className="text-gray-400 hover:text-black transition-colors p-0.5 cursor-pointer"
                          >
                            {isCopied ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Headline Title and Color-Coded Impact Score Badges */}
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {/* Prominent Color-Coded Impact Score Badge */}
                          <span
                            className={`inline-flex items-center space-x-1.5 px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider border shadow-2xs ${impactConfig.badgeBg}`}
                            title={`Volatility Impact: ${impactScore.toFixed(1)}/10 (${impactConfig.label}) - ${impactConfig.description}`}
                          >
                            <impactConfig.icon className={`w-3 h-3 ${impactConfig.iconColor} ${impactScore >= 8.5 ? 'animate-pulse' : ''}`} />
                            <span className="font-black">Impact {impactScore.toFixed(1)}</span>
                            <span className="opacity-60 text-[9px]">/10</span>
                            <span className="font-extrabold border-l pl-1.5 ml-0.5 border-current/25 text-[9px]">
                              {impactConfig.shortLabel}
                            </span>
                          </span>

                          {/* Detected Catalyst Keyword Tag if matched */}
                          {volatilityTriggers.map((trig, tIdx) => (
                            <span
                              key={tIdx}
                              className="inline-flex items-center space-x-1 px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider bg-white border border-gray-300 text-gray-800 shadow-2xs"
                              title={`Detected High-Volatility Catalyst Trigger: ${trig}`}
                            >
                              <Zap className="w-2.5 h-2.5 text-amber-600" />
                              <span>{highlightMatchedText(trig, searchQuery)}</span>
                            </span>
                          ))}

                          {/* High Volatility Event Badge */}
                          {isHighVolatilityEvent && (
                            <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 text-[9px] font-mono font-extrabold uppercase tracking-wider bg-rose-100 text-rose-900 border border-rose-300">
                              <Flame className="w-2.5 h-2.5 text-rose-600 animate-pulse" />
                              <span>High Volatility Event</span>
                            </span>
                          )}

                          {/* Zone Mapping Badges if tagged */}
                          {isTarget1Driver && (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 text-[9px] font-mono font-black uppercase bg-emerald-600 text-white shadow-xs">
                              <Target className="w-2.5 h-2.5" />
                              <span>Target 1 Driver (+{target1.percentGain}%)</span>
                            </span>
                          )}

                          {isTarget2Driver && (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 text-[9px] font-mono font-black uppercase bg-cyan-600 text-white shadow-xs">
                              <Flame className="w-2.5 h-2.5" />
                              <span>Target 2 Driver (+{target2.percentGain}%)</span>
                            </span>
                          )}

                          {isStopInvalidation && (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 text-[9px] font-mono font-black uppercase bg-rose-600 text-white shadow-xs">
                              <ShieldAlert className="w-2.5 h-2.5" />
                              <span>Stop Invalidation (-{stopLoss.percentRisk}%)</span>
                            </span>
                          )}
                        </div>

                        {/* Title with inline Impact Pill next to the headline */}
                        <div className="flex items-start gap-2">
                          <span
                            className={`shrink-0 inline-flex items-center space-x-1 px-1.5 py-0.5 text-[10px] font-mono font-black uppercase rounded-xs border mt-0.5 cursor-help ${impactConfig.titlePillBg}`}
                            title={`SEPA Volatility Impact Score: ${impactScore.toFixed(1)}/10 (${impactConfig.label}) - ${impactConfig.description}`}
                          >
                            <impactConfig.icon className={`w-2.5 h-2.5 text-white ${impactScore >= 8.5 ? 'animate-pulse' : ''}`} />
                            <span>{impactScore.toFixed(1)}</span>
                          </span>
                          <h4
                            onClick={() => toggleHeadlineExpand(idx)}
                            className="text-sm font-serif font-black text-[#1a1a1a] leading-tight cursor-pointer hover:text-amber-800 transition-colors flex-1"
                          >
                            <span>{highlightMatchedText(headline.title, searchQuery)}</span>
                          </h4>
                        </div>
                      </div>

                      {/* Snippet preview / full text */}
                      <p className="text-xs font-sans text-gray-600 leading-normal">
                        {highlightMatchedText(headline.snippet, searchQuery)}
                      </p>

                      {/* ============================================================= */}
                      {/* MINI VISUAL PRICE ZONE STRIP ON CARD */}
                      {/* ============================================================= */}
                      <div className="p-2 bg-white border border-[#e5e4e1] space-y-1 font-mono text-[10px]">
                        <div className="flex items-center justify-between text-gray-500 font-bold">
                          <span className="text-rose-700">Stop {currencySymbol}{stopLoss.price.toFixed(2)} (-{stopLoss.percentRisk}%)</span>
                          <span className="text-slate-800">Pivot {currencySymbol}{entryPrice.toFixed(2)}</span>
                          <span className="text-emerald-700">Target 1 {currencySymbol}{target1.price.toFixed(2)} (+{target1.percentGain}%)</span>
                        </div>
                        {/* Mini Visual Color Range Bar */}
                        <div className="w-full h-1.5 bg-gray-100 flex overflow-hidden rounded-xs border border-gray-200">
                          <div className="w-1/4 bg-rose-400" title={`Stop Loss Zone: ${currencySymbol}${stopLoss.price}`} />
                          <div className="w-1/4 bg-slate-700" title={`Pivot Entry Anchor: ${currencySymbol}${entryPrice}`} />
                          <div className="w-1/4 bg-emerald-500" title={`Target 1 Zone: ${currencySymbol}${target1.price}`} />
                          <div className="w-1/4 bg-cyan-500" title={`Target 2 Runner Zone: ${currencySymbol}${target2.price}`} />
                        </div>
                      </div>

                      {/* ============================================================= */}
                      {/* INLINE HEADLINE-TO-ZONE QUICK MAPPER DRAWER */}
                      {/* ============================================================= */}
                      <AnimatePresence>
                        {isZoneCardOpen && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden p-2.5 bg-[#f5f3ec] border border-amber-300 font-mono text-xs space-y-2"
                          >
                            <div className="flex items-center justify-between text-[10px] font-bold uppercase text-amber-950">
                              <span className="flex items-center space-x-1">
                                <Target className="w-3 h-3 text-amber-700" />
                                <span>Define Price Zones Based on this Headline:</span>
                              </span>
                              <button
                                onClick={() => setActiveHeadlineZoneCardIdx(null)}
                                className="text-gray-500 hover:text-black font-bold uppercase"
                              >
                                ✕
                              </button>
                            </div>

                            {/* Headline-driven Zone Assignment Buttons */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-[10px]">
                              <button
                                onClick={() => {
                                  handleTagHeadlineToZone(headline, 'TARGET_1', 20);
                                  setActiveHeadlineZoneCardIdx(null);
                                }}
                                className={`p-1.5 border font-bold uppercase text-left transition-all cursor-pointer ${
                                  isTarget1Driver
                                    ? 'bg-emerald-600 text-white border-emerald-700'
                                    : 'bg-white hover:bg-emerald-50 text-emerald-900 border-emerald-300'
                                }`}
                              >
                                <div className="font-extrabold flex items-center space-x-1">
                                  <Target className="w-3 h-3" />
                                  <span>Set as Target 1</span>
                                </div>
                                <div className="text-[9px] opacity-80 mt-0.5">
                                  +{target1.percentGain}% ({currencySymbol}{target1.price.toFixed(2)})
                                </div>
                              </button>

                              <button
                                onClick={() => {
                                  handleTagHeadlineToZone(headline, 'TARGET_2', 35);
                                  setActiveHeadlineZoneCardIdx(null);
                                }}
                                className={`p-1.5 border font-bold uppercase text-left transition-all cursor-pointer ${
                                  isTarget2Driver
                                    ? 'bg-cyan-600 text-white border-cyan-700'
                                    : 'bg-white hover:bg-cyan-50 text-cyan-900 border-cyan-300'
                                }`}
                              >
                                <div className="font-extrabold flex items-center space-x-1">
                                  <Flame className="w-3 h-3" />
                                  <span>Set as Target 2</span>
                                </div>
                                <div className="text-[9px] opacity-80 mt-0.5">
                                  +{target2.percentGain}% ({currencySymbol}{target2.price.toFixed(2)})
                                </div>
                              </button>

                              <button
                                onClick={() => {
                                  handleTagHeadlineToZone(headline, 'STOP_LOSS', 5);
                                  setActiveHeadlineZoneCardIdx(null);
                                }}
                                className={`p-1.5 border font-bold uppercase text-left transition-all cursor-pointer ${
                                  isStopInvalidation
                                    ? 'bg-rose-600 text-white border-rose-700'
                                    : 'bg-white hover:bg-rose-50 text-rose-900 border-rose-300'
                                }`}
                              >
                                <div className="font-extrabold flex items-center space-x-1">
                                  <ShieldAlert className="w-3 h-3" />
                                  <span>Set Invalidation</span>
                                </div>
                                <div className="text-[9px] opacity-80 mt-0.5">
                                  -{stopLoss.percentRisk}% ({currencySymbol}{stopLoss.price.toFixed(2)})
                                </div>
                              </button>
                            </div>

                            {/* Quick percentage adjustment chips */}
                            <div className="flex flex-wrap items-center gap-1 text-[9px] pt-1">
                              <span className="text-gray-500 font-bold uppercase">Quick Targets:</span>
                              {[15, 20, 25, 30, 40].map((pct) => (
                                <button
                                  key={pct}
                                  onClick={() => {
                                    handleTagHeadlineToZone(headline, 'TARGET_1', pct);
                                    setActiveHeadlineZoneCardIdx(null);
                                  }}
                                  className="bg-white hover:bg-black hover:text-white border border-gray-300 px-1.5 py-0.5 font-bold uppercase cursor-pointer"
                                >
                                  +{pct}%
                                </button>
                              ))}

                              {(isTarget1Driver || isTarget2Driver || isStopInvalidation) && (
                                <button
                                  onClick={() => {
                                    handleTagHeadlineToZone(headline, 'CLEAR');
                                    setActiveHeadlineZoneCardIdx(null);
                                  }}
                                  className="text-rose-700 hover:text-rose-900 underline font-bold uppercase ml-auto cursor-pointer"
                                >
                                  Clear Mapping
                                </button>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Animated Expandable SEPA Details Section */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.25 }}
                            className="overflow-hidden pt-2.5 border-t border-dashed border-[#e5e4e1] space-y-2.5 font-mono text-xs"
                          >
                            {/* Volatility & Impact Meter */}
                            <div className="p-2.5 bg-white border border-[#e5e4e1] space-y-1.5">
                              <div className="flex items-center justify-between text-[10px] font-bold">
                                <span className="text-gray-600 uppercase flex items-center space-x-1">
                                  <Activity className="w-3 h-3 text-amber-600" />
                                  <span>Volatility Impact Rating:</span>
                                </span>
                                <span className={`font-extrabold ${impactConfig.textColor}`}>
                                  {impactScore.toFixed(1)} / 10 ({impactConfig.label})
                                </span>
                              </div>

                              {/* Visual Progress Bar */}
                              <div className="w-full h-1.5 bg-gray-200 overflow-hidden relative">
                                <div
                                  className={`h-full transition-all duration-500 ${
                                    impactScore >= 8.5
                                      ? 'bg-rose-600'
                                      : impactScore >= 7.0
                                      ? 'bg-amber-600'
                                      : impactScore >= 5.0
                                      ? 'bg-blue-600'
                                      : 'bg-gray-500'
                                  }`}
                                  style={{ width: `${impactPercentage}%` }}
                                />
                              </div>
                              <p className="text-[10px] font-sans text-gray-500 leading-tight">
                                {impactConfig.description}
                              </p>
                            </div>

                            {/* SEPA Impact Alignment */}
                            <div className="bg-[#f4f2ec] p-2.5 space-y-1">
                              <div className="flex items-center justify-between text-[10px] font-bold uppercase">
                                <span className="text-gray-700 flex items-center space-x-1">
                                  <Zap className="w-3 h-3 text-amber-600" />
                                  <span>SEPA Setup Significance</span>
                                </span>
                                <span
                                  className={`px-1.5 py-0.2 text-[9px] font-extrabold border ${impactConfig.bgColor} ${impactConfig.textColor} ${impactConfig.borderColor}`}
                                >
                                  {impactConfig.shortLabel} IMPACT
                                </span>
                              </div>
                              <p className="text-[11px] font-sans text-gray-700 leading-relaxed">
                                {isBullish || isCatalyst
                                  ? `Provides fundamental catalyst fuel to support Stage 2 accumulation and VCP pivot expansion above ${currencySymbol}${stock.pivotPrice}.`
                                  : `Monitor volume reaction closely. Any breakdown below the stop loss level of ${currencySymbol}${stock.stopLossPrice} requires swift risk containment.`}
                              </p>
                            </div>

                            {/* Direct External Search Link */}
                            <div className="flex items-center justify-between pt-1 text-[10px]">
                              <a
                                href={`https://www.google.com/search?q=${encodeURIComponent(
                                  `${stock.ticker} ${headline.title}`
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-amber-800 hover:text-black font-bold flex items-center space-x-1 underline"
                              >
                                <span>Search Coverage on Google</span>
                                <ArrowUpRight className="w-3 h-3" />
                              </a>

                              <span className="text-gray-400">Grounded via Google Search</span>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Card Footer Bar: Catalyst Type, Map Zone Action, Sentiment Badge, Expand Button */}
                    <div className="px-4 py-2.5 bg-[#f2efe9]/60 border-t border-[#e5e4e1] flex items-center justify-between text-[10px] font-mono">
                      <div className="flex items-center space-x-1.5">
                        <span className="bg-white border border-[#d5d4d0] text-gray-800 px-2 py-0.5 font-bold uppercase tracking-wider">
                          {headline.catalystType}
                        </span>

                        {headline.isMajorEvent && (
                          <span className="bg-amber-500/20 text-amber-900 border border-amber-500/40 px-1.5 py-0.5 font-extrabold uppercase flex items-center space-x-0.5">
                            <Flame className="w-2.5 h-2.5 text-amber-600" />
                            <span>Major</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-2">
                        {/* Map Zone / Define Target Trigger Button */}
                        <button
                          onClick={() => setActiveHeadlineZoneCardIdx(isZoneCardOpen ? null : idx)}
                          title="Map Profit Target or Stop Loss based on this headline"
                          className={`px-2 py-0.5 font-bold uppercase text-[9px] flex items-center space-x-1 border transition-all cursor-pointer ${
                            isZoneCardOpen
                              ? 'bg-black text-white border-black'
                              : isTarget1Driver || isTarget2Driver || isStopInvalidation
                              ? 'bg-amber-100 text-amber-950 border-amber-300'
                              : 'bg-white hover:bg-gray-100 text-gray-800 border-gray-300'
                          }`}
                        >
                          <Target className="w-2.5 h-2.5 text-amber-600" />
                          <span>{isZoneCardOpen ? 'Close Zones' : 'Map Zones'}</span>
                        </button>

                        {/* Expand / Collapse Button */}
                        <button
                          onClick={() => toggleHeadlineExpand(idx)}
                          className="text-gray-500 hover:text-black font-bold uppercase flex items-center space-x-0.5 cursor-pointer text-[10px]"
                        >
                          <span>{isExpanded ? 'Less' : 'Details'}</span>
                          <ChevronDown
                            className={`w-3 h-3 transition-transform duration-200 ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                          />
                        </button>

                        {/* Sentiment Badge */}
                        <span
                          className={`px-2 py-0.5 font-extrabold uppercase tracking-wider flex items-center space-x-1 ${
                            isBullish
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              : isCatalyst
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : isBearish
                              ? 'bg-rose-100 text-rose-900 border border-rose-300'
                              : 'bg-gray-100 text-gray-800 border border-gray-300'
                          }`}
                        >
                          {isBullish && <TrendingUp className="w-3 h-3 text-emerald-700" />}
                          {isBearish && <TrendingDown className="w-3 h-3 text-rose-700" />}
                          <span>{headline.sentiment}</span>
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>

          {/* Empty Filter State */}
          {filteredHeadlines.length === 0 && (
            <div className="p-8 text-center space-y-3 bg-[#f9f8f5] border border-[#e5e4e1]">
              <AlertCircle className="w-6 h-6 text-gray-400 mx-auto" />
              <div className="text-xs font-mono font-bold text-gray-700 uppercase">
                No headlines match your active filter criteria
              </div>
              <p className="text-xs font-serif italic text-gray-500 max-w-sm mx-auto">
                Try clearing search keywords or selecting "ALL" sentiments and categories.
              </p>
              <button
                onClick={resetAllFilters}
                className="bg-[#1a1a1a] text-white px-3 py-1.5 text-xs font-mono font-bold uppercase cursor-pointer"
              >
                Reset All Filters
              </button>
            </div>
          )}

          {/* Verified Google Search Grounding Sources / Citations */}
          {newsData.groundingSources && newsData.groundingSources.length > 0 && (
            <div className="pt-4 border-t border-[#e5e4e1] space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-[10px] uppercase font-bold text-gray-500">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Verified Google Search Grounded Web Sources ({newsData.groundingSources.length})</span>
                </div>
                <button
                  onClick={handleShareBriefing}
                  className="text-[10px] text-amber-800 hover:text-black font-bold uppercase flex items-center space-x-1 cursor-pointer"
                >
                  <Share2 className="w-3 h-3" />
                  <span>Share Sources</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {newsData.groundingSources.map((source, i) => (
                  <a
                    key={i}
                    href={source.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-[#f9f8f5] hover:bg-black hover:text-white text-gray-700 border border-[#e5e4e1] px-2.5 py-1 text-[11px] font-bold flex items-center space-x-1.5 transition-all group"
                  >
                    <ExternalLink className="w-3 h-3 text-gray-400 group-hover:text-amber-400" />
                    <span className="truncate max-w-[260px]">{source.title}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
};
