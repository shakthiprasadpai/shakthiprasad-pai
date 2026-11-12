import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run, expandGlob } from "./desk-cli";
import { renderDash, sparkline, ladder, wrapLine } from "./desk-dash";
import { buildHistory, readBhavText, parseBhavDate, barsToSeries, scanPatterns } from "../src/core/desk";

const ok = (...a: string[]) => { const r = run(a); assert.equal(r.code, 0, `${a.join(" ")}: ${r.err}`); return r.out; };
const bad = (...a: string[]) => { const r = run(a); assert.equal(r.code, 2, a.join(" ")); return r.err; };

// bhavcopy: both formats, EQ only, dates in every NSE spelling, sorted, later file wins on a repeated date
assert.equal(parseBhavDate("2026-07-01"), "2026-07-01");
assert.equal(parseBhavDate("01-Jul-2026"), "2026-07-01");
assert.equal(parseBhavDate("01-July-2026"), "2026-07-01");
assert.equal(parseBhavDate("01/07/2026"), "2026-07-01");
assert.throws(() => parseBhavDate("31-Feb-2026"));
const UDIFF = (d: string) => `TradDt,BizDt,Sgmt,Src,FinInstrmTp,FinInstrmId,ISIN,TckrSymb,SctySrs,XpryDt,FininstrmActlXpryDt,StrkPric,OptnTp,FinInstrmNm,OpnPric,HghPric,LwPric,ClsPric,LastPric,PrvsClsgPric,UndrlygPric,SttlmPric,OpnIntrst,ChngInOpnIntrst,TtlTradgVol
${d},${d},CM,NSE,STK,1,IN1,TRENT,EQ,,,,,TRENT,100,110,95,105,105,100,,105,,,5000
${d},${d},CM,NSE,STK,2,IN2,TRENT,BE,,,,,TRENT,1,1,1,1,1,1,,1,,,10
${d},${d},CM,NSE,STK,3,IN3,GOLDBOND,GB,,,,,GB,50,50,50,50,50,50,,50,,,1
`;
const FULL = (d: string) => `SYMBOL, SERIES, DATE1, PREV_CLOSE, OPEN_PRICE, HIGH_PRICE, LOW_PRICE, LAST_PRICE, CLOSE_PRICE, AVG_PRICE, TTL_TRD_QNTY, TURNOVER_LACS, NO_OF_TRADES, DELIV_QTY, DELIV_PER
TRENT, EQ, ${d}, 100, 100, 110, 95, 105, 105, 103, 5000, 5, 10, 100, 20
`;
const hist = buildHistory([{ name: "b", text: UDIFF("2026-07-02") }, { name: "a", text: FULL("01-Jul-2026") }]);
assert.deepEqual(Object.keys(hist), ["TRENT"]);
assert.deepEqual(hist.TRENT.map((b) => b.date), ["2026-07-01", "2026-07-02"]);
assert.equal(hist.TRENT[1].c, 105);
assert.deepEqual(barsToSeries(hist.TRENT), { h: [110, 110], l: [95, 95], c: [105, 105] });
assert.deepEqual(Object.keys(readBhavText(UDIFF("2026-07-02"), "x", ["nosuch"])), []);
assert.throws(() => readBhavText("A,B\n1,2\n", "x.csv"), /not a cash-market bhavcopy/);
assert.equal(scanPatterns(barsToSeries(hist.TRENT)).every((r) => r.state === "insufficient"), true); // two bars are far too few

// picks and size: the numbers the app shows
const picks = ok("picks");
for (const t of ["Qty 33 at ₹5,00,000 capital and 1% risk", "Qty 111", "Trailing stop 8% below ₹2,454.00 = ₹2,257.68", "Trailing stop 3% below ₹1,836.80 = ₹1,781.70"]) assert.ok(picks.includes(t), t);
assert.ok(ok("picks", "--risk", "2").includes("Qty 66 at"));
const size = ok("size", "--entry", "2470", "--stop", "2320", "--t1", "2770", "--t2", "2920");
assert.ok(size.includes("Quantity 33") && size.includes("T1 2.00R"));
assert.ok(bad("size", "--entry", "100", "--stop", "120", "--t1", "130", "--t2", "140").includes("Levels do not work"));
assert.ok(bad("size", "--entry", "abc", "--stop", "1", "--t1", "2", "--t2", "3").includes("--entry needs a number"));

// patterns: list flags take several values, unknown tickers are reported, a wrong file is refused
const pt = ok("patterns", "--symbols", "SAILIFE", "TRENT", "LAURUSLABS");
assert.ok(pt.includes("SAILIFE") && pt.includes("Inverse head and shoulders"));
assert.ok(run(["patterns", "--symbols", "NOSUCH"]).err.includes("no price history"));
assert.ok(Array.isArray(JSON.parse(ok("patterns", "--symbols", "TRENT", "--json"))));

