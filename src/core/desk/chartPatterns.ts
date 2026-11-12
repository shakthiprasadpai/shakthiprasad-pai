// The ten chart patterns from IG's list, detected on daily bars. Pure: no DOM, no storage, no network.
//
// Input is oldest -> newest highs, lows and closes. Every pattern is judged from confirmed swing pivots
// (a bar that is the highest/lowest of the 2 bars either side), cleaned into an alternating zigzag.
//
//   confirmed    shape is in place AND a close has broken through the trigger line within the last FRESH bars
//   forming      shape is in place, trigger not yet hit
//   none         not formed (or broke out so long ago that it is stale)
//   insufficient not enough bars to judge this pattern
//
// Honest limits: rule-based detection is approximate. Two people can draw different lines on the same chart,
// so treat a "forming" result as "worth a look at the chart", not as a signal. A pivot needs 2 bars after it,
// so a turn made in the last 2 bars is not seen yet.

export type PatternState = "confirmed" | "forming" | "none" | "insufficient";
export type PatternBias = "bullish" | "bearish" | "neutral";

export interface Series { h: number[]; l: number[]; c: number[] }

export interface PatternResult {
  family: string;
  name: string; // the specific variant found (e.g. "Inverse head and shoulders"), else the family name
  bias: PatternBias;
  state: PatternState;
  detail: string;
  level?: number; // the trigger / breakout line
  target?: number; // measured-move target
  stop?: number; // where the pattern is wrong
  from?: number; // first / last bar index the pattern spans
  to?: number;
}

export const FAMILIES = [
  "Head and shoulders", "Double top", "Double bottom", "Rounding bottom", "Cup and handle",
  "Wedges", "Pennant or flags", "Ascending triangle", "Descending triangle", "Symmetrical triangle",
] as const;

export const FRESH = 8; // a breakout older than this many bars is stale, not a live setup

const inr = (v: number) => "₹" + v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const maxOf = (a: number[]) => a.reduce((x, y) => (y > x ? y : x), -Infinity);
const minOf = (a: number[]) => a.reduce((x, y) => (y < x ? y : x), Infinity);
const ago = (k: number) => (k <= 0 ? "on the last bar" : k === 1 ? "1 bar ago" : `${k} bars ago`);

// ---------- maths ----------
function linFit(xs: number[], ys: number[]) {
  const n = xs.length;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sx += xs[i]; sy += ys[i]; sxx += xs[i] * xs[i]; sxy += xs[i] * ys[i]; }
  const den = n * sxx - sx * sx;
  const slope = den === 0 ? 0 : (n * sxy - sx * sy) / den;
  const icpt = (sy - slope * sx) / n;
  return { slope, icpt };
}
interface Line { slope: number; at: (i: number) => number }
const mkLine = (xs: number[], ys: number[]): Line => { const f = linFit(xs, ys); return { slope: f.slope, at: (i) => f.icpt + f.slope * i }; };

// y = a x^2 + b x + c over x in [0,1]; returns the fit quality too
function quadFit(ys: number[]) {
  const m = ys.length;
  let s0 = 0, s1 = 0, s2 = 0, s3 = 0, s4 = 0, t0 = 0, t1 = 0, t2 = 0;
  for (let i = 0; i < m; i++) {
    const x = m === 1 ? 0 : i / (m - 1), y = ys[i];
    s0 += 1; s1 += x; s2 += x * x; s3 += x * x * x; s4 += x * x * x * x; t0 += y; t1 += x * y; t2 += x * x * y;
  }
  const A = [[s4, s3, s2, t2], [s3, s2, s1, t1], [s2, s1, s0, t0]];
  for (let c = 0; c < 3; c++) {
    let p = c;
    for (let r = c + 1; r < 3; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    if (Math.abs(A[c][c]) < 1e-12) return null;
    for (let r = 0; r < 3; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 4; k++) A[r][k] -= f * A[c][k];
    }
  }
  const a = A[0][3] / A[0][0], b = A[1][3] / A[1][1], c0 = A[2][3] / A[2][2];
  const my = t0 / m;
  let ssT = 0, ssR = 0;
  for (let i = 0; i < m; i++) {
    const x = m === 1 ? 0 : i / (m - 1), f = a * x * x + b * x + c0;
    ssT += (ys[i] - my) ** 2; ssR += (ys[i] - f) ** 2;
  }
  return { a, b, c: c0, r2: ssT === 0 ? 0 : 1 - ssR / ssT };
}

