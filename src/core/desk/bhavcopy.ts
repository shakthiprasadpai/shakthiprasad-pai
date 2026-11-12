// Build price history from NSE cash-market bhavcopy text, so the pattern scan can run on your own data.
// Pure: it takes the CSV text, so the same code can run in Node (the desk CLI) or in a browser file picker.
//
// Two formats are read:
//   UDiFF       BhavCopy_NSE_CM_0_0_0_YYYYMMDD_F_0000.csv  (TckrSymb, SctySrs, OpnPric, HghPric, LwPric, ClsPric, TtlTradgVol, TradDt)
//   Full bhav   sec_bhavdata_full_DDMMYYYY.csv             (SYMBOL, SERIES, DATE1, OPEN_PRICE, HIGH_PRICE, LOW_PRICE, CLOSE_PRICE, TTL_TRD_QNTY)
// Only the EQ series is kept. Bars come back sorted by date.
import { parseCsv } from "./patternSheet";
import type { Series } from "./chartPatterns";

export interface DailyBar { date: string; o: number; h: number; l: number; c: number; v: number }

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const FULL_MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const iso = (y: number, m: number, d: number) => {
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) throw new Error(`unreadable date ${y}-${m}-${d}`);
  return t.toISOString().slice(0, 10);
};

/** 2026-07-01, 01-Jul-2026, 01-July-2026 or 01/07/2026 -> 2026-07-01. */
export function parseBhavDate(raw: string): string {
  const s = raw.trim();
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) return iso(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{1,2})-([A-Za-z]+)-(\d{4})$/))) {
    const k = m[2].toLowerCase(), mi = k.length === 3 ? MONTHS.indexOf(k) : FULL_MONTHS.indexOf(k);
    if (mi >= 0) return iso(+m[3], mi + 1, +m[1]);
  }
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) return iso(+m[3], +m[2], +m[1]);
  throw new Error(`unreadable date '${raw}'`);
}

const num = (v: string | undefined): number | null => {
  const x = parseFloat(String(v ?? "").trim().replace(/,/g, ""));
  return isFinite(x) && x > 0 ? x : null;
};

/** One daily file -> { symbol: bar } for EQ rows, optionally only some symbols. `name` is only used in the error message. */
export function readBhavText(text: string, name = "file", symbols?: string[]): Record<string, DailyBar> {
  const rows = parseCsv(text);
  if (!rows.length) return {};
  const head = rows[0].map((h) => h.trim());
  const has = (...k: string[]) => k.every((x) => head.includes(x));
  let cols: { sym: string; ser: string; dt: string; o: string; h: string; l: string; c: string; v: string };
  if (has("TckrSymb", "ClsPric")) cols = { sym: "TckrSymb", ser: "SctySrs", dt: "TradDt", o: "OpnPric", h: "HghPric", l: "LwPric", c: "ClsPric", v: "TtlTradgVol" };
  else if (has("SYMBOL", "CLOSE_PRICE")) cols = { sym: "SYMBOL", ser: "SERIES", dt: "DATE1", o: "OPEN_PRICE", h: "HIGH_PRICE", l: "LOW_PRICE", c: "CLOSE_PRICE", v: "TTL_TRD_QNTY" };
  else throw new Error(`${name}: not a cash-market bhavcopy (columns: ${head.slice(0, 8).join(", ")} ...)`);
  const ix = Object.fromEntries(Object.entries(cols).map(([k, v]) => [k, head.indexOf(v)])) as Record<keyof typeof cols, number>;
  const want = symbols?.length ? new Set(symbols.map((s) => s.toUpperCase())) : null;
  const out: Record<string, DailyBar> = {};
  for (const r of rows.slice(1)) {
    const g = (i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");
    if (g(ix.ser) !== "EQ") continue;
    const sym = g(ix.sym).toUpperCase();
    if (!sym || (want && !want.has(sym))) continue;
    const [o, h, l, c] = [g(ix.o), g(ix.h), g(ix.l), g(ix.c)].map(num);
    if (o == null || h == null || l == null || c == null) continue;
    out[sym] = { date: parseBhavDate(g(ix.dt)), o, h, l, c, v: num(g(ix.v)) ?? 0 };
  }
  return out;
}

/** Many daily files -> { symbol: bars oldest..newest }. A date that appears twice keeps the later file. */
export function buildHistory(files: { name: string; text: string }[], symbols?: string[]): Record<string, DailyBar[]> {
  const bySym: Record<string, Map<string, DailyBar>> = {};
  for (const f of files) for (const [s, bar] of Object.entries(readBhavText(f.text, f.name, symbols))) (bySym[s] ??= new Map()).set(bar.date, bar);
  return Object.fromEntries(Object.entries(bySym).map(([s, m]) => [s, [...m.keys()].sort().map((k) => m.get(k)!)]));
}

export const barsToSeries = (b: DailyBar[]): Series => ({ h: b.map((x) => x.h), l: b.map((x) => x.l), c: b.map((x) => x.c) });
