import type {
  Bar,
  Beat,
  BeatDuration,
  Dynamic,
  MasterBar,
  Note,
  Score,
  Track,
  Voice
} from "./types";

export function createEmptyScore(): Score {
  return {
    meta: {
      title: "",
      artist: "",
      subtitle: "",
      album: "",
      words: "",
      music: "",
      copyright: "",
      transcriber: "",
      notice: "",
      instructions: ""
    },
    masterBars: [createMasterBar()],
    tracks: [],
    stylesheet: { placeholder: true },
    documentSettings: {
      zoom: 100,
      displayMode: "vertical-page",
      engine: "RSE",
      concertTone: false
    },
    masterAutomations: []
  };
}

export interface InstrumentPreset {
  name: string;
  shortName: string;
  color: string;
  icon: string;
  strings: number[];
  tuningLabel: string;
}

export const GUITAR_PRESET: InstrumentPreset = {
  name: "Guitar",
  shortName: "Gtr.",
  color: "#3b82f6",
  icon: "guitar",
  strings: [40, 45, 50, 55, 59, 64],
  tuningLabel: "E A D G B E"
};

let nextTrackId = 1;

export function createMasterBar(): MasterBar {
  return {
    timeSignature: {
      numerator: 4,
      denominator: 4,
      beamingPreset: "default"
    },
    keySignature: {
      key: "C",
      mode: "major"
    },
    tripletFeel: null,
    freeTime: false,
    doubleBar: false,
    repeatOpen: false,
    repeatClose: 0,
    alternateEndings: 0,
    directionTargets: [],
    directionJumps: [],
    fermatas: [],
    anacrusis: false,
    simileMark: "none"
  };
}

export function createTrack(
  instrumentPreset: InstrumentPreset = GUITAR_PRESET,
  masterBarCount = 1
): Track {
  const id = `track-${nextTrackId}`;
  nextTrackId += 1;

  return {
    id,
    name: instrumentPreset.name,
    shortName: instrumentPreset.shortName,
    color: instrumentPreset.color,
    icon: instrumentPreset.icon,
    notationTypes: ["standard", "tab"],
    staffConfig: "single",
    tuning: {
      strings: instrumentPreset.strings,
      capo: 0,
      partialCapo: null,
      label: instrumentPreset.tuningLabel,
      accidentalPreference: "sharp"
    },
    transpositionTonality: {
      soundingOffset: 0
    },
    sounds: [],
    engine: "RSE",
    interpretation: {
      playingStyle: "Pick",
      palmMuteIntensity: 0,
      accentuation: false,
      autoLetRing: false,
      autoBrush: false,
      stringed: true
    },
    chordLibrary: [],
    lyricsLines: [],
    automations: [],
    bars: Array.from({ length: masterBarCount }, () => createBar())
  };
}

export function createBar(): Bar {
  return {
    voices: [createVoice(), createVoice(), createVoice(), createVoice()]
  };
}

export function createVoice(): Voice {
  return {
    beats: []
  };
}

export function createBeat(options: Partial<Beat> = {}): Beat {
  return {
    duration: options.duration ?? 4,
    dots: options.dots ?? 0,
    tuplet: options.tuplet,
    rest: options.rest ?? true,
    graceNotes: options.graceNotes ?? [],
    notes: options.notes ?? [],
    whammy: options.whammy,
    brush: options.brush,
    arpeggio: options.arpeggio,
    tapping: options.tapping ?? false,
    slash: options.slash ?? false,
    barVibrato: options.barVibrato ?? "none",
    pickstroke: options.pickstroke ?? "none",
    text: options.text,
    timer: options.timer,
    chordId: options.chordId,
    dynamicHairpin: options.dynamicHairpin,
    ottava: options.ottava ?? "none"
  };
}

export function createNote(
  string = 1,
  fret = 0,
  dynamic: Dynamic = 4,
  duration: BeatDuration = 4
): Note {
  void duration;

  return {
    string,
    fret,
    accidental: "none",
    forceAccidental: false,
    dynamic,
    ghost: false,
    accent: "none",
    staccato: false,
    letRing: false,
    palmMute: false,
    deadNote: false,
    hopo: false,
    vibrato: "none",
    fadeIn: false,
    fadeOut: false,
    volumeSwell: false,
    slap: false,
    pop: false,
    deadSlapped: false,
    showStringNumber: false
  };
}
