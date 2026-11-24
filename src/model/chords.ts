import { frettedMidiPitch } from "./trackKind";
import type { Tuning } from "./types";

export type ChordQuality =
  | "maj"
  | "min"
  | "dim"
  | "aug"
  | "sus2"
  | "sus4"
  | "5"
  | "6"
  | "m6"
  | "7"
  | "maj7"
  | "m7"
  | "mMaj7"
  | "m7b5"
  | "dim7"
  | "add9"
  | "extended";

export interface ParsedChord {
  symbol: string;
  root: number;
  rootName: string;
  quality: ChordQuality;
  suffix: string;
  bass: number | null;
  bassName: string | null;
  intervals: number[];
  pitchClasses: number[];
  aliases: string[];
}

export interface ChordVoicingNote {
  string: number;
  fret: number;
  pitchClass: number;
  role: "root" | "third" | "fifth" | "color";
}

export interface ChordVoicing {
  id: string;
  notes: ChordVoicingNote[];
  mutedStrings: number[];
  difficulty: number;
  span: number;
  position: number;
  barreFret: number | null;
  label: string;
}

export const NOTE_NAMES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
const NOTE_NAME_TO_PC = new Map<string, number>(
  [
    ["C", 0],
    ["B#", 0],
    ["C#", 1],
    ["Db", 1],
    ["D", 2],
    ["D#", 3],
    ["Eb", 3],
    ["E", 4],
    ["Fb", 4],
    ["E#", 5],
    ["F", 5],
    ["F#", 6],
    ["Gb", 6],
    ["G", 7],
    ["G#", 8],
    ["Ab", 8],
    ["A", 9],
    ["A#", 10],
    ["Bb", 10],
    ["B", 11],
    ["Cb", 11]
  ]
);

const QUALITY_ALIASES: Array<[Exclude<ChordQuality, "extended">, string[], number[]]> = [
  ["maj", ["", "maj", "M"], [0, 4, 7]],
  ["min", ["m", "min", "-"], [0, 3, 7]],
  ["dim", ["dim", "o", "°"], [0, 3, 6]],
  ["aug", ["aug", "+"], [0, 4, 8]],
  ["sus2", ["sus2"], [0, 2, 7]],
  ["sus4", ["sus", "sus4"], [0, 5, 7]],
  ["5", ["5"], [0, 7]],
  ["6", ["6"], [0, 4, 7, 9]],
  ["m6", ["m6", "min6"], [0, 3, 7, 9]],
  ["7", ["7", "dom7"], [0, 4, 7, 10]],
  ["maj7", ["maj7", "M7", "Δ7"], [0, 4, 7, 11]],
  ["m7", ["m7", "min7", "-7"], [0, 3, 7, 10]],
  ["mMaj7", ["mMaj7", "mM7", "mmaj7", "mΔ7"], [0, 3, 7, 11]],
  ["m7b5", ["m7b5", "ø", "ø7", "halfdim"], [0, 3, 6, 10]],
  ["dim7", ["dim7", "o7", "°7"], [0, 3, 6, 9]],
  ["add9", ["add9"], [0, 4, 7, 14]]
];

