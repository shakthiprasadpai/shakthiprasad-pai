import { SecondBrainNote, SecondBrainClip, SecondBrainGraphNode, SecondBrainGraphLink, SecondBrainCategory, MinerviniTradeSetup } from '../types';

const STORAGE_NOTES_KEY = 'minervini_second_brain_notes_v1';
const STORAGE_CLIPS_KEY = 'minervini_second_brain_clips_v1';

// Comprehensive Initial Seed Notes for Minervini SEPA Second Brain
export const INITIAL_SECOND_BRAIN_NOTES: SecondBrainNote[] = [
  // PROJECTS (Active Trade Campaigns)
  {
    id: 'note-proj-1',
    title: 'NVDA — High Tight Flag & AI Infrastructure Campaign',
    category: 'PROJECTS',
    ticker: 'NVDA',
    patternType: 'High Tight Flag',
    tags: ['#active-campaign', '#semiconductors', '#high-tight-flag', '#ai-leaders'],
    content: `## 🎯 NVDA Setup Thesis
- **Pattern**: 3-week High Tight Flag consolidating after a +45% explosive advance.
- **Stage**: Stage 2 Trend Template active. 50 SMA > 150 SMA > 200 SMA.
- **Volume Contraction**: 4th day of contraction with volume 58% below 20-day average.
- **Execution**:
  - Pivot Buy Point: $138.50
  - Stop Loss: $131.20 (-5.2%)
  - Target 1: $165.00 (+19.1%)
  - Target 2: $185.00 (+33.5%)

> [!tip] Minervini Rule
> Never chase extended stocks >5% above the pivot price. Wait for pullback to 10/21 EMA.

**Linked Concepts**: [[Trend Template]] • [[Semiconductors]] • [[High Tight Flag]] • [[Risk Management]]`,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    sourceType: 'SCREENER',
    isPinned: true,
    sepaRating: 'ELITE',
    wikilinks: ['[[NVDA]]', '[[Trend Template]]', '[[Semiconductors]]', '[[High Tight Flag]]', '[[Risk Management]]']
  },
  {
    id: 'note-proj-2',
    title: 'TRENT — VCP 3-Contraction Tight Coil (NSE)',
    category: 'PROJECTS',
    ticker: 'TRENT',
    patternType: 'VCP (3 Contractions)',
    tags: ['#active-campaign', '#nse-leaders', '#vcp', '#retail', '#trent'],
    content: `## 🛒 Trent Ltd (Zudio & Westside Expansion)
- **Sector**: Consumer Retail / Discretionary (Market Outperformer)
- **VCP Contraction Anatomy**:
  - T1: -18.2% over 14 days
  - T2: -7.5% over 8 days
  - T3: -2.8% over 4 days (Volume dry-up -68%)
- **Catalyst**: Same-store sales growth accelerating at 32% YoY.
- **Trade Execution**:
  - Pivot Level: ₹7,850
  - Initial Stop: ₹7,450 (-5.1%)
  - Target: ₹9,400 (+19.7%)

**Linked**: [[TRENT]] • [[VCP]] • [[Retail]] • [[Pocket Pivot]]`,
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    sourceType: 'SCREENER',
    isPinned: true,
    sepaRating: 'ELITE',
    wikilinks: ['[[TRENT]]', '[[VCP]]', '[[Retail]]', '[[Pocket Pivot]]']
  },

  // AREAS (Core SEPA Mastery & Disciplines)
  {
    id: 'note-area-1',
    title: 'Minervini 8-Point Trend Template Rulebook',
    category: 'AREAS',
    tags: ['#sepa-rules', '#trend-template', '#foundations', '#stage2'],
    content: `## 🏆 The 8 Essential Trend Template Criteria
Every super-performance stock must satisfy these 8 quantitative rules prior to purchase:

1. **Current Price > 150-day & 200-day SMAs**
2. **150-day SMA > 200-day SMA** (Golden Alignment)
3. **200-day SMA must be trending UP** for at least 1 month (preferably 4-5 months)
4. **50-day SMA > 150-day & 200-day SMAs**
5. **Current Price > 50-day SMA**
6. **Current Price ≥ 30% above 52-week Low** (Bottoming candidates disqualified)
7. **Current Price within 25% of 52-week High** (Leaders trade near highs)
8. **Relative Strength (RS) Rating ≥ 70**, ideally ≥ 80 or 90

> [!quote] Mark Minervini
> "Do not invest in turnarounds, bottom fishers, or laggards. Stick exclusively to Stage 2 momentum leaders."

**Linked**: [[Stage 2]] • [[Trend Template]] • [[Risk Management]]`,
    createdAt: new Date(Date.now() - 86400000 * 15).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    sourceType: 'MANUAL',
    isPinned: true,
    sepaRating: 'ELITE',
    wikilinks: ['[[Stage 2]]', '[[Trend Template]]', '[[Risk Management]]']
  },
  {
    id: 'note-area-2',
    title: 'Strict Risk Sizing & Asymmetric Stop Loss Formula',
    category: 'AREAS',
    tags: ['#risk-management', '#position-sizing', '#stop-loss', '#drawdown-control'],
    content: `## 🛡️ Capital Preservation Rules
- **Maximum Account Risk Per Trade**: 1.0% to 1.5% of total liquid portfolio.
- **Maximum Stop Loss Range**: 5% to 8% maximum. Never let a trade exceed 8% loss.
- **Progressive Exposure Protocol**:
  - Tier 1: 50% initial sizing
  - Add 25% only when position is +3% into profit
  - Final 25% added on high-volume continuation bar
- **Break-Even Adjustment**: Raise stop loss to breakeven once price advances +3x the initial risk (e.g. +15% on a 5% stop).

$$Position Size = \\frac{Total Portfolio \\times Max Risk \\%}{Entry Price - Stop Loss Price}$$

**Linked**: [[Risk Management]] • [[Position Sizing]] • [[Stop Loss]]`,
    createdAt: new Date(Date.now() - 86400000 * 12).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    sourceType: 'MANUAL',
    isPinned: true,
    sepaRating: 'ELITE',
    wikilinks: ['[[Risk Management]]', '[[Position Sizing]]', '[[Stop Loss]]']
  },

  // RESOURCES (Knowledge Base, Gurus & Playbook)
  {
    id: 'note-res-1',
    title: 'Mark Minervini & Stan Weinstein Stage Analysis Matrix',
    category: 'RESOURCES',
    tags: ['#gurus', '#stage-analysis', '#mark-minervini', '#stan-weinstein'],
    content: `## 📊 The 4 Lifecycle Stages of Stocks
- **Stage 1 (Neglect / Basing)**: Sideways churn, 200 SMA flattening. Avoid capital lockup.
- **Stage 2 (Advancing / Super-performance)**: 200 SMA slope positive, higher highs, VCP contractions, pocket pivots. **100% of buying happens here.**
- **Stage 3 (Top / Distribution)**: Volatility expands, churn on high volume, 50 SMA broken repeatedly. Time to take profits.
- **Stage 4 (Declining / Capitulation)**: Severe downtrend, institutional selling. Do not touch.

**Linked**: [[Stage 2]] • [[VCP]] • [[Stan Weinstein]] • [[Mark Minervini]]`,
    createdAt: new Date(Date.now() - 86400000 * 20).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 10).toISOString(),
    sourceType: 'MANUAL',
    isPinned: false,
    sepaRating: 'LEADER',
    wikilinks: ['[[Stage 2]]', '[[VCP]]', '[[Stan Weinstein]]', '[[Mark Minervini]]']
  },
  {
    id: 'note-res-2',
    title: 'VCP Anatomy & Volume Dry-Up Signature Guide',
    category: 'RESOURCES',
    tags: ['#vcp', '#chart-patterns', '#volume-analysis', '#contractions'],
    content: `## 🌊 Understanding Volatility Contraction (VCP)
- **Mechanism**: Weak hands sell on successive pullbacks until sellers are exhausted.
- **Contraction Formula**:
  - Contraction 1: -25% to -35%
  - Contraction 2: -10% to -15%
  - Contraction 3: -3% to -6%
  - Contraction 4 (Optional): -1% to -3%
- **Volume Signature**: On the final contraction (T3/T4), volume MUST dry up to at least 40–70% below 20-day average.

**Linked**: [[VCP]] • [[Pocket Pivot]] • [[Cheat Entry]]`,
    createdAt: new Date(Date.now() - 86400000 * 18).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 8).toISOString(),
    sourceType: 'MANUAL',
    isPinned: false,
    sepaRating: 'ELITE',
    wikilinks: ['[[VCP]]', '[[VCP Pattern]]', '[[Volume Analysis]]', '[[Cheat Entry]]']
  },

  // ARCHIVES (Post-Trade Analysis & Market Studies)
  {
    id: 'note-arch-1',
    title: '2024 SMCI Climax Run Post-Mortem & Sell Rules',
    category: 'ARCHIVES',
    ticker: 'SMCI',
    tags: ['#archives', '#post-mortem', '#climax-top', '#sell-rules'],
    content: `## 📉 Climax Top Case Study: SMCI
- **Runup**: +280% in 7 weeks without touching 21 EMA.
- **Climax Sell Signals Detected**:
  1. Widest spread day in the entire run on record-breaking volume.
  2. Exhaustion gap open that failed to hold by market close.
  3. Violation of 10-day EMA with expanding red volume.
- **Key Lesson**: When a stock goes vertical, use a trailing 10 EMA or 8-day low stop instead of standard 50 SMA.

**Linked**: [[SMCI]] • [[Climax Run]] • [[Sell Rules]] • [[Risk Management]]`,
    createdAt: new Date(Date.now() - 86400000 * 45).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 30).toISOString(),
    sourceType: 'MANUAL',
    isPinned: false,
    sepaRating: 'AVOID',
    wikilinks: ['[[SMCI]]', '[[Climax Run]]', '[[Sell Rules]]', '[[Risk Management]]']
  }
];

