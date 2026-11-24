import { fileURLToPath } from "node:url";
import { expect } from "@playwright/test";
import { clickToolbarControl, openApp, state, test } from "../helpers";

test("the audio toolbar opens the real dock and hiding it preserves the decoded recording", async ({ page }) => {
  await openApp(page);
  await clickToolbarControl(page, "Audio track");
  const dock = page.getByTestId("audio-track-dock");
  await expect(dock).toBeVisible();
  const wav = fileURLToPath(new URL("../../fixtures/files/audio/pulse.wav", import.meta.url));
  await dock.locator("input[type=file]").setInputFiles(wav);
  await expect(dock.getByRole("slider", { name: "Audio timeline" })).toBeVisible();
  await expect(dock.getByRole("button", { name: "Preview audio" })).toBeVisible();
  const reference = (await state(page)).score.audioTrack;
  await clickToolbarControl(page, "Audio track");
  await expect(dock).toHaveCount(0);
  await expect(page.getByRole("separator", { name: "Resize audio track" })).toHaveCount(0);
  await clickToolbarControl(page, "Audio track");
  await expect(dock.getByRole("button", { name: "Preview audio" })).toBeVisible();
  expect((await state(page)).score.audioTrack).toEqual(reference);
  await dock.getByRole("button", { name: "Remove audio" }).click();
  expect((await state(page)).score.audioTrack).toBeUndefined();
});
