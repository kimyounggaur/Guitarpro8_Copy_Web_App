import { faderToGain, resolveTrackOutput, type EffectSlot, type EqPreset, type MixerState, type TrackOutput } from "./mixer";
import { mixerValueAt, type MixerAutomation, type MixerPoint } from "./mixerAutomation";

interface TrackAudioBus {
  input: GainNode;
  volume: GainNode;
  volumeAutomation: GainNode;
  panner: StereoPannerNode;
  audible: GainNode;
  effectNodes: AudioNode[];
  modulators: OscillatorNode[];
  effectsKey: string;
  gainValue: number;
  panValue: number;
  audibleValue: number;
}

const MASTER_HEADROOM = 10 ** (-6 / 20);
const MIX_TIME_CONSTANT = 0.01;

export class AudioGraph {
  private readonly master: GainNode;
  private readonly masterAutomation: GainNode;
  private readonly limiter: DynamicsCompressorNode;
  private readonly tracks = new Map<string, TrackAudioBus>();
  private readonly reverbBuffers = new Map<number, AudioBuffer>();

  constructor(private readonly context: BaseAudioContext) {
    this.master = context.createGain();
    this.master.gain.value = MASTER_HEADROOM;
    this.masterAutomation = context.createGain();

    this.limiter = context.createDynamicsCompressor();
    this.limiter.threshold.value = -3;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.250;
    this.master.connect(this.masterAutomation);
    this.masterAutomation.connect(this.limiter);
    this.limiter.connect(context.destination);
  }

  trackInput(trackId: string): GainNode {
    const bus = this.tracks.get(trackId);
    if (bus) return bus.input;
    return this.setTrackMix(trackId, {
      muted: false, gain: trackId === "__metronome__" ? 0.9 : 1,
      pan: 0, eq: trackId === "__metronome__" ? "bright" : "flat", effectChain: []
    }).input;
  }

  applyMixer(mixer: MixerState, focusedTrackId: string | null, automation: MixerAutomation | undefined,
    startSec: number, initial = false, when = this.context.currentTime, endSec = Infinity): void {
    const masterVolume = MASTER_HEADROOM * faderToGain(mixer.master.volume);
    this.master.gain.cancelScheduledValues(when);
    if (initial) this.master.gain.setValueAtTime(masterVolume, when);
    else this.master.gain.setTargetAtTime(masterVolume, when, MIX_TIME_CONSTANT);
    if (initial) scheduleLane(this.masterAutomation.gain, automation?.master ?? [], startSec, when, 1, faderToGain, endSec);

    for (const [trackId, settings] of Object.entries(mixer.tracks)) {
      const output = resolveTrackOutput(mixer, trackId, focusedTrackId);
      const bus = this.setTrackMix(trackId, output, when, initial);
      const lanes = automation?.tracks[trackId];
      scheduleLane(bus.volumeAutomation.gain, settings.volumeAutomationEnabled ? (lanes?.volume ?? []) : [],
        startSec, when, 1, faderToGain, endSec);
      const pan = settings.panAutomationEnabled ? lanes?.pan : lanes?.masterPan;
      scheduleLane(bus.panner.pan, pan ?? [], startSec, when, 0, (value) => clamp(value + output.pan, -1, 1), endSec);
    }
  }

  setTrackMix(trackId: string, mix: TrackOutput, when = this.context.currentTime, initial = false): TrackAudioBus {
    const gainValue = faderToGain(mix.gain);
    const panValue = clamp(mix.pan, -1, 1);
    const audibleValue = mix.muted ? 0 : 1;
    let bus = this.tracks.get(trackId);

    if (!bus) {
      bus = this.createTrackBus(gainValue, panValue, audibleValue);
      this.tracks.set(trackId, bus);
    } else {
      if (gainValue !== bus.gainValue) {
        if (initial) bus.volume.gain.setValueAtTime(gainValue, when);
        else bus.volume.gain.setTargetAtTime(gainValue, when, MIX_TIME_CONSTANT);
        bus.gainValue = gainValue;
      }
      if (panValue !== bus.panValue) {
        bus.panner.pan.setTargetAtTime(panValue, when, MIX_TIME_CONSTANT);
        bus.panValue = panValue;
      }
      if (audibleValue !== bus.audibleValue) {
        bus.audible.gain.cancelScheduledValues(when);
        bus.audible.gain.setTargetAtTime(audibleValue, when, MIX_TIME_CONSTANT);
        if (audibleValue === 0) bus.audible.gain.setValueAtTime(0, when + 0.04);
        bus.audibleValue = audibleValue;
      }
    }

    const enabled = mix.effectChain.filter((slot) => !slot.bypassed);
    const key = JSON.stringify([mix.eq, enabled]);
    if (key !== bus.effectsKey) {
      this.rebuildEffects(bus, mix.eq, enabled);
      bus.effectsKey = key;
    }
    return bus;
  }

  setMasterVolume(fader: number, when = this.context.currentTime): void {
    this.master.gain.setTargetAtTime(MASTER_HEADROOM * faderToGain(fader), when, MIX_TIME_CONSTANT);
  }

  dispose(): void {
    for (const bus of this.tracks.values()) {
      stopModulators(bus.modulators);
      for (const node of [bus.input, ...bus.effectNodes, bus.volume, bus.volumeAutomation, bus.panner, bus.audible]) node.disconnect();
    }
    this.tracks.clear();
    this.reverbBuffers.clear();
    this.master.disconnect();
    this.masterAutomation.disconnect();
    this.limiter.disconnect();
  }

