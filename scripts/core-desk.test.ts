import assert from "node:assert/strict";
import { TRADES, SESSION_DATES, parseLevels, levelsOk, sizePosition, trailStop, planText, obsidianNote, mergeSettings, emaSeries, rsiSeries } from "../src/core/desk";

const laurus = TRADES.find((t) => t.sym === "LAURUSLABS")!, sail = TRADES.find((t) => t.sym === "SAILIFE")!;
assert.equal(TRADES.length, 2);
for (const t of TRADES) assert.equal(t.closes.length, SESSION_DATES.length, `${t.sym}: one date per close`);

// sizing: 500000 x 1% / (2470 - 2320) = 33.33 -> 33 shares
const L = parseLevels(laurus.L);
assert.ok(levelsOk(L));
const z = sizePosition(L, "500000", "1")!;
assert.equal(z.qty, 33); assert.equal(z.risk, 150); assert.equal(z.atRisk, 4950); assert.equal(z.capped, false);
assert.equal(sizePosition(L, "1000000", "2")!.qty, 133);
// capital cap: 10% risk on a tight stop would exceed capital, so it is capped at capital / entry
const tight = sizePosition({ entry: 100, stop: 99, t1: 102, t2: 103 }, "10000", "10")!;
assert.equal(tight.qty, 100); assert.equal(tight.capped, true);
// invalid levels give no size
assert.equal(sizePosition({ ...L, stop: 2500 }, "500000", "1"), null);
assert.equal(sizePosition(parseLevels({ entry: "abc", stop: "1", t1: "2", t2: "3" }), "500000", "1"), null);

// trail: 8% below the highest close
const tr = trailStop(laurus.closes, laurus.close, "8", "", L.stop)!;
assert.equal(+tr.stop.toFixed(2), 2257.68); assert.equal(tr.usingData, true); assert.equal(tr.binding, false);
assert.equal(+trailStop(laurus.closes, laurus.close, "8", "2600", L.stop)!.stop.toFixed(2), 2392); // typed high wins and now beats the fixed stop
assert.equal(trailStop(laurus.closes, laurus.close, "8", "2600", L.stop)!.binding, true);
assert.equal(trailStop(laurus.closes, laurus.close, "0", ""), null);
assert.equal(trailStop(laurus.closes, laurus.close, "55", ""), null);

// note and plan text
const note = obsidianNote({ ...laurus, unchecked: 2 }, L, z, "2026-11-11");
for (const line of ["type: minervini-sepa-setup", "ticker: LAURUSLABS", "pivot_price: 2470", "stop_loss: 2320", "target_1: 2770", "target_2: 2920", "trend_score: 6", 'created_date: "2026-11-11"', "- Size at ₹5,00,000 and 1% risk: 33 shares", "Not checked: 200 DMA slope, RS rating"]) assert.ok(note.includes(line), line);
assert.ok(planText(laurus, L, z, tr).includes("Trailing stop 8% below ₹2,454.00 = ₹2,257.68"));

// settings: junk falls back to defaults
assert.deepEqual(mergeSettings({ capital: "x", riskPct: "2" } as any), { capital: "500000", riskPct: "2", trailPct: "8", trails: {} });
assert.deepEqual(mergeSettings(null), { capital: "500000", riskPct: "1", trailPct: "8", trails: {} });
// trail % per pick: swing 8, intraday 3, typed values win, junk is ignored
import { trailFor, defaultTrailPct } from "../src/core/desk";
assert.equal(defaultTrailPct("swing"), "8"); assert.equal(defaultTrailPct("intra"), "3"); assert.equal(defaultTrailPct("other"), "8");
assert.equal(trailFor(null, "intra"), "3"); assert.equal(trailFor({ trails: { intra: "5" } }, "intra"), "5"); assert.equal(trailFor({ trails: { intra: "abc" } }, "intra"), "3");
assert.deepEqual(mergeSettings({ trails: { intra: "4", swing: "x" } } as any).trails, { intra: "4" });
// 3% trail on SAILIFE from its highest close 1836.8 -> 1781.70
assert.equal(+trailStop(sail.closes, sail.close, trailFor(null, "intra"), "")!.stop.toFixed(2), 1781.7);

// indicators agree with the numbers shown on the desk
const rsi = rsiSeries({ closes: laurus.closes, pre: laurus.pre }, 14), ema = emaSeries({ closes: laurus.closes, pre: laurus.pre }, 20);
assert.equal(+rsi[rsi.length - 1]!.toFixed(1), 75.0); assert.equal(+ema[ema.length - 1]!.toFixed(2), 2214.39);
const rs = rsiSeries({ closes: sail.closes, pre: sail.pre }, 14); assert.equal(+rs[rs.length - 1]!.toFixed(1), 81.1);
console.log("core desk: all checks passed");

