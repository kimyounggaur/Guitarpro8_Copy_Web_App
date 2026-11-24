import { expect, it } from "vitest";
import { measurePeaks, secondsToX, xToSeconds } from "./waveform";

it("keeps independent signed channel extrema and the final partial bin", async () => {
  const data = [new Float32Array([-.5, .25, -.75, 1, 0]), new Float32Array([0, .5, -.25, .75, -1])];
  const peaks = await measurePeaks({ length: 5, numberOfChannels: 2, getChannelData: i => data[i] }, new AbortController().signal, 2);
  expect(peaks.channels.map(channel => [...channel])).toEqual([[-.5, .25, -.75, 1], [0, .5, -1, .75]]);
});

it("drops cancelled scans and shares an invertible seconds ruler at every zoom", async () => {
  const abort = new AbortController(); abort.abort();
  await expect(measurePeaks({ length: 1, numberOfChannels: 1, getChannelData: () => new Float32Array(1) }, abort.signal)).rejects.toMatchObject({ name: "AbortError" });
  expect(xToSeconds(secondsToX(47.25, 40, 10, 800), 40, 10, 800)).toBe(47.25);
});
