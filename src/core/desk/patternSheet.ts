import type { PatternResult } from "./chartPatterns";

/* Reads the "Dashboard Pattern Summary" spreadsheet (exported as CSV) and checks each row against the live pattern scan. */

export type SheetStatus = "confirmed" | "forming" | "none";
export interface SheetRow { stock: string; label: string; pattern: string; status: SheetStatus; bias: string; trigger: number | null; target: number | null; note: string }
export type CheckResult = "match" | "differs" | "not scanned";
export interface Check { check: CheckResult; live: string }

// Small CSV reader: quoted fields, doubled quotes, commas and line breaks inside quotes, CRLF.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cell = "", q = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) { if (ch === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && s[i + 1] === "\n") i++; row.push(cell); cell = ""; if (row.some((c) => c.trim() !== "")) rows.push(row); row = []; }
    else cell += ch;
  }
  row.push(cell); if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

const num = (v: string | undefined): number | null => {
  const n = parseFloat(String(v ?? "").replace(/[₹,\s]/g, ""));
  return isFinite(n) ? n : null;
};
const key = (h: string) => h.toLowerCase().replace(/[^a-z]/g, "");

// Returns the rows, or an error message when the file is not the pattern sheet.
export function parsePatternCsv(text: string): { rows: SheetRow[]; error?: string } {
  const grid = parseCsv(text);
  if (grid.length < 2) return { rows: [], error: "The file has no rows." };
  const idx: Record<string, number> = {};
  grid[0].forEach((h, i) => { idx[key(h)] = i; });
  for (const need of ["stock", "pattern", "status"]) if (idx[need] == null) return { rows: [], error: `Column "${need[0].toUpperCase() + need.slice(1)}" is missing. Export the Patterns sheet as CSV from the spreadsheet.` };
  const rows: SheetRow[] = [];
  for (const r of grid.slice(1)) {
    const label = (r[idx.stock] || "").trim(), st = (r[idx.status] || "").trim().toLowerCase();
    if (!label || !["confirmed", "forming", "none"].includes(st)) continue;
    rows.push({
      stock: label.replace(/\s*\(.*\)\s*$/, "").toUpperCase(), label, pattern: (r[idx.pattern] || "").trim(), status: st as SheetStatus,
      bias: (r[idx.bias] || "").trim().toLowerCase(), trigger: num(r[idx.trigger]), target: num(r[idx.target]), note: (r[idx.note] || "").trim(),
    });
  }
  return rows.length ? { rows } : { rows, error: "No rows with a Confirmed, Forming or None status were found." };
}

// Compares one spreadsheet row with the live scan of the same stock.
export function checkRow(row: SheetRow, scans: Record<string, PatternResult[]>): Check {
  const rs = scans[row.stock];
  if (!rs) return { check: "not scanned", live: "This stock is not on the desk" };
  const active = rs.filter((r) => r.state === "confirmed" || r.state === "forming");
  if (row.status === "none") {
    return active.length ? { check: "differs", live: active.map((r) => `${r.name}: ${r.state}`).join(", ") } : { check: "match", live: "None" };
  }
  const want = row.pattern.toLowerCase();
  const hit = rs.find((r) => r.name.toLowerCase() === want) || rs.find((r) => r.family.toLowerCase() === want);
  const live = hit ? (hit.state === "confirmed" || hit.state === "forming" ? hit.state : "not formed") : "not formed";
  if (live !== row.status) return { check: "differs", live: live[0].toUpperCase() + live.slice(1) };
  // same status: flag a trigger that has moved by more than 0.5%
  if (hit && row.trigger != null && hit.level != null && Math.abs(hit.level - row.trigger) / row.trigger > 0.005) return { check: "differs", live: `${live[0].toUpperCase() + live.slice(1)}, trigger now ${hit.level.toFixed(2)}` };
  return { check: "match", live: live[0].toUpperCase() + live.slice(1) };
}
