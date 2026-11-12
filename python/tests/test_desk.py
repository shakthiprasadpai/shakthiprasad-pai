"""Plan maths, indicators, tracker. Mirrors scripts/core-desk.test.ts so both versions are held to the same numbers."""
import json
import math
import sys
import unittest
from dataclasses import asdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from trade_desk import (Bar, apply_bar, day_change_pct, default_trail_pct, get_pick, levels_ok, merge_settings, obsidian_note,
                        open_position, parse_levels, plan_text, previous_close, size_position, trail_for, trail_stop, tracker_view)
from trade_desk.indicators import candle_patterns, ema_series, pattern_alerts, rsi_series
from trade_desk.picks import SESSION_DATES, TRADES
from trade_desk.tracker import sanitize_positions
from trade_desk.util import fmt_in, to_float

laurus, sail = get_pick("LAURUSLABS"), get_pick("SAILIFE")


class Plan(unittest.TestCase):
    def test_picks_data(self):
        self.assertEqual(len(TRADES), 2)
        for t in TRADES:
            self.assertEqual(len(t["closes"]), len(SESSION_DATES), f"{t['sym']}: one date per close")

    def test_sizing(self):
        L = parse_levels(laurus["L"])
        self.assertTrue(levels_ok(L))
        z = size_position(L, "500000", "1")
        self.assertEqual((z.qty, z.risk, z.atRisk, z.capped), (33, 150, 4950, False))
        self.assertEqual(size_position(L, "1000000", "2").qty, 133)
        tight = size_position(parse_levels({"entry": 100, "stop": 99, "t1": 102, "t2": 103}), "10000", "10")
        self.assertEqual((tight.qty, tight.capped), (100, True))  # capped at capital / entry
        self.assertIsNone(size_position(parse_levels({**laurus["L"], "stop": 2500}), "500000", "1"))
        self.assertIsNone(size_position(parse_levels({"entry": "abc", "stop": "1", "t1": "2", "t2": "3"}), "500000", "1"))

    def test_trailing_stop(self):
        L = parse_levels(laurus["L"])
        tr = trail_stop(laurus["closes"], laurus["close"], "8", "", L.stop)
        self.assertAlmostEqual(tr.stop, 2257.68, 2)
        self.assertTrue(tr.usingData)
        self.assertFalse(tr.binding)
        typed = trail_stop(laurus["closes"], laurus["close"], "8", "2600", L.stop)
        self.assertAlmostEqual(typed.stop, 2392, 2)
        self.assertTrue(typed.binding)
        self.assertIsNone(trail_stop(laurus["closes"], laurus["close"], "0", ""))
        self.assertIsNone(trail_stop(laurus["closes"], laurus["close"], "55", ""))
        self.assertAlmostEqual(trail_stop(sail["closes"], sail["close"], trail_for(None, "intra"), "").stop, 1781.7, 2)

    def test_note_and_plan_text(self):
        L = parse_levels(laurus["L"])
        z = size_position(L, "500000", "1")
        note = obsidian_note({**laurus, "unchecked": 2}, L, z, "2026-11-11")
        for line in ["type: minervini-sepa-setup", "ticker: LAURUSLABS", "pivot_price: 2470", "stop_loss: 2320", "target_1: 2770", "target_2: 2920",
                     "trend_score: 6", 'created_date: "2026-11-11"', "- Size at ₹5,00,000 and 1% risk: 33 shares", "Not checked: 200 DMA slope, RS rating"]:
            self.assertIn(line, note)
        tr = trail_stop(laurus["closes"], laurus["close"], "8", "", L.stop)
        self.assertIn("Trailing stop 8% below ₹2,454.00 = ₹2,257.68", plan_text(laurus, L, z, tr))

    def test_settings(self):
        self.assertEqual(asdict(merge_settings({"capital": "x", "riskPct": "2"})), {"capital": "500000", "riskPct": "2", "trailPct": "8", "trails": {}})
        self.assertEqual(asdict(merge_settings(None)), {"capital": "500000", "riskPct": "1", "trailPct": "8", "trails": {}})
        self.assertEqual((default_trail_pct("swing"), default_trail_pct("intra"), default_trail_pct("other")), ("8", "3", "8"))
        self.assertEqual(trail_for(None, "intra"), "3")
        self.assertEqual(trail_for({"trails": {"intra": "5"}}, "intra"), "5")
        self.assertEqual(trail_for({"trails": {"intra": "abc"}}, "intra"), "3")
        self.assertEqual(merge_settings({"trails": {"intra": "4", "swing": "x"}}).trails, {"intra": "4"})

    def test_number_helpers(self):
        self.assertEqual(fmt_in(500000), "5,00,000")
        self.assertEqual(fmt_in(1234567.8, 2), "12,34,567.80")
        self.assertEqual(fmt_in(999), "999")
        self.assertEqual(fmt_in(-4950), "-4,950")
        self.assertEqual(to_float("2470"), 2470.0)
        self.assertEqual(to_float("2470abc"), 2470.0)
        self.assertTrue(math.isnan(to_float("abc")))
        self.assertTrue(math.isnan(to_float("")))


