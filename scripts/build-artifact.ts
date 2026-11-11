// Builds the Claude artifact page (artifact/trade-desk.html) from the same TradeDeskView the dashboard uses.
// Publish it with the Artifact tool; capabilities needed: sample, downloads.
import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), ".."), here = resolve(root, "scripts/artifact");
const res = await build({
  entryPoints: [resolve(here, "entry.tsx")], bundle: true, write: false, format: "iife", minify: true, legalComments: "none", target: "es2020",
  jsx: "transform", inject: [resolve(here, "react-inject.js")], alias: { react: resolve(here, "react-shim.js") },
  tsconfigRaw: { compilerOptions: { jsx: "react" } }, define: { "process.env.NODE_ENV": '"production"' }, loader: { ".css": "empty" }, logLevel: "error",
});
const js = res.outputFiles[0].text.replace(/<\/script>/gi, "<\\/script>");
const html = `<title>Minervini Trade Desk</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
:root{color-scheme:dark}
body{background:#050508;color:#f2f2f5}
</style>
<div id="root"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script>${js}</script>
`;
mkdirSync(resolve(root, "artifact"), { recursive: true });
writeFileSync(resolve(root, "artifact/trade-desk.html"), html);
console.log("artifact page:", (html.length / 1024).toFixed(0), "kB ->", "artifact/trade-desk.html");
