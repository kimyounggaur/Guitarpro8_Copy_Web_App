import { expect } from "@playwright/test";
import { openApp, state, test } from "../helpers";
import { dropFileOnScore } from "./dropFile";

test("[B16] a binary Guitar Pro drop offers MusicXML import guidance", async ({ page }) => {
  await openApp(page);
  const before = await state(page);

  // A ZIP local-file header identifies the unsupported GP7/8 family.
  await dropFileOnScore(page, "binary-score.gp", [0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);
  const status = page.locator(".fileIoStatus");
  await expect(status).not.toHaveText("Native .gp, ASCII, MusicXML, MIDI, SVG, PNG, and PDF are ready.");
  expect((await state(page)).score.meta.title).toBe(before.score.meta.title);

  test.fail(true, "R1 detects the binary signature before attempting native JSON parsing.");
  expect(await status.textContent()).toMatch(/(export|내보내기).*MusicXML|MusicXML.*(export|내보내기)/is);
});
