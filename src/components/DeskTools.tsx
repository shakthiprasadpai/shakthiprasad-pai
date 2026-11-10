import { useState, useMemo, useEffect } from "react";

/* Desk tools: screener, pocket pivot, VCP scan, stage scan, portfolio, earnings, sector health,
   journal, pattern alerts and export. Everything is computed from the data passed in (40 daily
   sessions per stock) or typed in by the user. Nothing here is fetched live. */

const fmt = (n, d = 0) => Number(n).toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const avg = (a) => a.reduce((s, v) => s + v, 0) / (a.length || 1);

/* ---------- analysis (pure) ---------- */

// Pocket pivot: an up day whose volume beats the biggest down-day volume of the prior 10 sessions,
// closing above its 10-day average.
export function pocketPivots(t) {
  const { closes: c, vols: v } = t, out = [];
  for (let i = 11; i < c.length; i++) {
    if (!(c[i] > c[i - 1])) continue;
    let maxDown = 0;
    for (let j = i - 10; j < i; j++) if (c[j] < c[j - 1]) maxDown = Math.max(maxDown, v[j]);
    const sma10 = avg(c.slice(i - 9, i + 1));
    if (maxDown > 0 && v[i] > maxDown && c[i] > sma10) out.push({ i, ago: c.length - 1 - i, close: c[i], vol: v[i], maxDown });
  }
  return out;
}

// VCP from daily closes: swing highs and lows over a 5-session window, then the depth of each
// high-to-low pullback. Approximate: closes only, no intraday highs and lows.
export function vcpScan(t) {
  const c = t.closes, n = c.length, k = 2, pts = [];
  for (let i = k; i < n - k; i++) {
    const w = c.slice(i - k, i + k + 1);
    if (c[i] === Math.max(...w)) pts.push({ i, p: c[i], type: "H" });
    else if (c[i] === Math.min(...w)) pts.push({ i, p: c[i], type: "L" });
  }
  const seq = [];
  for (const p of pts) {
    const last = seq[seq.length - 1];
    if (!last || last.type !== p.type) seq.push(p);
    else if ((p.type === "H" && p.p > last.p) || (p.type === "L" && p.p < last.p)) seq[seq.length - 1] = p;
  }
  const cons = [];
  for (let j = 0; j + 1 < seq.length; j++) {
    if (seq[j].type === "H" && seq[j + 1].type === "L") cons.push({ from: seq[j].i, to: seq[j + 1].i, depth: ((seq[j].p - seq[j + 1].p) / seq[j].p) * 100 });
  }
  const last = cons.slice(-4);
  const tightening = last.length >= 2 && last.every((x, j) => j === 0 || x.depth < last[j - 1].depth);
  const med = median(t.vols), recent = avg(t.vols.slice(-5)) / med, dry = avg(t.vols.slice(-10, -2)) / med;
  return { contractions: last, tightening, recentVol: recent, priorVol: dry, swings: seq };
}

export function stageInfo(t) {
  const [m50, m150, m200] = t.ma;
  const stage2 = t.close > m50 && m50 > m150 && m150 > m200;
  return {
    stage2, ext50: (t.close / m50 - 1) * 100, fromHigh: (t.close / t.hi52 - 1) * 100, aboveLow: (t.close / t.lo52 - 1) * 100,
    rows: [
      ["Close above 50 DMA", t.close > m50], ["50 DMA above 150 DMA", m50 > m150], ["150 DMA above 200 DMA", m150 > m200],
      ["Close above 200 DMA", t.close > m200], ["30%+ above 52-week low", t.close >= t.lo52 * 1.3], ["Within 25% of 52-week high", t.close >= t.hi52 * 0.75],
    ],
  };
}

