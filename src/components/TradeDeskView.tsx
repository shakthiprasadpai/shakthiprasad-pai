import { useState, useMemo, useEffect, useRef } from "react";
import DeskTools, { TOOLS_CSS } from "./DeskTools";

// Screen output from NSE bhavcopy, session of 9 Nov 2026. Swap TRADES for your own screener results.
const TRADES = [
  {
    id: "swing", mode: "Swing · days to weeks", sym: "LAURUSLABS", name: "Laurus Labs",
    setup: "Pivot breakout from a tight base",
    close: 2454, prev: 2370, hi52: 2480, lo52: 917.95, ma: [2044.9, 1647.4, 1488.1],
    L: { entry: 2470, stop: 2320, t1: 2770, t2: 2920 },
    closes: [1945,1969,1926.9,1905.5,1948.1,1954,2017.5,2006.5,2034,2026.2,2007,2010.7,1979,1980,1984,1971.4,2050,2052.8,1997.9,2036.6,2069.2,2059.4,2036.9,2018.5,2060.1,2069,2012.5,2002.5,1970,2058.9,2142,2181.9,2244,2405.5,2348,2323,2323.8,2346,2340,2454],
    vols: [1.07,2.28,1.54,2.87,1.65,2.66,2.17,1.49,1.36,1.39,1.44,0.95,2.43,1.40,1.46,1.37,2.20,1.50,1.39,1.36,1.42,1.14,1.30,0.86,1.61,1.13,1.28,1.54,1.89,1.86,3.12,2.20,2.90,7.91,3.05,4.03,3.22,1.45,1.45,4.03],
    checks: [["Price above 150 and 200 DMA","₹2,454 vs ₹1,647 / ₹1,488","pass"],["150 DMA above 200 DMA","1,647 > 1,488","pass"],["200 DMA rising for 1+ month","not checked","unk"],["50 DMA above 150 and 200","₹2,045","pass"],["Price above 50 DMA","+20.0%","pass"],["30%+ above 52-week low","+167% (₹918)","pass"],["Within 25% of 52-week high","−1.0% (₹2,480)","pass"],["RS rating 70 or higher","not checked","unk"]],
    base: "Six-week base at ₹1,900–2,090. Breakout on 30 Oct on 7.9M shares, four quiet days at ₹2,320–2,350, then a new high on 9 Nov on 4.0M shares (2.0x average).",
    note: "About 20% above its 50 DMA, so it is extended. Size down, or wait for a low-volume pullback to ₹2,350–2,400 if a 6% stop is too wide.",
    targets: "Sell a third at T1, trail the rest under the 10-day low.",
  },
  {
    id: "intra", mode: "Intraday · square off by 3:15 pm", sym: "SAILIFE", name: "Sai Life Sciences",
    setup: "Prior-high break on heavy volume",
    close: 1836.8, prev: 1744, hi52: 1897.3, lo52: 783.85, ma: [1538.1, 1313.0, 1217.8],
    L: { entry: 1900, stop: 1855, t1: 1960, t2: 2000 },
    closes: [1591.1,1585,1541.5,1539.1,1545.7,1600.5,1608,1600.5,1609.6,1594.9,1592.2,1582.8,1559.9,1524.5,1541.2,1511.3,1558.1,1561.8,1505.6,1487.9,1471.3,1462.3,1432.1,1394.7,1389.4,1395.9,1393.6,1395.9,1395.3,1445.3,1486.2,1487.2,1495.7,1557.5,1542.3,1558.2,1546.1,1594.5,1785.1,1836.8],
    vols: [1.17,1.17,0.43,0.80,0.44,0.87,0.37,0.27,0.27,0.52,0.27,0.27,0.36,0.54,0.58,0.33,0.28,0.66,0.51,0.43,0.38,0.72,0.41,0.63,0.64,0.29,0.43,0.18,0.67,0.28,0.23,0.38,0.28,1.26,0.63,0.40,0.33,0.55,13.23,10.12],
    checks: [["Price above 150 and 200 DMA","₹1,837 vs ₹1,313 / ₹1,218","pass"],["150 DMA above 200 DMA","1,313 > 1,218","pass"],["200 DMA rising for 1+ month","not checked","unk"],["50 DMA above 150 and 200","₹1,538","pass"],["Price above 50 DMA","+19.4%","pass"],["30%+ above 52-week low","+134% (₹784)","pass"],["Within 25% of 52-week high","−3.2% (₹1,897)","pass"],["RS rating 70 or higher","not checked","unk"]],
    base: "Flat at ₹1,390–1,600 for two months, then 13.2M shares on 6 Nov and 10.1M on 9 Nov against under 1M on a normal day. Turnover on 9 Nov was ₹1,866 cr. The 9 Nov high of ₹1,897 was sold into (close ₹1,837).",
    note: "Up about 15% in two sessions. Skip it on a gap-up above 3%, and take no entry before 9:30. Alternative: buy a hold at ₹1,815–1,825 with a stop at ₹1,785.",
    targets: "Book half at T1, move the stop to cost, exit the rest at T2 or 3:15 pm.",
  },
];

