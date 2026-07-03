import {
  beatDurationTicks,
  barTheoreticalTicks,
  noteMidiPitch
} from "../../model/derive";
import {
  createBar,
  createBeat,
  createMasterBar,
  createNote
} from "../../model/factory";
import type {
  Bar,
  Beat,
  BeatDuration,
  DirectionJump,
  DirectionTarget,
  Dynamic,
  Note,
  NoteRef,
  Score,
  Track
} from "../../model/types";
import type { CursorMove, CursorPosition } from "./types";

const durationOrder: BeatDuration[] = [1, 2, 4, 8, 16, 32, 64];
const dynamicOrder: Dynamic[] = [0, 1, 2, 3, 4, 5, 6, 7];
const timeSignatureCycle = [
  { numerator: 4, denominator: 4 as BeatDuration },
  { numerator: 3, denominator: 4 as BeatDuration },
  { numerator: 6, denominator: 8 as BeatDuration },
  { numerator: 12, denominator: 8 as BeatDuration }
];
const keySignatureCycle = ["C", "G", "D", "A", "E", "F", "Bb", "Eb", "Am", "Em", "Bm"];

export type BarSymbolCommand =
  | "repeatOpen"
  | "repeatClose"
  | "doubleBar"
  | "freeTime"
  | "tripletFeel"
  | "alternateEnding"
  | "section"
  | "directionTarget"
  | "directionJump"
  | "fermata"
  | "simile"
  | "anacrusis";

export type NoteEffectCommand =
  | "ghost"
  | "dead"
  | "accent"
  | "heavyAccent"
  | "staccato"
  | "letRing"
  | "palmMute"
  | "hopo"
  | "slide"
  | "bend"
  | "harmonic"
  | "vibrato"
  | "trill"
  | "tremoloPicking"
  | "fadeIn"
  | "fadeOut"
  | "volumeSwell"
  | "wah"
  | "slap"
  | "pop"
  | "pickscrape"
  | "deadSlapped"
  | "stringNumber";

export type BeatEffectCommand =
  | "brushDown"
  | "brushUp"
  | "arpeggioDown"
  | "arpeggioUp"
  | "pickDown"
  | "pickUp"
  | "tapping"
  | "barVibrato"
  | "hairpinCresc"
  | "hairpinDecresc"
  | "ottava";

export function cloneScore(score: Score): Score {
  return structuredClone(score) as Score;
}

export function defaultCursor(score: Score): CursorPosition {
  return {
    trackId: score.tracks[0]?.id ?? null,
    barIndex: 0,
    voiceIndex: 0,
    beatIndex: 0,
    string: 1,
    staffLine: 0,
    staffKind: "tab"
  };
}

export function normaliseCursor(score: Score, cursor: CursorPosition): CursorPosition {
  const track = trackForCursor(score, cursor) ?? score.tracks[0] ?? null;
  const trackId = track?.id ?? null;
  const barIndex = clamp(cursor.barIndex, 0, Math.max(0, score.masterBars.length - 1));
  const voiceIndex = clamp(cursor.voiceIndex, 0, 3);
  const voice = track?.bars[barIndex]?.voices[voiceIndex];
  const beatIndex = clamp(cursor.beatIndex, 0, Math.max(0, (voice?.beats.length ?? 1) - 1));
  const stringCount = track?.tuning.strings.length ?? 6;

  return {
    ...cursor,
    trackId,
    barIndex,
    voiceIndex,
    beatIndex,
    string: clamp(cursor.string, 1, stringCount),
    staffLine: clamp(cursor.staffLine, -12, 12)
  };
}

export function moveCursor(score: Score, cursor: CursorPosition, move: CursorMove): CursorPosition {
  const current = normaliseCursor(score, cursor);
  const track = trackForCursor(score, current);

  if (!track) {
    return current;
  }

  switch (move) {
    case "left":
      return moveBeatLeft(score, track, current);
    case "right":
      return moveBeatRight(score, track, current);
    case "up":
      return current.staffKind === "tab"
        ? normaliseCursor(score, { ...current, string: current.string - 1 })
        : normaliseCursor(score, { ...current, staffLine: current.staffLine + 1 });
    case "down":
      return current.staffKind === "tab"
        ? normaliseCursor(score, { ...current, string: current.string + 1 })
        : normaliseCursor(score, { ...current, staffLine: current.staffLine - 1 });
    case "home":
      return { ...current, beatIndex: 0 };
    case "end":
      return { ...current, beatIndex: lastBeatIndex(track, current) };
    case "firstBar":
      return { ...current, barIndex: 0, beatIndex: 0 };
    case "lastBar":
      return { ...current, barIndex: Math.max(0, score.masterBars.length - 1), beatIndex: 0 };
    case "previousTrack":
      return moveTrack(score, current, -1);
    case "nextTrack":
      return moveTrack(score, current, 1);
  }
}

