import type { NoteEvent } from "./compile";
import { AudioGraph } from "./audioGraph";
import { DrumSynth } from "./drumSynth";

// Calibrate the dry oscillator against the stereo demo RMS after the faders
// and master headroom. The Web Audio graph mixes float samples before limiting.
const SYNTH_MAKEUP_GAIN = 10 ** (15 / 20);

export interface ScheduledVoice {
  oscillator: AudioScheduledSourceNode;
  gain: GainNode;
  nodes: AudioNode[];
  modulators: AudioScheduledSourceNode[];
}

export class SimpleSynth {
  readonly graph: AudioGraph;
  private readonly drums: DrumSynth;

  constructor(private readonly context: BaseAudioContext) {
    this.graph = new AudioGraph(context);
    this.drums = new DrumSynth(context);
  }

  trigger(event: NoteEvent, when: number): ScheduledVoice {
    if (event.percussion) {
      return this.drums.trigger(event.midiPitch, event.velocity, when, this.graph.trackInput(event.trackId), event.trackId);
    }

    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const nodes: AudioNode[] = [oscillator, gain];
    const modulators: OscillatorNode[] = [];
    const duration = Math.max(0.03, event.durationSec);
    const peak = peakGain(event);

    oscillator.type = oscillatorType(event);
    configurePitch(oscillator, event, when, duration, this.context, nodes, modulators);
    scheduleEnvelope(gain, event, when, duration, peak, this.context, nodes, modulators);
    appendArticulationFilter(this.context, oscillator, event, when, duration, nodes).connect(gain);
    gain.connect(this.graph.trackInput(event.trackId));

    oscillator.start(when);
    oscillator.stop(when + duration + 0.08);
    return { oscillator, gain, nodes, modulators };
  }

  dispose(): void {
    this.graph.dispose();
  }
}

function configurePitch(
  oscillator: OscillatorNode,
  event: NoteEvent,
  when: number,
  duration: number,
  context: BaseAudioContext,
  nodes: AudioNode[],
  modulators: OscillatorNode[]
): void {
  const baseFrequency = midiToFrequency(event.midiPitch);
  oscillator.frequency.setValueAtTime(baseFrequency, when);
  oscillator.detune.setValueAtTime(0, when);

  if (event.effects.pickscrape) {
    oscillator.frequency.setValueAtTime(baseFrequency * 2.2, when);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, baseFrequency * 0.72), when + duration);
  } else if (event.effects.bendPoints.length > 0) {
    applyBendCurve(oscillator, event, when, duration);
  } else if (event.effects.slide) {
    applySlideCurve(oscillator, event.effects.slide, when, duration);
  }

  if (event.effects.vibrato !== "none") {
    const lfo = context.createOscillator();
    const lfoGain = context.createGain();
    lfo.type = "sine";
    lfo.frequency.value = event.effects.vibrato === "wide" ? 6.3 : 5.4;
    lfoGain.gain.value = event.effects.vibrato === "wide" ? 28 : 13;
    lfo.connect(lfoGain);
    lfoGain.connect(oscillator.detune);
    nodes.push(lfoGain);
    modulators.push(lfo);
    lfo.start(when + Math.min(0.12, duration * 0.25));
    lfo.stop(when + duration + 0.08);
  }
}

function applyBendCurve(oscillator: OscillatorNode, event: NoteEvent, when: number, duration: number): void {
  const points = [...event.effects.bendPoints].sort((left, right) => left.offset - right.offset);
  const first = points[0];

  oscillator.detune.cancelScheduledValues(when);
  oscillator.detune.setValueAtTime(first ? bendValueToCents(first.value) : 0, when);

  points.forEach((point) => {
    oscillator.detune.linearRampToValueAtTime(
      bendValueToCents(point.value),
      when + duration * bendOffsetRatio(point.offset)
    );
  });
}

