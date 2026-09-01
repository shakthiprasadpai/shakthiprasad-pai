import React, { useState, useEffect, useRef } from 'react';
import { PriceAlert, MinerviniTradeSetup, PortfolioHolding, MajorNewsEventPayload, SmartMoneyDivergenceAlertPayload } from '../types';
import {
  getStoredAlerts,
  saveStoredAlerts,
  appendTrackerLog,
  playAlertChime,
  initializeLocalStorageAlerts,
  syncPortfolioAlerts,
} from '../utils/backgroundPriceChecker';
import {
  isTickerInUserWatchlists,
  simulateWatchlistMajorNewsAlert,
} from '../utils/watchlistNewsListener';
import {
  simulateSmartMoneyDivergenceAlert,
} from '../utils/sentimentDivergenceService';
import {
  DailyStage2ScanPayload,
  checkAndRunScheduledScan,
  runDailyStage2Scan,
  dispatchStage2DailyScanNotification,
} from '../utils/dailyStage2Scanner';
import {
  getAudioSettings,
  saveAudioSettings,
  playVolumeSpikeChime,
  playHighConvictionBreakoutChime,
  playSmartMoneyDivergenceChime,
  triggerWatchlistAudioAlert,
  VolumeBreakoutAlertPayload,
  AudioSettings,
} from '../utils/audioAlertEngine';
import { formatCurrency, getCurrencySymbol } from '../utils/sepaCalculator';
import {
  BellRing,
  AlertTriangle,
  CheckCircle2,
  X,
  ArrowUpRight,
  Target,
  ShieldAlert,
  BarChart3,
  RotateCcw,
  Activity,
  Briefcase,
  Sparkles,
  Zap,
  ChevronUp,
  ChevronDown,
  Newspaper,
  Globe,
  ExternalLink,
  Flame,
  Volume2,
  VolumeX,
  Volume1,
  Radio,
} from 'lucide-react';

interface GlobalNotificationToastProps {
  stocks: MinerviniTradeSetup[];
  onSelectStock: (stock: MinerviniTradeSetup) => void;
  onNavigateTab: (tab: 'screener' | 'chart' | 'calculator' | 'portfolio' | 'watchlist') => void;
  onOpenDailyScanner?: () => void;
}

export interface ActiveToastNotification {
  alert: PriceAlert;
  previousPrice: number;
  currentPrice: number;
  crossoverType:
    | 'PIVOT_CROSSOVER'
    | 'STOP_LOSS_HIT'
    | 'PROXIMITY_ALERT'
    | 'VOLATILITY_DRYUP'
    | 'PORTFOLIO_PIVOT_CROSSOVER'
    | 'PORTFOLIO_STOP_LOSS_HIT'
    | 'STAGE_2_COMPLETED'
    | 'VCP_BASE_FORMED'
    | 'MAJOR_NEWS_CATALYST'
    | 'VOLUME_SPIKE'
    | 'HIGH_CONVICTION_BREAKOUT'
    | 'SMART_MONEY_DIVERGENCE'
    | 'STAGE_2_DAILY_SCAN';
  triggeredAt: string;
  isPortfolioHolding?: boolean;
  portfolioHolding?: PortfolioHolding;
  majorNewsPayload?: MajorNewsEventPayload;
  volumeBreakoutPayload?: VolumeBreakoutAlertPayload;
  divergencePayload?: SmartMoneyDivergenceAlertPayload;
  stage2ScanPayload?: DailyStage2ScanPayload;
}