export function moveRightWithScoreMutation(score: Score, cursor: CursorPosition): CursorPosition {
  const current = normaliseCursor(score, cursor);
  const track = trackForCursor(score, current);
  const voice = voiceForCursor(score, current);

  if (!track || !voice) {
    return current;
  }

  if (current.beatIndex < voice.beats.length - 1) {
    return { ...current, beatIndex: current.beatIndex + 1 };
  }

  const expected = barTheoreticalTicks(score.masterBars[current.barIndex]);
  const actual = voice.beats.reduce((total, beat) => total + beatDurationTicks(beat), 0);

  if (actual < expected) {
    const previous = voice.beats[current.beatIndex] ?? createBeat({ duration: 4 });
    voice.beats.push(
      createBeat({
        duration: previous.duration,
        dots: previous.dots,
        tuplet: previous.tuplet,
        rest: true
      })
    );
    return { ...current, beatIndex: current.beatIndex + 1 };
  }

  if (current.barIndex >= score.masterBars.length - 1) {
    appendBarToAllTracks(score);
  }

  return normaliseCursor(score, {
    ...current,
    barIndex: current.barIndex + 1,
    beatIndex: 0
  });
}

export function shouldMutateOnMoveRight(score: Score, cursor: CursorPosition): boolean {
  const current = normaliseCursor(score, cursor);
  const track = trackForCursor(score, current);
  const voice = voiceForCursor(score, current);

  if (!track || !voice || current.beatIndex < voice.beats.length - 1) {
    return false;
  }

  const expected = barTheoreticalTicks(score.masterBars[current.barIndex]);
  const actual = voice.beats.reduce((total, beat) => total + beatDurationTicks(beat), 0);

  return actual < expected || current.barIndex >= score.masterBars.length - 1;
}

export function inputFret(score: Score, cursor: CursorPosition, fret: number): CursorPosition {
  const current = normaliseCursor(score, cursor);
  const beat = ensureBeat(score, current);

  if (!beat) {
    return current;
  }

  beat.rest = false;
  const string = current.staffKind === "tab" ? current.string : staffInputString(score, current, fret);
  const noteIndex = beat.notes.findIndex((note) => note.string === string);
  const note = noteIndex >= 0 ? beat.notes[noteIndex] : createNote(string, 0);
  note.string = string;
  note.fret = Math.max(0, fret);

  if (noteIndex >= 0) {
    beat.notes[noteIndex] = note;
  } else {
    beat.notes.push(note);
  }

  return { ...current, string };
}

export function inputStandardString(score: Score, cursor: CursorPosition, stringNumber: number): CursorPosition {
  const track = trackForCursor(score, cursor);
  const string = stringNumber === 0 ? bestStringForStaffLine(track, cursor.staffLine) : stringNumber;
  return inputFret(score, { ...cursor, string, staffKind: "standard" }, 0);
}

export function deleteNoteAtCursor(score: Score, cursor: CursorPosition): CursorPosition {
  const current = normaliseCursor(score, cursor);
  const beat = beatForCursor(score, current);

  if (!beat) {
    return current;
  }

  beat.notes = beat.notes.filter((note) => note.string !== current.string);

  if (beat.notes.length === 0) {
    beat.rest = true;
  }

  return current;
}

export function deleteBeatAtCursor(score: Score, cursor: CursorPosition): CursorPosition {
  const current = normaliseCursor(score, cursor);
  const voice = voiceForCursor(score, current);

  if (!voice || voice.beats.length === 0) {
    return current;
  }

  voice.beats.splice(current.beatIndex, 1);
  return normaliseCursor(score, { ...current, beatIndex: Math.max(0, current.beatIndex - 1) });
}

