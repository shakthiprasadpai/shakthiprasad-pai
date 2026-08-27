import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MinerviniTradeSetup } from '../types';
import { formatCurrency, calculateBreakoutProbability } from '../utils/sepaCalculator';
import { generateSepaPdfReport } from '../utils/pdfExporter';
import { 
  getStoredWatchlists, 
  saveStoredWatchlists, 
  getFavoriteTickers, 
  saveFavoriteTickers, 
  CustomWatchlist 
} from '../utils/watchlistStorage';
import { 
  Bookmark, Star, Plus, Trash2, FileText, Download, TrendingUp, 
  Target, ShieldCheck, Sparkles, Filter, Check, Bot, Eye, Layers, Search,
  Bell, BellRing, Zap, CheckCircle2, AlertTriangle, Activity, Newspaper,
  Volume2, VolumeX, Volume1
} from 'lucide-react';
import { playAlertChime, appendTrackerLog } from '../utils/backgroundPriceChecker';
import { simulateWatchlistMajorNewsAlert } from '../utils/watchlistNewsListener';
import {
  getAudioSettings,
  saveAudioSettings,
  playVolumeSpikeChime,
  playHighConvictionBreakoutChime,
  scanAndTriggerWatchlistAudio,
  triggerWatchlistAudioAlert,
  AudioSettings
} from '../utils/audioAlertEngine';

interface WatchlistManagerProps {
  stocks: MinerviniTradeSetup[];
  selectedStock: MinerviniTradeSetup;
  onSelectStock: (stock: MinerviniTradeSetup) => void;
  onNavigateTab: (tab: any) => void;
  onAddStock?: (stock: MinerviniTradeSetup) => void;
  isObsidian?: boolean;
}

