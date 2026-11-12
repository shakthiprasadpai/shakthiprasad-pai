import assert from "node:assert/strict";
import { parseCsv, parsePatternCsv, checkRow } from "../src/core/desk/patternSheet";
import type { PatternResult } from "../src/core/desk/chartPatterns";

// quoted commas, doubled quotes, CRLF
assert.deepEqual(parseCsv('a,"b,c","d ""e"""\r\n1,2,3\r\n'), [["a", "b,c", 'd "e"'], ["1", "2", "3"]]);

const csv = [
  "Stock,Pattern,Status,Bias,Trigger (₹),Target (₹),Note",
  'SAILIFE (intraday pick),Inverse head and shoulders,Confirmed,Bullish,"1,578.24","1,802.34","Price ₹1,836.80 is past the target, so extended"',
  "SUVEN,Bear flag,Forming,Bearish,256.30,168.95,A close below confirms it",
  "ZEEL,None,None,,,,No pattern",
  "junk,row,Maybe,,,,",
].join("\n");
const { rows, error } = parsePatternCsv(csv);
assert.equal(error, undefined);
assert.equal(rows.length, 3);
assert.equal(rows[0].stock, "SAILIFE"); assert.equal(rows[0].trigger, 1578.24); assert.equal(rows[0].status, "confirmed");
assert.match(rows[0].note, /1,836\.80/);
assert.equal(rows[2].trigger, null);
assert.ok(parsePatternCsv("a,b\n1,2").error);
assert.ok(parsePatternCsv("").error);

const R = (name: string, family: string, state: PatternResult["state"], level?: number): PatternResult => ({ family, name, bias: "bullish", state, detail: "", level } as any);
const scans = {
  SAILIFE: [R("Inverse head and shoulders", "Head and shoulders", "confirmed", 1578.3)],
  SUVEN: [R("Double bottom", "Double bottom", "confirmed", 273), R("Bear flag", "Pennant or flags", "none")],
  ZEEL: [R("Double top", "Double top", "forming", 100)],
};
assert.equal(checkRow(rows[0], scans).check, "match");
const s = checkRow(rows[1], scans); assert.equal(s.check, "differs"); assert.equal(s.live, "Not formed");
const z = checkRow(rows[2], scans); assert.equal(z.check, "differs"); assert.match(z.live, /Double top: forming/);
assert.equal(checkRow({ ...rows[0], stock: "NOPE" }, scans).check, "not scanned");
assert.equal(checkRow({ ...rows[0], trigger: 1500 }, scans).check, "differs"); // trigger moved more than 0.5%
console.log("pattern sheet: csv parse, row checks ok");