// ---------- swing pivots ----------
interface Pv { i: number; p: number; t: "H" | "L" }

function swings(s: Series, k: number, minPct: number): Pv[] {
  const { h, l } = s, n = h.length, raw: Pv[] = [];
  for (let i = k; i < n - k; i++) {
    let isH = true, isL = true;
    for (let j = i - k; j <= i + k; j++) {
      if (j === i) continue;
      if (h[j] > h[i]) isH = false;
      if (l[j] < l[i]) isL = false;
    }
    if (isH && isL) continue; // a flat stretch: no information
    if (isH) raw.push({ i, p: h[i], t: "H" });
    if (isL) raw.push({ i, p: l[i], t: "L" });
  }
  const z: Pv[] = [];
  for (const p of raw) {
    const last = z[z.length - 1];
    if (!last) { z.push(p); continue; }
    if (last.t === p.t) { if ((p.t === "H" && p.p > last.p) || (p.t === "L" && p.p < last.p)) z[z.length - 1] = p; continue; }
    if (Math.abs(p.p - last.p) / last.p < minPct) continue; // too small a swing to matter
    z.push(p);
  }
  return z;
}

// ---------- result helpers ----------
const RANK: Record<PatternState, number> = { confirmed: 3, forming: 2, none: 1, insufficient: 0 };
const best = (rs: PatternResult[]) => rs.slice().sort((a, b) => RANK[b.state] - RANK[a.state])[0];
const none = (family: string, detail = "Not formed", bias: PatternBias = "neutral"): PatternResult => ({ family, name: family, bias, state: "none", detail });

// ---------- double top / double bottom ----------
function doubles(s: Series, pv: Pv[], dir: 1 | -1): PatternResult[] {
  const family = dir > 0 ? "Double top" : "Double bottom", bias: PatternBias = dir > 0 ? "bearish" : "bullish";
  const E = dir > 0 ? "H" : "L", n = s.c.length, out: PatternResult[] = [];
  for (let a = pv.length - 3; a >= Math.max(0, pv.length - 7); a--) {
    const [p1, t, p2] = pv.slice(a, a + 3);
    if (p1.t !== E) continue;
    if (Math.abs(p1.p - p2.p) / Math.max(p1.p, p2.p) > 0.03) continue; // the two peaks should match
    if (p2.i - p1.i < 5) continue;
    const ext = dir > 0 ? Math.max(p1.p, p2.p) : Math.min(p1.p, p2.p);
    const depth = Math.abs(ext - t.p);
    if (depth / Math.max(ext, t.p) < 0.05) continue; // a real dip between the two
    const from = Math.max(0, p1.i - 30);
    const prior = dir > 0 ? p1.p / minOf(s.l.slice(from, p1.i + 1)) - 1 : 1 - p1.p / maxOf(s.h.slice(from, p1.i + 1));
    if (prior < 0.08) continue; // a double top needs an advance to top out; a double bottom needs a decline
    let broken = false, j = -1;
    for (let q = p2.i + 1; q < n; q++) {
      if (dir * (s.c[q] - ext) / ext > 0.01) { broken = true; break; } // pushed through the peaks: pattern failed
      if (dir * (t.p - s.c[q]) > 0) { j = q; break; }
    }
    if (broken) continue;
    const word = dir > 0 ? "tops" : "bottoms", through = dir > 0 ? "below" : "above";
    const base = { family, name: family, bias, from: p1.i, to: p2.i, level: t.p, target: t.p - dir * depth, stop: ext };
    if (j >= 0) {
      const age = n - 1 - j;
      if (age <= FRESH) out.push({ ...base, state: "confirmed", detail: `Two ${word} at ${inr(p1.p)} and ${inr(p2.p)}. Closed ${through} the ${inr(t.p)} middle ${dir > 0 ? "trough" : "peak"} ${ago(age)}. Measured target ${inr(base.target)}.` });
      else out.push({ ...none(family, `Broke ${through} the middle ${dir > 0 ? "trough" : "peak"} ${age} bars ago, older than ${FRESH} bars (stale)`, bias) });
    } else if (n - 1 - p2.i <= 25) {
      out.push({ ...base, state: "forming", detail: `Two ${word} at ${inr(p1.p)} and ${inr(p2.p)}. Not confirmed until a close ${through} ${inr(t.p)}. Target ${inr(base.target)}.` });
    }
  }
  return out;
}

