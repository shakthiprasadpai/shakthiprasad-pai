// Entry point: npm run desk -- <command> ...   (see scripts/desk-cli.ts for the commands)
import { run } from "./desk-cli";

const r = run(process.argv.slice(2));
if (r.out) process.stdout.write(r.out);
if (r.err) process.stderr.write(r.err);
process.exitCode = r.code;
