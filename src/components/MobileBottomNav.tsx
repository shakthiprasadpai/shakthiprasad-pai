import React from 'react';
import { motion } from 'motion/react';
import { BarChart3, TrendingUp, Bot, Download, Menu } from 'lucide-react';
import { AppNavTab } from './Navbar';

interface MobileBottomNavProps {
  activeTab: AppNavTab;
  setActiveTab: (tab: AppNavTab) => void;
  onOpenMenu: () => void;
  isObsidian?: boolean;
  aiInsightsCount?: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  onOpenMenu,
  isObsidian = false,
  aiInsightsCount = 0,
}) => {
  const isPrimaryTabActive = ['screener', 'chart', 'hermes_agent', 'export_data'].includes(activeTab);

  return (
    <div
      id="mobile-bottom-nav"
      className={`md:hidden fixed bottom-0 left-0 right-0 z-40 border-t backdrop-blur-xl transition-colors duration-300 pb-safe ${
        isObsidian
          ? 'bg-[#0e121a]/95 border-[#232b3b] text-gray-300'
          : 'bg-white/95 border-[#e5e4e1] text-gray-700 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]'
      }`}
    >
      <div className="grid grid-cols-5 h-16 items-center px-1">
        
        {/* 1. Screener */}
        <button
          id="mobile-nav-screener"
          type="button"
          onClick={() => setActiveTab('screener')}
          className={`flex flex-col items-center justify-center py-1 rounded-lg transition-all cursor-pointer relative ${
            activeTab === 'screener'
              ? isObsidian
                ? 'text-amber-400 font-bold'
                : 'text-black font-bold'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          {activeTab === 'screener' && (
            <motion.div
              layoutId="mobile-active-pill"
              className={`absolute -top-1 w-6 h-0.5 rounded-full ${isObsidian ? 'bg-amber-400' : 'bg-[#1a1a1a]'}`}
            />
          )}
          <BarChart3 className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-mono tracking-tight uppercase">Screener</span>
        </button>

        {/* 2. Charts */}
        <button
          id="mobile-nav-chart"
          type="button"
          onClick={() => setActiveTab('chart')}
          className={`flex flex-col items-center justify-center py-1 rounded-lg transition-all cursor-pointer relative ${
            activeTab === 'chart'
              ? isObsidian
                ? 'text-amber-400 font-bold'
                : 'text-black font-bold'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          {activeTab === 'chart' && (
            <motion.div
              layoutId="mobile-active-pill"
              className={`absolute -top-1 w-6 h-0.5 rounded-full ${isObsidian ? 'bg-amber-400' : 'bg-[#1a1a1a]'}`}
            />
          )}
          <TrendingUp className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-mono tracking-tight uppercase">Charts</span>
        </button>

        {/* 3. Hermes AI Co-Pilot */}
        <button
          id="mobile-nav-hermes"
          type="button"
          onClick={() => setActiveTab('hermes_agent')}
          className={`flex flex-col items-center justify-center py-1 rounded-lg transition-all cursor-pointer relative ${
            activeTab === 'hermes_agent'
              ? 'text-amber-400 font-bold'
              : 'text-gray-400 hover:text-amber-300'
          }`}
        >
          {activeTab === 'hermes_agent' && (
            <motion.div
              layoutId="mobile-active-pill"
              className="absolute -top-1 w-6 h-0.5 rounded-full bg-amber-400"
            />
          )}
          <div className="relative">
            <Bot className="w-5 h-5 mb-0.5" />
            {aiInsightsCount > 0 && (
              <span className="absolute -top-1 -right-2 flex h-3.5 w-3.5 items-center justify-center">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500 text-[8px] font-bold text-slate-950 items-center justify-center">
                  {aiInsightsCount > 9 ? '9+' : aiInsightsCount}
                </span>
              </span>
            )}
          </div>
          <span className="text-[10px] font-mono tracking-tight uppercase">Hermes</span>
        </button>

        {/* 4. Export Data (Direct 1-tap access on mobile!) */}
        <button
          id="mobile-nav-export"
          type="button"
          onClick={() => setActiveTab('export_data')}
          className={`flex flex-col items-center justify-center py-1 rounded-lg transition-all cursor-pointer relative ${
            activeTab === 'export_data'
              ? isObsidian
                ? 'text-emerald-400 font-bold'
                : 'text-emerald-700 font-bold'
              : 'text-gray-400 hover:text-emerald-300'
          }`}
        >
          {activeTab === 'export_data' && (
            <motion.div
              layoutId="mobile-active-pill"
              className="absolute -top-1 w-6 h-0.5 rounded-full bg-emerald-400"
            />
          )}
          <div className="relative">
            <Download className="w-5 h-5 mb-0.5" />
            <span className="absolute -top-0.5 -right-1 w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </div>
          <span className="text-[10px] font-mono tracking-tight uppercase">Export</span>
        </button>

        {/* 5. More / Categorized Menu */}
        <button
          id="mobile-nav-more"
          type="button"
          onClick={onOpenMenu}
          className={`flex flex-col items-center justify-center py-1 rounded-lg transition-all cursor-pointer relative ${
            !isPrimaryTabActive
              ? isObsidian
                ? 'text-amber-400 font-bold'
                : 'text-black font-bold'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          {!isPrimaryTabActive && (
            <motion.div
              layoutId="mobile-active-pill"
              className={`absolute -top-1 w-6 h-0.5 rounded-full ${isObsidian ? 'bg-amber-400' : 'bg-[#1a1a1a]'}`}
            />
          )}
          <div className="relative">
            <Menu className="w-5 h-5 mb-0.5" />
            {!isPrimaryTabActive && (
              <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}
          </div>
          <span className="text-[10px] font-mono tracking-tight uppercase">
            {!isPrimaryTabActive ? 'Active' : 'Tools'}
          </span>
        </button>

      </div>
    </div>
  );
};
