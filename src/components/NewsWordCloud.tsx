import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Hash, TrendingUp, TrendingDown, Tag, Filter, RefreshCw } from 'lucide-react';

interface HeadlineItem {
  title: string;
  snippet?: string;
  source?: string;
  sentiment?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  catalystType?: string;
}

interface NewsWordCloudProps {
  headlines: HeadlineItem[];
  selectedKeyword?: string;
  onSelectKeyword?: (keyword: string) => void;
  ticker: string;
}

interface WordWeight {
  word: string;
  count: number;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  catalystTypes: Set<string>;
  score: number;
}

// Common financial/English stopwords to filter out
const STOPWORDS = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'from', 'have', 'more', 'about', 'after',
  'into', 'over', 'than', 'will', 'been', 'their', 'were', 'which', 'would', 'could',
  'says', 'said', 'here', 'when', 'what', 'some', 'other', 'also', 'most', 'such',
  'stock', 'stocks', 'shares', 'share', 'market', 'markets', 'company', 'inc', 'corp',
  'ltd', 'report', 'reports', 'news', 'press', 'release', 'today', 'quarter', 'q1', 'q2',
  'q3', 'q4', 'year', 'fiscal', 'first', 'second', 'third', 'fourth', 'its', 'they',
  'them', 'are', 'was', 'has', 'had', 'our', 'all', 'any', 'not', 'out', 'new', 'how'
]);

export const NewsWordCloud: React.FC<NewsWordCloudProps> = ({
  headlines,
  selectedKeyword = '',
  onSelectKeyword,
  ticker,
}) => {
  const [hoveredWord, setHoveredWord] = useState<string | null>(null);

  // Extract and weigh keywords from headlines
  const wordCloudData = useMemo(() => {
    if (!headlines || headlines.length === 0) return [];

    const wordMap = new Map<string, WordWeight>();

    headlines.forEach((h) => {
      const fullText = `${h.title} ${h.snippet || ''} ${h.catalystType || ''}`.toLowerCase();
      // Remove punctuation and split by whitespace
      const words = fullText
        .replace(/[^a-z0-9\s-]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2 && !STOPWORDS.has(w) && w !== ticker.toLowerCase());

      words.forEach((w) => {
        // Capitalize nicely for display
        const displayWord = w.charAt(0).toUpperCase() + w.slice(1);
        const existing = wordMap.get(displayWord) || {
          word: displayWord,
          count: 0,
          sentiment: h.sentiment || 'NEUTRAL',
          catalystTypes: new Set<string>(),
          score: 0,
        };

        existing.count += 1;
        if (h.catalystType) existing.catalystTypes.add(h.catalystType);
        
        // Sentiment weighting
        if (h.sentiment === 'BULLISH') existing.sentiment = 'BULLISH';
        else if (h.sentiment === 'BEARISH' && existing.sentiment !== 'BULLISH') existing.sentiment = 'BEARISH';

        wordMap.set(displayWord, existing);
      });
    });

    // Filter words occurring at least once and sort by frequency
    const list = Array.from(wordMap.values())
      .filter((item) => item.count >= 1)
      .sort((a, b) => b.count - a.count)
      .slice(0, 32);

    // Compute relative size scores (1 to 5)
    if (list.length > 0) {
      const maxCount = list[0].count;
      const minCount = list[list.length - 1].count;
      list.forEach((item) => {
        const normalized = maxCount > minCount
          ? (item.count - minCount) / (maxCount - minCount)
          : 0.5;
        item.score = Math.round(1 + normalized * 4); // 1 to 5 scale
      });
    }

    return list;
  }, [headlines, ticker]);

  if (wordCloudData.length === 0) {
    return null;
  }

  return (
    <div className="bg-[#10141d] border border-gray-800 text-white p-4 font-mono shadow-sm space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 pb-2.5">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-serif font-black text-amber-300 uppercase tracking-wider">
            Grounded Headline Word Cloud & Trending Themes
          </span>
          <span className="text-[10px] text-gray-400 font-sans italic hidden sm:inline">
            (Click any corporate theme to instant-filter news stream)
          </span>
        </div>

        {selectedKeyword && onSelectKeyword && (
          <button
            onClick={() => onSelectKeyword('')}
            className="text-[10px] text-amber-400 hover:text-amber-200 border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 uppercase tracking-wider flex items-center space-x-1 cursor-pointer"
          >
            <span>Reset Filter ({selectedKeyword})</span>
          </button>
        )}
      </div>

      {/* Word Cloud Canvas / Tags Container */}
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 py-3 px-2 bg-black/40 border border-gray-800/80 min-h-[140px]">
        {wordCloudData.map((item, idx) => {
          const isSelected = selectedKeyword.toLowerCase() === item.word.toLowerCase();
          const isHovered = hoveredWord === item.word;

          // Visual sizing & color mapping based on frequency and sentiment
          let sizeClass = 'text-xs px-2 py-1';
          if (item.score === 5) sizeClass = 'text-base sm:text-lg font-black px-3.5 py-1.5 shadow-sm';
          else if (item.score === 4) sizeClass = 'text-sm sm:text-base font-extrabold px-3 py-1';
          else if (item.score === 3) sizeClass = 'text-xs sm:text-sm font-bold px-2.5 py-0.5';
          else if (item.score === 2) sizeClass = 'text-xs font-semibold px-2 py-0.5';

          let sentimentColor = 'bg-gray-800 text-gray-300 border-gray-700 hover:border-gray-500';
          if (item.sentiment === 'BULLISH') {
            sentimentColor = isSelected
              ? 'bg-emerald-600 text-white border-emerald-400 font-black shadow-md ring-2 ring-emerald-400'
              : 'bg-emerald-950/70 text-emerald-300 border-emerald-800/80 hover:bg-emerald-900 hover:border-emerald-500';
          } else if (item.sentiment === 'BEARISH') {
            sentimentColor = isSelected
              ? 'bg-rose-600 text-white border-rose-400 font-black shadow-md ring-2 ring-rose-400'
              : 'bg-rose-950/70 text-rose-300 border-rose-800/80 hover:bg-rose-900 hover:border-rose-500';
          } else {
            if (isSelected) {
              sentimentColor = 'bg-amber-500 text-black border-amber-400 font-black ring-2 ring-amber-400';
            }
          }

          return (
            <motion.button
              key={item.word}
              type="button"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, delay: Math.min(idx * 0.015, 0.3) }}
              whileHover={{ scale: 1.08, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onSelectKeyword && onSelectKeyword(isSelected ? '' : item.word)}
              onMouseEnter={() => setHoveredWord(item.word)}
              onMouseLeave={() => setHoveredWord(null)}
              className={`border transition-all cursor-pointer flex items-center space-x-1.5 select-none ${sizeClass} ${sentimentColor}`}
              title={`${item.word}: mentioned ${item.count} times. Click to filter.`}
            >
              <span>{item.word}</span>
              <span className="text-[9px] opacity-70 font-mono">
                {item.count > 1 ? `(${item.count})` : ''}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="flex flex-wrap items-center justify-between text-[10px] text-gray-400 pt-1">
        <div className="flex items-center space-x-3">
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            <span>Bullish Catalyst</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
            <span>Risk / Headwind</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-gray-500 inline-block" />
            <span>Neutral Topic</span>
          </span>
        </div>

        <span>Extracted from {headlines.length} grounded citations</span>
      </div>
    </div>
  );
};
