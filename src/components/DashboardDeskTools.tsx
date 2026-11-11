import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DeskTools, { TOOLS_CSS } from './DeskTools';
import { stockToDeskTrade, stockLevels } from '../utils/deskAdapter';
import type { MinerviniTradeSetup } from '../types';

// Desk tools on the dashboard: screener table, pocket pivots, candle patterns, VCP and Stage scans, portfolio,
// journal, pattern alerts and export, for the NSE stocks on this screen. The tools draw in a dark card with their own
// scoped styles so they look the same inside the light or the Obsidian theme.

const EMBED_CSS = `
.desk.desk-embed{--bg:#050508;--card:#0d0d13;--card2:#111118;--line:#1f1f29;--fg:#f2f2f5;--muted:#8a8a99;--dim:#5b5b69;
  --amber:#f5a524;--red:#e11d48;--red-t:#ff3347;--green:#12985a;--green-t:#3ddc97;--mono:"JetBrains Mono",ui-monospace,Menlo,monospace;
  background:var(--card);color:var(--fg);font-family:var(--mono);font-size:13px;line-height:1.5;min-height:0;padding:0;border:1px solid var(--line)}
.desk-embed button{font:inherit;color:inherit;cursor:pointer}
.desk-embed .de-head{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-end;padding:clamp(14px,2.5vw,22px) clamp(14px,2.5vw,22px) 0}
.desk-embed .de-title{margin:0;font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--amber)}
.desk-embed .de-sub{margin:4px 0 0;color:var(--muted);font-size:12px;max-width:72ch}
.desk-embed .de-ctl{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end}
.desk-embed .de-ctl label{display:flex;flex-direction:column;gap:4px;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.desk-embed .de-ctl input{font:inherit;font-weight:500;color:var(--fg);background:#08080c;border:1px solid #2a2a36;padding:7px 9px;width:120px;min-width:0}
.desk-embed .de-ctl input:focus-visible,.desk-embed .de-btn:focus-visible{outline:2px solid var(--amber);outline-offset:2px}
.desk-embed .de-btn{background:#0c0c14;border:1px solid var(--line);color:var(--muted);padding:8px 10px;font-weight:700;font-size:10px;letter-spacing:.1em;text-transform:uppercase}
.desk-embed .de-status{min-height:1.4em;margin:8px clamp(14px,2.5vw,22px) 0;color:var(--amber);font-size:12px}
.desk-embed .de-body{padding:8px clamp(14px,2.5vw,22px) clamp(14px,2.5vw,22px)}
.desk-embed .de-body .dtools{border:0;padding:0;background:transparent}
.desk-embed .de-empty{padding:22px;color:var(--muted)}
`;

interface Props {
  stocks: MinerviniTradeSetup[];
  selected?: MinerviniTradeSetup | null;
  onSelectStock?: (stock: MinerviniTradeSetup) => void;
  onNavigate?: (tab: string) => void;
  onOpenStageScan?: () => void;
}

const num = (v: string, d: number) => { const n = parseFloat(v); return isFinite(n) && n > 0 ? n : d; };
const read = (k: string, d: string) => { try { return localStorage.getItem(k) || d; } catch { return d; } };

export const DashboardDeskTools: React.FC<Props> = ({ stocks, selected, onSelectStock, onNavigate, onOpenStageScan }) => {
  const [capital, setCapital] = useState(() => read('gsa-dash-capital', '500000'));
  const [riskPct, setRiskPct] = useState(() => read('gsa-dash-risk', '1'));
  const [muted, setMuted] = useState(() => read('gsa-dash-muted', '0') === '1');
  const [status, setStatus] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => { try { localStorage.setItem('gsa-dash-capital', capital); localStorage.setItem('gsa-dash-risk', riskPct); localStorage.setItem('gsa-dash-muted', muted ? '1' : '0'); } catch { /* storage can be blocked */ } }, [capital, riskPct, muted]);

  // NSE and BSE stocks only: the tools format prices in rupees. The selected stock comes first.
  const { trades, levels, source } = useMemo(() => {
    const list = (stocks || []).filter((s) => s && (s.exchange === 'NSE' || s.exchange === 'BSE'));
    if (selected) list.sort((a, b) => (a.ticker === selected.ticker ? -1 : b.ticker === selected.ticker ? 1 : 0));
    const out: any[] = [], src: MinerviniTradeSetup[] = [], lv: Record<string, any> = {};
    list.forEach((s) => { const t = stockToDeskTrade(s); if (t) { out.push(t); src.push(s); lv[t.id] = stockLevels(s); } });
    return { trades: out, levels: lv, source: src };
  }, [stocks, selected]);

  const say = useCallback((m: string) => { setStatus(m); clearTimeout(timer.current); timer.current = setTimeout(() => setStatus(''), 3500); }, []);
  const copy = useCallback((text: string, msg?: string) => {
    const done = () => say(msg || 'Copied');
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, () => say('Copy was blocked by the browser'));
    else say('Copy is not available here');
  }, [say]);
  const beep = useCallback(() => {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext; const ctx = new Ctx();
      const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 880; g.gain.value = 0.05;
      o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.15); o.onended = () => ctx.close();
    } catch { /* no audio available */ }
  }, []);

  return (
    <section className="desk desk-embed" aria-label="Desk tools">
      <style>{EMBED_CSS + TOOLS_CSS}</style>
      <div className="de-head">
        <div>
          <h2 className="de-title">Desk tools</h2>
          <p className="de-sub">Pocket pivots, candle patterns, VCP and Stage scans, portfolio, journal, alerts and export for the NSE stocks on this screen. Prices here come from the screen's sample history, not live data.</p>
        </div>
        <div className="de-ctl">
          <label>Capital ₹<input type="number" inputMode="decimal" min="0" step="any" value={capital} onChange={(e) => setCapital(e.target.value)} /></label>
          <label>Risk %<input type="number" inputMode="decimal" min="0" step="any" value={riskPct} onChange={(e) => setRiskPct(e.target.value)} /></label>
          <button type="button" className="de-btn" aria-pressed={muted} onClick={() => setMuted((m) => !m)}>{muted ? 'Sound off' : 'Sound on'}</button>
        </div>
      </div>
      <p className="de-status" role="status" aria-live="polite">{status}</p>
      <div className="de-body">
        {trades.length ? (
          <DeskTools
            trades={trades}
            levels={levels}
            capital={String(num(capital, 500000))}
            riskPct={String(num(riskPct, 1))}
            scan={null}
            embedded
            hideTabs={['earnings', 'sector']}
            dataNote="Stocks come from the NSE and BSE names on this screen. Each row is scored on all 8 Trend Template rules from its own price and moving averages. Select a row to load it in the dashboard."
            onSelect={(i: number) => { const s = source[i]; if (s && onSelectStock) onSelectStock(s); }}
            say={say}
            copy={copy}
            beep={beep}
            muted={muted}
            onNavigate={onNavigate}
            onOpenStageScan={onOpenStageScan}
            onShowCandles={(i: number) => { const s = source[i]; if (s && onSelectStock) onSelectStock(s); onNavigate?.('chart'); }}
          />
        ) : (
          <p className="de-empty">No NSE or BSE stocks with price history on this screen yet.</p>
        )}
      </div>
    </section>
  );
};

export default DashboardDeskTools;
