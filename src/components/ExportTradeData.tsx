import React, { useState, useMemo } from 'react';
import { MinerviniTradeSetup, PortfolioHolding, TradeJournalNote, PriceAlert } from '../types';
import { getStoredAlerts, getTrackerLogs } from '../utils/backgroundPriceChecker';
import { getStoredWatchlists } from '../utils/watchlistStorage';
import { DEFAULT_NSE_BHAVCOPY, DEFAULT_BSE_BHAVCOPY } from '../data/bhavcopyData';
import { exportRiskAdjustedScreenerPdf, generateSepaPdfReport } from '../utils/pdfExporter';
import { exportBrokerageWatchlistToCsv } from '../utils/csvExport';
import {
  Download,
  FileSpreadsheet,
  FileJson,
  FileText,
  Gem,
  Code,
  CheckCircle2,
  Table,
  HardDrive,
  Copy,
  Briefcase,
  BookMarked,
  BarChart3,
  Bell,
  Sparkles,
  Search,
  Filter,
  Eye,
  Radio,
  Bookmark,
  Check,
  Printer,
  ChevronDown
} from 'lucide-react';

const getStoredPortfolioHoldings = (): PortfolioHolding[] => {
  try {
    const raw = localStorage.getItem('minervini_sepa_portfolio');
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error(e);
  }
  return [];
};

const getStoredJournalNotes = (): TradeJournalNote[] => {
  try {
    const raw = localStorage.getItem('minervini_trade_journal');
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error(e);
  }
  return [];
};

interface ExportTradeDataProps {
  stocks: MinerviniTradeSetup[];
  isObsidian?: boolean;
}

export type ExportDataType =
  | 'SCREENER_SETUPS'
  | 'BHAVCOPY_DAILY'
  | 'PORTFOLIO'
  | 'TRADE_JOURNAL'
  | 'WATCHLIST'
  | 'PRICE_ALERTS'
  | 'BROKERAGE_WATCHLIST'
  | 'MASTER_BACKUP';

export type ExportFormat =
  | 'CSV'
  | 'PDF_REPORT'
  | 'JSON'
  | 'TRADINGVIEW'
  | 'OBSIDIAN_MD'
  | 'PINESCRIPT';

