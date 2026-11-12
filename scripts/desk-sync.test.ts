import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import express from "express";
import { mountDeskPositions, isLoopback, readPositionsFile, writePositionsFile } from "../src/server/deskPositions";
import { openPosition, applyBar } from "../src/core/desk";
import { canonPositions } from "../src/core/desk/positionsStore";
import { run } from "./desk-cli";

assert.ok(isLoopback("127.0.0.1") && isLoopback("::1") && isLoopback("::ffff:127.0.0.1"));
assert.ok(!isLoopback("192.168.1.5") && !isLoopback("::ffff:10.0.0.1") && !isLoopback(undefined) && !isLoopback("127.0.0.1.evil"));

const dir = mkdtempSync(join(tmpdir(), "sync-")), file = join(dir, "sub", "positions.json");
try {
  const app = express();
  app.use(express.json());
  mountDeskPositions(app, file);
  app.use((err: any, _req: any, res: any, _next: any) => res.status(err.status || 500).json({ error: "bad request" })); // keep the test output quiet
  const srv = app.listen(0, "127.0.0.1");
  await new Promise((r) => srv.once("listening", r));
  const base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}/api/desk/positions`;
  const put = (body: string, type = "application/json") => fetch(base, { method: "PUT", headers: { "Content-Type": type }, body });

  // empty to start
  assert.deepEqual((await (await fetch(base)).json()).positions, {});

  // the browser saves a position; the CLI reads the same file
  const p0 = openPosition({ fill: 2470, qty: 33, stop0: 2320, on: "2026-11-10" })!;
  const r = await put(JSON.stringify({ positions: { swing: p0, junk: { fill: -1 } } }));
  assert.equal(r.status, 200);
  assert.deepEqual(Object.keys((await r.json()).positions), ["swing"]); // the malformed one is dropped
  assert.ok(run(["track", "show", "swing", "--state", file]).out.includes("33 shares, fill ₹2,470.00"));
  assert.equal(readdirSync(join(dir, "sub")).filter((f) => f.endsWith(".tmp")).length, 0); // no temp file left behind

  // the terminal updates it; the browser's next poll sees the change
  assert.equal(run(["track", "update", "swing", "--price", "2600", "--high", "2610", "--on", "2026-11-11", "--state", file]).code, 0);
  const got = (await (await fetch(base)).json()).positions;
  assert.equal(got.swing.high, 2610); assert.equal(+got.swing.stop.toFixed(2), 2401.2);
  // same data, same text, whichever side wrote it
  assert.equal(canonPositions(got), canonPositions(JSON.parse(readFileSync(file, "utf-8"))));
  assert.equal(canonPositions({ b: got.swing, a: got.swing }), canonPositions({ a: got.swing, b: got.swing }));
  assert.notEqual(canonPositions(got), canonPositions({ swing: applyBar(got.swing, { price: 2700, on: "2026-11-12" }, 8) }));

  // refused: wrong content type (a cross-site form post), arrays, bad JSON
  assert.equal((await put(JSON.stringify({ positions: {} }), "text/plain")).status, 400);
  assert.equal((await put("[]")).status, 400);
  assert.equal((await put("{not json")).status, 400);
  assert.equal(Object.keys(readPositionsFile(file)).length, 1); // none of those touched the file

  // a corrupt file reads as empty instead of breaking the page
  writeFileSync(file, "{oops");
  assert.deepEqual((await (await fetch(base)).json()).positions, {});
  writePositionsFile({ swing: p0 }, file);
  assert.ok(existsSync(file));
  srv.close();
} finally { rmSync(dir, { recursive: true, force: true }); }
console.log("desk sync: shared file, routes and CLI agree");
