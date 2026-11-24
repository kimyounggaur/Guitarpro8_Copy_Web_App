import { beatDurationTicks } from "../model/derive";
import { createBar, createBeat, createEmptyScore, createMasterBar, createNote, createTrack } from "../model/factory";
import type { Beat, Note, Score, Track } from "../model/types";

const DEFAULT_GUITAR_PITCHES = [40, 45, 50, 55, 59, 64];
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function exportAsciiTab(score: Score, trackId?: string, options: { columns?: number } = {}): string {
  const track = score.tracks.find((candidate) => candidate.id === trackId) ?? score.tracks[0];
  if (!track) return "# TabScore ASCII Tab\n";
  if (track.kind !== "stringed") throw new Error("ASCII TAB requires a stringed instrument.");

  const lines = ["# TabScore ASCII Tab", `Title: ${score.meta.title || "Untitled Score"}`, `Track: ${track.name}`, ""];
  const stringCount = track.tuning.strings.length;
  const prefixes = Array.from({ length: stringCount }, (_, index) => `${stringLabel(track, index + 1)}|`);
  const bars = track.bars.map((bar) => bar.voices[0].beats.length ? bar.voices[0].beats : [createBeat({ duration: 1 })]);
  const shortest = bars.flat().reduce((best, beat) => Math.min(best, beatDurationTicks(beat)), Infinity);
  const columns = Math.max(16, Math.floor(options.columns ?? 80));
  let system = [...prefixes];

  for (const beats of bars) {
    const bar = Array.from({ length: stringCount }, () => "");
    for (const beat of beats) {
      const tokens = bar.map((_, index) => {
        const note = beat.rest ? undefined : beat.notes.find(({ string }) => string === index + 1);
        return note ? noteToken(note) : "";
      });
      const span = Math.max(1, Math.round(beatDurationTicks(beat) / shortest), ...tokens.map((token) => token.length + 1));
      tokens.forEach((token, index) => { bar[index] += token.padEnd(span, "-"); });
    }
    if (system[0].length > prefixes[0].length && system[0].length + bar[0].length + 1 > columns) {
      lines.push(...system, "");
      system = [...prefixes];
    }
    bar.forEach((line, index) => { system[index] += `${line}|`; });
  }
  lines.push(...system, "");
  return lines.join("\n");
}

export function importAsciiTab(text: string): Score {
  const groups = text.split(/\r?\n\s*\r?\n/)
    .map((block) => block.split(/\r?\n/).filter((line) => line.includes("|") && /[-\dx]/i.test(line.slice(line.indexOf("|") + 1))))
    .filter((lines) => lines.length > 0);
  if (groups.length === 0) {
    throw new Error("No tablature lines were found in the ASCII file.");
  }

  const stringCount = groups[0].length;
  for (const [index, group] of groups.entries()) {
    if (group.length < 3 || group.length > 10) {
      throw new Error(`ASCII TAB ${index + 1}번째 묶음은 3~10개의 줄이어야 합니다.`);
    }
    if (group.length !== stringCount) {
      throw new Error(`ASCII TAB ${index + 1}번째 묶음의 줄 수가 다릅니다.`);
    }
  }

  const score = createEmptyScore();
  const title = /^Title:\s*(.+)$/im.exec(text)?.[1]?.trim();
  const trackName = /^Track:\s*(.+)$/im.exec(text)?.[1]?.trim();
  score.meta.title = title ?? "Imported ASCII Tab";
  const track = createTrack(undefined, 0);
  track.name = trackName ?? "ASCII Tab";
  track.shortName = "ASCII";
  track.tuning.strings = [
    ...Array.from({ length: Math.max(0, stringCount - 6) }, (_, index) => 40 - 5 * (stringCount - 6 - index)),
    ...DEFAULT_GUITAR_PITCHES.slice(-stringCount)
  ];
  track.tuning.label = track.tuning.strings.map((pitch) => pitchClassName(pitch)).join(" ");
  score.tracks = [track];

  const bars = groups.flatMap((lines) => {
    const segments = lines.map((line) => {
      const contents = line.slice(line.indexOf("|") + 1).trim();
      const bars = contents.split("|");
      if (bars.at(-1) === "") bars.pop();
      return bars;
    });
    return Array.from({ length: Math.max(...segments.map((line) => line.length)) }, (_, index) =>
      segments.map((line) => line[index] ?? "")
    );
  });
  score.masterBars = bars.map(() => createMasterBar());
  track.bars = bars.map(() => createBar());

  for (const [barIndex, barSegments] of bars.entries()) {
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
        applyAsciiEffect(note, next[2] === "x" ? "x" : next[1]);
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
  if (note.tiedFromPrevious) return "L";
  if (note.staccato) return ".";
  if (note.deadNote) return "";
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
  const name = pitchClassName(pitch);
  return stringNumber === 1 ? name.toLowerCase() : name;
}

function pitchClassName(pitch: number): string {
  return NOTE_NAMES[((pitch % 12) + 12) % 12];
}
