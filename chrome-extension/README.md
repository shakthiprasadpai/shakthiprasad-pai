# Growth Stock Alpha Desk: Chrome extension

Two surfaces, one data file:

- **Toolbar popup**: click the icon. Two picks (LAURUSLABS swing, SAILIFE intraday) with chart, levels, position size, trailing stop (8% swing, 3% intraday), RSI 14, 20 EMA, candle patterns, alerts, Copy plan and Copy Obsidian note.
- **Floating widget** on Chartink, TradingView, 5paisa, Screener and NSE: a small pill that expands to the same plan. Drag it by the header, collapse with –, hide with ×. Turn it off in the popup's Settings.

## Build and install (developer mode)
1. From the repo root run `npm run build:extension`. It bundles `chrome-extension/src` with the shared core in `src/core/desk` into `chrome-extension/dist`.
2. Open `chrome://extensions` and switch on **Developer mode**.
3. **Load unpacked** and choose `chrome-extension/dist`.
4. Pin the icon from the puzzle-piece menu.

## One core, three surfaces
The picks, levels, position sizing, trailing stop, Obsidian note and settings shape live in `src/core/desk`. The dashboard (Trade Desk tab and the home-screen desk panel), this extension and the Claude artifact all read it, and `npm run test:core` checks the maths.

## Notes
- Data is a snapshot (NSE close 9 Nov 2026), not live. No network requests, no login, no remote code.
- Capital, risk %, trail %, edited levels and your trade high are saved with `chrome.storage.local` and shared by the popup and the widget.
- The template check covers 6 of 8 rules; 200 DMA slope and RS rating are not checked.
- To add a site, add its URL pattern to `content_scripts.matches` in `src/manifest.json`, rebuild and reload the extension.
- To change a pick, edit `src/core/desk/picks.ts` and rebuild.
- Sizing and levels are arithmetic on your inputs, not advice.
