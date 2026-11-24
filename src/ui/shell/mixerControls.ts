import type { InputHTMLAttributes } from "react";
import type { EffectSlotType, EqPreset } from "../../engine/audio/mixer";
import type { MixerEditPhase } from "../../store/playbackStore";

export const eqPresets: EqPreset[] = ["flat", "bright", "warm", "bass"];

export const effectSlotButtons: Array<[EffectSlotType, string]> = [
  ["overdrive", "OD"], ["chorus", "Cho"], ["phaser", "Phs"], ["delay", "Dly"],
  ["reverb", "Rev"], ["wah", "Wah"], ["compressor", "Cmp"]
];

export function mixerRangeEvents(change: (value: number, phase: MixerEditPhase) => void): InputHTMLAttributes<HTMLInputElement> {
  return {
    onChange: (event) => change(event.currentTarget.valueAsNumber, "preview"),
    onPointerUp: (event) => change(event.currentTarget.valueAsNumber, "commit"),
    onPointerCancel: (event) => change(event.currentTarget.valueAsNumber, "commit"),
    onKeyUp: (event) => change(event.currentTarget.valueAsNumber, "commit"),
    onBlur: (event) => change(event.currentTarget.valueAsNumber, "commit")
  };
}
