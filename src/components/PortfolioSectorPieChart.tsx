import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { PortfolioHolding, MinerviniTradeSetup } from '../types';
import { formatCurrency, getCurrencySymbol } from '../utils/sepaCalculator';
import {
  PieChart as PieChartIcon,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  Info,
  TrendingUp,
  Layers,
  ChevronRight,
  Maximize2,
  DollarSign,
  Hash
} from 'lucide-react';

export interface SectorAllocationData {
  sector: string;
  totalValueUsd: number;
  formattedTotalValue: string;
  percentage: number;
  holdingsCount: number;
  tickers: string[];
  holdings: PortfolioHolding[];
  color: string;
  topStock: { ticker: string; valueUsd: number; gainPercent: number } | null;
  avgGainPercent: number;
}

interface PortfolioSectorPieChartProps {
  holdings: PortfolioHolding[];
  stocksList: MinerviniTradeSetup[];
  onSelectStock?: (stock: MinerviniTradeSetup) => void;
  onFilterSector?: (sector: string | null) => void;
  selectedSector?: string | null;
}

// Sophisticated SEPA color palette matching obsidian & luxury cream themes
const SECTOR_PALETTE: Record<string, string> = {
  'Technology': '#10b981', // Emerald
  'Information Technology': '#10b981',
  'Semiconductors': '#f59e0b', // Amber/Gold
  'Semiconductor': '#f59e0b',
  'Healthcare': '#06b6d4', // Cyan
  'Pharmaceuticals': '#0ea5e9', // Sky
  'Financial Services': '#6366f1', // Indigo
  'Banking & Financials': '#6366f1',
  'Consumer Cyclical': '#f43f5e', // Rose
  'Consumer Electronics': '#ec4899', // Pink
  'Industrials': '#f97316', // Orange
  'Capital Goods': '#f97316',
  'Energy': '#eab308', // Yellow
  'Communication Services': '#8b5cf6', // Violet
  'Materials': '#14b8a6', // Teal
  'Automotive': '#d97706', // Amber dark
  'Utilities': '#64748b', // Slate
  'Real Estate': '#78716c', // Stone
  'Diversified / Other': '#94a3b8', // Gray
};

const DEFAULT_COLORS = [
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#06b6d4', // Cyan
  '#6366f1', // Indigo
  '#f43f5e', // Rose
  '#f97316', // Orange
  '#8b5cf6', // Violet
  '#14b8a6', // Teal
  '#ec4899', // Pink
  '#eab308', // Yellow
  '#64748b', // Slate
];

