"""Command line for the desk.

  python -m trade_desk picks                       both picks: levels, size, trailing stop, indicators, alerts, patterns
  python -m trade_desk size --entry 2470 --stop 2320 --t1 2770 --t2 2920 [--capital 500000 --risk 1]
  python -m trade_desk patterns [--symbols TRENT SUVEN] [--bhavcopy FILES... --symbols ...] [--all]
  python -m trade_desk note LAURUSLABS [--vault DIR]
  python -m trade_desk track open swing --fill 2470 --qty 33
  python -m trade_desk track update swing --price 2600 [--high 2610 --low 2580]
  python -m trade_desk track show [swing]
  python -m trade_desk track close swing
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import List, Optional

from . import bhavcopy
from .indicators import candle_patterns, ema_series, pattern_alerts, rsi_series, stage_info
from .patterns import FAMILIES, Series, scan_patterns, series_from_trade, summarize
from .picks import PICKS_META, REAL_BARS, SESSION_DATES, TRADES, get_pick
from .plan import (day_change_pct, levels_ok, obsidian_note, parse_levels, plan_text, size_position, trail_for, trail_stop)
from .tracker import Bar, apply_bar, load_positions, open_position, save_positions, tracker_view
from .util import fmt_in, inr

STATE = Path.home() / ".trade_desk" / "positions.json"


def _hr(title: str) -> None:
    print(f"\n{title}\n" + "-" * len(title))


def cmd_picks(a) -> int:
    print(f"Desk picks, {PICKS_META['label']}")
    for t in TRADES:
        L = parse_levels(t["L"])
        z = size_position(L, a.capital, a.risk)
        trail = trail_stop(t["closes"], t["close"], trail_for(None, t["id"]), "", L.stop)
        _hr(f"{t['sym']}  {t['name']}  ({t['mode']})")
        print(f"Setup: {t['setup']}")
        print(f"Close {inr(t['close'])}  ({day_change_pct(t):+.1f}% on the day)   52w {inr(t['lo52'])} to {inr(t['hi52'])}")
        print(plan_text(t, L, z, trail))
        if z:
            print(f"R multiples: T1 {z.r1:.1f}R, T2 {z.r2:.1f}R   position value {inr(z.value)}" + ("  (capped by capital)" if z.capped else ""))
        tt = {**t, "dates": SESSION_DATES}
        rsi, ema = rsi_series(tt)[-1], ema_series(tt)[-1]
        st = stage_info(tt)
        print(f"RSI(14) {rsi:.1f}   EMA(20) {inr(ema)}   stage 2: {'yes' if st['stage2'] else 'no'}   {st['ext50']:.1f}% above the 50 DMA")
        print("Trend Template: " + f"{sum(1 for c in t['checks'] if c[2] == 'pass')} pass, {sum(1 for c in t['checks'] if c[2] == 'unk')} not checked")
        for sev, txt in pattern_alerts(tt, L):
            print(f"  [{sev:>4}] {txt}")
        recent = [p for p in candle_patterns(tt) if p["i"] >= len(t["closes"]) - 10]
        for p in recent:
            print(f"  candle {SESSION_DATES[p['i']]}: {p['name']} ({p['bias']})")
        for r in scan_patterns(series_from_trade(t)):
            if r.state in ("confirmed", "forming"):
                print(f"  chart pattern: {r.name} {r.state}, {r.bias}. {r.detail}")
        print(f"Plan: {t['targets']}")
    print("\nNot checked: " + ", ".join(PICKS_META["uncheckedRules"]) + ". Levels are from the bhavcopy screen, not advice.")
    return 0


def cmd_size(a) -> int:
    L = parse_levels({"entry": a.entry, "stop": a.stop, "t1": a.t1, "t2": a.t2})
    if not levels_ok(L):
        print("Levels do not work: need stop < entry < T1 <= T2, all above zero.", file=sys.stderr)
        return 2
    z = size_position(L, a.capital, a.risk)
    trail = trail_stop([L.entry], L.entry, a.trail, "", L.stop)
    print(f"Capital {inr(z.cap)}  risk {z.rp}%  risk per share {inr(z.risk)}")
    print(f"Quantity {z.qty}  position {inr(z.value)}  at risk {inr(z.atRisk)}" + ("  (capped by capital)" if z.capped else ""))
    print(f"T1 {z.r1:.2f}R   T2 {z.r2:.2f}R")
    if trail:
        print(f"Trailing stop {trail.p}% below the highest price: starts working once price passes {inr(trail.activates)}")
    return 0


def _series_for(sym: str, hist) -> Optional[Series]:
    for t in TRADES:
        if t["sym"] == sym:
            return series_from_trade(t)
    if sym in hist:
        return bhavcopy.to_series(hist[sym])
    if sym in REAL_BARS:
        b = REAL_BARS[sym]
        return Series(h=b["h"], l=b["l"], c=b["c"])
    return None


def cmd_patterns(a) -> int:
    hist = bhavcopy.build_history([Path(p) for p in a.bhavcopy], a.symbols or None) if a.bhavcopy else {}
    if a.symbols:
        syms = [s.upper() for s in a.symbols]
    elif hist:
        syms = sorted(hist)
    else:
        syms = [t["sym"] for t in TRADES] + list(REAL_BARS)
    rows = []
    for s in syms:
        ser = _series_for(s, hist)
        if ser is None:
            print(f"{s}: no price history (give --bhavcopy files)", file=sys.stderr)
            continue
        rows.append((s, len(ser.c), scan_patterns(ser)))
    if a.json:
        print(json.dumps([{"symbol": s, "bars": n, "patterns": [r.__dict__ for r in rs]} for s, n, rs in rows], indent=1, default=str))
        return 0
    print("Chart patterns (confirmed = a close broke the trigger line in the last 8 bars; forming = shape in place, no trigger yet)\n")
    short = {"Head and shoulders": "H&S", "Double top": "Dbl top", "Double bottom": "Dbl bottom", "Rounding bottom": "Round bot", "Cup and handle": "Cup+handle",
             "Wedges": "Wedges", "Pennant or flags": "Flag/pennant", "Ascending triangle": "Asc tri", "Descending triangle": "Desc tri", "Symmetrical triangle": "Sym tri"}
    print(f"{'Ticker':<12}{'Bars':>5}  " + "  ".join(f"{short[f]:<12}" for f in FAMILIES))
    for s, n, rs in rows:
        cell = lambda r: "YES" if r.state == "confirmed" else "forming" if r.state == "forming" else "-" if r.state == "none" else "n/a"
        print(f"{s:<12}{n:>5}  " + "  ".join(f"{cell(r):<12}" for r in rs))
    shown = False
    for s, n, rs in rows:
        act = [r for r in rs if r.state in ("confirmed", "forming")]
        if act and (a.all or a.symbols or len(rows) <= 12):
            if not shown:
                print()
                shown = True
            print(s)
            for r in act:
                print(f"  {r.state.upper():<9} {r.name}, {r.bias}: {r.detail}")
    print("\nRule-based detection on daily bars. Open the chart before trading a pattern; about 60 bars is short for a cup and handle or rounding bottom.")
    return 0


def cmd_note(a) -> int:
    t = get_pick(a.pick)
    L = parse_levels(t["L"])
    tt = {**t, "dates": SESSION_DATES}
    note = obsidian_note({**t, "unchecked": 2}, L, size_position(L, a.capital, a.risk), None, round(rsi_series(tt)[-1], 1), round(ema_series(tt)[-1], 2))
    if a.vault:
        out = Path(a.vault) / "Trades" / f"{t['sym']}-{PICKS_META['asOf']}.md"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(note, encoding="utf-8")
        print(f"Wrote {out}")
    else:
        print(note)
    return 0


def cmd_track(a) -> int:
    state = Path(a.state)
    pos = load_positions(state)
    if a.action == "show" or a.action == "update" or a.action == "close":
        pass
    pid = get_pick(a.pick)["id"] if a.pick else None
    if a.action == "open":
        t = get_pick(a.pick)
        L = parse_levels(t["L"])
        stop0 = a.stop if a.stop else L.stop
        p = open_position(a.fill, a.qty, stop0)
        if not p:
            print("Cannot open: need fill > stop, both above zero, and at least 1 share.", file=sys.stderr)
            return 2
        pos[pid] = p
        save_positions(state, pos)
        print(f"Opened {t['sym']}: {p.qty} shares at {inr(p.fill)}, stop {inr(p.stop0)}")
        return 0
    if a.action == "close":
        if pid in pos:
            del pos[pid]
            save_positions(state, pos)
            print(f"Closed {pid}")
        else:
            print("No open position there.", file=sys.stderr)
            return 2
        return 0
    ids = [pid] if pid else list(pos)
    if not ids or any(i not in pos for i in ids):
        print("No open position. Start one with: track open <pick> --fill <price> --qty <n>", file=sys.stderr)
        return 2
    for i in ids:
        trail = float(trail_for(None, i))
        if a.action == "update":
            before = pos[i]
            pos[i] = apply_bar(before, Bar(a.price, a.high, a.low, a.on), trail)
            save_positions(state, pos)
        p = pos[i]
        v = tracker_view(p, trail)
        sym = get_pick(i)["sym"]
        print(f"{sym}  {p.qty} shares, fill {inr(p.fill)}, last {inr(p.last)}, high {inr(p.high)}")
        print(f"  Stop {inr(v.stop)} ({v.binding}, raised {inr(v.raisedBy)} from the starting {inr(p.stop0)}), {trail:g}% trail  status: {v.status.upper()}")
        print(f"  P&L {'+' if v.pnl >= 0 else '-'}₹{fmt_in(abs(v.pnl))} ({v.pnlPct:+.1f}%), {v.openR:+.2f}R   {v.distancePct:.1f}% above the stop")
        print(f"  If the stop fills: {'+' if v.lockedIfStopped >= 0 else '-'}₹{fmt_in(abs(v.lockedIfStopped))}")
        if a.action == "update" and p.log:
            print(f"  {p.log[-1].note}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(prog="trade_desk", description="Minervini trade desk: sizing, trailing stops, tracker, chart patterns.")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub_common = argparse.ArgumentParser(add_help=False)
    sub_common.add_argument("--capital", default="500000", help="account size in rupees (default 500000)")
    sub_common.add_argument("--risk", default="1", help="risk per trade in percent (default 1)")

    sub.add_parser("picks", parents=[sub_common], help="show both picks").set_defaults(fn=cmd_picks)

    p = sub.add_parser("size", parents=[sub_common], help="size a position from your own levels")
    for k in ("entry", "stop", "t1", "t2"):
        p.add_argument(f"--{k}", type=float, required=True)
    p.add_argument("--trail", default="8", help="trailing stop percent (default 8)")
    p.set_defaults(fn=cmd_size)

    p = sub.add_parser("patterns", help="scan the ten chart patterns")
    p.add_argument("--symbols", nargs="*", help="tickers to scan")
    p.add_argument("--bhavcopy", nargs="*", default=[], help="daily bhavcopy CSV files to build history from")
    p.add_argument("--all", action="store_true", help="print the detail of every active pattern")
    p.add_argument("--json", action="store_true")
    p.set_defaults(fn=cmd_patterns)

    p = sub.add_parser("note", parents=[sub_common], help="Obsidian note for a pick")
    p.add_argument("pick")
    p.add_argument("--vault", help="Obsidian vault folder; writes Trades/<SYM>-<date>.md there")
    p.set_defaults(fn=cmd_note)

    p = sub.add_parser("track", help="trailing-stop tracker")
    p.add_argument("action", choices=["open", "update", "show", "close"])
    p.add_argument("pick", nargs="?")
    p.add_argument("--fill", type=float)
    p.add_argument("--qty", type=int)
    p.add_argument("--stop", type=float, help="starting stop (default: the pick's stop)")
    p.add_argument("--price", type=float)
    p.add_argument("--high", type=float)
    p.add_argument("--low", type=float)
    p.add_argument("--on", help="date of this update, YYYY-MM-DD")
    p.add_argument("--state", default=str(STATE), help=f"positions file (default {STATE})")
    p.set_defaults(fn=cmd_track)
    return ap


def main(argv: Optional[List[str]] = None) -> int:
    for stream in (sys.stdout, sys.stderr):  # the rupee sign breaks a Windows console on its legacy code page
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError, OSError):
            pass
    a = build_parser().parse_args(argv)
    if a.cmd == "track":
        if a.action in ("open", "update", "close") and not a.pick:
            print("Name the pick: swing or intra (or the ticker).", file=sys.stderr)
            return 2
        if a.action == "open" and (a.fill is None or a.qty is None):
            print("open needs --fill and --qty", file=sys.stderr)
            return 2
        if a.action == "update" and a.price is None:
            print("update needs --price", file=sys.stderr)
            return 2
    try:
        return a.fn(a)
    except KeyError as e:
        print(e.args[0], file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
