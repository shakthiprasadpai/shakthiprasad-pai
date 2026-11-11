import { TRADES, SESSION_DATES, PICKS_META, type DeskPick } from "./picks";
import { previousClose } from "./plan";
import { emaSeries, rsiSeries, candlePatterns, patternAlerts, stageInfo, vcpScan, pocketPivots } from "../../utils/deskIndicators";

// The two picks plus every indicator the extension shows, computed from the same bars as the dashboard.
// Pure and cheap (two 40-bar series), so the extension computes it when it opens instead of shipping a data file.

const r = (v: number | null | undefined, d: number) => (v == null ? null : +v.toFixed(d));

export function buildSnapshot(picks: DeskPick[] = TRADES, dates: string[] = SESSION_DATES) {
  const trades = picks.map((t) => {
    const tt: any = { ...t, dates };
    const ema = emaSeries(tt, 20), rsi = rsiSeries(tt, 14), st = stageInfo(tt), vc = vcpScan(tt);
    return {
      id: t.id, sym: t.sym, name: t.name, mode: t.mode, setup: t.setup, close: t.close, prev: previousClose(t),
      hi52: t.hi52, lo52: t.lo52, ma: t.ma, levels: t.L, closes: t.closes, vols: t.vols, dates,
      ema20: ema.map((v: number | null) => r(v, 2)), rsi: rsi.map((v: number | null) => r(v, 1)),
      candles: candlePatterns(tt).filter((p: any) => p.i >= t.closes.length - 10).map((p: any) => ({ date: dates[p.i], name: p.name, bias: p.bias, note: p.note })),
      alerts: patternAlerts(tt, t.L).map(([sev, txt]: [string, string]) => ({ sev, txt })),
      stage2: st.stage2, ext50: r(st.ext50, 1) as number, fromHigh: r(st.fromHigh, 1) as number,
      vcp: { tightening: vc.tightening, depths: vc.contractions.map((c: any) => r(c.depth, 1)) },
      pocketPivots: pocketPivots(tt).filter((x: any) => x.ago <= 3).map((x: any) => ({ ago: x.ago, vol: r(x.vol, 1) })),
      checks: t.checks, note: t.note, targets: t.targets,
    };
  });
  return { meta: PICKS_META, trades };
}
export type DeskSnapshot = ReturnType<typeof buildSnapshot>;
