"""Indicators and candlestick patterns. Port of src/utils/deskIndicators.ts.

A "series" t is a dict with closes, vols, and optionally o, h, l, pre, ma, close, hi52, lo52.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from .util import avg, fmt_in, median


def pocket_pivots(t: Dict[str, Any]) -> List[dict]:
    """An up day whose volume beats the biggest down-day volume of the prior 10 sessions, closing above its 10-day average."""
    c, v, out = t["closes"], t["vols"], []
    for i in range(11, len(c)):
        if not c[i] > c[i - 1]:
            continue
        max_down = 0.0
        for j in range(i - 10, i):
            if c[j] < c[j - 1]:
                max_down = max(max_down, v[j])
        if max_down > 0 and v[i] > max_down and c[i] > avg(c[i - 9:i + 1]):
            out.append({"i": i, "ago": len(c) - 1 - i, "close": c[i], "vol": v[i], "maxDown": max_down})
    return out


def vcp_scan(t: Dict[str, Any]) -> dict:
    """Volatility contraction from daily closes: swing highs and lows over a 5-session window, then the depth of each
    high-to-low pullback. Approximate: closes only."""
    c, n, k, pts = t["closes"], len(t["closes"]), 2, []
    for i in range(k, n - k):
        w = c[i - k:i + k + 1]
        if c[i] == max(w):
            pts.append({"i": i, "p": c[i], "type": "H"})
        elif c[i] == min(w):
            pts.append({"i": i, "p": c[i], "type": "L"})
    seq: List[dict] = []
    for p in pts:
        last = seq[-1] if seq else None
        if last is None or last["type"] != p["type"]:
            seq.append(p)
        elif (p["type"] == "H" and p["p"] > last["p"]) or (p["type"] == "L" and p["p"] < last["p"]):
            seq[-1] = p
    cons = [{"from": seq[j]["i"], "to": seq[j + 1]["i"], "depth": (seq[j]["p"] - seq[j + 1]["p"]) / seq[j]["p"] * 100}
            for j in range(len(seq) - 1) if seq[j]["type"] == "H" and seq[j + 1]["type"] == "L"]
    last4 = cons[-4:]
    tightening = len(last4) >= 2 and all(j == 0 or x["depth"] < last4[j - 1]["depth"] for j, x in enumerate(last4))
    med = median(t["vols"])
    return {"contractions": last4, "tightening": tightening, "recentVol": avg(t["vols"][-5:]) / med,
            "priorVol": avg(t["vols"][-10:-2]) / med, "swings": seq}


def _joined(t: Dict[str, Any]) -> List[float]:
    return list(t.get("pre") or []) + list(t["closes"])


def ema_series(t: Dict[str, Any], n: int = 20) -> List[Optional[float]]:
    """EMA over t.pre (earlier closes, for warm-up) then t.closes, seeded with the simple average of the first n closes.
    Returns values aligned to t.closes."""
    c = _joined(t)
    k = 2 / (n + 1)
    out: List[Optional[float]] = [None] * len(c)
    if len(c) >= n:
        e = avg(c[:n])
        out[n - 1] = e
        for i in range(n, len(c)):
            e = c[i] * k + e * (1 - k)
            out[i] = e
    return out[len(c) - len(t["closes"]):]


def rsi_series(t: Dict[str, Any], n: int = 14) -> List[Optional[float]]:
    """Wilder RSI, seeded with the average of the first n changes, aligned to t.closes."""
    c = _joined(t)
    out: List[Optional[float]] = [None] * len(c)
    if len(c) > n:
        g = l = 0.0
        for i in range(1, n + 1):
            d = c[i] - c[i - 1]
            if d >= 0:
                g += d
            else:
                l -= d
        g /= n
        l /= n
        val = lambda: 100.0 if l == 0 else 100 - 100 / (1 + g / l)
        out[n] = val()
        for i in range(n + 1, len(c)):
            d = c[i] - c[i - 1]
            g = (g * (n - 1) + max(d, 0)) / n
            l = (l * (n - 1) + max(-d, 0)) / n
            out[i] = val()
    return out[len(c) - len(t["closes"]):]


def stage_info(t: Dict[str, Any]) -> dict:
    m50, m150, m200 = t["ma"]
    cl = t["close"]
    return {
        "stage2": cl > m50 > m150 > m200,
        "ext50": (cl / m50 - 1) * 100, "fromHigh": (cl / t["hi52"] - 1) * 100, "aboveLow": (cl / t["lo52"] - 1) * 100,
        "rows": [("Close above 50 DMA", cl > m50), ("50 DMA above 150 DMA", m50 > m150), ("150 DMA above 200 DMA", m150 > m200),
                 ("Close above 200 DMA", cl > m200), ("30%+ above 52-week low", cl >= t["lo52"] * 1.3), ("Within 25% of 52-week high", cl >= t["hi52"] * 0.75)],
    }


def pattern_alerts(t: Dict[str, Any], L) -> List[tuple]:
    """Plain-language flags for one trade: (severity, text). L is a Levels or any object with entry and stop."""
    a: List[tuple] = []
    c, med, s = t["closes"], median(t["vols"]), stage_info(t)
    d_piv = (L.entry / t["close"] - 1) * 100
    if 0 < d_piv <= 3:
        a.append(("warn", f"Within {d_piv:.1f}% below the pivot at ₹{fmt_in(L.entry, 2)}"))
    elif d_piv > 3:
        a.append(("info", f"{d_piv:.1f}% below the pivot, no trigger yet"))
    else:
        a.append(("ok", f"Closed above the pivot by {-d_piv:.1f}%"))
    pp = [x for x in pocket_pivots(t) if x["ago"] <= 3]
    if pp:
        last = pp[-1]
        a.append(("ok", f"Pocket pivot {'today' if last['ago'] == 0 else str(last['ago']) + ' sessions ago'} on {last['vol']:.1f}M shares"))
    vx = t["vols"][-1] / med
    if vx >= 2:
        a.append(("ok", f"Volume {vx:.1f}x the 40-session median"))
    if s["ext50"] > 20:
        a.append(("warn", f"Extended: {s['ext50']:.0f}% above the 50 DMA"))
    risk = (L.entry - L.stop) / L.entry * 100
    if risk > 5:
        a.append(("warn", f"Wide stop: {risk:.1f}% below entry"))
    rs, ema = rsi_series(t), ema_series(t)
    r, e = rs[-1], ema[-1]
    if r is not None:
        if r >= 70:
            a.append(("warn", f"RSI(14) is {r:.0f}: overbought territory, strong stocks can stay there but a new entry is chasing"))
        elif r <= 30:
            a.append(("warn", f"RSI(14) is {r:.0f}: oversold, the trend may be broken"))
        else:
            a.append(("info", f"RSI(14) is {r:.0f}"))
    if e is not None:
        above = t["close"] > e
        a.append(("ok" if above else "warn", f"Close is {abs((t['close'] / e - 1) * 100):.1f}% {'above' if above else 'below'} the 20 EMA at ₹{fmt_in(e, 2)}"))
    gain2 = (c[-1] / c[-3] - 1) * 100
    if gain2 > 8:
        a.append(("warn", f"Up {gain2:.0f}% in two sessions, gap risk at the open"))
    return a


def candle_patterns(t: Dict[str, Any]) -> List[dict]:
    """Candlestick patterns from open, high, low, close. Textbook thresholds; a prompt to look at the chart, not a signal.
    Hammer vs hanging man (and inverted hammer vs shooting star) depend on the prior 5-session direction."""
    o, h, l, c = t.get("o"), t.get("h"), t.get("l"), t["closes"]
    out: List[dict] = []
    if not o or not h or not l:
        return out
    n = len(c)
    body = lambda i: abs(c[i] - o[i])
    rng = lambda i: h[i] - l[i]
    green = lambda i: c[i] > o[i]
    red = lambda i: c[i] < o[i]
    add = lambda i, name, bias, note: out.append({"i": i, "name": name, "bias": bias, "note": note})
    for i in range(5, n):
        r = rng(i)
        if not r > 0:
            continue
        b = body(i)
        lo = min(o[i], c[i]) - l[i]
        up = h[i] - max(o[i], c[i])
        down, up_trend = c[i - 1] < c[i - 5], c[i - 1] > c[i - 5]
        if b >= 0.9 * r:
            add(i, "Bullish marubozu" if green(i) else "Bearish marubozu", "bull" if green(i) else "bear", "Almost no wicks: one side controlled the whole session.")
        elif b <= 0.1 * r:
            add(i, "Doji", "neutral", "Open and close nearly equal: indecision.")
        elif b <= 0.35 * r and lo >= 2 * b and up <= 0.15 * r:
            if down:
                add(i, "Hammer", "bull", "Long lower wick after a decline: sellers were rejected.")
            elif up_trend:
                add(i, "Hanging man", "bear", "Hammer shape after a rise: a warning, needs a weak next day to count.")
        elif b <= 0.35 * r and up >= 2 * b and lo <= 0.15 * r:
            if up_trend:
                add(i, "Shooting star", "bear", "Long upper wick after a rise: buyers were rejected.")
            elif down:
                add(i, "Inverted hammer", "bull", "Upper wick after a decline: needs a strong next day to count.")
        pb = body(i - 1)
        if red(i - 1) and green(i) and c[i] >= o[i - 1] and o[i] <= c[i - 1] and b > pb:
            add(i, "Bullish engulfing", "bull", "Green body covers the prior red body.")
        if green(i - 1) and red(i) and o[i] >= c[i - 1] and c[i] <= o[i - 1] and b > pb:
            add(i, "Bearish engulfing", "bear", "Red body covers the prior green body.")
        if red(i - 1) and green(i) and o[i] <= c[i - 1] and c[i] > (o[i - 1] + c[i - 1]) / 2 and c[i] < o[i - 1]:
            add(i, "Piercing line", "bull", "Closes above the middle of the prior red body.")
        if green(i - 1) and red(i) and o[i] >= c[i - 1] and c[i] < (o[i - 1] + c[i - 1]) / 2 and c[i] > o[i - 1]:
            add(i, "Dark cloud cover", "bear", "Closes below the middle of the prior green body.")
        if h[i] < h[i - 1] and l[i] > l[i - 1]:
            add(i, "Inside bar", "neutral", "Range held inside the prior day: a pause before the next move.")
        if i >= 2:
            b2, r2, r1 = body(i - 2), rng(i - 2) or 1, rng(i - 1) or 1
            if red(i - 2) and b2 >= 0.5 * r2 and body(i - 1) <= 0.3 * r1 and green(i) and c[i] > (o[i - 2] + c[i - 2]) / 2:
                add(i, "Morning star", "bull", "Big red, small body, then a green that retakes the middle.")
            if green(i - 2) and b2 >= 0.5 * r2 and body(i - 1) <= 0.3 * r1 and red(i) and c[i] < (o[i - 2] + c[i - 2]) / 2:
                add(i, "Evening star", "bear", "Big green, small body, then a red that gives back the middle.")
            real = all(body(k) >= 0.5 * (rng(k) or 1) for k in (i, i - 1, i - 2))
            if real and green(i) and green(i - 1) and green(i - 2) and c[i] > c[i - 1] > c[i - 2] and o[i] > o[i - 1] > o[i - 2] and o[i] < c[i - 1] and o[i - 1] < c[i - 2]:
                add(i, "Three white soldiers", "bull", "Three rising green candles with real bodies, each opening inside the last body.")
            if real and red(i) and red(i - 1) and red(i - 2) and c[i] < c[i - 1] < c[i - 2] and o[i] < o[i - 1] < o[i - 2] and o[i] > c[i - 1] and o[i - 1] > c[i - 2]:
                add(i, "Three black crows", "bear", "Three falling red candles with real bodies, each opening inside the last body.")
    return out
