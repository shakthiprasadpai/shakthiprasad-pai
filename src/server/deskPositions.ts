// The desk's open positions live in one JSON file, ~/.trade_desk/positions.json, shared by the web dashboard (through the two
// routes below) and the command line (npm run desk -- track / dash). Node only: the browser never touches the file itself.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Express, Request, Response } from "express";
import { sanitizePositions, type Position } from "../core/desk/tracker";

export const defaultPositionsFile = () => process.env.DESK_POSITIONS || path.join(os.homedir(), ".trade_desk", "positions.json");

export function readPositionsFile(file = defaultPositionsFile()): Record<string, Position> {
  try { return sanitizePositions(JSON.parse(fs.readFileSync(file, "utf-8"))); } catch { return {}; }
}

/** Writes through a temp file and a rename, so a reader (the CLI in watch mode) never sees half a file. */
export function writePositionsFile(positions: Record<string, Position>, file = defaultPositionsFile()) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(positions, null, 1), "utf-8");
  fs.renameSync(tmp, file);
}

/** The file holds your fills, so only this computer may use the routes (a deployed copy answers 403 unless DESK_SHARED=1). */
export const isLoopback = (ip: string | undefined) => !!ip && /^(::1|127\.\d+\.\d+\.\d+|::ffff:127\.\d+\.\d+\.\d+)$/.test(ip);

export function mountDeskPositions(app: Express, file = defaultPositionsFile()) {
  const allowed = (req: Request, res: Response) => {
    if (process.env.DESK_SHARED === "1" || isLoopback(req.ip)) return true;
    res.status(403).json({ error: "Positions are only shared with the computer that runs the server." });
    return false;
  };
  app.get("/api/desk/positions", (req, res) => {
    if (!allowed(req, res)) return;
    res.set("Cache-Control", "no-store").json({ positions: readPositionsFile(file), file });
  });
  app.put("/api/desk/positions", (req, res) => {
    if (!allowed(req, res)) return;
    // JSON only: a cross-site form or text/plain request cannot set that content type without a CORS preflight, which this server refuses
    if (!req.is("application/json") || !req.body || typeof req.body !== "object" || Array.isArray(req.body)) return void res.status(400).json({ error: "Send a JSON object of positions." });
    const clean = sanitizePositions((req.body as any).positions ?? req.body);
    writePositionsFile(clean, file);
    res.json({ positions: clean, file });
  });
}
