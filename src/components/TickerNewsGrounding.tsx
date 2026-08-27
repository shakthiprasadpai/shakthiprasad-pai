import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MinerviniTradeSetup } from '../types';
import { evaluateAndDispatchWatchlistNewsEvents } from '../utils/watchlistNewsListener';
import {
  Newspaper,
  Globe,
  ExternalLink,
  RefreshCw,
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertCircle,
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
  Flame,
  ArrowUpRight,
  Maximize2,
  Minimize2,
} from 'lucide-react';

interface TickerNewsGroundingProps {
  stock: MinerviniTradeSetup;
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
  sepaContext?: string;
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

  // Filtering states
  const [activeSentiment, setActiveSentiment] = useState<'ALL' | 'BULLISH' | 'CATALYST' | 'BEARISH' | 'NEUTRAL'>('ALL');
  const [selectedCatalystType, setSelectedCatalystType] = useState<string>('ALL');
  const [majorOnly, setMajorOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'impact' | 'recent'>('impact');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);

  // Animated expansion states
  const [expandedHeadlines, setExpandedHeadlines] = useState<Record<number, boolean>>({});
  const [isAllExpanded, setIsAllExpanded] = useState<boolean>(false);
  const [isGroundingDrawerOpen, setIsGroundingDrawerOpen] = useState<boolean>(false);

  // Sharing & Copy notification feedback
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [copiedHeadlineIdx, setCopiedHeadlineIdx] = useState<number | null>(null);

  // Timer reference for auto-refresh
  const autoRefreshTimerRef = useRef<NodeJS.Timeout | null>(null);

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

      // 3. Major / High Impact Only filter
      if (majorOnly && !item.isMajorEvent && item.impactLevel !== 'CRITICAL' && item.impactLevel !== 'HIGH') {
        return false;
      }

