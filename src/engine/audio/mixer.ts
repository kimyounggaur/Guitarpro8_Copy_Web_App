import type { Automation, Score, Track } from "../../model/types";

export type EqPreset = "flat" | "bright" | "warm" | "bass";
export type EffectSlotType =
  | "overdrive"
  | "chorus"
  | "flanger"
  | "phaser"
  | "delay"
  | "reverb"
  | "wah"
  | "compressor";

export interface EffectSlot {
  type: EffectSlotType;
  amount: number;
  bypassed: boolean;
}

export interface TrackMixerState {
  visible: boolean;
  mute: boolean;
  solo: boolean;
  volume: number;
  volumeAutomationEnabled: boolean;
  pan: number;
  panAutomationEnabled: boolean;
  eq: EqPreset;
  effectChain: EffectSlot[];
}

export interface MasterMixerState {
  volume: number;
  pan: number;
  focusPercent: number;
}

export interface MixerState {
  tracks: Record<string, TrackMixerState>;
  master: MasterMixerState;
}

export interface NoteMix {
  muted: boolean;
  gain: number;
  pan: number;
  eq: EqPreset;
  effectChain: EffectSlot[];
}

export function createDefaultMixerState(tracks: Track[] = []): MixerState {
  return {
    tracks: Object.fromEntries(tracks.map((track) => [track.id, createDefaultTrackMixer(track)])),
    master: {
      volume: 1,
      pan: 0,
      focusPercent: 0
    }
  };
}

export function createDefaultTrackMixer(track: Track): TrackMixerState {
  const isBass = track.name.toLowerCase().includes("bass");

  return {
    visible: true,
    mute: false,
    solo: false,
    volume: 0.88,
    volumeAutomationEnabled: true,
    pan: isBass ? -0.08 : 0.08,
    panAutomationEnabled: true,
    eq: isBass ? "bass" : "bright",
    effectChain: isBass
      ? [{ type: "compressor", amount: 0.45, bypassed: false }]
      : [
          { type: "overdrive", amount: 0.24, bypassed: false },
          { type: "reverb", amount: 0.18, bypassed: false }
        ]
  };
}

export function syncMixerToTracks(mixer: MixerState, tracks: Track[]): MixerState {
  const nextTracks: Record<string, TrackMixerState> = {};

  tracks.forEach((track) => {
    nextTracks[track.id] = mixer.tracks[track.id] ?? createDefaultTrackMixer(track);
  });

  return {
    master: mixer.master,
    tracks: nextTracks
  };
}

export function buildNoteMix(
  score: Score,
  trackId: string,
  writtenTick: number,
  mixer: MixerState,
  focusedTrackId: string | null
): NoteMix {
  if (trackId === "__metronome__") {
    return {
      muted: false,
      gain: 0.9,
      pan: 0,
      eq: "bright",
      effectChain: []
    };
  }

  const track = score.tracks.find((candidate) => candidate.id === trackId);
  const trackMixer = mixer.tracks[trackId];

  if (!track || !trackMixer || !trackMixer.visible) {
    return mutedMix(trackMixer);
  }

  const soloActive = Object.values(mixer.tracks).some((state) => state.solo);
  const muted = trackMixer.mute || (soloActive && !trackMixer.solo);
  const volumeAutomation = trackMixer.volumeAutomationEnabled
    ? automationValue(track.automations, "volume", writtenTick, 1)
    : 1;
  const panAutomation = trackMixer.panAutomationEnabled
    ? automationValue(track.automations, "pan", writtenTick, 0)
    : 0;
  const masterVolume = automationValue(score.masterAutomations, "volume", writtenTick, mixer.master.volume);
  const masterPan = automationValue(score.masterAutomations, "pan", writtenTick, mixer.master.pan);
  const focus = focusGain(trackId, focusedTrackId, mixer.master.focusPercent);

  return {
    muted,
    gain: muted ? 0 : clamp(trackMixer.volume * volumeAutomation * masterVolume * focus, 0, 1.6),
    pan: clamp(trackMixer.pan + panAutomation + masterPan, -1, 1),
    eq: trackMixer.eq,
    effectChain: trackMixer.effectChain.filter((slot) => !slot.bypassed)
  };
}

export function toggleEffectSlot(
  mixer: MixerState,
  trackId: string,
  type: EffectSlotType
): MixerState {
  const trackMixer = mixer.tracks[trackId];

  if (!trackMixer) {
    return mixer;
  }

  const existingIndex = trackMixer.effectChain.findIndex((slot) => slot.type === type);
  const nextChain =
    existingIndex >= 0
      ? trackMixer.effectChain.filter((_, index) => index !== existingIndex)
      : [...trackMixer.effectChain, { type, amount: defaultEffectAmount(type), bypassed: false }].slice(0, 6);

  return {
    ...mixer,
    tracks: {
      ...mixer.tracks,
      [trackId]: {
        ...trackMixer,
        effectChain: nextChain
      }
    }
  };
}

function mutedMix(trackMixer: TrackMixerState | undefined): NoteMix {
  return {
    muted: true,
    gain: 0,
    pan: 0,
    eq: trackMixer?.eq ?? "flat",
    effectChain: []
  };
}

function focusGain(trackId: string, focusedTrackId: string | null, focusPercent: number): number {
  const amount = clamp(Math.abs(focusPercent) / 100, 0, 1);

  if (!focusedTrackId || amount === 0) {
    return 1;
  }

  if (focusPercent > 0) {
    return trackId === focusedTrackId ? 1 : 1 - amount * 0.72;
  }

  return trackId === focusedTrackId ? 1 - amount * 0.72 : 1;
}

function automationValue(
  automations: Automation[],
  type: "volume" | "pan",
  tick: number,
  fallback: number
): number {
  const automation = automations.find((candidate) => candidate.type === type);

  if (!automation || automation.points.length === 0) {
    return fallback;
  }

  const points = [...automation.points].sort((left, right) => left.tick - right.tick);
  const previous = [...points].reverse().find((point) => point.tick <= tick) ?? points[0];
  const next = points.find((point) => point.tick > tick);

  if (!next || previous.transition === "constant") {
    return type === "volume" ? normalizeVolume(previous.value) : normalizePan(previous.value);
  }

  const range = Math.max(1, next.tick - previous.tick);
  const progress = clamp((tick - previous.tick) / range, 0, 1);
  const start = type === "volume" ? normalizeVolume(previous.value) : normalizePan(previous.value);
  const end = type === "volume" ? normalizeVolume(next.value) : normalizePan(next.value);
  return start + (end - start) * progress;
}

function normalizeVolume(value: number): number {
  return clamp(value > 1 ? value / 100 : value, 0, 1.6);
}

function normalizePan(value: number): number {
  return clamp(Math.abs(value) > 1 ? value / 100 : value, -1, 1);
}

function defaultEffectAmount(type: EffectSlotType): number {
  const amounts: Record<EffectSlotType, number> = {
    overdrive: 0.32,
    chorus: 0.22,
    flanger: 0.18,
    phaser: 0.2,
    delay: 0.22,
    reverb: 0.18,
    wah: 0.5,
    compressor: 0.55
  };

  return amounts[type];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