// ---------- head and shoulders / inverse ----------
function headShoulders(s: Series, pv: Pv[], dir: 1 | -1): PatternResult[] {
  const family = "Head and shoulders", name = dir > 0 ? "Head and shoulders" : "Inverse head and shoulders";
  const bias: PatternBias = dir > 0 ? "bearish" : "bullish", E = dir > 0 ? "H" : "L", n = s.c.length, out: PatternResult[] = [];
  const beyond = (x: number, y: number) => (dir * (x - y)) / y;
  for (let a = pv.length - 5; a >= Math.max(0, pv.length - 9); a--) {
    const w = pv.slice(a, a + 5);
    if (w[0].t !== E) continue;
    const [ls, t1, hd, t2, rs] = w;
    if (beyond(hd.p, ls.p) < 0.03 || beyond(hd.p, rs.p) < 0.03) continue; // head clearly beyond both shoulders
    if (Math.abs(ls.p - rs.p) / Math.max(ls.p, rs.p) > 0.06) continue; // shoulders roughly level
    if (Math.abs(t1.p - t2.p) / Math.min(t1.p, t2.p) > 0.08) continue; // neckline not too steep
    const slope = (t2.p - t1.p) / (t2.i - t1.i), neck = (i: number) => t1.p + slope * (i - t1.i);
    const H = Math.abs(hd.p - neck(hd.i));
    if (H / hd.p < 0.05) continue;
    const from = Math.max(0, ls.i - 30);
    const prior = dir > 0 ? ls.p / minOf(s.l.slice(from, ls.i + 1)) - 1 : 1 - ls.p / maxOf(s.h.slice(from, ls.i + 1));
    if (prior < 0.08) continue;
    let failed = false, j = -1;
    for (let q = rs.i + 1; q < n; q++) {
      if (beyond(s.c[q], hd.p) > 0) { failed = true; break; } // closed beyond the head
      if (dir * (neck(q) - s.c[q]) > 0) { j = q; break; }
    }
    if (failed) continue;
    const through = dir > 0 ? "below" : "above";
    const base = { family, name, bias, from: ls.i, to: rs.i, stop: rs.p };
    if (j >= 0) {
      const age = n - 1 - j, lv = neck(j), target = lv - dir * H;
      if (age <= FRESH) out.push({ ...base, state: "confirmed", level: lv, target, detail: `${name}: shoulders ${inr(ls.p)} / ${inr(rs.p)}, head ${inr(hd.p)}. Closed ${through} the ${inr(lv)} neckline ${ago(age)}. Measured target ${inr(target)}.` });
      else out.push(none(family, `${name} broke its neckline ${age} bars ago, older than ${FRESH} bars (stale)`, bias));
    } else if (n - 1 - rs.i <= 25) {
      const lv = neck(n - 1), target = lv - dir * H;
      out.push({ ...base, state: "forming", level: lv, target, detail: `${name}: shoulders ${inr(ls.p)} / ${inr(rs.p)}, head ${inr(hd.p)}. Neckline now ${inr(lv)}; not confirmed until a close ${through} it. Target ${inr(target)}.` });
    }
  }
  return out;
}

// A parabola also fits a V quite well, so R² alone cannot tell a bowl from a V. A real U spends well over
// half its time in the lower 40% of its depth (a parabola ~63%, a straight-sided V exactly 40%).
function timeNearBottom(closes: number[]) {
  const lo = minOf(closes), hi = maxOf(closes), band = lo + 0.4 * (hi - lo);
  return closes.filter((v) => v <= band).length / closes.length;
}

