import { defaultMasterMix, defaultTrackMix } from "../model/mix";
import { z } from "zod";
import { createEmptyScore } from "../model/factory";
import { normalizeStylesheet } from "../model/stylesheet";
import type { Beat, MasterBar, Note, Score, Track, Tuplet } from "../model/types";

const duration = z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(8), z.literal(16), z.literal(32), z.literal(64)]);
const dynamic = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6), z.literal(7)]);
const engine = z.enum(["RSE", "MIDI"]);
const stem = z.enum(["auto", "up", "down"]);
const vibrato = z.enum(["none", "slight", "wide"]);
const fingeringPosition = z.enum(["left", "right", "above", "below"]);
const tabRhythmPosition = z.enum(["above", "below", "hidden"]);
const visibility = z.enum(["never", "firstPage", "everyPage"]);
const restPosition = z.enum(["auto", "above", "below"]);
const midi = z.number().int().min(0).max(127);
const finite = z.number().finite();
const offset = z.number().int().nonnegative();
const defaults = createEmptyScore();
const style = defaults.stylesheet;

const bendCurve = z.object({ points: z.array(z.object({ offset: finite, value: finite })) });
const stroke = z.object({ direction: z.enum(["down", "up"]), speed: finite, delay: finite });
const note: z.ZodType<Note> = z.object({
  string: z.number().int().default(0),
  fret: z.number().int().default(-1),
  midiPitch: midi.optional(),
  midiNumber: midi.optional(),
  articulation: z.string().optional(),
  tiedFromPrevious: z.boolean().optional(),
  accidental: z.enum(["none", "sharp", "flat", "natural", "doubleSharp", "doubleFlat"]).default("none"),
  forceAccidental: z.boolean().default(false),
  dynamic: dynamic.default(4),
  ghost: z.boolean().default(false),
  accent: z.enum(["none", "accent", "heavy"]).default("none"),
  staccato: z.boolean().default(false),
  letRing: z.boolean().default(false),
  palmMute: z.boolean().default(false),
  deadNote: z.boolean().default(false),
  hopo: z.boolean().default(false),
  slide: z.enum(["legato", "shift", "in-from-below", "in-from-above", "out-downwards", "out-upwards"]).optional(),
  bend: bendCurve.optional(),
  trill: z.object({ secondFret: z.number().int(), speed: duration }).optional(),
  harmonic: z.object({
    type: z.enum(["natural", "artificial", "tapped", "pinch", "semi"]),
    touchFret: finite
  }).optional(),
  vibrato: vibrato.default("none"),
  tremoloPicking: z.union([z.literal(8), z.literal(16), z.literal(32)]).optional(),
  ornament: z.enum(["upperMordent", "lowerMordent", "turn", "invertedTurn"]).optional(),
  leftFinger: z.string().optional(),
  rightFinger: z.string().optional(),
  fadeIn: z.boolean().default(false),
  fadeOut: z.boolean().default(false),
  volumeSwell: z.boolean().default(false),
  wah: z.enum(["open", "closed"]).optional(),
  slap: z.boolean().default(false),
  pop: z.boolean().default(false),
  golpe: z.enum(["finger", "thumb"]).optional(),
  pickscrape: z.boolean().optional(),
  deadSlapped: z.boolean().default(false),
  showStringNumber: z.boolean().default(false)
});

const tuplet: z.ZodType<Tuplet> = z.lazy(() =>
  z.object({ n: z.number().int().positive(), m: z.number().int().positive(), parent: tuplet.optional() })
);

const beat: z.ZodType<Beat> = z.object({
  duration,
  dots: z.union([z.literal(0), z.literal(1), z.literal(2)]).default(0),
  tuplet: tuplet.optional(),
  stemDirection: stem.default("auto"),
  beamMode: z.enum(["auto", "force", "break", "breakSecondary", "forceGroup"]).default("auto"),
  rest: z.boolean().default(true),
  graceNotes: z.array(z.object({ string: z.number().int(), fret: z.number().int(), onBeat: z.boolean() })).default([]),
  notes: z.array(note),
  whammy: bendCurve.optional(),
  brush: stroke.optional(),
  arpeggio: stroke.optional(),
  tapping: z.boolean().default(false),
  slash: z.boolean().default(false),
  barVibrato: vibrato.default("none"),
  pickstroke: z.enum(["none", "down", "up"]).default("none"),
  text: z.string().optional(),
  timer: z.boolean().optional(),
  chordId: z.string().optional(),
  dynamicHairpin: z.object({ type: z.enum(["cresc", "decresc"]) }).optional(),
  ottava: z.enum(["none", "8va", "8vb", "15ma", "15mb"]).default("none")
});

