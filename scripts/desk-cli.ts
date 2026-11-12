// The desk on the command line: both picks, sizing, trailing-stop tracker, chart patterns on your own bhavcopy files,
// and the Obsidian note. Same commands and output as the Python package in python/.
//
//   npm run desk -- picks [--capital 500000 --risk 1]
//   npm run desk -- size --entry 2470 --stop 2320 --t1 2770 --t2 2920 [--capital 500000 --risk 1 --trail 8]
//   npm run desk -- patterns [--symbols TRENT SUVEN] [--bhavcopy FILES... ] [--all] [--json]
//   npm run desk -- note LAURUSLABS [--vault DIR]
//   npm run desk -- track open swing --fill 2470 --qty 33
//   npm run desk -- track update swing --price 2600 [--high 2610 --low 2580 --on 2026-11-12]
//   npm run desk -- dash [--watch] [--no-color] [--width 100]
//   npm run desk -- track show [swing]
//   npm run desk -- track close swing
import { parseArgs } from "node:util";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import {
  TRADES, PICKS_META, SESSION_DATES, FAMILIES, scanPatterns, seriesFromTrade, parseLevels, levelsOk, sizePosition, trailStop, planText, obsidianNote,
  trailFor, dayChangePct, rsiSeries, emaSeries, stageInfo, patternAlerts, candlePatterns, openPosition, applyBar, trackerView, sanitizePositions,
  buildHistory, barsToSeries, type DeskPick, type Position, type Series, type PatternResult, type DailyBar,
} from "../src/core/desk";
import { REAL_BARS } from "../src/data/realNseBars";
import { renderDash } from "./desk-dash";

const HELP = `Minervini trade desk (TypeScript). Commands:
  picks [--capital 500000 --risk 1]
  size --entry 2470 --stop 2320 --t1 2770 --t2 2920 [--capital 500000 --risk 1 --trail 8]
  patterns [--symbols TRENT SUVEN] [--bhavcopy FILES...] [--all] [--json]
  note <pick> [--vault DIR]
  dash [--watch] [--no-color] [--width 100]   one-screen dashboard; --watch redraws every 2 s
  track open <pick> --fill 2470 --qty 33 [--stop N]
  track update <pick> --price 2600 [--high N --low N --on YYYY-MM-DD]
  track show [pick]
  track close <pick>
Picks are swing (LAURUSLABS) and intra (SAILIFE). Positions are kept in ~/.trade_desk/positions.json (override with --state).`;
const STATE = join(homedir(), ".trade_desk", "positions.json");
export const fmtIn = (n: number, d = 0) => Number(n).toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
const inr = (v: number) => "₹" + fmtIn(v, 2);
const signed = (x: number, d: number) => (x < 0 ? "" : "+") + x.toFixed(d);
const money = (x: number) => (x >= 0 ? "+" : "-") + "₹" + fmtIn(Math.abs(x));

export interface Result { code: number; out: string; err: string }
class Fail extends Error { constructor(msg: string, public code = 2) { super(msg); } }

const LIST_FLAGS = new Set(["--symbols", "--bhavcopy"]);
const OPTIONS = {
  capital: { type: "string", default: "500000" }, risk: { type: "string", default: "1" },
  entry: { type: "string" }, stop: { type: "string" }, t1: { type: "string" }, t2: { type: "string" }, trail: { type: "string", default: "8" },
  symbols: { type: "string", multiple: true }, bhavcopy: { type: "string", multiple: true }, all: { type: "boolean" }, json: { type: "boolean" },
  vault: { type: "string" },
  fill: { type: "string" }, qty: { type: "string" }, price: { type: "string" }, high: { type: "string" }, low: { type: "string" }, on: { type: "string" },
  watch: { type: "boolean" }, "no-color": { type: "boolean" }, width: { type: "string" },
  state: { type: "string", default: STATE }, help: { type: "boolean", short: "h" },
} as const;

/** `--symbols A B C` -> `--symbols A --symbols B --symbols C`, so a list flag takes every value up to the next flag (like a shell glob expansion). */
function spreadLists(argv: string[]): string[] {
  const out: string[] = [];
  let cur: string | null = null, n = 0;
  for (const a of argv) {
    if (a.startsWith("--")) { cur = LIST_FLAGS.has(a) ? a : null; n = 0; out.push(a); }
    else if (cur) { if (n > 0) out.push(cur); out.push(a); n++; }
    else out.push(a);
  }
  return out;
}

