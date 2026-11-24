export interface WaveformPeaks {
  channels: Float32Array[];
  bins: number;
}

/** Keep min/max for every channel; bounded chunks release the UI between long scans. */
export async function measurePeaks(
  audio: Pick<AudioBuffer, "length" | "numberOfChannels" | "getChannelData">,
  signal: AbortSignal,
  maxBins = 8192
): Promise<WaveformPeaks> {
  const bins = Math.max(1, Math.min(audio.length, maxBins));
  const channels: Float32Array[] = [];
  for (let channel = 0; channel < audio.numberOfChannels; channel++) {
    const samples = audio.getChannelData(channel);
    const values = new Float32Array(bins * 2);
    const yieldAfter = 262144;
    let untilYield = yieldAfter;
    for (let bin = 0; bin < bins; bin++) {
      signal.throwIfAborted();
      const start = Math.floor(bin * samples.length / bins);
      const end = Math.floor((bin + 1) * samples.length / bins);
      let lo = Infinity;
      let hi = -Infinity;
      for (let i = start; i < end; i++) {
        if (samples[i] < lo) lo = samples[i];
        if (samples[i] > hi) hi = samples[i];
      }
      values[2 * bin] = start < end ? lo : 0;
      values[2 * bin + 1] = start < end ? hi : 0;
      if (end >= untilYield) {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        untilYield = end + yieldAfter;
      }
    }
    channels.push(values);
  }
  signal.throwIfAborted();
  return { bins, channels };
}

export function secondsToX(seconds: number, start: number, span: number, width: number): number {
  return (seconds - start) * width / span;
}
export function xToSeconds(x: number, start: number, span: number, width: number): number {
  return start + Math.max(0, Math.min(1, x / width)) * span;
}
