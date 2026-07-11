import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    // Playwright owns src/test/e2e and src/test/visual (see
    // playwright.config.ts) — Vitest must not try to run those specs.
    exclude: ["**/node_modules/**", "src/test/e2e/**", "src/test/visual/**"]
  }
});
