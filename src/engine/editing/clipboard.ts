import { createBar, createBeat, createNote } from "../../model/factory";
import type { Bar, Beat, Note, Score } from "../../model/types";
import { insertBarsAt, insertScoreBars } from "./operations";
import type { ClipboardPayload, CursorPosition, SelectionRange } from "./types";

export interface PasteOptions {
  repeatCount: number;
  insert: boolean;
  content: "all" | "notes" | "effects";
}

export const DEFAULT_PASTE: PasteOptions = { repeatCount: 1, insert: false, content: "all" };

export function copyScoreRange(
  score: Score, cursor: CursorPosition, selection: SelectionRange | null, mode: ClipboardPayload["mode"]
): ClipboardPayload | null {
  const range = clipboardRange(score, cursor, selection, mode);
  if (!range) return null;
  const masterBars = score.masterBars.slice(range.first.barIndex, range.last.barIndex + 1);
  const tracks = score.tracks.slice(range.firstTrack, range.lastTrack + 1).map((track) => ({
    kind: track.kind,
    bars: track.bars.slice(range.first.barIndex, range.last.barIndex + 1).map((bar, index) => {
      const barIndex = range.first.barIndex + index;
      const copy = structuredClone(bar);
      if (!range.wholeBars) {
        const [from, to] = beatBounds(barIndex, range);
        for (const voice of copy.voices) voice.beats = voice.beats.slice(from, to);
      }
      return copy;
    })
  }));
  return {
    mode,
    source: cursor.trackId ? {
      trackId: cursor.trackId, barIndex: cursor.barIndex, voiceIndex: cursor.voiceIndex,
      beatIndex: cursor.beatIndex, noteIndex: 0
    } : null,
    wholeBars: range.wholeBars,
    masterBars: structuredClone(masterBars),
    tracks
  };
}

export function cutScoreRange(
  score: Score, cursor: CursorPosition, selection: SelectionRange | null, mode: ClipboardPayload["mode"]
): void {
  const range = clipboardRange(score, cursor, selection, mode);
  if (!range) return;

  for (let trackIndex = range.firstTrack; trackIndex <= range.lastTrack; trackIndex += 1) {
    for (let index = range.first.barIndex; index <= range.last.barIndex; index += 1) {
      const track = score.tracks[trackIndex];
      if (range.wholeBars) {
        track.bars[index] = createBar();
      } else {
        const [from, to] = beatBounds(index, range);
        for (const voice of track.bars[index].voices) {
          voice.beats.splice(from, to - from);
        }
      }
    }
  }
}

export function canPasteScoreRange(score: Score, cursor: CursorPosition, payload: ClipboardPayload): boolean {
  const active = score.tracks.findIndex((track) => track.id === cursor.trackId);
  const first = payload.mode === "multitrack" ? 0 : active;
  return first >= 0 && payload.tracks.every((track, offset) => score.tracks[first + offset]?.kind === track.kind);
}

export function pasteScoreRange(
  score: Score, cursor: CursorPosition, payload: ClipboardPayload, options: PasteOptions
): boolean {
  if (!canPasteScoreRange(score, cursor, payload)) return false;
  const firstTrack = payload.mode === "multitrack" ? 0 : score.tracks.findIndex((track) => track.id === cursor.trackId);
  const count = payload.masterBars.length;
  const total = count * options.repeatCount;
  if (!Number.isSafeInteger(total) || total < 1) return false;

  if (options.insert && options.content !== "effects") {
    if (payload.wholeBars && payload.mode === "multitrack" && options.content === "all") {
      const copies = Array.from({ length: total }, (_, index) => structuredClone(payload.masterBars[index % count]));
      insertScoreBars(score, cursor.barIndex, copies);
    } else {
      insertBarsAt(score, cursor.barIndex, total);
    }
  } else {
    const extra = cursor.barIndex + total - score.masterBars.length;
    if (extra > 0 && options.content !== "effects") insertBarsAt(score, score.masterBars.length, extra);
  }

  for (let offset = 0; offset < total; offset += 1) {
    const occurrence = offset % count;
    const index = cursor.barIndex + offset;
    if (!score.masterBars[index]) break;
    if (payload.wholeBars && payload.mode === "multitrack" && options.content === "all") {
      score.masterBars[index] = structuredClone(payload.masterBars[occurrence]);
    }
    payload.tracks.forEach(({ bars }, trackOffset) => {
      const track = score.tracks[firstTrack + trackOffset];
      const source = bars[occurrence];
      const target = track.bars[index];
      const firstBeat = payload.wholeBars || occurrence > 0 || options.insert ? 0 : cursor.beatIndex;
      if (payload.wholeBars && options.content === "all") {
        track.bars[index] = structuredClone(source);
      } else {
        pasteBeats(target, source, firstBeat, options.content);
      }
    });
  }
  return true;
}

