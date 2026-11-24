import { expect, test as base, type ConsoleMessage, type Page } from "@playwright/test";
import type { Score } from "../../model/types";

export const test = base.extend<{ failOnConsoleError: void }>({
  failOnConsoleError: [
    async ({ page }, use) => {
      const errors: ConsoleMessage[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") {
          errors.push(message);
        }
      });
      await use();
      expect(errors, errors.map((error) => error.text()).join("\n")).toHaveLength(0);
    },
    { auto: true }
  ]
});

export async function openApp(page: Page, { fixture }: { fixture?: Score } = {}): Promise<void> {
  await page.goto("/?testMode=e2e");
  await expect(page.getByTestId("gp-shell")).toBeVisible();
  await page.waitForFunction(() => (window.__GPW_TEST__?.getScore().tracks.length ?? 0) > 0);
  await page.waitForFunction(() => document.fonts.ready.then(() => true));
  if (fixture) {
    await page.evaluate((json) => window.__GPW_TEST__!.loadScoreJson(json), JSON.stringify(fixture));
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  }
}

export async function focusScore(page: Page): Promise<void> {
  await page.getByRole("application", { name: "Editable score" }).focus();
}

export async function typeKeys(page: Page, keys: string): Promise<void> {
  for (const key of keys.split(/\s+/).filter(Boolean)) {
    await page.keyboard.press(key);
  }
}

export function state(page: Page) {
  return page.evaluate(() => {
    const hooks = window.__GPW_TEST__;
    if (!hooks) {
      throw new Error("The editor test mode is not active.");
    }
    return {
      score: hooks.getScore(),
      cursor: hooks.getCursor(),
      selection: hooks.getSelection(),
      playback: hooks.getPlayback(),
      revision: hooks.getRevision()
    };
  });
}

export async function clickToolbarControl(page: Page, title: string | RegExp): Promise<void> {
  const control = page.getByTitle(title, { exact: typeof title === "string" });
  if (!(await control.isVisible())) {
    await page.getByRole("button", { name: "More toolbar controls" }).click();
  }
  await control.click();
}
