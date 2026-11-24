import type { Note, StaffConfig, Track, TrackClef, TrackKind, Tuning } from "./types";

interface TrackIdentity {
  id?: string;
  name?: string;
  icon?: string;
  stringed?: boolean;
  staffConfig?: StaffConfig;
  kind?: TrackKind;
  clef?: TrackClef;
}

export function inferTrackNotation(identity: TrackIdentity): { kind: TrackKind; clef: TrackClef; ambiguous: boolean } {
  const icon = identity.icon?.toLowerCase() ?? "";
  const name = identity.name?.toLowerCase() ?? "";
  const percussion = /^(?:drums?|percussion)$/.test(icon) || /^(?:drums?|drum kit|percussion)$/.test(name);
  const knownPitched = /^(?:piano|orchestra|keyboard|midi)$/.test(icon) ||
    /^(?:midi-track-\d+)$/.test(identity.id ?? "");
  const kind = identity.kind ?? (percussion ? "percussion" :
    identity.stringed === false || knownPitched ? "pitched" : "stringed");

  let clef = identity.clef;
  if (!clef) {
    if (kind === "percussion") clef = "percussion";
    else if (identity.staffConfig === "grand" || icon === "piano") clef = "grand";
    else if (kind === "stringed" && /\b(contrabass|cello)\b/.test(name)) clef = "bass";
    else if (kind === "stringed" && (/^bass/.test(name) || icon === "bass")) clef = "bass8vb";
    else if (kind === "stringed" && (/guitar/.test(name) || icon === "guitar" && !/\b(ukulele|banjo|mandolin|violin|viola)\b/.test(name))) clef = "treble8vb";
    else clef = "treble";
  }

  const ambiguous = !identity.kind && identity.stringed === undefined && !knownPitched && !percussion &&
    !/^(?:guitar|bass)$/.test(icon);
  return { kind, clef, ambiguous };
}

export function frettedMidiPitch(tuning: Tuning, string: number, fret: number): number | null {
  if (!Number.isInteger(string) || string < 1 || !Number.isInteger(fret) || fret < 0) return null;
  const open = tuning.strings[tuning.strings.length - string];
  if (open === undefined) return null;

  const partial = tuning.partialCapo;
  const capo = partial?.strings.includes(string) ? Math.max(tuning.capo, partial.fret) : tuning.capo;
  const pitch = open + capo + fret;
  return Number.isFinite(pitch) ? pitch : null;
}

export function isMidiPitch(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 127;
}

export function trackNoteMidiPitch(note: Note, track: Track): number | null {
  if (track.kind === "stringed") return frettedMidiPitch(track.tuning, note.string, note.fret);
  const pitch = track.kind === "percussion" ? note.midiNumber : note.midiPitch;
  return isMidiPitch(pitch) ? pitch : null;
}

export function clefPitchOffset(clef: TrackClef): number {
  return clef === "treble8vb" || clef === "bass8vb" ? 12 : 0;
}

/** Identifies one sustained note within a voice, even on a polyphonic staff. */
export function noteTieIdentity(note: Note, track: Track): string {
  if (track.kind === "stringed") return `string:${note.string}`;
  return track.kind === "pitched" ? `pitch:${note.midiPitch}` : `drum:${note.midiNumber}`;
}
