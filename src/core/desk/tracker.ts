// Trailing-stop tracker: pure maths for one open position. You enter your fill, then the latest price (and the day's
// high and low if you have them). The protective stop only ever moves up: stop = max(stop so far, highest price x (1 - trail%)).
// There is no live feed here, so a stop hit is evaluated on the prices you enter, not on the market.

export interface TrackLog { on: string; price: number; high: number; stop: number; note: string }
export interface Position {
  fill: number; qty: number; stop0: number;     // fill price, shares, the fixed stop you started with
  high: number; stop: number; last: number;      // highest price since entry, protective stop now, last price entered
  openedOn: string; updatedOn: string;
  hit: boolean; hitAt?: number; hitOn?: string;  // set once the stop is touched; stays until the position is closed
  log: TrackLog[];
}
export interface Bar { price: number; high?: number; low?: number; on?: string }

const pos = (v: unknown) => typeof v === "number" && isFinite(v) && v > 0;
const today = () => new Date().toISOString().slice(0, 10);

/** Start tracking. stop0 must be below the fill; qty is whole shares. Returns null when the inputs cannot work. */
export function openPosition(i: { fill: number; qty: number; stop0: number; on?: string }): Position | null {
  const qty = Math.floor(i.qty);
  if (!pos(i.fill) || !pos(i.stop0) || !(qty >= 1) || i.stop0 >= i.fill) return null;
  const on = i.on ?? today();
  return { fill: i.fill, qty, stop0: i.stop0, high: i.fill, stop: i.stop0, last: i.fill, openedOn: on, updatedOn: on, hit: false,
    log: [{ on, price: i.fill, high: i.fill, stop: i.stop0, note: "Opened" }] };
}

/** Apply one price update. The stop in force BEFORE this update decides whether it was hit (the low, or the price when no low is
 *  given); only then does the update's high raise the stop. A position that was hit stays hit and its stop does not move. */
export function applyBar(p: Position, bar: Bar, trailPct: number): Position {
  if (p.hit || !pos(bar.price) || !(trailPct > 0 && trailPct < 50)) return p;
  const on = bar.on ?? today();
  const low = pos(bar.low) ? Math.min(bar.low!, bar.price) : bar.price;
  const hi = Math.max(bar.price, pos(bar.high) ? bar.high! : 0);
  if (low <= p.stop) {
    return { ...p, last: bar.price, updatedOn: on, hit: true, hitAt: p.stop, hitOn: on,
      log: [...p.log, { on, price: bar.price, high: p.high, stop: p.stop, note: `Stop ₹${p.stop.toFixed(2)} hit` }].slice(-30) };
  }
  const high = Math.max(p.high, hi);
  const trail = high * (1 - trailPct / 100);
  const stop = Math.max(p.stop, trail);
  const raised = stop > p.stop + 1e-9;
  return { ...p, last: bar.price, high, stop, updatedOn: on,
    log: raised || high > p.high || !p.log.length || p.log[p.log.length - 1].on !== on
      ? [...p.log, { on, price: bar.price, high, stop, note: raised ? `Stop raised to ₹${stop.toFixed(2)}` : "No change" }].slice(-30) : p.log };
}

export interface TrackerView {
  trailLevel: number; stop: number; binding: "trail" | "fixed"; raisedBy: number;
  distancePct: number;           // how far the last price is above the stop
  pnl: number; pnlPct: number;   // open profit or loss at the last price
  openR: number;                 // open profit in multiples of the initial risk (fill - stop0)
  lockedIfStopped: number;       // rupees made (+) or lost (-) if the stop fills at the stop price
  status: "hit" | "danger" | "ok";
}

/** Everything the screen shows. danger = last price within 1.5% of the stop. */
export function trackerView(p: Position, trailPct: number): TrackerView {
  const trailLevel = p.high * (1 - trailPct / 100), stop = p.hit && p.hitAt ? p.hitAt : p.stop, fillAt = stop;
  const dist = (p.last / stop - 1) * 100;
  return { trailLevel, stop, binding: stop > p.stop0 + 1e-9 ? "trail" : "fixed", raisedBy: stop - p.stop0, distancePct: dist,
    pnl: (p.last - p.fill) * p.qty, pnlPct: (p.last / p.fill - 1) * 100, openR: (p.last - p.fill) / (p.fill - p.stop0),
    lockedIfStopped: (fillAt - p.fill) * p.qty, status: p.hit ? "hit" : dist <= 1.5 ? "danger" : "ok" };
}

/** Saved positions are untrusted: keep only well-formed ones. */
export function sanitizePositions(raw: unknown): Record<string, Position> {
  const out: Record<string, Position> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [id, v] of Object.entries(raw as Record<string, any>)) {
    if (!v || typeof v !== "object") continue;
    if (![v.fill, v.stop0, v.high, v.stop, v.last].every(pos) || !(Number.isInteger(v.qty) && v.qty >= 1) || v.stop0 >= v.fill) continue;
    out[id] = { fill: v.fill, qty: v.qty, stop0: v.stop0, high: v.high, stop: v.stop, last: v.last, openedOn: String(v.openedOn ?? ""), updatedOn: String(v.updatedOn ?? ""),
      hit: v.hit === true, hitAt: pos(v.hitAt) ? v.hitAt : undefined, hitOn: typeof v.hitOn === "string" ? v.hitOn : undefined,
      log: Array.isArray(v.log) ? v.log.filter((l: any) => l && pos(l.price) && pos(l.stop)).slice(-30).map((l: any) => ({ on: String(l.on ?? ""), price: l.price, high: pos(l.high) ? l.high : l.price, stop: l.stop, note: String(l.note ?? "") })) : [] };
  }
  return out;
}
