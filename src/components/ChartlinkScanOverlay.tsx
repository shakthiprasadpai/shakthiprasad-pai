import React, { useEffect, useMemo, useState } from 'react';
import { Radio, ExternalLink, Copy, Check, X } from 'lucide-react';
import { MinerviniTradeSetup } from '../types';
import { CHARTLINK_SCANNER_PRESETS } from '../utils/chartlinkScannerData';
import { getChartLinkUrl } from '../utils/chartLinkHelper';

// Links Chartink scan results to the stock shown on the VCP chart.
// Three sources: scans the stock passes locally (the app's own presets), live webhook alerts from
// Chartink (POST /api/chartlink/webhook), and a Chartink result the user pastes in.

const STORE_KEY = 'gsa-chartlink-paste';
const ALERT_POLL_MS = 30000;

export interface ChartlinkAlert {
  id: string;
  scanName: string;
  stocks: string[];
  triggeredAt: string;
  timestamp: number;
}

export type ScanVerdict = 'IN' | 'NOT_IN' | 'LOCAL' | 'NONE';

const tokens = (txt: string): Set<string> =>
  new Set(
    txt
      .toUpperCase()
      .split(/[\s,;|]+/)
      .map((t) => t.replace(/[^A-Z0-9&_-]/g, ''))
      .filter((t) => t.length >= 2)
  );

export function useChartlinkScan(stock: MinerviniTradeSetup, universe: MinerviniTradeSetup[]) {
  const [pasted, setPastedRaw] = useState<string>(() => {
    try { return localStorage.getItem(STORE_KEY) || ''; } catch { return ''; }
  });
  const [alerts, setAlerts] = useState<ChartlinkAlert[]>([]);

  const setPasted = (v: string) => {
    setPastedRaw(v);
    try { localStorage.setItem(STORE_KEY, v); } catch { /* storage unavailable */ }
  };

  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const res = await fetch('/api/chartlink/alerts');
        const data = await res.json();
        if (live && Array.isArray(data?.alerts)) setAlerts(data.alerts);
      } catch { /* server not reachable: keep what we have */ }
    };
    load();
    const id = setInterval(load, ALERT_POLL_MS);
    return () => { live = false; clearInterval(id); };
  }, []);

  return useMemo(() => {
    const t = stock.ticker.toUpperCase();
    const localMatches = CHARTLINK_SCANNER_PRESETS.filter((p) => {
      try { return p.filterFn(stock); } catch { return false; }
    });
    const alertHits = alerts.filter((a) => a.stocks.map((s) => String(s).toUpperCase()).includes(t));
    const pastedSet = pasted.trim() ? tokens(pasted) : null;
    const inPasted = pastedSet ? pastedSet.has(t) : null;
    let verdict: ScanVerdict = 'NONE';
    if (inPasted || alertHits.length) verdict = 'IN';
    else if (inPasted === false) verdict = 'NOT_IN';
    else if (localMatches.length) verdict = 'LOCAL';
    return { verdict, localMatches, alertHits, inPasted, pasted, setPasted, universeSize: universe.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stock, alerts, pasted, universe.length]);
}

export type ChartlinkScanState = ReturnType<typeof useChartlinkScan>;

/** Small badge drawn inside the chart's top-left corner. */
export const ChartlinkScanBadge: React.FC<{ scan: ChartlinkScanState }> = ({ scan }) => {
  if (scan.verdict === 'NONE') return null;
  const cfg = {
    IN: { text: 'CHARTINK SCAN: IN', cls: 'bg-emerald-600 text-white' },
    NOT_IN: { text: 'CHARTINK SCAN: NOT IN', cls: 'bg-red-600 text-white' },
    LOCAL: { text: `LOCAL PRESET MATCH: ${scan.localMatches.length}`, cls: 'bg-amber-500 text-black' },
  }[scan.verdict];
  return (
    <div className={`absolute top-2 left-2 z-10 px-2 py-1 text-[10px] font-bold tracking-wider rounded ${cfg.cls}`} role="status">
      {cfg.text}
    </div>
  );
};

