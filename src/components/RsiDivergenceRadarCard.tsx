import React, { useState } from 'react';
import { MinerviniTradeSetup, DetectedRsiDivergence } from '../types';
import {
  simulateRsiDivergence,
  dispatchRsiDivergenceNotification
} from '../utils/technicalIndicatorsCalculator';
import { getCurrencySymbol } from '../utils/sepaCalculator';
import {
  Zap,
  TrendingUp,
  TrendingDown,
  Bell,
  CheckCircle2,
  AlertTriangle,
  Target,
  ArrowRight,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Info,
  Radio,
  SlidersHorizontal
} from 'lucide-react';

interface RsiDivergenceRadarCardProps {
  stock: MinerviniTradeSetup;
  divergences: DetectedRsiDivergence[];
  activeDivergence: DetectedRsiDivergence | null;
  autoToastEnabled: boolean;
  onToggleAutoToast: () => void;
  onTriggerToast: (divergence?: DetectedRsiDivergence) => void;
}

export const RsiDivergenceRadarCard: React.FC<RsiDivergenceRadarCardProps> = ({
  stock,
  divergences,
  activeDivergence,
  autoToastEnabled,
  onToggleAutoToast,
  onTriggerToast
}) => {
  const [showHistoryTable, setShowHistoryTable] = useState(false);
  const [toastFeedback, setToastFeedback] = useState<string | null>(null);

  const currencySymbol = getCurrencySymbol(stock.exchange);

  const handleManualTrigger = (div?: DetectedRsiDivergence) => {
    onTriggerToast(div);
    setToastFeedback(
      `Toast notification triggered for ${div ? div.title : 'Active RSI Divergence'}!`
    );
    setTimeout(() => setToastFeedback(null), 3500);
  };

  const handleSimulateBullish = () => {
    const sim = simulateRsiDivergence(stock, 'BULLISH');
    dispatchRsiDivergenceNotification(stock, sim);
    setToastFeedback('Simulated RSI Bullish Divergence Toast Triggered!');
    setTimeout(() => setToastFeedback(null), 3500);
  };

  const handleSimulateBearish = () => {
    const sim = simulateRsiDivergence(stock, 'BEARISH');
    dispatchRsiDivergenceNotification(stock, sim);
    setToastFeedback('Simulated RSI Bearish Divergence Toast Triggered!');
    setTimeout(() => setToastFeedback(null), 3500);
  };

  const isBullish = activeDivergence?.type === 'BULLISH';
  const isBearish = activeDivergence?.type === 'BEARISH';

  return (
    <div
      id="rsi-divergence-radar-card"
      className="bg-white border border-[#e5e4e1] p-4 sm:p-5 font-mono space-y-4 shadow-xs"
    >
      {/* Top Banner Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e4e1] pb-3.5">
        <div className="flex items-center space-x-2.5">
          <div
            className={`w-8 h-8 flex items-center justify-center font-black ${
              isBullish
                ? 'bg-emerald-600 text-white'
                : isBearish
                ? 'bg-rose-600 text-white'
                : 'bg-amber-600 text-white'
            }`}
          >
            <Zap className="w-4 h-4" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#1a1a1a]">
                RSI Divergence Radar & Toast Notification Alert Station
              </h4>
              {activeDivergence && (
                <span
                  className={`text-[9px] font-black uppercase px-2 py-0.5 ${
                    isBullish
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-rose-100 text-rose-800 border border-rose-300'
                  }`}
                >
                  {activeDivergence.type} DIVERGENCE ACTIVE
                </span>
              )}
            </div>
            <p className="text-[10px] text-gray-500 font-sans">
              Real-time swing divergence scanner comparing price higher/lower extremes against Wilder's 14-period RSI momentum.
            </p>
          </div>
        </div>

        {/* Global Controls & Auto-Toast Toggle */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            onClick={onToggleAutoToast}
            className={`px-3 py-1 border text-[11px] font-bold uppercase tracking-wider transition-colors flex items-center space-x-1.5 cursor-pointer ${
              autoToastEnabled
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                : 'bg-gray-100 text-gray-500 border-gray-300 hover:bg-gray-200'
            }`}
            title="Automatically dispatch toast when viewing a stock with active divergence"
          >
            <Radio className={`w-3.5 h-3.5 ${autoToastEnabled ? 'text-emerald-600 animate-pulse' : 'text-gray-400'}`} />
            <span>Auto Toast: {autoToastEnabled ? 'ENABLED' : 'DISABLED'}</span>
          </button>

          <button
            onClick={() => handleManualTrigger(activeDivergence || undefined)}
            className="px-3.5 py-1 bg-[#1a1a1a] hover:bg-black text-amber-300 border border-amber-500/50 text-[11px] font-bold uppercase tracking-wider flex items-center space-x-1.5 transition-all cursor-pointer shadow-xs"
            title="Immediately trigger real-time toast banner for the selected stock's divergence"
          >
            <Bell className="w-3.5 h-3.5 text-amber-400" />
            <span>Trigger Toast Notification</span>
          </button>
        </div>
      </div>

      {/* Instant Feedback Notice */}
      {toastFeedback && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 px-3 py-2 text-xs flex items-center justify-between animate-fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="font-bold">{toastFeedback}</span>
          </div>
          <span className="text-[10px] text-emerald-600">See top-right notification banner</span>
        </div>
      )}

      {/* Active Divergence Deep Dive Card */}
      {activeDivergence ? (
        <div
          className={`p-4 border ${
            isBullish
              ? 'bg-[#0a1815]/5 border-emerald-300'
              : 'bg-[#1f0b12]/5 border-rose-300'
          } space-y-3`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              {isBullish ? (
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              ) : (
                <TrendingDown className="w-4 h-4 text-rose-600" />
              )}
              <span className="text-sm font-black text-[#1a1a1a]">
                {activeDivergence.title}
              </span>
              <span
                className={`text-[9px] font-bold uppercase px-1.5 py-0.5 ${
                  activeDivergence.strength === 'STRONG'
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {activeDivergence.strength} Strength
              </span>
              <span className="text-[10px] text-gray-500">
                Conviction: {activeDivergence.convictionScore}/10
              </span>
            </div>

            <div className="text-[11px] text-gray-500">
              Swing Period: <strong className="text-gray-900">{activeDivergence.startDate}</strong> ➔ <strong className="text-gray-900">{activeDivergence.endDate}</strong> ({activeDivergence.barsAgo} bars ago)
            </div>
          </div>

          {/* Metrics Comparative Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* Price Action Swing */}
            <div className="bg-white border border-[#e5e4e1] p-3 space-y-1">
              <span className="text-[10px] uppercase font-bold text-gray-500 block">
                Price Action Swing
              </span>
              <div className="flex items-baseline space-x-1.5 font-bold">
                <span>{currencySymbol}{activeDivergence.startPrice.toFixed(2)}</span>
                <span className="text-gray-400">➔</span>
                <span className={isBullish ? 'text-rose-600' : 'text-emerald-600'}>
                  {currencySymbol}{activeDivergence.endPrice.toFixed(2)}
                </span>
              </div>
              <span className={`text-[10px] font-bold block ${activeDivergence.priceDiffPercent < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {activeDivergence.priceDiffPercent > 0 ? '+' : ''}{activeDivergence.priceDiffPercent}% change ({isBullish ? 'Lower Low formed' : 'Higher High formed'})
              </span>
            </div>

            {/* RSI Momentum Swing */}
            <div className="bg-white border border-[#e5e4e1] p-3 space-y-1">
              <span className="text-[10px] uppercase font-bold text-gray-500 block">
                RSI Momentum (14)
              </span>
              <div className="flex items-baseline space-x-1.5 font-bold">
                <span>{activeDivergence.startRsi}</span>
                <span className="text-gray-400">➔</span>
                <span className={isBullish ? 'text-emerald-600' : 'text-rose-600'}>
                  {activeDivergence.endRsi}
                </span>
                <span className="text-gray-400 text-[10px] font-normal">
                  (Now: {activeDivergence.rsiCurrent})
                </span>
              </div>
              <span className={`text-[10px] font-bold block ${activeDivergence.rsiDiff > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {activeDivergence.rsiDiff > 0 ? '+' : ''}{activeDivergence.rsiDiff} pts ({isBullish ? 'Higher Low formed' : 'Lower High formed'})
              </span>
            </div>

            {/* Technical Diagnosis */}
            <div className="bg-white border border-[#e5e4e1] p-3 space-y-1 col-span-1 sm:col-span-2">
              <span className="text-[10px] uppercase font-bold text-gray-500 block">
                SEPA Momentum Implication
              </span>
              <p className="text-[11px] text-gray-700 font-sans leading-relaxed">
                {activeDivergence.description}
              </p>
            </div>
          </div>

          {/* Minervini SEPA Playbook Strategy */}
          <div
            className={`p-3 border text-xs font-sans flex items-start space-x-2.5 ${
              isBullish
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <Target className="w-4 h-4 mt-0.5 text-amber-600 shrink-0" />
            <div>
              <strong className="font-mono text-[10px] uppercase tracking-wider block text-amber-700">
                MARK MINERVINI SEPA ACTION PLAYBOOK:
              </strong>
              <p className="text-[11px] leading-snug mt-0.5">
                {activeDivergence.sepaPlaybook}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 bg-gray-50 border border-gray-200 text-center space-y-2">
          <Info className="w-5 h-5 text-gray-400 mx-auto" />
          <p className="text-xs text-gray-600 font-sans">
            No active divergence detected within recent swing bars for {stock.ticker}. RSI momentum is tracking price action in equilibrium.
          </p>
          <p className="text-[10px] text-gray-400">
            Use the simulation buttons below to test real-time toast alerts for {stock.ticker}.
          </p>
        </div>
      )}

      {/* Action Toolbar & Simulation Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#e5e4e1]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase font-bold text-gray-500">
            Live Testing Triggers:
          </span>
          <button
            onClick={handleSimulateBullish}
            className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] font-bold uppercase tracking-wider flex items-center space-x-1 cursor-pointer"
            title="Simulate and trigger an instant Bullish Divergence toast notification"
          >
            <TrendingUp className="w-3 h-3 text-emerald-200" />
            <span>Test Bullish Toast ⚡</span>
          </button>

          <button
            onClick={handleSimulateBearish}
            className="px-2.5 py-1 bg-rose-700 hover:bg-rose-800 text-white text-[10px] font-bold uppercase tracking-wider flex items-center space-x-1 cursor-pointer"
            title="Simulate and trigger an instant Bearish Divergence toast notification"
          >
            <TrendingDown className="w-3 h-3 text-rose-200" />
            <span>Test Bearish Toast ⚠️</span>
          </button>
        </div>

        <button
          onClick={() => setShowHistoryTable(!showHistoryTable)}
          className="text-xs text-gray-600 hover:text-black flex items-center space-x-1 cursor-pointer"
        >
          <span>All Detected Divergences ({divergences.length})</span>
          {showHistoryTable ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Collapsible Detected Divergences Table */}
      {showHistoryTable && (
        <div className="border border-[#e5e4e1] overflow-x-auto text-xs animate-slide-down">
          <table className="w-full text-left font-mono">
            <thead className="bg-[#f9f8f5] border-b border-[#e5e4e1] text-[10px] uppercase text-gray-500">
              <tr>
                <th className="p-2 px-3">Type</th>
                <th className="p-2">Dates</th>
                <th className="p-2">Price Swing</th>
                <th className="p-2">RSI Swing</th>
                <th className="p-2">Conviction</th>
                <th className="p-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e4e1]">
              {divergences.length > 0 ? (
                divergences.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="p-2 px-3">
                      <span
                        className={`text-[9px] font-bold uppercase px-1.5 py-0.5 ${
                          d.type === 'BULLISH'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {d.type} ({d.kind.replace('_', ' ')})
                      </span>
                    </td>
                    <td className="p-2 text-[11px] text-gray-700">
                      {d.startDate} ➔ {d.endDate}
                    </td>
                    <td className="p-2 text-[11px]">
                      {currencySymbol}{d.startPrice.toFixed(2)} ➔ {currencySymbol}{d.endPrice.toFixed(2)} (
                      <span className={d.priceDiffPercent < 0 ? 'text-rose-600' : 'text-emerald-600'}>
                        {d.priceDiffPercent > 0 ? '+' : ''}{d.priceDiffPercent}%
                      </span>)
                    </td>
                    <td className="p-2 text-[11px]">
                      {d.startRsi} ➔ {d.endRsi} (
                      <span className={d.rsiDiff > 0 ? 'text-emerald-600' : 'text-rose-600'}>
                        {d.rsiDiff > 0 ? '+' : ''}{d.rsiDiff} pts
                      </span>)
                    </td>
                    <td className="p-2 text-[11px]">
                      {d.convictionScore}/10 ({d.strength})
                    </td>
                    <td className="p-2">
                      <button
                        onClick={() => handleManualTrigger(d)}
                        className="px-2 py-0.5 bg-gray-900 hover:bg-black text-amber-300 text-[10px] font-bold uppercase cursor-pointer"
                      >
                        Trigger Toast
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-gray-500 font-sans">
                    No historical divergences recorded in the available timeframe.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
