import { defaultMasterMix, type EffectSlot, type EffectSlotType, type EqPreset } from "../../model/mix";
import type { Score, Track } from "../../model/types";

export { normalizeVolume, type EffectSlot, type EffectSlotType, type EqPreset } from "../../model/mix";

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

export interface MixerState {
  tracks: Record<string, TrackMixerState>;
  master: { volume: number; focusPercent: number };
}

export interface TrackOutput {
  muted: boolean;
  gain: number;
  pan: number;
  eq: EqPreset;
  effectChain: EffectSlot[];
}

export function createMixerState(
  score: Score,
  visibility: Record<string, boolean> = {},
  controls: Record<string, Partial<TrackMixerState>> = {},
  focusPreview: number | null = null
): MixerState {
  return {
    tracks: Object.fromEntries(score.tracks.map((track) => [
      track.id,
      { ...trackMixerState(track), ...controls[track.id], visible: visibility[track.id] ?? true }
    ])),
    master: {
      ...score.masterMix,
      focusPercent: focusPreview ?? score.masterMix.focusPercent
    }
  };
}

export function createDefaultMixerState(tracks: Track[] = []): MixerState {
  return {
    tracks: Object.fromEntries(tracks.map((track) => [track.id, trackMixerState(track)])),
    master: defaultMasterMix()
  };
}

function trackMixerState(track: Track): TrackMixerState {
  const { effects, ...mix } = track.mix;
  return { ...mix, effectChain: effects, visible: true, volumeAutomationEnabled: true, panAutomationEnabled: true };
}

export function resolveTrackOutput(mixer: MixerState, trackId: string, focusedTrackId: string | null): TrackOutput {
  const track = mixer.tracks[trackId];
  if (!track) return { muted: true, gain: 0, pan: 0, eq: "flat", effectChain: [] };
  const soloActive = Object.values(mixer.tracks).some(({ solo }) => solo);
  return {
    muted: track.mute || (soloActive && !track.solo),
    gain: track.volume * focusGain(trackId, focusedTrackId, mixer.master.focusPercent),
    pan: track.pan,
    eq: track.eq,
    effectChain: track.effectChain
  };
}

export function toggleEffectSlot(chain: EffectSlot[], type: EffectSlotType): EffectSlot[] {
  return chain.some((slot) => slot.type === type)
    ? chain.filter((slot) => slot.type !== type)
    : [...chain, { type, amount: defaultEffectAmount(type), bypassed: false }].slice(0, 6);
}

export function faderToGain(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)) ** 2;
}

function focusGain(trackId: string, focusedTrackId: string | null, focusPercent: number): number {
  const amount = Math.min(Math.abs(focusPercent) / 100, 1);
  if (!focusedTrackId || amount === 0) return 1;
  return (focusPercent > 0) === (trackId === focusedTrackId) ? 1 : 1 - amount * 0.72;
}

function defaultEffectAmount(type: EffectSlotType): number {
  const amounts: Record<EffectSlotType, number> = {
    overdrive: 0.32, chorus: 0.22, flanger: 0.18, phaser: 0.2,
    delay: 0.22, reverb: 0.18, wah: 0.5, compressor: 0.55
  };
  return amounts[type];
}