const dir = mkdtempSync(join(tmpdir(), "desk-"));
try {
  writeFileSync(join(dir, "BhavCopy_NSE_CM_0_0_0_20260702_F_0000.csv"), UDIFF("2026-07-02"));
  writeFileSync(join(dir, "sec_bhavdata_full_01072026.csv"), FULL("01-Jul-2026"));
  writeFileSync(join(dir, "wrong.csv"), "A,B\n1,2\n");
  assert.equal(expandGlob(join(dir, "*.csv")).length, 3);
  assert.deepEqual(expandGlob(join(dir, "none*.csv")), []);
  const fromFiles = ok("patterns", "--bhavcopy", join(dir, "BhavCopy*.csv"), join(dir, "sec_bhavdata_full_01072026.csv"));
  assert.ok(/TRENT\s+2\s/.test(fromFiles), "two bars built from the two formats");
  assert.ok(bad("patterns", "--bhavcopy", join(dir, "wrong.csv")).includes("not a cash-market bhavcopy"));
  assert.ok(bad("patterns", "--bhavcopy", join(dir, "nothing*.csv")).includes("No bhavcopy files matched"));

  // note: stdout, or a file in the vault
  assert.ok(ok("note", "LAURUSLABS").includes("type: minervini-sepa-setup"));
  const v = ok("note", "swing", "--vault", dir);
  assert.ok(v.startsWith("Wrote ") && existsSync(join(dir, "Trades", "LAURUSLABS-2026-11-09.md")));
  assert.ok(bad("note", "NOPE").includes("No pick called"));

  // tracker: open, ratchet the stop, stop hit, close; the file is the same JSON the Python package writes
  const state = join(dir, "pos.json");
  const S = ["--state", state];
  assert.ok(bad("track", "show", ...S).includes("No open position"));
  assert.ok(bad("track", "open", "swing", "--fill", "2300", "--qty", "10", ...S).includes("Cannot open"));
  assert.ok(ok("track", "open", "swing", "--fill", "2470", "--qty", "33", "--on", "2026-11-10", ...S).includes("Opened LAURUSLABS: 33 shares at ₹2,470.00, stop ₹2,320.00"));
  const up = ok("track", "update", "swing", "--price", "2600", "--high", "2610", "--low", "2580", "--on", "2026-11-11", ...S);
  assert.ok(up.includes("Stop ₹2,401.20 (trail, raised ₹81.20") && up.includes("status: OK") && up.includes("+₹4,290 (+5.3%)"), up);
  const saved = JSON.parse(readFileSync(state, "utf-8"));
  assert.equal(saved.swing.high, 2610); assert.equal(saved.swing.qty, 33);
  assert.ok(ok("track", "show", ...S).includes("LAURUSLABS"));
  assert.ok(ok("track", "update", "swing", "--price", "2300", "--on", "2026-11-12", ...S).includes("status: HIT"));
  assert.ok(ok("track", "close", "swing", ...S).includes("Closed swing"));
  assert.ok(bad("track", "close", "swing", ...S).includes("No open position"));
  assert.ok(bad("track", "update", "swing", ...S).includes("update needs --price"));
  assert.ok(bad("track", "update", ...S).includes("Name the pick"));
  assert.ok(bad("track", "frobnicate", ...S).includes("track needs one of"));
} finally { rmSync(dir, { recursive: true, force: true }); }

// dashboard: pure text, fits the width, shows both picks, the ladder, and open positions
assert.equal(sparkline([1, 2, 3, 4, 5, 6, 7, 8], 8), "▁▂▃▄▅▆▇█");
assert.equal(sparkline([5, 5, 5], 3), "▄▄▄");
const lad = ladder({ stop: 90, entry: 100, t1: 110, t2: 120 }, 95, 31);
assert.equal(lad.length, 31); assert.equal(lad[0], "S"); assert.equal(lad[30], "2"); assert.equal(lad[5], "●"); assert.equal(lad[10], "E");
const plain = renderDash({ width: 100, color: false });
assert.ok(!plain.includes("\x1b"));
for (const l of plain.split("\n")) assert.ok([...l].length <= 100, `too wide: ${l}`);
for (const t of ["LAURUSLABS", "SAILIFE", "Qty 33", "Qty 111", "none. Start one with", "Inverse head and shoulders confirmed"]) assert.ok(plain.includes(t), t);
assert.ok(renderDash({ width: 100, color: true }).includes("\x1b[32m"));
assert.deepEqual(wrapLine("  aaa bbb ccc ddd", 11), ["  aaa bbb", "    ccc ddd"]);
assert.deepEqual(wrapLine("short", 11), ["short"]);
assert.ok(renderDash({ width: 60, color: false }).split("\n").every((l) => [...l].length <= 60));
const dd = mkdtempSync(join(tmpdir(), "dash-"));
try {
  const st = join(dd, "pos.json");
  ok("track", "open", "swing", "--fill", "2470", "--qty", "33", "--on", "2026-11-10", "--state", st);
  ok("track", "update", "swing", "--price", "2600", "--high", "2610", "--on", "2026-11-11", "--state", st);
  const d2 = ok("dash", "--no-color", "--width", "100", "--state", st);
  assert.ok(d2.includes("33 @ ₹2,470.00") && d2.includes("stop ₹2,401.20 (trail)") && d2.includes("+₹4,290") && d2.includes("OK"), d2);
  assert.ok(!d2.includes("none. Start one"));
  assert.ok(ok("dash", "--no-color", "--state", join(dd, "missing.json")).includes("none. Start one"));
  assert.ok(bad("dash", "--width", "abc").includes("--width needs a number"));
} finally { rmSync(dd, { recursive: true, force: true }); }

assert.ok(bad("nope").includes("Unknown command"));
assert.ok(bad("picks", "--bogus").length > 0);
assert.equal(run(["--help"]).code, 0);
console.log("desk-cli tests passed");
