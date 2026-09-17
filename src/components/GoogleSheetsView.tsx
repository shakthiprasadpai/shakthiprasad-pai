import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  ExternalLink,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  LogIn,
  Layers,
  ArrowRight,
  Sparkles,
  Download,
  UploadCloud,
  Table,
  Eye,
  Calendar,
  Lock
} from 'lucide-react';
import { MinerviniTradeSetup } from '../types';
import {
  listUserGoogleSheets,
  createGoogleSheet,
  exportWatchlistToGoogleSheet,
  exportJournalToGoogleSheet,
  getSpreadsheetDetails,
  readSheetRangeValues,
  appendSheetRows,
  SheetFileMetadata,
  SpreadsheetDetails
} from '../utils/googleSheetsService';
import { googleSignIn, getCurrentUser, googleLogout } from '../utils/googleAuth';
import { User } from 'firebase/auth';

interface GoogleSheetsViewProps {
  stocks: MinerviniTradeSetup[];
  isObsidian?: boolean;
}

export const GoogleSheetsView: React.FC<GoogleSheetsViewProps> = ({ stocks, isObsidian = false }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(getCurrentUser());
  const [sheetsList, setSheetsList] = useState<SheetFileMetadata[]>([]);
  const [isLoadingList, setIsLoadingList] = useState<boolean>(false);
  const [listError, setListError] = useState<string | null>(null);

  // Selected spreadsheet inspection
  const [selectedSheetId, setSelectedSheetId] = useState<string | null>(null);
  const [sheetDetails, setSheetDetails] = useState<SpreadsheetDetails | null>(null);
  const [activeTabTitle, setActiveTabTitle] = useState<string>('');
  const [sheetRows, setSheetRows] = useState<(string | number)[][]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);

  // Actions state
  const [isExportingWatchlist, setIsExportingWatchlist] = useState<boolean>(false);
  const [isExportingJournal, setIsExportingJournal] = useState<boolean>(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState<string | null>(null);

  // Manual import / open by ID
  const [manualSheetInput, setManualSheetInput] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Add row modal / form
  const [showAddRowModal, setShowAddRowModal] = useState<boolean>(false);
  const [newRowTicker, setNewRowTicker] = useState<string>('');
  const [newRowName, setNewRowName] = useState<string>('');
  const [newRowPrice, setNewRowPrice] = useState<string>('');
  const [newRowPivot, setNewRowPivot] = useState<string>('');
  const [newRowStop, setNewRowStop] = useState<string>('');
  const [newRowNotes, setNewRowNotes] = useState<string>('');
  const [isSubmittingRow, setIsSubmittingRow] = useState<boolean>(false);

  const fetchSheetsList = async () => {
    setIsLoadingList(true);
    setListError(null);
    try {
      const files = await listUserGoogleSheets(30);
      setSheetsList(files);
      if (files.length > 0 && !selectedSheetId) {
        handleSelectSheet(files[0].id);
      }
    } catch (err: any) {
      setListError(err.message || 'Failed to fetch spreadsheets from Google Drive.');
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchSheetsList();
    }
  }, [currentUser]);

  const handleSignIn = async () => {
    try {
      const res = await googleSignIn();
      if (res?.user) {
        setCurrentUser(res.user);
      }
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Google Sign-In failed.');
    }
  };

  const handleSelectSheet = async (id: string) => {
    setSelectedSheetId(id);
    setIsLoadingDetails(true);
    setActionErrorMsg(null);
    try {
      const details = await getSpreadsheetDetails(id);
      setSheetDetails(details);
      const defaultTab = details.sheets[0]?.title || 'Sheet1';
      setActiveTabTitle(defaultTab);

      const rows = await readSheetRangeValues(id, `${defaultTab}!A1:Z100`);
      setSheetRows(rows);
    } catch (err: any) {
      setActionErrorMsg(`Could not load spreadsheet details: ${err.message}`);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleTabChange = async (tabTitle: string) => {
    if (!selectedSheetId) return;
    setActiveTabTitle(tabTitle);
    setIsLoadingDetails(true);
    try {
      const rows = await readSheetRangeValues(selectedSheetId, `${tabTitle}!A1:Z100`);
      setSheetRows(rows);
    } catch (err: any) {
      setActionErrorMsg(`Failed to load sheet tab ${tabTitle}: ${err.message}`);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleExportWatchlist = async () => {
    setIsExportingWatchlist(true);
    setActionSuccessMsg(null);
    setActionErrorMsg(null);
    try {
      const today = new Date().toISOString().split('T')[0];
      const result = await exportWatchlistToGoogleSheet(stocks, `Minervini SEPA Watchlist - ${today}`);
      setActionSuccessMsg(`Created new Google Sheet! ID: ${result.spreadsheetId}`);
      await fetchSheetsList();
      handleSelectSheet(result.spreadsheetId);
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Failed to export watchlist to Google Sheets.');
    } finally {
      setIsExportingWatchlist(false);
    }
  };

  const handleExportJournal = async () => {
    setIsExportingJournal(true);
    setActionSuccessMsg(null);
    setActionErrorMsg(null);
    try {
      const savedTradesRaw = localStorage.getItem('minervini_trade_log') || '[]';
      let trades = [];
      try {
        trades = JSON.parse(savedTradesRaw);
      } catch {
        trades = [];
      }

      if (trades.length === 0) {
        // Provide sample trade log rows if empty
        trades = [
          { date: new Date().toISOString().split('T')[0], ticker: 'NVDA', side: 'BUY', pattern: 'VCP (3 Contractions)', buyPrice: 124.50, shares: 100, stopLoss: 118.00, target: 145.00, status: 'OPEN', pnl: 400, returnPercent: 3.2, rMultiple: 1.2, notes: 'Tight volume on breakout' },
          { date: '2026-09-10', ticker: 'CELH', side: 'BUY', pattern: 'Cup with Handle', buyPrice: 88.20, shares: 75, stopLoss: 84.00, target: 105.00, exitPrice: 102.50, status: 'CLOSED', pnl: 1072.50, returnPercent: 16.2, rMultiple: 3.4, notes: 'Target 1 hit with expanding volume' }
        ];
      }

      const today = new Date().toISOString().split('T')[0];
      const result = await exportJournalToGoogleSheet(trades, `Minervini Trade Journal Log - ${today}`);
      setActionSuccessMsg(`Exported Trade Journal to Google Sheets! ID: ${result.spreadsheetId}`);
      await fetchSheetsList();
      handleSelectSheet(result.spreadsheetId);
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Failed to export journal to Google Sheets.');
    } finally {
      setIsExportingJournal(false);
    }
  };

  const handleOpenByUrlOrId = () => {
    if (!manualSheetInput.trim()) return;
    let sheetId = manualSheetInput.trim();
    // Extract ID from URL if full URL is pasted
    const match = sheetId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      sheetId = match[1];
    }
    handleSelectSheet(sheetId);
    setManualSheetInput('');
  };

  const handleAddRow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSheetId || !activeTabTitle || !newRowTicker) return;
    setIsSubmittingRow(true);
    setActionErrorMsg(null);
    try {
      const newRow = [
        newRowTicker.toUpperCase(),
        newRowName || 'Manual Entry',
        'NSE',
        'Custom',
        parseFloat(newRowPrice) || 0,
        '0.00%',
        'VCP Pivot',
        'T3',
        90,
        '8/8',
        parseFloat(newRowPivot) || parseFloat(newRowPrice) || 0,
        (parseFloat(newRowPivot) || parseFloat(newRowPrice) || 0) * 1.02,
        parseFloat(newRowStop) || 0,
        '-5.0%',
        (parseFloat(newRowPrice) || 0) * 1.2,
        '20.0%',
        '3.5:1',
        newRowNotes || 'Added via Minervini Screener'
      ];

      await appendSheetRows(selectedSheetId, activeTabTitle, [newRow]);
      setShowAddRowModal(false);
      setNewRowTicker('');
      setNewRowName('');
      setNewRowPrice('');
      setNewRowPivot('');
      setNewRowStop('');
      setNewRowNotes('');
      setActionSuccessMsg(`Added ${newRowTicker.toUpperCase()} to ${activeTabTitle}!`);
      // Reload sheet rows
      const rows = await readSheetRangeValues(selectedSheetId, `${activeTabTitle}!A1:Z100`);
      setSheetRows(rows);
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Failed to append row to spreadsheet.');
    } finally {
      setIsSubmittingRow(false);
    }
  };

  const filteredSheets = sheetsList.filter((s) =>
    s.name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950/40 to-slate-900 border border-emerald-500/30 rounded-xl p-5 shadow-lg relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              <span className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-md border border-emerald-500/30">
                <FileSpreadsheet className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-black tracking-wider text-slate-100 uppercase font-mono">
                Google Sheets SEPA Hub
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                2-WAY CLOUD SYNC
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Sync Mark Minervini SEPA Trend Template watchlists, Stage 2 VCP breakout candidates, and trade journal records directly to your personal Google Sheets.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {currentUser ? (
              <div className="flex items-center space-x-3 bg-slate-950/80 border border-emerald-500/40 rounded-lg px-3 py-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <div className="text-left">
                  <div className="text-[11px] font-mono font-bold text-slate-200">
                    {currentUser.displayName || currentUser.email?.split('@')[0]}
                  </div>
                  <div className="text-[9px] font-mono text-emerald-400 truncate max-w-[160px]">
                    {currentUser.email}
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={handleSignIn}
                className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-mono text-xs font-black uppercase tracking-wider py-2 px-3.5 rounded-md shadow-md flex items-center space-x-2 cursor-pointer transition-all"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign in with Google</span>
              </button>
            )}

            <button
              onClick={handleExportWatchlist}
              disabled={isExportingWatchlist || !currentUser}
              className="bg-emerald-700/80 hover:bg-emerald-600 text-white font-mono text-xs font-bold py-2 px-3 rounded-md shadow flex items-center space-x-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="Create a new Google Sheet populated with all currently screened stocks"
            >
              <UploadCloud className="w-4 h-4" />
              <span>{isExportingWatchlist ? 'Creating Sheet...' : 'Export Watchlist'}</span>
            </button>

            <button
              onClick={handleExportJournal}
              disabled={isExportingJournal || !currentUser}
              className="bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 font-mono text-xs font-bold py-2 px-3 rounded-md shadow flex items-center space-x-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="Create a new Google Sheet for your trade execution log"
            >
              <Table className="w-4 h-4" />
              <span>{isExportingJournal ? 'Exporting...' : 'Export Journal'}</span>
            </button>

            <button
              onClick={fetchSheetsList}
              disabled={isLoadingList || !currentUser}
              className="p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-md border border-slate-700 transition-all cursor-pointer disabled:opacity-50"
              title="Refresh spreadsheets from Drive"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingList ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Notifications */}
        {actionSuccessMsg && (
          <div className="mt-3 p-2.5 bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs font-mono rounded flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{actionSuccessMsg}</span>
            </div>
            <button
              onClick={() => setActionSuccessMsg(null)}
              className="text-emerald-400 hover:text-emerald-200 text-xs font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {actionErrorMsg && (
          <div className="mt-3 p-2.5 bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs font-mono rounded flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{actionErrorMsg}</span>
            </div>
            <button
              onClick={() => setActionErrorMsg(null)}
              className="text-rose-400 hover:text-rose-200 text-xs font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {!currentUser ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-200 font-mono">Sign In to Access Google Sheets</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Authorize Google Workspace to export SEPA watchlists, sync trading setups, and inspect spreadsheets directly inside the terminal.
          </p>
          <button
            onClick={handleSignIn}
            className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-mono text-xs font-black uppercase tracking-wider py-2.5 px-6 rounded-md shadow-lg inline-flex items-center space-x-2 cursor-pointer transition-all"
          >
            <LogIn className="w-4 h-4" />
            <span>Sign in with Google</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: List of User's Spreadsheets */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>My Spreadsheets</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {sheetsList.length} files found
                </span>
              </div>

              {/* Search filter */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter spreadsheets..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/70 text-slate-200 text-xs font-mono rounded pl-8 pr-3 py-1.5 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Open by URL or ID */}
              <div className="flex items-center space-x-1.5 pt-1">
                <input
                  type="text"
                  placeholder="Paste Sheet URL or ID..."
                  value={manualSheetInput}
                  onChange={(e) => setManualSheetInput(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-700/70 text-slate-200 text-[11px] font-mono rounded px-2.5 py-1.5 focus:border-emerald-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleOpenByUrlOrId}
                  className="bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 font-mono text-[10px] font-bold px-2.5 py-1.5 rounded cursor-pointer"
                >
                  Open
                </button>
              </div>

              {/* List */}
              <div className="space-y-1.5 max-h-[480px] overflow-y-auto pr-1">
                {isLoadingList ? (
                  <div className="text-center py-8 text-xs font-mono text-slate-500 flex items-center justify-center space-x-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-emerald-500" />
                    <span>Loading files from Drive...</span>
                  </div>
                ) : filteredSheets.length === 0 ? (
                  <div className="text-center py-8 text-xs font-mono text-slate-500 border border-dashed border-slate-800 rounded-lg p-4">
                    No spreadsheets found. Click &quot;Export Watchlist&quot; above to create one!
                  </div>
                ) : (
                  filteredSheets.map((sheet) => {
                    const isSelected = selectedSheetId === sheet.id;
                    const dateFormatted = new Date(sheet.modifiedTime).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    });

                    return (
                      <button
                        key={sheet.id}
                        type="button"
                        onClick={() => handleSelectSheet(sheet.id)}
                        className={`w-full text-left p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between group ${
                          isSelected
                            ? 'bg-emerald-950/40 border-emerald-500/60 shadow-xs'
                            : 'bg-slate-950/50 border-slate-800/80 hover:bg-slate-800/50 hover:border-slate-700'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className={`text-xs font-mono font-bold truncate ${isSelected ? 'text-emerald-300' : 'text-slate-200 group-hover:text-emerald-400'}`}>
                            {sheet.name}
                          </div>
                          <div className="text-[10px] font-mono text-slate-500 flex items-center space-x-2 mt-0.5">
                            <span>Mod: {dateFormatted}</span>
                          </div>
                        </div>

                        {sheet.webViewLink && (
                          <a
                            href={sheet.webViewLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-1 text-slate-500 hover:text-emerald-400 transition-colors shrink-0"
                            title="Open directly in Google Sheets"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Spreadsheet Viewer & Controls */}
          <div className="lg:col-span-8 space-y-4">
            {selectedSheetId && sheetDetails ? (
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-4 shadow-md">
                {/* Header bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="p-1 bg-emerald-500/20 text-emerald-400 rounded">
                        <FileSpreadsheet className="w-4 h-4" />
                      </span>
                      <h3 className="text-base font-bold text-slate-100 font-mono">
                        {sheetDetails.title}
                      </h3>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">
                      ID: {sheetDetails.spreadsheetId}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setShowAddRowModal(true)}
                      className="bg-emerald-600/90 hover:bg-emerald-500 text-slate-950 font-mono text-xs font-bold py-1.5 px-3 rounded flex items-center space-x-1.5 transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Setup Row</span>
                    </button>

                    <a
                      href={sheetDetails.spreadsheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 font-mono text-xs font-bold py-1.5 px-3 rounded flex items-center space-x-1.5 transition-all"
                    >
                      <span>Open in Sheets</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                {/* Sheet Tabs */}
                <div className="flex items-center space-x-1 border-b border-slate-800 overflow-x-auto pb-1">
                  {sheetDetails.sheets.map((tab) => {
                    const isActive = activeTabTitle === tab.title;
                    return (
                      <button
                        key={tab.sheetId}
                        type="button"
                        onClick={() => handleTabChange(tab.title)}
                        className={`font-mono text-xs font-bold px-3 py-1.5 rounded-t-md transition-all cursor-pointer whitespace-nowrap ${
                          isActive
                            ? 'bg-slate-800 text-emerald-300 border-t-2 border-emerald-400'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                        }`}
                      >
                        {tab.title}
                      </button>
                    );
                  })}
                </div>

                {/* Spreadsheet Content Table */}
                <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
                  {isLoadingDetails ? (
                    <div className="py-16 text-center text-xs font-mono text-slate-500 flex items-center justify-center space-x-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                      <span>Reading cell values from Google Sheets...</span>
                    </div>
                  ) : sheetRows.length === 0 ? (
                    <div className="py-16 text-center text-xs font-mono text-slate-500">
                      This tab is empty. Use &quot;Add Setup Row&quot; or &quot;Export Watchlist&quot; to populate data.
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-[500px]">
                      <table className="w-full text-left border-collapse text-xs font-mono">
                        <thead>
                          <tr className="bg-slate-900 border-b border-slate-700 text-slate-400 sticky top-0 z-10">
                            <th className="py-2 px-3 w-10 text-center text-slate-600 border-r border-slate-800 font-mono">
                              #
                            </th>
                            {sheetRows[0]?.map((col, idx) => (
                              <th
                                key={idx}
                                className="py-2 px-3 font-bold text-amber-400 border-r border-slate-800 whitespace-nowrap"
                              >
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sheetRows.slice(1).map((row, rowIdx) => (
                            <tr
                              key={rowIdx}
                              className="border-b border-slate-800/80 hover:bg-slate-900/60 transition-colors"
                            >
                              <td className="py-2 px-3 text-center text-slate-600 border-r border-slate-800/80 font-mono select-none">
                                {rowIdx + 1}
                              </td>
                              {row.map((cell, cIdx) => (
                                <td
                                  key={cIdx}
                                  className="py-2 px-3 text-slate-300 border-r border-slate-800/80 whitespace-nowrap"
                                >
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="text-[11px] font-mono text-slate-500 flex items-center justify-between">
                  <span>Displaying {Math.max(0, sheetRows.length - 1)} rows</span>
                  <span>Range: {activeTabTitle}!A1:Z100</span>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-12 text-center text-slate-400 space-y-3">
                <Table className="w-10 h-10 text-slate-600 mx-auto" />
                <h4 className="text-sm font-bold font-mono text-slate-300">No Spreadsheet Selected</h4>
                <p className="text-xs max-w-sm mx-auto">
                  Select a spreadsheet from the left column or create a new one using the Export buttons above.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Row Modal */}
      {showAddRowModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold font-mono text-slate-100 uppercase tracking-wider flex items-center space-x-2">
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>Add Row to {activeTabTitle}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddRowModal(false)}
                className="text-slate-500 hover:text-slate-300 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddRow} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">
                    Ticker Symbol *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. NVDA"
                    value={newRowTicker}
                    onChange={(e) => setNewRowTicker(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs font-mono rounded p-2 focus:border-emerald-500 focus:outline-none uppercase"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">
                    Company Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. NVIDIA Corp"
                    value={newRowName}
                    onChange={(e) => setNewRowName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs font-mono rounded p-2 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">
                    Current Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="128.50"
                    value={newRowPrice}
                    onChange={(e) => setNewRowPrice(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs font-mono rounded p-2 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">
                    Pivot Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="130.00"
                    value={newRowPivot}
                    onChange={(e) => setNewRowPivot(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs font-mono rounded p-2 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">
                    Stop Loss
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="122.00"
                    value={newRowStop}
                    onChange={(e) => setNewRowStop(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs font-mono rounded p-2 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">
                  SEPA Analysis Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Volume contraction stage, RS rating, catalyst..."
                  value={newRowNotes}
                  onChange={(e) => setNewRowNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs font-mono rounded p-2 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddRowModal(false)}
                  className="px-3 py-1.5 rounded text-xs font-mono text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRow}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-mono text-xs font-bold rounded flex items-center space-x-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  <span>{isSubmittingRow ? 'Appending...' : 'Append Row'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
