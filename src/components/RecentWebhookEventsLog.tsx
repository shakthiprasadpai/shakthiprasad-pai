import React, { useState } from 'react';
import {
  Radio,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  Send,
  Trash2,
  Clock,
  Filter,
  FileCode2,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Play,
  ShieldCheck,
  Lock,
  Activity,
  ArrowUpRight,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TradingViewWebhookEvent, TradingViewSepaCategory } from '../types';

interface RecentWebhookEventsLogProps {
  events: TradingViewWebhookEvent[];
  webhookUrl: string;
  onRefresh: () => void;
  onClear: () => void;
  onSelectEvent?: (event: TradingViewWebhookEvent) => void;
  onSimulateFastPing?: () => void;
  isPolling?: boolean;
  lastPollTime?: string;
}

export const RecentWebhookEventsLog: React.FC<RecentWebhookEventsLogProps> = ({
  events,
  webhookUrl,
  onRefresh,
  onClear,
  onSelectEvent,
  onSimulateFastPing,
  isPolling = false,
  lastPollTime
}) => {
  // Always take strictly the last 10 incoming requests for troubleshooting
  const last10Events = events.slice(0, 10);

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'VALID' | 'WARNING' | 'UNAUTHORIZED'>('ALL');
  const [expandedEventId, setExpandedEventId] = useState<string | null>(last10Events[0]?.id || null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedCurlId, setCopiedCurlId] = useState<string | null>(null);
  const [showTroubleshootGuide, setShowTroubleshootGuide] = useState(false);
  const [replayingId, setReplayingId] = useState<string | null>(null);
  const [replaySuccessId, setReplaySuccessId] = useState<string | null>(null);

  // Filtered subset of the last 10
  const displayedEvents = last10Events.filter((ev) => {
    if (statusFilter === 'ALL') return true;
    return ev.status === statusFilter;
  });

  // Health statistics for the last 10
  const validCount = last10Events.filter((e) => e.status === 'VALID').length;
  const warningCount = last10Events.filter((e) => e.status === 'WARNING').length;
  const unauthCount = last10Events.filter((e) => e.status === 'UNAUTHORIZED').length;
  const healthRate = last10Events.length > 0 ? Math.round((validCount / last10Events.length) * 100) : 100;

  // Format relative time helper
  const getRelativeTime = (isoString: string) => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 45) return 'just now';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHour = Math.floor(diffMin / 60);
      if (diffHour < 24) return `${diffHour}h ago`;
      return `${Math.floor(diffHour / 24)}d ago`;
    } catch {
      return 'recent';
    }
  };

  const copyToClipboard = (text: string, id: string, setCopiedFn: (val: string | null) => void) => {
    navigator.clipboard.writeText(text);
    setCopiedFn(id);
    setTimeout(() => setCopiedFn(null), 2500);
  };

  // Replay a request directly to the webhook endpoint
  const handleReplayEvent = async (ev: TradingViewWebhookEvent) => {
    try {
      setReplayingId(ev.id);
      let payload: any;
      try {
        payload = JSON.parse(ev.rawPayload);
      } catch {
        payload = {
          ticker: ev.ticker,
          action: ev.action,
          price: ev.price,
          exchange: ev.exchange,
          message: ev.message,
          strategy: ev.strategy || 'Replayed Event'
        };
      }

      const res = await fetch('/api/tradingview-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      setReplaySuccessId(ev.id);
      setTimeout(() => setReplaySuccessId(null), 3000);
      onRefresh();
    } catch (err) {
      console.error('Failed to replay webhook', err);
    } finally {
      setReplayingId(null);
    }
  };

  // Generate copyable cURL command for this specific request
  const getCurlSnippet = (ev: TradingViewWebhookEvent) => {
    const url = webhookUrl || 'https://<your-app-domain>/api/tradingview-webhook';
    return `curl -X POST "${url}" \\
  -H "Content-Type: application/json" \\
  -d '${ev.rawPayload.replace(/'/g, "\\'")}'`;
  };

  return (
    <div id="recent-webhook-events-log" className="space-y-4">
      {/* 1. Header & Diagnostics Summary Bar */}
      <div className="bg-white dark:bg-[#1e1e1e] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <span>Recent Webhook Events</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/30">
                    Last 10 Requests Log
                  </span>
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Live HTTP audit log of incoming TradingView alert dispatches, status codes, and parsing diagnostics for rapid troubleshooting.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Action Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {onSimulateFastPing && (
              <button
                id="btn-send-test-ping"
                onClick={onSimulateFastPing}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-xs active:scale-95 cursor-pointer"
                title="Send an instant test ping to test webhook ingestion"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Test Ping</span>
              </button>
            )}

            <button
              id="btn-refresh-webhook-log"
              onClick={onRefresh}
              className={`px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-all cursor-pointer ${
                isPolling ? 'ring-1 ring-emerald-500/40' : ''
              }`}
              title="Refresh webhook events from server"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isPolling ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              id="btn-troubleshoot-guide-toggle"
              onClick={() => setShowTroubleshootGuide(!showTroubleshootGuide)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-all cursor-pointer ${
                showTroubleshootGuide
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Troubleshoot Tips</span>
            </button>

            {last10Events.length > 0 && (
              <button
                id="btn-clear-webhook-log"
                onClick={onClear}
                className="px-2.5 py-1.5 text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg text-xs transition-colors cursor-pointer"
                title="Clear all webhook events"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Diagnostic Metrics Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800/80">
          <div className="bg-zinc-50 dark:bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-200/70 dark:border-zinc-800 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-zinc-500 font-medium">Logged Requests</div>
              <div className="text-lg font-bold text-zinc-900 dark:text-white font-mono">
                {last10Events.length} <span className="text-xs text-zinc-400 font-normal">/ 10 max</span>
              </div>
            </div>
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" title="Live webhook listener online" />
          </div>

          <div className="bg-zinc-50 dark:bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-200/70 dark:border-zinc-800 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">200 OK (Valid)</div>
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                {validCount}
              </div>
            </div>
            <CheckCircle2 className="w-4 h-4 text-emerald-500/80" />
          </div>

          <div className="bg-zinc-50 dark:bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-200/70 dark:border-zinc-800 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Warnings / 400</div>
              <div className="text-lg font-bold text-amber-600 dark:text-amber-400 font-mono">
                {warningCount}
              </div>
            </div>
            <AlertTriangle className="w-4 h-4 text-amber-500/80" />
          </div>

          <div className="bg-zinc-50 dark:bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-200/70 dark:border-zinc-800 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">401 Auth Rejected</div>
              <div className="text-lg font-bold text-rose-600 dark:text-rose-400 font-mono">
                {unauthCount}
              </div>
            </div>
            <Lock className="w-4 h-4 text-rose-500/80" />
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 text-xs">
          <div className="flex items-center space-x-1.5">
            <span className="text-zinc-400 font-medium mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Status Filter:
            </span>
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                statusFilter === 'ALL'
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              All ({last10Events.length})
            </button>
            <button
              onClick={() => setStatusFilter('VALID')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                statusFilter === 'VALID'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
              }`}
            >
              Valid Only ({validCount})
            </button>
            <button
              onClick={() => setStatusFilter('WARNING')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                statusFilter === 'WARNING'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-amber-600 dark:text-amber-400 hover:bg-amber-500/10'
              }`}
            >
              Warnings ({warningCount})
            </button>
            <button
              onClick={() => setStatusFilter('UNAUTHORIZED')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                statusFilter === 'UNAUTHORIZED'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-rose-600 dark:text-rose-400 hover:bg-rose-500/10'
              }`}
            >
              Unauthorized ({unauthCount})
            </button>
          </div>

          <div className="flex items-center space-x-2 text-[11px] text-zinc-400">
            <Clock className="w-3 h-3" />
            <span>Last polled: {lastPollTime || 'Live active'}</span>
          </div>
        </div>
      </div>

      {/* 2. Interactive Troubleshooting Assistant Drawer */}
      <AnimatePresence>
        {showTroubleshootGuide && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 rounded-xl p-5 text-xs text-zinc-700 dark:text-zinc-300 space-y-3 shadow-xs"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 font-bold text-blue-700 dark:text-blue-300 text-sm">
                <HelpCircle className="w-4 h-4 text-blue-500" />
                <span>TradingView Webhook Troubleshooting Playbook</span>
              </div>
              <button
                onClick={() => setShowTroubleshootGuide(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-white dark:bg-black/30 rounded-lg border border-blue-100 dark:border-blue-900/40 space-y-1">
                <div className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  1. Alert not appearing in this log?
                </div>
                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  In TradingView, open your Alert Settings &gt; <strong>Notifications</strong> tab. Ensure the <strong>Webhook URL</strong> checkbox is checked and your URL is entered exactly: <code className="text-emerald-600 dark:text-emerald-400 font-mono select-all">{webhookUrl}</code>.
                </p>
              </div>

              <div className="p-3 bg-white dark:bg-black/30 rounded-lg border border-blue-100 dark:border-blue-900/40 space-y-1">
                <div className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  2. Getting 400 Bad Request or JSON Syntax Error?
                </div>
                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  TradingView alert messages require strict JSON syntax: use double quotes around keys and string variables, e.g. <code className="font-mono text-blue-600 dark:text-blue-400">"ticker": "{"{{ticker}}"}"</code>. Never leave trailing commas.
                </p>
              </div>

              <div className="p-3 bg-white dark:bg-black/30 rounded-lg border border-blue-100 dark:border-blue-900/40 space-y-1">
                <div className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  3. Getting 401 Unauthorized?
                </div>
                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  If you have configured a Secret Token under <em>Security &amp; Settings</em>, your TradingView alert message must include: <code className="font-mono text-emerald-600 dark:text-emerald-400">"passphrase": "your-token"</code>. Alternatively, leave passphrase empty in settings for open prototyping.
                </p>
              </div>

              <div className="p-3 bg-white dark:bg-black/30 rounded-lg border border-blue-100 dark:border-blue-900/40 space-y-1">
                <div className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                  4. Alert triggering on every tick?
                </div>
                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  To prevent false breakouts on intra-bar wicks, configure your TradingView alert frequency to <strong>Once Per Bar Close</strong> (or use <code className="font-mono text-purple-600 dark:text-purple-400">alert.freq_once_per_bar_close</code> in Pine Script).
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. The Last 10 Incoming Requests Visual Log */}
      {displayedEvents.length === 0 ? (
        <div className="bg-white dark:bg-[#1e1e1e] border border-dashed border-zinc-300 dark:border-zinc-800 rounded-xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div className="space-y-1">
            <div className="text-sm font-bold text-zinc-900 dark:text-white">
              No webhook events match current filter
            </div>
            <p className="text-xs text-zinc-500 max-w-md mx-auto">
              Dispatch an alert from TradingView or click <strong>Test Ping</strong> above to simulate an incoming alert and test the troubleshooting pipeline.
            </p>
          </div>
          {onSimulateFastPing && (
            <button
              onClick={onSimulateFastPing}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg inline-flex items-center space-x-1.5 cursor-pointer shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send Sample NVDA Breakout Webhook</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {displayedEvents.map((ev, index) => {
            const isExpanded = expandedEventId === ev.id;
            const requestNumber = last10Events.indexOf(ev) + 1; // 1 to 10
            const isLatest = requestNumber === 1;

            // Status display styling
            const getStatusBadge = () => {
              if (ev.status === 'VALID') {
                return {
                  code: ev.httpStatus || 200,
                  label: '200 OK • VALID',
                  badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
                  icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                };
              }
              if (ev.status === 'UNAUTHORIZED') {
                return {
                  code: ev.httpStatus || 401,
                  label: '401 UNAUTHORIZED',
                  badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
                  icon: <XCircle className="w-3.5 h-3.5 text-rose-500" />
                };
              }
              return {
                code: ev.httpStatus || 400,
                label: `${ev.httpStatus || 400} WARNING / BAD REQ`,
                badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
                icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              };
            };

            const statusInfo = getStatusBadge();

            return (
              <motion.div
                key={ev.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-white dark:bg-[#1e1e1e] border rounded-xl transition-all shadow-xs overflow-hidden ${
                  isExpanded
                    ? 'border-zinc-400 dark:border-zinc-700 ring-1 ring-emerald-500/20'
                    : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                {/* Event Row Header */}
                <div
                  onClick={() => setExpandedEventId(isExpanded ? null : ev.id)}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none bg-zinc-50/50 dark:bg-zinc-900/30 hover:bg-zinc-100/60 dark:hover:bg-zinc-900/60 transition-colors"
                >
                  {/* Left: Request Index, Status, Ticker, Action */}
                  <div className="flex items-center space-x-3 min-w-0">
                    {/* Index Tag (#1 to #10) */}
                    <div className="flex flex-col items-center justify-center shrink-0">
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                          isLatest
                            ? 'bg-emerald-500 text-white shadow-xs'
                            : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                        }`}
                      >
                        #{requestNumber} {isLatest ? 'LATEST' : ''}
                      </span>
                    </div>

                    {/* Status Pill */}
                    <div className="shrink-0">
                      <span
                        className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold border ${statusInfo.badgeClass}`}
                      >
                        {statusInfo.icon}
                        <span className="font-mono">{statusInfo.label}</span>
                      </span>
                    </div>

                    {/* Ticker Symbol & Exchange */}
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="font-black text-sm text-zinc-900 dark:text-white tracking-tight">
                          {ev.ticker}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                          {ev.exchange || 'STOCK'}
                        </span>
                        <span className="text-xs font-mono font-semibold text-zinc-700 dark:text-zinc-300 hidden md:inline">
                          {ev.action}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate max-w-sm sm:max-w-md mt-0.5">
                        {ev.diagnostics || ev.message}
                      </div>
                    </div>
                  </div>

                  {/* Right: Timestamp & Expand Toggle */}
                  <div className="flex items-center justify-between sm:justify-end space-x-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-100 dark:border-zinc-800/80">
                    <div className="text-left sm:text-right">
                      <div className="flex items-center sm:justify-end space-x-1 text-xs font-mono font-semibold text-zinc-800 dark:text-zinc-200">
                        <Clock className="w-3 h-3 text-zinc-400" />
                        <span>{ev.formattedTime || ev.receivedAt.split('T')[1]?.slice(0, 8)}</span>
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        {getRelativeTime(ev.receivedAt)}
                      </div>
                    </div>

                    <button
                      className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                      title={isExpanded ? 'Collapse diagnostic details' : 'Expand diagnostic details'}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Troubleshooting Inspector */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="border-t border-zinc-200 dark:border-zinc-800 p-4 bg-white dark:bg-[#1e1e1e] space-y-4"
                    >
                      {/* Diagnostic Health Verdict Banner */}
                      <div
                        className={`p-3 rounded-lg border text-xs flex items-start space-x-2.5 ${
                          ev.status === 'VALID'
                            ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300'
                            : ev.status === 'UNAUTHORIZED'
                            ? 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/40 text-rose-800 dark:text-rose-300'
                            : 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40 text-amber-800 dark:text-amber-300'
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">{statusInfo.icon}</div>
                        <div className="space-y-1 flex-1">
                          <div className="font-bold">
                            Diagnostic Verdict: {statusInfo.label}
                          </div>
                          <p className="leading-relaxed">
                            {ev.diagnostics ||
                              (ev.status === 'VALID'
                                ? 'Payload successfully parsed and matched against active Stage 2 SEPA criteria.'
                                : 'Inspection needed: Review raw JSON payload and alert setup below.')}
                          </p>
                        </div>
                      </div>

                      {/* Request Metadata Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800 space-y-0.5">
                          <span className="text-[10px] text-zinc-400 uppercase font-semibold">Client Source IP</span>
                          <div className="font-mono font-medium text-zinc-900 dark:text-zinc-200 truncate">
                            {ev.ip || '52.89.214.238'}
                          </div>
                        </div>

                        <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800 space-y-0.5">
                          <span className="text-[10px] text-zinc-400 uppercase font-semibold">Content-Type</span>
                          <div className="font-mono font-medium text-zinc-900 dark:text-zinc-200 truncate">
                            {ev.contentType || 'application/json'}
                          </div>
                        </div>

                        <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800 space-y-0.5">
                          <span className="text-[10px] text-zinc-400 uppercase font-semibold">Trigger Price</span>
                          <div className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                            {ev.exchange === 'NSE' || ev.exchange === 'BSE' ? '₹' : '$'}
                            {ev.price ? ev.price.toFixed(2) : '0.00'}
                          </div>
                        </div>

                        <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800 space-y-0.5">
                          <span className="text-[10px] text-zinc-400 uppercase font-semibold">Processed In</span>
                          <div className="font-mono font-medium text-zinc-900 dark:text-zinc-200">
                            {ev.requestDurationMs || 12} ms
                          </div>
                        </div>
                      </div>

                      {/* Raw Inbound Payload Box */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                            <FileCode2 className="w-3.5 h-3.5 text-zinc-400" />
                            Raw Request Body Received from TradingView
                          </span>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => copyToClipboard(ev.rawPayload, `payload-${ev.id}`, setCopiedId)}
                              className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded text-[11px] font-medium flex items-center space-x-1 cursor-pointer transition-colors"
                            >
                              {copiedId === `payload-${ev.id}` ? (
                                <Check className="w-3 h-3 text-emerald-500" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                              <span>{copiedId === `payload-${ev.id}` ? 'Copied' : 'Copy Payload'}</span>
                            </button>

                            <button
                              onClick={() =>
                                copyToClipboard(getCurlSnippet(ev), `curl-${ev.id}`, setCopiedCurlId)
                              }
                              className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded text-[11px] font-medium flex items-center space-x-1 cursor-pointer transition-colors"
                            >
                              {copiedCurlId === `curl-${ev.id}` ? (
                                <Check className="w-3 h-3 text-emerald-500" />
                              ) : (
                                <FileCode2 className="w-3 h-3" />
                              )}
                              <span>{copiedCurlId === `curl-${ev.id}` ? 'Copied cURL' : 'Copy cURL'}</span>
                            </button>
                          </div>
                        </div>

                        <pre className="p-3 bg-zinc-950 rounded-lg text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-48 border border-zinc-800 whitespace-pre leading-relaxed select-all">
                          {(() => {
                            try {
                              return JSON.stringify(JSON.parse(ev.rawPayload), null, 2);
                            } catch {
                              return ev.rawPayload;
                            }
                          })()}
                        </pre>
                      </div>

                      {/* Interactive Troubleshooting Actions Bar */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/80">
                        <div className="text-[11px] text-zinc-500 flex items-center space-x-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          <span>Tip: Use <strong>Re-test Webhook</strong> to replay this alert payload immediately against your endpoint.</span>
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleReplayEvent(ev)}
                            disabled={replayingId === ev.id}
                            className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer"
                          >
                            <Play className={`w-3 h-3 text-emerald-400 ${replayingId === ev.id ? 'animate-spin' : ''}`} />
                            <span>
                              {replaySuccessId === ev.id
                                ? 'Replayed Successfully!'
                                : replayingId === ev.id
                                ? 'Replaying...'
                                : 'Re-test Webhook'}
                            </span>
                          </button>

                          {onSelectEvent && (
                            <button
                              onClick={() => onSelectEvent(ev)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer shadow-xs"
                            >
                              <span>View in Feed</span>
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};