export function insertBeatAtCursor(score: Score, cursor: CursorPosition): CursorPosition {
  const current = normaliseCursor(score, cursor);
  const voice = voiceForCursor(score, current);

  if (!voice) {
    return current;
  }

  const reference = voice.beats[current.beatIndex] ?? createBeat({ duration: 4 });
  voice.beats.splice(
    current.beatIndex,
    0,
    createBeat({ duration: reference.duration, dots: reference.dots, tuplet: reference.tuplet })
  );

  return current;
}

export function insertBarAtCursor(score: Score, cursor: CursorPosition): CursorPosition {
  const current = normaliseCursor(score, cursor);
  score.masterBars.splice(current.barIndex, 0, createMasterBar());
  score.tracks.forEach((track) => track.bars.splice(current.barIndex, 0, createBar()));
  return current;
}

export function deleteBarAtCursor(score: Score, cursor: CursorPosition): CursorPosition {
  const current = normaliseCursor(score, cursor);

  if (score.masterBars.length <= 1) {
    return current;
  }

  score.masterBars.splice(current.barIndex, 1);
  score.tracks.forEach((track) => track.bars.splice(current.barIndex, 1));

  return normaliseCursor(score, {
    ...current,
    barIndex: Math.min(current.barIndex, score.masterBars.length - 1),
    beatIndex: 0
  });
}

export function toggleRestAtCursor(score: Score, cursor: CursorPosition): CursorPosition {
  const current = normaliseCursor(score, cursor);
  const beat = ensureBeat(score, current);

  if (beat) {
    beat.rest = true;
    beat.notes = [];
  }

  return current;
}

export function setDotsAtCursor(score: Score, cursor: CursorPosition, dots: 1 | 2): CursorPosition {
  const current = normaliseCursor(score, cursor);
  const beat = ensureBeat(score, current);

  if (beat) {
    beat.dots = beat.dots === dots ? 0 : dots;
  }

  return current;
}

export function toggleTripletAtCursor(score: Score, cursor: CursorPosition): CursorPosition {
  const current = normaliseCursor(score, cursor);
  const beat = ensureBeat(score, current);

  if (beat) {
    beat.tuplet = beat.tuplet ? undefined : { n: 3, m: 2 };
  }

  return current;
}

export function tieCurrentNoteToNext(score: Score, cursor: CursorPosition, wholeBeat = false): CursorPosition {
  const current = normaliseCursor(score, cursor);
  const beat = beatForCursor(score, current);
  const next = nextBeatRef(score, current);

  if (!beat || !next.beat) {
    return current;
  }

  const nextBeat = next.beat;
  const notes = wholeBeat ? beat.notes : beat.notes.filter((note) => note.string === current.string);

  notes.forEach((note) => {
    const destinationIndex = nextBeat.notes.findIndex((candidate) => candidate.string === note.string);
    const destination =
      destinationIndex >= 0 ? nextBeat.notes[destinationIndex] : createNote(note.string, note.fret);

    destination.fret = note.fret;
    destination.tieOrigin = {
      trackId: current.trackId ?? "",
      barIndex: current.barIndex,
      voiceIndex: current.voiceIndex,
      beatIndex: current.beatIndex,
      noteIndex: beat.notes.indexOf(note)
    };
    note.tieDestination = {
      trackId: current.trackId ?? "",
      barIndex: next.cursor.barIndex,
      voiceIndex: next.cursor.voiceIndex,
      beatIndex: next.cursor.beatIndex,
      noteIndex: destinationIndex >= 0 ? destinationIndex : nextBeat.notes.length
    };

    if (destinationIndex < 0) {
      nextBeat.rest = false;
      nextBeat.notes.push(destination);
    }
  });

  return current;
}

export function copyPreviousBeat(score: Score, cursor: CursorPosition): CursorPosition {
  const current = normaliseCursor(score, cursor);
  const voice = voiceForCursor(score, current);

  if (!voice || current.beatIndex === 0) {
    return current;
  }

  voice.beats[current.beatIndex] = structuredClone(voice.beats[current.beatIndex - 1]);
  return current;
}