function applySlideCurve(
  oscillator: OscillatorNode,
  slide: NonNullable<NoteEvent["effects"]["slide"]>,
  when: number,
  duration: number
): void {
  const [start, end] =
    slide === "in-from-above"
      ? [180, 0]
      : slide === "out-upwards"
        ? [0, 220]
        : slide === "out-downwards"
          ? [0, -220]
          : [slide === "in-from-below" ? -220 : -160, 0];

  oscillator.detune.setValueAtTime(start, when);
  oscillator.detune.linearRampToValueAtTime(end, when + duration * 0.92);
}

function scheduleEnvelope(
  gain: GainNode,
  event: NoteEvent,
  when: number,
  duration: number,
  peak: number,
  context: BaseAudioContext,
  nodes: AudioNode[],
  modulators: OscillatorNode[]
): void {
  const attack = event.effects.volumeSwell
    ? duration * 0.68
    : event.effects.fadeIn
      ? duration * 0.42
      : Math.min(event.effects.attackSec, duration * 0.35);
  const release = Math.min(event.effects.releaseSec, duration * 0.5);
  const tremoloBase = event.effects.tremoloPicking ? peak * 0.64 : peak;
  const releaseStart = Math.max(when + attack + 0.01, when + duration - release);

  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, tremoloBase), when + Math.max(0.001, attack));
  gain.gain.setValueAtTime(Math.max(0.0002, tremoloBase), releaseStart);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);

  if (event.effects.tremoloPicking) {
    const lfo = context.createOscillator();
    const lfoGain = context.createGain();
    lfo.type = "triangle";
    lfo.frequency.value = tremoloRate(event.effects.tremoloPicking);
    lfoGain.gain.value = peak * 0.24;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    nodes.push(lfoGain);
    modulators.push(lfo);
    lfo.start(when + attack);
    lfo.stop(when + duration);
  }
}

function appendArticulationFilter(
  context: BaseAudioContext,
  input: AudioNode,
  event: NoteEvent,
  when: number,
  duration: number,
  nodes: AudioNode[]
): AudioNode {
  if (event.effects.filter === "none") {
    return input;
  }

  const filter = context.createBiquadFilter();
  nodes.push(filter);

  if (event.effects.filter === "palmMute") {
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(820, when);
    filter.frequency.linearRampToValueAtTime(980, when + duration * 0.2);
    filter.Q.value = 0.9;
  } else if (event.effects.filter === "harmonic") {
    filter.type = "highpass";
    filter.frequency.value = 1250;
    filter.Q.value = 0.65;
  } else {
    filter.type = "bandpass";
    filter.frequency.value = event.effects.pickscrape ? 2200 : 1450;
    filter.Q.value = event.effects.deadSlapped ? 2.5 : 1.6;
  }

  input.connect(filter);
  return filter;
}

function oscillatorType(event: NoteEvent): OscillatorType {
  if (event.trackId === "__metronome__" || event.effects.dead || event.effects.pickscrape) {
    return "square";
  }

  if (event.effects.harmonic) {
    return "sine";
  }

  if (event.effects.palmMute || event.effects.hopo) {
    return "triangle";
  }

  return event.effects.slap || event.effects.pop ? "square" : "sawtooth";
}

function peakGain(event: NoteEvent): number {
  const articulation =
    event.effects.dead || event.effects.deadSlapped
      ? 0.24
      : event.effects.ghost
        ? 0.33
        : event.effects.harmonic
          ? 0.42
          : event.effects.palmMute
            ? 0.5
            : 0.68;
  return SYNTH_MAKEUP_GAIN * (0.05 + clamp(event.velocity / 127, 0, 1) * 0.2) * articulation / 0.68;
}

function bendOffsetRatio(offset: number): number {
  if (Math.abs(offset) <= 1) {
    return clamp(offset, 0, 1);
  }

  return clamp(offset / 60, 0, 1);
}

function bendValueToCents(value: number): number {
  if (Math.abs(value) > 12) {
    return clamp(value, -300, 300) * 2;
  }

  return clamp(value, -12, 12) * 50;
}

function tremoloRate(value: NonNullable<NoteEvent["effects"]["tremoloPicking"]>): number {
  const rates = {
    8: 7,
    16: 11,
    32: 16
  } as const;
  return rates[value];
}

function midiToFrequency(midiPitch: number): number {
  return 440 * 2 ** ((midiPitch - 69) / 12);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