// ---------- rounding bottom ----------
function roundingBottom(s: Series): PatternResult {
  const family = "Rounding bottom", n = s.c.length, out: PatternResult[] = [];
  for (const W of [...new Set([30, 40, 50, 60, Math.min(n, 90)])]) {
    if (W > n || W < 30) continue;
    const off = n - W, seg = s.c.slice(off), fit = quadFit(seg);
    if (!fit || fit.a <= 0) continue;
    const xv = -fit.b / (2 * fit.a);
    if (xv < 0.3 || xv > 0.7 || fit.r2 < 0.7) continue; // a bowl, with its low near the middle
    const rim = maxOf(seg.slice(0, 5)), bottom = minOf(seg);
    if (off > 0 && maxOf(s.c.slice(Math.max(0, off - 10), off)) > rim * 1.02) continue; // the window starts mid-slope, not at a rim
    const depth = (rim - bottom) / rim;
    if (depth < 0.08 || timeNearBottom(seg) < 0.5) continue;
    const iv = off + Math.round(xv * (W - 1));
    let j = -1;
    for (let q = iv; q < n; q++) if (s.c[q] >= rim * 0.99) { j = q; break; }
    const lowest = minOf(s.l.slice(off)), base = { family, name: family, bias: "bullish" as PatternBias, from: off, to: n - 1, level: rim, target: rim + (rim - bottom), stop: lowest };
    const note = `Bowl over ${W} bars: rim ${inr(rim)}, low ${inr(bottom)} (${(depth * 100).toFixed(0)}% deep), fit R² ${fit.r2.toFixed(2)}.`;
    if (j >= 0) {
      const age = n - 1 - j;
      if (age <= FRESH && s.c[n - 1] >= rim * 0.98) out.push({ ...base, state: "confirmed", detail: `${note} Back at the left rim ${ago(age)}. Target ${inr(base.target)}.` });
      else out.push(none(family, `${note} Cleared the rim ${age} bars ago (stale)`, "bullish"));
    } else if (s.c[n - 1] >= rim * 0.9 && s.c[n - 1] > s.c[Math.max(0, n - 4)]) {
      out.push({ ...base, state: "forming", detail: `${note} Climbing the right side; a close above ${inr(rim)} completes it.` });
    }
  }
  return out.length ? best(out) : none(family, "No rounded base", "bullish");
}

// ---------- cup and handle ----------
function cupHandle(s: Series): PatternResult {
  const family = "Cup and handle", n = s.c.length, out: PatternResult[] = [];
  const isHigh = (i: number, k: number) => { for (let j = Math.max(0, i - k); j <= Math.min(n - 1, i + k); j++) if (s.h[j] > s.h[i]) return false; return true; };
  for (let iL = Math.max(0, n - 100); iL <= n - 18; iL++) {
    if (!isHigh(iL, 3)) continue;
    const rimL = s.h[iL];
    for (let iR = iL + 18; iR < n; iR++) {
      if (!isHigh(iR, 2)) continue;
      const rimR = s.h[iR];
      if (rimR < rimL * 0.88 || rimR > rimL * 1.03) continue;
      let iB = iL + 1;
      for (let q = iL + 1; q < iR; q++) if (s.l[q] < s.l[iB]) iB = q;
      if (iB - iL < 5 || iR - iB < 5) continue;
      const depth = (rimL - s.l[iB]) / rimL;
      if (depth < 0.12 || depth > 0.35) continue;
      const fit = quadFit(s.c.slice(iL, iR + 1));
      if (!fit || fit.a <= 0 || fit.r2 < 0.6) continue; // a U, not a V
      const xv = -fit.b / (2 * fit.a);
      if (xv < 0.25 || xv > 0.75) continue;
      if (maxOf(s.c.slice(iL, iR + 1)) > rimL * 1.03) continue;
      if (timeNearBottom(s.c.slice(iL, iR + 1)) < 0.5) continue; // a V, not a U
      const hb = n - 1 - iR, cup = `Cup ${inr(rimL)} down to ${inr(s.l[iB])} (${(depth * 100).toFixed(0)}% deep) back to ${inr(rimR)} over ${iR - iL} bars.`;
      const base = { family, name: family, bias: "bullish" as PatternBias, from: iL, to: n - 1, level: rimR, target: rimR + (rimL - s.l[iB]) };
      if (hb < 3) {
        if (s.c[n - 1] >= rimR * 0.9 && s.c[n - 1] <= rimR * 1.02) out.push({ ...base, state: "forming", stop: s.l[iB], detail: `${cup} The handle has not formed yet; watch for a 3-15% pullback that holds the upper half of the cup.` });
        continue;
      }
      if (hb > 25) continue;
      const hLow = minOf(s.l.slice(iR + 1)), hDepth = (rimR - hLow) / rimR;
      if (hDepth < 0.02 || hDepth > 0.15 || hDepth > 0.5 * depth) continue;
      if (hLow < s.l[iB] + 0.5 * (rimL - s.l[iB])) continue; // handle must hold the upper half of the cup
      let j = -1;
      for (let q = iR + 1; q < n; q++) if (s.c[q] > rimR) { j = q; break; }
      if (j >= 0) {
        const age = n - 1 - j;
        if (age <= FRESH) out.push({ ...base, state: "confirmed", stop: hLow, detail: `${cup} ${hb}-bar handle ${(hDepth * 100).toFixed(1)}% deep. Closed above ${inr(rimR)} ${ago(age)}. Target ${inr(base.target)}.` });
        else out.push(none(family, `${cup} Broke out ${age} bars ago (stale)`, "bullish"));
      } else if (s.c[n - 1] >= hLow) {
        out.push({ ...base, state: "forming", stop: hLow, detail: `${cup} ${hb}-bar handle ${(hDepth * 100).toFixed(1)}% deep. A close above ${inr(rimR)} triggers it. Target ${inr(base.target)}.` });
      }
    }
  }
  return out.length ? best(out) : none(family, "No cup with a handle", "bullish");
}

