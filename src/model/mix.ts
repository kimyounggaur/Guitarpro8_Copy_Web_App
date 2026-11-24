export type EqPreset = "flat" | "bright" | "warm" | "bass";
export type EffectSlotType = "overdrive" | "chorus" | "flanger" | "phaser" | "delay" | "reverb" | "wah" | "compressor";

export interface EffectSlot {
  type: EffectSlotType;
  amount: number;
  bypassed: boolean;
}

export interface TrackMix {
  volume: number;
  pan: number;
  mute: boolean;
  solo: boolean;
  eq: EqPreset;
  effects: EffectSlot[];
}

export interface MasterMix {
  volume: number;
  focusPercent: number;
}

export function defaultTrackMix(name: string): TrackMix {
  return { volume: 0.88, pan: name.toLowerCase().includes("bass") ? -0.08 : 0.08, mute: false, solo: false, eq: "flat", effects: [] };
}

export function defaultMasterMix(): MasterMix {
  return { volume: 1, focusPercent: 0 };
}

export function normalizeVolume(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value > 1.2 ? value / 100 : value));
}