export function changeDurationAtCursor(
  score: Score,
  cursor: CursorPosition,
  direction: "longer" | "shorter"
): CursorPosition {
  const current = normaliseCursor(score, cursor);
  const beat = ensureBeat(score, current);

  if (!beat) {
    return current;
  }

  const index = durationOrder.indexOf(beat.duration);
  const nextIndex = direction === "shorter" ? index + 1 : index - 1;
  beat.duration = durationOrder[clamp(nextIndex, 0, durationOrder.length - 1)];
  return current;
}

export function setDurationAtCursor(
  score: Score,
  cursor: CursorPosition,
  duration: BeatDuration
): CursorPosition {
  const current = normaliseCursor(score, cursor);
  const beat = ensureBeat(score, current);

  if (beat) {
    beat.duration = duration;
  }

  return current;
}

export function moveNoteString(score: Score, cursor: CursorPosition, direction: -1 | 1): CursorPosition {
  const current = normaliseCursor(score, cursor);
  const beat = beatForCursor(score, current);
  const track = trackForCursor(score, current);
  const note = beat?.notes.find((candidate) => candidate.string === current.string);

  if (!beat || !track || !note) {
    return current;
  }

  const pitch = noteMidiPitch(note, track);
  const nextString = clamp(note.string + direction, 1, track.tuning.strings.length);
  const openPitch = stringOpenPitch(track, nextString);
  const fret = pitch - openPitch - track.tuning.capo;

  if (fret >= 0) {
    note.string = nextString;
    note.fret = fret;
  }

  return normaliseCursor(score, { ...current, string: nextString });
}

export function transposeNoteAtCursor(score: Score, cursor: CursorPosition, semitones: -1 | 1): CursorPosition {
  const current = normaliseCursor(score, cursor);
  const beat = beatForCursor(score, current);
  const note = beat?.notes.find((candidate) => candidate.string === current.string);

  if (note) {
    note.fret = Math.max(0, note.fret + semitones);
  }

  return current;
}

export function setAccidentalAtCursor(
  score: Score,
  cursor: CursorPosition,
  accidental: Note["accidental"]
): CursorPosition {
  const current = normaliseCursor(score, cursor);
  const beat = beatForCursor(score, current);
  const note = beat?.notes.find((candidate) => candidate.string === current.string) ?? beat?.notes[0];

  if (note) {
    note.accidental = accidental;
    note.forceAccidental = accidental !== "none";
  }

  return current;
}

export function cycleTimeSignatureAtCursor(score: Score, cursor: CursorPosition): CursorPosition {
  const current = normaliseCursor(score, cursor);
  const masterBar = score.masterBars[current.barIndex];

  if (!masterBar) {
    return current;
  }

  const currentIndex = timeSignatureCycle.findIndex(
    (signature) =>
      signature.numerator === masterBar.timeSignature.numerator &&
      signature.denominator === masterBar.timeSignature.denominator
  );
  const next = timeSignatureCycle[(currentIndex + 1) % timeSignatureCycle.length];
  masterBar.timeSignature = {
    ...masterBar.timeSignature,
    numerator: next.numerator,
    denominator: next.denominator
  };

  return current;
}

export function cycleKeySignatureAtCursor(score: Score, cursor: CursorPosition): CursorPosition {
  const current = normaliseCursor(score, cursor);
  const masterBar = score.masterBars[current.barIndex];

  if (!masterBar) {
    return current;
  }

  const currentIndex = keySignatureCycle.indexOf(masterBar.keySignature.key);
  const next = keySignatureCycle[(currentIndex + 1) % keySignatureCycle.length];
  masterBar.keySignature = {
    key: next,
    mode: next.endsWith("m") ? "minor" : "major"
  };

  return current;
}