const voice = z.object({ beats: z.array(beat) });
const automation = z.object({
  type: z.enum(["tempo", "volume", "pan"]),
  scope: z.enum(["track", "master"]),
  points: z.array(z.object({
    tick: finite,
    value: finite,
    transition: z.enum(["constant", "progressive"]),
    label: z.string().optional()
  }))
});

export const clipboardBarSchema = z.object({ voices: z.tuple([voice, voice, voice, voice]) });

const track: z.ZodType<Track> = z.object({
  id: z.string().default(""),
  kind: z.enum(["stringed", "pitched", "percussion"]),
  clef: z.enum(["treble", "treble8vb", "bass", "bass8vb", "percussion", "grand"]),
  name: z.string(),
  shortName: z.string().default(""),
  color: z.string().default("#3b82f6"),
  icon: z.string().default("guitar"),
  notationTypes: z.array(z.enum(["standard", "tab", "slash", "numbered"])).default(["standard", "tab"]),
  staffConfig: z.enum(["single", "grand"]).default("single"),
  tuning: z.object({
    strings: z.array(midi),
    capo: z.number().int().nonnegative().default(0),
    partialCapo: z.object({ fret: z.number().int().nonnegative(), strings: z.array(offset) }).nullable().default(null),
    label: z.string().default(""),
    accidentalPreference: z.enum(["sharp", "flat"]).default("sharp")
  }),
  transpositionTonality: z.object({ soundingOffset: z.number().int() }).default({ soundingOffset: 0 }),
  sounds: z.array(z.object({ id: z.string(), name: z.string() })).default([]),
  engine: engine.default("RSE"),
  interpretation: z.object({
    playingStyle: z.enum(["Pick", "Finger", "Picking", "BassSlap"]).default("Pick"),
    palmMuteIntensity: finite.default(0),
    accentuation: z.boolean().default(false),
    autoLetRing: z.boolean().default(false),
    autoBrush: z.boolean().default(false),
    stringed: z.boolean().default(true)
  }).default({
    playingStyle: "Pick", palmMuteIntensity: 0, accentuation: false, autoLetRing: false, autoBrush: false, stringed: true
  }),
  chordLibrary: z.array(z.object({ id: z.string(), name: z.string() })).default([]),
  lyricsLines: z.array(z.object({ text: z.string(), firstBar: offset, visible: z.boolean() })).default([]),
  automations: z.array(automation).default([]),
  bars: z.array(clipboardBarSchema),
  mix: z.object({
    volume: finite.min(0).max(1),
    pan: finite.min(-1).max(1),
    mute: z.boolean(),
    solo: z.boolean(),
    eq: z.enum(["flat", "bright", "warm", "bass"]),
    effects: z.array(z.object({
      type: z.enum(["overdrive", "chorus", "flanger", "phaser", "delay", "reverb", "wah", "compressor"]),
      amount: finite.min(0).max(1),
      bypassed: z.boolean()
    })).max(6)
  }).optional()
}).transform((track) => ({ ...track, mix: track.mix ?? defaultTrackMix(track.name) }));

