"""The two desk picks and the real NSE bars, loaded from the JSON files next to this module.

Edit data/picks.json to change a level or a close in one place, the same way src/core/desk/picks.ts does for the app.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

DATA = Path(__file__).parent / "data"


def _load(name: str) -> Dict[str, Any]:
    return json.loads((DATA / name).read_text(encoding="utf-8"))


_picks = _load("picks.json")
PICKS_META: Dict[str, Any] = _picks["meta"]
SESSION_DATES: List[str] = _picks["session_dates"]
TRADES: List[Dict[str, Any]] = _picks["trades"]
REAL_BARS: Dict[str, Dict[str, Any]] = _load("real_bars.json")["bars"]


def get_pick(sym_or_id: str) -> Dict[str, Any]:
    key = sym_or_id.strip().lower()
    for t in TRADES:
        if key in (t["sym"].lower(), t["id"].lower()):
            return t
    raise KeyError(f"No pick called {sym_or_id!r}. Picks: " + ", ".join(f"{t['sym']} ({t['id']})" for t in TRADES))
