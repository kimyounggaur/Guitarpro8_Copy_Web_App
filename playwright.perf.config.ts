import { defineConfig, devices } from "@playwright/test";

const port = 5183;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./src/test/perf",
  workers: 1,
  timeout: 180_000,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 1280, height: 768 },
    baseURL
  },
  webServer: {
    command: `pnpm build && pnpm preview --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 90_000
  }
});
