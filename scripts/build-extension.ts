// Builds the Chrome extension into chrome-extension/dist from the shared core in src/core/desk.
// Usage: npm run build:extension   then Chrome > Extensions > Developer mode > Load unpacked > chrome-extension/dist
import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ext = resolve(root, "chrome-extension"), out = resolve(ext, "dist");

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

await build({
  entryPoints: { popup: resolve(ext, "src/popup.js"), widget: resolve(ext, "src/widget.js") },
  outdir: out, bundle: true, format: "iife", target: "chrome110", minify: true, legalComments: "none", logLevel: "info",
  loader: { ".ts": "ts" },
});

for (const f of ["manifest.json", "popup.html", "popup.css"]) cpSync(resolve(ext, "src", f), resolve(out, f));
cpSync(resolve(ext, "icons"), resolve(out, "icons"), { recursive: true });
cpSync(resolve(ext, "README.md"), resolve(out, "README.md"));

// Fail the build if the manifest points at a file that is not in dist.
const m = JSON.parse(readFileSync(resolve(out, "manifest.json"), "utf8"));
const need = [m.action?.default_popup, ...Object.values(m.icons ?? {}), ...(m.content_scripts ?? []).flatMap((c: any) => c.js ?? [])].filter(Boolean) as string[];
for (const f of need) { try { readFileSync(resolve(out, f)); } catch { throw new Error(`manifest.json references ${f}, which is not in dist`); } }
writeFileSync(resolve(out, "BUILD.txt"), `Built from src/core/desk by scripts/build-extension.ts on ${new Date().toISOString().slice(0, 10)}\n`);
console.log("extension built:", out);
