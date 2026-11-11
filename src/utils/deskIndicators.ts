// Pure analysis shared by the Trade Desk, the desk tools panel and the dashboard chart.
// A "series" t is { closes, vols, o?, h?, l?, pre?, ma?, close, hi52, lo52 }; nothing here touches the DOM or the network.

export const fmt = (n: any, d = 0) => Number(n).toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
export const median = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
export const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / (a.length || 1);


// Pocket pivot: an up day whose volume beats the biggest down-day volume of the prior 10 sessions,
// closing above its 10-day average.
export function pocketPivots(t: any) {
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
export function vcpScan(t: any) {
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

// EMA and Wilder RSI over t.pre (earlier closes, for warm-up) followed by t.closes; returns arrays aligned to t.closes.
// EMA is seeded with the simple average of its first n closes, RSI with the average of its first n changes, as most charting packages do.
const joined = (t: any): number[] => [...(Array.isArray(t.pre) ? t.pre : []), ...t.closes];
export function emaSeries(t: any, n = 20): (number | null)[] {
  const c = joined(t), k = 2 / (n + 1), out = new Array<number | null>(c.length).fill(null);
  if (c.length < n) return out.slice(c.length - t.closes.length);
  let e = avg(c.slice(0, n)); out[n - 1] = e;
  for (let i = n; i < c.length; i++) { e = c[i] * k + e * (1 - k); out[i] = e; }
  return out.slice(c.length - t.closes.length);
}
export function rsiSeries(t: any, n = 14): (number | null)[] {
  const c = joined(t), out = new Array<number | null>(c.length).fill(null);
  if (c.length <= n) return out.slice(c.length - t.closes.length);
  let g = 0, l = 0;
  for (let i = 1; i <= n; i++) { const d = c[i] - c[i - 1]; if (d >= 0) g += d; else l -= d; }
  g /= n; l /= n;
  const val = () => (l === 0 ? 100 : 100 - 100 / (1 + g / l));
  out[n] = val();
  for (let i = n + 1; i < c.length; i++) {
    const d = c[i] - c[i - 1];
    g = (g * (n - 1) + Math.max(d, 0)) / n; l = (l * (n - 1) + Math.max(-d, 0)) / n;
    out[i] = val();
  }
  return out.slice(c.length - t.closes.length);
}

export function stageInfo(t: any) {
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

export function patternAlerts(t: any, L: any) {
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
  const rs = rsiSeries(t), ema = emaSeries(t), r = rs[rs.length - 1], e = ema[ema.length - 1];
  if (r != null) {
    if (r >= 70) a.push(["warn", `RSI(14) is ${r.toFixed(0)}: overbought territory, strong stocks can stay there but a new entry is chasing`]);
    else if (r <= 30) a.push(["warn", `RSI(14) is ${r.toFixed(0)}: oversold, the trend may be broken`]);
    else a.push(["info", `RSI(14) is ${r.toFixed(0)}`]);
  }
  if (e != null) a.push([t.close > e ? "ok" : "warn", `Close is ${Math.abs((t.close / e - 1) * 100).toFixed(1)}% ${t.close > e ? "above" : "below"} the 20 EMA at ₹${fmt(e, 2)}`]);
  const gain2 = (c[c.length - 1] / c[c.length - 3] - 1) * 100;
  if (gain2 > 8) a.push(["warn", `Up ${gain2.toFixed(0)}% in two sessions, gap risk at the open`]);
  return a;
}



// Candlestick patterns from open, high, low, close. Thresholds are the common textbook ones; a pattern is a prompt to look
// at the chart, not a trade signal by itself. Hammer vs hanging man (and inverted hammer vs shooting star) depend on the
// prior 5-session direction.
export function candlePatterns(t: any) {
  const { o, h, l, closes: c } = t, out = [];
  if (!o || !h || !l) return out;
  const n = c.length;
  const body = (i) => Math.abs(c[i] - o[i]), rng = (i) => h[i] - l[i];
  const green = (i) => c[i] > o[i], red = (i) => c[i] < o[i];
  const add = (i, name, bias, note) => out.push({ i, name, bias, note });
  for (let i = 5; i < n; i++) {
    const r = rng(i); if (!(r > 0)) continue;
    const b = body(i), lo = Math.min(o[i], c[i]) - l[i], up = h[i] - Math.max(o[i], c[i]);
    const down = c[i - 1] < c[i - 5], upTrend = c[i - 1] > c[i - 5];
    if (b >= 0.9 * r) add(i, green(i) ? "Bullish marubozu" : "Bearish marubozu", green(i) ? "bull" : "bear", "Almost no wicks: one side controlled the whole session.");
    else if (b <= 0.1 * r) add(i, "Doji", "neutral", "Open and close nearly equal: indecision.");
    else if (b <= 0.35 * r && lo >= 2 * b && up <= 0.15 * r) {
      if (down) add(i, "Hammer", "bull", "Long lower wick after a decline: sellers were rejected.");
      else if (upTrend) add(i, "Hanging man", "bear", "Hammer shape after a rise: a warning, needs a weak next day to count.");
    } else if (b <= 0.35 * r && up >= 2 * b && lo <= 0.15 * r) {
      if (upTrend) add(i, "Shooting star", "bear", "Long upper wick after a rise: buyers were rejected.");
      else if (down) add(i, "Inverted hammer", "bull", "Upper wick after a decline: needs a strong next day to count.");
    }
    const pb = body(i - 1);
    if (red(i - 1) && green(i) && c[i] >= o[i - 1] && o[i] <= c[i - 1] && b > pb) add(i, "Bullish engulfing", "bull", "Green body covers the prior red body.");
    if (green(i - 1) && red(i) && o[i] >= c[i - 1] && c[i] <= o[i - 1] && b > pb) add(i, "Bearish engulfing", "bear", "Red body covers the prior green body.");
    if (red(i - 1) && green(i) && o[i] <= c[i - 1] && c[i] > (o[i - 1] + c[i - 1]) / 2 && c[i] < o[i - 1]) add(i, "Piercing line", "bull", "Closes above the middle of the prior red body.");
    if (green(i - 1) && red(i) && o[i] >= c[i - 1] && c[i] < (o[i - 1] + c[i - 1]) / 2 && c[i] > o[i - 1]) add(i, "Dark cloud cover", "bear", "Closes below the middle of the prior green body.");
    if (h[i] < h[i - 1] && l[i] > l[i - 1]) add(i, "Inside bar", "neutral", "Range held inside the prior day: a pause before the next move.");
    if (i >= 2) {
      const b2 = body(i - 2), r2 = rng(i - 2) || 1, r1 = rng(i - 1) || 1;
      if (red(i - 2) && b2 >= 0.5 * r2 && body(i - 1) <= 0.3 * r1 && green(i) && c[i] > (o[i - 2] + c[i - 2]) / 2) add(i, "Morning star", "bull", "Big red, small body, then a green that retakes the middle.");
      if (green(i - 2) && b2 >= 0.5 * r2 && body(i - 1) <= 0.3 * r1 && red(i) && c[i] < (o[i - 2] + c[i - 2]) / 2) add(i, "Evening star", "bear", "Big green, small body, then a red that gives back the middle.");
      if ([i, i - 1, i - 2].every((k) => body(k) >= 0.5 * (rng(k) || 1)) && green(i) && green(i - 1) && green(i - 2) && c[i] > c[i - 1] && c[i - 1] > c[i - 2] && o[i] > o[i - 1] && o[i - 1] > o[i - 2] && o[i] < c[i - 1] && o[i - 1] < c[i - 2]) add(i, "Three white soldiers", "bull", "Three rising green candles with real bodies, each opening inside the last body.");
      if ([i, i - 1, i - 2].every((k) => body(k) >= 0.5 * (rng(k) || 1)) && red(i) && red(i - 1) && red(i - 2) && c[i] < c[i - 1] && c[i - 1] < c[i - 2] && o[i] < o[i - 1] && o[i - 1] < o[i - 2] && o[i] > c[i - 1] && o[i - 1] > c[i - 2]) add(i, "Three black crows", "bear", "Three falling red candles with real bodies, each opening inside the last body.");
    }
  }
  return out;
}