// Initial web clips for the Second Brain
export const INITIAL_SECOND_BRAIN_CLIPS: SecondBrainClip[] = [
  {
    id: 'clip-1',
    title: 'TradingView: NVDA Daily Cup & Handle with Volume Contraction',
    url: 'https://www.tradingview.com/chart/?symbol=NASDAQ:NVDA',
    ticker: 'NVDA',
    source: 'TradingView',
    content: 'NVDA tested the 21 EMA at $128 and bounced with institutional buying. Contraction depth 4.2% on declining volume. Ready for pivot breakout above $138.50.',
    summary: 'Consolidation base resting directly on rising 21-day EMA. Volume dried up to 48M shares vs 75M 20-day average.',
    tags: ['#tradingview', '#nvda', '#cup-handle', '#ema21'],
    category: 'PROJECTS',
    timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
    status: 'FAVORITE'
  },
  {
    id: 'clip-2',
    title: 'Finviz: Semiconductor Sector Relative Strength Breakdown',
    url: 'https://finviz.com/groups.ashx?g=industry&v=110',
    source: 'Finviz',
    content: 'Semiconductor sector gained +3.8% week-over-week. Leading stocks include NVDA, TSM, AVGO, and ARM with relative strength ratings consistently > 85.',
    summary: 'Sector breadth expanding with 82% of semiconductor equities trading above 50-day SMA.',
    tags: ['#finviz', '#semiconductors', '#relative-strength', '#sector-breadth'],
    category: 'RESOURCES',
    timestamp: new Date(Date.now() - 3600000 * 18).toISOString(),
    status: 'PROCESSED'
  },
  {
    id: 'clip-3',
    title: 'X / Twitter: Mark Minervini on Progressive Exposure',
    url: 'https://x.com/markminervini/status/1789201940',
    source: 'Twitter / X',
    content: 'Do not finance new risk with hope. Finance new risk with profits from previous winning trades. If your first 2 trades in a breakout cluster fail, downshift to cash.',
    summary: 'Progressive exposure protects capital during false breakout market environments.',
    tags: ['#minervini', '#twitter', '#risk-discipline', '#progressive-exposure'],
    category: 'AREAS',
    timestamp: new Date(Date.now() - 3600000 * 32).toISOString(),
    status: 'FAVORITE'
  }
];