interface ClipboardRange {
  first: CursorPosition;
  last: CursorPosition;
  firstTrack: number;
  lastTrack: number;
  wholeBars: boolean;
}

function clipboardRange(
  score: Score, cursor: CursorPosition, selection: SelectionRange | null, mode: ClipboardPayload["mode"]
): ClipboardRange | null {
  const anchor = selection?.anchor ?? cursor;
  const head = selection?.head ?? cursor;
  const anchorTrack = score.tracks.findIndex((track) => track.id === anchor.trackId);
  const headTrack = score.tracks.findIndex((track) => track.id === head.trackId);
  if (anchorTrack < 0 || headTrack < 0) return null;
  const forward = anchor.barIndex < head.barIndex || anchor.barIndex === head.barIndex && anchor.beatIndex <= head.beatIndex;
  return {
    first: forward ? anchor : head,
    last: forward ? head : anchor,
    firstTrack: mode === "multitrack" ? 0 : Math.min(anchorTrack, headTrack),
    lastTrack: mode === "multitrack" ? score.tracks.length - 1 : Math.max(anchorTrack, headTrack),
    wholeBars: !selection || selection.unit !== "beat" || mode === "multitrack"
  };
}

function beatBounds(barIndex: number, { first, last }: ClipboardRange): [number, number] {
  return [barIndex === first.barIndex ? first.beatIndex : 0, barIndex === last.barIndex ? last.beatIndex + 1 : Infinity];
}

function pasteBeats(target: Bar, source: Bar, firstBeat: number, filter: PasteOptions["content"]): void {
  source.voices.forEach((sourceVoice, voiceIndex) => {
    const targetVoice = target.voices[voiceIndex];
    sourceVoice.beats.forEach((beat, offset) => {
      const index = firstBeat + offset;
      const previous = targetVoice.beats[index];
      if (!previous && filter === "effects") return;
      while (targetVoice.beats.length < index) targetVoice.beats.push(createBeat());
      targetVoice.beats[index] = filteredBeat(beat, previous, filter);
    });
  });
}

function filteredBeat(source: Beat, target: Beat | undefined, filter: PasteOptions["content"]): Beat {
  if (filter === "all") return structuredClone(source);
  const prior = target ?? createBeat();
  if (filter === "notes") {
    return {
      ...prior,
      duration: source.duration, dots: source.dots, tuplet: structuredClone(source.tuplet), rest: source.rest,
      notes: source.notes.map((note, index) => pitchedDetails(prior.notes[index] ?? createNote(), note)),
      graceNotes: structuredClone(source.graceNotes)
    };
  }
  return {
    ...structuredClone(source),
    duration: prior.duration, dots: prior.dots, tuplet: prior.tuplet, rest: prior.rest, graceNotes: prior.graceNotes,
    notes: prior.notes.map((note, index) => pitchedDetails(structuredClone(source.notes[index] ?? note), note))
  };
}

function pitchedDetails(effects: Note, note: Note): Note {
  return {
    ...effects,
    string: note.string, fret: note.fret, midiPitch: note.midiPitch, midiNumber: note.midiNumber,
    articulation: note.articulation, tiedFromPrevious: note.tiedFromPrevious
  };
}
