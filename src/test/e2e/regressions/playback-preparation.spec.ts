import { expect } from "@playwright/test";
import { big100x8 } from "../../fixtures";
import { openApp, test } from "../helpers";

test("[B18] the large-score worker matches the main-thread compilation and honours cancellation", async ({ page }) => {
  await openApp(page, { fixture: big100x8() });
  const result = await page.evaluate(async () => {
    const path = "/src/engine/audio/playbackPreparation.ts";
    const { compilePlaybackOnMainThread, preparePlaybackInWorker } = await import(path) as
      typeof import("../../../engine/audio/playbackPreparation");
    const score = window.__GPW_TEST__!.getScore();
    const oldRequest = new AbortController();
    const old = preparePlaybackInWorker(score, 74, oldRequest.signal);
    oldRequest.abort();
    const cancelled = await old.then(() => false, (error: Error) => error.name === "AbortError");
    const worker = await preparePlaybackInWorker(score, 120, new AbortController().signal);
    const main = compilePlaybackOnMainThread(score, 120);
    return {
      cancelled,
      events: worker.events.length,
      sameNotes: JSON.stringify(worker.events) === JSON.stringify(main.events),
      samePosition: JSON.stringify(worker.positionAtSecond(3.5)) === JSON.stringify(main.positionAtSecond(3.5)),
      sameEnd: worker.totalSeconds === main.totalSeconds
    };
  });
  expect(result).toMatchObject({ cancelled: true, sameNotes: true, samePosition: true, sameEnd: true });
  expect(result.events).toBeGreaterThan(3000);
});
