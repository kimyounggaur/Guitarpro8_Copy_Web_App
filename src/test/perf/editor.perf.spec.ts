import { stat } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import type { Score } from "../../model/types";
import { createBeat, createEmptyScore, createMasterBar, createNote, createTrack } from "../../model/factory";
import { big100x8 } from "../fixtures";
import { focusScore, openApp } from "../e2e/helpers";

interface PerfSample {
  score: string;
  browser: string;
  editMedianMs: number;
  editP95Ms: number;
  cursorMedianMs: number;
  cursorP95Ms: number;
  heapIncreaseBytes: number;
  playbackLongTasks: number | null;
  saveBytes: number;
  svgElements: number;
}

const shapes = [[1, 32], [8, 100], [20, 300]] as const;

for (const [trackCount, barCount] of shapes) {
  test(`[B18] ${trackCount} tracks × ${barCount} measures`, async ({ page, browser }, testInfo) => {
    const fixture = trackCount === 8 ? big100x8() : makeFixture(trackCount, barCount);
    fixture.meta.title = `Performance ${trackCount}×${barCount}`;
    await page.addInitScript(() => Object.defineProperty(window, "showSaveFilePicker", { value: undefined }));
    await openApp(page, { fixture });
    await focusScore(page);

    await page.keyboard.press("2");
    await page.keyboard.press("ArrowRight");

    const edits: number[] = [];
    const moves: number[] = [];
    for (let index = 0; index < 50; index++) {
      edits.push(await untilFrameAfterKey(page, index % 2 === 0 ? "2" : "3"));
      moves.push(await untilFrameAfterKey(page, "ArrowRight"));
    }

    // Reset history before the GC-to-GC measurement.
    await page.evaluate((data) => window.__GPW_TEST__!.loadScoreJson(data), JSON.stringify(fixture));
    await focusScore(page);
    const cdp = await page.context().newCDPSession(page);
    async function heapSize(): Promise<number> {
      await cdp.send("HeapProfiler.collectGarbage");
      return (await cdp.send("Runtime.getHeapUsage")).usedSize;
    }
    const heapBefore = await heapSize();
    for (let index = 0; index < 20; index++) {
      await page.keyboard.press(index % 2 === 0 ? "2" : "3");
      await page.keyboard.press("ArrowRight");
    }
    const heapIncreaseBytes = (await heapSize()) - heapBefore;
    await cdp.detach();

    const save = page.waitForEvent("download");
    await page.keyboard.press("Control+s");
    const saveBytes = (await stat(await (await save).path())).size;

    const svgElements = await page.locator(".scoreViewport svg *").count();
    const playbackLongTasks = await measurePlaybackTasks(page);
    const result: PerfSample = {
      score: fixture.meta.title,
      browser: browser.version(),
      editMedianMs: percentile(edits, 0.5),
      editP95Ms: percentile(edits, 0.95),
      cursorMedianMs: percentile(moves, 0.5),
      cursorP95Ms: percentile(moves, 0.95),
      heapIncreaseBytes,
      playbackLongTasks,
      saveBytes,
      svgElements
    };

    const evidence = JSON.stringify(result);
    await testInfo.attach("editor-perf.json", { body: evidence, contentType: "application/json" });
    console.log(evidence);
    expect(saveBytes).toBeGreaterThan(0);
    if (trackCount === 8) reportTargets(result);
  });
}

function makeFixture(trackCount: number, barCount: number): Score {
  const score = createEmptyScore();
  score.masterBars = Array.from({ length: barCount }, () => createMasterBar());
  score.tracks = Array.from({ length: trackCount }, (_, trackIndex) => {
    const track = createTrack(undefined, barCount);
    track.id = `perf-track-${trackIndex + 1}`;
    track.bars.forEach((bar, index) => {
      bar.voices[0].beats = Array.from({ length: 4 }, (_, beat) => createBeat({
        rest: false, notes: [createNote(1, (index + beat) % 12)]
      }));
    });
    return track;
  });
  return score;
}

async function untilFrameAfterKey(page: Page, key: string): Promise<number> {
  await page.evaluate(() => {
    const keydown = (event: KeyboardEvent) => {
      requestAnimationFrame(() => {
        document.body.dataset.perfSample = String(performance.now() - event.timeStamp);
      });
    };
    delete document.body.dataset.perfSample;
    window.addEventListener("keydown", keydown, { capture: true, once: true });
  });
  await page.keyboard.press(key);
  const sample = await page.waitForFunction(() => document.body.dataset.perfSample);
  return Number(await sample.jsonValue());
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * p) - 1;
  return Math.round(sorted[index] * 100) / 100;
}

async function measurePlaybackTasks(page: Page): Promise<number | null> {
  await page.getByTestId("transport-play-stop").click();
  await page.waitForFunction(() => window.__GPW_TEST__?.getPlayback().status === "playing");
  const count = await page.evaluate(() => {
    if (!PerformanceObserver.supportedEntryTypes.includes("longtask")) return null;
    return new Promise<number>((resolve) => {
      let entries = 0;
      const observer = new PerformanceObserver((list) => { entries += list.getEntries().length; });
      observer.observe({ type: "longtask" });
      setTimeout(() => { observer.disconnect(); resolve(entries); }, 4000);
    });
  });
  await page.getByTestId("transport-play-stop").click();
  return count;
}

function reportTargets(result: PerfSample): void {
  const baseline = Number(process.env.TABSCORE_BASELINE_EDIT_P95);
  if (Number.isFinite(baseline) && baseline > 0 && result.editP95Ms >= baseline * 1.20) {
    console.warn(`::warning::8×100 edit p95 is ${result.editP95Ms}ms against the ${baseline}ms baseline.`);
  }

  const missed = [
    result.editP95Ms >= 50 ? "edit p95 < 50ms" : "",
    result.cursorP95Ms > 16 ? "cursor p95 ≤ 16ms" : "",
    result.heapIncreaseBytes > 50_000_000 ? "heap growth ≤ 50MB" : "",
    result.playbackLongTasks === null || result.playbackLongTasks > 2 ? "≤ 2 playback long tasks" : "",
    result.saveBytes > 1_500_000 ? "save ≤ 1.5MB" : ""
  ].filter(Boolean);
  if (missed.length) console.warn(`Perf targets pending: ${missed.join(", ")}`);
}
