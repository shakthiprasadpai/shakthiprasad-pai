import React, { useState, useMemo, useRef } from 'react';
import {
  BhavcopyRecord,
  BhavcopyExchange,
  BhavcopyMarketSummary,
  MinerviniTradeSetup
} from '../types';
import {
  DEFAULT_NSE_BHAVCOPY,
  DEFAULT_BSE_BHAVCOPY,
  LATEST_TRADING_DATE,
  PREVIOUS_TRADING_DATE,
  calculateBhavcopySummary,
  exportBhavcopyToCSV,
  parseCustomBhavcopyCSV
} from '../data/bhavcopyData';
import { formatCurrency, formatVolume } from '../utils/sepaCalculator';
import {
  FileSpreadsheet,
  Download,
  Upload,
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  Activity,
  Layers,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Droplets,
  Target,
  BarChart3,
  Calculator,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Info,
  X,
  RefreshCw,
  Clock,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';

interface BhavcopyViewProps {
  onSelectStockForChart?: (ticker: string) => void;
  onSelectStockForTradePlan?: (ticker: string) => void;
  onAddToWatchlist?: (stock: Partial<MinerviniTradeSetup>) => void;
}

type SepaFilterMode =
  | 'ALL'
  | 'STAGE_2_BREAKOUT'
  | 'HIGH_DELIVERY'
  | 'VOLUME_SURGE'
  | 'VOLUME_DRYUP'
  | 'UPPER_CIRCUIT';

export const BhavcopyView: React.FC<BhavcopyViewProps> = ({
  onSelectStockForChart,
  onSelectStockForTradePlan,
  onAddToWatchlist
}) => {
  const [selectedExchange, setSelectedExchange] = useState<BhavcopyExchange>('ALL');
  const [activeSessionDate, setActiveSessionDate] = useState<string>(LATEST_TRADING_DATE);
  const [sepaFilter, setSepaFilter] = useState<SepaFilterMode>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [seriesFilter, setSeriesFilter] = useState<string>('ALL');
  
  // Custom uploaded datasets stored in state
  const [customRecords, setCustomRecords] = useState<BhavcopyRecord[]>([]);
  const [customFileName, setCustomFileName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [inspectorRecord, setInspectorRecord] = useState<BhavcopyRecord | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Combine default and custom records
  const allRawRecords = useMemo(() => {
    if (customRecords.length > 0) {
      return customRecords;
    }
    return [...DEFAULT_NSE_BHAVCOPY, ...DEFAULT_BSE_BHAVCOPY];
  }, [customRecords]);

  // Compute market summary breadth for currently selected exchange
  const marketSummary = useMemo(() => {
    return calculateBhavcopySummary(allRawRecords, selectedExchange, activeSessionDate);
  }, [allRawRecords, selectedExchange, activeSessionDate]);

  // Filter records based on active criteria
  const filteredRecords = useMemo(() => {
    return allRawRecords.filter((rec) => {
      // Exchange filter
      if (selectedExchange !== 'ALL' && rec.exchange !== selectedExchange) {
        return false;
      }

      // Series / Group filter
      if (seriesFilter !== 'ALL' && rec.series !== seriesFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesSymbol = rec.symbol.toLowerCase().includes(query);
        const matchesName = rec.name.toLowerCase().includes(query);
        const matchesScrip = rec.scripCode?.toLowerCase().includes(query);
        const matchesIsin = rec.isin.toLowerCase().includes(query);
        if (!matchesSymbol && !matchesName && !matchesScrip && !matchesIsin) {
          return false;
        }
      }

      // SEPA filters
      switch (sepaFilter) {
        case 'STAGE_2_BREAKOUT':
          return (
            (rec.sepaStage.includes('Stage 2') || rec.isMinerviniCandidate) &&
            rec.distanceFrom52wHighPercent >= -15 &&
            rec.changePercent > 0
          );
        case 'HIGH_DELIVERY':
          return (rec.deliveryPercent ?? 0) >= 55;
        case 'VOLUME_SURGE':
          return rec.volumeSurgeRatio >= 1.4;
        case 'VOLUME_DRYUP':
          return rec.volumeSurgeRatio <= 0.7;
        case 'UPPER_CIRCUIT':
          return rec.isCircuitHit === 'UPPER' || rec.changePercent >= 5.0;
        default:
          return true;
      }
    });
  }, [allRawRecords, selectedExchange, seriesFilter, searchQuery, sepaFilter]);

  // Handle CSV file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) {
        setUploadError('Failed to read file content.');
        return;
      }

      const { records, detectedExchange, error } = parseCustomBhavcopyCSV(content);
      if (error || records.length === 0) {
        setUploadError(error || 'Could not parse Bhavcopy data from file. Please check CSV format.');
      } else {
        setCustomRecords(records);
        setCustomFileName(file.name);
        setUploadError(null);
        setShowUploadModal(false);
        if (detectedExchange !== 'UNKNOWN') {
          setSelectedExchange(detectedExchange);
        }
        showToast(`Successfully loaded ${records.length} records from ${file.name} (${detectedExchange} format).`);
      }
    };
    reader.readAsText(file);
  };

  const handleResetToDefault = () => {
    setCustomRecords([]);
    setCustomFileName(null);
    setUploadError(null);
    setSelectedExchange('ALL');
    setSepaFilter('ALL');
    setSearchQuery('');
    showToast('Reset to official NSE & BSE default Bhavcopy snapshot.');
  };

  const handleExportCSV = () => {
    const csvData = exportBhavcopyToCSV(filteredRecords, selectedExchange);
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Bhavcopy_${selectedExchange}_${activeSessionDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Downloaded Bhavcopy CSV for ${selectedExchange} (${filteredRecords.length} records).`);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1a1a1a] text-white px-5 py-3 rounded shadow-2xl border border-amber-400 font-mono text-xs flex items-center space-x-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Header & Title Banner */}
      <div className="bg-white border border-[#e5e4e1] p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#b5a68d] font-bold">
                Official Indian Equity Settlement
              </span>
              <span className="bg-[#1a1a1a] text-amber-400 text-[9px] font-mono px-2 py-0.5 uppercase tracking-wider font-bold">
                NSE &bull; BSE
              </span>
              {customFileName && (
                <span className="bg-emerald-100 text-emerald-800 text-[9px] font-mono px-2 py-0.5 uppercase tracking-wider font-bold border border-emerald-300">
                  Custom File: {customFileName}
                </span>
              )}
            </div>
            <h2 className="text-2xl font-serif font-black tracking-tight text-[#1a1a1a] flex items-center space-x-3">
              <FileSpreadsheet className="w-6 h-6 text-amber-600" />
              <span>National &amp; Bombay Stock Exchange Bhavcopy Engine</span>
            </h2>
            <p className="text-xs text-gray-500 max-w-2xl">
              End-of-day official trading settlement reports from NSE &amp; BSE. Track volume delivery percentages, institutional accumulation, upper circuits, and Mark Minervini Stage 2 breakout footprints.
            </p>
          </div>

          {/* Action Tools */}
          <div className="flex items-center space-x-2 font-mono text-xs">
            <button
              id="upload-bhavcopy-btn"
              onClick={() => setShowUploadModal(true)}
              className="bg-white hover:bg-gray-50 text-gray-800 font-bold px-3.5 py-2 border border-gray-300 flex items-center space-x-1.5 shadow-xs cursor-pointer transition-colors"
              title="Upload custom NSE or BSE Bhavcopy CSV"
            >
              <Upload className="w-3.5 h-3.5 text-amber-600" />
              <span>Import CSV</span>
            </button>

            <button
              id="export-bhavcopy-csv-btn"
              onClick={handleExportCSV}
              className="bg-white hover:bg-gray-50 text-gray-800 font-bold px-3.5 py-2 border border-gray-300 flex items-center space-x-1.5 shadow-xs cursor-pointer transition-colors"
              title="Download filtered records as official Bhavcopy CSV"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export CSV</span>
            </button>

            {customRecords.length > 0 && (
              <button
                onClick={handleResetToDefault}
                className="bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold px-3 py-2 border border-amber-300 flex items-center space-x-1 shadow-xs cursor-pointer"
                title="Reset to default snapshot"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Exchange Tabs & Date Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#e5e4e1] pt-4">
          <div className="flex items-center space-x-2 font-mono text-xs">
            <button
              id="bhavcopy-tab-all"
              onClick={() => setSelectedExchange('ALL')}
              className={`px-4 py-2 font-bold uppercase tracking-wider transition-all border cursor-pointer ${
                selectedExchange === 'ALL'
                  ? 'bg-[#1a1a1a] text-white border-black shadow-xs'
                  : 'bg-[#f9f8f5] text-gray-600 border-[#e5e4e1] hover:text-black'
              }`}
            >
              All Exchanges ({allRawRecords.length})
            </button>
            <button
              id="bhavcopy-tab-nse"
              onClick={() => setSelectedExchange('NSE')}
              className={`px-4 py-2 font-bold uppercase tracking-wider transition-all border flex items-center space-x-1.5 cursor-pointer ${
                selectedExchange === 'NSE'
                  ? 'bg-[#1a1a1a] text-white border-black shadow-xs'
                  : 'bg-[#f9f8f5] text-gray-600 border-[#e5e4e1] hover:text-black'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <span>NSE Bhavcopy ({allRawRecords.filter((r) => r.exchange === 'NSE').length})</span>
            </button>
            <button
              id="bhavcopy-tab-bse"
              onClick={() => setSelectedExchange('BSE')}
              className={`px-4 py-2 font-bold uppercase tracking-wider transition-all border flex items-center space-x-1.5 cursor-pointer ${
                selectedExchange === 'BSE'
                  ? 'bg-[#1a1a1a] text-white border-black shadow-xs'
                  : 'bg-[#f9f8f5] text-gray-600 border-[#e5e4e1] hover:text-black'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span>BSE Bhavcopy ({allRawRecords.filter((r) => r.exchange === 'BSE').length})</span>
            </button>
          </div>

          <div className="flex items-center space-x-3 text-xs font-mono text-gray-600">
            <span className="text-gray-400 uppercase tracking-widest text-[10px]">Session Date:</span>
            <div className="flex items-center space-x-1 bg-[#f9f8f5] border border-[#e5e4e1] px-3 py-1 font-bold text-[#1a1a1a]">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>{activeSessionDate}</span>
              <span className="text-[10px] text-gray-400 ml-1">EOD Settlement</span>
            </div>
          </div>
        </div>
      </div>

      {/* Market Breadth & Institutional Delivery Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Scrips */}
        <div className="bg-white border border-[#e5e4e1] p-3.5 shadow-xs space-y-1">
          <div className="text-[10px] uppercase font-mono tracking-wider text-gray-400">Total Scrips</div>
          <div className="text-xl font-mono font-black text-[#1a1a1a]">{marketSummary.totalTradedCount}</div>
          <div className="text-[10px] text-gray-500 font-mono flex items-center justify-between">
            <span className="text-emerald-600 font-bold">{marketSummary.advances} Adv</span>
            <span className="text-red-600 font-bold">{marketSummary.declines} Dec</span>
          </div>
        </div>

        {/* Total Turnover */}
        <div className="bg-white border border-[#e5e4e1] p-3.5 shadow-xs space-y-1">
          <div className="text-[10px] uppercase font-mono tracking-wider text-gray-400">Total Turnover</div>
          <div className="text-xl font-mono font-black text-[#1a1a1a]">₹{marketSummary.totalTurnoverCrores.toLocaleString()} Cr</div>
          <div className="text-[10px] text-gray-500 font-mono">
            {formatVolume(marketSummary.totalVolumeTraded)} Shares Traded
          </div>
        </div>

        {/* High Delivery % Accumulation */}
        <div className="bg-white border border-[#e5e4e1] p-3.5 shadow-xs space-y-1">
          <div className="text-[10px] uppercase font-mono tracking-wider text-amber-600 font-bold flex items-center space-x-1">
            <ShieldCheck className="w-3 h-3" />
            <span>Delivery &gt; 55%</span>
          </div>
          <div className="text-xl font-mono font-black text-amber-700">{marketSummary.highDeliveryAccumulationCount} Scrips</div>
          <div className="text-[10px] text-gray-500 font-sans">Institutional Footprint</div>
        </div>

        {/* Stage 2 Breakout Ready */}
        <div className="bg-white border border-[#e5e4e1] p-3.5 shadow-xs space-y-1">
          <div className="text-[10px] uppercase font-mono tracking-wider text-emerald-600 font-bold flex items-center space-x-1">
            <Target className="w-3 h-3" />
            <span>Stage 2 Setups</span>
          </div>
          <div className="text-xl font-mono font-black text-emerald-700">{marketSummary.stage2BreakoutCount} Scrips</div>
          <div className="text-[10px] text-gray-500 font-sans">Near 52W High &amp; Trend</div>
        </div>

        {/* 52-Week High Near */}
        <div className="bg-white border border-[#e5e4e1] p-3.5 shadow-xs space-y-1">
          <div className="text-[10px] uppercase font-mono tracking-wider text-gray-400">At 52W High</div>
          <div className="text-xl font-mono font-black text-[#1a1a1a]">{marketSummary.stocksAt52wHigh} Scrips</div>
          <div className="text-[10px] text-gray-500 font-mono">Within 2.5% of Peak</div>
        </div>

        {/* Upper Circuit Hits */}
        <div className="bg-white border border-[#e5e4e1] p-3.5 shadow-xs space-y-1">
          <div className="text-[10px] uppercase font-mono tracking-wider text-purple-600 font-bold flex items-center space-x-1">
            <Flame className="w-3 h-3" />
            <span>Circuits Hit</span>
          </div>
          <div className="text-xl font-mono font-black text-purple-700">{marketSummary.upperCircuitCount} Scrips</div>
          <div className="text-[10px] text-gray-500 font-mono">Upper Band Locked</div>
        </div>
      </div>

      {/* Filter and Search Controls Bar */}
      <div className="bg-white border border-[#e5e4e1] p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* SEPA Preset Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
            <button
              onClick={() => setSepaFilter('ALL')}
              className={`px-3 py-1.5 font-bold uppercase transition-all border cursor-pointer ${
                sepaFilter === 'ALL'
                  ? 'bg-[#1a1a1a] text-white border-black'
                  : 'bg-[#f9f8f5] text-gray-600 border-[#e5e4e1] hover:text-black'
              }`}
            >
              All Scrips ({allRawRecords.filter((r) => selectedExchange === 'ALL' || r.exchange === selectedExchange).length})
            </button>

            <button
              onClick={() => setSepaFilter('STAGE_2_BREAKOUT')}
              className={`px-3 py-1.5 font-bold uppercase transition-all border flex items-center space-x-1 cursor-pointer ${
                sepaFilter === 'STAGE_2_BREAKOUT'
                  ? 'bg-emerald-800 text-white border-emerald-900'
                  : 'bg-[#f9f8f5] text-emerald-800 border-[#e5e4e1] hover:border-emerald-500'
              }`}
            >
              <Target className="w-3 h-3" />
              <span>Stage 2 Breakout Ready</span>
            </button>

            <button
              onClick={() => setSepaFilter('HIGH_DELIVERY')}
              className={`px-3 py-1.5 font-bold uppercase transition-all border flex items-center space-x-1 cursor-pointer ${
                sepaFilter === 'HIGH_DELIVERY'
                  ? 'bg-amber-700 text-white border-amber-800'
                  : 'bg-[#f9f8f5] text-amber-800 border-[#e5e4e1] hover:border-amber-500'
              }`}
            >
              <ShieldCheck className="w-3 h-3" />
              <span>High Institutional Delivery (&gt;55%)</span>
            </button>

            <button
              onClick={() => setSepaFilter('VOLUME_SURGE')}
              className={`px-3 py-1.5 font-bold uppercase transition-all border flex items-center space-x-1 cursor-pointer ${
                sepaFilter === 'VOLUME_SURGE'
                  ? 'bg-blue-800 text-white border-blue-900'
                  : 'bg-[#f9f8f5] text-blue-800 border-[#e5e4e1] hover:border-blue-500'
              }`}
            >
              <Flame className="w-3 h-3" />
              <span>Volume Surge (&gt;140%)</span>
            </button>

            <button
              onClick={() => setSepaFilter('VOLUME_DRYUP')}
              className={`px-3 py-1.5 font-bold uppercase transition-all border flex items-center space-x-1 cursor-pointer ${
                sepaFilter === 'VOLUME_DRYUP'
                  ? 'bg-teal-800 text-white border-teal-900'
                  : 'bg-[#f9f8f5] text-teal-800 border-[#e5e4e1] hover:border-teal-500'
              }`}
            >
              <Droplets className="w-3 h-3" />
              <span>VCP Volume Dry-Up</span>
            </button>

            <button
              onClick={() => setSepaFilter('UPPER_CIRCUIT')}
              className={`px-3 py-1.5 font-bold uppercase transition-all border flex items-center space-x-1 cursor-pointer ${
                sepaFilter === 'UPPER_CIRCUIT'
                  ? 'bg-purple-800 text-white border-purple-900'
                  : 'bg-[#f9f8f5] text-purple-800 border-[#e5e4e1] hover:border-purple-500'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>Upper Circuits / Gainers</span>
            </button>
          </div>

          {/* Search & Series Filter */}
          <div className="flex items-center space-x-2 font-mono text-xs w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
              <input
                id="bhavcopy-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Symbol, BSE Code, ISIN..."
                className="w-full pl-9 pr-3 py-1.5 bg-[#f9f8f5] border border-[#e5e4e1] text-xs font-mono placeholder:text-gray-400 focus:outline-none focus:border-black"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-gray-400 hover:text-black"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <select
              value={seriesFilter}
              onChange={(e) => setSeriesFilter(e.target.value)}
              className="bg-[#f9f8f5] border border-[#e5e4e1] px-3 py-1.5 text-xs font-mono text-gray-700 focus:outline-none focus:border-black"
            >
              <option value="ALL">All Series / Groups</option>
              <option value="EQ">NSE EQ (Equities)</option>
              <option value="BE">NSE BE (Book Entry / Trade-for-Trade)</option>
              <option value="A">BSE Group A (Top Largecaps)</option>
              <option value="B">BSE Group B (Mid/Smallcaps)</option>
              <option value="T">BSE Group T (T-to-T Settlement)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Bhavcopy Settlements Table */}
      <div className="bg-white border border-[#e5e4e1] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead>
              <tr className="bg-[#1a1a1a] text-white uppercase text-[10px] tracking-wider border-b border-black">
                <th className="py-3 px-3">Exchange &amp; Series</th>
                <th className="py-3 px-3">Symbol / Company Name</th>
                <th className="py-3 px-2 text-right">Open</th>
                <th className="py-3 px-2 text-right">High</th>
                <th className="py-3 px-2 text-right">Low</th>
                <th className="py-3 px-3 text-right">Close (LTP)</th>
                <th className="py-3 px-3 text-right">Change (%)</th>
                <th className="py-3 px-3 text-right">Traded Volume</th>
                <th className="py-3 px-3 text-right">Turnover (₹ Cr)</th>
                <th className="py-3 px-3 text-right">Delivery %</th>
                <th className="py-3 px-3 text-right">52W High</th>
                <th className="py-3 px-3 text-center">SEPA Setup</th>
                <th className="py-3 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e4e1]">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-gray-500 font-mono">
                    <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2 opacity-60" />
                    <p className="text-sm font-bold text-[#1a1a1a]">No Bhavcopy records matched current filters</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Try adjusting the exchange selector, clearing search parameters, or resetting presets.
                    </p>
                    <button
                      onClick={handleResetToDefault}
                      className="mt-4 px-4 py-1.5 bg-[#1a1a1a] text-white text-xs font-bold uppercase tracking-wider"
                    >
                      Reset All Filters
                    </button>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => {
                  const isPositive = rec.changePercent >= 0;
                  const isHighDelivery = (rec.deliveryPercent ?? 0) >= 55;
                  const isExtremeSurge = rec.volumeSurgeRatio >= 1.5;

                  return (
                    <tr
                      key={`${rec.exchange}_${rec.symbol}_${rec.scripCode || ''}`}
                      className="hover:bg-[#fcfbfa] transition-colors group cursor-pointer"
                      onClick={() => setInspectorRecord(rec)}
                    >
                      {/* Exchange & Series */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          <span
                            className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded ${
                              rec.exchange === 'NSE'
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {rec.exchange}
                          </span>
                          <span className="bg-gray-100 text-gray-700 px-1 py-0.5 text-[9px] font-bold border border-gray-200">
                            {rec.series}
                          </span>
                          {rec.scripCode && (
                            <span className="text-[10px] text-gray-400 font-mono" title="BSE Scrip Code">
                              #{rec.scripCode}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Symbol & Name */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-[#1a1a1a] text-sm group-hover:text-amber-700 transition-colors flex items-center space-x-1.5">
                          <span>{rec.symbol}</span>
                          {rec.isCircuitHit === 'UPPER' && (
                            <span className="bg-purple-100 text-purple-800 text-[8px] font-mono px-1 py-0.2 rounded font-black border border-purple-300">
                              UC
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-500 truncate max-w-[170px]" title={rec.name}>
                          {rec.name}
                        </div>
                        <div className="text-[9px] text-gray-400 font-mono truncate max-w-[150px]">
                          {rec.isin}
                        </div>
                      </td>

                      {/* OHLC */}
                      <td className="py-3 px-2 text-right text-gray-600">
                        {formatCurrency(rec.open, '₹', 2)}
                      </td>
                      <td className="py-3 px-2 text-right text-gray-800 font-medium">
                        {formatCurrency(rec.high, '₹', 2)}
                      </td>
                      <td className="py-3 px-2 text-right text-gray-600">
                        {formatCurrency(rec.low, '₹', 2)}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-[#1a1a1a]">
                        {formatCurrency(rec.close, '₹', 2)}
                      </td>

                      {/* Change % */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div
                          className={`font-bold flex items-center justify-end space-x-0.5 ${
                            isPositive ? 'text-emerald-700' : 'text-red-600'
                          }`}
                        >
                          {isPositive ? (
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowDownRight className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {isPositive ? '+' : ''}
                            {rec.changePercent.toFixed(2)}%
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {isPositive ? '+' : ''}
                          {formatCurrency(rec.change, '₹', 2)}
                        </div>
                      </td>

                      {/* Traded Volume */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="font-bold text-gray-900">{formatVolume(rec.totalTradedQty)}</div>
                        <div className="text-[10px] flex items-center justify-end space-x-1">
                          <span
                            className={`${
                              isExtremeSurge
                                ? 'text-emerald-700 font-bold'
                                : rec.volumeSurgeRatio < 0.75
                                ? 'text-teal-700 font-medium'
                                : 'text-gray-500'
                            }`}
                          >
                            {(rec.volumeSurgeRatio * 100).toFixed(0)}% vs 20d
                          </span>
                        </div>
                      </td>

                      {/* Turnover */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="font-medium text-gray-800">
                          ₹{((rec.totalTradedVal / 10000000)).toFixed(2)} Cr
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {rec.totalTrades.toLocaleString()} trades
                        </div>
                      </td>

                      {/* Delivery % */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        {rec.deliveryPercent !== undefined ? (
                          <div className="inline-flex flex-col items-end">
                            <span
                              className={`px-2 py-0.5 text-[10px] font-bold rounded flex items-center space-x-1 ${
                                isHighDelivery
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300 font-black'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                              title={
                                isHighDelivery
                                  ? 'High Institutional Accumulation (>55% Delivery)'
                                  : 'Normal delivery percentage'
                              }
                            >
                              {isHighDelivery && <ShieldCheck className="w-3 h-3 text-amber-600" />}
                              <span>{rec.deliveryPercent.toFixed(1)}%</span>
                            </span>
                            {rec.deliveryQty && (
                              <span className="text-[9px] text-gray-400 mt-0.5">
                                {formatVolume(rec.deliveryQty)} deliv
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-[10px]">—</span>
                        )}
                      </td>

                      {/* 52W High & Proximity */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="font-bold text-gray-800">
                          {formatCurrency(rec.high52w, '₹', 2)}
                        </div>
                        <div
                          className={`text-[10px] font-medium ${
                            rec.distanceFrom52wHighPercent >= -5
                              ? 'text-emerald-700 font-bold'
                              : rec.distanceFrom52wHighPercent >= -15
                              ? 'text-amber-700'
                              : 'text-gray-400'
                          }`}
                        >
                          {rec.distanceFrom52wHighPercent.toFixed(1)}% from High
                        </div>
                      </td>

                      {/* SEPA Setup & RS */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex flex-col items-center">
                          <span
                            className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded ${
                              rec.sepaStage.includes('Breakout')
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : rec.sepaStage.includes('Contraction')
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {rec.sepaStage}
                          </span>
                          <span className="text-[9px] text-gray-500 font-mono mt-0.5">
                            RS: <span className="font-bold text-[#1a1a1a]">{rec.rsRating}</span>
                          </span>
                        </div>
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3 px-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center space-x-1.5">
                          {onSelectStockForChart && (
                            <button
                              onClick={() => onSelectStockForChart(rec.symbol)}
                              className="p-1.5 bg-gray-100 hover:bg-[#1a1a1a] hover:text-white rounded text-gray-700 transition-colors cursor-pointer"
                              title="Inspect Interactive VCP Chart"
                            >
                              <BarChart3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {onSelectStockForTradePlan && (
                            <button
                              onClick={() => onSelectStockForTradePlan(rec.symbol)}
                              className="p-1.5 bg-gray-100 hover:bg-emerald-600 hover:text-white rounded text-gray-700 transition-colors cursor-pointer"
                              title="Calculate Minervini Trade Plan &amp; Risk"
                            >
                              <Calculator className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => setInspectorRecord(rec)}
                            className="p-1.5 bg-amber-50 hover:bg-amber-500 hover:text-white rounded text-amber-700 transition-colors cursor-pointer"
                            title="View Deep-Dive Bhavcopy Inspection"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
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

        {/* Table Footer info */}
        <div className="bg-[#f9f8f5] border-t border-[#e5e4e1] p-3 text-xs text-gray-500 font-mono flex flex-wrap items-center justify-between gap-2">
          <div>
            Showing <span className="font-bold text-[#1a1a1a]">{filteredRecords.length}</span> of{' '}
            <span className="font-bold text-[#1a1a1a]">{allRawRecords.length}</span> settlements &bull; Exchange:{' '}
            <span className="font-bold text-amber-700">{selectedExchange}</span>
          </div>
          <div className="flex items-center space-x-4 text-[11px]">
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
              <span>Stage 2 Breakout Ready</span>
            </span>
            <span className="flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
              <span>High Institutional Delivery (&gt;55%)</span>
            </span>
          </div>
        </div>
      </div>

      {/* Educational Guide Card on Bhavcopy */}
      <div className="bg-[#fcfbf9] border border-[#e5e4e1] p-5 rounded space-y-3 font-sans text-xs">
        <div className="flex items-center space-x-2 text-amber-800 font-bold uppercase tracking-wider font-mono text-sm">
          <Info className="w-4 h-4" />
          <span>Why Minervini SEPA Traders Study Daily NSE &amp; BSE Bhavcopy</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-gray-600 leading-relaxed">
          <div className="space-y-1 bg-white p-3 border border-[#e5e4e1]">
            <h4 className="font-bold text-[#1a1a1a] font-mono uppercase text-[11px] flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
              <span>1. Institutional Delivery Footprints</span>
            </h4>
            <p>
              In Indian markets (NSE &amp; BSE), intraday speculation inflates volume. The Bhavcopy <strong>Delivery %</strong> isolates real buy-and-hold accumulation. A surge above 55%–60% delivery confirms institutional accumulation.
            </p>
          </div>

          <div className="space-y-1 bg-white p-3 border border-[#e5e4e1]">
            <h4 className="font-bold text-[#1a1a1a] font-mono uppercase text-[11px] flex items-center space-x-1">
              <Target className="w-3.5 h-3.5 text-emerald-600" />
              <span>2. 52-Week High Proximity Check</span>
            </h4>
            <p>
              Mark Minervini Trend Template Rule #5 mandates that winning stocks must be within 15% (and ideally within 5%–10%) of their 52-week high. Bhavcopy settlement prices verify true closing highs without intraday noise.
            </p>
          </div>

          <div className="space-y-1 bg-white p-3 border border-[#e5e4e1]">
            <h4 className="font-bold text-[#1a1a1a] font-mono uppercase text-[11px] flex items-center space-x-1">
              <Layers className="w-3.5 h-3.5 text-purple-600" />
              <span>3. Cross-Exchange Arbitrage &amp; Series</span>
            </h4>
            <p>
              Leading scrips trade across both NSE (EQ/BE) and BSE (Groups A, B, T). Inspecting both exchanges reveals total blended liquidity and confirms breakouts across the entire Indian financial capital ecosystem.
            </p>
          </div>
        </div>
      </div>

      {/* CSV Import Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-black max-w-lg w-full p-6 space-y-4 shadow-2xl font-mono text-xs animate-scale-in">
            <div className="flex items-center justify-between border-b border-[#e5e4e1] pb-3">
              <div className="flex items-center space-x-2">
                <FileSpreadsheet className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-serif font-black text-[#1a1a1a]">Import Official Bhavcopy CSV</h3>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-gray-400 hover:text-black"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-gray-600 font-sans">
              Select or drag-and-drop any official daily settlement Bhavcopy CSV file from either <strong>NSE</strong> (<code className="bg-gray-100 px-1">cm*bhav.csv</code> or <code className="bg-gray-100 px-1">Sec_bhavdata_full.csv</code>) or <strong>BSE</strong> (<code className="bg-gray-100 px-1">EQ*.csv</code> or <code className="bg-gray-100 px-1">BhavCopy_BSE*.csv</code>).
            </p>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 hover:border-black p-8 text-center bg-[#f9f8f5] cursor-pointer transition-colors space-y-2"
            >
              <Upload className="w-8 h-8 text-gray-400 mx-auto" />
              <div className="font-bold text-[#1a1a1a]">Click to select or drag CSV file here</div>
              <div className="text-[10px] text-gray-400">Supports .csv or .txt exchange formats</div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {uploadError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-[#e5e4e1]">
              <button
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2 border border-gray-300 hover:bg-gray-100 font-bold uppercase"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  fileInputRef.current?.click();
                }}
                className="px-4 py-2 bg-[#1a1a1a] text-white hover:bg-black font-bold uppercase tracking-wider"
              >
                Browse Files
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Deep-Dive Inspector Modal */}
      {inspectorRecord && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-black max-w-2xl w-full p-6 space-y-5 shadow-2xl font-mono text-xs animate-scale-in">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-[#e5e4e1] pb-3">
              <div>
                <div className="flex items-center space-x-2">
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${
                      inspectorRecord.exchange === 'NSE'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {inspectorRecord.exchange} {inspectorRecord.series}
                  </span>
                  {inspectorRecord.scripCode && (
                    <span className="text-gray-500 font-mono text-xs">
                      BSE Code: {inspectorRecord.scripCode}
                    </span>
                  )}
                  <span className="text-gray-400 text-xs font-mono">ISIN: {inspectorRecord.isin}</span>
                </div>
                <h3 className="text-xl font-serif font-black text-[#1a1a1a] mt-1">
                  {inspectorRecord.symbol} &bull; {inspectorRecord.name}
                </h3>
              </div>
              <button
                onClick={() => setInspectorRecord(null)}
                className="text-gray-400 hover:text-black p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* OHLC and Change Grid */}
            <div className="grid grid-cols-4 gap-3 bg-[#f9f8f5] p-4 border border-[#e5e4e1]">
              <div>
                <div className="text-[10px] text-gray-400 uppercase">Open Price</div>
                <div className="text-sm font-bold text-gray-800">{formatCurrency(inspectorRecord.open, '₹', 2)}</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-400 uppercase">Day High</div>
                <div className="text-sm font-bold text-gray-800">{formatCurrency(inspectorRecord.high, '₹', 2)}</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-400 uppercase">Day Low</div>
                <div className="text-sm font-bold text-gray-800">{formatCurrency(inspectorRecord.low, '₹', 2)}</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-400 uppercase">Settlement Close</div>
                <div className="text-sm font-bold text-[#1a1a1a]">{formatCurrency(inspectorRecord.close, '₹', 2)}</div>
              </div>
            </div>

            {/* Volume and Delivery Analysis */}
            <div className="space-y-2">
              <div className="font-bold text-[#1a1a1a] uppercase text-xs flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                <span>Institutional Accumulation &amp; Volume Metrics</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white border border-[#e5e4e1] p-3 space-y-1">
                  <div className="text-[10px] text-gray-400 uppercase">Traded Shares</div>
                  <div className="text-base font-bold text-[#1a1a1a]">
                    {inspectorRecord.totalTradedQty.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-gray-500">
                    Ratio: {(inspectorRecord.volumeSurgeRatio * 100).toFixed(0)}% of 20d avg
                  </div>
                </div>

                <div className="bg-white border border-[#e5e4e1] p-3 space-y-1">
                  <div className="text-[10px] text-gray-400 uppercase">Delivery Percentage</div>
                  <div className="text-base font-bold text-amber-700">
                    {inspectorRecord.deliveryPercent?.toFixed(1) ?? '—'}%
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {inspectorRecord.deliveryQty?.toLocaleString() ?? '—'} delivered
                  </div>
                </div>

                <div className="bg-white border border-[#e5e4e1] p-3 space-y-1">
                  <div className="text-[10px] text-gray-400 uppercase">Turnover (Value)</div>
                  <div className="text-base font-bold text-[#1a1a1a]">
                    ₹{(inspectorRecord.totalTradedVal / 10000000).toFixed(2)} Cr
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {inspectorRecord.totalTrades.toLocaleString()} contracts
                  </div>
                </div>
              </div>
            </div>

            {/* SEPA Stage & Distance to 52W High */}
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
              <div className="flex items-center justify-between font-bold text-xs uppercase">
                <span>Minervini SEPA Evaluation</span>
                <span>RS Rating: {inspectorRecord.rsRating}</span>
              </div>
              <p className="text-[11px] font-sans text-amber-800">
                Setup Stage: <strong>{inspectorRecord.sepaStage}</strong> &bull; Distance from 52-Week High:{' '}
                <strong>{inspectorRecord.distanceFrom52wHighPercent.toFixed(2)}%</strong> (Peak:{' '}
                {formatCurrency(inspectorRecord.high52w, '₹', 2)}).
                {inspectorRecord.isMinerviniCandidate
                  ? ' Meets Mark Minervini Trend Template qualifications with strong relative strength and institutional delivery accumulation.'
                  : ' Currently consolidating or building a base before qualifying for active Stage 2 pivot entry.'}
              </p>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-3 border-t border-[#e5e4e1]">
              <div className="flex items-center space-x-2">
                {onAddToWatchlist && (
                  <button
                    onClick={() => {
                      onAddToWatchlist({
                        ticker: inspectorRecord.symbol,
                        name: inspectorRecord.name,
                        exchange: inspectorRecord.exchange,
                        currentPrice: inspectorRecord.close,
                        changePercent: inspectorRecord.changePercent,
                        high52w: inspectorRecord.high52w,
                        low52w: inspectorRecord.low52w,
                        rsRating: inspectorRecord.rsRating,
                        avgVolume20d: inspectorRecord.avgVolume20d
                      });
                      showToast(`Added ${inspectorRecord.symbol} to your Watchlist.`);
                    }}
                    className="px-3 py-2 bg-white border border-gray-300 hover:bg-gray-100 font-bold uppercase tracking-wider text-xs cursor-pointer"
                  >
                    + Add to Watchlist
                  </button>
                )}
              </div>

              <div className="flex items-center space-x-2">
                {onSelectStockForChart && (
                  <button
                    onClick={() => {
                      onSelectStockForChart(inspectorRecord.symbol);
                      setInspectorRecord(null);
                    }}
                    className="px-3.5 py-2 bg-[#1a1a1a] hover:bg-black text-white font-bold uppercase tracking-wider text-xs flex items-center space-x-1.5 cursor-pointer"
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>View VCP Chart</span>
                  </button>
                )}
                {onSelectStockForTradePlan && (
                  <button
                    onClick={() => {
                      onSelectStockForTradePlan(inspectorRecord.symbol);
                      setInspectorRecord(null);
                    }}
                    className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold uppercase tracking-wider text-xs flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Calculator className="w-3.5 h-3.5" />
                    <span>Calculate Trade Plan</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
