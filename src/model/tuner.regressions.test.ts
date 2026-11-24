import { expect, it } from "vitest";
import { centsBetween, detectPitchFromBuffer, medianPitch, midiToFrequency, TUNER_SAMPLE_COUNT } from "./tuner";

it.each([
  [23, "B0"], [28, "E1"], [40, "E2"], [45, "A2"], [50, "D3"], [55, "G3"], [59, "B3"], [64, "E4"]
])("[B19] detects %s (%s) within two cents with string harmonics", (midi, name) => {
  const sampleRate = 48_000;
  const frequency = midiToFrequency(midi);
  const samples = Float32Array.from({ length: TUNER_SAMPLE_COUNT }, (_, index) => {
    const phase = (2 * Math.PI * frequency * index) / sampleRate;
    return 0.52 * Math.sin(phase) + 0.25 * Math.sin(phase * 2) + 0.13 * Math.sin(phase * 3);
  });
  const pitch = detectPitchFromBuffer(samples, sampleRate);
  expect(pitch?.noteName).toBe(name);
  expect(pitch?.clarity).toBeGreaterThanOrEqual(0.9);
  expect(Math.abs(centsBetween(pitch?.frequency ?? 0, frequency))).toBeLessThanOrEqual(2);
});

it("[B19] ignores silence and takes the median of five accepted pitches", () => {
  expect(detectPitchFromBuffer(new Float32Array(TUNER_SAMPLE_COUNT), 48_000)).toBeNull();
  const readings = [109, 110, 220, 108, 111].map((frequency) => ({
    frequency, midi: 45, cents: 0, clarity: 0.94, noteName: "A2"
  }));
  expect(medianPitch(readings)?.frequency).toBe(110);
});
