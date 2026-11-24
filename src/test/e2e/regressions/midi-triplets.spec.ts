import { expect } from "@playwright/test";
import { writeMidi, type MidiEvent } from "midi-file";
import { clickToolbarControl, openApp, state, test } from "../helpers";
import { dropFileOnScore } from "./dropFile";

const events: MidiEvent[] = [
  { type: "trackName", deltaTime: 0, text: "Three-note triplets" },
  { type: "programChange", deltaTime: 0, channel: 0, programNumber: 73 }
];
for (const noteNumber of [60, 62, 64]) {
  events.push({ type: "noteOn", deltaTime: 0, channel: 0, noteNumber, velocity: 80 });
  events.push({ type: "noteOff", deltaTime: 160, channel: 0, noteNumber, velocity: 0 });
}
events.push({ type: "endOfTrack", deltaTime: 0 });
const bytes = writeMidi({ header: { format: 0, ticksPerBeat: 480, numTracks: 1 }, tracks: [events] });

test("[B14] opening MIDI can detect and notate three eighth-note triplets", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, "showOpenFilePicker", { value: undefined }));
  await openApp(page);
  await clickToolbarControl(page, "File I/O");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Open", exact: true }).click();
  const picker = await chooser;
  expect(await picker.element().getAttribute("accept")).toContain(".mid");
  await picker.setFiles({ name: "triplets.mid", mimeType: "audio/midi", buffer: Buffer.from(bytes) });

  const dialog = page.getByRole("dialog", { name: "Import MIDI" });
  await dialog.getByRole("checkbox", { name: "Detect triplets" }).check();
  await dialog.getByRole("button", { name: "Import", exact: true }).click();
  await expect.poll(async () => (await state(page)).score.tracks[0].name).toBe("Three-note triplets");
  const beats = (await state(page)).score.tracks[0].bars[0].voices[0].beats.filter(beat => !beat.rest);
  expect(beats.map(({ duration, tuplet, notes }) => [duration, tuplet, notes[0].midiPitch])).toEqual([
    [8, { n: 3, m: 2 }, 60], [8, { n: 3, m: 2 }, 62], [8, { n: 3, m: 2 }, 64]
  ]);
});

test("[B14] dropping MIDI can be cancelled or imported on the default straight grid", async ({ page }) => {
  await openApp(page);
  const before = await state(page);
  await dropFileOnScore(page, "triplets.mid", bytes);
  const dialog = page.getByRole("dialog", { name: "Import MIDI" });
  await expect(dialog.getByRole("checkbox", { name: "Detect triplets" })).not.toBeChecked();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  expect((await state(page)).score).toEqual(before.score);
  await dropFileOnScore(page, "triplets.mid", bytes);
  await dialog.getByRole("button", { name: "Import", exact: true }).click();
  await expect.poll(async () => (await state(page)).score.tracks[0].name).toBe("Three-note triplets");
  const beats = (await state(page)).score.tracks[0].bars[0].voices[0].beats.filter(beat => !beat.rest);
  expect(beats.map(beat => beat.duration)).toEqual([16, 8, 16]);
  expect(beats.every(beat => !beat.tuplet)).toBe(true);
});
