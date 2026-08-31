import React, { useState, useMemo } from 'react';
import { MinerviniTradeSetup } from '../types';
import {
  calculateVolumeProfile,
  VolumeProfileResult,
  VolumeProfileBin,
} from '../utils/volumeProfileCalculator';
import { formatCurrency, formatVolume, getCurrencySymbol } from '../utils/sepaCalculator';
import {
  BarChart2,
  Layers,
  ShieldCheck,
  Zap,
  Sliders,
  Info,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Sparkles,
  ChevronRight,
  Maximize2,
  Minimize2,
  HelpCircle,
  TrendingUp,
} from 'lucide-react';

interface VolumeProfileSidebarProps {
  stock: MinerviniTradeSetup;
  showOverlayOnChart: boolean;
  onToggleOverlayOnChart: (show: boolean) => void;
  onSelectPriceLevel?: (price: number) => void;
  className?: string;
}

export const VolumeProfileSidebar: React.FC<VolumeProfileSidebarProps> = ({
  stock,
  showOverlayOnChart,
  onToggleOverlayOnChart,
  onSelectPriceLevel,
  className = '',
}) => {
  const [rangeType, setRangeType] = useState<'ALL' | 'VCP_BASE' | 'LAST_60D'>('ALL');
  const [binCount, setBinCount] = useState<number>(26);
  const [hoveredBin, setHoveredBin] = useState<VolumeProfileBin | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [showHelp, setShowHelp] = useState<boolean>(false);

  const currencySymbol = getCurrencySymbol(stock.exchange);

  // Compute Volume Profile
  const profile: VolumeProfileResult = useMemo(() => {
    return calculateVolumeProfile(stock, {
      binCount,
      rangeType,
      valueAreaRatio: 0.70,
    });
  }, [stock, binCount, rangeType]);

  const {
    bins,
    totalVolume,
    maxBinVolume,
    pocPrice,
    pocVolume,
    vahPrice,
    valPrice,
    supportInsight,
    currentPricePosition,
  } = profile;

  // Render bins in descending price order (Highest price on top, lowest on bottom)
  const reversedBins = useMemo(() => {
    return [...bins].reverse();
  }, [bins]);

  return (
    <div
      className={`bg-white border-2 border-[#1a1a1a] shadow-xs flex flex-col font-mono select-none ${className}`}
    >
      {/* Header Bar */}
      <div className="bg-[#1a1a1a] text-white p-2.5 flex items-center justify-between border-b border-black">
        <div className="flex items-center space-x-2">
          <BarChart2 className="w-4 h-4 text-amber-400" />
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-white">
                Volume Profile
              </span>
              <span className="bg-amber-500 text-black text-[9px] font-black px-1.5 py-0.2 rounded-2xs">
                70% VA
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => setShowHelp(!showHelp)}
            className={`p-1 transition-colors cursor-pointer ${
              showHelp ? 'text-amber-400 bg-neutral-800' : 'text-gray-400 hover:text-white'
            }`}
            title="What is Volume Profile & Value Area?"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-gray-400 hover:text-white transition-colors cursor-pointer"
            title={isExpanded ? 'Collapse Profile' : 'Expand Profile'}
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Educational Popover banner if open */}
      {showHelp && (
        <div className="p-3 bg-amber-50 border-b border-amber-200 text-[11px] text-amber-950 font-sans space-y-1.5">
          <div className="font-bold flex items-center space-x-1 text-amber-900">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>How to Read Minervini Volume Profile & Value Area:</span>
          </div>
          <ul className="list-disc pl-4 space-y-1 text-[10.5px] text-gray-700">
            <li>
              <strong className="text-emerald-700">VAH (Value Area High):</strong> Top boundary of the 70% highest volume zone. When price breaks above VAH, it confirms institutional markup.
            </li>
            <li>
              <strong className="text-purple-700">POC (Point of Control):</strong> The exact price level where the maximum volume was exchanged. Acts as the primary institutional accumulation anchor.
            </li>
            <li>
              <strong className="text-blue-700">VAL (Value Area Low):</strong> Bottom boundary of 70% volume. Strongest baseline support floor.
            </li>
          </ul>
        </div>
      )}

      {/* Controls & Lookback Toolbar */}
      <div className="p-2 bg-[#f9f8f5] border-b border-[#e5e4e1] flex flex-wrap items-center justify-between gap-1.5 text-[10px]">
        {/* Lookback range */}
        <div className="flex items-center space-x-1">
          <span className="text-gray-500 font-bold uppercase">Range:</span>
          <div className="flex items-center space-x-0.5">
            {[
              { id: 'ALL', label: 'All' },
              { id: 'VCP_BASE', label: 'VCP Base' },
              { id: 'LAST_60D', label: '60D' },
            ].map((r) => (
              <button
                key={r.id}
                onClick={() => setRangeType(r.id as any)}
                className={`px-1.5 py-0.5 text-[9.5px] font-bold uppercase border transition-all cursor-pointer ${
                  rangeType === r.id
                    ? 'bg-black text-amber-400 border-black'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Resolution */}
        <div className="flex items-center space-x-1">
          <span className="text-gray-500 font-bold uppercase">Bins:</span>
          <div className="flex items-center space-x-0.5">
            {[20, 28, 36].map((cnt) => (
              <button
                key={cnt}
                onClick={() => setBinCount(cnt)}
                className={`px-1.5 py-0.5 text-[9.5px] font-bold border transition-all cursor-pointer ${
                  binCount === cnt
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                }`}
              >
                {cnt}
              </button>
            ))}
          </div>
        </div>

        {/* Chart Lines Sync toggle */}
        <button
          onClick={() => onToggleOverlayOnChart(!showOverlayOnChart)}
          className={`px-2 py-0.5 text-[9.5px] font-bold uppercase border flex items-center space-x-1 transition-all cursor-pointer ${
            showOverlayOnChart
              ? 'bg-emerald-900 text-emerald-100 border-emerald-950'
              : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
          }`}
          title="Toggle VAH, VAL, and POC reference lines directly on the candlestick chart"
        >
          <Layers className="w-2.5 h-2.5" />
          <span>{showOverlayOnChart ? 'Chart Lines ON' : 'Show on Chart'}</span>
        </button>
      </div>

      {/* Key Metric Scorecard Banner: VAH, POC, VAL */}
      <div className="grid grid-cols-3 border-b border-[#e5e4e1] bg-white divide-x divide-[#e5e4e1] text-center py-2">
        {/* VAH */}
        <div className="px-1.5">
          <div className="text-[9px] font-bold uppercase text-emerald-700 tracking-wider flex items-center justify-center space-x-0.5">
            <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full" />
            <span>VAH (High)</span>
          </div>
          <div className="text-xs font-black text-emerald-900 mt-0.5">
            {formatCurrency(vahPrice, currencySymbol)}
          </div>
          <div className="text-[9px] text-gray-500">
            {(((vahPrice - stock.currentPrice) / stock.currentPrice) * 100).toFixed(1)}% away
          </div>
        </div>

        {/* POC */}
        <div className="px-1.5 bg-purple-50/50">
          <div className="text-[9px] font-bold uppercase text-purple-700 tracking-wider flex items-center justify-center space-x-0.5">
            <span className="w-1.5 h-1.5 bg-purple-600 rounded-full" />
            <span>POC (Anchor)</span>
          </div>
          <div className="text-xs font-black text-purple-900 mt-0.5">
            {formatCurrency(pocPrice, currencySymbol)}
          </div>
          <div className="text-[9px] text-gray-500">
            {formatVolume(pocVolume)} vol
          </div>
        </div>

        {/* VAL */}
        <div className="px-1.5">
          <div className="text-[9px] font-bold uppercase text-blue-700 tracking-wider flex items-center justify-center space-x-0.5">
            <span className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
            <span>VAL (Floor)</span>
          </div>
          <div className="text-xs font-black text-blue-900 mt-0.5">
            {formatCurrency(valPrice, currencySymbol)}
          </div>
          <div className="text-[9px] text-gray-500">
            {(((valPrice - stock.currentPrice) / stock.currentPrice) * 100).toFixed(1)}% away
          </div>
        </div>
      </div>

      {/* Support & Positioning Insight Badge */}
      <div className="p-2 border-b border-[#e5e4e1] bg-[#fdfcf9]">
        <div className="flex items-center justify-between gap-1 mb-1">
          <span className="text-[9.5px] font-bold text-gray-600 uppercase">Support Zone Status:</span>
          <span
            className={`text-[9px] font-black uppercase px-1.5 py-0.5 border rounded-2xs ${supportInsight.badgeBg} ${supportInsight.badgeText}`}
          >
            {supportInsight.badgeLabel}
          </span>
        </div>
        <p className="text-[10px] text-gray-700 font-sans leading-tight">
          {supportInsight.detail}
        </p>
      </div>

      {/* Main Histogram Visualization: Volume at Price */}
      {isExpanded && (
        <div className="flex-1 overflow-y-auto p-2 space-y-1 max-h-[380px] scrollbar-thin bg-[#faf9f6]">
          <div className="text-[9px] font-bold text-gray-500 uppercase flex items-center justify-between mb-1 pb-1 border-b border-gray-200">
            <span>Price Node</span>
            <span>Traded Volume at Price</span>
            <span>% Max</span>
          </div>

          {reversedBins.map((bin) => {
            const isHovered = hoveredBin?.id === bin.id;
            const isNearCurrentPrice =
              stock.currentPrice >= bin.priceLow && stock.currentPrice <= bin.priceHigh;
            const isNearPivot =
              stock.pivotPrice >= bin.priceLow && stock.pivotPrice <= bin.priceHigh;

            const buyShare = bin.totalVolume > 0 ? (bin.buyVolume / bin.totalVolume) * 100 : 50;
            const sellShare = 100 - buyShare;

            return (
              <div
                key={bin.id}
                onMouseEnter={() => setHoveredBin(bin)}
                onMouseLeave={() => setHoveredBin(null)}
                onClick={() => onSelectPriceLevel && onSelectPriceLevel(bin.priceMid)}
                className={`relative group px-1.5 py-0.5 rounded-2xs transition-all cursor-pointer flex items-center justify-between text-[10px] ${
                  bin.isPoc
                    ? 'bg-purple-100/90 border border-purple-400 font-bold'
                    : bin.isVah
                    ? 'bg-emerald-100/80 border border-emerald-400 font-bold'
                    : bin.isVal
                    ? 'bg-blue-100/80 border border-blue-400 font-bold'
                    : bin.isValueArea
                    ? 'bg-amber-50/70 border border-amber-200'
                    : 'bg-white border border-gray-200 hover:bg-gray-100'
                } ${isNearCurrentPrice ? 'ring-1.5 ring-black' : ''}`}
              >
                {/* Price Label & Node Tag */}
                <div className="w-20 shrink-0 flex items-center space-x-1 z-10">
                  <span className="text-[9.5px] font-bold text-gray-900">
                    {currencySymbol}{bin.priceMid.toFixed(2)}
                  </span>
                  {bin.isPoc && (
                    <span className="bg-purple-700 text-white text-[8px] font-black px-1 rounded-2xs">
                      POC
                    </span>
                  )}
                  {bin.isVah && (
                    <span className="bg-emerald-700 text-white text-[8px] font-black px-1 rounded-2xs">
                      VAH
                    </span>
                  )}
                  {bin.isVal && (
                    <span className="bg-blue-700 text-white text-[8px] font-black px-1 rounded-2xs">
                      VAL
                    </span>
                  )}
                  {isNearCurrentPrice && (
                    <span className="bg-black text-amber-400 text-[8px] font-black px-1 rounded-2xs" title="Current Market Price">
                      CMP
                    </span>
                  )}
                </div>

                {/* Volume Horizontal Bar (Dual Buy/Sell Split) */}
                <div className="flex-1 mx-2 h-3.5 bg-gray-100 rounded-2xs overflow-hidden relative flex items-center">
                  <div
                    className="h-full flex transition-all duration-300"
                    style={{ width: `${Math.max(4, bin.volumePercent)}%` }}
                  >
                    {/* Buy volume portion */}
                    <div
                      className={`h-full ${
                        bin.isPoc
                          ? 'bg-purple-600'
                          : bin.isVah
                          ? 'bg-emerald-600'
                          : bin.isVal
                          ? 'bg-blue-600'
                          : bin.isValueArea
                          ? 'bg-emerald-500'
                          : 'bg-slate-400'
                      }`}
                      style={{ width: `${buyShare}%` }}
                      title={`Buy Volume: ${formatVolume(bin.buyVolume)} (${buyShare.toFixed(0)}%)`}
                    />
                    {/* Sell volume portion */}
                    <div
                      className={`h-full ${
                        bin.isPoc
                          ? 'bg-purple-400'
                          : bin.isVah
                          ? 'bg-emerald-400'
                          : bin.isVal
                          ? 'bg-blue-400'
                          : bin.isValueArea
                          ? 'bg-rose-400'
                          : 'bg-slate-300'
                      }`}
                      style={{ width: `${sellShare}%` }}
                      title={`Sell Volume: ${formatVolume(bin.sellVolume)} (${sellShare.toFixed(0)}%)`}
                    />
                  </div>

                  {/* Volume Label overlaid */}
                  <span className="absolute left-1.5 text-[8.5px] font-bold text-gray-700 mix-blend-multiply pointer-events-none">
                    {formatVolume(bin.totalVolume)}
                  </span>
                </div>

                {/* Share % */}
                <div className="w-9 text-right shrink-0 text-[9px] text-gray-500 z-10">
                  {bin.totalVolumeSharePct}%
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Hovered Node Detail Footer */}
      {hoveredBin && (
        <div className="p-2 bg-neutral-900 text-white border-t border-black text-[10px] space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-bold text-amber-400">
              Level: {currencySymbol}{hoveredBin.priceLow.toFixed(2)} - {currencySymbol}{hoveredBin.priceHigh.toFixed(2)}
            </span>
            <span className="text-[9px] text-gray-300 font-bold">
              {hoveredBin.isPoc ? 'POC ANCHOR' : hoveredBin.isVah ? 'VAH RESISTANCE' : hoveredBin.isVal ? 'VAL SUPPORT' : hoveredBin.isValueArea ? 'INSIDE 70% VALUE' : 'LOW LIQUIDITY ZONE'}
            </span>
          </div>
          <div className="flex items-center justify-between text-gray-300 text-[9px]">
            <span>Volume: <strong>{formatVolume(hoveredBin.totalVolume)}</strong> ({hoveredBin.totalVolumeSharePct}% share)</span>
            <span>Buy/Sell: <span className="text-emerald-400 font-bold">{formatVolume(hoveredBin.buyVolume)}</span> / <span className="text-rose-400 font-bold">{formatVolume(hoveredBin.sellVolume)}</span></span>
          </div>
        </div>
      )}

      {/* Footer Info / Action */}
      <div className="p-2 bg-[#f9f8f5] border-t border-[#e5e4e1] text-[9.5px] text-gray-500 flex items-center justify-between font-sans">
        <span>70% Value Area: <strong>{formatCurrency(valPrice, currencySymbol)} - {formatCurrency(vahPrice, currencySymbol)}</strong></span>
        <span className="text-[9px] font-mono text-gray-400">{profile.lookbackCount} Bars Profiled</span>
      </div>
    </div>
  );
};
