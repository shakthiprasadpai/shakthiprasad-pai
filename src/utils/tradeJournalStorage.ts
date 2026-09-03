import { TradeJournalNote } from '../types';

export interface TradeGoals {
  targetWinRate: number;
  maxDrawdownLimit: number;
  minRiskRewardRatio: number;
  weeklyTradesTarget: number;
  targetDisciplineScore: number;
}

const LOCAL_STORAGE_KEY = 'minervini_trade_journal_notes_v1';
const STORAGE_GOALS_KEY = 'minervini_trade_goals_v1';

const DEFAULT_TRADE_GOALS: TradeGoals = {
  targetWinRate: 60,
  maxDrawdownLimit: 5.0,
  minRiskRewardRatio: 3.0,
  weeklyTradesTarget: 5,
  targetDisciplineScore: 4.5,
};

export function getStoredTradeGoals(): TradeGoals {
  try {
    const raw = localStorage.getItem(STORAGE_GOALS_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_GOALS_KEY, JSON.stringify(DEFAULT_TRADE_GOALS));
      return DEFAULT_TRADE_GOALS;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading trade goals from localStorage:', err);
    return DEFAULT_TRADE_GOALS;
  }
}

export function saveStoredTradeGoals(goals: TradeGoals): void {
  try {
    localStorage.setItem(STORAGE_GOALS_KEY, JSON.stringify(goals));
    window.dispatchEvent(new CustomEvent('minervini_goals_updated'));
  } catch (err) {
    console.error('Error saving trade goals to localStorage:', err);
  }
}

const INITIAL_JOURNAL_NOTES: TradeJournalNote[] = [
  {
    id: 'journal-nvda-1',
    ticker: 'NVDA',
    stockName: 'NVIDIA Corporation',
    exchange: 'NASDAQ',
    date: '2026-07-24',
    setupType: 'VCP (3 Contractions)',
    entryPrice: 128.50,
    exitPrice: 142.00,
    stopLossPrice: 121.50,
    targetPrice: 154.00,
    riskRewardRatio: 3.65,
    emotionalState: 'DISCIPLINED',
    notes: 'Clean 3-contraction VCP forming right below all-time highs. Volume dried up by 68% during the 3rd contraction (T3). Entered right as volume surged 2.4x above average on the pivot breakout.',
    keyLesson: 'Patience pays off. Waiting for the volume dry-up on the final contraction prevented a premature entry.',
    tradeStatus: 'CLOSED_WIN',
    rating: 5,
    sector: 'Technology',
    industry: 'Semiconductors',
    sectorRank: 1,
    sectorRsScore: 94,
    sectorTrend: 'LEADING',
    sectorTailwindNotes: 'Top-ranked leading industry theme with strong institutional accumulation and AI infrastructure tailwinds.',
    patternQualityScore: 96,
    patternTightnessRatio: 68,
    volumeDryUpRatio: -68.0,
    contractionsSummary: 'T1: -18.4% (16d) ➔ T2: -9.2% (8d) ➔ T3: -3.1% (4d)',
    patternChecklistPassed: ['Stage 2 Trend 8/8', 'Volume Dry-Up -68%', 'Progressive Tightening 68%', 'RS 99 Leader']
  },
  {
    id: 'journal-aapl-1',
    ticker: 'AAPL',
    stockName: 'Apple Inc.',
    exchange: 'NASDAQ',
    date: '2026-07-20',
    setupType: 'Pivot Pullback',
    entryPrice: 220.00,
    exitPrice: 216.50,
    stopLossPrice: 214.00,
    targetPrice: 242.00,
    riskRewardRatio: 3.67,
    emotionalState: 'ANXIOUS',
    notes: 'Attempted to buy a breakout without sufficient volume dry-up in the base. Got caught in minor shakeout and hit stop loss.',
    keyLesson: 'Never compromise on volume dry-up criteria. Low volume contraction is non-negotiable for SEPA setups.',
    tradeStatus: 'CLOSED_LOSS',
    rating: 3,
    sector: 'Technology',
    industry: 'Consumer Electronics',
    sectorRank: 1,
    sectorRsScore: 82,
    sectorTrend: 'IMPROVING',
    sectorTailwindNotes: 'Technology group performing well, but individual stock lacked the proper VCP volume dry-up signature.',
    patternQualityScore: 72,
    patternTightnessRatio: 35,
    volumeDryUpRatio: -18.5,
    contractionsSummary: 'T1: -11.0% (12d) ➔ T2: -6.5% (6d)',
    patternChecklistPassed: ['Stage 2 Trend 8/8', 'RS 82 Leader']
  },
  {
    id: 'journal-tsla-1',
    ticker: 'TSLA',
    stockName: 'Tesla Inc.',
    exchange: 'NASDAQ',
    date: '2026-07-26',
    setupType: 'High Tight Flag',
    entryPrice: 254.00,
    stopLossPrice: 239.00,
    targetPrice: 310.00,
    riskRewardRatio: 3.73,
    emotionalState: 'CONFIDENT',
    notes: 'High tight flag after a 120% surge in 6 weeks. Consolidating tightly in the upper quartile of the range. Ready for secondary breakout.',
    keyLesson: 'Keep position size scaled correctly when volatility is high in growth stocks.',
    tradeStatus: 'ACTIVE_TRADE',
    rating: 4,
    sector: 'Consumer Cyclical',
    industry: 'Auto Manufacturers',
    sectorRank: 2,
    sectorRsScore: 88,
    sectorTrend: 'LEADING',
    sectorTailwindNotes: 'Consumer Cyclical momentum accelerating with heavy institutional buying in EV / Autonomous theme.',
    patternQualityScore: 92,
    patternTightnessRatio: 64,
    volumeDryUpRatio: -58.0,
    contractionsSummary: 'T1: -12.0% (10d) ➔ T2: -4.5% (4d)',
    patternChecklistPassed: ['Stage 2 Trend 8/8', 'Volume Dry-Up -58%', 'Upper Quartile Consolidation']
  },
  {
    id: 'journal-reliance-1',
    ticker: 'RELIANCE',
    stockName: 'Reliance Industries Ltd',
    exchange: 'NSE',
    date: '2026-07-22',
    setupType: 'Cup with Handle',
    entryPrice: 2950.00,
    stopLossPrice: 2800.00,
    targetPrice: 3450.00,
    riskRewardRatio: 3.33,
    emotionalState: 'CALM',
    notes: 'Classic cup with handle pattern on NSE. Handle formed in lower volume over 3 weeks. Clean pivot at 2950.',
    keyLesson: 'Index alignment matters. Ensure Nifty 50 is in confirmed uptrend before committing capital.',
    tradeStatus: 'PLANNING',
    rating: 4,
    sector: 'Energy',
    industry: 'Oil & Gas Refining',
    sectorRank: 4,
    sectorRsScore: 78,
    sectorTrend: 'ROTATIONAL',
    sectorTailwindNotes: 'Energy sector showing rotational buying on crude stability; large-cap bellwether base.',
    patternQualityScore: 86,
    patternTightnessRatio: 52,
    volumeDryUpRatio: -46.0,
    contractionsSummary: 'Cup Depth: -16.0% ➔ Handle Depth: -4.8%',
    patternChecklistPassed: ['Stage 2 Trend 8/8', 'Volume Dry-Up -46%', 'Pivot Resistance Defined']
  }
];

