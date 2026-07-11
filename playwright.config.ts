import { defineConfig, devices } from "@playwright/test";

const PORT = 5174;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./src/test",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  outputDir: "test-results",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    video: "off"
  },
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000
  },
  projects: [
    {
      name: "chromium",
      testDir: "./src/test/e2e",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 768 } }
    },
    {
      name: "visual-1024x768",
      testDir: "./src/test/visual",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1024, height: 768 } }
    },
    {
      name: "visual-1280x768",
      testDir: "./src/test/visual",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 768 } }
    },
    {
      name: "visual-1440x900",
      testDir: "./src/test/visual",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }
    },
    {
      name: "visual-1920x1080",
      testDir: "./src/test/visual",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1920, height: 1080 } }
    }
  ]
});
