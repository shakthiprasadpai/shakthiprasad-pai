import React, { useState, useEffect, useRef, useMemo } from 'react';
import { PriceAlert, MinerviniTradeSetup, DetectedRsiDivergence } from '../types';
import { formatCurrency, getCurrencySymbol } from '../utils/sepaCalculator';
import { getChartLinkUrl } from '../utils/chartLinkHelper';
import { RecentPriceAlertHistory } from './RecentPriceAlertHistory';
import {
  getStoredAlerts,
  saveStoredAlerts,
  getTrackerLogs,
  appendTrackerLog,
  playAlertChime,
  BackgroundCheckLog,
} from '../utils/backgroundPriceChecker';
import {
  Bell,
  BellRing,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Plus,
  Trash2,
  Volume2,
  VolumeX,
  Target,
  ShieldAlert,
  Zap,
  Activity,
  History,
  TrendingUp,
  TrendingDown,
  HardDrive,
  RefreshCw,
  Radio,
  BarChart3,
  ExternalLink,
  Compass,
  Sparkles,
  Filter,
  Sliders,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Eye,
} from 'lucide-react';
import {
  detectRsiDivergences,
  simulateRsiDivergence,
  dispatchRsiDivergenceNotification,
} from '../utils/technicalIndicatorsCalculator';
import {
  detectRsiDivergence,
  RsiDivergenceResult,
} from '../utils/rsiDivergenceEngine';
import { logAlertTrigger } from '../utils/priceAlertHistoryStorage';
import { RsiDivergenceNotification } from './RsiDivergenceNotification';

interface PriceAlertSystemProps {
  stocks: MinerviniTradeSetup[];
  selectedStock?: MinerviniTradeSetup;
  onSelectStock?: (stock: MinerviniTradeSetup) => void;
}

