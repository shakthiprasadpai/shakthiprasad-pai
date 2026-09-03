import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TrendingUp, BarChart3, Calculator, BookOpen, SlidersHorizontal, Briefcase, Calendar, Video, Gem, Moon, Sun, Zap, Target, BookMarked, Layers, BellRing, Download, Sparkles, Bot, Cpu, Bookmark, ShieldCheck, CheckSquare, Award, Monitor, FileSpreadsheet, Radio, Menu, X, Compass } from 'lucide-react';
import { DesktopRemixGuideModal } from './DesktopRemixGuideModal';
import { MobileNavDrawer } from './MobileNavDrawer';

export type AppNavTab = 
  | 'daily_review'
  | 'hermes_agent'
  | 'screener' 
  | 'watchlist'
  | 'chart' 
  | 'rrg_chart'
  | 'calculator' 
  | 'bhavcopy'
  | 'custom' 
  | 'playbook' 
  | 'portfolio' 
  | 'earnings' 
  | 'masterclass' 
  | 'obsidian' 
  | 'pocket_pivot' 
  | 'vcp_scanner' 
  | 'journal'
  | 'sector_heatmap'
  | 'alert_history'
  | 'tradingview_webhook'
  | 'pattern_library'
  | 'export_data'
  | 'security_shield';

export const TAB_LABELS: Record<AppNavTab, string> = {
  daily_review: 'Daily Review',
  hermes_agent: 'Hermes AI',
  screener: 'Screener',
  watchlist: 'Watchlist',
  chart: 'VCP Charts',
  rrg_chart: 'RRG Tool',
  calculator: 'Trade Plan',
  bhavcopy: 'Bhavcopy',
  custom: 'Scanner',
  playbook: 'Playbook',
  portfolio: 'Portfolio',
  earnings: 'Earnings',
  masterclass: 'Masterclass',
  obsidian: 'Obsidian AI',
  pocket_pivot: 'Pocket Pivots',
  vcp_scanner: 'VCP Scanner',
  journal: 'Trade Journal',
  sector_heatmap: 'Sector Heatmap',
  alert_history: 'Alert History',
  tradingview_webhook: 'Webhooks',
  pattern_library: 'Pattern Library',
  export_data: 'Export Data',
  security_shield: 'Security Shield',
};

interface NavbarProps {
  activeTab: AppNavTab;
  setActiveTab: (tab: AppNavTab) => void;
  selectedStockTicker: string;
  totalSetupsCount: number;
  tightVolumeCount: number;
  isObsidian?: boolean;
  onToggleObsidian?: () => void;
  onOpenDailyScanner?: () => void;
  isMobileDrawerOpen?: boolean;
  setIsMobileDrawerOpen?: (open: boolean) => void;
}


