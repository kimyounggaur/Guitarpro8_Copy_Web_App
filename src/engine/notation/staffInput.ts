import { writtenPitchOffset, type WrittenPitchOptions } from "../../model/derive";
import { DRUM_MAPPINGS } from "../../model/instruments";
import { DEFAULT_MAX_FRET } from "../../model/invariants";
import { keyFifths } from "../../model/keys";
import { frettedMidiPitch } from "../../model/trackKind";
import type { KeySignature, Track } from "../../model/types";
import { midiForSpelledPitch, spellPitch } from "./pitchSpelling";
import { pitchAtStaffPosition, staffPosition, type Clef } from "./staffPosition";

export interface FretPlacement {
  string: number;
  fret: number;
}

interface FingeringOptions {
  preferredString?: number;
  occupiedStrings?: ReadonlySet<number>;
  previousFret?: number;
}

export interface StaffInputOptions extends FingeringOptions, WrittenPitchOptions {
  position: number;
  clef: Clef;
  key: KeySignature;
  writtenMidi?: number;
}

export type StaffInputNote =
  | ({ kind: "stringed" } & FretPlacement)
  | { kind: "pitched"; midiPitch: number }
  | { kind: "percussion"; midiNumber: number; articulation: string };

export function chooseFretForPitch(track: Track, midi: number, options: FingeringOptions = {}): FretPlacement | null {
  if (track.kind !== "stringed" || !isMidiPitch(midi)) return null;
  const previousFret = options.previousFret ?? 0;
  let best: FretPlacement | null = null;
  let minDistance = Infinity;
  for (let string = 1; string <= track.tuning.strings.length; string += 1) {
    if (options.occupiedStrings?.has(string)) continue;
    const openPitch = frettedMidiPitch(track.tuning, string, 0);
    if (openPitch === null) continue;
    const fret = midi - openPitch;
    if (fret < 0 || fret > DEFAULT_MAX_FRET) continue;
    if (string === options.preferredString) return { string, fret };

    const distance = Math.abs(fret - previousFret);
    if (distance < minDistance || (distance === minDistance && best && fret < best.fret)) {
      best = { string, fret };
      minDistance = distance;
    }
  }
  return best;
}

export function resolveStaffInput(track: Track, options: StaffInputOptions): StaffInputNote | null {
  if (!Number.isFinite(options.position)) return null;
  if (track.kind === "percussion") {
    const nearest = DRUM_MAPPINGS.reduce((best, mapping) =>
      Math.abs(mapping.staffLine - options.position) < Math.abs(best.staffLine - options.position) ? mapping : best);
    return { kind: "percussion", midiNumber: nearest.midiNumber, articulation: nearest.articulations[0] };
  }

  const soundingMidi = writtenMidiAtCursor(options) - writtenPitchOffset(track, options);
  if (!isMidiPitch(soundingMidi)) return null;
  if (track.kind === "pitched") return { kind: "pitched", midiPitch: soundingMidi };

  const placement = chooseFretForPitch(track, soundingMidi, options);
  return placement ? { kind: "stringed", ...placement } : null;
}

export function moveStaffPitch(
  options: Pick<StaffInputOptions, "position" | "key" | "clef" | "writtenMidi">,
  direction: -1 | 1,
  chromatic: boolean
): { position: number; writtenMidi?: number } {
  if (!chromatic || options.clef === "percussion") {
    return { position: options.position + direction };
  }
  const writtenMidi = writtenMidiAtCursor(options) + direction;
  const pitch = spellPitch(writtenMidi, keyFifths(options.key));
  return { position: staffPosition(pitch, options.clef), writtenMidi };
}

function writtenMidiAtCursor(
  options: Pick<StaffInputOptions, "position" | "key" | "clef" | "writtenMidi">
): number {
  return options.writtenMidi ??
    midiForSpelledPitch(pitchAtStaffPosition(options.position, options.clef, keyFifths(options.key)));
}

function isMidiPitch(midi: number): boolean {
  return Number.isInteger(midi) && midi >= 0 && midi <= 127;
}