export function patternAlerts(t, L) {
  const a = [], c = t.closes, med = median(t.vols), s = stageInfo(t);
  const dPiv = (L.entry / t.close - 1) * 100;
  if (dPiv > 0 && dPiv <= 3) a.push(["warn", `Within ${dPiv.toFixed(1)}% below the pivot at ₹${fmt(L.entry, 2)}`]);
  else if (dPiv > 3) a.push(["info", `${dPiv.toFixed(1)}% below the pivot, no trigger yet`]);
  else a.push(["ok", `Closed above the pivot by ${(-dPiv).toFixed(1)}%`]);
  const pp = pocketPivots(t).filter((x) => x.ago <= 3);
  if (pp.length) a.push(["ok", `Pocket pivot ${pp[pp.length - 1].ago === 0 ? "today" : pp[pp.length - 1].ago + " sessions ago"} on ${pp[pp.length - 1].vol.toFixed(1)}M shares`]);
  const vx = t.vols[t.vols.length - 1] / med;
  if (vx >= 2) a.push(["ok", `Volume ${vx.toFixed(1)}x the 40-session median`]);
  if (s.ext50 > 20) a.push(["warn", `Extended: ${s.ext50.toFixed(0)}% above the 50 DMA`]);
  const risk = ((L.entry - L.stop) / L.entry) * 100;
  if (risk > 5) a.push(["warn", `Wide stop: ${risk.toFixed(1)}% below entry`]);
  const gain2 = (c[c.length - 1] / c[c.length - 3] - 1) * 100;
  if (gain2 > 8) a.push(["warn", `Up ${gain2.toFixed(0)}% in two sessions, gap risk at the open`]);
  return a;
}

/* ---------- reference data (fetched 10 Nov 2026) ---------- */

// InvestSights earnings calendar. SAILIFE's reported figures look inconsistent (revenue actual about 1% of the estimate): verify before relying on them.
const EARN = [
  { sym: "LAURUSLABS", last: "2026-10-29", lastTxt: "EPS 8.20 vs 6.67 est, revenue beat", next: "2027-01-28", nextTxt: "EPS est 7.06" },
  { sym: "SAILIFE", last: "2026-11-05", lastTxt: "EPS 0.05 vs 3.97 est (data looks inconsistent, verify)", next: "", nextTxt: "No date in the next 120 days" },
];

// InvestSights sector heatmap, 1 month to 9 Nov 2026 (base 12 Oct). Sector average of every stock in the sector.
const SECTORS: [string, number][] = [["Airlines", 13.24], ["Oil, Gas & Energy", 9.56], ["Cement & Building", 9.47], ["Infra & Realty", 8.35], ["Diversified", 8.22], ["Pharma & Healthcare", 7.83], ["Consumer Discretionary", 7.35], ["Power & Utilities", 7.27], ["Telecom", 7.11], ["Banking", 6.2], ["IT & Technology", 5.95], ["Automobile", 5.93], ["FMCG", 4.79], ["Metals & Mining", 3.23], ["Financial Services", 3.03], ["Defence", -0.27], ["Chemicals", -1.89], ["Capital Goods", -6.84], ["Auto Components", -10.9]];

/* ---------- storage ---------- */
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

const csvCell = (v) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export const toCSV = (rows) => rows.map((r) => r.map(csvCell).join(",")).join("\n");

const TABS = [
  ["screener", "Screener"], ["pocket", "Pocket pivot"], ["vcp", "VCP scanner"], ["stage", "Stage scan"], ["portfolio", "Portfolio"],
  ["earnings", "Earnings"], ["sector", "Sector health"], ["journal", "Journal entry"], ["alerts", "Alert patterns"], ["export", "Export"],
];
// Where each tool lives in the full app (used only when the desk is hosted inside it).
const APP_TAB = { screener: "screener", pocket: "pocket_pivot", vcp: "vcp_scanner", portfolio: "portfolio", earnings: "earnings", sector: "sector_heatmap", journal: "journal", alerts: "alert_history", export: "export_data" };