// ---------- wedges and triangles: two trendlines through the swing pivots ----------
interface Cand { hi: Line; lo: Line; i0: number; i1: number; w0: number; w1: number; nsH: number; nsL: number; hp: Pv[]; lp: Pv[] }

function candidates(s: Series, pv: Pv[]): Cand[] {
  const n = s.c.length, out: Cand[] = [];
  for (let e = 0; e <= 2; e++) {
    const base = pv.slice(0, pv.length - e);
    for (const take of [8, 7, 6, 5]) {
      const w = base.slice(-take);
      if (w.length < take) continue;
      const hp = w.filter((p) => p.t === "H"), lp = w.filter((p) => p.t === "L");
      if (hp.length < 2 || lp.length < 2 || hp.length + lp.length < 5) continue;
      const hi = mkLine(hp.map((p) => p.i), hp.map((p) => p.p)), lo = mkLine(lp.map((p) => p.i), lp.map((p) => p.p));
      const mean = avg(w.map((p) => p.p));
      if (hp.some((p) => Math.abs(p.p - hi.at(p.i)) / mean > 0.01) || lp.some((p) => Math.abs(p.p - lo.at(p.i)) / mean > 0.01)) continue; // pivots must sit on the lines
      const i0 = w[0].i, i1 = w[w.length - 1].i;
      if (i1 - i0 < 12 || n - 1 - i1 > 20) continue;
      const w0 = hi.at(i0) - lo.at(i0), w1 = hi.at(i1) - lo.at(i1);
      if (!(w0 > 0) || w0 / mean < 0.05 || w1 < 0.05 * w0 || w1 > 0.75 * w0) continue; // a real range (5%+ wide) that is narrowing
      let outside = 0; // price has to stay inside its own lines, otherwise the lines describe nothing
      for (let q = i0; q <= i1; q++) if (s.c[q] > hi.at(q) * 1.007 || s.c[q] < lo.at(q) * 0.993) outside++;
      if (outside > 0) continue;
      out.push({ hi, lo, i0, i1, w0, w1, nsH: (hi.slope / mean) * 100, nsL: (lo.slope / mean) * 100, hp, lp });
    }
  }
  return out;
}