class Indicators(unittest.TestCase):
    def test_values_match_the_desk(self):
        rsi = rsi_series({"closes": laurus["closes"], "pre": laurus["pre"]}, 14)
        ema = ema_series({"closes": laurus["closes"], "pre": laurus["pre"]}, 20)
        self.assertEqual(round(rsi[-1], 1), 75.0)
        self.assertEqual(round(ema[-1], 2), 2214.39)
        rs = rsi_series({"closes": sail["closes"], "pre": sail["pre"]}, 14)
        self.assertEqual(round(rs[-1], 1), 81.1)
        self.assertEqual(round(ema_series({"closes": sail["closes"], "pre": sail["pre"]}, 20)[-1], 2), 1561.22)

    def test_candles_and_alerts_count(self):
        for t, candles in ((laurus, 4), (sail, 1)):
            tt = {**t, "dates": SESSION_DATES}
            self.assertEqual(len([p for p in candle_patterns(tt) if p["i"] >= len(t["closes"]) - 10]), candles)
            self.assertEqual(len(pattern_alerts(tt, parse_levels(t["L"]))), 6)

    def test_day_change_uses_previous_bar(self):
        self.assertEqual(previous_close(laurus), 2340)
        self.assertEqual(previous_close(sail), 1785.1)
        self.assertEqual(round(day_change_pct(laurus), 2), 4.87)
        self.assertEqual(round(day_change_pct(sail), 2), 2.9)
        self.assertEqual(round(day_change_pct({"close": 110, "prev": 100}), 2), 10)  # no series: falls back to prev


class Tracker(unittest.TestCase):
    def test_ratchet_hit_and_junk(self):
        # SAILIFE intraday: fill 1900, 50 shares, fixed stop 1855, 3% trail
        p0 = open_position(1900, 50, 1855, "2026-11-12")
        self.assertEqual((p0.stop, p0.high), (1855, 1900))
        self.assertIsNone(open_position(1900, 50, 1900))   # stop must be below the fill
        self.assertIsNone(open_position(1900, 0, 1855))
        self.assertIsNone(open_position(-1, 5, 1))
        # price runs to 1980: trail = 1980 x 0.97 = 1920.60, above the fixed stop, so the stop is raised
        p1 = apply_bar(p0, Bar(1975, 1980, 1940), 3)
        self.assertEqual((round(p1.high, 2), round(p1.stop, 2), p1.hit), (1980, 1920.6, False))
        # a lower price does not lower the stop
        p2 = apply_bar(p1, Bar(1950), 3)
        self.assertEqual((round(p2.stop, 2), round(p2.high, 2)), (1920.6, 1980))
        # the new high only counts after the old stop is checked
        p3 = apply_bar(p2, Bar(2050, 2100, 1915), 3)
        self.assertTrue(p3.hit)
        self.assertEqual((round(p3.hitAt, 2), round(p3.high, 2)), (1920.6, 1980))
        self.assertIs(apply_bar(p3, Bar(3000, 3000), 3), p3)  # hit is sticky
        self.assertEqual(round(apply_bar(p1, Bar(1975), 8).stop, 2), 1920.6)  # widening the trail never lowers the stop
        v = tracker_view(p1, 3)
        self.assertEqual((round(v.stop, 2), v.binding, round(v.raisedBy, 2), v.pnl, round(v.openR, 2), round(v.lockedIfStopped, 2), v.status),
                         (1920.6, "trail", 65.6, 3750, 1.67, 1030, "ok"))
        self.assertEqual(tracker_view(apply_bar(p0, Bar(1860), 3), 3).status, "danger")
        hit = tracker_view(apply_bar(p0, Bar(1850), 3), 3)
        self.assertEqual((hit.status, round(hit.lockedIfStopped)), ("hit", -2250))
        self.assertIs(apply_bar(p0, Bar(math.nan), 3), p0)
        self.assertIs(apply_bar(p0, Bar(1900), 0), p0)
        self.assertIs(apply_bar(p0, Bar(1900), 60), p0)
        self.assertEqual(sanitize_positions("x"), {})
        self.assertEqual(sanitize_positions({"a": 5, "b": {"fill": "x"}, "c": {"fill": 100, "stop0": 120, "qty": 1, "high": 1, "stop": 1, "last": 1}}), {})
        round_trip = sanitize_positions(json.loads(json.dumps({"intra": asdict(p1)})))
        self.assertEqual(round_trip["intra"].stop, p1.stop)


if __name__ == "__main__":
    unittest.main()
