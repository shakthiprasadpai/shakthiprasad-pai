import assert from "node:assert/strict";
import { scanPatterns, FAMILIES, type PatternResult, type Series } from "../src/core/desk/chartPatterns";

// ---- synthetic chart builders ----
const wob = (i: number) => Math.sin(i * 1.7) * 0.0006; // tiny deterministic noise so bars are not perfectly clean
function fromCloses(c: number[], band = 0.004): Series {
  return { c, h: c.map((v, i) => v * (1 + band + Math.abs(wob(i)))), l: c.map((v, i) => v * (1 - band - Math.abs(wob(i + 1)))) };
}
// straight lines through (index, price) control points
function through(pts: [number, number][]): number[] {
  const out: number[] = [];
  for (let k = 0; k < pts.length - 1; k++) {
    const [i0, p0] = pts[k], [i1, p1] = pts[k + 1];
    for (let i = i0; i < i1; i++) out.push(p0 + ((p1 - p0) * (i - i0)) / (i1 - i0));
  }
  out.push(pts[pts.length - 1][1]);
  return out;
}
// closes zig-zagging between two lines: a triangle-wave of the given period
function between(n: number, upper: (i: number) => number, lower: (i: number) => number, period = 8, phase = 0): number[] {
  return Array.from({ length: n }, (_, i) => {
    const ph = (((i + phase) % period) + period) % period / period, tri = ph < 0.5 ? ph * 2 : (1 - ph) * 2;
    return lower(i) + (upper(i) - lower(i)) * (1 - tri); // starts at the upper line
  });
}
const get = (rs: PatternResult[], family: string) => rs.find((r) => r.family === family)!;
const show = (rs: PatternResult[]) => rs.map((r) => `${r.family}:${r.state}`).join(" | ");
const expect = (s: Series, family: string, state: string, name?: string) => {
  const rs = scanPatterns(s), r = get(rs, family);
  assert.equal(r.state, state, `${family} expected ${state}, got ${r.state} (${r.detail})\n  all: ${show(rs)}`);
  if (name) assert.equal(r.name, name);
  return r;
};

// ---- structure ----
{
  const rs = scanPatterns(fromCloses(through([[0, 100], [60, 160]])));
  assert.deepEqual(rs.map((r) => r.family), [...FAMILIES]);
  assert.equal(rs.length, 10);
}
// too few bars
for (const r of scanPatterns(fromCloses(through([[0, 100], [12, 110]])))) assert.equal(r.state, "insufficient");
// junk input
for (const r of scanPatterns({ c: [1, NaN, 3], h: [1, 2, 3], l: [1, 2, 3] })) assert.equal(r.state, "insufficient");
for (const r of scanPatterns({ c: [], h: [], l: [] })) assert.equal(r.state, "insufficient");

// ---- a clean trend is not a pattern ----
{
  const rs = scanPatterns(fromCloses(through([[0, 100], [70, 170]])));
  for (const r of rs) assert.ok(r.state === "none", `straight trend should show nothing, got ${r.family}:${r.state}`);
  const down = scanPatterns(fromCloses(through([[0, 170], [70, 100]])));
  for (const r of down) assert.ok(r.state === "none", `straight downtrend should show nothing, got ${r.family}:${r.state}`);
}

// ---- double top ----
const dtPts: [number, number][] = [[0, 100], [15, 130], [25, 115], [35, 129], [41, 114], [43, 110]];
{
  const r = expect(fromCloses(through(dtPts)), "Double top", "confirmed");
  assert.equal(r.bias, "bearish"); assert.ok(Math.abs(r.level! - 115) < 3); assert.ok(r.target! < r.level!);
  expect(fromCloses(through(dtPts.slice(0, 4).concat([[38, 125]]))), "Double top", "forming");
  // pushing through the peaks cancels it
  expect(fromCloses(through([[0, 100], [15, 130], [25, 115], [35, 129], [42, 140]])), "Double top", "none");
  // only a few percent dip is not a double top
  expect(fromCloses(through([[0, 100], [15, 130], [25, 127], [35, 129], [41, 126], [43, 124]])), "Double top", "none");
}
// ---- double bottom ----
const dbPts: [number, number][] = [[0, 130], [15, 100], [25, 115], [35, 101], [41, 116], [43, 120]];
{
  const r = expect(fromCloses(through(dbPts)), "Double bottom", "confirmed");
  assert.equal(r.bias, "bullish"); assert.ok(r.target! > r.level!);
  expect(fromCloses(through(dbPts.slice(0, 4).concat([[38, 105]]))), "Double bottom", "forming");
}

