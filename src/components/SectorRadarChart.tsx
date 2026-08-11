import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { SectorAggregate } from './SectorStrengthView';
import { Layers, Activity, Zap, Info, Sliders, ChevronDown, Compass, Award } from 'lucide-react';

export interface RadarAxis {
  key: string;
  label: string;
  description: string;
}

export interface RadarSeries {
  id: string;
  name: string;
  color: string;
  fillColor: string;
  isBenchmark?: boolean;
  values: Record<string, number>; // key -> value (0 - 100)
}

interface SectorRadarChartProps {
  sectorAggregates: SectorAggregate[];
  selectedSectorName?: string | null;
  onSelectSector?: (sectorName: string) => void;
}

// Fixed Major Market Index Benchmarks for Relative Comparison
const MAJOR_INDEX_BENCHMARKS: Record<string, Record<string, number>> = {
  'S&P 500 / Nifty 50 Broad Market': {
    momentum: 62,
    rsScore: 60,
    moneyFlow: 58,
    vcpQuality: 52,
    breadth: 55,
    alpha: 50,
  },
  'Nasdaq 100 Growth Index': {
    momentum: 78,
    rsScore: 80,
    moneyFlow: 75,
    vcpQuality: 65,
    breadth: 68,
    alpha: 72,
  },
  'Russell 2000 Small Cap Index': {
    momentum: 48,
    rsScore: 45,
    moneyFlow: 42,
    vcpQuality: 40,
    breadth: 38,
    alpha: 40,
  },
};

const RADAR_AXES: RadarAxis[] = [
  { key: 'momentum', label: 'Price Momentum', description: 'Average % change & short-term trend strength' },
  { key: 'rsScore', label: 'Industry RS Rating', description: 'Relative strength percentile (0 - 99)' },
  { key: 'moneyFlow', label: 'Institutional Flow', description: 'Accumulation vs Distribution index' },
  { key: 'vcpQuality', label: 'VCP Base Tightness', description: 'Volume dry-up & volatility contraction' },
  { key: 'breadth', label: 'SEPA Setup Ratio', description: '% of stocks in Stage 2 with 8/8 score' },
  { key: 'alpha', label: 'Alpha vs Market', description: 'Outperformance spread vs benchmark' },
];

