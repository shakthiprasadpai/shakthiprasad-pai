"""The ten chart patterns on synthetic charts, plus a random-walk guard. Mirrors scripts/patterns.test.ts."""
import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from trade_desk.patterns import FAMILIES, Series, scan_patterns


# ---- synthetic chart builders ----
def wob(i):
    return math.sin(i * 1.7) * 0.0006  # tiny deterministic noise so bars are not perfectly clean


def from_closes(c, band=0.004):
    return Series(c=list(c), h=[v * (1 + band + abs(wob(i))) for i, v in enumerate(c)], l=[v * (1 - band - abs(wob(i + 1))) for i, v in enumerate(c)])


def through(pts):
    """Straight lines through (index, price) control points."""
    out = []
    for (i0, p0), (i1, p1) in zip(pts, pts[1:]):
        out += [p0 + (p1 - p0) * (i - i0) / (i1 - i0) for i in range(i0, i1)]
    out.append(pts[-1][1])
    return out


def between(n, upper, lower, period=8, phase=0):
    """Closes zig-zagging between two lines: a triangle wave of the given period, starting at the upper line."""
    out = []
    for i in range(n):
        ph = (((i + phase) % period) + period) % period / period
        tri = ph * 2 if ph < 0.5 else (1 - ph) * 2
        out.append(lower(i) + (upper(i) - lower(i)) * (1 - tri))
    return out


def get(rs, family):
    return next(r for r in rs if r.family == family)


