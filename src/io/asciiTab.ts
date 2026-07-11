import { createBar, createBeat, createEmptyScore, createMasterBar, createNote, createTrack } from "../model/factory";
import type { Beat, Note, Score, Track } from "../model/types";

const CELL_WIDTH = 4;
const DEFAULT_GUITAR_PITCHES = [40, 45, 50, 55, 59, 64];
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function exportAsciiTab(score: Score, trackId?: string): string {
  const track = score.tracks.find((candidate) => candidate.id === trackId) ?? score.tracks[0];

  if (!track) {
    return "# GuitarPro8 Copy ASCII Tab\n";
  }

  const lines = [
    "# GuitarPro8 Copy ASCII Tab",
    `Title: ${score.meta.title || "Untitled Score"}`,
    `Track: ${track.name}`,
    ""
  ];
  const stringCount = track.tuning.strings.length;
  const buffers = Array.from({ length: stringCount }, (_, index) => `${stringLabel(track, index + 1)}|`);

  track.bars.forEach((bar) => {
    const beats = bar.voices[0].beats.length > 0 ? bar.voices[0].beats : [createBeat({ duration: 1 })];

    beats.forEach((beat) => {
      for (let stringNumber = 1; stringNumber <= stringCount; stringNumber += 1) {
        const note = beat.notes.find((candidate) => candidate.string === stringNumber);
        buffers[stringNumber - 1] += note ? noteToken(note).padEnd(CELL_WIDTH, "-").slice(0, CELL_WIDTH) : "-".repeat(CELL_WIDTH);
      }
    });

    for (let index = 0; index < stringCount; index += 1) {
      buffers[index] += "|";
    }
  });

  lines.push(...buffers, "");
  return lines.join("\n");
}

export function importAsciiTab(text: string): Score {
  const tabLines = text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.includes("|") && /[-\d]/.test(line));

  if (tabLines.length === 0) {
    throw new Error("No tablature lines were found in the ASCII file.");
  }

  const score = createEmptyScore();
  const title = /^Title:\s*(.+)$/im.exec(text)?.[1]?.trim();
  const trackName = /^Track:\s*(.+)$/im.exec(text)?.[1]?.trim();
  score.meta.title = title ?? "Imported ASCII Tab";
  const track = createTrack(undefined, 0);
  track.name = trackName ?? "ASCII Tab";
  track.shortName = "ASCII";
  track.tuning.strings = DEFAULT_GUITAR_PITCHES.slice(-tabLines.length);
  track.tuning.label = track.tuning.strings.map((pitch) => pitchClassName(pitch)).join(" ");
  score.tracks = [track];

  const contents = tabLines.map((line) => line.slice(line.indexOf("|")));
  const barCount = Math.max(...contents.map((line) => Math.max(0, line.split("|").length - 2)));
  score.masterBars = Array.from({ length: Math.max(1, barCount) }, () => createMasterBar());
  track.bars = Array.from({ length: score.masterBars.length }, () => createBar());

  for (let barIndex = 0; barIndex < score.masterBars.length; barIndex += 1) {
    const barSegments = contents.map((line) => line.split("|")[barIndex + 1] ?? "");
    const events = parseBarEvents(barSegments);
    const voice = track.bars[barIndex].voices[0];

    if (events.length === 0) {
      voice.beats = [createBeat({ duration: 1, rest: true })];
      continue;
    }

    voice.beats = events.map((event) => {
      const beat = createBeat({ duration: 4, rest: false });
      beat.notes = event.notes;
      return beat;
    });
  }

  return score;
}

function parseBarEvents(segments: string[]): Array<{ position: number; notes: Note[] }> {
  const byPosition = new Map<number, Note[]>();

  segments.forEach((segment, lineIndex) => {
    const stringNumber = lineIndex + 1;
    let position = 0;

    while (position < segment.length) {
      const char = segment[position];
      const next = segment.slice(position).match(/^([A-Za-z.+~<>^=nVx]?)(\d{1,2}|x)/);

      if (next && next.index === 0 && next[0] !== "-" && /\d|x/.test(next[2])) {
        const fret = next[2] === "x" ? 0 : Number(next[2]);
        const note = createNote(stringNumber, fret);
        applyAsciiEffect(note, next[1]);
        const notes = byPosition.get(position) ?? [];
        notes.push(note);
        byPosition.set(position, notes);
        position += Math.max(1, next[0].length);
      } else {
        void char;
        position += 1;
      }
    }
  });

  return Array.from(byPosition.entries())
    .sort(([left], [right]) => left - right)
    .map(([position, notes]) => ({ position, notes }));
}

function noteToken(note: Note): string {
  return `${effectToken(note)}${note.deadNote ? "x" : note.fret}`;
}

function effectToken(note: Note): string {
  if (note.tieOrigin || note.tieDestination) return "L";
  if (note.staccato) return ".";
  if (note.deadNote) return "x";
  if (note.hopo) return "h";
  if (note.bend) return "b";
  if (note.slide) return "s";
  if (note.vibrato === "wide") return "W";
  if (note.vibrato !== "none") return "~";
  if (note.ghost) return "g";
  if (note.accent !== "none") return ">";
  if (note.trill) return "t";
  if (note.palmMute) return "M";
  if (note.pop) return "P";
  if (note.slap) return "S";
  if (note.tremoloPicking) return "=";
  return "";
}

function applyAsciiEffect(note: Note, token: string): void {
  switch (token) {
    case ".":
      note.staccato = true;
      break;
    case "x":
      note.deadNote = true;
      break;
    case "h":
      note.hopo = true;
      break;
    case "b":
      note.bend = { points: [{ offset: 0, value: 0 }, { offset: 60, value: 100 }] };
      break;
    case "s":
      note.slide = "shift";
      break;
    case "W":
      note.vibrato = "wide";
      break;
    case "~":
      note.vibrato = "slight";
      break;
    case "g":
      note.ghost = true;
      break;
    case ">":
      note.accent = "accent";
      break;
    case "t":
      note.trill = { secondFret: note.fret + 1, speed: 16 };
      break;
    case "M":
      note.palmMute = true;
      break;
    case "P":
      note.pop = true;
      break;
    case "S":
      note.slap = true;
      break;
    case "=":
      note.tremoloPicking = 16;
      break;
    default:
      break;
  }
}

function stringLabel(track: Track, stringNumber: number): string {
  const pitch = track.tuning.strings[track.tuning.strings.length - stringNumber] ?? 64;
  return pitchClassName(pitch).padStart(2, " ");
}

function pitchClassName(pitch: number): string {
  return NOTE_NAMES[((pitch % 12) + 12) % 12];
}
