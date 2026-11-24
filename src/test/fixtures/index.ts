import { createBeat, createEmptyScore, createMasterBar, createNote, createTrack } from "../../model/factory";
import type { Beat, BeatDuration, MasterBar, Score } from "../../model/types";

function scoreBuilder() {
  const score = createEmptyScore();
  score.meta.title = "Regression fixture";

  return {
    bars(count: number) {
      score.masterBars = Array.from({ length: count }, () => createMasterBar());
      return this;
    },
    timeSignature(numerator: number, denominator: BeatDuration) {
      for (const bar of score.masterBars) {
        bar.timeSignature = { ...bar.timeSignature, numerator, denominator };
      }
      return this;
    },
    masterBar(index: number, patch: Partial<MasterBar>) {
      Object.assign(score.masterBars[index], patch);
      return this;
    },
    tracks(count: number) {
      score.tracks = Array.from({ length: count }, (_, index) => ({
        ...createTrack(undefined, score.masterBars.length),
        id: `fixture-track-${index + 1}`
      }));
      return this;
    },
    build: () => score
  };
}

export function emptyGuitar(bars = 1): Score {
  return scoreBuilder().bars(bars).tracks(1).build();
}

export function quarterRun(): Score {
  const score = emptyGuitar();
  score.tracks[0].bars[0].voices[0].beats = [0, 2, 4, 5].map((fret) => fretted(4, fret));
  return score;
}

export function tieAcrossBeat(): Score {
  return tiedQuarters(0, 1);
}

export function tieAcrossBarline(): Score {
  return tiedQuarters(1, 0);
}

function tiedQuarters(destinationBar: number, destinationBeat: number): Score {
  const score = emptyGuitar(destinationBar + 1);
  const track = score.tracks[0];
  const originBeat = destinationBar === 0 ? 0 : 3;
  const origin = fretted(4, 5);
  const destination = fretted(4, 5);
  origin.notes[0].tieDestination = {
    trackId: track.id, barIndex: destinationBar, voiceIndex: 0, beatIndex: destinationBeat, noteIndex: 0
  };
  destination.notes[0].tieOrigin = {
    trackId: track.id, barIndex: 0, voiceIndex: 0, beatIndex: originBeat, noteIndex: 0
  };
  track.bars[0].voices[0].beats = destinationBar === 0
    ? [origin, destination, createBeat({ duration: 2 })]
    : [createBeat(), createBeat(), createBeat(), origin];
  if (destinationBar !== 0) {
    track.bars[destinationBar].voices[0].beats = [destination, createBeat(), createBeat({ duration: 2 })];
  }
  return score;
}

export function dsAlCoda(): Score {
  const score = scoreBuilder().bars(8).tracks(1)
    .masterBar(1, { directionTargets: ["Segno"] })
    .masterBar(3, { directionJumps: ["DaCoda"] })
    .masterBar(5, { directionJumps: ["DalSegno", "AlCoda"] })
    .masterBar(6, { directionTargets: ["Coda"] })
    .build();
  fillQuarterBars(score);
  return score;
}

export function voltaTwoBarFirstEnding(): Score {
  const score = scoreBuilder().bars(5).tracks(1)
    .masterBar(0, { repeatOpen: true })
    .masterBar(1, { alternateEndings: 1 })
    .masterBar(2, { repeatClose: 2 })
    .masterBar(3, { alternateEndings: 2 })
    .build();
  fillQuarterBars(score);
  return score;
}

export function threeFour(): Score {
  const score = scoreBuilder().bars(1).timeSignature(3, 4).tracks(1).build();
  score.tracks[0].bars[0].voices[0].beats = [0, 2, 4].map((fret) => fretted(4, fret));
  return score;
}

export function tempoRamp(): Score {
  const score = emptyGuitar(16);
  fillQuarterBars(score);
  score.masterAutomations = [{
    type: "tempo",
    scope: "master",
    points: [
      { tick: 0, value: 140, transition: "progressive" },
      { tick: 16 * 1920, value: 200, transition: "constant" }
    ]
  }];
  return score;
}

export function drumsBasic(): Score {
  const score = emptyGuitar();
  const track = score.tracks[0];
  track.name = "Drums";
  track.shortName = "Dr.";
  track.icon = "drums";
  track.interpretation.stringed = false;
  track.bars[0].voices[0].beats = [36, 38, 42, 46].map((midiNumber) =>
    createBeat({ rest: false, notes: [{ ...createNote(), midiNumber }] }));
  return score;
}

export function chordsAndRests(): Score {
  const score = emptyGuitar(2);
  score.masterBars[0].fermatas = [{ beatTick: 960, glyph: "above", tempoScale: 0.75 }];
  score.tracks[0].bars[0].voices[0].beats = [
    createBeat({
      duration: 4,
      rest: false,
      notes: [createNote(6, 0), createNote(5, 2), createNote(4, 2)]
    }),
    createBeat({ duration: 4 }),
    createBeat({ duration: 2 })
  ];
  score.tracks[0].bars[1].voices[0].beats = [fretted(4, 1), createBeat(), fretted(2, 2)];
  return score;
}

export function eightTracks(): Score {
  const score = scoreBuilder().bars(12).tracks(8).build();
  fillQuarterBars(score);
  return score;
}

export function big100x8(): Score {
  const score = scoreBuilder().bars(100).tracks(8).build();
  fillQuarterBars(score);
  return score;
}

function fretted(duration: BeatDuration, fret: number): Beat {
  return createBeat({ duration, rest: false, notes: [createNote(1, fret)] });
}

function fillQuarterBars(score: Score): void {
  for (const track of score.tracks) {
    track.bars.forEach((bar, index) => {
      bar.voices[0].beats = Array.from({ length: 4 }, (_, beat) => fretted(4, (index + beat) % 12));
    });
  }
}
