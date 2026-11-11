# Growth Stock Alpha Desk: Chrome extension

Two surfaces, one data file:

- **Toolbar popup**: click the icon. Two picks (LAURUSLABS swing, SAILIFE intraday) with chart, levels, position size, 8% trailing stop, RSI 14, 20 EMA, candle patterns, alerts, Copy plan and Copy Obsidian note.
- **Floating widget** on Chartink, TradingView, 5paisa, Screener and NSE: a small pill that expands to the same plan. Drag it by the header, collapse with –, hide with ×. Turn it off in the popup's Settings.

## Install (developer mode)
1. Open `chrome://extensions` and switch on **Developer mode**.
2. **Load unpacked** and choose this `chrome-extension` folder.
3. Pin the icon from the puzzle-piece menu.

## Notes
- Data is a snapshot (`data.js`, NSE close 9 Nov 2026), not live. No network requests, no login, no remote code.
- Capital, risk %, trail %, edited levels and your trade high are saved with `chrome.storage.local` and shared by the popup and the widget.
- The template check covers 6 of 8 rules; 200 DMA slope and RS rating are not checked.
- To add a site, add its URL pattern to `content_scripts.matches` in `manifest.json` and reload the extension.
- To refresh the picks, regenerate `data.js` and reload the extension.
- Sizing and levels are arithmetic on your inputs, not advice.