const fmt = (n, d = 0) => Number(n).toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

// ---- Hermes co-pilot ------------------------------------------------------
// askModel(messages, onText) must resolve to the reply text. messages = [{ role: "user" | "assistant", content }].
// Pass your own as <App askModel={...} /> to use any provider (Gemini, Claude API, etc.) through your own backend.
// The default only works when the page is hosted as a claude.ai artifact with the "sample" capability.
async function defaultAskModel(messages, onText) {
  const sample = await (window as any).claude?.use?.("sample");
  if (!sample) throw Object.assign(new Error("unavailable"), { code: "unavailable" });
  const r = await sample(messages, { cache: false, onText: ({ text }) => onText?.(text) });
  return r.text;
}

// Provider-neutral adapter: POSTs { messages } to a small backend you run and expects { text } back.
// Keep the provider key (Azure AI Foundry, Gemini, Claude, ...) on that backend, never in the page.
//   <App askModel={makeProxyAskModel("/api/hermes")} />
export const makeProxyAskModel = (url, headers = {}) => async (messages, onText) => {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify({ messages }) });
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { code: res.status === 429 ? "rate_limited" : "http_error" });
  const { text } = await res.json();
  onText?.(text);
  return text;
};

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

function Chart({ t, L, scan, trail }) {
  const ss = scan ? (scan.has(t.sym) ? "yes" : "no") : "none";
  const W = 640, ml = 8, mr = 84, top = 10, ph = 200, vt = 228, vh = 56, n = t.closes.length;
  const lo = Math.min(...t.closes, L.stop, trail ?? Infinity) * 0.995, hi = Math.max(...t.closes, L.t2) * 1.005;
  const x = (i) => ml + (i * (W - ml - mr)) / (n - 1);
  const y = (v) => top + ((hi - v) / (hi - lo)) * ph;
  const med = median(t.vols), vmax = Math.max(...t.vols), bw = ((W - ml - mr) / n) * 0.62;
  const lv = [["entry", L.entry, "Entry"], ["stop", L.stop, "Stop"], ["tgt", L.t1, "T1"], ["tgt", L.t2, "T2"], ...(trail ? [["trail", trail, "Trail"]] : [])];
  const lab = lv.map(([k, v, name]) => ({ k, y: y(v), txt: `${name} ${fmt(v)}` })).sort((p, q) => p.y - q.y);
  for (let i = 1; i < lab.length; i++) if (lab[i].y - lab[i - 1].y < 13) lab[i].y = lab[i - 1].y + 13;
  return (
    <svg className="chart" viewBox="0 0 640 300" role="img" aria-label={`Last 40 sessions of ${t.sym}`}>
      {[0, 0.25, 0.5, 0.75, 1].map((f) => <line key={f} x1={ml} x2={W - mr} y1={y(lo + (hi - lo) * f)} y2={y(lo + (hi - lo) * f)} stroke="#1a1a22" />)}
      {t.vols.map((v, i) => {
        const h = (v / vmax) * vh;
        return <rect key={i} className={v > 2 * med ? "vb hot" : "vb"} x={x(i) - bw / 2} y={vt + vh - h} width={bw} height={h} />;
      })}
      <text x={ml + 62} y={vt - 4}>VOLUME (AMBER = OVER 2X MEDIAN)</text>
      {lv.map(([k, v], i) => <line key={i} className={`lv ${k}`} x1={ml} x2={W - mr} y1={y(v)} y2={y(v)} />)}
      <polyline className="ln-price" points={t.closes.map((c, i) => `${x(i)},${y(c)}`).join(" ")} />
      <circle className="cdot" cx={x(n - 1)} cy={y(t.close)} r="3.5" />
      {ss === "yes" && <circle className="scan-ring" cx={x(n - 1)} cy={y(t.close)} r="9" />}
      {ss !== "none" && <text className="scan-tag" x={ml + 4} y={top + 26} style={{ fill: ss === "yes" ? "#3ddc97" : "#ff3347" }}>{ss === "yes" ? "CHARTINK SCAN: IN" : "CHARTINK SCAN: NOT IN"}</text>}
      {lab.map((l, i) => <text key={i} className={`lt ${l.k}`} x={W - mr + 6} y={l.y + 3.5}>{l.txt}</text>)}
      <text x={ml} y={top + ph + 14}>10 SEP</text>
      <text x={W - mr} y={top + ph + 14} textAnchor="end">9 NOV 2026</text>
    </svg>
  );
}

