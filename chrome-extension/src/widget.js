/* Floating on-page widget. Runs only on the sites listed in manifest.json, draws inside a shadow root so the
   page's CSS cannot touch it, reads the same saved settings as the popup, and makes no network requests. */
import { buildSnapshot, parseLevels, sizePosition, trailStop, planText, trailFor } from "../../src/core/desk";

(function () {
  "use strict";
  if (window.top !== window || document.getElementById("gsa-desk-host")) return;
  var D = buildSnapshot();
  var st = {}, open = false, sel = 0, host, root, panel;
  var fmt = function (n, d) { return Number(n).toLocaleString("en-IN", { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); };
  var num = parseFloat;

  var CSS = ':host{all:initial}*{box-sizing:border-box}' +
    '.w{position:fixed;z-index:2147483647;right:16px;bottom:16px;font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#f2f2f5}' +
    '.pill{display:flex;align-items:center;gap:8px;background:#121218;border:1px solid #f5a524;color:#f5a524;padding:7px 11px;cursor:pointer;font:inherit;letter-spacing:.08em;box-shadow:0 6px 24px rgba(0,0,0,.45)}' +
    '.pill b{color:#f2f2f5;font-weight:600}.up{color:#3ddc97}.dn{color:#ff3347}' +
    '.panel{width:300px;background:#0c0c10;border:1px solid #2a2a35;box-shadow:0 10px 36px rgba(0,0,0,.55)}' +
    '.hd{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-bottom:1px solid #2a2a35;cursor:grab;user-select:none}' +
    '.hd span{color:#f5a524;letter-spacing:.14em;font-size:10px}.hd button{background:none;border:0;color:#9a9aa8;cursor:pointer;font:inherit;padding:2px 6px}' +
    '.tabs{display:flex}.tabs button{flex:1;background:#121218;border:0;border-bottom:2px solid transparent;color:#9a9aa8;padding:7px 4px;cursor:pointer;font:inherit}' +
    '.tabs button[aria-selected=true]{color:#f5a524;border-bottom-color:#f5a524;background:#17171f}' +
    '.bd{padding:10px}.px{font-size:18px;font-weight:600}.sub{color:#9a9aa8;font-size:11px;margin:2px 0 8px}' +
    'table{width:100%;border-collapse:collapse;font:inherit;color:inherit}td{font:inherit;color:inherit;padding:3px 0;border-bottom:1px solid #1c1c25}td:last-child{text-align:right}td.k{color:#9a9aa8}' +
    '.lv{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:8px 0}.lv label{display:flex;flex-direction:column;gap:2px;font-size:9px;letter-spacing:.1em;color:#9a9aa8;text-transform:uppercase}' +
    'input{width:100%;background:#121218;border:1px solid #2a2a35;color:#f2f2f5;padding:4px;font:inherit}input:focus{outline:1px solid #f5a524}' +
    '.warn{color:#f5a524}.bad{color:#ff3347}.note{color:#9a9aa8;font-size:10px;margin:6px 0 0}' +
    '.row{display:flex;gap:6px;margin-top:8px}.btn{flex:1;background:#f5a524;color:#121218;border:0;padding:7px;cursor:pointer;font:inherit;font-weight:600;letter-spacing:.06em}.btn.g{background:none;color:#f5a524;border:1px solid #6b4a10}' +
    '.st{min-height:14px;color:#3ddc97;font-size:10px;margin-top:4px}';

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "class") e.className = attrs[k]; else if (k === "text") e.textContent = attrs[k];
      else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), attrs[k]); else e.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  }
  var store = {
    get: function (cb) { try { chrome.storage.local.get("gsa", function (r) { cb((r && r.gsa) || {}); }); } catch (e) { cb({}); } },
    set: function () { try { chrome.storage.local.set({ gsa: st }); } catch (e) { /* extension reloaded; ignore */ } }
  };

  function levels(t) { var o = (st.levels || {})[t.id] || {}; var g = function (k) { return o[k] !== undefined ? o[k] : String(t.levels[k]); }; return { entry: g("entry"), stop: g("stop"), t1: g("t1"), t2: g("t2") }; }
  function plan(t) {
    var L = parseLevels(levels(t)), z = sizePosition(L, st.capital != null ? st.capital : "500000", st.riskPct != null ? st.riskPct : (st.risk != null ? st.risk : "1"));
    return { L: L, risk: L.entry - L.stop, ok: !!z, qty: z ? z.qty : 0, cap: z ? z.cap : 0, rp: z ? z.rp : 0, z: z };
  }
  function trail(t) {
    var fixed = plan(t).L.stop, hi = (st.trailHigh || {})[t.id], p = trailFor(st, t.id);
    return trailStop(t.closes, t.close, p, hi, fixed) || trailStop(t.closes, t.close, "8", hi, fixed);
  }

  var status;
  function say(m) { if (status) { status.textContent = m; setTimeout(function () { status.textContent = ""; }, 3000); } }
  function copy(text, m) {
    var fb = function () { var ta = el("textarea"); ta.value = text; ta.style.cssText = "position:fixed;opacity:0"; root.appendChild(ta); ta.select(); var ok = false; try { ok = document.execCommand("copy"); } catch (e) { } ta.remove(); say(ok ? m : "Copy blocked on this page"); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { say(m); }, fb); else fb();
  }

  function draw() {
    if (!root) return;
    var old = root.querySelector(".w"); if (old) old.remove();
    var t = D.trades[sel], last = t.closes.length - 1, day = (t.close / t.prev - 1) * 100;
    var w = el("div", { "class": "w" });
    if (st.widgetPos) { w.style.left = st.widgetPos.x + "px"; w.style.top = st.widgetPos.y + "px"; w.style.right = "auto"; w.style.bottom = "auto"; }
    if (!open) {
      w.appendChild(el("button", { "class": "pill", type: "button", title: "Open the desk", onclick: function () { open = true; draw(); } }, [
        "GSA", el("b", { text: t.sym }), el("span", { "class": day >= 0 ? "up" : "dn", text: (day >= 0 ? "+" : "") + day.toFixed(1) + "%" })]));
      root.appendChild(w); return;
    }
    var P = plan(t), T = trail(t), body = el("div", { "class": "bd" });
    var rsi = t.rsi[last], ema = t.ema20[last];
    status = el("div", { "class": "st", role: "status" });
    body.appendChild(el("div", { "class": "px" }, ["₹" + fmt(t.close, 2) + " ", el("span", { "class": day >= 0 ? "up" : "dn", text: (day >= 0 ? "+" : "") + day.toFixed(2) + "%" })]));
    body.appendChild(el("div", { "class": "sub", text: t.mode + " · " + t.setup }));
    var lv = el("div", { "class": "lv" });
    [["entry", "Entry"], ["stop", "Stop"], ["t1", "T1"], ["t2", "T2"]].forEach(function (d) {
      var i = el("input", { type: "number", step: "any", "aria-label": d[1], value: levels(t)[d[0]] });
      i.addEventListener("change", function () { st.levels = st.levels || {}; (st.levels[t.id] = st.levels[t.id] || {})[d[0]] = i.value; store.set(); draw(); });
      lv.appendChild(el("label", {}, [d[1], i]));
    });
    body.appendChild(lv);
    var rows = [];
    if (P.ok) {
      rows.push(["Size", fmt(P.qty) + " sh at " + P.rp + "% risk"], ["Money at risk", "₹" + fmt(P.qty * P.risk)], ["Risk / share", "₹" + fmt(P.risk, 2) + " (" + (P.risk / P.L.entry * 100).toFixed(1) + "%)"],
        ["T1 / T2", ((P.L.t1 - P.L.entry) / P.risk).toFixed(1) + "R / " + ((P.L.t2 - P.L.entry) / P.risk).toFixed(1) + "R"]);
    }
    rows.push(["Trail " + T.p + "%", "₹" + fmt(T.stop, 2)], ["RSI 14", rsi.toFixed(0) + (rsi >= 70 ? " (overbought)" : rsi <= 30 ? " (oversold)" : "")],
      ["20 EMA", "₹" + fmt(ema) + " (" + ((t.close / ema - 1) * 100).toFixed(1) + "%)"]);
    var tbl = el("table", {}, rows.map(function (r) { return el("tr", {}, [el("td", { "class": "k", text: r[0] }), el("td", { text: r[1] })]); }));
    if (!P.ok) body.appendChild(el("p", { "class": "note bad", text: "Check the levels: stop below entry, T1 above entry, T2 at or above T1." }));
    body.appendChild(tbl);
    var c = t.candles[t.candles.length - 1];
    if (c) body.appendChild(el("p", { "class": "note", text: "Latest candle: " + c.name + " on " + c.date.slice(5).replace("-", "/") }));
    body.appendChild(el("div", { "class": "row" }, [
      el("button", { "class": "btn", type: "button", onclick: function () { var p = plan(t), tr = trail(t); copy(planText(t, p.L, p.z, tr), "Plan copied"); } }, ["Copy plan"]),
      el("button", { "class": "btn g", type: "button", onclick: function () { copy(t.sym, "Symbol copied"); } }, ["Copy symbol"])
    ]));
    body.appendChild(status);
    body.appendChild(el("p", { "class": "note", text: D.meta.label + " snapshot, not live. 200 DMA slope and RS rating not checked. Not advice." }));

    var hd = el("div", { "class": "hd", title: "Drag to move" }, [el("span", { text: "GROWTH STOCK ALPHA" }),
      el("span", {}, [el("button", { type: "button", "aria-label": "Collapse", onclick: function (e) { e.stopPropagation(); open = false; draw(); } }, ["–"]),
        el("button", { type: "button", "aria-label": "Hide until the page reloads", onclick: function (e) { e.stopPropagation(); host.remove(); } }, ["×"])])]);
    hd.addEventListener("pointerdown", function (e) {
      if (e.target.tagName === "BUTTON") return;
      var r = w.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
      hd.setPointerCapture(e.pointerId);
      var mv = function (ev) { var x = Math.min(Math.max(0, ev.clientX - dx), innerWidth - 60), y = Math.min(Math.max(0, ev.clientY - dy), innerHeight - 40); w.style.cssText += ";left:" + x + "px;top:" + y + "px;right:auto;bottom:auto"; st.widgetPos = { x: x, y: y }; };
      var up = function () { hd.removeEventListener("pointermove", mv); hd.removeEventListener("pointerup", up); store.set(); };
      hd.addEventListener("pointermove", mv); hd.addEventListener("pointerup", up);
    });
    var tabs = el("div", { "class": "tabs", role: "tablist" }, D.trades.map(function (x, i) {
      return el("button", { type: "button", role: "tab", "aria-selected": String(i === sel), onclick: function () { sel = i; st.tab = i; store.set(); draw(); } }, [x.sym]);
    }));
    panel = el("div", { "class": "panel" }, [hd, tabs, body]);
    w.appendChild(panel); root.appendChild(w);
  }

  function mount() {
    if (document.getElementById("gsa-desk-host")) return;
    host = document.createElement("div"); host.id = "gsa-desk-host";
    root = host.attachShadow({ mode: "open" });
    root.appendChild(el("style", { text: CSS }));
    (document.body || document.documentElement).appendChild(host);
    draw();
  }
  store.get(function (s) {
    st = s || {};
    if (st.showWidget === false) return;
    sel = Math.min(Math.max(parseInt(st.tab, 10) || 0, 0), D.trades.length - 1);
    mount();
  });
  try {
    chrome.storage.onChanged.addListener(function (ch, area) {
      if (area !== "local" || !ch.gsa) return;
      st = ch.gsa.newValue || {};
      if (st.showWidget === false) { if (host) { host.remove(); host = null; root = null; } return; }
      if (!document.getElementById("gsa-desk-host")) mount(); else draw();
    });
  } catch (e) { /* ignore */ }
})();
