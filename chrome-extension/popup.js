(function () {
  "use strict";
  var D = window.GSA_DATA, I = window.GSAInd;
  var DEFAULTS = { showWidget: true, capital: 500000, risk: 1, trailPct: 8, appUrl: "", levels: {}, trailHigh: {}, tab: 0 };
  var st = JSON.parse(JSON.stringify(DEFAULTS));

  /* ---------- storage: chrome.storage when installed, localStorage when opened as a plain page ---------- */
  var hasChrome = typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
  function loadState() {
    return new Promise(function (resolve) {
      try {
        if (hasChrome) chrome.storage.local.get("gsa", function (r) { resolve((r && r.gsa) || {}); });
        else resolve(JSON.parse(localStorage.getItem("gsa-desk-ext") || "{}"));
      } catch (e) { resolve({}); }
    });
  }
  var saveTimer;
  function saveState() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try {
        if (hasChrome) chrome.storage.local.set({ gsa: st });
        else localStorage.setItem("gsa-desk-ext", JSON.stringify(st));
      } catch (e) { /* storage can be unavailable; the popup still works for this session */ }
    }, 200);
  }

  /* ---------- helpers ---------- */
  var $ = function (id) { return document.getElementById(id); };
  var fmt = function (n, d) { return Number(n).toLocaleString("en-IN", { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); };
  var num = function (v) { return parseFloat(v); };
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "class") el.className = attrs[k];
      else if (k === "text") el.textContent = attrs[k];
      else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2), attrs[k]);
      else el.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c != null) el.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return el;
  }
  var statusTimer;
  function say(msg) {
    $("status").textContent = msg;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(function () { $("status").textContent = ""; }, 3500);
  }
  function copy(text, msg) {
    function fallback() {
      var ta = h("textarea", { "aria-hidden": "true" });
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand("copy"); } catch (e) { /* ignore */ }
      ta.remove(); say(ok ? msg : "Copy was blocked by the browser");
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { say(msg); }, fallback);
    else fallback();
  }

  /* ---------- plan maths ---------- */
  function levelsFor(t) {
    var s = st.levels[t.id] || {};
    var pick = function (k) { return s[k] !== undefined ? s[k] : String(t.levels[k]); };
    return { entry: pick("entry"), stop: pick("stop"), t1: pick("t1"), t2: pick("t2") };
  }
  function plan(t) {
    var raw = levelsFor(t), L = { entry: num(raw.entry), stop: num(raw.stop), t1: num(raw.t1), t2: num(raw.t2) };
    var cap = num(st.capital) || 0, rp = num(st.risk) || 0, risk = L.entry - L.stop;
    var valid = [L.entry, L.stop, L.t1, L.t2].every(function (v) { return isFinite(v) && v > 0; }) && risk > 0 && L.t1 > L.entry && L.t2 >= L.t1;
    var qty = valid ? Math.floor((cap * rp) / 100 / risk) : 0;
    qty = Math.min(qty, Math.floor(cap / L.entry) || 0);
    return { L: L, raw: raw, risk: risk, valid: valid, qty: qty, cap: cap, rp: rp };
  }
  function trail(t) {
    var hi = num(st.trailHigh[t.id]), usingData = !(isFinite(hi) && hi > 0);
    if (usingData) hi = Math.max.apply(null, t.closes);
    var p = num(st.trailPct); if (!(p > 0 && p < 100)) p = 8;
    return { hi: hi, p: p, stop: hi * (1 - p / 100), usingData: usingData };
  }

  /* ---------- sparkline ---------- */
  var NS = "http://www.w3.org/2000/svg";
  function s(tag, attrs, text) {
    var el = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    if (text != null) el.textContent = text;
    return el;
  }
  function spark(t, P, T) {
    var W = 396, H = 138, ml = 6, mr = 70, top = 8, bot = 18, n = t.closes.length;
    var ema = t.ema20.filter(function (v) { return v != null; });
    var vals = t.closes.concat(ema, [P.L.entry, P.L.stop, P.L.t1, T.stop].filter(isFinite));
    var lo = Math.min.apply(null, vals) * 0.995, hi = Math.max.apply(null, vals) * 1.005;
    var x = function (i) { return ml + (i * (W - ml - mr)) / (n - 1); };
    var y = function (v) { return top + ((hi - v) / (hi - lo)) * (H - top - bot); };
    var svg = s("svg", { "class": "spark", viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Last " + n + " sessions of " + t.sym + " with the 20 EMA and your levels" });
    var lines = [["entry", P.L.entry, "#f5a524", "Entry"], ["stop", P.L.stop, "#ff3347", "Stop"], ["t1", P.L.t1, "#3ddc97", "T1"], ["trail", T.stop, "#a78bfa", "Trail"]].filter(function (l) { return isFinite(l[1]); });
    lines.forEach(function (l) { svg.appendChild(s("line", { x1: ml, x2: W - mr, y1: y(l[1]), y2: y(l[1]), stroke: l[2], "stroke-width": 1, "stroke-dasharray": "4 3" })); });
    var labs = lines.map(function (l) { return { y: y(l[1]), c: l[2], t: l[3] + " " + fmt(l[1]) }; }).sort(function (a, b) { return a.y - b.y; });
    for (var i = 1; i < labs.length; i++) if (labs[i].y - labs[i - 1].y < 11) labs[i].y = labs[i - 1].y + 11;
    labs.forEach(function (l) { var tx = s("text", { x: W - mr + 4, y: l.y + 3 }, l.t); tx.style.fill = l.c; svg.appendChild(tx); });
    var pts = function (arr) { return arr.map(function (v, k) { return v == null ? null : x(k) + "," + y(v); }).filter(Boolean).join(" "); };
    svg.appendChild(s("polyline", { points: pts(t.ema20), fill: "none", stroke: "#38bdf8", "stroke-width": 1.4, "stroke-dasharray": "5 3" }));
    svg.appendChild(s("polyline", { points: pts(t.closes), fill: "none", stroke: "#f2f2f5", "stroke-width": 1.6 }));
    svg.appendChild(s("circle", { cx: x(n - 1), cy: y(t.closes[n - 1]), r: 3, fill: "#f2f2f5" }));
    svg.appendChild(s("text", { x: ml, y: H - 4 }, t.dates[0].slice(5).replace("-", "/")));
    svg.appendChild(s("text", { x: W - mr, y: H - 4, "text-anchor": "end" }, t.dates[n - 1].slice(5).replace("-", "/")));
    return svg;
  }

  /* ---------- Obsidian note, same fields as the desk's note ---------- */
  function note(t, P) {
    var pass = t.checks.filter(function (c) { return c[2] === "pass"; }).length;
    return "---\ntype: minervini-sepa-setup\nticker: " + t.sym + "\nname: \"" + t.name + "\"\nexchange: NSE\ncurrent_price: " + t.close +
      "\npivot_price: " + P.L.entry + "\nstop_loss: " + P.L.stop + "\ntarget_1: " + P.L.t1 + "\ntarget_2: " + P.L.t2 + "\ntrend_score: " + pass +
      "\nrsi_14: " + t.rsi[t.rsi.length - 1] + "\nema_20: " + t.ema20[t.ema20.length - 1] + "\ncreated_date: \"" + new Date().toISOString().slice(0, 10) +
      "\"\ntags:\n  - trading/minervini\n---\n\n# " + t.sym + ": " + t.name + " (NSE)\n\n- Pattern: " + t.setup + "\n- Entry ₹" + fmt(P.L.entry, 2) + ", stop ₹" + fmt(P.L.stop, 2) +
      ", T1 ₹" + fmt(P.L.t1, 2) + ", T2 ₹" + fmt(P.L.t2, 2) + "\n- Size at ₹" + fmt(P.cap) + " and " + P.rp + "% risk: " + P.qty + " shares\n- Not checked: 200 DMA slope, RS rating\n";
  }
  function planText(t, P, T) {
    return t.sym + " (" + t.mode + ")\nEntry ₹" + fmt(P.L.entry, 2) + "  Stop ₹" + fmt(P.L.stop, 2) + "  T1 ₹" + fmt(P.L.t1, 2) + "  T2 ₹" + fmt(P.L.t2, 2) +
      "\nQty " + P.qty + " at ₹" + fmt(P.cap) + " capital and " + P.rp + "% risk" + (P.valid ? " (risk ₹" + fmt(P.qty * P.risk) + ")" : "") +
      "\nTrailing stop " + T.p + "% below ₹" + fmt(T.hi, 2) + " = ₹" + fmt(T.stop, 2);
  }

  /* ---------- view ---------- */
  var sel = 0;
  function render() {
    var t = D.trades[sel];
    var view = $("view"); view.textContent = "";
    var last = t.closes.length - 1, day = (t.close / t.prev - 1) * 100;
    var rsi = t.rsi[last], ema = t.ema20[last], aboveEma = (t.close / ema - 1) * 100;
    var pass = t.checks.filter(function (c) { return c[2] === "pass"; }).length;
    var med = t.vols.slice().sort(function (a, b) { return a - b; })[Math.floor(t.vols.length / 2)];

    var chartBox = h("div"), planBox = h("div"), trailBox = h("div");

    // header + chart
    view.appendChild(h("section", { "class": "card" }, [
      h("div", { "class": "hd" }, [h("span", { "class": "price", text: "₹" + fmt(t.close, 2) }), h("span", { "class": "chg " + (day >= 0 ? "up" : "dn"), text: (day >= 0 ? "+" : "") + day.toFixed(2) + "% on the day" })]),
      h("p", { "class": "setup", text: t.mode + " · " + t.setup }),
      chartBox,
      h("div", { "class": "legend" }, [
        h("span", {}, [h("i", { style: "border-color:#f2f2f5" }), "Close"]), h("span", {}, [h("i", { style: "border-color:#38bdf8;border-top-style:dashed" }), "20 EMA"]),
        h("span", {}, [h("i", { style: "border-color:#a78bfa;border-top-style:dashed" }), "Trail"])
      ])
    ]));

    // indicators
    var rsiClass = rsi >= 70 ? "warn" : rsi <= 30 ? "bad" : "";
    view.appendChild(h("section", { "class": "grid", "aria-label": "Indicators" }, [
      h("div", { "class": "stat" }, [h("div", { "class": "k", text: "RSI (14)" }), h("div", { "class": "v " + rsiClass, text: rsi.toFixed(0) }), h("div", { "class": "s", text: rsi >= 70 ? "overbought" : rsi <= 30 ? "oversold" : "neutral" })]),
      h("div", { "class": "stat" }, [h("div", { "class": "k", text: "20 EMA" }), h("div", { "class": "v", text: "₹" + fmt(ema) }), h("div", { "class": "s " + (aboveEma > 0 ? "good" : "bad"), text: Math.abs(aboveEma).toFixed(1) + "% " + (aboveEma > 0 ? "above" : "below") })]),
      h("div", { "class": "stat" }, [h("div", { "class": "k", text: "Template" }), h("div", { "class": "v", text: pass + "/" + D.meta.checkedRules }), h("div", { "class": "s", text: "2 not checked" })]),
      h("div", { "class": "stat" }, [h("div", { "class": "k", text: "Stage 2" }), h("div", { "class": "v " + (t.stage2 ? "good" : "bad"), text: t.stage2 ? "Yes" : "No" }), h("div", { "class": "s", text: t.ext50.toFixed(0) + "% over 50 DMA" })]),
      h("div", { "class": "stat" }, [h("div", { "class": "k", text: "Volume" }), h("div", { "class": "v", text: (t.vols[last] / med).toFixed(1) + "x" }), h("div", { "class": "s", text: "vs 40-day median" })]),
      h("div", { "class": "stat" }, [h("div", { "class": "k", text: "52w high" }), h("div", { "class": "v", text: Math.abs(t.fromHigh).toFixed(1) + "%" }), h("div", { "class": "s", text: "below the high" })])
    ]));

    // levels
    var inputs = {};
    var lvRow = h("div", { "class": "lv" });
    [["entry", "Entry", "entry"], ["stop", "Stop", "stop"], ["t1", "T1", "tgt"], ["t2", "T2", "tgt"]].forEach(function (d) {
      var inp = h("input", { type: "number", step: "any", inputmode: "decimal", "aria-label": d[1] + " price", value: levelsFor(t)[d[0]] });
      inp.addEventListener("input", function () { (st.levels[t.id] = st.levels[t.id] || {})[d[0]] = inp.value; saveState(); update(); });
      inputs[d[0]] = inp;
      lvRow.appendChild(h("label", { "class": d[2] }, [d[1], inp]));
    });
    view.appendChild(h("section", { "class": "card" }, [h("h3", { text: "Trade plan" }), lvRow, planBox]));

    // trailing stop
    var hiInp = h("input", { type: "number", step: "any", inputmode: "decimal", placeholder: "highest close", "aria-label": "Highest price since entry", value: st.trailHigh[t.id] || "" });
    hiInp.addEventListener("input", function () { st.trailHigh[t.id] = hiInp.value; saveState(); update(); });
    view.appendChild(h("section", { "class": "card" }, [h("h3", { text: "Trailing stop" }), h("label", { "class": "lv", style: "display:flex;flex-direction:column;gap:4px;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#9a9aa8" }, ["Highest price since you entered", hiInp]), trailBox]));

    // candles + alerts
    var cList = t.candles.length ? h("ul", {}, t.candles.slice().reverse().map(function (c) {
      return h("li", {}, [h("span", {}, [h("span", { "class": "dot " + (c.bias === "bull" ? "ok" : c.bias === "bear" ? "bad" : "") }), c.name]), h("span", { "class": "dim", text: c.date.slice(5).replace("-", "/") })]);
    })) : h("p", { "class": "note", text: "No candlestick pattern in the last 10 sessions." });
    view.appendChild(h("section", { "class": "card" }, [h("h3", { text: "Candle patterns, last 10 sessions" }), cList, h("p", { "class": "note", text: "A pattern is a prompt to read the chart, not a signal on its own." })]));
    view.appendChild(h("section", { "class": "card" }, [h("h3", { text: "Alerts on the last close" }), h("ul", {}, t.alerts.map(function (a) {
      return h("li", {}, [h("span", {}, [h("span", { "class": "dot " + (a.sev === "ok" ? "ok" : a.sev === "warn" ? "warn" : "") }), a.txt])]);
    })), h("p", { "class": "note", text: t.note })]));

    // actions
    view.appendChild(h("div", { "class": "row" }, [
      h("button", { "class": "btn", type: "button", onclick: function () { var P = plan(t); copy(planText(t, P, trail(t)), "Plan copied"); } }, ["Copy plan"]),
      h("button", { "class": "btn ghost", type: "button", onclick: function () { copy(note(t, plan(t)), "Obsidian note copied"); } }, ["Copy Obsidian note"])
    ]));

    function update() {
      var P = plan(t), T = trail(t);
      chartBox.textContent = ""; chartBox.appendChild(spark(t, P, T));
      planBox.textContent = "";
      if (!P.valid) {
        planBox.appendChild(h("p", { "class": "note bad", text: "Check the levels: the stop must be below the entry, T1 above the entry and T2 at or above T1." }));
      } else {
        var rows = [
          ["Risk per share", "₹" + fmt(P.risk, 2) + " (" + (P.risk / P.L.entry * 100).toFixed(1) + "%)"],
          ["Position size", fmt(P.qty) + " shares" + (P.qty * P.L.entry >= P.cap ? " (capped by capital)" : "")],
          ["Money at risk", "₹" + fmt(P.qty * P.risk)],
          ["Position value", "₹" + fmt(P.qty * P.L.entry)],
          ["T1 reward", "₹" + fmt((P.L.t1 - P.L.entry) * P.qty) + " (" + ((P.L.t1 - P.L.entry) / P.risk).toFixed(1) + "R)"],
          ["T2 reward", "₹" + fmt((P.L.t2 - P.L.entry) * P.qty) + " (" + ((P.L.t2 - P.L.entry) / P.risk).toFixed(1) + "R)"]
        ];
        planBox.appendChild(h("table", {}, rows.map(function (r) { return h("tr", {}, [h("td", { "class": "k", text: r[0] }), h("td", { text: r[1] })]); })));
        planBox.appendChild(h("p", { "class": "note", text: "Sized at ₹" + fmt(P.cap) + " and " + P.rp + "% risk. Change both in Settings." }));
      }
      trailBox.textContent = "";
      var rows2 = [["Trailing stop", "₹" + fmt(T.stop, 2) + " (" + T.p + "% below ₹" + fmt(T.hi, 2) + ")"], ["Versus last close", (T.stop / t.close * 100 - 100).toFixed(1) + "%"]];
      if (P.valid) {
        rows2.push(["Versus fixed stop ₹" + fmt(P.L.stop, 2), T.stop > P.L.stop ? "Trail is higher: it now protects more" : "Fixed stop is still higher"]);
        if (P.qty) rows2.push([T.stop > P.L.entry ? "Profit locked in if hit" : "Loss if trail is hit", "₹" + fmt(Math.abs(T.stop - P.L.entry) * P.qty)]);
      }
      trailBox.appendChild(h("table", {}, rows2.map(function (r) { return h("tr", {}, [h("td", { "class": "k", text: r[0] }), h("td", { text: r[1] })]); })));
      if (T.usingData) trailBox.appendChild(h("p", { "class": "note", text: "No high entered, so the highest close in the data is used. Enter your own high after you are in the trade." }));
    }
    update();
  }

  function renderTabs() {
    var tabs = $("tabs"); tabs.textContent = "";
    D.trades.forEach(function (t, i) {
      tabs.appendChild(h("button", { type: "button", role: "tab", "aria-selected": String(i === sel), onclick: function () { sel = i; st.tab = i; saveState(); renderTabs(); render(); } }, [t.sym, h("small", { text: t.id === "swing" ? "Swing" : "Intraday" })]));
    });
  }

  /* ---------- settings ---------- */
  function bindSettings() {
    var map = { capital: "capital", risk: "risk", trailPct: "trailPct", appUrl: "appUrl" };
    Object.keys(map).forEach(function (id) {
      var el = $(id); el.value = st[id];
      el.addEventListener("input", function () { st[id] = el.value; saveState(); if (id === "appUrl") link(); else render(); });
    });
    var sw = $("showWidget"); sw.checked = st.showWidget !== false;
    sw.addEventListener("change", function () { st.showWidget = sw.checked; saveState(); });
    $("gear").addEventListener("click", function () {
      var open = $("settings").hidden; $("settings").hidden = !open; $("gear").setAttribute("aria-expanded", String(open));
    });
    $("reset").addEventListener("click", function () {
      st = JSON.parse(JSON.stringify(DEFAULTS)); saveState();
      Object.keys(map).forEach(function (id) { $(id).value = st[id]; });
      $("showWidget").checked = true; sel = 0; link(); renderTabs(); render(); say("Settings and levels reset");
    });
  }
  function link() {
    var a = $("open"), u = String(st.appUrl || "").trim();
    var ok = /^https?:\/\//i.test(u);
    a.hidden = !ok; if (ok) a.href = u;
  }

  loadState().then(function (saved) {
    st = Object.assign({}, DEFAULTS, saved);
    st.levels = st.levels || {}; st.trailHigh = st.trailHigh || {};
    sel = Math.min(Math.max(parseInt(st.tab, 10) || 0, 0), D.trades.length - 1);
    $("asof").textContent = D.meta.label + " · snapshot";
    bindSettings(); link(); renderTabs(); render();
  });
})();