// snapshot: what the extension shows must match the desk
import { buildSnapshot } from "../src/core/desk";
const snap = buildSnapshot(), sl = snap.trades[0], ss = snap.trades[1];
assert.equal(sl.sym, "LAURUSLABS"); assert.equal(sl.rsi[sl.rsi.length - 1], 75.0); assert.equal(sl.ema20[sl.ema20.length - 1], 2214.39);
assert.equal(ss.rsi[ss.rsi.length - 1], 81.1); assert.equal(ss.ema20[ss.ema20.length - 1], 1561.22);
assert.equal(sl.candles.length, 4); assert.equal(ss.candles.length, 1); assert.equal(sl.alerts.length, 6); assert.equal(ss.alerts.length, 6);
console.log("snapshot: matches the desk values");

// day change uses the previous bar, not the feed's inconsistent prevClose field
import { dayChangePct, previousClose } from "../src/core/desk";
assert.equal(previousClose(laurus), 2340); assert.equal(previousClose(sail), 1785.1);
assert.equal(+dayChangePct(laurus).toFixed(2), 4.87); assert.equal(+dayChangePct(sail).toFixed(2), 2.9);
assert.equal(+dayChangePct({ close: 110, prev: 100 }).toFixed(2), 10); // no series: falls back to prev
console.log("day change: consistent");

// ---- trailing-stop tracker ----
import { openPosition, applyBar, trackerView, sanitizePositions } from "../src/core/desk";
{
  // SAILIFE intraday: fill 1900, 50 shares, fixed stop 1855, 3% trail
  const p0 = openPosition({ fill: 1900, qty: 50, stop0: 1855, on: "2026-11-12" })!;
  assert.ok(p0); assert.equal(p0.stop, 1855); assert.equal(p0.high, 1900);
  assert.equal(openPosition({ fill: 1900, qty: 50, stop0: 1900 }), null);   // stop must be below the fill
  assert.equal(openPosition({ fill: 1900, qty: 0, stop0: 1855 }), null);
  assert.equal(openPosition({ fill: -1, qty: 5, stop0: 1 }), null);
  // price runs to 1980: trail = 1980 x 0.97 = 1920.60, above the fixed stop, so the stop is raised
  const p1 = applyBar(p0, { price: 1975, high: 1980, low: 1940 }, 3);
  assert.equal(+p1.high.toFixed(2), 1980); assert.equal(+p1.stop.toFixed(2), 1920.6); assert.equal(p1.hit, false);
  // a lower price does not lower the stop
  const p2 = applyBar(p1, { price: 1950 }, 3);
  assert.equal(+p2.stop.toFixed(2), 1920.6); assert.equal(+p2.high.toFixed(2), 1980);
  // the new high only counts after the old stop is checked: a low of 1915 under the old stop 1920.60 is a hit even though the high was 2100
  const p3 = applyBar(p2, { price: 2050, high: 2100, low: 1915 }, 3);
  assert.equal(p3.hit, true); assert.equal(+p3.hitAt!.toFixed(2), 1920.6); assert.equal(+p3.high.toFixed(2), 1980);
  // hit is sticky: later prices change nothing
  assert.equal(applyBar(p3, { price: 3000, high: 3000 }, 3), p3);
  // stop never drops when the trail % is widened
  const wide = applyBar(p1, { price: 1975 }, 8); assert.equal(+wide.stop.toFixed(2), 1920.6);
  // views
  const v = trackerView(p1, 3);
  assert.equal(+v.stop.toFixed(2), 1920.6); assert.equal(v.binding, "trail"); assert.equal(+v.raisedBy.toFixed(2), 65.6);
  assert.equal(v.pnl, 3750); assert.equal(+v.openR.toFixed(2), 1.67); assert.equal(+v.lockedIfStopped.toFixed(2), 1030); assert.equal(v.status, "ok");
  assert.equal(trackerView(applyBar(p0, { price: 1860 }, 3), 3).status, "danger");   // 0.27% above the stop
  assert.equal(trackerView(applyBar(p0, { price: 1850 }, 3), 3).status, "hit");
  assert.equal(+trackerView(applyBar(p0, { price: 1850 }, 3), 3).lockedIfStopped.toFixed(0), -2250);
  // bad bar or bad trail changes nothing
  assert.equal(applyBar(p0, { price: NaN }, 3), p0); assert.equal(applyBar(p0, { price: 1900 }, 0), p0); assert.equal(applyBar(p0, { price: 1900 }, 60), p0);
  // saved junk is dropped, good records survive a round trip
  assert.deepEqual(sanitizePositions("x"), {}); assert.deepEqual(sanitizePositions({ a: 5, b: { fill: "x" }, c: { fill: 100, stop0: 120, qty: 1, high: 1, stop: 1, last: 1 } }), {});
  assert.deepEqual(sanitizePositions(JSON.parse(JSON.stringify({ intra: p1 }))).intra.stop, p1.stop);
  console.log("tracker: ratchet, hit, sticky, junk handling ok");
}
