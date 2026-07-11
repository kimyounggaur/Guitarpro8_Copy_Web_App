import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // esbuild's in-process minify service crashes (native
    // STATUS_STACK_BUFFER_OVERRUN) on this project's local dev machine
    // under Node 25 — see docs/ui-remaster/00-baseline-audit.md §2.2.
    // terser is pure JS and unaffected.
    minify: "terser"
  }
});
