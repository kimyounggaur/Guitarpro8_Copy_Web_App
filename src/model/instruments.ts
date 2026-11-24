import { assignFingerings, handPosition } from "./fingering";
import { frettedMidiPitch } from "./trackKind";
import type { NotationType, StaffConfig, Track, TrackClef, Tuning } from "./types";

export type InstrumentCategory = "Stringed" | "Orchestra" | "Drums" | "MIDI";
export type RetuneMode = "keep-fingering" | "adjust-fingering" | "remove-missing-strings";

export interface InstrumentDefinition {
  id: string;
  category: InstrumentCategory;
  name: string;
  shortName: string;
  color: string;
  icon: string;
  notationTypes: NotationType[];
  staffConfig: StaffConfig;
  tuning: number[];
  tuningLabel: string;
  stringed: boolean;
  clef: TrackClef;
  range: [number, number];
  gmProgram: number;
  soundingOffset: number;
}

export interface TuningPreset {
  id: string;
  instrumentIds: string[];
  name: string;
  strings: number[];
  label: string;
}

export interface DrumMapping {
  id: string;
  name: string;
  midiNumber: number;
  staffLine: number;
  articulations: string[];
  shortcut: number;
}

export const INSTRUMENT_DEFINITIONS: InstrumentDefinition[] = [
  stringed("guitar", "Guitar", "Gtr.", "#2563eb", [40, 45, 50, 55, 59, 64], "E A D G B E", 25),
  stringed("guitar-7", "7-string Guitar", "7Gtr.", "#1d4ed8", [31, 40, 45, 50, 55, 59, 64], "B E A D G B E", 25),
  stringed("guitar-drop-d", "Drop D Guitar", "DropD", "#0f766e", [38, 45, 50, 55, 59, 64], "D A D G B E", 30),
  stringed("bass", "Bass", "Bs.", "#c2410c", [28, 33, 38, 43], "E A D G", 34),
  stringed("bass-5", "5-string Bass", "5Bs.", "#9a3412", [23, 28, 33, 38, 43], "B E A D G", 34),
  stringed("ukulele", "Ukulele", "Uke", "#ca8a04", [67, 60, 64, 69], "G C E A", 24),
  stringed("banjo", "Banjo", "Bjo.", "#a16207", [67, 50, 55, 59, 62], "G D G B D", 105),
  stringed("mandolin", "Mandolin", "Mdn.", "#b45309", [55, 62, 69, 76], "G D A E", 26),
  stringed("violin", "Violin", "Vln.", "#9333ea", [55, 62, 69, 76], "G D A E", 40),
  stringed("viola", "Viola", "Vla.", "#7e22ce", [48, 55, 62, 69], "C G D A", 41),
  stringed("cello", "Cello", "Vc.", "#6d28d9", [36, 43, 50, 57], "C G D A", 42),
  stringed("contrabass", "Contrabass", "Cb.", "#581c87", [28, 33, 38, 43], "E A D G", 43),
  keyed("piano", "Piano", "Pno.", "#64748b", "grand", [21, 108], 0),
  keyed("electric-piano", "Electric Piano", "E.Pno.", "#475569", "grand", [21, 108], 4),
  orchestra("flute", "Flute", "Fl.", "#0891b2", "single", [60, 96], 73),
  orchestra("clarinet-bb", "Bb Clarinet", "Cl.", "#0e7490", "single", [50, 94], 71, -2),
  orchestra("alto-sax", "Alto Sax", "A.Sax", "#0369a1", "single", [49, 92], 65, -9),
  orchestra("trumpet-bb", "Bb Trumpet", "Tpt.", "#d97706", "single", [54, 86], 56, -2),
  orchestra("trombone", "Trombone", "Tbn.", "#b45309", "single", [40, 77], 57),
  orchestra("choir", "Choir", "Cho.", "#be123c", "grand", [36, 84], 52),
  drums("drums", "Drum Kit", "Dr.", "#dc2626", 0),
  drums("percussion", "Percussion", "Perc.", "#b91c1c", 8),
  midi("synth-lead", "Synth Lead", "Lead", "#16a34a", [48, 96], 80),
  midi("pad", "Synth Pad", "Pad", "#15803d", [36, 96], 88)
];