function lineShape(s: Series, pv: Pv[], family: string, name: string, bias: PatternBias, accept: (c: Cand) => boolean, brk: "up" | "down" | "either", shape: string): PatternResult {
  const n = s.c.length, out: PatternResult[] = [];
  for (const c of candidates(s, pv)) {
    if (!accept(c)) continue;
    if (c.hi.at(n - 1) <= c.lo.at(n - 1)) continue; // the lines have already crossed: past the apex, the pattern is over
    let up = -1, dn = -1;
    for (let q = c.i1 + 1; q < n; q++) {
      if (up < 0 && s.c[q] > c.hi.at(q) * 1.005) up = q; // a close must clear the line by 0.5%, so a touch is not a breakout
      if (dn < 0 && s.c[q] < c.lo.at(q) * 0.995) dn = q;
    }
    const first = up >= 0 && (dn < 0 || up < dn) ? "up" : dn >= 0 ? "down" : "";
    const base = { family, name, bias, from: c.i0, to: n - 1 };
    if (first) {
      if (brk !== "either" && first !== brk) continue; // broke the wrong way: the pattern failed
      const j = first === "up" ? up : dn, age = n - 1 - j, lv = first === "up" ? c.hi.at(j) : c.lo.at(j);
      const target = first === "up" ? lv + c.w0 : lv - c.w0, stop = first === "up" ? c.lo.at(n - 1) : c.hi.at(n - 1);
      const b: PatternBias = brk === "either" ? (first === "up" ? "bullish" : "bearish") : bias;
      if (age <= FRESH) out.push({ ...base, bias: b, state: "confirmed", level: lv, target, stop, detail: `${shape} (${c.hp.length} highs, ${c.lp.length} lows). Closed ${first === "up" ? "above" : "below"} the ${inr(lv)} line ${ago(age)}. Measured target ${inr(target)}.` });
      else out.push(none(family, `${shape} broke ${first === "up" ? "up" : "down"} ${age} bars ago, older than ${FRESH} bars (stale)`, bias));
      continue;
    }
    if (n - 1 - c.i1 > 12) continue;
    const u = c.hi.at(n - 1), lo = c.lo.at(n - 1), px = s.c[n - 1];
    if (px > u * 1.01 || px < lo * 0.99) continue;
    const lv = brk === "down" ? lo : u, target = brk === "down" ? lo - c.w0 : u + c.w0;
    const watch = brk === "either" ? `a close above ${inr(u)} or below ${inr(lo)}` : brk === "up" ? `a close above ${inr(u)}` : `a close below ${inr(lo)}`;
    out.push({ ...base, state: "forming", level: lv, target: brk === "either" ? undefined : target, stop: brk === "down" ? u : lo, detail: `${shape} (${c.hp.length} highs, ${c.lp.length} lows), squeezing from ₹${c.w0.toFixed(0)} wide to ₹${c.w1.toFixed(0)}. Waiting for ${watch}.` });
  }
  return out.length ? best(out) : none(family);
}