export function toggleBarSymbolAtCursor(
  score: Score,
  cursor: CursorPosition,
  symbol: BarSymbolCommand
): CursorPosition {
  const current = normaliseCursor(score, cursor);
  const masterBar = score.masterBars[current.barIndex];

  if (!masterBar) {
    return current;
  }

  switch (symbol) {
    case "repeatOpen":
      masterBar.repeatOpen = !masterBar.repeatOpen;
      break;
    case "repeatClose":
      masterBar.repeatClose = masterBar.repeatClose > 0 ? 0 : 2;
      break;
    case "doubleBar":
      masterBar.doubleBar = !masterBar.doubleBar;
      break;
    case "freeTime":
      masterBar.freeTime = !masterBar.freeTime;
      break;
    case "tripletFeel":
      masterBar.tripletFeel = masterBar.tripletFeel ? null : "8th swing";
      break;
    case "alternateEnding":
      masterBar.alternateEndings = nextAlternateEndingMask(masterBar.alternateEndings);
      break;
    case "section":
      masterBar.section = masterBar.section
        ? undefined
        : {
            letter: nextSectionLetter(score),
            name: "Section",
            boxed: true
          };
      break;
    case "directionTarget":
      masterBar.directionTargets = cycleDirectionTarget(masterBar.directionTargets);
      break;
    case "directionJump":
      masterBar.directionJumps = cycleDirectionJump(masterBar.directionJumps);
      break;
    case "fermata":
      toggleFermataAtBeat(score, current);
      break;
    case "simile":
      masterBar.simileMark =
        masterBar.simileMark === "none"
          ? "single"
          : masterBar.simileMark === "single"
            ? "double"
            : "none";
      break;
    case "anacrusis":
      masterBar.anacrusis = !masterBar.anacrusis;
      break;
  }

  return current;
}

export function setDynamicAtCursor(
  score: Score,
  cursor: CursorPosition,
  dynamic: Dynamic
): CursorPosition {
  const current = normaliseCursor(score, cursor);
  const note = noteForCursor(score, current);

  if (note) {
    note.dynamic = dynamicOrder.includes(dynamic) ? dynamic : 4;
  }

  return current;
}

export function toggleNoteEffectAtCursor(
  score: Score,
  cursor: CursorPosition,
  effect: NoteEffectCommand
): CursorPosition {
  const current = normaliseCursor(score, cursor);
  const note = noteForCursor(score, current);

  if (!note) {
    return current;
  }

  switch (effect) {
    case "ghost":
      note.ghost = !note.ghost;
      break;
    case "dead":
      note.deadNote = !note.deadNote;
      break;
    case "accent":
      note.accent = note.accent === "accent" ? "none" : "accent";
      break;
    case "heavyAccent":
      note.accent = note.accent === "heavy" ? "none" : "heavy";
      break;
    case "staccato":
      note.staccato = !note.staccato;
      break;
    case "letRing":
      note.letRing = !note.letRing;
      break;
    case "palmMute":
      note.palmMute = !note.palmMute;
      break;
    case "hopo":
      note.hopo = !note.hopo;
      break;
    case "slide":
      note.slide = note.slide ? undefined : "shift";
      break;
    case "bend":
      note.bend = note.bend
        ? undefined
        : {
            points: [
              { offset: 0, value: 0 },
              { offset: 60, value: 100 }
            ]
          };
      break;
    case "harmonic":
      note.harmonic = note.harmonic ? undefined : { type: "natural", touchFret: 12 };
      break;
    case "vibrato":
      note.vibrato =
        note.vibrato === "none" ? "slight" : note.vibrato === "slight" ? "wide" : "none";
      break;
    case "trill":
      note.trill = note.trill ? undefined : { secondFret: note.fret + 2, speed: 16 };
      break;
    case "tremoloPicking":
      note.tremoloPicking =
        note.tremoloPicking === undefined ? 16 : note.tremoloPicking === 16 ? 32 : undefined;
      break;
    case "fadeIn":
      note.fadeIn = !note.fadeIn;
      break;
    case "fadeOut":
      note.fadeOut = !note.fadeOut;
      break;
    case "volumeSwell":
      note.volumeSwell = !note.volumeSwell;
      break;
    case "wah":
      note.wah = note.wah === undefined ? "open" : note.wah === "open" ? "closed" : undefined;
      break;
    case "slap":
      note.slap = !note.slap;
      if (note.slap) {
        note.pop = false;
      }
      break;
    case "pop":
      note.pop = !note.pop;
      if (note.pop) {
        note.slap = false;
      }
      break;
    case "pickscrape":
      note.pickscrape = !note.pickscrape;
      break;
    case "deadSlapped":
      note.deadSlapped = !note.deadSlapped;
      break;
    case "stringNumber":
      note.showStringNumber = !note.showStringNumber;
      break;
  }

  return current;
}

