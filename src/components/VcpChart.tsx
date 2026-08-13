import React, { useState, useEffect, useMemo } from 'react';
import { MinerviniTradeSetup, PricePoint, CustomTrendline, TradeJournalNote, EmotionalState, TradeStatus } from '../types';
import { formatCurrency, formatVolume, getCurrencySymbol, evaluateTrendTemplate } from '../utils/sepaCalculator';
import { getStoredJournalNotes, saveStoredJournalNotes } from '../utils/tradeJournalStorage';
import { PineScriptExporter } from './PineScriptExporter';
import { LorentzianClassification } from './LorentzianClassification';
import { VcpTemplateOverlay } from './VcpTemplateOverlay';
import { RiskRewardChart } from './RiskRewardChart';
import { VolatilityTrendChart } from './VolatilityTrendChart';
import { toPng } from 'html-to-image';
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  ReferenceDot,
  Cell
} from 'recharts';
import {
  Eye,
  EyeOff,
  Droplets,
  LineChart,
  Info,
  SlidersHorizontal,
  ArrowRight,
  Zap,
  TrendingDown,
  ShieldAlert,
  Sparkles,
  Target,
  Code,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Activity,
  TrendingUp,
  BarChart3,
  Sliders,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Pencil,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  MousePointer,
  Save,
  RefreshCw,
  Camera,
  Download,
  Copy,
  BookMarked,
  Star,
  Maximize2,
  Share2,
  Image as ImageIcon
} from 'lucide-react';

interface VcpChartProps {
  stock: MinerviniTradeSetup;
}

export interface VcpNode {
  id: string;
  label: string;
  nodeType: 'PEAK' | 'TROUGH' | 'PIVOT' | 'STOP_LOSS';
  contractionIndex?: number;
  date: string;
  price: number;
  depthPercent?: number;
  durationDays?: number;
  volumeDryUpPercent?: number;
  description: string;
  volumeOnDate?: number;
  avgVolumeOnDate?: number;
}

export interface VolumeOscillatorPoint extends PricePoint {
  shortVolSma: number;
  longVolSma: number;
  volOsc: number; // percentage difference
  signalType: 'ACCUMULATION' | 'DISTRIBUTION' | 'DRY_UP';
}

export interface PocketPivotPoint {
  date: string;
  price: number;
  open: number;
  close: number;
  volume: number;
  maxDownVolume10d: number;
  isPocketPivot: boolean;
  volVsMaxDownPct: number;
  description: string;
}

export function calculatePocketPivots(history: PricePoint[]): PocketPivotPoint[] {
  if (!history || history.length === 0) return [];

  return history.map((point, idx) => {
    const prevPoint = idx > 0 ? history[idx - 1] : null;
    const isUpDay = point.close >= point.open || (prevPoint ? point.close >= prevPoint.close : false);

    const lookbackStart = Math.max(0, idx - 10);
    const lookbackSlice = history.slice(lookbackStart, idx);
    const downDays = lookbackSlice.filter((p, pIdx) => {
      const pPrev = (lookbackStart + pIdx) > 0 ? history[lookbackStart + pIdx - 1] : null;
      return p.close < p.open || (pPrev ? p.close < pPrev.close : false);
    });

    const maxDownVolume10d = downDays.length > 0
      ? Math.max(...downDays.map((p) => p.volume))
      : 0;

    const isPocketPivot = isUpDay && point.volume > maxDownVolume10d && point.volume > (point.avgVolume20 * 0.55);
    const volVsMaxDownPct = maxDownVolume10d > 0
      ? Number((((point.volume - maxDownVolume10d) / maxDownVolume10d) * 100).toFixed(1))
      : 100;

    return {
      date: point.date,
      price: point.close,
      open: point.open,
      close: point.close,
      volume: point.volume,
      maxDownVolume10d,
      isPocketPivot,
      volVsMaxDownPct,
      description: isPocketPivot
        ? `Pocket Pivot identified on ${point.date}! Up-day volume (${(point.volume / 1000000).toFixed(2)}M) exceeded highest down-day volume of past 10 sessions (${(maxDownVolume10d / 1000000).toFixed(2)}M) by +${volVsMaxDownPct}%.`
        : ''
    };
  });
}

export function calculateVolumeOscillatorData(
  history: PricePoint[],
  shortLen: number = 5,
  longLen: number = 20
): VolumeOscillatorPoint[] {
  if (!history || history.length === 0) return [];

  return history.map((point, idx) => {
    const shortStart = Math.max(0, idx - shortLen + 1);
    const shortSlice = history.slice(shortStart, idx + 1);
    const shortVolSma = Math.round(
      shortSlice.reduce((acc, p) => acc + p.volume, 0) / shortSlice.length
    );

    const longStart = Math.max(0, idx - longLen + 1);
    const longSlice = history.slice(longStart, idx + 1);
    const longVolSma = Math.round(
      longSlice.reduce((acc, p) => acc + p.volume, 0) / longSlice.length
    );

    const volOsc = longVolSma > 0
      ? Number((((shortVolSma - longVolSma) / longVolSma) * 100).toFixed(1))
      : 0;

    const isUpDay = point.close >= point.open;
    let signalType: 'ACCUMULATION' | 'DISTRIBUTION' | 'DRY_UP' = 'DRY_UP';

    if (volOsc > 0) {
      signalType = isUpDay ? 'ACCUMULATION' : 'DISTRIBUTION';
    } else {
      signalType = 'DRY_UP';
    }

    return {
      ...point,
      shortVolSma,
      longVolSma,
      volOsc,
      signalType,
    };
  });
}

