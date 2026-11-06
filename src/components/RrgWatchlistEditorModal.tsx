import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MinerviniTradeSetup } from '../types';
import {
  CustomWatchlist,
  getStoredWatchlists,
  saveStoredWatchlists,
  INITIAL_WATCHLISTS,
} from '../utils/watchlistStorage';
import { RrgQuadrant, QUADRANT_META } from '../utils/rrgCalculator';
import { formatCurrency, getCurrencySymbol } from '../utils/sepaCalculator';
import {
  X,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  ChevronsUp,
  ChevronsDown,
  ListOrdered,
  Search,
  Sparkles,
  Check,
  RotateCcw,
  GripVertical,
  Layers,
  ShieldCheck,
  ArrowUpDown,
  Zap,
  Tag,
  CheckCircle2,
} from 'lucide-react';

export interface RrgWatchlistEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableWatchlists: CustomWatchlist[];
  activeWatchlistId: string;
  onSelectWatchlistId: (id: string) => void;
  onSaveWatchlists: (updatedLists: CustomWatchlist[]) => void;
  stocks: MinerviniTradeSetup[];
  currentQuadrantMap?: Record<string, RrgQuadrant>;
  isObsidian?: boolean;
}

export const RrgWatchlistEditorModal: React.FC<RrgWatchlistEditorModalProps> = ({
  isOpen,
  onClose,
  availableWatchlists,
  activeWatchlistId,
  onSelectWatchlistId,
  onSaveWatchlists,
  stocks,
  currentQuadrantMap = {},
  isObsidian = true,
}) => {
  // Currently targeted watchlist to edit
  const [targetListId, setTargetListId] = useState<string>(activeWatchlistId);
  const [lists, setLists] = useState<CustomWatchlist[]>(availableWatchlists);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // New list creation inline state
  const [isCreatingNewList, setIsCreatingNewList] = useState<boolean>(false);
  const [newListName, setNewListName] = useState<string>('');

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keep targetListId valid
  useEffect(() => {
    if (activeWatchlistId !== 'ALL_COMBINED') {
      setTargetListId(activeWatchlistId);
    } else if (lists.length > 0) {
      setTargetListId(lists[0].id);
    }
  }, [activeWatchlistId, lists]);

  // Keep local lists in sync with prop
  useEffect(() => {
    setLists(availableWatchlists);
  }, [availableWatchlists]);

  // Notice timeout
  const showNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => {
      setActionNotice((prev) => (prev === msg ? null : prev));
    }, 2500);
  };

  // The active watchlist being edited
  const currentList = useMemo(() => {
    return lists.find((l) => l.id === targetListId) || lists[0];
  }, [lists, targetListId]);

  // Stocks map for quick lookup
  const stockMap = useMemo(() => {
    const map = new Map<string, MinerviniTradeSetup>();
    stocks.forEach((s) => map.set(s.ticker.toUpperCase(), s));
    return map;
  }, [stocks]);

  // Filtered stock suggestions for Add input
  const suggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const currentTickers = new Set((currentList?.tickers || []).map((t) => t.toUpperCase()));
    return stocks
      .filter((s) => {
        const matchTicker = s.ticker.toLowerCase().includes(q);
        const matchName = s.name.toLowerCase().includes(q);
        const matchSector = s.sector.toLowerCase().includes(q);
        return matchTicker || matchName || matchSector;
      })
      .slice(0, 7)
      .map((s) => ({
        ...s,
        isAlreadyAdded: currentTickers.has(s.ticker.toUpperCase()),
      }));
  }, [stocks, searchQuery, currentList]);

  // Commit updated watchlists to local storage & parent state
  const commitWatchlists = (updated: CustomWatchlist[]) => {
    setLists(updated);
    saveStoredWatchlists(updated);
    onSaveWatchlists(updated);
  };

  // Add ticker to active watchlist
  const handleAddTicker = (tickerToAdd: string) => {
    const cleanTicker = tickerToAdd.trim().toUpperCase();
    if (!cleanTicker || !currentList) return;

    if (currentList.tickers.includes(cleanTicker)) {
      showNotice(`${cleanTicker} is already in ${currentList.name}`);
      return;
    }

    const updatedLists = lists.map((wl) => {
      if (wl.id === currentList.id) {
        return {
          ...wl,
          tickers: [...wl.tickers, cleanTicker],
          updatedAt: Date.now(),
        };
      }
      return wl;
    });

    commitWatchlists(updatedLists);
    setSearchQuery('');
    showNotice(`Added ${cleanTicker} to ${currentList.name} ✓`);
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  // Remove ticker from active watchlist
  const handleRemoveTicker = (tickerToRemove: string) => {
    if (!currentList) return;
    const updatedLists = lists.map((wl) => {
      if (wl.id === currentList.id) {
        return {
          ...wl,
          tickers: wl.tickers.filter((t) => t !== tickerToRemove),
          updatedAt: Date.now(),
        };
      }
      return wl;
    });

    commitWatchlists(updatedLists);
    showNotice(`Removed ${tickerToRemove} from ${currentList.name}`);
  };

  // Reorder ticker position
  const handleMoveTicker = (
    index: number,
    direction: 'UP' | 'DOWN' | 'TOP' | 'BOTTOM'
  ) => {
    if (!currentList) return;
    const items = [...currentList.tickers];
    const ticker = items[index];
    if (!ticker) return;

    items.splice(index, 1);

    if (direction === 'UP') {
      const newIdx = Math.max(0, index - 1);
      items.splice(newIdx, 0, ticker);
    } else if (direction === 'DOWN') {
      const newIdx = Math.min(items.length, index + 1);
      items.splice(newIdx, 0, ticker);
    } else if (direction === 'TOP') {
      items.unshift(ticker);
    } else if (direction === 'BOTTOM') {
      items.push(ticker);
    }

    const updatedLists = lists.map((wl) => {
      if (wl.id === currentList.id) {
        return {
          ...wl,
          tickers: items,
          updatedAt: Date.now(),
        };
      }
      return wl;
    });

    commitWatchlists(updatedLists);
    showNotice(`Reordered ${ticker}`);
  };

  // HTML5 Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex || !currentList) {
      setDraggedIndex(null);
      return;
    }

    const items = [...currentList.tickers];
    const [moved] = items.splice(draggedIndex, 1);
    items.splice(targetIndex, 0, moved);

    const updatedLists = lists.map((wl) => {
      if (wl.id === currentList.id) {
        return {
          ...wl,
          tickers: items,
          updatedAt: Date.now(),
        };
      }
      return wl;
    });

    commitWatchlists(updatedLists);
    showNotice(`Reordered ${moved} to position #${targetIndex + 1}`);
    setDraggedIndex(null);
  };

  // Sorting utilities
  const handleSortBy = (sortMode: 'RS_RATING' | 'ALPHABETICAL' | 'QUADRANT') => {
    if (!currentList) return;
    const items = [...currentList.tickers];

    if (sortMode === 'RS_RATING') {
      items.sort((a, b) => {
        const stockA = stockMap.get(a);
        const stockB = stockMap.get(b);
        const rsA = stockA?.rsRating || 0;
        const rsB = stockB?.rsRating || 0;
        return rsB - rsA;
      });
      showNotice(`Sorted by Relative Strength (RS Rating)`);
    } else if (sortMode === 'ALPHABETICAL') {
      items.sort((a, b) => a.localeCompare(b));
      showNotice(`Sorted Alphabetically (A to Z)`);
    } else if (sortMode === 'QUADRANT') {
      const quadPriority: Record<RrgQuadrant, number> = {
        LEADING: 1,
        IMPROVING: 2,
        WEAKENING: 3,
        LAGGING: 4,
      };
      items.sort((a, b) => {
        const qA = currentQuadrantMap[a] ? quadPriority[currentQuadrantMap[a]] : 5;
        const qB = currentQuadrantMap[b] ? quadPriority[currentQuadrantMap[b]] : 5;
        return qA - qB;
      });
      showNotice(`Sorted by RRG Quadrant (Leading First)`);
    }

    const updatedLists = lists.map((wl) => {
      if (wl.id === currentList.id) {
        return {
          ...wl,
          tickers: items,
          updatedAt: Date.now(),
        };
      }
      return wl;
    });

    commitWatchlists(updatedLists);
  };

  // Quick Preset Add Buttons
  const handleAddPreset = (type: 'TOP_RS' | 'VCP_COILS' | 'OPTIONS') => {
    if (!currentList) return;
    const currentSet = new Set(currentList.tickers);
    let candidates: string[] = [];

    if (type === 'TOP_RS') {
      candidates = [...stocks]
        .sort((a, b) => (b.rsRating || 0) - (a.rsRating || 0))
        .map((s) => s.ticker)
        .filter((t) => !currentSet.has(t))
        .slice(0, 3);
    } else if (type === 'VCP_COILS') {
      candidates = stocks
        .filter((s) => s.patternType?.includes('VCP') || s.setupGrade === 'A+' || s.setupGrade === 'A')
        .map((s) => s.ticker)
        .filter((t) => !currentSet.has(t))
        .slice(0, 3);
    } else if (type === 'OPTIONS') {
      candidates = stocks
        .filter((s) => (s as any).isOptionsStock || (s as any).optionsChain?.hasOptions)
        .map((s) => s.ticker)
        .filter((t) => !currentSet.has(t))
        .slice(0, 3);
    }

    if (candidates.length === 0) {
      showNotice('All matching candidates are already in the watchlist');
      return;
    }

    const updatedLists = lists.map((wl) => {
      if (wl.id === currentList.id) {
        return {
          ...wl,
          tickers: [...wl.tickers, ...candidates],
          updatedAt: Date.now(),
        };
      }
      return wl;
    });

    commitWatchlists(updatedLists);
    showNotice(`Added ${candidates.join(', ')} to ${currentList.name} ✓`);
  };

  // Reset to default watchlists
  const handleRestoreDefaults = () => {
    if (window.confirm('Reset all watchlists to default presets? Your custom modifications will be restored to default.')) {
      commitWatchlists(INITIAL_WATCHLISTS);
      setTargetListId(INITIAL_WATCHLISTS[0].id);
      onSelectWatchlistId(INITIAL_WATCHLISTS[0].id);
      showNotice('Restored default watchlists ✓');
    }
  };

  // Create new custom watchlist inline
  const handleCreateNewList = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newListName.trim();
    if (!name) return;

    const newList: CustomWatchlist = {
      id: `wl-custom-${Date.now()}`,
      name,
      description: 'Custom user-managed RRG watchlist',
      tickers: ['HAL', 'TRENT'],
      isCustom: true,
      createdAt: new Date().toLocaleDateString(),
      updatedAt: Date.now(),
    };

    const updated = [...lists, newList];
    commitWatchlists(updated);
    setTargetListId(newList.id);
    onSelectWatchlistId(newList.id);
    setNewListName('');
    setIsCreatingNewList(false);
    showNotice(`Created new watchlist "${name}" ✓`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className={`w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden font-sans ${
          isObsidian ? 'bg-[#121620] border-[#253046] text-gray-200' : 'bg-white border-gray-300 text-gray-900'
        }`}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between shrink-0 bg-black/20">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
              <ListOrdered className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base sm:text-lg font-serif font-black text-white tracking-wide">
                  Manage RRG Watchlist Tickers
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Instant Auto-Save
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Add, remove, or reorder stocks plotted on the Relative Rotation Graph. Changes sync immediately with local storage.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Close modal (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Watchlist Target Selector & Action Notice Bar */}
        <div className="px-6 py-3 border-b border-white/10 bg-black/10 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-mono font-bold uppercase text-gray-400 shrink-0">
              Active Watchlist:
            </span>
            <select
              value={targetListId}
              onChange={(e) => {
                setTargetListId(e.target.value);
                onSelectWatchlistId(e.target.value);
              }}
              className={`py-1.5 px-3 rounded-lg border font-mono text-xs font-bold cursor-pointer ${
                isObsidian
                  ? 'bg-[#181f2c] border-amber-500/40 text-amber-300'
                  : 'bg-white border-amber-400 text-gray-900'
              }`}
            >
              {lists.map((wl) => (
                <option key={wl.id} value={wl.id}>
                  {wl.name} ({wl.tickers.length} stocks)
                </option>
              ))}
            </select>

            <button
              onClick={() => setIsCreatingNewList(!isCreatingNewList)}
              className="px-2.5 py-1.5 rounded border border-white/20 text-xs font-mono text-gray-300 hover:text-white hover:bg-white/10 transition-all cursor-pointer flex items-center space-x-1"
              title="Create a new custom watchlist"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New List</span>
            </button>
          </div>

          {/* Action Feedback Badge */}
          {actionNotice && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center space-x-1.5 text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{actionNotice}</span>
            </motion.div>
          )}
        </div>

        {/* Inline New List Form */}
        {isCreatingNewList && (
          <form
            onSubmit={handleCreateNewList}
            className="px-6 py-3 bg-amber-500/10 border-b border-amber-500/20 flex items-center space-x-3 shrink-0"
          >
            <span className="text-xs font-mono font-bold text-amber-300 shrink-0">
              New Watchlist Name:
            </span>
            <input
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="e.g. Breakout Radar, High Volume Leaders..."
              className="flex-1 py-1 px-3 rounded border border-amber-500/40 bg-black/30 font-mono text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
              autoFocus
            />
            <button
              type="submit"
              className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono text-xs font-bold rounded cursor-pointer transition-all"
            >
              Save List
            </button>
            <button
              type="button"
              onClick={() => setIsCreatingNewList(false)}
              className="px-2 py-1 text-gray-400 hover:text-white text-xs font-mono cursor-pointer"
            >
              Cancel
            </button>
          </form>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section 1: Add Stock Ticker Form & Quick Presets */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono font-bold uppercase tracking-wider text-gray-300 flex items-center space-x-2">
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>Add Stock to Watchlist:</span>
              </label>
              <span className="text-[11px] font-mono text-gray-400">
                Type symbol or company name (e.g. NVDA, TRENT, POLYCAB)
              </span>
            </div>

            {/* Input with Auto-Complete Dropdown */}
            <div className="relative">
              <div className="flex items-center space-x-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setIsSearchFocused(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (suggestions.length > 0) {
                          handleAddTicker(suggestions[0].ticker);
                        } else if (searchQuery.trim()) {
                          handleAddTicker(searchQuery.trim());
                        }
                      }
                    }}
                    placeholder="Search stock to add (press Enter to confirm)..."
                    className={`w-full py-2.5 pl-9 pr-3 rounded-xl border font-mono text-xs text-white placeholder-gray-500 transition-all ${
                      isObsidian
                        ? 'bg-[#181f2c] border-[#29354a] focus:border-amber-400 focus:bg-[#1a2332]'
                        : 'bg-gray-50 border-gray-300 focus:border-amber-500'
                    }`}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  onClick={() => {
                    if (suggestions.length > 0) {
                      handleAddTicker(suggestions[0].ticker);
                    } else if (searchQuery.trim()) {
                      handleAddTicker(searchQuery.trim());
                    }
                  }}
                  disabled={!searchQuery.trim()}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-mono text-xs font-bold uppercase transition-all cursor-pointer shrink-0 shadow-sm flex items-center space-x-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add</span>
                </button>
              </div>

              {/* Suggestions Dropdown */}
              {isSearchFocused && searchQuery.trim() && suggestions.length > 0 && (
                <div
                  className={`absolute top-full left-0 right-0 mt-1 rounded-xl border shadow-2xl z-30 overflow-hidden font-mono text-xs ${
                    isObsidian ? 'bg-[#141b27] border-[#2a374f]' : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="p-2 border-b border-white/5 text-[10px] text-gray-400 uppercase font-bold flex justify-between">
                    <span>Matched Stocks</span>
                    <span>Click or Press Enter to Add</span>
                  </div>
                  <div className="max-h-60 overflow-y-auto divide-y divide-white/5">
                    {suggestions.map((s) => (
                      <div
                        key={s.ticker}
                        onClick={() => {
                          handleAddTicker(s.ticker);
                          setIsSearchFocused(false);
                        }}
                        className={`p-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                          s.isAlreadyAdded
                            ? 'opacity-50 bg-black/20 hover:bg-black/30'
                            : isObsidian
                            ? 'hover:bg-amber-500/10'
                            : 'hover:bg-amber-50'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <span className="font-bold text-white text-sm">{s.ticker}</span>
                          <span className="text-gray-400 truncate max-w-[200px]">{s.name}</span>
                          <span className="px-1.5 py-0.5 rounded bg-black/30 text-[10px] text-gray-300">
                            {s.sector}
                          </span>
                        </div>

                        <div className="flex items-center space-x-3">
                          <span className="text-gray-300 font-bold">
                            {formatCurrency(s.currentPrice, getCurrencySymbol(s.exchange))}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px]">
                            RS {s.rsRating}
                          </span>
                          {s.isAlreadyAdded ? (
                            <span className="text-[10px] text-gray-500 font-bold uppercase">
                              In List ✓
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold uppercase">
                              + Add
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Add Presets Bar */}
            <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-[11px]">
              <span className="text-gray-400 uppercase font-bold text-[10px]">Quick Presets:</span>
              <button
                onClick={() => handleAddPreset('TOP_RS')}
                className="px-2.5 py-1 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 flex items-center space-x-1 cursor-pointer transition-all"
                title="Add top 3 Relative Strength leaders from universe"
              >
                <Zap className="w-3 h-3 text-amber-400" />
                <span>+ Top RS Leaders</span>
              </button>
              <button
                onClick={() => handleAddPreset('VCP_COILS')}
                className="px-2.5 py-1 rounded-lg border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 flex items-center space-x-1 cursor-pointer transition-all"
                title="Add top VCP volatility contraction coil setups"
              >
                <Sparkles className="w-3 h-3 text-cyan-400" />
                <span>+ VCP Tight Coils</span>
              </button>
              <button
                onClick={() => handleAddPreset('OPTIONS')}
                className="px-2.5 py-1 rounded-lg border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 flex items-center space-x-1 cursor-pointer transition-all"
                title="Add liquid F&O Options tradable stocks"
              >
                <Layers className="w-3 h-3 text-purple-400" />
                <span>+ F&amp;O Options Stocks</span>
              </button>
            </div>
          </div>

          {/* Section 2: Tickers List with Reordering Controls */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-white/10 pb-2">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-gray-300">
                  Current Tickers in {currentList?.name} ({currentList?.tickers.length || 0})
                </span>
                <span className="text-[11px] font-mono text-gray-500">
                  • Drag rows or use ▲/▼ arrows to reorder
                </span>
              </div>

              {/* Sort Presets */}
              <div className="flex items-center space-x-1.5 font-mono text-[10px]">
                <span className="text-gray-500 uppercase font-bold">Sort:</span>
                <button
                  onClick={() => handleSortBy('RS_RATING')}
                  className="px-2 py-0.5 rounded border border-white/10 hover:border-amber-400 text-gray-300 hover:text-white transition-colors cursor-pointer"
                  title="Sort tickers by SEPA Relative Strength rating descending"
                >
                  RS Rating ↓
                </button>
                <button
                  onClick={() => handleSortBy('QUADRANT')}
                  className="px-2 py-0.5 rounded border border-white/10 hover:border-emerald-400 text-gray-300 hover:text-white transition-colors cursor-pointer"
                  title="Sort tickers by RRG Quadrant (Leading first)"
                >
                  Quadrant
                </button>
                <button
                  onClick={() => handleSortBy('ALPHABETICAL')}
                  className="px-2 py-0.5 rounded border border-white/10 hover:border-white/30 text-gray-300 hover:text-white transition-colors cursor-pointer"
                  title="Sort alphabetically A-Z"
                >
                  A-Z
                </button>
              </div>
            </div>

            {/* Reorderable Ticker Rows */}
            <div className="space-y-2">
              {currentList?.tickers.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-white/10 rounded-xl text-gray-400 font-mono text-xs">
                  <ListOrdered className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <p className="font-bold text-gray-300">No stocks in this watchlist yet.</p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Use the search bar above or click one of the quick presets to populate stocks.
                  </p>
                </div>
              ) : (
                currentList?.tickers.map((ticker, index) => {
                  const stock = stockMap.get(ticker.toUpperCase());
                  const quadrant = currentQuadrantMap[ticker.toUpperCase()] || 'LEADING';
                  const quadMeta = QUADRANT_META[quadrant];
                  const isFirst = index === 0;
                  const isLast = index === (currentList?.tickers.length || 0) - 1;

                  return (
                    <div
                      key={ticker}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, index)}
                      className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 group ${
                        draggedIndex === index
                          ? 'opacity-40 border-amber-500 border-dashed bg-amber-500/10'
                          : isObsidian
                          ? 'bg-[#181f2c] border-[#29354a] hover:border-amber-500/40'
                          : 'bg-white border-gray-200 hover:border-amber-400'
                      }`}
                    >
                      {/* Left: Drag Handle, Number, Ticker Info */}
                      <div className="flex items-center space-x-3 min-w-0">
                        {/* Drag Handle */}
                        <div
                          className="cursor-grab active:cursor-grabbing text-gray-500 hover:text-gray-300 p-1"
                          title="Click and drag to reorder"
                        >
                          <GripVertical className="w-4 h-4" />
                        </div>

                        {/* Order Index */}
                        <span className="w-6 text-center text-xs font-mono font-bold text-gray-500">
                          #{index + 1}
                        </span>

                        {/* Ticker & Name */}
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-black text-sm text-white">
                              {ticker}
                            </span>
                            {stock?.name && (
                              <span className="text-xs text-gray-400 truncate max-w-[150px] sm:max-w-[220px]">
                                {stock.name}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 text-[10px] font-mono text-gray-400 mt-0.5">
                            {stock?.sector && <span>{stock.sector}</span>}
                            {stock?.currentPrice && (
                              <>
                                <span>•</span>
                                <span className="text-gray-300 font-bold">
                                  {formatCurrency(stock.currentPrice, getCurrencySymbol(stock.exchange))}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: RRG Quadrant Badge, Reorder Buttons & Remove Button */}
                      <div className="flex items-center space-x-2 shrink-0">
                        {/* Quadrant Badge */}
                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase hidden sm:inline-block border ${
                            quadrant === 'LEADING'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : quadrant === 'IMPROVING'
                              ? 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                              : quadrant === 'WEAKENING'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                          }`}
                          title={`Current RRG Status: ${quadMeta.label} - ${quadMeta.description}`}
                        >
                          {quadMeta.label}
                        </span>

                        {/* Reorder Buttons */}
                        <div className="flex items-center space-x-1 border border-white/10 rounded-lg p-0.5 bg-black/20">
                          {/* Move to Top */}
                          <button
                            onClick={() => handleMoveTicker(index, 'TOP')}
                            disabled={isFirst}
                            className="p-1 rounded text-gray-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                            title="Move to top (#1)"
                          >
                            <ChevronsUp className="w-3.5 h-3.5" />
                          </button>

                          {/* Move Up */}
                          <button
                            onClick={() => handleMoveTicker(index, 'UP')}
                            disabled={isFirst}
                            className="p-1 rounded text-gray-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                            title="Move up one position"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>

                          {/* Move Down */}
                          <button
                            onClick={() => handleMoveTicker(index, 'DOWN')}
                            disabled={isLast}
                            className="p-1 rounded text-gray-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                            title="Move down one position"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>

                          {/* Move to Bottom */}
                          <button
                            onClick={() => handleMoveTicker(index, 'BOTTOM')}
                            disabled={isLast}
                            className="p-1 rounded text-gray-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                            title="Move to bottom"
                          >
                            <ChevronsDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Delete / Remove Ticker Button */}
                        <button
                          onClick={() => handleRemoveTicker(ticker)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 transition-all cursor-pointer"
                          title={`Remove ${ticker} from this watchlist`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-black/20 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-3 text-xs font-mono text-gray-400">
            <button
              onClick={handleRestoreDefaults}
              className="text-gray-400 hover:text-amber-400 flex items-center space-x-1 underline cursor-pointer"
              title="Restore standard Minervini presets"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restore Default Watchlists</span>
            </button>
            <span>•</span>
            <span className="text-gray-500">
              {currentList?.tickers.length || 0} stocks in active view
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono text-xs font-black uppercase transition-all cursor-pointer shadow-md active:scale-95"
            >
              Done &amp; Update RRG
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
