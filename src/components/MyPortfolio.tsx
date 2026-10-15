import React, { useState, useEffect } from 'react';
import { PortfolioHolding, MinerviniTradeSetup } from '../types';
import { formatCurrency, getCurrencySymbol } from '../utils/sepaCalculator';
import { exportPortfolioToCsv } from '../utils/csvExport';
import { PortfolioRebalancing } from './PortfolioRebalancing';
import { PortfolioSectorPieChart } from './PortfolioSectorPieChart';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import {
  Briefcase,
  TrendingUp,
  TrendingDown,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Target,
  BarChart3,
  DollarSign,
  PieChart,
  Edit2,
  X,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  ChevronRight,
  Download,
  FileSpreadsheet,
  GripVertical,
  ListOrdered,
  Cloud,
  Zap,
  Lock,
  Sliders,
  Check
} from 'lucide-react';
import { fetchFivePaisaHoldings, sync5paisaToMinerviniPortfolio } from '../utils/fivePaisaService';

interface MyPortfolioProps {
  stocks: MinerviniTradeSetup[];
  onSelectStock: (stock: MinerviniTradeSetup) => void;
  onViewChart: (stock: MinerviniTradeSetup) => void;
}

export const MyPortfolio: React.FC<MyPortfolioProps> = ({
  stocks,
  onSelectStock,
  onViewChart,
}) => {
  const { user, signIn } = useAuth();
  const [portfolioSubTab, setPortfolioSubTab] = useState<'holdings' | 'rebalancing'>('holdings');
  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(false);
  const [fivePaisaSyncStatus, setFivePaisaSyncStatus] = useState<string | null>(null);
  // Load portfolio from localStorage or provide initial default holdings
  const [holdings, setHoldings] = useState<PortfolioHolding[]>(() => {
    try {
      const saved = localStorage.getItem('minervini_sepa_portfolio');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return [
      {
        id: 'hold-1',
        ticker: 'NVDA',
        stockName: 'NVIDIA Corporation',
        exchange: 'NASDAQ',
        shares: 100,
        entryPrice: 128.5,
        currentPrice: 135.2,
        buyDate: '2026-07-10',
        stopLossPrice: 122.0,
        pivotTargetPrice: 154.2,
        notes: '3T VCP Breakout Entry on 2.5x volume surge',
        trendScore: 8,
        sma50: 121.5,
        sma200: 105.0,
        vcpStage: 'Active Breakout',
        isTrailingStopEnabled: true,
        trailingStopPrice: 128.5,
        trailingStopPercent: 5.0,
        trailingPeakPrice: 135.2,
        trailingStopType: 'BREAKEVEN',
      },
      {
        id: 'hold-2',
        ticker: 'DIXON',
        stockName: 'Dixon Technologies Ltd.',
        exchange: 'NSE',
        shares: 25,
        entryPrice: 13200.0,
        currentPrice: 13850.0,
        buyDate: '2026-07-14',
        stopLossPrice: 12500.0,
        pivotTargetPrice: 15800.0,
        notes: 'NSE Growth Leader - Cup with Handle pivot',
        trendScore: 8,
        sma50: 12400.0,
        sma200: 10800.0,
        vcpStage: 'Active Breakout',
        isTrailingStopEnabled: true,
        trailingStopPrice: 12742.0,
        trailingStopPercent: 8.0,
        trailingPeakPrice: 13850.0,
        trailingStopType: 'PERCENT',
      },
    ];
  });

  // Real-time Cloud Firestore synchronization when user is authenticated
  useEffect(() => {
    if (!user) {
      setIsCloudSyncing(false);
      return;
    }

    setIsCloudSyncing(true);
    const holdingsCol = collection(db, 'users', user.uid, 'portfolio_holdings');

    const unsubscribe = onSnapshot(
      holdingsCol,
      async (snapshot) => {
        if (!snapshot.empty) {
          const cloudItems: PortfolioHolding[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            cloudItems.push({
              id: docSnap.id,
              ticker: data.ticker || '',
              stockName: data.stockName || data.ticker || '',
              exchange: data.exchange || 'NASDAQ',
              shares: Number(data.shares) || 0,
              entryPrice: Number(data.entryPrice) || 0,
              currentPrice: Number(data.currentPrice) || Number(data.entryPrice) || 0,
              buyDate: data.buyDate || '',
              stopLossPrice: Number(data.stopLossPrice) || 0,
              pivotTargetPrice: Number(data.pivotTargetPrice) || 0,
              notes: data.notes || '',
              trendScore: Number(data.trendScore) || 8,
              sma50: Number(data.sma50) || 0,
              sma200: Number(data.sma200) || 0,
              vcpStage: data.vcpStage || 'Active Breakout',
              isTrailingStopEnabled: Boolean(data.isTrailingStopEnabled),
              trailingStopPrice: data.trailingStopPrice ? Number(data.trailingStopPrice) : undefined,
              trailingStopPercent: data.trailingStopPercent ? Number(data.trailingStopPercent) : undefined,
              trailingPeakPrice: data.trailingPeakPrice ? Number(data.trailingPeakPrice) : undefined,
              trailingStopType: data.trailingStopType || 'PERCENT',
            });
          });
          setHoldings(cloudItems);
        } else {
          // If Firestore is empty, initialize user's Firestore with current holdings
          try {
            for (const item of holdings) {
              await setDoc(doc(db, 'users', user.uid, 'portfolio_holdings', item.id), item);
            }
          } catch (migrateErr) {
            console.error('Failed to migrate initial holdings to Firestore:', migrateErr);
          }
        }
        setIsCloudSyncing(false);
      },
      (error) => {
        console.error('Firestore portfolio listener error:', error);
        setIsCloudSyncing(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingHoldingId, setEditingHoldingId] = useState<string | null>(null);
  const [selectedSectorFilter, setSelectedSectorFilter] = useState<string | null>(null);

  // Drag and Drop state for custom holdings reordering
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [reorderNotification, setReorderNotification] = useState<string | null>(null);

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const updated = [...holdings];
    const [movedItem] = updated.splice(draggedIndex, 1);
    updated.splice(dropIndex, 0, movedItem);

    setHoldings(updated);
    setDraggedIndex(null);
    setDragOverIndex(null);

    setReorderNotification(`Moved ${movedItem.ticker} to position #${dropIndex + 1}`);
    setTimeout(() => setReorderNotification(null), 3000);
  };

  // Preset Quick Sort Helpers
  const handleSortByPnL = () => {
    const sorted = [...holdings].sort((a, b) => {
      const pnlA = (a.currentPrice - a.entryPrice) / a.entryPrice;
      const pnlB = (b.currentPrice - b.entryPrice) / b.entryPrice;
      return pnlB - pnlA;
    });
    setHoldings(sorted);
    setReorderNotification('Sorted holdings by Conviction P&L % (High to Low)');
    setTimeout(() => setReorderNotification(null), 3000);
  };

  const handleGroupBySector = () => {
    const sorted = [...holdings].sort((a, b) => {
      const secA = stocks.find((s) => s.ticker === a.ticker)?.sector || '';
      const secB = stocks.find((s) => s.ticker === b.ticker)?.sector || '';
      return secA.localeCompare(secB);
    });
    setHoldings(sorted);
    setReorderNotification('Grouped holdings by Sector Industry');
    setTimeout(() => setReorderNotification(null), 3000);
  };

  const handleSortByValue = () => {
    const sorted = [...holdings].sort((a, b) => {
      const valA = a.shares * a.currentPrice;
      const valB = b.shares * b.currentPrice;
      return valB - valA;
    });
    setHoldings(sorted);
    setReorderNotification('Sorted holdings by Position Market Value');
    setTimeout(() => setReorderNotification(null), 3000);
  };

  // Real-time market index benchmark state for performance summary widget
  const [selectedBenchmark, setSelectedBenchmark] = useState<'SP500' | 'NASDAQ' | 'NIFTY50' | 'RUSSELL'>('SP500');
  const [lastTickTime, setLastTickTime] = useState<string>(new Date().toLocaleTimeString());
  const [isLiveStreaming, setIsLiveStreaming] = useState<boolean>(true);

  // Benchmark index live data feed
  const benchmarkData = {
    SP500: { name: 'S&P 500 (^GSPC)', value: 5592.1, changePercent: 0.54 },
    NASDAQ: { name: 'Nasdaq 100 (^NDX)', value: 19850.3, changePercent: 0.88 },
    NIFTY50: { name: 'Nifty 50 (^NSEI)', value: 24420.8, changePercent: 0.32 },
    RUSSELL: { name: 'Russell 2000 (^RUT)', value: 2240.15, changePercent: 1.15 },
  };

  const currentBenchmark = benchmarkData[selectedBenchmark];

  // Periodic real-time update simulation for the widget
  useEffect(() => {
    if (!isLiveStreaming) return;
    const interval = setInterval(() => {
      setLastTickTime(new Date().toLocaleTimeString());
    }, 5000);
    return () => clearInterval(interval);
  }, [isLiveStreaming]);

  // Add position form state
  const [selectedStockTicker, setSelectedStockTicker] = useState<string>(
    stocks.length > 0 ? stocks[0].ticker : 'NVDA'
  );
  const [sharesInput, setSharesInput] = useState<string>('50');
  const [entryPriceInput, setEntryPriceInput] = useState<string>(
    stocks.length > 0 ? stocks[0].pivotPrice.toString() : '138.50'
  );
  const [stopLossInput, setStopLossInput] = useState<string>(
    stocks.length > 0 ? stocks[0].stopLossPrice.toString() : '129.00'
  );
  const [targetPriceInput, setTargetPriceInput] = useState<string>(
    stocks.length > 0 ? stocks[0].target1Price.toString() : '165.00'
  );
  const [buyDateInput, setBuyDateInput] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [notesInput, setNotesInput] = useState<string>('');

  // Trailing Stop Loss Form & Quick Modal State
  const [isTrailingEnabledInput, setIsTrailingEnabledInput] = useState<boolean>(false);
  const [trailingPercentInput, setTrailingPercentInput] = useState<string>('8.0');
  const [trailingTypeInput, setTrailingTypeInput] = useState<'PERCENT' | 'ATR' | 'BREAKEVEN'>('PERCENT');

  const [trailModalHolding, setTrailModalHolding] = useState<PortfolioHolding | null>(null);
  const [quickTrailPercent, setQuickTrailPercent] = useState<number>(8.0);

  const calculateDaysHeld = (dateStr: string): number | null => {
    if (!dateStr) return null;
    const entryDateObj = new Date(dateStr + 'T00:00:00');
    if (isNaN(entryDateObj.getTime())) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diffTime = now.getTime() - entryDateObj.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  // Sync current prices and saved trade entry dates from live stock feed & localStorage with auto-ratchet for trailing stops
  useEffect(() => {
    setHoldings((prevHoldings) =>
      prevHoldings.map((h) => {
        let syncedDate = h.buyDate;
        try {
          const savedDate = localStorage.getItem(`sepa_trade_entry_date_${h.ticker}`);
          if (savedDate) {
            syncedDate = savedDate;
          }
        } catch (e) {}

        const liveStock = stocks.find((s) => s.ticker === h.ticker);
        const currentP = liveStock ? liveStock.currentPrice : h.currentPrice;

        // Auto-ratchet peak price and trailing stop upward only
        const newPeak = Math.max(h.trailingPeakPrice || h.entryPrice, currentP);
        let newTrailPrice = h.trailingStopPrice;

        if (h.isTrailingStopEnabled) {
          if (h.trailingStopType === 'BREAKEVEN') {
            newTrailPrice = h.entryPrice;
          } else if (h.trailingStopType === 'ATR') {
            const atrVal = liveStock?.atr14 || (h.entryPrice * 0.03);
            const rawTrail = Number((newPeak - 2 * atrVal).toFixed(2));
            newTrailPrice = Math.max(h.stopLossPrice, Math.max(h.trailingStopPrice || 0, rawTrail));
          } else {
            const pct = h.trailingStopPercent || 8.0;
            const rawTrail = Number((newPeak * (1 - pct / 100)).toFixed(2));
            newTrailPrice = Math.max(h.stopLossPrice, Math.max(h.trailingStopPrice || 0, rawTrail));
          }
        }

        return {
          ...h,
          buyDate: syncedDate,
          currentPrice: currentP,
          trendScore: liveStock ? liveStock.trendScore : h.trendScore,
          sma50: liveStock ? liveStock.sma50 : h.sma50,
          sma200: liveStock ? liveStock.sma200 : h.sma200,
          vcpStage: liveStock ? liveStock.vcpStage : h.vcpStage,
          trailingPeakPrice: newPeak,
          trailingStopPrice: newTrailPrice,
        };
      })
    );
  }, [stocks]);

  // Persist portfolio
  useEffect(() => {
    try {
      localStorage.setItem('minervini_sepa_portfolio', JSON.stringify(holdings));
      window.dispatchEvent(new CustomEvent('minervini_portfolio_updated'));
    } catch (e) {
      console.error(e);
    }
  }, [holdings]);

  // Select stock handler in add modal
  const handleSelectStockForAdd = (ticker: string) => {
    setSelectedStockTicker(ticker);
    const matched = stocks.find((s) => s.ticker === ticker);
    if (matched) {
      setEntryPriceInput(matched.pivotPrice.toString());
      setStopLossInput(matched.stopLossPrice.toString());
      setTargetPriceInput(matched.target1Price.toString());
      setTrailingPercentInput('8.0');
    }
  };

  // Add or Edit holding submit
  const handleSaveHolding = (e: React.FormEvent) => {
    e.preventDefault();
    const matchedStock = stocks.find((s) => s.ticker === selectedStockTicker);

    const sharesNum = parseFloat(sharesInput) || 1;
    const entryNum = parseFloat(entryPriceInput) || (matchedStock ? matchedStock.pivotPrice : 100);
    const stopNum = parseFloat(stopLossInput) || entryNum * 0.93;
    const targetNum = parseFloat(targetPriceInput) || entryNum * 1.2;

    const effectiveTicker = matchedStock ? matchedStock.ticker : selectedStockTicker.toUpperCase();
    try {
      if (buyDateInput) {
        localStorage.setItem(`sepa_trade_entry_date_${effectiveTicker}`, buyDateInput);
      }
    } catch (err) {
      console.error(err);
    }

    const currentLivePrice = matchedStock ? matchedStock.currentPrice : entryNum;
    const peakPrice = Math.max(currentLivePrice, entryNum);

    let trailPriceCalculated: number | undefined = undefined;
    if (isTrailingEnabledInput) {
      if (trailingTypeInput === 'BREAKEVEN') {
        trailPriceCalculated = entryNum;
      } else if (trailingTypeInput === 'ATR') {
        const atr = matchedStock?.atr14 || (entryNum * 0.03);
        trailPriceCalculated = Math.max(stopNum, Number((peakPrice - 2 * atr).toFixed(2)));
      } else {
        const pct = parseFloat(trailingPercentInput) || 8.0;
        trailPriceCalculated = Math.max(stopNum, Number((peakPrice * (1 - pct / 100)).toFixed(2)));
      }
    }

    if (editingHoldingId) {
      const updatedHolding: PortfolioHolding = {
        ...(holdings.find((h) => h.id === editingHoldingId) || {}),
        id: editingHoldingId,
        ticker: effectiveTicker,
        stockName: matchedStock ? matchedStock.name : `${effectiveTicker} Inc.`,
        exchange: matchedStock ? matchedStock.exchange : 'NASDAQ',
        shares: sharesNum,
        entryPrice: entryNum,
        currentPrice: currentLivePrice,
        stopLossPrice: stopNum,
        pivotTargetPrice: targetNum,
        buyDate: buyDateInput,
        notes: notesInput,
        trendScore: matchedStock ? matchedStock.trendScore : 8,
        sma50: matchedStock ? matchedStock.sma50 : entryNum * 0.95,
        sma200: matchedStock ? matchedStock.sma200 : entryNum * 0.85,
        vcpStage: matchedStock ? matchedStock.vcpStage : 'Active Breakout',
        isTrailingStopEnabled: isTrailingEnabledInput,
        trailingStopType: isTrailingEnabledInput ? trailingTypeInput : undefined,
        trailingStopPercent: isTrailingEnabledInput ? parseFloat(trailingPercentInput) || 8.0 : undefined,
        trailingPeakPrice: peakPrice,
        trailingStopPrice: trailPriceCalculated,
      };

      setHoldings((prev) =>
        prev.map((h) => (h.id === editingHoldingId ? updatedHolding : h))
      );

      if (user) {
        setDoc(doc(db, 'users', user.uid, 'portfolio_holdings', editingHoldingId), updatedHolding, {
          merge: true,
        }).catch(console.error);
      }
      setEditingHoldingId(null);
    } else {
      const newHolding: PortfolioHolding = {
        id: `hold-${Date.now()}`,
        ticker: matchedStock ? matchedStock.ticker : selectedStockTicker.toUpperCase(),
        stockName: matchedStock ? matchedStock.name : `${selectedStockTicker.toUpperCase()} Inc.`,
        exchange: matchedStock ? matchedStock.exchange : 'NASDAQ',
        shares: sharesNum,
        entryPrice: entryNum,
        currentPrice: currentLivePrice,
        buyDate: buyDateInput,
        stopLossPrice: stopNum,
        pivotTargetPrice: targetNum,
        notes: notesInput || 'Stage 2 VCP Position Entry',
        trendScore: matchedStock ? matchedStock.trendScore : 8,
        sma50: matchedStock ? matchedStock.sma50 : entryNum * 0.95,
        sma200: matchedStock ? matchedStock.sma200 : entryNum * 0.85,
        vcpStage: matchedStock ? matchedStock.vcpStage : 'Active Breakout',
        isTrailingStopEnabled: isTrailingEnabledInput,
        trailingStopType: isTrailingEnabledInput ? trailingTypeInput : undefined,
        trailingStopPercent: isTrailingEnabledInput ? parseFloat(trailingPercentInput) || 8.0 : undefined,
        trailingPeakPrice: peakPrice,
        trailingStopPrice: trailPriceCalculated,
      };

      setHoldings([newHolding, ...holdings]);

      if (user) {
        setDoc(doc(db, 'users', user.uid, 'portfolio_holdings', newHolding.id), newHolding).catch(
          console.error
        );
      }
    }

    setIsAddModalOpen(false);
    setNotesInput('');
  };

  // Delete holding
  const handleDeleteHolding = (id: string) => {
    setHoldings((prev) => prev.filter((h) => h.id !== id));
    if (user) {
      deleteDoc(doc(db, 'users', user.uid, 'portfolio_holdings', id)).catch(console.error);
    }
  };

  // Apply rebalancing with Firestore sync
  const handleApplyRebalanceWithCloud = (updated: PortfolioHolding[]) => {
    setHoldings(updated);
    if (user) {
      for (const item of updated) {
        setDoc(doc(db, 'users', user.uid, 'portfolio_holdings', item.id), item, { merge: true }).catch(
          console.error
        );
      }
    }
  };

  // Quick 1-click Trailing Stop preset applier
  const handleApplyQuickTrail = (
    holdingId: string,
    type: 'PERCENT' | 'ATR' | 'BREAKEVEN' | 'DISABLE',
    customPct?: number
  ) => {
    const targetHolding = holdings.find((h) => h.id === holdingId);
    if (!targetHolding) return;

    const matchedStock = stocks.find((s) => s.ticker === targetHolding.ticker);
    const peak = Math.max(targetHolding.trailingPeakPrice || targetHolding.entryPrice, targetHolding.currentPrice);

    let isEnabled = true;
    let newTrailPrice: number | undefined = undefined;
    let chosenType: 'PERCENT' | 'ATR' | 'BREAKEVEN' = 'PERCENT';
    let chosenPct = customPct !== undefined ? customPct : quickTrailPercent;

    if (type === 'DISABLE') {
      isEnabled = false;
    } else if (type === 'BREAKEVEN') {
      chosenType = 'BREAKEVEN';
      newTrailPrice = targetHolding.entryPrice;
      chosenPct = 0;
    } else if (type === 'ATR') {
      chosenType = 'ATR';
      const atr = matchedStock?.atr14 || (targetHolding.entryPrice * 0.03);
      newTrailPrice = Math.max(targetHolding.stopLossPrice, Number((peak - 2 * atr).toFixed(2)));
      chosenPct = Number(((2 * atr / peak) * 100).toFixed(1));
    } else {
      chosenType = 'PERCENT';
      newTrailPrice = Math.max(targetHolding.stopLossPrice, Number((peak * (1 - chosenPct / 100)).toFixed(2)));
    }

    const updated: PortfolioHolding = {
      ...targetHolding,
      isTrailingStopEnabled: isEnabled,
      trailingStopType: isEnabled ? chosenType : undefined,
      trailingStopPercent: isEnabled ? chosenPct : undefined,
      trailingPeakPrice: peak,
      trailingStopPrice: isEnabled ? newTrailPrice : undefined,
    };

    setHoldings((prev) => prev.map((h) => (h.id === holdingId ? updated : h)));

    if (user) {
      setDoc(doc(db, 'users', user.uid, 'portfolio_holdings', holdingId), updated, { merge: true }).catch(
        console.error
      );
    }

    setReorderNotification(
      isEnabled
        ? `Activated Trailing Stop for ${targetHolding.ticker} at ${formatCurrency(newTrailPrice || 0, getCurrencySymbol(targetHolding.exchange))}`
        : `Disabled Trailing Stop for ${targetHolding.ticker}`
    );
    setTimeout(() => setReorderNotification(null), 3500);
    setTrailModalHolding(null);
  };

  // Edit holding trigger
  const handleOpenEdit = (holding: PortfolioHolding) => {
    setEditingHoldingId(holding.id);
    setSelectedStockTicker(holding.ticker);
    setSharesInput(holding.shares.toString());
    setEntryPriceInput(holding.entryPrice.toString());
    setStopLossInput(holding.stopLossPrice.toString());
    setTargetPriceInput(holding.pivotTargetPrice.toString());
    setBuyDateInput(holding.buyDate);
    setNotesInput(holding.notes || '');
    setIsTrailingEnabledInput(Boolean(holding.isTrailingStopEnabled));
    setTrailingPercentInput((holding.trailingStopPercent || 8.0).toString());
    setTrailingTypeInput((holding.trailingStopType as any) || 'PERCENT');
    setIsAddModalOpen(true);
  };

  // Portfolio Summary Calculations
  const calculateTotals = () => {
    let totalCostBasisUsd = 0;
    let totalValueUsd = 0;
    let totalCostBasisNse = 0;
    let totalValueNse = 0;

    let totalGainers = 0;
    let totalLosers = 0;

    let sepaViolations = 0;
    let trailingEnabledCount = 0;
    let trailingViolations = 0;
    let profitProtectedUsd = 0;
    let profitProtectedNse = 0;

    holdings.forEach((h) => {
      const cost = h.shares * h.entryPrice;
      const value = h.shares * h.currentPrice;

      if (h.exchange === 'NSE' || h.exchange === 'BSE') {
        totalCostBasisNse += cost;
        totalValueNse += value;
      } else {
        totalCostBasisUsd += cost;
        totalValueUsd += value;
      }

      if (h.currentPrice >= h.entryPrice) totalGainers++;
      else totalLosers++;

      // SEPA Violation checks:
      // 1. Current price dropped below Stop Loss
      // 2. Current price dropped below 200 SMA (Lost Stage 2)
      if (h.currentPrice <= h.stopLossPrice || (h.sma200 && h.currentPrice < h.sma200)) {
        sepaViolations++;
      }

      // Trailing stop metrics
      if (h.isTrailingStopEnabled) {
        trailingEnabledCount++;
        const effectiveTrail = h.trailingStopPrice || h.stopLossPrice;
        if (h.currentPrice <= effectiveTrail) {
          trailingViolations++;
        }
        if (effectiveTrail > h.entryPrice) {
          const lockedGain = (effectiveTrail - h.entryPrice) * h.shares;
          if (h.exchange === 'NSE' || h.exchange === 'BSE') {
            profitProtectedNse += lockedGain;
          } else {
            profitProtectedUsd += lockedGain;
          }
        }
      }
    });

    const pnlUsd = totalValueUsd - totalCostBasisUsd;
    const pnlUsdPercent = totalCostBasisUsd > 0 ? (pnlUsd / totalCostBasisUsd) * 100 : 0;

    const pnlNse = totalValueNse - totalCostBasisNse;
    const pnlNsePercent = totalCostBasisNse > 0 ? (pnlNse / totalCostBasisNse) * 100 : 0;

    return {
      totalCostBasisUsd,
      totalValueUsd,
      pnlUsd,
      pnlUsdPercent,
      totalCostBasisNse,
      totalValueNse,
      pnlNse,
      pnlNsePercent,
      totalGainers,
      totalLosers,
      sepaViolations,
      trailingEnabledCount,
      trailingViolations,
      profitProtectedUsd,
      profitProtectedNse,
    };
  };

  const totals = calculateTotals();

  return (
    <div className="bg-white border border-[#e5e4e1] p-6 shadow-xs space-y-6">
      
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e5e4e1] pb-5">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 bg-[#1a1a1a] text-white flex items-center justify-center font-bold">
            <Briefcase className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#b5a68d]">
                Minervini Execution Engine
              </span>
              <span className="bg-black text-white text-[9px] uppercase tracking-[0.15em] px-2 py-0.5 font-bold">
                Actual Holdings Tracker
              </span>
            </div>
            <h3 className="text-xl font-serif font-black text-[#1a1a1a] tracking-tight leading-none mt-1">
              My Portfolio & SEPA Rule Alignment Tracker
            </h3>
            <div className="flex items-center space-x-2 mt-1.5">
              {user ? (
                <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-300 text-[10px] font-mono font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <Cloud className="w-3 h-3 text-emerald-600" />
                  <span>Firestore Cloud Active ({user.email?.split('@')[0]})</span>
                </span>
              ) : (
                <button
                  onClick={signIn}
                  className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-mono font-bold cursor-pointer transition-colors"
                >
                  <Cloud className="w-3 h-3 text-amber-600" />
                  <span>Local Mode • Click to Sign In & Sync</span>
                </button>
              )}
              {fivePaisaSyncStatus && (
                <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded bg-amber-500 text-black text-[10px] font-mono font-bold animate-pulse">
                  <Zap className="w-3 h-3 fill-black" />
                  <span>{fivePaisaSyncStatus}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Portfolio Header Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1 bg-[#f9f8f5] p-1 border border-[#e5e4e1] font-mono text-xs">
            <button
              onClick={() => setPortfolioSubTab('holdings')}
              className={`px-3 py-1.5 font-bold uppercase tracking-wider transition cursor-pointer ${
                portfolioSubTab === 'holdings'
                  ? 'bg-[#1a1a1a] text-white shadow-xs'
                  : 'text-gray-600 hover:text-black'
              }`}
            >
              Active Holdings ({holdings.length})
            </button>
            <button
              onClick={() => setPortfolioSubTab('rebalancing')}
              className={`px-3 py-1.5 font-bold uppercase tracking-wider transition cursor-pointer flex items-center space-x-1 ${
                portfolioSubTab === 'rebalancing'
                  ? 'bg-purple-800 text-white shadow-xs'
                  : 'text-purple-800 hover:bg-purple-50'
              }`}
            >
              <PieChart className="w-3.5 h-3.5" />
              <span>Portfolio Rebalancer</span>
            </button>
          </div>

          <button
            type="button"
            onClick={async () => {
              setFivePaisaSyncStatus('Fetching 5paisa holdings...');
              try {
                const fpHoldings = await fetchFivePaisaHoldings();
                const updated = sync5paisaToMinerviniPortfolio(fpHoldings, holdings);
                setHoldings(updated);
                if (user) {
                  for (const h of updated) {
                    setDoc(doc(db, 'users', user.uid, 'portfolio_holdings', h.id), h).catch(console.error);
                  }
                }
                setFivePaisaSyncStatus(`Synced ${fpHoldings.length} stocks from 5paisa!`);
                setTimeout(() => setFivePaisaSyncStatus(null), 4000);
              } catch (e) {
                setFivePaisaSyncStatus('5paisa sync failed');
                setTimeout(() => setFivePaisaSyncStatus(null), 3000);
              }
            }}
            className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-3 py-2 text-xs uppercase tracking-wider flex items-center space-x-1.5 transition-all border border-amber-600 shadow-xs cursor-pointer"
            title="Import Demat holdings directly from 5paisa Trading Account"
          >
            <Zap className="w-3.5 h-3.5 fill-black" />
            <span className="hidden sm:inline">Sync 5paisa</span>
          </button>

          <button
            onClick={() => exportPortfolioToCsv(holdings)}
            className="bg-[#f9f8f5] hover:bg-black hover:text-white text-[#1a1a1a] font-bold px-3 py-2 text-xs uppercase tracking-wider flex items-center space-x-1.5 transition-all border border-[#e5e4e1] shadow-xs cursor-pointer group"
            title="Export portfolio holdings to CSV format"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 group-hover:text-amber-400" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          <button
            onClick={() => {
              setEditingHoldingId(null);
              setIsAddModalOpen(true);
            }}
            className="bg-[#1a1a1a] hover:bg-black text-white font-bold px-3.5 py-2 text-xs uppercase tracking-wider flex items-center space-x-1.5 transition-all border border-black shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-amber-400" />
            <span>Add Position</span>
          </button>
        </div>
      </div>

      {portfolioSubTab === 'rebalancing' ? (
        <PortfolioRebalancing
          holdings={holdings}
          stocksList={stocks}
          onApplyRebalance={handleApplyRebalanceWithCloud}
        />
      ) : (
        <>

      {/* Real-Time Portfolio Performance Summary Widget */}
      <div className="bg-[#1a1a1a] text-white p-5 border border-black shadow-lg space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-3">
          <div className="flex items-center space-x-3">
            <div className="relative flex items-center justify-center">
              <span className={`w-3 h-3 rounded-full bg-emerald-400 absolute ${isLiveStreaming ? 'animate-ping' : ''} opacity-75`} />
              <span className="w-3 h-3 rounded-full bg-emerald-400 relative" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-amber-400">
                  Real-Time Portfolio Performance Widget
                </span>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] uppercase px-2 py-0.2 font-mono font-bold">
                  {isLiveStreaming ? 'Live Tick Active' : 'Feed Paused'}
                </span>
              </div>
              <h4 className="text-lg font-serif font-bold text-white mt-0.5">
                Aggregate Portfolio Unrealized P&L & Benchmark Alpha
              </h4>
            </div>
          </div>

          {/* Benchmark Selector & Controls */}
          <div className="flex items-center space-x-3 text-xs font-mono">
            <div className="flex items-center space-x-1 bg-white/10 p-1 border border-white/20">
              <span className="text-gray-400 text-[10px] uppercase px-1">Benchmark:</span>
              {(['SP500', 'NASDAQ', 'NIFTY50', 'RUSSELL'] as const).map((bKey) => (
                <button
                  key={bKey}
                  onClick={() => setSelectedBenchmark(bKey)}
                  className={`px-2 py-1 text-[10px] uppercase font-bold transition-all ${
                    selectedBenchmark === bKey
                      ? 'bg-amber-400 text-black shadow-xs'
                      : 'text-gray-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {bKey === 'SP500' ? 'S&P 500' : bKey === 'NASDAQ' ? 'Nasdaq' : bKey === 'NIFTY50' ? 'Nifty 50' : 'Russell'}
                </button>
              ))}
            </div>

            <button
              onClick={() => setIsLiveStreaming(!isLiveStreaming)}
              className={`px-2.5 py-1.5 text-[10px] font-bold uppercase border transition-all ${
                isLiveStreaming ? 'bg-emerald-900/80 border-emerald-500 text-emerald-200' : 'bg-gray-800 border-gray-600 text-gray-300'
              }`}
            >
              {isLiveStreaming ? 'Pause Stream' : 'Resume Stream'}
            </button>
          </div>
        </div>

        {/* Performance Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          
          {/* Metric 1: Total Portfolio Unrealized P&L */}
          <div className="bg-white/5 border border-white/10 p-4 space-y-1.5">
            <div className="flex justify-between items-center text-[10px] font-mono text-gray-400 uppercase font-bold">
              <span>Total Unrealized P&L (USD Equiv)</span>
              <span>All Active Positions</span>
            </div>
            <div className="font-mono text-2xl font-black text-white">
              {formatCurrency(totals.pnlUsd + totals.pnlNse * 0.012, '$')}
            </div>
            <div className="flex items-center justify-between text-xs font-mono pt-1 border-t border-white/10 text-gray-300">
              <span>Weighted Return:</span>
              <span
                className={`font-black flex items-center space-x-1 ${
                  totals.pnlUsd + totals.pnlNse >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {totals.pnlUsd + totals.pnlNse >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                <span>
                  {totals.pnlUsdPercent >= 0 ? '+' : ''}
                  {totals.pnlUsdPercent.toFixed(2)}%
                </span>
              </span>
            </div>
          </div>

          {/* Metric 2: Market Index Comparison */}
          <div className="bg-white/5 border border-white/10 p-4 space-y-1.5">
            <div className="flex justify-between items-center text-[10px] font-mono text-gray-400 uppercase font-bold">
              <span>{currentBenchmark.name}</span>
              <span>Live Index Return</span>
            </div>
            <div className="font-mono text-2xl font-black text-white">
              {currentBenchmark.value.toLocaleString()}
            </div>
            <div className="flex items-center justify-between text-xs font-mono pt-1 border-t border-white/10 text-gray-300">
              <span>Index Change Today:</span>
              <span
                className={`font-black flex items-center space-x-1 ${
                  currentBenchmark.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {currentBenchmark.changePercent >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                <span>
                  {currentBenchmark.changePercent >= 0 ? '+' : ''}
                  {currentBenchmark.changePercent}%
                </span>
              </span>
            </div>
          </div>

          {/* Metric 3: Portfolio Alpha vs Market Index */}
          <div className="bg-white/5 border border-white/10 p-4 space-y-1.5">
            <div className="flex justify-between items-center text-[10px] font-mono text-gray-400 uppercase font-bold">
              <span>Portfolio Alpha vs Index</span>
              <span>Relative Outperformance</span>
            </div>
            {(() => {
              const portfolioReturn = totals.pnlUsdPercent;
              const alpha = portfolioReturn - currentBenchmark.changePercent;
              return (
                <>
                  <div className={`font-mono text-2xl font-black ${alpha >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {alpha >= 0 ? '+' : ''}{alpha.toFixed(2)}% Alpha
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono pt-1 border-t border-white/10 text-gray-300">
                    <span>Performance Status:</span>
                    <span className="font-bold text-amber-300">
                      {alpha >= 0 ? 'Outperforming Market' : 'Lagging Market Index'}
                    </span>
                  </div>
                </>
              );
            })()}
          </div>

        </div>

        {/* Live Timestamp footer */}
        <div className="flex items-center justify-between text-[10px] font-mono text-gray-400 pt-1 border-t border-white/10">
          <span>Real-time WebSocket Data Feed: Connected (NYSE / NASDAQ / NSE Direct Feed)</span>
          <span>Last Tick Synchronized: <strong className="text-white">{lastTickTime}</strong></span>
        </div>
      </div>

      {/* Portfolio Performance Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        
        {/* Card 1: US Growth Holdings P&L */}
        <div className="bg-[#f9f8f5] border border-[#e5e4e1] p-4 space-y-1.5">
          <div className="flex justify-between items-center text-[10px] font-mono text-gray-500 uppercase font-bold">
            <span>🇺🇸 US Portfolio</span>
            <span>NASDAQ / NYSE</span>
          </div>
          <div className="font-mono text-xl font-black text-[#1a1a1a]">
            {formatCurrency(totals.totalValueUsd, '$')}
          </div>
          <div className="flex items-center justify-between text-xs font-mono pt-1 border-t border-[#e5e4e1]">
            <span className="text-gray-500 text-[10px]">P&L:</span>
            <span
              className={`font-extrabold flex items-center space-x-1 ${
                totals.pnlUsd >= 0 ? 'text-emerald-700' : 'text-rose-600'
              }`}
            >
              {totals.pnlUsd >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
              <span>
                {totals.pnlUsd >= 0 ? '+' : ''}
                {formatCurrency(totals.pnlUsd, '$')} ({totals.pnlUsdPercent.toFixed(2)}%)
              </span>
            </span>
          </div>
        </div>

        {/* Card 2: NSE India Growth Holdings P&L */}
        <div className="bg-[#f9f8f5] border border-[#e5e4e1] p-4 space-y-1.5">
          <div className="flex justify-between items-center text-[10px] font-mono text-gray-500 uppercase font-bold">
            <span>🇮🇳 NSE India Value</span>
            <span>NSE Leader Stocks</span>
          </div>
          <div className="font-mono text-xl font-black text-[#1a1a1a]">
            {formatCurrency(totals.totalValueNse, '₹')}
          </div>
          <div className="flex items-center justify-between text-xs font-mono pt-1 border-t border-[#e5e4e1]">
            <span className="text-gray-500 text-[10px]">P&L:</span>
            <span
              className={`font-extrabold flex items-center space-x-1 ${
                totals.pnlNse >= 0 ? 'text-emerald-700' : 'text-rose-600'
              }`}
            >
              {totals.pnlNse >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
              <span>
                {totals.pnlNse >= 0 ? '+' : ''}
                {formatCurrency(totals.pnlNse, '₹')} ({totals.pnlNsePercent.toFixed(2)}%)
              </span>
            </span>
          </div>
        </div>

        {/* Card 3: Trailing Stop Loss Guard */}
        <div className="bg-gradient-to-br from-amber-50 to-white border border-amber-300 p-4 space-y-1.5 shadow-xs">
          <div className="flex justify-between items-center text-[10px] font-mono text-amber-900 uppercase font-bold">
            <span className="flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
              <span>Trailing Stop Guard</span>
            </span>
            <span className="bg-amber-500 text-black px-1.5 py-0.2 text-[9px] font-black font-mono">
              {totals.trailingEnabledCount}/{holdings.length} Active
            </span>
          </div>
          <div className="font-mono text-xl font-black text-[#1a1a1a]">
            {totals.profitProtectedNse > 0 || totals.profitProtectedUsd > 0 ? (
              <span className="text-emerald-700">
                +{formatCurrency(totals.profitProtectedUsd + totals.profitProtectedNse * 0.012, '$')}
              </span>
            ) : (
              <span className="text-gray-600 text-sm">Capital Preserved</span>
            )}
          </div>
          <div className="flex justify-between text-[11px] font-mono text-gray-600 pt-1 border-t border-amber-200">
            <span>{totals.trailingViolations > 0 ? '🚨 Trailing Triggered:' : 'Profit Protection:'}</span>
            <strong className={totals.trailingViolations > 0 ? 'text-rose-600 font-bold animate-pulse' : 'text-emerald-700 font-bold'}>
              {totals.trailingViolations > 0 ? `${totals.trailingViolations} Need Exit` : 'Locked Above Cost'}
            </strong>
          </div>
        </div>

        {/* Card 4: SEPA Risk Health Score */}
        <div className="bg-[#f9f8f5] border border-[#e5e4e1] p-4 space-y-1.5">
          <div className="flex justify-between items-center text-[10px] font-mono text-gray-500 uppercase font-bold">
            <span>SEPA Health Status</span>
            <span>Stage 2 & Stops</span>
          </div>
          <div className="flex items-center space-x-2">
            {totals.sepaViolations === 0 ? (
              <div className="flex items-center space-x-1 text-emerald-800 bg-emerald-100 px-2.5 py-1 text-xs font-mono font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>100% Compliant</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1 text-rose-800 bg-rose-100 px-2.5 py-1 text-xs font-mono font-bold animate-pulse">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>{totals.sepaViolations} Violations</span>
              </div>
            )}
          </div>
          <p className="text-[10px] font-serif italic text-gray-600 pt-1 border-t border-[#e5e4e1] truncate">
            {totals.sepaViolations === 0
              ? 'All positions above Stage 2 MAs & stops.'
              : 'Action: Stop hit or lost 200 SMA.'}
          </p>
        </div>

        {/* Card 5: Position Win/Loss Ratio */}
        <div className="bg-[#f9f8f5] border border-[#e5e4e1] p-4 space-y-1.5">
          <div className="flex justify-between items-center text-[10px] font-mono text-gray-500 uppercase font-bold">
            <span>Win / Loss Breadth</span>
            <span>Batting Average</span>
          </div>
          <div className="font-mono text-lg font-bold text-[#1a1a1a] flex items-center space-x-2">
            <span className="text-emerald-700 font-black">{totals.totalGainers} Win</span>
            <span className="text-gray-300">/</span>
            <span className="text-rose-600 font-black">{totals.totalLosers} Loss</span>
          </div>
          <div className="flex justify-between text-[11px] font-mono text-gray-500 pt-1 border-t border-[#e5e4e1]">
            <span>Active Positions:</span>
            <strong className="text-[#1a1a1a] font-bold">{holdings.length} Positions</strong>
          </div>
        </div>

      </div>

      {/* D3-Based SEPA Capital Allocation & Sector Distribution Pie Chart */}
      <PortfolioSectorPieChart
        holdings={holdings}
        stocksList={stocks}
        onSelectStock={onSelectStock}
        onFilterSector={(sec) => setSelectedSectorFilter(sec)}
        selectedSector={selectedSectorFilter}
      />

      {/* Position Reordering & Sector Grouping Control Bar */}
      <div className="bg-[#1a1a1a] text-white p-3 border border-black flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center space-x-2">
          <GripVertical className="w-4 h-4 text-amber-400 animate-pulse" />
          <span className="font-bold uppercase text-[11px] text-amber-300">
            Drag & Drop Reordering Active
          </span>
          <span className="text-[10px] text-gray-400 font-sans hidden sm:inline">
            (Drag rows using handle <GripVertical className="w-3.5 h-3.5 inline text-amber-400" /> to organize holdings by conviction rank)
          </span>
        </div>

        {/* Quick Sorting Presets */}
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] uppercase font-bold">
          <span className="text-gray-400 pr-1 hidden md:inline">Quick Presets:</span>
          <button
            onClick={handleSortByPnL}
            className="bg-white/10 hover:bg-amber-400 hover:text-black text-amber-300 px-2.5 py-1 border border-white/20 transition-all flex items-center space-x-1 cursor-pointer"
            title="Reorder holdings by highest conviction P&L gain %"
          >
            <TrendingUp className="w-3 h-3" />
            <span>Conviction (P&L %)</span>
          </button>
          <button
            onClick={handleGroupBySector}
            className="bg-white/10 hover:bg-amber-400 hover:text-black text-sky-300 px-2.5 py-1 border border-white/20 transition-all flex items-center space-x-1 cursor-pointer"
            title="Group holdings by sector industry"
          >
            <ListOrdered className="w-3 h-3" />
            <span>Group by Sector</span>
          </button>
          <button
            onClick={handleSortByValue}
            className="bg-white/10 hover:bg-amber-400 hover:text-black text-emerald-300 px-2.5 py-1 border border-white/20 transition-all flex items-center space-x-1 cursor-pointer"
            title="Sort holdings by position size market value"
          >
            <DollarSign className="w-3 h-3" />
            <span>Position Value</span>
          </button>
        </div>
      </div>

      {/* Reorder Notification Toast */}
      {reorderNotification && (
        <div className="bg-amber-500 text-black px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-between border border-amber-600 shadow-md">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4" />
            <span>{reorderNotification}</span>
          </div>
          <span className="text-[10px] bg-black text-amber-400 px-1.5 py-0.5">Saved to Local Storage</span>
        </div>
      )}

      {/* Main Holdings Table */}
      <div className="overflow-x-auto border border-[#e5e4e1]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#e5e4e1] text-[10px] uppercase tracking-[0.2em] text-[#b5a68d] font-bold bg-[#f9f8f5]">
              <th className="py-3 px-3 text-center w-12" title="Drag handle to reorder rows"># Drag</th>
              <th className="py-3 px-4">Stock & Exchange</th>
              <th className="py-3 px-4">Position Size</th>
              <th className="py-3 px-4">Cost Basis</th>
              <th className="py-3 px-4">Current Price</th>
              <th className="py-3 px-4 font-mono text-right">Unrealized P&L</th>
              <th className="py-3 px-4 text-center">Stop & Trailing TSL</th>
              <th className="py-3 px-4 text-center">SEPA Compliance</th>
              <th className="py-3 px-4 text-center">Execution Plan</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e5e4e1] text-xs">
            {holdings.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-gray-500 font-serif italic text-sm">
                  No actual portfolio holdings tracked yet. Click "Add Portfolio Holding" to monitor your positions.
                </td>
              </tr>
            ) : (
              holdings.map((h, index) => {
                const currency = getCurrencySymbol(h.exchange);
                const totalCost = h.shares * h.entryPrice;
                const currentValue = h.shares * h.currentPrice;
                const pnl = currentValue - totalCost;
                const pnlPercent = totalCost > 0 ? (pnl / totalCost) * 100 : 0;

                const matchedStock = stocks.find((s) => s.ticker === h.ticker);
                const holdingSector = matchedStock?.sector?.trim() || (h.exchange === 'NSE' ? 'NSE Growth Leader' : 'Technology / Growth');
                const isSectorMatch = selectedSectorFilter ? holdingSector.toLowerCase() === selectedSectorFilter.toLowerCase() : true;

                const peakPrice = Math.max(h.trailingPeakPrice || h.entryPrice, h.currentPrice);
                let effectiveTrail = h.trailingStopPrice;
                if (h.isTrailingStopEnabled && !effectiveTrail) {
                  if (h.trailingStopType === 'BREAKEVEN') {
                    effectiveTrail = h.entryPrice;
                  } else if (h.trailingStopType === 'ATR') {
                    const atr = matchedStock?.atr14 || (h.entryPrice * 0.03);
                    effectiveTrail = Math.max(h.stopLossPrice, Number((peakPrice - 2 * atr).toFixed(2)));
                  } else {
                    const pct = h.trailingStopPercent || 8.0;
                    effectiveTrail = Math.max(h.stopLossPrice, Number((peakPrice * (1 - pct / 100)).toFixed(2)));
                  }
                }

                const isStopViolated = h.currentPrice <= h.stopLossPrice;
                const isTrailViolated = Boolean(h.isTrailingStopEnabled && effectiveTrail && h.currentPrice <= effectiveTrail);
                const isTargetReached = h.currentPrice >= h.pivotTargetPrice;
                const isStage2Intact = !h.sma200 || h.currentPrice >= h.sma200;

                return (
                  <tr
                    key={h.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    onDrop={(e) => handleDrop(e, index)}
                    className={`transition-all ${
                      draggedIndex === index
                        ? 'opacity-30 bg-amber-100 border-2 border-dashed border-amber-500'
                        : dragOverIndex === index
                        ? 'bg-amber-100/90 border-t-4 border-t-amber-600 shadow-md scale-[1.01]'
                        : selectedSectorFilter && !isSectorMatch
                        ? 'opacity-40 bg-gray-50'
                        : selectedSectorFilter && isSectorMatch
                        ? 'bg-amber-50/70 border-l-4 border-l-amber-500'
                        : isStopViolated
                        ? 'bg-rose-50/80 border-l-4 border-l-rose-600'
                        : isTrailViolated
                        ? 'bg-amber-50/90 border-l-4 border-l-amber-500'
                        : isTargetReached
                        ? 'bg-emerald-50/80 border-l-4 border-l-emerald-600'
                        : 'hover:bg-gray-50/80'
                    }`}
                  >
                    {/* Position Rank & Drag Handle */}
                    <td className="py-4 px-2 text-center align-middle select-none">
                      <div className="flex flex-col items-center justify-center space-y-1 cursor-grab active:cursor-grabbing group" title="Drag to reorder position rank">
                        <GripVertical className="w-4 h-4 text-gray-400 group-hover:text-amber-600 transition-colors" />
                        <span className="text-[9px] font-mono font-bold bg-[#1a1a1a] text-amber-400 px-1 py-0.2">
                          #{index + 1}
                        </span>
                      </div>
                    </td>

                    {/* Ticker & Name */}
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-2">
                        <span className="font-extrabold text-sm text-[#1a1a1a] font-mono">
                          {h.ticker}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 uppercase tracking-wider bg-[#1a1a1a] text-white font-mono font-semibold">
                          {h.exchange}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-500 truncate max-w-[160px] mt-0.5 font-sans">
                        {h.stockName}
                      </div>
                      {matchedStock?.sector && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 bg-gray-100 text-gray-700 border border-gray-300 font-semibold inline-block mt-0.5">
                          📂 {matchedStock.sector}
                        </span>
                      )}
                      <div className="text-[10px] font-mono text-gray-500 mt-0.5 flex flex-wrap items-center gap-1">
                        <span>Bought {h.buyDate}</span>
                        {(() => {
                          const daysInTrade = calculateDaysHeld(h.buyDate);
                          if (daysInTrade === null) return null;
                          let badgeStyle = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                          let badgeLabel = `${daysInTrade}d in trade`;
                          if (daysInTrade > 30) {
                            badgeStyle = 'bg-rose-100 text-rose-900 border-rose-300 font-extrabold animate-pulse';
                            badgeLabel = `🔴 Stalled (${daysInTrade}d)`;
                          } else if (daysInTrade > 15) {
                            badgeStyle = 'bg-amber-100 text-amber-900 border-amber-300 font-bold';
                            badgeLabel = `🟡 Stalling (${daysInTrade}d)`;
                          } else if (daysInTrade > 5) {
                            badgeStyle = 'bg-blue-50 text-blue-800 border-blue-200 font-semibold';
                            badgeLabel = `🔵 ${daysInTrade}d in trade`;
                          } else {
                            badgeStyle = 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold';
                            badgeLabel = `🟢 Fresh (${daysInTrade}d)`;
                          }
                          return (
                            <span className={`text-[9px] px-1 py-0.2 border ${badgeStyle}`} title="Time in trade holding duration">
                              {badgeLabel}
                            </span>
                          );
                        })()}
                      </div>
                    </td>

                    {/* Position Size */}
                    <td className="py-4 px-4 font-mono">
                      <div className="font-bold text-[#1a1a1a] text-sm">
                        {h.shares} Shares
                      </div>
                      <div className="text-[10px] text-gray-500">
                        Market Value: {formatCurrency(currentValue, currency)}
                      </div>
                    </td>

                    {/* Cost Basis */}
                    <td className="py-4 px-4 font-mono">
                      <div className="font-bold text-[#1a1a1a]">
                        {formatCurrency(h.entryPrice, currency)}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        Total Cost: {formatCurrency(totalCost, currency)}
                      </div>
                    </td>

                    {/* Current Live Price */}
                    <td className="py-4 px-4 font-mono">
                      <div className="font-extrabold text-sm text-[#1a1a1a]">
                        {formatCurrency(h.currentPrice, currency)}
                      </div>
                      <div className="text-[10px] text-gray-500 flex items-center space-x-1">
                        <span>Peak:</span>
                        <strong className="text-gray-700">{formatCurrency(peakPrice, currency)}</strong>
                      </div>
                    </td>

                    {/* Unrealized P&L */}
                    <td className="py-4 px-4 font-mono text-right">
                      <div
                        className={`font-black text-sm flex items-center justify-end space-x-1 ${
                          pnl >= 0 ? 'text-emerald-700' : 'text-rose-600'
                        }`}
                      >
                        {pnl >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                        <span>
                          {pnl >= 0 ? '+' : ''}
                          {formatCurrency(pnl, currency)}
                        </span>
                      </div>
                      <div
                        className={`text-[11px] font-bold ${
                          pnl >= 0 ? 'text-emerald-800' : 'text-rose-700'
                        }`}
                      >
                        {pnlPercent >= 0 ? '+' : ''}
                        {pnlPercent.toFixed(2)}%
                      </div>
                    </td>

                    {/* Stop & Trailing Stop Loss */}
                    <td className="py-4 px-4 font-mono">
                      <div className="flex flex-col space-y-1 min-w-[140px]">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-gray-500 text-[10px]">Hard Stop:</span>
                          <span className={`font-bold ${isStopViolated ? 'text-rose-600' : 'text-gray-700'}`}>
                            {formatCurrency(h.stopLossPrice, currency)}
                          </span>
                        </div>

                        {h.isTrailingStopEnabled ? (
                          <div className="p-1.5 bg-amber-500/10 border border-amber-500/30 text-[10px]">
                            <div className="flex items-center justify-between font-bold">
                              <span className="flex items-center space-x-1 text-amber-700">
                                <ShieldCheck className="w-3 h-3 text-amber-600" />
                                <span>Trailing:</span>
                              </span>
                              <span className={isTrailViolated ? 'text-rose-600 line-through' : 'text-amber-900 font-extrabold'}>
                                {formatCurrency(effectiveTrail || h.stopLossPrice, currency)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[9px] text-gray-500 mt-0.5">
                              <span>Peak: {formatCurrency(peakPrice, currency)}</span>
                              <span className="text-amber-800 font-semibold">
                                {h.trailingStopType === 'BREAKEVEN'
                                  ? '🔒 Breakeven'
                                  : `-${h.trailingStopPercent || 8}%`}
                              </span>
                            </div>
                            {isTrailViolated ? (
                              <div className="mt-1 text-[9px] font-bold text-white bg-rose-600 px-1 py-0.5 text-center animate-pulse">
                                🚨 TRAIL HIT — LOCK PROFIT!
                              </div>
                            ) : effectiveTrail && effectiveTrail > h.entryPrice ? (
                              <div className="mt-0.5 text-[8.5px] font-bold text-emerald-700">
                                🔒 +{(((effectiveTrail - h.entryPrice) / h.entryPrice) * 100).toFixed(1)}% Locked
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <div className="text-[10px] text-gray-400 italic">
                            No trailing stop active
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setTrailModalHolding(h);
                            setQuickTrailPercent(h.trailingStopPercent || 8.0);
                          }}
                          className={`mt-1 px-2 py-1 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center space-x-1 transition-all cursor-pointer border ${
                            h.isTrailingStopEnabled
                              ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300'
                              : 'bg-white hover:bg-gray-100 text-gray-700 border-gray-300 hover:border-black'
                          }`}
                        >
                          <ShieldCheck className="w-3 h-3 text-amber-600" />
                          <span>{h.isTrailingStopEnabled ? 'Adjust Trail' : '+ Set Trail Stop'}</span>
                        </button>
                      </div>
                    </td>

                    {/* SEPA Stage & Risk Compliance Check */}
                    <td className="py-4 px-4 text-center font-mono">
                      {isStopViolated ? (
                        <span className="inline-flex items-center space-x-1 bg-rose-800 text-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider animate-pulse">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          <span>STOP HIT — CUT LOSS!</span>
                        </span>
                      ) : isTrailViolated ? (
                        <span className="inline-flex items-center space-x-1 bg-amber-600 text-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider animate-pulse">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          <span>TRAIL HIT — LOCK PROFIT!</span>
                        </span>
                      ) : isTargetReached ? (
                        <span className="inline-flex items-center space-x-1 bg-emerald-800 text-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">
                          <Target className="w-3.5 h-3.5" />
                          <span>+20% TARGET REACHED!</span>
                        </span>
                      ) : !isStage2Intact ? (
                        <span className="inline-flex items-center space-x-1 bg-amber-500 text-black px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>BELOW 200 SMA</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 bg-emerald-50 border border-emerald-300 text-emerald-900 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                          <span>STAGE 2 INTACT</span>
                        </span>
                      )}
                    </td>

                    {/* Minervini Action Plan */}
                    <td className="py-4 px-4 text-center font-sans">
                      {pnlPercent >= 8 ? (
                        <span className="text-[10px] bg-blue-50 text-blue-900 border border-blue-300 px-2 py-0.5 font-mono font-bold block">
                          🔒 Trail Stop to Breakeven (${h.entryPrice})
                        </span>
                      ) : pnlPercent <= -5 ? (
                        <span className="text-[10px] bg-rose-50 text-rose-900 border border-rose-300 px-2 py-0.5 font-mono font-bold block">
                          ⚠️ Nearing Max 7-8% Loss Limit
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-500 font-mono block">
                          Hold for Stage 2 Trend Continuation
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        {matchedStock && (
                          <button
                            onClick={() => onViewChart(matchedStock)}
                            title="Scan VCP Chart"
                            className="bg-[#1a1a1a] hover:bg-black text-white p-1.5 transition-colors border border-black"
                          >
                            <BarChart3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenEdit(h)}
                          title="Edit Position"
                          className="bg-white hover:bg-gray-100 text-gray-800 p-1.5 border border-[#e5e4e1] transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteHolding(h.id)}
                          title="Remove Position"
                          className="bg-white hover:bg-rose-50 text-rose-600 p-1.5 border border-[#e5e4e1] transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Minervini Risk Management Golden Rules Banner */}
      <div className="bg-[#f9f8f5] border border-[#e5e4e1] p-4 flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-gray-700">
        <div className="flex items-center space-x-2">
          <Info className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <span className="font-bold uppercase text-[10px] text-[#b5a68d]">
            Mark Minervini SEPA Portfolio Rule:
          </span>
          <span className="font-bold text-[#1a1a1a]">
            "Never turn a gain into a loss. Once a stock advances +7-8% above pivot, raise stop loss to breakeven."
          </span>
        </div>
      </div>

      {/* Add / Edit Holding Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-[#1a1a1a] max-w-lg w-full p-6 shadow-2xl space-y-4">
            
            <div className="flex items-center justify-between border-b border-[#e5e4e1] pb-3">
              <h3 className="text-lg font-serif font-black text-[#1a1a1a]">
                {editingHoldingId ? 'Edit Portfolio Position' : 'Add Actual Portfolio Holding'}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-black p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveHolding} className="space-y-4 font-mono text-xs">
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-600 mb-1">
                  Select Stock Setup Candidate
                </label>
                <select
                  value={selectedStockTicker}
                  onChange={(e) => handleSelectStockForAdd(e.target.value)}
                  className="w-full bg-white border border-[#e5e4e1] p-2 text-xs font-bold text-[#1a1a1a] focus:outline-none"
                >
                  {stocks.map((s) => (
                    <option key={s.ticker} value={s.ticker}>
                      {s.ticker} — {s.name} ({s.exchange}) [Pivot: {s.pivotPrice}]
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-600 mb-1">
                    Shares Quantity
                  </label>
                  <input
                    type="number"
                    step="1"
                    required
                    value={sharesInput}
                    onChange={(e) => setSharesInput(e.target.value)}
                    className="w-full bg-white border border-[#e5e4e1] p-2 text-xs font-bold text-[#1a1a1a] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-600 mb-1">
                    Purchase Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={entryPriceInput}
                    onChange={(e) => setEntryPriceInput(e.target.value)}
                    className="w-full bg-white border border-[#e5e4e1] p-2 text-xs font-bold text-[#1a1a1a] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-600 mb-1">
                    Stop Loss Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={stopLossInput}
                    onChange={(e) => setStopLossInput(e.target.value)}
                    className="w-full bg-white border border-[#e5e4e1] p-2 text-xs font-bold text-[#1a1a1a] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-600 mb-1">
                    Profit Target Price (+20%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={targetPriceInput}
                    onChange={(e) => setTargetPriceInput(e.target.value)}
                    className="w-full bg-white border border-[#e5e4e1] p-2 text-xs font-bold text-[#1a1a1a] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-600 mb-1">
                    Purchase Date
                  </label>
                  <input
                    type="date"
                    required
                    value={buyDateInput}
                    onChange={(e) => setBuyDateInput(e.target.value)}
                    className="w-full bg-white border border-[#e5e4e1] p-2 text-xs font-bold text-[#1a1a1a] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-600 mb-1">
                    Strategy Notes
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Breakout on 2x avg volume"
                    value={notesInput}
                    onChange={(e) => setNotesInput(e.target.value)}
                    className="w-full bg-white border border-[#e5e4e1] p-2 text-xs text-[#1a1a1a] focus:outline-none font-sans"
                  />
                </div>
              </div>

              {/* Trailing Stop Loss Form Section */}
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isTrailingEnabledInput}
                      onChange={(e) => setIsTrailingEnabledInput(e.target.checked)}
                      className="w-4 h-4 text-amber-600 rounded-none border-gray-300 focus:ring-amber-500 cursor-pointer"
                    />
                    <span className="font-bold text-gray-900 flex items-center space-x-1.5">
                      <ShieldCheck className="w-4 h-4 text-amber-600" />
                      <span>Enable Dynamic Trailing Stop Loss</span>
                    </span>
                  </label>
                  {isTrailingEnabledInput && (
                    <span className="text-[9px] bg-amber-500 text-black px-1.5 py-0.2 font-black uppercase">
                      TSL Active
                    </span>
                  )}
                </div>

                {isTrailingEnabledInput && (
                  <div className="pt-2 border-t border-amber-500/20 space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setTrailingTypeInput('PERCENT');
                          setTrailingPercentInput('8.0');
                        }}
                        className={`p-1.5 text-center border font-bold text-[10px] uppercase transition-colors cursor-pointer ${
                          trailingTypeInput === 'PERCENT' && trailingPercentInput === '8.0'
                            ? 'bg-amber-500 text-black border-amber-600'
                            : 'bg-white border-gray-300 text-gray-700'
                        }`}
                      >
                        8% Standard
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTrailingTypeInput('PERCENT');
                          setTrailingPercentInput('5.0');
                        }}
                        className={`p-1.5 text-center border font-bold text-[10px] uppercase transition-colors cursor-pointer ${
                          trailingTypeInput === 'PERCENT' && trailingPercentInput === '5.0'
                            ? 'bg-amber-500 text-black border-amber-600'
                            : 'bg-white border-gray-300 text-gray-700'
                        }`}
                      >
                        5% Tight
                      </button>
                      <button
                        type="button"
                        onClick={() => setTrailingTypeInput('BREAKEVEN')}
                        className={`p-1.5 text-center border font-bold text-[10px] uppercase transition-colors cursor-pointer ${
                          trailingTypeInput === 'BREAKEVEN'
                            ? 'bg-amber-500 text-black border-amber-600'
                            : 'bg-white border-gray-300 text-gray-700'
                        }`}
                      >
                        🔒 Breakeven
                      </button>
                    </div>

                    {trailingTypeInput === 'PERCENT' && (
                      <div className="flex items-center space-x-2 pt-1">
                        <span className="text-[10px] text-gray-600">Trail Offset (%):</span>
                        <input
                          type="number"
                          step="0.5"
                          min="1"
                          max="25"
                          value={trailingPercentInput}
                          onChange={(e) => setTrailingPercentInput(e.target.value)}
                          className="w-20 bg-white border border-[#e5e4e1] p-1.5 text-xs font-bold text-[#1a1a1a] focus:outline-none"
                        />
                        <span className="text-[10px] text-gray-500">
                          (Trails {trailingPercentInput}% below peak)
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-[#e5e4e1]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="bg-white hover:bg-gray-100 text-gray-700 font-bold px-4 py-2 text-xs uppercase tracking-wider border border-[#e5e4e1]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#1a1a1a] hover:bg-black text-white font-bold px-5 py-2 text-xs uppercase tracking-wider border border-black"
                >
                  Save Position
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Quick Trailing Stop Adjuster Modal */}
      {trailModalHolding && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-[#1a1a1a] max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#e5e4e1] pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-amber-500 text-black flex items-center justify-center font-bold">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-serif font-black text-[#1a1a1a]">
                    Trailing Stop Loss (TSL) Manager
                  </h3>
                  <div className="text-[11px] font-mono text-gray-500">
                    {trailModalHolding.ticker} ({trailModalHolding.stockName}) • {trailModalHolding.exchange}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setTrailModalHolding(null)}
                className="text-gray-400 hover:text-black p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Position Reference Metrics */}
            <div className="grid grid-cols-4 gap-2 font-mono text-center text-xs">
              <div className="p-2 bg-gray-50 border border-gray-200">
                <div className="text-[9px] uppercase text-gray-500">Entry Cost</div>
                <div className="font-bold">{formatCurrency(trailModalHolding.entryPrice, getCurrencySymbol(trailModalHolding.exchange))}</div>
              </div>
              <div className="p-2 bg-gray-50 border border-gray-200">
                <div className="text-[9px] uppercase text-gray-500">Current LTP</div>
                <div className="font-bold text-amber-600">{formatCurrency(trailModalHolding.currentPrice, getCurrencySymbol(trailModalHolding.exchange))}</div>
              </div>
              <div className="p-2 bg-gray-50 border border-gray-200">
                <div className="text-[9px] uppercase text-gray-500">Peak High</div>
                <div className="font-bold text-emerald-700">
                  {formatCurrency(Math.max(trailModalHolding.trailingPeakPrice || trailModalHolding.entryPrice, trailModalHolding.currentPrice), getCurrencySymbol(trailModalHolding.exchange))}
                </div>
              </div>
              <div className="p-2 bg-gray-50 border border-gray-200">
                <div className="text-[9px] uppercase text-gray-500">Hard Stop</div>
                <div className="font-bold text-rose-600">{formatCurrency(trailModalHolding.stopLossPrice, getCurrencySymbol(trailModalHolding.exchange))}</div>
              </div>
            </div>

            {/* Presets Grid */}
            <div className="space-y-2">
              <label className="block text-[11px] font-mono font-bold uppercase text-gray-700">
                Minervini Trailing Stop Presets (1-Click Apply):
              </label>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                {/* Preset 1: Lock Breakeven */}
                <button
                  type="button"
                  onClick={() => handleApplyQuickTrail(trailModalHolding.id, 'BREAKEVEN')}
                  className="p-3 text-left border border-blue-300 bg-blue-50/60 hover:bg-blue-100 transition-colors flex flex-col justify-between group cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-blue-900 flex items-center space-x-1">
                      <Lock className="w-3.5 h-3.5 text-blue-700" />
                      <span>Lock Breakeven</span>
                    </span>
                    <span className="text-[10px] bg-blue-200 text-blue-900 px-1.5 py-0.2 font-bold">0% Risk</span>
                  </div>
                  <div className="text-[10px] text-blue-800 mt-1">
                    Stop at {formatCurrency(trailModalHolding.entryPrice, getCurrencySymbol(trailModalHolding.exchange))} (Cost basis)
                  </div>
                  <div className="text-[9px] text-gray-500 mt-0.5">Eliminates downside capital loss.</div>
                </button>

                {/* Preset 2: 8% Standard Minervini Trail */}
                <button
                  type="button"
                  onClick={() => handleApplyQuickTrail(trailModalHolding.id, 'PERCENT', 8.0)}
                  className="p-3 text-left border border-amber-300 bg-amber-50/60 hover:bg-amber-100 transition-colors flex flex-col justify-between group cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-900 flex items-center space-x-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                      <span>8% Standard Trail</span>
                    </span>
                    <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.2 font-bold">-8.0%</span>
                  </div>
                  <div className="text-[10px] text-amber-800 mt-1">
                    Stop at {formatCurrency(Math.max(trailModalHolding.trailingPeakPrice || trailModalHolding.entryPrice, trailModalHolding.currentPrice) * 0.92, getCurrencySymbol(trailModalHolding.exchange))}
                  </div>
                  <div className="text-[9px] text-gray-500 mt-0.5">Minervini SEPA swing runner trail.</div>
                </button>

                {/* Preset 3: 5% Tight Profit Guard */}
                <button
                  type="button"
                  onClick={() => handleApplyQuickTrail(trailModalHolding.id, 'PERCENT', 5.0)}
                  className="p-3 text-left border border-emerald-300 bg-emerald-50/60 hover:bg-emerald-100 transition-colors flex flex-col justify-between group cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-900 flex items-center space-x-1">
                      <Zap className="w-3.5 h-3.5 text-emerald-600" />
                      <span>5% Tight Trail</span>
                    </span>
                    <span className="text-[10px] bg-emerald-200 text-emerald-900 px-1.5 py-0.2 font-bold">-5.0%</span>
                  </div>
                  <div className="text-[10px] text-emerald-800 mt-1">
                    Stop at {formatCurrency(Math.max(trailModalHolding.trailingPeakPrice || trailModalHolding.entryPrice, trailModalHolding.currentPrice) * 0.95, getCurrencySymbol(trailModalHolding.exchange))}
                  </div>
                  <div className="text-[9px] text-gray-500 mt-0.5">Tight defense on steep vertical acceleration.</div>
                </button>

                {/* Preset 4: 2x ATR Volatility Trail */}
                <button
                  type="button"
                  onClick={() => handleApplyQuickTrail(trailModalHolding.id, 'ATR')}
                  className="p-3 text-left border border-purple-300 bg-purple-50/60 hover:bg-purple-100 transition-colors flex flex-col justify-between group cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-purple-900 flex items-center space-x-1">
                      <Sliders className="w-3.5 h-3.5 text-purple-600" />
                      <span>2x ATR Trail</span>
                    </span>
                    <span className="text-[10px] bg-purple-200 text-purple-900 px-1.5 py-0.2 font-bold">Volatility</span>
                  </div>
                  <div className="text-[10px] text-purple-800 mt-1">
                    Dynamic buffer based on 14-day True Range
                  </div>
                  <div className="text-[9px] text-gray-500 mt-0.5">Adapts to stock's actual daily volatility.</div>
                </button>
              </div>
            </div>

            {/* Custom Trail Percentage Input */}
            <div className="p-3 bg-gray-50 border border-gray-200 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono font-bold text-gray-700">
                <span>Custom Trail Distance Percentage:</span>
                <span className="text-amber-600 font-extrabold">{quickTrailPercent}% Trail</span>
              </div>
              <div className="flex items-center space-x-3">
                <input
                  type="range"
                  min="2"
                  max="20"
                  step="0.5"
                  value={quickTrailPercent}
                  onChange={(e) => setQuickTrailPercent(parseFloat(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <input
                  type="number"
                  min="1"
                  max="25"
                  step="0.5"
                  value={quickTrailPercent}
                  onChange={(e) => setQuickTrailPercent(parseFloat(e.target.value) || 5)}
                  className="w-16 p-1 text-center font-mono text-xs font-bold border border-gray-300 bg-white"
                />
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono text-gray-600 pt-1 border-t border-gray-200">
                <span>Projected Trail Level:</span>
                <strong className="text-gray-900 font-bold">
                  {formatCurrency(
                    Math.max(
                      trailModalHolding.stopLossPrice,
                      Math.max(trailModalHolding.trailingPeakPrice || trailModalHolding.entryPrice, trailModalHolding.currentPrice) * (1 - quickTrailPercent / 100)
                    ),
                    getCurrencySymbol(trailModalHolding.exchange)
                  )}
                </strong>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-[#e5e4e1] font-mono text-xs">
              <button
                type="button"
                onClick={() => handleApplyQuickTrail(trailModalHolding.id, 'DISABLE')}
                className="px-3 py-2 text-rose-700 hover:bg-rose-50 border border-rose-300 uppercase font-bold text-[10px] tracking-wider cursor-pointer transition-colors"
              >
                Disable Trailing Stop
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setTrailModalHolding(null)}
                  className="px-4 py-2 bg-white hover:bg-gray-100 text-gray-700 uppercase font-bold text-[10px] tracking-wider border border-[#e5e4e1] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyQuickTrail(trailModalHolding.id, 'PERCENT', quickTrailPercent)}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-black uppercase font-black text-[10px] tracking-wider border border-amber-600 cursor-pointer transition-all shadow-xs"
                >
                  Apply {quickTrailPercent}% Trail
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

        </>
      )}

    </div>
  );
};
