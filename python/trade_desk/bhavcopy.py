"""Build price history from NSE bhavcopy files, so the pattern scan can run on your own data.

Reads either format NSE publishes for the cash market:
  * UDiFF:      BhavCopy_NSE_CM_0_0_0_YYYYMMDD_F_0000.csv   (TckrSymb, SctySrs, OpnPric, HghPric, LwPric, ClsPric, TtlTradgVol, TradDt)
  * Full bhav:  sec_bhavdata_full_DDMMYYYY.csv              (SYMBOL, SERIES, DATE1, OPEN_PRICE, HIGH_PRICE, LOW_PRICE, CLOSE_PRICE, TTL_TRD_QNTY)

Only the EQ series is kept. Pass many daily files, oldest or newest first; bars are sorted by date.
"""
from __future__ import annotations

import csv
from datetime import datetime
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence

from .patterns import Series


def _date(s: str) -> str:
    s = s.strip()
    for f in ("%Y-%m-%d", "%d-%b-%Y", "%d-%B-%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(s, f).date().isoformat()
        except ValueError:
            pass
    raise ValueError(f"unreadable date {s!r}")


def _num(v: str) -> Optional[float]:
    try:
        x = float(str(v).strip().replace(",", ""))
    except ValueError:
        return None
    return x if x > 0 else None


def read_file(path: Path, symbols: Optional[Sequence[str]] = None) -> Dict[str, dict]:
    """One daily file -> {symbol: {date, o, h, l, c, v}} for EQ rows (optionally only some symbols)."""
    want = {s.upper() for s in symbols} if symbols else None
    out: Dict[str, dict] = {}
    with open(path, newline="", encoding="utf-8-sig") as fh:
        rd = csv.DictReader(fh)
        rd.fieldnames = [h.strip() for h in (rd.fieldnames or [])]
        cols = set(rd.fieldnames)
        if {"TckrSymb", "ClsPric"} <= cols:
            sym, ser, dt, o, h, l, c, v = "TckrSymb", "SctySrs", "TradDt", "OpnPric", "HghPric", "LwPric", "ClsPric", "TtlTradgVol"
        elif {"SYMBOL", "CLOSE_PRICE"} <= cols:
            sym, ser, dt, o, h, l, c, v = "SYMBOL", "SERIES", "DATE1", "OPEN_PRICE", "HIGH_PRICE", "LOW_PRICE", "CLOSE_PRICE", "TTL_TRD_QNTY"
        else:
            raise ValueError(f"{Path(path).name}: not a cash-market bhavcopy (columns: {', '.join(rd.fieldnames[:8])} ...)")
        for row in rd:
            row = {k.strip(): (x or "").strip() for k, x in row.items() if k}
            if row.get(ser) != "EQ":
                continue
            s = row[sym].upper()
            if want and s not in want:
                continue
            vals = [_num(row[k]) for k in (o, h, l, c)]
            if None in vals:
                continue
            out[s] = {"date": _date(row[dt]), "o": vals[0], "h": vals[1], "l": vals[2], "c": vals[3], "v": _num(row.get(v, "")) or 0.0}
    return out


def build_history(paths: Iterable[Path], symbols: Optional[Sequence[str]] = None) -> Dict[str, List[dict]]:
    """Many daily files -> {symbol: [bars oldest..newest]}. A date that appears twice keeps the later file."""
    by_sym: Dict[str, Dict[str, dict]] = {}
    for p in paths:
        for s, bar in read_file(Path(p), symbols).items():
            by_sym.setdefault(s, {})[bar["date"]] = bar
    return {s: [d[k] for k in sorted(d)] for s, d in by_sym.items()}


def to_series(bars: List[dict]) -> Series:
    return Series(h=[b["h"] for b in bars], l=[b["l"] for b in bars], c=[b["c"] for b in bars])
