import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MinerviniTradeSetup } from '../types';
import {
  CHARTLINK_SCANNER_PRESETS,
  ChartlinkScannerPreset,
  runChartlinkScanOnUniverse,
  parseChartlinkImportText,
  ChartlinkScanResult,
} from '../utils/chartlinkScannerData';
import { getChartLinkUrl } from '../utils/chartLinkHelper';
import { formatCurrency, getCurrencySymbol } from '../utils/sepaCalculator';
import {
  Zap,
  ExternalLink,
  Copy,
  Check,
  Search,
  Sparkles,
  Target,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Layers,
  ArrowUpRight,
  Radio,
  Play,
  RotateCcw,
  Plus,
  Eye,
  CheckCircle2,
  FileCode,
  Globe,
  Sliders,
  ShieldCheck,
  Flame,
} from 'lucide-react';

interface ChartLinkScannerViewProps {
  stocks: MinerviniTradeSetup[];
  selectedStock?: MinerviniTradeSetup;
  onSelectStock: (stock: MinerviniTradeSetup) => void;
  onNavigateTab: (tab: any) => void;
  onAddToWatchlist?: (ticker: string) => void;
  isObsidian?: boolean;
}

export const ChartLinkScannerView: React.FC<ChartLinkScannerViewProps> = ({
  stocks,
  selectedStock,
  onSelectStock,
  onNavigateTab,
  onAddToWatchlist,
  isObsidian = true,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'PRESETS' | 'IMPORT' | 'WEBHOOK'>('PRESETS');
  const [selectedPresetId, setSelectedPresetId] = useState<string>(CHARTLINK_SCANNER_PRESETS[0].id);
  const [copiedPresetId, setCopiedPresetId] = useState<string | null>(null);
  const [importInput, setImportInput] = useState<string>('DIXON, KAYNES, TATAELXSI, ZOMATO, TRENT, HAL');
  const [importedResult, setImportedResult] = useState<MinerviniTradeSetup[] | null>(null);
  const [scanResultsMap, setScanResultsMap] = useState<Record<string, ChartlinkScanResult>>({});
  const [simulatedWebhookHistory, setSimulatedWebhookHistory] = useState<
    Array<{ id: string; scanName: string; stocks: string[]; triggeredAt: string }>
  >([
    {
      id: 'webhook-init-1',
      scanName: 'Minervini Stage 2 VCP Breakout',
      stocks: ['DIXON', 'TATAELXSI', 'KAYNES'],
      triggeredAt: '09:32:15 IST (Live Market)',
    },
    {
      id: 'webhook-init-2',
      scanName: 'VCP Volatility Dry-Up (T3/T4)',
      stocks: ['ZOMATO', 'HAL', 'RELIANCE'],
      triggeredAt: '10:15:00 IST (Live Market)',
    },
  ]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const activePreset = useMemo(() => {
    return CHARTLINK_SCANNER_PRESETS.find((p) => p.id === selectedPresetId) || CHARTLINK_SCANNER_PRESETS[0];
  }, [selectedPresetId]);

  // Execute scan on universe for active preset
  const handleRunScan = (preset: ChartlinkScannerPreset) => {
    const res = runChartlinkScanOnUniverse(preset, stocks);
    setScanResultsMap((prev) => ({ ...prev, [preset.id]: res }));
    showToast(`Scan executed! Found ${res.matchedStocks.length} matching setups for "${preset.name}".`);
  };

  const handleCopyFormula = (preset: ChartlinkScannerPreset) => {
    navigator.clipboard.writeText(preset.chartinkFormula);
    setCopiedPresetId(preset.id);
    showToast(`Copied Chartink formula for "${preset.name}" to clipboard.`);
    setTimeout(() => setCopiedPresetId(null), 3000);
  };

  const handleLaunchChartink = (preset: ChartlinkScannerPreset) => {
    // Open Chartink Minervini Screener in new tab
    const targetUrl = preset.chartinkUrl || 'https://chartink.com/screener/mark-minervini-trend-template-with-volume';
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  const handleProcessImport = () => {
    const res = parseChartlinkImportText(importInput, stocks);
    setImportedResult(res.recognized);
    showToast(`Parsed ${res.recognized.length} stocks from Chartink import!`);
  };

  const handleAddAllToWatchlist = (tickers: string[]) => {
    try {
      const saved: string[] = JSON.parse(localStorage.getItem('minervini_custom_watchlist') || '[]');
      let addedCount = 0;
      for (const t of tickers) {
        if (!saved.includes(t)) {
          saved.push(t);
          addedCount++;
        }
      }
      localStorage.setItem('minervini_custom_watchlist', JSON.stringify(saved));
      window.dispatchEvent(new CustomEvent('minervini_watchlist_updated'));
      showToast(`Added ${addedCount} stocks to your SEPA Watchlist!`);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSimulateWebhookTrigger = () => {
    const samplePicks = ['DIXON', 'KAYNES', 'TATAELXSI', 'ZOMATO', 'TRENT'];
    const newEntry = {
      id: `webhook-${Date.now()}`,
      scanName: activePreset.name,
      stocks: samplePicks.slice(0, 3 + Math.floor(Math.random() * 2)),
      triggeredAt: new Date().toLocaleTimeString() + ' IST (Simulated)',
    };
    setSimulatedWebhookHistory((prev) => [newEntry, ...prev.slice(0, 9)]);

    // Dispatch custom event for GlobalNotificationToast
    window.dispatchEvent(
      new CustomEvent('minervini_chartlink_scan_received', {
        detail: newEntry,
      })
    );
    showToast(`Simulated Chartink Alert dispatched for ${newEntry.stocks.join(', ')}!`);
  };

  // Active matched stocks for current preset
  const currentScanResult = scanResultsMap[activePreset.id];
  const matchedStocks = currentScanResult ? currentScanResult.matchedStocks : stocks.filter(activePreset.filterFn);

  return (
    <div className="space-y-6">
      
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-24 right-6 z-50 bg-[#0d131f] text-white border border-amber-500/70 px-4 py-3 shadow-2xl flex items-center space-x-3 text-xs font-mono rounded-lg"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Header Banner */}
      <div className={`p-6 sm:p-8 border shadow-sm transition-colors rounded-xl relative overflow-hidden ${
        isObsidian ? 'bg-[#0f1420] border-[#222c3d]' : 'bg-white border-[#e5e4e1]'
      }`}>
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-wrap items-center justify-between gap-6 border-b pb-6 border-slate-700/60">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center space-x-2.5">
              <span className="text-[10px] uppercase font-mono font-black tracking-[0.25em] px-2.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                CHARTINK.COM CONNECTOR
              </span>
              <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-amber-400">
                SEPA® Automated Scanners
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-serif font-black tracking-tight text-white flex items-center gap-2">
              <span>Chartink / ChartLink Scanner Hub</span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Live Sync
              </span>
            </h2>

            <p className="text-xs sm:text-sm font-sans text-slate-300 leading-relaxed">
              Seamless bridge between India&apos;s leading technical screener (Chartink.com) and the Minervini SEPA execution platform. Run custom VCP formulas, copy verified query code, import scanned candidates, or receive live webhook alerts.
            </p>
          </div>

          {/* Quick Header Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono">
            <a
              href="https://chartink.com/screener/mark-minervini-trend-template-with-volume"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold uppercase tracking-wider flex items-center space-x-2 transition-all shadow-md cursor-pointer"
            >
              <BarChart3 className="w-4 h-4" />
              <span>Minervini Trend Template (Chartink)</span>
              <ExternalLink className="w-3.5 h-3.5 text-blue-200" />
            </a>

            <button
              onClick={() => handleRunScan(activePreset)}
              className="px-4 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black uppercase tracking-wider flex items-center space-x-2 transition-all shadow-md cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Run Selected Scan</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center space-x-2 pt-4 text-xs font-mono">
          <button
            onClick={() => setActiveSubTab('PRESETS')}
            className={`px-4 py-2 rounded-lg font-bold flex items-center space-x-2 transition-all cursor-pointer ${
              activeSubTab === 'PRESETS'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Minervini Chartink Presets ({CHARTLINK_SCANNER_PRESETS.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('IMPORT')}
            className={`px-4 py-2 rounded-lg font-bold flex items-center space-x-2 transition-all cursor-pointer ${
              activeSubTab === 'IMPORT'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Import Scanned Tickers</span>
          </button>

          <button
            onClick={() => setActiveSubTab('WEBHOOK')}
            className={`px-4 py-2 rounded-lg font-bold flex items-center space-x-2 transition-all cursor-pointer ${
              activeSubTab === 'WEBHOOK'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Live Webhook Connector</span>
          </button>
        </div>
      </div>

      {/* SUBTAB 1: PRESETS & LIVE RUNNER */}
      {activeSubTab === 'PRESETS' && (
        <div className="space-y-6">
          
          {/* Preset Selector Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {CHARTLINK_SCANNER_PRESETS.map((preset) => {
              const isSelected = preset.id === selectedPresetId;
              const hasRun = !!scanResultsMap[preset.id];
              const matchesCount = hasRun
                ? scanResultsMap[preset.id].matchedStocks.length
                : stocks.filter(preset.filterFn).length;

              return (
                <div
                  key={preset.id}
                  onClick={() => setSelectedPresetId(preset.id)}
                  className={`p-5 rounded-xl border transition-all cursor-pointer space-y-3.5 ${
                    isSelected
                      ? 'bg-[#151c2a] border-amber-400 shadow-md ring-1 ring-amber-400/50'
                      : 'bg-[#0f1420] border-[#222c3d] hover:border-slate-600 hover:bg-[#121824]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${preset.badgeColor}`}>
                      {preset.tag}
                    </span>
                    <span className="text-[11px] font-mono text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded">
                      {matchesCount} Setups
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-serif font-black text-white leading-tight">
                      {preset.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                      {preset.description}
                    </p>
                  </div>

                  {/* Actions Row */}
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyFormula(preset);
                      }}
                      className="text-amber-400 hover:text-amber-300 font-bold flex items-center space-x-1 cursor-pointer"
                    >
                      {copiedPresetId === preset.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Formula</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPresetId(preset.id);
                        handleRunScan(preset);
                      }}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center space-x-1 cursor-pointer"
                    >
                      <Play className="w-3 h-3 fill-current text-amber-400" />
                      <span>Execute</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Preset Detailed Inspector */}
          <div className="bg-[#0f1420] border border-[#222c3d] rounded-xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold">
                  Active Formula Specification
                </span>
                <h3 className="text-lg font-serif font-black text-white">
                  {activePreset.name}
                </h3>
              </div>

              <div className="flex items-center space-x-2 text-xs font-mono">
                <button
                  onClick={() => handleCopyFormula(activePreset)}
                  className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold flex items-center space-x-1.5 border border-slate-700 cursor-pointer"
                >
                  {copiedPresetId === activePreset.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedPresetId === activePreset.id ? 'Copied' : 'Copy Query'}</span>
                </button>

                <a
                  href={activePreset.chartinkUrl || 'https://chartink.com/screener/mark-minervini-trend-template-with-volume'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center space-x-1.5 cursor-pointer shadow-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Run on Chartink.com</span>
                </a>
              </div>
            </div>

            {/* Formula Code Block */}
            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-xs text-amber-200/90 leading-relaxed overflow-x-auto selection:bg-amber-500 selection:text-black">
              <code>{activePreset.chartinkFormula}</code>
            </div>

            <p className="text-xs text-slate-400 font-sans">
              <strong>How to run on Chartink:</strong> Click &ldquo;Copy Query&rdquo; above or open <a href="https://chartink.com/screener/mark-minervini-trend-template-with-volume" target="_blank" rel="noreferrer" className="text-blue-400 underline font-bold">Chartink Minervini Screener</a> to scan all 2,000+ NSE cash stocks in real time.
            </p>
          </div>

          {/* Matched Stocks Table Panel */}
          <div className="bg-[#0f1420] border border-[#222c3d] rounded-xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-serif font-black text-white">
                    Qualified Candidates in Active Universe ({matchedStocks.length})
                  </h4>
                  <span className="text-[11px] font-mono text-slate-400">
                    Calculated against live SEPA rules and Bhavcopy records
                  </span>
                </div>
              </div>

              {matchedStocks.length > 0 && (
                <button
                  onClick={() => handleAddAllToWatchlist(matchedStocks.map((s) => s.ticker))}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-950/80 border border-emerald-600/70 hover:bg-emerald-900 text-emerald-300 font-mono text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add All ({matchedStocks.length}) to Watchlist</span>
                </button>
              )}
            </div>

            {/* Candidate Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {matchedStocks.map((stock) => {
                const currency = getCurrencySymbol(stock.exchange);
                const isSelected = selectedStock?.ticker === stock.ticker;

                return (
                  <div
                    key={`chartlink-match-${stock.ticker}`}
                    className={`p-4 rounded-xl border space-y-3 transition-all ${
                      isSelected
                        ? 'bg-[#182132] border-amber-400 shadow-md ring-1 ring-amber-400/50'
                        : 'bg-[#111622] border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <strong className="text-base font-black text-white">{stock.ticker}</strong>
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-black text-slate-300 uppercase font-bold">
                          {stock.exchange}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono font-bold text-amber-400">
                        RS {stock.rsRating}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 truncate">{stock.name}</p>

                    {/* Price & Pivot Metrics */}
                    <div className="grid grid-cols-3 gap-2 p-2.5 rounded bg-slate-950/80 border border-slate-900 text-center font-mono text-xs">
                      <div>
                        <span className="text-[9px] text-slate-500 uppercase block">Current</span>
                        <strong className="text-white">{currency}{stock.currentPrice}</strong>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 uppercase block">Pivot</span>
                        <strong className="text-emerald-400">{currency}{stock.pivotPrice}</strong>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 uppercase block">Stop</span>
                        <strong className="text-rose-400">{currency}{stock.stopLossPrice}</strong>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
                      {/* Direct ChartLink Button */}
                      <a
                        href={getChartLinkUrl(stock)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 font-bold flex items-center space-x-1 cursor-pointer"
                        title={`Open Live Chartink chart for ${stock.ticker}`}
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                        <span>ChartLink ↗</span>
                      </a>

                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (onAddToWatchlist) onAddToWatchlist(stock.ticker);
                            showToast(`Added ${stock.ticker} to watchlist.`);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
                          title="Add to Watchlist"
                        >
                          <Plus className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            onSelectStock(stock);
                            onNavigateTab('chart');
                          }}
                          className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] cursor-pointer"
                        >
                          VCP Chart
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: IMPORT SCANNED TICKERS */}
      {activeSubTab === 'IMPORT' && (
        <div className="bg-[#0f1420] border border-[#222c3d] rounded-xl p-6 space-y-6">
          <div className="space-y-2 border-b border-slate-800 pb-4">
            <h3 className="text-xl font-serif font-black text-white">
              Import Scanned Tickers from Chartink
            </h3>
            <p className="text-xs text-slate-300">
              Paste stock tickers exported or copied from any Chartink screener table (comma separated, newline separated, or tab-delimited). The engine will map them to SEPA setups, evaluate VCP metrics, and let you add them directly to your active watchlist.
            </p>
          </div>

          {/* Text Area Input */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400">
              <span>Paste Tickers / Symbols:</span>
              <button
                type="button"
                onClick={() => setImportInput('DIXON, KAYNES, TATAELXSI, ZOMATO, TRENT, HAL, PERSISTENT, COFORGE')}
                className="text-amber-400 hover:underline cursor-pointer"
              >
                Insert Sample Chartink Scan
              </button>
            </div>

            <textarea
              rows={4}
              value={importInput}
              onChange={(e) => setImportInput(e.target.value)}
              placeholder="e.g. RELIANCE, TCS, INFY, DIXON, KAYNES..."
              className="w-full p-3.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-amber-400 leading-relaxed"
            />

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handleProcessImport}
                className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-mono font-black text-xs uppercase tracking-wider flex items-center space-x-2 cursor-pointer shadow-md"
              >
                <Sparkles className="w-4 h-4 fill-current" />
                <span>Process &amp; Map Candidates</span>
              </button>

              {importedResult && importedResult.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleAddAllToWatchlist(importedResult.map((s) => s.ticker))}
                  className="px-4 py-2.5 rounded-lg bg-emerald-900/80 border border-emerald-600 hover:bg-emerald-800 text-emerald-200 font-mono text-xs font-bold flex items-center space-x-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add All ({importedResult.length}) to Watchlist</span>
                </button>
              )}
            </div>
          </div>

          {/* Imported Results Display */}
          {importedResult && (
            <div className="space-y-4 pt-4 border-t border-slate-800">
              <h4 className="text-base font-serif font-black text-white">
                Imported Setups ({importedResult.length} Stocks)
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {importedResult.map((stock) => (
                  <div
                    key={`imported-${stock.ticker}`}
                    className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <strong className="text-base font-black text-white">{stock.ticker}</strong>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        {stock.industry}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-400">Current: ₹{stock.currentPrice}</span>
                      <span className="text-emerald-400 font-bold">Pivot: ₹{stock.pivotPrice}</span>
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
                      <a
                        href={getChartLinkUrl(stock)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 font-bold flex items-center space-x-1"
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                        <span>ChartLink ↗</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => {
                          onSelectStock(stock);
                          onNavigateTab('chart');
                        }}
                        className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px]"
                      >
                        Analyze VCP
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 3: WEBHOOK & LIVE CONNECTOR */}
      {activeSubTab === 'WEBHOOK' && (
        <div className="bg-[#0f1420] border border-[#222c3d] rounded-xl p-6 space-y-6">
          <div className="space-y-2 border-b border-slate-800 pb-4">
            <div className="flex items-center space-x-2 text-emerald-400">
              <Radio className="w-4 h-4 animate-pulse" />
              <span className="text-xs font-mono uppercase font-bold tracking-widest">
                Real-Time Scanner Webhook Listener
              </span>
            </div>
            <h3 className="text-xl font-serif font-black text-white">
              Connect Chartink Alert Webhooks
            </h3>
            <p className="text-xs text-slate-300">
              Chartink allows setting up email / webhook notifications on any scanner. Configure your Chartink scanner alerts to notify this terminal whenever new breakouts or volume dry-ups trigger during live Indian market hours.
            </p>
          </div>

          {/* Webhook Endpoint Card */}
          <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 uppercase tracking-wider text-[10px]">
                Terminal Incoming Webhook URL:
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                LISTENING (HTTP POST)
              </span>
            </div>

            <div className="p-3 bg-slate-900 border border-slate-800 rounded text-amber-300 text-xs flex items-center justify-between">
              <code>{typeof window !== 'undefined' ? `${window.location.origin}/api/chartlink/webhook` : '/api/chartlink/webhook'}</code>
              <button
                type="button"
                onClick={() => {
                  const url = `${window.location.origin}/api/chartlink/webhook`;
                  navigator.clipboard.writeText(url);
                  showToast('Webhook endpoint URL copied to clipboard!');
                }}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center space-x-1 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy URL</span>
              </button>
            </div>

            <div className="pt-2 text-[11px] text-slate-400 space-y-1">
              <p><strong>Sample JSON Payload:</strong></p>
              <pre className="p-2.5 bg-slate-900/60 rounded text-slate-300 text-[10px]">
{`{
  "scan_name": "Minervini Stage 2 VCP",
  "stocks": "DIXON, KAYNES, TATAELXSI",
  "triggered_at": "09:32:15 IST"
}`}
              </pre>
            </div>
          </div>

          {/* Simulator Button */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <div>
              <strong className="text-sm font-serif font-black text-white block">
                Test Live Alert Integration
              </strong>
              <span className="text-xs text-slate-400">
                Simulate a real-time breakout alert being posted by Chartink.
              </span>
            </div>

            <button
              type="button"
              onClick={handleSimulateWebhookTrigger}
              className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-xs uppercase tracking-wider flex items-center space-x-2 transition-all cursor-pointer shadow-md"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>Simulate Chartink Alert</span>
            </button>
          </div>

          {/* Recent Webhook Trigger Feed */}
          <div className="space-y-3">
            <h4 className="text-sm font-mono uppercase font-bold text-slate-400 tracking-wider">
              Recent Chartink Scan Alerts:
            </h4>

            <div className="space-y-2">
              {simulatedWebhookHistory.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <strong className="text-white font-bold">{item.scanName}</strong>
                    </div>
                    <div className="text-slate-400 text-[11px]">
                      Triggered @ {item.triggeredAt}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {item.stocks.map((t) => (
                      <a
                        key={t}
                        href={getChartLinkUrl(t)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 rounded bg-blue-950/60 border border-blue-600/50 text-blue-300 font-bold hover:bg-blue-900 transition-colors"
                        title={`Open Chartink for ${t}`}
                      >
                        {t} ↗
                      </a>
                    ))}

                    <button
                      type="button"
                      onClick={() => handleAddAllToWatchlist(item.stocks)}
                      className="px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 font-bold cursor-pointer"
                    >
                      + Watchlist
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
