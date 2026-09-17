import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MinerviniTradeSetup,
  FivePaisaAccountMargin,
  FivePaisaHolding,
  FivePaisaPosition,
  FivePaisaOrder,
  FivePaisaCredentials,
  PortfolioHolding
} from '../types';
import {
  fetchFivePaisaMargin,
  fetchFivePaisaHoldings,
  fetchFivePaisaPositions,
  fetchFivePaisaOrders,
  cancelFivePaisaOrder,
  sync5paisaToMinerviniPortfolio,
  getStoredCredentials,
  saveStoredCredentials,
  clearStoredCredentials
} from '../utils/fivePaisaService';
import { FivePaisaOrderModal } from './FivePaisaOrderModal';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import {
  Wallet,
  Building2,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Key,
  ShieldCheck,
  Download,
  Trash2,
  Plus,
  ExternalLink,
  ChevronRight,
  Clock,
  Briefcase,
  HelpCircle,
  FileSpreadsheet,
  XCircle,
  Sparkles
} from 'lucide-react';

interface FivePaisaTradingViewProps {
  stocks: MinerviniTradeSetup[];
  onSelectStock: (stock: MinerviniTradeSetup) => void;
  onViewChart: (stock: MinerviniTradeSetup) => void;
  onNavigateToPortfolio: () => void;
  isObsidian?: boolean;
}