      // 4. Keyword search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchTitle = item.title?.toLowerCase().includes(query);
        const matchSnippet = item.snippet?.toLowerCase().includes(query);
        const matchSource = item.source?.toLowerCase().includes(query);
        const matchType = item.catalystType?.toLowerCase().includes(query);
        if (!matchTitle && !matchSnippet && !matchSource && !matchType) {
          return false;
        }
      }

      return true;
    });

    // Sort headlines
    if (sortBy === 'impact') {
      const impactWeight = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, undefined: 0 };
      list.sort((a, b) => {
        const weightA = impactWeight[a.impactLevel || 'MEDIUM'] + (a.isMajorEvent ? 2 : 0);
        const weightB = impactWeight[b.impactLevel || 'MEDIUM'] + (b.isMajorEvent ? 2 : 0);
        return weightB - weightA;
      });
    }

    return list;
  }, [newsData, activeSentiment, selectedCatalystType, majorOnly, searchQuery, sortBy]);

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
    report += `Exchange: ${stock.exchange} | Price: $${stock.currentPrice} | Date: ${dateStr}\n`;
    report += `Trend Score: ${stock.trendScore}/8 | VCP Stage: ${stock.vcpStage} | RS Rating: ${stock.rsRating}\n\n`;

    if (newsData.summary) {
      report += `⚡ Catalyst Synthesis:\n${newsData.summary}\n\n`;
    }

    report += `🎯 Key Grounded Headlines (${filteredHeadlines.length}):\n`;
    filteredHeadlines.forEach((h, i) => {
      report += `${i + 1}. [${h.sentiment}] ${h.title}\n`;
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
    const text = `[${headline.sentiment} - ${headline.catalystType}] ${headline.title}\nSource: ${headline.source} (${headline.date})\n"${headline.snippet}"\n(Ticker: ${stock.ticker})`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedHeadlineIdx(idx);
      setTimeout(() => setCopiedHeadlineIdx(null), 2500);
    } catch (err) {
      console.error('Failed to copy headline', err);
    }
  };

  // Download Briefing as .md file
  const handleDownloadReport = () => {
    const reportText = generateShareReport();
    if (!reportText) return;
    const blob = new Blob([reportText], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${stock.ticker}_SEPA_News_Catalysts_${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setShareFeedback('Downloaded catalyst report (.md)');
    setTimeout(() => setShareFeedback(null), 3000);
  };

  const isFiltersActive =
    activeSentiment !== 'ALL' ||
    selectedCatalystType !== 'ALL' ||
    majorOnly ||
    searchQuery.trim().length > 0;

  const resetAllFilters = () => {
    setActiveSentiment('ALL');
    setSelectedCatalystType('ALL');
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

          {/* Download Markdown Report */}
          <button
            onClick={handleDownloadReport}
            disabled={!newsData || loading}
            title="Download report as Markdown file"
            className="bg-[#f9f8f5] hover:bg-[#1a1a1a] hover:text-white text-gray-800 border border-[#e5e4e1] hover:border-black p-2 text-[11px] font-bold transition-all disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
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
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono bg-[#f9f8f5] p-3 border border-[#e5e4e1]">
            
            {/* Left: Sentiment Filter Buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-gray-500 uppercase font-bold mr-1 flex items-center space-x-1">
                <Filter className="w-3 h-3" />
                <span>Sentiment:</span>
              </span>

              {(['ALL', 'BULLISH', 'CATALYST', 'BEARISH', 'NEUTRAL'] as const).map((sentiment) => {
                const count = sentimentCounts[sentiment] || 0;
                const isSelected = activeSentiment === sentiment;

                return (
                  <button
                    key={sentiment}
                    onClick={() => setActiveSentiment(sentiment)}
                    className={`px-2.5 py-1 text-[10px] font-bold uppercase transition-all cursor-pointer border flex items-center space-x-1.5 ${
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

            {/* Right: Quick Search Box & Filters Toggle */}
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter news keywords..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-white border border-[#e5e4e1] pl-8 pr-7 py-1 text-[11px] font-mono w-44 md:w-56 focus:outline-none focus:border-black"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`px-2.5 py-1 text-[10px] font-bold uppercase border flex items-center space-x-1.5 cursor-pointer transition-all ${
                  showAdvancedFilters || isFiltersActive
                    ? 'bg-amber-100 text-amber-950 border-amber-300'
                    : 'bg-white text-gray-700 border-[#e5e4e1] hover:bg-gray-100'
                }`}
              >
                <SlidersHorizontal className="w-3 h-3 text-amber-700" />
                <span>Filters</span>
                {isFiltersActive && (
                  <span className="w-2 h-2 rounded-full bg-amber-600 inline-block" />
                )}
              </button>
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
                <div className="bg-[#f2efe9] border border-[#e5e4e1] p-3.5 space-y-3 font-mono text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    
                    {/* Catalyst Category Pill Filter */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold uppercase text-gray-600 block">
                        Catalyst Type Category:
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          onClick={() => setSelectedCatalystType('ALL')}
                          className={`px-2 py-0.5 text-[10px] font-bold uppercase border cursor-pointer ${
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
                            onClick={() => setSelectedCatalystType(type)}
                            className={`px-2 py-0.5 text-[10px] font-bold uppercase border cursor-pointer ${
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

                    {/* Major Only Switch & Sort & Auto-refresh */}
                    <div className="flex flex-wrap items-center gap-4 pt-1">
                      
                      {/* High-Impact / Major Only Toggle */}
                      <label className="flex items-center space-x-2 cursor-pointer select-none bg-white px-2.5 py-1 border border-[#d5d4d0]">
                        <input
                          type="checkbox"
                          checked={majorOnly}
                          onChange={(e) => setMajorOnly(e.target.checked)}
                          className="accent-amber-600"
                        />
                        <span className="text-[10px] font-bold uppercase text-amber-900 flex items-center space-x-1">
                          <Flame className="w-3 h-3 text-amber-600" />
                          <span>High-Impact Only</span>
                        </span>
                      </label>

                      {/* Sort Order Selector */}
                      <div className="flex items-center space-x-1.5">
                        <span className="text-[10px] text-gray-600 font-bold uppercase">Sort:</span>
                        <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value as any)}
                          className="bg-white border border-[#d5d4d0] px-2 py-1 text-[10px] font-mono font-bold uppercase focus:outline-none"
                        >
                          <option value="impact">Highest SEPA Impact</option>
                          <option value="recent">Most Recent Date</option>
                        </select>
                      </div>

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

                      {/* Clear All Filters Button */}
                      {isFiltersActive && (
                        <button
                          onClick={resetAllFilters}
                          className="text-[10px] text-rose-700 hover:text-rose-900 font-bold uppercase underline cursor-pointer"
                        >
                          Reset Filters
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Active Filter Metrics Ribbon */}
          <div className="flex items-center justify-between text-[10px] font-mono text-gray-500 px-1">
            <div>
              <span>Showing </span>
              <strong className="text-black">{filteredHeadlines.length}</strong>
              <span> of {newsData.headlines.length} grounded headlines</span>
              {isFiltersActive && <span className="text-amber-800 font-bold"> (Filtered)</span>}
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
          
          {/* Executive Catalyst Summary Banner */}
          {newsData.summary && (
            <div className="p-4 bg-amber-50/80 border border-amber-200/90 rounded-none space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs font-bold text-amber-950 font-mono uppercase tracking-wider">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>Mark Minervini SEPA Price Catalyst Synthesis</span>
                </div>
                <button
                  onClick={handleShareBriefing}
                  className="text-[10px] font-mono text-amber-800 hover:text-black font-bold uppercase flex items-center space-x-1 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy Synthesis</span>
                </button>
              </div>
              <p className="text-xs font-serif text-gray-800 leading-relaxed italic">
                "{newsData.summary}"
              </p>
            </div>
          )}

          {/* Animated Headlines Grid with motion layout */}
          <motion.div layout className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatePresence mode="popLayout">
              {filteredHeadlines.map((headline, idx) => {
                const isBullish = headline.sentiment === 'BULLISH';
                const isCatalyst = headline.sentiment === 'CATALYST';
                const isBearish = headline.sentiment === 'BEARISH';
                const isExpanded = !!expandedHeadlines[idx] || isAllExpanded;
                const isCopied = copiedHeadlineIdx === idx;

                const impact = headline.impactLevel || (headline.isMajorEvent ? 'HIGH' : 'MEDIUM');

                return (
                  <motion.div
                    key={`${headline.title}-${idx}`}
                    layout
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.2 }}
                    className={`bg-[#f9f8f5] border transition-colors shadow-2xs flex flex-col justify-between ${
                      isExpanded
                        ? 'border-[#1a1a1a] bg-white ring-1 ring-black/5'
                        : 'border-[#e5e4e1] hover:border-black'
                    }`}
                  >
                    {/* Card Top Area */}
                    <div className="p-4 space-y-2.5">
                      
                      {/* Meta header: Source, Date, Copy Icon, Expand Icon */}
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className="font-bold text-gray-700 uppercase tracking-wider flex items-center space-x-1">
                          <Globe className="w-3 h-3 text-gray-400" />
                          <span>{headline.source}</span>
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-400">{headline.date}</span>
                          
                          {/* Copy single button */}
                          <button
                            onClick={(e) => handleCopySingleHeadline(headline, idx, e)}
                            title="Copy headline takeaway"
                            className="text-gray-400 hover:text-black transition-colors p-0.5"
                          >
                            {isCopied ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Headline Title */}
                      <h4
                        onClick={() => toggleHeadlineExpand(idx)}
                        className="text-sm font-serif font-black text-[#1a1a1a] leading-tight cursor-pointer hover:text-amber-800 transition-colors flex items-start justify-between gap-2"
                      >
                        <span>{headline.title}</span>
                      </h4>

                      {/* Snippet preview / full text */}
                      <p className="text-xs font-sans text-gray-600 leading-normal">
                        {headline.snippet}
                      </p>

                      {/* Animated Expandable SEPA Details Section */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.25 }}
                            className="overflow-hidden pt-2.5 border-t border-dashed border-[#e5e4e1] space-y-2 font-mono text-xs"
                          >
                            {/* SEPA Impact Alignment */}
                            <div className="bg-[#f4f2ec] p-2.5 space-y-1">
                              <div className="flex items-center justify-between text-[10px] font-bold uppercase">
                                <span className="text-gray-700 flex items-center space-x-1">
                                  <Zap className="w-3 h-3 text-amber-600" />
                                  <span>SEPA Setup Significance</span>
                                </span>
                                <span
                                  className={`px-1.5 py-0.2 text-[9px] font-extrabold ${
                                    impact === 'CRITICAL'
                                      ? 'bg-rose-600 text-white'
                                      : impact === 'HIGH'
                                      ? 'bg-amber-600 text-white'
                                      : 'bg-gray-300 text-gray-800'
                                  }`}
                                >
                                  {impact} IMPACT
                                </span>
                              </div>
                              <p className="text-[11px] font-sans text-gray-700 leading-relaxed">
                                {isBullish || isCatalyst
                                  ? `Provides fundamental catalyst fuel to support Stage 2 accumulation and VCP pivot expansion above $${stock.pivotPrice}.`
                                  : `Monitor volume reaction closely. Any breakdown below the stop loss level of $${stock.stopLossPrice} requires swift risk containment.`}
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

                    {/* Card Footer Bar: Catalyst Type, Sentiment Badge, Expand Button */}
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
