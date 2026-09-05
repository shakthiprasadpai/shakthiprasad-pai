import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import {
  RrgSecurityData,
  RrgPoint,
  RrgQuadrant,
  QUADRANT_META,
  RrgBenchmark,
  RRG_BENCHMARKS,
} from '../utils/rrgCalculator';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Compass,
  Layers,
  Sparkles,
  Info,
  TrendingUp,
  Activity,
  ArrowUpRight,
  Shield,
  Eye,
} from 'lucide-react';

interface D3RrgChartProps {
  items: RrgSecurityData[];
  selectedItemId: string | null;
  hoveredItemId: string | null;
  onSelectItem: (item: RrgSecurityData) => void;
  onHoverItem: (itemId: string | null) => void;
  animStep: number;
  tailLength: number;
  showTails: boolean;
  benchmark: RrgBenchmark;
  isObsidian?: boolean;
  universeMode: string;
  labelMode?: 'ALL' | 'LEADING_ONLY' | 'SELECTED_ONLY';
  showGridLines?: boolean;
  showAxisLabels?: boolean;
}

export const D3RrgChart: React.FC<D3RrgChartProps> = ({
  items,
  selectedItemId,
  hoveredItemId,
  onSelectItem,
  onHoverItem,
  animStep,
  tailLength,
  showTails,
  benchmark,
  isObsidian = true,
  universeMode,
  labelMode = 'ALL',
  showGridLines = true,
  showAxisLabels = true,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomGRef = useRef<SVGGElement | null>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 860,
    height: 640,
  });

  // Tooltip state
  const [tooltipData, setTooltipData] = useState<{
    item: RrgSecurityData;
    headPoint: RrgPoint;
    x: number;
    y: number;
  } | null>(null);

  // Resize observer to keep chart responsive to container width
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        if (width > 300) {
          // Keep a 4:3 or comfortable 16:11 aspect ratio
          const height = Math.max(520, Math.min(720, Math.round(width * 0.72)));
          setDimensions({ width, height });
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Margins
  const margin = useMemo(
    () => ({
      top: 48,
      right: 48,
      bottom: 56,
      left: 58,
    }),
    []
  );

  // Determine domain symmetrically centered around 100
  const { xDomain, yDomain } = useMemo(() => {
    let maxDelta = 12; // Minimum extent (88 to 112)
    items.forEach((item) => {
      item.tailPoints.forEach((pt) => {
        const dX = Math.abs(pt.rsRatio - 100);
        const dY = Math.abs(pt.rsMomentum - 100);
        if (dX > maxDelta) maxDelta = dX;
        if (dY > maxDelta) maxDelta = dY;
      });
    });

    const paddingDelta = Math.ceil(maxDelta) + 2.5;
    const minVal = Number((100 - paddingDelta).toFixed(1));
    const maxVal = Number((100 + paddingDelta).toFixed(1));

    return {
      xDomain: [minVal, maxVal] as [number, number],
      yDomain: [minVal, maxVal] as [number, number],
    };
  }, [items]);

  // D3 Scales
  const xScale = useMemo(() => {
    return d3
      .scaleLinear()
      .domain(xDomain)
      .range([margin.left, dimensions.width - margin.right]);
  }, [xDomain, dimensions.width, margin.left, margin.right]);

  const yScale = useMemo(() => {
    return d3
      .scaleLinear()
      .domain(yDomain)
      .range([dimensions.height - margin.bottom, margin.top]);
  }, [yDomain, dimensions.height, margin.top, margin.bottom]);

  // D3 Smooth Line Generator for historical tails
  const lineGenerator = useMemo(() => {
    return d3
      .line<RrgPoint>()
      .x((d) => xScale(d.rsRatio))
      .y((d) => yScale(d.rsMomentum))
      .curve(d3.curveCatmullRom.alpha(0.5));
  }, [xScale, yScale]);

  // Center benchmark coordinates (100, 100)
  const originX = xScale(100);
  const originY = yScale(100);

  // Setup D3 Zoom behavior
  useEffect(() => {
    if (!svgRef.current || !zoomGRef.current) return;

    const svg = d3.select(svgRef.current);
    const zoomGroup = d3.select(zoomGRef.current);

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.8, 3.5])
      .translateExtent([
        [-dimensions.width * 0.5, -dimensions.height * 0.5],
        [dimensions.width * 1.5, dimensions.height * 1.5],
      ])
      .on('zoom', (event) => {
        zoomGroup.attr('transform', event.transform.toString());
      });

    svg.call(zoom);
    zoomBehaviorRef.current = zoom;

    return () => {
      svg.on('.zoom', null);
    };
  }, [dimensions.width, dimensions.height]);

  // Reset Zoom handler
  const handleResetZoom = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    d3.select(svgRef.current)
      .transition()
      .duration(650)
      .ease(d3.easeCubicOut)
      .call(zoomBehaviorRef.current.transform, d3.zoomIdentity);
  };

  // Zoom In / Out handlers
  const handleZoomBy = (factor: number) => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    d3.select(svgRef.current)
      .transition()
      .duration(350)
      .call(zoomBehaviorRef.current.scaleBy, factor);
  };

  // Grid tick values (centered around 100)
  const gridTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let v = 85; v <= 115; v += 5) {
      if (v >= xDomain[0] && v <= xDomain[1] && v !== 100) {
        ticks.push(v);
      }
    }
    return ticks;
  }, [xDomain]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full rounded-xl overflow-hidden select-none border transition-all ${
        isObsidian
          ? 'bg-[#0a0d14] border-[#1f2738] shadow-2xl'
          : 'bg-[#fafaf8] border-gray-200 shadow-md'
      }`}
    >
      {/* ========================================================================= */}
      {/* D3 RRG TOOLBAR & CONTROL OVERLAYS                                         */}
      {/* ========================================================================= */}
      <div
        className={`px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 border-b text-xs font-mono backdrop-blur-sm ${
          isObsidian
            ? 'bg-[#0f1420]/85 border-[#1f2738] text-gray-300'
            : 'bg-white/85 border-gray-200 text-gray-700'
        }`}
      >
        <div className="flex items-center space-x-2.5">
          <div className="flex items-center space-x-1 px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-black uppercase">
            <Compass className="w-3 h-3" />
            <span>D3.js Interactive Engine</span>
          </div>

          <span className="text-[11px] text-gray-400">
            Center Baseline:{' '}
            <strong className="text-amber-400 font-bold">
              {RRG_BENCHMARKS[benchmark]?.label || 'S&P 500'} (100.0, 100.0)
            </strong>
          </span>
        </div>

        {/* Zoom & Canvas Action Controls */}
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => handleZoomBy(1.25)}
            className={`p-1.5 rounded border transition-colors cursor-pointer ${
              isObsidian
                ? 'bg-slate-800/80 border-slate-700 hover:bg-slate-700 text-gray-200'
                : 'bg-gray-100 border-gray-300 hover:bg-gray-200 text-gray-700'
            }`}
            title="D3 Zoom In (+)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleZoomBy(0.8)}
            className={`p-1.5 rounded border transition-colors cursor-pointer ${
              isObsidian
                ? 'bg-slate-800/80 border-slate-700 hover:bg-slate-700 text-gray-200'
                : 'bg-gray-100 border-gray-300 hover:bg-gray-200 text-gray-700'
            }`}
            title="D3 Zoom Out (-)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleResetZoom}
            className={`px-2 py-1 rounded border text-[10px] font-bold uppercase flex items-center space-x-1 transition-colors cursor-pointer ${
              isObsidian
                ? 'bg-slate-800/80 border-slate-700 hover:bg-slate-700 text-amber-300'
                : 'bg-gray-100 border-gray-300 hover:bg-gray-200 text-amber-700'
            }`}
            title="Reset D3 Zoom and Pan to Center Origin"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MAIN D3 SVG CANVAS                                                        */}
      {/* ========================================================================= */}
      <svg
        ref={svgRef}
        width="100%"
        height={dimensions.height}
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        className="w-full block cursor-grab active:cursor-grabbing select-none"
        onMouseLeave={() => {
          onHoverItem(null);
          setTooltipData(null);
        }}
      >
        <defs>
          {/* Directional Head Markers for Trails */}
          <marker
            id="d3-arrow-leading"
            markerWidth="7"
            markerHeight="7"
            refX="5"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 7 3.5, 0 7" fill="#10b981" />
          </marker>
          <marker
            id="d3-arrow-improving"
            markerWidth="7"
            markerHeight="7"
            refX="5"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 7 3.5, 0 7" fill="#06b6d4" />
          </marker>
          <marker
            id="d3-arrow-weakening"
            markerWidth="7"
            markerHeight="7"
            refX="5"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 7 3.5, 0 7" fill="#f59e0b" />
          </marker>
          <marker
            id="d3-arrow-lagging"
            markerWidth="7"
            markerHeight="7"
            refX="5"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 7 3.5, 0 7" fill="#f43f5e" />
          </marker>

          {/* Quadrant Ambient Gradient Fills */}
          <radialGradient id="d3-grad-leading" cx="85%" cy="15%" r="75%">
            <stop offset="0%" stopColor="#10b981" stopOpacity={isObsidian ? 0.16 : 0.09} />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.01" />
          </radialGradient>
          <radialGradient id="d3-grad-improving" cx="15%" cy="15%" r="75%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity={isObsidian ? 0.16 : 0.09} />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.01" />
          </radialGradient>
          <radialGradient id="d3-grad-lagging" cx="15%" cy="85%" r="75%">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity={isObsidian ? 0.16 : 0.09} />
            <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.01" />
          </radialGradient>
          <radialGradient id="d3-grad-weakening" cx="85%" cy="85%" r="75%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity={isObsidian ? 0.16 : 0.09} />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.01" />
          </radialGradient>

          {/* Subtle Drop Shadow for Nodes */}
          <filter id="d3-node-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.45" />
          </filter>
        </defs>

        {/* Transformable Container for Zoom and Pan */}
        <g ref={zoomGRef}>
          {/* ========================================================================= */}
          {/* 1. QUADRANT BACKGROUND RECTANGLES MAPPED VIA D3 SCALES                    */}
          {/* ========================================================================= */}

          {/* Top-Right: LEADING (RS-Ratio ≥ 100, RS-Momentum ≥ 100) */}
          <rect
            x={originX}
            y={margin.top}
            width={Math.max(0, dimensions.width - margin.right - originX)}
            height={Math.max(0, originY - margin.top)}
            fill="url(#d3-grad-leading)"
          />

          {/* Top-Left: IMPROVING (RS-Ratio < 100, RS-Momentum ≥ 100) */}
          <rect
            x={margin.left}
            y={margin.top}
            width={Math.max(0, originX - margin.left)}
            height={Math.max(0, originY - margin.top)}
            fill="url(#d3-grad-improving)"
          />

          {/* Bottom-Left: LAGGING (RS-Ratio < 100, RS-Momentum < 100) */}
          <rect
            x={margin.left}
            y={originY}
            width={Math.max(0, originX - margin.left)}
            height={Math.max(0, dimensions.height - margin.bottom - originY)}
            fill="url(#d3-grad-lagging)"
          />

          {/* Bottom-Right: WEAKENING (RS-Ratio ≥ 100, RS-Momentum < 100) */}
          <rect
            x={originX}
            y={originY}
            width={Math.max(0, dimensions.width - margin.right - originX)}
            height={Math.max(0, dimensions.height - margin.bottom - originY)}
            fill="url(#d3-grad-weakening)"
          />

          {/* ========================================================================= */}
          {/* 2. QUADRANT WATERMARKS & EDITORIAL LABELS                                 */}
          {/* ========================================================================= */}
          {/* LEADING (Top-Right) */}
          <g transform={`translate(${dimensions.width - margin.right - 14}, ${margin.top + 20})`}>
            <text
              textAnchor="end"
              className="font-mono text-xs font-black tracking-widest uppercase pointer-events-none"
              fill="#10b981"
              fillOpacity={isObsidian ? 0.65 : 0.8}
            >
              LEADING ↗
            </text>
            <text
              y="14"
              textAnchor="end"
              className="font-mono text-[9px] uppercase tracking-wider pointer-events-none"
              fill="#10b981"
              fillOpacity={isObsidian ? 0.45 : 0.6}
            >
              RS ≥ 100 • MOM ≥ 100
            </text>
          </g>

          {/* IMPROVING (Top-Left) */}
          <g transform={`translate(${margin.left + 14}, ${margin.top + 20})`}>
            <text
              textAnchor="start"
              className="font-mono text-xs font-black tracking-widest uppercase pointer-events-none"
              fill="#06b6d4"
              fillOpacity={isObsidian ? 0.65 : 0.8}
            >
              ↖ IMPROVING
            </text>
            <text
              y="14"
              textAnchor="start"
              className="font-mono text-[9px] uppercase tracking-wider pointer-events-none"
              fill="#06b6d4"
              fillOpacity={isObsidian ? 0.45 : 0.6}
            >
              RS &lt; 100 • MOM ≥ 100
            </text>
          </g>

          {/* LAGGING (Bottom-Left) */}
          <g transform={`translate(${margin.left + 14}, ${dimensions.height - margin.bottom - 24})`}>
            <text
              textAnchor="start"
              className="font-mono text-xs font-black tracking-widest uppercase pointer-events-none"
              fill="#f43f5e"
              fillOpacity={isObsidian ? 0.65 : 0.8}
            >
              ↙ LAGGING
            </text>
            <text
              y="14"
              textAnchor="start"
              className="font-mono text-[9px] uppercase tracking-wider pointer-events-none"
              fill="#f43f5e"
              fillOpacity={isObsidian ? 0.45 : 0.6}
            >
              RS &lt; 100 • MOM &lt; 100
            </text>
          </g>

          {/* WEAKENING (Bottom-Right) */}
          <g transform={`translate(${dimensions.width - margin.right - 14}, ${dimensions.height - margin.bottom - 24})`}>
            <text
              textAnchor="end"
              className="font-mono text-xs font-black tracking-widest uppercase pointer-events-none"
              fill="#f59e0b"
              fillOpacity={isObsidian ? 0.65 : 0.8}
            >
              WEAKENING ↘
            </text>
            <text
              y="14"
              textAnchor="end"
              className="font-mono text-[9px] uppercase tracking-wider pointer-events-none"
              fill="#f59e0b"
              fillOpacity={isObsidian ? 0.45 : 0.6}
            >
              RS ≥ 100 • MOM &lt; 100
            </text>
          </g>

          {/* ========================================================================= */}
          {/* 3. CLOCKWISE ROTATION DYNAMICS INDICATORS                                 */}
          {/* ========================================================================= */}
          {showGridLines && (
            <>
              {/* Center concentric rotation guide */}
              <circle
                cx={originX}
                cy={originY}
                r="80"
                fill="none"
                stroke={isObsidian ? '#ffffff' : '#000000'}
                strokeOpacity="0.06"
                strokeDasharray="4 4"
                className="pointer-events-none"
              />

              {/* Clockwise curved guide arcs */}
              <path
                d={`M ${originX + 80} ${originY} A 80 80 0 0 1 ${originX} ${originY + 80}`}
                fill="none"
                stroke="#f59e0b"
                strokeOpacity={isObsidian ? 0.28 : 0.35}
                strokeWidth="1.75"
                strokeDasharray="4 4"
                className="pointer-events-none"
              />
              <path
                d={`M ${originX} ${originY + 80} A 80 80 0 0 1 ${originX - 80} ${originY}`}
                fill="none"
                stroke="#f43f5e"
                strokeOpacity={isObsidian ? 0.28 : 0.35}
                strokeWidth="1.75"
                strokeDasharray="4 4"
                className="pointer-events-none"
              />
              <path
                d={`M ${originX - 80} ${originY} A 80 80 0 0 1 ${originX} ${originY - 80}`}
                fill="none"
                stroke="#06b6d4"
                strokeOpacity={isObsidian ? 0.28 : 0.35}
                strokeWidth="1.75"
                strokeDasharray="4 4"
                className="pointer-events-none"
              />
              <path
                d={`M ${originX} ${originY - 80} A 80 80 0 0 1 ${originX + 80} ${originY}`}
                fill="none"
                stroke="#10b981"
                strokeOpacity={isObsidian ? 0.28 : 0.35}
                strokeWidth="1.75"
                strokeDasharray="4 4"
                className="pointer-events-none"
              />
            </>
          )}

          {/* ========================================================================= */}
          {/* 4. D3 GRID TICKS & GUIDES                                                 */}
          {/* ========================================================================= */}
          {gridTicks.map((val) => {
            const gx = xScale(val);
            const gy = yScale(val);
            return (
              <g key={`grid-tick-${val}`} className="pointer-events-none">
                {/* Vertical tick guide line */}
                {showGridLines && (
                  <line
                    x1={gx}
                    y1={margin.top}
                    x2={gx}
                    y2={dimensions.height - margin.bottom}
                    stroke={isObsidian ? '#ffffff' : '#000000'}
                    strokeOpacity={isObsidian ? 0.05 : 0.06}
                    strokeDasharray="2 4"
                  />
                )}
                {/* Vertical tick coordinate label */}
                {showAxisLabels && (
                  <text
                    x={gx}
                    y={dimensions.height - margin.bottom + 16}
                    textAnchor="middle"
                    className="font-mono text-[9px]"
                    fill={isObsidian ? '#737f94' : '#6b7280'}
                  >
                    {val}
                  </text>
                )}

                {/* Horizontal tick guide line */}
                {showGridLines && (
                  <line
                    x1={margin.left}
                    y1={gy}
                    x2={dimensions.width - margin.right}
                    y2={gy}
                    stroke={isObsidian ? '#ffffff' : '#000000'}
                    strokeOpacity={isObsidian ? 0.05 : 0.06}
                    strokeDasharray="2 4"
                  />
                )}
                {/* Horizontal tick coordinate label */}
                {showAxisLabels && (
                  <text
                    x={margin.left - 10}
                    y={gy + 3}
                    textAnchor="end"
                    className="font-mono text-[9px]"
                    fill={isObsidian ? '#737f94' : '#6b7280'}
                  >
                    {val}
                  </text>
                )}
              </g>
            );
          })}

          {/* ========================================================================= */}
          {/* 5. PRIMARY BENCHMARK ORIGIN AXES (100, 100)                               */}
          {/* ========================================================================= */}
          {/* Center Vertical Axis (RS-Ratio = 100) */}
          <line
            x1={originX}
            y1={margin.top}
            x2={originX}
            y2={dimensions.height - margin.bottom}
            stroke={isObsidian ? '#ffffff' : '#1e293b'}
            strokeOpacity={isObsidian ? 0.4 : 0.5}
            strokeWidth="1.5"
          />

          {/* Center Horizontal Axis (RS-Momentum = 100) */}
          <line
            x1={margin.left}
            y1={originY}
            x2={dimensions.width - margin.right}
            y2={originY}
            stroke={isObsidian ? '#ffffff' : '#1e293b'}
            strokeOpacity={isObsidian ? 0.4 : 0.5}
            strokeWidth="1.5"
          />

          {/* Origin Badges (100) */}
          {showAxisLabels && (
            <>
              <g transform={`translate(${originX}, ${dimensions.height - margin.bottom + 16})`}>
                <rect
                  x="-16"
                  y="-10"
                  width="32"
                  height="16"
                  rx="3"
                  fill="#f59e0b"
                />
                <text
                  textAnchor="middle"
                  y="2"
                  className="font-mono text-[10px] font-black"
                  fill="#0b0e14"
                >
                  100
                </text>
              </g>

              <g transform={`translate(${margin.left - 18}, ${originY})`}>
                <rect
                  x="-16"
                  y="-8"
                  width="28"
                  height="16"
                  rx="3"
                  fill="#f59e0b"
                />
                <text
                  textAnchor="middle"
                  y="4"
                  className="font-mono text-[10px] font-black"
                  fill="#0b0e14"
                >
                  100
                </text>
              </g>
            </>
          )}

          {/* Center Benchmark Origin Target Dot */}
          <circle
            cx={originX}
            cy={originY}
            r="4"
            fill="#f59e0b"
            stroke="#ffffff"
            strokeWidth="1.5"
          />

          {/* ========================================================================= */}
          {/* 6. TRAILING VECTORS & D3 ROTATIONAL PATHS                                  */}
          {/* ========================================================================= */}
          {items.map((item) => {
            const isSelected = item.id === selectedItemId;
            const isHovered = item.id === hoveredItemId;
            const isProminent = isSelected || isHovered;

            // Trim points to current animation step
            const currentTail = item.tailPoints.slice(0, animStep + 1);
            const headPoint =
              currentTail[currentTail.length - 1] ||
              item.tailPoints[item.tailPoints.length - 1];

            const headX = xScale(headPoint.rsRatio);
            const headY = yScale(headPoint.rsMomentum);

            const quadMeta = QUADRANT_META[item.quadrant];
            const markerId = `d3-arrow-${item.quadrant.toLowerCase()}`;

            // Generate SVG path string with D3
            const d3PathString = showTails && currentTail.length > 1
              ? lineGenerator(currentTail) || ''
              : '';

            // Should show label?
            let showLabel = true;
            if (labelMode === 'LEADING_ONLY') {
              showLabel = item.quadrant === 'LEADING' || isProminent;
            } else if (labelMode === 'SELECTED_ONLY') {
              showLabel = isProminent;
            }

            return (
              <g
                key={item.id}
                className="cursor-pointer transition-all duration-150"
                opacity={selectedItemId && !isProminent ? 0.35 : 1}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectItem(item);
                }}
                onMouseEnter={(e) => {
                  onHoverItem(item.id);
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (rect) {
                    setTooltipData({
                      item,
                      headPoint,
                      x: headX,
                      y: headY,
                    });
                  }
                }}
                onMouseLeave={() => {
                  onHoverItem(null);
                  setTooltipData(null);
                }}
              >
                {/* D3 Curved Tail Trajectory Line */}
                {showTails && d3PathString && (
                  <path
                    d={d3PathString}
                    fill="none"
                    stroke={quadMeta.themeColor}
                    strokeWidth={isProminent ? 3.5 : item.isWatchlistSector ? 2.5 : 1.8}
                    strokeOpacity={isProminent ? 1.0 : item.isWatchlistSector ? 0.85 : 0.55}
                    markerEnd={`url(#${markerId})`}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Historical Step Dots */}
                {showTails &&
                  currentTail.slice(0, -1).map((pt, idx) => (
                    <circle
                      key={`${item.id}-step-${idx}`}
                      cx={xScale(pt.rsRatio)}
                      cy={yScale(pt.rsMomentum)}
                      r={isProminent ? 3 : item.isWatchlistSector ? 2.5 : 2}
                      fill={quadMeta.themeColor}
                      fillOpacity={((idx + 1) / currentTail.length) * 0.75}
                      stroke={isObsidian ? '#0f1420' : '#ffffff'}
                      strokeWidth="0.5"
                    />
                  ))}

                {/* Selection Ping Animation Ring */}
                {isProminent && (
                  <circle
                    cx={headX}
                    cy={headY}
                    r="14"
                    fill="none"
                    stroke={quadMeta.themeColor}
                    strokeWidth="2.5"
                    strokeOpacity="0.8"
                    className="animate-ping pointer-events-none"
                  />
                )}

                {/* Active Head Node */}
                <circle
                  cx={headX}
                  cy={headY}
                  r={isProminent ? 7.5 : item.isWatchlistSector ? 6.5 : 5}
                  fill={quadMeta.themeColor}
                  stroke="#ffffff"
                  strokeWidth={isProminent ? 2.5 : 1.5}
                  filter="url(#d3-node-shadow)"
                  className="transition-transform"
                />

                {/* Watchlist Sector Special Star or Indicator Badge */}
                {item.isWatchlistSector && (
                  <circle
                    cx={headX}
                    cy={headY}
                    r="2.5"
                    fill="#0f1420"
                    className="pointer-events-none"
                  />
                )}

                {/* Text Label at Node Head */}
                {showLabel && (
                  <g transform={`translate(${headX + 9}, ${headY + 3.5})`} className="pointer-events-none">
                    <text
                      className={`font-mono font-black ${
                        isProminent ? 'text-xs' : 'text-[11px]'
                      }`}
                      fill={isProminent ? '#ffffff' : quadMeta.themeColor}
                      stroke={isObsidian ? '#000000' : '#ffffff'}
                      strokeWidth={isObsidian ? '3' : '2.5'}
                      paintOrder="stroke"
                    >
                      {item.ticker}
                      {item.isWatchlistSector && item.watchlistCount
                        ? ` (${item.watchlistCount})`
                        : ''}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>

        {/* ========================================================================= */}
        {/* AXIS LABELS (Fixed, not zoomed)                                           */}
        {/* ========================================================================= */}
        {showAxisLabels && (
          <>
            {/* X-Axis Title */}
            <text
              x={dimensions.width / 2}
              y={dimensions.height - 12}
              textAnchor="middle"
              className="font-mono text-[11px] font-bold uppercase tracking-wider pointer-events-none"
              fill={isObsidian ? '#b3becd' : '#475569'}
            >
              JdK RS-Ratio™ (Relative Trend vs Benchmark: &gt;100 = Outperforming) →
            </text>

            {/* Y-Axis Title */}
            <text
              x={16}
              y={dimensions.height / 2}
              textAnchor="middle"
              transform={`rotate(-90 16 ${dimensions.height / 2})`}
              className="font-mono text-[11px] font-bold uppercase tracking-wider pointer-events-none"
              fill={isObsidian ? '#b3becd' : '#475569'}
            >
              ↑ JdK RS-Momentum™ (Relative Rate of Change: &gt;100 = Accelerating)
            </text>
          </>
        )}
      </svg>

      {/* ========================================================================= */}
      {/* FLOATING HOVER TOOLTIP CARD                                               */}
      {/* ========================================================================= */}
      {tooltipData && (
        <div
          className={`absolute pointer-events-none z-30 p-3 rounded-lg border shadow-2xl backdrop-blur-md font-mono text-xs w-64 transition-all duration-75 ${
            isObsidian
              ? 'bg-[#121722]/95 border-[#2b3548] text-gray-200'
              : 'bg-white/95 border-gray-300 text-gray-900 shadow-xl'
          }`}
          style={{
            left: Math.min(dimensions.width - 270, Math.max(16, tooltipData.x - 120)),
            top: tooltipData.y > dimensions.height - 200 ? tooltipData.y - 170 : tooltipData.y + 16,
          }}
        >
          <div className="flex items-center justify-between border-b pb-1.5 mb-1.5 border-white/10">
            <div className="flex items-center space-x-1.5">
              <span className="font-black text-amber-400 text-sm">
                {tooltipData.item.ticker}
              </span>
              {tooltipData.item.isWatchlistSector && (
                <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase font-bold">
                  Watchlist Sector
                </span>
              )}
            </div>

            <span
              className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                QUADRANT_META[tooltipData.item.quadrant].badgeBg
              } ${QUADRANT_META[tooltipData.item.quadrant].badgeText} border ${
                QUADRANT_META[tooltipData.item.quadrant].badgeBorder
              }`}
            >
              {tooltipData.item.quadrant}
            </span>
          </div>

          <div className="text-[11px] font-sans text-gray-300 line-clamp-1 mb-2">
            {tooltipData.item.name}
          </div>

          <div className="grid grid-cols-2 gap-1.5 text-[10px] py-1 bg-black/20 rounded p-1.5 mb-2">
            <div>
              <span className="text-gray-400">RS-Ratio:</span>{' '}
              <strong className="text-white font-bold">
                {tooltipData.headPoint.rsRatio.toFixed(2)}
              </strong>
            </div>
            <div>
              <span className="text-gray-400">Momentum:</span>{' '}
              <strong className="text-white font-bold">
                {tooltipData.headPoint.rsMomentum.toFixed(2)}
              </strong>
            </div>
            <div>
              <span className="text-gray-400">Heading:</span>{' '}
              <strong className="text-amber-400 font-bold">
                {tooltipData.item.headingAngle}° ({tooltipData.item.headingDirection})
              </strong>
            </div>
            <div>
              <span className="text-gray-400">Velocity:</span>{' '}
              <strong className="text-emerald-400 font-bold">
                {tooltipData.item.velocity.toFixed(2)}
              </strong>
            </div>
          </div>

          {tooltipData.item.constituentStocks && tooltipData.item.constituentStocks.length > 0 && (
            <div className="text-[10px] text-gray-400 border-t border-white/10 pt-1.5">
              <span className="text-amber-300 font-bold">Watchlist Constituents:</span>{' '}
              {tooltipData.item.constituentStocks.map((s) => s.ticker).join(', ')}
            </div>
          )}

          <div className="text-[9px] text-gray-400 italic mt-1.5 text-center">
            Click to inspect detailed sector metrics &amp; sound
          </div>
        </div>
      )}
    </div>
  );
};