const CLAUSE =
  '{cash} ( latest close > latest sma( close , 150 ) and latest close > latest sma( close , 200 ) and latest sma( close , 150 ) > latest sma( close , 200 ) and latest sma( close , 200 ) > 1 month ago sma( close , 200 ) and latest sma( close , 50 ) > latest sma( close , 150 ) and latest sma( close , 50 ) > latest sma( close , 200 ) and latest close > latest sma( close , 50 ) and latest close >= 1.3 * latest min( 250 , latest low ) and latest close >= 0.75 * latest max( 250 , latest high ) )';

/** Panel above the chart: where the stock stands in each Chartink source. */
export const ChartlinkScanPanel: React.FC<{ stock: MinerviniTradeSetup; scan: ChartlinkScanState; onOpenScanner?: () => void }> = ({ stock, scan, onOpenScanner }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(CLAUSE); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* clipboard blocked */ }
  };
  return (
    <section className="bg-[#0d0d13] border border-[#1f1f29] text-gray-200 p-4 space-y-3" aria-label="Chartink scan for this chart">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.2em] uppercase text-gray-400">
          <Radio className="w-3.5 h-3.5 text-amber-400" /> Chartink scan · {stock.ticker}
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={getChartLinkUrl(stock)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider border border-amber-700 text-amber-400 hover:bg-amber-500/10">
            Open on Chartink <ExternalLink className="w-3 h-3" />
          </a>
          <button type="button" onClick={copy} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider border border-amber-700 text-amber-400 hover:bg-amber-500/10">
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copied ? 'Copied' : 'Copy scan clause'}
          </button>
          {onOpenScanner && (
            <button type="button" onClick={onOpenScanner} className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider border border-gray-600 text-gray-300 hover:bg-white/5">
              Full scanner
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3 text-xs">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">Pasted Chartink result</div>
          <div className="relative">
            <textarea
              value={scan.pasted}
              onChange={(e) => scan.setPasted(e.target.value)}
              rows={3}
              aria-label="Chartink scan result"
              placeholder="Paste a scan result or symbols, e.g. LAURUSLABS, SAILIFE"
              className="w-full bg-[#08080c] border border-[#1f1f29] text-gray-100 font-mono text-xs p-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            {scan.pasted && (
              <button type="button" aria-label="Clear pasted result" onClick={() => scan.setPasted('')} className="absolute top-1 right-1 text-gray-500 hover:text-red-400">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="mt-1 text-gray-400">
            {scan.inPasted === null ? 'Nothing pasted.' : scan.inPasted ? <span className="text-emerald-400 font-bold">{stock.ticker} is in your pasted scan.</span> : <span className="text-red-400 font-bold">{stock.ticker} is not in your pasted scan.</span>}
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">Live Chartink alerts</div>
          {scan.alertHits.length ? (
            <ul className="space-y-1">
              {scan.alertHits.slice(0, 4).map((a) => (
                <li key={a.id} className="text-emerald-400">{a.scanName} <span className="text-gray-500">· {a.triggeredAt}</span></li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400">No webhook alert for {stock.ticker}. Point a Chartink alert at <code className="text-amber-400">/api/chartlink/webhook</code> to see them here.</p>
          )}
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">App presets this stock passes</div>
          {scan.localMatches.length ? (
            <ul className="space-y-1">
              {scan.localMatches.map((p) => <li key={p.id} className="text-amber-300">{p.name}</li>)}
            </ul>
          ) : (
            <p className="text-gray-400">None of the {scan.universeSize}-stock universe presets.</p>
          )}
          <p className="text-gray-500 mt-1">Local checks use the app's own data, not Chartink's.</p>
        </div>
      </div>
    </section>
  );
};