export const GlobalNotificationToast: React.FC<GlobalNotificationToastProps> = ({
  stocks,
  onSelectStock,
  onNavigateTab,
  onOpenDailyScanner,
}) => {
  const [activeToast, setActiveToast] = useState<ActiveToastNotification | null>(null);
  const [backgroundRunning, setBackgroundRunning] = useState<boolean>(true);
  const [lastCheckTime, setLastCheckTime] = useState<string>('');
  const [checksCount, setChecksCount] = useState<number>(0);
  const [isTestDrawerOpen, setIsTestDrawerOpen] = useState<boolean>(false);
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(() => getAudioSettings());

  // Initialize LocalStorage Alerts & Portfolio Sync on mount
  useEffect(() => {
    initializeLocalStorageAlerts(stocks);
    syncPortfolioAlerts();
  }, [stocks]);

  // Listen to custom window events for immediate alert/portfolio re-sync, major news, and volume breakout alerts
  useEffect(() => {
    const handleSync = () => {
      syncPortfolioAlerts();
    };

    const handleAudioSettingsUpdate = (e: Event) => {
      const customEvt = e as CustomEvent<AudioSettings>;
      if (customEvt.detail) {
        setAudioSettings(customEvt.detail);
      }
    };

    const handleVolumeBreakoutEvent = (e: Event) => {
      const customEvt = e as CustomEvent<VolumeBreakoutAlertPayload>;
      const payload = customEvt.detail;
      if (!payload) return;

      const match = stocksRef.current.find((s) => s.ticker === payload.stock.ticker) || payload.stock;
      const alertItem: PriceAlert = {
        id: `volbreak-${payload.stock.ticker}-${Date.now()}`,
        ticker: payload.stock.ticker,
        stockName: payload.stock.name,
        targetType: payload.type,
        targetPrice: match.pivotPrice,
        triggerProximityPercent: 0,
        currentPrice: match.currentPrice,
        status: 'TRIGGERED',
        createdAt: new Date().toLocaleDateString(),
        exchange: match.exchange,
        notes: payload.description,
      };

      setActiveToast({
        alert: alertItem,
        previousPrice: match.currentPrice - 1.2,
        currentPrice: match.currentPrice,
        crossoverType: payload.type,
        triggeredAt: payload.triggeredAt || new Date().toLocaleTimeString(),
        volumeBreakoutPayload: payload,
      });
    };

    const handleMajorNewsEvent = (e: Event) => {
      const customEvt = e as CustomEvent<MajorNewsEventPayload>;
      const payload = customEvt.detail;
      if (!payload) return;

      const match = stocksRef.current.find((s) => s.ticker === payload.ticker);
      const alertItem: PriceAlert = {
        id: `news-${payload.ticker}-${Date.now()}`,
        ticker: payload.ticker,
        stockName: payload.stockName,
        targetType: 'MAJOR_NEWS_CATALYST',
        targetPrice: match ? match.pivotPrice : 0,
        triggerProximityPercent: 0,
        currentPrice: match ? match.currentPrice : 0,
        status: 'TRIGGERED',
        createdAt: new Date().toLocaleDateString(),
        exchange: (payload.exchange as any) || 'NASDAQ',
        notes: `⚡ Watchlist Major News: ${payload.headlineTitle}`,
      };

      setActiveToast({
        alert: alertItem,
        previousPrice: match ? match.currentPrice - 1 : 0,
        currentPrice: match ? match.currentPrice : 0,
        crossoverType: 'MAJOR_NEWS_CATALYST',
        triggeredAt: payload.triggeredAt || new Date().toLocaleTimeString(),
        majorNewsPayload: payload,
      });
    };

    const handleDivergenceEvent = (e: Event) => {
      const customEvt = e as CustomEvent<SmartMoneyDivergenceAlertPayload>;
      const payload = customEvt.detail;
      if (!payload) return;

      const match = stocksRef.current.find((s) => s.ticker === payload.ticker);
      const alertItem: PriceAlert = {
        id: `divergence-${payload.ticker}-${Date.now()}`,
        ticker: payload.ticker,
        stockName: payload.stockName,
        targetType: 'SMART_MONEY_DIVERGENCE',
        targetPrice: match ? match.pivotPrice : payload.priceEnd,
        triggerProximityPercent: 0,
        currentPrice: payload.priceEnd,
        status: 'TRIGGERED',
        createdAt: new Date().toLocaleDateString(),
        exchange: (payload.exchange as any) || 'NASDAQ',
        notes: payload.description,
        divergenceType: payload.divergenceType,
        divergenceConviction: payload.convictionScore,
      };

      setActiveToast({
        alert: alertItem,
        previousPrice: payload.priceStart,
        currentPrice: payload.priceEnd,
        crossoverType: 'SMART_MONEY_DIVERGENCE',
        triggeredAt: payload.triggeredAt || new Date().toLocaleTimeString(),
        divergencePayload: payload,
      });
    };

    const handleStage2DailyScanEvent = (e: Event) => {
      const customEvt = e as CustomEvent<DailyStage2ScanPayload>;
      const payload = customEvt.detail;
      if (!payload || !payload.result) return;

      const top = payload.topCandidates[0];
      const match = top
        ? stocksRef.current.find((s) => s.ticker === top.ticker) || top.stock
        : stocksRef.current[0];

      const alertItem: PriceAlert = {
        id: `daily-scan-${Date.now()}`,
        ticker: top ? top.ticker : 'STAGE-2',
        stockName: top ? top.stockName : 'Stage 2 Daily Breakouts',
        targetType: 'STAGE_2_DAILY_SCAN',
        targetPrice: top ? top.pivotPrice : 0,
        triggerProximityPercent: 0,
        currentPrice: top ? top.currentPrice : 0,
        status: 'TRIGGERED',
        createdAt: new Date().toLocaleDateString(),
        exchange: top ? (top.exchange as any) : 'NASDAQ',
        notes: payload.summary,
      };

      setActiveToast({
        alert: alertItem,
        previousPrice: top ? top.currentPrice - 1 : 0,
        currentPrice: top ? top.currentPrice : 0,
        crossoverType: 'STAGE_2_DAILY_SCAN',
        triggeredAt: payload.triggeredAt || new Date().toLocaleTimeString(),
        stage2ScanPayload: payload,
      });
    };

    window.addEventListener('minervini_portfolio_updated', handleSync);
    window.addEventListener('minervini_alerts_updated', handleSync);
    window.addEventListener('minervini_major_news_detected', handleMajorNewsEvent);
    window.addEventListener('minervini_volume_breakout_alert', handleVolumeBreakoutEvent);
    window.addEventListener('minervini_sentiment_divergence_alert', handleDivergenceEvent);
    window.addEventListener('minervini_stage2_daily_scan_alert', handleStage2DailyScanEvent);
    window.addEventListener('minervini_audio_settings_updated', handleAudioSettingsUpdate);
    return () => {
      window.removeEventListener('minervini_portfolio_updated', handleSync);
      window.removeEventListener('minervini_alerts_updated', handleSync);
      window.removeEventListener('minervini_major_news_detected', handleMajorNewsEvent);
      window.removeEventListener('minervini_volume_breakout_alert', handleVolumeBreakoutEvent);
      window.removeEventListener('minervini_sentiment_divergence_alert', handleDivergenceEvent);
      window.removeEventListener('minervini_stage2_daily_scan_alert', handleStage2DailyScanEvent);
      window.removeEventListener('minervini_audio_settings_updated', handleAudioSettingsUpdate);
    };
  }, []);

  // Background Price Checker Loop
  const stocksRef = useRef(stocks);
  stocksRef.current = stocks;

  useEffect(() => {
    if (!backgroundRunning) return;

    const interval = setInterval(() => {
      // Re-sync portfolio holdings to make sure new portfolio positions are tracked
      syncPortfolioAlerts();

      // Check if scheduled daily scan is due
      checkAndRunScheduledScan(stocksRef.current);

      const storedAlerts = getStoredAlerts();
      if (!storedAlerts || storedAlerts.length === 0) return;

      // Read active portfolio holdings
      let portfolioHoldings: PortfolioHolding[] = [];
      try {
        const rawPortfolio = localStorage.getItem('minervini_sepa_portfolio');
        if (rawPortfolio) portfolioHoldings = JSON.parse(rawPortfolio);
      } catch (e) {
        console.error(e);
      }

      let hasUpdates = false;
      let newToast: ActiveToastNotification | null = null;

      const updatedAlerts = storedAlerts.map((alert) => {
        if (alert.status !== 'ACTIVE') return alert;

        // Match stock setup from current stock list
        const stockMatch = stocksRef.current.find((s) => s.ticker === alert.ticker);
        const currentPrice = stockMatch ? stockMatch.currentPrice : alert.currentPrice;

        // Match portfolio holding if present
        const portfolioMatch = portfolioHoldings.find((h) => h.ticker === alert.ticker);
        const isPortfolio = !!portfolioMatch || (alert.notes && alert.notes.includes('💼 Portfolio'));

        // Micro live tick simulation to test price movement towards/over thresholds
        const randomTickChange = (Math.random() - 0.48) * 0.28;
        const simulatedPrice = Number((currentPrice + randomTickChange).toFixed(2));
        const previousPrice = alert.currentPrice;

        const currencySymbol = getCurrencySymbol(alert.exchange);

        // Check 1: Pivot Entry Crossover
        if (alert.targetType === 'PIVOT_ENTRY') {
          const isCrossed = (previousPrice < alert.targetPrice && simulatedPrice >= alert.targetPrice) ||
                            simulatedPrice >= alert.targetPrice;

          if (isCrossed) {
            hasUpdates = true;
            playAlertChime();

            const toastType = isPortfolio ? 'PORTFOLIO_PIVOT_CROSSOVER' : 'PIVOT_CROSSOVER';

            // Native browser notification if permitted
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(
                isPortfolio
                  ? `💼 Portfolio Position Breakout: ${alert.ticker}`
                  : `🎯 Pivot Breakout Crossover: ${alert.ticker}`,
                {
                  body: `${alert.ticker} price at ${currencySymbol}${simulatedPrice.toFixed(2)} crossed Pivot Target ${currencySymbol}${alert.targetPrice.toFixed(2)}!`,
                  icon: '/favicon.ico',
                }
              );
            }

            appendTrackerLog({
              ticker: alert.ticker,
              exchange: alert.exchange || 'NASDAQ',
              previousPrice,
              currentPrice: simulatedPrice,
              targetPrice: alert.targetPrice,
              targetType: alert.targetType,
              event: 'PIVOT_CROSSED',
              triggered: true,
            });

            newToast = {
              alert: { ...alert, status: 'TRIGGERED' as const },
              previousPrice,
              currentPrice: simulatedPrice,
              crossoverType: toastType,
              triggeredAt: new Date().toLocaleTimeString(),
              isPortfolioHolding: isPortfolio,
              portfolioHolding: portfolioMatch,
            };

            return {
              ...alert,
              currentPrice: simulatedPrice,
              status: 'TRIGGERED' as const,
              triggeredAt: new Date().toLocaleTimeString(),
            };
          }
        }

        // Check 2: Stop Loss Hit
        if (alert.targetType === 'STOP_LOSS') {
          const isStopHit = simulatedPrice <= alert.targetPrice;
          if (isStopHit) {
            hasUpdates = true;
            playAlertChime();

            const toastType = isPortfolio ? 'PORTFOLIO_STOP_LOSS_HIT' : 'STOP_LOSS_HIT';

            // Native browser notification
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(
                isPortfolio
                  ? `🚨 PORTFOLIO STOP LOSS WARNING: ${alert.ticker}`
                  : `🚨 Stop Loss Hit Warning: ${alert.ticker}`,
                {
                  body: `${alert.ticker} price at ${currencySymbol}${simulatedPrice.toFixed(2)} fell below Stop Loss threshold ${currencySymbol}${alert.targetPrice.toFixed(2)}! Protect capital!`,
                  icon: '/favicon.ico',
                }
              );
            }

            appendTrackerLog({
              ticker: alert.ticker,
              exchange: alert.exchange || 'NASDAQ',
              previousPrice,
              currentPrice: simulatedPrice,
              targetPrice: alert.targetPrice,
              targetType: alert.targetType,
              event: 'STOP_LOSS_HIT',
              triggered: true,
            });

            newToast = {
              alert: { ...alert, status: 'TRIGGERED' as const },
              previousPrice,
              currentPrice: simulatedPrice,
              crossoverType: toastType,
              triggeredAt: new Date().toLocaleTimeString(),
              isPortfolioHolding: isPortfolio,
              portfolioHolding: portfolioMatch,
            };

            return {
              ...alert,
              currentPrice: simulatedPrice,
              status: 'TRIGGERED' as const,
              triggeredAt: new Date().toLocaleTimeString(),
            };
          }
        }

        // Check 3: Volatility Dry-Up Alert
        if (alert.targetType === 'VOLATILITY_DRYUP') {
          const targetTightness = alert.volatilityTightnessTargetPct || 5.0;
          const targetDryUp = alert.volatilityVolumeDryUpTargetPct || -50.0;

          const currentTightness = stockMatch
            ? Math.abs(stockMatch.contractions[stockMatch.contractions.length - 1]?.depthPercent || 4.2)
            : 4.2;
          const currentVolDryUp = stockMatch ? stockMatch.volumeDryUpPercent : -58;

          const isPrimed = currentTightness <= targetTightness && currentVolDryUp <= targetDryUp;

          if (isPrimed && alert.status === 'ACTIVE') {
            hasUpdates = true;
            playAlertChime();

            appendTrackerLog({
              ticker: alert.ticker,
              exchange: alert.exchange || 'NASDAQ',
              previousPrice,
              currentPrice: simulatedPrice,
              targetPrice: alert.targetPrice,
              targetType: alert.targetType,
              event: 'VOLATILITY_DRYUP_PRIMED',
              triggered: true,
            });

            newToast = {
              alert: { ...alert, status: 'TRIGGERED' as const },
              previousPrice,
              currentPrice: simulatedPrice,
              crossoverType: 'VOLATILITY_DRYUP',
              triggeredAt: new Date().toLocaleTimeString(),
              isPortfolioHolding: isPortfolio,
              portfolioHolding: portfolioMatch,
            };

            return {
              ...alert,
              currentPrice: simulatedPrice,
              status: 'TRIGGERED' as const,
              triggeredAt: new Date().toLocaleTimeString(),
            };
          }
        }

        // Check 4: Stage 2 Criteria Completed Pattern Alert
        if (alert.targetType === 'STAGE_2_COMPLETED') {
          const reqRules = alert.stage2RuleThreshold || 7;
          const currentPassedRules = stockMatch ? stockMatch.trendScore : 8;
          const isStage2Complete = currentPassedRules >= reqRules;

          if (isStage2Complete && alert.status === 'ACTIVE') {
            hasUpdates = true;
            playAlertChime();

            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(`🎯 Stage 2 Criteria Completed: ${alert.ticker}`, {
                body: `${alert.ticker} passed ${currentPassedRules}/8 Stage 2 Trend Template rules! Trading in confirmed Stage 2 uptrend with RS ${stockMatch?.rsRating || 90}.`,
                icon: '/favicon.ico',
              });
            }

            appendTrackerLog({
              ticker: alert.ticker,
              exchange: alert.exchange || 'NASDAQ',
              previousPrice,
              currentPrice: simulatedPrice,
              targetPrice: alert.targetPrice,
              targetType: alert.targetType,
              event: 'STAGE_2_COMPLETED',
              triggered: true,
            });

            newToast = {
              alert: { ...alert, status: 'TRIGGERED' as const },
              previousPrice,
              currentPrice: simulatedPrice,
              crossoverType: 'STAGE_2_COMPLETED',
              triggeredAt: new Date().toLocaleTimeString(),
              isPortfolioHolding: isPortfolio,
              portfolioHolding: portfolioMatch,
            };

            return {
              ...alert,
              currentPrice: simulatedPrice,
              status: 'TRIGGERED' as const,
              triggeredAt: new Date().toLocaleTimeString(),
            };
          }
        }

        // Check 5: VCP Base Formed Pattern Alert
        if (alert.targetType === 'VCP_BASE_FORMED') {
          const reqContractions = alert.vcpContractionThreshold || 3;
          const currentContractions = stockMatch ? (stockMatch.contractions?.length || 3) : 3;
          const currentDryUp = stockMatch ? stockMatch.volumeDryUpPercent : -55;
          const isVcpFormed = currentContractions >= reqContractions && currentDryUp <= -40;

          if (isVcpFormed && alert.status === 'ACTIVE') {
            hasUpdates = true;
            playAlertChime();

            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(`⚡ VCP Base Formed Alert: ${alert.ticker}`, {
                body: `${alert.ticker} completed a tight ${stockMatch?.patternType || 'VCP Base'} with ${currentContractions} contractions & ${currentDryUp}% volume dry-up! Ready for breakout at ${currencySymbol}${stockMatch?.pivotPrice || alert.targetPrice}.`,
                icon: '/favicon.ico',
              });
            }

            appendTrackerLog({
              ticker: alert.ticker,
              exchange: alert.exchange || 'NASDAQ',
              previousPrice,
              currentPrice: simulatedPrice,
              targetPrice: alert.targetPrice,
              targetType: alert.targetType,
              event: 'VCP_BASE_FORMED',
              triggered: true,
            });

            newToast = {
              alert: { ...alert, status: 'TRIGGERED' as const },
              previousPrice,
              currentPrice: simulatedPrice,
              crossoverType: 'VCP_BASE_FORMED',
              triggeredAt: new Date().toLocaleTimeString(),
              isPortfolioHolding: isPortfolio,
              portfolioHolding: portfolioMatch,
            };

            return {
              ...alert,
              currentPrice: simulatedPrice,
              status: 'TRIGGERED' as const,
              triggeredAt: new Date().toLocaleTimeString(),
            };
          }
        }

        return { ...alert, currentPrice: simulatedPrice };
      });

      if (hasUpdates) {
        saveStoredAlerts(updatedAlerts);
        window.dispatchEvent(new CustomEvent('minervini_alerts_updated'));
      }

      if (newToast) {
        setActiveToast(newToast);
      }

      setLastCheckTime(new Date().toLocaleTimeString());
      setChecksCount((c) => c + 1);
    }, 3500);

    return () => clearInterval(interval);
  }, [backgroundRunning]);

  // Manual Trigger Simulation for User Testing
  const triggerSimulatedPortfolioToast = (type: 'PORTFOLIO_PIVOT_CROSSOVER' | 'PORTFOLIO_STOP_LOSS_HIT') => {
    let portfolioHoldings: PortfolioHolding[] = [];
    try {
      const raw = localStorage.getItem('minervini_sepa_portfolio');
      if (raw) portfolioHoldings = JSON.parse(raw);
    } catch (e) {
      console.error(e);
    }

    const testHolding = portfolioHoldings[0] || {
      id: 'test-nvda',
      ticker: 'NVDA',
      stockName: 'NVIDIA Corporation',
      exchange: 'NASDAQ',
      shares: 100,
      entryPrice: 128.5,
      currentPrice: 154.5,
      buyDate: '2026-07-10',
      stopLossPrice: 122.0,
      pivotTargetPrice: 154.2,
    };

    playAlertChime();

    const simulatedPrice =
      type === 'PORTFOLIO_PIVOT_CROSSOVER'
        ? Number((testHolding.pivotTargetPrice + 0.8).toFixed(2))
        : Number((testHolding.stopLossPrice - 0.6).toFixed(2));

    setActiveToast({
      alert: {
        id: `sim-${Date.now()}`,
        ticker: testHolding.ticker,
        stockName: testHolding.stockName,
        targetType: type === 'PORTFOLIO_PIVOT_CROSSOVER' ? 'PIVOT_ENTRY' : 'STOP_LOSS',
        targetPrice: type === 'PORTFOLIO_PIVOT_CROSSOVER' ? testHolding.pivotTargetPrice : testHolding.stopLossPrice,
        triggerProximityPercent: 1.5,
        currentPrice: simulatedPrice,
        status: 'TRIGGERED',
        createdAt: new Date().toLocaleDateString(),
        exchange: testHolding.exchange,
        notes: '💼 Simulated Real-Time Portfolio Threshold Alert',
      },
      previousPrice: testHolding.entryPrice,
      currentPrice: simulatedPrice,
      crossoverType: type,
      triggeredAt: new Date().toLocaleTimeString(),
      isPortfolioHolding: true,
      portfolioHolding: testHolding,
    });
  };

  // View News Grounding handler
  const handleViewNews = () => {
    if (!activeToast) return;
    const match = stocks.find((s) => s.ticker === activeToast.alert.ticker);
    if (match) onSelectStock(match);
    onNavigateTab('screener');
    setActiveToast(null);
    setTimeout(() => {
      const el = document.getElementById('ticker-news-grounding-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);
  };

  // View Portfolio handler
  const handleViewPortfolio = () => {
    if (!activeToast) return;
    const match = stocks.find((s) => s.ticker === activeToast.alert.ticker);
    if (match) onSelectStock(match);
    onNavigateTab('portfolio');
    setActiveToast(null);
  };

  // View Chart handler
  const handleViewChart = () => {
    if (!activeToast) return;
    const match = stocks.find((s) => s.ticker === activeToast.alert.ticker);
    if (match) onSelectStock(match);
    onNavigateTab('chart');
    setActiveToast(null);
  };

  // Re-arm triggered alert
  const handleRearmAlert = () => {
    if (!activeToast) return;
    const stored = getStoredAlerts();
    const updated = stored.map((a) =>
      a.id === activeToast.alert.id
        ? { ...a, status: 'ACTIVE' as const, triggeredAt: undefined }
        : a
    );
    saveStoredAlerts(updated);
    window.dispatchEvent(new CustomEvent('minervini_alerts_updated'));
    setActiveToast(null);
  };

  const toggleAudioMute = () => {
    const updated: AudioSettings = {
      ...audioSettings,
      enabled: !audioSettings.enabled,
    };
    setAudioSettings(updated);
    saveAudioSettings(updated);
    if (updated.enabled) {
      playVolumeSpikeChime();
    }
  };

  const handleVolumeChange = (vol: number) => {
    const updated: AudioSettings = {
      ...audioSettings,
      volume: vol,
    };
    setAudioSettings(updated);
    saveAudioSettings(updated);
  };

  if (!activeToast) {
    return (
      <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end space-y-1.5 font-mono text-xs">
        {/* Expandable Quick Test Simulation Panel */}
        {isTestDrawerOpen && (
          <div className="bg-[#1a1a1a] text-white p-3 border border-amber-500/50 shadow-2xl space-y-2 max-w-xs animate-slide-up">
            <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center space-x-1">
                <Zap className="w-3 h-3" />
                <span>Simulate Real-Time Alerts</span>
              </span>
              <button
                onClick={() => setIsTestDrawerOpen(false)}
                className="text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            <p className="text-[10px] text-gray-300 font-sans leading-tight">
              Test real-time notification toasts and subtle audio alerts:
            </p>

            {/* Audio Settings Inline Mini Control */}
            <div className="bg-white/5 p-2 border border-white/10 space-y-1 text-[10px]">
              <div className="flex items-center justify-between">
                <span className="text-gray-300 flex items-center gap-1">
                  {audioSettings.enabled ? <Volume2 className="w-3 h-3 text-amber-400" /> : <VolumeX className="w-3 h-3 text-rose-400" />}
                  <span>Subtle Browser Audio:</span>
                </span>
                <button
                  onClick={toggleAudioMute}
                  className={`px-2 py-0.5 font-bold uppercase rounded text-[9px] cursor-pointer ${
                    audioSettings.enabled
                      ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                      : 'bg-rose-500/30 text-rose-300 border border-rose-500/50 hover:bg-rose-500/50'
                  }`}
                >
                  {audioSettings.enabled ? 'ON' : 'MUTED'}
                </button>
              </div>

              {audioSettings.enabled && (
                <div className="flex items-center space-x-2 pt-1">
                  <span className="text-gray-400 text-[9px]">Volume:</span>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.05"
                    value={audioSettings.volume}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    className="w-full accent-amber-400 h-1 bg-white/20 rounded cursor-pointer"
                  />
                  <span className="text-amber-300 font-bold text-[9px]">
                    {Math.round(audioSettings.volume * 100)}%
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-1.5 pt-1">
              <button
                onClick={() => {
                  const stock = stocks[0];
                  playVolumeSpikeChime();
                  triggerWatchlistAudioAlert(stock, 'VOLUME_SPIKE', {
                    forceChime: true,
                    customDescription: `⚡ Extreme Volume Surge: ${stock.ticker} is trading at 2.8x 20-day average volume at pivot ₹${stock.pivotPrice}.`,
                  });
                }}
                className="bg-purple-600 hover:bg-purple-500 text-white px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center space-x-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Volume2 className="w-3 h-3 text-purple-200" />
                <span>Test Volume Spike Chime 🔔</span>
              </button>

              <button
                onClick={() => {
                  const stock = stocks[0];
                  playHighConvictionBreakoutChime();
                  triggerWatchlistAudioAlert(stock, 'HIGH_CONVICTION_BREAKOUT', {
                    forceChime: true,
                    customDescription: `🎯 High-Conviction Setup: ${stock.ticker} confirmed 8/8 Trend Template & RS ${stock.rsRating} with VCP contraction coil!`,
                  });
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center space-x-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Sparkles className="w-3 h-3 text-emerald-200" />
                <span>Test Breakout Setup Chime 🎵</span>
              </button>

              <button
                onClick={() => triggerSimulatedPortfolioToast('PORTFOLIO_PIVOT_CROSSOVER')}
                className="bg-emerald-700 hover:bg-emerald-600 text-white px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center space-x-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Target className="w-3 h-3" />
                <span>Test Pivot Target Breakout</span>
              </button>

              <button
                onClick={() => triggerSimulatedPortfolioToast('PORTFOLIO_STOP_LOSS_HIT')}
                className="bg-rose-600 hover:bg-rose-500 text-white px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center space-x-1.5 shadow-sm transition-all cursor-pointer"
              >
                <ShieldAlert className="w-3 h-3" />
                <span>Test Stop Loss Level Hit</span>
              </button>

              <button
                onClick={() => {
                  const stock = stocks[0];
                  simulateWatchlistMajorNewsAlert(stock);
                }}
                className="bg-amber-600 hover:bg-amber-500 text-white px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center space-x-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Newspaper className="w-3 h-3" />
                <span>Test Watchlist Major News Toast</span>
              </button>

              <button
                onClick={() => {
                  const stock = stocks[0];
                  simulateSmartMoneyDivergenceAlert(stock, 'BULLISH_ACCUMULATION');
                }}
                className="bg-cyan-700 hover:bg-cyan-600 text-white px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center space-x-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Flame className="w-3 h-3 text-cyan-200" />
                <span>Test Smart Money Accumulation Alert 💎</span>
              </button>

              <button
                onClick={() => {
                  const res = runDailyStage2Scan(stocks, { isScheduled: true, force: true });
                  dispatchStage2DailyScanNotification(res);
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center space-x-1.5 shadow-sm transition-all cursor-pointer border border-emerald-400/40"
              >
                <Sparkles className="w-3 h-3 text-amber-300 animate-pulse" />
                <span>Test Scheduled Daily Stage 2 Scan 🎯</span>
              </button>
            </div>
          </div>
        )}

        {/* Minimal Bottom Monitor Status Pill */}
        <div className="flex items-center space-x-2 bg-[#1a1a1a] text-white px-3 py-1.5 border border-amber-500/40 text-[10px] font-mono shadow-lg rounded-none opacity-90 hover:opacity-100 transition-opacity">
          <Activity className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          <span>
            Watchlist Audio & Pivot Monitor: <strong className="text-emerald-400">LIVE</strong>
          </span>

          <button
            onClick={toggleAudioMute}
            title={audioSettings.enabled ? 'Click to Mute Alert Audio' : 'Click to Enable Alert Audio'}
            className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white cursor-pointer transition-colors"
          >
            {audioSettings.enabled ? (
              <Volume2 className="w-3 h-3 text-emerald-400" />
            ) : (
              <VolumeX className="w-3 h-3 text-rose-400" />
            )}
            <span className="text-[9px] uppercase font-bold">
              {audioSettings.enabled ? 'Audio ON' : 'Muted'}
            </span>
          </button>

          <button
            onClick={() => setIsTestDrawerOpen(!isTestDrawerOpen)}
            className="ml-2 bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 px-2 py-0.5 border border-amber-500/30 text-[9px] font-bold uppercase flex items-center space-x-1 transition-colors cursor-pointer"
          >
            <span>Test Alerts</span>
            {isTestDrawerOpen ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronUp className="w-2.5 h-2.5" />}
          </button>
        </div>
      </div>
    );
  }

  const currencySymbol = getCurrencySymbol(activeToast.alert.exchange);
  const isPortfolio = activeToast.isPortfolioHolding || activeToast.crossoverType.startsWith('PORTFOLIO');
  const isPivot = activeToast.crossoverType === 'PIVOT_CROSSOVER' || activeToast.crossoverType === 'PORTFOLIO_PIVOT_CROSSOVER';
  const isStopHit = activeToast.crossoverType === 'STOP_LOSS_HIT' || activeToast.crossoverType === 'PORTFOLIO_STOP_LOSS_HIT';
  const isVolatility = activeToast.crossoverType === 'VOLATILITY_DRYUP';
  const isStage2 = activeToast.crossoverType === 'STAGE_2_COMPLETED';
  const isVcpBase = activeToast.crossoverType === 'VCP_BASE_FORMED';
  const isMajorNews = activeToast.crossoverType === 'MAJOR_NEWS_CATALYST';
  const isVolumeSpike = activeToast.crossoverType === 'VOLUME_SPIKE';
  const isHighConvictionBreakout = activeToast.crossoverType === 'HIGH_CONVICTION_BREAKOUT';
  const newsPayload = activeToast.majorNewsPayload;
  const volumeBreakoutPayload = activeToast.volumeBreakoutPayload;

  const holding = activeToast.portfolioHolding;
  const shares = holding ? holding.shares : 50;
  const entryPrice = holding ? holding.entryPrice : activeToast.previousPrice;
  const positionValue = shares * activeToast.currentPrice;
  const positionCost = shares * entryPrice;
  const pnlDollar = positionValue - positionCost;
  const pnlPercent = entryPrice > 0 ? ((activeToast.currentPrice - entryPrice) / entryPrice) * 100 : 0;

  // Render Specialized Major News Catalyst Toast Card
  if (isMajorNews && newsPayload) {
    return (
      <div className="fixed top-5 right-5 z-50 max-w-xl w-full animate-slide-down shadow-2xl">
        <div className="p-5 border-2 bg-[#120e09] text-white border-amber-400 shadow-amber-500/30">
          {/* Top Header Tag */}
          <div className="flex items-start justify-between border-b border-white/15 pb-2.5 mb-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 bg-amber-400 text-black flex items-center justify-center font-bold">
                <Newspaper className="w-5 h-5" />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] uppercase font-mono tracking-[0.2em] font-extrabold text-amber-400 block">
                    ⚡ WATCHLIST MAJOR NEWS DETECTED
                  </span>
                  <span className="bg-[#1a1a1a] text-amber-300 border border-amber-500/40 text-[9px] font-black uppercase px-2 py-0.5 font-mono">
                    Google Search Grounded
                  </span>
                  {newsPayload.watchlistName && (
                    <span className="bg-amber-400 text-black text-[9px] font-black uppercase px-2 py-0.5 font-mono">
                      {newsPayload.watchlistName}
                    </span>
                  )}
                </div>

                <h4 className="text-lg font-mono font-black text-white leading-tight mt-0.5">
                  {newsPayload.ticker} ({newsPayload.exchange || 'NASDAQ'}) — {newsPayload.stockName}
                </h4>
              </div>
            </div>

            <button
              onClick={() => setActiveToast(null)}
              className="text-gray-400 hover:text-white p-1 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Breaking Headline Detail Block */}
          <div className="bg-white/5 border border-white/10 p-3.5 mb-3 font-mono text-xs space-y-2.5">
            <div className="flex items-center justify-between text-[10px] pb-1.5 border-b border-white/10">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-gray-300 uppercase flex items-center space-x-1">
                  <Globe className="w-3 h-3 text-amber-400" />
                  <span>{newsPayload.source}</span>
                </span>
                <span className="text-gray-400">• {newsPayload.date}</span>
              </div>
              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 font-bold uppercase tracking-wider text-[9px]">
                {newsPayload.catalystType || 'High-Impact Catalyst'}
              </span>
            </div>

            <h3 className="text-sm font-serif font-black text-amber-100 leading-snug">
              {newsPayload.headlineTitle}
            </h3>

            <p className="text-xs font-sans text-gray-300 leading-relaxed italic">
              "{newsPayload.snippet}"
            </p>

            {newsPayload.summary && (
              <div className="bg-black/40 p-2.5 border-l-2 border-amber-400 text-[11px] font-sans text-gray-200">
                <strong className="text-amber-300 font-serif">SEPA Catalyst Alignment: </strong>
                {newsPayload.summary}
              </div>
            )}

            {newsPayload.groundingSources && newsPayload.groundingSources.length > 0 && (
              <div className="pt-1 flex flex-wrap items-center gap-2 text-[10px]">
                <span className="text-gray-400">Source:</span>
                {newsPayload.groundingSources.slice(0, 2).map((src, i) => (
                  <a
                    key={i}
                    href={src.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-300 hover:underline flex items-center space-x-1 truncate max-w-[200px]"
                  >
                    <ExternalLink className="w-2.5 h-2.5" />
                    <span className="truncate">{src.title}</span>
                  </a>
                ))}
              </div>
            )}

            <div className="text-[10px] text-gray-400 border-t border-white/10 pt-1.5 flex justify-between">
              <span>Listener Triggered At:</span>
              <span className="text-gray-200 font-bold">{newsPayload.triggeredAt}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-2 text-xs font-mono">
            <button
              onClick={() => setActiveToast(null)}
              className="bg-white/10 hover:bg-white/20 text-gray-200 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors border border-white/20"
            >
              Dismiss
            </button>

            <button
              onClick={handleViewChart}
              className="bg-white/10 hover:bg-white/20 text-amber-300 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider flex items-center space-x-1.5 transition-all border border-amber-400/40"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Open Chart</span>
            </button>

            <button
              onClick={handleViewNews}
              className="bg-amber-400 hover:bg-amber-300 text-black px-4 py-1.5 text-[11px] font-black uppercase tracking-wider flex items-center space-x-1.5 transition-all shadow-md"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Inspect Grounded News</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render Specialized Smart Money Sentiment vs Price Divergence Toast Card
  const divergencePayload = activeToast.divergencePayload;
  const isDivergence = activeToast.crossoverType === 'SMART_MONEY_DIVERGENCE' && Boolean(divergencePayload);

  if (isDivergence && divergencePayload) {
    const isBullish =
      divergencePayload.divergenceType === 'BULLISH_ACCUMULATION' ||
      divergencePayload.divergenceType === 'HIDDEN_ACCUMULATION';

    return (
      <div className="fixed top-5 right-5 z-50 max-w-xl w-full animate-slide-down shadow-2xl">
        <div
          className={`p-5 border-2 ${
            isBullish
              ? 'bg-[#0a1618] text-white border-cyan-400 shadow-cyan-500/30'
              : 'bg-[#220a0f] text-white border-rose-500 shadow-rose-500/30'
          }`}
        >
          {/* Top Header */}
          <div className="flex items-start justify-between border-b border-white/15 pb-2.5 mb-3">
            <div className="flex items-center space-x-2.5">
              <div
                className={`w-8 h-8 flex items-center justify-center font-bold ${
                  isBullish ? 'bg-cyan-400 text-slate-950 animate-pulse' : 'bg-rose-500 text-white'
                }`}
              >
                <Flame className="w-5 h-5" />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`text-[10px] uppercase font-mono tracking-[0.2em] font-extrabold block ${
                      isBullish ? 'text-cyan-300' : 'text-rose-300'
                    }`}
                  >
                    {isBullish ? '🔥 SMART MONEY ACCUMULATION DIVERGENCE' : '⚠️ SMART MONEY DISTRIBUTION DETECTED'}
                  </span>
                  <span
                    className={`text-[9px] font-black uppercase px-2 py-0.5 font-mono ${
                      isBullish ? 'bg-cyan-400 text-slate-950' : 'bg-rose-500 text-white'
                    }`}
                  >
                    {divergencePayload.institutionalPhase} PHASE
                  </span>
                  <span className="bg-white/10 text-gray-200 border border-white/20 text-[9px] font-black uppercase px-1.5 py-0.5 font-mono">
                    Conviction: {divergencePayload.convictionScore}/10
                  </span>
                </div>

                <h4 className="text-lg font-mono font-black text-white leading-tight mt-0.5">
                  {divergencePayload.ticker} ({divergencePayload.exchange || 'NASDAQ'}) — {divergencePayload.stockName}
                </h4>
              </div>
            </div>

            <button
              onClick={() => setActiveToast(null)}
              className="text-gray-400 hover:text-white p-1 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Divergence Metrics & Comparison Grid */}
          <div className="bg-white/5 border border-white/10 p-3.5 mb-3 font-mono text-xs space-y-2.5">
            <div className="grid grid-cols-2 gap-2 pb-2 border-b border-white/10">
              <div className="bg-black/30 p-2 border border-white/10">
                <span className="text-gray-400 text-[10px] uppercase font-bold block">
                  Price Action ({divergencePayload.lookbackDays}D):
                </span>
                <div className="flex items-center space-x-1.5 mt-0.5">
                  <span
                    className={`text-sm font-extrabold ${
                      divergencePayload.priceSlope <= 0 ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                  >
                    {divergencePayload.priceSlope > 0 ? '+' : ''}
                    {divergencePayload.priceSlope}%
                  </span>
                  <span className="text-[10px] text-gray-400">
                    ({currencySymbol}{divergencePayload.priceStart} &rarr; {currencySymbol}{divergencePayload.priceEnd})
                  </span>
                </div>
              </div>

              <div className="bg-black/30 p-2 border border-white/10">
                <span className="text-gray-400 text-[10px] uppercase font-bold block">
                  News Sentiment MA:
                </span>
                <div className="flex items-center space-x-1.5 mt-0.5">
                  <span
                    className={`text-sm font-extrabold ${
                      divergencePayload.sentimentSlope >= 0 ? 'text-cyan-400' : 'text-rose-400'
                    }`}
                  >
                    {divergencePayload.sentimentSlope > 0 ? '+' : ''}
                    {divergencePayload.sentimentSlope} pts
                  </span>
                  <span className="text-[10px] text-gray-400">
                    ({divergencePayload.sentimentStart} &rarr; {divergencePayload.sentimentEnd}/100)
                  </span>
                </div>
              </div>
            </div>

            <p className="text-xs font-sans text-gray-200 leading-relaxed">
              {divergencePayload.description}
            </p>

            <div className="bg-black/40 p-2.5 border-l-2 border-cyan-400 text-[11px] font-sans text-gray-200">
              <strong className="text-cyan-300 font-serif">Mark Minervini SEPA Playbook: </strong>
              {divergencePayload.sepaPlaybook}
            </div>

            <div className="text-[10px] text-gray-400 border-t border-white/10 pt-1.5 flex justify-between">
              <span>Divergence Detected At:</span>
              <span className="text-gray-200 font-bold">{divergencePayload.triggeredAt}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-2 text-xs font-mono">
            <button
              onClick={() => playSmartMoneyDivergenceChime(isBullish ? 'BULLISH' : 'BEARISH')}
              title="Replay smart money chime"
              className="bg-white/10 hover:bg-white/20 text-cyan-300 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider flex items-center space-x-1 transition-colors border border-cyan-400/40 cursor-pointer"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Chime</span>
            </button>

            <button
              onClick={() => setActiveToast(null)}
              className="bg-white/10 hover:bg-white/20 text-gray-200 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors border border-white/20 cursor-pointer"
            >
              Dismiss
            </button>

            <button
              onClick={handleViewNews}
              className="bg-white/10 hover:bg-white/20 text-cyan-300 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider flex items-center space-x-1.5 transition-all border border-cyan-400/40 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>D3 Sentiment Grounding</span>
            </button>

            <button
              onClick={handleViewChart}
              className={`px-4 py-1.5 text-[11px] font-black uppercase tracking-wider flex items-center space-x-1.5 transition-all shadow-md cursor-pointer ${
                isBullish ? 'bg-cyan-400 hover:bg-cyan-300 text-slate-950' : 'bg-rose-500 hover:bg-rose-400 text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>View Chart</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render Specialized Scheduled Daily Stage 2 Breakout Scan Toast Card
  const stage2ScanPayload = activeToast.stage2ScanPayload;
  const isDailyStage2Scan = activeToast.crossoverType === 'STAGE_2_DAILY_SCAN' && Boolean(stage2ScanPayload);

  if (isDailyStage2Scan && stage2ScanPayload) {
    const { result, topCandidates } = stage2ScanPayload;

    return (
      <div className="fixed top-5 right-5 z-50 max-w-xl w-full animate-slide-down shadow-2xl">
        <div className="p-5 border-2 bg-[#09151c] text-white border-amber-400 shadow-amber-500/30">
          {/* Top Header Tag */}
          <div className="flex items-start justify-between border-b border-white/15 pb-2.5 mb-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 bg-amber-400 text-slate-950 flex items-center justify-center font-black animate-pulse shadow-md">
                <Sparkles className="w-5 h-5" />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] uppercase font-mono tracking-[0.2em] font-extrabold text-amber-300 block">
                    🎯 SCHEDULED DAILY SCAN: STAGE 2 BREAKOUTS
                  </span>
                  <span className="bg-amber-400 text-slate-950 text-[9px] font-black uppercase px-2 py-0.5 font-mono">
                    {result.qualifiedCount} Leaders Found
                  </span>
                  {result.newBreakoutsCount > 0 && (
                    <span className="bg-emerald-500 text-slate-950 text-[9px] font-black uppercase px-2 py-0.5 font-mono animate-pulse">
                      {result.newBreakoutsCount} New Breakouts
                    </span>
                  )}
                </div>

                <h4 className="text-lg font-mono font-black text-white leading-tight mt-0.5">
                  Minervini Stage 2 Trend Template Scan Complete
                </h4>
              </div>
            </div>

            <button
              onClick={() => setActiveToast(null)}
              className="text-gray-400 hover:text-white p-1 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Qualified Candidates Summary List */}
          <div className="bg-white/5 border border-white/10 p-3.5 mb-3 font-mono text-xs space-y-2.5">
            <div className="flex items-center justify-between text-[10px] text-gray-300 border-b border-white/10 pb-1.5">
              <span>Automated Scan Executed at {stage2ScanPayload.triggeredAt}</span>
              <span className="text-amber-400 font-bold">Scanned {result.totalStocksScanned} Equities</span>
            </div>

            <p className="text-xs font-sans text-gray-200 leading-snug">
              {result.marketSummary}
            </p>

            {/* Candidates Quick Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {topCandidates.map((c) => {
                const currSym = getCurrencySymbol(c.exchange);
                return (
                  <div
                    key={c.ticker}
                    onClick={() => {
                      onSelectStock(c.stock);
                      onNavigateTab('chart');
                      setActiveToast(null);
                    }}
                    className="bg-black/40 hover:bg-black/70 border border-white/15 hover:border-amber-400 p-2 space-y-1 cursor-pointer transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-amber-300 font-mono text-xs">
                        {c.ticker}
                      </span>
                      <span className="text-[9px] bg-emerald-950 text-emerald-300 border border-emerald-700 px-1 font-bold">
                        RS {c.rsRating}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-gray-300">
                      <span>{formatCurrency(c.currentPrice, currSym)}</span>
                      <span
                        className={`font-bold ${
                          c.distanceToPivotPct >= 0 ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {c.distanceToPivotPct >= 0 ? '+' : ''}
                        {c.distanceToPivotPct}% to Pivot
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[9px] text-gray-400">
                      <span>Trend: {c.trendScore}/8 Rules</span>
                      <span className="uppercase text-amber-400 font-semibold">{c.breakoutStatus.replace('_', ' ')}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-black/40 p-2 border-l-2 border-amber-400 text-[11px] font-sans text-gray-200">
              <strong className="text-amber-300 font-serif">Mark Minervini SEPA Principle: </strong>
              Stocks in verified Stage 2 uptrends with upward sloping 200-day SMAs and Relative Strength &ge; 70 represent 90%+ of all superperformance market leaders.
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-end gap-2 text-xs font-mono">
            <button
              onClick={() => playHighConvictionBreakoutChime()}
              title="Replay breakout chime"
              className="bg-white/10 hover:bg-white/20 text-amber-300 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider flex items-center space-x-1 transition-colors border border-amber-400/40 cursor-pointer"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Chime</span>
            </button>

            <button
              onClick={() => setActiveToast(null)}
              className="bg-white/10 hover:bg-white/20 text-gray-200 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors border border-white/20 cursor-pointer"
            >
              Dismiss
            </button>

            <button
              onClick={() => {
                if (topCandidates.length > 0) {
                  onSelectStock(topCandidates[0].stock);
                  onNavigateTab('chart');
                }
                setActiveToast(null);
              }}
              className="bg-white/10 hover:bg-white/20 text-cyan-300 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider flex items-center space-x-1.5 transition-all border border-cyan-400/40 cursor-pointer"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>View Leader Chart</span>
            </button>

            <button
              onClick={() => {
                if (onOpenDailyScanner) {
                  onOpenDailyScanner();
                } else {
                  window.dispatchEvent(new CustomEvent('minervini_open_daily_stage2_scanner'));
                }
                setActiveToast(null);
              }}
              className="bg-amber-400 hover:bg-amber-300 text-slate-950 px-4 py-1.5 text-[11px] font-black uppercase tracking-wider flex items-center space-x-1.5 transition-all shadow-md cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Inspect All {result.qualifiedCount} Leaders</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed top-5 right-5 z-50 max-w-lg w-full animate-slide-down shadow-2xl">
      <div
        className={`p-5 border-2 ${
          isVolumeSpike
            ? 'bg-[#180d28] text-white border-purple-400 shadow-purple-500/30'
            : isHighConvictionBreakout
            ? 'bg-[#061e18] text-white border-emerald-400 shadow-emerald-500/30'
            : isPortfolio && isPivot
            ? 'bg-[#0a1a12] text-white border-emerald-400 shadow-emerald-500/30'
            : isPortfolio && isStopHit
            ? 'bg-[#21090c] text-white border-rose-500 shadow-rose-500/30'
            : isStage2
            ? 'bg-[#0f1d24] text-white border-cyan-400 shadow-cyan-500/30'
            : isVcpBase
            ? 'bg-[#1a142e] text-white border-amber-400 shadow-amber-500/30'
            : isVolatility
            ? 'bg-[#150d2a] text-white border-purple-400 shadow-purple-500/30'
            : isPivot
            ? 'bg-[#131722] text-white border-amber-400 shadow-amber-500/20'
            : 'bg-rose-950 text-white border-rose-500 shadow-rose-500/20'
        }`}
      >
        {/* Top Header Tag */}
        <div className="flex items-start justify-between border-b border-white/15 pb-2.5 mb-3">
          <div className="flex items-center space-x-2.5">
            <div
              className={`w-8 h-8 flex items-center justify-center font-bold ${
                isVolumeSpike
                  ? 'bg-purple-500 text-white animate-bounce'
                  : isHighConvictionBreakout
                  ? 'bg-emerald-400 text-slate-950 animate-pulse'
                  : isPortfolio && isPivot
                  ? 'bg-emerald-500 text-black'
                  : isPortfolio && isStopHit
                  ? 'bg-rose-600 text-white'
                  : isStage2
                  ? 'bg-cyan-400 text-black'
                  : isVcpBase
                  ? 'bg-amber-400 text-black'
                  : isVolatility
                  ? 'bg-purple-500 text-white'
                  : isPivot
                  ? 'bg-amber-400 text-black'
                  : 'bg-rose-500 text-white'
              }`}
            >
              {isVolumeSpike ? (
                <Volume2 className="w-5 h-5" />
              ) : isHighConvictionBreakout ? (
                <Sparkles className="w-5 h-5" />
              ) : isPortfolio ? (
                <Briefcase className="w-5 h-5" />
              ) : isStage2 ? (
                <Sparkles className="w-5 h-5" />
              ) : isVcpBase ? (
                <Zap className="w-5 h-5" />
              ) : isVolatility ? (
                <Activity className="w-5 h-5" />
              ) : isPivot ? (
                <Target className="w-5 h-5" />
              ) : (
                <ShieldAlert className="w-5 h-5" />
              )}
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <span
                  className={`text-[10px] uppercase font-mono tracking-[0.2em] font-extrabold block ${
                    isVolumeSpike
                      ? 'text-purple-300'
                      : isHighConvictionBreakout
                      ? 'text-emerald-300'
                      : isPortfolio
                      ? 'text-amber-300'
                      : 'text-amber-400'
                  }`}
                >
                  {isVolumeSpike
                    ? '⚡ WATCHLIST VOLUME SPIKE DETECTED'
                    : isHighConvictionBreakout
                    ? '🎯 HIGH-CONVICTION BREAKOUT SETUP'
                    : isPortfolio && isPivot
                    ? '💼 PORTFOLIO POSITION BREAKOUT'
                    : isPortfolio && isStopHit
                    ? '💼 PORTFOLIO STOP LOSS TRIGGERED'
                    : isStage2
                    ? '🎯 STAGE 2 CRITERIA COMPLETED'
                    : isVcpBase
                    ? '⚡ VCP BASE FORMED & COILED'
                    : isVolatility
                    ? '⚡ VCP VOLATILITY DRY-UP PRIMED'
                    : isPivot
                    ? '🎯 PIVOT ENTRY CROSSOVER'
                    : '🚨 STOP LOSS HIT WARNING'}
                </span>
                {isVolumeSpike && (
                  <span className="bg-purple-500 text-white text-[9px] font-black uppercase px-1.5 py-0.5 rounded">
                    Audio Chime Fired 🔔
                  </span>
                )}
                {isHighConvictionBreakout && (
                  <span className="bg-emerald-500 text-slate-950 text-[9px] font-black uppercase px-1.5 py-0.5 rounded">
                    Alpha Setup 🎵
                  </span>
                )}
                {isPortfolio && (
                  <span className="bg-amber-400 text-black text-[9px] font-black uppercase px-1.5 py-0.5">
                    Portfolio Stock
                  </span>
                )}
              </div>

              <h4 className="text-lg font-mono font-black text-white leading-tight">
                {activeToast.alert.ticker} ({activeToast.alert.exchange || 'NASDAQ'}) — {activeToast.alert.stockName}
                {isPortfolio && <span className="text-xs font-normal text-gray-300 ml-2">[{shares} Shares]</span>}
              </h4>
            </div>
          </div>

          <button
            onClick={() => setActiveToast(null)}
            className="text-gray-400 hover:text-white p-1 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Crossover & Surge Detail Grid */}
        <div className="bg-white/5 border border-white/10 p-3.5 mb-3 font-mono text-xs space-y-2">
          <div className="grid grid-cols-2 gap-2 pb-2 border-b border-white/10">
            <div>
              <span className="text-gray-300 text-[10px] uppercase font-bold block">
                {isVolumeSpike || isHighConvictionBreakout ? 'Pivot Entry Level:' : isPivot ? 'Target Pivot Price:' : 'Stop Loss Threshold:'}
              </span>
              <span className="text-amber-300 font-extrabold text-sm">
                {formatCurrency(activeToast.alert.targetPrice, currencySymbol)}
              </span>
            </div>

            <div>
              <span className="text-gray-300 text-[10px] uppercase font-bold block">
                {isVolumeSpike ? 'Live Volume Surge:' : 'Live Price:'}
              </span>
              <span
                className={`text-sm font-black ${
                  isVolumeSpike
                    ? 'text-purple-300 animate-pulse'
                    : isHighConvictionBreakout || isPivot
                    ? 'text-emerald-400 animate-pulse'
                    : 'text-rose-400 animate-pulse'
                }`}
              >
                {isVolumeSpike && volumeBreakoutPayload
                  ? `${volumeBreakoutPayload.volumeRatio}x 20-Day Avg`
                  : formatCurrency(activeToast.currentPrice, currencySymbol)}
              </span>
            </div>
          </div>

          {/* Volume Breakout Key Metrics */}
          {volumeBreakoutPayload && (
            <div className="bg-black/40 p-2 border border-white/10 grid grid-cols-3 gap-2 text-center text-[10px]">
              <div>
                <span className="text-gray-400 block uppercase">Volume Ratio</span>
                <strong className="text-purple-300 font-black text-xs font-mono">
                  {volumeBreakoutPayload.volumeRatio}x
                </strong>
              </div>
              <div>
                <span className="text-gray-400 block uppercase">Dry-up Pre-Breakout</span>
                <strong className="text-emerald-300 font-black text-xs font-mono">
                  {volumeBreakoutPayload.volumeDryUpPercent}%
                </strong>
              </div>
              <div>
                <span className="text-gray-400 block uppercase">Conviction Score</span>
                <strong className="text-amber-300 font-black text-xs font-mono">
                  {volumeBreakoutPayload.breakoutProbability}%
                </strong>
              </div>
            </div>
          )}

          {/* Portfolio P&L Summary Block */}
          {isPortfolio && (
            <div className="bg-black/30 p-2 border border-white/10 space-y-1">
              <div className="flex justify-between items-center text-[10px] text-gray-300 uppercase">
                <span>Entry Price: {formatCurrency(entryPrice, currencySymbol)}</span>
                <span>Shares: {shares}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-gray-200">Position Un-Realized P&L:</span>
                <span
                  className={`font-black font-mono text-xs ${
                    pnlDollar >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {pnlDollar >= 0 ? '+' : ''}
                  {formatCurrency(pnlDollar, currencySymbol)} ({pnlPercent >= 0 ? '+' : ''}
                  {pnlPercent.toFixed(2)}%)
                </span>
              </div>
            </div>
          )}

          {/* Minervini Trade Management Discipline Rule */}
          <div className="text-[11px] font-sans text-gray-200 leading-relaxed pt-1">
            {isVolumeSpike ? (
              <p>
                <strong className="text-purple-300 font-serif italic">Mark Minervini SEPA Rule:</strong> Institutional accumulation confirmed. Heavy volume spike ({volumeBreakoutPayload?.volumeRatio || 2.5}x average) indicates large funds stepping in at the pivot. A subtle browser audio chime was triggered for real-time awareness.
              </p>
            ) : isHighConvictionBreakout ? (
              <p>
                <strong className="text-emerald-300 font-serif italic">High-Conviction Setup:</strong> Stock satisfies all 8 Stage 2 Trend Template rules, boasts top Relative Strength (RS rating &ge; 85), and displays proper VCP contraction tightness.
              </p>
            ) : isPivot ? (
              <p>
                <strong className="text-emerald-300 font-serif italic">SEPA Discipline Rule:</strong> Position crossed
                its pivot entry price on expanding volume. Consider taking partial 20-25% profits into strength or trailing
                stops up to entry level.
              </p>
            ) : isStopHit ? (
              <p>
                <strong className="text-rose-300 font-serif italic">Mark Minervini Rule:</strong> Price crossed hard stop
                loss threshold ({formatCurrency(activeToast.alert.targetPrice, currencySymbol)}). Preserve trading capital
                by executing stop immediately — never hold and hope!
              </p>
            ) : (
              <p>
                <strong className="text-purple-300 font-serif italic">VCP Setup Primed:</strong> Stock entered tight 3-week
                contraction range with extreme volume dry-up. Prepare for pivot breakout order!
              </p>
            )}
          </div>

          <div className="text-[10px] text-gray-400 border-t border-white/10 pt-1 flex justify-between">
            <span>Triggered At:</span>
            <span className="text-gray-200 font-bold">{activeToast.triggeredAt}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-2 text-xs font-mono">
          <button
            onClick={() => {
              if (isVolumeSpike) {
                playVolumeSpikeChime();
              } else {
                playHighConvictionBreakoutChime();
              }
            }}
            title="Replay subtle audio chime"
            className="bg-white/10 hover:bg-white/20 text-purple-300 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider flex items-center space-x-1 transition-colors border border-purple-400/40 cursor-pointer"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Replay Chime</span>
          </button>

          <button
            onClick={handleRearmAlert}
            className="bg-white/10 hover:bg-white/20 text-gray-200 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider flex items-center space-x-1 transition-colors border border-white/20 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3 text-blue-400" />
            <span>Re-arm</span>
          </button>

          {isPortfolio && (
            <button
              onClick={handleViewPortfolio}
              className="bg-emerald-500 hover:bg-emerald-400 text-black px-3.5 py-1.5 text-[11px] font-black uppercase tracking-wider flex items-center space-x-1.5 transition-all shadow-md cursor-pointer"
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>View Portfolio</span>
            </button>
          )}

          <button
            onClick={handleViewChart}
            className="bg-amber-500 hover:bg-amber-400 text-black px-3.5 py-1.5 text-[11px] font-black uppercase tracking-wider flex items-center space-x-1.5 transition-all shadow-md cursor-pointer"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>View VCP Chart</span>
          </button>
        </div>
      </div>
    </div>
  );
};

