import { barTheoreticalTicks, beatDurationTicks } from "../../model/derive";
import { createBeat } from "../../model/factory";
import { assignFingerings, handPosition } from "../../model/fingering";
import { trackNoteMidiPitch } from "../../model/trackKind";
import type { Beat, BeatDuration, MasterBar, Track, Voice } from "../../model/types";

const REST_DURATIONS: readonly BeatDuration[] = [1, 2, 4, 8, 16, 32, 64];

export function completeVoiceRests(voice: Voice, masterBar: MasterBar): void {
  const end = barTheoreticalTicks(masterBar);
  let position = voice.beats.reduce((total, beat) => total + beatDurationTicks(beat), 0);
  const { numerator, denominator } = masterBar.timeSignature;
  const fourFourMidpoint = numerator === 4 && denominator === 4 ? end / 2 : null;

  const rests = REST_DURATIONS.map((duration) => {
    const beat = createBeat({ duration });
    return { beat, ticks: beatDurationTicks(beat) };
  });

  while (position < end) {
    const current = position;
    const candidate = rests.find(({ ticks }) => {
      if (ticks > end - current || current % ticks !== 0) return false;
      if (fourFourMidpoint === null || current >= fourFourMidpoint || current === 0 && ticks === end) return true;
      return current + ticks <= fourFourMidpoint;
    });
    if (!candidate) break;

    voice.beats.push(createBeat({ duration: candidate.beat.duration }));
    position += candidate.ticks;
  }
}

export function lowerBeatFingerings(track: Track, beat: Beat, previousFret: number): number {
  if (track.kind !== "stringed" || beat.notes.length === 0) return previousFret;
  const placements = assignFingerings(track.tuning, beat.notes.map((note) => ({
    midi: trackNoteMidiPitch(note, track),
    maximumFret: note.fret,
    fallback: note
  })), previousFret);
  placements.forEach((placement, index) => {
    if (!placement?.matched) return;
    const note = beat.notes[index];
    note.string = placement.string;
    note.fret = placement.fret;
  });
  return handPosition(beat.notes);
}
