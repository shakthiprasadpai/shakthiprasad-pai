import { useState, useMemo, useEffect, useRef } from "react";
import DeskTools, { TOOLS_CSS, candlePatterns, emaSeries, rsiSeries } from "./DeskTools";
import { stockToDeskTrade, stockLevels } from "../utils/deskAdapter";
import type { MinerviniTradeSetup } from "../types";
import { TRADES, parseLevels, levelsOk, sizePosition, trailStop, dayChangePct, previousClose, trailFor, openPosition, applyBar, trackerView, type Position } from "../core/desk";
import { useSharedPositions } from "../hooks/useSharedPositions";
import { loadDeskSettings, saveDeskSettings } from "../core/desk/settingsStore";



const fmt = (n, d = 0) => Number(n).toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

// ---- Hermes co-pilot ------------------------------------------------------
// Hermes runs on Gemini through the app's own server (POST /api/desk-chat), so the key stays on the backend.
// askModel(messages, onText) must resolve to the reply text. messages = [{ role: "user" | "assistant", content }].
// Pass your own <App askModel={...} /> to use a different backend.
export const makeProxyAskModel = (url: string, headers: Record<string, string> = {}) => async (messages: any[], onText?: (t: string) => void) => {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify({ messages }) });
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { code: res.status === 429 ? "rate_limited" : "http_error" });
  const { text } = await res.json();
  onText?.(text);
  return text;
};
const defaultAskModel = makeProxyAskModel("/api/desk-chat");

const SYSTEM =
  "You are Hermes, the trading co-pilot on a Minervini SEPA trade desk for Indian equities. " +
  "Answer only from the DATA below plus general knowledge of Minervini's method. If a figure is not in DATA, say it was not checked. " +
  "Plain text, no markdown, at most 120 words, lead with the answer. Describe plan mechanics and risks; do not give personalised investment advice. DATA: ";
const GREETING = "Ask about the selected setup: entry, stop, position size, risk, or how the two ideas compare. Answers come from the data on this page, and I will say when something was not checked.";
const QUICK = [
  ["Is the stop too wide?", "Is the stop too wide for the selected setup, and what would a tighter one look like?"],
  ["Size this trade", "Size the selected trade for my capital and risk setting, and say what limits the position."],
  ["Compare the two", "Compare the two setups on extension, risk per share and liquidity."],
  ["What invalidates it?", "What would invalidate the selected entry before I take it?"],
];
const hhmm = () => new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

const SCAN_CLAUSE = "{cash} ( latest close > latest sma( close , 150 ) and latest close > latest sma( close , 200 ) and latest sma( close , 150 ) > latest sma( close , 200 ) and latest sma( close , 200 ) > 1 month ago sma( close , 200 ) and latest sma( close , 50 ) > latest sma( close , 150 ) and latest sma( close , 50 ) > latest sma( close , 200 ) and latest close > latest sma( close , 50 ) and latest close >= 1.3 * latest min( 250 , latest low ) and latest close >= 0.75 * latest max( 250 , latest high ) )";
const parseScan = (txt) => {
  const toks = (txt || "").toUpperCase().split(/[\s,;|]+/).filter((x) => /^[A-Z0-9&-]{2,20}$/.test(x));
  return toks.length ? new Set(toks) : null;
};

function Chart({ t, L, scan, trail, mode, showEma, showRsi }: any) {
  const candle = mode === "candle" && !!t.o;
  const pats = candle ? candlePatterns(t).filter((p) => p.i >= t.closes.length - 15) : [];
  const ss = scan ? (scan.has(t.sym) ? "yes" : "no") : "none";
  const W = 640, ml = 8, mr = 84, top = 10, ph = 200, vt = 228, vh = 56, n = t.closes.length;
    const ema: (number | null)[] | null = showEma ? emaSeries(t) : null, rsi: (number | null)[] | null = showRsi ? rsiSeries(t) : null;
  const rt = 316, rh = 64, H = showRsi ? 396 : 300, ry = (v) => rt + ((100 - v) / 100) * rh;
  const lastEma = ema ? ema[n - 1] : null, lastRsi = rsi ? rsi[n - 1] : null;
  const lo = Math.min(...(candle ? t.l : t.closes), L.stop, trail ?? Infinity, ...(ema ? (ema.filter((v) => v != null) as number[]) : [])) * 0.995, hi = Math.max(...(candle ? t.h : t.closes), L.t2) * 1.005;
  const x = (i) => ml + (i * (W - ml - mr)) / (n - 1);
  const y = (v) => top + ((hi - v) / (hi - lo)) * ph;
  const med = median(t.vols), vmax = Math.max(...t.vols), bw = ((W - ml - mr) / n) * 0.62;
  const lv = [["entry", L.entry, "Entry"], ["stop", L.stop, "Stop"], ["tgt", L.t1, "T1"], ["tgt", L.t2, "T2"], ...(trail ? [["trail", trail, "Trail"]] : [])];
  const lab = [...lv, ...(lastEma != null ? [["ema", lastEma, "EMA20"]] : [])].map(([k, v, name]: any) => ({ k, y: y(v), txt: `${name} ${fmt(v)}` })).sort((p, q) => p.y - q.y);
  for (let i = 1; i < lab.length; i++) if (lab[i].y - lab[i - 1].y < 13) lab[i].y = lab[i - 1].y + 13;
  return (
    <svg className="chart" viewBox={`0 0 640 ${H}`} role="img" aria-label={`Last 40 sessions of ${t.sym}`}>
      {[0, 0.25, 0.5, 0.75, 1].map((f) => <line key={f} x1={ml} x2={W - mr} y1={y(lo + (hi - lo) * f)} y2={y(lo + (hi - lo) * f)} stroke="#1a1a22" />)}
      {t.vols.map((v, i) => {
        const h = (v / vmax) * vh;
        return <rect key={i} className={v > 2 * med ? "vb hot" : "vb"} x={x(i) - bw / 2} y={vt + vh - h} width={bw} height={h} />;
      })}
      <text x={ml + 62} y={vt - 4}>VOLUME (AMBER = OVER 2X MEDIAN)</text>
      {lv.map(([k, v], i) => <line key={i} className={`lv ${k}`} x1={ml} x2={W - mr} y1={y(v)} y2={y(v)} />)}
      {candle ? (
        <g>
          {t.closes.map((c, i) => {
            const up = c >= t.o[i], col = up ? "#3ddc97" : "#ff3347", cw = Math.max(2, ((W - ml - mr) / n) * 0.62);
            return (
              <g key={i}>
                <line x1={x(i)} x2={x(i)} y1={y(t.h[i])} y2={y(t.l[i])} stroke={col} strokeWidth="1" />
                <rect x={x(i) - cw / 2} y={y(Math.max(c, t.o[i]))} width={cw} height={Math.max(1, Math.abs(y(c) - y(t.o[i])))} fill={col} />
              </g>);
          })}
          {pats.map((p, k) => {
            const bull = p.bias === "bull", bear = p.bias === "bear";
            const py = bear ? y(t.h[p.i]) - 7 : y(t.l[p.i]) + 12;
            return <text key={k} className="cp-mark" x={x(p.i)} y={py} textAnchor="middle" style={{ fill: bull ? "#3ddc97" : bear ? "#ff3347" : "#f5a524" }}>{bear ? "▼" : bull ? "▲" : "◆"}</text>;
          })}
        </g>
      ) : (
        <>
          <polyline className="ln-price" points={t.closes.map((c, i) => `${x(i)},${y(c)}`).join(" ")} />
          <circle className="cdot" cx={x(n - 1)} cy={y(t.close)} r="3.5" />
        </>
      )}
      {ema && <polyline className="ln-ema" points={ema.map((v, i) => (v == null ? null : `${x(i)},${y(v)}`)).filter(Boolean).join(" ")} />}
      {rsi && (
        <g>
          <rect x={ml} y={rt} width={W - ml - mr} height={rh} fill="none" stroke="#1a1a22" />
          <rect x={ml} y={ry(70)} width={W - ml - mr} height={ry(30) - ry(70)} fill="#ffffff08" />
          {[70, 50, 30].map((v) => <line key={v} x1={ml} x2={W - mr} y1={ry(v)} y2={ry(v)} stroke="#2a2a36" strokeDasharray={v === 50 ? "1 4" : "3 3"} />)}
          <polyline className="ln-rsi" points={rsi.map((v, i) => (v == null ? null : `${x(i)},${ry(v)}`)).filter(Boolean).join(" ")} />
          <text x={ml} y={rt - 5}>RSI (14){lastRsi != null && <tspan style={{ fill: lastRsi >= 70 ? "#f5a524" : lastRsi <= 30 ? "#ff3347" : "#7dd3fc" }}>  {lastRsi.toFixed(0)}{lastRsi >= 70 ? " overbought" : lastRsi <= 30 ? " oversold" : ""}</tspan>}</text>
          <text x={W - mr + 6} y={ry(70) + 3.5}>70</text><text x={W - mr + 6} y={ry(30) + 3.5}>30</text>
        </g>
      )}
      {ss === "yes" && <circle className="scan-ring" cx={x(n - 1)} cy={y(t.close)} r="9" />}
      {ss !== "none" && <text className="scan-tag" x={ml + 4} y={top + 26} style={{ fill: ss === "yes" ? "#3ddc97" : "#ff3347" }}>{ss === "yes" ? "CHARTINK SCAN: IN" : "CHARTINK SCAN: NOT IN"}</text>}
      {lab.map((l, i) => <text key={i} className={`lt ${l.k}`} x={W - mr + 6} y={l.y + 3.5}>{l.txt}</text>)}
      <text x={ml} y={top + ph + 14}>10 SEP</text>
      <text x={W - mr} y={top + ph + 14} textAnchor="end">9 NOV 2026</text>
    </svg>
  );
}

