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
assert.deepEqual(mergeSettings({ capital: "x", riskPct: "2" } as any), { capital: "500000", riskPct: "2", trailPct: "8" });
assert.deepEqual(mergeSettings(null), { capital: "500000", riskPct: "1", trailPct: "8" });

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