// Helper to get notes from localStorage or fallback to defaults
export const getSecondBrainNotes = (): SecondBrainNote[] => {
  try {
    const raw = localStorage.getItem(STORAGE_NOTES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (err) {
    console.error('Failed to load second brain notes from storage', err);
  }
  return INITIAL_SECOND_BRAIN_NOTES;
};

// Helper to save notes to localStorage
export const saveSecondBrainNotes = (notes: SecondBrainNote[]): void => {
  try {
    localStorage.setItem(STORAGE_NOTES_KEY, JSON.stringify(notes));
  } catch (err) {
    console.error('Failed to save second brain notes to storage', err);
  }
};

// Helper to get clips from localStorage
export const getSecondBrainClips = (): SecondBrainClip[] => {
  try {
    const raw = localStorage.getItem(STORAGE_CLIPS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (err) {
    console.error('Failed to load second brain clips from storage', err);
  }
  return INITIAL_SECOND_BRAIN_CLIPS;
};

// Helper to save clips to localStorage
export const saveSecondBrainClips = (clips: SecondBrainClip[]): void => {
  try {
    localStorage.setItem(STORAGE_CLIPS_KEY, JSON.stringify(clips));
  } catch (err) {
    console.error('Failed to save second brain clips to storage', err);
  }
};

// Knowledge Graph Node & Link generator
export const buildSecondBrainGraphData = (
  notes: SecondBrainNote[],
  stocks: MinerviniTradeSetup[]
): { nodes: SecondBrainGraphNode[]; links: SecondBrainGraphLink[] } => {
  const nodesMap = new Map<string, SecondBrainGraphNode>();
  const links: SecondBrainGraphLink[] = [];

  // Core Central Hub Node
  nodesMap.set('SEPA_BRAIN', {
    id: 'SEPA_BRAIN',
    label: '🧠 Minervini SEPA Second Brain',
    type: 'CONCEPT',
    val: 35,
    group: 'CORE'
  });

  // Category Nodes
  const categories: SecondBrainCategory[] = ['PROJECTS', 'AREAS', 'RESOURCES', 'ARCHIVES'];
  categories.forEach((cat) => {
    nodesMap.set(`CAT_${cat}`, {
      id: `CAT_${cat}`,
      label: cat === 'PROJECTS' ? '🎯 Projects' : cat === 'AREAS' ? '🛡️ Areas' : cat === 'RESOURCES' ? '📚 Resources' : '📦 Archives',
      type: 'CONCEPT',
      category: cat,
      val: 24,
      group: cat
    });
    links.push({
      source: 'SEPA_BRAIN',
      target: `CAT_${cat}`,
      relationship: 'contains'
    });
  });

  // Add notes as nodes
  notes.forEach((note) => {
    const noteNodeId = `NOTE_${note.id}`;
    nodesMap.set(noteNodeId, {
      id: noteNodeId,
      label: note.title.length > 25 ? `${note.title.slice(0, 25)}...` : note.title,
      type: 'NOTE',
      category: note.category,
      val: 16,
      group: note.category
    });

    // Link note to its category
    links.push({
      source: `CAT_${note.category}`,
      target: noteNodeId,
      relationship: 'category_of'
    });

    // If note has a ticker, link note to ticker node
    if (note.ticker) {
      const tickerNodeId = `TICKER_${note.ticker}`;
      if (!nodesMap.has(tickerNodeId)) {
        nodesMap.set(tickerNodeId, {
          id: tickerNodeId,
          label: `$${note.ticker}`,
          type: 'TICKER',
          val: 20,
          group: 'TICKER'
        });
      }
      links.push({
        source: noteNodeId,
        target: tickerNodeId,
        relationship: 'analyzes'
      });
    }

    // Extract wikilinks and build graph edges
    const wikilinkMatches = note.content.match(/\[\[(.*?)\]\]/g) || [];
    wikilinkMatches.forEach((match) => {
      const cleanConcept = match.replace(/\[\[|\]\]/g, '').trim();
      const conceptId = `CONCEPT_${cleanConcept.replace(/\s+/g, '_')}`;
      if (!nodesMap.has(conceptId)) {
        nodesMap.set(conceptId, {
          id: conceptId,
          label: cleanConcept,
          type: 'CONCEPT',
          val: 14,
          group: 'WIKILINK'
        });
      }
      links.push({
        source: noteNodeId,
        target: conceptId,
        relationship: 'references'
      });
    });
  });

  // Enrich with top 5 screener leaders
  stocks.slice(0, 8).forEach((stock) => {
    const tickerNodeId = `TICKER_${stock.ticker}`;
    if (!nodesMap.has(tickerNodeId)) {
      nodesMap.set(tickerNodeId, {
        id: tickerNodeId,
        label: `$${stock.ticker} (RS ${stock.rsRating})`,
        type: 'TICKER',
        val: 18,
        group: 'TICKER'
      });
      links.push({
        source: 'CAT_PROJECTS',
        target: tickerNodeId,
        relationship: 'screener_candidate'
      });
    }
  });

  return {
    nodes: Array.from(nodesMap.values()),
    links
  };
};

// Export entire Second Brain knowledge vault to Markdown string with Obsidian YAML frontmatter
export const exportSecondBrainToObsidianMarkdown = (notes: SecondBrainNote[]): string => {
  return notes
    .map((note) => {
      const tagsList = note.tags.map((t) => (t.startsWith('#') ? t.slice(1) : t)).join(', ');
      return `---
id: "${note.id}"
title: "${note.title.replace(/"/g, '\\"')}"
category: "${note.category}"
ticker: "${note.ticker || ''}"
pattern_type: "${note.patternType || ''}"
sepa_rating: "${note.sepaRating || 'LEADER'}"
tags: [${tagsList}]
created: "${note.createdAt}"
updated: "${note.updatedAt}"
source: "${note.sourceType || 'MANUAL'}"
---

# ${note.title}

${note.content}

---
*Minervini SEPA Second Brain • Vault Knowledge Note • Exported ${new Date().toLocaleDateString()}*
`;
    })
    .join('\n\n========================================\n\n');
};
