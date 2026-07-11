import { test as base, expect, type ConsoleMessage } from "@playwright/test";

/**
 * Behavioral regression harness for the current (pre-remaster) EditorShell.
 * These assertions describe today's real behavior (see
 * docs/ui-remaster/00-interaction-matrix.md) so later remaster phases fail
 * loudly the moment they accidentally regress something that used to work.
 * They are NOT a spec for the GP8 target UX — Phase 5+ specs will assert
 * the target behavior (exclusive SONG/TRACK tabs, working menu, etc.) as
 * each phase actually implements it.
 */

// Auto-fixture: every test in this file fails if the page logs a console
// error, per the playbook's "console error가 발생하면 테스트가 실패한다" gate —
// not just the tests that check for it explicitly.
const test = base.extend<{ failOnConsoleError: void }>({
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

test.beforeEach(async ({ page }) => {
  await page.goto("/?testMode=visual");
  await expect(page.getByTestId("gp-shell")).toBeVisible();
  await page.waitForFunction(() => document.fonts.ready.then(() => true));
});

test("initial editor opens with all six panels visible", async ({ page }) => {
  await expect(page.getByTestId("workspace-panel")).toBeVisible();
  await expect(page.getByTestId("palette-panel")).toBeVisible();
  await expect(page.getByTestId("inspector-panel")).toBeVisible();
  await expect(page.getByTestId("bottom-dock")).toBeVisible();
});

test("F2 hides and restores the edition palette", async ({ page }) => {
  await expect(page.getByTestId("palette-panel")).toBeVisible();

  await page.keyboard.press("F2");
  await expect(page.getByTestId("palette-panel")).toBeHidden();

  await page.keyboard.press("F2");
  await expect(page.getByTestId("palette-panel")).toBeVisible();
});

test("F5 and F6 toggle the Song/Track inspector sections independently", async ({ page }) => {
  const inspector = page.getByTestId("inspector-panel");
  await expect(inspector).toBeVisible();
  await expect(inspector.getByText("Song", { exact: true })).toBeVisible();
  await expect(inspector.getByText("Transposition", { exact: true })).toBeVisible();

  await page.keyboard.press("F5");
  await expect(inspector.getByText("Song", { exact: true })).toBeHidden();
  await expect(inspector.getByText("Transposition", { exact: true })).toBeVisible();

  await page.keyboard.press("F5");
  await expect(inspector.getByText("Song", { exact: true })).toBeVisible();

  await page.keyboard.press("F6");
  await expect(inspector.getByText("Transposition", { exact: true })).toBeHidden();

  await page.keyboard.press("F6");
  await expect(inspector.getByText("Transposition", { exact: true })).toBeVisible();
});

test("F8 toggles the Global View dock", async ({ page }) => {
  await expect(page.getByTestId("bottom-dock")).toBeVisible();

  await page.keyboard.press("F8");
  await expect(page.getByTestId("bottom-dock")).toBeHidden();

  await page.keyboard.press("F8");
  await expect(page.getByTestId("bottom-dock")).toBeVisible();
});

test("Command Palette opens on Ctrl+E and closes on Escape", async ({ page }) => {
  await expect(page.getByTestId("command-palette")).toHaveCount(0);

  await page.keyboard.press("Control+E");
  await expect(page.getByTestId("command-palette")).toBeVisible();
  await expect(page.getByTestId("command-palette-input")).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("command-palette")).toHaveCount(0);
});

test("Play/Stop transport button round-trips playing and stopped state", async ({ page }) => {
  const playStop = page.getByTestId("transport-play-stop");
  await expect(playStop).toHaveText("Play");

  await playStop.click();
  await expect(playStop).toHaveText("Stop");

  await playStop.click();
  await expect(playStop).toHaveText("Play");
});