export default function App({ askModel = defaultAskModel, checkReady, onNavigate, onOpenStageScan, stocks, selectedStock, onSelectStock, inDashboard }: { askModel?: (messages: any[], onText?: (t: string) => void) => Promise<string>; checkReady?: () => Promise<boolean>; onNavigate?: (tab: string) => void; onOpenStageScan?: () => void; stocks?: MinerviniTradeSetup[]; selectedStock?: MinerviniTradeSetup | null; onSelectStock?: (s: MinerviniTradeSetup) => void; inDashboard?: boolean }) {
  const [sel, setSel] = useState(0);
  const [lv, setLv] = useState(() => Object.fromEntries(TRADES.map((t) => [t.id, { ...t.L }])));
  // One desk: the two picks first, then the NSE/BSE stocks on the dashboard screen (the selected one first), all in the same tools.
  const extra = useMemo(() => {
    const list = (stocks || []).filter((x) => x && (x.exchange === "NSE" || x.exchange === "BSE"));
    if (selectedStock) list.sort((a, b) => (a.ticker === selectedStock.ticker ? -1 : b.ticker === selectedStock.ticker ? 1 : 0));
    const trades: any[] = [], source: MinerviniTradeSetup[] = [], levels: Record<string, any> = {};
    list.forEach((x) => { const t = stockToDeskTrade(x); if (t && !TRADES.some((p) => p.sym === t.sym)) { trades.push(t); source.push(x); levels[t.id] = stockLevels(x); } });
    return { trades, source, levels };
  }, [stocks, selectedStock]);
  const deskTrades: any[] = useMemo(() => [...TRADES, ...extra.trades], [extra]);
  const deskLevels = useMemo(() => ({ ...extra.levels, ...lv }), [extra, lv]);
  const saved = useMemo(() => loadDeskSettings(), []);
  const [capital, setCapital] = useState(saved.capital);
  const [riskPct, setRiskPct] = useState(saved.riskPct);
  const [muted, setMuted] = useState(true);
  const [chartMode, setChartMode] = useState("line");
  const [showEma, setShowEma] = useState(true);
  const [showRsi, setShowRsi] = useState(true);
  // Trail % is kept per pick: the swing starts at 8%, the intraday trade at 3%.
  const [trails, setTrails] = useState<Record<string, string>>(saved.trails);
  const [trailHigh, setTrailHigh] = useState("");
  const [scanTxt, setScanTxt] = useState(() => { try { return localStorage.getItem("gsa-scan") || ""; } catch { return ""; } });
  const scan = useMemo(() => parseScan(scanTxt), [scanTxt]);
  const onScan = (v) => { setScanTxt(v); try { localStorage.setItem("gsa-scan", v); } catch {} };
  const [toast, setToast] = useState("");
  const timer = useRef();
  // The Gemini proxy is assumed up. A host with its own model (the Claude artifact) passes checkReady to probe it first.
  const [ready, setReady] = useState<boolean | null>(checkReady ? null : true);
  useEffect(() => { if (checkReady) checkReady().then((v) => setReady(!!v), () => setReady(false)); }, []);
  const [hist, setHist] = useState([]);
  const [msgs, setMsgs] = useState(() => [{ r: "a", t: GREETING, time: hhmm() }]);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const histRef = useRef(), inputRef = useRef(), dialogueRef = useRef(), benchRef = useRef();

  useEffect(() => { histRef.current?.scrollTo({ top: histRef.current.scrollHeight }); }, [msgs]);
  const chartRef = useRef(), tplRef = useRef(), scanRef = useRef();

  const t = TRADES[sel];
  const raw = lv[t.id];
  const L = parseLevels(raw);
  const ok = levelsOk(L);
  useEffect(() => { saveDeskSettings({ ...loadDeskSettings(), capital, riskPct, trails }); }, [capital, riskPct, trails]);
  const passN = t.checks.filter((c) => c[2] === "pass").length;
  const chg = dayChangePct(t);

  const size = useMemo(() => sizePosition(L, capital, riskPct), [L.entry, L.stop, L.t1, L.t2, capital, riskPct]);

  // Trailing stop: highest price since entry x (1 - trail%). Until you enter a real high, the highest close in the 40 sessions is used.
  useEffect(() => { setTrailHigh(""); }, [sel]); // a high entered for one stock must not carry to the other
  const trailPct = trailFor({ trails }, t.id);
  const setTrailPct = (v: string) => setTrails((m) => ({ ...m, [t.id]: v }));
  // Position tracker: your fill, the stop that only moves up, and a hit flag. It works on the prices you enter; there is no live feed.
  const [positions, setPositions, sharedPositions] = useSharedPositions();
  const [tin, setTin] = useState<Record<string, Record<string, string>>>({});
  const ti = tin[t.id] || {};
  const setTi = (k: string) => (e: any) => setTin((m) => ({ ...m, [t.id]: { ...(m[t.id] || {}), [k]: e.target.value } }));
  const posn = positions[t.id];
  const trailNum = parseFloat(trailPct);
  const trk = posn && trailNum > 0 && trailNum < 50 ? trackerView(posn, trailNum) : null;
  const startTrack = () => {
    const p = openPosition({ fill: parseFloat(ti.fill || String(L.entry)), qty: parseInt(ti.qty || String(size?.qty ?? 0), 10), stop0: L.stop });
    if (!p) return say("Check the fill, the share count and the stop: the stop must be below the fill.");
    setPositions((m) => ({ ...m, [t.id]: p })); setTin((m) => ({ ...m, [t.id]: {} })); say(`Tracking ${t.sym} from ₹${fmt(p.fill, 2)}, stop ₹${fmt(p.stop, 2)}`);
  };
  const updateTrack = () => {
    if (!posn) return;
    const price = parseFloat(ti.price || String(t.close));
    if (!(price > 0)) return say("Enter the latest price.");
    const next = applyBar(posn, { price, high: parseFloat(ti.high) || undefined, low: parseFloat(ti.low) || undefined }, trailNum);
    if (next === posn) return say("Enter a trail between 1 and 49 percent first.");
    setPositions((m) => ({ ...m, [t.id]: next })); setTin((m) => ({ ...m, [t.id]: {} }));
    if (next.hit) { say(`STOP HIT: ${t.sym} traded through ₹${fmt(next.hitAt!, 2)}`); if (!muted) beep(); }
    else if (next.stop > posn.stop) say(`Stop raised to ₹${fmt(next.stop, 2)}`);
    else say("No change: the stop only moves up");
  };
  const closeTrack = () => { setPositions((m) => { const n = { ...m }; delete n[t.id]; return n; }); say(`${t.sym} tracker cleared`); };
  const trailInfo = useMemo(() => trailStop(t.closes, t.close, trailPct, trailHigh, ok ? L.stop : undefined), [trailPct, trailHigh, t, ok, L.stop]);

  const say = (m) => { setToast(m); clearTimeout(timer.current); timer.current = setTimeout(() => setToast(""), 2600); };
  const copy = (text, msg) => {
    try { navigator.clipboard.writeText(text).then(() => say(msg), () => say(text)); } catch { say(text); }
  };
  const beep = () => {
    try {
      const c = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
      const o = c.createOscillator(), g = c.createGain();
      o.frequency.value = 880; g.gain.value = 0.12; o.connect(g); g.connect(c.destination);
      o.start(); o.stop(c.currentTime + 0.22);
    } catch {}
  };
  const next = () => setSel((s) => (s + 1) % TRADES.length);

  useEffect(() => {
    const h = (e) => { if (!inDashboard && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); next(); } };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);

  const setLevel = (k) => (e) => setLv((v) => ({ ...v, [t.id]: { ...v[t.id], [k]: e.target.value } }));
  const scrollTo = (ref) => () => ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });

  const ctxData = () => {
    const cap = parseFloat(capital) || 0, rp = parseFloat(riskPct) || 0;
    return {
      session: "NSE close 9 Nov 2026, screen run 10 Nov 2026", marketBreadthAD: 0.77, capitalINR: cap, riskPerTradePct: rp, selected: t.sym, trailingStop: trailInfo ? { percent: trailInfo.p, highUsed: +trailInfo.hi.toFixed(2), stop: +trailInfo.stop.toFixed(2), highIsFromData: trailInfo.usingData } : null,
      setups: TRADES.map((x) => {
        const l = parseLevels(lv[x.id]);
        const risk = l.entry - l.stop;
        const qty = sizePosition(l, cap, rp)?.qty ?? 0;
        return {
          symbol: x.sym, name: x.name, style: x.mode, setup: x.setup, close: x.close, prevClose: previousClose(x),
          high52w: x.hi52, low52w: x.lo52, dma50_150_200: x.ma, levels: l,
          riskPerShare: +risk.toFixed(2), riskPctOfEntry: +((risk / l.entry) * 100).toFixed(2), quantity: qty, positionValue: Math.round(qty * l.entry),
          rToT1: +((l.t1 - l.entry) / risk).toFixed(2), rToT2: +((l.t2 - l.entry) / risk).toFixed(2),
          trendTemplate: x.checks.map((c) => `${c[0]}: ${c[1]} (${c[2] === "pass" ? "pass" : "not checked"})`),
          notes: [x.base, x.note, x.targets],
        };
      }),
    };
  };

  const ask = async (text) => {
    text = (text || "").trim();
    if (!text || busy) return;
    if (ready === false) {
      setMsgs((m) => [...m, { r: "a", t: "The co-pilot is not available here. The plan, sizing and trend template still work.", time: hhmm() }]);
      return;
    }
    setBusy(true);
    const nextHist = [...hist, { role: "user", content: text }];
    setHist(nextHist);
    setMsgs((m) => [...m, { r: "u", t: text, time: hhmm() }, { r: "a", t: "Thinking…", time: hhmm() }]);
    const send = nextHist.slice(-8).map((m) => ({ ...m }));
    while (send.length && send[0].role !== "user") send.shift();
    send[0].content = SYSTEM + JSON.stringify(ctxData()) + "\n\nConversation:\n\n" + send[0].content;
    const setLast = (s) => setMsgs((m) => m.map((x, i) => (i === m.length - 1 ? { ...x, t: s } : x)));
    try {
      const reply = await askModel(send, setLast);
      setLast(reply);
      setHist((h) => [...h, { role: "assistant", content: reply }]);
    } catch (e) {
      setLast(e?.code === "not_granted" ? "Access to the model was declined for this page." : e?.code === "rate_limited" ? "Too many questions at once. Wait a moment and try again." : "The co-pilot could not answer. Try again.");
      setHist((h) => h.slice(0, -1));
    }
    setBusy(false);
  };
  const pos = ((t.close - t.lo52) / (t.hi52 - t.lo52)) * 100;

  return (
    <div className={`desk${inDashboard ? " desk-in-dash" : ""}`}>
      <style>{CSS + TOOLS_CSS}</style>

      <div className="bar">
        <div className="brand">
          <div className="row"><span className="lab">Technical Intelligence</span><span className="badge">Minervini SEPA</span></div>
          <h1>Growth Stock Alpha</h1>
        </div>
        <div className="chips">
          <div className="chip"><span className="dot" style={{ background: "var(--green-t)" }} /><span className="t"><span>Qualified</span><span>Setups <b>&nbsp;3 stocks</b></span></span></div>
          <div className="chip"><span className="dot" style={{ background: "#4aa3ff" }} /><span className="t"><span>Volume</span><span>Expansion <b>&nbsp;2 setups</b></span></span></div>
          <div className="chip amberline"><span className="t"><span>Source</span><span>NSE bhavcopy</span></span></div>
          <div className="chip fill-amber"><span>Daily</span><span>Stage 2</span><span>Scan</span></div>
          <div className="chip fill-red" title="Based on 9 Nov market breadth only (advances/declines 0.77). No index trend was measured."><span className="t"><span>Market</span><span><b>Bearish trend</b></span></span><span className="sm">9 Nov</span></div>
          <div className="chip"><span className="t"><span>Session</span><span><b>9 Nov 2026</b></span></span><span className="sm dk">EOD</span></div>
        </div>
      </div>

      <div className="wrap">
        <section className="hero">
          <div className="tags"><span className="tag1">Priority Setup</span><span className="tag2">Mark Minervini SEPA Engine</span></div>
          <h2>Stage 2 Trend Continuation &amp; VCP Screener</h2>
          <p className="desc">Identifies high-momentum growth stocks in Stage 2 uptrends that clear the Trend Template, then sets a pivot entry, a tight stop and two targets. Today's screen found one swing pivot and one intraday break.</p>

          <div className="tiles">
            <div className="tile t1"><span className="lab">Selected stock</span><span className="v">{t.sym}</span></div>
            <div className="tile t2"><span className="lab">Pivot entry</span><span className="v num">₹{fmt(L.entry, 2)}</span></div>
            <div className="tile t3"><span className="lab">Tight stop</span><span className="v num">₹{fmt(L.stop, 2)}</span></div>
            <div className="tile t4"><span className="lab">Template pass</span><span className="v num">{passN}/8</span><span className="s">{8 - passN} NOT CHECKED</span></div>
            <button className="act amber" onClick={() => copy(`${t.sym} ${t.mode}: buy ₹${fmt(L.entry, 2)}, stop ₹${fmt(L.stop, 2)}, T1 ₹${fmt(L.t1, 2)}, T2 ₹${fmt(L.t2, 2)}. ${t.base}`, "Trade note copied")}>
              <span className="tt"><b>Tag insight</b><i>Copy trade note</i></span>
            </button>
            <button className="act green" onClick={() => copy(`${t.sym}: alert above ₹${fmt(L.entry, 2)} (entry), below ₹${fmt(L.stop, 2)} (stop), at ₹${fmt(L.t1, 2)} (T1), at ₹${fmt(L.t2, 2)} (T2)`, "Alert levels copied")}>
              <span className="tt"><b>Set trend-line alert</b><i>Copy price triggers</i></span>
            </button>
          </div>

          <div className="acts">
            <a className="btn2 blue" href="https://chartink.com/" target="_blank" rel="noopener noreferrer"><span className="tt"><b>Chartlink ↗</b><i>Live chart</i></span></a>
            <button className="btn2 dark" onClick={scrollTo(chartRef)}><span className="tt"><b>VCP chart</b><i>Price and volume</i></span></button>
            <button className="btn2 violet" onClick={scrollTo(tplRef)}><span className="tt"><b>SEPA template <span className="q">8 rules</span></b><i>Trend template check</i></span></button>
            <button className="btn2 red" disabled title="Not run in this screen"><span className="tt"><b>Bear market <span className="q">Stage 4</span></b><i>Short screener, not run</i></span></button>
          </div>

          <div className="scan">
            <button className="pill" onClick={next} title="Switch between the two setups">
              <span className="dot" style={{ background: "var(--green-t)" }} />Stage 2 Scanner <span className="k">⌘K / CTRL+K</span>
            </button>
            <div className="tabs" role="tablist">
              {TRADES.map((x, i) => (
                <button key={x.id} role="tab" className="tab" aria-selected={i === sel} onClick={() => setSel(i)}>
                  {x.sym} · {i ? "Intraday" : "Swing"}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="hermes">
          <div>
            <div className="hbadges">
              <span className="hbadge">Hermes agent</span>
              <span className={`hbadge ${ready ? "ok" : ready === false ? "off" : ""}`}>{ready ? "Co-pilot ready" : ready === false ? "Co-pilot unavailable here" : "Checking co-pilot"}</span>
            </div>
            <h3>Hermes Autonomous Trading Agent</h3>
            <p className="hdesc">An AI co-pilot that reads both setups on this desk: the trend template, the levels you set and your sizing inputs. Ask it about entries, stops, position size and risk. It only knows what is on this page.</p>
            <div className="hbtns">
              <button className="hbtn on" onClick={() => { dialogueRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); inputRef.current?.focus(); }}>AI Co-Pilot Chat</button>
              <button className="hbtn" disabled={ready === false} onClick={() => ask(`Write a trade directive for ${t.sym}: entry, stop, targets, size, and the conditions to skip it.`)}>Trade Directive Generator</button>
              <button className="hbtn" disabled={ready === false} onClick={() => ask("Compare the two setups on risk, extension and liquidity. Which needs more caution, and why?")}>Watchlist AI Radar</button>
              <button className="hbtn" disabled={ready === false} onClick={() => ask("Brief me on the session: market breadth, what the two setups have in common, and what to watch at the open.")}>Daily Intelligence Briefing</button>
            </div>
          </div>
          <div className="eng">
            <div className="r"><span>Engine status</span><span>{ready ? "Ready" : ready === false ? "Unavailable" : "Checking"}</span></div>
            <div className="r"><span>Context</span><span>2 setups · 8 rules</span></div>
            <div className="r"><span>Template score</span><span>{passN} / 8 · {t.sym}</span></div>
            <div className="r"><span>Active stock</span><span className="es">{t.sym}</span></div>
          </div>
        </section>

        <div className="dgrid">
          <section className="dpanel" ref={dialogueRef}>
            <div className="dh">
              <div><h4>Hermes Strategic Dialogue</h4><div className="s">Ask about trade setups, sizing, stops, risk and how the two ideas compare.</div></div>
              <button className="clr" onClick={() => { setHist([]); setMsgs([{ r: "a", t: GREETING, time: hhmm() }]); }}>Clear history</button>
            </div>
            <div className="hist" ref={histRef} aria-live="polite">
              {msgs.map((m, i) => (
                <div key={i} className={`msg ${m.r}`}>
                  <div className="mh">{m.r === "u" ? "You" : "Hermes agent"} · {m.time}</div>
                  <div className="mb">{m.t}</div>
                </div>
              ))}
            </div>
            <form className="qf" onSubmit={(e) => { e.preventDefault(); const v = q; setQ(""); ask(v); }}>
              <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" placeholder="Ask Hermes about the selected setup" aria-label="Question for Hermes" />
              <button type="submit" disabled={busy}>Execute</button>
            </form>
            <div className="qq"><span>Quick queries:</span>{QUICK.map(([label, full]) => <button key={label} type="button" onClick={() => ask(full)}>{label}</button>)}</div>
          </section>

          <section className="dpanel">
            <div className="dh"><h4>Active Evaluation Context</h4><span className="hbadge">{t.sym}</span></div>
            <div className="cxb">
              {[["Company", t.name], ["Current price", `₹${fmt(t.close, 2)}`], ["52-week range position", `${pos.toFixed(0)}%`], ["Trend template score", `${passN} / 8 rules`]].map(([k, v]) => (
                <div className="cxr" key={k}><span>{k}</span><span className={k.startsWith("Trend") ? "am" : ""}>{v}</span></div>
              ))}
            </div>
            {ok && (
              <div className="cxb">
                <div className="ct">Tactical execution levels</div>
                <div className="cxr"><span>Pivot entry</span><span className="g">₹{fmt(L.entry, 2)}</span></div>
                <div className="cxr"><span>Hard stop loss</span><span className="rd">₹{fmt(L.stop, 2)} (−{(((L.entry - L.stop) / L.entry) * 100).toFixed(2)}%)</span></div>
                <div className="cxr"><span>Target 1</span><span className="g">₹{fmt(L.t1, 2)} (+{((L.t1 / L.entry - 1) * 100).toFixed(1)}%)</span></div>
                <div className="cxr"><span>Risk / reward to T1</span><span className="am">{((L.t1 - L.entry) / (L.entry - L.stop)).toFixed(1)} : 1</span></div>
              </div>
            )}
            <div>
              <button className="cbtn a" onClick={scrollTo(benchRef)}>Open position size calculator</button>
              <button className="cbtn b" onClick={scrollTo(chartRef)}>View VCP chart &amp; contractions</button>
            </div>
          </section>
        </div>

        <section className="bench" ref={benchRef}>
          <div className="bh">
            <div>
              <div className="lab">{t.mode}</div>
              <div className="sym">{t.sym}</div>
              <div className="sub">{t.name} · {t.setup}</div>
            </div>
            <div className="size">
              <label className="f"><span className="lab">Capital ₹</span><input type="number" min="0" step="10000" value={capital} onChange={(e) => setCapital(e.target.value)} /></label>
              <label className="f"><span className="lab">Risk per trade %</span><input type="number" min="0.1" max="5" step="0.1" value={riskPct} onChange={(e) => setRiskPct(e.target.value)} /></label>
            </div>
          </div>

          <div className="stats">
            <span>Close <b>₹{fmt(t.close, 2)}</b> (+{chg.toFixed(2)}%)</span>
            <span>52w high <b>₹{fmt(t.hi52, 2)}</b></span>
            <span>52w low <b>₹{fmt(t.lo52, 2)}</b></span>
            <span>50 / 150 / 200 DMA <b>{fmt(t.ma[0])} / {fmt(t.ma[1])} / {fmt(t.ma[2])}</b></span>
          </div>

          <div className="scan" ref={scanRef}>
            <div className="lab">Chartink scan on the chart</div>
            <div className="srow">
              <textarea rows={2} aria-label="Chartink scan results" value={scanTxt} onChange={(e) => onScan(e.target.value)} placeholder="Paste your Chartink scan result or a list of symbols, e.g. LAURUSLABS, SAILIFE" />
              <div className="sbtns">
                <button className="sbtn" type="button" onClick={() => copy(SCAN_CLAUSE, "Scan clause copied. Paste it in Chartink, then run the scan")}>Copy scan clause</button>
                <a className="sbtn" href="https://chartink.com/screener" target="_blank" rel="noopener noreferrer">Open Chartink ↗</a>
                <button className="sbtn" type="button" onClick={() => onScan("")}>Clear</button>
              </div>
            </div>
            <div className="sstat">
              {scan ? <><span>{scan.size} tokens read</span>{TRADES.map((x) => { const m = scan.has(x.sym); return <span key={x.id}>{x.sym}: <b className={m ? "y" : "n"}>{m ? "in scan" : "not in scan"}</b></span>; })}</> : <span>No scan pasted yet. Run the clause in Chartink, paste the result here, and each chart shows whether its stock is in the scan.</span>}
            </div>
          </div>
          <div className="cmode" role="group" aria-label="Chart type">
            <button type="button" className={chartMode === "line" ? "on" : ""} aria-pressed={chartMode === "line"} onClick={() => setChartMode("line")}>Line</button>
            <button type="button" className={chartMode === "candle" ? "on" : ""} aria-pressed={chartMode === "candle"} onClick={() => setChartMode("candle")}>Candles + patterns</button>
            <button type="button" className={showEma ? "on" : ""} aria-pressed={showEma} onClick={() => setShowEma((v) => !v)}>EMA 20</button>
            <button type="button" className={showRsi ? "on" : ""} aria-pressed={showRsi} onClick={() => setShowRsi((v) => !v)}>RSI 14</button>
            {chartMode === "candle" && <span className="cleg">▲ bullish  ▼ bearish  ◆ neutral · last 15 sessions</span>}
          </div>
          <div className="chartbox" ref={chartRef}>{ok ? <Chart t={t} L={L} scan={scan} trail={trailInfo?.stop} mode={chartMode} showEma={showEma} showRsi={showRsi} /> : null}</div>
          <p className="read">{t.base}</p>

          <div className="cols">
            <div>
              <div className="lab">Trade plan</div>
              <div className="lvls">
                {[["entry", "Entry"], ["stop", "Stop"], ["t1", "Target 1"], ["t2", "Target 2"]].map(([k, label]) => (
                  <label key={k} className="f"><span className="lab">{label}</span>
                    <input type="number" step="0.05" value={raw[k]} onChange={setLevel(k)} />
                  </label>
                ))}
              </div>
              {size ? (
                <table className="num"><tbody>
                  {[
                    ["Risk per share", `₹${fmt(size.risk, 2)} (${((size.risk / L.entry) * 100).toFixed(1)}%)`],
                    ["Quantity", `${fmt(size.qty)} shares${size.capped ? " (capped by capital)" : ""}`],
                    ["Position value", `₹${fmt(size.value)} (${size.cap ? ((size.value / size.cap) * 100).toFixed(0) : 0}% of capital)`],
                    ["Loss at stop", `₹${fmt(size.qty * size.risk)}`],
                    ["Target 1", `${size.r1.toFixed(1)}R · ₹${fmt(size.qty * (L.t1 - L.entry))}`],
                    ["Target 2", `${size.r2.toFixed(1)}R · ₹${fmt(size.qty * (L.t2 - L.entry))}`],
                  ].map(([k, v]) => <tr key={k}><td className="k">{k}</td><td>{v}</td></tr>)}
                </tbody></table>
              ) : (
                <div className="err">Check the levels: stop below entry, targets above entry, target 2 at or above target 1.</div>
              )}
              <div className="tg">{t.targets}</div>
              <div className="tbox">
                <div className="lab">Trailing stop</div>
                <div className="trow">
                  <label className="f"><span className="lab">Trail %</span><input type="number" min="1" max="49" step="0.5" value={trailPct} onChange={(e) => setTrailPct(e.target.value)} /><span className="presets">{["3", "5", "8"].map((v) => <button key={v} type="button" className={trailPct === v ? "on" : ""} aria-pressed={trailPct === v} onClick={() => setTrailPct(v)}>{v}%</button>)}</span></label>
                  <label className="f"><span className="lab">Highest price since entry</span><input type="number" step="0.05" value={trailHigh} placeholder={`${fmt(Math.max(...t.closes), 2)} (40-session high close)`} onChange={(e) => setTrailHigh(e.target.value)} /></label>
                </div>
                {trailInfo ? (
                  <table className="num"><tbody>
                    <tr><td className="k">Trailing stop</td><td>₹{fmt(trailInfo.stop, 2)} ({trailInfo.p}% below ₹{fmt(trailInfo.hi, 2)})</td></tr>
                    <tr><td className="k">Versus last close</td><td>{(trailInfo.stop / t.close * 100 - 100).toFixed(1)}%</td></tr>
                    {ok && <tr><td className="k">Versus fixed stop ₹{fmt(L.stop, 2)}</td><td>{trailInfo.binding ? "Trail is higher: it now protects more" : `Fixed stop is tighter until the high passes ₹${fmt(trailInfo.activates, 2)}`}</td></tr>}
                    {size && (trailInfo.stop > L.entry
                      ? <tr><td className="k">Profit locked in if hit</td><td>₹{fmt((trailInfo.stop - L.entry) * size.qty)}</td></tr>
                      : <tr><td className="k">Loss if trail is hit</td><td>₹{fmt((L.entry - trailInfo.stop) * size.qty)}</td></tr>)}
                  </tbody></table>
                ) : <div className="err">Enter a trail between 1 and 49 percent.</div>}
                <div className="tg">{trailInfo?.usingData ? "No real high entered, so the highest close in the data is used. Enter your own high after you are in the trade. " : ""}Raise the stop only; never lower it. {t.id === "intra" ? "SAILIFE is the intraday trade, so it starts at a 3% trail; an 8% trail is far wider than the day's range and works as a swing exit only." : "LAURUSLABS is the swing trade, so it starts at an 8% trail; 3% is an intraday setting and would stop you out on normal pullbacks."}</div>
              </div>
              <div className="tbox tk" aria-label="Position tracker">
                <div className="lab">Position tracker</div>
                <div className="tg" role="status">{sharedPositions ? "Synced with the desk command line (~/.trade_desk/positions.json): npm run desk -- track / dash." : "Kept in this browser only. Run the dev server (npm run dev) to share positions with the desk command line."}</div>
                {!posn ? (
                  <>
                    <div className="trow">
                      <label className="f"><span className="lab">Your fill ₹</span><input type="number" step="0.05" value={ti.fill ?? ""} placeholder={String(L.entry)} onChange={setTi("fill")} /></label>
                      <label className="f"><span className="lab">Shares</span><input type="number" step="1" min="1" value={ti.qty ?? ""} placeholder={String(size?.qty ?? "")} onChange={setTi("qty")} /></label>
                    </div>
                    <button type="button" className="tkbtn" onClick={startTrack}>Start tracking</button>
                    <div className="tg">Enter what you actually paid. The stop starts at your fixed stop ₹{fmt(L.stop, 2)} and then only moves up with the highest price you enter.</div>
                  </>
                ) : trk ? (
                  <>
                    <div className={`tkflag ${trk.status}`} role="status">
                      {trk.status === "hit" ? `STOP HIT at ₹${fmt(posn.hitAt!, 2)} on ${posn.hitOn}. Exit the position and clear the tracker.` : trk.status === "danger" ? `Within ${trk.distancePct.toFixed(1)}% of the stop at ₹${fmt(trk.stop, 2)}.` : `Open. ${trk.distancePct.toFixed(1)}% above the stop.`}
                    </div>
                    <table className="num"><tbody>
                      <tr><td className="k">Fill / shares</td><td>₹{fmt(posn.fill, 2)} × {posn.qty}</td></tr>
                      <tr><td className="k">Last price</td><td>₹{fmt(posn.last, 2)} ({trk.pnlPct >= 0 ? "+" : ""}{trk.pnlPct.toFixed(2)}%, {trk.pnl >= 0 ? "+" : "-"}₹{fmt(Math.abs(trk.pnl))})</td></tr>
                      <tr><td className="k">Highest since entry</td><td>₹{fmt(posn.high, 2)}</td></tr>
                      <tr><td className="k">Trailing level ({trailNum}%)</td><td>₹{fmt(trk.trailLevel, 2)}</td></tr>
                      <tr><td className="k">Protective stop</td><td><b>₹{fmt(trk.stop, 2)}</b> {trk.binding === "trail" ? `(raised ₹${fmt(trk.raisedBy, 2)} from ₹${fmt(posn.stop0, 2)})` : "(your fixed stop; the trail is still below it)"}</td></tr>
                      <tr><td className="k">Open profit in R</td><td>{trk.openR.toFixed(2)}R</td></tr>
                      <tr><td className="k">{trk.lockedIfStopped >= 0 ? "Profit locked in" : "Loss if stopped"}</td><td>{trk.lockedIfStopped >= 0 ? "+" : "-"}₹{fmt(Math.abs(trk.lockedIfStopped))}</td></tr>
                    </tbody></table>
                    {!posn.hit && (
                      <>
                        <div className="trow">
                          <label className="f"><span className="lab">Latest price ₹</span><input type="number" step="0.05" value={ti.price ?? ""} placeholder={String(t.close)} onChange={setTi("price")} /></label>
                          <label className="f"><span className="lab">Day high ₹ (optional)</span><input type="number" step="0.05" value={ti.high ?? ""} onChange={setTi("high")} /></label>
                          <label className="f"><span className="lab">Day low ₹ (optional)</span><input type="number" step="0.05" value={ti.low ?? ""} onChange={setTi("low")} /></label>
                        </div>
                        <button type="button" className="tkbtn" onClick={updateTrack}>Update stop</button>
                      </>
                    )}
                    <button type="button" className="tkbtn ghost" onClick={closeTrack}>{posn.hit ? "Clear tracker" : "Close position"}</button>
                    {posn.log.length > 1 && <ul className="tklog">{posn.log.slice(-5).reverse().map((l, i) => <li key={i}><span>{l.on}</span><span>₹{fmt(l.price, 2)}</span><span>{l.note}</span></li>)}</ul>}
                    <div className="tg">Checked only against prices you enter, so it cannot alert you in the market. If the price gaps through the stop you will fill below it. A day low under the stop counts as a hit.</div>
                  </>
                ) : <div className="err">Enter a trail between 1 and 49 percent above to track.</div>}
              </div>
            </div>
            <div ref={tplRef}>
              <div className="lab">Trend template</div>
              <ul className="chk">
                {t.checks.map(([label, val, st]) => (
                  <li key={label}><span className={`st ${st}`}>{st === "pass" ? "Pass" : "Open"}</span><span>{label}</span><span className="v">{val}</span></li>
                ))}
              </ul>
            </div>
          </div>

          <div className="note"><b>Watch</b>{t.note}</div>
        </section>

        <DeskTools
          trades={deskTrades} levels={deskLevels} capital={capital} riskPct={riskPct} scan={scan}
          hideSelfLink={inDashboard}
          dataNote={extra.trades.length ? "Rows after the two picks are the NSE and BSE stocks on this screen, scored on all 8 Trend Template rules from their own price and moving averages. Their moving-average and candle scores use sample price history, so those candle patterns repeat; the two picks use real NSE bars. The Chart patterns tab uses real NSE daily bars (12 Aug to 11 Nov 2026) for TRENT, SUVEN, MOSCHIP, GOLDIAM, DIXON, PAYTM and ZEEL, and marks any other row as sample data. Selecting one of them loads it in the dashboard." : undefined}
          onSelect={(i: number) => { if (i < TRADES.length) setSel(i); else { const x = extra.source[i - TRADES.length]; if (x && onSelectStock) onSelectStock(x); } }} say={say} copy={copy} beep={beep} muted={muted}
          onNavigate={onNavigate} onOpenStageScan={onOpenStageScan}
          onShowCandles={(i: number) => { if (i < TRADES.length) { setSel(i); setChartMode("candle"); chartRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); } else { const x = extra.source[i - TRADES.length]; if (x && onSelectStock) onSelectStock(x); onNavigate?.("chart"); } }}
          jumps={[["Hermes agent", () => { dialogueRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); inputRef.current?.focus(); }], ["VCP chart", scrollTo(chartRef)], ["Trade plan", scrollTo(benchRef)], ["Scanner", scrollTo(scanRef)]]}
        />

        <footer>
          <span>Source: NSE bhavcopy via the NSE MCP tool, sessions to 9 Nov 2026. Prices are unadjusted; no corporate-action check was run on these two names.</span>
          <span>Not checked: 200-day average slope and RS rating. The 10 Nov session is not in the data, so confirm live prices before entry. Capital and risk are example values. Screen output, not investment advice.</span>
        </footer>
      </div>

      <div className="mon" role="group" aria-label="Pivot monitor">
        <span>Watchlist audio &amp; pivot monitor:</span><span className="st1">SNAPSHOT</span>
        <button aria-pressed={muted} onClick={() => setMuted((m) => !m)}>{muted ? "Muted" : "Sound on"}</button>
        <button className="go" onClick={() => (muted ? say("Alerts are muted. Turn sound on to hear the test.") : (beep(), say("Test alert played")))}>Test alerts</button>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

const CSS = `
@import url("https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Playfair+Display:ital,wght@0,600;0,700;0,800;1,400;1,700;1,800&display=swap");
.desk{--bg:#050508;--bar:#0a0a0e;--card:#0d0d13;--card2:#111118;--line:#1f1f29;--fg:#f2f2f5;--muted:#8a8a99;--dim:#5b5b69;
  --amber:#f5a524;--amber-d:#3a2a0e;--red:#e11d48;--red-t:#ff3347;--green:#12985a;--green-t:#3ddc97;--blue:#1d4ed8;--violet:#4f46e5;
  --cream:#faf3df;--ink:#14110a;--mauve:#7d6b70;--serif:"Playfair Display",Georgia,serif;--mono:"JetBrains Mono",ui-monospace,Menlo,monospace;
  background:var(--bg);color:var(--fg);font-family:var(--mono);font-size:13px;line-height:1.5;min-height:100vh;padding-bottom:96px}
.desk.desk-in-dash{min-height:0;padding-bottom:0;border:1px solid var(--line)}
.desk-in-dash .mon,.desk-in-dash .bar{display:none}
.tk .tkbtn{background:var(--amber);color:#14110a;border:0;padding:8px 14px;font-weight:700;font-size:11px;letter-spacing:.08em;text-transform:uppercase;margin:8px 8px 0 0}.tk .tkbtn.ghost{background:transparent;color:var(--muted);border:1px solid var(--line)}
.tkflag{padding:8px 10px;margin:6px 0 8px;font-size:12px;border:1px solid var(--line)}.tkflag.ok{color:var(--green-t);border-color:#14472f}.tkflag.danger{color:var(--amber);border-color:#5a4214}.tkflag.hit{color:#fff;background:#5a0f1f;border-color:var(--red-t);font-weight:700}
.tklog{list-style:none;margin:10px 0 0;padding:0;font-size:11px;color:var(--muted)}.tklog li{display:grid;grid-template-columns:86px 80px 1fr;gap:8px;padding:3px 0;border-top:1px solid var(--line)}
.presets{display:flex;gap:4px;margin-top:4px}.presets button{background:#0c0c14;border:1px solid var(--line);color:var(--muted);padding:2px 8px;font-size:10px;font-weight:700}.presets button.on{border-color:var(--amber);color:var(--amber)}
.desk *{box-sizing:border-box}
.desk button{font:inherit;color:inherit;cursor:pointer}
.desk .lab{font-size:10px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--muted)}
.desk .num{font-variant-numeric:tabular-nums}
.bar{background:var(--bar);border-bottom:1px solid var(--line);display:flex;align-items:center;gap:20px;padding:12px 16px;overflow-x:auto}
.brand{flex:none}.brand .row{display:flex;align-items:center;gap:10px}
.badge{font-size:9px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;background:var(--amber-d);color:var(--amber);padding:3px 8px;border:1px solid #5a4214}
.brand h1{margin:2px 0 0;font-family:var(--serif);font-style:italic;font-weight:800;font-size:30px;line-height:1.05;white-space:nowrap}
.chips{display:flex;gap:12px;flex:none}
.chip{display:flex;align-items:center;gap:10px;padding:8px 14px;border:1px solid var(--line);background:#0c0c11;font-size:10px;letter-spacing:.14em;text-transform:uppercase;white-space:nowrap;min-height:58px}
.chip .t{display:flex;flex-direction:column;gap:2px;color:var(--muted)}.chip b{color:var(--fg);letter-spacing:.1em}
.chip.amberline{border-color:#7a5512}.chip.amberline .t{color:var(--amber)}
.chip.fill-amber{background:var(--amber);border-color:var(--amber);color:#1a1204;font-weight:700;flex-direction:column;gap:0;justify-content:center}
.chip.fill-red{background:var(--red);border-color:var(--red);color:#fff;font-weight:700}.chip.fill-red .t,.chip.fill-red b{color:#fff}
.chip .sm{font-size:8px;padding:2px 6px;background:rgba(255,255,255,.2)}.chip .sm.dk{background:#2a2a35;color:var(--amber)}
.dot{width:7px;height:7px;border-radius:50%;flex:none;display:inline-block}
.wrap{max-width:1240px;margin:0 auto;padding:24px 16px 0;display:flex;flex-direction:column;gap:20px}
.hero,.bench{background:var(--card);border:1px solid var(--line);padding:clamp(16px,3.4vw,32px);display:flex;flex-direction:column;gap:22px;min-width:0}
.tags{display:flex;flex-wrap:wrap;gap:14px;align-items:center}
.tag1{background:#16161d;border:1px solid var(--line);padding:6px 14px;font-size:10px;font-weight:700;letter-spacing:.2em;text-transform:uppercase}
.tag2{font-size:10px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--muted)}
.hero h2{margin:0;font-family:var(--serif);font-weight:800;font-size:clamp(30px,5.4vw,58px);line-height:1.08;max-width:20ch;text-wrap:balance}
.desc{margin:0;font-family:var(--serif);font-style:italic;color:var(--muted);font-size:clamp(14px,1.6vw,17px);line-height:1.6;max-width:76ch}
.tiles{display:flex;flex-wrap:wrap}
.tile{padding:16px 22px;display:flex;flex-direction:column;gap:6px;min-width:170px;justify-content:center}
.tile.t1{background:#08080c;border:1px solid var(--line)}.tile.t1 .v{font-family:var(--serif);font-style:italic;font-weight:800;font-size:34px;line-height:1.05}
.tile.t2{background:#0a0a0f;border:1px solid var(--line);border-left:0}.tile.t2 .v{font-weight:700;font-size:24px}
.tile.t3{background:var(--mauve);border:1px solid #a58f95}.tile.t3 .lab{color:#2a0d14}.tile.t3 .v{font-weight:700;font-size:24px;color:var(--red-t)}
.tile.t4{background:var(--cream);color:var(--ink)}.tile.t4 .lab{color:#6b5a2c}.tile.t4 .v{font-weight:700;font-size:26px}.tile.t4 .s{font-size:10px;color:#6b5a2c}
.act{display:flex;align-items:center;padding:12px 18px;border:0;text-align:left;margin-left:12px}
.act.amber{background:#f08a0b;color:#1a1204}.act.green{background:var(--green);color:#eafff4}
.tt{display:flex;flex-direction:column;line-height:1.25}.tt b{font-size:11px;letter-spacing:.14em;text-transform:uppercase;display:flex;gap:8px;align-items:center}.tt i{font-style:normal;font-size:9px;letter-spacing:.08em;opacity:.85}
.acts,.scan{display:flex;flex-wrap:wrap;gap:12px;align-items:center}
.btn2{display:flex;align-items:center;padding:12px 18px;border:1px solid transparent;text-decoration:none;color:#fff}
.btn2.blue{background:var(--blue)}.btn2.dark{background:#0a0a0f;border-color:#23232d}.btn2.violet{background:var(--violet)}.btn2.red{background:#b4153c;opacity:.45;cursor:not-allowed}
.q{font-size:8px;background:rgba(255,255,255,.22);padding:1px 6px}
.pill{display:flex;align-items:center;gap:12px;padding:10px 20px;border:1px solid #5a4214;border-radius:99px;background:#100c05;font-weight:700;font-size:12px}
.pill .k{font-size:9px;padding:3px 8px;background:var(--amber-d);color:var(--amber);border:1px solid #5a4214}
.tabs{display:flex;flex-wrap:wrap;gap:8px}
.tab{padding:9px 16px;background:#0a0a0f;border:1px solid var(--line);border-radius:99px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.tab[aria-selected="true"]{background:var(--amber);border-color:var(--amber);color:#1a1204}
.bh{display:flex;flex-wrap:wrap;gap:12px 24px;justify-content:space-between;align-items:flex-end}
.bh .sym{font-family:var(--serif);font-style:italic;font-weight:800;font-size:28px;line-height:1.1}.bh .sub{color:var(--muted);font-size:12px}
.size{display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end}
.desk label.f{display:flex;flex-direction:column;gap:5px}
.desk input[type=number]{font:inherit;font-weight:500;color:var(--fg);background:#08080c;border:1px solid #2a2a36;padding:8px 10px;width:130px;min-width:0}
.stats{display:flex;flex-wrap:wrap;gap:6px 24px;color:var(--muted);font-size:12px}.stats b{color:var(--fg);font-weight:500}
.cmode{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.cmode button{background:#0c0c14;border:1px solid var(--line);color:var(--muted);padding:7px 11px;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase}.cmode button.on{background:var(--amber);color:#1a1204;border-color:var(--amber)}.cleg{font-size:11px;color:var(--muted)}svg.chart .cp-mark{font-size:11px}
.tbox{border-top:1px solid var(--line);margin-top:6px;padding-top:14px;display:flex;flex-direction:column;gap:10px}.tbox .trow{display:flex;gap:10px;flex-wrap:wrap}.tbox .trow .f{flex:1 1 140px;min-width:0}.tbox table{width:100%;border-collapse:collapse;font-size:12px}.tbox td{padding:6px 0;border-bottom:1px solid #15151c}.tbox td:last-child{text-align:right}.tbox .k{color:var(--muted)}
.scan{background:var(--card2);border:1px solid var(--line);padding:12px;display:flex;flex-direction:column;gap:10px;min-width:0}
.scan .srow{display:flex;gap:10px;flex-wrap:wrap;min-width:0}
.scan textarea{flex:1 1 260px;min-width:0;background:#08080c;border:1px solid var(--line);color:var(--fg);font:12px/1.4 var(--mono);padding:8px 10px;resize:vertical}
.scan textarea:focus{outline:2px solid var(--amber);outline-offset:1px}
.scan .sbtns{display:flex;gap:8px;flex-wrap:wrap;align-items:flex-start}
.sbtn{display:inline-block;padding:9px 12px;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;background:#0c0c14;border:1px solid #5a4214;color:var(--amber);cursor:pointer;text-decoration:none;font-family:inherit}
.sbtn:hover{background:#15110a}
.sstat{font-size:12px;color:var(--muted);display:flex;gap:14px;flex-wrap:wrap}
.sstat b.y{color:var(--green-t)}.sstat b.n{color:var(--red-t)}
.scan-ring{fill:none;stroke:var(--green-t);stroke-width:2}.scan-tag{font-weight:700;letter-spacing:.08em}
.chartbox{overflow-x:auto;background:#08080c;border:1px solid var(--line);padding:10px}
svg.chart{display:block;width:100%;min-width:520px;height:auto}
svg.chart text{font-family:var(--mono);font-size:10.5px;fill:var(--muted)}
.ln-price{fill:none;stroke:var(--fg);stroke-width:1.6}.ln-ema{fill:none;stroke:#38bdf8;stroke-width:1.4}.ln-rsi{fill:none;stroke:#7dd3fc;stroke-width:1.4}svg.chart .lt.ema{fill:#38bdf8}.vb{fill:#2a2a36}.vb.hot{fill:var(--amber)}
.lv{stroke-width:1;stroke-dasharray:4 3}.lv.trail{stroke:#a78bfa;stroke-dasharray:2 4}.lv.entry{stroke:var(--amber)}.lv.stop{stroke:var(--red-t)}.lv.tgt{stroke:var(--green-t)}
svg.chart .lt.trail{fill:#a78bfa}svg.chart .lt.entry{fill:var(--amber)}svg.chart .lt.stop{fill:var(--red-t)}svg.chart .lt.tgt{fill:var(--green-t)}.cdot{fill:var(--fg)}
.cols{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:28px}
@media (max-width:760px){.cols{grid-template-columns:minmax(0,1fr)}}
.lvls{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}
.desk table{width:100%;border-collapse:collapse;margin-top:14px}.desk td{padding:7px 0;border-bottom:1px solid var(--line);vertical-align:top}
.desk td:last-child{text-align:right}.desk tr:last-child td{border-bottom:0}.desk td.k{color:var(--muted)}
.chk{list-style:none;margin:12px 0 0;padding:0}
.chk li{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:baseline;padding:7px 0;border-bottom:1px solid var(--line)}.chk li:last-child{border-bottom:0}
.st{font-size:9px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;padding:2px 8px}
.st.pass{background:#0e2a1d;color:var(--green-t)}.st.unk{background:var(--amber-d);color:var(--amber)}.chk .v{color:var(--muted);font-size:11px;text-align:right}
.read{font-family:var(--serif);font-style:italic;color:var(--muted);font-size:15px;line-height:1.6;margin:0}
.note{border:1px solid #5a4214;background:#120d04;padding:12px 14px}.note b{color:var(--amber);letter-spacing:.12em;text-transform:uppercase;font-size:10px;margin-right:8px}
.tg{font-size:12px;color:var(--muted);margin-top:10px}.err{color:var(--red-t);font-size:12px;margin-top:10px}
footer{color:var(--dim);font-size:11px;display:flex;flex-direction:column;gap:4px;line-height:1.6}
.hermes{background:linear-gradient(135deg,#0b0b12 0%,#0a0f26 100%);border:1px solid #1f2433;padding:clamp(18px,3.4vw,32px);display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:28px;align-items:center}
@media (max-width:860px){.hermes{grid-template-columns:minmax(0,1fr)}}
.hbadges{display:flex;flex-wrap:wrap;gap:10px}
.hbadge{font-size:9px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;padding:4px 10px;border:1px solid #5a4214;background:var(--amber-d);color:var(--amber);display:inline-flex;align-items:center}
.hbadge.ok{border-color:#145a3a;background:#0b2a1c;color:var(--green-t)}.hbadge.off{border-color:#5a2a2a;background:#2a1010;color:var(--red-t)}
.hermes h3{margin:14px 0 10px;font-family:var(--serif);font-weight:800;font-size:clamp(26px,4vw,40px);line-height:1.1;text-wrap:balance}
.hdesc{margin:0 0 18px;color:var(--muted);font-size:12px;line-height:1.7;max-width:66ch}
.hbtns{display:flex;flex-wrap:wrap;gap:10px}
.hbtn{padding:8px 14px;background:#0c0c14;border:1px solid #262636;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
.hbtn.on{background:#f08a0b;border-color:#f08a0b;color:#1a1204}.hbtn:disabled{opacity:.45;cursor:not-allowed}
.eng{border:1px solid #1f2433;background:#080a16;padding:14px 16px}
.eng .r{display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid #141827;font-size:10px;letter-spacing:.06em}.eng .r:last-child{border-bottom:0}
.eng .r span:first-child{color:var(--dim);text-transform:uppercase;letter-spacing:.12em}.eng .r span:last-child{text-align:right}
.eng .es{font-family:var(--serif);font-style:italic;font-weight:800;font-size:16px}
.dgrid{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(0,1fr);gap:20px}
@media (max-width:860px){.dgrid{grid-template-columns:minmax(0,1fr)}}
.dpanel{background:var(--card);border:1px solid var(--line);padding:18px;display:flex;flex-direction:column;gap:14px;min-width:0}
.dh{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.dh h4{margin:0;font-family:var(--serif);font-weight:700;font-size:17px}.dh .s{color:var(--dim);font-size:10px;margin-top:2px}
.clr{background:#0c0c14;border:1px solid #262636;padding:5px 10px;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);flex:none}
.hist{display:flex;flex-direction:column;gap:12px;max-height:340px;min-height:160px;overflow-y:auto;padding-right:4px}
.msg{max-width:92%;padding:12px 14px;border:1px solid #1f2433;background:#0a0b14;min-width:0}.msg.u{align-self:flex-end;background:#140f05;border-color:#5a4214}
.msg .mh{font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim);margin-bottom:6px}.msg .mb{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;line-height:1.65}
.qf{display:flex;gap:10px}.qf input{flex:1;min-width:0;font:inherit;color:var(--fg);background:#08080c;border:1px solid #2a2a36;padding:10px 12px}
.qf button{background:#c47a0a;border:0;color:#1a1204;font-weight:700;letter-spacing:.12em;text-transform:uppercase;font-size:10px;padding:0 18px}.qf button:disabled{opacity:.5;cursor:wait}
.qq{display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim)}
.qq button{background:#0c0c14;border:1px solid #262636;padding:5px 10px;font-size:10px;color:var(--muted)}
.cxb{border:1px solid #1f2433;background:#09090f;padding:12px 14px}.cxb .ct{font-size:9px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);margin-bottom:6px}
.cxr{display:flex;justify-content:space-between;gap:12px;padding:5px 0;font-size:11px}.cxr span:first-child{color:var(--dim)}.cxr span:last-child{font-weight:700;text-align:right}
.cxr .g{color:var(--green-t)}.cxr .rd{color:var(--red-t)}.cxr .am{color:var(--amber)}
.cbtn{display:block;width:100%;text-align:center;padding:9px 12px;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-top:10px;background:#0c0c14;color:var(--amber)}
.cbtn.a{border:1px solid #7a5512}.cbtn.b{border:1px solid #5a4214}
.mon{position:fixed;right:12px;bottom:12px;z-index:20;display:flex;flex-wrap:wrap;align-items:center;gap:10px 12px;background:#120d04;border:1px solid #5a4214;padding:8px 12px;font-size:10px;max-width:calc(100% - 24px)}
.mon .st1{color:var(--green-t);font-weight:700}
.mon button{background:#1a1a22;border:1px solid #2a2a36;padding:4px 8px;font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
.mon button.go{background:#f08a0b;color:#1a1204;border-color:#f08a0b}
.toast{position:fixed;left:50%;transform:translateX(-50%);bottom:76px;background:#f2f2f5;color:#0a0a0e;padding:9px 16px;font-weight:700;font-size:12px;z-index:30;max-width:calc(100% - 32px);text-align:center}
`;