  private createTrackBus(gainValue: number, panValue: number, audibleValue: number): TrackAudioBus {
    const input = this.context.createGain();
    const volume = this.context.createGain();
    const volumeAutomation = this.context.createGain();
    const panner = this.context.createStereoPanner();
    const audible = this.context.createGain();
    volume.gain.value = gainValue;
    panner.pan.value = panValue;
    audible.gain.value = audibleValue;
    volume.connect(volumeAutomation);
    volumeAutomation.connect(panner);
    panner.connect(audible);
    audible.connect(this.master);
    return { input, volume, volumeAutomation, panner, audible, effectNodes: [], modulators: [], effectsKey: "", gainValue, panValue, audibleValue };
  }

  private rebuildEffects(bus: TrackAudioBus, preset: EqPreset, enabled: EffectSlot[]): void {
    bus.input.disconnect();
    stopModulators(bus.modulators);
    for (const node of bus.effectNodes) node.disconnect();
    bus.effectNodes = [];
    bus.modulators = [];

    let tail = appendEq(this.context, bus.input, preset, bus.effectNodes);
    for (const slot of enabled) {
      tail = this.appendEffect(tail, slot, bus);
    }
    tail.connect(bus.volume);
  }

  private appendEffect(input: AudioNode, slot: EffectSlot, bus: TrackAudioBus): AudioNode {
    const amount = clamp(slot.amount, 0, 1);
    const { effectNodes, modulators } = bus;
    switch (slot.type) {
      case "overdrive": return appendOverdrive(this.context, input, amount, effectNodes);
      case "chorus":
      case "flanger": return appendChorusLike(this.context, input, slot.type, amount, effectNodes, modulators);
      case "phaser": return appendPhaser(this.context, input, amount, effectNodes, modulators);
      case "delay": return appendDelay(this.context, input, amount, effectNodes);
      case "reverb": return appendReverb(this.context, input, amount, this.reverbBuffer(amount), effectNodes);
      case "wah": return appendWah(this.context, input, amount, effectNodes);
      case "compressor": return appendCompressor(this.context, input, amount, effectNodes);
    }
  }

  private reverbBuffer(amount: number): AudioBuffer {
    const cached = this.reverbBuffers.get(amount);
    if (cached) return cached;

    const length = Math.floor(this.context.sampleRate * (1.1 + amount * 0.6));
    const buffer = this.context.createBuffer(2, length, this.context.sampleRate);
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let index = 0; index < length; index += 1) {
        data[index] = (Math.random() * 2 - 1) * (1 - index / length) ** 2.2 * 0.42;
      }
    }
    this.reverbBuffers.set(amount, buffer);
    return buffer;
  }
}

function scheduleLane(
  parameter: AudioParam, points: MixerPoint[], position: number, when: number,
  fallback: number, transform: (value: number) => number, endSec: number
): void {
  parameter.cancelScheduledValues(when);
  parameter.setValueAtTime(transform(mixerValueAt(points, position, fallback).value), when);
  for (const { timeSec, value, ramp } of points) {
    if (timeSec <= position) continue;
    if (timeSec >= endSec) break;
    const time = when + timeSec - position;
    if (ramp) parameter.linearRampToValueAtTime(transform(value), time);
    else parameter.setValueAtTime(transform(value), time);
  }
  if (Number.isFinite(endSec) && endSec > position) {
    const lastSecond = endSec - 1e-6;
    const endpoint = mixerValueAt(points, lastSecond, fallback);
    if (endpoint.ramp) parameter.linearRampToValueAtTime(transform(endpoint.value), when + lastSecond - position);
  }
}

function stopModulators(modulators: OscillatorNode[]): void {
  for (const modulator of modulators) {
    modulator.stop();
    modulator.disconnect();
  }
}

function appendEq(context: BaseAudioContext, input: AudioNode, preset: EqPreset, nodes: AudioNode[]): AudioNode {
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

function appendOverdrive(context: BaseAudioContext, input: AudioNode, amount: number, nodes: AudioNode[]): AudioNode {
  const shaper = context.createWaveShaper();
  shaper.curve = distortionCurve(amount);
  shaper.oversample = "4x";
  nodes.push(shaper);
  input.connect(shaper);
  return shaper;
}

function appendChorusLike(
  context: BaseAudioContext,
  input: AudioNode,
  type: "chorus" | "flanger",
  amount: number,
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
  lfo.start();
  return output;
}

function appendPhaser(
  context: BaseAudioContext,
  input: AudioNode,
  amount: number,
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
  lfo.start();
  return connectSerial(input, stages);
}

function appendDelay(context: BaseAudioContext, input: AudioNode, amount: number, nodes: AudioNode[]): AudioNode {
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
  context: BaseAudioContext,
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

function appendWah(context: BaseAudioContext, input: AudioNode, amount: number, nodes: AudioNode[]): AudioNode {
  const filter = context.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 510 + amount * 1150;
  filter.Q.value = 5 + amount * 7;
  nodes.push(filter);
  input.connect(filter);
  return filter;
}

function appendCompressor(context: BaseAudioContext, input: AudioNode, amount: number, nodes: AudioNode[]): AudioNode {
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

function eqFilter(context: BaseAudioContext, type: BiquadFilterType, frequency: number, gain: number): BiquadFilterNode {
  const filter = context.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  filter.gain.value = gain;
  return filter;
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