export const WatchlistManager: React.FC<WatchlistManagerProps> = ({
  stocks,
  selectedStock,
  onSelectStock,
  onNavigateTab,
  onAddStock,
  isObsidian = true
}) => {
  const [watchlists, setWatchlists] = useState<CustomWatchlist[]>(() => getStoredWatchlists());
  const [activeWatchlistId, setActiveWatchlistId] = useState<string>(() => watchlists[0]?.id || 'wl-stage2-leaders');
  const [favorites, setFavorites] = useState<string[]>(() => getFavoriteTickers());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFavoritesOnly, setFilterFavoritesOnly] = useState(false);
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(() => getAudioSettings());

  // New Watchlist Form Modal State
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListDesc, setNewListDesc] = useState('');

  // New Stock Form Modal State
  const [isAddingTicker, setIsAddingTicker] = useState(false);
  const [newTicker, setNewTicker] = useState('');
  const [newName, setNewName] = useState('');
  const [newPivot, setNewPivot] = useState<number>(1250);
  const [newStop, setNewStop] = useState<number>(1180);
  const [newRs, setNewRs] = useState<number>(92);

  // Notification API Permission State
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(() => {
    return typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'default';
  });

  const handleRequestPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const perm = await Notification.requestPermission();
      setNotifPermission(perm);
      if (perm === 'granted') {
        playAlertChime();
        new Notification('🎯 Watchlist Pattern Alerts Activated', {
          body: 'Browser Notifications enabled! You will receive real-time notifications when watchlist stocks complete Stage 2 criteria or form a VCP base.',
          icon: '/favicon.ico',
        });
      }
    }
  };

  const handleSimulateStage2Alert = (stock: MinerviniTradeSetup) => {
    playAlertChime();
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(`🎯 Stage 2 Criteria Completed: ${stock.ticker}`, {
        body: `${stock.ticker} (${stock.name}) passed 8/8 Stage 2 Trend Template rules! Trading in confirmed Stage 2 uptrend with RS ${stock.rsRating}.`,
        icon: '/favicon.ico',
      });
    } else {
      handleRequestPermission();
    }
    appendTrackerLog({
      ticker: stock.ticker,
      exchange: stock.exchange,
      previousPrice: stock.currentPrice - 2,
      currentPrice: stock.currentPrice,
      targetPrice: stock.pivotPrice,
      targetType: 'STAGE_2_COMPLETED',
      event: 'STAGE_2_COMPLETED',
      triggered: true,
    });
    window.dispatchEvent(new CustomEvent('minervini_alerts_updated'));
  };

  const handleSimulateVcpBaseAlert = (stock: MinerviniTradeSetup) => {
    playAlertChime();
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(`⚡ VCP Base Formed Alert: ${stock.ticker}`, {
        body: `${stock.ticker} (${stock.name}) formed a tight ${stock.patternType} base with ${stock.volumeDryUpPercent}% volume dry-up! Ready for breakout at pivot.`,
        icon: '/favicon.ico',
      });
    } else {
      handleRequestPermission();
    }
    appendTrackerLog({
      ticker: stock.ticker,
      exchange: stock.exchange,
      previousPrice: stock.currentPrice - 1,
      currentPrice: stock.currentPrice,
      targetPrice: stock.pivotPrice,
      targetType: 'VCP_BASE_FORMED',
      event: 'VCP_BASE_FORMED',
      triggered: true,
    });
    window.dispatchEvent(new CustomEvent('minervini_alerts_updated'));
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

  const handleTestVolumeSpikeAudio = (stock: MinerviniTradeSetup) => {
    playVolumeSpikeChime();
    triggerWatchlistAudioAlert(stock, 'VOLUME_SPIKE', {
      forceChime: true,
      customDescription: `⚡ Institutional Volume Spike: ${stock.ticker} trading at 2.8x average volume with RS ${stock.rsRating}.`,
    });
  };

  const handleTestBreakoutAudio = (stock: MinerviniTradeSetup) => {
    playHighConvictionBreakoutChime();
    triggerWatchlistAudioAlert(stock, 'HIGH_CONVICTION_BREAKOUT', {
      forceChime: true,
      customDescription: `🎯 High-Conviction SEPA Breakout: ${stock.ticker} passing 8/8 Stage 2 rules with RS ${stock.rsRating}.`,
    });
  };

  useEffect(() => {
    saveStoredWatchlists(watchlists);
  }, [watchlists]);

  useEffect(() => {
    saveFavoriteTickers(favorites);
  }, [favorites]);

  const activeWatchlist = watchlists.find(w => w.id === activeWatchlistId) || watchlists[0];

  // Get stocks belonging to active watchlist
  const watchlistStocks = stocks.filter(stock => {
    const isListed = activeWatchlist?.tickers.includes(stock.ticker);
    const isFav = filterFavoritesOnly ? favorites.includes(stock.ticker) : true;
    const matchesSearch = stock.ticker.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          stock.name.toLowerCase().includes(searchTerm.toLowerCase());
    return isListed && isFav && matchesSearch;
  });

  // Automated Watchlist Scan for Subtle Audio Notifications on Volume Spike / High-Conviction setups
  useEffect(() => {
    if (watchlistStocks.length > 0 && audioSettings.enabled) {
      scanAndTriggerWatchlistAudio(watchlistStocks);
    }
  }, [watchlistStocks, audioSettings.enabled]);

  const toggleFavorite = (ticker: string) => {
    if (favorites.includes(ticker)) {
      setFavorites(favorites.filter(t => t !== ticker));
    } else {
      setFavorites([...favorites, ticker]);
    }
  };

  const handleCreateWatchlist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;

    const newList: CustomWatchlist = {
      id: `wl-custom-${Date.now()}`,
      name: newListName,
      description: newListDesc || 'Custom Minervini Watchlist',
      tickers: [selectedStock.ticker],
      createdAt: new Date().toLocaleDateString()
    };

    const updated = [...watchlists, newList];
    setWatchlists(updated);
    setActiveWatchlistId(newList.id);
    setNewListName('');
    setNewListDesc('');
    setIsCreatingList(false);
  };

  const handleRemoveTickerFromWatchlist = (ticker: string) => {
    const updated = watchlists.map(wl => {
      if (wl.id === activeWatchlistId) {
        return {
          ...wl,
          tickers: wl.tickers.filter(t => t !== ticker)
        };
      }
      return wl;
    });
    setWatchlists(updated);
  };

  const handleAddTickerToActiveWatchlist = (ticker: string) => {
    if (!activeWatchlist.tickers.includes(ticker)) {
      const updated = watchlists.map(wl => {
        if (wl.id === activeWatchlistId) {
          return {
            ...wl,
            tickers: [...wl.tickers, ticker]
          };
        }
        return wl;
      });
      setWatchlists(updated);
    }
  };

  const handleCreateCustomStockAndAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicker.trim() || !onAddStock) return;

    const createdStock: MinerviniTradeSetup = {
      ticker: newTicker.toUpperCase(),
      name: newName || `${newTicker.toUpperCase()} Growth India`,
      exchange: 'NSE',
      sector: 'Capital Goods & Growth Tech',
      industry: 'Growth Precision Engineering',
      currentPrice: newPivot * 0.98,
      changePercent: 1.8,
      pivotPrice: newPivot,
      buyZoneMax: newPivot * 1.02,
      stopLossPrice: newStop,
      stopLossPercent: Number((((newStop - newPivot) / newPivot) * 100).toFixed(1)),
      target1Price: Number((newPivot * 1.20).toFixed(1)),
      target1Percent: 20,
      target2Price: Number((newPivot * 1.35).toFixed(1)),
      target2Percent: 35,
      riskRewardRatio: 3.2,
      vcpStage: 'T3',
      patternType: 'VCP (3 Contractions)',
      avgVolume20d: 1500000,
      pivotVolume: 420000,
      contractions: [
        { contractionIndex: 1, depthPercent: 14, durationDays: 18, volumeDryUpPercent: -25, startDate: '2026-06-01', endDate: '2026-06-19', highPrice: newPivot * 1.1, lowPrice: newPivot * 0.95 },
        { contractionIndex: 2, depthPercent: 7, durationDays: 10, volumeDryUpPercent: -40, startDate: '2026-06-20', endDate: '2026-06-30', highPrice: newPivot * 1.05, lowPrice: newPivot * 0.98 },
        { contractionIndex: 3, depthPercent: 3.2, durationDays: 5, volumeDryUpPercent: -52, startDate: '2026-07-01', endDate: '2026-07-06', highPrice: newPivot, lowPrice: newPivot * 0.97 }
      ],
      volumeDryUpPercent: -52,
      isTightVolume: true,
      rsRating: newRs,
      trendScore: 8,
      sma50: newPivot * 0.90,
      sma150: newPivot * 0.82,
      sma200: newPivot * 0.75,
      sma200_1mo_ago: newPivot * 0.73,
      high52w: newPivot * 1.02,
      low52w: newPivot * 0.60,
      priceHistory: stocks[0]?.priceHistory || [],
      sepaNotes: `Custom Watchlist Entry for ${newTicker.toUpperCase()} with ₹${newPivot} Pivot Entry.`
    };

    onAddStock(createdStock);
    handleAddTickerToActiveWatchlist(createdStock.ticker);
    setIsAddingTicker(false);
    setNewTicker('');
    setNewName('');
  };

  return (
    <div className={`space-y-6 ${isObsidian ? 'text-[#f1f5f9]' : 'text-[#1a1a1a]'}`}>
      
      {/* HEADER BANNER */}
      <div className="bg-slate-950 border border-slate-800 p-6 sm:p-8 rounded-xl shadow-xl flex flex-wrap items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-3 max-w-2xl relative z-10">
          <div className="flex items-center space-x-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] uppercase font-mono font-extrabold tracking-widest bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Bookmark className="w-3.5 h-3.5 text-amber-400" />
              WATCHLIST HUB
            </span>
            <span className="text-[10px] uppercase font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/20">
              {watchlists.length} Custom Lists Active
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-serif font-black tracking-tight text-white leading-tight">
            Curated SEPA Growth Watchlists
          </h1>

          <p className="text-sm font-sans text-slate-300 leading-relaxed">
            Organize high-conviction Stage 2 candidates, monitor volume dry-ups, star top performers, and export printable PDF reports for institutional execution.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 relative z-10 font-mono text-xs">
          <button
            onClick={() => setIsCreatingList(true)}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold px-4 py-2.5 rounded-lg flex items-center space-x-2 cursor-pointer shadow-lg transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Custom List</span>
          </button>

          <button
            onClick={() => setIsAddingTicker(true)}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold px-4 py-2.5 rounded-lg flex items-center space-x-2 cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Add Custom Ticker</span>
          </button>
        </div>
      </div>

      {/* REAL-TIME PATTERN & AUDIO ALERT SYSTEM BANNER */}
      <div className="bg-gradient-to-r from-slate-900 via-amber-950/30 to-slate-900 border border-amber-500/30 p-5 rounded-xl shadow-lg font-mono text-xs space-y-3 relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold">
              <BellRing className="w-5 h-5 text-amber-400 animate-pulse" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-400" />
                  REAL-TIME PATTERN & AUDIO ALERTS
                </span>
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${
                  notifPermission === 'granted'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : notifPermission === 'denied'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                }`}>
                  {notifPermission === 'granted'
                    ? '🟢 Browser Notifications Granted'
                    : notifPermission === 'denied'
                    ? '🔴 Notifications Blocked in Browser'
                    : '🟡 Browser Permission Required'}
                </span>
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border flex items-center gap-1 ${
                  audioSettings.enabled
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {audioSettings.enabled ? <Volume2 className="w-3 h-3 text-purple-400" /> : <VolumeX className="w-3 h-3 text-slate-500" />}
                  <span>{audioSettings.enabled ? `Subtle Audio Chimes Active (${Math.round(audioSettings.volume * 100)}%)` : 'Audio Muted'}</span>
                </span>
              </div>
              <h2 className="text-base font-serif font-black text-white mt-0.5">
                Volume Spike Surge & High-Conviction Breakout Audio Notifications
              </h2>
            </div>
          </div>

          {/* Action & Audio Test Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Audio Settings Toggle */}
            <button
              onClick={toggleAudioMute}
              title={audioSettings.enabled ? 'Click to Mute Audio Alerts' : 'Click to Enable Audio Alerts'}
              className={`px-3 py-2 rounded-lg font-bold flex items-center space-x-1.5 cursor-pointer transition-all border ${
                audioSettings.enabled
                  ? 'bg-purple-900/60 hover:bg-purple-900 text-purple-200 border-purple-500/50 shadow-md'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
            >
              {audioSettings.enabled ? (
                <Volume2 className="w-4 h-4 text-purple-300" />
              ) : (
                <VolumeX className="w-4 h-4 text-rose-400" />
              )}
              <span>{audioSettings.enabled ? 'Audio Chime ON' : 'Audio Muted'}</span>
            </button>

            {/* Test Volume Spike Chime */}
            <button
              onClick={() => handleTestVolumeSpikeAudio(watchlistStocks[0] || selectedStock)}
              className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-2 rounded-lg font-bold flex items-center space-x-1.5 cursor-pointer shadow-md transition-all"
              title="Test subtle harmonic arpeggio chime for Volume Spikes (institutional accumulation)"
            >
              <Volume2 className="w-3.5 h-3.5 text-purple-200" />
              <span>Test Volume Spike Sound 🔔</span>
            </button>

            {/* Test High-Conviction Breakout Chime */}
            <button
              onClick={() => handleTestBreakoutAudio(watchlistStocks[0] || selectedStock)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-lg font-bold flex items-center space-x-1.5 cursor-pointer shadow-md transition-all"
              title="Test uplifting ascending major triad chime for High-Conviction Breakouts"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
              <span>Test Breakout Setup Sound 🎵</span>
            </button>

            {notifPermission !== 'granted' && (
              <button
                onClick={handleRequestPermission}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold px-3.5 py-2 rounded-lg flex items-center space-x-1.5 cursor-pointer shadow-md transition-all"
              >
                <Bell className="w-4 h-4" />
                <span>Enable Browser Notifications</span>
              </button>
            )}
          </div>
        </div>

        <p className="text-[11px] font-sans text-slate-300 leading-relaxed border-t border-slate-800/80 pt-2.5">
          The watch-list engine continuously monitors setups in real time. When an institutional <strong>Volume Spike (&ge; 1.5x volume expansion)</strong> or a <strong>High-Conviction Breakout Setup (8/8 Trend rules, RS &ge; 85, tight VCP coil)</strong> is detected, the Web Audio engine synthesizes a subtle, pleasant harmonic chime without freezing the UI.
        </p>
      </div>
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-md space-y-4 font-mono text-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar py-1">
            {watchlists.map(wl => (
              <button
                key={wl.id}
                onClick={() => setActiveWatchlistId(wl.id)}
                className={`px-4 py-2 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap flex items-center space-x-2 border ${
                  activeWatchlistId === wl.id
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md font-extrabold'
                    : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border-slate-800'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{wl.name}</span>
                <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded bg-slate-950/40 text-slate-200">
                  {wl.tickers.length}
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setFilterFavoritesOnly(!filterFavoritesOnly)}
              className={`px-3 py-1.5 rounded flex items-center space-x-1.5 font-bold transition-all border cursor-pointer ${
                filterFavoritesOnly
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${filterFavoritesOnly ? 'fill-amber-400 text-amber-400' : ''}`} />
              <span>Starred Only ({favorites.length})</span>
            </button>

            <button
              onClick={() => generateSepaPdfReport(selectedStock)}
              className="bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 px-3.5 py-1.5 rounded font-bold flex items-center space-x-1.5 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              <span>Export PDF Report</span>
            </button>
          </div>
        </div>

        {/* Search Input and Add Quick Tickers Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search watchlist by ticker or company name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="text-[11px] text-slate-400 font-sans">
            Active Watchlist: <strong className="text-amber-400 font-mono">{activeWatchlist.name}</strong> — {activeWatchlist.description}
          </div>
        </div>
      </div>

      {/* WATCHLIST STOCKS TABLE */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden font-mono text-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-3.5 text-center">Fav</th>
                <th className="p-3.5">Stock Ticker</th>
                <th className="p-3.5">Current Price</th>
                <th className="p-3.5">Pivot Entry</th>
                <th className="p-3.5">Hard Stop Loss</th>
                <th className="p-3.5">VCP Pattern & Dry-Up</th>
                <th className="p-3.5">Trend Score</th>
                <th className="p-3.5">RS Rating</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {watchlistStocks.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-400 font-sans text-sm italic">
                    No stocks matching this watchlist filter. Use 'Add Custom Ticker' above to add items to "{activeWatchlist.name}".
                  </td>
                </tr>
              ) : (
                watchlistStocks.map(stock => {
                  const isFav = favorites.includes(stock.ticker);
                  const isSelected = selectedStock.ticker === stock.ticker;

                  return (
                    <tr
                      key={stock.ticker}
                      className={`hover:bg-slate-800/60 transition-colors ${
                        isSelected ? 'bg-amber-500/10 border-l-2 border-amber-500' : ''
                      }`}
                    >
                      {/* Star Favorite Button */}
                      <td className="p-3.5 text-center">
                        <button
                          onClick={() => toggleFavorite(stock.ticker)}
                          className="text-slate-500 hover:text-amber-400 cursor-pointer"
                        >
                          <Star className={`w-4 h-4 ${isFav ? 'fill-amber-400 text-amber-400' : ''}`} />
                        </button>
                      </td>

                      {/* Ticker & Name */}
                      <td className="p-3.5">
                        <button
                          onClick={() => onSelectStock(stock)}
                          className="text-left cursor-pointer group"
                        >
                          <strong className="text-sm font-serif italic text-white group-hover:text-amber-400 transition-colors">
                            {stock.ticker}
                          </strong>
                          <span className="block text-[10px] font-sans text-slate-400">{stock.name}</span>
                        </button>
                      </td>

                      {/* Current Price */}
                      <td className="p-3.5 font-bold text-slate-100">
                        {formatCurrency(stock.currentPrice, '₹')}
                      </td>

                      {/* Pivot Price */}
                      <td className="p-3.5 font-extrabold text-emerald-400">
                        {formatCurrency(stock.pivotPrice, '₹')}
                      </td>

                      {/* Stop Loss */}
                      <td className="p-3.5 font-bold text-red-400">
                        {formatCurrency(stock.stopLossPrice, '₹')}
                        <span className="text-[10px] block text-red-400/80">({stock.stopLossPercent}%)</span>
                      </td>

                      {/* VCP & Volume Dry Up */}
                      <td className="p-3.5">
                        <div className="space-y-0.5">
                          <span className="text-slate-300 font-bold block">{stock.patternType}</span>
                          <span className="text-[10px] text-emerald-400 font-bold">
                            Dry-Up: {stock.volumeDryUpPercent}%
                          </span>
                        </div>
                      </td>

                      {/* Trend Score */}
                      <td className="p-3.5">
                        <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded font-bold">
                          {stock.trendScore} / 8 Rules
                        </span>
                      </td>

                      {/* RS Rating */}
                      <td className="p-3.5 font-bold text-emerald-400">
                        {stock.rsRating} / 99
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => handleTestVolumeSpikeAudio(stock)}
                            title="Play subtle Volume Spike chime and fire notification"
                            className="p-1.5 rounded bg-purple-500/10 hover:bg-purple-500 text-purple-300 hover:text-white border border-purple-500/30 transition-all cursor-pointer"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleTestBreakoutAudio(stock)}
                            title="Play subtle High-Conviction Breakout chime and fire notification"
                            className="p-1.5 rounded bg-emerald-500/10 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/30 transition-all cursor-pointer"
                          >
                            <Volume1 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleSimulateStage2Alert(stock)}
                            title="Trigger Stage 2 Completed Pattern Notification"
                            className="p-1.5 rounded bg-cyan-500/10 hover:bg-cyan-500 text-cyan-400 hover:text-black border border-cyan-500/30 transition-all cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleSimulateVcpBaseAlert(stock)}
                            title="Trigger VCP Base Formed Pattern Notification"
                            className="p-1.5 rounded bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-black border border-amber-500/30 transition-all cursor-pointer"
                          >
                            <Zap className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => simulateWatchlistMajorNewsAlert(stock)}
                            title="Trigger Major News Catalyst Grounding Notification"
                            className="p-1.5 rounded bg-amber-600/15 hover:bg-amber-600 text-amber-300 hover:text-black border border-amber-500/30 transition-all cursor-pointer"
                          >
                            <Newspaper className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => {
                              onSelectStock(stock);
                              onNavigateTab('hermes_agent');
                            }}
                            title="Audit with Hermes AI Agent"
                            className="p-1.5 rounded bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-slate-950 border border-amber-500/30 transition-all cursor-pointer"
                          >
                            <Bot className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => {
                              onSelectStock(stock);
                              onNavigateTab('chart');
                            }}
                            title="View VCP Chart"
                            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => generateSepaPdfReport(stock)}
                            title="Export PDF Report"
                            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 transition-all cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleRemoveTickerFromWatchlist(stock.ticker)}
                            title="Remove from watchlist"
                            className="p-1.5 rounded bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-slate-700 transition-all cursor-pointer"
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
      </div>

      {/* CREATE NEW LIST MODAL */}
      <AnimatePresence>
        {isCreatingList && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 p-6 rounded-xl max-w-md w-full shadow-2xl space-y-4 font-mono text-xs"
            >
              <h3 className="font-serif font-bold text-lg text-white">Create Custom Watchlist</h3>
              <form onSubmit={handleCreateWatchlist} className="space-y-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">List Name</label>
                  <input
                    type="text"
                    placeholder="e.g. High Alpha Breakouts"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded text-white focus:border-amber-500 font-sans"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Description</label>
                  <input
                    type="text"
                    placeholder="e.g. Tightly coiling stocks with RS > 85"
                    value={newListDesc}
                    onChange={(e) => setNewListDesc(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded text-white focus:border-amber-500 font-sans"
                  />
                </div>
                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreatingList(false)}
                    className="px-4 py-2 rounded bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded bg-amber-500 text-slate-950 font-extrabold cursor-pointer"
                  >
                    Create List
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CREATE NEW CUSTOM TICKER MODAL */}
      <AnimatePresence>
        {isAddingTicker && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 p-6 rounded-xl max-w-md w-full shadow-2xl space-y-4 font-mono text-xs"
            >
              <h3 className="font-serif font-bold text-lg text-white">Add Custom Stock Ticker</h3>
              <form onSubmit={handleCreateCustomStockAndAdd} className="space-y-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Ticker Symbol (NSE / BSE)</label>
                  <input
                    type="text"
                    placeholder="e.g. KAYNES"
                    value={newTicker}
                    onChange={(e) => setNewTicker(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded text-white focus:border-amber-500 font-bold uppercase"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Company Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Kaynes Technology India Ltd"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded text-white focus:border-amber-500 font-sans"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Pivot Price (₹)</label>
                    <input
                      type="number"
                      value={newPivot}
                      onChange={(e) => setNewPivot(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded text-white focus:border-amber-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Stop Loss (₹)</label>
                    <input
                      type="number"
                      value={newStop}
                      onChange={(e) => setNewStop(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded text-white focus:border-amber-500"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">RS Rating (1 - 99)</label>
                  <input
                    type="number"
                    value={newRs}
                    min={1}
                    max={99}
                    onChange={(e) => setNewRs(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded text-white focus:border-amber-500"
                  />
                </div>
                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingTicker(false)}
                    className="px-4 py-2 rounded bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded bg-amber-500 text-slate-950 font-extrabold cursor-pointer"
                  >
                    Add Stock
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