export const PriceAlertSystem: React.FC<PriceAlertSystemProps> = ({
  stocks,
  selectedStock,
  onSelectStock,
}) => {
  const [alerts, setAlerts] = useState<PriceAlert[]>(() => {
    return getStoredAlerts();
  });

  const [logs, setLogs] = useState<BackgroundCheckLog[]>(() => {
    return getTrackerLogs();
  });

  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(() => {
    return typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'default';
  });

  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [rsiDivergenceAlertsEnabled, setRsiDivergenceAlertsEnabled] = useState<boolean>(() => {
    return typeof window !== 'undefined'
      ? localStorage.getItem('minervini_rsi_divergence_alerts_enabled') !== 'false'
      : true;
  });

  const handleToggleRsiDivergenceAlerts = () => {
    const nextState = !rsiDivergenceAlertsEnabled;
    setRsiDivergenceAlertsEnabled(nextState);
    if (typeof window !== 'undefined') {
      localStorage.setItem('minervini_rsi_divergence_alerts_enabled', String(nextState));
      window.dispatchEvent(
        new CustomEvent('minervini_rsi_alerts_toggle', { detail: { enabled: nextState } })
      );
    }
  };
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'TRIGGERED'>('ALL');
  const [activeSubTab, setActiveSubTab] = useState<'ALERTS' | 'RSI_DIVERGENCE_RADAR' | 'PRICE_HISTORY' | 'AUDIT_LOGS'>('ALERTS');

  // RSI Divergence Detection Radar Filter State
  const [rsiDivergenceFilter, setRsiDivergenceFilter] = useState<'ALL' | 'BEARISH' | 'BULLISH' | 'HIGH_SEVERITY'>('ALL');
  const [rsiTimeframe, setRsiTimeframe] = useState<'DAILY' | 'WEEKLY'>('DAILY');

  // Custom alert form state
  const [customPrice, setCustomPrice] = useState<string>('');
  const [customProximity, setCustomProximity] = useState<number>(1.5);
  const [customNotes, setCustomNotes] = useState<string>('');
  const [customTargetType, setCustomTargetType] = useState<
    'PIVOT_ENTRY' | 'STOP_LOSS' | 'CUSTOM_ABOVE' | 'CUSTOM_BELOW' | 'VOLATILITY_DRYUP' | 'RSI_BEARISH_DIVERGENCE' | 'RSI_BULLISH_DIVERGENCE'
  >('PIVOT_ENTRY');

  // Simulation state
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // Real-time calculation of RSI divergences across all universe stocks
  const divergenceScanList = useMemo(() => {
    return stocks.map((stock) => {
      const detailed = detectRsiDivergence(stock, rsiTimeframe);
      const allDivergences = detectRsiDivergences(stock, 14);
      const isArmedBearish = alerts.some(
        (a) => a.ticker === stock.ticker && a.targetType === 'RSI_BEARISH_DIVERGENCE' && a.status === 'ACTIVE'
      );
      const isArmedBullish = alerts.some(
        (a) => a.ticker === stock.ticker && a.targetType === 'RSI_BULLISH_DIVERGENCE' && a.status === 'ACTIVE'
      );

      return {
        stock,
        divergence: detailed,
        allDivergences,
        hasDivergence: detailed.hasDivergence,
        divergenceType: detailed.divergenceType,
        isArmed: isArmedBearish || isArmedBullish,
        isArmedBearish,
        isArmedBullish,
      };
    });
  }, [stocks, alerts, rsiTimeframe]);

  // Sync state with LocalStorage when background price checker updates
  useEffect(() => {
    const handleStorageUpdate = () => {
      setAlerts(getStoredAlerts());
      setLogs(getTrackerLogs());
    };

    window.addEventListener('minervini_alerts_updated', handleStorageUpdate);
    window.addEventListener('storage', handleStorageUpdate);
    return () => {
      window.removeEventListener('minervini_alerts_updated', handleStorageUpdate);
      window.removeEventListener('storage', handleStorageUpdate);
    };
  }, []);

  // Save to localStorage whenever alerts state changes manually
  useEffect(() => {
    if (alerts.length > 0) {
      saveStoredAlerts(alerts);
    }
  }, [alerts]);

  // Surveillance effect: periodically scan active RSI divergence alerts
  useEffect(() => {
    // Silence surveillance if RSI Divergence notifications are disabled globally
    if (!rsiDivergenceAlertsEnabled) return;

    const activeDivergenceAlerts = alerts.filter(
      (a) => a.status === 'ACTIVE' && (a.targetType === 'RSI_BEARISH_DIVERGENCE' || a.targetType === 'RSI_BULLISH_DIVERGENCE')
    );
    if (activeDivergenceAlerts.length === 0) return;

    let hasUpdates = false;
    const updatedAlerts = alerts.map((alert) => {
      if (alert.status !== 'ACTIVE') return alert;
      if (alert.targetType !== 'RSI_BEARISH_DIVERGENCE' && alert.targetType !== 'RSI_BULLISH_DIVERGENCE') return alert;

      const matchingStock = stocks.find((s) => s.ticker === alert.ticker);
      if (!matchingStock) return alert;

      const div = detectRsiDivergence(matchingStock, rsiTimeframe);
      const isBearishMatch = alert.targetType === 'RSI_BEARISH_DIVERGENCE' && div.divergenceType === 'BEARISH_DIVERGENCE';
      const isBullishMatch = alert.targetType === 'RSI_BULLISH_DIVERGENCE' && (div.divergenceType === 'BULLISH_DIVERGENCE' || div.divergenceType === 'HIDDEN_BULLISH');

      if (isBearishMatch || isBullishMatch) {
        hasUpdates = true;
        if (soundEnabled) playAlertChime();
        const simDiv = simulateRsiDivergence(matchingStock, isBearishMatch ? 'BEARISH' : 'BULLISH');
        dispatchRsiDivergenceNotification(matchingStock, simDiv);
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(div.title, {
            body: `${alert.ticker}: ${div.description} ${div.actionAdvice}`,
            icon: '/favicon.ico',
          });
        }
        appendTrackerLog({
          ticker: alert.ticker,
          exchange: alert.exchange,
          previousPrice: alert.currentPrice,
          currentPrice: matchingStock.currentPrice,
          targetPrice: alert.targetPrice,
          targetType: alert.targetType,
          event: alert.targetType === 'RSI_BEARISH_DIVERGENCE' ? 'STOP_LOSS_HIT' : 'PIVOT_CROSSED',
          triggered: true,
        });

        return {
          ...alert,
          currentPrice: matchingStock.currentPrice,
          status: 'TRIGGERED' as const,
          triggeredAt: new Date().toLocaleTimeString(),
          notes: `${div.shortLabel}: ${div.description}`,
        };
      }
      return alert;
    });

    if (hasUpdates) {
      setAlerts(updatedAlerts);
      saveStoredAlerts(updatedAlerts);
      window.dispatchEvent(new CustomEvent('minervini_alerts_updated'));
    }
  }, [stocks, alerts, soundEnabled, rsiTimeframe, rsiDivergenceAlertsEnabled]);

  // Quick-Add Bearish RSI Divergence Alert (Reversal / Top Warning)
  const handleAddBearishRsiAlert = (stock: MinerviniTradeSetup) => {
    const existing = alerts.find(
      (a) => a.ticker === stock.ticker && a.targetType === 'RSI_BEARISH_DIVERGENCE' && a.status === 'ACTIVE'
    );
    if (existing) return;

    const newAlert: PriceAlert = {
      id: `alert-${stock.ticker}-rsi-bear-${Date.now()}`,
      ticker: stock.ticker,
      stockName: stock.name,
      targetType: 'RSI_BEARISH_DIVERGENCE',
      targetPrice: stock.currentPrice,
      triggerProximityPercent: 1.0,
      currentPrice: stock.currentPrice,
      status: 'ACTIVE',
      createdAt: new Date().toLocaleDateString(),
      exchange: stock.exchange,
      divergenceType: 'BEARISH_DISTRIBUTION',
      notes: `⚠️ RSI Bearish Divergence Alert: Notifies when price makes higher high but 14-RSI weakens (Exhaustion / Reversal)`,
    };

    const updated = [newAlert, ...alerts];
    setAlerts(updated);
    saveStoredAlerts(updated);
    window.dispatchEvent(new CustomEvent('minervini_alerts_updated'));
  };

  // Quick-Add Bullish RSI Divergence Alert (Reversal / Bottom Accumulation)
  const handleAddBullishRsiAlert = (stock: MinerviniTradeSetup) => {
    const existing = alerts.find(
      (a) => a.ticker === stock.ticker && a.targetType === 'RSI_BULLISH_DIVERGENCE' && a.status === 'ACTIVE'
    );
    if (existing) return;

    const newAlert: PriceAlert = {
      id: `alert-${stock.ticker}-rsi-bull-${Date.now()}`,
      ticker: stock.ticker,
      stockName: stock.name,
      targetType: 'RSI_BULLISH_DIVERGENCE',
      targetPrice: stock.currentPrice,
      triggerProximityPercent: 1.0,
      currentPrice: stock.currentPrice,
      status: 'ACTIVE',
      createdAt: new Date().toLocaleDateString(),
      exchange: stock.exchange,
      divergenceType: 'BULLISH_ACCUMULATION',
      notes: `⚡ RSI Bullish Divergence Alert: Notifies when price makes lower low but 14-RSI forms higher low (Selling Dry-Up / Reversal)`,
    };

    const updated = [newAlert, ...alerts];
    setAlerts(updated);
    saveStoredAlerts(updated);
    window.dispatchEvent(new CustomEvent('minervini_alerts_updated'));
  };

  // Instant Simulated RSI Divergence Notification Trigger
  const triggerSimulatedRsiDivergenceAlert = (type: 'BEARISH' | 'BULLISH', targetStock?: MinerviniTradeSetup) => {
    const stock = targetStock || selectedStock || stocks[0];
    const simulatedDiv = simulateRsiDivergence(stock, type);

    const stored = getStoredAlerts();
    const targetType = type === 'BEARISH' ? 'RSI_BEARISH_DIVERGENCE' : 'RSI_BULLISH_DIVERGENCE';
    let targetAlert = stored.find((a) => a.ticker === stock.ticker && a.targetType === targetType);

    if (!targetAlert) {
      targetAlert = {
        id: `alert-${stock.ticker}-sim-rsi-${Date.now()}`,
        ticker: stock.ticker,
        stockName: stock.name,
        targetType,
        targetPrice: stock.currentPrice,
        triggerProximityPercent: 1.0,
        currentPrice: stock.currentPrice,
        status: 'ACTIVE',
        createdAt: new Date().toLocaleDateString(),
        exchange: stock.exchange,
        notes: simulatedDiv.title,
      };
      stored.unshift(targetAlert);
    }

    const updatedAlerts = stored.map((a) => {
      if (a.id === targetAlert!.id) {
        return {
          ...a,
          status: 'TRIGGERED' as const,
          triggeredAt: new Date().toLocaleTimeString(),
          notes: `${simulatedDiv.title}: ${simulatedDiv.description}`,
        };
      }
      return a;
    });

    saveStoredAlerts(updatedAlerts);
    setAlerts(updatedAlerts);

    appendTrackerLog({
      ticker: stock.ticker,
      exchange: stock.exchange,
      previousPrice: stock.currentPrice,
      currentPrice: stock.currentPrice,
      targetPrice: stock.currentPrice,
      targetType,
      event: type === 'BEARISH' ? 'STOP_LOSS_HIT' : 'PIVOT_CROSSED',
      triggered: true,
    });

    logAlertTrigger({
      ticker: stock.ticker,
      exchange: stock.exchange,
      triggeredPrice: stock.currentPrice,
      targetPrice: stock.currentPrice,
      alertType: targetType,
      eventTypeLabel: type === 'BEARISH' ? 'RSI Bearish Divergence Warning' : 'RSI Bullish Divergence Alert',
      notes: simulatedDiv.description,
    });

    playAlertChime();

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`${type === 'BEARISH' ? '⚠️ Bearish' : '⚡ Bullish'} RSI Divergence: ${stock.ticker}`, {
        body: `${simulatedDiv.description} Playbook: ${simulatedDiv.sepaPlaybook}`,
        icon: '/favicon.ico',
      });
    }

    dispatchRsiDivergenceNotification(stock, simulatedDiv);
    window.dispatchEvent(new CustomEvent('minervini_alerts_updated'));
  };

  // Request browser Notification permissions
  const handleRequestPermission = async () => {
    if ('Notification' in window) {
      const perm = await Notification.requestPermission();
      setNotifPermission(perm);
      if (perm === 'granted') {
        playAlertChime();
        new Notification('Minervini SEPA Price Alerts Active', {
          body: 'Browser alerts enabled! You will receive real-time notifications when prices approach or cross pivot entry levels.',
          icon: '/favicon.ico',
        });
      }
    }
  };

  // Instant Breakout Crossover Simulator (updates LocalStorage to trigger Toast across all tabs)
  const triggerSimulatedBreakout = () => {
    const stock = selectedStock || stocks[0];
    const stored = getStoredAlerts();
    
    // Check if alert exists or create one
    let targetAlert = stored.find((a) => a.ticker === stock.ticker && a.targetType === 'PIVOT_ENTRY');
    
    if (!targetAlert) {
      targetAlert = {
        id: `alert-${stock.ticker}-pivot-${Date.now()}`,
        ticker: stock.ticker,
        stockName: stock.name,
        targetType: 'PIVOT_ENTRY',
        targetPrice: stock.pivotPrice,
        triggerProximityPercent: 1.5,
        currentPrice: stock.pivotPrice - 1.20,
        status: 'ACTIVE',
        createdAt: new Date().toLocaleDateString(),
        exchange: stock.exchange,
        notes: `Simulated Breakout Test Target @ ${stock.pivotPrice}`,
      };
      stored.unshift(targetAlert);
    }

    const crossedPrice = Number((stock.pivotPrice + 0.85).toFixed(2));
    const previousPrice = Number((stock.pivotPrice - 0.55).toFixed(2));

    const updatedAlerts = stored.map((a) => {
      if (a.id === targetAlert!.id) {
        return {
          ...a,
          currentPrice: crossedPrice,
          status: 'TRIGGERED' as const,
          triggeredAt: new Date().toLocaleTimeString(),
        };
      }
      return a;
    });

    saveStoredAlerts(updatedAlerts);
    appendTrackerLog({
      ticker: stock.ticker,
      exchange: stock.exchange,
      previousPrice,
      currentPrice: crossedPrice,
      targetPrice: stock.pivotPrice,
      targetType: 'PIVOT_ENTRY',
      event: 'PIVOT_CROSSED',
      triggered: true,
    });

    playAlertChime();
    window.dispatchEvent(new CustomEvent('minervini_alerts_updated'));
  };

  // Quick-Add Pivot Entry Alert for Selected Stock
  const handleAddPivotAlert = (stock: MinerviniTradeSetup) => {
    const existing = alerts.find(
      (a) => a.ticker === stock.ticker && a.targetType === 'PIVOT_ENTRY' && a.status === 'ACTIVE'
    );
    if (existing) return;

    const newAlert: PriceAlert = {
      id: `alert-${stock.ticker}-pivot-${Date.now()}`,
      ticker: stock.ticker,
      stockName: stock.name,
      targetType: 'PIVOT_ENTRY',
      targetPrice: stock.pivotPrice,
      triggerProximityPercent: 1.5,
      currentPrice: stock.currentPrice,
      status: 'ACTIVE',
      createdAt: new Date().toLocaleDateString(),
      exchange: stock.exchange,
      notes: `Auto Pivot Entry Alert @ ${getCurrencySymbol(stock.exchange)}${stock.pivotPrice}`,
    };

    const updated = [newAlert, ...alerts];
    setAlerts(updated);
    saveStoredAlerts(updated);
  };

  // Instant Volatility Dry-Up Alert Simulator
  const triggerSimulatedVolatilityAlert = () => {
    const stock = selectedStock || stocks[0];
    const stored = getStoredAlerts();

    let targetAlert = stored.find((a) => a.ticker === stock.ticker && a.targetType === 'VOLATILITY_DRYUP');

    if (!targetAlert) {
      targetAlert = {
        id: `alert-${stock.ticker}-volatility-${Date.now()}`,
        ticker: stock.ticker,
        stockName: stock.name,
        targetType: 'VOLATILITY_DRYUP',
        targetPrice: stock.pivotPrice,
        triggerProximityPercent: 1.5,
        currentPrice: stock.currentPrice,
        status: 'ACTIVE',
        createdAt: new Date().toLocaleDateString(),
        exchange: stock.exchange,
        volatilityTightnessTargetPct: 5.0,
        volatilityVolumeDryUpTargetPct: -50.0,
        notes: `Simulated VCP Volatility Dry-Up Primed Alert`,
      };
      stored.unshift(targetAlert);
    }

    const updatedAlerts = stored.map((a) => {
      if (a.id === targetAlert!.id) {
        return {
          ...a,
          status: 'TRIGGERED' as const,
          triggeredAt: new Date().toLocaleTimeString(),
        };
      }
      return a;
    });

    saveStoredAlerts(updatedAlerts);
    appendTrackerLog({
      ticker: stock.ticker,
      exchange: stock.exchange,
      previousPrice: stock.currentPrice,
      currentPrice: stock.currentPrice,
      targetPrice: stock.pivotPrice,
      targetType: 'VOLATILITY_DRYUP',
      event: 'VOLATILITY_DRYUP_PRIMED',
      triggered: true,
    });

    playAlertChime();

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`⚡ VCP Volatility Alert Primed: ${stock.ticker}`, {
        body: `${stock.ticker} (${stock.exchange}) entered tight VCP Volatility Dry-Up phase! 3-Week Range Tightness: 3.8%, Volume Dry-Up: ${stock.volumeDryUpPercent}%. Setup Primed for Breakout!`,
        icon: '/favicon.ico',
      });
    }

    window.dispatchEvent(new CustomEvent('minervini_alerts_updated'));
  };

  // Quick-Add 3:1 RRR Alert for Selected Stock
  const handleAddRRRAlert = (stock: MinerviniTradeSetup, targetRatio: number = 3.0) => {
    const existing = alerts.find(
      (a) => a.ticker === stock.ticker && a.targetType === 'RISK_REWARD_RATIO' && a.status === 'ACTIVE'
    );
    if (existing) return;

    const riskPerShare = stock.pivotPrice - stock.stopLossPrice;
    const rrrTargetPrice = Number((stock.pivotPrice + (riskPerShare * targetRatio)).toFixed(2));

    const newAlert: PriceAlert = {
      id: `alert-${stock.ticker}-rrr-${Date.now()}`,
      ticker: stock.ticker,
      stockName: stock.name,
      targetType: 'RISK_REWARD_RATIO',
      targetPrice: rrrTargetPrice,
      triggerProximityPercent: 1.5,
      currentPrice: stock.currentPrice,
      status: 'ACTIVE',
      createdAt: new Date().toLocaleDateString(),
      exchange: stock.exchange,
      targetRRRatio: targetRatio,
      notes: `🎯 Risk-to-Reward Milestone Alert: Trigger when stock reaches ${targetRatio}:1 RRR @ ${getCurrencySymbol(stock.exchange)}${rrrTargetPrice}`,
    };

    const updated = [newAlert, ...alerts];
    setAlerts(updated);
    saveStoredAlerts(updated);
  };

  // Instant Simulated 3:1 RRR Milestone Trigger
  const triggerSimulatedRRRAlert = () => {
    const stock = selectedStock || stocks[0];
    const stored = getStoredAlerts();

    let targetAlert = stored.find((a) => a.ticker === stock.ticker && a.targetType === 'RISK_REWARD_RATIO');

    if (!targetAlert) {
      const riskPerShare = stock.pivotPrice - stock.stopLossPrice;
      const rrrTargetPrice = Number((stock.pivotPrice + (riskPerShare * 3.0)).toFixed(2));
      targetAlert = {
        id: `alert-${stock.ticker}-rrr-${Date.now()}`,
        ticker: stock.ticker,
        stockName: stock.name,
        targetType: 'RISK_REWARD_RATIO',
        targetPrice: rrrTargetPrice,
        triggerProximityPercent: 1.5,
        currentPrice: stock.currentPrice,
        status: 'ACTIVE',
        createdAt: new Date().toLocaleDateString(),
        exchange: stock.exchange,
        targetRRRatio: 3.0,
        notes: `Simulated 3:1 RRR Milestone Reached @ ${rrrTargetPrice}`,
      };
      stored.unshift(targetAlert);
    }

    const updatedAlerts = stored.map((a) => {
      if (a.id === targetAlert!.id) {
        return {
          ...a,
          status: 'TRIGGERED' as const,
          triggeredAt: new Date().toLocaleTimeString(),
        };
      }
      return a;
    });

    saveStoredAlerts(updatedAlerts);
    appendTrackerLog({
      ticker: stock.ticker,
      exchange: stock.exchange,
      previousPrice: stock.currentPrice,
      currentPrice: targetAlert.targetPrice,
      targetPrice: targetAlert.targetPrice,
      targetType: 'RISK_REWARD_RATIO',
      event: 'PIVOT_CROSSED',
      triggered: true,
    });

    playAlertChime();

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`🎯 3:1 Risk-to-Reward Milestone Achieved: ${stock.ticker}`, {
        body: `${stock.ticker} (${stock.exchange}) reached its 3:1 SEPA Risk-to-Reward target price of ${getCurrencySymbol(stock.exchange)}${targetAlert.targetPrice}! Scale out 50% profits & raise stop to breakeven!`,
        icon: '/favicon.ico',
      });
    }

    window.dispatchEvent(new CustomEvent('minervini_alerts_updated'));
  };

  // Quick-Add Volatility Alert for Stock
  const handleAddVolatilityAlert = (stock: MinerviniTradeSetup) => {
    const existing = alerts.find(
      (a) => a.ticker === stock.ticker && a.targetType === 'VOLATILITY_DRYUP' && a.status === 'ACTIVE'
    );
    if (existing) return;

    const newAlert: PriceAlert = {
      id: `alert-${stock.ticker}-volatility-${Date.now()}`,
      ticker: stock.ticker,
      stockName: stock.name,
      targetType: 'VOLATILITY_DRYUP',
      targetPrice: stock.pivotPrice,
      triggerProximityPercent: 1.5,
      currentPrice: stock.currentPrice,
      status: 'ACTIVE',
      createdAt: new Date().toLocaleDateString(),
      exchange: stock.exchange,
      volatilityTightnessTargetPct: 5.0,
      volatilityVolumeDryUpTargetPct: -50.0,
      notes: `⚡ VCP Volatility Radar: Range tightening ≤ 5% with Volume Dry-Up ≤ -50%`,
    };

    const updated = [newAlert, ...alerts];
    setAlerts(updated);
    saveStoredAlerts(updated);
  };

  // Quick-Add Stop Loss Alert for Selected Stock
  const handleAddStopLossAlert = (stock: MinerviniTradeSetup) => {
    const existing = alerts.find(
      (a) => a.ticker === stock.ticker && a.targetType === 'STOP_LOSS' && a.status === 'ACTIVE'
    );
    if (existing) return;

    const newAlert: PriceAlert = {
      id: `alert-${stock.ticker}-stop-${Date.now()}`,
      ticker: stock.ticker,
      stockName: stock.name,
      targetType: 'STOP_LOSS',
      targetPrice: stock.stopLossPrice,
      triggerProximityPercent: 1.0,
      currentPrice: stock.currentPrice,
      status: 'ACTIVE',
      createdAt: new Date().toLocaleDateString(),
      exchange: stock.exchange,
      notes: `Hard Risk Stop Loss Alert @ ${getCurrencySymbol(stock.exchange)}${stock.stopLossPrice}`,
    };

    const updated = [newAlert, ...alerts];
    setAlerts(updated);
    saveStoredAlerts(updated);
  };

  // Add Custom Alert
  const handleCreateCustomAlert = (e: React.FormEvent) => {
    e.preventDefault();
    const stock = selectedStock || stocks[0];
    const targetPriceNum = parseFloat(customPrice) || stock.pivotPrice;

    const newAlert: PriceAlert = {
      id: `alert-${stock.ticker}-custom-${Date.now()}`,
      ticker: stock.ticker,
      stockName: stock.name,
      targetType: customTargetType,
      targetPrice: targetPriceNum,
      triggerProximityPercent: customProximity,
      currentPrice: stock.currentPrice,
      status: 'ACTIVE',
      createdAt: new Date().toLocaleDateString(),
      exchange: stock.exchange,
      notes: customNotes || `Custom ${customTargetType.replace('_', ' ')} alert`,
    };

    const updated = [newAlert, ...alerts];
    setAlerts(updated);
    saveStoredAlerts(updated);
    setCustomPrice('');
    setCustomNotes('');
  };

  // Delete Alert
  const handleDeleteAlert = (id: string) => {
    const updated = alerts.filter((a) => a.id !== id);
    setAlerts(updated);
    saveStoredAlerts(updated);
  };

  // Reset Triggered Alert back to Active
  const handleResetAlert = (id: string) => {
    const updated = alerts.map((a) =>
      a.id === id ? { ...a, status: 'ACTIVE' as const, triggeredAt: undefined } : a
    );
    setAlerts(updated);
    saveStoredAlerts(updated);
    window.dispatchEvent(new CustomEvent('minervini_alerts_updated'));
  };

  // Filtered alerts
  const filteredAlerts = alerts.filter((a) => {
    if (filterStatus === 'ACTIVE') return a.status === 'ACTIVE';
    if (filterStatus === 'TRIGGERED') return a.status === 'TRIGGERED';
    return true;
  });

  const activeCount = alerts.filter((a) => a.status === 'ACTIVE').length;
  const triggeredCount = alerts.filter((a) => a.status === 'TRIGGERED').length;

  return (
    <div className="bg-white border border-[#e5e4e1] p-6 shadow-xs space-y-6">
      
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e5e4e1] pb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-[#1a1a1a] text-white flex items-center justify-center font-bold">
            <BellRing className="w-5 h-5 text-amber-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#b5a68d]">
                Minervini Execution Engine
              </span>
              <span className="bg-black text-white text-[9px] uppercase tracking-[0.15em] px-2 py-0.5 font-bold flex items-center space-x-1">
                <HardDrive className="w-3 h-3 text-emerald-400" />
                <span>LocalStorage Background Tracker</span>
              </span>
            </div>
            <h3 className="text-xl font-serif font-black text-[#1a1a1a] tracking-tight leading-none mt-1">
              Pivot Entry & Risk Stop Loss Monitor
            </h3>
          </div>
        </div>

        {/* Browser Web Notification Permission, RSI Divergence Global Toggle & Sound Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* RSI Divergence Global Alert Toggle Switch */}
          <button
            onClick={handleToggleRsiDivergenceAlerts}
            title={
              rsiDivergenceAlertsEnabled
                ? 'RSI Divergence alerts active. Click to mute / silence notifications.'
                : 'RSI Divergence alerts muted. Click to enable notifications.'
            }
            className={`flex items-center space-x-2 px-3 py-1.5 text-xs font-bold transition-all border shadow-xs cursor-pointer ${
              rsiDivergenceAlertsEnabled
                ? 'bg-purple-950 text-purple-200 border-purple-700 hover:bg-purple-900'
                : 'bg-gray-100 text-gray-500 border-gray-300 hover:bg-gray-200'
            }`}
          >
            <div className="relative inline-flex items-center">
              <span
                className={`w-7 h-4 flex items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out ${
                  rsiDivergenceAlertsEnabled ? 'bg-purple-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`bg-white w-3 h-3 rounded-full shadow-xs transform transition-transform duration-200 ease-in-out ${
                    rsiDivergenceAlertsEnabled ? 'translate-x-3' : 'translate-x-0'
                  }`}
                />
              </span>
            </div>
            <span className="flex items-center space-x-1">
              <Zap className={`w-3.5 h-3.5 ${rsiDivergenceAlertsEnabled ? 'text-amber-400' : 'text-gray-400'}`} />
              <span>RSI Alerts:</span>
              <span className={`uppercase font-black ${rsiDivergenceAlertsEnabled ? 'text-purple-300' : 'text-gray-500'}`}>
                {rsiDivergenceAlertsEnabled ? 'Active' : 'Muted'}
              </span>
            </span>
          </button>

          {notifPermission === 'granted' ? (
            <div className="flex items-center space-x-2 bg-emerald-50 border border-emerald-300 text-emerald-900 px-3 py-1.5 text-xs font-mono font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
              <span>Web Notifications Active</span>
            </div>
          ) : (
            <button
              onClick={handleRequestPermission}
              className="bg-[#1a1a1a] hover:bg-black text-white font-bold px-4 py-2 text-xs uppercase tracking-wider flex items-center space-x-2 transition-all border border-black shadow-xs"
            >
              <Bell className="w-4 h-4 text-amber-400" />
              <span>Enable Web Notifications</span>
            </button>
          )}

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'Mute Alert Sound' : 'Enable Alert Sound'}
            className="p-2 border border-[#e5e4e1] hover:bg-gray-100 text-[#1a1a1a] transition-colors"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-700" /> : <VolumeX className="w-4 h-4 text-gray-400" />}
          </button>

          {/* Quick Chart Link */}
          <a
            href={getChartLinkUrl(selectedStock ? selectedStock.ticker : 'RELIANCE')}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-blue-700 hover:bg-blue-600 text-white font-bold px-3 py-2 text-xs flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer"
            title={`Open Live ChartLink for ${selectedStock ? selectedStock.ticker : 'RELIANCE'}`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-white" />
            <span>ChartLink ({selectedStock ? selectedStock.ticker : 'Live'})</span>
            <ExternalLink className="w-3 h-3 text-blue-200" />
          </a>
        </div>
      </div>

      {/* 52-Week High RSI Exhaustion Divergence Sentinel Notification */}
      <RsiDivergenceNotification
        stocks={stocks}
        selectedStock={selectedStock}
        onSelectStock={onSelectStock}
        soundEnabled={soundEnabled}
        notificationsEnabled={rsiDivergenceAlertsEnabled}
        onToggleNotifications={handleToggleRsiDivergenceAlerts}
        onArmAlert={(ticker, targetType, price, notes) => {
          const targetStock = stocks.find((s) => s.ticker === ticker) || selectedStock;
          if (!targetStock) return;
          const newAlert: PriceAlert = {
            id: `alert-${ticker}-52w-rsi-${Date.now()}`,
            ticker,
            stockName: targetStock.name,
            targetType: 'RSI_BEARISH_DIVERGENCE',
            targetPrice: price,
            triggerProximityPercent: 1.5,
            currentPrice: targetStock.currentPrice,
            status: 'ACTIVE',
            createdAt: new Date().toLocaleDateString(),
            exchange: targetStock.exchange,
            notes,
          };
          const updated = [newAlert, ...alerts];
          setAlerts(updated);
          saveStoredAlerts(updated);
          window.dispatchEvent(new CustomEvent('minervini_alerts_updated'));
        }}
      />

      {/* Selected Stock Quick-Setup Card & Real-time Breakout Simulator */}
      {selectedStock && (
        <div className="bg-[#f9f8f5] border border-[#e5e4e1] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e4e1] pb-3">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-[#b5a68d] font-bold">
                Quick Setup for Selected Candidate
              </span>
              <h4 className="text-lg font-serif font-black text-[#1a1a1a]">
                {selectedStock.ticker} — {selectedStock.name}
              </h4>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Quick Volatility Alert Button */}
              <button
                onClick={() => handleAddVolatilityAlert(selectedStock)}
                className="bg-purple-800 hover:bg-purple-900 text-white font-bold px-3.5 py-1.5 text-xs uppercase tracking-wider flex items-center space-x-1.5 transition-all shadow-xs"
              >
                <Activity className="w-3.5 h-3.5 text-amber-300" />
                <span>Add Volatility Alert (Range ≤ 5%)</span>
              </button>

              {/* Quick Pivot Entry Button */}
              <button
                onClick={() => handleAddPivotAlert(selectedStock)}
                className="bg-emerald-800 hover:bg-emerald-900 text-white font-bold px-3.5 py-1.5 text-xs uppercase tracking-wider flex items-center space-x-1.5 transition-all shadow-xs"
              >
                <Target className="w-3.5 h-3.5" />
                <span>Add Pivot Alert ({getCurrencySymbol(selectedStock.exchange)}{selectedStock.pivotPrice})</span>
              </button>

              {/* Quick Stop Loss Button */}
              <button
                onClick={() => handleAddStopLossAlert(selectedStock)}
                className="bg-rose-800 hover:bg-rose-900 text-white font-bold px-3.5 py-1.5 text-xs uppercase tracking-wider flex items-center space-x-1.5 transition-all shadow-xs"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Add Stop Alert ({getCurrencySymbol(selectedStock.exchange)}{selectedStock.stopLossPrice})</span>
              </button>

              {/* Quick 3:1 RRR Target Alert Button */}
              <button
                onClick={() => handleAddRRRAlert(selectedStock, 3.0)}
                className="bg-amber-700 hover:bg-amber-800 text-white font-bold px-3.5 py-1.5 text-xs uppercase tracking-wider flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer"
              >
                <TrendingUp className="w-3.5 h-3.5 text-amber-200" />
                <span>Add 3:1 RRR Alert</span>
              </button>

              {/* Quick Bearish RSI Divergence Alert */}
              <button
                onClick={() => handleAddBearishRsiAlert(selectedStock)}
                className="bg-rose-900 hover:bg-rose-950 text-rose-200 border border-rose-700 font-bold px-3.5 py-1.5 text-xs uppercase tracking-wider flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer"
                title="Alert when price makes a higher high but RSI diverges downward (Trend Exhaustion / Top Warning)"
              >
                <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                <span>Add Bearish RSI Div Alert</span>
              </button>

              {/* Quick Bullish RSI Divergence Alert */}
              <button
                onClick={() => handleAddBullishRsiAlert(selectedStock)}
                className="bg-cyan-900 hover:bg-cyan-950 text-cyan-200 border border-cyan-700 font-bold px-3.5 py-1.5 text-xs uppercase tracking-wider flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer"
                title="Alert when price makes a lower low but RSI diverges upward (Selling Exhaustion / Bottom Accumulation)"
              >
                <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                <span>Add Bullish RSI Div Alert</span>
              </button>
            </div>
          </div>

          {/* Real-time LocalStorage Breakout & Volatility Test Simulator Panel */}
          <div className="bg-white border border-[#e5e4e1] p-4 flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
            <div className="flex items-center space-x-3">
              <Zap className="w-5 h-5 text-amber-500" />
              <div>
                <span className="font-bold text-[#1a1a1a] block">Real-Time Browser Notification Simulators</span>
                <span className="text-gray-500 text-[11px] font-sans">
                  Test browser notification API and alert chime when {selectedStock.ticker} enters a tight Volatility Dry-Up phase, forms RSI divergence trend reversal, or crosses pivot level.
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={triggerSimulatedVolatilityAlert}
                className="bg-purple-900 hover:bg-purple-950 text-amber-300 font-bold px-3 py-2 text-xs uppercase tracking-wider flex items-center space-x-1.5 transition-all border border-purple-800 shadow-xs cursor-pointer"
              >
                <Activity className="w-3.5 h-3.5 text-amber-300" />
                <span>Test Volatility</span>
              </button>

              <button
                onClick={triggerSimulatedRRRAlert}
                className="bg-amber-800 hover:bg-amber-900 text-white font-bold px-3 py-2 text-xs uppercase tracking-wider flex items-center space-x-1.5 transition-all border border-amber-900 shadow-xs cursor-pointer"
              >
                <TrendingUp className="w-3.5 h-3.5 text-amber-300" />
                <span>Test 3:1 RRR</span>
              </button>

              <button
                onClick={() => triggerSimulatedRsiDivergenceAlert('BEARISH')}
                className="bg-rose-950 hover:bg-black text-rose-300 font-bold px-3 py-2 text-xs uppercase tracking-wider flex items-center space-x-1.5 transition-all border border-rose-800 shadow-xs cursor-pointer"
                title="Simulate Bearish RSI Divergence: Price higher high, RSI lower high (Trend Exhaustion)"
              >
                <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                <span>Test Bearish Div</span>
              </button>

              <button
                onClick={() => triggerSimulatedRsiDivergenceAlert('BULLISH')}
                className="bg-cyan-950 hover:bg-black text-cyan-300 font-bold px-3 py-2 text-xs uppercase tracking-wider flex items-center space-x-1.5 transition-all border border-cyan-800 shadow-xs cursor-pointer"
                title="Simulate Bullish RSI Divergence: Price lower low, RSI higher low (Bottom Reversal)"
              >
                <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                <span>Test Bullish Div</span>
              </button>

              <button
                onClick={triggerSimulatedBreakout}
                className="bg-[#1a1a1a] hover:bg-black text-amber-400 font-bold px-3 py-2 text-xs uppercase tracking-wider flex items-center space-x-1.5 transition-all border border-black shadow-xs cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 text-amber-400" />
                <span>Test Pivot Entry</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VCP Volatility Dry-Up Alert Radar Banner */}
      <div className="bg-[#150d2a] border border-purple-800 p-5 text-white space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-purple-800/60 pb-3">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-purple-950 border border-purple-500/50 flex items-center justify-center text-amber-300 font-bold">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] uppercase font-mono tracking-[0.2em] font-bold text-amber-400">
                  VCP Volatility Dry-Up Radar
                </span>
                <span className="bg-purple-950 border border-purple-600/60 text-purple-200 text-[9px] px-2 py-0.5 font-bold uppercase font-mono">
                  3-Week Contraction Engine
                </span>
              </div>
              <h4 className="text-base font-serif font-black text-white mt-0.5">
                Tightening Price Range & Volume Dry-Up Monitor
              </h4>
            </div>
          </div>

          <div className="text-xs font-mono text-purple-200">
            <span>Automated alert triggers when price range contracts <strong className="text-amber-300">≤ 5.0%</strong> over 3 weeks</span>
          </div>
        </div>

        {/* Live Stocks Volatility Dry-Up Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
          {stocks.slice(0, 4).map((st, idx) => {
            const lastContraction = st.contractions[st.contractions.length - 1];
            const tightness = Math.abs(lastContraction?.percentContraction || 4.2);
            const isPrimed = tightness <= 5.0 && st.volumeDryUpPercent <= -40;
            const hasAlert = alerts.some((a) => a.ticker === st.ticker && a.targetType === 'VOLATILITY_DRYUP' && a.status === 'ACTIVE');

            return (
              <div key={st.id || `vcp-stock-${st.ticker}-${idx}`} className="bg-[#0e081f] border border-purple-900/80 p-3.5 space-y-2 relative group hover:border-purple-500 transition-all">
                <div className="flex items-center justify-between border-b border-purple-900/60 pb-2">
                  <span className="font-black text-sm text-white">{st.ticker}</span>
                  <span className={`px-2 py-0.5 text-[9px] font-bold uppercase border ${
                    isPrimed
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                      : 'bg-purple-950 text-purple-300 border-purple-800'
                  }`}>
                    {isPrimed ? '🔥 PRIMED & READY' : '⏳ TIGHTENING'}
                  </span>
                </div>

                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-purple-300/80">3-Wk Range Tightness:</span>
                    <strong className="text-amber-300">{tightness.toFixed(1)}%</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-purple-300/80">Volume Dry-Up:</span>
                    <strong className="text-emerald-400">{st.volumeDryUpPercent}%</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-purple-300/80">SEPA Score:</span>
                    <strong className="text-white">{st.trendScore}/8</strong>
                  </div>
                </div>

                <button
                  onClick={() => handleAddVolatilityAlert(st)}
                  disabled={hasAlert}
                  className={`w-full py-1.5 text-[10px] font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                    hasAlert
                      ? 'bg-purple-950 text-purple-400 border-purple-900 cursor-default'
                      : 'bg-amber-400 hover:bg-amber-300 text-black border-amber-500 font-extrabold'
                  }`}
                >
                  {hasAlert ? '✓ Volatility Alert Active' : 'Set Volatility Alert'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main View Mode Selector: Active Alerts vs RSI Divergence Radar vs Audit Logs vs Recent Alert History */}
      <div className="flex items-center justify-between border-b border-[#e5e4e1] pb-2 font-mono text-xs">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveSubTab('ALERTS')}
            className={`px-4 py-2 font-bold uppercase tracking-wider transition-all border ${
              activeSubTab === 'ALERTS'
                ? 'bg-[#1a1a1a] text-white border-black'
                : 'bg-white text-gray-600 border-[#e5e4e1] hover:text-black'
            }`}
          >
            Monitored Alerts ({alerts.length})
          </button>
          <button
            onClick={() => setActiveSubTab('RSI_DIVERGENCE_RADAR')}
            className={`px-4 py-2 font-bold uppercase tracking-wider flex items-center space-x-1.5 transition-all border cursor-pointer ${
              activeSubTab === 'RSI_DIVERGENCE_RADAR'
                ? 'bg-[#1a1a1a] text-cyan-300 border-black shadow-xs ring-1 ring-cyan-500/40'
                : 'bg-white text-gray-600 border-[#e5e4e1] hover:text-black'
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-cyan-500" />
            <span>RSI Divergence Radar ({divergenceScanList.filter((d) => d.hasDivergence).length} Active)</span>
          </button>
          <button
            onClick={() => setActiveSubTab('PRICE_HISTORY')}
            className={`px-4 py-2 font-bold uppercase tracking-wider flex items-center space-x-1.5 transition-all border ${
              activeSubTab === 'PRICE_HISTORY'
                ? 'bg-[#1a1a1a] text-white border-black'
                : 'bg-white text-gray-600 border-[#e5e4e1] hover:text-black'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-amber-400" />
            <span>Recent Price Alert History ({selectedStock?.ticker || stocks[0]?.ticker})</span>
          </button>
          <button
            onClick={() => setActiveSubTab('AUDIT_LOGS')}
            className={`px-4 py-2 font-bold uppercase tracking-wider flex items-center space-x-1.5 transition-all border ${
              activeSubTab === 'AUDIT_LOGS'
                ? 'bg-[#1a1a1a] text-white border-black'
                : 'bg-white text-gray-600 border-[#e5e4e1] hover:text-black'
            }`}
          >
            <History className="w-3.5 h-3.5 text-gray-400" />
            <span>Background Tracker Logs ({logs.length})</span>
          </button>
        </div>

        <div className="flex items-center space-x-2 text-[11px] text-gray-500 font-sans">
          <Activity className="w-3.5 h-3.5 text-emerald-600" />
          <span>Polling interval: <strong>3.5s</strong> via LocalStorage</span>
        </div>
      </div>

      {activeSubTab === 'RSI_DIVERGENCE_RADAR' ? (
        /* RSI DIVERGENCE DETECTION & REVERSAL RADAR PANEL */
        <div className="space-y-5 font-mono text-xs">
          {/* Top Control Ribbon */}
          <div className="bg-[#0b1329] border border-cyan-800 p-5 text-white space-y-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-800/60 pb-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-cyan-950 border border-cyan-500 flex items-center justify-center text-cyan-300 font-bold">
                  <Compass className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] uppercase font-mono tracking-[0.2em] font-bold text-amber-400">
                      Minervini SEPA Sentinel
                    </span>
                    <span className="bg-cyan-950 border border-cyan-600 text-cyan-200 text-[9px] px-2 py-0.5 font-bold uppercase">
                      Trend Reversal &amp; Exhaustion Radar
                    </span>
                  </div>
                  <h4 className="text-base font-serif font-black text-white mt-0.5">
                    RSI Divergence Detection &amp; Price Reversal Sentinel
                  </h4>
                </div>
              </div>

              {/* Timeframe & Controls */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Global Toggle Switch inside Radar Tab */}
                <button
                  onClick={handleToggleRsiDivergenceAlerts}
                  title={
                    rsiDivergenceAlertsEnabled
                      ? 'Click to disable RSI Divergence background notifications'
                      : 'Click to enable RSI Divergence background notifications'
                  }
                  className={`flex items-center space-x-2 px-3 py-1 text-[11px] font-bold border transition cursor-pointer ${
                    rsiDivergenceAlertsEnabled
                      ? 'bg-purple-900/60 border-purple-500 text-purple-200 hover:bg-purple-900'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  <span
                    className={`w-6 h-3.5 flex items-center rounded-full p-0.5 transition-colors ${
                      rsiDivergenceAlertsEnabled ? 'bg-purple-500' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`bg-white w-2.5 h-2.5 rounded-full transform transition-transform ${
                        rsiDivergenceAlertsEnabled ? 'translate-x-2.5' : 'translate-x-0'
                      }`}
                    />
                  </span>
                  <span>Surveillance:</span>
                  <span className={`font-black uppercase ${rsiDivergenceAlertsEnabled ? 'text-purple-300' : 'text-slate-400'}`}>
                    {rsiDivergenceAlertsEnabled ? 'ON' : 'OFF'}
                  </span>
                </button>

                <div className="flex items-center space-x-1 bg-cyan-950 border border-cyan-800 p-0.5 text-[10px]">
                  <button
                    onClick={() => setRsiTimeframe('DAILY')}
                    className={`px-2.5 py-1 font-bold uppercase transition cursor-pointer ${
                      rsiTimeframe === 'DAILY' ? 'bg-cyan-500 text-black font-black' : 'text-cyan-300 hover:text-white'
                    }`}
                  >
                    Daily
                  </button>
                  <button
                    onClick={() => setRsiTimeframe('WEEKLY')}
                    className={`px-2.5 py-1 font-bold uppercase transition cursor-pointer ${
                      rsiTimeframe === 'WEEKLY' ? 'bg-cyan-500 text-black font-black' : 'text-cyan-300 hover:text-white'
                    }`}
                  >
                    Weekly
                  </button>
                </div>
              </div>
            </div>

            {/* KPI Cards Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="bg-[#070d1e] border border-cyan-900/80 p-3">
                <span className="text-[10px] text-cyan-300 block uppercase">Total Scanned</span>
                <strong className="text-lg font-black text-white">{stocks.length} Setups</strong>
              </div>
              <div className="bg-[#1f0a14] border border-rose-900/80 p-3">
                <span className="text-[10px] text-rose-300 block uppercase flex items-center gap-1">
                  <TrendingDown className="w-3 h-3 text-rose-400" />
                  Bearish Reversals
                </span>
                <strong className="text-lg font-black text-rose-400">
                  {divergenceScanList.filter((d) => d.divergenceType === 'BEARISH_DIVERGENCE').length} Alerts
                </strong>
              </div>
              <div className="bg-[#051c14] border border-emerald-900/80 p-3">
                <span className="text-[10px] text-emerald-300 block uppercase flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-emerald-400" />
                  Bullish Reversals
                </span>
                <strong className="text-lg font-black text-emerald-400">
                  {divergenceScanList.filter((d) => d.divergenceType === 'BULLISH_DIVERGENCE').length} Setups
                </strong>
              </div>
              <div className="bg-[#181103] border border-amber-900/80 p-3">
                <span className="text-[10px] text-amber-300 block uppercase flex items-center gap-1">
                  <Target className="w-3 h-3 text-amber-400" />
                  Armed Divergence Alerts
                </span>
                <strong className="text-lg font-black text-amber-400">
                  {alerts.filter((a) => a.targetType === 'RSI_BEARISH_DIVERGENCE' || a.targetType === 'RSI_BULLISH_DIVERGENCE').length} Armed
                </strong>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px]">
              {(['ALL', 'BEARISH', 'BULLISH', 'HIGH_SEVERITY'] as const).map((flt) => (
                <button
                  key={flt}
                  onClick={() => setRsiDivergenceFilter(flt)}
                  className={`px-3 py-1 font-bold uppercase tracking-wider border transition cursor-pointer ${
                    rsiDivergenceFilter === flt
                      ? 'bg-cyan-400 text-slate-950 border-cyan-300 font-black'
                      : 'bg-cyan-950/60 text-cyan-200 border-cyan-800 hover:border-cyan-600'
                  }`}
                >
                  {flt === 'ALL'
                    ? `All Candidates (${divergenceScanList.length})`
                    : flt === 'BEARISH'
                    ? `⚠️ Bearish Reversals (${divergenceScanList.filter((d) => d.divergenceType === 'BEARISH_DIVERGENCE').length})`
                    : flt === 'BULLISH'
                    ? `⚡ Bullish Reversals (${divergenceScanList.filter((d) => d.divergenceType === 'BULLISH_DIVERGENCE' || d.divergenceType === 'HIDDEN_BULLISH').length})`
                    : `🔥 High Severity (${divergenceScanList.filter((d) => d.divergence.severity === 'HIGH').length})`}
                </button>
              ))}
            </div>
          </div>

          {/* Divergence Stock Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {divergenceScanList
              .filter((item) => {
                if (rsiDivergenceFilter === 'BEARISH') return item.divergenceType === 'BEARISH_DIVERGENCE';
                if (rsiDivergenceFilter === 'BULLISH') return item.divergenceType === 'BULLISH_DIVERGENCE' || item.divergenceType === 'HIDDEN_BULLISH';
                if (rsiDivergenceFilter === 'HIGH_SEVERITY') return item.divergence.severity === 'HIGH';
                return true;
              })
              .map(({ stock, divergence, hasDivergence, isArmed, isArmedBearish, isArmedBullish }) => {
                const currency = getCurrencySymbol(stock.exchange);
                const isBearish = divergence.divergenceType === 'BEARISH_DIVERGENCE';
                const isBullish = divergence.divergenceType === 'BULLISH_DIVERGENCE';
                const isHidden = divergence.divergenceType === 'HIDDEN_BULLISH';

                return (
                  <div
                    key={`div-card-${stock.ticker}`}
                    className={`border p-4 space-y-3 transition-all ${
                      isBearish
                        ? 'bg-rose-50/20 border-rose-300 hover:border-rose-500'
                        : isBullish
                        ? 'bg-emerald-50/20 border-emerald-300 hover:border-emerald-500'
                        : isHidden
                        ? 'bg-blue-50/20 border-blue-300 hover:border-blue-500'
                        : 'bg-white border-[#e5e4e1] hover:border-gray-400'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between border-b pb-2">
                      <div>
                        <div className="flex items-center space-x-1.5">
                          <strong className="text-base font-black text-slate-900">{stock.ticker}</strong>
                          <span className="text-[9px] px-1.5 py-0.2 bg-black text-white uppercase font-bold">
                            {stock.exchange}
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-500 truncate block max-w-[160px] font-sans">
                          {stock.name} • {stock.sector}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-black block text-slate-900">
                          {formatCurrency(stock.currentPrice, currency)}
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                          isBearish
                            ? 'bg-rose-100 text-rose-800 border-rose-300'
                            : isBullish
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : isHidden
                            ? 'bg-blue-100 text-blue-800 border-blue-300'
                            : 'bg-gray-100 text-gray-600 border-gray-200'
                        }`}>
                          {divergence.shortLabel}
                        </span>
                      </div>
                    </div>

                    {/* Swing Metrics Comparison */}
                    <div className="bg-[#f9f8f5] border border-[#e5e4e1] p-2.5 space-y-1.5 text-[11px]">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Price Action Swing:</span>
                        <span className="font-bold text-slate-900">
                          {currency}{divergence.priorPrice.toFixed(2)} &rarr; {currency}{divergence.currentPrice.toFixed(2)}
                          <strong className={`ml-1 text-[10px] ${divergence.currentPrice >= divergence.priorPrice ? 'text-emerald-700' : 'text-rose-700'}`}>
                            ({divergence.currentPrice >= divergence.priorPrice ? '+' : ''}{((divergence.currentPrice - divergence.priorPrice) / (divergence.priorPrice || 1) * 100).toFixed(1)}%)
                          </strong>
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">14-Period RSI Swing:</span>
                        <span className="font-bold text-slate-900">
                          {divergence.priorRsi} &rarr; <strong className={divergence.currentRsi < divergence.priorRsi ? 'text-rose-600' : 'text-emerald-600'}>{divergence.currentRsi}</strong>
                          <span className="ml-1 text-[10px] text-gray-500">
                            ({divergence.currentRsi >= divergence.priorRsi ? '+' : ''}{(divergence.currentRsi - divergence.priorRsi).toFixed(1)} pts)
                          </span>
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-[10px] text-gray-500 pt-0.5 border-t border-gray-200">
                        <span>Lookback: {divergence.lookbackBars || 14} {rsiTimeframe.toLowerCase()} bars</span>
                        <span className={`font-bold ${divergence.severity === 'HIGH' ? 'text-rose-600' : 'text-amber-600'}`}>
                          Severity: {divergence.severity}
                        </span>
                      </div>
                    </div>

                    {/* Minervini SEPA Reversal Risk Advisory */}
                    <div className="text-[10px] text-slate-700 font-sans italic bg-white p-2 border border-gray-200 leading-snug">
                      <strong className="text-slate-900 not-italic font-mono block mb-0.5">
                        Minervini SEPA Diagnostic:
                      </strong>
                      {divergence.actionAdvice}
                    </div>

                    {/* Actions: Arm Alert, Simulate Trigger, Inspect */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {isBearish ? (
                        <button
                          onClick={() => handleAddBearishRsiAlert(stock)}
                          disabled={isArmedBearish}
                          className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider border transition cursor-pointer flex items-center justify-center gap-1 ${
                            isArmedBearish
                              ? 'bg-rose-950 text-rose-300 border-rose-800 cursor-default'
                              : 'bg-rose-700 hover:bg-rose-800 text-white border-rose-800'
                          }`}
                        >
                          <TrendingDown className="w-3 h-3" />
                          <span>{isArmedBearish ? '✓ Bearish Alert Active' : 'Arm Bearish Alert'}</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAddBullishRsiAlert(stock)}
                          disabled={isArmedBullish}
                          className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider border transition cursor-pointer flex items-center justify-center gap-1 ${
                            isArmedBullish
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-800 cursor-default'
                              : 'bg-emerald-700 hover:bg-emerald-800 text-white border-emerald-800'
                          }`}
                        >
                          <TrendingUp className="w-3 h-3" />
                          <span>{isArmedBullish ? '✓ Bullish Alert Active' : 'Arm Bullish Alert'}</span>
                        </button>
                      )}

                      <button
                        onClick={() => triggerSimulatedRsiDivergenceAlert(isBearish ? 'BEARISH' : 'BULLISH', stock)}
                        className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-slate-800 border border-gray-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                        title="Simulate desktop notification and chime for this setup"
                      >
                        <Zap className="w-3 h-3 text-amber-500" />
                        <span>Test Alert</span>
                      </button>

                      {onSelectStock && (
                        <button
                          onClick={() => onSelectStock(stock)}
                          className="px-2.5 py-1.5 bg-[#1a1a1a] hover:bg-black text-amber-300 border border-black text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                          title="Inspect on VCP Candlestick Chart"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Inspect</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      ) : activeSubTab === 'PRICE_HISTORY' ? (
        <RecentPriceAlertHistory
          stock={selectedStock || stocks[0]}
          allStocks={stocks}
          onSelectStock={onSelectStock}
        />
      ) : activeSubTab === 'AUDIT_LOGS' ? (
        /* Background Tracker Audit Logs Table */
        <div className="bg-[#f9f8f5] border border-[#e5e4e1] p-4 space-y-3 font-mono text-xs">
          <div className="flex justify-between items-center pb-2 border-b border-[#e5e4e1]">
            <span className="text-[10px] uppercase font-bold text-gray-500">
              Recent Background Price Check Events (LocalStorage)
            </span>
            <button
              onClick={() => setLogs(getTrackerLogs())}
              className="text-[10px] uppercase font-bold text-blue-700 flex items-center space-x-1 hover:underline"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Refresh Logs</span>
            </button>
          </div>

          <div className="divide-y divide-[#e5e4e1] bg-white border border-[#e5e4e1] max-h-80 overflow-y-auto">
            {logs.length === 0 ? (
              <div className="p-6 text-center text-gray-400 italic font-sans text-xs">
                No background check logs recorded yet. The background system logs events automatically every 3.5s.
              </div>
            ) : (
              logs.map((lg, idx) => (
                <div key={lg.id || `tracker-log-${lg.ticker}-${idx}`} className="p-3 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-3">
                    <span className="text-gray-400 text-[10px]">{lg.timestamp}</span>
                    <strong className="text-slate-900">{lg.ticker} ({lg.exchange})</strong>
                    <span className={`px-2 py-0.5 text-[9px] font-bold uppercase ${
                      lg.event === 'PIVOT_CROSSED'
                        ? 'bg-emerald-600 text-white'
                        : lg.event === 'STOP_LOSS_HIT'
                        ? 'bg-rose-600 text-white'
                        : 'bg-amber-100 text-amber-900 border border-amber-300'
                    }`}>
                      {lg.event.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="text-gray-600">
                    Prev: {lg.previousPrice.toFixed(2)} &rarr; <strong className="text-slate-900">Curr: {lg.currentPrice.toFixed(2)}</strong> (Target: {lg.targetPrice.toFixed(2)})
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        /* Custom Alert Creation Form & Active Alert Filters */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: Custom Price Alert Form */}
          <div className="bg-[#f9f8f5] border border-[#e5e4e1] p-5 space-y-4">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-[#b5a68d] font-bold">New Custom Alert</span>
              <h4 className="text-base font-serif font-black text-[#1a1a1a]">Configure Target Threshold</h4>
            </div>

            <form onSubmit={handleCreateCustomAlert} className="space-y-3 font-mono text-xs">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-gray-600 font-bold mb-1">
                  Target Condition
                </label>
                <select
                  value={customTargetType}
                  onChange={(e: any) => setCustomTargetType(e.target.value)}
                  className="w-full bg-white border border-[#e5e4e1] p-2 text-xs font-bold text-[#1a1a1a] focus:outline-none"
                >
                  <option value="VOLATILITY_DRYUP">⚡ VCP Volatility Dry-Up (Range ≤ 5.0%)</option>
                  <option value="RSI_BEARISH_DIVERGENCE">⚠️ RSI Bearish Divergence (Price New High / Lower RSI)</option>
                  <option value="RSI_BULLISH_DIVERGENCE">⚡ RSI Bullish Divergence (Price New Low / Higher RSI)</option>
                  <option value="PIVOT_ENTRY">Pivot Entry Level (Breakout)</option>
                  <option value="STOP_LOSS">Risk Stop Loss Level (Exit)</option>
                  <option value="CUSTOM_ABOVE">Crosses Above Custom Price</option>
                  <option value="CUSTOM_BELOW">Crosses Below Custom Price</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-gray-600 font-bold mb-1">
                  Target Price ({selectedStock ? getCurrencySymbol(selectedStock.exchange) : '$'})
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder={selectedStock ? selectedStock.pivotPrice.toString() : '150.00'}
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  className="w-full bg-white border border-[#e5e4e1] p-2 text-xs font-bold text-[#1a1a1a] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-gray-600 font-bold mb-1">
                  Proximity Sensitivity ({customProximity}%)
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="5.0"
                  step="0.5"
                  value={customProximity}
                  onChange={(e) => setCustomProximity(parseFloat(e.target.value))}
                  className="w-full accent-black"
                />
                <span className="text-[10px] text-gray-500 font-sans block">
                  Trigger notification when current price comes within {customProximity}% of target.
                </span>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-gray-600 font-bold mb-1">
                  Strategy Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Volume surge near $145 pivot"
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  className="w-full bg-white border border-[#e5e4e1] p-2 text-xs text-[#1a1a1a] focus:outline-none font-sans"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#1a1a1a] hover:bg-black text-white font-bold py-2.5 text-xs uppercase tracking-widest flex items-center justify-center space-x-1.5 transition-all shadow-xs"
              >
                <Plus className="w-4 h-4 text-amber-400" />
                <span>Add Price Alert</span>
              </button>
            </form>
          </div>

          {/* Right Column: Active Alerts List */}
          <div className="lg:col-span-2 space-y-4">
            
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e4e1] pb-3">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-serif font-black text-[#1a1a1a]">
                  Monitored SEPA Price Alerts ({filteredAlerts.length})
                </span>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 font-mono font-bold">
                  {activeCount} Active
                </span>
                {triggeredCount > 0 && (
                  <span className="bg-amber-100 text-amber-900 text-[10px] px-2 py-0.5 font-mono font-bold">
                    {triggeredCount} Triggered
                  </span>
                )}
              </div>

              {/* Filter Buttons */}
              <div className="flex items-center space-x-1 text-xs font-mono">
                {(['ALL', 'ACTIVE', 'TRIGGERED'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setFilterStatus(st)}
                    className={`px-3 py-1 font-bold text-[10px] uppercase tracking-wider transition-all border ${
                      filterStatus === st
                        ? 'bg-[#1a1a1a] text-white border-black'
                        : 'bg-white text-gray-600 border-[#e5e4e1] hover:text-black'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Alerts Table / List */}
            <div className="divide-y divide-[#e5e4e1] border border-[#e5e4e1]">
              {filteredAlerts.length === 0 ? (
                <div className="p-8 text-center text-gray-500 font-serif italic text-xs">
                  No price alerts set for this filter mode. Use quick setup above to add alerts.
                </div>
              ) : (
                filteredAlerts.map((alt, idx) => {
                  const currency = getCurrencySymbol(alt.exchange);
                  const isTriggered = alt.status === 'TRIGGERED';

                  return (
                    <div
                      key={alt.id || `alert-${alt.ticker}-${alt.targetType}-${idx}`}
                      className={`p-4 flex flex-wrap items-center justify-between gap-4 transition-all ${
                        isTriggered ? 'bg-amber-50/70 border-l-4 border-l-amber-500' : 'bg-white hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div
                          className={`w-9 h-9 flex items-center justify-center font-bold text-xs ${
                            alt.targetType === 'RSI_BEARISH_DIVERGENCE'
                              ? 'bg-rose-950 text-rose-300 border border-rose-700'
                              : alt.targetType === 'RSI_BULLISH_DIVERGENCE'
                              ? 'bg-cyan-950 text-cyan-300 border border-cyan-700'
                              : alt.targetType === 'VOLATILITY_DRYUP'
                              ? 'bg-purple-100 text-purple-900 border border-purple-300'
                              : alt.targetType === 'PIVOT_ENTRY'
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              : 'bg-rose-100 text-rose-900 border border-rose-300'
                          }`}
                        >
                          {alt.targetType === 'RSI_BEARISH_DIVERGENCE' ? (
                            <TrendingDown className="w-5 h-5 text-rose-400" />
                          ) : alt.targetType === 'RSI_BULLISH_DIVERGENCE' ? (
                            <TrendingUp className="w-5 h-5 text-cyan-400" />
                          ) : alt.targetType === 'VOLATILITY_DRYUP' ? (
                            <Activity className="w-5 h-5 text-purple-700" />
                          ) : alt.targetType === 'PIVOT_ENTRY' ? (
                            <Target className="w-5 h-5" />
                          ) : (
                            <ShieldAlert className="w-5 h-5" />
                          )}
                        </div>

                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-extrabold text-sm text-[#1a1a1a]">
                              {alt.ticker}
                            </span>
                            <span className="text-[9px] px-1.5 py-0.2 bg-[#1a1a1a] text-white font-mono uppercase font-bold">
                              {alt.exchange}
                            </span>
                            <span
                              className={`text-[9px] font-mono font-bold px-2 py-0.5 uppercase border ${
                                isTriggered
                                  ? 'bg-amber-400 text-black border-amber-600 animate-pulse'
                                  : alt.targetType === 'RSI_BEARISH_DIVERGENCE'
                                  ? 'bg-rose-950 text-rose-300 border-rose-800'
                                  : alt.targetType === 'RSI_BULLISH_DIVERGENCE'
                                  ? 'bg-cyan-950 text-cyan-300 border-cyan-800'
                                  : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              }`}
                            >
                              {isTriggered
                                ? `TRIGGERED @ ${alt.triggeredAt}`
                                : alt.targetType === 'RSI_BEARISH_DIVERGENCE'
                                ? '⚠️ BEARISH DIV MONITORED'
                                : alt.targetType === 'RSI_BULLISH_DIVERGENCE'
                                ? '⚡ BULLISH DIV MONITORED'
                                : 'ACTIVE MONITORING'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 font-sans mt-0.5">
                            {alt.notes || `${alt.targetType.replace(/_/g, ' ')} Target`}
                          </p>
                        </div>
                      </div>

                      {/* Price Metrics */}
                      <div className="flex items-center space-x-6 font-mono text-xs">
                        <div>
                          <span className="text-[10px] text-gray-500 block uppercase font-bold">Target Price</span>
                          <strong className="text-sm font-black text-[#1a1a1a]">
                            {formatCurrency(alt.targetPrice, currency)}
                          </strong>
                        </div>

                        <div>
                          <span className="text-[10px] text-gray-500 block uppercase font-bold">Current Price</span>
                          <strong className="text-sm font-bold text-gray-700">
                            {formatCurrency(alt.currentPrice, currency)}
                          </strong>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center space-x-2">
                          {isTriggered && (
                            <button
                              onClick={() => handleResetAlert(alt.id)}
                              title="Re-arm Alert"
                              className="bg-white hover:bg-gray-100 text-[#1a1a1a] p-1.5 border border-[#e5e4e1] transition-all"
                            >
                              <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteAlert(alt.id)}
                            title="Delete Alert"
                            className="bg-white hover:bg-red-50 text-red-600 p-1.5 border border-[#e5e4e1] transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                    </div>
                  );
                })
              )}
            </div>

          </div>

        </div>
      )}

    </div>
  );
};