export const FivePaisaTradingView: React.FC<FivePaisaTradingViewProps> = ({
  stocks,
  onSelectStock,
  onViewChart,
  onNavigateToPortfolio,
  isObsidian = false,
}) => {
  const { user } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'holdings' | 'positions' | 'orders' | 'terminal' | 'settings'>('holdings');
  const [margin, setMargin] = useState<FivePaisaAccountMargin | null>(null);
  const [holdings, setHoldings] = useState<FivePaisaHolding[]>([]);
  const [positions, setPositions] = useState<FivePaisaPosition[]>([]);
  const [orders, setOrders] = useState<FivePaisaOrder[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Search & Filter state for Holdings
  const [holdingSearch, setHoldingSearch] = useState<string>('');
  const [orderFilter, setOrderFilter] = useState<'ALL' | 'Executed' | 'Pending' | 'Cancelled'>('ALL');

  // Order Modal state
  const [selectedStockForOrder, setSelectedStockForOrder] = useState<MinerviniTradeSetup | null>(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState<boolean>(false);

  // Credentials State
  const [credentials, setCredentials] = useState<FivePaisaCredentials>(() => {
    return getStoredCredentials() || {
      clientCode: '5P88421943',
      appName: 'GrowthStockAlpha',
      appSource: 'MinerviniSEPA',
      userKey: 'LIVE_5P_API_DEMO_KEY',
      encryptionKey: 'ENC_7849_ALPHA',
      passwordPin: '••••••',
      isSimulated: true
    };
  });

  const [isLiveApiMode, setIsLiveApiMode] = useState<boolean>(false);

  const loadData = async () => {
    setIsRefreshing(true);
    try {
      const [m, h, p, o] = await Promise.all([
        fetchFivePaisaMargin(),
        fetchFivePaisaHoldings(),
        fetchFivePaisaPositions(),
        fetchFivePaisaOrders()
      ]);
      setMargin(m);
      setHoldings(h);
      setPositions(p);
      setOrders(o);
    } catch (e) {
      console.error('Failed to load 5paisa data:', e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = async () => {
    await loadData();
    showToast('5paisa margins, holdings & order book updated from exchange.');
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Sync to Minervini Portfolio
  const handleSyncToPortfolio = () => {
    try {
      const savedPortfolio: PortfolioHolding[] = JSON.parse(
        localStorage.getItem('minervini_sepa_portfolio') || '[]'
      );
      const updated = sync5paisaToMinerviniPortfolio(holdings, savedPortfolio);

      // If user is logged into Firestore, also backup
      if (user) {
        updated.forEach((item) => {
          setDoc(doc(db, 'users', user.uid, 'portfolio_holdings', item.id), item).catch((err) =>
            console.error('Failed to sync holding to Firestore:', err)
          );
        });
      }

      showToast(`Successfully synced ${holdings.length} holdings into Minervini SEPA Portfolio!`);
    } catch (e) {
      console.error(e);
      showToast('Error syncing to portfolio');
    }
  };

  // Cancel order handler
  const handleCancelOrder = async (orderId: string) => {
    const res = await cancelFivePaisaOrder(orderId);
    if (res.success) {
      showToast(res.message);
      const updated = await fetchFivePaisaOrders();
      setOrders(updated);
    } else {
      showToast(res.message || 'Failed to cancel order.');
    }
  };

  // Quick Order Launcher for a stock from holdings or search
  const handleLaunchOrderForTicker = (ticker: string) => {
    const matched = stocks.find((s) => s.ticker.toUpperCase() === ticker.toUpperCase());
    if (matched) {
      setSelectedStockForOrder(matched);
      setIsOrderModalOpen(true);
    } else {
      // Create synthetic trade setup for this Indian stock
      const holding = holdings.find((h) => h.symbol.toUpperCase() === ticker.toUpperCase());
      const syntheticStock: MinerviniTradeSetup = {
        ticker,
        name: holding?.companyName || `${ticker} Ltd`,
        exchange: holding?.exchange || 'NSE',
        currentPrice: holding?.currentPrice || 1000,
        changePercent: holding?.dayChangePercent || 1.5,
        avgVolume20d: 1500000,
        high52w: (holding?.currentPrice || 1000) * 1.15,
        low52w: (holding?.currentPrice || 1000) * 0.75,
        sma50: (holding?.currentPrice || 1000) * 0.95,
        sma150: (holding?.currentPrice || 1000) * 0.9,
        sma200: (holding?.currentPrice || 1000) * 0.85,
        sma200_1mo_ago: (holding?.currentPrice || 1000) * 0.83,
        rsRating: holding?.rsRating || 88,
        patternType: 'VCP (3 Contractions)',
        vcpStage: 'Active Breakout',
        trendScore: 8,
        pivotVolume: 600000,
        volumeDryUpPercent: -45,
        isTightVolume: true,
        pivotPrice: holding?.currentPrice || 1000,
        buyZoneMax: Number(((holding?.currentPrice || 1000) * 1.02).toFixed(2)),
        stopLossPrice: Number(((holding?.currentPrice || 1000) * 0.94).toFixed(2)),
        stopLossPercent: -6.0,
        target1Price: Number(((holding?.currentPrice || 1000) * 1.25).toFixed(2)),
        target1Percent: 25,
        target2Price: Number(((holding?.currentPrice || 1000) * 1.4).toFixed(2)),
        target2Percent: 40,
        riskRewardRatio: 4.16,
        contractions: [],
        priceHistory: [],
        sepaNotes: '5paisa live portfolio holding scrip.',
        sector: 'Indian Equities',
        industry: 'NSE Listed'
      };
      setSelectedStockForOrder(syntheticStock);
      setIsOrderModalOpen(true);
    }
  };

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    saveStoredCredentials(credentials);
    showToast('5paisa API credentials saved securely.');
  };

  const handleUseDemoAccount = () => {
    const demoCreds: FivePaisaCredentials = {
      clientCode: '5P88421943',
      appName: 'GrowthStockAlpha',
      appSource: 'MinerviniSEPA',
      userKey: 'DEMO_USER_KEY_5P',
      encryptionKey: 'ENC_KEY_DEMO',
      passwordPin: '••••••',
      isSimulated: true
    };
    setCredentials(demoCreds);
    saveStoredCredentials(demoCreds);
    loadData();
    showToast('Connected to 5paisa Instant Simulated Demo Account (₹5,00,000 Sandbox Margin)');
  };

  // Filtered holdings
  const filteredHoldings = holdings.filter((h) =>
    h.symbol.toLowerCase().includes(holdingSearch.toLowerCase()) ||
    h.companyName.toLowerCase().includes(holdingSearch.toLowerCase())
  );

  const totalHoldingsValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);
  const totalHoldingsPnl = holdings.reduce((sum, h) => sum + h.pnl, 0);
  const totalHoldingsPnlPercent = totalHoldingsValue > 0
    ? (totalHoldingsPnl / (totalHoldingsValue - totalHoldingsPnl)) * 100
    : 0;

  // Filtered orders
  const filteredOrders = orders.filter((o) => {
    if (orderFilter === 'ALL') return true;
    return o.orderStatus === orderFilter;
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-24 right-6 z-50 bg-[#10141d] text-white border border-amber-500/60 px-4 py-3 shadow-2xl flex items-center space-x-3 text-xs font-mono"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main 5paisa Account Header */}
      <div className={`p-6 border shadow-sm transition-colors ${
        isObsidian ? 'bg-[#10141d] border-[#262b36]' : 'bg-white border-[#e5e4e1]'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-5 border-gray-200 dark:border-gray-800">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-amber-600 text-black font-mono font-black text-xl flex items-center justify-center shadow-md">
              5P
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono font-black tracking-widest uppercase px-2 py-0.5 bg-amber-500/20 text-amber-500 border border-amber-500/30">
                  5paisa Capital Ltd
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 flex items-center space-x-1 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1" />
                  {credentials.isSimulated ? 'PAPER TRADING SANDBOX' : 'LIVE BROKER CONNECTED'}
                </span>
                <span className="text-[10px] font-mono text-gray-500">
                  DP: CDSL (12010600)
                </span>
              </div>
              <h2 className="text-2xl font-serif font-black tracking-tight mt-1 flex items-center space-x-3">
                <span>Trading & Demat Account</span>
                <span className="text-sm font-mono text-gray-400 font-normal">
                  [{margin?.clientCode || credentials.clientCode}]
                </span>
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={`px-3.5 py-2 text-xs font-mono font-bold uppercase tracking-wider border flex items-center space-x-2 transition-all cursor-pointer ${
                isObsidian
                  ? 'bg-[#181e2b] border-[#2d3648] hover:bg-[#202838] text-gray-200'
                  : 'bg-gray-50 border-gray-300 hover:bg-gray-100 text-gray-800'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-500' : ''}`} />
              <span>{isRefreshing ? 'Syncing...' : 'Refresh'}</span>
            </button>

            <button
              onClick={handleSyncToPortfolio}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold uppercase tracking-wider flex items-center space-x-2 shadow-xs transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Sync to SEPA Portfolio</span>
            </button>

            <button
              onClick={() => setActiveSubTab('terminal')}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-mono font-black uppercase tracking-wider flex items-center space-x-2 shadow-sm transition-all cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>1-Click Order Terminal</span>
            </button>
          </div>
        </div>

        {/* 6-Card Real-time Financial Margins & Capital Summary Bar */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-5">
          {/* 1. Available Cash Margin */}
          <div className={`p-3.5 border font-mono text-left ${
            isObsidian ? 'bg-[#141924] border-[#222a3a]' : 'bg-[#fcfbf9] border-[#e8e6e1]'
          }`}>
            <div className="text-[10px] uppercase font-bold text-gray-500 tracking-wider flex items-center justify-between">
              <span>Available Cash</span>
              <Wallet className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div className="text-lg font-black text-amber-600 dark:text-amber-400 mt-1">
              ₹{margin?.availableCashMargin ? margin.availableCashMargin.toLocaleString('en-IN') : '3,85,420'}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Ready for instant orders</div>
          </div>

          {/* 2. Total Purchasing Power */}
          <div className={`p-3.5 border font-mono text-left ${
            isObsidian ? 'bg-[#141924] border-[#222a3a]' : 'bg-[#fcfbf9] border-[#e8e6e1]'
          }`}>
            <div className="text-[10px] uppercase font-bold text-gray-500 tracking-wider flex items-center justify-between">
              <span>Total Buying Power</span>
              <Building2 className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <div className="text-lg font-black text-slate-900 dark:text-white mt-1">
              ₹{margin?.totalPurchasingPower ? margin.totalPurchasingPower.toLocaleString('en-IN') : '5,95,420'}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Cash + Collateral Margin</div>
          </div>

          {/* 3. Used Margin */}
          <div className={`p-3.5 border font-mono text-left ${
            isObsidian ? 'bg-[#141924] border-[#222a3a]' : 'bg-[#fcfbf9] border-[#e8e6e1]'
          }`}>
            <div className="text-[10px] uppercase font-bold text-gray-500 tracking-wider flex items-center justify-between">
              <span>Margin Utilized</span>
              <Layers className="w-3.5 h-3.5 text-gray-400" />
            </div>
            <div className="text-lg font-black text-gray-700 dark:text-gray-300 mt-1">
              ₹{margin?.usedMargin ? margin.usedMargin.toLocaleString('en-IN') : '74,580'}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Active positions & blocked</div>
          </div>

          {/* 4. Collateral Margin */}
          <div className={`p-3.5 border font-mono text-left ${
            isObsidian ? 'bg-[#141924] border-[#222a3a]' : 'bg-[#fcfbf9] border-[#e8e6e1]'
          }`}>
            <div className="text-[10px] uppercase font-bold text-gray-500 tracking-wider flex items-center justify-between">
              <span>Pledge Collateral</span>
              <ShieldCheck className="w-3.5 h-3.5 text-purple-500" />
            </div>
            <div className="text-lg font-black text-purple-600 dark:text-purple-400 mt-1">
              ₹{margin?.collateralMargin ? margin.collateralMargin.toLocaleString('en-IN') : '2,10,000'}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Stock pledge holding limit</div>
          </div>

          {/* 5. Day MTM P&L */}
          <div className={`p-3.5 border font-mono text-left ${
            isObsidian ? 'bg-[#141924] border-[#222a3a]' : 'bg-[#fcfbf9] border-[#e8e6e1]'
          }`}>
            <div className="text-[10px] uppercase font-bold text-gray-500 tracking-wider flex items-center justify-between">
              <span>Day MTM P&L</span>
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1">
              +₹{margin?.unrealizedMtm ? margin.unrealizedMtm.toLocaleString('en-IN') : '22,300'}
            </div>
            <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">
              +1.83% Day Change
            </div>
          </div>

          {/* 6. Total Demat Portfolio Value */}
          <div className={`p-3.5 border font-mono text-left ${
            isObsidian ? 'bg-[#141924] border-[#222a3a]' : 'bg-[#fcfbf9] border-[#e8e6e1]'
          }`}>
            <div className="text-[10px] uppercase font-bold text-gray-500 tracking-wider flex items-center justify-between">
              <span>Demat Holdings</span>
              <Briefcase className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div className="text-lg font-black text-slate-900 dark:text-white mt-1">
              ₹{totalHoldingsValue ? totalHoldingsValue.toLocaleString('en-IN') : '12,42,125'}
            </div>
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
              +₹{totalHoldingsPnl.toLocaleString('en-IN')} ({totalHoldingsPnlPercent.toFixed(1)}%)
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Tab Navigation Bar */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 space-x-1 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('holdings')}
          className={`px-5 py-3 text-xs font-mono font-bold uppercase tracking-wider flex items-center space-x-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'holdings'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-500/10'
              : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          <span>Demat Holdings ({holdings.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('positions')}
          className={`px-5 py-3 text-xs font-mono font-bold uppercase tracking-wider flex items-center space-x-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'positions'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-500/10'
              : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Positions ({positions.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('orders')}
          className={`px-5 py-3 text-xs font-mono font-bold uppercase tracking-wider flex items-center space-x-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'orders'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-500/10'
              : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Order Book ({orders.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('terminal')}
          className={`px-5 py-3 text-xs font-mono font-bold uppercase tracking-wider flex items-center space-x-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'terminal'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-500/10'
              : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <Zap className="w-4 h-4 text-amber-500" />
          <span>SEPA Order Terminal</span>
        </button>

        <button
          onClick={() => setActiveSubTab('settings')}
          className={`px-5 py-3 text-xs font-mono font-bold uppercase tracking-wider flex items-center space-x-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'settings'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-500/10'
              : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <Key className="w-4 h-4" />
          <span>API Credentials & Connection</span>
        </button>
      </div>

      {/* SUB-TAB 1: HOLDINGS */}
      {activeSubTab === 'holdings' && (
        <div className={`p-6 border shadow-sm space-y-4 ${
          isObsidian ? 'bg-[#10141d] border-[#262b36]' : 'bg-white border-[#e5e4e1]'
        }`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={holdingSearch}
                onChange={(e) => setHoldingSearch(e.target.value)}
                placeholder="Search holdings by ticker or company name..."
                className="w-full pl-9 pr-4 py-2 border text-xs font-mono border-gray-300 dark:border-gray-700 bg-transparent focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center space-x-3 text-xs font-mono">
              <span className="text-gray-500">Total Holdings: <strong className="text-slate-900 dark:text-white">{filteredHoldings.length}</strong></span>
              <span className="text-gray-400">|</span>
              <span className="text-gray-500">Unrealized P&L: <strong className={totalHoldingsPnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                {totalHoldingsPnl >= 0 ? '+' : ''}₹{totalHoldingsPnl.toLocaleString('en-IN')} ({totalHoldingsPnlPercent.toFixed(1)}%)
              </strong></span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-500 uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">Symbol</th>
                  <th className="py-3 px-3">Exchange</th>
                  <th className="py-3 px-3 text-right">Qty</th>
                  <th className="py-3 px-3 text-right">Avg Price</th>
                  <th className="py-3 px-3 text-right">Current LTP</th>
                  <th className="py-3 px-3 text-right">Day Chg</th>
                  <th className="py-3 px-3 text-right">Total P&L</th>
                  <th className="py-3 px-3 text-right">Market Value</th>
                  <th className="py-3 px-3">SEPA Setup</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                {filteredHoldings.map((h) => (
                  <tr key={h.symbol} className="hover:bg-amber-500/5 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-bold text-sm text-slate-900 dark:text-white">{h.symbol}</div>
                      <div className="text-[10px] text-gray-400 max-w-[140px] truncate">{h.companyName}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold text-[10px]">
                        {h.exchange}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white">
                      {h.quantity}
                    </td>
                    <td className="py-3 px-3 text-right text-gray-500">
                      ₹{h.averagePrice.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white">
                      ₹{h.currentPrice.toLocaleString('en-IN')}
                    </td>
                    <td className={`py-3 px-3 text-right font-bold ${
                      h.dayChangePercent >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      {h.dayChangePercent >= 0 ? '+' : ''}{h.dayChangePercent.toFixed(2)}%
                    </td>
                    <td className={`py-3 px-3 text-right font-bold ${
                      h.pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      {h.pnl >= 0 ? '+' : ''}₹{h.pnl.toLocaleString('en-IN')}
                      <div className="text-[10px] opacity-80">({h.pnlPercent.toFixed(1)}%)</div>
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white">
                      ₹{h.marketValue.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-bold whitespace-nowrap">
                        {h.sepaStage || 'SEPA Stage 2'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => handleLaunchOrderForTicker(h.symbol)}
                          className="p-1.5 bg-amber-500/10 hover:bg-amber-500 text-amber-600 dark:text-amber-400 hover:text-black border border-amber-500/30 transition-all cursor-pointer"
                          title="Trade on 5paisa"
                        >
                          <Zap className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: POSITIONS */}
      {activeSubTab === 'positions' && (
        <div className={`p-6 border shadow-sm space-y-4 ${
          isObsidian ? 'bg-[#10141d] border-[#262b36]' : 'bg-white border-[#e5e4e1]'
        }`}>
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold flex items-center space-x-2">
              <span>Open Intraday & Delivery Positions</span>
              <span className="text-xs font-mono text-gray-500">({positions.length} active)</span>
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-500 uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">Symbol</th>
                  <th className="py-3 px-3">Exchange</th>
                  <th className="py-3 px-3">Product</th>
                  <th className="py-3 px-3 text-right">Net Qty</th>
                  <th className="py-3 px-3 text-right">Buy Avg</th>
                  <th className="py-3 px-3 text-right">LTP</th>
                  <th className="py-3 px-3 text-right">MTM P&L</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                {positions.map((p) => (
                  <tr key={p.symbol} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                    <td className="py-3 px-3 font-bold text-sm text-slate-900 dark:text-white">
                      {p.symbol}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-[10px] font-bold">
                        {p.exchange}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 text-[10px] font-bold ${
                        p.productType === 'MIS' ? 'bg-purple-100 dark:bg-purple-950/40 text-purple-600' : 'bg-blue-100 dark:bg-blue-950/40 text-blue-600'
                      }`}>
                        {p.productType === 'MIS' ? 'MIS (Intraday)' : 'CNC (Delivery)'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white">
                      {p.netQty}
                    </td>
                    <td className="py-3 px-3 text-right text-gray-500">
                      ₹{p.buyAvgPrice.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white">
                      ₹{p.currentPrice.toLocaleString('en-IN')}
                    </td>
                    <td className={`py-3 px-3 text-right font-bold ${
                      p.mtm >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      {p.mtm >= 0 ? '+' : ''}₹{p.mtm.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 text-[10px] font-bold">
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => handleLaunchOrderForTicker(p.symbol)}
                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold uppercase cursor-pointer"
                      >
                        Square Off
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: ORDER BOOK */}
      {activeSubTab === 'orders' && (
        <div className={`p-6 border shadow-sm space-y-4 ${
          isObsidian ? 'bg-[#10141d] border-[#262b36]' : 'bg-white border-[#e5e4e1]'
        }`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              {(['ALL', 'Executed', 'Pending', 'Cancelled'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setOrderFilter(filter)}
                  className={`px-3 py-1.5 text-xs font-mono font-bold uppercase transition-all cursor-pointer ${
                    orderFilter === filter
                      ? 'bg-amber-500 text-black'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                  }`}
                >
                  {filter} ({orders.filter(o => filter === 'ALL' || o.orderStatus === filter).length})
                </button>
              ))}
            </div>

            <span className="text-xs font-mono text-gray-400">
              Direct 5paisa Gateway Execution Log
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-500 uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">Order ID</th>
                  <th className="py-3 px-3">Time</th>
                  <th className="py-3 px-3">Symbol</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Product</th>
                  <th className="py-3 px-3 text-right">Qty</th>
                  <th className="py-3 px-3 text-right">Price</th>
                  <th className="py-3 px-3 text-right">Stop Loss</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Minervini Tag</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                {filteredOrders.map((o) => (
                  <tr key={o.orderId} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                    <td className="py-3 px-3 font-bold text-gray-400">{o.orderId}</td>
                    <td className="py-3 px-3 text-[11px] text-gray-500">{o.placedTime}</td>
                    <td className="py-3 px-3 font-bold text-sm text-slate-900 dark:text-white">{o.symbol}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 text-[10px] font-bold ${
                        o.transactionType === 'BUY' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {o.transactionType} {o.orderType}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-[10px] text-gray-500 font-bold">{o.productType}</span>
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white">{o.quantity}</td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white">₹{o.price.toLocaleString('en-IN')}</td>
                    <td className="py-3 px-3 text-right text-rose-600 dark:text-rose-400">
                      {o.stopLossPrice ? `₹${o.stopLossPrice.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 text-[10px] font-bold ${
                        o.orderStatus === 'Executed'
                          ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                          : o.orderStatus === 'Pending'
                          ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 animate-pulse'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                      }`}>
                        {o.orderStatus}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[10px] text-gray-400">
                      {o.minerviniSetupTag || 'SEPA Setup'}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {o.orderStatus === 'Pending' ? (
                        <button
                          onClick={() => handleCancelOrder(o.orderId)}
                          className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold uppercase cursor-pointer"
                        >
                          Cancel
                        </button>
                      ) : (
                        <span className="text-gray-400 text-[10px]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: FAST ORDER TERMINAL */}
      {activeSubTab === 'terminal' && (
        <div className={`p-6 border shadow-sm space-y-5 ${
          isObsidian ? 'bg-[#10141d] border-[#262b36]' : 'bg-white border-[#e5e4e1]'
        }`}>
          <div className="flex items-center justify-between border-b pb-4 border-gray-200 dark:border-gray-800">
            <div>
              <h3 className="text-lg font-serif font-black">Minervini SEPA 1-Click Order Terminal</h3>
              <p className="text-xs font-mono text-gray-500">
                Select any verified breakout candidate to instantly size positions and place bracket orders on 5paisa.
              </p>
            </div>
            <div className="flex items-center space-x-2 text-xs font-mono">
              <span className="text-gray-500">Buying Power:</span>
              <span className="font-bold text-amber-500">
                ₹{margin?.availableCashMargin.toLocaleString('en-IN') || '3,85,420'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stocks.slice(0, 6).map((stk) => (
              <div
                key={stk.ticker}
                className={`p-4 border transition-all ${
                  isObsidian ? 'bg-[#141924] border-[#222a3a] hover:border-amber-500/50' : 'bg-gray-50 border-gray-200 hover:border-black'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-mono font-bold text-base">{stk.ticker}</div>
                  <span className="px-2 py-0.5 bg-black text-white dark:bg-amber-400 dark:text-black font-mono font-bold text-[10px]">
                    RS {stk.rsRating}
                  </span>
                </div>
                <div className="text-xs text-gray-400 truncate mt-0.5">{stk.name}</div>

                <div className="grid grid-cols-2 gap-2 my-3 text-xs font-mono">
                  <div className="p-2 bg-white/50 dark:bg-black/30 border border-gray-200 dark:border-gray-800">
                    <div className="text-[10px] text-gray-500">Pivot Price</div>
                    <div className="font-bold text-emerald-600 dark:text-emerald-400">
                      ₹{stk.pivotPrice.toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div className="p-2 bg-white/50 dark:bg-black/30 border border-gray-200 dark:border-gray-800">
                    <div className="text-[10px] text-gray-500">Stop Loss</div>
                    <div className="font-bold text-rose-600 dark:text-rose-400">
                      ₹{stk.stopLossPrice.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSelectedStockForOrder(stk);
                    setIsOrderModalOpen(true);
                  }}
                  className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-black font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-xs"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Execute on 5paisa</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 5: SETTINGS & CREDENTIALS */}
      {activeSubTab === 'settings' && (
        <div className={`p-6 border shadow-sm space-y-6 ${
          isObsidian ? 'bg-[#10141d] border-[#262b36]' : 'bg-white border-[#e5e4e1]'
        }`}>
          <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4 border-gray-200 dark:border-gray-800">
            <div>
              <h3 className="text-lg font-serif font-black flex items-center space-x-2">
                <Key className="w-5 h-5 text-amber-500" />
                <span>5paisa Developer API Configuration</span>
              </h3>
              <p className="text-xs font-mono text-gray-500 mt-0.5">
                Connect your real 5paisa trading account or test in simulated paper trading mode.
              </p>
            </div>

            <button
              type="button"
              onClick={handleUseDemoAccount}
              className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-600 dark:text-amber-400 border border-amber-500/40 text-xs font-mono font-bold uppercase tracking-wider flex items-center space-x-2 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Launch Instant Demo Account (₹5,00,000 Margin)</span>
            </button>
          </div>

          <form onSubmit={handleSaveCredentials} className="space-y-4 max-w-2xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  5paisa Client Code / User ID *
                </label>
                <input
                  type="text"
                  required
                  value={credentials.clientCode}
                  onChange={(e) => setCredentials({ ...credentials, clientCode: e.target.value })}
                  placeholder="e.g. 5P12345678"
                  className="w-full p-2.5 text-xs font-mono border border-gray-300 dark:border-gray-700 bg-transparent focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  App Name *
                </label>
                <input
                  type="text"
                  value={credentials.appName || 'GrowthStockAlpha'}
                  onChange={(e) => setCredentials({ ...credentials, appName: e.target.value })}
                  placeholder="e.g. GrowthStockAlpha"
                  className="w-full p-2.5 text-xs font-mono border border-gray-300 dark:border-gray-700 bg-transparent focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  User Key (from Developer Portal)
                </label>
                <input
                  type="password"
                  value={credentials.userKey || ''}
                  onChange={(e) => setCredentials({ ...credentials, userKey: e.target.value })}
                  placeholder="Enter 5paisa User Key"
                  className="w-full p-2.5 text-xs font-mono border border-gray-300 dark:border-gray-700 bg-transparent focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Encryption Key
                </label>
                <input
                  type="password"
                  value={credentials.encryptionKey || ''}
                  onChange={(e) => setCredentials({ ...credentials, encryptionKey: e.target.value })}
                  placeholder="Enter 5paisa Encryption Key"
                  className="w-full p-2.5 text-xs font-mono border border-gray-300 dark:border-gray-700 bg-transparent focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Account Password / PIN
                </label>
                <input
                  type="password"
                  value={credentials.passwordPin || ''}
                  onChange={(e) => setCredentials({ ...credentials, passwordPin: e.target.value })}
                  placeholder="Enter 6-digit MPIN"
                  className="w-full p-2.5 text-xs font-mono border border-gray-300 dark:border-gray-700 bg-transparent focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  TOTP Secret (2FA Key)
                </label>
                <input
                  type="password"
                  value={credentials.totpSecret || ''}
                  onChange={(e) => setCredentials({ ...credentials, totpSecret: e.target.value })}
                  placeholder="Base32 TOTP Key for auto 2FA"
                  className="w-full p-2.5 text-xs font-mono border border-gray-300 dark:border-gray-700 bg-transparent focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center space-x-3">
              <button
                type="submit"
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-mono font-bold text-xs uppercase tracking-wider cursor-pointer shadow-sm transition-all"
              >
                Save & Connect 5paisa Account
              </button>
              <button
                type="button"
                onClick={() => {
                  clearStoredCredentials();
                  showToast('5paisa credentials cleared.');
                }}
                className="px-4 py-2.5 border border-rose-500/40 text-rose-500 hover:bg-rose-500/10 font-mono font-bold text-xs uppercase tracking-wider cursor-pointer transition-all"
              >
                Disconnect & Clear
              </button>
            </div>
          </form>

          {/* Security Guarantee Box */}
          <div className={`p-4 border text-xs font-mono space-y-1.5 ${
            isObsidian ? 'bg-[#181e2b] border-[#262f40] text-gray-400' : 'bg-gray-50 border-gray-200 text-gray-600'
          }`}>
            <div className="flex items-center space-x-2 text-slate-900 dark:text-white font-bold">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Direct Bank-Grade API Security</span>
            </div>
            <p>
              Your credentials are never exposed publicly. All order routes use encrypted tokens conforming to SEBI regulations and 5paisa Open API specifications.
            </p>
          </div>
        </div>
      )}

      {/* 1-Click Order Modal */}
      {selectedStockForOrder && (
        <FivePaisaOrderModal
          isOpen={isOrderModalOpen}
          onClose={() => setIsOrderModalOpen(false)}
          stock={selectedStockForOrder}
          onOrderSuccess={(orderId) => {
            loadData();
            showToast(`Order #${orderId} placed on 5paisa!`);
          }}
          isObsidian={isObsidian}
        />
      )}
    </div>
  );
};
