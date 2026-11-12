"""Plan maths: levels, position size, trailing stop, plan text and the Obsidian note.

Port of src/core/desk/plan.ts. Pure functions, no network, no files.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import date
from typing import Any, Mapping, Optional, Sequence

from .util import fmt_in, to_float


@dataclass
class Levels:
    entry: float
    stop: float
    t1: float
    t2: float


@dataclass
class DeskSettings:
    capital: str = "500000"
    riskPct: str = "1"
    trailPct: str = "8"
    trails: dict = field(default_factory=dict)


DEFAULT_SETTINGS = DeskSettings()
# Trail % each pick starts with: 8% for the swing, 3% for the intraday trade.
DEFAULT_TRAIL_BY_ID = {"swing": "8", "intra": "3"}


def default_trail_pct(pick_id: str) -> str:
    return DEFAULT_TRAIL_BY_ID.get(pick_id, DEFAULT_SETTINGS.trailPct)


def trail_for(settings: Optional[Mapping[str, Any]], pick_id: str) -> str:
    v = ((settings or {}).get("trails") or {}).get(pick_id)
    return str(v) if v is not None and math.isfinite(to_float(v)) else default_trail_pct(pick_id)


def parse_levels(raw: Mapping[str, Any]) -> Levels:
    """Turn text boxes ("2470") into numbers; anything unreadable becomes nan."""
    return Levels(*(to_float(raw.get(k)) for k in ("entry", "stop", "t1", "t2")))


def levels_ok(L: Levels) -> bool:
    """Stop below entry, T1 above entry, T2 at or above T1, all positive."""
    vals = (L.entry, L.stop, L.t1, L.t2)
    return all(math.isfinite(v) and v > 0 for v in vals) and L.entry > L.stop and L.t1 > L.entry and L.t2 >= L.t1


@dataclass
class Size:
    cap: float
    rp: float
    risk: float
    qty: int
    capped: bool
    value: float
    atRisk: float
    r1: float
    r2: float


def size_position(L: Levels, capital, risk_pct) -> Optional[Size]:
    """qty = capital x risk% / (entry - stop), never more than capital / entry."""
    if not levels_ok(L):
        return None
    cap = to_float(capital, 0.0)
    rp = to_float(risk_pct, 0.0)
    cap = 0.0 if math.isnan(cap) else cap
    rp = 0.0 if math.isnan(rp) else rp
    risk = L.entry - L.stop
    qty = max(0, math.floor(cap * rp / 100 / risk))
    maxq = math.floor(cap / L.entry)
    capped = qty > maxq
    if capped:
        qty = maxq
    return Size(cap, rp, risk, qty, capped, qty * L.entry, qty * risk, (L.t1 - L.entry) / risk, (L.t2 - L.entry) / risk)


@dataclass
class Trail:
    p: float
    hi: float
    stop: float
    fromClose: float
    binding: bool
    activates: float
    usingData: bool
    dataHigh: float


def trail_stop(closes: Sequence[float], close: float, pct, high_input=None, fixed_stop: Optional[float] = None) -> Optional[Trail]:
    """Trailing stop = highest price since entry x (1 - pct). With no high entered, the highest close in the data is used."""
    p = to_float(pct)
    if not (0 < p < 50):
        return None
    data_high = max(closes)
    typed = to_float("" if high_input is None else high_input)
    using_data = not (typed > 0)
    hi = data_high if using_data else typed
    stop = hi * (1 - p / 100)
    initial = fixed_stop if fixed_stop is not None and math.isfinite(fixed_stop) else math.nan
    return Trail(p, hi, stop, (1 - stop / close) * 100, math.isfinite(initial) and stop > initial,
                 initial / (1 - p / 100) if math.isfinite(initial) else math.nan, using_data, data_high)


def plan_text(t: Mapping[str, Any], L: Levels, size: Optional[Size], trail: Optional[Trail]) -> str:
    s = f"{t['sym']} ({t['mode']})\nEntry ₹{fmt_in(L.entry, 2)}  Stop ₹{fmt_in(L.stop, 2)}  T1 ₹{fmt_in(L.t1, 2)}  T2 ₹{fmt_in(L.t2, 2)}"
    if size:
        s += f"\nQty {size.qty} at ₹{fmt_in(size.cap)} capital and {_num(size.rp)}% risk (risk ₹{fmt_in(size.atRisk)})"
    if trail:
        s += f"\nTrailing stop {_num(trail.p)}% below ₹{fmt_in(trail.hi, 2)} = ₹{fmt_in(trail.stop, 2)}"
    return s


def _num(v: float) -> str:
    """Print 1.0 as 1 and 1.5 as 1.5, the way JavaScript prints numbers."""
    return str(int(v)) if float(v).is_integer() else str(v)


def obsidian_note(t: Mapping[str, Any], L: Levels, size: Optional[Size], today: Optional[str] = None,
                  rsi: Optional[float] = None, ema20: Optional[float] = None) -> str:
    """The note the Obsidian vault expects (type: minervini-sepa-setup)."""
    today = today or date.today().isoformat()
    passed = sum(1 for c in t["checks"] if c[2] == "pass")
    extra = (f"rsi_14: {rsi}\n" if rsi is not None else "") + (f"ema_20: {ema20}\n" if ema20 is not None else "")
    lines = f"""---
type: minervini-sepa-setup
ticker: {t['sym']}
name: "{t['name']}"
exchange: NSE
current_price: {_num(t['close'])}
pivot_price: {_num(L.entry)}
stop_loss: {_num(L.stop)}
target_1: {_num(L.t1)}
target_2: {_num(L.t2)}
trend_score: {passed}
{extra}created_date: "{today}"
tags:
  - trading/minervini
---

# {t['sym']}: {t['name']} (NSE)

- Pattern: {t['setup']}
- Entry ₹{fmt_in(L.entry, 2)}, stop ₹{fmt_in(L.stop, 2)}, T1 ₹{fmt_in(L.t1, 2)}, T2 ₹{fmt_in(L.t2, 2)}
"""
    if size:
        lines += f"- Size at ₹{fmt_in(size.cap)} and {_num(size.rp)}% risk: {size.qty} shares\n"
    if t.get("unchecked", 2) > 0:
        lines += "- Not checked: 200 DMA slope, RS rating\n"
    return lines


def merge_settings(saved: Optional[Mapping[str, Any]]) -> DeskSettings:
    """Junk falls back to the defaults, the same rule as the dashboard and the extension."""
    s = DeskSettings(trails={})
    saved = saved or {}
    for k in ("capital", "riskPct", "trailPct"):
        v = saved.get(k)
        if v is not None and math.isfinite(to_float(v)):
            setattr(s, k, str(v))
    tr = saved.get("trails")
    if isinstance(tr, Mapping):
        for pid, v in tr.items():
            if math.isfinite(to_float(v)):
                s.trails[pid] = str(v)
    return s


def previous_close(t: Mapping[str, Any]) -> float:
    """Change is measured against the previous bar, which matches the chart on every surface."""
    closes = t.get("closes")
    return closes[-2] if closes and len(closes) > 1 else t["prev"]


def day_change_pct(t: Mapping[str, Any]) -> float:
    return (t["close"] / previous_close(t) - 1) * 100
