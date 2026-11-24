import { expect, test } from "@playwright/test";

test("[B4] the real Web Audio hat is noise-based and a closed hat chokes its tail", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const synthPath = "/src/engine/audio/drumSynth.ts";
    const { DrumSynth } = await import(synthPath) as typeof import("../../engine/audio/drumSynth");
    const sampleRate = 48000;
    function rms(buffer: AudioBuffer, start: number, end: number) {
      const samples = buffer.getChannelData(0).slice(start * sampleRate, end * sampleRate);
      return Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length);
    }
    async function render(closed: boolean) {
      const context = new OfflineAudioContext(1, sampleRate / 2, sampleRate);
      const synth = new DrumSynth(context);
      const openHat = synth.trigger(46, 112, 0, context.destination, "drums");
      if (closed) synth.trigger(42, 112, 0.12, context.destination, "drums");
      return { buffer: await context.startRendering(), noise: openHat.oscillator instanceof AudioBufferSourceNode };
    }

    const open = await render(false);
    const choked = await render(true);
    return {
      usesNoise: open.noise,
      early: rms(open.buffer, 0.02, 0.08),
      openTail: rms(open.buffer, 0.22, 0.29),
      chokedTail: rms(choked.buffer, 0.22, 0.29)
    };
  });
  expect(result.usesNoise).toBe(true);
  expect(result.early).toBeGreaterThan(0.005);
  expect(result.openTail).toBeGreaterThan(0.0001);
  expect(result.chokedTail).toBeLessThan(result.openTail / 30);
});
