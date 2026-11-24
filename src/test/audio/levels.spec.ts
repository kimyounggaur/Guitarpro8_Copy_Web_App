import { expect, test } from "@playwright/test";

test("[A8] the complete demo's real stereo audio stays within the peak and RMS targets", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const path = "/src/test/audio/measureDemo.ts";
    const { measureDemo } = await import(path) as typeof import("./measureDemo");
    return measureDemo();
  });

  const evidence = JSON.stringify(result);
  await test.info().attach("demo-audio-levels.json", { body: evidence, contentType: "application/json" });
  expect(result.peakDb, evidence).toBeLessThanOrEqual(-1);
  expect(result.rmsDb, evidence).toBeGreaterThanOrEqual(-20);
  expect(result.rmsDb, evidence).toBeLessThanOrEqual(-14);
  expect(result.clippedSeconds, evidence).toBe(0);
});

test("[B5] muting an already-sounding track silences its bus within 50ms", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const path = "/src/test/audio/measureDemo.ts";
    const { measureTrackMute } = await import(path) as typeof import("./measureDemo");
    return measureTrackMute();
  });
  expect(result.before).toBeGreaterThan(0.05);
  expect(result.after50ms).toBe(0);
});