export const masterBarSchema: z.ZodType<MasterBar> = z.object({
  timeSignature: z.object({
    numerator: z.number().int().positive(),
    denominator: duration,
    beamingPreset: z.string().default("default")
  }),
  keySignature: z.object({ key: z.string(), mode: z.enum(["major", "minor"]) }).default({ key: "C", mode: "major" }),
  tripletFeel: z.enum(["8th", "16th"]).nullable().default(null),
  freeTime: z.boolean().default(false),
  doubleBar: z.boolean().default(false),
  repeatOpen: z.boolean().default(false),
  repeatClose: offset.default(0),
  alternateEndings: offset.default(0),
  section: z.object({ letter: z.string(), name: z.string(), boxed: z.boolean() }).optional(),
  directionTargets: z.array(z.enum(["Coda", "DoubleCoda", "Segno", "SegnoSegno", "Fine"])).default([]),
  directionJumps: z.array(z.enum([
    "DaCapo", "DalSegno", "DalSegnoSegno", "DaCoda", "DaDoubleCoda", "AlCoda", "AlDoubleCoda", "AlFine"
  ])).default([]),
  fermatas: z.array(z.object({
    beatTick: finite,
    glyph: z.string(),
    tempoScale: finite.positive().default(0.75)
  })).default([]),
  anacrusis: z.boolean().default(false),
  simileMark: z.enum(["none", "single", "double"]).default("none"),
  layout: z.object({ forcedBreak: z.boolean().default(false), preventBreak: z.boolean().default(false) })
    .default({ forcedBreak: false, preventBreak: false })
});

function primitiveShape<T extends { [Key in keyof T]: string | number | boolean }>(record: T) {
  const shape: Record<string, z.ZodType<string | number | boolean>> = {};

  for (const [name, defaultValue] of Object.entries(record)) {
    shape[name] = typeof defaultValue === "number" ? finite :
      typeof defaultValue === "boolean" ? z.boolean() : z.string();
  }

  return shape;
}

// Validate supplied style fields before applying the same defaults as the editor.
const stylesheet = z.object({
  presetName: z.enum(["Classic", "Jazz", "Rock"]).optional(),
  placeholder: z.boolean().optional(),
  page: z.object({
    ...primitiveShape(style.page),
    width: finite.positive(),
    height: finite.positive(),
    orientation: z.enum(["portrait", "landscape"])
  }).partial().optional(),
  systems: z.object({
    ...primitiveShape(style.systems),
    showTrackNames: z.enum(["none", "firstSystem", "everySystem"])
  }).partial().optional(),
  headerFooter: z.object({
    ...primitiveShape(style.headerFooter),
    headerVisibility: visibility,
    footerVisibility: visibility
  }).partial().optional(),
  texts: z.object({
    ...primitiveShape(style.texts),
    lyricsPosition: z.enum(["above", "below"]),
    barNumberFrequency: z.enum(["none", "everySystem", "everyBar"])
  }).partial().optional(),
  notation: z.object({
    ...primitiveShape(style.notation),
    tabRhythmPositionVoice1: tabRhythmPosition,
    tabRhythmPositionVoice2: tabRhythmPosition,
    tabRhythmPositionVoice3: tabRhythmPosition,
    tabRhythmPositionVoice4: tabRhythmPosition,
    stemDirectionVoice1: stem,
    stemDirectionVoice2: stem,
    restPositionVoice1: restPosition,
    restPositionVoice2: restPosition
  }).partial().optional(),
  symbols: z.object({ ...primitiveShape(style.symbols), style: z.enum(["Classic", "Jazz"]) }).partial().optional(),
  fingerings: z.object({
    ...primitiveShape(style.fingerings),
    leftHandPosition: fingeringPosition,
    rightHandPosition: fingeringPosition,
    barreDisplay: z.enum(["roman", "arabic"])
  }).partial().optional()
}).optional().transform(normalizeStylesheet);

export const scoreSchema: z.ZodType<Score> = z.object({
  meta: z.object(primitiveShape(defaults.meta)).partial().optional().transform((meta) => ({ ...defaults.meta, ...meta })),
  masterBars: z.array(masterBarSchema).min(1),
  tracks: z.array(track),
  audioTrack: z.object({ id: z.string(), name: z.string(), embedded: z.boolean() }).optional(),
  stylesheet,
  documentSettings: z.object({
    zoom: finite.transform((zoom) => Math.min(300, Math.max(25, zoom))).default(100),
    displayMode: z.enum(["vertical-page", "horizontal-page", "grid", "parchment", "vertical-screen", "horizontal-screen"])
      .default("vertical-page"),
    engine: engine.default("RSE"),
    concertTone: z.boolean().default(false)
  }).default(defaults.documentSettings),
  masterAutomations: z.array(automation).default([]),
  masterMix: z.object({
    volume: finite.min(0).max(1),
    focusPercent: finite.min(-100).max(100)
  }).default(defaultMasterMix)
});
