import { createBar, createBeat, createEmptyScore, createMasterBar, createNote, createTrack } from "./factory";
import type { Bar, Beat, BeatDuration, Score, Tuplet } from "./types";

const guitarPattern = [
  [6, 0],
  [5, 2],
  [4, 2],
  [3, 1]
] as const;

const bassPattern = [
  [4, 0],
  [4, 2],
  [3, 0],
  [3, 2]
] as const;

export function createDemoScore(): Score {
  const score = createEmptyScore();
  score.meta.title = "Phase 2b Rhythm Engraving Demo";
  score.masterBars = Array.from({ length: 11 }, () => createMasterBar());
  score.masterBars[3].layout.forcedBreak = true;
  score.masterBars[7].layout.forcedBreak = true;

  const guitar = createTrack(undefined, score.masterBars.length);
  guitar.name = "Guitar";
  guitar.shortName = "Gtr.";
  guitar.color = "#2563eb";

  const bass = createTrack(
    {
      name: "Bass",
      shortName: "Bs.",
      color: "#c2410c",
      icon: "bass",
      strings: [28, 33, 38, 43],
      tuningLabel: "E A D G"
    },
    score.masterBars.length
  );
  bass.notationTypes = ["standard", "tab"];

  score.tracks = [guitar, bass];
  guitar.bars = guitarDemoBars(guitar.id);
  bass.bars = bassDemoBars(score.masterBars.length);

  return score;
}

function guitarDemoBars(trackId: string): Bar[] {
  return [
    dottedQuarterBar(),
    sixteenthBeamBar(),
    tripletBar(),
    nestedTupletBar(),
    wholeNoteBar(),
    durationLadderBar(),
    flaggedRhythmBar(),
    restLadderBar(),
    tiedHalfNoteBar(trackId, 8),
    twoVoiceBar(),
    incompleteBar()
  ];
}

function bassDemoBars(count: number): Bar[] {
  return Array.from({ length: count }, (_, barIndex) => {
    if (barIndex === 4) {
      return barWithVoice([restBeat(1)]);
    }

    const rotation = barIndex % bassPattern.length;
    const beats = bassPattern.map((_, index) => {
      const [string, fret] = bassPattern[(index + rotation) % bassPattern.length];
      return noteBeat(4, string, fret + (barIndex % 2));
    });

    return barWithVoice(beats);
  });
}

function dottedQuarterBar(): Bar {
  return barWithVoice([
    noteBeat(4, 6, 0, { dots: 1 }),
    noteBeat(8, 5, 2),
    noteBeat(4, 4, 2),
    noteBeat(4, 3, 1)
  ]);
}

function sixteenthBeamBar(): Bar {
  const sixteenths = Array.from({ length: 8 }, (_, index) =>
    noteBeat(16, guitarPattern[index % guitarPattern.length][0], index % 4)
  );

  return barWithVoice([...sixteenths, noteBeat(4, 4, 4), noteBeat(4, 3, 2)]);
}

function tripletBar(): Bar {
  const triplet: Tuplet = { n: 3, m: 2 };

  return barWithVoice([
    noteBeat(8, 6, 3, { tuplet: triplet }),
    noteBeat(8, 5, 3, { tuplet: triplet }),
    noteBeat(8, 4, 3, { tuplet: triplet }),
    noteBeat(4, 3, 2),
    restBeat(2)
  ]);
}

function nestedTupletBar(): Bar {
  const outer: Tuplet = { n: 3, m: 2 };
  const inner: Tuplet = { n: 5, m: 4, parent: outer };
  const nested = Array.from({ length: 5 }, (_, index) =>
    noteBeat(16, guitarPattern[index % guitarPattern.length][0], index + 1, {
      tuplet: inner,
      beamMode: index === 0 ? "forceGroup" : "auto"
    })
  );

  return barWithVoice([
    ...nested,
    noteBeat(4, 3, 4, { tuplet: outer }),
    noteBeat(4, 2, 3, { tuplet: outer }),
    noteBeat(4, 4, 5),
    noteBeat(4, 3, 5)
  ]);
}

function wholeNoteBar(): Bar {
  return barWithVoice([noteBeat(1, 4, 7)]);
}

function durationLadderBar(): Bar {
  return barWithVoice([
    noteBeat(2, 5, 5),
    noteBeat(4, 4, 5),
    noteBeat(8, 3, 5),
    noteBeat(16, 2, 3),
    noteBeat(16, 1, 3)
  ]);
}

function flaggedRhythmBar(): Bar {
  return barWithVoice([
    noteBeat(32, 6, 7),
    noteBeat(32, 5, 7),
    noteBeat(32, 4, 7),
    noteBeat(32, 3, 7),
    noteBeat(64, 2, 5),
    noteBeat(64, 1, 5),
    noteBeat(64, 2, 6),
    noteBeat(64, 1, 6),
    noteBeat(64, 2, 7),
    noteBeat(64, 1, 7),
    noteBeat(64, 2, 8),
    noteBeat(64, 1, 8),
    noteBeat(4, 4, 7),
    noteBeat(4, 3, 7),
    noteBeat(4, 2, 7)
  ]);
}

function restLadderBar(): Bar {
  return barWithVoice([
    restBeat(2),
    restBeat(4),
    restBeat(8),
    restBeat(16),
    restBeat(32),
    restBeat(64),
    restBeat(64)
  ]);
}

function tiedHalfNoteBar(trackId: string, barIndex: number): Bar {
  const first = createNote(4, 9);
  const second = createNote(4, 9);
  const firstRef = { trackId, barIndex, voiceIndex: 0, beatIndex: 0, noteIndex: 0 };
  const secondRef = { trackId, barIndex, voiceIndex: 0, beatIndex: 1, noteIndex: 0 };
  first.tieDestination = secondRef;
  second.tieOrigin = firstRef;

  return barWithVoice([
    createBeat({ duration: 2, rest: false, notes: [first] }),
    createBeat({ duration: 2, rest: false, notes: [second] })
  ]);
}

function twoVoiceBar(): Bar {
  const bar = createBar();
  bar.voices[0].beats = [noteBeat(4, 6, 5), noteBeat(4, 5, 5), noteBeat(4, 4, 5), noteBeat(4, 3, 5)];
  bar.voices[1].beats = Array.from({ length: 8 }, (_, index) =>
    noteBeat(8, index % 2 === 0 ? 2 : 1, index % 2 === 0 ? 8 : 7, {
      stemDirection: "down"
    })
  );
  return bar;
}

function incompleteBar(): Bar {
  return barWithVoice([noteBeat(4, 6, 0), noteBeat(4, 5, 2), noteBeat(4, 4, 2)]);
}

function barWithVoice(beats: Beat[]): Bar {
  const bar = createBar();
  bar.voices[0].beats = beats;
  return bar;
}

function noteBeat(
  duration: BeatDuration,
  string: number,
  fret: number,
  options: Partial<Beat> = {}
): Beat {
  return createBeat({
    duration,
    rest: false,
    notes: [createNote(string, fret)],
    ...options
  });
}

function restBeat(duration: BeatDuration, options: Partial<Beat> = {}): Beat {
  return createBeat({
    duration,
    rest: true,
    notes: [],
    ...options
  });
}