export const TUNING_PRESETS: TuningPreset[] = [
  tuning("guitar-standard", ["guitar"], "Standard", [40, 45, 50, 55, 59, 64], "E A D G B E"),
  tuning("guitar-drop-d", ["guitar", "guitar-drop-d"], "Drop D", [38, 45, 50, 55, 59, 64], "D A D G B E"),
  tuning("guitar-dadgad", ["guitar"], "DADGAD", [38, 45, 50, 55, 57, 62], "D A D G A D"),
  tuning("guitar-open-g", ["guitar"], "Open G", [38, 43, 50, 55, 59, 62], "D G D G B D"),
  tuning("guitar-7-standard", ["guitar-7"], "7-string Standard", [31, 40, 45, 50, 55, 59, 64], "B E A D G B E"),
  tuning("bass-standard", ["bass"], "Bass Standard", [28, 33, 38, 43], "E A D G"),
  tuning("bass-drop-d", ["bass"], "Bass Drop D", [26, 33, 38, 43], "D A D G"),
  tuning("bass-5-standard", ["bass-5"], "5-string Bass", [23, 28, 33, 38, 43], "B E A D G"),
  tuning("ukulele-standard", ["ukulele"], "Ukulele Standard", [67, 60, 64, 69], "G C E A"),
  tuning("mandolin-standard", ["mandolin", "violin"], "Fifths", [55, 62, 69, 76], "G D A E"),
  tuning("viola-standard", ["viola"], "Viola Standard", [48, 55, 62, 69], "C G D A"),
  tuning("cello-standard", ["cello"], "Cello Standard", [36, 43, 50, 57], "C G D A"),
  tuning("contrabass-standard", ["contrabass"], "Contrabass Standard", [28, 33, 38, 43], "E A D G")
];

export const DRUM_MAPPINGS: DrumMapping[] = [
  drum("kick", "Kick", 36, -6, ["normal", "accent", "ghost"], 1),
  drum("snare", "Snare", 38, 0, ["normal", "rimshot", "ghost"], 2),
  drum("sidestick", "Side Stick", 37, 0, ["normal", "accent", "ghost"], 3),
  drum("closed-hat", "Closed Hi-Hat", 42, 5, ["closed", "accent", "foot"], 4),
  drum("pedal-hat", "Pedal Hi-Hat", 44, 4, ["pedal", "splash", "chick"], 5),
  drum("open-hat", "Open Hi-Hat", 46, 6, ["open", "semi", "choke"], 6),
  drum("low-tom", "Low Tom", 45, -3, ["normal", "accent", "rim"], 7),
  drum("mid-tom", "Mid Tom", 47, -1, ["normal", "accent", "rim"], 8),
  drum("high-tom", "High Tom", 50, 2, ["normal", "accent", "rim"], 9),
  drum("crash", "Crash", 49, 7, ["normal", "choke", "bell"], 10),
  drum("ride", "Ride", 51, 8, ["normal", "bell", "edge"], 11),
  drum("china", "China", 52, 9, ["normal", "choke", "bell"], 12)
];

export function instrumentById(id: string): InstrumentDefinition {
  return INSTRUMENT_DEFINITIONS.find((instrument) => instrument.id === id) ?? INSTRUMENT_DEFINITIONS[0];
}

export function presetsByCategory(category: InstrumentCategory): InstrumentDefinition[] {
  return INSTRUMENT_DEFINITIONS.filter((instrument) => instrument.category === category);
}

export function tuningMatchesPreset(strings: number[]): TuningPreset | null {
  return TUNING_PRESETS.find(
    (preset) => preset.strings.length === strings.length && preset.strings.every((midi, index) => midi === strings[index])
  ) ?? null;
}

