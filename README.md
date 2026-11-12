based on mark minervini template
Remix  SEPA Trend & VCP Screener
SEPA Trend Template & VCP setup analyzer with precise pivot entries, tight volume checks, and exit price levels.

## Trade desk on the command line (TypeScript)

Same commands as the Python package in `python/`, run from the repo root (`npm install` once):

```bash
npm run desk -- picks                         # both picks: levels, size, trailing stop, indicators, alerts, patterns
npm run desk -- size --entry 2470 --stop 2320 --t1 2770 --t2 2920 --capital 500000 --risk 1
npm run desk -- patterns --symbols SAILIFE TRENT
npm run desk -- patterns --bhavcopy "C:\data\BhavCopy_NSE_CM_*.csv" --symbols TRENT   # your own NSE files, * works on Windows too
npm run desk -- note LAURUSLABS --vault "C:\path\to\vault"
npm run desk -- track open swing --fill 2470 --qty 33
npm run desk -- track update swing --price 2600 --high 2610
npm run desk -- track show
npm run desk -- dash --watch                  # one-screen dashboard, redraws every 2 s (Ctrl+C to quit)
```

Both bhavcopy formats are read (`BhavCopy_NSE_CM_*` and `sec_bhavdata_full_*`), EQ series only. Open positions are kept in
`~/.trade_desk/positions.json`, the same file the Python version uses. `dash` shows both picks with a sparkline and a stop-to-target ladder, your open positions and the live pattern hits; with `--watch` it re-reads the positions file, so a `track update` in another window appears within 2 seconds (`--no-color` and `--width N` are available). The code is `scripts/desk-cli.ts`, `scripts/desk-dash.ts` and `src/core/desk/bhavcopy.ts`;
`npm run test:core` covers it.
