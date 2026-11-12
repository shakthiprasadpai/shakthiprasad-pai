"""The ten chart patterns from IG's list, detected on daily bars. Port of src/core/desk/chartPatterns.ts.

Input is oldest -> newest highs, lows and closes. Every pattern is judged from confirmed swing pivots (a bar that is the
highest/lowest of the 2 bars either side), cleaned into an alternating zigzag.

  confirmed     shape is in place AND a close has broken through the trigger line within the last FRESH bars
  forming       shape is in place, trigger not yet hit
  none          not formed (or broke out so long ago that it is stale)
  insufficient  not enough bars to judge this pattern

Honest limits: rule-based detection is approximate. Two people can draw different lines on the same chart, so treat
"forming" as "worth a look at the chart", not as a signal. A pivot needs 2 bars after it, so a turn made in the last
2 bars is not seen yet.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, replace
from typing import Callable, Dict, List, Optional, Sequence

from .util import avg, inr, max_of, min_of

FAMILIES = (
    "Head and shoulders", "Double top", "Double bottom", "Rounding bottom", "Cup and handle",
    "Wedges", "Pennant or flags", "Ascending triangle", "Descending triangle", "Symmetrical triangle",
)
FRESH = 8  # a breakout older than this many bars is stale, not a live setup
MIN_BARS = {
    "Head and shoulders": 30, "Double top": 25, "Double bottom": 25, "Rounding bottom": 30, "Cup and handle": 40,
    "Wedges": 20, "Pennant or flags": 20, "Ascending triangle": 20, "Descending triangle": 20, "Symmetrical triangle": 20,
}


@dataclass
class Series:
    h: List[float]
    l: List[float]
    c: List[float]


@dataclass
class PatternResult:
    family: str
    name: str                      # the specific variant found (e.g. "Inverse head and shoulders"), else the family name
    bias: str                      # bullish | bearish | neutral
    state: str                     # confirmed | forming | none | insufficient
    detail: str
    level: Optional[float] = None  # the trigger / breakout line
    target: Optional[float] = None  # measured-move target
    stop: Optional[float] = None   # where the pattern is wrong
    from_: Optional[int] = None    # first / last bar index the pattern spans
    to: Optional[int] = None


def ago(k: int) -> str:
    return "on the last bar" if k <= 0 else "1 bar ago" if k == 1 else f"{k} bars ago"


# ---------- maths ----------
@dataclass
class Line:
    slope: float
    icpt: float

    def at(self, i: float) -> float:
        return self.icpt + self.slope * i


def lin_fit(xs: Sequence[float], ys: Sequence[float]) -> Line:
    n = len(xs)
    sx = sum(xs)
    sy = sum(ys)
    sxx = sum(x * x for x in xs)
    sxy = sum(x * y for x, y in zip(xs, ys))
    den = n * sxx - sx * sx
    slope = 0.0 if den == 0 else (n * sxy - sx * sy) / den
    return Line(slope, (sy - slope * sx) / n)


def quad_fit(ys: Sequence[float]):
    """y = a x^2 + b x + c over x in [0, 1]. Returns (a, b, c, r2) or None."""
    m = len(ys)
    s0 = s1 = s2 = s3 = s4 = t0 = t1 = t2 = 0.0
    for i, y in enumerate(ys):
        x = 0.0 if m == 1 else i / (m - 1)
        s0 += 1; s1 += x; s2 += x * x; s3 += x ** 3; s4 += x ** 4
        t0 += y; t1 += x * y; t2 += x * x * y
    A = [[s4, s3, s2, t2], [s3, s2, s1, t1], [s2, s1, s0, t0]]
    for c in range(3):
        p = c
        for r in range(c + 1, 3):
            if abs(A[r][c]) > abs(A[p][c]):
                p = r
        A[c], A[p] = A[p], A[c]
        if abs(A[c][c]) < 1e-12:
            return None
        for r in range(3):
            if r == c:
                continue
            f = A[r][c] / A[c][c]
            for k in range(c, 4):
                A[r][k] -= f * A[c][k]
    a, b, c0 = A[0][3] / A[0][0], A[1][3] / A[1][1], A[2][3] / A[2][2]
    my = t0 / m
    ss_t = ss_r = 0.0
    for i, y in enumerate(ys):
        x = 0.0 if m == 1 else i / (m - 1)
        f = a * x * x + b * x + c0
        ss_t += (y - my) ** 2
        ss_r += (y - f) ** 2
    return a, b, c0, (0.0 if ss_t == 0 else 1 - ss_r / ss_t)


# ---------- swing pivots ----------
@dataclass
class Pv:
    i: int
    p: float
    t: str  # "H" or "L"


def swings(s: Series, k: int, min_pct: float) -> List[Pv]:
    h, l, n = s.h, s.l, len(s.h)
    raw: List[Pv] = []
    for i in range(k, n - k):
        is_h = is_l = True
        for j in range(i - k, i + k + 1):
            if j == i:
                continue
            if h[j] > h[i]:
                is_h = False
            if l[j] < l[i]:
                is_l = False
        if is_h and is_l:
            continue  # a flat stretch: no information
        if is_h:
            raw.append(Pv(i, h[i], "H"))
        if is_l:
            raw.append(Pv(i, l[i], "L"))
    z: List[Pv] = []
    for p in raw:
        last = z[-1] if z else None
        if last is None:
            z.append(p)
            continue
        if last.t == p.t:
            if (p.t == "H" and p.p > last.p) or (p.t == "L" and p.p < last.p):
                z[-1] = p
            continue
        if abs(p.p - last.p) / last.p < min_pct:
            continue  # too small a swing to matter
        z.append(p)
    return z


# ---------- result helpers ----------
RANK = {"confirmed": 3, "forming": 2, "none": 1, "insufficient": 0}


def best(rs: List[PatternResult]) -> PatternResult:
    return sorted(rs, key=lambda r: -RANK[r.state])[0]  # stable: first of equal rank wins


def none(family: str, detail: str = "Not formed", bias: str = "neutral") -> PatternResult:
    return PatternResult(family, family, bias, "none", detail)


# ---------- double top / double bottom ----------
def doubles(s: Series, pv: List[Pv], d: int) -> List[PatternResult]:
    family = "Double top" if d > 0 else "Double bottom"
    bias = "bearish" if d > 0 else "bullish"
    E = "H" if d > 0 else "L"
    n = len(s.c)
    out: List[PatternResult] = []
    for a in range(len(pv) - 3, max(0, len(pv) - 7) - 1, -1):
        if a < 0:
            break
        p1, t, p2 = pv[a:a + 3]
        if p1.t != E:
            continue
        if abs(p1.p - p2.p) / max(p1.p, p2.p) > 0.03:
            continue  # the two peaks should match
        if p2.i - p1.i < 5:
            continue
        ext = max(p1.p, p2.p) if d > 0 else min(p1.p, p2.p)
        depth = abs(ext - t.p)
        if depth / max(ext, t.p) < 0.05:
            continue  # a real dip between the two
        frm = max(0, p1.i - 30)
        prior = p1.p / min_of(s.l[frm:p1.i + 1]) - 1 if d > 0 else 1 - p1.p / max_of(s.h[frm:p1.i + 1])
        if prior < 0.08:
            continue  # a double top needs an advance to top out; a double bottom needs a decline
        broken, j = False, -1
        for q in range(p2.i + 1, n):
            if d * (s.c[q] - ext) / ext > 0.01:
                broken = True  # pushed through the peaks: pattern failed
                break
            if d * (t.p - s.c[q]) > 0:
                j = q
                break
        if broken:
            continue
        word = "tops" if d > 0 else "bottoms"
        through = "below" if d > 0 else "above"
        target = t.p - d * depth
        base = dict(family=family, name=family, bias=bias, from_=p1.i, to=p2.i, level=t.p, target=target, stop=ext)
        if j >= 0:
            age = n - 1 - j
            if age <= FRESH:
                out.append(PatternResult(state="confirmed", detail=f"Two {word} at {inr(p1.p)} and {inr(p2.p)}. Closed {through} the {inr(t.p)} middle {'trough' if d > 0 else 'peak'} {ago(age)}. Measured target {inr(target)}.", **base))
            else:
                out.append(none(family, f"Broke {through} the middle {'trough' if d > 0 else 'peak'} {age} bars ago, older than {FRESH} bars (stale)", bias))
        elif n - 1 - p2.i <= 25:
            out.append(PatternResult(state="forming", detail=f"Two {word} at {inr(p1.p)} and {inr(p2.p)}. Not confirmed until a close {through} {inr(t.p)}. Target {inr(target)}.", **base))
    return out


# ---------- head and shoulders / inverse ----------
def head_shoulders(s: Series, pv: List[Pv], d: int) -> List[PatternResult]:
    family = "Head and shoulders"
    name = "Head and shoulders" if d > 0 else "Inverse head and shoulders"
    bias = "bearish" if d > 0 else "bullish"
    E = "H" if d > 0 else "L"
    n = len(s.c)
    out: List[PatternResult] = []
    beyond = lambda x, y: d * (x - y) / y
    for a in range(len(pv) - 5, max(0, len(pv) - 9) - 1, -1):
        if a < 0:
            break
        w = pv[a:a + 5]
        if w[0].t != E:
            continue
        ls, t1, hd, t2, rs = w
        if beyond(hd.p, ls.p) < 0.03 or beyond(hd.p, rs.p) < 0.03:
            continue  # head clearly beyond both shoulders
        if abs(ls.p - rs.p) / max(ls.p, rs.p) > 0.06:
            continue  # shoulders roughly level
        if abs(t1.p - t2.p) / min(t1.p, t2.p) > 0.08:
            continue  # neckline not too steep
        slope = (t2.p - t1.p) / (t2.i - t1.i)
        neck = lambda i, t1=t1, slope=slope: t1.p + slope * (i - t1.i)
        H = abs(hd.p - neck(hd.i))
        if H / hd.p < 0.05:
            continue
        frm = max(0, ls.i - 30)
        prior = ls.p / min_of(s.l[frm:ls.i + 1]) - 1 if d > 0 else 1 - ls.p / max_of(s.h[frm:ls.i + 1])
        if prior < 0.08:
            continue
        failed, j = False, -1
        for q in range(rs.i + 1, n):
            if beyond(s.c[q], hd.p) > 0:
                failed = True  # closed beyond the head
                break
            if d * (neck(q) - s.c[q]) > 0:
                j = q
                break
        if failed:
            continue
        through = "below" if d > 0 else "above"
        base = dict(family=family, name=name, bias=bias, from_=ls.i, to=rs.i, stop=rs.p)
        if j >= 0:
            age = n - 1 - j
            lv = neck(j)
            target = lv - d * H
            if age <= FRESH:
                out.append(PatternResult(state="confirmed", level=lv, target=target, detail=f"{name}: shoulders {inr(ls.p)} / {inr(rs.p)}, head {inr(hd.p)}. Closed {through} the {inr(lv)} neckline {ago(age)}. Measured target {inr(target)}.", **base))
            else:
                out.append(none(family, f"{name} broke its neckline {age} bars ago, older than {FRESH} bars (stale)", bias))
        elif n - 1 - rs.i <= 25:
            lv = neck(n - 1)
            target = lv - d * H
            out.append(PatternResult(state="forming", level=lv, target=target, detail=f"{name}: shoulders {inr(ls.p)} / {inr(rs.p)}, head {inr(hd.p)}. Neckline now {inr(lv)}; not confirmed until a close {through} it. Target {inr(target)}.", **base))
    return out


def time_near_bottom(closes: Sequence[float]) -> float:
    """A parabola also fits a V quite well, so R² alone cannot tell a bowl from a V. A real U spends well over half its time
    in the lower 40% of its depth (a parabola ~63%, a straight-sided V exactly 40%)."""
    lo, hi = min(closes), max(closes)
    band = lo + 0.4 * (hi - lo)
    return sum(1 for v in closes if v <= band) / len(closes)


# ---------- rounding bottom ----------
def rounding_bottom(s: Series) -> PatternResult:
    family = "Rounding bottom"
    n = len(s.c)
    out: List[PatternResult] = []
    for W in dict.fromkeys([30, 40, 50, 60, min(n, 90)]):
        if W > n or W < 30:
            continue
        off = n - W
        seg = s.c[off:]
        fit = quad_fit(seg)
        if not fit or fit[0] <= 0:
            continue
        a, b, _, r2 = fit
        xv = -b / (2 * a)
        if xv < 0.3 or xv > 0.7 or r2 < 0.7:
            continue  # a bowl, with its low near the middle
        rim, bottom = max(seg[:5]), min(seg)
        if off > 0 and max_of(s.c[max(0, off - 10):off]) > rim * 1.02:
            continue  # the window starts mid-slope, not at a rim
        depth = (rim - bottom) / rim
        if depth < 0.08 or time_near_bottom(seg) < 0.5:
            continue
        iv = off + round_half_up(xv * (W - 1))
        j = -1
        for q in range(iv, n):
            if s.c[q] >= rim * 0.99:
                j = q
                break
        lowest = min_of(s.l[off:])
        target = rim + (rim - bottom)
        base = dict(family=family, name=family, bias="bullish", from_=off, to=n - 1, level=rim, target=target, stop=lowest)
        note = f"Bowl over {W} bars: rim {inr(rim)}, low {inr(bottom)} ({depth * 100:.0f}% deep), fit R² {r2:.2f}."
        if j >= 0:
            age = n - 1 - j
            if age <= FRESH and s.c[n - 1] >= rim * 0.98:
                out.append(PatternResult(state="confirmed", detail=f"{note} Back at the left rim {ago(age)}. Target {inr(target)}.", **base))
            else:
                out.append(none(family, f"{note} Cleared the rim {age} bars ago (stale)", "bullish"))
        elif s.c[n - 1] >= rim * 0.9 and s.c[n - 1] > s.c[max(0, n - 4)]:
            out.append(PatternResult(state="forming", detail=f"{note} Climbing the right side; a close above {inr(rim)} completes it.", **base))
    return best(out) if out else none(family, "No rounded base", "bullish")


def round_half_up(x: float) -> int:
    """JavaScript Math.round: halves go up."""
    return math.floor(x + 0.5)


# ---------- cup and handle ----------
def cup_handle(s: Series) -> PatternResult:
    family = "Cup and handle"
    n = len(s.c)
    out: List[PatternResult] = []

    def is_high(i: int, k: int) -> bool:
        return all(s.h[j] <= s.h[i] for j in range(max(0, i - k), min(n - 1, i + k) + 1))

    for iL in range(max(0, n - 100), n - 18 + 1):
        if not is_high(iL, 3):
            continue
        rim_l = s.h[iL]
        for iR in range(iL + 18, n):
            if not is_high(iR, 2):
                continue
            rim_r = s.h[iR]
            if rim_r < rim_l * 0.88 or rim_r > rim_l * 1.03:
                continue
            iB = iL + 1
            for q in range(iL + 1, iR):
                if s.l[q] < s.l[iB]:
                    iB = q
            if iB - iL < 5 or iR - iB < 5:
                continue
            depth = (rim_l - s.l[iB]) / rim_l
            if depth < 0.12 or depth > 0.35:
                continue
            seg = s.c[iL:iR + 1]
            fit = quad_fit(seg)
            if not fit or fit[0] <= 0 or fit[3] < 0.6:
                continue  # a U, not a V
            xv = -fit[1] / (2 * fit[0])
            if xv < 0.25 or xv > 0.75:
                continue
            if max(seg) > rim_l * 1.03:
                continue
            if time_near_bottom(seg) < 0.5:
                continue  # a V, not a U
            hb = n - 1 - iR
            cup = f"Cup {inr(rim_l)} down to {inr(s.l[iB])} ({depth * 100:.0f}% deep) back to {inr(rim_r)} over {iR - iL} bars."
            target = rim_r + (rim_l - s.l[iB])
            base = dict(family=family, name=family, bias="bullish", from_=iL, to=n - 1, level=rim_r, target=target)
            if hb < 3:
                if rim_r * 0.9 <= s.c[n - 1] <= rim_r * 1.02:
                    out.append(PatternResult(state="forming", stop=s.l[iB], detail=f"{cup} The handle has not formed yet; watch for a 3-15% pullback that holds the upper half of the cup.", **base))
                continue
            if hb > 25:
                continue
            h_low = min(s.l[iR + 1:])
            h_depth = (rim_r - h_low) / rim_r
            if h_depth < 0.02 or h_depth > 0.15 or h_depth > 0.5 * depth:
                continue
            if h_low < s.l[iB] + 0.5 * (rim_l - s.l[iB]):
                continue  # handle must hold the upper half of the cup
            j = -1
            for q in range(iR + 1, n):
                if s.c[q] > rim_r:
                    j = q
                    break
            if j >= 0:
                age = n - 1 - j
                if age <= FRESH:
                    out.append(PatternResult(state="confirmed", stop=h_low, detail=f"{cup} {hb}-bar handle {h_depth * 100:.1f}% deep. Closed above {inr(rim_r)} {ago(age)}. Target {inr(target)}.", **base))
                else:
                    out.append(none(family, f"{cup} Broke out {age} bars ago (stale)", "bullish"))
            elif s.c[n - 1] >= h_low:
                out.append(PatternResult(state="forming", stop=h_low, detail=f"{cup} {hb}-bar handle {h_depth * 100:.1f}% deep. A close above {inr(rim_r)} triggers it. Target {inr(target)}.", **base))
    return best(out) if out else none(family, "No cup with a handle", "bullish")


# ---------- wedges and triangles: two trendlines through the swing pivots ----------
@dataclass
class Cand:
    hi: Line
    lo: Line
    i0: int
    i1: int
    w0: float
    w1: float
    nsH: float
    nsL: float
    hp: List[Pv]
    lp: List[Pv]


def candidates(s: Series, pv: List[Pv]) -> List[Cand]:
    n = len(s.c)
    out: List[Cand] = []
    for e in range(0, 3):
        base = pv[:len(pv) - e]
        for take in (8, 7, 6, 5):
            w = base[-take:] if take <= len(base) else []
            if len(w) < take:
                continue
            hp = [p for p in w if p.t == "H"]
            lp = [p for p in w if p.t == "L"]
            if len(hp) < 2 or len(lp) < 2 or len(hp) + len(lp) < 5:
                continue
            hi = lin_fit([p.i for p in hp], [p.p for p in hp])
            lo = lin_fit([p.i for p in lp], [p.p for p in lp])
            mean = avg([p.p for p in w])
            if any(abs(p.p - hi.at(p.i)) / mean > 0.01 for p in hp) or any(abs(p.p - lo.at(p.i)) / mean > 0.01 for p in lp):
                continue  # pivots must sit on the lines
            i0, i1 = w[0].i, w[-1].i
            if i1 - i0 < 12 or n - 1 - i1 > 20:
                continue
            w0, w1 = hi.at(i0) - lo.at(i0), hi.at(i1) - lo.at(i1)
            if not w0 > 0 or w0 / mean < 0.05 or w1 < 0.05 * w0 or w1 > 0.75 * w0:
                continue  # a real range (5%+ wide) that is narrowing
            # price has to stay inside its own lines, otherwise the lines describe nothing
            if any(s.c[q] > hi.at(q) * 1.007 or s.c[q] < lo.at(q) * 0.993 for q in range(i0, i1 + 1)):
                continue
            out.append(Cand(hi, lo, i0, i1, w0, w1, hi.slope / mean * 100, lo.slope / mean * 100, hp, lp))
    return out


def line_shape(s: Series, pv: List[Pv], family: str, name: str, bias: str, accept: Callable[[Cand], bool], brk: str, shape: str) -> PatternResult:
    n = len(s.c)
    out: List[PatternResult] = []
    for c in candidates(s, pv):
        if not accept(c):
            continue
        if c.hi.at(n - 1) <= c.lo.at(n - 1):
            continue  # the lines have already crossed: past the apex, the pattern is over
        up = dn = -1
        for q in range(c.i1 + 1, n):
            if up < 0 and s.c[q] > c.hi.at(q) * 1.005:
                up = q  # a close must clear the line by 0.5%, so a touch is not a breakout
            if dn < 0 and s.c[q] < c.lo.at(q) * 0.995:
                dn = q
        first = "up" if up >= 0 and (dn < 0 or up < dn) else "down" if dn >= 0 else ""
        base = dict(family=family, name=name, bias=bias, from_=c.i0, to=n - 1)
        if first:
            if brk != "either" and first != brk:
                continue  # broke the wrong way: the pattern failed
            j = up if first == "up" else dn
            age = n - 1 - j
            lv = c.hi.at(j) if first == "up" else c.lo.at(j)
            target = lv + c.w0 if first == "up" else lv - c.w0
            stop = c.lo.at(n - 1) if first == "up" else c.hi.at(n - 1)
            b = ("bullish" if first == "up" else "bearish") if brk == "either" else bias
            if age <= FRESH:
                out.append(PatternResult(**{**base, "bias": b}, state="confirmed", level=lv, target=target, stop=stop,
                                         detail=f"{shape} ({len(c.hp)} highs, {len(c.lp)} lows). Closed {'above' if first == 'up' else 'below'} the {inr(lv)} line {ago(age)}. Measured target {inr(target)}."))
            else:
                out.append(none(family, f"{shape} broke {'up' if first == 'up' else 'down'} {age} bars ago, older than {FRESH} bars (stale)", bias))
            continue
        if n - 1 - c.i1 > 12:
            continue
        u, lo, px = c.hi.at(n - 1), c.lo.at(n - 1), s.c[n - 1]
        if px > u * 1.01 or px < lo * 0.99:
            continue
        lv = lo if brk == "down" else u
        target = lo - c.w0 if brk == "down" else u + c.w0
        watch = (f"a close above {inr(u)} or below {inr(lo)}" if brk == "either" else f"a close above {inr(u)}" if brk == "up" else f"a close below {inr(lo)}")
        out.append(PatternResult(**base, state="forming", level=lv, target=None if brk == "either" else target, stop=u if brk == "down" else lo,
                                 detail=f"{shape} ({len(c.hp)} highs, {len(c.lp)} lows), squeezing from ₹{c.w0:.0f} wide to ₹{c.w1:.0f}. Waiting for {watch}."))
    return best(out) if out else none(family)


# ---------- flags and pennants ----------
def flags_for(s: Series, d: int) -> List[PatternResult]:
    family = "Pennant or flags"
    n = len(s.c)
    out: List[PatternResult] = []
    for m in range(0, 4):
        e = n - 1 - m
        for ip in range(e - 5, max(3, e - 20) - 1, -1):
            cons = lambda f, ip=ip, e=e: f[ip + 1:e + 1]
            top, bot = max_of(cons(s.h)), min_of(cons(s.l))
            frm = max(0, ip - 20)
            i0 = frm
            if d > 0:
                if top > s.h[ip] * 1.005:
                    continue
                for q in range(frm, ip - 3 + 1):
                    if s.l[q] < s.l[i0]:
                        i0 = q
                pole = s.h[ip] / s.l[i0] - 1
                height = s.h[ip] - s.l[i0]
                if max_of(s.h[i0:ip + 1]) > s.h[ip] * 1.005:
                    continue  # the pole must end at its own high, not mid-way
                if ip - i0 < 3 or pole < 0.12 or bot <= s.l[i0] or (s.h[ip] - bot) / height > 0.5:
                    continue
            else:
                if bot < s.l[ip] * 0.995:
                    continue
                for q in range(frm, ip - 3 + 1):
                    if s.h[q] > s.h[i0]:
                        i0 = q
                pole = 1 - s.l[ip] / s.h[i0]
                height = s.h[i0] - s.l[ip]
                if min_of(s.l[i0:ip + 1]) < s.l[ip] * 0.995:
                    continue
                if ip - i0 < 3 or pole < 0.12 or top >= s.h[i0] or (top - s.l[ip]) / height > 0.5:
                    continue
            # trendlines through the pause's own swing highs and lows (every bar would blur a tightening range)
            hx = [q for q in range(ip + 2, e) if s.h[q] >= s.h[q - 1] and s.h[q] >= s.h[q + 1]]
            lx = [q for q in range(ip + 2, e) if s.l[q] <= s.l[q - 1] and s.l[q] <= s.l[q + 1]]
            allx = list(range(ip + 1, e + 1))
            hi = lin_fit(hx, [s.h[q] for q in hx]) if len(hx) >= 2 else lin_fit(allx, cons(s.h))
            lo = lin_fit(lx, [s.l[q] for q in lx]) if len(lx) >= 2 else lin_fit(allx, cons(s.l))
            w0, w1 = hi.at(ip + 1) - lo.at(ip + 1), hi.at(e) - lo.at(e)
            if not w0 > 0 or not w1 > 0:
                continue
            mean = avg(cons(s.c))
            nsH, nsL = hi.slope / mean * 100, lo.slope / mean * 100
            converge = w1 < 0.7 * w0
            kind = ""
            if d > 0:
                kind = "flag" if nsH <= 0.03 and nsL <= 0.03 and not converge else "pennant" if nsH <= 0.03 and nsL >= -0.03 and converge else ""
            else:
                kind = "flag" if nsH >= -0.03 and nsL >= -0.03 and not converge else "pennant" if nsL >= -0.03 and nsH <= 0.03 and converge else ""
            if not kind:
                continue
            j, failed = -1, False
            for q in range(e + 1, n):
                if (s.c[q] < bot) if d > 0 else (s.c[q] > top):
                    failed = True
                    break
                if (s.c[q] > top) if d > 0 else (s.c[q] < bot):
                    j = q
                    break
            if failed:
                continue
            bias = "bullish" if d > 0 else "bearish"
            nm = f"{'Bull' if d > 0 else 'Bear'} {kind}"
            lv = top if d > 0 else bot
            target = lv + d * height
            stop = bot if d > 0 else top
            base = dict(family=family, name=nm, bias=bias, from_=i0, to=n - 1, level=lv, target=target, stop=stop)
            desc = f"{nm}: {pole * 100:.0f}% pole in {ip - i0} bars, then {e - ip} bars of {'channel' if kind == 'flag' else 'tightening'} range {inr(bot)} to {inr(top)}."
            if j >= 0:
                age = n - 1 - j
                if age <= FRESH:
                    out.append(PatternResult(state="confirmed", detail=f"{desc} Closed {'above' if d > 0 else 'below'} {inr(lv)} {ago(age)}. Measured target {inr(target)}.", **base))
                else:
                    out.append(none(family, f"{nm} broke {age} bars ago, older than {FRESH} bars (stale)", bias))
            elif m == 0:
                out.append(PatternResult(state="forming", detail=f"{desc} A close {'above' if d > 0 else 'below'} {inr(lv)} triggers it. Measured target {inr(target)}.", **base))
    return out


# ---------- the scan ----------
def scan_patterns(s: Series) -> List[PatternResult]:
    n = len(s.c) if s.c is not None else 0
    ok = n > 0 and len(s.h) == n and len(s.l) == n and all(isinstance(v, (int, float)) and math.isfinite(v) and v > 0 for v in [*s.h, *s.l, *s.c])

    def lack(family: str) -> PatternResult:
        return PatternResult(family, family, "neutral", "insufficient", f"Needs {MIN_BARS[family]} bars, has {n}" if ok else "No usable price history")

    if not ok:
        return [lack(f) for f in FAMILIES]
    big, fine = swings(s, 2, 0.03), swings(s, 2, 0.02)
    last = s.c[n - 1]
    gate = lambda family, f: lack(family) if n < MIN_BARS[family] else f()
    pick = lambda family, rs, empty, bias="neutral": best(rs) if rs else none(family, empty, bias)
    hp = lambda c: [p.p for p in c.hp]
    lpp = lambda c: [p.p for p in c.lp]
    results = [
        gate("Head and shoulders", lambda: pick("Head and shoulders", head_shoulders(s, big, 1) + head_shoulders(s, big, -1), "No head and shoulders or inverse")),
        gate("Double top", lambda: pick("Double top", doubles(s, big, 1), "No two matching tops", "bearish")),
        gate("Double bottom", lambda: pick("Double bottom", doubles(s, big, -1), "No two matching bottoms", "bullish")),
        gate("Rounding bottom", lambda: rounding_bottom(s)),
        gate("Cup and handle", lambda: cup_handle(s)),
        gate("Wedges", lambda: best([
            line_shape(s, fine, "Wedges", "Rising wedge", "bearish", lambda c: c.nsH > 0.08 and c.nsL > 0.08 and c.nsL > c.nsH, "down", "Rising wedge"),
            line_shape(s, fine, "Wedges", "Falling wedge", "bullish", lambda c: c.nsH < -0.08 and c.nsL < -0.08 and c.nsH < c.nsL, "up", "Falling wedge"),
        ])),
        gate("Pennant or flags", lambda: pick("Pennant or flags", flags_for(s, 1) + flags_for(s, -1), "No pole followed by a tight pause")),
        gate("Ascending triangle", lambda: line_shape(s, fine, "Ascending triangle", "Ascending triangle", "bullish",
                                                      lambda c: abs(c.nsH) <= 0.04 and c.nsL >= 0.08 and (max(hp(c)) - min(hp(c))) / max(hp(c)) <= 0.02, "up", "Ascending triangle")),
        gate("Descending triangle", lambda: line_shape(s, fine, "Descending triangle", "Descending triangle", "bearish",
                                                       lambda c: abs(c.nsL) <= 0.04 and c.nsH <= -0.08 and (max(lpp(c)) - min(lpp(c))) / max(lpp(c)) <= 0.02, "down", "Descending triangle")),
        gate("Symmetrical triangle", lambda: line_shape(s, fine, "Symmetrical triangle", "Symmetrical triangle", "neutral",
                                                        lambda c: c.nsH <= -0.05 and c.nsL >= 0.05 and 0.4 <= abs(c.nsH) / c.nsL <= 2.5, "either", "Symmetrical triangle")),
    ]

    # a confirmed pattern whose measured move has already been delivered is a finished move, not a fresh entry
    def finish(r: PatternResult) -> PatternResult:
        if r.state != "confirmed" or r.target is None or r.bias == "neutral":
            return r
        done = last >= r.target if r.bias == "bullish" else last <= r.target
        return replace(r, detail=f"{r.detail} Price {inr(last)} is already past that target, so this is an extended move, not a fresh entry.") if done else r

    return [finish(r) for r in results]


def series_from_trade(t: Dict) -> Series:
    """Picks keep older bars as closes only (`pre`) and the recent window as full OHLC. For the older bars the close stands
    in for the high and low, which is why a pivot there can be a touch off."""
    pre = list(t.get("pre") or [])
    return Series(h=pre + list(t["h"]), l=pre + list(t["l"]), c=pre + list(t["closes"]))


def summarize(rs: List[PatternResult]) -> Dict[str, List[PatternResult]]:
    return {k: [r for r in rs if r.state == k] for k in ("confirmed", "forming", "none", "insufficient")}