export function tuningPresetsForTrack(track: Track, stringCount: number): TuningPreset[] {
  if (track.kind !== "stringed") return [];
  const namedInstrument = INSTRUMENT_DEFINITIONS.find((instrument) =>
    instrument.name.toLowerCase() === track.name.trim().toLowerCase());
  const soundCandidates = INSTRUMENT_DEFINITIONS.filter((instrument) =>
    instrument.stringed && track.sounds.some((sound) => sound.id === `gm-${instrument.gmProgram}`));
  const matchingSound = soundCandidates.find((instrument) => instrument.tuning.length === track.tuning.strings.length)
    ?? soundCandidates[0];
  const generic = track.icon === "bass" ? (track.tuning.strings.length === 5 ? "bass-5" : "bass")
    : track.clef === "treble8vb" ? (track.tuning.strings.length === 7 ? "guitar-7" : "guitar") : "";
  const instrument = namedInstrument?.id ?? matchingSound?.id ?? generic;
  return TUNING_PRESETS.filter((preset) => preset.instrumentIds.includes(instrument) && preset.strings.length === stringCount);
}

export function tuningLabel(strings: number[]): string {
  return strings.map((midi) => midiName(midi).replace(/\d+$/, "")).join(" ");
}

export function midiName(midi: number): string {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const octave = Math.floor(midi / 12) - 1;
  return `${names[((midi % 12) + 12) % 12]}${octave}`;
}

export function retuneTrack(track: Track, nextTuning: Tuning, mode: RetuneMode): number {
  const original = track.tuning;
  const reducing = nextTuning.strings.length < original.strings.length;
  if (track.kind !== "stringed" || sameFrettedPitches(original, nextTuning)) {
    if (!sameTuningSettings(original, nextTuning)) track.tuning = nextTuning;
    return 0;
  }
  if (mode === "keep-fingering") {
    if (reducing) throw new Error("줄 수를 줄일 때는 음을 옮기거나 삭제해야 합니다.");
    track.tuning = nextTuning;
    return 0;
  }

  const previousFrets = [0, 0, 0, 0];
  let removed = 0;
  const bars = track.bars.map((bar) => {
    const voices: typeof bar.voices = [...bar.voices];
    bar.voices.forEach((voice, voiceIndex) => {
      voices[voiceIndex] = {
        ...voice,
        beats: voice.beats.map((beat) => {
          const place = <T extends { string: number; fret: number }>(notes: T[]): T[] => {
            if (mode === "remove-missing-strings") return notes.filter((note) => note.string <= nextTuning.strings.length);
            return placeRetunedNotes(notes, original, nextTuning, previousFrets[voiceIndex]);
          };
          const notes = place(beat.notes);
          const graceNotes = beat.graceNotes.flatMap((note) => place([note]));
          removed += beat.notes.length - notes.length + beat.graceNotes.length - graceNotes.length;
          if (notes.length) previousFrets[voiceIndex] = handPosition(notes);
          return { ...beat, notes, graceNotes, rest: beat.rest || !notes.length };
        })
      };
    });
    return { ...bar, voices };
  });

  // A same-size tuning can make notes unplayable as well. Keep the score
  // byte-for-byte until the user selects a viable tuning or Keep Fingering.
  if (removed > 0 && !reducing && mode === "adjust-fingering") return removed;
  track.bars = bars;
  track.tuning = nextTuning;
  return removed;
}

function placeRetunedNotes<T extends { string: number; fret: number }>(notes: T[], before: Tuning, after: Tuning, previousFret: number): T[] {
  const positions = assignFingerings(after, notes.map((note) => ({
    midi: frettedMidiPitch(before, note.string, note.fret)
  })), previousFret);
  return notes.flatMap((note, index) => {
    const position = positions[index];
    return position ? [{ ...note, string: position.string, fret: position.fret }] : [];
  });
}