// ---- head and shoulders / inverse ----
const hsPts: [number, number][] = [[0, 100], [10, 120], [16, 110], [24, 135], [32, 111], [38, 121], [42, 108], [43, 106]];
{
  const r = expect(fromCloses(through(hsPts)), "Head and shoulders", "confirmed", "Head and shoulders");
  assert.equal(r.bias, "bearish"); assert.ok(r.target! < r.level!);
  expect(fromCloses(through(hsPts.slice(0, 6).concat([[41, 118]]))), "Head and shoulders", "forming", "Head and shoulders");
  const inv = hsPts.map(([i, p]) => [i, 240 - p] as [number, number]); // mirror the prices
  const ri = expect(fromCloses(through(inv)), "Head and shoulders", "confirmed", "Inverse head and shoulders");
  assert.equal(ri.bias, "bullish"); assert.ok(ri.target! > ri.level!);
}

// ---- rounding bottom ----
const bowl = (n: number) => Array.from({ length: n }, (_, i) => { const x = i / 59; return 90 + 120 * (x - 0.5) ** 2 + Math.sin(i * 1.3) * 0.4; });
{
  expect(fromCloses(bowl(57), 0.003), "Rounding bottom", "forming");
  expect(fromCloses(bowl(62), 0.003), "Rounding bottom", "confirmed");
  // an inverted bowl (rounded top) is not a rounding bottom
  expect(fromCloses(bowl(60).map((v) => 210 - v), 0.003), "Rounding bottom", "none");
}

// ---- cup and handle ----
function cupSeries(tail: [number, number][]) {
  const lead = through([[0, 90], [19, 120]]); // prior advance into the left rim
  const cup = Array.from({ length: 41 }, (_, i) => 90 + 30 * ((i - 20) / 20) ** 2); // 120 -> 90 -> 120
  return fromCloses([...lead, ...cup, ...through(tail).slice(1)], 0.003);
}
{
  const handle: [number, number][] = [[0, 120], [6, 113], [10, 114], [12, 117]]; // 7% pullback that holds the upper half
  const r = expect(cupSeries(handle), "Cup and handle", "forming");
  assert.equal(r.bias, "bullish");
  expect(cupSeries([...handle, [14, 123], [16, 126]]), "Cup and handle", "confirmed");
  // a handle that gives back most of the cup is not a handle
  expect(cupSeries([[0, 120], [8, 100], [12, 102]]), "Cup and handle", "none");
  // a V-shaped dip is not a cup
  const v = fromCloses([...through([[0, 90], [19, 120]]), ...through([[0, 120], [20, 90], [40, 120]]).slice(1), ...through([[0, 120], [6, 113], [10, 114]]).slice(1)], 0.003);
  expect(v, "Cup and handle", "none");
}