export function parseChordSymbol(symbol: string): ParsedChord | null {
  const trimmed = symbol.trim().replace(/^'/, "");
  const match = /^([A-G](?:#|b)?)([^/]*)?(?:\/([A-G](?:#|b)?))?$/i.exec(normalizeChordText(trimmed));

  if (!match) {
    return null;
  }

  const rootName = normalizeNoteName(match[1]);
  const root = NOTE_NAME_TO_PC.get(rootName);

  if (root === undefined) {
    return null;
  }

  const qualityText = match[2] ?? "";
  const parsedQuality = parseChordQuality(qualityText);
  if (!parsedQuality) return null;
  const { quality, suffix, intervals, aliases } = parsedQuality;
  const bassName = match[3] ? normalizeNoteName(match[3]) : null;
  const bass = bassName ? NOTE_NAME_TO_PC.get(bassName) ?? null : null;
  const pitchClasses = uniquePitchClasses(intervals.map((interval) => root + interval));
  const bassSuffix = bassName ? `/${bassName}` : "";
  return {
    symbol: `${rootName}${suffix}${bassSuffix}`,
    root,
    rootName,
    quality,
    suffix,
    bass,
    bassName,
    intervals,
    pitchClasses,
    aliases: aliases.map((alias) => `${rootName}${alias}${bassSuffix}`)
  };
}

export function chordPitchClasses(chord: ParsedChord): number[] {
  return chord.pitchClasses;
}

export function enumerateChordVoicings(
  tuning: Tuning,
  chord: ParsedChord,
  options: { startFret?: number; maxFret?: number; window?: number; limit?: number } = {}
): ChordVoicing[] {
  const startFret = options.startFret ?? 0;
  const maxFret = options.maxFret ?? 12;
  const window = options.window ?? 4;
  const limit = options.limit ?? 24;
  const rootWindows = Array.from({ length: Math.max(1, maxFret - startFret - window + 2) }, (_, index) => startFret + index);
  const voicings: ChordVoicing[] = [];

  const withBass = chord.bass === null ? chord.pitchClasses : uniquePitchClasses([...chord.pitchClasses, chord.bass]);
  const required = withBass.length <= tuning.strings.length ? withBass : essentialChordTones(chord);
  rootWindows.forEach((position) => {
    const candidates = stringCandidates(tuning, chord, position, Math.min(maxFret, position + window));
    buildVoicings(candidates, [], 0, required, chord.bass, voicings, limit * 6);
  });

  return dedupeVoicings(voicings)
    .sort((left, right) => left.difficulty - right.difficulty || left.position - right.position)
    .slice(0, limit);
}

export function identifyChordName(pitchClasses: number[]): string | null {
  const normalized = uniquePitchClasses(pitchClasses);

  for (const root of normalized) {
    for (const [quality, , intervals] of QUALITY_ALIASES) {
      const expected = uniquePitchClasses(intervals.map((interval) => root + interval));

      if (expected.length === normalized.length && expected.every((pc) => normalized.includes(pc))) {
        return `${NOTE_NAMES_SHARP[root]}${canonicalQualitySuffix(quality)}`;
      }
    }
  }

  return null;
}

export function transposeChordSymbol(symbol: string, semitones: number): string {
  const chord = parseChordSymbol(symbol);

  if (!chord) {
    return symbol;
  }

  const rootName = NOTE_NAMES_SHARP[mod(chord.root + semitones, 12)];
  const bassName = chord.bass === null ? null : NOTE_NAMES_SHARP[mod(chord.bass + semitones, 12)];
  return `${rootName}${chord.suffix}${bassName ? `/${bassName}` : ""}`;
}

interface VoicingCandidate extends ChordVoicingNote {
  midiPitch: number;
}

function stringCandidates(
  tuning: Tuning,
  chord: ParsedChord,
  startFret: number,
  endFret: number
): Array<Array<VoicingCandidate | null>> {
  return tuning.strings.map((_, lowIndex) => {
    const stringNumber = tuning.strings.length - lowIndex;
    const notes: Array<VoicingCandidate | null> = [null];

    for (let fret = 0; fret <= endFret; fret += 1) {
      if (fret > 0 && fret < startFret) {
        continue;
      }

      const midiPitch = frettedMidiPitch(tuning, stringNumber, fret);
      if (midiPitch === null) continue;
      const pitchClass = mod(midiPitch, 12);

      if (chord.pitchClasses.includes(pitchClass) || pitchClass === chord.bass) {
        notes.push({
          string: stringNumber,
          fret,
          midiPitch,
          pitchClass,
          role: roleForPitchClass(chord, pitchClass)
        });
      }
    }

    return notes;
  });
}

function buildVoicings(
  candidates: Array<Array<VoicingCandidate | null>>,
  current: Array<VoicingCandidate | null>,
  index: number,
  required: number[],
  bass: number | null,
  voicings: ChordVoicing[],
  cap: number
): void {
  if (voicings.length >= cap) {
    return;
  }

  if (index >= candidates.length) {
    const notes = current.filter((note): note is VoicingCandidate => note !== null);

    if (notes.length < Math.min(3, required.length)) {
      return;
    }

    const sounded = uniquePitchClasses(notes.map((note) => note.pitchClass));

    if (required.some((pc) => !sounded.includes(pc))) return;
    if (bass !== null && notes.reduce((lowest, note) => note.midiPitch < lowest.midiPitch ? note : lowest).pitchClass !== bass) return;

    const stringCount = candidates.length;
    const mutedStrings = Array.from({ length: stringCount }, (_, lowIndex) => stringCount - lowIndex).filter(
      (string) => !notes.some((note) => note.string === string)
    );
    const fretted = notes.filter((note) => note.fret > 0).map((note) => note.fret);
    const minFret = fretted.length ? Math.min(...fretted) : 0;
    const maxFret = fretted.length ? Math.max(...fretted) : 0;
    const span = fretted.length ? maxFret - minFret : 0;
    const barreFret = suggestedBarre(notes);
    const difficulty = span * 8 + mutedStrings.length * 4 + Math.max(0, maxFret - 5) + (barreFret ? 3 : 0);
    const fretsLabel = Array.from({ length: stringCount }, (_, lowIndex) => {
      const string = stringCount - lowIndex;
      const note = notes.find((candidate) => candidate.string === string);
      return note ? String(note.fret) : "x";
    }).join("-");

    voicings.push({
      id: fretsLabel,
      notes,
      mutedStrings,
      difficulty,
      span,
      position: minFret,
      barreFret,
      label: fretsLabel
    });
    return;
  }

  candidates[index].forEach((candidate) => buildVoicings(candidates, [...current, candidate], index + 1, required, bass, voicings, cap));
}

function essentialChordTones(chord: ParsedChord): number[] {
  // Compact extended guitar voicings retain the third (or suspension),
  // seventh, and highest color even when the full collection exceeds six strings.
  const intervals = chord.intervals;
  const third = intervals.find((interval) => interval > 0 && interval <= 5) ?? 0;
  const seventh = intervals.find((interval) => interval === 10 || interval === 11) ?? 0;
  return uniquePitchClasses([
    chord.root,
    chord.root + third,
    chord.root + seventh,
    chord.root + intervals[intervals.length - 1],
    ...(chord.bass === null ? [] : [chord.bass])
  ]);
}

function dedupeVoicings(voicings: ChordVoicing[]): ChordVoicing[] {
  const byId = new Map<string, ChordVoicing>();
  voicings.forEach((voicing) => {
    const previous = byId.get(voicing.id);

    if (!previous || voicing.difficulty < previous.difficulty) {
      byId.set(voicing.id, voicing);
    }
  });
  return [...byId.values()];
}

function parseChordQuality(text: string): {
  quality: ChordQuality;
  suffix: string;
  intervals: number[];
  aliases: string[];
} | null {
  // Quality is case-sensitive: m selects a minor third, M a major chord.
  const fixed = QUALITY_ALIASES.find(([, aliases]) => aliases.includes(text));
  if (fixed) {
    const [quality, aliases, intervals] = fixed;
    return { quality, suffix: canonicalQualitySuffix(quality), intervals: [...intervals], aliases: aliases.slice(0, 4) };
  }

  const match = /^(mMaj|mmaj|mM|mΔ|min|maj|dim|aug|sus[24]?|halfdim|dom|m|M|Δ|°|o|ø|\+|-)?(69|13|11|9|7|6)?(sus[24]?)?((?:[b#](?:13|11|9|5))*)(add(?:13|11|9))?$/.exec(text);
  if (!match) return null;

  const [, prefix = "", extension = "", trailingSus = "", changes = "", addition = ""] = match;
  const startsSuspended = prefix.startsWith("sus");
  if (trailingSus && prefix && prefix !== "dom") return null;
  if (prefix === "dom" && !extension) return null;

  const suspended = startsSuspended ? prefix : trailingSus;
  const minorMajor = ["mMaj", "mmaj", "mM", "mΔ"].includes(prefix);
  const minor = minorMajor || ["m", "min", "-"].includes(prefix);
  const diminished = ["dim", "°", "o"].includes(prefix);
  const halfDiminished = ["ø", "halfdim"].includes(prefix);
  const augmented = prefix === "aug" || prefix === "+";
  const majorSeventh = minorMajor || ["M", "maj", "Δ"].includes(prefix);
  let triadMiddle = minor || diminished || halfDiminished ? 3 : 4;
  if (suspended) triadMiddle = suspended === "sus2" ? 2 : 5;
  const fifth = diminished || halfDiminished ? 6 : augmented ? 8 : 7;
  const degrees = new Map<number, number[]>([[1, [0]], [3, [triadMiddle]], [5, [fifth]]]);
  const extensionDegree = Number(extension);
  if (extension === "6" || extension === "69") degrees.set(6, [9]);
  if ((extensionDegree >= 7 && extension !== "69") || halfDiminished) {
    degrees.set(7, [diminished ? 9 : majorSeventh ? 11 : 10]);
  }
  if (extensionDegree >= 9) degrees.set(9, [14]);
  if (extensionDegree >= 11 && extension !== "69") degrees.set(11, [17]);
  if (extension === "13") degrees.set(13, [21]);

  const natural = new Map([[5, 7], [9, 14], [11, 17], [13, 21]]);
  const altered = new Map<number, number[]>();
  for (const [, accidental, degreeText] of changes.matchAll(/([b#])(13|11|9|5)/g)) {
    const degree = Number(degreeText);
    const interval = natural.get(degree)! + (accidental === "#" ? 1 : -1);
    const intervals = altered.get(degree) ?? [];
    if (!intervals.includes(interval)) intervals.push(interval);
    altered.set(degree, intervals);
  }
  altered.forEach((intervals, degree) => degrees.set(degree, intervals));
  if (addition) {
    const degree = Number(addition.slice(3));
    const interval = natural.get(degree)!;
    degrees.set(degree, [...new Set([...(degrees.get(degree) ?? []), interval])]);
  }

  const qualityPrefix = minorMajor ? "mMaj" : minor ? "m" : diminished ? "dim" : halfDiminished ? "ø"
    : augmented ? "aug" : majorSeventh ? "maj" : startsSuspended ? normalizeSuspension(prefix) : "";
  const suffix = `${qualityPrefix}${extension}${normalizeSuspension(trailingSus)}${changes}${addition}`;
  const intervals = [...degrees.values()].flat().sort((a, b) => a - b);
  return { quality: "extended", suffix, intervals, aliases: [suffix] };
}

function normalizeSuspension(text: string): string {
  return text === "sus" ? "sus4" : text;
}

function roleForPitchClass(chord: ParsedChord, pitchClass: number): ChordVoicingNote["role"] {
  const interval = mod(pitchClass - chord.root, 12);

  if (interval === 0) return "root";
  if (interval === 3 || interval === 4) return "third";
  if (interval === 6 || interval === 7 || interval === 8) return "fifth";
  return "color";
}

function suggestedBarre(notes: ChordVoicingNote[]): number | null {
  const fretted = notes.filter((note) => note.fret > 0);
  const counts = new Map<number, number>();
  fretted.forEach((note) => counts.set(note.fret, (counts.get(note.fret) ?? 0) + 1));
  const barre = [...counts.entries()].find(([, count]) => count >= 2);
  return barre?.[0] ?? null;
}

function canonicalQualitySuffix(quality: Exclude<ChordQuality, "extended">): string {
  const suffixes: Record<Exclude<ChordQuality, "extended">, string> = {
    maj: "",
    min: "m",
    dim: "dim",
    aug: "aug",
    sus2: "sus2",
    sus4: "sus4",
    "5": "5",
    "6": "6",
    m6: "m6",
    "7": "7",
    maj7: "maj7",
    m7: "m7",
    mMaj7: "mMaj7",
    m7b5: "m7b5",
    dim7: "dim7",
    add9: "add9"
  };
  return suffixes[quality];
}

function normalizeChordText(value: string): string {
  return value.replace(/♯/g, "#").replace(/♭/g, "b").replace(/\s+/g, "");
}

function normalizeNoteName(value: string): string {
  const first = value[0].toUpperCase();
  const suffix = value.slice(1);
  return `${first}${suffix}`;
}

function uniquePitchClasses(values: number[]): number[] {
  return [...new Set(values.map((value) => mod(value, 12)))].sort((left, right) => left - right);
}

function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
