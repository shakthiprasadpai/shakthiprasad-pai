"""Trailing-stop tracker for one open position. Port of src/core/desk/tracker.ts.

You enter your fill, then the latest price (and the day's high and low if you have them). The protective stop only ever
moves up: stop = max(stop so far, highest price x (1 - trail%)). There is no live feed, so a stop hit is judged on the
prices you enter, not on the market.
"""
from __future__ import annotations

import json
import math
from dataclasses import asdict, dataclass, field
from datetime import date
from pathlib import Path
from typing import Any, Dict, List, Optional

from .util import finite_pos


@dataclass
class TrackLog:
    on: str
    price: float
    high: float
    stop: float
    note: str


@dataclass
class Position:
    fill: float
    qty: int
    stop0: float                 # the fixed stop you started with
    high: float                  # highest price since entry
    stop: float                  # protective stop now
    last: float                  # last price entered
    openedOn: str
    updatedOn: str
    hit: bool = False            # set once the stop is touched; stays until the position is closed
    hitAt: Optional[float] = None
    hitOn: Optional[str] = None
    log: List[TrackLog] = field(default_factory=list)


@dataclass
class Bar:
    price: float
    high: Optional[float] = None
    low: Optional[float] = None
    on: Optional[str] = None


def _today() -> str:
    return date.today().isoformat()


def open_position(fill: float, qty: float, stop0: float, on: Optional[str] = None) -> Optional[Position]:
    """Start tracking. stop0 must be below the fill; qty is whole shares. None when the inputs cannot work."""
    q = math.floor(qty) if isinstance(qty, (int, float)) and math.isfinite(qty) else 0
    if not finite_pos(fill) or not finite_pos(stop0) or not q >= 1 or stop0 >= fill:
        return None
    on = on or _today()
    return Position(fill, q, stop0, fill, stop0, fill, on, on, False, None, None, [TrackLog(on, fill, fill, stop0, "Opened")])


def apply_bar(p: Position, bar: Bar, trail_pct: float) -> Position:
    """Apply one price update. The stop in force BEFORE the update decides whether it was hit (the low, or the price when no
    low is given); only then does the update's high raise the stop. A position that was hit stays hit and its stop does not move."""
    if p.hit or not finite_pos(bar.price) or not (0 < trail_pct < 50):
        return p
    on = bar.on or _today()
    low = min(bar.low, bar.price) if finite_pos(bar.low) else bar.price
    hi = max(bar.price, bar.high if finite_pos(bar.high) else 0)
    if low <= p.stop:
        log = (p.log + [TrackLog(on, bar.price, p.high, p.stop, f"Stop ₹{p.stop:.2f} hit")])[-30:]
        return Position(**{**asdict(p), "log": log, "last": bar.price, "updatedOn": on, "hit": True, "hitAt": p.stop, "hitOn": on})
    high = max(p.high, hi)
    stop = max(p.stop, high * (1 - trail_pct / 100))
    raised = stop > p.stop + 1e-9
    log = p.log
    if raised or high > p.high or not p.log or p.log[-1].on != on:
        log = (p.log + [TrackLog(on, bar.price, high, stop, f"Stop raised to ₹{stop:.2f}" if raised else "No change")])[-30:]
    return Position(**{**asdict(p), "log": log, "last": bar.price, "high": high, "stop": stop, "updatedOn": on})


@dataclass
class TrackerView:
    trailLevel: float
    stop: float
    binding: str                 # "trail" once the stop has moved above the starting stop, else "fixed"
    raisedBy: float
    distancePct: float           # how far the last price is above the stop
    pnl: float
    pnlPct: float
    openR: float                 # open profit in multiples of the initial risk (fill - stop0)
    lockedIfStopped: float       # rupees made (+) or lost (-) if the stop fills at the stop price
    status: str                  # "hit" | "danger" (within 1.5% of the stop) | "ok"


def tracker_view(p: Position, trail_pct: float) -> TrackerView:
    trail_level = p.high * (1 - trail_pct / 100)
    stop = p.hitAt if p.hit and p.hitAt else p.stop
    dist = (p.last / stop - 1) * 100
    return TrackerView(trail_level, stop, "trail" if stop > p.stop0 + 1e-9 else "fixed", stop - p.stop0, dist,
                       (p.last - p.fill) * p.qty, (p.last / p.fill - 1) * 100, (p.last - p.fill) / (p.fill - p.stop0),
                       (stop - p.fill) * p.qty, "hit" if p.hit else "danger" if dist <= 1.5 else "ok")


def sanitize_positions(raw: Any) -> Dict[str, Position]:
    """Saved positions are untrusted: keep only well-formed ones."""
    out: Dict[str, Position] = {}
    if not isinstance(raw, dict):
        return out
    for pid, v in raw.items():
        if not isinstance(v, dict):
            continue
        if not all(finite_pos(v.get(k)) for k in ("fill", "stop0", "high", "stop", "last")):
            continue
        qty = v.get("qty")
        if not (isinstance(qty, int) and not isinstance(qty, bool) and qty >= 1) or v["stop0"] >= v["fill"]:
            continue
        log = [TrackLog(str(l.get("on", "")), l["price"], l["high"] if finite_pos(l.get("high")) else l["price"], l["stop"], str(l.get("note", "")))
               for l in (v.get("log") or []) if isinstance(l, dict) and finite_pos(l.get("price")) and finite_pos(l.get("stop"))][-30:]
        out[pid] = Position(v["fill"], qty, v["stop0"], v["high"], v["stop"], v["last"], str(v.get("openedOn", "")), str(v.get("updatedOn", "")),
                            v.get("hit") is True, v["hitAt"] if finite_pos(v.get("hitAt")) else None,
                            v["hitOn"] if isinstance(v.get("hitOn"), str) else None, log)
    return out


# ---- a small JSON file keeps the open positions between runs ----
def load_positions(path: Path) -> Dict[str, Position]:
    try:
        return sanitize_positions(json.loads(Path(path).read_text(encoding="utf-8")))
    except (OSError, ValueError):
        return {}


def save_positions(path: Path, positions: Dict[str, Position]) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({k: asdict(v) for k, v in positions.items()}, indent=1), encoding="utf-8")
