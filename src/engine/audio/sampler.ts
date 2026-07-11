import type { NoteEvent } from "./compile";
import type { EffectSlot, EqPreset } from "./mixer";

export interface ScheduledVoice {
  oscillator: OscillatorNode;
  gain: GainNode;
  nodes: AudioNode[];
  modulators: OscillatorNode[];
}

export class SimpleSynth {
  private readonly masterGain: GainNode;
  private readonly limiter: DynamicsCompressorNode;
  private reverbBuffer: AudioBuffer | null = null;

  constructor(private readonly context: AudioContext) {
    this.masterGain = context.createGain();
    this.masterGain.gain.value = 0.2;

    this.limiter = context.createDynamicsCompressor();
    this.limiter.threshold.value = -10;
    this.limiter.knee.value = 12;
    this.limiter.ratio.value = 8;
    this.limiter.attack.value = 0.004;
    this.limiter.release.value = 0.14;

    this.masterGain.connect(this.limiter);
    this.limiter.connect(context.destination);
  }

  trigger(event: NoteEvent, when: number): ScheduledVoice | null {
    if (event.mix.muted || event.mix.gain <= 0) {
      return null;
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

    let current: AudioNode = oscillator;
    current = appendArticulationFilter(this.context, current, event, when, duration, nodes);
    current.connect(gain);
    current = gain;
    current = appendEq(this.context, current, event.mix.eq, nodes);

    event.mix.effectChain.forEach((slot) => {
      current = this.appendEffect(current, slot, event, when, duration, nodes, modulators);
    });

    const panner = this.context.createStereoPanner();
    panner.pan.setValueAtTime(clamp(event.mix.pan, -1, 1), when);
    nodes.push(panner);
    current.connect(panner);
    panner.connect(this.masterGain);

    oscillator.start(when);
    oscillator.stop(when + duration + 0.08);

    return { oscillator, gain, nodes, modulators };
  }

  dispose(): void {
    this.masterGain.disconnect();
    this.limiter.disconnect();
  }

  private appendEffect(
    input: AudioNode,
    slot: EffectSlot,
    event: NoteEvent,
    when: number,
    duration: number,
    nodes: AudioNode[],
    modulators: OscillatorNode[]
  ): AudioNode {
    const amount = clamp(slot.amount, 0, 1);

    switch (slot.type) {
      case "overdrive":
        return appendOverdrive(this.context, input, amount, nodes);
      case "chorus":
      case "flanger":
        return appendChorusLike(this.context, input, slot.type, amount, when, duration, nodes, modulators);
      case "phaser":
        return appendPhaser(this.context, input, amount, when, duration, nodes, modulators);
      case "delay":
        return appendDelay(this.context, input, amount, nodes);
      case "reverb":
        return appendReverb(this.context, input, amount, this.getReverbBuffer(amount), nodes);
      case "wah":
        return appendWah(this.context, input, event, amount, when, duration, nodes);
      case "compressor":
        return appendCompressor(this.context, input, amount, nodes);
    }
  }

  private getReverbBuffer(amount: number): AudioBuffer {
    if (this.reverbBuffer) {
      return this.reverbBuffer;
    }

    const length = Math.floor(this.context.sampleRate * (1.1 + amount * 0.6));
    const buffer = this.context.createBuffer(2, length, this.context.sampleRate);

    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const data = buffer.getChannelData(channel);

      for (let index = 0; index < length; index += 1) {
        const decay = (1 - index / length) ** 2.2;
        data[index] = (Math.random() * 2 - 1) * decay * 0.42;
      }
    }

    this.reverbBuffer = buffer;
    return buffer;
  }
}