export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  selectedStockTicker,
  totalSetupsCount,
  tightVolumeCount,
  isObsidian = false,
  onToggleObsidian,
  onOpenDailyScanner,
  isMobileDrawerOpen,
  setIsMobileDrawerOpen,
}) => {
  const [showDesktopModal, setShowDesktopModal] = useState<boolean>(false);
  const [internalDrawerOpen, setInternalDrawerOpen] = useState<boolean>(false);

  const isDrawerOpen = isMobileDrawerOpen !== undefined ? isMobileDrawerOpen : internalDrawerOpen;
  const setIsDrawerOpen = setIsMobileDrawerOpen || setInternalDrawerOpen;
  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-[#e5e4e1] text-[#1a1a1a] sticky top-0 z-40 shadow-xs transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Brand Logo & Editorial Title */}
          <div className="flex items-center space-x-3 cursor-pointer group" onClick={() => setActiveTab('screener')}>
            <div className={`w-10 h-10 flex items-center justify-center font-serif italic font-bold text-xl shadow-sm transition-transform group-hover:scale-105 ${
              isObsidian ? 'bg-amber-500 text-black' : 'bg-[#1a1a1a] text-white'
            }`}>
              α
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className={`text-[10px] tracking-[0.25em] uppercase font-bold ${
                  isObsidian ? 'text-amber-400' : 'text-[#b5a68d]'
                }`}>
                  Technical Intelligence
                </span>
                <span className={`text-[9px] uppercase tracking-[0.2em] px-2 py-0.5 font-semibold ${
                  isObsidian ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-[#1a1a1a] text-white'
                }`}>
                  Minervini SEPA
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-serif italic font-black tracking-tight leading-none mt-0.5">
                Growth Stock Alpha
              </h1>
            </div>
          </div>

          {/* Quick Metrics Badges & OBSIDIAN Toggle Button */}
          <div className="hidden lg:flex items-center space-x-4 text-[11px] font-mono">
            <div className="bg-[#f9f8f5] border border-[#e5e4e1] px-3.5 py-1.5 flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
              <span className="text-gray-500 uppercase tracking-wider text-[10px] font-sans">Qualified Setups:</span>
              <span className="font-bold text-[#1a1a1a]">{totalSetupsCount} Stocks</span>
            </div>
            <div className="bg-[#f9f8f5] border border-[#e5e4e1] px-3.5 py-1.5 flex items-center space-x-2">
              <span className="text-emerald-700 font-bold">💧 Dry-Up Volume:</span>
              <span className="font-bold text-[#1a1a1a]">{tightVolumeCount} Setups</span>
            </div>

            {/* Connect & Remix Desktop Modal Button */}
            <motion.button
              id="desktop-remix-btn"
              onClick={() => setShowDesktopModal(true)}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className={`px-3 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider font-mono flex items-center space-x-1.5 border shadow-sm cursor-pointer ${
                isObsidian
                   ? 'bg-slate-900 hover:bg-slate-800 text-amber-300 border-amber-500/40'
                  : 'bg-white hover:bg-gray-100 text-gray-800 border-[#d5d4d0]'
              }`}
              title="Connect & Remix Minervini SEPA Scanner on Desktop"
            >
              <Monitor className="w-3.5 h-3.5 text-amber-500" />
              <span>Connect Desktop / Remix</span>
            </motion.button>

            {/* Daily Stage 2 Scanner Button */}
            {onOpenDailyScanner && (
              <motion.button
                id="daily-stage-2-scan-btn"
                onClick={onOpenDailyScanner}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                className="px-3 py-1.5 rounded text-[11px] font-black uppercase tracking-wider font-mono flex items-center space-x-1.5 bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 shadow-md border border-amber-300 hover:brightness-105 cursor-pointer"
                title="Open Scheduled Daily Stage 2 Breakout Scanner (Cmd+K / Ctrl+K)"
              >
                <Sparkles className="w-3.5 h-3.5 fill-current animate-pulse" />
                <span>Daily Stage 2 Scan</span>
                <span className="hidden xl:inline-block bg-black/20 text-slate-950 px-1 py-0.2 rounded text-[9px] font-mono font-extrabold border border-black/20 ml-0.5">
                  ⌘K
                </span>
              </motion.button>
            )}

            {/* OBSIDIAN Theme Toggle Button */}
            {onToggleObsidian && (
              <motion.button
                id="obsidian-theme-toggle-btn"
                onClick={onToggleObsidian}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className={`relative px-3.5 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider font-mono transition-colors duration-300 flex items-center space-x-2 border shadow-sm cursor-pointer overflow-hidden ${
                  isObsidian
                    ? 'bg-amber-500 text-slate-950 border-amber-400 hover:bg-amber-400'
                    : 'bg-slate-900 text-amber-300 border-slate-800 hover:bg-slate-800'
                }`}
                title="Toggle Obsidian Dark Mode"
              >
                {/* Subtle animated background shine */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-amber-400/20 via-transparent to-amber-400/20 pointer-events-none"
                  initial={false}
                  animate={{
                    x: isObsidian ? ['-100%', '100%'] : ['100%', '-100%']
                  }}
                  transition={{ repeat: Infinity, duration: 4, ease: 'linear' }}
                />

                {/* Animated Gem Icon */}
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={isObsidian ? 'obsidian-on' : 'obsidian-off'}
                    initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
                    animate={{ rotate: 0, opacity: 1, scale: 1 }}
                    exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
                    transition={{ duration: 0.22, ease: 'easeInOut' }}
                    className="flex items-center justify-center relative z-10"
                  >
                    <Gem className={`w-3.5 h-3.5 ${isObsidian ? 'text-slate-950 fill-current' : 'text-amber-400'}`} />
                  </motion.div>
                </AnimatePresence>

                {/* Animated Text Label */}
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={isObsidian ? 'text-on' : 'text-off'}
                    initial={{ y: 6, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -6, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="relative z-10"
                  >
                    {isObsidian ? 'OBSIDIAN DARK ON' : 'OBSIDIAN MODE'}
                  </motion.span>
                </AnimatePresence>

                {/* Premium Switch Track & Sliding Thumb */}
                <div className="relative z-10 ml-1 w-6 h-3 bg-black/40 rounded-full p-0.5 flex items-center border border-white/20">
                  <motion.div
                    className={`w-2 h-2 rounded-full ${isObsidian ? 'bg-slate-950' : 'bg-amber-400'}`}
                    animate={{
                      x: isObsidian ? 12 : 0
                    }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                </div>
              </motion.button>
            )}
          </div>

          {/* Mobile Action Controls Header Bar (< md) */}
          <div className="flex md:hidden items-center space-x-2">
            {/* Active Tab Pill Indicator */}
            <div className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold tracking-tight uppercase border flex items-center space-x-1.5 ${
              isObsidian
                ? 'bg-[#161b22] border-[#30363d] text-amber-300'
                : 'bg-gray-100 border-gray-300 text-gray-800'
            }`}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="truncate max-w-[80px]">{TAB_LABELS[activeTab] || activeTab}</span>
            </div>

            {/* Quick Export 1-Tap Trigger */}
            <button
              id="mobile-header-quick-export"
              type="button"
              onClick={() => setActiveTab('export_data')}
              className={`p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                activeTab === 'export_data'
                  ? 'bg-emerald-500 text-white border-emerald-400'
                  : isObsidian
                  ? 'bg-[#161b22] border-emerald-500/40 text-emerald-400 hover:bg-[#1f2633]'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'
              }`}
              title="Quick Export Trade Data"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* Mobile Theme Toggle */}
            {onToggleObsidian && (
              <button
                id="mobile-header-theme-toggle"
                type="button"
                onClick={onToggleObsidian}
                className={`p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                  isObsidian
                    ? 'bg-[#161b22] border-amber-500/40 text-amber-400 hover:bg-[#1f2633]'
                    : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                }`}
                title="Toggle Dark / Light Theme"
              >
                {isObsidian ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            )}

            {/* Hamburger Drawer Toggle */}
            <button
              id="mobile-header-menu-toggle"
              type="button"
              onClick={() => setIsDrawerOpen(!isDrawerOpen)}
              className={`p-2 rounded-lg border text-xs cursor-pointer transition-all relative ${
                isDrawerOpen
                  ? 'bg-amber-500 text-slate-950 border-amber-400'
                  : isObsidian
                  ? 'bg-[#161b22] border-[#30363d] text-gray-200 hover:text-white'
                  : 'bg-gray-100 border-gray-300 text-gray-800 hover:text-black'
              }`}
              title="Open Menu & All 22 Tools"
            >
              {isDrawerOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400" />
            </button>
          </div>

          {/* Editorial Style Navigation Tabs (Desktop & Tablets >= md) */}
          <nav className="hidden md:flex items-center space-x-1 sm:space-x-4 lg:space-x-5 text-[11px] uppercase tracking-widest font-semibold overflow-x-auto no-scrollbar py-1">
            <button
              id="nav-tab-daily-review"
              onClick={() => setActiveTab('daily_review')}
              className={`flex items-center space-x-1.5 py-2 px-2.5 rounded transition-all border-b-2 font-bold cursor-pointer ${
                activeTab === 'daily_review'
                  ? 'bg-amber-500/10 border-amber-500 text-amber-500 shadow-xs'
                  : 'border-transparent text-amber-600/90 hover:text-amber-500 hover:bg-amber-500/5'
              }`}
            >
              <Award className="w-4 h-4 text-amber-500" />
              <span className="font-mono tracking-wider font-extrabold flex items-center gap-1">
                DAILY REVIEW
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              </span>
            </button>

            <button
              id="nav-tab-hermes-agent"
              onClick={() => setActiveTab('hermes_agent')}
              className={`flex items-center space-x-1.5 py-2 px-2.5 rounded transition-all border-b-2 font-bold cursor-pointer ${
                activeTab === 'hermes_agent'
                  ? 'bg-amber-500/10 border-amber-500 text-amber-500 shadow-xs'
                  : 'border-transparent text-amber-600/90 hover:text-amber-500 hover:bg-amber-500/5'
              }`}
            >
              <Bot className="w-4 h-4 text-amber-500 animate-pulse" />
              <span className="font-mono tracking-wider font-extrabold flex items-center gap-1">
                HERMES AGENT
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              </span>
            </button>

            <button
              id="nav-tab-screener"
              onClick={() => setActiveTab('screener')}
              className={`flex items-center space-x-1.5 py-2 transition-all border-b-2 ${
                activeTab === 'screener'
                  ? 'border-[#1a1a1a] text-[#1a1a1a] font-bold'
                  : 'border-transparent text-gray-500 hover:text-black hover:border-gray-300'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Minervini Strategy</span>
            </button>

            <button
              id="nav-tab-watchlist"
              onClick={() => setActiveTab('watchlist')}
              className={`flex items-center space-x-1.5 py-2 transition-all border-b-2 ${
                activeTab === 'watchlist'
                  ? 'border-[#1a1a1a] text-[#1a1a1a] font-bold'
                  : 'border-transparent text-gray-500 hover:text-black hover:border-gray-300'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5 text-amber-500" />
              <span>Watchlist</span>
            </button>

            <button
              id="nav-tab-chart"
              onClick={() => setActiveTab('chart')}
              className={`flex items-center space-x-1.5 py-2 transition-all border-b-2 ${
                activeTab === 'chart'
                  ? 'border-[#1a1a1a] text-[#1a1a1a] font-bold'
                  : 'border-transparent text-gray-500 hover:text-black hover:border-gray-300'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>VCP Scans ({selectedStockTicker})</span>
            </button>

            <button
              id="nav-tab-rrg-chart"
              onClick={() => setActiveTab('rrg_chart')}
              className={`flex items-center space-x-1.5 py-2 px-2.5 rounded transition-all border-b-2 font-bold cursor-pointer ${
                activeTab === 'rrg_chart'
                  ? 'bg-amber-500/10 border-amber-500 text-amber-500 shadow-xs'
                  : 'border-transparent text-gray-500 hover:text-amber-500 hover:border-amber-300'
              }`}
            >
              <Compass className="w-3.5 h-3.5 text-amber-500 animate-spin-slow" />
              <span className="flex items-center space-x-1">
                <span>RRG Tool</span>
                <span className="px-1 py-0.2 bg-emerald-500/20 text-emerald-400 text-[8px] font-mono rounded font-black">
                  NEW
                </span>
              </span>
            </button>

            <button
              id="nav-tab-calculator"
              onClick={() => setActiveTab('calculator')}
              className={`flex items-center space-x-1.5 py-2 transition-all border-b-2 ${
                activeTab === 'calculator'
                  ? 'border-[#1a1a1a] text-[#1a1a1a] font-bold'
                  : 'border-transparent text-gray-500 hover:text-black hover:border-gray-300'
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Trade Plan</span>
            </button>

            <button
              id="nav-tab-bhavcopy"
              onClick={() => setActiveTab('bhavcopy')}
              className={`flex items-center space-x-1.5 py-2 transition-all border-b-2 font-bold cursor-pointer ${
                activeTab === 'bhavcopy'
                  ? 'border-amber-500 text-amber-500'
                  : 'border-transparent text-gray-500 hover:text-amber-500 hover:border-amber-300'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-amber-500" />
              <span className="flex items-center space-x-1">
                <span>NSE/BSE Bhavcopy</span>
                <span className="px-1 py-0.2 bg-amber-500/20 text-amber-500 text-[8px] font-mono rounded font-black">
                  DAILY
                </span>
              </span>
            </button>

            <button
              id="nav-tab-portfolio"
              onClick={() => setActiveTab('portfolio')}
              className={`flex items-center space-x-1.5 py-2 transition-all border-b-2 ${
                activeTab === 'portfolio'
                  ? 'border-[#1a1a1a] text-[#1a1a1a] font-bold'
                  : 'border-transparent text-gray-500 hover:text-black hover:border-gray-300'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>My Portfolio</span>
            </button>

            <button
              id="nav-tab-earnings"
              onClick={() => setActiveTab('earnings')}
              className={`flex items-center space-x-1.5 py-2 transition-all border-b-2 ${
                activeTab === 'earnings'
                  ? 'border-[#1a1a1a] text-[#1a1a1a] font-bold'
                  : 'border-transparent text-gray-500 hover:text-black hover:border-gray-300'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-amber-600" />
              <span>Earnings Calendar</span>
            </button>

            <button
              id="nav-tab-custom"
              onClick={() => setActiveTab('custom')}
              className={`flex items-center space-x-1.5 py-2 transition-all border-b-2 ${
                activeTab === 'custom'
                  ? 'border-[#1a1a1a] text-[#1a1a1a] font-bold'
                  : 'border-transparent text-gray-500 hover:text-black hover:border-gray-300'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Scanner</span>
            </button>

            <button
              id="nav-tab-playbook"
              onClick={() => setActiveTab('playbook')}
              className={`flex items-center space-x-1.5 py-2 transition-all border-b-2 ${
                activeTab === 'playbook'
                  ? 'border-[#1a1a1a] text-[#1a1a1a] font-bold'
                  : 'border-transparent text-gray-500 hover:text-black hover:border-gray-300'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Playbook</span>
            </button>

            <button
              id="nav-tab-masterclass"
              onClick={() => setActiveTab('masterclass')}
              className={`flex items-center space-x-1.5 py-2 transition-all border-b-2 ${
                activeTab === 'masterclass'
                  ? 'border-[#1a1a1a] text-[#1a1a1a] font-bold'
                  : 'border-transparent text-gray-500 hover:text-black hover:border-gray-300'
              }`}
            >
              <Video className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">3C Masterclass</span>
            </button>

            <button
              id="nav-tab-obsidian"
              onClick={() => setActiveTab('obsidian')}
              className={`flex items-center space-x-1.5 py-2 transition-all border-b-2 ${
                activeTab === 'obsidian'
                  ? 'border-amber-400 text-amber-500 font-bold'
                  : 'border-transparent text-gray-500 hover:text-amber-500 hover:border-amber-300'
              }`}
            >
              <Gem className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden sm:inline font-bold">Obsidian &amp; Gemini</span>
            </button>

            <button
              id="nav-tab-pocket-pivot"
              onClick={() => setActiveTab('pocket_pivot')}
              className={`flex items-center space-x-1.5 py-2 transition-all border-b-2 ${
                activeTab === 'pocket_pivot'
                  ? 'border-amber-400 text-amber-400 font-bold'
                  : 'border-transparent text-gray-500 hover:text-amber-400 hover:border-amber-300'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline font-bold">Pocket Pivots</span>
            </button>

            <button
              id="nav-tab-vcp-scanner"
              onClick={() => setActiveTab('vcp_scanner')}
              className={`flex items-center space-x-1.5 py-2 transition-all border-b-2 ${
                activeTab === 'vcp_scanner'
                  ? 'border-amber-400 text-amber-400 font-bold'
                  : 'border-transparent text-gray-500 hover:text-amber-400 hover:border-amber-300'
              }`}
            >
              <Target className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline font-bold">VCP Scanner</span>
            </button>

            <button
              id="nav-tab-journal"
              onClick={() => setActiveTab('journal')}
              className={`flex items-center space-x-1.5 py-2 transition-all border-b-2 ${
                activeTab === 'journal'
                  ? 'border-[#1a1a1a] text-[#1a1a1a] font-bold'
                  : 'border-transparent text-gray-500 hover:text-black hover:border-gray-300'
              }`}
            >
              <BookMarked className="w-3.5 h-3.5 text-emerald-600" />
              <span className="font-bold">Trade Journal</span>
            </button>

            <button
              id="nav-tab-sector-heatmap"
              onClick={() => setActiveTab('sector_heatmap')}
              className={`flex items-center space-x-1.5 py-2 transition-all border-b-2 ${
                activeTab === 'sector_heatmap'
                  ? 'border-purple-500 text-purple-400 font-bold'
                  : 'border-transparent text-gray-500 hover:text-purple-400 hover:border-purple-300'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              <span className="font-bold">Sector Heat Map</span>
            </button>

            <button
              id="nav-tab-alert-history"
              onClick={() => setActiveTab('alert_history')}
              className={`flex items-center space-x-1.5 py-2 transition-all border-b-2 ${
                activeTab === 'alert_history'
                  ? 'border-amber-400 text-amber-400 font-bold'
                  : 'border-transparent text-gray-500 hover:text-amber-400 hover:border-amber-300'
              }`}
            >
              <BellRing className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-bold">Price Alert History</span>
            </button>

            <button
              id="nav-tab-tradingview-webhook"
              onClick={() => setActiveTab('tradingview_webhook')}
              className={`flex items-center space-x-1.5 py-2 transition-all border-b-2 ${
                activeTab === 'tradingview_webhook'
                  ? 'border-emerald-500 text-emerald-500 font-bold'
                  : 'border-transparent text-gray-500 hover:text-emerald-500 hover:border-emerald-300'
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
              <span className="font-bold">TradingView Webhook</span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 tracking-wider">
                LIVE
              </span>
            </button>

            <button
              id="nav-tab-pattern-library"
              onClick={() => setActiveTab('pattern_library')}
              className={`flex items-center space-x-1.5 py-2 transition-all border-b-2 ${
                activeTab === 'pattern_library'
                  ? 'border-amber-400 text-amber-400 font-bold'
                  : 'border-transparent text-gray-500 hover:text-amber-400 hover:border-amber-300'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-bold">Pattern Visuals Library</span>
            </button>

            <button
              id="nav-tab-export-data"
              onClick={() => setActiveTab('export_data')}
              className={`flex items-center space-x-1.5 py-2 transition-all border-b-2 ${
                activeTab === 'export_data'
                  ? 'border-emerald-500 text-emerald-400 font-bold'
                  : 'border-transparent text-gray-500 hover:text-emerald-400 hover:border-emerald-300'
              }`}
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-bold">Export Trade Data</span>
            </button>

            <button
              id="nav-tab-security-shield"
              onClick={() => setActiveTab('security_shield')}
              className={`flex items-center space-x-1.5 py-2 transition-all border-b-2 ${
                activeTab === 'security_shield'
                  ? 'border-emerald-500 text-emerald-400 font-bold'
                  : 'border-transparent text-emerald-600/80 hover:text-emerald-400 hover:border-emerald-500/50'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span className="font-bold">Security & Antiphishing</span>
            </button>
          </nav>

        </div>
      </div>

      {/* Connect Desktop & Remix Modal */}
      <DesktopRemixGuideModal
        isOpen={showDesktopModal}
        onClose={() => setShowDesktopModal(false)}
        stocksCount={totalSetupsCount}
      />

      {/* Mobile Slide-Over Navigation Drawer */}
      <MobileNavDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        totalSetupsCount={totalSetupsCount}
        tightVolumeCount={tightVolumeCount}
        isObsidian={isObsidian}
        onToggleObsidian={onToggleObsidian}
        onOpenDailyScanner={onOpenDailyScanner}
        onOpenDesktopModal={() => setShowDesktopModal(true)}
      />
    </header>
  );
};

