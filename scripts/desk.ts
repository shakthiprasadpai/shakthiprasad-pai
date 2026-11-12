// Entry point: npm run desk -- <command> ...   (see scripts/desk-cli.ts for the commands)
import { run } from "./desk-cli";

const argv = process.argv.slice(2);
const show = (r: ReturnType<typeof run>) => { if (r.out) process.stdout.write(r.out); if (r.err) process.stderr.write(r.err); return r.code; };

if (argv[0] === "dash" && argv.includes("--watch")) {
  // clear the screen and redraw every 2 s; the positions file is re-read each time. Ctrl+C to stop.
  const draw = () => { process.stdout.write("\x1b[2J\x1b[H"); show(run(argv)); process.stdout.write("\n  refreshing every 2 s, Ctrl+C to quit\n"); };
  draw();
  setInterval(draw, 2000);
  process.on("SIGINT", () => { process.stdout.write("\n"); process.exit(0); });
} else process.exitCode = show(run(argv));
