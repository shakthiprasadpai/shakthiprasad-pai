import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Search,
  Award,
  Bot,
  BarChart3,
  Bookmark,
  TrendingUp,
  Calculator,
  FileSpreadsheet,
  Briefcase,
  Calendar,
  SlidersHorizontal,
  BookOpen,
  Video,
  Gem,
  Zap,
  Target,
  BookMarked,
  Layers,
  BellRing,
  Radio,
  Download,
  ShieldCheck,
  Sparkles,
  ChevronRight,
  Sun,
  Moon,
  Monitor
} from 'lucide-react';
import { AppNavTab } from './Navbar';

interface NavItemDef {
  id: AppNavTab;
  title: string;
  subtitle: string;
  category: 'strategy' | 'market' | 'execution' | 'tools';
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeColor?: string;
}

const NAV_ITEMS: NavItemDef[] = [
  // Category: Strategy & AI
  {
    id: 'daily_review',
    title: 'Daily Review',
    subtitle: 'End-of-day market evaluation & setup rankings',
    category: 'strategy',
    icon: Award,
    badge: 'DAILY',
    badgeColor: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  },
  {
    id: 'hermes_agent',
    title: 'Hermes AI Co-Pilot',
    subtitle: 'Minervini conversational agent & smart analysis',
    category: 'strategy',
    icon: Bot,
    badge: 'AI LIVE',
    badgeColor: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  },
  {
    id: 'screener',
    title: 'Minervini Screener',
    subtitle: 'SEPA 8-point trend template & pivot breakouts',
    category: 'strategy',
    icon: BarChart3,
  },
  {
    id: 'watchlist',
    title: 'Watchlist Manager',
    subtitle: 'Curated high-conviction candidate tracking',
    category: 'strategy',
    icon: Bookmark,
  },
  {
    id: 'chart',
    title: 'VCP Scans & Charts',
    subtitle: 'Interactive contraction overlays & price history',
    category: 'strategy',
    icon: TrendingUp,
  },

  // Category: Market Intelligence
  {
    id: 'bhavcopy',
    title: 'NSE / BSE Bhavcopy',
    subtitle: 'Official daily settlement & delivery volume',
    category: 'market',
    icon: FileSpreadsheet,
    badge: 'DAILY DATA',
    badgeColor: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  },
  {
    id: 'pocket_pivot',
    title: 'Pocket Pivot Scanner',
    subtitle: 'Early institutional accumulation volume signatures',
    category: 'market',
    icon: Zap,
  },
  {
    id: 'vcp_scanner',
    title: 'VCP Pattern Scanner',
    subtitle: 'Contraction stage detection & dry-up alerts',
    category: 'market',
    icon: Target,
  },
  {
    id: 'sector_heatmap',
    title: 'Sector Heat Map',
    subtitle: 'Leading industry groups & relative rotation',
    category: 'market',
    icon: Layers,
  },
  {
    id: 'earnings',
    title: 'Earnings Calendar',
    subtitle: 'Upcoming quarterly earnings & catalyst dates',
    category: 'market',
    icon: Calendar,
  },

  // Category: Trading Execution
  {
    id: 'calculator',
    title: 'Trade Plan Calculator',
    subtitle: 'Position sizing, stop loss, and R-multiples',
    category: 'execution',
    icon: Calculator,
  },
  {
    id: 'portfolio',
    title: 'My Portfolio',
    subtitle: 'Active holdings, cost basis, and unrealized P&L',
    category: 'execution',
    icon: Briefcase,
  },
  {
    id: 'journal',
    title: 'Trade Journal',
    subtitle: 'Post-trade reflection & discipline grading',
    category: 'execution',
    icon: BookMarked,
  },
  {
    id: 'alert_history',
    title: 'Price Alert History',
    subtitle: 'Audited trigger log and proximity monitoring',
    category: 'execution',
    icon: BellRing,
  },
  {
    id: 'tradingview_webhook',
    title: 'TradingView Webhooks',
    subtitle: 'Real-time alert receiver & automated triggers',
    category: 'execution',
    icon: Radio,
    badge: 'WEBHOOK',
    badgeColor: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  },

  // Category: Data Export & Tools
  {
    id: 'export_data',
    title: 'Export Trade Data Hub',
    subtitle: 'CSV, PDF reports, JSON, TradingView & Obsidian',
    category: 'tools',
    icon: Download,
    badge: 'DATA HUB',
    badgeColor: 'bg-emerald-500/25 text-emerald-300 border border-emerald-400',
  },
  {
    id: 'pattern_library',
    title: 'Pattern Visuals Library',
    subtitle: 'Visual encyclopedia of classic Minervini setups',
    category: 'tools',
    icon: BookOpen,
  },
  {
    id: 'obsidian',
    title: 'Obsidian & Gemini AI',
    subtitle: 'Personal knowledge vault integration',
    category: 'tools',
    icon: Gem,
  },
  {
    id: 'security_shield',
    title: 'Security & Antiphishing',
    subtitle: 'Key protection & connection security audit',
    category: 'tools',
    icon: ShieldCheck,
  },
  {
    id: 'masterclass',
    title: '3C Video Masterclass',
    subtitle: 'Cheat & Cheat-lateral cup pattern educational series',
    category: 'tools',
    icon: Video,
  },
  {
    id: 'playbook',
    title: 'Minervini Playbook',
    subtitle: 'SEPA core rules & risk management principles',
    category: 'tools',
    icon: BookOpen,
  },
  {
    id: 'custom',
    title: 'Custom Scanner',
    subtitle: 'Custom filter parameters & criteria builder',
    category: 'tools',
    icon: SlidersHorizontal,
  },
];