export default function App({ askModel = defaultAskModel, onNavigate, onOpenStageScan }) {
  const [sel, setSel] = useState(0);
  const [lv, setLv] = useState(() => Object.fromEntries(TRADES.map((t) => [t.id, { ...t.L }])));
  const [capital, setCapital] = useState("500000");
  const [riskPct, setRiskPct] = useState("1");
  const [muted, setMuted] = useState(true);
  const [trailPct, setTrailPct] = useState("8");
  const [trailHigh, setTrailHigh] = useState("");
  const [scanTxt, setScanTxt] = useState(() => { try { return localStorage.getItem("gsa-scan") || ""; } catch { return ""; } });
  const scan = useMemo(() => parseScan(scanTxt), [scanTxt]);
  const onScan = (v) => { setScanTxt(v); try { localStorage.setItem("gsa-scan", v); } catch {} };
  const [toast, setToast] = useState("");
  const timer = useRef();
  const [ready, setReady] = useState(askModel !== defaultAskModel ? true : null);
  const [hist, setHist] = useState([]);
  const [msgs, setMsgs] = useState(() => [{ r: "a", t: GREETING, time: hhmm() }]);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const histRef = useRef(), inputRef = useRef(), dialogueRef = useRef(), benchRef = useRef();

  useEffect(() => {
    if (askModel !== defaultAskModel) return;
    (async () => { try { setReady(!!(await (window as any).claude?.use?.("sample"))); } catch { setReady(false); } })();
  }, [askModel]);
  useEffect(() => { histRef.current?.scrollTo({ top: histRef.current.scrollHeight }); }, [msgs]);
  const chartRef = useRef(), tplRef = useRef(), scanRef = useRef();

  const t = TRADES[sel];
  const raw = lv[t.id];
  const L = { entry: parseFloat(raw.entry), stop: parseFloat(raw.stop), t1: parseFloat(raw.t1), t2: parseFloat(raw.t2) };
  const ok = Object.values(L).every((v) => isFinite(v) && v > 0) && L.entry > L.stop && L.t1 > L.entry && L.t2 >= L.t1;
  const passN = t.checks.filter((c) => c[2] === "pass").length;
  const chg = (t.close / t.prev - 1) * 100;

  const size = useMemo(() => {
    if (!ok) return null;
    const cap = parseFloat(capital) || 0, rp = parseFloat(riskPct) || 0, risk = L.entry - L.stop;
    let qty = Math.floor((cap * rp) / 100 / risk);
    const maxq = Math.floor(cap / L.entry), capped = qty > maxq;
    if (capped) qty = maxq;
    return { cap, risk, qty, capped, value: qty * L.entry, r1: (L.t1 - L.entry) / risk, r2: (L.t2 - L.entry) / risk };
  }, [ok, L.entry, L.stop, L.t1, L.t2, capital, riskPct]);

  // Trailing stop: highest price since entry x (1 - trail%). Until you enter a real high, the highest close in the 40 sessions is used.
  useEffect(() => { setTrailHigh(""); }, [sel]); // a high entered for one stock must not carry to the other
  const trailInfo = useMemo(() => {
    const p = parseFloat(trailPct);
    if (!(p > 0 && p < 50)) return null;
    const dataHigh = Math.max(...t.closes);
    const hi = parseFloat(trailHigh) > 0 ? parseFloat(trailHigh) : dataHigh;
    const stop = hi * (1 - p / 100);
    const initial = ok ? L.stop : NaN;
    const activates = isFinite(initial) ? initial / (1 - p / 100) : NaN; // the high at which the trail overtakes the fixed stop
    return { p, hi, stop, fromClose: (1 - stop / t.close) * 100, binding: isFinite(initial) && stop > initial, activates, usingData: !(parseFloat(trailHigh) > 0), dataHigh };
  }, [trailPct, trailHigh, t, ok, L.stop]);

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
    const h = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); next(); } };
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
        const l = Object.fromEntries(Object.entries(lv[x.id]).map(([k, v]) => [k, parseFloat(v as string)]));
        const risk = l.entry - l.stop;
        const qty = Math.min(Math.floor((cap * rp) / 100 / risk), Math.floor(cap / l.entry));
        return {
          symbol: x.sym, name: x.name, style: x.mode, setup: x.setup, close: x.close, prevClose: x.prev,
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
    <div className="desk">
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
          <div className="chartbox" ref={chartRef}>{ok ? <Chart t={t} L={L} scan={scan} trail={trailInfo?.stop} /> : null}</div>
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
                  <label className="f"><span className="lab">Trail %</span><input type="number" min="1" max="49" step="0.5" value={trailPct} onChange={(e) => setTrailPct(e.target.value)} /></label>
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
                <div className="tg">{trailInfo?.usingData ? "No real high entered, so the highest close in the data is used. Enter your own high after you are in the trade. " : ""}Raise the stop only; never lower it. For SAILIFE, an intraday trade, an 8% trail is far wider than the day's range and works as a swing exit only.</div>
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
          trades={TRADES} levels={lv} capital={capital} riskPct={riskPct} scan={scan}
          onSelect={setSel} say={say} copy={copy} beep={beep} muted={muted}
          onNavigate={onNavigate} onOpenStageScan={onOpenStageScan}
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
.ln-price{fill:none;stroke:var(--fg);stroke-width:1.6}.vb{fill:#2a2a36}.vb.hot{fill:var(--amber)}
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