class Patterns(unittest.TestCase):
    def expect(self, s, family, state, name=None):
        rs = scan_patterns(s)
        r = get(rs, family)
        self.assertEqual(r.state, state, f"{family} expected {state}, got {r.state} ({r.detail})\n  all: " + " | ".join(f"{x.family}:{x.state}" for x in rs))
        if name:
            self.assertEqual(r.name, name)
        return r

    def test_structure_and_bad_input(self):
        rs = scan_patterns(from_closes(through([(0, 100), (60, 160)])))
        self.assertEqual([r.family for r in rs], list(FAMILIES))
        for r in scan_patterns(from_closes(through([(0, 100), (12, 110)]))):
            self.assertEqual(r.state, "insufficient")
        for r in scan_patterns(Series(c=[1, math.nan, 3], h=[1, 2, 3], l=[1, 2, 3])):
            self.assertEqual(r.state, "insufficient")
        for r in scan_patterns(Series(c=[], h=[], l=[])):
            self.assertEqual(r.state, "insufficient")

    def test_clean_trend_is_not_a_pattern(self):
        for pts in ([(0, 100), (70, 170)], [(0, 170), (70, 100)]):
            for r in scan_patterns(from_closes(through(pts))):
                self.assertEqual(r.state, "none", f"straight trend should show nothing, got {r.family}:{r.state}")

    def test_double_top(self):
        pts = [(0, 100), (15, 130), (25, 115), (35, 129), (41, 114), (43, 110)]
        r = self.expect(from_closes(through(pts)), "Double top", "confirmed")
        self.assertEqual(r.bias, "bearish")
        self.assertLess(abs(r.level - 115), 3)
        self.assertLess(r.target, r.level)
        self.expect(from_closes(through(pts[:4] + [(38, 125)])), "Double top", "forming")
        self.expect(from_closes(through([(0, 100), (15, 130), (25, 115), (35, 129), (42, 140)])), "Double top", "none")
        self.expect(from_closes(through([(0, 100), (15, 130), (25, 127), (35, 129), (41, 126), (43, 124)])), "Double top", "none")

    def test_double_bottom(self):
        pts = [(0, 130), (15, 100), (25, 115), (35, 101), (41, 116), (43, 120)]
        r = self.expect(from_closes(through(pts)), "Double bottom", "confirmed")
        self.assertEqual(r.bias, "bullish")
        self.assertGreater(r.target, r.level)
        self.expect(from_closes(through(pts[:4] + [(38, 105)])), "Double bottom", "forming")

    def test_head_and_shoulders_and_inverse(self):
        pts = [(0, 100), (10, 120), (16, 110), (24, 135), (32, 111), (38, 121), (42, 108), (43, 106)]
        r = self.expect(from_closes(through(pts)), "Head and shoulders", "confirmed", "Head and shoulders")
        self.assertEqual(r.bias, "bearish")
        self.assertLess(r.target, r.level)
        self.expect(from_closes(through(pts[:6] + [(41, 118)])), "Head and shoulders", "forming", "Head and shoulders")
        inv = [(i, 240 - p) for i, p in pts]
        ri = self.expect(from_closes(through(inv)), "Head and shoulders", "confirmed", "Inverse head and shoulders")
        self.assertEqual(ri.bias, "bullish")
        self.assertGreater(ri.target, ri.level)

    def test_rounding_bottom(self):
        bowl = lambda n: [90 + 120 * ((i / 59) - 0.5) ** 2 + math.sin(i * 1.3) * 0.4 for i in range(n)]
        self.expect(from_closes(bowl(57), 0.003), "Rounding bottom", "forming")
        self.expect(from_closes(bowl(62), 0.003), "Rounding bottom", "confirmed")
        self.expect(from_closes([210 - v for v in bowl(60)], 0.003), "Rounding bottom", "none")  # a rounded top

    def test_cup_and_handle(self):
        def cup_series(tail):
            lead = through([(0, 90), (19, 120)])
            cup = [90 + 30 * ((i - 20) / 20) ** 2 for i in range(41)]  # 120 -> 90 -> 120
            return from_closes(lead + cup + through(tail)[1:], 0.003)

        handle = [(0, 120), (6, 113), (10, 114), (12, 117)]  # 7% pullback that holds the upper half
        r = self.expect(cup_series(handle), "Cup and handle", "forming")
        self.assertEqual(r.bias, "bullish")
        self.expect(cup_series(handle + [(14, 123), (16, 126)]), "Cup and handle", "confirmed")
        self.expect(cup_series([(0, 120), (8, 100), (12, 102)]), "Cup and handle", "none")  # a handle that gives back the cup
        v = from_closes(through([(0, 90), (19, 120)]) + through([(0, 120), (20, 90), (40, 120)])[1:] + through([(0, 120), (6, 113), (10, 114)])[1:], 0.003)
        self.expect(v, "Cup and handle", "none")  # a V-shaped dip is not a cup

    def test_wedges(self):
        up, lo = (lambda i: 100 + 0.3 * i), (lambda i: 90 + 0.6 * i)
        rw = self.expect(from_closes(between(60, up, lo, 8)[:29], 0.002), "Wedges", "forming", "Rising wedge")
        self.assertEqual(rw.bias, "bearish")
        fu, fl = (lambda i: 150 - 0.6 * i), (lambda i: 140 - 0.3 * i)
        fw = self.expect(from_closes(between(60, fu, fl, 8)[:29], 0.002), "Wedges", "forming", "Falling wedge")
        self.assertEqual(fw.bias, "bullish")

    def test_triangles(self):
        asc = self.expect(from_closes(between(60, lambda i: 120, lambda i: 100 + 0.7 * i, 8)[:29], 0.002), "Ascending triangle", "forming")
        self.assertEqual(asc.bias, "bullish")
        desc = self.expect(from_closes(between(60, lambda i: 125 - 0.7 * i, lambda i: 100, 8, 4)[:29], 0.002), "Descending triangle", "forming")
        self.assertEqual(desc.bias, "bearish")
        self.expect(from_closes(between(60, lambda i: 120 - 0.3 * i, lambda i: 100 + 0.3 * i, 8)[:29], 0.002), "Symmetrical triangle", "forming")

    def test_flags_and_pennants(self):
        pole = through([(0, 100), (10, 130)])
        flag = between(13, lambda i: 130 - 0.2 * i, lambda i: 124 - 0.2 * i, 6)
        mk = lambda tail: from_closes([100 + (i % 2) for i in range(15)] + pole + tail, 0.003)
        f = self.expect(mk(flag[1:]), "Pennant or flags", "forming", "Bull flag")
        self.assertEqual(f.bias, "bullish")
        self.expect(mk(flag[1:] + [128, 133, 136]), "Pennant or flags", "confirmed", "Bull flag")
        pen = between(14, lambda i: 130 - 0.3 * i, lambda i: 118 + 0.3 * i, 6)
        self.expect(mk(pen[1:]), "Pennant or flags", "forming", "Bull pennant")
        drop = through([(0, 130), (10, 100)])
        rally = between(13, lambda i: 106 + 0.2 * i, lambda i: 100 + 0.2 * i, 6)
        bear = from_closes([130 - (i % 2) for i in range(15)] + drop + rally[1:], 0.003)
        self.expect(bear, "Pennant or flags", "forming", "Bear flag")

    def test_numbers_are_sane(self):
        shapes = [from_closes(through([(0, 100), (15, 130), (25, 115), (35, 129), (41, 114), (43, 110)])),
                  from_closes(through([(0, 130), (15, 100), (25, 115), (35, 101), (41, 116), (43, 120)])),
                  from_closes([90 + 120 * ((i / 59) - 0.5) ** 2 + math.sin(i * 1.3) * 0.4 for i in range(62)], 0.003)]
        for s in shapes:
            for r in scan_patterns(s):
                self.assertTrue(r.detail)
                if r.state in ("confirmed", "forming"):
                    self.assertTrue(math.isfinite(r.level) and math.isfinite(r.stop), f"{r.family}: level and stop are numbers")

    def test_random_walks_do_not_light_up(self):
        """Same generator and seed as the TypeScript guard, so the counts must match it exactly."""
        seed = [12345]

        def rnd():
            seed[0] = (seed[0] * 1664525 + 1013904223) & 0xFFFFFFFF
            return seed[0] / 4294967296

        counts, runs = {}, 400
        for _ in range(runs):
            p, c = 100.0, []
            for _i in range(63):
                p *= 1 + (rnd() - 0.5) * 0.04
                c.append(p)
            h = [v * (1 + rnd() * 0.01) for v in c]
            l = [v * (1 - rnd() * 0.01) for v in c]
            for r in scan_patterns(Series(c=c, h=h, l=l)):
                if r.state == "confirmed":
                    counts[r.family] = counts.get(r.family, 0) + 1
        self.assertEqual(counts, {"Wedges": 55, "Double top": 18, "Symmetrical triangle": 13, "Double bottom": 17, "Descending triangle": 5,
                                  "Ascending triangle": 4, "Head and shoulders": 3, "Pennant or flags": 5, "Rounding bottom": 1})
        self.assertLess(sum(counts.values()) / runs, 0.6)


if __name__ == "__main__":
    unittest.main()
