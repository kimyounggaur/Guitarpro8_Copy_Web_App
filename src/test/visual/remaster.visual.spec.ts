import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { clickToolbarControl, openApp } from "../e2e/helpers";

async function action(page: Page, input: string) {
  await page.keyboard.press("Control+e");
  const search = page.getByTestId("command-palette-input");
  await search.fill(input);
  await search.press("Enter");
}

const scenes = ["palette-hidden", "song-inspector", "playback-loop", "command-palette", "add-track", "stylesheet", "home", "audio-recording"] as const;
for (const scene of scenes) {
  test(`remaster scene ${scene}`, async ({ page }, info) => {
    test.skip(info.project.name !== "visual-1440x900", "The scene audit has one canonical desktop size.");
    await openApp(page);
    if (scene === "palette-hidden") await page.keyboard.press("F2");
    if (scene === "song-inspector") {
      await page.keyboard.press("F6");
      await page.keyboard.press("F5");
    }
    if (scene === "playback-loop") {
      await page.evaluate(async () => {
        const source = "/src/store/playbackStore.ts";
        const { usePlaybackStore } = await import(source) as typeof import("../../store/playbackStore");
        usePlaybackStore.setState({ status: "playing", loopEnabled: true, currentTimeSec: 1.25, currentBarIndex: 0 });
      });
    }
    if (scene === "command-palette") {
      await page.keyboard.press("Control+e");
      await expect(page.getByTestId("command-palette-input")).toBeFocused();
    }
    if (scene === "add-track") {
      await action(page, "@ track.add");
      await expect(page.getByRole("dialog")).toBeVisible();
    }
    if (scene === "stylesheet") {
      await action(page, "@ view.stylesheet");
      await expect(page.getByRole("region", { name: "Score stylesheet", exact: true })).toBeVisible();
    }
    if (scene === "home") await page.getByRole("button", { name: "Home", exact: true }).click();
    if (scene === "audio-recording") {
      await clickToolbarControl(page, "Audio track");
      const dock = page.getByTestId("audio-track-dock");
      await dock.locator("input[type=file]").setInputFiles(fileURLToPath(new URL("../fixtures/files/audio/pulse.wav", import.meta.url)));
      await expect(dock.getByRole("slider", { name: "Audio timeline" })).toBeVisible();
    }
    await expect(page).toHaveScreenshot(`${scene}.png`, { animations: "disabled", fullPage: true });
  });
}