export default function DeskTools({ trades, levels, capital, riskPct, scan, onSelect, say, copy, beep, muted, onNavigate, onOpenStageScan, jumps = [] }) {
  const [tab, setTab] = useState("screener");
  const [pf, setPf] = useState(() => load("gsa-pf", []));
  const [jr, setJr] = useState(() => load("gsa-journal", []));
  const [er, setEr] = useState(() => load("gsa-earn", []));
  useEffect(() => save("gsa-pf", pf), [pf]);
  useEffect(() => save("gsa-journal", jr), [jr]);
  useEffect(() => save("gsa-earn", er), [er]);

  const L = (t) => Object.fromEntries(Object.entries(levels[t.id]).map(([k, v]) => [k, parseFloat(v as string)]));
  const cap = parseFloat(capital) || 0, rp = parseFloat(riskPct) || 0;
  const plans = trades.map((t) => {
    const l = L(t), risk = l.entry - l.stop, okp = risk > 0 && l.t1 > l.entry;
    let qty = okp ? Math.floor((cap * rp) / 100 / risk) : 0;
    qty = Math.min(qty, Math.floor(cap / l.entry) || 0);
    return { t, l, risk, qty, okp };
  });
  const scanOf = (t) => (scan ? (scan.has(t.sym) ? "in scan" : "not in scan") : "no scan pasted");

  /* form state */
  const [pfForm, setPfForm] = useState({ sym: "", qty: "", avg: "", stop: "", last: "" });
  const [jrForm, setJrForm] = useState({ sym: trades[0].sym, side: "Buy", entry: "", stop: "", qty: "", note: "" });
  const [erForm, setErForm] = useState({ sym: "", date: "", note: "" });
  const fillJournal = (p) => setJrForm({ sym: p.t.sym, side: "Buy", entry: String(p.l.entry), stop: String(p.l.stop), qty: String(p.qty), note: p.t.setup });
  const num = (v) => parseFloat(v);

  const pfRows = pf.map((p, i) => {
    const known = trades.find((t) => t.sym === p.sym);
    const last = known ? known.close : num(p.last);
    const value = last * p.qty, cost = p.avg * p.qty;
    return { ...p, i, last, value, pl: value - cost, plPct: (last / p.avg - 1) * 100, openRisk: isFinite(p.stop) && p.stop > 0 ? Math.max(0, (last - p.stop) * p.qty) : null, known: !!known };
  });
  const pfTot = pfRows.reduce((s, r) => ({ value: s.value + (r.value || 0), pl: s.pl + (r.pl || 0), risk: s.risk + (r.openRisk || 0) }), { value: 0, pl: 0, risk: 0 });

  const exportRows = () => {
    const rows = [["Section", "Symbol", "Style", "Entry", "Stop", "T1", "T2", "Qty", "Risk per share", "Note"]];
    plans.forEach((p) => rows.push(["Trade plan", p.t.sym, p.t.mode, p.l.entry, p.l.stop, p.l.t1, p.l.t2, p.qty, p.okp ? p.risk.toFixed(2) : "", p.t.setup]));
    pfRows.forEach((r) => rows.push(["Portfolio", r.sym, "", r.avg, r.stop || "", "", "", r.qty, "", `last ${r.last}, P&L ${isFinite(r.pl) ? r.pl.toFixed(0) : ""}`]));
    jr.forEach((j) => rows.push(["Journal", j.sym, j.side, j.entry, j.stop, "", "", j.qty, "", `${j.when}: ${j.note}`]));
    return rows;
  };
  const download = async (name, text, mime) => {
    try {
      // Inside claude.ai the page has no download permission; the downloads capability asks the viewer instead.
      const dl = await (window as any).claude?.use?.("downloads");
      if (dl) { await dl.save({ filename: name, data: text }); say("Save requested"); return; }
    } catch { /* fall through to the browser download */ }
    try {
      const url = URL.createObjectURL(new Blob([text], { type: mime }));
      const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      say("Download started. If nothing saved, use Copy.");
    } catch { copy(text, "Downloads are blocked here, copied instead"); }
  };
  const mdNote = (p) => `---
type: minervini-sepa-setup
ticker: ${p.t.sym}
name: "${p.t.name}"
exchange: NSE
current_price: ${p.t.close}
pivot_price: ${p.l.entry}
stop_loss: ${p.l.stop}
target_1: ${p.l.t1}
target_2: ${p.l.t2}
trend_score: ${p.t.checks.filter((c) => c[2] === "pass").length}
created_date: "${new Date().toISOString().slice(0, 10)}"
tags:
  - trading/minervini
---

# ${p.t.sym}: ${p.t.name} (NSE)

- Pattern: ${p.t.setup}
- Entry ₹${fmt(p.l.entry, 2)}, stop ₹${fmt(p.l.stop, 2)}, T1 ₹${fmt(p.l.t1, 2)}, T2 ₹${fmt(p.l.t2, 2)}
- Size at ₹${fmt(cap)} and ${rp}% risk: ${p.qty} shares
- Not checked: 200 DMA slope, RS rating
`;

  const open = (key) => onNavigate && APP_TAB[key] ? <button className="dt-link" type="button" onClick={() => onNavigate(APP_TAB[key])}>Open the full {TABS.find((x) => x[0] === key)[1].toLowerCase()} screen in the app →</button> : null;

  const body = {
    screener: (
      <>
        <table className="dt-table"><thead><tr><th>Stock</th><th>Style</th><th>Close</th><th>Day</th><th>Template</th><th>Pivot</th><th>Stop</th><th>Stop %</th><th>Chartink</th></tr></thead>
          <tbody>{plans.map(({ t, l }) => (
            <tr key={t.id} className="dt-click" onClick={() => onSelect(trades.indexOf(t))} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onSelect(trades.indexOf(t))}>
              <td><b>{t.sym}</b></td><td>{t.id === "swing" ? "Swing" : "Intraday"}</td><td>₹{fmt(t.close, 2)}</td><td className="g">+{((t.close / t.prev - 1) * 100).toFixed(2)}%</td>
              <td>{t.checks.filter((c) => c[2] === "pass").length}/8 <span className="dt-dim">(2 not checked)</span></td><td>₹{fmt(l.entry, 2)}</td><td>₹{fmt(l.stop, 2)}</td><td>{(((l.entry - l.stop) / l.entry) * 100).toFixed(1)}%</td><td>{scanOf(t)}</td>
            </tr>))}</tbody></table>
        <p className="dt-note">Two names from the 9 Nov NSE screen. Select a row to load it on the desk. RS rating was not computed, so it is not scored.</p>
      </>
    ),
    pocket: (
      <div className="dt-cards">{trades.map((t) => {
        const pp = pocketPivots(t), lastp = pp[pp.length - 1];
        return (
          <div className="dt-card" key={t.id}><div className="dt-h"><b>{t.sym}</b><span className={`dt-pill ${lastp && lastp.ago <= 3 ? "ok" : ""}`}>{lastp ? (lastp.ago === 0 ? "pocket pivot today" : `last ${lastp.ago} sessions ago`) : "none in 40 sessions"}</span></div>
            {pp.length ? <ul className="dt-list">{pp.slice(-4).reverse().map((x) => <li key={x.i}><span>{x.ago === 0 ? "Latest session" : x.ago + " sessions ago"}</span><span>₹{fmt(x.close, 2)}</span><span>{x.vol.toFixed(1)}M vs {x.maxDown.toFixed(1)}M down-day max</span></li>)}</ul> : <p className="dt-note">No up day beat the heaviest down-day volume of the prior 10 sessions while closing above its 10-day average.</p>}
          </div>);
      })}<p className="dt-note">Rule used: up day, volume above the highest down-day volume of the prior 10 sessions, close above the 10-day average. Volumes are millions of shares.</p></div>
    ),
    vcp: (
      <div className="dt-cards">{trades.map((t) => {
        const v = vcpScan(t);
        return (
          <div className="dt-card" key={t.id}><div className="dt-h"><b>{t.sym}</b><span className={`dt-pill ${v.tightening ? "ok" : ""}`}>{v.tightening ? "contractions tightening" : v.contractions.length < 2 ? "too few swings" : "not tightening"}</span></div>
            <div className="dt-bars">{v.contractions.map((x, j) => <div key={j}><span className="dt-dim">T{j + 1}</span><i style={{ width: Math.min(100, x.depth * 5) + "%" }} /><b>{x.depth.toFixed(1)}%</b></div>)}</div>
            <p className="dt-note">Volume: last 5 sessions are {v.recentVol.toFixed(1)}x the median; the 8 sessions before were {v.priorVol.toFixed(1)}x. {v.recentVol > 1.5 ? "That is breakout volume, not dry-up." : v.priorVol < 0.8 ? "Dry-up before the move." : "No clear dry-up."}</p>
          </div>);
      })}<p className="dt-note">Approximate: swings are found on daily closes over a 5-session window, with no intraday highs or lows. Check the pattern on a real chart before trading it.</p></div>
    ),
    stage: (
      <div className="dt-cards">{trades.map((t) => {
        const s = stageInfo(t);
        return (
          <div className="dt-card" key={t.id}><div className="dt-h"><b>{t.sym}</b><span className={`dt-pill ${s.stage2 ? "ok" : "bad"}`}>{s.stage2 ? "Stage 2 structure" : "not Stage 2"}</span></div>
            <ul className="dt-list">{s.rows.map(([k, p]) => <li key={k}><span>{k}</span><span className={p ? "g" : "rd"}>{p ? "Pass" : "Fail"}</span></li>)}</ul>
            <p className="dt-note">{s.ext50.toFixed(0)}% above the 50 DMA{s.ext50 > 20 ? " (extended)" : ""}, {Math.abs(s.fromHigh).toFixed(1)}% below the 52-week high, {s.aboveLow.toFixed(0)}% above the low. The 200 DMA slope was not checked.</p>
          </div>);
      })}{onOpenStageScan && <button className="dt-link" type="button" onClick={onOpenStageScan}>Run the full Stage 2 scan in the app →</button>}</div>
    ),
    portfolio: (
      <>
        <form className="dt-form" onSubmit={(e) => { e.preventDefault(); const f = pfForm; if (!f.sym.trim() || !(num(f.qty) > 0) || !(num(f.avg) > 0)) { say("Enter a symbol, quantity and average price"); return; } setPf((p) => [...p, { sym: f.sym.trim().toUpperCase(), qty: num(f.qty), avg: num(f.avg), stop: num(f.stop) || 0, last: f.last }]); setPfForm({ sym: "", qty: "", avg: "", stop: "", last: "" }); }}>
          {[["sym", "Symbol", "text"], ["qty", "Qty", "number"], ["avg", "Avg price", "number"], ["stop", "Stop", "number"], ["last", "Last price", "number"]].map(([k, label, type]) => (
            <label key={k}><span className="dt-lab">{label}</span><input type={type} step="any" value={pfForm[k]} onChange={(e) => setPfForm({ ...pfForm, [k]: e.target.value })} /></label>))}
          <button className="dt-btn" type="submit">Add position</button>
        </form>
        {pfRows.length ? (
          <div className="dt-scroll"><table className="dt-table"><thead><tr><th>Symbol</th><th>Qty</th><th>Avg</th><th>Last</th><th>Value</th><th>P&amp;L</th><th>Open risk</th><th /></tr></thead>
            <tbody>{pfRows.map((r) => <tr key={r.i}><td><b>{r.sym}</b></td><td>{fmt(r.qty)}</td><td>₹{fmt(r.avg, 2)}</td><td>{isFinite(r.last) ? "₹" + fmt(r.last, 2) : "enter last"}{r.known ? "" : ""}</td><td>{isFinite(r.value) ? "₹" + fmt(r.value) : "-"}</td><td className={r.pl >= 0 ? "g" : "rd"}>{isFinite(r.pl) ? `₹${fmt(r.pl)} (${r.plPct.toFixed(1)}%)` : "-"}</td><td>{r.openRisk == null ? "no stop" : "₹" + fmt(r.openRisk)}</td><td><button className="dt-x" type="button" aria-label={`Remove ${r.sym}`} onClick={() => setPf((p) => p.filter((_, j) => j !== r.i))}>×</button></td></tr>)}
              <tr className="dt-tot"><td colSpan={4}>Total</td><td>₹{fmt(pfTot.value)}</td><td className={pfTot.pl >= 0 ? "g" : "rd"}>₹{fmt(pfTot.pl)}</td><td>₹{fmt(pfTot.risk)}</td><td /></tr></tbody></table></div>
        ) : <p className="dt-note">No positions yet. Add the ones you hold. They stay in this browser only. Last price fills itself for the two desk stocks (9 Nov close).</p>}
      </>
    ),
    earnings: (
      <>
        <table className="dt-table"><thead><tr><th>Stock</th><th>Last result</th><th>Next result</th></tr></thead>
          <tbody>{[...EARN, ...er.map((e) => ({ sym: e.sym, last: "", lastTxt: e.note, next: e.date, nextTxt: "added by you" }))].map((e, i) => {
            const d = e.next ? Math.ceil((new Date(e.next).getTime() - new Date(new Date().toDateString()).getTime()) / 86400000) : null;
            return <tr key={e.sym + i}><td><b>{e.sym}</b></td><td>{e.last || "-"}<div className="dt-dim">{e.lastTxt}</div></td><td>{e.next ? <>{e.next} <span className={`dt-pill ${d != null && d <= 10 && d >= 0 ? "bad" : ""}`}>{d == null ? "" : d < 0 ? "passed" : d + " days"}</span></> : "-"}<div className="dt-dim">{e.nextTxt}</div></td></tr>;
          })}</tbody></table>
        <form className="dt-form" onSubmit={(ev) => { ev.preventDefault(); if (!erForm.sym.trim() || !erForm.date) { say("Enter a symbol and a date"); return; } setEr((x) => [...x, { sym: erForm.sym.trim().toUpperCase(), date: erForm.date, note: erForm.note }]); setErForm({ sym: "", date: "", note: "" }); }}>
          <label><span className="dt-lab">Symbol</span><input value={erForm.sym} onChange={(e) => setErForm({ ...erForm, sym: e.target.value })} /></label>
          <label><span className="dt-lab">Result date</span><input type="date" value={erForm.date} onChange={(e) => setErForm({ ...erForm, date: e.target.value })} /></label>
          <label><span className="dt-lab">Note</span><input value={erForm.note} onChange={(e) => setErForm({ ...erForm, note: e.target.value })} /></label>
          <button className="dt-btn" type="submit">Add date</button>
        </form>
        <p className="dt-note">LAURUSLABS and SAILIFE rows come from the InvestSights earnings calendar on 10 Nov 2026. SAILIFE reported on 5 Nov, so the 9 Nov move came after results. Its reported EPS and revenue look wrong against the estimates, so check the filing.</p>
      </>
    ),
    sector: (
      <>
        <div className="dt-sec">{SECTORS.map(([n, v]) => <div key={n} className={n.startsWith("Pharma") ? "me" : ""}><span>{n}</span><div className="dt-track"><i className={v < 0 ? "neg" : ""} style={{ width: Math.min(100, Math.abs(v) * 7) + "%" }} /></div><b className={v < 0 ? "rd" : "g"}>{v > 0 ? "+" : ""}{v.toFixed(2)}%</b></div>)}</div>
        <p className="dt-note">One-month sector average to 9 Nov 2026 (base 12 Oct), source InvestSights. Pharma &amp; Healthcare is 6th of 19 at +7.83%. I assumed both desk stocks sit in that sector; the heatmap only listed each sector's top three names. This is a one-month view, not the Relative Rotation chart in the app.</p>
      </>
    ),
    journal: (
      <>
        <form className="dt-form" onSubmit={(e) => { e.preventDefault(); const f = jrForm; if (!f.sym.trim()) { say("Enter a symbol"); return; } setJr((x) => [{ ...f, sym: f.sym.trim().toUpperCase(), when: new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) }, ...x]); setJrForm({ ...jrForm, entry: "", stop: "", qty: "", note: "" }); say("Journal entry saved"); }}>
          <label><span className="dt-lab">Symbol</span><input value={jrForm.sym} onChange={(e) => setJrForm({ ...jrForm, sym: e.target.value })} /></label>
          <label><span className="dt-lab">Side</span><select value={jrForm.side} onChange={(e) => setJrForm({ ...jrForm, side: e.target.value })}><option>Buy</option><option>Sell</option></select></label>
          {[["entry", "Price"], ["stop", "Stop"], ["qty", "Qty"]].map(([k, label]) => <label key={k}><span className="dt-lab">{label}</span><input type="number" step="any" value={jrForm[k]} onChange={(e) => setJrForm({ ...jrForm, [k]: e.target.value })} /></label>)}
          <label className="wide"><span className="dt-lab">Note</span><input value={jrForm.note} onChange={(e) => setJrForm({ ...jrForm, note: e.target.value })} placeholder="Why this trade, what you saw, what you felt" /></label>
          <div className="dt-row"><button className="dt-btn" type="submit">Save entry</button>{plans.map((p) => <button key={p.t.id} className="dt-btn ghost" type="button" onClick={() => fillJournal(p)}>Fill from {p.t.sym} plan</button>)}</div>
        </form>
        {jr.length ? <ul className="dt-list jr">{jr.map((j, i) => <li key={i}><span><b>{j.sym}</b> {j.side}</span><span>{j.entry ? "₹" + fmt(j.entry, 2) : "-"}{j.stop ? ` · stop ₹${fmt(j.stop, 2)}` : ""}{j.qty ? ` · ${fmt(j.qty)} sh` : ""}</span><span className="dt-dim">{j.when}{j.note ? " · " + j.note : ""}</span><button className="dt-x" type="button" aria-label="Delete entry" onClick={() => setJr((x) => x.filter((_, k) => k !== i))}>×</button></li>)}</ul> : <p className="dt-note">No entries yet. They stay in this browser only; Export copies them as CSV.</p>}
      </>
    ),
    alerts: (
      <div className="dt-cards">{plans.map((p) => {
        const al = patternAlerts(p.t, p.l);
        return (
          <div className="dt-card" key={p.t.id}><div className="dt-h"><b>{p.t.sym}</b><span className="dt-pill">{scanOf(p.t)}</span></div>
            <ul className="dt-list">{al.map(([sev, txt], i) => <li key={i}><span className={`dt-dot ${sev}`} aria-hidden="true" /><span>{txt}</span></li>)}</ul>
            <div className="dt-row">
              <button className="dt-btn ghost" type="button" onClick={() => copy(`${p.t.sym}: alert above ₹${fmt(p.l.entry, 2)} (entry), below ₹${fmt(p.l.stop, 2)} (stop), at ₹${fmt(p.l.t1, 2)} (T1), at ₹${fmt(p.l.t2, 2)} (T2)`, "Alert levels copied")}>Copy price alerts</button>
              <button className="dt-btn ghost" type="button" onClick={() => { if (muted) say("Alerts are muted. Turn sound on in the monitor bar."); else { beep(); say("Test alert played"); } }}>Test sound</button>
            </div>
          </div>);
      })}<p className="dt-note">These are checks on the last close, not live alerts. The page cannot watch prices while closed; copy the levels into your broker's alert tool.</p></div>
    ),
    export: (
      <>
        <div className="dt-row">
          <button className="dt-btn" type="button" onClick={() => copy(toCSV(exportRows()), "CSV copied")}>Copy CSV</button>
          <button className="dt-btn" type="button" onClick={() => download("trade-desk-" + new Date().toISOString().slice(0, 10) + ".csv", toCSV(exportRows()), "text/csv")}>Download CSV</button>
          <button className="dt-btn ghost" type="button" onClick={() => copy(plans.map(mdNote).join("\n---\n\n"), "Obsidian notes copied")}>Copy as Obsidian notes</button>
        </div>
        <pre className="dt-pre" tabIndex={0}>{toCSV(exportRows())}</pre>
        <p className="dt-note">Includes both trade plans (with your current levels and sizing), your portfolio and your journal. Some viewers block downloads; Copy always works.</p>
      </>
    ),
  };

  return (
    <section className="dtools" aria-label="Desk tools">
      {jumps.length > 0 && <div className="dt-jumps"><span className="dt-lab">Jump to</span>{jumps.map(([label, fn]) => <button key={label} type="button" onClick={fn}>{label}</button>)}</div>}
      <div className="dt-tabs" role="tablist">
        {TABS.map(([k, label]) => <button key={k} role="tab" type="button" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{label}</button>)}
      </div>
      <div className="dt-body" role="tabpanel">{body[tab]}{open(tab)}</div>
    </section>
  );
}