export function getStoredJournalNotes(): TradeJournalNote[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(INITIAL_JOURNAL_NOTES));
      return INITIAL_JOURNAL_NOTES;
    }
    const notes: TradeJournalNote[] = JSON.parse(raw);
    // Enrich any note missing sector metadata with defaults
    let updated = false;
    const enriched = notes.map((n) => {
      if (!n.sector) {
        updated = true;
        const initialMatch = INITIAL_JOURNAL_NOTES.find((inNote) => inNote.ticker.toUpperCase() === n.ticker.toUpperCase());
        if (initialMatch) {
          return {
            ...n,
            sector: initialMatch.sector,
            industry: initialMatch.industry,
            sectorRank: initialMatch.sectorRank,
            sectorRsScore: initialMatch.sectorRsScore,
            sectorTrend: initialMatch.sectorTrend,
            sectorTailwindNotes: initialMatch.sectorTailwindNotes,
            patternQualityScore: n.patternQualityScore || initialMatch.patternQualityScore,
            contractionsSummary: n.contractionsSummary || initialMatch.contractionsSummary,
            volumeDryUpRatio: n.volumeDryUpRatio ?? initialMatch.volumeDryUpRatio,
            patternTightnessRatio: n.patternTightnessRatio ?? initialMatch.patternTightnessRatio,
            patternChecklistPassed: n.patternChecklistPassed || initialMatch.patternChecklistPassed,
          };
        }
      }
      return n;
    });

    if (updated) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(enriched));
    }
    return enriched;
  } catch (err) {
    console.error('Error reading journal notes from localStorage:', err);
    return INITIAL_JOURNAL_NOTES;
  }
}

export function saveStoredJournalNotes(notes: TradeJournalNote[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(notes));
    window.dispatchEvent(new CustomEvent('minervini_journal_updated'));
  } catch (err) {
    console.error('Error saving journal notes to localStorage:', err);
  }
}

export function getNotesForTicker(ticker: string): TradeJournalNote[] {
  const notes = getStoredJournalNotes();
  return notes.filter((n) => n.ticker.toUpperCase() === ticker.toUpperCase());
}