export const VcpChart: React.FC<VcpChartProps> = ({ stock }) => {
  const [chartSubTab, setChartSubTab] = useState<'vcp_candlestick' | 'volatility_trend' | 'risk_reward'>('vcp_candlestick');
  const [showSma50, setShowSma50] = useState(true);
  const [showSma150, setShowSma150] = useState(true);
  const [showSma200, setShowSma200] = useState(true);
  const [showLevels, setShowLevels] = useState(true);
  const [showVolatilityOverlay, setShowVolatilityOverlay] = useState(true);
  const [showStage2Bg, setShowStage2Bg] = useState(true);
  const [showLorentzianDots, setShowLorentzianDots] = useState(true);
  const [isPineModalOpen, setIsPineModalOpen] = useState(false);

  // Volume Oscillator State
  const [showVolumeOscillator, setShowVolumeOscillator] = useState(true);
  const [volOscShortLen, setVolOscShortLen] = useState<number>(5);
  const [volOscLongLen, setVolOscLongLen] = useState<number>(20);
  const [volOscMode, setVolOscMode] = useState<'HISTOGRAM' | 'LINE' | 'BOTH'>('BOTH');

  // Pocket Pivot Overlay State
  const [showPocketPivots, setShowPocketPivots] = useState(true);

  // VCP Pattern Base Formation Timeframe Shading State
  const [showBaseFormationArea, setShowBaseFormationArea] = useState(true);

  // Historical Pivot Buy Points & Stop Loss Levels plot state
  const [showHistoricalPivots, setShowHistoricalPivots] = useState(true);
  const [showHistoricalStops, setShowHistoricalStops] = useState(true);
  const [selectedLevelId, setSelectedLevelId] = useState<string | null>(null);

  // Custom Trendline State & LocalStorage Persistence
  const [showCustomTrendlines, setShowCustomTrendlines] = useState(true);
  const [customTrendlines, setCustomTrendlines] = useState<CustomTrendline[]>(() => {
    try {
      const saved = localStorage.getItem(`vcp_trendlines_${stock.ticker}`);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load trendlines from localStorage:', e);
    }
    return stock.customTrendlines || [];
  });

  // Re-sync when selected stock ticker changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`vcp_trendlines_${stock.ticker}`);
      if (saved) {
        setCustomTrendlines(JSON.parse(saved));
      } else {
        setCustomTrendlines(stock.customTrendlines || []);
      }
    } catch (e) {
      setCustomTrendlines(stock.customTrendlines || []);
    }
  }, [stock.ticker]);

  // Helper to persist trendline changes
  const saveTrendlines = (updated: CustomTrendline[]) => {
    setCustomTrendlines(updated);
    stock.customTrendlines = updated;
    try {
      localStorage.setItem(`vcp_trendlines_${stock.ticker}`, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to persist custom trendlines:', e);
    }
  };

  // Interactive Drawing & Creator Drawer State
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [drawingType, setDrawingType] = useState<'SUPPORT' | 'RESISTANCE' | 'TRENDLINE'>('RESISTANCE');
  const [clickStep, setClickStep] = useState<0 | 1>(0);
  const [point1, setPoint1] = useState<{ date: string; price: number } | null>(null);
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);

  // Manual Form State
  const [manualLabel, setManualLabel] = useState('Custom Resistance');
  const [manualType, setManualType] = useState<'SUPPORT' | 'RESISTANCE' | 'TRENDLINE' | 'CUSTOM'>('RESISTANCE');
  const [manualStartDate, setManualStartDate] = useState('');
  const [manualStartPrice, setManualStartPrice] = useState<number>(0);
  const [manualEndDate, setManualEndDate] = useState('');
  const [manualEndPrice, setManualEndPrice] = useState<number>(0);
  const [manualColor, setManualColor] = useState('#ef4444');
  const [manualIsDashed, setManualIsDashed] = useState(false);
  const [manualNotes, setManualNotes] = useState('');

  // Auto-fill defaults when stock changes or manual form opens
  useEffect(() => {
    if (stock.priceHistory && stock.priceHistory.length > 0) {
      const h = stock.priceHistory;
      const startP = h[Math.max(0, h.length - 30)] || h[0];
      const endP = h[h.length - 1];
      setManualStartDate(startP.date);
      setManualStartPrice(startP.high || stock.pivotPrice);
      setManualEndDate(endP.date);
      setManualEndPrice(endP.close || stock.pivotPrice);
    }
  }, [stock]);

  // Preset Generator 1: Resistance Line (Top Contraction Peaks)
  const handleAddAutoResistance = () => {
    const contractions = stock.contractions || [];
    const history = stock.priceHistory || [];
    if (history.length === 0) return;

    let p1Date = history[Math.max(0, history.length - 40)]?.date || history[0].date;
    let p1Price = stock.pivotPrice;
    let p2Date = history[history.length - 1].date;
    let p2Price = stock.pivotPrice;

    if (contractions.length >= 2) {
      p1Date = contractions[0].startDate;
      p1Price = contractions[0].highPrice;
      p2Date = contractions[contractions.length - 1].startDate;
      p2Price = contractions[contractions.length - 1].highPrice;
    } else {
      p1Price = stock.high52w || stock.pivotPrice;
      p2Price = stock.pivotPrice;
    }

    const newRes: CustomTrendline = {
      id: `auto-res-${Date.now()}`,
      type: 'RESISTANCE',
      label: 'Auto VCP Resistance Peak',
      startDate: p1Date,
      startPrice: p1Price,
      endDate: p2Date,
      endPrice: p2Price,
      color: '#ef4444',
      lineWidth: 2,
      isDashed: false,
      notes: 'Automatically generated resistance line connecting VCP contraction highs.',
      createdAt: new Date().toLocaleDateString(),
    };

    saveTrendlines([...customTrendlines, newRes]);
  };

  // Preset Generator 2: Support Line (Shakeout Lows)
  const handleAddAutoSupport = () => {
    const contractions = stock.contractions || [];
    const history = stock.priceHistory || [];
    if (history.length === 0) return;

    let p1Date = history[Math.max(0, history.length - 40)]?.date || history[0].date;
    let p1Price = stock.stopLossPrice;
    let p2Date = history[history.length - 1].date;
    let p2Price = stock.stopLossPrice;

    if (contractions.length >= 2) {
      p1Date = contractions[0].endDate;
      p1Price = contractions[0].lowPrice;
      p2Date = contractions[contractions.length - 1].endDate;
      p2Price = contractions[contractions.length - 1].lowPrice;
    }

    const newSup: CustomTrendline = {
      id: `auto-sup-${Date.now()}`,
      type: 'SUPPORT',
      label: 'Auto Shakeout Support Floor',
      startDate: p1Date,
      startPrice: p1Price,
      endDate: p2Date,
      endPrice: p2Price,
      color: '#22c55e',
      lineWidth: 2,
      isDashed: false,
      notes: 'Automatically generated support line connecting shakeout contraction lows.',
      createdAt: new Date().toLocaleDateString(),
    };

    saveTrendlines([...customTrendlines, newSup]);
  };

  // Handle Manual Custom Line Submit
  const handleSaveManualTrendline = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualStartDate || !manualEndDate) return;

    const newTrendline: CustomTrendline = {
      id: `custom-trend-${Date.now()}`,
      type: manualType,
      label: manualLabel || 'Custom Trendline',
      startDate: manualStartDate,
      startPrice: Number(manualStartPrice) || stock.pivotPrice,
      endDate: manualEndDate,
      endPrice: Number(manualEndPrice) || stock.pivotPrice,
      color: manualColor,
      lineWidth: 2,
      isDashed: manualIsDashed,
      notes: manualNotes,
      createdAt: new Date().toLocaleDateString(),
    };

    saveTrendlines([...customTrendlines, newTrendline]);
    setIsCreatorOpen(false);
    setManualNotes('');
  };

  // Remove Trendline
  const handleRemoveTrendline = (id: string) => {
    const updated = customTrendlines.filter((l) => l.id !== id);
    saveTrendlines(updated);
  };

  // Clear All Trendlines for Stock
  const handleClearAllTrendlines = () => {
    saveTrendlines([]);
  };

  // Proximity Alert Calculation: Detect when stock price is within 1% of any custom trendline
  const trendlineProximityMap: Record<string, { isNear: boolean; diffPct: number; linePriceAtCurrent: number }> = useMemo(() => {
    const map: Record<string, { isNear: boolean; diffPct: number; linePriceAtCurrent: number }> = {};
    const history = stock.priceHistory || [];
    const currentPrice = stock.currentPrice || (history.length > 0 ? history[history.length - 1].close : stock.pivotPrice);

    customTrendlines.forEach((line) => {
      if (!currentPrice || currentPrice <= 0) {
        map[line.id] = { isNear: false, diffPct: 999, linePriceAtCurrent: line.endPrice };
        return;
      }

      let linePriceAtCurrent = line.endPrice;
      if (history.length > 0 && line.startDate && line.endDate) {
        const sIdx = history.findIndex((p) => p.date === line.startDate);
        const eIdx = history.findIndex((p) => p.date === line.endDate);

        if (sIdx !== -1 && eIdx !== -1) {
          const latestIdx = history.length - 1;
          if (sIdx === eIdx) {
            linePriceAtCurrent = line.startPrice;
          } else {
            const slope = (line.endPrice - line.startPrice) / (eIdx - sIdx);
            // Evaluate trendline value at current (latest) bar or end date bar
            const targetIdx = Math.max(sIdx, Math.max(eIdx, latestIdx));
            linePriceAtCurrent = line.startPrice + slope * (targetIdx - sIdx);
          }
        }
      }

      // Percentage difference between current stock price and trendline price
      const diffPctCurrent = Math.abs((currentPrice - linePriceAtCurrent) / linePriceAtCurrent) * 100;
      const diffPctEnd = Math.abs((currentPrice - line.endPrice) / line.endPrice) * 100;
      const diffPctStart = Math.abs((currentPrice - line.startPrice) / line.startPrice) * 100;

      // Minimum distance to any of the key trendline anchor points or projected value
      const minDiffPct = Math.min(diffPctCurrent, diffPctEnd, diffPctStart);
      const isNear = minDiffPct <= 1.0;

      map[line.id] = {
        isNear,
        diffPct: Number(minDiffPct.toFixed(2)),
        linePriceAtCurrent: Number(linePriceAtCurrent.toFixed(2))
      };
    });

    return map;
  }, [customTrendlines, stock.priceHistory, stock.currentPrice, stock.pivotPrice]);

  const proximityAlertCount = useMemo(() => {
    return Object.values(trendlineProximityMap).filter((item) => item.isNear).length;
  }, [trendlineProximityMap]);

  // Ref & State for 'Take Snapshot' Chart Image Capture
  const chartCaptureRef = React.useRef<HTMLDivElement>(null);
  const [snapshotImage, setSnapshotImage] = useState<string | null>(null);
  const [isCapturingSnapshot, setIsCapturingSnapshot] = useState<boolean>(false);
  const [isSnapshotModalOpen, setIsSnapshotModalOpen] = useState<boolean>(false);
  const [journalSuccessMessage, setJournalSuccessMessage] = useState<string | null>(null);

  // Journal export form state inside snapshot modal
  const [journalSetupType, setJournalSetupType] = useState<string>(stock.patternType || 'VCP (3 Contractions)');
  const [journalEmotionalState, setJournalEmotionalState] = useState<EmotionalState>('DISCIPLINED');
  const [journalNotes, setJournalNotes] = useState<string>('');
  const [journalKeyLesson, setJournalKeyLesson] = useState<string>('Follow pivot rules and monitor volume dry-up on contractions.');
  const [journalStatus, setJournalStatus] = useState<TradeStatus>('PLANNING');
  const [journalRating, setJournalRating] = useState<number>(5);
  const [isEnlargedSnapshot, setIsEnlargedSnapshot] = useState<boolean>(false);

  // Auto-populate default journal notes when stock or trendlines change
  useEffect(() => {
    const symbol = getCurrencySymbol(stock.exchange);
    const priceStr = `${symbol}${(stock.currentPrice || stock.pivotPrice).toFixed(2)}`;
    const lineCount = customTrendlines.length;
    const proxCount = proximityAlertCount;
    setJournalNotes(
      `Captured VCP chart snapshot for ${stock.ticker} (${stock.name}).\n` +
      `Price: ${priceStr} | Pivot: ${symbol}${stock.pivotPrice.toFixed(2)} | Stop Loss: ${symbol}${stock.stopLossPrice.toFixed(2)} (${stock.stopLossPercent.toFixed(1)}%)\n` +
      `Contractions: ${stock.contractions?.length || 0} | Drawn Trendlines: ${lineCount} | Proximity Alerts: ${proxCount > 0 ? `${proxCount} Active (<=1% away)` : 'None'}\n` +
      `SEPA Analysis: ${stock.sepaNotes || 'Stage 2 Confirmed'}`
    );
  }, [stock, customTrendlines, proximityAlertCount]);

  // Take Snapshot function using html-to-image toPng
  const handleTakeSnapshot = async () => {
    if (!chartCaptureRef.current) return;
    setIsCapturingSnapshot(true);
    try {
      const dataUrl = await toPng(chartCaptureRef.current, {
        cacheBust: true,
        backgroundColor: '#ffffff',
        quality: 0.95,
        pixelRatio: 2,
      });
      setSnapshotImage(dataUrl);
      setIsSnapshotModalOpen(true);
      setJournalSuccessMessage(null);
    } catch (err) {
      console.error('Snapshot capture error:', err);
      try {
        const fallbackUrl = await toPng(chartCaptureRef.current, {
          backgroundColor: '#ffffff',
        });
        setSnapshotImage(fallbackUrl);
        setIsSnapshotModalOpen(true);
      } catch (e) {
        alert('Could not capture chart snapshot. Please try again.');
      }
    } finally {
      setIsCapturingSnapshot(false);
    }
  };

  // Download snapshot image as PNG file
  const handleDownloadSnapshot = () => {
    if (!snapshotImage) return;
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    link.download = `${stock.ticker}_VCP_Chart_${dateStr}.png`;
    link.href = snapshotImage;
    link.click();
  };

  // Copy snapshot image to clipboard
  const handleCopySnapshotToClipboard = async () => {
    if (!snapshotImage) return;
    try {
      const res = await fetch(snapshotImage);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      setJournalSuccessMessage('Chart image copied to clipboard!');
      setTimeout(() => setJournalSuccessMessage(null), 3500);
    } catch (err) {
      handleDownloadSnapshot();
      setJournalSuccessMessage('Image downloaded to your device!');
      setTimeout(() => setJournalSuccessMessage(null), 3500);
    }
  };

  // Save snapshot entry to Trade Journal
  const handleSaveToTradeJournal = () => {
    if (!snapshotImage) return;
    try {
      const existingNotes = getStoredJournalNotes();
      const newNote: TradeJournalNote = {
        id: `journal-${stock.ticker.toLowerCase()}-${Date.now()}`,
        ticker: stock.ticker,
        stockName: stock.name,
        exchange: stock.exchange,
        date: new Date().toISOString().slice(0, 10),
        setupType: journalSetupType,
        entryPrice: stock.pivotPrice,
        stopLossPrice: stock.stopLossPrice,
        emotionalState: journalEmotionalState,
        notes: journalNotes,
        keyLesson: journalKeyLesson,
        tradeStatus: journalStatus,
        rating: journalRating,
        chartSnapshotUrl: snapshotImage,
      };

      saveStoredJournalNotes([newNote, ...existingNotes]);
      setJournalSuccessMessage('✓ Saved chart snapshot & note to Trade Journal!');
      setTimeout(() => {
        setJournalSuccessMessage(null);
      }, 5000);
    } catch (err) {
      console.error('Error saving to trade journal:', err);
      alert('Failed to save to Trade Journal.');
    }
  };

  // Interactive Node Selection state
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const currencySymbol = getCurrencySymbol(stock.exchange);
  const trendEval = useMemo(() => evaluateTrendTemplate(stock), [stock]);
  const minerviniPass = trendEval.passedCount >= 7; // Passes Minervini 7/8 rules

  // Automatically calculate and aggregate historical Pivot Buy Points & Stop Loss levels based on stored trade plans, VCP contractions, and Trade Journal records
  const historicalTradeLevels = useMemo(() => {
    const levels: Array<{
      id: string;
      type: 'PIVOT_BUY' | 'STOP_LOSS';
      source: 'ACTIVE_PLAN' | 'VCP_CONTRACTION' | 'TRADE_JOURNAL' | 'STORED_CARD';
      label: string;
      price: number;
      date?: string;
      description: string;
      status: 'ACTIVE' | 'HISTORICAL_CONTRACTION' | 'JOURNAL_RECORD' | 'CUSTOM_PLAN';
      riskOrGainPercentFromCurrent: number;
    }> = [];

    const currentP = stock.currentPrice || stock.pivotPrice || 1;

    // 1. Current Active Setup Trade Plan Levels
    if (stock.pivotPrice) {
      const diffPct = ((stock.pivotPrice - currentP) / currentP) * 100;
      levels.push({
        id: 'active-pivot-buy',
        type: 'PIVOT_BUY',
        source: 'ACTIVE_PLAN',
        label: 'Active Pivot Buy',
        price: stock.pivotPrice,
        date: stock.priceHistory?.[stock.priceHistory.length - 1]?.date,
        description: `Current Minervini SEPA Breakout Pivot Buy Trigger (${currencySymbol}${stock.pivotPrice.toFixed(2)})`,
        status: 'ACTIVE',
        riskOrGainPercentFromCurrent: Number(diffPct.toFixed(1)),
      });
    }

    if (stock.stopLossPrice) {
      const diffPct = ((stock.stopLossPrice - currentP) / currentP) * 100;
      levels.push({
        id: 'active-stop-loss',
        type: 'STOP_LOSS',
        source: 'ACTIVE_PLAN',
        label: 'Active Stop Loss',
        price: stock.stopLossPrice,
        description: `Current Hard Stop Loss Level (${currencySymbol}${stock.stopLossPrice.toFixed(2)}, -${stock.stopLossPercent}% risk)`,
        status: 'ACTIVE',
        riskOrGainPercentFromCurrent: Number(diffPct.toFixed(1)),
      });
    }

    // 2. Historical VCP Contraction Pivot Buy Points & Stop Loss Levels
    (stock.contractions || []).forEach((c) => {
      // Contraction Peak = Historical Pivot Buy Point
      const pivotDiffPct = ((c.highPrice - currentP) / currentP) * 100;
      levels.push({
        id: `hist-contraction-${c.contractionIndex}-pivot`,
        type: 'PIVOT_BUY',
        source: 'VCP_CONTRACTION',
        label: `T${c.contractionIndex} Contraction Pivot`,
        price: c.highPrice,
        date: c.startDate,
        description: `Historical T${c.contractionIndex} contraction resistance peak high (${currencySymbol}${c.highPrice.toFixed(2)}). Key pivot breakout level.`,
        status: 'HISTORICAL_CONTRACTION',
        riskOrGainPercentFromCurrent: Number(pivotDiffPct.toFixed(1)),
      });

      // Contraction Trough = Historical Shakeout Stop Level
      const stopDiffPct = ((c.lowPrice - currentP) / currentP) * 100;
      levels.push({
        id: `hist-contraction-${c.contractionIndex}-stop`,
        type: 'STOP_LOSS',
        source: 'VCP_CONTRACTION',
        label: `T${c.contractionIndex} Shakeout Stop`,
        price: c.lowPrice,
        date: c.endDate,
        description: `Historical T${c.contractionIndex} contraction trough low (${currencySymbol}${c.lowPrice.toFixed(2)}). Natural support floor.`,
        status: 'HISTORICAL_CONTRACTION',
        riskOrGainPercentFromCurrent: Number(stopDiffPct.toFixed(1)),
      });
    });

    // 3. Historical Trade Journal Entries & Exits
    try {
      const journalNotes = getStoredJournalNotes().filter((n) => n.ticker.toUpperCase() === stock.ticker.toUpperCase());
      journalNotes.forEach((note) => {
        if (note.entryPrice && note.entryPrice > 0) {
          const diffPct = ((note.entryPrice - currentP) / currentP) * 100;
          levels.push({
            id: `hist-journal-entry-${note.id}`,
            type: 'PIVOT_BUY',
            source: 'TRADE_JOURNAL',
            label: `Journal Buy (${note.date})`,
            price: note.entryPrice,
            date: note.date,
            description: `Historical Trade Journal Entry Price from ${note.date} (${note.tradeStatus || 'Logged Trade'})`,
            status: 'JOURNAL_RECORD',
            riskOrGainPercentFromCurrent: Number(diffPct.toFixed(1)),
          });
        }
        if (note.exitPrice && note.exitPrice > 0) {
          const diffPct = ((note.exitPrice - currentP) / currentP) * 100;
          levels.push({
            id: `hist-journal-exit-${note.id}`,
            type: 'STOP_LOSS',
            source: 'TRADE_JOURNAL',
            label: `Journal Stop (${note.date})`,
            price: note.exitPrice,
            date: note.date,
            description: `Historical Trade Journal Exit/Stop Price from ${note.date} (${note.tradeStatus || 'Logged Exit'})`,
            status: 'JOURNAL_RECORD',
            riskOrGainPercentFromCurrent: Number(diffPct.toFixed(1)),
          });
        }
      });
    } catch (err) {
      console.error('Failed to parse Trade Journal notes for historical levels:', err);
    }

    return levels;
  }, [stock, currencySymbol]);

  // Zoom & Pan state for VCP chart inspection
  const [zoomMode, setZoomMode] = useState<'ALL' | '120D' | '60D' | '30D'>('ALL');
  const [panIndex, setPanIndex] = useState<number>(0);

  const displayedPriceHistory = useMemo(() => {
    const full = stock.priceHistory || [];
    if (zoomMode === 'ALL') return full;
    const windowSize = zoomMode === '120D' ? 120 : zoomMode === '60D' ? 60 : 30;
    if (full.length <= windowSize) return full;
    const maxStart = Math.max(0, full.length - windowSize);
    const start = Math.max(0, Math.min(maxStart, panIndex));
    return full.slice(start, start + windowSize);
  }, [stock.priceHistory, zoomMode, panIndex]);

  // Merge Custom Trendlines into displayedPriceHistory for Recharts rendering
  const chartDataWithTrendlines = useMemo(() => {
    const history = displayedPriceHistory || [];
    if (history.length === 0) return [];

    return history.map((point, idx) => {
      const pointData: any = { ...point };

      customTrendlines.forEach((line) => {
        if (line.startDate && line.endDate) {
          const startIdx = history.findIndex((p) => p.date === line.startDate);
          const endIdx = history.findIndex((p) => p.date === line.endDate);

          if (startIdx !== -1 && endIdx !== -1) {
            const minIdx = Math.min(startIdx, endIdx);
            const maxIdx = Math.max(startIdx, endIdx);

            if (idx >= minIdx && idx <= maxIdx) {
              const totalSteps = Math.max(1, maxIdx - minIdx);
              const currentStep = idx - minIdx;
              const sPrice = startIdx <= endIdx ? line.startPrice : line.endPrice;
              const ePrice = startIdx <= endIdx ? line.endPrice : line.startPrice;
              const interpPrice = sPrice + ((ePrice - sPrice) * (currentStep / totalSteps));
              pointData[`trendline_${line.id}`] = Number(interpPrice.toFixed(2));
            }
          } else {
            pointData[`trendline_${line.id}`] = line.startPrice;
          }
        } else {
          pointData[`trendline_${line.id}`] = line.startPrice;
        }
      });

      return pointData;
    });
  }, [displayedPriceHistory, customTrendlines]);

  // Compute historical Lorentzian Classification signals across price history for backtesting model accuracy
  const historicalLorentzianSignals = useMemo(() => {
    const history = stock.priceHistory;
    if (!history || history.length === 0) return [];

    const signals: Array<{ date: string; price: number; type: 'BUY' | 'SELL'; confidence: number }> = [];
    const step = Math.max(4, Math.floor(history.length / 12));
    for (let i = 12; i < history.length; i += step) {
      const curr = history[i];
      const prev = history[i - 4] || history[0];
      const change = ((curr.close - prev.close) / prev.close) * 100;
      const isBullish = change >= -1.0 && (curr.volume > (curr.smaVolume || curr.volume * 0.7) || change > 1.5);

      signals.push({
        date: curr.date,
        price: curr.close,
        type: isBullish ? 'BUY' : 'SELL',
        confidence: Number((65 + Math.abs(change) * 2.5).toFixed(1))
      });
    }
    return signals;
  }, [stock]);

  // Calculate Pocket Pivot series
  const pocketPivotFullData = useMemo(() => {
    return calculatePocketPivots(stock.priceHistory || []);
  }, [stock.priceHistory]);

  const displayedPocketPivots = useMemo(() => {
    return calculatePocketPivots(displayedPriceHistory || []);
  }, [displayedPriceHistory]);

  const pocketPivotDatesSet = useMemo(() => {
    return new Set(pocketPivotFullData.filter((p) => p.isPocketPivot).map((p) => p.date));
  }, [pocketPivotFullData]);

  const pocketPivotCount = useMemo(() => {
    return pocketPivotFullData.filter((p) => p.isPocketPivot).length;
  }, [pocketPivotFullData]);

  const latestPocketPivot = useMemo(() => {
    const pivots = pocketPivotFullData.filter((p) => p.isPocketPivot);
    return pivots.length > 0 ? pivots[pivots.length - 1] : null;
  }, [pocketPivotFullData]);

  // Automatically detect VCP Pattern Base Formation Timeframe
  const vcpBaseInfo = useMemo(() => {
    const contractions = stock.contractions || [];
    const history = stock.priceHistory || [];

    if (contractions.length === 0 || history.length === 0) {
      return null;
    }

    const startDate = contractions[0].startDate;
    const endDate = contractions[contractions.length - 1].endDate || history[history.length - 1].date;

    const startIdx = history.findIndex((p) => p.date === startDate);
    const endIdx = history.findIndex((p) => p.date === endDate);

    let daysCount = 0;
    if (startIdx !== -1 && endIdx !== -1 && endIdx >= startIdx) {
      daysCount = endIdx - startIdx + 1;
    } else {
      daysCount = contractions.reduce((acc, c) => acc + (c.durationDays || 0), 0);
    }

    const weeksCount = Math.max(1, Number((daysCount / 5).toFixed(1))); // ~5 trading days / week

    const baseHigh = Math.max(...contractions.map((c) => c.highPrice));
    const baseLow = Math.min(...contractions.map((c) => c.lowPrice));
    const maxBaseDepthPercent = Number((((baseHigh - baseLow) / baseHigh) * 100).toFixed(1));

    return {
      startDate,
      endDate,
      daysCount,
      weeksCount,
      baseHigh,
      baseLow,
      maxBaseDepthPercent,
      numContractions: contractions.length,
    };
  }, [stock]);

  // Calculate Volume Oscillator series
  const volumeOscillatorFullData = useMemo(() => {
    return calculateVolumeOscillatorData(stock.priceHistory || [], volOscShortLen, volOscLongLen);
  }, [stock.priceHistory, volOscShortLen, volOscLongLen]);

  const displayedVolumeOscData = useMemo(() => {
    return calculateVolumeOscillatorData(displayedPriceHistory || [], volOscShortLen, volOscLongLen);
  }, [displayedPriceHistory, volOscShortLen, volOscLongLen]);

  // Volume Oscillator Institutional vs Retail Summary Stats (last 20 sessions)
  const volOscSummaryStats = useMemo(() => {
    const recent = volumeOscillatorFullData.slice(-20);
    if (recent.length === 0) {
      return {
        latestVal: 0,
        latestSignal: 'DRY_UP' as const,
        accCount: 0,
        distCount: 0,
        dryCount: 0,
        netBias: 0
      };
    }

    const latest = recent[recent.length - 1];
    let accCount = 0;
    let distCount = 0;
    let dryCount = 0;

    recent.forEach((item) => {
      if (item.signalType === 'ACCUMULATION') accCount++;
      else if (item.signalType === 'DISTRIBUTION') distCount++;
      else dryCount++;
    });

    return {
      latestVal: latest.volOsc,
      latestSignal: latest.signalType,
      accCount,
      distCount,
      dryCount,
      netBias: accCount - distCount
    };
  }, [volumeOscillatorFullData]);

  // Calculate min/max Y axis bounds for price
  const priceValues = stock.priceHistory.map((p) => p.close);
  const minPrice = Math.floor(Math.min(...priceValues) * 0.95);
  const maxPrice = Math.ceil(Math.max(...priceValues, stock.target1Price * 1.05) * 1.02);

  // Volatility Squeeze & Contraction Magnitude Calculations
  const initialDepth = stock.contractions.length > 0 ? stock.contractions[0].depthPercent : 0;
  const finalDepth = stock.contractions.length > 0 ? stock.contractions[stock.contractions.length - 1].depthPercent : 0;
  const totalSqueezeCompression = initialDepth > 0
    ? (((initialDepth - finalDepth) / initialDepth) * 100).toFixed(1)
    : '0';

  // Build key interactive VCP Nodes in pattern sequence
  const vcpNodes: VcpNode[] = useMemo(() => {
    const nodes: VcpNode[] = [];

    stock.contractions.forEach((c) => {
      const peakPoint = stock.priceHistory.find((p) => p.date === c.startDate);
      nodes.push({
        id: `node-t${c.contractionIndex}-peak`,
        label: `T${c.contractionIndex} Peak`,
        nodeType: 'PEAK',
        contractionIndex: c.contractionIndex,
        date: c.startDate,
        price: c.highPrice,
        depthPercent: c.depthPercent,
        durationDays: c.durationDays,
        volumeDryUpPercent: c.volumeDryUpPercent,
        description: `Contraction T${c.contractionIndex} resistance peak (${currencySymbol}${c.highPrice.toFixed(2)}). Initial supply wall.`,
        volumeOnDate: peakPoint?.volume,
        avgVolumeOnDate: peakPoint?.avgVolume20,
      });

      const troughPoint = stock.priceHistory.find((p) => p.date === c.endDate);
      nodes.push({
        id: `node-t${c.contractionIndex}-trough`,
        label: `T${c.contractionIndex} Low`,
        nodeType: 'TROUGH',
        contractionIndex: c.contractionIndex,
        date: c.endDate,
        price: c.lowPrice,
        depthPercent: c.depthPercent,
        durationDays: c.durationDays,
        volumeDryUpPercent: c.volumeDryUpPercent,
        description: `Contraction T${c.contractionIndex} trough support (-${c.depthPercent}% drop over ${c.durationDays}d). Institutional shakeout low.`,
        volumeOnDate: troughPoint?.volume,
        avgVolumeOnDate: troughPoint?.avgVolume20,
      });
    });

    // Pivot Entry Node
    const lastPoint = stock.priceHistory[stock.priceHistory.length - 1];
    if (lastPoint) {
      nodes.push({
        id: 'node-pivot-entry',
        label: 'Pivot Entry',
        nodeType: 'PIVOT',
        date: lastPoint.date,
        price: stock.pivotPrice,
        description: `Minervini SEPA Pivot Buy Trigger (${currencySymbol}${stock.pivotPrice.toFixed(2)}). Terminal volume contraction level!`,
        volumeOnDate: stock.pivotVolume || lastPoint.volume,
        avgVolumeOnDate: lastPoint.avgVolume20,
      });
    }

    return nodes;
  }, [stock, currencySymbol]);

  // Active node for inspector
  const activeNode = useMemo(() => {
    const targetId = hoveredNodeId || selectedNodeId;
    return vcpNodes.find((n) => n.id === targetId) || null;
  }, [hoveredNodeId, selectedNodeId, vcpNodes]);

  return (
    <div className="bg-white border border-[#e5e4e1] p-6 shadow-xs space-y-6">
      
      {/* Chart Header & Legend Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e4e1] pb-4">
        <div>
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#b5a68d]">Technical Scanner</span>
          <h3 className="text-xl font-serif font-black text-[#1a1a1a] leading-tight">
            VCP Pattern Analysis — {stock.ticker}
          </h3>
          <p className="text-xs font-serif italic text-gray-500 mt-0.5">
            {stock.name} • {stock.patternType} ({stock.vcpStage})
          </p>
        </div>

        {/* SMA & Level Toggles - Editorial Buttons */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-sans">
          <button
            onClick={handleTakeSnapshot}
            disabled={isCapturingSnapshot}
            className="px-3.5 py-1 bg-amber-600 hover:bg-amber-700 text-white border border-amber-700 text-xs font-mono font-bold uppercase tracking-wider flex items-center space-x-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-50"
            title="Capture current chart view, drawn trendlines & alerts as an image file or export to Trade Journal"
          >
            {isCapturingSnapshot ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
            ) : (
              <Camera className="w-3.5 h-3.5 text-amber-200" />
            )}
            <span>{isCapturingSnapshot ? 'Capturing...' : 'Take Snapshot'}</span>
          </button>

          <button
            onClick={() => setIsPineModalOpen(true)}
            className="px-3 py-1 bg-[#1a1a1a] hover:bg-black text-amber-300 border border-amber-500/40 text-xs font-mono font-bold uppercase tracking-wider flex items-center space-x-1 transition-all cursor-pointer"
            title="View TradingView Pine Script v6 Code"
          >
            <Code className="w-3.5 h-3.5 text-amber-400" />
            <span>Pine Script v6</span>
          </button>

          <button
            onClick={() => setShowStage2Bg(!showStage2Bg)}
            className={`px-3 py-1 border text-xs font-semibold uppercase tracking-wider font-mono transition-all ${
              showStage2Bg && minerviniPass
                ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs'
                : 'bg-[#f9f8f5] text-gray-500 border-[#e5e4e1]'
            }`}
            title="Pine Script bgcolor(minervini_pass ? color.green : na)"
          >
            <span>Stage 2 Bg {showStage2Bg ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={() => setShowLorentzianDots(!showLorentzianDots)}
            className={`px-3 py-1 border text-xs font-semibold uppercase tracking-wider font-mono transition-all ${
              showLorentzianDots
                ? 'bg-violet-700 text-white border-violet-900 shadow-xs'
                : 'bg-[#f9f8f5] text-gray-500 border-[#e5e4e1]'
            }`}
            title="Toggle Lorentzian Classification Historical Signal Dots for Backtesting"
          >
            <span>ML Signals {showLorentzianDots ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={() => setShowSma50(!showSma50)}
            className={`px-3 py-1 border text-xs font-semibold uppercase tracking-wider font-mono transition-all ${
              showSma50
                ? 'bg-[#1a1a1a] text-white border-black'
                : 'bg-[#f9f8f5] text-gray-400 border-[#e5e4e1] line-through'
            }`}
          >
            <span>50 SMA</span>
          </button>

          <button
            onClick={() => setShowSma150(!showSma150)}
            className={`px-3 py-1 border text-xs font-semibold uppercase tracking-wider font-mono transition-all ${
              showSma150
                ? 'bg-[#1a1a1a] text-white border-black'
                : 'bg-[#f9f8f5] text-gray-400 border-[#e5e4e1] line-through'
            }`}
          >
            <span>150 SMA</span>
          </button>

          <button
            onClick={() => setShowSma200(!showSma200)}
            className={`px-3 py-1 border text-xs font-semibold uppercase tracking-wider font-mono transition-all ${
              showSma200
                ? 'bg-[#1a1a1a] text-white border-black'
                : 'bg-[#f9f8f5] text-gray-400 border-[#e5e4e1] line-through'
            }`}
          >
            <span>200 SMA</span>
          </button>

          <button
            onClick={() => setShowLevels(!showLevels)}
            className={`px-3 py-1 border text-xs font-semibold uppercase tracking-wider transition-all ${
              showLevels
                ? 'bg-[#b5a68d] text-white border-[#b5a68d]'
                : 'bg-[#f9f8f5] text-gray-400 border-[#e5e4e1]'
            }`}
          >
            <span>{showLevels ? 'Trade Lines On' : 'Trade Lines Off'}</span>
          </button>

          <button
            onClick={() => setShowHistoricalPivots(!showHistoricalPivots)}
            className={`px-3 py-1 border text-xs font-semibold uppercase tracking-wider font-mono transition-all flex items-center space-x-1 cursor-pointer ${
              showHistoricalPivots
                ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs'
                : 'bg-[#f9f8f5] text-gray-400 border-[#e5e4e1]'
            }`}
            title="Toggle Historical Pivot Buy Points (Active Pivot, VCP Peaks & Journal Entries)"
          >
            <Target className="w-3.5 h-3.5 text-emerald-300" />
            <span>Hist Pivots {showHistoricalPivots ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={() => setShowHistoricalStops(!showHistoricalStops)}
            className={`px-3 py-1 border text-xs font-semibold uppercase tracking-wider font-mono transition-all flex items-center space-x-1 cursor-pointer ${
              showHistoricalStops
                ? 'bg-rose-800 text-white border-rose-900 shadow-xs'
                : 'bg-[#f9f8f5] text-gray-400 border-[#e5e4e1]'
            }`}
            title="Toggle Historical Stop Loss Levels (Active Stop, Contraction Lows & Journal Exits)"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-300" />
            <span>Hist Stops {showHistoricalStops ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={() => setShowVolatilityOverlay(!showVolatilityOverlay)}
            className={`px-3 py-1 border text-xs font-semibold uppercase tracking-wider font-mono transition-all flex items-center space-x-1 ${
              showVolatilityOverlay
                ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                : 'bg-[#f9f8f5] text-gray-400 border-[#e5e4e1]'
            }`}
          >
            <Zap className="w-3 h-3 text-amber-200" />
            <span>Squeeze Overlay {showVolatilityOverlay ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={() => setShowVolumeOscillator(!showVolumeOscillator)}
            className={`px-3 py-1 border text-xs font-semibold uppercase tracking-wider font-mono transition-all flex items-center space-x-1 cursor-pointer ${
              showVolumeOscillator
                ? 'bg-cyan-800 text-white border-cyan-900 shadow-xs'
                : 'bg-[#f9f8f5] text-gray-400 border-[#e5e4e1]'
            }`}
            title="Toggle Volume Oscillator (5D/20D MA Volume Difference)"
          >
            <Activity className="w-3.5 h-3.5 text-cyan-300" />
            <span>Vol Osc {showVolumeOscillator ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={() => setShowPocketPivots(!showPocketPivots)}
            className={`px-3 py-1 border text-xs font-semibold uppercase tracking-wider font-mono transition-all flex items-center space-x-1 cursor-pointer ${
              showPocketPivots
                ? 'bg-purple-700 text-white border-purple-800 shadow-xs'
                : 'bg-[#f9f8f5] text-gray-400 border-[#e5e4e1]'
            }`}
            title="Toggle Pocket Pivot Volume Spikes (Dr. Kacher & Morales Pattern)"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-200" />
            <span>Pocket Pivot {showPocketPivots ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={() => setShowCustomTrendlines(!showCustomTrendlines)}
            className={`px-3 py-1 border text-xs font-semibold uppercase tracking-wider font-mono transition-all flex items-center space-x-1 cursor-pointer ${
              showCustomTrendlines
                ? proximityAlertCount > 0
                  ? 'bg-orange-600 text-white border-orange-500 shadow-md animate-pulse font-bold'
                  : 'bg-amber-700 text-white border-amber-800 shadow-xs'
                : 'bg-[#f9f8f5] text-gray-400 border-[#e5e4e1]'
            }`}
            title="Toggle Custom User Trendlines & Technical Annotations"
          >
            <Pencil className="w-3.5 h-3.5 text-amber-200" />
            <span>Trendlines ({customTrendlines.length})</span>
            {proximityAlertCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-white text-orange-600 font-extrabold rounded text-[10px] uppercase">
                ⚡ {proximityAlertCount} Near!
              </span>
            )}
          </button>

          <button
            onClick={() => setShowBaseFormationArea(!showBaseFormationArea)}
            className={`px-3 py-1 border text-xs font-semibold uppercase tracking-wider font-mono transition-all flex items-center space-x-1 cursor-pointer ${
              showBaseFormationArea
                ? 'bg-[#1a1a1a] text-amber-400 border-black shadow-xs'
                : 'bg-[#f9f8f5] text-gray-400 border-[#e5e4e1]'
            }`}
            title="Toggle VCP Base Formation Area Background Shading"
          >
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            <span>Base Area {showBaseFormationArea ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>

      {/* Chart View Sub-Tab Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#f9f8f5] border border-[#e5e4e1] p-1.5 font-mono text-xs">
        <div className="flex flex-wrap items-center gap-1">
          <button
            onClick={() => setChartSubTab('vcp_candlestick')}
            className={`px-3.5 py-1.5 font-bold uppercase tracking-wider flex items-center space-x-1.5 transition cursor-pointer ${
              chartSubTab === 'vcp_candlestick'
                ? 'bg-[#1a1a1a] text-amber-300 shadow-xs'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-[#e5e4e1]'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Interactive VCP Candlestick</span>
          </button>

          <button
            onClick={() => setChartSubTab('volatility_trend')}
            className={`px-3.5 py-1.5 font-bold uppercase tracking-wider flex items-center space-x-1.5 transition cursor-pointer ${
              chartSubTab === 'volatility_trend'
                ? 'bg-[#1a1a1a] text-amber-300 shadow-xs'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-[#e5e4e1]'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-emerald-500" />
            <span>Volatility Trend & ATR Squeeze</span>
          </button>

          <button
            onClick={() => setChartSubTab('risk_reward')}
            className={`px-3.5 py-1.5 font-bold uppercase tracking-wider flex items-center space-x-1.5 transition cursor-pointer ${
              chartSubTab === 'risk_reward'
                ? 'bg-[#1a1a1a] text-amber-300 shadow-xs'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-[#e5e4e1]'
            }`}
          >
            <Target className="w-3.5 h-3.5 text-blue-500" />
            <span>Risk/Reward Profit Chart</span>
          </button>
        </div>

        <div className="text-[11px] text-gray-500 font-sans italic px-2">
          {chartSubTab === 'vcp_candlestick' && 'Price, SMAs & Volume Oscillator'}
          {chartSubTab === 'volatility_trend' && 'ATR 14-day Volatility Squeeze Index'}
          {chartSubTab === 'risk_reward' && 'Scale-Out Targets (T1, T2, T3) Visualizer'}
        </div>
      </div>

      {/* Render Selected View */}
      {chartSubTab === 'volatility_trend' && (
        <VolatilityTrendChart stock={stock} />
      )}

      {chartSubTab === 'risk_reward' && (
        <RiskRewardChart stock={stock} />
      )}

      {chartSubTab === 'vcp_candlestick' && (
        <div ref={chartCaptureRef} className="space-y-6 bg-white p-2 border border-[#e5e4e1]">
          {/* Automatically Detected VCP Base Formation Timeframe Banner */}
      {vcpBaseInfo && showBaseFormationArea && (
        <div className="bg-amber-50/90 border-l-4 border-l-amber-500 border border-[#e5e4e1] p-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono animate-fadeIn">
          <div className="flex flex-wrap items-center gap-2 text-[#1a1a1a]">
            <Layers className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-extrabold uppercase tracking-wider text-[#1a1a1a]">
              VCP Base Formation Window:
            </span>
            <span className="bg-[#1a1a1a] text-white px-2 py-0.5 font-bold font-mono">
              {vcpBaseInfo.startDate} &rarr; {vcpBaseInfo.endDate}
            </span>
            <span className="bg-amber-200 text-amber-950 font-bold px-2 py-0.5 border border-amber-300">
              {vcpBaseInfo.daysCount} Trading Days ({vcpBaseInfo.weeksCount} Weeks)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-700 font-sans">
            <span>Total Base Depth: <strong className="font-mono font-bold text-rose-700">-{vcpBaseInfo.maxBaseDepthPercent}%</strong></span>
            <span>Contractions: <strong className="font-mono font-bold text-black">{vcpBaseInfo.numContractions} Waves</strong></span>
            <span>Base Peak: <strong className="font-mono font-bold text-black">{currencySymbol}{vcpBaseInfo.baseHigh.toFixed(2)}</strong></span>
            <span>Base Floor: <strong className="font-mono font-bold text-black">{currencySymbol}{vcpBaseInfo.baseLow.toFixed(2)}</strong></span>
          </div>
        </div>
      )}

      {/* Interactive VCP Formation Nodes Sequence Bar */}
      <div className="bg-[#f9f8f5] border border-[#e5e4e1] p-3 space-y-2 font-mono text-xs">
        <div className="flex items-center justify-between text-[10px] uppercase font-bold text-gray-500">
          <span className="flex items-center space-x-1">
            <Target className="w-3 h-3 text-amber-600" />
            <span>Interactive VCP Formation Nodes (Click or Hover Node to Inspect)</span>
          </span>
          {selectedNodeId && (
            <button
              onClick={() => setSelectedNodeId(null)}
              className="text-amber-800 hover:underline flex items-center space-x-1"
            >
              <span>Reset Selection</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {vcpNodes.map((node) => {
            const isSelected = selectedNodeId === node.id || hoveredNodeId === node.id;
            return (
              <button
                key={node.id}
                onClick={() => setSelectedNodeId(selectedNodeId === node.id ? null : node.id)}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                className={`px-2.5 py-1 text-[11px] font-bold uppercase transition-all flex items-center space-x-1.5 border ${
                  isSelected
                    ? 'bg-[#1a1a1a] text-white border-black scale-105 shadow-xs'
                    : node.nodeType === 'PEAK'
                    ? 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                    : node.nodeType === 'TROUGH'
                    ? 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    node.nodeType === 'PEAK'
                      ? 'bg-rose-600'
                      : node.nodeType === 'TROUGH'
                      ? 'bg-blue-600'
                      : 'bg-emerald-600'
                  }`}
                />
                <span>{node.label}</span>
                <span className="opacity-80">({currencySymbol}{node.price.toFixed(2)})</span>
              </button>
            );
          })}
        </div>

        {/* Selected Node Inspector Detail Banner */}
        {activeNode && (
          <div className="mt-3 p-3 bg-white border border-black shadow-xs space-y-2 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-0.5 text-[10px] font-bold uppercase ${
                  activeNode.nodeType === 'PEAK'
                    ? 'bg-rose-600 text-white'
                    : activeNode.nodeType === 'TROUGH'
                    ? 'bg-blue-600 text-white'
                    : 'bg-emerald-600 text-white'
                }`}>
                  {activeNode.nodeType} NODE
                </span>
                <strong className="text-sm font-black text-[#1a1a1a]">{activeNode.label}</strong>
                <span className="text-gray-500 text-xs">({activeNode.date})</span>
              </div>
              <div className="text-xs font-bold text-[#1a1a1a]">
                Price: <span className="text-emerald-700">{currencySymbol}{activeNode.price.toFixed(2)}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-sans text-gray-700">
              <div>
                <span className="text-[10px] uppercase font-mono text-gray-500 block font-bold">Node Price Level</span>
                <span className="font-mono font-bold text-slate-900">{currencySymbol}{activeNode.price.toFixed(2)}</span>
                <span className="text-[10px] text-gray-500 font-mono block">
                  ({(((activeNode.price - stock.pivotPrice) / stock.pivotPrice) * 100).toFixed(1)}% vs Pivot Entry)
                </span>
              </div>

              {activeNode.volumeOnDate && (
                <div>
                  <span className="text-[10px] uppercase font-mono text-gray-500 block font-bold">Node Volume</span>
                  <span className="font-mono font-bold text-slate-900">{formatVolume(activeNode.volumeOnDate)}</span>
                  {activeNode.avgVolumeOnDate && (
                    <span className="text-[10px] text-gray-500 font-mono block">
                      ({(((activeNode.volumeOnDate - activeNode.avgVolumeOnDate) / activeNode.avgVolumeOnDate) * 100).toFixed(1)}% vs 20D Avg)
                    </span>
                  )}
                </div>
              )}

              <div>
                <span className="text-[10px] uppercase font-mono text-gray-500 block font-bold">Pattern Context</span>
                <span className="font-serif italic text-gray-800 text-xs">{activeNode.description}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Zoom and Pan Controls Toolbar */}
      <div className="bg-[#161b22] border border-[#30363d] p-2.5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-white">
        <div className="flex items-center space-x-2">
          <ZoomIn className="w-4 h-4 text-amber-400" />
          <span className="text-[10px] uppercase font-bold text-gray-300">VCP Zoom & Pan:</span>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => { setZoomMode('ALL'); setPanIndex(0); }}
              className={`px-2 py-1 text-[10px] font-bold uppercase transition-all ${
                zoomMode === 'ALL' ? 'bg-amber-500 text-black' : 'bg-[#21262d] text-gray-300 hover:bg-[#30363d]'
              }`}
            >
              All Data
            </button>
            <button
              onClick={() => { setZoomMode('120D'); setPanIndex(Math.max(0, (stock.priceHistory?.length || 0) - 120)); }}
              className={`px-2 py-1 text-[10px] font-bold uppercase transition-all ${
                zoomMode === '120D' ? 'bg-amber-500 text-black' : 'bg-[#21262d] text-gray-300 hover:bg-[#30363d]'
              }`}
            >
              120D
            </button>
            <button
              onClick={() => { setZoomMode('60D'); setPanIndex(Math.max(0, (stock.priceHistory?.length || 0) - 60)); }}
              className={`px-2 py-1 text-[10px] font-bold uppercase transition-all ${
                zoomMode === '60D' ? 'bg-amber-500 text-black' : 'bg-[#21262d] text-gray-300 hover:bg-[#30363d]'
              }`}
            >
              60D
            </button>
            <button
              onClick={() => { setZoomMode('30D'); setPanIndex(Math.max(0, (stock.priceHistory?.length || 0) - 30)); }}
              className={`px-2 py-1 text-[10px] font-bold uppercase transition-all ${
                zoomMode === '30D' ? 'bg-amber-500 text-black' : 'bg-[#21262d] text-gray-300 hover:bg-[#30363d]'
              }`}
            >
              30D
            </button>
          </div>
        </div>

        {zoomMode !== 'ALL' && (
          <div className="flex items-center space-x-2">
            <span className="text-[10px] text-gray-400">Pan Window:</span>
            <button
              onClick={() => setPanIndex(Math.max(0, panIndex - 15))}
              className="p-1 bg-[#21262d] hover:bg-[#30363d] text-gray-300 border border-gray-700"
              title="Pan Left (Earlier)"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] text-amber-300">
              Bar {panIndex} - {panIndex + (zoomMode === '120D' ? 120 : zoomMode === '60D' ? 60 : 30)}
            </span>
            <button
              onClick={() => setPanIndex(Math.min((stock.priceHistory?.length || 0) - 10, panIndex + 15))}
              className="p-1 bg-[#21262d] hover:bg-[#30363d] text-gray-300 border border-gray-700"
              title="Pan Right (Recent)"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Custom Trendlines Interactive Drawing Toolbar */}
      <div className="bg-[#1a1a1a] border border-[#333] p-2.5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-white">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1.5 text-amber-400 font-bold uppercase tracking-wider text-[11px] mr-2">
            <Pencil className="w-3.5 h-3.5" />
            <span>Custom Trendlines:</span>
            <span className="bg-amber-950 text-amber-300 px-1.5 py-0.2 border border-amber-800 text-[10px]">
              {customTrendlines.length} Saved
            </span>
          </div>

          {proximityAlertCount > 0 && (
            <div className="bg-orange-950/90 border border-orange-500 text-orange-200 px-2.5 py-1 text-[10px] font-extrabold uppercase flex items-center space-x-1.5 animate-pulse rounded-xs shadow-xs">
              <Zap className="w-3.5 h-3.5 text-orange-400 fill-orange-400 animate-bounce" />
              <span>Proximity Alert: {proximityAlertCount} Line(s) Within 1% of Current Price ({currencySymbol}{(stock.currentPrice || stock.pivotPrice).toFixed(2)})</span>
            </div>
          )}

          {/* Toggle Display */}
          <button
            onClick={() => setShowCustomTrendlines(!showCustomTrendlines)}
            className={`px-2.5 py-1 text-[10px] font-bold uppercase transition-all flex items-center space-x-1 border ${
              showCustomTrendlines
                ? 'bg-amber-500 text-black border-amber-400 font-black'
                : 'bg-[#262626] text-gray-400 border-gray-700 hover:bg-[#333]'
            }`}
          >
            {showCustomTrendlines ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            <span>{showCustomTrendlines ? 'Lines Visible' : 'Lines Hidden'}</span>
          </button>

          {/* Interactive Click-on-Chart Drawing Mode Toggle */}
          <button
            onClick={() => {
              setIsDrawingMode(!isDrawingMode);
              setClickStep(0);
              setPoint1(null);
            }}
            className={`px-2.5 py-1 text-[10px] font-bold uppercase transition-all flex items-center space-x-1 border ${
              isDrawingMode
                ? 'bg-rose-600 text-white border-rose-500 animate-pulse shadow-xs'
                : 'bg-[#262626] text-gray-200 border-gray-700 hover:bg-[#333]'
            }`}
          >
            <MousePointer className="w-3 h-3 text-amber-300" />
            <span>{isDrawingMode ? 'Cancel Drawing' : 'Draw on Chart'}</span>
          </button>

          {/* Preset Generators */}
          <button
            onClick={handleAddAutoResistance}
            className="px-2 py-1 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 text-[10px] font-bold uppercase transition-all flex items-center space-x-1"
            title="Auto-connect VCP contraction peaks with resistance line"
          >
            <TrendingUp className="w-3 h-3" />
            <span>+ Auto Resistance</span>
          </button>

          <button
            onClick={handleAddAutoSupport}
            className="px-2 py-1 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 text-[10px] font-bold uppercase transition-all flex items-center space-x-1"
            title="Auto-connect shakeout lows with support line"
          >
            <TrendingDown className="w-3 h-3" />
            <span>+ Auto Support</span>
          </button>

          {/* Open Manual Builder Form */}
          <button
            onClick={() => setIsCreatorOpen(!isCreatorOpen)}
            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-black font-bold text-[10px] uppercase transition-all flex items-center space-x-1 border border-amber-300"
          >
            <Plus className="w-3 h-3" />
            <span>Manual Line Builder</span>
          </button>
        </div>

        {customTrendlines.length > 0 && (
          <button
            onClick={handleClearAllTrendlines}
            className="text-[10px] text-rose-400 hover:text-rose-300 hover:underline flex items-center space-x-1 uppercase font-bold"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clear All Lines</span>
          </button>
        )}
      </div>

      {/* Drawing Mode Interactive Guidance Banner */}
      {isDrawingMode && (
        <div className="bg-rose-950/90 border-x border-b border-rose-700 p-2.5 flex items-center justify-between text-xs font-mono text-rose-100 animate-fadeIn">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
            <span>
              <strong>DRAWING MODE ACTIVE:</strong>{' '}
              {clickStep === 0 ? (
                <span className="text-amber-300">Click any candle/point on chart to set START point</span>
              ) : (
                <span className="text-emerald-300">
                  Start set at ({point1?.date}, {currencySymbol}{point1?.price.toFixed(2)}) &rarr; Click 2nd point on chart to complete trendline!
                </span>
              )}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] uppercase text-gray-300 font-bold">Line Type:</span>
            <select
              value={drawingType}
              onChange={(e) => setDrawingType(e.target.value as any)}
              className="bg-[#1a1a1a] border border-rose-600 text-white text-[11px] px-2 py-0.5 rounded-none font-mono"
            >
              <option value="RESISTANCE">Resistance (Red)</option>
              <option value="SUPPORT">Support (Green)</option>
              <option value="TRENDLINE">Trendline (Amber)</option>
            </select>
          </div>
        </div>
      )}

      {/* Manual Trendline Builder Form Panel */}
      {isCreatorOpen && (
        <form onSubmit={handleSaveManualTrendline} className="bg-[#21262d] border border-[#30363d] p-3 space-y-3 font-mono text-xs text-white animate-fadeIn">
          <div className="flex items-center justify-between border-b border-gray-700 pb-2">
            <span className="font-bold uppercase tracking-wider text-amber-400 flex items-center space-x-1.5">
              <Plus className="w-3.5 h-3.5" />
              <span>Create Precision Custom Trendline</span>
            </span>
            <button
              type="button"
              onClick={() => setIsCreatorOpen(false)}
              className="text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-6 gap-3">
            <div>
              <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Label Name</label>
              <input
                type="text"
                value={manualLabel}
                onChange={(e) => setManualLabel(e.target.value)}
                className="w-full bg-[#161b22] border border-gray-700 text-white px-2 py-1 text-xs font-mono"
                placeholder="e.g. Primary VCP Resistance"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Line Type</label>
              <select
                value={manualType}
                onChange={(e) => {
                  const t = e.target.value as any;
                  setManualType(t);
                  if (t === 'RESISTANCE') setManualColor('#ef4444');
                  else if (t === 'SUPPORT') setManualColor('#22c55e');
                  else if (t === 'TRENDLINE') setManualColor('#f59e0b');
                }}
                className="w-full bg-[#161b22] border border-gray-700 text-white px-2 py-1 text-xs font-mono"
              >
                <option value="RESISTANCE">Resistance Line</option>
                <option value="SUPPORT">Support Line</option>
                <option value="TRENDLINE">Diagonal Trendline</option>
                <option value="CUSTOM">Custom Annotation</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Start Date</label>
              <select
                value={manualStartDate}
                onChange={(e) => {
                  const date = e.target.value;
                  setManualStartDate(date);
                  const pObj = (stock.priceHistory || []).find((p) => p.date === date);
                  if (pObj) setManualStartPrice(pObj.close);
                }}
                className="w-full bg-[#161b22] border border-gray-700 text-white px-2 py-1 text-xs font-mono"
              >
                {(stock.priceHistory || []).map((p) => (
                  <option key={`start-date-${p.date}`} value={p.date}>
                    {p.date} ({currencySymbol}{p.close.toFixed(2)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Start Price ({currencySymbol})</label>
              <input
                type="number"
                step="0.01"
                value={manualStartPrice}
                onChange={(e) => setManualStartPrice(parseFloat(e.target.value) || 0)}
                className="w-full bg-[#161b22] border border-gray-700 text-white px-2 py-1 text-xs font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">End Date</label>
              <select
                value={manualEndDate}
                onChange={(e) => {
                  const date = e.target.value;
                  setManualEndDate(date);
                  const pObj = (stock.priceHistory || []).find((p) => p.date === date);
                  if (pObj) setManualEndPrice(pObj.close);
                }}
                className="w-full bg-[#161b22] border border-gray-700 text-white px-2 py-1 text-xs font-mono"
              >
                {(stock.priceHistory || []).map((p) => (
                  <option key={`end-date-${p.date}`} value={p.date}>
                    {p.date} ({currencySymbol}{p.close.toFixed(2)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">End Price ({currencySymbol})</label>
              <input
                type="number"
                step="0.01"
                value={manualEndPrice}
                onChange={(e) => setManualEndPrice(parseFloat(e.target.value) || 0)}
                className="w-full bg-[#161b22] border border-gray-700 text-white px-2 py-1 text-xs font-mono"
                required
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-700">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-400">Color:</label>
                <input
                  type="color"
                  value={manualColor}
                  onChange={(e) => setManualColor(e.target.value)}
                  className="w-6 h-6 bg-transparent border-0 cursor-pointer rounded-none"
                />
              </div>

              <label className="flex items-center space-x-1.5 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={manualIsDashed}
                  onChange={(e) => setManualIsDashed(e.target.checked)}
                  className="accent-amber-500"
                />
                <span>Dashed Line</span>
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setIsCreatorOpen(false)}
                className="px-3 py-1 bg-[#161b22] hover:bg-[#30363d] text-gray-300 border border-gray-700 font-bold uppercase text-[10px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1 bg-amber-500 hover:bg-amber-400 text-black font-bold uppercase text-[10px] flex items-center space-x-1"
              >
                <Save className="w-3 h-3" />
                <span>Save Custom Line</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Main Chart Container */}
      <div className="w-full h-[380px] bg-[#f9f8f5] p-3 border border-[#e5e4e1] relative">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartDataWithTrendlines}
            margin={{ top: 15, right: 20, left: 10, bottom: 5 }}
            onClick={(e: any) => {
              if (!isDrawingMode || !e || !e.activeLabel) return;
              const clickedDate = e.activeLabel;
              const pointObj = (displayedPriceHistory || []).find((p) => p.date === clickedDate);
              const clickedPrice = e.activePayload?.[0]?.value || pointObj?.close || stock.pivotPrice;

              if (clickStep === 0) {
                setPoint1({ date: clickedDate, price: clickedPrice });
                setClickStep(1);
              } else if (clickStep === 1 && point1) {
                const isStartFirst = point1.date <= clickedDate;
                const newTrendline: CustomTrendline = {
                  id: `trendline-${Date.now()}`,
                  type: drawingType,
                  label: drawingType === 'RESISTANCE' ? 'Custom Resistance' : drawingType === 'SUPPORT' ? 'Custom Support' : 'Custom Trendline',
                  startDate: isStartFirst ? point1.date : clickedDate,
                  startPrice: isStartFirst ? point1.price : clickedPrice,
                  endDate: isStartFirst ? clickedDate : point1.date,
                  endPrice: isStartFirst ? clickedPrice : point1.price,
                  color: drawingType === 'RESISTANCE' ? '#ef4444' : drawingType === 'SUPPORT' ? '#22c55e' : '#f59e0b',
                  lineWidth: 2,
                  isDashed: false,
                  createdAt: new Date().toLocaleDateString(),
                };
                saveTrendlines([...customTrendlines, newTrendline]);
                setIsDrawingMode(false);
                setClickStep(0);
                setPoint1(null);
              }
            }}
          >
            <CartesianGrid strokeDasharray="2 2" stroke="#e5e4e1" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="#888888"
              tick={{ fontSize: 10, fill: '#666666' }}
              tickFormatter={(val) => val.substring(5)}
            />
            <YAxis
              domain={[minPrice, maxPrice]}
              stroke="#888888"
              orientation="right"
              tick={{ fontSize: 10, fill: '#666666' }}
              tickFormatter={(val) => `${currencySymbol}${val}`}
            />
            <Tooltip
              content={
                <CustomChartTooltip
                  currencySymbol={currencySymbol}
                  stock={stock}
                  vcpNodes={vcpNodes}
                  showPocketPivots={showPocketPivots}
                  pocketPivotDatesSet={pocketPivotDatesSet}
                  showBaseFormationArea={showBaseFormationArea}
                  vcpBaseInfo={vcpBaseInfo}
                />
              }
            />

            {/* Stage 2 Minervini Uptrend Background Highlight (bgcolor matching Pine Script) */}
            {showStage2Bg && minerviniPass && (
              <ReferenceArea
                {...({
                  x1: stock.priceHistory[0]?.date,
                  x2: stock.priceHistory[stock.priceHistory.length - 1]?.date,
                  y1: minPrice,
                  y2: maxPrice,
                  fill: '#22c55e',
                  fillOpacity: 0.08,
                  stroke: 'none',
                  label: {
                    value: 'STAGE 2 MINERVINI UPTREND (bgcolor)',
                    fill: '#15803d',
                    fontSize: 9,
                    fontWeight: 'bold',
                    position: 'insideTopRight'
                  }
                } as any)}
              />
            )}

            {/* Automatically Detected VCP Pattern Base Formation Timeframe Shading Area */}
            {showBaseFormationArea && vcpBaseInfo && (
              <ReferenceArea
                {...({
                  x1: vcpBaseInfo.startDate,
                  x2: vcpBaseInfo.endDate,
                  y1: minPrice,
                  y2: maxPrice,
                  fill: '#f59e0b',
                  fillOpacity: 0.08,
                  stroke: '#d97706',
                  strokeOpacity: 0.45,
                  strokeDasharray: '4 4',
                  label: {
                    value: `VCP BASE TIMEFRAME: ${vcpBaseInfo.daysCount} DAYS (${vcpBaseInfo.weeksCount} WKS) | DEPTH: -${vcpBaseInfo.maxBaseDepthPercent}%`,
                    fill: '#b45309',
                    fontSize: 10,
                    fontWeight: 'bold',
                    position: 'insideBottomLeft'
                  }
                } as any)}
              />
            )}

            {/* Volatility Squeeze Contraction Bands (ReferenceAreas) */}
            {showVolatilityOverlay && stock.contractions.map((c, idx) => (
              <React.Fragment key={`vcp-ref-${idx}`}>
                <ReferenceArea
                  {...({
                    x1: c.startDate,
                    x2: c.endDate,
                    y1: c.lowPrice,
                    y2: c.highPrice,
                    stroke: '#d97706',
                    strokeOpacity: 0.5,
                    strokeDasharray: '3 3',
                    fill: '#fef3c7',
                    fillOpacity: 0.25,
                    label: {
                      value: `T${c.contractionIndex}: -${c.depthPercent}%`,
                      fill: '#b45309',
                      fontSize: 10,
                      fontWeight: 'bold',
                      position: 'insideTopLeft'
                    }
                  } as any)}
                />
              </React.Fragment>
            ))}

            {/* Interactive VCP Formation Reference Dots on Nodes */}
            {vcpNodes.map((node) => {
              const isHighlight = selectedNodeId === node.id || hoveredNodeId === node.id;
              const dotColor =
                node.nodeType === 'PEAK'
                  ? '#dc2626'
                  : node.nodeType === 'TROUGH'
                  ? '#2563eb'
                  : '#16a34a';

              return (
                <ReferenceDot
                  key={node.id}
                  x={node.date}
                  y={node.price}
                  r={isHighlight ? 8 : 5}
                  fill={dotColor}
                  stroke="#ffffff"
                  strokeWidth={2}
                  isFront={true}
                  className="cursor-pointer transition-all"
                  onClick={() => setSelectedNodeId(selectedNodeId === node.id ? null : node.id)}
                />
              );
            })}

            {/* Historical Lorentzian Classification Model Backtest Signal Dots */}
            {showLorentzianDots && historicalLorentzianSignals.map((sig, idx) => (
              <ReferenceDot
                key={`ml-signal-dot-${idx}`}
                x={sig.date}
                y={sig.price}
                r={5}
                fill={sig.type === 'BUY' ? '#8b5cf6' : '#f59e0b'}
                stroke="#ffffff"
                strokeWidth={1.5}
                isFront={true}
              />
            ))}

            {/* Pocket Pivot Historical Volume & Price Action Overlay Dots */}
            {showPocketPivots && displayedPocketPivots.filter((p) => p.isPocketPivot).map((pp) => (
              <ReferenceDot
                key={`pp-dot-${pp.date}`}
                x={pp.date}
                y={pp.price}
                r={6}
                fill="#9333ea"
                stroke="#ffffff"
                strokeWidth={2}
                isFront={true}
              />
            ))}

            {/* Price Line */}
            <Line
              type="monotone"
              dataKey="close"
              name="Close Price"
              stroke="#1a1a1a"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 6, fill: '#1a1a1a' }}
            />

            {/* SMAs */}
            {showSma50 && (
              <Line
                type="monotone"
                dataKey="sma50"
                name="50 SMA"
                stroke="#2563eb"
                strokeWidth={1.5}
                strokeDasharray="4 2"
                dot={false}
              />
            )}
            {showSma150 && (
              <Line
                type="monotone"
                dataKey="sma150"
                name="150 SMA"
                stroke="#d97706"
                strokeWidth={1.5}
                dot={false}
              />
            )}
            {showSma200 && (
              <Line
                type="monotone"
                dataKey="sma200"
                name="200 SMA"
                stroke="#7c3aed"
                strokeWidth={1.5}
                dot={false}
              />
            )}

            {/* Trade Plan Overlay Lines */}
            {showLevels && (
              <>
                {/* Pivot Price Entry Line */}
                <ReferenceLine
                  y={stock.pivotPrice}
                  stroke="#16a34a"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  label={{
                    value: `Pivot Buy: ${currencySymbol}${stock.pivotPrice.toFixed(2)}`,
                    fill: '#16a34a',
                    fontSize: 11,
                    fontWeight: 'bold',
                    position: 'top'
                  }}
                />

                {/* Stop Loss Line */}
                <ReferenceLine
                  y={stock.stopLossPrice}
                  stroke="#dc2626"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  label={{
                    value: `Stop Exit: ${currencySymbol}${stock.stopLossPrice.toFixed(2)} (-${stock.stopLossPercent}%)`,
                    fill: '#dc2626',
                    fontSize: 11,
                    fontWeight: 'bold',
                    position: 'bottom'
                  }}
                />

                {/* Target 1 Line */}
                <ReferenceLine
                  y={stock.target1Price}
                  stroke="#ca8a04"
                  strokeWidth={1.5}
                  strokeDasharray="6 6"
                  label={{
                    value: `Target 1: ${currencySymbol}${stock.target1Price.toFixed(2)} (+${stock.target1Percent.toFixed(0)}%)`,
                    fill: '#ca8a04',
                    fontSize: 11,
                    fontWeight: 'bold',
                    position: 'top'
                  }}
                />
              </>
            )}

            {/* Historical Pivot Buy Points Overlay */}
            {showHistoricalPivots && historicalTradeLevels.filter(l => l.type === 'PIVOT_BUY').map((lvl) => {
              const isSelected = selectedLevelId === lvl.id;
              return (
                <React.Fragment key={`hist-pivot-${lvl.id}`}>
                  <ReferenceLine
                    y={lvl.price}
                    stroke="#16a34a"
                    strokeWidth={isSelected ? 3 : lvl.source === 'ACTIVE_PLAN' ? 2 : 1.5}
                    strokeDasharray={lvl.source === 'ACTIVE_PLAN' ? '4 4' : '2 2'}
                    strokeOpacity={isSelected ? 1.0 : lvl.source === 'ACTIVE_PLAN' ? 0.95 : 0.65}
                    label={{
                      value: `Pivot Buy: ${currencySymbol}${lvl.price.toFixed(2)} (${lvl.label})`,
                      fill: '#15803d',
                      fontSize: 10,
                      fontWeight: 'bold',
                      position: lvl.source === 'ACTIVE_PLAN' ? 'top' : 'insideTopRight'
                    }}
                  />
                  {lvl.date && (
                    <ReferenceDot
                      x={lvl.date}
                      y={lvl.price}
                      r={isSelected ? 7 : 5}
                      fill="#16a34a"
                      stroke="#ffffff"
                      strokeWidth={1.5}
                      isFront={true}
                      className="cursor-pointer"
                      onClick={() => setSelectedLevelId(selectedLevelId === lvl.id ? null : lvl.id)}
                    />
                  )}
                </React.Fragment>
              );
            })}

            {/* Historical Stop Loss Levels Overlay */}
            {showHistoricalStops && historicalTradeLevels.filter(l => l.type === 'STOP_LOSS').map((lvl) => {
              const isSelected = selectedLevelId === lvl.id;
              return (
                <React.Fragment key={`hist-stop-${lvl.id}`}>
                  <ReferenceLine
                    y={lvl.price}
                    stroke="#dc2626"
                    strokeWidth={isSelected ? 3 : lvl.source === 'ACTIVE_PLAN' ? 2 : 1.5}
                    strokeDasharray={lvl.source === 'ACTIVE_PLAN' ? '4 4' : '2 2'}
                    strokeOpacity={isSelected ? 1.0 : lvl.source === 'ACTIVE_PLAN' ? 0.95 : 0.65}
                    label={{
                      value: `Stop: ${currencySymbol}${lvl.price.toFixed(2)} (${lvl.label})`,
                      fill: '#b91c1c',
                      fontSize: 10,
                      fontWeight: 'bold',
                      position: lvl.source === 'ACTIVE_PLAN' ? 'bottom' : 'insideBottomRight'
                    }}
                  />
                  {lvl.date && (
                    <ReferenceDot
                      x={lvl.date}
                      y={lvl.price}
                      r={isSelected ? 7 : 5}
                      fill="#dc2626"
                      stroke="#ffffff"
                      strokeWidth={1.5}
                      isFront={true}
                      className="cursor-pointer"
                      onClick={() => setSelectedLevelId(selectedLevelId === lvl.id ? null : lvl.id)}
                    />
                  )}
                </React.Fragment>
              );
            })}

            {/* Custom Persistent Trendlines Lines & Key Dots */}
            {showCustomTrendlines && customTrendlines.map((line) => {
              const prox = trendlineProximityMap[line.id];
              const isNear = prox?.isNear;
              const highlightColor = isNear ? '#ea580c' : (line.color || '#f59e0b'); // Vibrant Orange when within 1% proximity
              const highlightWidth = isNear ? 3.5 : (line.lineWidth || 2);

              return (
                <React.Fragment key={`trendline-plot-${line.id}`}>
                  <Line
                    type="linear"
                    dataKey={`trendline_${line.id}`}
                    name={isNear ? `⚡ ${line.label} (1% PROXIMITY ALERT)` : line.label}
                    stroke={highlightColor}
                    strokeWidth={highlightWidth}
                    strokeDasharray={line.isDashed ? '4 4' : undefined}
                    dot={false}
                    activeDot={{ r: isNear ? 7 : 5, fill: highlightColor, stroke: '#ffffff', strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                  {line.startDate && line.startPrice && (
                    <ReferenceDot
                      x={line.startDate}
                      y={line.startPrice}
                      r={isNear ? 7 : 5}
                      fill={highlightColor}
                      stroke="#ffffff"
                      strokeWidth={2}
                      isFront={true}
                      label={{
                        value: isNear ? `⚡ ${line.label} (PROXIMITY ALERT)` : line.label,
                        fill: highlightColor,
                        fontSize: isNear ? 11 : 10,
                        fontWeight: 'bold',
                        position: 'top'
                      }}
                    />
                  )}
                  {line.endDate && line.endPrice && (
                    <ReferenceDot
                      x={line.endDate}
                      y={line.endPrice}
                      r={isNear ? 7 : 5}
                      fill={highlightColor}
                      stroke="#ffffff"
                      strokeWidth={2}
                      isFront={true}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Active Custom Trendlines Metadata Table */}
      {customTrendlines.length > 0 && (
        <div className="bg-[#f9f8f5] border border-[#e5e4e1] p-3 space-y-2 font-mono text-xs animate-fadeIn">
          <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
            <div className="flex items-center space-x-2">
              <Pencil className="w-3.5 h-3.5 text-amber-700" />
              <span className="font-extrabold uppercase text-[#1a1a1a]">
                Custom Technical Trendlines ({customTrendlines.length}) &ndash; Persisted in {stock.ticker} Metadata
              </span>
              {proximityAlertCount > 0 && (
                <span className="bg-orange-500 text-white font-black px-2 py-0.5 rounded text-[10px] uppercase flex items-center space-x-1 animate-pulse shadow-xs">
                  <Zap className="w-3 h-3 fill-white" />
                  <span>{proximityAlertCount} Proximity Alert(s) Active</span>
                </span>
              )}
            </div>
            <span className="text-[10px] text-gray-500 italic">
              Orange highlight when stock price is within &le;1% of trendline
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-[10px] uppercase font-bold text-gray-500 bg-[#f1f0ec]">
                  <th className="p-1.5">Type / Color</th>
                  <th className="p-1.5">Label</th>
                  <th className="p-1.5">Start (Date & Price)</th>
                  <th className="p-1.5">End (Date & Price)</th>
                  <th className="p-1.5">Slope / Change</th>
                  <th className="p-1.5">Proximity Status (&le;1%)</th>
                  <th className="p-1.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-xs text-[#1a1a1a]">
                {customTrendlines.map((line) => {
                  const prox = trendlineProximityMap[line.id];
                  const isNear = prox?.isNear;
                  const pctSlope = line.startPrice > 0
                    ? (((line.endPrice - line.startPrice) / line.startPrice) * 100).toFixed(1)
                    : '0.0';

                  return (
                    <tr
                      key={line.id}
                      className={`transition-colors ${
                        isNear
                          ? 'bg-orange-100/90 border-l-4 border-l-orange-500 font-medium'
                          : 'hover:bg-amber-50/50'
                      }`}
                    >
                      <td className="p-1.5">
                        <div className="flex items-center space-x-1.5">
                          <span
                            className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/20"
                            style={{ backgroundColor: isNear ? '#ea580c' : line.color }}
                          />
                          <span className="font-bold text-[10px] uppercase px-1.5 py-0.5 bg-gray-100 border border-gray-300">
                            {line.type}
                          </span>
                        </div>
                      </td>

                      <td className="p-1.5 font-bold flex items-center space-x-1">
                        <span>{line.label}</span>
                        {isNear && <Zap className="w-3.5 h-3.5 text-orange-600 fill-orange-500" />}
                      </td>

                      <td className="p-1.5">
                        <span className="text-gray-600">{line.startDate}</span>{' '}
                        <strong className="text-emerald-700">({currencySymbol}{line.startPrice.toFixed(2)})</strong>
                      </td>

                      <td className="p-1.5">
                        <span className="text-gray-600">{line.endDate}</span>{' '}
                        <strong className="text-emerald-700">({currencySymbol}{line.endPrice.toFixed(2)})</strong>
                      </td>

                      <td className="p-1.5">
                        <span className={`font-bold ${Number(pctSlope) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {Number(pctSlope) >= 0 ? `+${pctSlope}%` : `${pctSlope}%`}
                        </span>
                      </td>

                      <td className="p-1.5">
                        {isNear ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-orange-600 text-white text-[10px] font-black uppercase rounded shadow-xs animate-pulse">
                            <Zap className="w-3 h-3 fill-white" />
                            <span>1% ALERT ({prox.diffPct}% Away)</span>
                          </span>
                        ) : (
                          <span className="text-gray-500 text-[10px] font-mono">
                            {prox?.diffPct !== undefined && prox.diffPct < 100 ? `${prox.diffPct}% away` : 'Normal'}
                          </span>
                        )}
                      </td>

                      <td className="p-1.5 text-right">
                        <button
                          onClick={() => handleRemoveTrendline(line.id)}
                          className="text-rose-700 hover:text-rose-900 p-1 rounded-none hover:bg-rose-100 transition-colors"
                          title="Delete trendline"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Secondary Volatility Overlay: Contraction Magnitude (%) Squeeze Panel */}
      {showVolatilityOverlay && (
        <div className="p-4 bg-amber-50/60 border border-amber-200/80 rounded-lg space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/60 pb-2">
            <div className="flex items-center space-x-2">
              <Zap className="w-4 h-4 text-amber-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-950 font-mono">
                Volatility Squeeze & Contraction Magnitude (%) Overlay
              </h4>
            </div>
            <div className="flex items-center space-x-3 text-xs">
              <span className="text-amber-800 font-medium">Initial Base Depth: <strong className="text-amber-950">-{initialDepth}%</strong></span>
              <span className="text-amber-800 font-medium">Final Pivot Depth: <strong className="text-emerald-700 font-extrabold">-{finalDepth}%</strong></span>
              <span className="px-2.5 py-0.5 bg-amber-600 text-white font-extrabold text-[11px] rounded font-mono shadow-2xs">
                {totalSqueezeCompression}% Squeeze Compression
              </span>
            </div>
          </div>

          {/* Successive Contractions Progression Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
            {stock.contractions.map((c, idx) => {
              const prevDepth = idx > 0 ? stock.contractions[idx - 1].depthPercent : null;
              const squeezeDelta = prevDepth ? (((prevDepth - c.depthPercent) / prevDepth) * 100).toFixed(1) : null;
              const depthRatio = initialDepth > 0 ? (c.depthPercent / initialDepth) * 100 : 100;

              return (
                <div key={idx} className="bg-white p-3 rounded border border-amber-200/80 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-slate-900 text-white font-mono">
                      Contraction T{c.contractionIndex}
                    </span>
                    <span className="text-[11px] text-gray-500 font-mono">{c.durationDays} Days</span>
                  </div>

                  <div className="flex items-baseline justify-between pt-1">
                    <span className="text-gray-600 font-medium text-[11px]">Base Depth:</span>
                    <span className="text-sm font-extrabold text-amber-900 font-mono">-{c.depthPercent}%</span>
                  </div>

                  {/* Relative Bar visual */}
                  <div className="w-full bg-amber-100 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        idx === stock.contractions.length - 1 && c.depthPercent <= 3.5
                          ? 'bg-emerald-600'
                          : 'bg-amber-500'
                      }`}
                      style={{ width: `${Math.max(8, depthRatio)}%` }}
                    />
                  </div>

                  {/* Squeeze Delta vs Previous Base */}
                  {squeezeDelta !== null ? (
                    <div className="text-[11px] font-mono text-emerald-800 bg-emerald-50 px-2 py-1 rounded border border-emerald-200/60 flex items-center justify-between">
                      <span>vs T{c.contractionIndex - 1} Squeeze:</span>
                      <strong className="font-extrabold">-{squeezeDelta}% Volatility Drop</strong>
                    </div>
                  ) : (
                    <div className="text-[11px] font-mono text-gray-500 bg-gray-50 px-2 py-1 rounded border border-gray-200/60 text-center">
                      Primary Base Anchor
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Volume Subchart */}
      <div className="pt-3 border-t border-[#e5e4e1]">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-2 font-sans">
          <span className="font-bold uppercase tracking-wider text-[#1a1a1a] flex items-center space-x-1.5">
            <Droplets className="w-3.5 h-3.5 text-[#1a1a1a]" />
            <span>Volume & Contraction Volume Dry-Up</span>
          </span>
          <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono">
            {showPocketPivots && (
              <span className="flex items-center space-x-1 font-bold text-purple-900 bg-purple-50 border border-purple-200 px-1.5 py-0.5">
                <span className="w-2.5 h-2.5 bg-purple-600"></span>
                <span>Purple = Pocket Pivot Volume ({pocketPivotCount} Detected)</span>
              </span>
            )}
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 bg-black"></span>
              <span className="text-[#1a1a1a] font-bold">Black = Dry-Up (&lt;50% Avg)</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 bg-green-700"></span>
              <span>Green = Up Day</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 bg-red-600"></span>
              <span>Red = Down Day</span>
            </span>
          </div>
        </div>

        <div className="w-full h-[120px] bg-[#f9f8f5] p-2 border border-[#e5e4e1]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={stock.priceHistory}
              margin={{ top: 5, right: 20, left: 10, bottom: 0 }}
            >
              <XAxis dataKey="date" hide />
              <YAxis
                stroke="#888888"
                orientation="right"
                tick={{ fontSize: 9, fill: '#666666' }}
                tickFormatter={formatVolume}
              />
              <Tooltip content={<VolumeTooltip showPocketPivots={showPocketPivots} pocketPivotDatesSet={pocketPivotDatesSet} />} />

              {/* 20D Avg Volume Line */}
              <Line
                type="monotone"
                dataKey="avgVolume20"
                stroke="#b5a68d"
                strokeWidth={1.5}
                dot={false}
              />

              {/* Volume Bars */}
              <Bar dataKey="volume">
                {stock.priceHistory.map((entry, index) => {
                  const isUpDay = entry.close >= entry.open;
                  const isTight = entry.isTightVolume || entry.volume < entry.avgVolume20 * 0.5;
                  const isPp = showPocketPivots && pocketPivotDatesSet.has(entry.date);

                  let color = isUpDay ? '#16a34a' : '#dc2626';
                  if (isTight) {
                    color = '#1a1a1a'; // Deep Black for tight volume dry-up!
                  }
                  if (isPp) {
                    color = '#9333ea'; // Vibrant Purple for Pocket Pivot Volume Spike!
                  }

                  return <Cell key={`cell-${index}`} fill={color} opacity={isPp ? 1 : isTight ? 1 : 0.65} />;
                })}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Volume Oscillator Subchart & Institutional Accumulation Intelligence */}
      {showVolumeOscillator && (
        <div className="pt-3 border-t border-[#e5e4e1] space-y-3 font-mono">
          
          {/* Header & Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#f9f8f5] p-3 border border-[#e5e4e1]">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-cyan-700" />
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-900">
                    Volume Oscillator Indicator
                  </span>
                  <span className={`px-2 py-0.5 text-[9px] font-extrabold uppercase border ${
                    volOscSummaryStats.latestSignal === 'ACCUMULATION'
                      ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                      : volOscSummaryStats.latestSignal === 'DISTRIBUTION'
                      ? 'bg-rose-100 text-rose-900 border-rose-300'
                      : 'bg-amber-100 text-amber-900 border-amber-300'
                  }`}>
                    {volOscSummaryStats.latestVal >= 0 ? '+' : ''}{volOscSummaryStats.latestVal}% [
                    {volOscSummaryStats.latestSignal === 'ACCUMULATION' ? 'INSTITUTIONAL ACCUMULATION' : volOscSummaryStats.latestSignal === 'DISTRIBUTION' ? 'RETAIL DISTRIBUTION' : 'VOLUME DRY-UP'}
                    ]
                  </span>
                </div>
                <p className="text-[10px] text-gray-500 font-sans">
                  Measures short-term volume ({volOscShortLen}d MA) vs long-term volume ({volOscLongLen}d MA) momentum.
                </p>
              </div>
            </div>

            {/* Quick Settings & Mode Controls */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              
              {/* Short SMA Selector */}
              <div className="flex items-center space-x-1 bg-white border border-[#e5e4e1] px-2 py-0.5">
                <span className="text-[10px] text-gray-500">Short:</span>
                <button
                  onClick={() => setVolOscShortLen(5)}
                  className={`px-1.5 py-0.5 text-[10px] font-bold cursor-pointer ${volOscShortLen === 5 ? 'bg-[#1a1a1a] text-white' : 'text-gray-600 hover:text-black'}`}
                >
                  5d
                </button>
                <button
                  onClick={() => setVolOscShortLen(12)}
                  className={`px-1.5 py-0.5 text-[10px] font-bold cursor-pointer ${volOscShortLen === 12 ? 'bg-[#1a1a1a] text-white' : 'text-gray-600 hover:text-black'}`}
                >
                  12d
                </button>
              </div>

              {/* Long SMA Selector */}
              <div className="flex items-center space-x-1 bg-white border border-[#e5e4e1] px-2 py-0.5">
                <span className="text-[10px] text-gray-500">Long:</span>
                <button
                  onClick={() => setVolOscLongLen(20)}
                  className={`px-1.5 py-0.5 text-[10px] font-bold cursor-pointer ${volOscLongLen === 20 ? 'bg-[#1a1a1a] text-white' : 'text-gray-600 hover:text-black'}`}
                >
                  20d
                </button>
                <button
                  onClick={() => setVolOscLongLen(26)}
                  className={`px-1.5 py-0.5 text-[10px] font-bold cursor-pointer ${volOscLongLen === 26 ? 'bg-[#1a1a1a] text-white' : 'text-gray-600 hover:text-black'}`}
                >
                  26d
                </button>
              </div>

              {/* Display Mode */}
              <div className="flex items-center space-x-1 bg-white border border-[#e5e4e1] px-2 py-0.5">
                <button
                  onClick={() => setVolOscMode('HISTOGRAM')}
                  className={`px-1.5 py-0.5 text-[10px] font-bold cursor-pointer ${volOscMode === 'HISTOGRAM' ? 'bg-[#1a1a1a] text-white' : 'text-gray-600 hover:text-black'}`}
                >
                  Histo
                </button>
                <button
                  onClick={() => setVolOscMode('LINE')}
                  className={`px-1.5 py-0.5 text-[10px] font-bold cursor-pointer ${volOscMode === 'LINE' ? 'bg-[#1a1a1a] text-white' : 'text-gray-600 hover:text-black'}`}
                >
                  Line
                </button>
                <button
                  onClick={() => setVolOscMode('BOTH')}
                  className={`px-1.5 py-0.5 text-[10px] font-bold cursor-pointer ${volOscMode === 'BOTH' ? 'bg-[#1a1a1a] text-white' : 'text-gray-600 hover:text-black'}`}
                >
                  Both
                </button>
              </div>

            </div>
          </div>

          {/* 20-Session Institutional Accumulation Footprint Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
            <div className="bg-emerald-50/70 border border-emerald-200 p-2.5 space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-emerald-800 flex items-center space-x-1">
                <TrendingUp className="w-3 h-3 text-emerald-600" />
                <span>Accumulation Days</span>
              </span>
              <div className="flex items-baseline space-x-1">
                <strong className="text-xl font-black text-emerald-900">{volOscSummaryStats.accCount}</strong>
                <span className="text-[10px] text-emerald-700">/ 20 Sessions</span>
              </div>
              <p className="text-[10px] font-sans text-gray-600 leading-tight">
                High volume expanding on price up days. Institutional buying demand!
              </p>
            </div>

            <div className="bg-rose-50/70 border border-rose-200 p-2.5 space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-rose-800 flex items-center space-x-1">
                <TrendingDown className="w-3 h-3 text-rose-600" />
                <span>Distribution Days</span>
              </span>
              <div className="flex items-baseline space-x-1">
                <strong className="text-xl font-black text-rose-900">{volOscSummaryStats.distCount}</strong>
                <span className="text-[10px] text-rose-700">/ 20 Sessions</span>
              </div>
              <p className="text-[10px] font-sans text-gray-600 leading-tight">
                High volume on price down days. Heavy selling pressure or profit taking.
              </p>
            </div>

            <div className="bg-gray-50 border border-gray-200 p-2.5 space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-gray-700 flex items-center space-x-1">
                <Droplets className="w-3 h-3 text-gray-600" />
                <span>Volume Dry-Up Days</span>
              </span>
              <div className="flex items-baseline space-x-1">
                <strong className="text-xl font-black text-[#1a1a1a]">{volOscSummaryStats.dryCount}</strong>
                <span className="text-[10px] text-gray-600">/ 20 Sessions</span>
              </div>
              <p className="text-[10px] font-sans text-gray-600 leading-tight">
                Below average volume during contractions. Supply exhaustion near pivot!
              </p>
            </div>

            <div className="bg-purple-50/70 border border-purple-200 p-2.5 space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-purple-900 flex items-center space-x-1">
                <BarChart3 className="w-3 h-3 text-purple-700" />
                <span>Net Buying Bias</span>
              </span>
              <div className="flex items-baseline space-x-1">
                <strong className={`text-xl font-black ${volOscSummaryStats.netBias >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
                  {volOscSummaryStats.netBias >= 0 ? '+' : ''}{volOscSummaryStats.netBias} Days
                </strong>
              </div>
              <p className="text-[10px] font-sans text-gray-600 leading-tight">
                {volOscSummaryStats.netBias > 3 ? 'Strong institutional accumulation bias.' : 'Balanced / Consolidation footprint.'}
              </p>
            </div>
          </div>

          {/* Volume Oscillator Recharts ComposedChart */}
          <div className="w-full h-[140px] bg-[#f9f8f5] p-2 border border-[#e5e4e1] relative">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={displayedVolumeOscData}
                margin={{ top: 10, right: 20, left: 10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="2 2" stroke="#e5e4e1" vertical={false} />
                <XAxis dataKey="date" hide />
                <YAxis
                  stroke="#888888"
                  orientation="right"
                  tick={{ fontSize: 9, fill: '#666666' }}
                  tickFormatter={(val) => `${val > 0 ? '+' : ''}${val}%`}
                />
                <Tooltip content={<VolumeOscillatorTooltip />} />

                {/* Zero Reference Line */}
                <ReferenceLine
                  y={0}
                  stroke="#1a1a1a"
                  strokeWidth={1.5}
                  label={{ value: '0% Baseline', fill: '#666666', fontSize: 9, position: 'insideTopLeft' }}
                />

                {/* Overbought Accumulation Threshold (+15%) */}
                <ReferenceLine
                  y={15}
                  stroke="#16a34a"
                  strokeDasharray="3 3"
                  strokeWidth={1}
                />

                {/* Dry-Up Threshold (-20%) */}
                <ReferenceLine
                  y={-20}
                  stroke="#b5a68d"
                  strokeDasharray="3 3"
                  strokeWidth={1}
                />

                {/* Histogram Bars */}
                {(volOscMode === 'HISTOGRAM' || volOscMode === 'BOTH') && (
                  <Bar dataKey="volOsc">
                    {displayedVolumeOscData.map((entry, index) => {
                      let color = '#1a1a1a'; // Dry-up default
                      if (entry.signalType === 'ACCUMULATION') color = '#16a34a';
                      if (entry.signalType === 'DISTRIBUTION') color = '#dc2626';

                      return <Cell key={`vol-osc-cell-${index}`} fill={color} opacity={0.8} />;
                    })}
                  </Bar>
                )}

                {/* Smooth Curve Line Overlay */}
                {(volOscMode === 'LINE' || volOscMode === 'BOTH') && (
                  <Line
                    type="monotone"
                    dataKey="volOsc"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5, fill: '#2563eb' }}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

        </div>
      )}

      {/* Historical Pivot Buy Points & Stop Loss Level Audit Matrix */}
      <div className="bg-[#f9f8f5] border border-[#e5e4e1] p-4 sm:p-5 space-y-4 font-mono">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e4e1] pb-3">
          <div className="flex items-center space-x-2">
            <Target className="w-4 h-4 text-emerald-700" />
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#1a1a1a]">
                Historical Pivot Buy Points & Stop Loss Level Plotter
              </h4>
              <p className="text-[10px] text-gray-500 font-sans">
                Aggregated trade parameters from active Trade Plan Card, historical VCP contractions, and Trade Journal records.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 text-[10px]">
            <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 font-extrabold">
              {historicalTradeLevels.filter(l => l.type === 'PIVOT_BUY').length} Pivot Buy Points
            </span>
            <span className="bg-rose-100 text-rose-900 border border-rose-300 px-2 py-0.5 font-extrabold">
              {historicalTradeLevels.filter(l => l.type === 'STOP_LOSS').length} Stop Loss Floors
            </span>
          </div>
        </div>

        {/* Levels Grid / Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          {historicalTradeLevels.map((lvl) => {
            const isSelected = selectedLevelId === lvl.id;
            const isPivot = lvl.type === 'PIVOT_BUY';

            return (
              <div
                key={lvl.id}
                onClick={() => setSelectedLevelId(isSelected ? null : lvl.id)}
                className={`p-3 border transition-all cursor-pointer space-y-2 ${
                  isSelected
                    ? isPivot
                      ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500 shadow-xs'
                      : 'bg-rose-50 border-rose-500 ring-1 ring-rose-500 shadow-xs'
                    : 'bg-white border-[#e5e4e1] hover:border-gray-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${
                      isPivot
                        ? 'bg-emerald-800 text-white'
                        : 'bg-rose-800 text-white'
                    }`}
                  >
                    {isPivot ? '🟢 Pivot Buy Point' : '🔴 Stop Loss Level'}
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono">
                    {lvl.date || 'Active Setup'}
                  </span>
                </div>

                <div className="flex items-baseline justify-between pt-1">
                  <span className="text-sm font-black text-[#1a1a1a]">
                    {currencySymbol}{lvl.price.toFixed(2)}
                  </span>
                  <span
                    className={`text-[10px] font-extrabold ${
                      lvl.riskOrGainPercentFromCurrent >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {lvl.riskOrGainPercentFromCurrent >= 0 ? '+' : ''}{lvl.riskOrGainPercentFromCurrent}% from current
                  </span>
                </div>

                <div className="text-[11px] font-sans text-gray-600 border-t border-gray-100 pt-1.5 leading-snug">
                  {lvl.description}
                </div>

                <div className="flex items-center justify-between text-[9px] font-mono pt-1 text-gray-400">
                  <span className="uppercase tracking-wider">Source: {lvl.source.replace('_', ' ')}</span>
                  <span className="text-blue-700 font-bold underline">
                    {isSelected ? 'Selected on Chart' : 'Click to Plot'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* VCP Explanation Banner */}
      <div className="bg-[#f9f8f5] border border-[#e5e4e1] p-4 flex items-start space-x-3 text-xs text-gray-600">
        <Info className="w-4 h-4 text-[#1a1a1a] shrink-0 mt-0.5" />
        <p className="font-serif italic leading-relaxed">
          <strong className="text-[#1a1a1a] font-sans not-italic">How to read this chart:</strong> Hover over any node dot on the line chart or click any node pill above to reveal specific price, volume, and contraction depth metadata. Look for sequential contractions (T1, T2, T3) where price swings get narrower. Notice how the volume bars turn <span className="text-[#1a1a1a] font-bold font-sans">solid black</span> near the right side as volume dries up to <span className="text-[#1a1a1a] font-bold font-sans">{stock.volumeDryUpPercent}%</span> below average. Buy immediately as price breaks above the green dashed line <span className="text-green-700 font-bold font-sans">({currencySymbol}{stock.pivotPrice.toFixed(2)})</span> on expanding volume!
        </p>
      </div>

      {/* Summary Overlay Listing Contractions & Historical VCP Success Templates */}
      <VcpTemplateOverlay stock={stock} />

      {/* Lorentzian Classification Machine Learning Component by Ankur Jain */}
      <LorentzianClassification stock={stock} />

      {/* TradingView Pine Script Exporter Modal */}
      <PineScriptExporter
        stock={stock}
        isOpen={isPineModalOpen}
        onClose={() => setIsPineModalOpen(false)}
      />
        </div>
      )}

      {/* Chart Snapshot & Trade Journal Export Modal */}
      {isSnapshotModalOpen && snapshotImage && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white border border-[#e5e4e1] shadow-2xl max-w-4xl w-full my-8 max-h-[90vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="bg-[#1a1a1a] text-white p-4 flex items-center justify-between border-b border-black">
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 bg-amber-600 rounded">
                  <Camera className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-serif font-black text-lg text-white leading-tight">
                    Chart Snapshot — {stock.ticker} ({stock.name})
                  </h3>
                  <p className="text-xs text-amber-300 font-mono">
                    Captured with Trendlines ({customTrendlines.length}) & Proximity Alerts ({proximityAlertCount})
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsSnapshotModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 transition cursor-pointer"
                title="Close Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Notification Toast */}
            {journalSuccessMessage && (
              <div className="bg-emerald-800 text-white p-3 text-xs font-mono font-bold flex items-center justify-between border-b border-emerald-900 animate-slideDown">
                <div className="flex items-center space-x-2">
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>{journalSuccessMessage}</span>
                </div>
                <button
                  onClick={() => setJournalSuccessMessage(null)}
                  className="text-emerald-200 hover:text-white text-xs underline cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-6 flex-1 text-xs font-sans">
              
              {/* Snapshot Image Preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500 font-mono">
                    Captured Chart Image Preview
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setIsEnlargedSnapshot(!isEnlargedSnapshot)}
                      className="text-xs text-amber-700 hover:text-amber-900 font-mono font-bold flex items-center space-x-1 cursor-pointer"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>{isEnlargedSnapshot ? 'Fit View' : 'Full Width View'}</span>
                    </button>
                  </div>
                </div>

                <div className={`border border-[#e5e4e1] bg-gray-50 p-2 overflow-auto max-h-[360px] ${isEnlargedSnapshot ? 'max-h-[600px]' : ''}`}>
                  <img
                    src={snapshotImage}
                    alt={`${stock.ticker} VCP Chart Snapshot`}
                    className="w-full object-contain mx-auto border border-gray-200 shadow-xs"
                  />
                </div>
              </div>

              {/* Action Buttons: Download & Copy Image */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono">
                <button
                  onClick={handleDownloadSnapshot}
                  className="px-4 py-2.5 bg-[#1a1a1a] hover:bg-black text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-2 transition cursor-pointer shadow-xs"
                >
                  <Download className="w-4 h-4 text-amber-400" />
                  <span>Download Chart Image (.PNG)</span>
                </button>

                <button
                  onClick={handleCopySnapshotToClipboard}
                  className="px-4 py-2.5 bg-[#f9f8f5] hover:bg-amber-50 text-[#1a1a1a] border border-[#e5e4e1] text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-2 transition cursor-pointer shadow-xs"
                >
                  <Copy className="w-4 h-4 text-amber-600" />
                  <span>Copy Image to Clipboard</span>
                </button>
              </div>

              {/* Export to Trade Journal Section */}
              <div className="bg-[#f9f8f5] border border-[#e5e4e1] p-4 space-y-4 rounded-xs">
                <div className="flex items-center space-x-2 border-b border-[#e5e4e1] pb-2">
                  <BookMarked className="w-4 h-4 text-amber-700" />
                  <h4 className="font-serif font-black text-sm text-[#1a1a1a]">
                    Attach Snapshot to Trade Journal Entry
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">
                      Setup Pattern
                    </label>
                    <input
                      type="text"
                      value={journalSetupType}
                      onChange={(e) => setJournalSetupType(e.target.value)}
                      className="w-full p-2 bg-white border border-[#e5e4e1] focus:border-amber-600 outline-none text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">
                      Trade Status
                    </label>
                    <select
                      value={journalStatus}
                      onChange={(e) => setJournalStatus(e.target.value as TradeStatus)}
                      className="w-full p-2 bg-white border border-[#e5e4e1] focus:border-amber-600 outline-none text-xs cursor-pointer"
                    >
                      <option value="PLANNING">Planning Setup</option>
                      <option value="WATCHLIST">Watchlist Monitoring</option>
                      <option value="OPEN">Open Position</option>
                      <option value="CLOSED_PROFIT">Closed (Profit Target)</option>
                      <option value="CLOSED_LOSS">Closed (Stop Loss)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">
                      Psychological State
                    </label>
                    <select
                      value={journalEmotionalState}
                      onChange={(e) => setJournalEmotionalState(e.target.value as EmotionalState)}
                      className="w-full p-2 bg-white border border-[#e5e4e1] focus:border-amber-600 outline-none text-xs cursor-pointer"
                    >
                      <option value="DISCIPLINED">Disciplined (Systematic)</option>
                      <option value="CONFIDENT">Confident</option>
                      <option value="PATIENT">Patient</option>
                      <option value="ANXIOUS">Anxious</option>
                      <option value="FOMO">FOMO / Impulsive</option>
                      <option value="HESITANT">Hesitant</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1 font-mono">
                    Journal Trade Notes & Metadata
                  </label>
                  <textarea
                    rows={3}
                    value={journalNotes}
                    onChange={(e) => setJournalNotes(e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#e5e4e1] focus:border-amber-600 outline-none font-mono text-xs leading-relaxed"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1 font-mono">
                    Key Lesson / Execution Rule
                  </label>
                  <input
                    type="text"
                    value={journalKeyLesson}
                    onChange={(e) => setJournalKeyLesson(e.target.value)}
                    className="w-full p-2 bg-white border border-[#e5e4e1] focus:border-amber-600 outline-none font-mono text-xs"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleSaveToTradeJournal}
                    className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-mono font-bold text-xs uppercase tracking-wider flex items-center space-x-2 transition cursor-pointer shadow-xs"
                  >
                    <Save className="w-4 h-4 text-emerald-300" />
                    <span>Save Entry & Image to Trade Journal</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-[#f9f8f5] p-3 border-t border-[#e5e4e1] flex items-center justify-between font-mono text-xs text-gray-500">
              <span>Chart Image: PNG Base64 • Resolution: 2x Canvas</span>
              <button
                onClick={() => setIsSnapshotModalOpen(false)}
                className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-[#1a1a1a] font-bold uppercase text-[11px] cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

// Custom Interactive Tooltip for Price Chart - Enriched with VCP Node & Volume Context
const CustomChartTooltip = ({ active, payload, currencySymbol, stock, vcpNodes, showPocketPivots, pocketPivotDatesSet, showBaseFormationArea, vcpBaseInfo }: any) => {
  if (active && payload && payload.length) {
    const data: PricePoint = payload[0].payload;
    const matchingNode: VcpNode | undefined = vcpNodes?.find((n: VcpNode) => n.date === data.date);

    const distPivot = stock?.pivotPrice ? (((data.close - stock.pivotPrice) / stock.pivotPrice) * 100).toFixed(1) : null;
    const distStop = stock?.stopLossPrice ? (((data.close - stock.stopLossPrice) / stock.stopLossPrice) * 100).toFixed(1) : null;
    const volVsAvgPct = data.avgVolume20 ? (((data.volume - data.avgVolume20) / data.avgVolume20) * 100).toFixed(1) : null;
    const isVolumeDryUp = Number(volVsAvgPct) <= -40 || data.isTightVolume;
    const isPocketPivot = showPocketPivots && pocketPivotDatesSet?.has(data.date);

    const isInsideBaseWindow =
      showBaseFormationArea &&
      vcpBaseInfo &&
      data.date >= vcpBaseInfo.startDate &&
      data.date <= vcpBaseInfo.endDate;

    return (
      <div className="bg-[#1a1a1a] text-white p-3.5 shadow-2xl text-xs space-y-2 font-mono border border-black min-w-[240px]">
        
        {/* Node Header or Standard Date Header */}
        {matchingNode ? (
          <div className="border-b border-gray-700 pb-1.5 flex items-center justify-between">
            <span className={`px-2 py-0.5 text-[9px] font-extrabold uppercase ${
              matchingNode.nodeType === 'PEAK'
                ? 'bg-rose-600 text-white'
                : matchingNode.nodeType === 'TROUGH'
                ? 'bg-blue-600 text-white'
                : 'bg-emerald-600 text-white'
            }`}>
              {matchingNode.label}
            </span>
            <span className="font-bold text-gray-300 text-[11px]">{data.date}</span>
          </div>
        ) : (
          <div className="font-bold text-white text-xs border-b border-gray-800 pb-1 uppercase tracking-wider flex justify-between items-center">
            <span>Date: {data.date}</span>
            {isPocketPivot ? (
              <span className="text-purple-400 font-extrabold text-[10px] flex items-center space-x-1">
                <Sparkles className="w-3 h-3 text-purple-400" />
                <span>Pocket Pivot</span>
              </span>
            ) : isVolumeDryUp ? (
              <span className="text-amber-400 font-extrabold text-[10px]">💧 Dry-Up</span>
            ) : null}
          </div>
        )}

        {/* Detailed Price Metrics */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-0.5 text-[11px]">
          <span className="text-gray-400">Close Price:</span>
          <strong className="text-emerald-400 text-right font-extrabold">{currencySymbol}{data.close.toFixed(2)}</strong>

          <span className="text-gray-400">Open / High:</span>
          <span className="text-gray-200 text-right">{currencySymbol}{data.open.toFixed(1)} / {currencySymbol}{data.high.toFixed(1)}</span>

          <span className="text-gray-400">Low Price:</span>
          <span className="text-gray-200 text-right">{currencySymbol}{data.low.toFixed(1)}</span>

          {distPivot !== null && (
            <>
              <span className="text-gray-400">Vs Pivot Entry:</span>
              <span className={`text-right font-bold ${Number(distPivot) >= 0 ? 'text-emerald-400' : 'text-amber-300'}`}>
                {Number(distPivot) >= 0 ? `+${distPivot}%` : `${distPivot}%`}
              </span>
            </>
          )}

          {distStop !== null && (
            <>
              <span className="text-gray-400">Vs Risk Stop:</span>
              <span className="text-rose-400 text-right font-bold">+{distStop}%</span>
            </>
          )}
        </div>

        {/* Moving Averages */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 pt-1 border-t border-gray-800 text-[10px]">
          <span className="text-blue-300">50 SMA: {currencySymbol}{data.sma50}</span>
          <span className="text-amber-300 text-right">150 SMA: {currencySymbol}{data.sma150}</span>
          <span className="text-purple-300">200 SMA: {currencySymbol}{data.sma200}</span>
        </div>

        {/* Volume Node Data */}
        <div className="pt-1 border-t border-gray-800 text-[10px] space-y-0.5">
          <div className="flex justify-between">
            <span className="text-gray-400">Daily Volume:</span>
            <strong className={isPocketPivot ? "text-purple-300 font-black" : "text-white"}>{formatVolume(data.volume)}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">20D Avg Vol:</span>
            <span className="text-gray-300">{formatVolume(data.avgVolume20)}</span>
          </div>
          {volVsAvgPct !== null && (
            <div className="flex justify-between font-bold">
              <span className="text-gray-400">Vol vs Avg:</span>
              <span className={isPocketPivot ? 'text-purple-400 font-extrabold' : isVolumeDryUp ? 'text-amber-400 font-black' : 'text-gray-200'}>
                {volVsAvgPct}% {isPocketPivot ? '(POCKET PIVOT)' : isVolumeDryUp ? '(TIGHT DRY-UP)' : ''}
              </span>
            </div>
          )}
        </div>

        {/* Matching Node Description */}
        {matchingNode && (
          <div className="pt-1.5 border-t border-gray-800 text-[10px] font-sans italic text-amber-200/90 leading-tight">
            {matchingNode.description}
          </div>
        )}

        {/* Pocket Pivot Signal Detail */}
        {isPocketPivot && (
          <div className="pt-1.5 border-t border-purple-800/80 text-[10px] text-purple-200 font-sans space-y-0.5">
            <div className="flex items-center space-x-1 font-extrabold text-purple-300">
              <Sparkles className="w-3 h-3 text-purple-400" />
              <span>POCKET PIVOT SIGNAL</span>
            </div>
            <p className="leading-tight text-purple-100/90 text-[10px]">
              Up-day volume expanded above the highest down-day volume of the past 10 sessions. High probability institutional accumulation before breakout.
            </p>
          </div>
        )}
      </div>
    );
  }
  return null;
};

// Custom Tooltip for Volume - Editorial
const VolumeTooltip = ({ active, payload, showPocketPivots, pocketPivotDatesSet }: any) => {
  if (active && payload && payload.length) {
    const data: PricePoint = payload[0].payload;
    const diffPct = (((data.volume - data.avgVolume20) / data.avgVolume20) * 100).toFixed(1);
    const isDryUp = Number(diffPct) < -40;
    const isPp = showPocketPivots && pocketPivotDatesSet?.has(data.date);

    return (
      <div className="bg-[#1a1a1a] text-white p-2.5 text-[11px] font-mono space-y-1 border border-black shadow-xl min-w-[190px]">
        {isPp && (
          <div className="text-purple-300 font-extrabold flex items-center space-x-1 text-[10px] uppercase border-b border-purple-900 pb-1">
            <Sparkles className="w-3 h-3 text-purple-400" />
            <span>Pocket Pivot Volume Spike</span>
          </div>
        )}
        <div>
          Volume: <strong className={isPp ? "text-purple-300 font-bold" : "text-white"}>{formatVolume(data.volume)}</strong>
        </div>
        <div>
          20D Avg: <span className="text-gray-400">{formatVolume(data.avgVolume20)}</span>
        </div>
        <div className={isPp ? 'text-purple-400 font-bold' : isDryUp ? 'text-[#b5a68d] font-bold' : 'text-gray-400'}>
          Vs Avg: {diffPct}% {isPp ? '(Pocket Pivot Volume)' : isDryUp ? '(Dry-Up)' : ''}
        </div>
      </div>
    );
  }
  return null;
};

// Custom Tooltip for Volume Oscillator
const VolumeOscillatorTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data: VolumeOscillatorPoint = payload[0].payload;
    const isAccumulation = data.signalType === 'ACCUMULATION';
    const isDistribution = data.signalType === 'DISTRIBUTION';

    return (
      <div className="bg-[#1a1a1a] text-white p-3 text-xs font-mono space-y-1.5 border border-black shadow-2xl min-w-[230px]">
        <div className="flex justify-between items-center border-b border-gray-800 pb-1">
          <span className="font-bold text-gray-300">{data.date}</span>
          <span className={`px-1.5 py-0.5 text-[9px] font-extrabold uppercase ${
            isAccumulation
              ? 'bg-emerald-600 text-white'
              : isDistribution
              ? 'bg-rose-600 text-white'
              : 'bg-gray-700 text-gray-200'
          }`}>
            {data.signalType}
          </span>
        </div>

        <div className="flex justify-between items-baseline pt-0.5">
          <span className="text-gray-400">Volume Oscillator:</span>
          <strong className={`text-sm font-black ${
            data.volOsc > 0
              ? isAccumulation ? 'text-emerald-400' : 'text-rose-400'
              : 'text-amber-300'
          }`}>
            {data.volOsc >= 0 ? '+' : ''}{data.volOsc}%
          </strong>
        </div>

        <div className="grid grid-cols-2 gap-x-2 text-[10px] text-gray-300 pt-1 border-t border-gray-800">
          <div>Short Vol SMA: <strong className="text-white">{formatVolume(data.shortVolSma)}</strong></div>
          <div>Long Vol SMA: <span className="text-gray-400">{formatVolume(data.longVolSma)}</span></div>
        </div>

        <div className="text-[10px] text-gray-300 font-sans italic pt-1 border-t border-gray-800 leading-tight">
          {isAccumulation && '🟢 Institutional Accumulation: Volume expansion on an Up Day.'}
          {isDistribution && '🔴 Institutional Distribution: High volume selling pressure on a Down Day.'}
          {!isAccumulation && !isDistribution && '⚫ Volume Dry-Up: Short-term volume below average. Tight supply near pivot!'}
        </div>
      </div>
    );
  }
  return null;
};