function sameTuningSettings(left: Tuning, right: Tuning): boolean {
  return left.label === right.label && left.accidentalPreference === right.accidentalPreference &&
    left.capo === right.capo && left.partialCapo?.fret === right.partialCapo?.fret &&
    left.partialCapo?.strings.join(",") === right.partialCapo?.strings.join(",") &&
    left.strings.length === right.strings.length && left.strings.every((note, index) => note === right.strings[index]);
}

function sameFrettedPitches(left: Tuning, right: Tuning): boolean {
  return left.strings.length === right.strings.length && left.strings.every((_, index) =>
    frettedMidiPitch(left, index + 1, 0) === frettedMidiPitch(right, index + 1, 0));
}

function stringed(
  id: string,
  name: string,
  shortName: string,
  color: string,
  strings: number[],
  tuningLabelValue: string,
  gmProgram: number
): InstrumentDefinition {
  return {
    id,
    category: "Stringed",
    name,
    shortName,
    color,
    icon: id.includes("bass") ? "bass" : "guitar",
    notationTypes: ["standard", "tab"],
    staffConfig: "single",
    tuning: strings,
    tuningLabel: tuningLabelValue,
    stringed: true,
    clef: id.startsWith("bass") ? "bass8vb" : id.startsWith("guitar") ? "treble8vb" :
      id === "cello" || id === "contrabass" ? "bass" : "treble",
    range: [Math.min(...strings), Math.max(...strings) + 24],
    gmProgram,
    soundingOffset: 0
  };
}

function keyed(
  id: string,
  name: string,
  shortName: string,
  color: string,
  staffConfig: StaffConfig,
  range: [number, number],
  gmProgram: number
): InstrumentDefinition {
  return {
    id,
    category: "Orchestra",
    name,
    shortName,
    color,
    icon: "piano",
    notationTypes: ["standard"],
    staffConfig,
    tuning: [48, 52, 55, 60, 64],
    tuningLabel: "Keyboard",
    stringed: false,
    clef: "grand",
    range,
    gmProgram,
    soundingOffset: 0
  };
}

function orchestra(
  id: string,
  name: string,
  shortName: string,
  color: string,
  staffConfig: StaffConfig,
  range: [number, number],
  gmProgram: number,
  soundingOffset = 0
): InstrumentDefinition {
  return {
    id,
    category: "Orchestra",
    name,
    shortName,
    color,
    icon: "orchestra",
    notationTypes: ["standard"],
    staffConfig,
    tuning: [range[0], range[0] + 7, range[0] + 14],
    tuningLabel: "Concert",
    stringed: false,
    clef: range[0] < 48 ? "bass" : "treble",
    range,
    gmProgram,
    soundingOffset
  };
}

function drums(id: string, name: string, shortName: string, color: string, gmProgram: number): InstrumentDefinition {
  return {
    id,
    category: "Drums",
    name,
    shortName,
    color,
    icon: "drums",
    notationTypes: ["standard"],
    staffConfig: "single",
    tuning: [36, 38, 42],
    tuningLabel: "GM Kit",
    stringed: false,
    clef: "percussion",
    range: [27, 87],
    gmProgram,
    soundingOffset: 0
  };
}

function midi(id: string, name: string, shortName: string, color: string, range: [number, number], gmProgram: number): InstrumentDefinition {
  return {
    id,
    category: "MIDI",
    name,
    shortName,
    color,
    icon: "midi",
    notationTypes: ["standard"],
    staffConfig: "single",
    tuning: [range[0], range[0] + 7, range[0] + 14],
    tuningLabel: "MIDI",
    stringed: false,
    clef: "treble",
    range,
    gmProgram,
    soundingOffset: 0
  };
}

function tuning(id: string, instrumentIds: string[], name: string, strings: number[], label: string): TuningPreset {
  return { id, instrumentIds, name, strings, label };
}

function drum(id: string, name: string, midiNumber: number, staffLine: number, articulations: string[], shortcut: number): DrumMapping {
  return { id, name, midiNumber, staffLine, articulations, shortcut };
}
