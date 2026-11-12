// Terminal dashboard for the desk: both picks with a sparkline and a stop-to-target ladder, the open tracker positions and the
// live chart-pattern hits, on one screen. Pure: renderDash() returns the text, so it is easy to test. No live feed; it shows the
// picks file plus your positions file, and --watch re-reads the positions file so `track update` in another window shows up here.
import {
  TRADES, PICKS_META, SESSION_DATES, parseLevels, sizePosition, trailStop, trailFor, dayChangePct, rsiSeries, emaSeries, stageInfo,
  patternAlerts, scanPatterns, seriesFromTrade, trackerView, type Position,
} from "../src/core/desk";

const fmtIn = (n: number, d = 0) => Number(n).toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
const inr = (v: number, d = 2) => "₹" + fmtIn(v, d);
const signed = (x: number, d: number) => (x < 0 ? "" : "+") + x.toFixed(d);

export interface DashOptions { width?: number; color?: boolean; positions?: Record<string, Position>; capital?: string; risk?: string }

const SPARK = "▁▂▃▄▅▆▇█";
export function sparkline(v: number[], n: number): string {
  const a = v.slice(-n), lo = Math.min(...a), hi = Math.max(...a);
  return a.map((x) => SPARK[hi === lo ? 3 : Math.min(7, Math.floor(((x - lo) / (hi - lo)) * 8))]).join("");
}

/** One line from the stop to T2 with S (stop), C (close), E (entry), 1 and 2 (targets) placed in proportion. */
export function ladder(L: { stop: number; entry: number; t1: number; t2: number }, close: number, w: number): string {
  const lo = Math.min(L.stop, close), hi = Math.max(L.t2, close), cells = Array.from({ length: w }, () => "─");
  const at = (p: number) => Math.max(0, Math.min(w - 1, Math.round(((p - lo) / (hi - lo)) * (w - 1))));
  for (const [p, ch] of [[L.stop, "S"], [L.entry, "E"], [L.t1, "1"], [L.t2, "2"], [close, "●"]] as [number, string][]) cells[at(p)] = ch;
  return cells.join("");
}