export function toggleBeatEffectAtCursor(
  score: Score,
  cursor: CursorPosition,
  effect: BeatEffectCommand
): CursorPosition {
  const current = normaliseCursor(score, cursor);
  const beat = ensureBeat(score, current);

  if (!beat) {
    return current;
  }

  switch (effect) {
    case "brushDown":
      beat.brush = beat.brush?.direction === "down" ? undefined : { direction: "down", speed: 1, delay: 0 };
      break;
    case "brushUp":
      beat.brush = beat.brush?.direction === "up" ? undefined : { direction: "up", speed: 1, delay: 0 };
      break;
    case "arpeggioDown":
      beat.arpeggio =
        beat.arpeggio?.direction === "down" ? undefined : { direction: "down", speed: 1, delay: 0 };
      break;
    case "arpeggioUp":
      beat.arpeggio =
        beat.arpeggio?.direction === "up" ? undefined : { direction: "up", speed: 1, delay: 0 };
      break;
    case "pickDown":
      beat.pickstroke = beat.pickstroke === "down" ? "none" : "down";
      break;
    case "pickUp":
      beat.pickstroke = beat.pickstroke === "up" ? "none" : "up";
      break;
    case "tapping":
      beat.tapping = !beat.tapping;
      break;
    case "barVibrato":
      beat.barVibrato =
        beat.barVibrato === "none" ? "slight" : beat.barVibrato === "slight" ? "wide" : "none";
      break;
    case "hairpinCresc":
      beat.dynamicHairpin =
        beat.dynamicHairpin?.type === "cresc" ? undefined : { type: "cresc" };
      break;
    case "hairpinDecresc":
      beat.dynamicHairpin =
        beat.dynamicHairpin?.type === "decresc" ? undefined : { type: "decresc" };
      break;
    case "ottava":
      beat.ottava =
        beat.ottava === "none"
          ? "8va"
          : beat.ottava === "8va"
            ? "8vb"
            : beat.ottava === "8vb"
              ? "15ma"
              : "none";
      break;
  }

  return current;
}

export function cloneCurrentBar(track: Track, barIndex: number): Bar {
  return structuredClone(track.bars[barIndex] ?? createBar());
}

export function replaceTrackBars(track: Track, startBar: number, bars: Bar[], insert: boolean): void {
  if (insert) {
    track.bars.splice(startBar, 0, ...structuredClone(bars));
    return;
  }

  bars.forEach((bar, offset) => {
    track.bars[startBar + offset] = structuredClone(bar);
  });
}

function moveBeatLeft(score: Score, track: Track, cursor: CursorPosition): CursorPosition {
  if (cursor.beatIndex > 0) {
    return { ...cursor, beatIndex: cursor.beatIndex - 1 };
  }

  if (cursor.barIndex === 0) {
    return cursor;
  }

  const previousBarIndex = cursor.barIndex - 1;
  const previousVoice = track.bars[previousBarIndex]?.voices[cursor.voiceIndex];
  return {
    ...cursor,
    barIndex: previousBarIndex,
    beatIndex: Math.max(0, (previousVoice?.beats.length ?? 1) - 1)
  };
}

function moveBeatRight(score: Score, track: Track, cursor: CursorPosition): CursorPosition {
  const voice = track.bars[cursor.barIndex]?.voices[cursor.voiceIndex];

  if (voice && cursor.beatIndex < voice.beats.length - 1) {
    return { ...cursor, beatIndex: cursor.beatIndex + 1 };
  }

  if (cursor.barIndex >= score.masterBars.length - 1) {
    return cursor;
  }

  return { ...cursor, barIndex: cursor.barIndex + 1, beatIndex: 0 };
}

function moveTrack(score: Score, cursor: CursorPosition, direction: -1 | 1): CursorPosition {
  const trackIndex = score.tracks.findIndex((track) => track.id === cursor.trackId);
  const nextTrack = score.tracks[clamp(trackIndex + direction, 0, score.tracks.length - 1)];

  return normaliseCursor(score, {
    ...cursor,
    trackId: nextTrack?.id ?? cursor.trackId
  });
}

function appendBarToAllTracks(score: Score): void {
  score.masterBars.push(createMasterBar());
  score.tracks.forEach((track) => track.bars.push(createBar()));
}