// ---------- flags and pennants ----------
function flagsFor(s: Series, dir: 1 | -1): PatternResult[] {
  const family = "Pennant or flags", n = s.c.length, out: PatternResult[] = [];
  for (let m = 0; m <= 3; m++) {
    const e = n - 1 - m;
    for (let ip = e - 5; ip >= Math.max(3, e - 20); ip--) {
      const cons = (f: number[]) => f.slice(ip + 1, e + 1);
      const top = maxOf(cons(s.h)), bot = minOf(cons(s.l));
      let i0 = -1, pole: number, height: number;
      const from = Math.max(0, ip - 20);
      if (dir > 0) {
        if (top > s.h[ip] * 1.005) continue;
        i0 = from; for (let q = from; q <= ip - 3; q++) if (s.l[q] < s.l[i0]) i0 = q;
        pole = s.h[ip] / s.l[i0] - 1; height = s.h[ip] - s.l[i0];
        if (maxOf(s.h.slice(i0, ip + 1)) > s.h[ip] * 1.005) continue; // the pole must end at its own high, not mid-way
        if (ip - i0 < 3 || pole < 0.12 || bot <= s.l[i0] || (s.h[ip] - bot) / height > 0.5) continue;
      } else {
        if (bot < s.l[ip] * 0.995) continue;
        i0 = from; for (let q = from; q <= ip - 3; q++) if (s.h[q] > s.h[i0]) i0 = q;
        pole = 1 - s.l[ip] / s.h[i0]; height = s.h[i0] - s.l[ip];
        if (minOf(s.l.slice(i0, ip + 1)) < s.l[ip] * 0.995) continue;
        if (ip - i0 < 3 || pole < 0.12 || top >= s.h[i0] || (top - s.l[ip]) / height > 0.5) continue;
      }
      // trendlines through the pause's own swing highs and lows (every bar would blur a tightening range)
      const hx: number[] = [], lx: number[] = [];
      for (let q = ip + 2; q < e; q++) {
        if (s.h[q] >= s.h[q - 1] && s.h[q] >= s.h[q + 1]) hx.push(q);
        if (s.l[q] <= s.l[q - 1] && s.l[q] <= s.l[q + 1]) lx.push(q);
      }
      const all = Array.from({ length: e - ip }, (_, k) => ip + 1 + k);
      const hi = hx.length >= 2 ? mkLine(hx, hx.map((q) => s.h[q])) : mkLine(all, cons(s.h));
      const lo = lx.length >= 2 ? mkLine(lx, lx.map((q) => s.l[q])) : mkLine(all, cons(s.l));
      const w0 = hi.at(ip + 1) - lo.at(ip + 1), w1 = hi.at(e) - lo.at(e);
      if (!(w0 > 0) || !(w1 > 0)) continue;
      const mean = avg(cons(s.c)), nsH = (hi.slope / mean) * 100, nsL = (lo.slope / mean) * 100, converge = w1 < 0.7 * w0;
      let kind = "";
      if (dir > 0) kind = nsH <= 0.03 && nsL <= 0.03 && !converge ? "flag" : nsH <= 0.03 && nsL >= -0.03 && converge ? "pennant" : "";
      else kind = nsH >= -0.03 && nsL >= -0.03 && !converge ? "flag" : nsL >= -0.03 && nsH <= 0.03 && converge ? "pennant" : "";
      if (!kind) continue;
      let j = -1, failed = false;
      for (let q = e + 1; q < n; q++) {
        if (dir > 0 ? s.c[q] < bot : s.c[q] > top) { failed = true; break; }
        if (dir > 0 ? s.c[q] > top : s.c[q] < bot) { j = q; break; }
      }
      if (failed) continue;
      const bias: PatternBias = dir > 0 ? "bullish" : "bearish", nm = `${dir > 0 ? "Bull" : "Bear"} ${kind}`;
      const lv = dir > 0 ? top : bot, target = lv + dir * height, stop = dir > 0 ? bot : top;
      const base = { family, name: nm, bias, from: i0, to: n - 1, level: lv, target, stop };
      const desc = `${nm}: ${(pole * 100).toFixed(0)}% pole in ${ip - i0} bars, then ${e - ip} bars of ${kind === "flag" ? "channel" : "tightening"} range ${inr(bot)} to ${inr(top)}.`;
      if (j >= 0) {
        const age = n - 1 - j;
        if (age <= FRESH) out.push({ ...base, state: "confirmed", detail: `${desc} Closed ${dir > 0 ? "above" : "below"} ${inr(lv)} ${ago(age)}. Measured target ${inr(target)}.` });
        else out.push(none(family, `${nm} broke ${age} bars ago, older than ${FRESH} bars (stale)`, bias));
      } else if (m === 0) {
        out.push({ ...base, state: "forming", detail: `${desc} A close ${dir > 0 ? "above" : "below"} ${inr(lv)} triggers it. Measured target ${inr(target)}.` });
      }
    }
  }
  return out;
}

// ---------- the scan ----------
export const MIN_BARS: Record<string, number> = {
  "Head and shoulders": 30, "Double top": 25, "Double bottom": 25, "Rounding bottom": 30, "Cup and handle": 40,
  "Wedges": 20, "Pennant or flags": 20, "Ascending triangle": 20, "Descending triangle": 20, "Symmetrical triangle": 20,
};

