// Run the ten-pattern scan on the two picks and the dashboard stocks and print a table.
//   npx tsx scripts/scan-patterns.ts
import { TRADES, scanPatterns, seriesFromTrade, FAMILIES } from "../src/core/desk";
import { MOCK_STOCKS } from "../src/data/mockStocks";
import { stockToDeskTrade } from "../src/utils/deskAdapter";
import { REAL_BARS } from "../src/data/realNseBars";

const rows: { sym: string; real: boolean; bars: number; res: ReturnType<typeof scanPatterns> }[] = [];
for (const t of TRADES) { const s = seriesFromTrade(t); rows.push({ sym: t.sym, real: true, bars: s.c.length, res: scanPatterns(s) }); }
for (const [sym, b] of Object.entries(REAL_BARS)) rows.push({ sym, real: true, bars: b.c.length, res: scanPatterns(b) });
for (const m of MOCK_STOCKS) {
  if (REAL_BARS[m.ticker]) continue; // judged on real NSE bars above
  const t = stockToDeskTrade(m);
  if (!t) { console.log(`${m.ticker}: no usable history`); continue; }
  const s = seriesFromTrade(t); rows.push({ sym: m.ticker, real: false, bars: s.c.length, res: scanPatterns(s) });
}
for (const r of rows) {
  console.log(`\n${r.sym} (${r.real ? "real NSE bars" : "SAMPLE data"}, ${r.bars} bars)`);
  for (const p of r.res) {
    const mark = p.state === "confirmed" ? "CONFIRMED" : p.state === "forming" ? "forming  " : p.state === "insufficient" ? "too short " : "-        ";
    console.log(`  ${mark} ${p.family.padEnd(22)} ${p.state === "none" || p.state === "insufficient" ? p.detail : (p.detail.startsWith(p.name) ? p.detail : `${p.name}: ${p.detail}`)}`);
  }
}
console.log("\n" + ["Ticker", ...FAMILIES].join(" | "));
for (const r of rows) console.log([r.sym, ...r.res.map((p) => (p.state === "confirmed" ? "YES" : p.state === "forming" ? "forming" : p.state === "insufficient" ? "n/a" : "no"))].join(" | "));