export const ExportTradeData: React.FC<ExportTradeDataProps> = ({ stocks, isObsidian = true }) => {
  const [exportType, setExportType] = useState<ExportDataType>('SCREENER_SETUPS');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('CSV');
  const [copiedStatus, setCopiedStatus] = useState<boolean>(false);
  const [previewFilter, setPreviewFilter] = useState<string>('');
  const [brokerageTarget, setBrokerageTarget] = useState<'zerodha' | 'groww' | 'angelone'>('zerodha');

  // Trigger file download in browser
  const downloadFile = (content: string, fileName: string, contentType: string) => {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Generate CSV data based on active export type
  const generateCSV = (): { content: string; filename: string } => {
    const today = new Date().toISOString().slice(0, 10);

    if (exportType === 'SCREENER_SETUPS') {
      const headers = ['Ticker', 'Name', 'Sector', 'Exchange', 'Price', 'Today %', 'RS Rating', 'SEPA Score', 'Pivot Price', 'Stop Loss', 'Vol DryUp %', 'VCP Stage'];
      const rows = stocks.map((s) => [
        s.ticker,
        `"${s.name.replace(/"/g, '""')}"`,
        `"${s.sector || ''}"`,
        s.exchange,
        s.currentPrice,
        s.changePercent,
        s.rsRating,
        s.trendScore,
        s.pivotPrice,
        s.stopLossPrice,
        s.volumeDryUpPercent,
        `"${s.vcpStage}"`,
      ]);
      const content = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      return { content, filename: `minervini_screener_setups_${today}.csv` };
    }

    if (exportType === 'BHAVCOPY_DAILY') {
      const allBhav = [...DEFAULT_NSE_BHAVCOPY, ...DEFAULT_BSE_BHAVCOPY];
      const headers = ['Symbol', 'Company Name', 'Exchange', 'Series', 'Close Price', 'Change %', 'Traded Qty', 'Turnover (Cr)', '52W High', '52W Low', 'Delivery %', 'RS Rating', 'SEPA Stage'];
      const rows = allBhav.map((b) => [
        b.symbol,
        `"${b.name.replace(/"/g, '""')}"`,
        b.exchange,
        b.series,
        b.close,
        b.changePercent,
        b.totalTradedQty,
        (b.totalTradedVal / 10000000).toFixed(2),
        b.high52w,
        b.low52w,
        b.deliveryPercent || 'N/A',
        b.rsRating,
        `"${b.sepaStage}"`,
      ]);
      const content = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      return { content, filename: `NSE_BSE_Bhavcopy_Settlement_${today}.csv` };
    }

    if (exportType === 'PORTFOLIO') {
      const holdings = getStoredPortfolioHoldings();
      const headers = ['Ticker', 'Stock Name', 'Exchange', 'Shares', 'Avg Entry Price', 'Current Price', 'Stop Loss', 'Pivot Target', 'Unrealized P&L %'];
      const rows = holdings.map((h) => {
        const pnlPct = h.entryPrice ? (((h.currentPrice - h.entryPrice) / h.entryPrice) * 100).toFixed(2) : '0.00';
        return [
          h.ticker,
          `"${h.stockName.replace(/"/g, '""')}"`,
          h.exchange,
          h.shares,
          h.entryPrice,
          h.currentPrice,
          h.stopLossPrice,
          h.pivotTargetPrice,
          pnlPct,
        ];
      });
      const content = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      return { content, filename: `minervini_portfolio_holdings_${today}.csv` };
    }

    if (exportType === 'TRADE_JOURNAL') {
      const entries = getStoredJournalNotes();
      const headers = ['Date', 'Ticker', 'Stock Name', 'Exchange', 'Setup Type', 'Status', 'Entry Price', 'Exit Price', 'Rating', 'Emotional State', 'Key Lesson', 'Notes'];
      const rows = entries.map((e) => [
        e.date,
        e.ticker,
        `"${e.stockName.replace(/"/g, '""')}"`,
        e.exchange,
        `"${e.setupType || ''}"`,
        e.tradeStatus,
        e.entryPrice || '',
        e.exitPrice || '',
        e.rating || 5,
        e.emotionalState || 'DISCIPLINED',
        `"${(e.keyLesson || '').replace(/"/g, '""')}"`,
        `"${(e.notes || '').replace(/"/g, '""')}"`,
      ]);
      const content = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      return { content, filename: `minervini_trade_journal_${today}.csv` };
    }

    if (exportType === 'WATCHLIST') {
      const watchlists = getStoredWatchlists();
      const allTickers = Array.from(new Set(watchlists.flatMap(w => w.tickers)));
      const matched = allTickers.map(t => stocks.find(s => s.ticker === t) || { ticker: t, name: t, currentPrice: 0, pivotPrice: 0, stopLossPrice: 0, rsRating: 0 });
      const headers = ['Ticker', 'Name', 'Current Price', 'Pivot Price', 'Stop Loss', 'RS Rating'];
      const rows = matched.map(m => [
        m.ticker,
        `"${m.name.replace(/"/g, '""')}"`,
        m.currentPrice,
        m.pivotPrice,
        m.stopLossPrice,
        m.rsRating,
      ]);
      const content = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      return { content, filename: `minervini_watchlist_${today}.csv` };
    }

    if (exportType === 'PRICE_ALERTS') {
      const alerts = getStoredAlerts();
      const headers = ['Ticker', 'Exchange', 'Target Type', 'Target Price', 'Current Price', 'Proximity %', 'Status', 'Triggered At', 'Notes'];
      const rows = alerts.map((a) => [
        a.ticker,
        a.exchange,
        a.targetType,
        a.targetPrice,
        a.currentPrice,
        a.triggerProximityPercent,
        a.status,
        a.triggeredAt || '',
        `"${(a.notes || '').replace(/"/g, '""')}"`,
      ]);
      const content = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      return { content, filename: `minervini_price_alerts_${today}.csv` };
    }

    if (exportType === 'BROKERAGE_WATCHLIST') {
      if (brokerageTarget === 'zerodha') {
        const headers = ['tradingsymbol', 'exchange', 'instrument_token', 'name'];
        const rows = stocks.map((s) => [s.ticker, s.exchange || 'NSE', '', `"${s.name.replace(/"/g, '""')}"`]);
        const content = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
        return { content, filename: `Zerodha_Kite_Watchlist_${today}.csv` };
      } else if (brokerageTarget === 'groww') {
        const headers = ['Symbol', 'Exchange', 'Segment', 'Alert Price'];
        const rows = stocks.map((s) => [s.ticker, s.exchange || 'NSE', 'EQUITY', s.pivotPrice]);
        const content = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
        return { content, filename: `Groww_Watchlist_${today}.csv` };
      } else {
        const headers = ['Scriptname', 'Exchange', 'Token', 'BuyTriggerPrice', 'StopLossPrice'];
        const rows = stocks.map((s) => [s.ticker, s.exchange || 'NSE', '', s.pivotPrice, s.stopLossPrice]);
        const content = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
        return { content, filename: `AngelOne_Watchlist_${today}.csv` };
      }
    }

    // Default Master Backup as CSV (Screener)
    const headers = ['Ticker', 'Name', 'Sector', 'Price', 'RS Rating', 'Trend Score', 'Pivot Price', 'Stop Loss'];
    const rows = stocks.map((s) => [s.ticker, `"${s.name}"`, `"${s.sector || ''}"`, s.currentPrice, s.rsRating, s.trendScore, s.pivotPrice, s.stopLossPrice]);
    const content = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    return { content, filename: `minervini_master_data_${today}.csv` };
  };

  // Generate JSON content
  const generateJSON = (): { content: string; filename: string } => {
    const today = new Date().toISOString().slice(0, 10);
    let rawData: any = stocks;
    let filenamePrefix = 'screener';

    if (exportType === 'BHAVCOPY_DAILY') {
      rawData = { nse: DEFAULT_NSE_BHAVCOPY, bse: DEFAULT_BSE_BHAVCOPY, exportDate: today };
      filenamePrefix = 'bhavcopy';
    } else if (exportType === 'PORTFOLIO') {
      rawData = getStoredPortfolioHoldings();
      filenamePrefix = 'portfolio';
    } else if (exportType === 'TRADE_JOURNAL') {
      rawData = getStoredJournalNotes();
      filenamePrefix = 'journal';
    } else if (exportType === 'WATCHLIST') {
      rawData = getStoredWatchlists();
      filenamePrefix = 'watchlist';
    } else if (exportType === 'PRICE_ALERTS') {
      rawData = { alerts: getStoredAlerts(), trackerLogs: getTrackerLogs() };
      filenamePrefix = 'alerts';
    } else if (exportType === 'MASTER_BACKUP') {
      rawData = {
        screenerStocks: stocks,
        portfolioHoldings: getStoredPortfolioHoldings(),
        tradeJournal: getStoredJournalNotes(),
        watchlists: getStoredWatchlists(),
        priceAlerts: getStoredAlerts(),
        trackerLogs: getTrackerLogs(),
        metadata: {
          exportTimestamp: new Date().toISOString(),
          version: '2.0.0',
          appName: 'Growth Stock Alpha — Minervini SEPA Engine',
        },
      };
      filenamePrefix = 'master_full_backup';
    }

    const content = JSON.stringify(rawData, null, 2);
    return { content, filename: `minervini_${filenamePrefix}_export_${today}.json` };
  };

  // Generate TradingView formatted text list
  const generateTradingViewText = (): { content: string; filename: string } => {
    const today = new Date().toISOString().slice(0, 10);
    let tickersList: string[] = [];

    if (exportType === 'BHAVCOPY_DAILY') {
      const allBhav = [...DEFAULT_NSE_BHAVCOPY, ...DEFAULT_BSE_BHAVCOPY];
      tickersList = allBhav.map(b => `${b.exchange || 'NSE'}:${b.symbol}`);
    } else if (exportType === 'WATCHLIST') {
      const wls = getStoredWatchlists();
      const set = new Set(wls.flatMap(w => w.tickers));
      tickersList = Array.from(set).map(t => `NSE:${t}`);
    } else {
      tickersList = stocks.map(s => `${s.exchange || 'NSE'}:${s.ticker}`);
    }

    const content = tickersList.join(',\n');
    return { content, filename: `TradingView_Watchlist_${today}.txt` };
  };

  // Generate Obsidian Markdown content
  const generateObsidianMD = (): { content: string; filename: string } => {
    const today = new Date().toISOString().slice(0, 10);

    if (exportType === 'PORTFOLIO') {
      const holdings = getStoredPortfolioHoldings();
      let md = `---
tags:
  - trading/portfolio
  - minervini/sepa
  - stock-market
date: ${today}
---

# 💼 Minervini SEPA Portfolio Holdings — ${today}

| Ticker | Exchange | Shares | Entry Price | Current Price | Stop Loss | P&L % |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
`;
      holdings.forEach((h) => {
        const pnl = h.entryPrice ? (((h.currentPrice - h.entryPrice) / h.entryPrice) * 100).toFixed(2) : '0.00';
        md += `| **[[${h.ticker}]]** | ${h.exchange} | ${h.shares} | $${h.entryPrice} | $${h.currentPrice} | $${h.stopLossPrice} | **${pnl}%** |\n`;
      });
      md += `\n\n> Exported automatically from Growth Stock Alpha (Minervini SEPA Intelligence)`;
      return { content: md, filename: `Minervini_Portfolio_${today}.md` };
    }

    if (exportType === 'BHAVCOPY_DAILY') {
      const allBhav = DEFAULT_NSE_BHAVCOPY.slice(0, 25);
      let md = `---
tags:
  - trading/bhavcopy
  - nse/settlement
  - minervini/stage2
date: ${today}
---

# 📊 NSE Bhavcopy Settlement Leaders — ${today}

| Symbol | Name | Close | Change % | Delivery % | RS Rating | SEPA Stage |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
`;
      allBhav.forEach(b => {
        md += `| **[[${b.symbol}]]** | ${b.name} | ₹${b.close} | ${b.changePercent}% | ${b.deliveryPercent || 'N/A'}% | ${b.rsRating} | ${b.sepaStage} |\n`;
      });
      return { content: md, filename: `Bhavcopy_Leaders_${today}.md` };
    }

    // Default Screener / Setups Obsidian Markdown Note
    let md = `---
tags:
  - trading/screener
  - minervini/vcp
  - growth-stocks
date: ${today}
---

# 📈 Minervini SEPA Qualified Trade Setups — ${today}

Total Qualified Stocks: **${stocks.length}**

## 🎯 Qualified Setups Table

| Ticker | Name | RS Rating | SEPA Score | Pivot Price | Stop Loss | Vol Dry-Up % |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
`;
    stocks.forEach((s) => {
      md += `| **[[${s.ticker}]]** | ${s.name} | RS ${s.rsRating} | ${s.trendScore}/8 | $${s.pivotPrice} | $${s.stopLossPrice} | ${s.volumeDryUpPercent}% |\n`;
    });

    md += `\n\n## 📝 Strategy Rules
- [ ] Verify 8/8 Trend Template criteria on daily chart.
- [ ] Confirm volume dry-up (< -50% 20-day avg) prior to pivot breakout.
- [ ] Place hard stop loss within 3% - 7% of pivot level.

---
*Exported from Growth Stock Alpha SEPA Suite*`;
    return { content: md, filename: `Minervini_Setups_${today}.md` };
  };

  // Generate PineScript v6 Indicator
  const generatePineScript = (): { content: string; filename: string } => {
    const code = `//@version=6
indicator("Minervini SEPA VCP Overlay [Growth Stock Alpha]", overlay=true)

// --- MINERVINI TREND TEMPLATE EMAs & SMAs ---
ema10 = ta.ema(close, 10)
ema20 = ta.ema(close, 20)
sma50 = ta.sma(close, 50)
sma150 = ta.sma(close, 150)
sma200 = ta.sma(close, 200)

plot(ema10, title="10 EMA", color=color.rgb(56, 189, 248), linewidth=2)
plot(ema20, title="20 EMA", color=color.rgb(251, 191, 36), linewidth=1)
plot(sma50, title="50 SMA", color=color.rgb(168, 85, 247), linewidth=2)
plot(sma150, title="150 SMA", color=color.rgb(52, 211, 153), linewidth=1)
plot(sma200, title="200 SMA", color=color.rgb(244, 63, 94), linewidth=2)

// --- SEPA 8-POINT TREND TEMPLATE CONDITION ---
c1 = close > sma150 and close > sma200
c2 = sma150 > sma200
c3 = sma200 > sma200[20]
c4 = sma50 > sma150 and sma50 > sma200
c5 = close > sma50
c6 = close >= ta.lowest(low, 252) * 1.30
c7 = close >= ta.highest(high, 252) * 0.75

sepaTrendPass = c1 and c2 and c3 and c4 and c5 and c6 and c7

// --- VOLATILITY DRY-UP (VDU) DETECTION ---
volAvg20 = ta.sma(volume, 20)
isVolumeDryUp = volume <= (volAvg20 * 0.50)
isTightRange = (high - low) <= (ta.sma(high - low, 20) * 0.60)

vcpPrimed = sepaTrendPass and isVolumeDryUp and isTightRange

plotshape(vcpPrimed, title="VCP Primed Alert", style=shape.triangleup, location=location.belowbar, color=color.emerald, size=size.small, text="VCP PRIMED")
alertcondition(vcpPrimed, title="Minervini VCP Primed Alert", message="VCP Volatility Dry-Up Primed for {{ticker}}!")
`;
    return { content: code, filename: `Minervini_SEPA_Overlay.ps` };
  };

  // Perform export action
  const handleExport = () => {
    if (exportFormat === 'PDF_REPORT') {
      exportRiskAdjustedScreenerPdf(stocks, { filterName: 'Minervini SEPA Qualified Candidates' });
      return;
    }

    let result = { content: '', filename: '' };
    let mimeType = 'text/plain';

    if (exportFormat === 'CSV') {
      result = generateCSV();
      mimeType = 'text/csv;charset=utf-8;';
    } else if (exportFormat === 'JSON') {
      result = generateJSON();
      mimeType = 'application/json;charset=utf-8;';
    } else if (exportFormat === 'TRADINGVIEW') {
      result = generateTradingViewText();
      mimeType = 'text/plain;charset=utf-8;';
    } else if (exportFormat === 'OBSIDIAN_MD') {
      result = generateObsidianMD();
      mimeType = 'text/markdown;charset=utf-8;';
    } else if (exportFormat === 'PINESCRIPT') {
      result = generatePineScript();
      mimeType = 'text/plain;charset=utf-8;';
    }

    downloadFile(result.content, result.filename, mimeType);
  };

  // Copy formatted content to clipboard
  const handleCopyToClipboard = () => {
    let result = { content: '', filename: '' };
    if (exportFormat === 'CSV') result = generateCSV();
    else if (exportFormat === 'JSON') result = generateJSON();
    else if (exportFormat === 'TRADINGVIEW') result = generateTradingViewText();
    else if (exportFormat === 'OBSIDIAN_MD') result = generateObsidianMD();
    else if (exportFormat === 'PINESCRIPT') result = generatePineScript();
    else if (exportFormat === 'PDF_REPORT') {
      // If PDF, copy the markdown or CSV summary
      result = generateCSV();
    }

    navigator.clipboard.writeText(result.content);
    setCopiedStatus(true);
    setTimeout(() => setCopiedStatus(false), 2500);
  };

  // Preview Data Items
  const previewRows = useMemo(() => {
    let rows: Array<{ col1: string; col2: string; col3: string; col4: string; col5: string }> = [];

    if (exportType === 'SCREENER_SETUPS' || exportType === 'BROKERAGE_WATCHLIST') {
      rows = stocks.map(s => ({
        col1: s.ticker,
        col2: s.name,
        col3: `$${s.currentPrice}`,
        col4: `RS ${s.rsRating}`,
        col5: s.vcpStage,
      }));
    } else if (exportType === 'BHAVCOPY_DAILY') {
      const allBhav = [...DEFAULT_NSE_BHAVCOPY, ...DEFAULT_BSE_BHAVCOPY];
      rows = allBhav.map(b => ({
        col1: b.symbol,
        col2: b.name,
        col3: `₹${b.close}`,
        col4: `${b.changePercent > 0 ? '+' : ''}${b.changePercent}%`,
        col5: b.sepaStage,
      }));
    } else if (exportType === 'PORTFOLIO') {
      const holdings = getStoredPortfolioHoldings();
      rows = holdings.map(h => ({
        col1: h.ticker,
        col2: h.stockName,
        col3: `$${h.currentPrice}`,
        col4: `${h.shares} Sh`,
        col5: `Stop: $${h.stopLossPrice}`,
      }));
    } else if (exportType === 'TRADE_JOURNAL') {
      const entries = getStoredJournalNotes();
      rows = entries.map(e => ({
        col1: e.ticker,
        col2: e.date,
        col3: e.tradeStatus,
        col4: `${e.rating || 5} ★`,
        col5: e.emotionalState || 'DISCIPLINED',
      }));
    } else if (exportType === 'WATCHLIST') {
      const wls = getStoredWatchlists();
      const allTickers = Array.from(new Set(wls.flatMap(w => w.tickers)));
      rows = allTickers.map(t => ({
        col1: t,
        col2: 'Watchlist Candidate',
        col3: 'Stage 2',
        col4: 'Active Coiling',
        col5: 'Ready',
      }));
    } else if (exportType === 'PRICE_ALERTS') {
      const alerts = getStoredAlerts();
      rows = alerts.map(a => ({
        col1: a.ticker,
        col2: a.targetType,
        col3: `$${a.targetPrice}`,
        col4: `${a.triggerProximityPercent}% Prox`,
        col5: a.status,
      }));
    } else {
      // Master backup
      rows = stocks.map(s => ({
        col1: s.ticker,
        col2: s.name,
        col3: 'SEPA Stock',
        col4: `Score ${s.trendScore}/8`,
        col5: 'Archived',
      }));
    }

    if (previewFilter.trim()) {
      const q = previewFilter.toLowerCase();
      return rows.filter(r =>
        r.col1.toLowerCase().includes(q) ||
        r.col2.toLowerCase().includes(q) ||
        r.col3.toLowerCase().includes(q) ||
        r.col4.toLowerCase().includes(q) ||
        r.col5.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [exportType, stocks, previewFilter]);

  return (
    <div
      id="export-trade-data-container"
      className={`border p-4 sm:p-6 shadow-xl space-y-6 transition-colors duration-300 font-sans ${
        isObsidian
          ? 'bg-[#11141b] border-[#242b38] text-white'
          : 'bg-white border-[#e5e4e1] text-[#1a1a1a]'
      }`}
    >
      {/* Header Banner */}
      <div
        className={`flex flex-wrap items-center justify-between gap-4 border-b pb-4 ${
          isObsidian ? 'border-[#242b38]' : 'border-[#e5e4e1]'
        }`}
      >
        <div className="flex items-center space-x-3.5">
          <div
            className={`w-11 h-11 border flex items-center justify-center shrink-0 rounded-sm ${
              isObsidian
                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-400'
                : 'bg-emerald-50 border-emerald-600 text-emerald-700'
            }`}
          >
            <Download className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] uppercase font-mono tracking-[0.25em] text-emerald-500 font-bold block">
                Data Sovereignty &amp; Interoperability
              </span>
              <span
                className={`text-[9px] px-2 py-0.5 font-bold uppercase rounded-xs ${
                  isObsidian
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                CSV • PDF • JSON • TradingView • Brokerages
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-serif font-black tracking-tight mt-0.5">
              Export Trade Data &amp; Strategy Analytics
            </h3>
          </div>
        </div>

        {/* Quick Action Top Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopyToClipboard}
            className={`font-mono text-xs font-bold uppercase tracking-wider px-3.5 py-2 flex items-center space-x-2 border transition-all cursor-pointer rounded-xs ${
              isObsidian
                ? 'bg-[#161b22] hover:bg-[#1f242d] text-amber-300 border-amber-500/50'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-800 border-gray-300'
            }`}
          >
            {copiedStatus ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-amber-400" />
                <span>Copy Data</span>
              </>
            )}
          </button>

          {exportFormat === 'PDF_REPORT' ? (
            <button
              type="button"
              onClick={handleExport}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-black px-4 py-2 text-xs uppercase tracking-wider flex items-center space-x-2 border border-emerald-400 shadow-md transition-all cursor-pointer rounded-xs"
            >
              <Printer className="w-4 h-4 text-white" />
              <span>Generate PDF Dossier</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleExport}
              className="bg-emerald-700 hover:bg-emerald-600 text-white font-mono font-black px-4 py-2 text-xs uppercase tracking-wider flex items-center space-x-2 border border-emerald-500 shadow-md transition-all cursor-pointer rounded-xs"
            >
              <Download className="w-4 h-4 text-white" />
              <span>Download {exportFormat}</span>
            </button>
          )}
        </div>
      </div>

      {/* Step 1 & Step 2 Selection Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Step 1: Select Trade Data Subject */}
        <div
          className={`border p-4 space-y-3 rounded-xs ${
            isObsidian ? 'bg-[#161a22] border-[#242b38]' : 'bg-[#faf9f6] border-[#e5e4e1]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-mono font-bold text-emerald-500 tracking-wider">
              1. Select Trade Data Subject
            </span>
            <span className="text-[10px] font-mono text-gray-400">
              {stocks.length} Setups Loaded
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {/* Screener Qualified Setups */}
            <button
              type="button"
              onClick={() => setExportType('SCREENER_SETUPS')}
              className={`p-2.5 text-left border flex flex-col justify-between transition-all cursor-pointer rounded-xs ${
                exportType === 'SCREENER_SETUPS'
                  ? 'bg-emerald-950/80 text-white border-emerald-500 font-bold shadow-xs'
                  : isObsidian
                  ? 'bg-[#0e1117] text-gray-300 border-[#2b3342] hover:border-gray-500'
                  : 'bg-white text-gray-800 border-[#e5e4e1] hover:border-gray-400'
              }`}
            >
              <div className="flex items-center space-x-2 mb-1">
                <BarChart3 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-semibold truncate">Screener Setups</span>
              </div>
              <span className="text-[10px] text-gray-400 font-mono">SEPA 8/8 Criteria ({stocks.length})</span>
            </button>

            {/* Bhavcopy Settlement Records */}
            <button
              type="button"
              onClick={() => setExportType('BHAVCOPY_DAILY')}
              className={`p-2.5 text-left border flex flex-col justify-between transition-all cursor-pointer rounded-xs ${
                exportType === 'BHAVCOPY_DAILY'
                  ? 'bg-emerald-950/80 text-white border-emerald-500 font-bold shadow-xs'
                  : isObsidian
                  ? 'bg-[#0e1117] text-gray-300 border-[#2b3342] hover:border-gray-500'
                  : 'bg-white text-gray-800 border-[#e5e4e1] hover:border-gray-400'
              }`}
            >
              <div className="flex items-center space-x-2 mb-1">
                <FileSpreadsheet className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="font-semibold truncate">NSE / BSE Bhavcopy</span>
              </div>
              <span className="text-[10px] text-gray-400 font-mono">Settlement &amp; Delivery Data</span>
            </button>

            {/* Portfolio Holdings */}
            <button
              type="button"
              onClick={() => setExportType('PORTFOLIO')}
              className={`p-2.5 text-left border flex flex-col justify-between transition-all cursor-pointer rounded-xs ${
                exportType === 'PORTFOLIO'
                  ? 'bg-emerald-950/80 text-white border-emerald-500 font-bold shadow-xs'
                  : isObsidian
                  ? 'bg-[#0e1117] text-gray-300 border-[#2b3342] hover:border-gray-500'
                  : 'bg-white text-gray-800 border-[#e5e4e1] hover:border-gray-400'
              }`}
            >
              <div className="flex items-center space-x-2 mb-1">
                <Briefcase className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="font-semibold truncate">Portfolio Holdings</span>
              </div>
              <span className="text-[10px] text-gray-400 font-mono">Live Positions &amp; P&amp;L</span>
            </button>

            {/* Trade Journal Notes */}
            <button
              type="button"
              onClick={() => setExportType('TRADE_JOURNAL')}
              className={`p-2.5 text-left border flex flex-col justify-between transition-all cursor-pointer rounded-xs ${
                exportType === 'TRADE_JOURNAL'
                  ? 'bg-emerald-950/80 text-white border-emerald-500 font-bold shadow-xs'
                  : isObsidian
                  ? 'bg-[#0e1117] text-gray-300 border-[#2b3342] hover:border-gray-500'
                  : 'bg-white text-gray-800 border-[#e5e4e1] hover:border-gray-400'
              }`}
            >
              <div className="flex items-center space-x-2 mb-1">
                <BookMarked className="w-4 h-4 text-purple-400 shrink-0" />
                <span className="font-semibold truncate">Trade Journal</span>
              </div>
              <span className="text-[10px] text-gray-400 font-mono">Executed Trades &amp; Lessons</span>
            </button>

            {/* Custom Watchlists */}
            <button
              type="button"
              onClick={() => setExportType('WATCHLIST')}
              className={`p-2.5 text-left border flex flex-col justify-between transition-all cursor-pointer rounded-xs ${
                exportType === 'WATCHLIST'
                  ? 'bg-emerald-950/80 text-white border-emerald-500 font-bold shadow-xs'
                  : isObsidian
                  ? 'bg-[#0e1117] text-gray-300 border-[#2b3342] hover:border-gray-500'
                  : 'bg-white text-gray-800 border-[#e5e4e1] hover:border-gray-400'
              }`}
            >
              <div className="flex items-center space-x-2 mb-1">
                <Bookmark className="w-4 h-4 text-sky-400 shrink-0" />
                <span className="font-semibold truncate">Watchlist Candidates</span>
              </div>
              <span className="text-[10px] text-gray-400 font-mono">Tracked Watchlist Tickers</span>
            </button>

            {/* Price Alerts & Audits */}
            <button
              type="button"
              onClick={() => setExportType('PRICE_ALERTS')}
              className={`p-2.5 text-left border flex flex-col justify-between transition-all cursor-pointer rounded-xs ${
                exportType === 'PRICE_ALERTS'
                  ? 'bg-emerald-950/80 text-white border-emerald-500 font-bold shadow-xs'
                  : isObsidian
                  ? 'bg-[#0e1117] text-gray-300 border-[#2b3342] hover:border-gray-500'
                  : 'bg-white text-gray-800 border-[#e5e4e1] hover:border-gray-400'
              }`}
            >
              <div className="flex items-center space-x-2 mb-1">
                <Bell className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="font-semibold truncate">Price Alerts</span>
              </div>
              <span className="text-[10px] text-gray-400 font-mono">Audit Logs &amp; Proximity</span>
            </button>

            {/* Brokerage Watchlist (Zerodha, Groww, Angel One) */}
            <button
              type="button"
              onClick={() => setExportType('BROKERAGE_WATCHLIST')}
              className={`p-2.5 text-left border flex flex-col justify-between transition-all cursor-pointer rounded-xs ${
                exportType === 'BROKERAGE_WATCHLIST'
                  ? 'bg-emerald-950/80 text-white border-emerald-500 font-bold shadow-xs'
                  : isObsidian
                  ? 'bg-[#0e1117] text-gray-300 border-[#2b3342] hover:border-gray-500'
                  : 'bg-white text-gray-800 border-[#e5e4e1] hover:border-gray-400'
              }`}
            >
              <div className="flex items-center space-x-2 mb-1">
                <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
                <span className="font-semibold truncate">Brokerage Watchlist</span>
              </div>
              <span className="text-[10px] text-gray-400 font-mono">Zerodha / Groww / AngelOne</span>
            </button>

            {/* Master Complete Backup */}
            <button
              type="button"
              onClick={() => {
                setExportType('MASTER_BACKUP');
                setExportFormat('JSON');
              }}
              className={`p-2.5 text-left border flex flex-col justify-between transition-all cursor-pointer rounded-xs ${
                exportType === 'MASTER_BACKUP'
                  ? 'bg-emerald-950/80 text-white border-emerald-500 font-bold shadow-xs'
                  : isObsidian
                  ? 'bg-[#0e1117] text-gray-300 border-[#2b3342] hover:border-gray-500'
                  : 'bg-white text-gray-800 border-[#e5e4e1] hover:border-gray-400'
              }`}
            >
              <div className="flex items-center space-x-2 mb-1">
                <HardDrive className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-semibold truncate">Master Backup</span>
              </div>
              <span className="text-[10px] text-gray-400 font-mono">All-in-One Data Archive</span>
            </button>
          </div>

          {/* Sub-Option for Brokerage Target */}
          {exportType === 'BROKERAGE_WATCHLIST' && (
            <div
              className={`p-3 border space-y-2 rounded-xs ${
                isObsidian ? 'bg-[#0e1117] border-amber-500/30' : 'bg-amber-50 border-amber-200'
              }`}
            >
              <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold block">
                Select Brokerage Format:
              </span>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {(['zerodha', 'groww', 'angelone'] as const).map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBrokerageTarget(b)}
                    className={`py-1.5 px-2 rounded-xs border text-center font-mono font-bold capitalize transition-all cursor-pointer ${
                      brokerageTarget === b
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : isObsidian
                        ? 'bg-[#161a22] text-gray-300 border-[#30363d]'
                        : 'bg-white text-gray-700 border-gray-300'
                    }`}
                  >
                    {b === 'angelone' ? 'Angel One' : b}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Step 2: Select Export Format */}
        <div
          className={`border p-4 space-y-3 rounded-xs ${
            isObsidian ? 'bg-[#161a22] border-[#242b38]' : 'bg-[#faf9f6] border-[#e5e4e1]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-mono font-bold text-amber-500 tracking-wider">
              2. Choose Output Format
            </span>
            <span className="text-[10px] font-mono text-gray-400">
              Active: {exportFormat}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
            {/* CSV */}
            <button
              type="button"
              onClick={() => setExportFormat('CSV')}
              className={`p-3 border text-left flex flex-col justify-between space-y-1.5 transition-all cursor-pointer rounded-xs ${
                exportFormat === 'CSV'
                  ? 'bg-amber-950/80 border-amber-400 text-white font-bold shadow-xs'
                  : isObsidian
                  ? 'bg-[#0e1117] border-[#2b3342] text-gray-300 hover:border-gray-500'
                  : 'bg-white border-[#e5e4e1] text-gray-800 hover:border-gray-400'
              }`}
            >
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
              <div>
                <strong className="block text-xs">CSV Sheet</strong>
                <span className="text-[10px] text-gray-400">Excel / Google Sheets</span>
              </div>
            </button>

            {/* PDF Report */}
            <button
              type="button"
              onClick={() => setExportFormat('PDF_REPORT')}
              className={`p-3 border text-left flex flex-col justify-between space-y-1.5 transition-all cursor-pointer rounded-xs ${
                exportFormat === 'PDF_REPORT'
                  ? 'bg-amber-950/80 border-amber-400 text-white font-bold shadow-xs'
                  : isObsidian
                  ? 'bg-[#0e1117] border-[#2b3342] text-gray-300 hover:border-gray-500'
                  : 'bg-white border-[#e5e4e1] text-gray-800 hover:border-gray-400'
              }`}
            >
              <Printer className="w-5 h-5 text-rose-400" />
              <div>
                <strong className="block text-xs">PDF Dossier</strong>
                <span className="text-[10px] text-gray-400">Audit report / Print</span>
              </div>
            </button>

            {/* JSON */}
            <button
              type="button"
              onClick={() => setExportFormat('JSON')}
              className={`p-3 border text-left flex flex-col justify-between space-y-1.5 transition-all cursor-pointer rounded-xs ${
                exportFormat === 'JSON'
                  ? 'bg-amber-950/80 border-amber-400 text-white font-bold shadow-xs'
                  : isObsidian
                  ? 'bg-[#0e1117] border-[#2b3342] text-gray-300 hover:border-gray-500'
                  : 'bg-white border-[#e5e4e1] text-gray-800 hover:border-gray-400'
              }`}
            >
              <FileJson className="w-5 h-5 text-amber-400" />
              <div>
                <strong className="block text-xs">Raw JSON</strong>
                <span className="text-[10px] text-gray-400">Programmatic export</span>
              </div>
            </button>

            {/* TradingView Ticker List */}
            <button
              type="button"
              onClick={() => setExportFormat('TRADINGVIEW')}
              className={`p-3 border text-left flex flex-col justify-between space-y-1.5 transition-all cursor-pointer rounded-xs ${
                exportFormat === 'TRADINGVIEW'
                  ? 'bg-amber-950/80 border-amber-400 text-white font-bold shadow-xs'
                  : isObsidian
                  ? 'bg-[#0e1117] border-[#2b3342] text-gray-300 hover:border-gray-500'
                  : 'bg-white border-[#e5e4e1] text-gray-800 hover:border-gray-400'
              }`}
            >
              <Radio className="w-5 h-5 text-sky-400" />
              <div>
                <strong className="block text-xs">TradingView</strong>
                <span className="text-[10px] text-gray-400">Comma list for TV</span>
              </div>
            </button>

            {/* Obsidian MD */}
            <button
              type="button"
              onClick={() => setExportFormat('OBSIDIAN_MD')}
              className={`p-3 border text-left flex flex-col justify-between space-y-1.5 transition-all cursor-pointer rounded-xs ${
                exportFormat === 'OBSIDIAN_MD'
                  ? 'bg-amber-950/80 border-amber-400 text-white font-bold shadow-xs'
                  : isObsidian
                  ? 'bg-[#0e1117] border-[#2b3342] text-gray-300 hover:border-gray-500'
                  : 'bg-white border-[#e5e4e1] text-gray-800 hover:border-gray-400'
              }`}
            >
              <Gem className="w-5 h-5 text-amber-500" />
              <div>
                <strong className="block text-xs">Obsidian MD</strong>
                <span className="text-[10px] text-gray-400">Knowledge vault</span>
              </div>
            </button>

            {/* PineScript */}
            <button
              type="button"
              onClick={() => setExportFormat('PINESCRIPT')}
              className={`p-3 border text-left flex flex-col justify-between space-y-1.5 transition-all cursor-pointer rounded-xs ${
                exportFormat === 'PINESCRIPT'
                  ? 'bg-amber-950/80 border-amber-400 text-white font-bold shadow-xs'
                  : isObsidian
                  ? 'bg-[#0e1117] border-[#2b3342] text-gray-300 hover:border-gray-500'
                  : 'bg-white border-[#e5e4e1] text-gray-800 hover:border-gray-400'
              }`}
            >
              <Code className="w-5 h-5 text-indigo-400" />
              <div>
                <strong className="block text-xs">PineScript v6</strong>
                <span className="text-[10px] text-gray-400">Chart indicator</span>
              </div>
            </button>
          </div>

          {/* Export Action Strip */}
          <div
            className={`p-3 border rounded-xs flex flex-wrap items-center justify-between gap-3 ${
              isObsidian ? 'bg-[#0e1117] border-[#2b3342]' : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div className="space-y-0.5">
              <span className="text-[10px] font-mono text-gray-400 block uppercase">
                Target Format: <strong className="text-emerald-400">{exportFormat}</strong>
              </span>
              <span className="text-xs text-gray-300">
                Ready to export {previewRows.length} records
              </span>
            </div>

            <button
              type="button"
              onClick={handleExport}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-black uppercase tracking-wider py-2 px-4 rounded-xs shadow-md flex items-center space-x-2 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export {exportFormat}</span>
            </button>
          </div>
        </div>

      </div>

      {/* Live Data Preview Section */}
      <div
        className={`border p-4 space-y-3 rounded-xs ${
          isObsidian ? 'bg-[#161a22] border-[#242b38]' : 'bg-[#faf9f6] border-[#e5e4e1]'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 border-gray-700/30">
          <div className="flex items-center space-x-2">
            <Eye className="w-4 h-4 text-emerald-400" />
            <h4 className="font-mono text-xs font-bold uppercase tracking-wider">
              Live Data Preview ({previewRows.length} Matches)
            </h4>
            <span className="px-2 py-0.5 text-[9px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xs">
              READY FOR EXPORT
            </span>
          </div>

          {/* Quick Filter Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" />
            <input
              type="text"
              value={previewFilter}
              onChange={(e) => setPreviewFilter(e.target.value)}
              placeholder="Search records in preview..."
              className={`w-full text-xs pl-8 pr-3 py-1.5 border rounded-xs font-sans outline-hidden ${
                isObsidian
                  ? 'bg-[#0e1117] border-[#30363d] text-white placeholder-gray-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
              }`}
            />
          </div>
        </div>

        {/* Preview Table */}
        <div className="overflow-x-auto border border-gray-700/30 rounded-xs">
          <table className="w-full text-left font-mono text-xs">
            <thead
              className={`text-[10px] uppercase font-bold tracking-wider ${
                isObsidian ? 'bg-[#0e1117] text-gray-400' : 'bg-gray-100 text-gray-600'
              }`}
            >
              <tr>
                <th className="p-2.5">Symbol / Ticker</th>
                <th className="p-2.5">Description / Name</th>
                <th className="p-2.5">Price / Status</th>
                <th className="p-2.5">Technical Metric</th>
                <th className="p-2.5">Stage / Action</th>
              </tr>
            </thead>
            <tbody
              className={`divide-y text-xs ${
                isObsidian ? 'divide-[#242b38]' : 'divide-gray-200'
              }`}
            >
              {previewRows.slice(0, 8).map((row, idx) => (
                <tr
                  key={idx}
                  className={`transition-colors ${
                    isObsidian ? 'hover:bg-[#1f2533]' : 'hover:bg-gray-50'
                  }`}
                >
                  <td className="p-2.5 font-bold text-amber-400">{row.col1}</td>
                  <td className="p-2.5 truncate max-w-[200px]">{row.col2}</td>
                  <td className="p-2.5 text-emerald-400 font-semibold">{row.col3}</td>
                  <td className="p-2.5">{row.col4}</td>
                  <td className="p-2.5 text-gray-400">{row.col5}</td>
                </tr>
              ))}
              {previewRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-gray-400 font-sans italic">
                    No matching records found for "{previewFilter}".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono text-gray-400 pt-1">
          <span>Showing top {Math.min(previewRows.length, 8)} of {previewRows.length} records</span>
          <span>Timestamp: {new Date().toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
};