export function scanPatterns(s: Series): PatternResult[] {
  const n = s.c?.length ?? 0;
  const ok = n > 0 && s.h?.length === n && s.l?.length === n && [...s.h, ...s.l, ...s.c].every((v) => isFinite(v) && v > 0);
  const lack = (family: string): PatternResult => ({ family, name: family, bias: "neutral", state: "insufficient", detail: ok ? `Needs ${MIN_BARS[family]} bars, has ${n}` : "No usable price history" });
  if (!ok) return FAMILIES.map(lack);
  const big = swings(s, 2, 0.03), fine = swings(s, 2, 0.02);
  const last = s.c[n - 1];
  const gate = (family: string, f: () => PatternResult) => (n < MIN_BARS[family] ? lack(family) : f());
  const pick = (family: string, rs: PatternResult[], empty: string, bias: PatternBias = "neutral") => (rs.length ? best(rs) : none(family, empty, bias));
  const results: PatternResult[] = [
    gate("Head and shoulders", () => pick("Head and shoulders", [...headShoulders(s, big, 1), ...headShoulders(s, big, -1)], "No head and shoulders or inverse")),
    gate("Double top", () => pick("Double top", doubles(s, big, 1), "No two matching tops", "bearish")),
    gate("Double bottom", () => pick("Double bottom", doubles(s, big, -1), "No two matching bottoms", "bullish")),
    gate("Rounding bottom", () => roundingBottom(s)),
    gate("Cup and handle", () => cupHandle(s)),
    gate("Wedges", () => best([
      lineShape(s, fine, "Wedges", "Rising wedge", "bearish", (c) => c.nsH > 0.08 && c.nsL > 0.08 && c.nsL > c.nsH, "down", "Rising wedge"),
      lineShape(s, fine, "Wedges", "Falling wedge", "bullish", (c) => c.nsH < -0.08 && c.nsL < -0.08 && c.nsH < c.nsL, "up", "Falling wedge"),
    ])),
    gate("Pennant or flags", () => pick("Pennant or flags", [...flagsFor(s, 1), ...flagsFor(s, -1)], "No pole followed by a tight pause")),
    gate("Ascending triangle", () => lineShape(s, fine, "Ascending triangle", "Ascending triangle", "bullish", (c) => Math.abs(c.nsH) <= 0.04 && c.nsL >= 0.08 && (maxOf(c.hp.map((p) => p.p)) - minOf(c.hp.map((p) => p.p))) / maxOf(c.hp.map((p) => p.p)) <= 0.02, "up", "Ascending triangle")),
    gate("Descending triangle", () => lineShape(s, fine, "Descending triangle", "Descending triangle", "bearish", (c) => Math.abs(c.nsL) <= 0.04 && c.nsH <= -0.08 && (maxOf(c.lp.map((p) => p.p)) - minOf(c.lp.map((p) => p.p))) / maxOf(c.lp.map((p) => p.p)) <= 0.02, "down", "Descending triangle")),
    gate("Symmetrical triangle", () => lineShape(s, fine, "Symmetrical triangle", "Symmetrical triangle", "neutral", (c) => c.nsH <= -0.05 && c.nsL >= 0.05 && Math.abs(c.nsH) / c.nsL >= 0.4 && Math.abs(c.nsH) / c.nsL <= 2.5, "either", "Symmetrical triangle")),
  ];
  // a confirmed pattern whose measured move has already been delivered is a finished move, not a fresh entry
  return results.map((r) => {
    if (r.state !== "confirmed" || r.target == null || r.bias === "neutral") return r;
    const done = r.bias === "bullish" ? last >= r.target : last <= r.target;
    return done ? { ...r, detail: `${r.detail} Price ${inr(last)} is already past that target, so this is an extended move, not a fresh entry.` } : r;
  });
}

// The picks and dashboard trades keep older bars as closes only (`pre`) and the recent window as full OHLC.
// For the older bars the close stands in for the high and low, which is why a pivot there can be a touch off.
export function seriesFromTrade(t: { pre?: number[]; closes: number[]; h: number[]; l: number[] }): Series {
  const pre = Array.isArray(t.pre) ? t.pre : [];
  return { c: [...pre, ...t.closes], h: [...pre, ...t.h], l: [...pre, ...t.l] };
}

export function summarizePatterns(rs: PatternResult[]) {
  return {
    confirmed: rs.filter((r) => r.state === "confirmed"),
    forming: rs.filter((r) => r.state === "forming"),
    none: rs.filter((r) => r.state === "none"),
    insufficient: rs.filter((r) => r.state === "insufficient"),
  };
}
