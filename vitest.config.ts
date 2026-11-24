import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    // Playwright owns browser suites (see
    // playwright.config.ts) — Vitest must not try to run those specs.
    exclude: [
      "**/node_modules/**",
      "src/test/e2e/**",
      "src/test/visual/**",
      "src/test/audio/**",
      "src/test/perf/**"
    ]
  }
});