/** PowerShell and cmd do not expand `*`: do it here for the file name part of a path. */
export function expandGlob(p: string): string[] {
  if (!p.includes("*")) return [p];
  const dir = dirname(p), re = new RegExp("^" + basename(p).replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$", "i");
  try { return readdirSync(dir).filter((f) => re.test(f)).sort().map((f) => join(dir, f)); } catch { return []; }
}

const need = (v: string | undefined, name: string): number => {
  const n = parseFloat(String(v));
  if (!isFinite(n)) throw new Fail(`--${name} needs a number`);
  return n;
};
const getPick = (key: string): DeskPick => {
  const k = key.trim().toLowerCase(), t = TRADES.find((x) => x.sym.toLowerCase() === k || x.id.toLowerCase() === k);
  if (!t) throw new Fail(`No pick called '${key}'. Picks: ` + TRADES.map((x) => `${x.sym} (${x.id})`).join(", "));
  return t;
};
const withDates = (t: DeskPick) => ({ ...t, dates: SESSION_DATES });

function loadPositions(path: string): Record<string, Position> {
  try { return sanitizePositions(JSON.parse(readFileSync(path, "utf-8"))); } catch { return {}; }
}
function savePositions(path: string, pos: Record<string, Position>) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(pos, null, 1), "utf-8");
}

type V = ReturnType<typeof parseArgs<{ options: typeof OPTIONS; allowPositionals: true }>>["values"];

