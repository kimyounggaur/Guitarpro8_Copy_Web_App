export interface DrumVoice {
  oscillator: AudioScheduledSourceNode;
  gain: GainNode;
  nodes: AudioNode[];
  modulators: AudioScheduledSourceNode[];
}

interface DrumPatch {
  seconds: number;
  level: number;
  tone?: { startHz: number; endHz: number; level: number };
  noise?: { filter: BiquadFilterType; hz: number; q: number; level: number };
  hat?: "open" | "closed";
}

const kick: DrumPatch = {
  seconds: 0.21,
  level: 0.34,
  tone: { startHz: 145, endHz: 43, level: 1 }
};
const snare: DrumPatch = {
  seconds: 0.18,
  level: 0.24,
  tone: { startHz: 189, endHz: 155, level: 0.48 },
  noise: { filter: "highpass", hz: 1300, q: 0.72, level: 1 }
};
const sideStick: DrumPatch = {
  seconds: 0.08,
  level: 0.28,
  tone: { startHz: 860, endHz: 600, level: 0.45 },
  noise: { filter: "bandpass", hz: 2900, q: 2.5, level: 0.8 }
};
const cymbal = (hz: number, seconds: number): DrumPatch => ({
  seconds,
  level: 0.24,
  noise: { filter: "bandpass", hz, q: 0.82, level: 1 }
});
const hat = (seconds: number, open = false): DrumPatch => ({
  seconds,
  level: 0.22,
  noise: { filter: "highpass", hz: 6700, q: 0.65, level: 1 },
  hat: open ? "open" : "closed"
});
const toms = new Map([
  [41, 82], [43, 96], [45, 113], [47, 132], [48, 155], [50, 184]
]);
const patches = new Map<number, DrumPatch>([
  [35, kick], [36, kick], [37, sideStick], [38, snare], [40, snare],
  [42, hat(0.075)], [44, hat(0.11)], [46, hat(0.44, true)],
  [49, cymbal(5750, 0.9)], [51, cymbal(8300, 0.62)], [52, cymbal(4100, 1.05)],
  [57, cymbal(5300, 0.85)], [59, cymbal(7200, 0.62)]
]);

export function drumPatchFor(midiNumber: number): DrumPatch {
  const frequency = toms.get(midiNumber);
  return patches.get(midiNumber) ?? (frequency
    ? {
      seconds: 0.28,
      level: 0.31,
      tone: { startHz: frequency * 1.45, endHz: frequency, level: 1 }
    }
    : sideStick);
}

export class DrumSynth {
  private noiseBuffer: AudioBuffer | undefined;
  private readonly openHats = new Map<string, { gain: GainNode; source: AudioScheduledSourceNode; end: number }>();

  constructor(private readonly context: BaseAudioContext) {}

  trigger(
    midiNumber: number,
    velocity: number,
    when: number,
    output: AudioNode,
    trackId: string
  ): DrumVoice {
    const patch = drumPatchFor(midiNumber);
    if (patch.hat) this.chokeOpenHat(when, trackId);

    const gain = this.context.createGain();
    const peak = Math.max(0.001, patch.level * Math.min(1, Math.max(0, velocity / 127)));
    const end = when + patch.seconds;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(peak, when + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    gain.connect(output);

    const sources: AudioScheduledSourceNode[] = [];
    const nodes: AudioNode[] = [gain];
    if (patch.tone) {
      const tone = this.context.createOscillator();
      const level = this.context.createGain();
      tone.type = "sine";
      tone.frequency.setValueAtTime(patch.tone.startHz, when);
      tone.frequency.exponentialRampToValueAtTime(patch.tone.endHz, when + patch.seconds * 0.45);
      level.gain.value = patch.tone.level;
      tone.connect(level);
      level.connect(gain);
      sources.push(tone);
      nodes.push(tone, level);
    }
    if (patch.noise) {
      const noise = this.context.createBufferSource();
      const eq = this.context.createBiquadFilter();
      const level = this.context.createGain();
      noise.buffer = this.noiseBuffer ??= this.createNoiseBuffer();
      eq.type = patch.noise.filter;
      eq.frequency.value = patch.noise.hz;
      eq.Q.value = patch.noise.q;
      level.gain.value = patch.noise.level;
      noise.connect(eq);
      eq.connect(level);
      level.connect(gain);
      sources.push(noise);
      nodes.push(noise, eq, level);
    }
    for (const source of sources) {
      source.start(when);
      source.stop(end);
    }
    const [oscillator, ...modulators] = sources;
    if (patch.hat === "open") {
      const entry = { gain, source: oscillator, end };
      this.openHats.set(trackId, entry);
      oscillator.addEventListener("ended", () => {
        if (this.openHats.get(trackId) === entry) this.openHats.delete(trackId);
      }, { once: true });
    }
    return { oscillator, gain, nodes, modulators };
  }

  private chokeOpenHat(when: number, trackId: string): void {
    const open = this.openHats.get(trackId);
    if (!open) return;
    this.openHats.delete(trackId);
    if (when >= open.end) return;
    const gain = open.gain.gain;
    if (typeof gain.cancelAndHoldAtTime === "function") {
      gain.cancelAndHoldAtTime(when);
    } else {
      gain.cancelScheduledValues(when);
      gain.setValueAtTime(Math.max(0.0001, gain.value), when);
    }
    const end = Math.min(open.end, when + 0.006);
    gain.linearRampToValueAtTime(0, end);
    open.source.stop(end);
  }

  private createNoiseBuffer(): AudioBuffer {
    const buffer = this.context.createBuffer(1, Math.ceil(this.context.sampleRate * 1.1), this.context.sampleRate);
    const samples = buffer.getChannelData(0);
    let state = 0x3e2a7f69;
    for (let index = 0; index < samples.length; index++) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      samples[index] = state / 0x80000000 - 1;
    }
    return buffer;
  }
}