export const PortfolioSectorPieChart: React.FC<PortfolioSectorPieChartProps> = ({
  holdings,
  stocksList,
  onSelectStock,
  onFilterSector,
  selectedSector,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [hoveredSector, setHoveredSector] = useState<SectorAllocationData | null>(null);
  const [chartType, setChartType] = useState<'donut' | 'solid'>('donut');
  const [allocationMetric, setAllocationMetric] = useState<'capital' | 'count'>('capital');
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Group portfolio holdings by Sector and compute unified capital distribution
  const sectorData = useMemo<SectorAllocationData[]>(() => {
    if (!holdings || holdings.length === 0) return [];

    const sectorMap: Record<
      string,
      {
        totalValueUsd: number;
        holdings: PortfolioHolding[];
        tickers: string[];
        totalGainPercentSum: number;
      }
    > = {};

    let grandTotalUsd = 0;

    holdings.forEach((h) => {
      // Find matching stock metadata for sector name
      const matched = stocksList.find((s) => s.ticker.toUpperCase() === h.ticker.toUpperCase());
      const sectorName = matched?.sector?.trim() || (h.exchange === 'NSE' ? 'NSE Growth Leader' : 'Technology / Growth');

      // Standardize value into USD equivalent for consolidated chart
      // Note: NSE INR positions converted with standard rate 0.012 USD/INR
      const isNse = h.exchange === 'NSE' || h.exchange === 'BSE';
      const holdingValueUsd = isNse ? h.shares * h.currentPrice * 0.012 : h.shares * h.currentPrice;
      const gainPercent = ((h.currentPrice - h.entryPrice) / (h.entryPrice || 1)) * 100;

      grandTotalUsd += holdingValueUsd;

      if (!sectorMap[sectorName]) {
        sectorMap[sectorName] = {
          totalValueUsd: 0,
          holdings: [],
          tickers: [],
          totalGainPercentSum: 0,
        };
      }

      sectorMap[sectorName].totalValueUsd += holdingValueUsd;
      sectorMap[sectorName].holdings.push(h);
      if (!sectorMap[sectorName].tickers.includes(h.ticker)) {
        sectorMap[sectorName].tickers.push(h.ticker);
      }
      sectorMap[sectorName].totalGainPercentSum += gainPercent;
    });

    const sectorsArray = Object.keys(sectorMap).map((sectorName, index) => {
      const info = sectorMap[sectorName];
      const percentage = grandTotalUsd > 0 ? (info.totalValueUsd / grandTotalUsd) * 100 : 0;
      const color =
        SECTOR_PALETTE[sectorName] || DEFAULT_COLORS[index % DEFAULT_COLORS.length];

      // Find top performing holding in this sector
      let topStock: { ticker: string; valueUsd: number; gainPercent: number } | null = null;
      if (info.holdings.length > 0) {
        const sorted = [...info.holdings].sort((a, b) => {
          const gainA = (a.currentPrice - a.entryPrice) / a.entryPrice;
          const gainB = (b.currentPrice - b.entryPrice) / b.entryPrice;
          return gainB - gainA;
        });
        const topH = sorted[0];
        const isNseTop = topH.exchange === 'NSE' || topH.exchange === 'BSE';
        topStock = {
          ticker: topH.ticker,
          valueUsd: isNseTop ? topH.shares * topH.currentPrice * 0.012 : topH.shares * topH.currentPrice,
          gainPercent: ((topH.currentPrice - topH.entryPrice) / topH.entryPrice) * 100,
        };
      }

      return {
        sector: sectorName,
        totalValueUsd: info.totalValueUsd,
        formattedTotalValue: formatCurrency(info.totalValueUsd, '$'),
        percentage: Number(percentage.toFixed(1)),
        holdingsCount: info.holdings.length,
        tickers: info.tickers,
        holdings: info.holdings,
        color,
        topStock,
        avgGainPercent: info.holdings.length > 0 ? info.totalGainPercentSum / info.holdings.length : 0,
      };
    });

    // Sort sectors by capital allocation descending
    return sectorsArray.sort((a, b) => b.totalValueUsd - a.totalValueUsd);
  }, [holdings, stocksList]);

  // Total Portfolio Capital
  const totalCapitalUsd = useMemo(() => {
    return sectorData.reduce((sum, s) => sum + s.totalValueUsd, 0);
  }, [sectorData]);

  // Max Sector Concentration Metric
  const maxSectorConcentration = useMemo(() => {
    if (sectorData.length === 0) return { sector: '', pct: 0 };
    return { sector: sectorData[0].sector, pct: sectorData[0].percentage };
  }, [sectorData]);

  // Active highlighted sector (hovered or explicitly selected)
  const activeHighlighted = useMemo(() => {
    if (hoveredSector) return hoveredSector;
    if (selectedSector) {
      return sectorData.find((s) => s.sector.toLowerCase() === selectedSector.toLowerCase()) || null;
    }
    return sectorData[0] || null;
  }, [hoveredSector, selectedSector, sectorData]);

  // D3 Pie & Arc Rendering Engine
  useEffect(() => {
    if (!svgRef.current || sectorData.length === 0) return;

    const width = 360;
    const height = 360;
    const margin = 20;
    const outerRadius = Math.min(width, height) / 2 - margin;
    const innerRadius = chartType === 'donut' ? outerRadius * 0.58 : 0;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg
      .append('g')
      .attr('transform', `translate(${width / 2}, ${height / 2})`);

    // D3 Pie Generator
    const pie = d3
      .pie<SectorAllocationData>()
      .value((d) => (allocationMetric === 'capital' ? d.totalValueUsd : d.holdingsCount))
      .sort(null)
      .padAngle(chartType === 'donut' ? 0.025 : 0.015);

    // Standard Arc Generator
    const arc = d3
      .arc<d3.PieArcDatum<SectorAllocationData>>()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius)
      .cornerRadius(chartType === 'donut' ? 4 : 0);

    // Expanded Hover Arc Generator
    const hoverArc = d3
      .arc<d3.PieArcDatum<SectorAllocationData>>()
      .innerRadius(innerRadius > 0 ? innerRadius - 2 : 0)
      .outerRadius(outerRadius + 8)
      .cornerRadius(chartType === 'donut' ? 6 : 0);

    // Outer Label Arc Generator
    const labelArc = d3
      .arc<d3.PieArcDatum<SectorAllocationData>>()
      .innerRadius(outerRadius * 0.75)
      .outerRadius(outerRadius * 0.75);

    const pieData = pie(sectorData);

    // Background Glow Filter Definition
    const defs = svg.append('defs');
    const filter = defs.append('filter').attr('id', 'pie-glow');
    filter.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'coloredBlur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Render Slices
    const slices = g
      .selectAll('.arc-slice')
      .data(pieData)
      .enter()
      .append('g')
      .attr('class', 'arc-slice')
      .style('cursor', 'pointer');

    slices
      .append('path')
      .attr('d', (d) => {
        const isHovered =
          (hoveredSector && hoveredSector.sector === d.data.sector) ||
          (selectedSector && selectedSector === d.data.sector);
        return isHovered ? hoverArc(d) : arc(d);
      })
      .attr('fill', (d) => d.data.color)
      .attr('stroke', '#111827')
      .attr('stroke-width', 2)
      .attr('opacity', (d) => {
        if (!hoveredSector && !selectedSector) return 0.95;
        const isMatch =
          (hoveredSector && hoveredSector.sector === d.data.sector) ||
          (selectedSector && selectedSector === d.data.sector);
        return isMatch ? 1 : 0.45;
      })
      .on('mouseenter', (event, d) => {
        setHoveredSector(d.data);
        const [x, y] = d3.pointer(event, containerRef.current);
        setTooltipPos({ x, y });

        d3.select(event.currentTarget)
          .transition()
          .duration(200)
          .attr('d', hoverArc as any)
          .attr('opacity', 1)
          .style('filter', 'url(#pie-glow)');
      })
      .on('mousemove', (event) => {
        const [x, y] = d3.pointer(event, containerRef.current);
        setTooltipPos({ x, y });
      })
      .on('mouseleave', (event, d) => {
        setHoveredSector(null);
        setTooltipPos(null);

        const isSelected = selectedSector && selectedSector === d.data.sector;
        d3.select(event.currentTarget)
          .transition()
          .duration(200)
          .attr('d', (isSelected ? hoverArc : arc) as any)
          .attr('opacity', isSelected ? 1 : 0.95)
          .style('filter', 'none');
      })
      .on('click', (_, d) => {
        if (onFilterSector) {
          onFilterSector(selectedSector === d.data.sector ? null : d.data.sector);
        }
      });

    // Add Slice Labels for prominent segments (> 6% of portfolio)
    slices
      .filter((d) => d.data.percentage >= 6.0)
      .append('text')
      .attr('transform', (d) => `translate(${labelArc.centroid(d)})`)
      .attr('text-anchor', 'middle')
      .attr('alignment-baseline', 'central')
      .attr('fill', '#ffffff')
      .attr('font-size', '11px')
      .attr('font-family', 'monospace')
      .attr('font-weight', 'bold')
      .attr('pointer-events', 'none')
      .style('text-shadow', '0 1px 3px rgba(0,0,0,0.85)')
      .text((d) => `${d.data.percentage}%`);

  }, [sectorData, chartType, allocationMetric, hoveredSector, selectedSector, onFilterSector]);

  if (holdings.length === 0) {
    return (
      <div
        id="portfolio-sector-pie-chart-empty"
        className="bg-white border border-[#e5e4e1] p-8 text-center space-y-3"
      >
        <div className="w-12 h-12 mx-auto bg-amber-50 rounded-full flex items-center justify-center border border-amber-200">
          <PieChartIcon className="w-6 h-6 text-amber-600" />
        </div>
        <h4 className="font-serif font-bold text-base text-[#1a1a1a]">
          No Holdings for Sector Allocation
        </h4>
        <p className="text-xs text-gray-500 font-sans max-w-md mx-auto">
          Add positions to your portfolio to visualize capital distribution and sector diversification health using the D3 interactive pie chart.
        </p>
      </div>
    );
  }

  return (
    <div
      id="portfolio-sector-pie-chart-module"
      ref={containerRef}
      className="bg-white border border-[#e5e4e1] p-5 shadow-xs space-y-4 relative"
    >
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e4e1] pb-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-[#1a1a1a] text-amber-400">
            <PieChartIcon className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[#b5a68d]">
                D3 SEPA Capital Distribution
              </span>
              <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[9px] uppercase px-1.5 py-0.2 font-mono font-bold">
                {sectorData.length} Active Sectors
              </span>
            </div>
            <h3 className="text-base font-serif font-bold text-[#1a1a1a] tracking-tight">
              Sector Capital Allocation & Concentration Breakdown
            </h3>
          </div>
        </div>

        {/* View Switchers & Controls */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          {/* Metric Selector: Capital vs Count */}
          <div className="flex items-center space-x-1 bg-[#f9f8f5] p-1 border border-[#e5e4e1]">
            <button
              id="pie-metric-capital-btn"
              onClick={() => setAllocationMetric('capital')}
              className={`px-2 py-1 text-[10px] uppercase font-bold transition-all cursor-pointer flex items-center space-x-1 ${
                allocationMetric === 'capital'
                  ? 'bg-[#1a1a1a] text-amber-300 shadow-xs'
                  : 'text-gray-600 hover:text-black'
              }`}
              title="Weight by total capital market value"
            >
              <DollarSign className="w-3 h-3" />
              <span>Capital ($)</span>
            </button>
            <button
              id="pie-metric-count-btn"
              onClick={() => setAllocationMetric('count')}
              className={`px-2 py-1 text-[10px] uppercase font-bold transition-all cursor-pointer flex items-center space-x-1 ${
                allocationMetric === 'count'
                  ? 'bg-[#1a1a1a] text-amber-300 shadow-xs'
                  : 'text-gray-600 hover:text-black'
              }`}
              title="Weight by position quantity count"
            >
              <Hash className="w-3 h-3" />
              <span>Positions Count</span>
            </button>
          </div>

          {/* Chart Style: Donut vs Solid Pie */}
          <div className="flex items-center space-x-1 bg-[#f9f8f5] p-1 border border-[#e5e4e1]">
            <button
              id="pie-style-donut-btn"
              onClick={() => setChartType('donut')}
              className={`px-2 py-1 text-[10px] uppercase font-bold transition-all cursor-pointer ${
                chartType === 'donut'
                  ? 'bg-[#1a1a1a] text-white shadow-xs'
                  : 'text-gray-600 hover:text-black'
              }`}
            >
              Donut
            </button>
            <button
              id="pie-style-solid-btn"
              onClick={() => setChartType('solid')}
              className={`px-2 py-1 text-[10px] uppercase font-bold transition-all cursor-pointer ${
                chartType === 'solid'
                  ? 'bg-[#1a1a1a] text-white shadow-xs'
                  : 'text-gray-600 hover:text-black'
              }`}
            >
              Solid Pie
            </button>
          </div>

          {selectedSector && (
            <button
              onClick={() => onFilterSector && onFilterSector(null)}
              className="bg-rose-50 text-rose-700 border border-rose-200 px-2 py-1 text-[10px] font-bold uppercase hover:bg-rose-100 transition cursor-pointer"
            >
              Clear Filter ({selectedSector})
            </button>
          )}
        </div>
      </div>

      {/* Main Visualizer Body: D3 Pie Canvas + Sector Breakdown Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        
        {/* Left Col: D3 Pie Chart Stage */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center relative p-3 bg-[#fcfbfa] border border-[#e5e4e1]">
          <div className="relative w-[320px] h-[320px] flex items-center justify-center">
            <svg
              ref={svgRef}
              id="d3-portfolio-sector-svg"
              className="w-full h-full drop-shadow-sm select-none"
            />

            {/* Center Summary Content (for Donut mode) */}
            {chartType === 'donut' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none p-4">
                {activeHighlighted ? (
                  <div className="space-y-0.5 animate-fadeIn">
                    <span
                      className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 rounded-xs inline-block text-white"
                      style={{ backgroundColor: activeHighlighted.color }}
                    >
                      {activeHighlighted.sector}
                    </span>
                    <div className="text-xl font-mono font-black text-[#1a1a1a] tracking-tight">
                      {activeHighlighted.formattedTotalValue}
                    </div>
                    <div className="text-xs font-mono font-extrabold text-amber-700">
                      {activeHighlighted.percentage}% of Portfolio
                    </div>
                    <div className="text-[10px] text-gray-500 font-mono">
                      {activeHighlighted.holdingsCount} stock{activeHighlighted.holdingsCount > 1 ? 's' : ''} ({activeHighlighted.tickers.join(', ')})
                    </div>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-mono uppercase tracking-widest text-gray-400 font-bold">
                      Total Invested
                    </span>
                    <div className="text-lg font-mono font-black text-[#1a1a1a]">
                      {formatCurrency(totalCapitalUsd, '$')}
                    </div>
                    <div className="text-[10px] font-mono text-gray-500">
                      Across {sectorData.length} Sectors
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="text-[10px] font-mono text-gray-500 text-center mt-2">
            💡 Hover on slices to inspect holdings • Click slice to filter holdings table
          </div>
        </div>

        {/* Right Col: Sector Breakdown List & Minervini Concentration Assessment */}
        <div className="lg:col-span-7 space-y-3">
          
          {/* Minervini SEPA Concentration Risk Banner */}
          <div
            className={`p-3 border flex items-start space-x-3 text-xs ${
              maxSectorConcentration.pct > 35
                ? 'bg-rose-50 border-rose-300 text-rose-900'
                : maxSectorConcentration.pct > 25
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : 'bg-emerald-50 border-emerald-300 text-emerald-900'
            }`}
          >
            {maxSectorConcentration.pct > 35 ? (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            ) : maxSectorConcentration.pct > 25 ? (
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-0.5">
              <div className="font-mono font-bold uppercase tracking-wider text-[11px] flex items-center space-x-2">
                <span>SEPA Concentration Health:</span>
                <span className="underline decoration-current">
                  {maxSectorConcentration.pct > 35
                    ? 'Elevated Sector Exposure (>35%)'
                    : maxSectorConcentration.pct > 25
                    ? 'Moderate Sector Concentration (25-35%)'
                    : 'Optimal SEPA Diversification (≤25%)'}
                </span>
              </div>
              <p className="font-sans text-[11px] leading-relaxed">
                {maxSectorConcentration.pct > 35
                  ? `High correlation warning: ${maxSectorConcentration.sector} represents ${maxSectorConcentration.pct}% of total equity. Mark Minervini advises capping single-industry exposure below 25-30% to prevent correlated market drawdowns.`
                  : maxSectorConcentration.pct > 25
                  ? `Leading position: ${maxSectorConcentration.sector} accounts for ${maxSectorConcentration.pct}% of capital. Well aligned with concentrated growth guidelines, but monitor sector-wide volume pullbacks.`
                  : `Well-balanced risk distribution: Highest single sector is ${maxSectorConcentration.sector} at ${maxSectorConcentration.pct}%, comfortably within the SEPA safe diversification threshold.`}
              </p>
            </div>
          </div>

          {/* Detailed Sector Legend & Allocation Bars */}
          <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
            {sectorData.map((sec) => {
              const isSelected = selectedSector === sec.sector;
              const isHovered = hoveredSector?.sector === sec.sector;

              return (
                <div
                  key={sec.sector}
                  onMouseEnter={() => setHoveredSector(sec)}
                  onMouseLeave={() => setHoveredSector(null)}
                  onClick={() => onFilterSector && onFilterSector(isSelected ? null : sec.sector)}
                  className={`p-2.5 border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-50/90 border-amber-500 shadow-xs'
                      : isHovered
                      ? 'bg-[#fcfbfa] border-gray-400'
                      : 'bg-[#f9f8f5] border-[#e5e4e1] hover:bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <span
                        className="w-3 h-3 rounded-xs shrink-0"
                        style={{ backgroundColor: sec.color }}
                      />
                      <span className="font-bold text-[#1a1a1a] font-sans">
                        {sec.sector}
                      </span>
                      <span className="text-[10px] font-mono text-gray-500">
                        ({sec.holdingsCount} position{sec.holdingsCount > 1 ? 's' : ''})
                      </span>
                    </div>

                    <div className="flex items-center space-x-3 font-mono">
                      <span className="text-gray-600 font-medium text-[11px]">
                        {sec.formattedTotalValue}
                      </span>
                      <span className="font-extrabold text-[#1a1a1a] text-xs bg-white px-1.5 py-0.5 border border-[#e5e4e1]">
                        {sec.percentage}%
                      </span>
                    </div>
                  </div>

                  {/* Allocation Visual Bar */}
                  <div className="w-full bg-[#e5e4e1] h-1.5 mt-2 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, sec.percentage)}%`,
                        backgroundColor: sec.color,
                      }}
                    />
                  </div>

                  {/* Tickers & Sector Health Footnote */}
                  <div className="flex items-center justify-between text-[10px] font-mono text-gray-500 mt-1.5 pt-1 border-t border-[#e5e4e1]/60">
                    <div className="flex items-center space-x-1">
                      <span>Holdings:</span>
                      <span className="font-bold text-[#1a1a1a]">
                        {sec.tickers.join(', ')}
                      </span>
                    </div>
                    {sec.topStock && (
                      <div className="flex items-center space-x-1">
                        <span>Top Leader:</span>
                        <strong className="text-emerald-700 font-bold">
                          {sec.topStock.ticker} ({sec.topStock.gainPercent >= 0 ? '+' : ''}{sec.topStock.gainPercent.toFixed(1)}%)
                        </strong>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>

      {/* Interactive Floating Hover Tooltip */}
      {tooltipPos && hoveredSector && (
        <div
          id="d3-sector-pie-tooltip"
          className="absolute z-50 pointer-events-none bg-[#1a1a1a] text-white p-3 border border-amber-400/80 shadow-2xl text-xs font-mono space-y-1.5 w-64 animate-fadeIn"
          style={{
            left: Math.min(window.innerWidth - 300, Math.max(10, tooltipPos.x + 15)),
            top: Math.max(10, tooltipPos.y - 40),
          }}
        >
          <div className="flex items-center justify-between border-b border-white/20 pb-1">
            <div className="flex items-center space-x-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: hoveredSector.color }}
              />
              <span className="font-bold text-amber-300 uppercase text-[11px] truncate max-w-[140px]">
                {hoveredSector.sector}
              </span>
            </div>
            <span className="bg-amber-400 text-black px-1.5 py-0.2 font-black text-[10px]">
              {hoveredSector.percentage}%
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1 text-[10px] text-gray-300 pt-0.5">
            <div>Capital Value:</div>
            <div className="text-right text-white font-bold">{hoveredSector.formattedTotalValue}</div>

            <div>Stock Count:</div>
            <div className="text-right text-white font-bold">{hoveredSector.holdingsCount} holding(s)</div>

            <div>Avg P&L Gain:</div>
            <div className={`text-right font-bold ${hoveredSector.avgGainPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {hoveredSector.avgGainPercent >= 0 ? '+' : ''}{hoveredSector.avgGainPercent.toFixed(2)}%
            </div>
          </div>

          <div className="pt-1 border-t border-white/10 text-[9px] text-amber-200/90 font-sans">
            Positions: {hoveredSector.tickers.join(', ')}
          </div>
        </div>
      )}
    </div>
  );
};