function ensureBeat(score: Score, cursor: CursorPosition): Beat | null {
  const voice = voiceForCursor(score, cursor);

  if (!voice) {
    return null;
  }

  while (voice.beats.length <= cursor.beatIndex) {
    voice.beats.push(createBeat({ duration: 4 }));
  }

  return voice.beats[cursor.beatIndex];
}

function nextBeatRef(
  score: Score,
  cursor: CursorPosition
): { cursor: CursorPosition; beat: Beat | null } {
  const nextCursor = moveCursor(score, cursor, "right");
  return { cursor: nextCursor, beat: ensureBeat(score, nextCursor) };
}

function beatForCursor(score: Score, cursor: CursorPosition): Beat | null {
  return voiceForCursor(score, cursor)?.beats[cursor.beatIndex] ?? null;
}

function voiceForCursor(score: Score, cursor: CursorPosition) {
  return trackForCursor(score, cursor)?.bars[cursor.barIndex]?.voices[cursor.voiceIndex] ?? null;
}

function trackForCursor(score: Score, cursor: CursorPosition): Track | null {
  return score.tracks.find((track) => track.id === cursor.trackId) ?? null;
}

function noteForCursor(score: Score, cursor: CursorPosition): Note | null {
  const beat = beatForCursor(score, cursor);
  return beat?.notes.find((candidate) => candidate.string === cursor.string) ?? beat?.notes[0] ?? null;
}

function lastBeatIndex(track: Track, cursor: CursorPosition): number {
  const voice = track.bars[cursor.barIndex]?.voices[cursor.voiceIndex];
  return Math.max(0, (voice?.beats.length ?? 1) - 1);
}

function staffInputString(score: Score, cursor: CursorPosition, key: number): number {
  const track = trackForCursor(score, cursor);
  return key === 0 ? bestStringForStaffLine(track, cursor.staffLine) : key;
}

function bestStringForStaffLine(track: Track | null, staffLine: number): number {
  if (!track) {
    return 1;
  }

  const middle = Math.ceil(track.tuning.strings.length / 2);
  return clamp(middle - Math.sign(staffLine), 1, track.tuning.strings.length);
}

function stringOpenPitch(track: Track, stringNumber: number): number {
  const index = track.tuning.strings.length - stringNumber;
  return track.tuning.strings[index] ?? track.tuning.strings[0] ?? 40;
}

function nextAlternateEndingMask(mask: number): number {
  if (mask === 0) {
    return 1;
  }

  if (mask === 1) {
    return 2;
  }

  if (mask === 2) {
    return 3;
  }

  return 0;
}

function nextSectionLetter(score: Score): string {
  const sectionCount = score.masterBars.filter((masterBar) => masterBar.section).length;
  return String.fromCharCode(65 + (sectionCount % 26));
}

function cycleDirectionTarget(targets: DirectionTarget[]): DirectionTarget[] {
  const cycle: DirectionTarget[] = ["Segno", "Coda", "DoubleCoda", "Fine"];
  const currentIndex = targets.length === 0 ? -1 : cycle.indexOf(targets[0]);
  const next = cycle[currentIndex + 1];
  return next ? [next] : [];
}

function cycleDirectionJump(jumps: DirectionJump[]): DirectionJump[] {
  const cycle: DirectionJump[] = ["DaCapo", "DalSegno", "AlCoda", "AlFine"];
  const currentIndex = jumps.length === 0 ? -1 : cycle.indexOf(jumps[0]);
  const next = cycle[currentIndex + 1];
  return next ? [next] : [];
}

function toggleFermataAtBeat(score: Score, cursor: CursorPosition): void {
  const masterBar = score.masterBars[cursor.barIndex];
  const beatTick = beatTickForCursor(score, cursor);
  const existingIndex = masterBar.fermatas.findIndex((fermata) => fermata.beatTick === beatTick);

  if (existingIndex >= 0) {
    masterBar.fermatas.splice(existingIndex, 1);
    return;
  }

  masterBar.fermatas.push({
    beatTick,
    glyph: "above",
    tempoScale: 0.75
  });
}

function beatTickForCursor(score: Score, cursor: CursorPosition): number {
  const voice = voiceForCursor(score, cursor);

  if (!voice) {
    return 0;
  }

  return voice.beats
    .slice(0, cursor.beatIndex)
    .reduce((tick, beat) => tick + beatDurationTicks(beat), 0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
