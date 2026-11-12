# trade_desk (Python)

The trade desk from `src/core/desk` in Python, standard library only. It gives the same numbers as the app and the Chrome extension.

| Module | What it does |
|---|---|
| `plan.py` | levels, position size (capital x risk% / (entry - stop), capped by capital), trailing stop, plan text, Obsidian note, settings |
| `tracker.py` | trailing-stop tracker: the stop only moves up; a hit is judged on the prices you enter |
| `indicators.py` | EMA 20, Wilder RSI 14, stage 2 check, VCP contractions, pocket pivots, alerts, candlestick patterns |
| `patterns.py` | the ten IG chart patterns (head and shoulders, double top/bottom, rounding bottom, cup and handle, wedges, pennant/flags, three triangles) |
| `bhavcopy.py` | builds price history from NSE cash bhavcopy files (`BhavCopy_NSE_CM_*.csv` or `sec_bhavdata_full_*.csv`) |
| `picks.py`, `data/` | the two picks (LAURUSLABS swing, SAILIFE intraday) and the real NSE bars for TRENT, SUVEN, MOSCHIP, GOLDIAM, DIXON, PAYTM, ZEEL |

## Run it

From this folder (`python/`), Python 3.9 or newer:

```
python -m trade_desk picks                                   # both picks: levels, size at 1% risk, trailing stops, indicators, alerts, patterns
python -m trade_desk picks --capital 1000000 --risk 2
python -m trade_desk size --entry 2470 --stop 2320 --t1 2770 --t2 2920
python -m trade_desk patterns                                # the 10 patterns on every desk ticker
python -m trade_desk patterns --symbols TRENT SUVEN
python -m trade_desk patterns --bhavcopy bhav/*.csv --symbols RELIANCE INFY   # your own daily files, oldest or newest first
python -m trade_desk note LAURUSLABS --vault "C:\path\to\vault"              # writes Trades/LAURUSLABS-2026-11-09.md
python -m trade_desk track open swing --fill 2470 --qty 33    # trailing-stop tracker (swing 8%, intraday 3%)
python -m trade_desk track update swing --price 2600 --high 2610 --low 2580
python -m trade_desk track show
```

Positions are kept in `~/.trade_desk/positions.json` (change it with `--state`).

As a library:

```python
import trade_desk as td
t = td.get_pick("LAURUSLABS")
L = td.parse_levels(t["L"])
td.size_position(L, 500000, 1).qty                      # 33
td.trail_stop(t["closes"], t["close"], 8, "", L.stop).stop
for r in td.scan_patterns(td.series_from_trade(t)):
    print(r.family, r.state, r.detail)
```

## Tests

```
python -m unittest discover -s tests
```

The tests use the same numbers as `scripts/core-desk.test.ts` and `scripts/patterns.test.ts`, including the 400 random-walk guard (the false-positive counts match the TypeScript run exactly).

## Honest limits

- Pattern detection is rule-based and approximate. "Confirmed" means a close broke the trigger line in the last 8 bars; "forming" means the shape is in place without a trigger. Open the chart before trading one.
- About 60 daily bars is short for a cup and handle or a rounding bottom; feed more history with `--bhavcopy` for those.
- Targets are measured moves, not forecasts. About 14% of random series still show a wedge.
- 200 DMA slope and RS rating are not checked (no history in the picks file).
- The tracker has no live feed: it works on the prices you type in.
