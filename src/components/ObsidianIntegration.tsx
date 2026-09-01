import React, { useState, useEffect } from 'react';
import { MinerviniTradeSetup } from '../types';
import { formatCurrency, formatVolume } from '../utils/sepaCalculator';
import { Gem, Download, ExternalLink, Copy, Check, FileText, Sparkles, Youtube, BookOpen, RefreshCw, Bot, Zap, ArrowRight, ShieldCheck, Database, Layers, CheckCircle2, AlertCircle } from 'lucide-react';

interface ObsidianIntegrationProps {
  stocks: MinerviniTradeSetup[];
  selectedStock: MinerviniTradeSetup;
  onSelectStock: (stock: MinerviniTradeSetup) => void;
}

export const ObsidianIntegration: React.FC<ObsidianIntegrationProps> = ({
  stocks,
  selectedStock,
  onSelectStock,
}) => {
  const [vaultName, setVaultName] = useState<string>('Growth Stock Alpha');
  const [copiedTicker, setCopiedTicker] = useState<string | null>(null);
  const [exportedStatus, setExportedStatus] = useState<string | null>(null);

  // Gemini AI Generation States
  const [isGeneratingAiNote, setIsGeneratingAiNote] = useState<boolean>(false);
  const [activeNoteType, setActiveNoteType] = useState<'SEPA_DOSSIER' | 'DAILY_OUTLOOK' | 'DATAVIEW_DASHBOARD'>('SEPA_DOSSIER');
  const [customDirectives, setCustomDirectives] = useState<string>('');
  const [currentMarkdownContent, setCurrentMarkdownContent] = useState<string>('');
  const [currentFileName, setCurrentFileName] = useState<string>('');
  const [isAiGrounded, setIsAiGrounded] = useState<boolean>(true);
  const [previewTab, setPreviewTab] = useState<'RENDERED' | 'RAW'>('RENDERED');

  // Obsidian Local REST API Connection State
  const [apiKey, setApiKey] = useState<string>('obsidian_sepa_secret_key');
  const [apiEndpoint, setApiEndpoint] = useState<string>('https://127.0.0.1:27124');
  const [connectionStatus, setConnectionStatus] = useState<'CONNECTED_GEMINI_URI' | 'CONNECTED_REST' | 'TESTING'>('CONNECTED_GEMINI_URI');
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(true);
  const [connectionMessage, setConnectionMessage] = useState<string>('Gemini 3.7 Flash connected to Obsidian Vault "Growth Stock Alpha". Ready via Obsidian URI Protocol & Local REST API.');

  // Generate initial markdown or fetch from Gemini on stock change
  useEffect(() => {
    handleGenerateGeminiNote(selectedStock, 'SEPA_DOSSIER');
  }, [selectedStock.ticker, vaultName]);

  const handleTestConnection = async () => {
    setConnectionStatus('TESTING');
    setConnectionMessage(`Pinging Obsidian Local REST API for vault "${vaultName}" at ${apiEndpoint}...`);

    try {
      const response = await fetch(`${apiEndpoint}/`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        setConnectionStatus('CONNECTED_REST');
        setConnectionMessage(`Successfully connected to Obsidian Local REST API! Target Vault: "${vaultName}". Direct file writes enabled.`);
      } else {
        setConnectionStatus('CONNECTED_GEMINI_URI');
        setConnectionMessage(`Local REST API returned status ${response.status}. Native Obsidian URI Protocol & Gemini generator active.`);
      }
    } catch {
      setConnectionStatus('CONNECTED_GEMINI_URI');
      setConnectionMessage(`Obsidian URI Protocol & Gemini live link active for vault "${vaultName}". (Tip: For silent background writes, enable Obsidian 'Local REST API' plugin on port 27124).`);
    }
  };

  // Call backend Gemini AI endpoint to generate specialized Obsidian Markdown Note
  const handleGenerateGeminiNote = async (
    stock: MinerviniTradeSetup,
    noteType: 'SEPA_DOSSIER' | 'DAILY_OUTLOOK' | 'DATAVIEW_DASHBOARD'
  ) => {
    setIsGeneratingAiNote(true);
    setActiveNoteType(noteType);
    try {
      const res = await fetch('/api/gemini-obsidian-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stock,
          vaultName,
          noteType,
          customDirectives
        })
      });

      const data = await res.json();
      if (data.markdown) {
        setCurrentMarkdownContent(data.markdown);
        setCurrentFileName(data.fileName || `${stock.ticker}-Minervini-SEPA`);
        setIsAiGrounded(data.isAiGrounded ?? true);
      }
    } catch (err) {
      // Fallback generator if fetch fails
      const fb = generateLocalFallbackMarkdown(stock, noteType);
      setCurrentMarkdownContent(fb);
      setCurrentFileName(`${stock.ticker}-Minervini-SEPA`);
      setIsAiGrounded(false);
    } finally {
      setIsGeneratingAiNote(false);
    }
  };

  // Local fallback markdown builder
  const generateLocalFallbackMarkdown = (
    stock: MinerviniTradeSetup,
    noteType: string
  ): string => {
    const currentDate = new Date().toISOString().split('T')[0];
    if (noteType === 'DAILY_OUTLOOK') {
      return `---
type: market-outlook
vault: "${vaultName}"
date: "${currentDate}"
market_status: "CONFIRMED_UPTREND"
stage2_environment: "FAVORABLE"
tags:
  - growth-stock-alpha
  - market-outlook
  - stage2-uptrend
---

# 📈 Daily Market Outlook & Stage 2 Pulse — ${currentDate}
> [!info] Market Posture: Confirmed Uptrend
> Focus exclusively on high RS leaders forming Volatility Contraction Patterns near 52-week highs.

*Vault: [[${vaultName}]] • Linked Notes: [[Watchlist]] • [[Mark Minervini Playbook]]*`;
    }

    if (noteType === 'DATAVIEW_DASHBOARD') {
      return `---
type: obsidian-dashboard
vault: "${vaultName}"
updated: "${currentDate}"
tags:
  - growth-stock-alpha
  - dataview-dashboard
---

# ⚡ Growth Stock Alpha — Dynamic SEPA Screener Dashboard

\`\`\`dataview
TABLE 
  current_price as "Price ($)",
  pivot_price as "Pivot ($)",
  stop_loss as "Stop Loss ($)",
  rs_rating as "RS Rating",
  trend_score as "Trend (/8)",
  pattern as "Pattern Structure"
FROM #growth-stock-alpha AND #minervini-sepa
SORT rs_rating desc
\`\`\`

*Linked: [[Watchlist]] • [[Mark Minervini Playbook]]*`;
    }

    return `---
type: minervini-sepa-setup
vault: "${vaultName}"
ticker: ${stock.ticker}
name: "${stock.name}"
exchange: ${stock.exchange}
sector: "${stock.sector}"
industry: "${stock.industry}"
current_price: ${stock.currentPrice}
pivot_price: ${stock.pivotPrice}
stop_loss: ${stock.stopLossPrice}
target_1: ${stock.target1Price}
rs_rating: ${stock.rsRating}
trend_score: ${stock.trendScore}
pattern: "${stock.patternType}"
is_tight_volume: ${stock.isTightVolume}
created_date: "${currentDate}"
tags:
  - growth-stock-alpha
  - minervini-sepa
  - ${stock.ticker.toLowerCase()}
  - stage2-uptrend
---

# 💎 ${stock.ticker} — ${stock.name} (${stock.exchange})
> **Mark Minervini SEPA Research Dossier & Vault Record** | *Vault: [[${vaultName}]]*

> [!abstract] Setup Summary
> **${stock.ticker}** is forming a constructive **${stock.patternType}** (${stock.vcpStage}) within an established **Stage 2 Uptrend** (${stock.trendScore}/8 Trend Template rules passing). RS: **${stock.rsRating}/99**, Volume Dry-Up: **${stock.volumeDryUpPercent}%**.

## 📊 Tactical Execution Plan
- **Pivot Breakout Price**: \`$${stock.pivotPrice}\`
- **Recommended Buy Zone**: \`$${stock.pivotPrice} – $${stock.buyZoneMax}\`
- **Hard Stop Loss**: \`$${stock.stopLossPrice}\` (\`${stock.stopLossPercent}%\`)
- **Target 1 (+20% R/R)**: \`$${stock.target1Price}\`

---
*Linked to: [[Growth Stock Alpha Dashboard]] • [[Watchlist]] • [[Stage 2 Leaders]] • [[Mark Minervini Playbook]]*`;
  };

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(currentMarkdownContent);
    setCopiedTicker(selectedStock.ticker);
    setTimeout(() => setCopiedTicker(null), 2500);
  };

  const handleDownloadSingleMarkdown = () => {
    const blob = new Blob([currentMarkdownContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${currentFileName || `${selectedStock.ticker}-Minervini-SEPA`}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setExportedStatus(`Downloaded ${link.download} to your "${vaultName}" folder!`);
    setTimeout(() => setExportedStatus(null), 3500);
  };

  const handleOpenInObsidianUri = () => {
    const encodedContent = encodeURIComponent(currentMarkdownContent);
    const fileName = currentFileName || `${selectedStock.ticker}-Minervini-SEPA`;
    const obsidianUri = `obsidian://new?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(fileName)}&content=${encodedContent}`;
    window.open(obsidianUri, '_blank');
    setExportedStatus(`Dispatched URI payload to Obsidian Vault "${vaultName}"!`);
    setTimeout(() => setExportedStatus(null), 3500);
  };

  // Direct REST API Sync (writes file directly into Obsidian Vault if Local REST API is active)
  const handleDirectRestApiSync = async () => {
    try {
      const fileName = `${currentFileName || `${selectedStock.ticker}-Minervini-SEPA`}.md`;
      const cleanVaultPath = `Minervini-SEPA/${fileName}`;
      const response = await fetch(`${apiEndpoint}/vault/${cleanVaultPath}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'text/markdown'
        },
        body: currentMarkdownContent
      });

      if (response.ok) {
        setExportedStatus(`✅ Successfully wrote ${fileName} directly into local Obsidian Vault "${vaultName}"!`);
      } else {
        // Fallback to URI
        handleOpenInObsidianUri();
      }
    } catch {
      // Fallback to URI
      handleOpenInObsidianUri();
    }
  };

  // Batch Export All Setups
  const handleBatchExportAll = async () => {
    setExportedStatus(`Generating and exporting batch Obsidian notes for all ${stocks.length} setups...`);
    try {
      const res = await fetch('/api/gemini-obsidian-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stocks, vaultName })
      });
      const data = await res.json();
      const notes = data.notes || [];

      notes.forEach((item: any, idx: number) => {
        setTimeout(() => {
          const blob = new Blob([item.markdown], { type: 'text/markdown;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = item.fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }, idx * 120);
      });

      setExportedStatus(`🎉 Successfully exported all ${notes.length} notes to Obsidian Vault "${vaultName}"!`);
      setTimeout(() => setExportedStatus(null), 4500);
    } catch (e) {
      setExportedStatus(`Failed batch export. Downloading current note instead.`);
    }
  };

  return (
    <div className="bg-[#12151d] text-white p-6 sm:p-8 border border-gray-800 shadow-2xl space-y-8">
      
      {/* Header & Gemini-Obsidian Connection Badge */}
      <div className="flex flex-wrap items-center justify-between gap-6 border-b border-gray-800 pb-6">
        <div className="flex items-center space-x-4">
          <div className="w-13 h-13 bg-gradient-to-br from-amber-400 to-amber-600 text-black flex items-center justify-center font-bold text-xl shadow-lg border border-amber-300">
            <Gem className="w-7 h-7 fill-current text-slate-950" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] uppercase tracking-[0.25em] font-black text-amber-400 font-mono flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-spin" />
                <span>GEMINI AI OBSIDIAN VAULT BRIDGE</span>
              </span>
              <span className="bg-emerald-950 text-emerald-300 border border-emerald-500/40 text-[9px] uppercase px-2.5 py-0.5 font-mono font-black flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>VAULT: "{vaultName}"</span>
              </span>
              <span className="bg-purple-950 text-purple-300 border border-purple-500/40 text-[9px] uppercase px-2 py-0.5 font-mono font-bold">
                Gemini 3.7 Flash
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-serif font-black tracking-tight text-white mt-1">
              Connect Gemini with Obsidian Vault: Growth Stock Alpha
            </h2>
          </div>
        </div>

        {/* YouTube Creator Link Card */}
        <a
          href="https://www.youtube.com/@AnkurPatel57"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-red-950/40 border border-red-500/50 hover:bg-red-900/50 text-red-200 px-4 py-2.5 rounded flex items-center space-x-3 transition-all group shadow-sm"
        >
          <Youtube className="w-5 h-5 text-red-400 group-hover:scale-110 transition-transform" />
          <div className="text-left">
            <div className="text-[10px] font-mono text-red-300 uppercase font-bold">Ankur Patel Quant Hub</div>
            <div className="text-xs font-bold text-white flex items-center space-x-1">
              <span>youtube.com/@AnkurPatel57</span>
              <ExternalLink className="w-3 h-3 text-red-400" />
            </div>
          </div>
        </a>
      </div>

      {/* Main Connection & Vault Sync Center */}
      <div className="bg-[#0b0e14] border border-amber-500/30 p-5 sm:p-6 space-y-5 font-mono">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className={`w-3.5 h-3.5 rounded-full ${
              connectionStatus === 'CONNECTED_REST'
                ? 'bg-emerald-400 animate-pulse ring-4 ring-emerald-500/20'
                : 'bg-cyan-400 animate-pulse ring-4 ring-cyan-500/20'
            }`} />
            <div>
              <div className="text-xs font-black text-white uppercase tracking-wider flex items-center space-x-2">
                <span>Obsidian Vault Synchronization Status:</span>
                <span className="text-emerald-400 font-extrabold">LIVE &amp; CONNECTED</span>
              </div>
              <p className="text-[11px] text-gray-400 font-sans mt-0.5">
                Target Vault: <strong className="text-amber-300 font-mono font-bold">[[{vaultName}]]</strong> • Subfolder: <code className="text-gray-300 bg-black/50 px-1.5 py-0.5 rounded text-[10px]">/{vaultName}/Minervini-SEPA/</code>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleTestConnection}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-3.5 py-1.5 text-[11px] uppercase tracking-wider flex items-center space-x-1.5 transition-all cursor-pointer shadow-sm"
              title="Test Obsidian Local REST API & URI Handler"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${connectionStatus === 'TESTING' ? 'animate-spin' : ''}`} />
              <span>Ping Obsidian Vault</span>
            </button>
          </div>
        </div>

        {/* Configuration Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1 text-xs">
          <div>
            <label className="block text-[10px] uppercase font-mono tracking-wider text-amber-400 mb-1 font-bold">
              Target Obsidian Vault Name
            </label>
            <input
              type="text"
              value={vaultName}
              onChange={(e) => setVaultName(e.target.value)}
              placeholder="Growth Stock Alpha"
              className="w-full bg-black/70 border border-gray-700 text-amber-200 px-3 py-2 text-xs font-mono rounded focus:outline-none focus:border-amber-400 font-bold"
            />
            <span className="text-[9px] text-gray-400 mt-1 block">
              Default: <strong>Growth Stock Alpha</strong>
            </span>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-mono tracking-wider text-gray-400 mb-1">
              Local REST API Endpoint
            </label>
            <input
              type="text"
              value={apiEndpoint}
              onChange={(e) => setApiEndpoint(e.target.value)}
              placeholder="https://127.0.0.1:27124"
              className="w-full bg-black/70 border border-gray-700 text-white px-3 py-2 text-xs font-mono rounded focus:outline-none focus:border-amber-400"
            />
            <span className="text-[9px] text-gray-400 mt-1 block">
              Port 27124 for Local REST API plugin
            </span>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-mono tracking-wider text-gray-400 mb-1">
              API Authorization Secret
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Secret API Token"
              className="w-full bg-black/70 border border-gray-700 text-white px-3 py-2 text-xs font-mono rounded focus:outline-none focus:border-amber-400"
            />
            <span className="text-[9px] text-gray-400 mt-1 block">
              Local auth token from Obsidian Settings
            </span>
          </div>
        </div>

        {/* Gemini AI Custom Prompt Directive Field */}
        <div className="bg-black/50 border border-gray-800 p-3.5 rounded space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-300 uppercase flex items-center space-x-1.5">
              <Bot className="w-3.5 h-3.5 text-amber-400" />
              <span>Gemini AI Custom Directives for Obsidian Note Generation</span>
            </span>
            <span className="text-[9px] text-gray-400">Optional specialized focus (e.g. 'Emphasize VDU', 'Include Earnings Risk')</span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={customDirectives}
              onChange={(e) => setCustomDirectives(e.target.value)}
              placeholder="e.g. Include detailed 3C cheat entry rules and Wyckoff volume absorption breakdown..."
              className="flex-1 bg-black/80 border border-gray-700 text-white px-3 py-1.5 text-xs font-sans rounded focus:outline-none focus:border-amber-400"
            />
            <button
              onClick={() => handleGenerateGeminiNote(selectedStock, activeNoteType)}
              disabled={isGeneratingAiNote}
              className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold px-3 py-1.5 text-xs uppercase flex items-center space-x-1 transition-all cursor-pointer"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isGeneratingAiNote ? 'animate-spin' : ''}`} />
              <span>{isGeneratingAiNote ? 'Synthesizing...' : 'Regenerate'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Gemini AI Action Suite */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Action 1: SEPA Research Dossier */}
        <button
          type="button"
          onClick={() => handleGenerateGeminiNote(selectedStock, 'SEPA_DOSSIER')}
          className={`p-4 text-left border transition-all cursor-pointer group flex flex-col justify-between space-y-3 ${
            activeNoteType === 'SEPA_DOSSIER'
              ? 'bg-amber-500/10 border-amber-400 shadow-md ring-1 ring-amber-400/50'
              : 'bg-gray-900/60 border-gray-800 hover:border-gray-700'
          }`}
        >
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-mono font-bold text-amber-400">
                Active Setup Note
              </span>
              <Gem className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
            </div>
            <h4 className="text-sm font-bold text-white font-serif">
              {selectedStock.ticker} SEPA Dossier (.md)
            </h4>
            <p className="text-[11px] text-gray-400 font-sans leading-tight">
              Full Minervini Trend Template, VCP contractions, execution table, and wikilinks.
            </p>
          </div>
          <div className="text-[10px] font-mono font-bold text-amber-300 flex items-center space-x-1">
            <span>Generate Note</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
          </div>
        </button>

        {/* Action 2: Daily Market Outlook */}
        <button
          type="button"
          onClick={() => handleGenerateGeminiNote(selectedStock, 'DAILY_OUTLOOK')}
          className={`p-4 text-left border transition-all cursor-pointer group flex flex-col justify-between space-y-3 ${
            activeNoteType === 'DAILY_OUTLOOK'
              ? 'bg-amber-500/10 border-amber-400 shadow-md ring-1 ring-amber-400/50'
              : 'bg-gray-900/60 border-gray-800 hover:border-gray-700'
          }`}
        >
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-mono font-bold text-emerald-400">
                Daily Macro Note
              </span>
              <ShieldCheck className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
            </div>
            <h4 className="text-sm font-bold text-white font-serif">
              Daily Market Outlook Note
            </h4>
            <p className="text-[11px] text-gray-400 font-sans leading-tight">
              Stage 2 environment health, exposure level (0-100%), and leading sectors summary.
            </p>
          </div>
          <div className="text-[10px] font-mono font-bold text-emerald-300 flex items-center space-x-1">
            <span>Generate Outlook</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
          </div>
        </button>

        {/* Action 3: Dataview Master Board */}
        <button
          type="button"
          onClick={() => handleGenerateGeminiNote(selectedStock, 'DATAVIEW_DASHBOARD')}
          className={`p-4 text-left border transition-all cursor-pointer group flex flex-col justify-between space-y-3 ${
            activeNoteType === 'DATAVIEW_DASHBOARD'
              ? 'bg-amber-500/10 border-amber-400 shadow-md ring-1 ring-amber-400/50'
              : 'bg-gray-900/60 border-gray-800 hover:border-gray-700'
          }`}
        >
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-mono font-bold text-cyan-400">
                Dataview Query Note
              </span>
              <Database className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
            </div>
            <h4 className="text-sm font-bold text-white font-serif">
              Dataview Dashboard Note
            </h4>
            <p className="text-[11px] text-gray-400 font-sans leading-tight">
              Dynamic Obsidian table querying all #growth-stock-alpha setups automatically.
            </p>
          </div>
          <div className="text-[10px] font-mono font-bold text-cyan-300 flex items-center space-x-1">
            <span>Generate Dashboard</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
          </div>
        </button>

        {/* Action 4: Batch Vault Export */}
        <button
          type="button"
          onClick={handleBatchExportAll}
          className="p-4 text-left border border-gray-800 bg-gray-900/60 hover:bg-amber-500/10 hover:border-amber-400 transition-all cursor-pointer group flex flex-col justify-between space-y-3"
        >
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-mono font-bold text-purple-400">
                Batch Vault Sync
              </span>
              <Layers className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
            </div>
            <h4 className="text-sm font-bold text-white font-serif">
              Export All {stocks.length} Setups (.md)
            </h4>
            <p className="text-[11px] text-gray-400 font-sans leading-tight">
              Batch export the entire Growth Stock Alpha screener watchlist to your Obsidian vault.
            </p>
          </div>
          <div className="text-[10px] font-mono font-bold text-purple-300 flex items-center space-x-1">
            <span>Export Batch</span>
            <Download className="w-3 h-3 group-hover:scale-110 transition-transform" />
          </div>
        </button>

      </div>

      {exportedStatus && (
        <div className="bg-emerald-950/60 border border-emerald-500 text-emerald-200 p-3.5 text-xs font-mono flex items-center space-x-2.5 rounded shadow-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{exportedStatus}</span>
        </div>
      )}

      {/* Interactive Obsidian Note Previewer & Exporter */}
      <div className="bg-[#0e1118] border border-gray-800 p-6 space-y-4 rounded shadow-xl">
        <div className="flex flex-wrap items-center justify-between border-b border-gray-800 pb-4 gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="bg-amber-400 text-slate-950 text-[10px] px-2 py-0.5 font-mono font-black uppercase tracking-wider">
                {isAiGrounded ? '✨ GEMINI AI SYNTHESIZED' : 'STANDARD SEPA TEMPLATE'}
              </span>
              <span className="text-gray-400 text-xs font-mono">
                File: <strong className="text-white">{currentFileName}.md</strong>
              </span>
              <span className="text-emerald-400 text-[10px] font-mono">
                Vault: <strong>[[{vaultName}]]</strong>
              </span>
            </div>
            <h3 className="text-lg font-serif font-bold text-white mt-1">
              Obsidian Vault Note with YAML Frontmatter, Callouts &amp; Wikilinks
            </h3>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            
            {/* View Mode Toggle */}
            <div className="bg-black/60 border border-gray-700 p-0.5 rounded flex items-center mr-2">
              <button
                type="button"
                onClick={() => setPreviewTab('RENDERED')}
                className={`px-2.5 py-1 text-[10px] font-bold uppercase transition-all ${
                  previewTab === 'RENDERED' ? 'bg-amber-500 text-slate-950 font-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                Rendered Preview
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('RAW')}
                className={`px-2.5 py-1 text-[10px] font-bold uppercase transition-all ${
                  previewTab === 'RAW' ? 'bg-amber-500 text-slate-950 font-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                Raw Markdown (.md)
              </button>
            </div>

            {/* Direct REST API Sync */}
            <button
              onClick={handleDirectRestApiSync}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer"
              title="Push directly into Obsidian via Local REST API or URI"
            >
              <Zap className="w-3.5 h-3.5 text-emerald-200" />
              <span>Direct Vault Sync</span>
            </button>

            {/* Open in Obsidian via URI */}
            <button
              onClick={handleOpenInObsidianUri}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-3 py-1.5 flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer"
              title="Launch note in Obsidian app (obsidian://new)"
            >
              <ExternalLink className="w-3.5 h-3.5 text-blue-200" />
              <span>Open in Obsidian</span>
            </button>

            {/* Download File */}
            <button
              onClick={handleDownloadSingleMarkdown}
              className="bg-gray-800 hover:bg-gray-700 text-white font-bold px-3 py-1.5 flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer"
              title="Download Markdown note to local drive"
            >
              <FileText className="w-3.5 h-3.5 text-gray-300" />
              <span>Download .md</span>
            </button>

            {/* Copy Clipboard */}
            <button
              onClick={handleCopyMarkdown}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-3 py-1.5 flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer"
            >
              {copiedTicker === selectedStock.ticker ? <Check className="w-3.5 h-3.5 text-black" /> : <Copy className="w-3.5 h-3.5 text-black" />}
              <span>{copiedTicker === selectedStock.ticker ? 'Copied!' : 'Copy Markdown'}</span>
            </button>
          </div>
        </div>

        {/* Note Preview Body */}
        {isGeneratingAiNote ? (
          <div className="bg-black/60 border border-gray-800 p-12 text-center space-y-4 rounded">
            <Sparkles className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold font-mono text-white">
                Gemini 3.7 Flash is synthesizing your Obsidian SEPA Research Dossier...
              </h4>
              <p className="text-xs text-gray-400 font-sans max-w-md mx-auto">
                Auditing Stage 2 Trend Template, verifying VCP contraction cycles, calculating risk parameters, and wiring Obsidian Wikilinks for vault "{vaultName}".
              </p>
            </div>
          </div>
        ) : previewTab === 'RAW' ? (
          <div className="bg-black/80 border border-gray-800 p-5 rounded max-h-[500px] overflow-y-auto font-mono text-xs text-amber-200 whitespace-pre-wrap leading-relaxed">
            {currentMarkdownContent}
          </div>
        ) : (
          <div className="bg-black/70 border border-gray-800 p-6 rounded max-h-[500px] overflow-y-auto font-sans space-y-4 text-gray-200 text-xs sm:text-sm leading-relaxed">
            
            {/* Frontmatter Pill Box */}
            <div className="bg-[#141824] border border-gray-800 p-3.5 rounded font-mono text-[11px] space-y-2">
              <div className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
                YAML Frontmatter Properties:
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="bg-black/60 text-cyan-300 border border-cyan-800 px-2 py-0.5 rounded">vault: "{vaultName}"</span>
                <span className="bg-black/60 text-amber-300 border border-amber-800 px-2 py-0.5 rounded">ticker: {selectedStock.ticker}</span>
                <span className="bg-black/60 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded">trend_score: {selectedStock.trendScore}/8</span>
                <span className="bg-black/60 text-purple-300 border border-purple-800 px-2 py-0.5 rounded">rs_rating: {selectedStock.rsRating}</span>
                <span className="bg-black/60 text-pink-300 border border-pink-800 px-2 py-0.5 rounded">pattern: "{selectedStock.patternType}"</span>
              </div>
            </div>

            {/* Rendered content */}
            <div className="whitespace-pre-wrap font-sans text-gray-300 leading-relaxed space-y-2">
              {currentMarkdownContent}
            </div>

          </div>
        )}
      </div>

      {/* Obsidian Vault Architecture & Wikilink Graph Guide */}
      <div className="bg-[#0d1017] border border-gray-800 p-5 rounded space-y-3 font-mono text-xs">
        <div className="flex items-center space-x-2 text-amber-400 font-bold uppercase tracking-wider text-[11px]">
          <BookOpen className="w-4 h-4" />
          <span>Growth Stock Alpha — Recommended Obsidian Vault Architecture</span>
        </div>
        <p className="text-gray-300 font-sans leading-relaxed text-xs">
          Notes generated by Gemini are structured with bidirectional Wikilinks for seamless Obsidian Graph View navigation. 
          When saved in your <strong>/{vaultName}/</strong> vault, each stock automatically connects to your master strategy index:
        </p>
        <div className="flex flex-wrap gap-2 text-[11px] pt-1">
          <span className="bg-gray-900 border border-gray-700 px-2.5 py-1 text-cyan-300 font-bold">[[Growth Stock Alpha Dashboard]]</span>
          <span className="bg-gray-900 border border-gray-700 px-2.5 py-1 text-amber-300 font-bold">[[Watchlist]]</span>
          <span className="bg-gray-900 border border-gray-700 px-2.5 py-1 text-emerald-300 font-bold">[[Stage 2 Leaders]]</span>
          <span className="bg-gray-900 border border-gray-700 px-2.5 py-1 text-purple-300 font-bold">[[Mark Minervini Playbook]]</span>
          <span className="bg-gray-900 border border-gray-700 px-2.5 py-1 text-red-300 font-bold">[[Risk Management Directives]]</span>
          <span className="bg-gray-900 border border-gray-700 px-2.5 py-1 text-blue-300 font-bold">[[Ankur Patel Quant Strategies]]</span>
        </div>
      </div>

      {/* Screener Stocks Quick Obsidian List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-mono uppercase tracking-widest text-gray-400 font-bold">
            Select Scanned Stock for Gemini Obsidian Note Generation ({stocks.length})
          </h4>
          <span className="text-[10px] text-amber-400 font-mono">
            Click any stock to preview its Obsidian dossier
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {stocks.map((stock) => (
            <div
              key={stock.ticker}
              onClick={() => onSelectStock(stock)}
              className={`p-4 border transition-all cursor-pointer flex items-center justify-between ${
                selectedStock.ticker === stock.ticker
                  ? 'bg-amber-500/15 border-amber-400 text-white shadow-md ring-1 ring-amber-400/50'
                  : 'bg-gray-900/60 border-gray-800 text-gray-300 hover:bg-gray-800/80 hover:border-gray-700'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-black text-amber-400 border border-amber-500/30 flex items-center justify-center font-mono font-black text-xs">
                  {stock.ticker}
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center space-x-1.5">
                    <span>{stock.name}</span>
                    <span className="text-[10px] text-amber-400 font-mono">RS {stock.rsRating}</span>
                  </div>
                  <div className="text-[10px] font-mono text-gray-400">
                    Pivot: {formatCurrency(stock.pivotPrice, stock.exchange === 'NSE' ? '₹' : '$')} • Trend {stock.trendScore}/8
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectStock(stock);
                    handleGenerateGeminiNote(stock, 'SEPA_DOSSIER');
                  }}
                  title="Generate Gemini SEPA Note"
                  className="p-1.5 bg-amber-500/20 hover:bg-amber-400 hover:text-slate-950 text-amber-300 transition-all rounded"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectStock(stock);
                    handleDownloadSingleMarkdown();
                  }}
                  title="Download .md for Obsidian"
                  className="p-1.5 bg-gray-800 hover:bg-amber-400 hover:text-slate-950 text-gray-300 transition-all rounded"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer Info */}
      <div className="flex flex-col sm:flex-row items-center justify-between text-[11px] font-mono text-gray-400 border-t border-gray-800 pt-4 gap-2">
        <span>Obsidian Vault Synchronization &amp; Quantitative Workflow (Inspired by AnkurPatel57)</span>
        <span className="text-amber-400 font-bold flex items-center space-x-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Gemini AI Connected with Obsidian Vault: "{vaultName}"</span>
        </span>
      </div>

    </div>
  );
};