// ---- wedges ----
{
  const up = (i: number) => 100 + 0.3 * i, lo = (i: number) => 90 + 0.6 * i; // both rising, lows rising faster
  const base = between(60, up, lo, 8);
  const rw = expect(fromCloses(base.slice(0, 29), 0.002), "Wedges", "forming", "Rising wedge");
  assert.equal(rw.bias, "bearish");
  const fu = (i: number) => 150 - 0.6 * i, fl = (i: number) => 140 - 0.3 * i; // both falling, highs falling faster
  const fw = expect(fromCloses(between(60, fu, fl, 8).slice(0, 29), 0.002), "Wedges", "forming", "Falling wedge");
  assert.equal(fw.bias, "bullish");
}
// ---- triangles ----
{
  const flat = (_: number) => 120, rise = (i: number) => 100 + 0.7 * i;
  const asc = expect(fromCloses(between(60, flat, rise, 8).slice(0, 29), 0.002), "Ascending triangle", "forming");
  assert.equal(asc.bias, "bullish");
  const floor = (_: number) => 100, fall = (i: number) => 125 - 0.7 * i;
  const desc = expect(fromCloses(between(60, fall, floor, 8, 4).slice(0, 29), 0.002), "Descending triangle", "forming");
  assert.equal(desc.bias, "bearish");
  const sU = (i: number) => 120 - 0.3 * i, sL = (i: number) => 100 + 0.3 * i;
  expect(fromCloses(between(60, sU, sL, 8).slice(0, 29), 0.002), "Symmetrical triangle", "forming");
}

// ---- flags and pennants ----
{
  const pole = through([[0, 100], [10, 130]]);
  const flag = between(13, (i) => 130 - 0.2 * i, (i) => 124 - 0.2 * i, 6).map((v, i) => v - 0.2 * i * 0.0); // channel drifting down
  const lead = through([[0, 98], [0, 98]]);
  const mk = (tail: number[]) => fromCloses([...Array(15).fill(0).map((_, i) => 100 + (i % 2)), ...pole, ...tail], 0.003);
  const f = expect(mk(flag.slice(1)), "Pennant or flags", "forming", "Bull flag");
  assert.equal(f.bias, "bullish");
  expect(mk([...flag.slice(1), 128, 133, 136]), "Pennant or flags", "confirmed", "Bull flag");
  // converging range = pennant
  const pen = between(14, (i) => 130 - 0.3 * i, (i) => 118 + 0.3 * i, 6);
  expect(mk(pen.slice(1)), "Pennant or flags", "forming", "Bull pennant");
  // a bear flag: fall of 25% then a drift up
  const drop = through([[0, 130], [10, 100]]);
  const rally = between(13, (i) => 106 + 0.2 * i, (i) => 100 + 0.2 * i, 6);
  const bear = fromCloses([...Array(15).fill(0).map((_, i) => 130 - (i % 2)), ...drop, ...rally.slice(1)], 0.003);
  expect(bear, "Pennant or flags", "forming", "Bear flag");
}

// ---- every confirmed/forming result carries sane numbers ----
{
  for (const s of [fromCloses(through(dtPts)), fromCloses(through(dbPts)), fromCloses(through(hsPts)), fromCloses(bowl(62), 0.003)]) {
    for (const r of scanPatterns(s)) {
      assert.ok(typeof r.detail === "string" && r.detail.length > 0);
      if (r.state === "confirmed" || r.state === "forming") assert.ok(isFinite(r.level!) && isFinite(r.stop!), `${r.family}: level and stop are numbers`);
    }
  }
}

// ---- random walks: report how often a pattern shows up so a runaway detector is caught ----
{
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const counts: Record<string, number> = {};
  const runs = 400;
  for (let k = 0; k < runs; k++) {
    let p = 100; const c: number[] = [];
    for (let i = 0; i < 63; i++) { p *= 1 + (rnd() - 0.5) * 0.04; c.push(p); }
    const s = { c, h: c.map((v) => v * (1 + rnd() * 0.01)), l: c.map((v) => v * (1 - rnd() * 0.01)) };
    for (const r of scanPatterns(s)) if (r.state === "confirmed") counts[r.family] = (counts[r.family] || 0) + 1;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log("random-walk confirmed counts per 400 walks:", JSON.stringify(counts));
  assert.ok(total / runs < 0.6, `too many false confirmations on random data: ${total} in ${runs}`);
}

console.log("chart patterns: synthetic shapes detected, negatives stay quiet");
