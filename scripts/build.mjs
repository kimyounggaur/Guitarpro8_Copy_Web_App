// Runs `tsc --noEmit` then `vite build` with a short pause between them.
//
// On this project's local Windows dev machine (Node 25), spawning `vite
// build` immediately after `tsc --noEmit` exits reliably crashes with a
// native STATUS_STACK_BUFFER_OVERRUN inside vite's minify step — even
// though `vite build` run entirely on its own never crashes. A short delay
// between the two process spawns avoids it. See
// docs/ui-remaster/00-baseline-audit.md §2.2 and
// docs/ui-remaster/01-visual-testing.md §3 for the isolation history; this
// script is the fix promised there once the workaround needed to be more
// robust than "just retry once".
import { spawnSync } from "node:child_process";

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: true });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("npx", ["tsc", "--noEmit"]);
await new Promise((resolve) => setTimeout(resolve, 1200));
run("npx", ["vite", "build"]);
