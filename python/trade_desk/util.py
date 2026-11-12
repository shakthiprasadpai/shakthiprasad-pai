"""Small helpers shared by the desk modules."""
from __future__ import annotations

import math
import re
from typing import Iterable, Sequence

_NUM = re.compile(r"^\s*[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?")


def fmt_in(n: float, d: int = 0) -> str:
    """Number with Indian digit grouping (12,34,567.80), like toLocaleString("en-IN")."""
    neg = n < 0
    s = f"{abs(float(n)):.{d}f}"
    whole, _, frac = s.partition(".")
    if len(whole) > 3:
        head, tail = whole[:-3], whole[-3:]
        parts = []
        while len(head) > 2:
            parts.insert(0, head[-2:])
            head = head[:-2]
        if head:
            parts.insert(0, head)
        whole = ",".join(parts + [tail])
    return ("-" if neg else "") + whole + ("." + frac if frac else "")


def inr(v: float) -> str:
    return "₹" + fmt_in(v, 2)


def avg(a: Sequence[float]) -> float:
    return sum(a) / (len(a) or 1)


def median(a: Sequence[float]) -> float:
    """Same pick as the TypeScript desk: the element at index floor(n / 2) of the sorted values."""
    return sorted(a)[len(a) // 2]


def max_of(a: Iterable[float]) -> float:
    return max(a, default=-math.inf)


def min_of(a: Iterable[float]) -> float:
    return min(a, default=math.inf)


def to_float(v, default: float = math.nan) -> float:
    """parseFloat-like: '2470' -> 2470.0, '2470abc' -> 2470.0, junk -> nan."""
    m = _NUM.match(str(v))
    return float(m.group(0)) if m else default


def finite_pos(v) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) and v > 0