export const TOOLS_CSS = `
.desk .dtools{background:var(--card);border:1px solid var(--line);padding:clamp(14px,2.5vw,22px);display:flex;flex-direction:column;gap:16px;min-width:0}
.desk .dt-jumps{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.desk .dt-jumps button{background:none;border:1px solid #5a4214;color:var(--amber);padding:7px 10px;font-weight:600;font-size:11px;font-family:inherit;cursor:pointer}
.desk .dt-jumps button:hover{background:#15110a}
.desk .dt-tabs{display:flex;gap:6px;flex-wrap:wrap}
.desk .dt-tabs button{background:#0c0c14;border:1px solid var(--line);color:var(--muted);padding:9px 12px;font-weight:700;font-size:10px;font-family:inherit;letter-spacing:.1em;text-transform:uppercase;cursor:pointer}
.desk .dt-tabs button:hover{color:var(--fg)}
.desk .dt-tabs button.on{background:var(--amber);color:#1a1204;border-color:var(--amber)}
.desk .dt-body{display:flex;flex-direction:column;gap:14px;min-width:0}
.desk .dt-scroll{overflow-x:auto}
.desk .dt-table{width:100%;border-collapse:collapse;font-size:12px;font-variant-numeric:tabular-nums}
.desk .dt-table th{text-align:left;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);padding:8px;border-bottom:1px solid var(--line);white-space:nowrap}
.desk .dt-table td{padding:9px 8px;border-bottom:1px solid #15151c;vertical-align:top}
.desk .dt-click{cursor:pointer}.dt-click:hover,.dt-click:focus-visible{background:#11111a;outline:none}
.desk .dt-tot td{font-weight:700;border-top:1px solid var(--line)}
.desk .dt-dim{color:var(--dim);font-size:11px}
.desk .g{color:var(--green-t)}
.desk .rd{color:var(--red-t)}
.desk .dt-note{font-size:12px;line-height:1.5;color:var(--muted);margin:0;max-width:78ch}
.desk .dt-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:12px;min-width:0}
.desk .dt-cards>.dt-note,.dt-cards>.dt-link{grid-column:1/-1}
.desk .dt-card{background:var(--card2);border:1px solid var(--line);padding:14px;display:flex;flex-direction:column;gap:10px;min-width:0}
.desk .dt-h{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}
.desk .dt-pill{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;border:1px solid var(--line);padding:4px 8px;color:var(--muted)}
.desk .dt-pill.ok{color:var(--green-t);border-color:#14583a}.dt-pill.bad{color:var(--red-t);border-color:#6b1b2b}
.desk .dt-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}
.desk .dt-list li{display:flex;gap:12px;justify-content:space-between;flex-wrap:wrap;padding:7px 0;border-bottom:1px solid #15151c;font-size:12px;position:relative}
.desk .dt-list.jr li{padding-right:26px}
.desk .dt-bars{display:flex;flex-direction:column;gap:7px}
.desk .dt-bars div{display:grid;grid-template-columns:26px 1fr 52px;gap:8px;align-items:center;font-size:12px}
.desk .dt-bars i{display:block;height:8px;background:var(--amber)}
.desk .dt-bars b{text-align:right}
.desk .dt-dot{width:8px;height:8px;border-radius:50%;flex:none;margin-top:4px;background:var(--dim)}
.desk .dt-dot.ok{background:var(--green-t)}.dt-dot.warn{background:var(--amber)}
.desk .dt-list li:has(.dt-dot){justify-content:flex-start;flex-wrap:nowrap}
.desk .dt-form{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end}
.desk .dt-form label{display:flex;flex-direction:column;gap:5px;flex:1 1 110px;min-width:0}
.desk .dt-form label.wide{flex:1 1 100%}
.desk .dt-lab{font-size:10px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--muted)}
.desk .dt-form input,.dt-form select{background:#08080c;border:1px solid var(--line);color:var(--fg);font:13px var(--mono);padding:9px 10px;min-width:0;width:100%}
.desk .dt-form input:focus,.dt-form select:focus{outline:2px solid var(--amber);outline-offset:1px}
.desk .dt-row{display:flex;gap:8px;flex-wrap:wrap}
.desk .dt-btn{background:var(--amber);color:#1a1204;border:1px solid var(--amber);padding:10px 14px;font-weight:700;font-size:10px;font-family:inherit;letter-spacing:.1em;text-transform:uppercase;cursor:pointer}
.desk .dt-btn.ghost{background:#0c0c14;color:var(--amber);border-color:#5a4214}
.desk .dt-link{align-self:flex-start;background:none;border:0;color:var(--amber);font-weight:600;font-size:12px;font-family:inherit;cursor:pointer;padding:0;text-decoration:underline}
.desk .dt-x{position:absolute;right:0;top:4px;background:none;border:0;color:var(--muted);font-size:18px;line-height:1;cursor:pointer;padding:2px 6px}
.desk .dt-table .dt-x{position:static}
.desk .dt-x:hover{color:var(--red-t)}
.desk .dt-sec{display:flex;flex-direction:column;gap:6px}
.desk .dt-sec>div{display:grid;grid-template-columns:minmax(110px,190px) 1fr 62px;gap:10px;align-items:center;font-size:12px}
.desk .dt-sec>div.me{color:var(--amber);font-weight:700}
.desk .dt-sec b{text-align:right}
.desk .dt-track{height:8px;background:#14141c}
.desk .dt-track i{display:block;height:100%;background:var(--green)}
.desk .dt-track i.neg{background:var(--red)}
.desk .dt-sec .me .dt-track i{background:var(--amber)}
.desk .dt-pre{margin:0;max-height:260px;overflow:auto;background:#08080c;border:1px solid var(--line);padding:12px;font:12px/1.5 var(--mono);color:var(--muted);white-space:pre}
@media (max-width:560px){.desk .dt-sec>div{grid-template-columns:96px 1fr 56px}}
`;