export function run(argv: string[]): Result {
  let out = "", err = "";
  const p = (s = "") => { out += s + "\n"; };
  const hr = (title: string) => { p(); p(title); p("-".repeat(title.length)); };
  try {
    const [cmd, ...rest] = argv;
    if (!cmd || cmd === "-h" || cmd === "--help" || cmd === "help") { p(HELP); return { code: cmd ? 0 : 2, out, err }; }
    let parsed: ReturnType<typeof parseArgs<{ options: typeof OPTIONS; allowPositionals: true }>>;
    try { parsed = parseArgs({ args: spreadLists(rest), options: OPTIONS, allowPositionals: true }); }
    catch (e: any) { throw new Fail(String(e.message ?? e)); }
    const { values: a, positionals: pos } = parsed;

    if (cmd === "picks") {
      p(`Desk picks, ${PICKS_META.label}`);
      for (const t of TRADES) {
        const L = parseLevels(t.L), z = sizePosition(L, a.capital!, a.risk!);
        const trail = trailStop(t.closes, t.close, trailFor(null, t.id), "", L.stop);
        hr(`${t.sym}  ${t.name}  (${t.mode})`);
        p(`Setup: ${t.setup}`);
        p(`Close ${inr(t.close)}  (${signed(dayChangePct(t), 1)}% on the day)   52w ${inr(t.lo52)} to ${inr(t.hi52)}`);
        p(planText(t, L, z, trail));
        if (z) p(`R multiples: T1 ${z.r1.toFixed(1)}R, T2 ${z.r2.toFixed(1)}R   position value ${inr(z.value)}` + (z.capped ? "  (capped by capital)" : ""));
        const tt = withDates(t), rsi = rsiSeries(tt).at(-1)!, ema = emaSeries(tt).at(-1)!, st = stageInfo(tt);
        p(`RSI(14) ${rsi.toFixed(1)}   EMA(20) ${inr(ema)}   stage 2: ${st.stage2 ? "yes" : "no"}   ${st.ext50.toFixed(1)}% above the 50 DMA`);
        p(`Trend Template: ${t.checks.filter((c) => c[2] === "pass").length} pass, ${t.checks.filter((c) => c[2] === "unk").length} not checked`);
        for (const [sev, txt] of patternAlerts(tt, L)) p(`  [${String(sev).padStart(4)}] ${txt}`);
        for (const c of candlePatterns(tt).filter((c: any) => c.i >= t.closes.length - 10)) p(`  candle ${SESSION_DATES[c.i]}: ${c.name} (${c.bias})`);
        for (const r of scanPatterns(seriesFromTrade(t))) if (r.state === "confirmed" || r.state === "forming") p(`  chart pattern: ${r.name} ${r.state}, ${r.bias}. ${r.detail}`);
        p(`Plan: ${t.targets}`);
      }
      p();
      p("Not checked: " + PICKS_META.uncheckedRules.join(", ") + ". Levels are from the bhavcopy screen, not advice.");
      return { code: 0, out, err };
    }

    if (cmd === "dash") {
      const w = a.width !== undefined ? need(a.width, "width") : process.stdout.columns || 100;
      p(renderDash({ width: w, color: !a["no-color"] && !process.env.NO_COLOR && (process.stdout.isTTY || a.watch === true), positions: loadPositions(a.state!), capital: a.capital, risk: a.risk }).trimEnd());
      return { code: 0, out, err };
    }

    if (cmd === "size") {
      const L = parseLevels({ entry: need(a.entry, "entry"), stop: need(a.stop, "stop"), t1: need(a.t1, "t1"), t2: need(a.t2, "t2") });
      if (!levelsOk(L)) throw new Fail("Levels do not work: need stop < entry < T1 <= T2, all above zero.");
      const z = sizePosition(L, a.capital!, a.risk!)!, trail = trailStop([L.entry], L.entry, a.trail!, "", L.stop);
      p(`Capital ${inr(z.cap)}  risk ${z.rp}%  risk per share ${inr(z.risk)}`);
      p(`Quantity ${z.qty}  position ${inr(z.value)}  at risk ${inr(z.atRisk)}` + (z.capped ? "  (capped by capital)" : ""));
      p(`T1 ${z.r1.toFixed(2)}R   T2 ${z.r2.toFixed(2)}R`);
      if (trail) p(`Trailing stop ${trail.p}% below the highest price: starts working once price passes ${inr(trail.activates)}`);
      return { code: 0, out, err };
    }

    if (cmd === "patterns") {
      const files = (a.bhavcopy ?? []).flatMap(expandGlob);
      if ((a.bhavcopy ?? []).length && !files.length) throw new Fail("No bhavcopy files matched.");
      let hist: Record<string, DailyBar[]> = {};
      if (files.length) {
        const missing = files.filter((f) => !existsSync(f));
        if (missing.length) throw new Fail(`File not found: ${missing[0]}`);
        try { hist = buildHistory(files.map((f) => ({ name: basename(f), text: readFileSync(f, "utf-8") })), a.symbols); }
        catch (e: any) { throw new Fail(String(e.message ?? e)); }
      }
      const syms = a.symbols?.length ? a.symbols.map((s) => s.toUpperCase()) : Object.keys(hist).length ? Object.keys(hist).sort() : [...TRADES.map((t) => t.sym), ...Object.keys(REAL_BARS)];
      const seriesFor = (s: string): Series | null => {
        const t = TRADES.find((x) => x.sym === s);
        if (t) return seriesFromTrade(t);
        if (hist[s]) return barsToSeries(hist[s]);
        const b = REAL_BARS[s];
        return b ? { h: b.h, l: b.l, c: b.c } : null;
      };
      const rows: { symbol: string; bars: number; patterns: PatternResult[] }[] = [];
      for (const s of syms) {
        const ser = seriesFor(s);
        if (!ser) { err += `${s}: no price history (give --bhavcopy files)\n`; continue; }
        rows.push({ symbol: s, bars: ser.c.length, patterns: scanPatterns(ser) });
      }
      if (a.json) { p(JSON.stringify(rows, null, 1)); return { code: 0, out, err }; }
      p("Chart patterns (confirmed = a close broke the trigger line in the last 8 bars; forming = shape in place, no trigger yet)\n");
      const short: Record<string, string> = { "Head and shoulders": "H&S", "Double top": "Dbl top", "Double bottom": "Dbl bottom", "Rounding bottom": "Round bot", "Cup and handle": "Cup+handle",
        "Wedges": "Wedges", "Pennant or flags": "Flag/pennant", "Ascending triangle": "Asc tri", "Descending triangle": "Desc tri", "Symmetrical triangle": "Sym tri" };
      p("Ticker".padEnd(12) + "Bars".padStart(5) + "  " + FAMILIES.map((f) => short[f].padEnd(12)).join("  "));
      const cell = (r: PatternResult) => (r.state === "confirmed" ? "YES" : r.state === "forming" ? "forming" : r.state === "none" ? "-" : "n/a");
      for (const r of rows) p(r.symbol.padEnd(12) + String(r.bars).padStart(5) + "  " + r.patterns.map((x) => cell(x).padEnd(12)).join("  "));
      let shown = false;
      for (const r of rows) {
        const act = r.patterns.filter((x) => x.state === "confirmed" || x.state === "forming");
        if (act.length && (a.all || a.symbols?.length || rows.length <= 12)) {
          if (!shown) { p(); shown = true; }
          p(r.symbol);
          for (const x of act) p(`  ${x.state.toUpperCase().padEnd(9)} ${x.name}, ${x.bias}: ${x.detail}`);
        }
      }
      p();
      p("Rule-based detection on daily bars. Open the chart before trading a pattern; about 60 bars is short for a cup and handle or rounding bottom.");
      return { code: 0, out, err };
    }

    if (cmd === "note") {
      if (!pos[0]) throw new Fail("Name the pick: swing or intra (or the ticker).");
      const t = getPick(pos[0]), L = parseLevels(t.L), tt = withDates(t), z = sizePosition(L, a.capital!, a.risk!);
      const note = obsidianNote({ ...t, unchecked: 2 }, L, z, undefined, { rsi: +rsiSeries(tt).at(-1)!.toFixed(1), ema20: +emaSeries(tt).at(-1)!.toFixed(2) });
      if (a.vault) {
        const file = join(a.vault, "Trades", `${t.sym}-${PICKS_META.asOf}.md`);
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, note, "utf-8");
        p(`Wrote ${file}`);
      } else p(note);
      return { code: 0, out, err };
    }

    if (cmd === "track") {
      const [action, pickKey] = pos;
      if (!["open", "update", "show", "close"].includes(action ?? "")) throw new Fail("track needs one of: open, update, show, close");
      if (action !== "show" && !pickKey) throw new Fail("Name the pick: swing or intra (or the ticker).");
      const state = a.state!, all = loadPositions(state), pid = pickKey ? getPick(pickKey).id : null;
      if (action === "open") {
        if (a.fill === undefined || a.qty === undefined) throw new Fail("open needs --fill and --qty");
        const t = getPick(pickKey), L = parseLevels(t.L);
        const pp = openPosition({ fill: need(a.fill, "fill"), qty: need(a.qty, "qty"), stop0: a.stop !== undefined ? need(a.stop, "stop") : L.stop, on: a.on });
        if (!pp) throw new Fail("Cannot open: need fill > stop, both above zero, and at least 1 share.");
        all[pid!] = pp; savePositions(state, all);
        p(`Opened ${t.sym}: ${pp.qty} shares at ${inr(pp.fill)}, stop ${inr(pp.stop0)}`);
        return { code: 0, out, err };
      }
      if (action === "close") {
        if (!all[pid!]) throw new Fail("No open position there.");
        delete all[pid!]; savePositions(state, all);
        p(`Closed ${pid}`);
        return { code: 0, out, err };
      }
      if (action === "update" && a.price === undefined) throw new Fail("update needs --price");
      const ids = pid ? [pid] : Object.keys(all);
      if (!ids.length || ids.some((i) => !all[i])) throw new Fail("No open position. Start one with: track open <pick> --fill <price> --qty <n>");
      for (const i of ids) {
        const trail = parseFloat(trailFor(null, i));
        if (action === "update") {
          all[i] = applyBar(all[i], { price: need(a.price, "price"), high: a.high !== undefined ? need(a.high, "high") : undefined, low: a.low !== undefined ? need(a.low, "low") : undefined, on: a.on }, trail);
          savePositions(state, all);
        }
        const q = all[i], v = trackerView(q, trail), sym = getPick(i).sym;
        p(`${sym}  ${q.qty} shares, fill ${inr(q.fill)}, last ${inr(q.last)}, high ${inr(q.high)}`);
        p(`  Stop ${inr(v.stop)} (${v.binding}, raised ${inr(v.raisedBy)} from the starting ${inr(q.stop0)}), ${trail}% trail  status: ${v.status.toUpperCase()}`);
        p(`  P&L ${money(v.pnl)} (${signed(v.pnlPct, 1)}%), ${signed(v.openR, 2)}R   ${v.distancePct.toFixed(1)}% above the stop`);
        p(`  If the stop fills: ${money(v.lockedIfStopped)}`);
        if (action === "update" && q.log.length) p(`  ${q.log[q.log.length - 1].note}`);
      }
      return { code: 0, out, err };
    }

    throw new Fail(`Unknown command '${cmd}'. Use: picks, size, patterns, note, track (or --help).`);
  } catch (e: any) {
    if (e instanceof Fail) return { code: e.code, out, err: err + e.message + "\n" };
    throw e;
  }
}
