import { expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { openApp, state, test } from "../helpers";
import { guitarWithBars } from "./scoreFixtures";

const wav = fileURLToPath(new URL("../../fixtures/files/audio/pulse.wav", import.meta.url));
test("local recording decodes, seeks, auditions, detaches and reports an invalid replacement", async ({ page }, info) => {
  await openApp(page, { fixture: guitarWithBars([[5,7]]) });
  await page.evaluate(async () => {
    const path = "/src/test/fixtures/audioDockHarness.tsx";
    const harness = await import(path) as typeof import("../../fixtures/audioDockHarness");
    harness.mountAudioDockFixture();
  });
  const host = page.getByTestId("audio-dock-fixture");
  const input = host.locator("input[type=file]");
  await expect(host.getByRole("button", { name: "Add audio" })).toBeVisible();
  await info.attach("audio-empty", { body: await host.screenshot(), contentType: "image/png" });
  await input.setInputFiles(wav);
  const wave = host.getByRole("slider", { name: "Audio timeline" });
  await expect(wave).toBeVisible();
  await expect(host.getByText("1.00 s", { exact: true })).toBeVisible();
  expect((await state(page)).score.audioTrack).toMatchObject({ name: "pulse.wav", embedded: false });
  await info.attach("audio-loaded", { body: await host.screenshot(), contentType: "image/png" });
  await wave.focus();
  await page.keyboard.press("ArrowRight");
  expect(Number(await host.getAttribute("data-seek"))).toBeCloseTo(.25);
  await host.getByRole("button", { name: "Preview audio" }).click();
  await expect.poll(async () => Number(await wave.getAttribute("aria-valuenow"))).toBeGreaterThan(.3);
  await host.getByRole("button", { name: "Mute" }).click();
  await expect(host.getByRole("button", { name: "Mute" })).toHaveAttribute("aria-pressed", "true");
  await input.setInputFiles({name:"bad.wav", mimeType:"audio/wav", buffer:Buffer.from("invalid audio")});
  await expect(host.getByRole("alert")).toContainText("Could not decode");
  await expect(wave).toBeVisible();
  await host.getByRole("button", { name: "Remove audio" }).click();
  await expect(wave).toHaveCount(0);
  expect((await state(page)).score.audioTrack).toBeUndefined();
});

test("decoded audio playback owns and releases a real audio buffer and source", async ({ page }) => {
  await openApp(page);
  const result = await page.evaluate(async () => {
    const path = "/src/ui/audio-track/audioFile.ts";
    const { DecodedAudioFile } = await import(path) as typeof import("../../../ui/audio-track/audioFile");
    const response = await fetch("/src/test/fixtures/files/audio/pulse.wav");
    const clip = await DecodedAudioFile.open(new File([await response.arrayBuffer()], "pulse.wav"), new AbortController().signal);
    clip.setLevel(.5, false);
    clip.follow(.25);
    const started = clip.position;
    clip.stop();
    const stopped = clip.position;
    clip.dispose(); clip.dispose();
    clip.follow(.5);
    return { started, stopped, closed: clip.closed, afterDispose: clip.position, duration: clip.duration };
  });
  expect(result.started).toBeCloseTo(.25, 1);
  expect(result).toMatchObject({ duration: 1, stopped:null, closed:true, afterDispose:null });
});