const CATEGORY_NAMES: Record<NavItemDef['category'], string> = {
  strategy: 'Core Strategy & AI Intelligence',
  market: 'Market Intelligence & Scans',
  execution: 'Trading Execution & Portfolio',
  tools: 'Data Export & Pro Utilities',
};

interface MobileNavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: AppNavTab;
  setActiveTab: (tab: AppNavTab) => void;
  totalSetupsCount: number;
  tightVolumeCount: number;
  isObsidian?: boolean;
  onToggleObsidian?: () => void;
  onOpenDailyScanner?: () => void;
  onOpenDesktopModal?: () => void;
}

export const MobileNavDrawer: React.FC<MobileNavDrawerProps> = ({
  isOpen,
  onClose,
  activeTab,
  setActiveTab,
  totalSetupsCount,
  tightVolumeCount,
  isObsidian = false,
  onToggleObsidian,
  onOpenDailyScanner,
  onOpenDesktopModal,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return NAV_ITEMS;
    const q = searchQuery.toLowerCase();
    return NAV_ITEMS.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const handleSelect = (tab: AppNavTab) => {
    setActiveTab(tab);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop Overlay */}
          <motion.div
            key="mobile-nav-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 md:hidden"
          />

          {/* Drawer Slide-in Container */}
          <motion.div
            key="mobile-nav-content"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className={`fixed inset-y-0 right-0 w-full max-w-sm z-50 md:hidden flex flex-col shadow-2xl border-l transition-colors duration-300 ${
              isObsidian
                ? 'bg-[#0d1117] border-[#21262d] text-gray-100'
                : 'bg-[#faf9f6] border-[#e5e4e1] text-[#1a1a1a]'
            }`}
          >
            {/* Drawer Header */}
            <div
              className={`p-4 border-b flex items-center justify-between ${
                isObsidian ? 'border-[#21262d] bg-[#161b22]' : 'border-[#e5e4e1] bg-white'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <div
                  className={`w-8 h-8 flex items-center justify-center font-serif italic font-bold text-lg rounded-xs ${
                    isObsidian ? 'bg-amber-500 text-slate-950' : 'bg-[#1a1a1a] text-white'
                  }`}
                >
                  α
                </div>
                <div>
                  <span className="text-[9px] uppercase tracking-[0.2em] font-mono block text-amber-500 font-bold">
                    Technical Intelligence
                  </span>
                  <h3 className="font-serif italic font-black text-base leading-tight">
                    Navigation Hub
                  </h3>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {onToggleObsidian && (
                  <button
                    type="button"
                    onClick={onToggleObsidian}
                    className={`p-2 rounded-md border text-xs cursor-pointer ${
                      isObsidian
                        ? 'bg-slate-900 border-amber-500/40 text-amber-400'
                        : 'bg-gray-100 border-gray-300 text-gray-800'
                    }`}
                    title="Toggle Theme"
                  >
                    {isObsidian ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className={`p-2 rounded-md border text-xs cursor-pointer ${
                    isObsidian
                      ? 'bg-slate-900 border-[#30363d] text-gray-300 hover:text-white'
                      : 'bg-gray-100 border-gray-300 text-gray-700 hover:text-black'
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quick Stats Badges Bar */}
            <div
              className={`px-4 py-2 border-b flex items-center justify-between text-[11px] font-mono ${
                isObsidian ? 'border-[#21262d] bg-[#0d1117]' : 'border-[#e5e4e1] bg-[#f9f8f5]'
              }`}
            >
              <div className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-gray-400">Setups:</span>
                <span className="font-bold text-amber-400">{totalSetupsCount} Stocks</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="text-emerald-400 font-bold">💧 Dry-Up:</span>
                <span className="font-bold">{tightVolumeCount}</span>
              </div>
            </div>

            {/* Search Filter Input */}
            <div className="p-3 border-b border-gray-800/20">
              <div
                className={`flex items-center px-3 py-2 rounded-lg border text-xs ${
                  isObsidian
                    ? 'bg-[#161b22] border-[#30363d] text-white'
                    : 'bg-white border-[#d5d4d0] text-gray-900'
                }`}
              >
                <Search className="w-4 h-4 text-gray-400 mr-2 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter 22 tabs & tools (e.g. export, bhavcopy)..."
                  className="w-full bg-transparent border-none outline-hidden font-sans placeholder-gray-400 text-xs"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-gray-400 hover:text-gray-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable Navigation Items List */}
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
              {(['strategy', 'market', 'execution', 'tools'] as const).map((cat) => {
                const itemsInCat = filteredItems.filter((i) => i.category === cat);
                if (itemsInCat.length === 0) return null;

                return (
                  <div key={cat} className="space-y-1.5">
                    <div className="px-2 py-1">
                      <span className="text-[10px] font-mono uppercase tracking-[0.2em] font-bold text-gray-400">
                        {CATEGORY_NAMES[cat]}
                      </span>
                    </div>

                    <div className="space-y-1">
                      {itemsInCat.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;

                        return (
                          <button
                            key={item.id}
                            id={`mobile-menu-item-${item.id}`}
                            type="button"
                            onClick={() => handleSelect(item.id)}
                            className={`w-full p-2.5 rounded-lg text-left flex items-center justify-between transition-all cursor-pointer border ${
                              isActive
                                ? isObsidian
                                  ? 'bg-amber-500/15 border-amber-500/50 text-amber-300 font-bold shadow-xs'
                                  : 'bg-[#1a1a1a] border-[#1a1a1a] text-white font-bold shadow-xs'
                                : isObsidian
                                ? 'bg-[#161b22]/70 hover:bg-[#161b22] border-transparent text-gray-300 hover:text-white'
                                : 'bg-white hover:bg-gray-50 border-[#e5e4e1] text-gray-800'
                            }`}
                          >
                            <div className="flex items-center space-x-3 min-w-0">
                              <div
                                className={`w-8 h-8 rounded flex items-center justify-center shrink-0 ${
                                  isActive
                                    ? isObsidian
                                      ? 'bg-amber-500 text-slate-950'
                                      : 'bg-white text-black'
                                    : isObsidian
                                    ? 'bg-[#21262d] text-amber-400'
                                    : 'bg-gray-100 text-gray-700'
                                }`}
                              >
                                <Icon className="w-4 h-4" />
                              </div>

                              <div className="min-w-0 pr-2">
                                <div className="flex items-center space-x-1.5">
                                  <span className="text-xs truncate font-medium">{item.title}</span>
                                  {item.badge && (
                                    <span
                                      className={`text-[8px] font-mono font-bold px-1.5 py-0.2 rounded shrink-0 ${item.badgeColor}`}
                                    >
                                      {item.badge}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-gray-400 truncate mt-0.5">
                                  {item.subtitle}
                                </p>
                              </div>
                            </div>

                            <ChevronRight
                              className={`w-4 h-4 shrink-0 transition-transform ${
                                isActive ? 'text-amber-400 translate-x-0.5' : 'text-gray-500'
                              }`}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Quick Action Bar in Drawer */}
            <div
              className={`p-3 border-t space-y-2 ${
                isObsidian ? 'border-[#21262d] bg-[#161b22]' : 'border-[#e5e4e1] bg-white'
              }`}
            >
              {/* Quick Export Data Shortcut Button */}
              <button
                type="button"
                onClick={() => handleSelect('export_data')}
                className="w-full py-2 px-3 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold uppercase tracking-wider rounded flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Trade Data (CSV, PDF, JSON)</span>
              </button>

              {/* Stage 2 Scanner & Desktop Guide Grid */}
              <div className="grid grid-cols-2 gap-2">
                {onOpenDailyScanner && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenDailyScanner();
                      onClose();
                    }}
                    className="py-2 px-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] uppercase tracking-wider rounded flex items-center justify-center space-x-1 transition-all cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Stage 2 Scan</span>
                  </button>
                )}

                {onOpenDesktopModal && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenDesktopModal();
                      onClose();
                    }}
                    className={`py-2 px-2 border text-[10px] uppercase font-bold tracking-wider rounded flex items-center justify-center space-x-1 transition-all cursor-pointer ${
                      isObsidian
                        ? 'bg-slate-900 border-[#30363d] text-gray-300'
                        : 'bg-gray-100 border-gray-300 text-gray-800'
                    }`}
                  >
                    <Monitor className="w-3 h-3 text-amber-400" />
                    <span>Desktop App</span>
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
