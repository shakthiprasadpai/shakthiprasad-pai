import { sanitizePositions, type Position } from "./tracker";

export const POSITIONS_KEY = "gsa-desk-positions";

export function loadPositions(): Record<string, Position> {
  try { return sanitizePositions(JSON.parse(localStorage.getItem(POSITIONS_KEY) || "null")); } catch { return {}; }
}
export function savePositions(p: Record<string, Position>) {
  try { localStorage.setItem(POSITIONS_KEY, JSON.stringify(p)); } catch { /* storage unavailable: tracking works for this session */ }
}

/** Same positions, same text: ids sorted, junk removed. Used to tell whether the browser copy and the shared file differ. */
export const canonPositions = (p: unknown) => {
  const c = sanitizePositions(p);
  return JSON.stringify(Object.keys(c).sort().map((k) => [k, c[k]]));
};