export function renderDash(o: DashOptions = {}): string {
  const W = Math.max(60, Math.min(o.width ?? 100, 140)), c = o.color ?? false;
  const paint = (code: number) => (s: string) => (c ? `\x1b[${code}m${s}\x1b[0m` : s);
  const bold = paint(1), dim = paint(2), red = paint(31), green = paint(32), yellow = paint(33), cyan = paint(36);
  const out: string[] = [];
  const rule = (ch = "─") => dim(ch.repeat(W));
  const sev = (s: string) => (s === "warn" ? yellow("!") : s === "ok" ? green("+") : dim("·"));

  out.push(bold(cyan(" MINERVINI TRADE DESK ")) + dim(`  ${PICKS_META.label}  ·  capital ${inr(+(o.capital ?? 500000), 0)}, risk ${o.risk ?? "1"}%`));
  out.push(rule("═"));

  for (const t of TRADES) {
    const L = parseLevels(t.L), z = sizePosition(L, o.capital ?? "500000", o.risk ?? "1");
    const tp = parseFloat(trailFor(null, t.id)), trail = trailStop(t.closes, t.close, tp, "", L.stop);
    const tt = { ...t, dates: SESSION_DATES }, rsi = rsiSeries(tt).at(-1)!, ema = emaSeries(tt).at(-1)!, st = stageInfo(tt);
    const chg = dayChangePct(t), passN = t.checks.filter((k) => k[2] === "pass").length;
    const head = ` ${bold(t.sym)}  ${t.name} · ${t.mode.split("·")[0].trim()}`;
    const px = `${inr(t.close)}  ${(chg >= 0 ? green : red)(signed(chg, 1) + "%")} `;
    const gap = Math.max(1, W - visible(head) - visible(px));
    out.push(head + " ".repeat(gap) + px);
    out.push(`  ${dim(t.setup)}`);
    out.push(`  ${dim("40 sessions")} ${cyan(sparkline(t.closes, Math.min(40, W - 20)))}`);
    const lw = W - 4;
    out.push(`  ${ladder(L, t.close, lw)}`);
    out.push(`  ${dim("S stop · E entry · 1 T1 · 2 T2 · ● close")}`);
    out.push(`  Entry ${inr(L.entry)}   Stop ${red(inr(L.stop))} (${(((L.stop / L.entry) - 1) * 100).toFixed(1)}%)   T1 ${inr(L.t1)}${z ? ` ${z.r1.toFixed(1)}R` : ""}   T2 ${inr(L.t2)}${z ? ` ${z.r2.toFixed(1)}R` : ""}`);
    if (z) out.push(`  Qty ${bold(String(z.qty))}  position ${inr(z.value, 0)}  at risk ${inr(z.atRisk, 0)}${z.capped ? yellow("  (capped by capital)") : ""}`);
    if (trail) out.push(`  Trailing stop ${tp}% below ${inr(trail.hi)} = ${bold(inr(trail.stop))}${trail.binding ? "" : dim("  (below your fixed stop, so the fixed stop rules)")}`);
    out.push(`  RSI ${rsi.toFixed(1)}  ·  EMA20 ${inr(ema)}  ·  ${st.ext50.toFixed(1)}% above 50 DMA  ·  stage 2 ${st.stage2 ? green("yes") : red("no")}  ·  template ${passN}/${t.checks.length}`);
    for (const [s, txt] of patternAlerts(tt, L).filter(([s]: any) => s === "warn").slice(0, 3)) out.push(`  ${sev(s)} ${txt}`);
    const hits = scanPatterns(seriesFromTrade(t)).filter((r) => r.state === "confirmed" || r.state === "forming");
    for (const r of hits) out.push(`  ${r.state === "confirmed" ? green("◆") : yellow("◇")} ${r.name} ${r.state}, ${r.bias}${r.level ? ` · trigger ${inr(r.level)}` : ""}${r.target ? ` · target ${inr(r.target)}` : ""}`);
    out.push(rule());
  }

  const pos = o.positions ?? {}, ids = Object.keys(pos);
  out.push(bold(" OPEN POSITIONS"));
  if (!ids.length) out.push(dim("  none. Start one with: npm run desk -- track open swing --fill 2470 --qty 33"));
  for (const id of ids) {
    const p = pos[id], v = trackerView(p, parseFloat(trailFor(null, id))), sym = TRADES.find((t) => t.id === id)?.sym ?? id;
    const col = v.status === "hit" ? red : v.status === "danger" ? yellow : green;
    out.push(`  ${bold(sym.padEnd(11))}${p.qty} @ ${inr(p.fill)}  last ${inr(p.last)}  stop ${inr(v.stop)} (${v.binding})  P&L ${col((v.pnl >= 0 ? "+" : "-") + "₹" + fmtIn(Math.abs(v.pnl)))} (${signed(v.pnlPct, 1)}%, ${signed(v.openR, 2)}R)  ${col(v.status.toUpperCase())}`);
  }
  out.push(rule("═"));
  out.push(dim(` Not checked: ${PICKS_META.uncheckedRules.join(", ")}. Levels come from the bhavcopy screen; this is not advice.`));
  return out.flatMap((l) => wrapLine(l, W)).join("\n") + "\n";
}

/** Break a long text line at spaces so nothing runs past the screen; continuation lines keep the indent plus two spaces. */
export function wrapLine(line: string, w: number): string[] {
  if (visible(line) <= w) return [line];
  const indent = line.match(/^ */)![0].length, pad = " ".repeat(indent + 2), words = line.trim().split(/ +/), rows: string[] = [];
  let cur = " ".repeat(indent);
  for (const word of words) {
    const has = visible(cur) > (rows.length ? pad.length : indent);
    if (has && visible(cur) + 1 + visible(word) > w) { rows.push(cur); cur = pad + word; }
    else cur += (has ? " " : "") + word;
  }
  rows.push(cur);
  return rows;
}

const visible = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "").length;
