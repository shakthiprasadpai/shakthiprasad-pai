import { sanitizePositions, type Position } from "./tracker";

export const POSITIONS_KEY = "gsa-desk-positions";

export function loadPositions(): Record<string, Position> {
  try { return sanitizePositions(JSON.parse(localStorage.getItem(POSITIONS_KEY) || "null")); } catch { return {}; }
}
export function savePositions(p: Record<string, Position>) {
  try { localStorage.setItem(POSITIONS_KEY, JSON.stringify(p)); } catch { /* storage unavailable: tracking works for this session */ }
}