export const SectorRadarChart: React.FC<SectorRadarChartProps> = ({
  sectorAggregates,
  selectedSectorName,
  onSelectSector,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Active sector selection
  const activeSector = useMemo(() => {
    if (selectedSectorName) {
      const found = sectorAggregates.find(
        (s) => s.sector.toLowerCase() === selectedSectorName.toLowerCase()
      );
      if (found) return found;
    }
    return sectorAggregates[0] || null;
  }, [sectorAggregates, selectedSectorName]);

  const [compareSectorName, setCompareSectorName] = useState<string>('');
  const [selectedBenchmark, setSelectedBenchmark] = useState<string>('S&P 500 / Nifty 50 Broad Market');
  const [tooltipData, setTooltipData] = useState<{
    axisLabel: string;
    description: string;
    seriesData: { name: string; value: number; color: string }[];
    x: number;
    y: number;
  } | null>(null);

  const compareSector = useMemo(() => {
    if (!compareSectorName) return null;
    return sectorAggregates.find((s) => s.sector === compareSectorName) || null;
  }, [sectorAggregates, compareSectorName]);

  // Transform sector aggregate into 0-100 radar metric values
  const getSectorRadarMetrics = (sec: SectorAggregate): Record<string, number> => {
    // Momentum: map avgChange (-4% to +4%) -> (0 to 100)
    const momentum = Math.min(100, Math.max(0, Math.round(50 + sec.avgChange * 10)));
    // RS Score: direct 0-99
    const rsScore = Math.min(99, Math.max(0, sec.rsScore));
    // Money Flow Index: 0-100
    const moneyFlow = Math.min(100, Math.max(0, sec.moneyFlowIndex));
    // VCP Base Tightness: avgDryUp (-70% to 0%) -> (100 to 0)
    const dryUpVal = Math.abs(sec.avgDryUp);
    const vcpQuality = Math.min(100, Math.max(0, Math.round((dryUpVal / 65) * 100)));
    // Breadth: qualified ratio %
    const breadth = Math.min(100, Math.max(0, Math.round((sec.qualifiedCount / (sec.stockCount || 1)) * 100)));
    // Alpha vs Market: relative to +0.5% benchmark
    const alpha = Math.min(100, Math.max(0, Math.round(50 + (sec.avgChange - 0.5) * 12)));

    return {
      momentum,
      rsScore,
      moneyFlow,
      vcpQuality,
      breadth,
      alpha,
    };
  };

  // Build series list for radar chart rendering
  const radarSeriesList = useMemo<RadarSeries[]>(() => {
    const list: RadarSeries[] = [];

    if (activeSector) {
      list.push({
        id: `sector-${activeSector.sector}`,
        name: `${activeSector.sector} (Selected Sector)`,
        color: '#10b981', // Emerald-500
        fillColor: 'rgba(16, 185, 129, 0.25)',
        values: getSectorRadarMetrics(activeSector),
      });
    }

    if (compareSector) {
      list.push({
        id: `sector-comp-${compareSector.sector}`,
        name: `${compareSector.sector} (Comparison Sector)`,
        color: '#ec4899', // Pink-500
        fillColor: 'rgba(236, 72, 153, 0.2)',
        values: getSectorRadarMetrics(compareSector),
      });
    }

    if (selectedBenchmark && MAJOR_INDEX_BENCHMARKS[selectedBenchmark]) {
      list.push({
        id: `benchmark-${selectedBenchmark}`,
        name: `${selectedBenchmark}`,
        color: '#3b82f6', // Blue-500
        fillColor: 'rgba(59, 130, 246, 0.12)',
        isBenchmark: true,
        values: MAJOR_INDEX_BENCHMARKS[selectedBenchmark],
      });
    }

    return list;
  }, [activeSector, compareSector, selectedBenchmark]);

  // Render D3 Radar Chart
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 480;
    const height = 380;
    const margin = 50;
    const radius = Math.min(width, height) / 2 - margin;
    const centerX = width / 2;
    const centerY = height / 2;

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg
      .append('g')
      .attr('transform', `translate(${centerX}, ${centerY})`);

    const axes = RADAR_AXES;
    const numAxes = axes.length;
    const angleSlice = (Math.PI * 2) / numAxes;

    // Scale from 0 to 100 -> 0 to radius
    const rScale = d3.scaleLinear().domain([0, 100]).range([0, radius]);

    // Draw background concentric grid polygons (levels: 20%, 40%, 60%, 80%, 100%)
    const levels = [20, 40, 60, 80, 100];
    levels.forEach((level) => {
      const levelRadius = rScale(level);
      const points: [number, number][] = axes.map((_, i) => {
        const angle = i * angleSlice - Math.PI / 2;
        return [levelRadius * Math.cos(angle), levelRadius * Math.sin(angle)];
      });

      // Polygon outline
      const lineGenerator = d3.line().curve(d3.curveLinearClosed);
      g.append('path')
        .datum(points)
        .attr('d', lineGenerator as any)
        .attr('fill', level === 100 ? 'rgba(15, 23, 42, 0.6)' : 'none')
        .attr('stroke', '#334155')
        .attr('stroke-dasharray', level === 100 ? 'none' : '2,2')
        .attr('stroke-width', level === 100 ? 1.5 : 1);

      // Level Label
      g.append('text')
        .attr('x', 5)
        .attr('y', -levelRadius + 3)
        .attr('fill', '#64748b')
        .attr('font-size', '8px')
        .attr('font-family', 'monospace')
        .attr('font-weight', 'bold')
        .text(`${level}%`);
    });

    // Draw radial axis lines and outer labels
    axes.forEach((axis, i) => {
      const angle = i * angleSlice - Math.PI / 2;
      const lineX = radius * Math.cos(angle);
      const lineY = radius * Math.sin(angle);

      // Axis ray line
      g.append('line')
        .attr('x1', 0)
        .attr('y1', 0)
        .attr('x2', lineX)
        .attr('y2', lineY)
        .attr('stroke', '#475569')
        .attr('stroke-width', 1);

      // Axis outer label text positioning
      const labelRadius = radius + 22;
      const labelX = labelRadius * Math.cos(angle);
      const labelY = labelRadius * Math.sin(angle);

      let textAnchor = 'middle';
      if (Math.abs(labelX) > 10) {
        textAnchor = labelX > 0 ? 'start' : 'end';
      }

      const labelGroup = g
        .append('g')
        .attr('transform', `translate(${labelX}, ${labelY})`)
        .attr('class', 'cursor-pointer')
        .on('mouseenter', (event) => {
          const seriesData = radarSeriesList.map((s) => ({
            name: s.name,
            value: s.values[axis.key] || 0,
            color: s.color,
          }));
          const rect = containerRef.current?.getBoundingClientRect();
          if (rect) {
            setTooltipData({
              axisLabel: axis.label,
              description: axis.description,
              seriesData,
              x: event.clientX - rect.left,
              y: event.clientY - rect.top,
            });
          }
        })
        .on('mouseleave', () => setTooltipData(null));

      labelGroup
        .append('text')
        .attr('text-anchor', textAnchor)
        .attr('dy', '0.35em')
        .attr('fill', '#f1f5f9')
        .attr('font-size', '10px')
        .attr('font-family', 'sans-serif')
        .attr('font-weight', 'bold')
        .text(axis.label);
    });

    // Draw series data polygons
    radarSeriesList.forEach((series) => {
      const points: [number, number][] = axes.map((axis, i) => {
        const val = Math.min(100, Math.max(0, series.values[axis.key] || 0));
        const angle = i * angleSlice - Math.PI / 2;
        const r = rScale(val);
        return [r * Math.cos(angle), r * Math.sin(angle)];
      });

      const lineGenerator = d3.line().curve(d3.curveLinearClosed);

      // Polygon Area Fill
      g.append('path')
        .datum(points)
        .attr('d', lineGenerator as any)
        .attr('fill', series.fillColor)
        .attr('stroke', series.color)
        .attr('stroke-width', series.isBenchmark ? 1.8 : 2.5)
        .attr('stroke-dasharray', series.isBenchmark ? '4,3' : 'none')
        .attr('class', 'transition-all duration-300');

      // Vertex Markers
      points.forEach(([px, py], i) => {
        const axis = axes[i];
        const val = series.values[axis.key] || 0;

        g.append('circle')
          .attr('cx', px)
          .attr('cy', py)
          .attr('r', series.isBenchmark ? 3 : 4)
          .attr('fill', series.color)
          .attr('stroke', '#0f172a')
          .attr('stroke-width', 1.5)
          .attr('class', 'cursor-pointer hover:scale-125 transition-transform')
          .on('mouseenter', (event) => {
            const seriesData = radarSeriesList.map((s) => ({
              name: s.name,
              value: s.values[axis.key] || 0,
              color: s.color,
            }));
            const rect = containerRef.current?.getBoundingClientRect();
            if (rect) {
              setTooltipData({
                axisLabel: axis.label,
                description: axis.description,
                seriesData,
                x: event.clientX - rect.left,
                y: event.clientY - rect.top,
              });
            }
          })
          .on('mouseleave', () => setTooltipData(null));
      });
    });
  }, [radarSeriesList]);

  // Sector relative strength rank badge
  const activeSectorMetrics = activeSector ? getSectorRadarMetrics(activeSector) : null;
  const benchmarkMetrics = selectedBenchmark ? MAJOR_INDEX_BENCHMARKS[selectedBenchmark] : null;

  let overallSectorScore = 0;
  let benchmarkScore = 0;
  if (activeSectorMetrics) {
    overallSectorScore = Math.round(
      Object.values(activeSectorMetrics).reduce((a, b) => a + b, 0) / RADAR_AXES.length
    );
  }
  if (benchmarkMetrics) {
    benchmarkScore = Math.round(
      Object.values(benchmarkMetrics).reduce((a, b) => a + b, 0) / RADAR_AXES.length
    );
  }

  const alphaDiff = overallSectorScore - benchmarkScore;

  return (
    <div className="bg-[#161b22] border border-[#30363d] p-5 space-y-4 shadow-xl font-mono relative">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#30363d] pb-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-emerald-950/80 text-emerald-400 border border-emerald-700/60">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                D3 Multi-Dimensional Relative Strength Engine
              </span>
              <span className="bg-purple-950 text-purple-300 text-[9px] px-1.5 py-0.2 uppercase border border-purple-700 font-bold">
                Radar Matrix
              </span>
            </div>
            <h4 className="text-base font-serif font-black text-white mt-0.5">
              Sector Rotation vs Major Market Indices
            </h4>
          </div>
        </div>

        {/* Selected Sector & Benchmark Badge */}
        <div className="flex items-center space-x-2 text-xs">
          <span className="px-2.5 py-1 bg-emerald-950 text-emerald-300 border border-emerald-700 font-bold">
            {activeSector?.sector || 'All Sectors'}: {overallSectorScore}/100 Score
          </span>
          <span className={`px-2.5 py-1 font-bold border ${
            alphaDiff >= 0
              ? 'bg-emerald-900 text-emerald-200 border-emerald-500'
              : 'bg-rose-950 text-rose-300 border-rose-700'
          }`}>
            {alphaDiff >= 0 ? `+${alphaDiff} Alpha vs Index` : `${alphaDiff} Alpha vs Index`}
          </span>
        </div>
      </div>

      {/* Control Bar: Select Sector to Compare & Benchmark Index */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#0e1117] p-3 border border-[#30363d] text-xs">
        {/* Primary Selected Sector Dropdown */}
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-gray-400 block">
            Primary Sector:
          </label>
          <select
            value={activeSector?.sector || ''}
            onChange={(e) => {
              if (onSelectSector) onSelectSector(e.target.value);
            }}
            className="w-full bg-[#161b22] border border-[#30363d] text-emerald-400 font-bold px-2.5 py-1.5 focus:outline-none focus:border-emerald-500"
          >
            {sectorAggregates.map((sec) => (
              <option key={sec.sector} value={sec.sector}>
                #{sec.rank} {sec.sector} (RS {sec.rsScore})
              </option>
            ))}
          </select>
        </div>

        {/* Benchmark Index Selector Dropdown */}
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-gray-400 block">
            Compare Market Benchmark:
          </label>
          <select
            value={selectedBenchmark}
            onChange={(e) => setSelectedBenchmark(e.target.value)}
            className="w-full bg-[#161b22] border border-[#30363d] text-sky-400 font-bold px-2.5 py-1.5 focus:outline-none focus:border-sky-500"
          >
            {Object.keys(MAJOR_INDEX_BENCHMARKS).map((benchName) => (
              <option key={benchName} value={benchName}>
                {benchName}
              </option>
            ))}
          </select>
        </div>

        {/* Optional 2nd Sector Comparison Dropdown */}
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-gray-400 block">
            Optional 2nd Sector Compare:
          </label>
          <select
            value={compareSectorName}
            onChange={(e) => setCompareSectorName(e.target.value)}
            className="w-full bg-[#161b22] border border-[#30363d] text-pink-400 font-bold px-2.5 py-1.5 focus:outline-none focus:border-pink-500"
          >
            <option value="">None (Benchmark Only)</option>
            {sectorAggregates
              .filter((s) => s.sector !== activeSector?.sector)
              .map((sec) => (
                <option key={sec.sector} value={sec.sector}>
                  #{sec.rank} {sec.sector}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Main D3 Radar Chart Container */}
      <div
        ref={containerRef}
        className="relative flex flex-col md:flex-row items-center justify-center gap-6 bg-[#0e1117] p-4 border border-[#30363d]"
      >
        <div className="w-full max-w-[480px] h-[380px] flex items-center justify-center">
          <svg ref={svgRef} className="w-full h-full overflow-visible" />
        </div>

        {/* Legend & Breakdown Panel */}
        <div className="w-full md:w-64 space-y-3 font-mono text-xs border-t md:border-t-0 md:border-l border-[#30363d] pt-4 md:pt-0 md:pl-5">
          <span className="text-[10px] uppercase font-bold text-gray-400 block border-b border-[#30363d] pb-1">
            Series Legend & Factor Weights
          </span>

          {radarSeriesList.map((series) => (
            <div
              key={series.id}
              className="p-2.5 bg-[#161b22] border border-[#30363d] space-y-1.5"
            >
              <div className="flex items-center space-x-2">
                <span
                  className="w-3 h-3 inline-block rounded-xs border"
                  style={{ backgroundColor: series.color, borderColor: series.color }}
                />
                <span className="font-bold text-white text-[11px] truncate">
                  {series.name}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-1 text-[9px] text-gray-400 pt-1 border-t border-gray-800">
                <span>Momentum: <strong className="text-white">{series.values.momentum}</strong></span>
                <span>Industry RS: <strong className="text-amber-300">{series.values.rsScore}</strong></span>
                <span>Money Flow: <strong className="text-emerald-400">{series.values.moneyFlow}</strong></span>
                <span>VCP Base: <strong className="text-teal-300">{series.values.vcpQuality}</strong></span>
              </div>
            </div>
          ))}

          {/* Key Insight Box */}
          <div className="p-2.5 bg-purple-950/40 border border-purple-800/60 text-[10px] text-purple-200 space-y-1 font-sans">
            <div className="flex items-center space-x-1 font-mono font-bold text-amber-300">
              <Award className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span>SEPA Sector Rotation Tip:</span>
            </div>
            <p className="leading-snug">
              Look for sectors where the green polygon expands far beyond the blue dashed market benchmark along the <strong>Industry RS</strong> and <strong>Institutional Flow</strong> axes.
            </p>
          </div>
        </div>

        {/* Hover Tooltip */}
        {tooltipData && (
          <div
            className="absolute z-20 bg-slate-900 border border-emerald-500 p-2.5 text-white font-mono text-[10px] space-y-1 shadow-2xl pointer-events-none"
            style={{
              left: Math.min(320, Math.max(10, tooltipData.x + 15)),
              top: Math.min(300, Math.max(10, tooltipData.y + 15)),
            }}
          >
            <strong className="text-emerald-400 uppercase block border-b border-gray-800 pb-1">
              {tooltipData.axisLabel}
            </strong>
            <p className="text-[9px] text-gray-400 italic">{tooltipData.description}</p>
            <div className="space-y-0.5 pt-1">
              {tooltipData.seriesData.map((s, idx) => (
                <div key={idx} className="flex justify-between items-center space-x-3">
                  <span className="flex items-center space-x-1" style={{ color: s.color }}>
                    <span>●</span>
                    <span className="text-gray-200 truncate max-w-[120px]">{s.name}:</span>
                  </span>
                  <strong className="text-white font-black">{s.value} / 100</strong>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
