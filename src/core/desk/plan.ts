// Pure plan maths shared by the dashboard, the Chrome extension and the artifact: levels, position size,
// trailing stop, plan text and the Obsidian note. No DOM, no React, no network.

export interface Levels { entry: number; stop: number; t1: number; t2: number }
export interface DeskSettings { capital: string; riskPct: string; trailPct: string; trails: Record<string, string> }
export const DEFAULT_SETTINGS: DeskSettings = { capital: "500000", riskPct: "1", trailPct: "8", trails: {} };

/** Trail % each pick starts with: 8% for the swing, 3% for the intraday trade. Anything the user types is saved per pick in settings.trails. */
export const DEFAULT_TRAIL_BY_ID: Record<string, string> = { swing: "8", intra: "3" };
export const defaultTrailPct = (id: string) => DEFAULT_TRAIL_BY_ID[id] ?? DEFAULT_SETTINGS.trailPct;
export const trailFor = (s: Pick<DeskSettings, "trails"> | null | undefined, id: string) => {
  const v = s?.trails?.[id];
  return v !== undefined && isFinite(parseFloat(String(v))) ? String(v) : defaultTrailPct(id);
};

const fmtN = (n: number, d = 0) => Number(n).toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });

/** Turn the text boxes ("2470") into numbers; anything unreadable becomes NaN. */
export function parseLevels(raw: Record<string, string | number | undefined>): Levels {
  const n = (v: unknown) => parseFloat(String(v));
  return { entry: n(raw.entry), stop: n(raw.stop), t1: n(raw.t1), t2: n(raw.t2) };
}

/** Stop below entry, T1 above entry, T2 at or above T1, all positive. */
export const levelsOk = (L: Levels) =>
  [L.entry, L.stop, L.t1, L.t2].every((v) => isFinite(v) && v > 0) && L.entry > L.stop && L.t1 > L.entry && L.t2 >= L.t1;

export interface Size { cap: number; rp: number; risk: number; qty: number; capped: boolean; value: number; atRisk: number; r1: number; r2: number }

/** qty = capital x risk% / (entry - stop), never more than capital / entry. */
export function sizePosition(L: Levels, capital: string | number, riskPct: string | number): Size | null {
  if (!levelsOk(L)) return null;
  const cap = parseFloat(String(capital)) || 0, rp = parseFloat(String(riskPct)) || 0, risk = L.entry - L.stop;
  let qty = Math.max(0, Math.floor((cap * rp) / 100 / risk));
  const maxq = Math.floor(cap / L.entry), capped = qty > maxq;
  if (capped) qty = maxq;
  return { cap, rp, risk, qty, capped, value: qty * L.entry, atRisk: qty * risk, r1: (L.t1 - L.entry) / risk, r2: (L.t2 - L.entry) / risk };
}

export interface Trail { p: number; hi: number; stop: number; fromClose: number; binding: boolean; activates: number; usingData: boolean; dataHigh: number }

/** Trailing stop = highest price since entry x (1 - pct). With no high entered, the highest close in the data is used. */
export function trailStop(closes: number[], close: number, pct: string | number, highInput: string | number | undefined, fixedStop?: number): Trail | null {
  const p = parseFloat(String(pct));
  if (!(p > 0 && p < 50)) return null;
  const dataHigh = Math.max(...closes), typed = parseFloat(String(highInput ?? ""));
  const usingData = !(typed > 0), hi = usingData ? dataHigh : typed, stop = hi * (1 - p / 100);
  const initial = fixedStop != null && isFinite(fixedStop) ? fixedStop : NaN;
  return { p, hi, stop, fromClose: (1 - stop / close) * 100, binding: isFinite(initial) && stop > initial, activates: isFinite(initial) ? initial / (1 - p / 100) : NaN, usingData, dataHigh };
}

export interface NotePick { sym: string; name: string; mode: string; setup: string; close: number; checks: [string, string, string][]; unchecked?: number }

export function planText(t: Pick<NotePick, "sym" | "mode">, L: Levels, size: Size | null, trail: Trail | null) {
  return `${t.sym} (${t.mode})\nEntry ₹${fmtN(L.entry, 2)}  Stop ₹${fmtN(L.stop, 2)}  T1 ₹${fmtN(L.t1, 2)}  T2 ₹${fmtN(L.t2, 2)}` +
    (size ? `\nQty ${size.qty} at ₹${fmtN(size.cap)} capital and ${size.rp}% risk (risk ₹${fmtN(size.atRisk)})` : "") +
    (trail ? `\nTrailing stop ${trail.p}% below ₹${fmtN(trail.hi, 2)} = ₹${fmtN(trail.stop, 2)}` : "");
}

/** The note the Obsidian vault expects (type: minervini-sepa-setup). extra adds RSI and EMA when the caller has them. */
export function obsidianNote(t: NotePick, L: Levels, size: Size | null, today = new Date().toISOString().slice(0, 10), extra?: { rsi?: number; ema20?: number }) {
  const pass = t.checks.filter((c) => c[2] === "pass").length;
  return `---
type: minervini-sepa-setup
ticker: ${t.sym}
name: "${t.name}"
exchange: NSE
current_price: ${t.close}
pivot_price: ${L.entry}
stop_loss: ${L.stop}
target_1: ${L.t1}
target_2: ${L.t2}
trend_score: ${pass}
${extra?.rsi != null ? `rsi_14: ${extra.rsi}\n` : ""}${extra?.ema20 != null ? `ema_20: ${extra.ema20}\n` : ""}created_date: "${today}"
tags:
  - trading/minervini
---

# ${t.sym}: ${t.name} (NSE)

- Pattern: ${t.setup}
- Entry ₹${fmtN(L.entry, 2)}, stop ₹${fmtN(L.stop, 2)}, T1 ₹${fmtN(L.t1, 2)}, T2 ₹${fmtN(L.t2, 2)}
${size ? `- Size at ₹${fmtN(size.cap)} and ${size.rp}% risk: ${size.qty} shares\n` : ""}${(t.unchecked ?? 2) > 0 ? "- Not checked: 200 DMA slope, RS rating\n" : ""}`;
}

/** Shared settings, one shape for localStorage (dashboard) and chrome.storage (extension). */
export function mergeSettings(saved: Partial<DeskSettings> | null | undefined): DeskSettings {
  const s: DeskSettings = { ...DEFAULT_SETTINGS, trails: {} };
  (["capital", "riskPct", "trailPct"] as const).forEach((k) => { const v = saved?.[k]; if (v !== undefined && v !== null && isFinite(parseFloat(String(v)))) s[k] = String(v); });
  const tr = saved?.trails;
  if (tr && typeof tr === "object") Object.entries(tr).forEach(([id, v]) => { if (isFinite(parseFloat(String(v)))) s.trails[id] = String(v); });
  return s;
}

/** Change since the previous session's close. For the 9 Nov picks the feed's prevClose field disagrees with the 6 Nov bar
 *  (2370 vs 2340 for LAURUSLABS, 1744 vs 1785.1 for SAILIFE), so the previous bar is used: it matches the chart on every surface. */
export const previousClose = (t: { prev?: number; closes?: number[] }) => (t.closes && t.closes.length > 1 ? t.closes[t.closes.length - 2] : (t.prev as number));
export const dayChangePct = (t: { close: number; prev?: number; closes?: number[] }) => (t.close / previousClose(t) - 1) * 100;
