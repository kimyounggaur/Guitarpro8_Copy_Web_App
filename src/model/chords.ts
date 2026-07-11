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
  | "add9";

export interface ParsedChord {
  symbol: string;
  root: number;
  rootName: string;
  quality: ChordQuality;
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

const QUALITY_ALIASES: Array<[ChordQuality, string[], number[]]> = [
  ["maj", ["", "maj", "M"], [0, 4, 7]],
  ["min", ["m", "min", "-"], [0, 3, 7]],
  ["dim", ["dim", "o"], [0, 3, 6]],
  ["aug", ["aug", "+"], [0, 4, 8]],
  ["sus2", ["sus2"], [0, 2, 7]],
  ["sus4", ["sus", "sus4"], [0, 5, 7]],
  ["5", ["5"], [0, 7]],
  ["6", ["6"], [0, 4, 7, 9]],
  ["m6", ["m6", "min6"], [0, 3, 7, 9]],
  ["7", ["7", "dom7"], [0, 4, 7, 10]],
  ["maj7", ["maj7", "M7", "Δ7"], [0, 4, 7, 11]],
  ["m7", ["m7", "min7", "-7"], [0, 3, 7, 10]],
  ["mMaj7", ["mMaj7", "mM7"], [0, 3, 7, 11]],
  ["m7b5", ["m7b5", "ø", "halfdim"], [0, 3, 6, 10]],
  ["dim7", ["dim7", "o7"], [0, 3, 6, 9]],
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
  const qualityEntry = qualityFromText(qualityText);
  const bassName = match[3] ? normalizeNoteName(match[3]) : null;
  const bass = bassName ? NOTE_NAME_TO_PC.get(bassName) ?? null : null;
  const pitchClasses = uniquePitchClasses(qualityEntry[2].map((interval) => root + interval));

  return {
    symbol: `${rootName}${canonicalQualitySuffix(qualityEntry[0])}${bassName ? `/${bassName}` : ""}`,
    root,
    rootName,
    quality: qualityEntry[0],
    bass,
    bassName,
    intervals: qualityEntry[2],
    pitchClasses,
    aliases: equivalentChordNames(rootName, qualityEntry[0], bassName)
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

  rootWindows.forEach((position) => {
    const candidates = stringCandidates(tuning, chord, position, Math.min(maxFret, position + window));
    buildVoicings(candidates, [], 0, tuning.strings.length, chord, voicings, limit * 6);
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
  return `${rootName}${canonicalQualitySuffix(chord.quality)}${bassName ? `/${bassName}` : ""}`;
}

function stringCandidates(
  tuning: Tuning,
  chord: ParsedChord,
  startFret: number,
  endFret: number
): Array<Array<ChordVoicingNote | null>> {
  return tuning.strings.map((openPitch, lowIndex) => {
    const stringNumber = tuning.strings.length - lowIndex;
    const notes: Array<ChordVoicingNote | null> = [null];

    for (let fret = 0; fret <= endFret; fret += 1) {
      if (fret > 0 && fret < startFret) {
        continue;
      }

      const pitchClass = mod(openPitch + tuning.capo + fret, 12);

      if (chord.pitchClasses.includes(pitchClass)) {
        notes.push({
          string: stringNumber,
          fret,
          pitchClass,
          role: roleForPitchClass(chord, pitchClass)
        });
      }
    }

    return notes;
  });
}

function buildVoicings(
  candidates: Array<Array<ChordVoicingNote | null>>,
  current: Array<ChordVoicingNote | null>,
  index: number,
  stringCount: number,
  chord: ParsedChord,
  voicings: ChordVoicing[],
  cap: number
): void {
  if (voicings.length >= cap) {
    return;
  }

  if (index >= candidates.length) {
    const notes = current.filter((note): note is ChordVoicingNote => note !== null);

    if (notes.length < Math.min(3, chord.pitchClasses.length)) {
      return;
    }

    const sounded = uniquePitchClasses(notes.map((note) => note.pitchClass));

    if (!sounded.includes(chord.root) || chord.pitchClasses.some((pc) => !sounded.includes(pc))) {
      return;
    }

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

  candidates[index].forEach((candidate) => buildVoicings(candidates, [...current, candidate], index + 1, stringCount, chord, voicings, cap));
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

function qualityFromText(text: string): [ChordQuality, string[], number[]] {
  const normalized = text.trim();
  return (
    [...QUALITY_ALIASES]
      .sort((left, right) => longestAlias(right[1]) - longestAlias(left[1]))
      .find(([, aliases]) => aliases.some((alias) => alias.toLowerCase() === normalized.toLowerCase())) ??
    QUALITY_ALIASES[0]
  );
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

function canonicalQualitySuffix(quality: ChordQuality): string {
  const suffixes: Record<ChordQuality, string> = {
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

function equivalentChordNames(rootName: string, quality: ChordQuality, bassName: string | null): string[] {
  const aliases = QUALITY_ALIASES.find(([candidate]) => candidate === quality)?.[1] ?? [""];
  return aliases.slice(0, 4).map((alias) => `${rootName}${alias}${bassName ? `/${bassName}` : ""}`);
}

function normalizeChordText(value: string): string {
  return value.replace("♯", "#").replace("♭", "b").replace("Δ", "maj");
}

function normalizeNoteName(value: string): string {
  const first = value[0].toUpperCase();
  const suffix = value.slice(1);
  return `${first}${suffix}`;
}

function uniquePitchClasses(values: number[]): number[] {
  return [...new Set(values.map((value) => mod(value, 12)))].sort((left, right) => left - right);
}

function longestAlias(aliases: string[]): number {
  return Math.max(...aliases.map((alias) => alias.length));
}

function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