function configurePitch(
  oscillator: OscillatorNode,
  event: NoteEvent,
  when: number,
  duration: number,
  context: AudioContext,
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
  context: AudioContext,
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
  context: AudioContext,
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

function appendEq(context: AudioContext, input: AudioNode, preset: EqPreset, nodes: AudioNode[]): AudioNode {
  if (preset === "flat") {
    return input;
  }

  const filters =
    preset === "bright"
      ? [
          eqFilter(context, "highshelf", 2600, 3.2),
          eqFilter(context, "lowshelf", 160, -1.8)
        ]
      : preset === "warm"
        ? [
            eqFilter(context, "lowshelf", 180, 2.8),
            eqFilter(context, "highshelf", 3000, -2.1)
          ]
        : [
            eqFilter(context, "lowshelf", 120, 4.2),
            eqFilter(context, "highshelf", 2400, -2.8)
          ];

  nodes.push(...filters);
  return connectSerial(input, filters);
}

function appendOverdrive(context: AudioContext, input: AudioNode, amount: number, nodes: AudioNode[]): AudioNode {
  const shaper = context.createWaveShaper();
  shaper.curve = distortionCurve(amount);
  shaper.oversample = "4x";
  nodes.push(shaper);
  input.connect(shaper);
  return shaper;
}

function appendChorusLike(
  context: AudioContext,
  input: AudioNode,
  type: "chorus" | "flanger",
  amount: number,
  when: number,
  duration: number,
  nodes: AudioNode[],
  modulators: OscillatorNode[]
): AudioNode {
  const output = context.createGain();
  const dry = context.createGain();
  const wet = context.createGain();
  const delay = context.createDelay(0.08);
  const lfo = context.createOscillator();
  const lfoGain = context.createGain();

  dry.gain.value = 1 - amount * 0.18;
  wet.gain.value = 0.18 + amount * 0.32;
  delay.delayTime.value = type === "chorus" ? 0.018 : 0.0045;
  lfo.frequency.value = type === "chorus" ? 0.85 : 0.35;
  lfoGain.gain.value = type === "chorus" ? 0.004 + amount * 0.006 : 0.001 + amount * 0.002;

  input.connect(dry);
  dry.connect(output);
  input.connect(delay);
  delay.connect(wet);
  wet.connect(output);
  lfo.connect(lfoGain);
  lfoGain.connect(delay.delayTime);

  nodes.push(output, dry, wet, delay, lfoGain);
  modulators.push(lfo);
  lfo.start(when);
  lfo.stop(when + duration + 0.35);
  return output;
}

function appendPhaser(
  context: AudioContext,
  input: AudioNode,
  amount: number,
  when: number,
  duration: number,
  nodes: AudioNode[],
  modulators: OscillatorNode[]
): AudioNode {
  const stages = [context.createBiquadFilter(), context.createBiquadFilter(), context.createBiquadFilter()];
  const lfo = context.createOscillator();
  const lfoGain = context.createGain();

  stages.forEach((stage, index) => {
    stage.type = "allpass";
    stage.frequency.value = 520 + index * 420;
    stage.Q.value = 0.65 + amount * 1.4;
    lfoGain.connect(stage.frequency);
  });

  lfo.frequency.value = 0.28 + amount * 0.42;
  lfoGain.gain.value = 280 + amount * 520;
  lfo.connect(lfoGain);
  nodes.push(...stages, lfoGain);
  modulators.push(lfo);
  lfo.start(when);
  lfo.stop(when + duration + 0.35);
  return connectSerial(input, stages);
}

function appendDelay(context: AudioContext, input: AudioNode, amount: number, nodes: AudioNode[]): AudioNode {
  const output = context.createGain();
  const dry = context.createGain();
  const wet = context.createGain();
  const delay = context.createDelay(1.2);
  const feedback = context.createGain();

  dry.gain.value = 1;
  wet.gain.value = 0.16 + amount * 0.28;
  delay.delayTime.value = 0.16 + amount * 0.22;
  feedback.gain.value = 0.18 + amount * 0.28;

  input.connect(dry);
  dry.connect(output);
  input.connect(delay);
  delay.connect(wet);
  wet.connect(output);
  delay.connect(feedback);
  feedback.connect(delay);

  nodes.push(output, dry, wet, delay, feedback);
  return output;
}

function appendReverb(
  context: AudioContext,
  input: AudioNode,
  amount: number,
  buffer: AudioBuffer,
  nodes: AudioNode[]
): AudioNode {
  const output = context.createGain();
  const dry = context.createGain();
  const wet = context.createGain();
  const convolver = context.createConvolver();

  convolver.buffer = buffer;
  dry.gain.value = 1 - amount * 0.12;
  wet.gain.value = 0.12 + amount * 0.34;

  input.connect(dry);
  dry.connect(output);
  input.connect(convolver);
  convolver.connect(wet);
  wet.connect(output);

  nodes.push(output, dry, wet, convolver);
  return output;
}

function appendWah(
  context: AudioContext,
  input: AudioNode,
  event: NoteEvent,
  amount: number,
  when: number,
  duration: number,
  nodes: AudioNode[]
): AudioNode {
  const filter = context.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 5 + amount * 7;

  if (event.effects.wah === "open") {
    filter.frequency.setValueAtTime(1650 + amount * 620, when);
  } else if (event.effects.wah === "closed") {
    filter.frequency.setValueAtTime(440 + amount * 260, when);
  } else {
    filter.frequency.setValueAtTime(420, when);
    filter.frequency.linearRampToValueAtTime(1750 + amount * 540, when + duration * 0.42);
    filter.frequency.linearRampToValueAtTime(720, when + duration);
  }

  nodes.push(filter);
  input.connect(filter);
  return filter;
}

function appendCompressor(context: AudioContext, input: AudioNode, amount: number, nodes: AudioNode[]): AudioNode {
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -24 + amount * 8;
  compressor.knee.value = 18;
  compressor.ratio.value = 3 + amount * 8;
  compressor.attack.value = 0.004;
  compressor.release.value = 0.12 + amount * 0.1;
  nodes.push(compressor);
  input.connect(compressor);
  return compressor;
}

function connectSerial(input: AudioNode, nodes: AudioNode[]): AudioNode {
  let current = input;

  nodes.forEach((node) => {
    current.connect(node);
    current = node;
  });

  return current;
}

function eqFilter(context: AudioContext, type: BiquadFilterType, frequency: number, gain: number): BiquadFilterNode {
  const filter = context.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  filter.gain.value = gain;
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
  return Math.max(0.0002, (event.velocity / 127) * articulation * event.mix.gain);
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

function distortionCurve(amount: number): Float32Array<ArrayBuffer> {
  const samples = 256;
  const curve = new Float32Array(new ArrayBuffer(samples * Float32Array.BYTES_PER_ELEMENT));
  const drive = 1 + amount * 46;

  for (let index = 0; index < samples; index += 1) {
    const x = (index * 2) / samples - 1;
    curve[index] = ((3 + drive) * x * 20) / (Math.PI + drive * Math.abs(x));
  }

  return curve;
}

function midiToFrequency(midiPitch: number): number {
  return 440 * 2 ** ((midiPitch - 69) / 12);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
