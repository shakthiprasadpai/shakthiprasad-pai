import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Radio,
  Send,
  Check,
  Copy,
  Terminal,
  Code,
  Settings,
  Play,
  Trash2,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  TrendingUp,
  Volume2,
  RefreshCw,
  Sliders,
  Download,
  CheckCircle2,
  Zap,
  Filter,
  Search,
  ArrowUpRight,
  Lock,
  Clock,
  Target,
  Bell,
  HelpCircle,
  FileCode2,
  ChevronDown,
  ChevronRight,
  Shield,
  Layers,
  Sparkles
} from 'lucide-react';
import { MinerviniTradeSetup, TradingViewWebhookEvent, TradingViewSepaCategory } from '../types';
import { playAlertChime } from '../utils/backgroundPriceChecker';
import { logAlertTrigger } from '../utils/priceAlertHistoryStorage';

interface TradingViewWebhookHubProps {
  stocks: MinerviniTradeSetup[];
  selectedStock?: MinerviniTradeSetup;
  onSelectStock?: (stock: MinerviniTradeSetup) => void;
  onViewChart?: (stock: MinerviniTradeSetup) => void;
  onOpenCalculator?: (stock: MinerviniTradeSetup) => void;
}

export const TradingViewWebhookHub: React.FC<TradingViewWebhookHubProps> = ({
  stocks,
  selectedStock,
  onSelectStock,
  onViewChart,
  onOpenCalculator
}) => {
  // State for events & connection
  const [events, setEvents] = useState<TradingViewWebhookEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [autoPoll, setAutoPoll] = useState<boolean>(true);
  const [pollIntervalSec, setPollIntervalSec] = useState<number>(3);
  const [lastPollTime, setLastPollTime] = useState<string>('');
  const [webhookUrl, setWebhookUrl] = useState<string>('');
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);
  const [copiedPine, setCopiedPine] = useState<boolean>(false);
  const [copiedPayload, setCopiedPayload] = useState<string | null>(null);
  const [copiedCurl, setCopiedCurl] = useState<boolean>(false);

  // Filter state
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeSubTab, setActiveSubTab] = useState<'events' | 'simulator' | 'pine_script' | 'config'>('events');

  // Config State
  const [passphrase, setPassphrase] = useState<string>('');
  const [passphraseSaved, setPassphraseSaved] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [autoSyncWatchlist, setAutoSyncWatchlist] = useState<boolean>(true);
  const [desktopNotif, setDesktopNotif] = useState<boolean>(false);

  // Selected event modal/expander
  const [selectedEventModal, setSelectedEventModal] = useState<TradingViewWebhookEvent | null>(null);

  // Simulator Form State
  const [simTicker, setSimTicker] = useState<string>(selectedStock?.ticker || 'NVDA');
  const [simAction, setSimAction] = useState<string>('PIVOT_BREAKOUT');
  const [simPrice, setSimPrice] = useState<number>(selectedStock?.pivotPrice || 132.85);
  const [simVolume, setSimVolume] = useState<number>(68500000);
  const [simExchange, setSimExchange] = useState<string>(selectedStock?.exchange || 'NASDAQ');
  const [simStrategy, setSimStrategy] = useState<string>('Minervini SEPA VCP Squeeze');
  const [simMessage, setSimMessage] = useState<string>('');
  const [simIsSending, setSimIsSending] = useState<boolean>(false);
  const [simSuccessMsg, setSimSuccessMsg] = useState<string | null>(null);

  // Keep track of latest known event ID to trigger audio chimes on fresh inbound events
  const lastEventIdRef = useRef<string | null>(null);
  const isInitialMountRef = useRef<boolean>(true);

  // Compute live webhook URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      setWebhookUrl(`${origin}/api/tradingview-webhook`);
    }
  }, []);

  // Fetch events from server
  const fetchEvents = async () => {
    try {
      const queryParams = new URLSearchParams();
      if (categoryFilter !== 'ALL') queryParams.append('category', categoryFilter);
      if (searchQuery.trim()) queryParams.append('ticker', searchQuery.trim());

      const res = await fetch(`/api/tradingview-webhook/events?${queryParams.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch webhook events');
      const data = await res.json();
      const newEvents: TradingViewWebhookEvent[] = data.events || [];

      // Detect if a brand new event arrived while polling
      if (!isInitialMountRef.current && newEvents.length > 0) {
        const topEvent = newEvents[0];
        if (lastEventIdRef.current && topEvent.id !== lastEventIdRef.current) {
          // New event detected!
          if (soundEnabled) {
            playAlertChime();
          }

          // Also bridge to Price Alert History so the user sees it in their unified alerts
          logAlertTrigger({
            ticker: topEvent.ticker,
            stockName: topEvent.stockName,
            exchange: topEvent.exchange,
            triggeredPrice: topEvent.price,
            targetPrice: topEvent.price,
            alertType: topEvent.sepaCategory === 'STOP_EXIT' ? 'STOP_LOSS' : 'PIVOT_ENTRY',
            eventTypeLabel: `TradingView: ${topEvent.action}`,
            notes: `Inbound TradingView Webhook: ${topEvent.message}`,
            timestamp: topEvent.receivedAt
          });

          // Show desktop notification if enabled
          if (desktopNotif && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            new Notification(`TradingView Alert: ${topEvent.ticker}`, {
              body: `${topEvent.action} @ ${topEvent.price} - ${topEvent.message}`,
              icon: '/favicon.ico'
            });
          }
        }
      }

      if (newEvents.length > 0) {
        lastEventIdRef.current = newEvents[0].id;
      }
      isInitialMountRef.current = false;

      setEvents(newEvents);
      setLastPollTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (e) {
      console.error('Error polling TradingView events:', e);
    }
  };

  // Initial fetch and auto-polling effect
  useEffect(() => {
    fetchEvents();
    if (!autoPoll) return;

    const intervalId = setInterval(() => {
      fetchEvents();
    }, pollIntervalSec * 1000);

    return () => clearInterval(intervalId);
  }, [autoPoll, pollIntervalSec, categoryFilter, searchQuery, soundEnabled, desktopNotif]);

  // Copy helper
  const copyToClipboard = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Clear events
  const handleClearEvents = async () => {
    if (!window.confirm('Are you sure you want to clear the TradingView webhook event log?')) return;
    try {
      await fetch('/api/tradingview-webhook/events', { method: 'DELETE' });
      setEvents([]);
      lastEventIdRef.current = null;
    } catch (e) {
      console.error('Failed to clear events:', e);
    }
  };

  // Save passphrase
  const handleSavePassphrase = async () => {
    try {
      await fetch('/api/tradingview-webhook/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passphrase })
      });
      setPassphraseSaved(true);
      setTimeout(() => setPassphraseSaved(false), 2500);
    } catch (e) {
      console.error('Failed to update passphrase:', e);
    }
  };

  // Fire simulated alert
  const handleSendSimulation = async () => {
    setSimIsSending(true);
    setSimSuccessMsg(null);
    try {
      const res = await fetch('/api/tradingview-webhook/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: simTicker,
          action: simAction,
          price: simPrice,
          volume: simVolume,
          exchange: simExchange,
          strategy: simStrategy,
          message: simMessage || undefined
        })
      });
      const data = await res.json();
      if (data.success) {
        setSimSuccessMsg(`Alert dispatched successfully for ${simTicker}! Event ID: ${data.event.id}`);
        if (soundEnabled) playAlertChime();
        await fetchEvents();
      }
    } catch (e: any) {
      setSimSuccessMsg(`Failed to send test: ${e?.message}`);
    } finally {
      setSimIsSending(false);
    }
  };

  // Preset loader for simulation
  const loadSimPreset = (preset: {
    ticker: string;
    action: string;
    price: number;
    volume: number;
    exchange: string;
    strategy: string;
    msg: string;
  }) => {
    setSimTicker(preset.ticker);
    setSimAction(preset.action);
    setSimPrice(preset.price);
    setSimVolume(preset.volume);
    setSimExchange(preset.exchange);
    setSimStrategy(preset.strategy);
    setSimMessage(preset.msg);
  };

  // Export Events as JSON
  const handleExportEventsJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(events, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `TradingView_Webhook_Log_${new Date().toISOString().split('T')[0]}.json`);
    dlAnchor.click();
  };

  // Request browser notification permission
  const handleToggleNotif = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert('Desktop notifications are not supported in this browser.');
      return;
    }
    if (Notification.permission === 'granted') {
      setDesktopNotif(!desktopNotif);
    } else {
      const res = await Notification.requestPermission();
      if (res === 'granted') {
        setDesktopNotif(true);
      } else {
        setDesktopNotif(false);
      }
    }
  };

  // Pine Script v5 Code Snippet
  const pineScriptCode = `//@version=5
indicator("Minervini SEPA & VCP Breakout Webhook [Pro]", overlay=true)

// ==========================================
// 1. INPUT PARAMETERS & USER SETTINGS
// ==========================================
webhookSecret = input.string("", title="Webhook Passphrase / Secret", tooltip="Optional secret key matched with your SEPA applet")
enableWebhookAlerts = input.bool(true, title="Enable Automated Webhook Trigger")

// Minervini Trend Template Inputs
lenSma50 = input.int(50, "50-day SMA")
lenSma150 = input.int(150, "150-day SMA")
lenSma200 = input.int(200, "200-day SMA")
lenVol20 = input.int(20, "20-day Volume MA")

// ==========================================
// 2. TREND TEMPLATE & MOVING AVERAGES
// ==========================================
sma50 = ta.sma(close, lenSma50)
sma150 = ta.sma(close, lenSma150)
sma200 = ta.sma(close, lenSma200)
volMa20 = ta.sma(volume, lenVol20)

// 200 SMA must be trending up for at least 1 month (20 bars)
sma200TrendingUp = sma200 > sma200[20]

// Minervini Stage 2 Trend Template Rules
isStage2 = close > sma50 and sma50 > sma150 and sma150 > sma200 and sma200TrendingUp

// ==========================================
// 3. VCP VOLATILITY CONTRACTION & DRY-UP
// ==========================================
// Pivot High (Recent 20-bar consolidation resistance)
pivotHigh = ta.highest(high[1], 20)

// Volume Dry-up: Volume is at least 45% below 20-day average
isVolumeDryUp = volume < (volMa20 * 0.55)

// Breakout Surge: Price crosses above pivot with +50% volume expansion
isPivotCross = ta.crossover(close, pivotHigh)
isVolumeSurge = volume > (volMa20 * 1.5)
isVcpBreakout = isPivotCross and isVolumeSurge and isStage2

// Stop Loss: 50-day SMA or 6% below Pivot
stopLossLevel = math.max(sma50, pivotHigh * 0.94)

// ==========================================
// 4. CHART PLOTS
// ==========================================
plot(sma50, "50 SMA", color=color.blue, linewidth=2)
plot(sma150, "150 SMA", color=color.orange, linewidth=2)
plot(sma200, "200 SMA", color=color.red, linewidth=2)
plot(pivotHigh, "VCP Pivot Resistance", color=color.yellow, style=plot.style_linebr, linewidth=2)

// Visual Breakout Markers
plotshape(isVcpBreakout, title="SEPA Breakout Signal", style=shape.triangleup, location=location.belowbar, color=color.green, size=size.normal, text="VCP BUY")
plotshape(isVolumeDryUp, title="Volume Dry-Up", style=shape.circle, location=location.abovebar, color=color.purple, size=size.tiny, text="VDU")

// ==========================================
// 5. TRADINGVIEW WEBHOOK ALERT PAYLOAD (JSON)
// ==========================================
// Formatted JSON alert for direct POST into your Minervini Webhook Hub
var string alertJson = ""
if isVcpBreakout and enableWebhookAlerts
    alertJson := '{"ticker":"' + syminfo.ticker + '","action":"PIVOT_BREAKOUT","price":' + str.tostring(close) + ',"volume":' + str.tostring(volume) + ',"exchange":"' + syminfo.prefix + '","time":"' + str.tostring(time) + '","strategy":"Minervini SEPA VCP Indicator","message":"' + syminfo.ticker + ' broke above Pivot ' + str.tostring(pivotHigh, "#.##") + ' with high volume surge!","passphrase":"' + webhookSecret + '"}'
    alert(alertJson, alert.freq_once_per_bar_close)

// In Alert Dialog, simply enter Webhook URL and leave message as: {{strategy.order.alert_message}} or {{alert}}`;

  // Standard JSON alert templates for TradingView alert dialog
  const jsonTemplateBreakout = `{
  "ticker": "{{ticker}}",
  "action": "PIVOT_BREAKOUT",
  "price": {{close}},
  "volume": {{volume}},
  "exchange": "{{exchange}}",
  "time": "{{time}}",
  "message": "{{ticker}} crossed Pivot at {{close}} with high volume",
  "strategy": "Minervini SEPA VCP Squeeze"
}`;

  const jsonTemplateStopLoss = `{
  "ticker": "{{ticker}}",
  "action": "STOP_LOSS",
  "price": {{close}},
  "exchange": "{{exchange}}",
  "time": "{{time}}",
  "message": "Risk Alert: {{ticker}} breached stop loss at {{close}}. Exit immediately!",
  "strategy": "SEPA Capital Protection"
}`;

  const jsonTemplateTarget = `{
  "ticker": "{{ticker}}",
  "action": "TARGET_1",
  "price": {{close}},
  "exchange": "{{exchange}}",
  "time": "{{time}}",
  "message": "{{ticker}} achieved 3:1 Reward-to-Risk Target 1 at {{close}}",
  "strategy": "Minervini Profit Target"
}`;

  // Terminal curl command for testing
  const curlTestCommand = `curl -X POST "${webhookUrl || 'https://<your-app-domain>/api/tradingview-webhook'}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "ticker": "NVDA",
    "action": "PIVOT_BREAKOUT",
    "price": 132.85,
    "volume": 72500000,
    "exchange": "NASDAQ",
    "message": "NVDA crossed above pivot $131.50 on 2.2x volume surge",
    "strategy": "Minervini SEPA VCP Indicator"
  }'`;

  // Helper for category badge styling
  const getCategoryBadge = (cat: TradingViewSepaCategory) => {
    switch (cat) {
      case 'PIVOT_ENTRY':
        return {
          bg: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
          label: 'Pivot Breakout',
          dot: 'bg-emerald-400'
        };
      case 'STOP_EXIT':
        return {
          bg: 'bg-rose-500/10 text-rose-500 border-rose-500/30',
          label: 'Stop Loss Exit',
          dot: 'bg-rose-400'
        };
      case 'TARGET_PROFIT':
        return {
          bg: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
          label: 'Profit Target',
          dot: 'bg-purple-400'
        };
      case 'VCP_CONTRACTION':
        return {
          bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
          label: 'VCP Dry-Up',
          dot: 'bg-amber-400'
        };
      case 'VOLUME_SURGE':
        return {
          bg: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
          label: 'Volume Surge',
          dot: 'bg-blue-400'
        };
      case 'STAGE_2_SIGNAL':
        return {
          bg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
          label: 'Stage 2 Trend',
          dot: 'bg-cyan-400'
        };
      default:
        return {
          bg: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
          label: 'General Alert',
          dot: 'bg-gray-400'
        };
    }
  };

  // Find matching setup in local stock database if available
  const findSetup = (ticker: string) => {
    return stocks.find((s) => s.ticker.toUpperCase() === ticker.toUpperCase());
  };

  // Metrics summary
  const totalEvents = events.length;
  const pivotCount = events.filter((e) => e.sepaCategory === 'PIVOT_ENTRY').length;
  const vcpCount = events.filter((e) => e.sepaCategory === 'VCP_CONTRACTION').length;
  const stopCount = events.filter((e) => e.sepaCategory === 'STOP_EXIT').length;
  const targetCount = events.filter((e) => e.sepaCategory === 'TARGET_PROFIT').length;

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Webhook Endpoint Bar */}
      <div className="bg-[#1e1e1e] text-white border border-[#2a2a2a] rounded-xl p-6 shadow-xl relative overflow-hidden">
        {/* Subtle decorative background accent */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center space-x-2.5">
                  <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                    TradingView Webhook Integration Hub
                  </h1>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-ping" />
                    LIVE LISTENER
                  </span>
                </div>
                <p className="text-sm text-gray-400">
                  Direct connection pipe for TradingView alerts, Pine Script strategy orders, and automated Minervini VCP breakout execution.
                </p>
              </div>
            </div>
          </div>

          {/* Audio Chime & Controls */}
          <div className="flex items-center flex-wrap gap-2.5">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center space-x-1.5 border transition-all ${
                soundEnabled
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700'
              }`}
              title="Toggle audio alert chime when webhooks trigger"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Chime: {soundEnabled ? 'ON' : 'OFF'}</span>
            </button>

            <button
              onClick={handleToggleNotif}
              className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center space-x-1.5 border transition-all ${
                desktopNotif
                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700'
              }`}
              title="Toggle browser desktop notifications"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Desktop Notif</span>
            </button>

            <button
              onClick={() => setAutoPoll(!autoPoll)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center space-x-1.5 border transition-all ${
                autoPoll
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700'
              }`}
              title="Auto-refresh incoming event stream"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${autoPoll ? 'animate-spin' : ''}`} style={{ animationDuration: '4s' }} />
              <span>Auto-Sync: {autoPoll ? `${pollIntervalSec}s` : 'PAUSED'}</span>
            </button>
          </div>
        </div>

        {/* Live Webhook URL Box */}
        <div className="mt-5 p-4 rounded-xl bg-black/40 border border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center space-x-2 text-xs text-zinc-400 font-medium">
              <span>Your Unique TradingView Webhook URL</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">POST Endpoint</span>
            </div>
            <div className="font-mono text-xs sm:text-sm text-emerald-400 bg-zinc-900/90 py-1.5 px-3 rounded-lg border border-zinc-700/60 truncate select-all">
              {webhookUrl || 'https://ais-dev-bg4we7rctbvgg7qs5bevus-190494263733.asia-southeast1.run.app/api/tradingview-webhook'}
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => copyToClipboard(webhookUrl, setCopiedUrl)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
            >
              {copiedUrl ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedUrl ? 'Copied URL!' : 'Copy Webhook URL'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Navigation Tabs for Webhook Hub */}
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
        <div className="flex items-center space-x-2 sm:space-x-4 overflow-x-auto">
          <button
            onClick={() => setActiveSubTab('events')}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold flex items-center space-x-2 transition-all cursor-pointer ${
              activeSubTab === 'events'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            <Radio className="w-4 h-4 text-emerald-500" />
            <span>Live Webhook Feed</span>
            {events.length > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                activeSubTab === 'events' ? 'bg-emerald-500 text-white' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
              }`}>
                {events.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('simulator')}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold flex items-center space-x-2 transition-all cursor-pointer ${
              activeSubTab === 'simulator'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            <Send className="w-4 h-4 text-blue-500" />
            <span>Test Simulator & Curl</span>
          </button>

          <button
            onClick={() => setActiveSubTab('pine_script')}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold flex items-center space-x-2 transition-all cursor-pointer ${
              activeSubTab === 'pine_script'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            <Code className="w-4 h-4 text-amber-500" />
            <span>Pine Script v5 & Setup Guide</span>
          </button>

          <button
            onClick={() => setActiveSubTab('config')}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold flex items-center space-x-2 transition-all cursor-pointer ${
              activeSubTab === 'config'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            <Settings className="w-4 h-4 text-purple-500" />
            <span>Security & Settings</span>
          </button>
        </div>

        <div className="hidden sm:flex items-center space-x-2 text-xs text-zinc-500">
          <Clock className="w-3.5 h-3.5" />
          <span>Last sync: {lastPollTime || 'Connecting...'}</span>
        </div>
      </div>

      {/* 3. SUBTAB CONTENT */}

      {/* SUBTAB 1: LIVE WEBHOOK FEED */}
      {activeSubTab === 'events' && (
        <div className="space-y-4">
          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-[#1e1e1e] border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-xs">
              <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Total Alerts Received</div>
              <div className="text-2xl font-black text-zinc-900 dark:text-white mt-1">{totalEvents}</div>
              <div className="text-[11px] text-emerald-500 font-medium mt-1">Live WebSocket / Polling</div>
            </div>

            <div className="bg-white dark:bg-[#1e1e1e] border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-xs">
              <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Pivot Breakouts</div>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{pivotCount}</div>
              <div className="text-[11px] text-zinc-400 font-medium mt-1">Stage 2 Entries</div>
            </div>

            <div className="bg-white dark:bg-[#1e1e1e] border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-xs">
              <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">VCP Dry-Ups</div>
              <div className="text-2xl font-black text-amber-500 mt-1">{vcpCount}</div>
              <div className="text-[11px] text-zinc-400 font-medium mt-1">Supply Contractions</div>
            </div>

            <div className="bg-white dark:bg-[#1e1e1e] border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-xs">
              <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Stop & Profit Exits</div>
              <div className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">{stopCount + targetCount}</div>
              <div className="text-[11px] text-zinc-400 font-medium mt-1">Target Hits & Stops</div>
            </div>
          </div>

          {/* Filtering & Action Toolbar */}
          <div className="bg-white dark:bg-[#1e1e1e] border border-zinc-200 dark:border-zinc-800 p-3.5 rounded-xl shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-center flex-wrap gap-2 w-full md:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Filter by ticker or strategy..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Category Pills */}
              <div className="flex items-center space-x-1 overflow-x-auto pb-1 sm:pb-0">
                {[
                  { id: 'ALL', label: 'All Events' },
                  { id: 'PIVOT_ENTRY', label: 'Breakouts' },
                  { id: 'VCP_CONTRACTION', label: 'VCP Dry-Up' },
                  { id: 'TARGET_PROFIT', label: 'Targets' },
                  { id: 'STOP_EXIT', label: 'Stop Loss' }
                ].map((pill) => (
                  <button
                    key={pill.id}
                    onClick={() => setCategoryFilter(pill.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      categoryFilter === pill.id
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-2 w-full md:w-auto justify-end">
              <button
                onClick={handleExportEventsJson}
                disabled={events.length === 0}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export JSON</span>
              </button>

              <button
                onClick={handleClearEvents}
                disabled={events.length === 0}
                className="px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 transition-all flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            </div>
          </div>

          {/* Events Feed List */}
          {events.length === 0 ? (
            <div className="bg-white dark:bg-[#1e1e1e] border border-zinc-200 dark:border-zinc-800 rounded-xl p-12 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
                <Radio className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">Waiting for Inbound Webhooks</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
                  No TradingView alerts matched your filters. Fire a test alert using the Simulator tab or configure your TradingView chart alert using our Pine Script!
                </p>
              </div>
              <button
                onClick={() => setActiveSubTab('simulator')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold inline-flex items-center space-x-1.5 transition-all cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Fire a Test Webhook</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {events.map((ev) => {
                const badge = getCategoryBadge(ev.sepaCategory);
                const setup = findSetup(ev.ticker);

                return (
                  <motion.div
                    key={ev.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-[#1e1e1e] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-xs hover:border-emerald-500/50 transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start space-x-3.5">
                        {/* Ticker & Exchange Badge */}
                        <div className="w-12 h-12 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex flex-col items-center justify-center shrink-0">
                          <span className="font-mono font-bold text-xs text-zinc-900 dark:text-white leading-tight">
                            {ev.ticker}
                          </span>
                          <span className="text-[9px] font-semibold text-zinc-500 dark:text-zinc-400 leading-tight">
                            {ev.exchange}
                          </span>
                        </div>

                        {/* Title, Category & Message */}
                        <div className="space-y-1">
                          <div className="flex items-center flex-wrap gap-2">
                            <span className="font-bold text-sm text-zinc-900 dark:text-white">
                              {ev.stockName || ev.ticker}
                            </span>

                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${badge.bg}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${badge.dot} mr-1.5`} />
                              {ev.action}
                            </span>

                            {ev.status === 'VALID' ? (
                              <span className="inline-flex items-center text-[10px] text-emerald-500 font-medium gap-0.5">
                                <CheckCircle2 className="w-3 h-3" /> Valid
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-[10px] text-rose-500 font-medium gap-0.5">
                                <AlertTriangle className="w-3 h-3" /> {ev.status}
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-zinc-600 dark:text-zinc-300 font-medium">
                            {ev.message}
                          </p>

                          <div className="flex items-center flex-wrap gap-3 text-[11px] text-zinc-400">
                            <span>Strategy: <span className="text-zinc-500 dark:text-zinc-300">{ev.strategy || 'Alert'}</span></span>
                            <span>•</span>
                            <span>Received: <span className="text-zinc-500 dark:text-zinc-300">{ev.formattedTime}</span></span>
                            {ev.volume && (
                              <>
                                <span>•</span>
                                <span>Volume: <span className="font-mono text-zinc-500 dark:text-zinc-300">{ev.volume.toLocaleString()}</span></span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right side: Price & Action Buttons */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 pt-2 sm:pt-0 border-zinc-100 dark:border-zinc-800 gap-2">
                        <div className="text-right">
                          <div className="text-xs text-zinc-400">Trigger Price</div>
                          <div className="font-mono font-black text-base text-zinc-900 dark:text-white">
                            {ev.exchange === 'NSE' || ev.exchange === 'BSE' ? '₹' : '$'}{ev.price ? ev.price.toFixed(2) : '--'}
                          </div>
                        </div>

                        <div className="flex items-center space-x-1.5">
                          {setup && onViewChart && (
                            <button
                              onClick={() => {
                                onSelectStock?.(setup);
                                onViewChart(setup);
                              }}
                              className="px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-emerald-600 hover:text-white text-zinc-700 dark:text-zinc-300 text-xs font-semibold rounded-md transition-all flex items-center space-x-1 cursor-pointer"
                              title="Inspect setup on Interactive VCP Chart"
                            >
                              <TrendingUp className="w-3 h-3" />
                              <span>Chart</span>
                            </button>
                          )}

                          {setup && onOpenCalculator && (
                            <button
                              onClick={() => {
                                onSelectStock?.(setup);
                                onOpenCalculator(setup);
                              }}
                              className="px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold rounded-md transition-all flex items-center space-x-1 cursor-pointer"
                              title="Calculate position sizing and stop loss risk"
                            >
                              <Target className="w-3 h-3" />
                              <span>Risk</span>
                            </button>
                          )}

                          <button
                            onClick={() => setSelectedEventModal(ev)}
                            className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 text-xs font-medium rounded-md transition-all cursor-pointer"
                            title="View Raw JSON Payload"
                          >
                            <FileCode2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 2: TEST SIMULATOR & CURL */}
      {activeSubTab === 'simulator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left 7 cols: Test Form */}
          <div className="lg:col-span-7 bg-white dark:bg-[#1e1e1e] border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-xs space-y-5">
            <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-blue-500" />
                <span>TradingView Webhook Test Bench</span>
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Simulate an immediate alert dispatch to verify your local endpoint, sound chime, and SEPA trigger parsing.
              </p>
            </div>

            {/* Presets */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Quick Test Presets</label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    loadSimPreset({
                      ticker: 'NVDA',
                      action: 'PIVOT_BREAKOUT',
                      price: 132.85,
                      volume: 72500000,
                      exchange: 'NASDAQ',
                      strategy: 'Minervini VCP Squeeze Indicator',
                      msg: 'NVDA broke above VCP Pivot $131.50 with +85% volume surge.'
                    })
                  }
                  className="px-2.5 py-1 text-xs rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 font-medium cursor-pointer"
                >
                  🚀 NVDA Pivot Breakout ($132.85)
                </button>

                <button
                  type="button"
                  onClick={() =>
                    loadSimPreset({
                      ticker: 'RELIANCE',
                      action: 'VCP_CONTRACTION_DRYUP',
                      price: 3042.50,
                      volume: 1240000,
                      exchange: 'NSE',
                      strategy: 'SEPA Stage 2 Scanner',
                      msg: 'RELIANCE volume dried up by -62% near pivot ₹3,050. Contraction T3 tightening.'
                    })
                  }
                  className="px-2.5 py-1 text-xs rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 font-medium cursor-pointer"
                >
                  💧 RELIANCE VCP Dry-Up (₹3,042.50)
                </button>

                <button
                  type="button"
                  onClick={() =>
                    loadSimPreset({
                      ticker: 'BEL',
                      action: 'TARGET_1_REACHED',
                      price: 318.00,
                      volume: 8900000,
                      exchange: 'NSE',
                      strategy: 'Minervini Profit Target',
                      msg: 'BEL hit 3:1 Reward/Risk Target 1 at ₹318.00 (+14.2% gain).'
                    })
                  }
                  className="px-2.5 py-1 text-xs rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 font-medium cursor-pointer"
                >
                  🎯 BEL 3:1 Target 1 Hit (₹318.00)
                </button>

                <button
                  type="button"
                  onClick={() =>
                    loadSimPreset({
                      ticker: 'TSLA',
                      action: 'STOP_LOSS',
                      price: 238.00,
                      volume: 45000000,
                      exchange: 'NASDAQ',
                      strategy: 'Minervini Capital Guard',
                      msg: 'TSLA breached initial stop loss at $238.00. Exit immediately.'
                    })
                  }
                  className="px-2.5 py-1 text-xs rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 font-medium cursor-pointer"
                >
                  🛡️ TSLA Stop Loss Protection ($238.00)
                </button>
              </div>
            </div>

            {/* Input fields */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Ticker Symbol
                </label>
                <input
                  type="text"
                  value={simTicker}
                  onChange={(e) => setSimTicker(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 text-xs font-mono bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white"
                  placeholder="e.g. NVDA, RELIANCE"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Action / Alert Type
                </label>
                <select
                  value={simAction}
                  onChange={(e) => setSimAction(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white"
                >
                  <option value="PIVOT_BREAKOUT">PIVOT_BREAKOUT (Buy Signal)</option>
                  <option value="VCP_CONTRACTION_DRYUP">VCP_CONTRACTION_DRYUP (Tight Squeeze)</option>
                  <option value="TARGET_1_REACHED">TARGET_1_REACHED (Take Profit)</option>
                  <option value="STOP_LOSS">STOP_LOSS (Capital Defense)</option>
                  <option value="VOLUME_SURGE">VOLUME_SURGE (Institutional Buy)</option>
                  <option value="STAGE_2_CONFIRMED">STAGE_2_CONFIRMED (Trend Check)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Exchange
                </label>
                <select
                  value={simExchange}
                  onChange={(e) => setSimExchange(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white"
                >
                  <option value="NASDAQ">NASDAQ (US)</option>
                  <option value="NYSE">NYSE (US)</option>
                  <option value="NSE">NSE (India)</option>
                  <option value="BSE">BSE (India)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Trigger Price
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={simPrice}
                  onChange={(e) => setSimPrice(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-xs font-mono bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Traded Volume (contracts)
                </label>
                <input
                  type="number"
                  value={simVolume}
                  onChange={(e) => setSimVolume(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-xs font-mono bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                Custom Alert Description
              </label>
              <textarea
                rows={2}
                value={simMessage}
                onChange={(e) => setSimMessage(e.target.value)}
                placeholder="e.g. NVDA crossed above VCP pivot $131.50 with +85% institutional volume surge."
                className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white"
              />
            </div>

            {simSuccessMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{simSuccessMsg}</span>
              </div>
            )}

            <button
              type="button"
              disabled={simIsSending}
              onClick={handleSendSimulation}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-all shadow-md flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{simIsSending ? 'Dispatching Webhook...' : 'Fire Test TradingView Webhook'}</span>
            </button>
          </div>

          {/* Right 5 cols: Terminal Curl Snippet */}
          <div className="lg:col-span-5 bg-zinc-900 text-zinc-200 border border-zinc-800 rounded-xl p-6 shadow-xs flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center space-x-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white">Direct Terminal Curl</h3>
                </div>
                <button
                  onClick={() => copyToClipboard(curlTestCommand, setCopiedCurl)}
                  className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-md font-medium transition-all flex items-center space-x-1 cursor-pointer"
                >
                  {copiedCurl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedCurl ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>

              <p className="text-xs text-zinc-400">
                You can test this endpoint directly from your terminal, Postman, or external automated scripts:
              </p>

              <pre className="p-3 bg-black/60 rounded-lg border border-zinc-800 text-[11px] font-mono text-emerald-300 overflow-x-auto whitespace-pre leading-relaxed">
                {curlTestCommand}
              </pre>
            </div>

            <div className="p-3 bg-zinc-800/60 rounded-lg border border-zinc-700/50 text-[11px] text-zinc-400 space-y-1">
              <div className="font-semibold text-zinc-300 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-blue-400" />
                <span>Format Flexibility</span>
              </div>
              <p>
                The server automatically parses standard JSON payloads, URL-encoded webhook posts, or raw TradingView text alert notifications.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: PINE SCRIPT v5 & SETUP GUIDE */}
      {activeSubTab === 'pine_script' && (
        <div className="space-y-6">
          {/* Step-by-Step Instructions */}
          <div className="bg-white dark:bg-[#1e1e1e] border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <Code className="w-4 h-4 text-amber-500" />
              <span>How to Link TradingView with your Minervini Webhook Hub</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-2">
                <div className="w-6 h-6 rounded-full bg-emerald-500 text-white font-bold text-xs flex items-center justify-center">
                  1
                </div>
                <h4 className="text-xs font-bold text-zinc-900 dark:text-white">Copy Webhook URL</h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Copy your unique webhook URL above. In TradingView, create an Alert on your chart and go to the <strong>Notifications</strong> tab. Check <strong>Webhook URL</strong> and paste the link.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-2">
                <div className="w-6 h-6 rounded-full bg-blue-500 text-white font-bold text-xs flex items-center justify-center">
                  2
                </div>
                <h4 className="text-xs font-bold text-zinc-900 dark:text-white">Paste JSON Payload</h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  In the Alert <strong>Settings</strong> tab, paste one of our pre-formatted JSON message templates into the <strong>Message</strong> field. TradingView replaces placeholders like <code className="text-emerald-400">{'{{close}}'}</code> automatically.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-2">
                <div className="w-6 h-6 rounded-full bg-purple-500 text-white font-bold text-xs flex items-center justify-center">
                  3
                </div>
                <h4 className="text-xs font-bold text-zinc-900 dark:text-white">Auto-Execute & Monitor</h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Save the alert. Whenever conditions trigger, TradingView will immediately send the data here. The hub plays an audio chime and logs the event to your live SEPA dashboard!
                </p>
              </div>
            </div>
          </div>

          {/* Ready-to-use JSON Templates */}
          <div className="bg-white dark:bg-[#1e1e1e] border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
              TradingView Alert Message JSON Templates
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Template 1 */}
              <div className="space-y-2 bg-zinc-50 dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">VCP Breakout (Buy)</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(jsonTemplateBreakout);
                      setCopiedPayload('breakout');
                      setTimeout(() => setCopiedPayload(null), 2000);
                    }}
                    className="px-2 py-1 text-[11px] bg-zinc-200 dark:bg-zinc-800 rounded text-zinc-700 dark:text-zinc-300 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    {copiedPayload === 'breakout' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedPayload === 'breakout' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="text-[10px] font-mono text-zinc-600 dark:text-zinc-400 bg-white dark:bg-black/40 p-2.5 rounded border border-zinc-200 dark:border-zinc-800 overflow-x-auto">
                  {jsonTemplateBreakout}
                </pre>
              </div>

              {/* Template 2 */}
              <div className="space-y-2 bg-zinc-50 dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-600 dark:text-rose-400">Stop Loss (Defense)</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(jsonTemplateStopLoss);
                      setCopiedPayload('stop');
                      setTimeout(() => setCopiedPayload(null), 2000);
                    }}
                    className="px-2 py-1 text-[11px] bg-zinc-200 dark:bg-zinc-800 rounded text-zinc-700 dark:text-zinc-300 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    {copiedPayload === 'stop' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedPayload === 'stop' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="text-[10px] font-mono text-zinc-600 dark:text-zinc-400 bg-white dark:bg-black/40 p-2.5 rounded border border-zinc-200 dark:border-zinc-800 overflow-x-auto">
                  {jsonTemplateStopLoss}
                </pre>
              </div>

              {/* Template 3 */}
              <div className="space-y-2 bg-zinc-50 dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-600 dark:text-purple-400">Profit Target 1</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(jsonTemplateTarget);
                      setCopiedPayload('target');
                      setTimeout(() => setCopiedPayload(null), 2000);
                    }}
                    className="px-2 py-1 text-[11px] bg-zinc-200 dark:bg-zinc-800 rounded text-zinc-700 dark:text-zinc-300 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    {copiedPayload === 'target' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedPayload === 'target' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="text-[10px] font-mono text-zinc-600 dark:text-zinc-400 bg-white dark:bg-black/40 p-2.5 rounded border border-zinc-200 dark:border-zinc-800 overflow-x-auto">
                  {jsonTemplateTarget}
                </pre>
              </div>
            </div>
          </div>

          {/* Full Pine Script v5 Code Box */}
          <div className="bg-zinc-900 text-zinc-200 border border-zinc-800 rounded-xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
              <div>
                <div className="flex items-center space-x-2">
                  <FileCode2 className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white">
                    Minervini SEPA & VCP Breakout Indicator (Pine Script v5)
                  </h3>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Paste this directly into TradingView Pine Editor. It calculates Stage 2 moving averages, volume dry-up, and automatically dispatches webhooks.
                </p>
              </div>

              <button
                onClick={() => copyToClipboard(pineScriptCode, setCopiedPine)}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 shrink-0 cursor-pointer"
              >
                {copiedPine ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedPine ? 'Copied Pine Script!' : 'Copy Pine Script v5'}</span>
              </button>
            </div>

            <pre className="p-4 bg-black/60 rounded-lg border border-zinc-800 text-[11px] font-mono text-zinc-300 max-h-96 overflow-y-auto whitespace-pre leading-relaxed">
              {pineScriptCode}
            </pre>
          </div>
        </div>
      )}

      {/* SUBTAB 4: SECURITY & SETTINGS */}
      {activeSubTab === 'config' && (
        <div className="bg-white dark:bg-[#1e1e1e] border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-xs space-y-6 max-w-2xl">
          <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-purple-500" />
              <span>Webhook Security & Secret Key</span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Secure your inbound endpoint against unauthorized requests or public internet noise.
            </p>
          </div>

          {/* Passphrase Setting */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
              Webhook Secret Token / Passphrase
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Lock className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="e.g. minervini-alpha-token"
                  className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white"
                />
              </div>
              <button
                onClick={handleSavePassphrase}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                {passphraseSaved ? 'Saved!' : 'Save Token'}
              </button>
            </div>
            <p className="text-[11px] text-zinc-400">
              When configured, any TradingView alert must include this token in its JSON payload (<code className="text-emerald-500">"passphrase": "your-token"</code>) or request header. Unmatched webhooks will be flagged as UNAUTHORIZED.
            </p>
          </div>

          <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4 space-y-4">
            <h3 className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Polling & Client Behavior</h3>

            <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
              <div>
                <div className="text-xs font-semibold text-zinc-900 dark:text-white">Audio Chime on Webhook Trigger</div>
                <div className="text-[11px] text-zinc-500">Plays an instant bell chime when a new TradingView breakout arrives</div>
              </div>
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={(e) => setSoundEnabled(e.target.checked)}
                className="h-4 w-4 text-emerald-600 rounded border-zinc-300 focus:ring-emerald-500 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
              <div>
                <div className="text-xs font-semibold text-zinc-900 dark:text-white">Auto-Bridge to Price Alert History</div>
                <div className="text-[11px] text-zinc-500">Automatically adds triggered TradingView breakouts into unified price alert log</div>
              </div>
              <input
                type="checkbox"
                checked={autoSyncWatchlist}
                onChange={(e) => setAutoSyncWatchlist(e.target.checked)}
                className="h-4 w-4 text-emerald-600 rounded border-zinc-300 focus:ring-emerald-500 cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* RAW JSON MODAL */}
      {selectedEventModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-[#1e1e1e] text-white border border-zinc-800 rounded-xl max-w-xl w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center space-x-2">
                <FileCode2 className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold">
                  Raw Webhook Payload: {selectedEventModal.ticker}
                </h3>
              </div>
              <button
                onClick={() => setSelectedEventModal(null)}
                className="text-zinc-400 hover:text-white text-xs px-2 py-1 rounded bg-zinc-800 cursor-pointer"
              >
                Close
              </button>
            </div>

            <pre className="p-3.5 bg-black/80 rounded-lg text-xs font-mono text-emerald-300 overflow-x-auto max-h-80 whitespace-pre">
              {JSON.stringify(JSON.parse(selectedEventModal.rawPayload || '{}'), null, 2)}
            </pre>

            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(selectedEventModal.rawPayload);
                  alert('Payload copied to clipboard');
                }}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold rounded-lg text-zinc-200 flex items-center space-x-1 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Payload</span>
              </button>
              <button
                onClick={() => setSelectedEventModal(null)}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold rounded-lg text-white cursor-pointer"
              >
                Done
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
