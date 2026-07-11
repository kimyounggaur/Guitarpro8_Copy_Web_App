import { createBar, createBeat, createEmptyScore, createMasterBar, createNote, createTrack } from "./factory";
import type { Bar, Beat, BeatDuration, Note, Score, Tuplet } from "./types";

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
  score.meta.title = "Phase 9 Tools Demo";
  score.masterBars = Array.from({ length: 11 }, () => createMasterBar());
  applyPhase5MasterSymbols(score);
  score.masterBars[3].layout.forcedBreak = true;
  score.masterBars[7].layout.forcedBreak = true;
  score.masterAutomations = [
    {
      type: "tempo",
      scope: "master",
      points: [
        { tick: 0, value: 120, transition: "constant" },
        { tick: 3840, value: 144, transition: "progressive" },
        { tick: 7680, value: 108, transition: "constant" }
      ]
    },
    {
      type: "volume",
      scope: "master",
      points: [
        { tick: 0, value: 0.95, transition: "constant" },
        { tick: 3840, value: 1.08, transition: "progressive" },
        { tick: 7680, value: 0.86, transition: "progressive" }
      ]
    },
    {
      type: "pan",
      scope: "master",
      points: [
        { tick: 0, value: 0, transition: "constant" },
        { tick: 5760, value: 0.08, transition: "progressive" },
        { tick: 9600, value: -0.08, transition: "progressive" }
      ]
    }
  ];

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
  guitar.automations = [
    {
      type: "volume",
      scope: "track",
      points: [
        { tick: 0, value: 0.88, transition: "constant" },
        { tick: 3840, value: 1.12, transition: "progressive" },
        { tick: 7680, value: 0.82, transition: "progressive" }
      ]
    },
    {
      type: "pan",
      scope: "track",
      points: [
        { tick: 0, value: -0.18, transition: "constant" },
        { tick: 3840, value: 0.18, transition: "progressive" }
      ]
    }
  ];
  bass.automations = [
    {
      type: "volume",
      scope: "track",
      points: [
        { tick: 0, value: 0.9, transition: "constant" },
        { tick: 5760, value: 0.72, transition: "progressive" },
        { tick: 9600, value: 1.02, transition: "progressive" }
      ]
    },
    {
      type: "pan",
      scope: "track",
      points: [
        { tick: 0, value: 0.14, transition: "constant" },
        { tick: 5760, value: -0.16, transition: "progressive" }
      ]
    }
  ];
  guitar.bars = guitarDemoBars(guitar.id);
  bass.bars = bassDemoBars(score.masterBars.length);

  return score;
}

function applyPhase5MasterSymbols(score: Score): void {
  score.masterBars[0].section = { letter: "A", name: "Intro", boxed: true };
  score.masterBars[0].repeatOpen = true;
  score.masterBars[0].tripletFeel = "8th swing";
  score.masterBars[1].alternateEndings = 1;
  score.masterBars[1].fermatas = [{ beatTick: 960, glyph: "above", tempoScale: 0.75 }];
  score.masterBars[2].repeatClose = 2;
  score.masterBars[3].directionTargets = ["Segno"];
  score.masterBars[3].doubleBar = true;
  score.masterBars[4].freeTime = true;
  score.masterBars[4].directionJumps = ["DaCapo"];
  score.masterBars[5].simileMark = "single";
  score.masterBars[6].directionTargets = ["Coda"];
  score.masterBars[6].simileMark = "double";
  score.masterBars[7].alternateEndings = 2;
  score.masterBars[7].repeatClose = 3;
  score.masterBars[8].directionJumps = ["AlCoda"];
  score.masterBars[9].section = { letter: "B", name: "Solo", boxed: true };
  score.masterBars[9].anacrusis = true;
  score.masterBars[10].fermatas = [{ beatTick: 960, glyph: "above", tempoScale: 0.65 }];
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
    noteBeatWithEffects(4, 6, 0, { ghost: true, letRing: true, accent: "accent", dynamic: 5 }, { dots: 1 }),
    noteBeatWithEffects(8, 5, 2, { staccato: true, palmMute: true }),
    noteBeatWithEffects(4, 4, 2, {
      bend: {
        points: [
          { offset: 0, value: 0 },
          { offset: 60, value: 100 }
        ]
      }
    }),
    noteBeatWithEffects(4, 3, 1, { vibrato: "wide", harmonic: { type: "natural", touchFret: 12 } })
  ]);
}

function sixteenthBeamBar(): Bar {
  const effectPatches: Array<Partial<Note>> = [
    { deadNote: true },
    { hopo: true },
    { slide: "shift" },
    { trill: { secondFret: 4, speed: 16 } },
    { tremoloPicking: 16 },
    { fadeIn: true },
    { wah: "open" },
    { showStringNumber: true }
  ];
  const sixteenths = Array.from({ length: 8 }, (_, index) =>
    noteBeatWithEffects(
      16,
      guitarPattern[index % guitarPattern.length][0],
      index % 4,
      effectPatches[index] ?? {}
    )
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
  return barWithVoice([
    noteBeatWithEffects(1, 4, 7, { volumeSwell: true }, { chordId: "Em9", text: "swell" })
  ]);
}

function durationLadderBar(): Bar {
  return barWithVoice([
    noteBeat(2, 5, 5, { brush: { direction: "down", speed: 1, delay: 0 } }),
    noteBeat(4, 4, 5, { arpeggio: { direction: "up", speed: 1, delay: 0 } }),
    noteBeat(8, 3, 5, { pickstroke: "down", dynamicHairpin: { type: "cresc" } }),
    noteBeat(16, 2, 3, { tapping: true, ottava: "8va" }),
    noteBeat(16, 1, 3, { barVibrato: "wide" })
  ]);
}

function flaggedRhythmBar(): Bar {
  return barWithVoice([
    noteBeatWithEffects(32, 6, 7, { slap: true }),
    noteBeat(32, 5, 7),
    noteBeatWithEffects(32, 4, 7, { pop: true }),
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
  return barWithVoice([
    noteBeatWithEffects(4, 6, 0, { pickscrape: true }),
    noteBeatWithEffects(4, 5, 2, { deadSlapped: true }),
    noteBeat(4, 4, 2)
  ]);
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

function noteBeatWithEffects(
  duration: BeatDuration,
  string: number,
  fret: number,
  notePatch: Partial<Note>,
  options: Partial<Beat> = {}
): Beat {
  const note = createNote(string, fret);
  Object.assign(note, notePatch);
  return createBeat({
    duration,
    rest: false,
    notes: [note],
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
