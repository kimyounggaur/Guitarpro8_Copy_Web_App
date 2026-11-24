import { performance } from "node:perf_hooks";
import { expect, test } from "@playwright/test";
import { big100x8 } from "../fixtures";
import { openApp } from "../e2e/helpers";

test("large-score shell startup, keyboard resizing and overview scroll cadence", async ({ page }, info) => {
  const start = performance.now();
  await openApp(page, { fixture: big100x8() });
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const readyMs = performance.now() - start;
  const samples = await page.evaluate(async () => {
    async function cadence(action: (frame: number) => void) {
      const started = performance.now();
      const frames: number[] = [];
      let previous = started;
      return new Promise<{ framesPerSecond: number; gapsOver32Ms: number }>((resolve) => {
        function step(now: number) {
          frames.push(now - previous);
          previous = now;
          action(frames.length);
          if (now - started < 1500) requestAnimationFrame(step);
          else resolve({ framesPerSecond: Math.round(frames.length * 10000 / (now - started)) / 10,
            gapsOver32Ms: frames.filter((gap) => gap > 32).length });
        }
        requestAnimationFrame(step);
      });
    }
    const separator = document.querySelector<HTMLElement>('[role="separator"][aria-label="Resize edition palette"]')!;
    const resize = await cadence((frame) => separator.dispatchEvent(new KeyboardEvent("keydown", {
      key: Math.floor(frame / 8) % 2 ? "ArrowLeft" : "ArrowRight", bubbles: true, cancelable: true
    })));
    const grid = document.querySelector<HTMLElement>(".alignedGlobalView");
    const scroll = grid ? await cadence((frame) => { grid.scrollLeft = (frame * 24) % Math.max(1, grid.scrollWidth - grid.clientWidth); }) : null;
    return { resize, scroll };
  });
  expect(samples.scroll, "The overview scroller must be present for the scroll measurement").not.toBeNull();
  const evidence = { readyMs: Math.round(readyMs), ...samples };
  console.log(JSON.stringify(evidence));
  await info.attach("shell-cadence.json", { body: JSON.stringify(evidence), contentType: "application/json" });
});
