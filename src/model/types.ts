export const TICKS_PER_QUARTER = 480;
export const VOICES_PER_BAR = 4;
export const MIN_STRING_COUNT = 3;
export const MAX_STRING_COUNT = 10;

export type DisplayMode =
  | "vertical-page"
  | "horizontal-page"
  | "grid"
  | "parchment"
  | "vertical-screen"
  | "horizontal-screen";
export type PlaybackEngine = "RSE" | "MIDI";
export type NotationType = "standard" | "tab" | "slash" | "numbered";
export type StaffConfig = "single" | "grand";
export type AccidentalPreference = "sharp" | "flat";
export type KeyMode = "major" | "minor";
export type BeatDuration = 1 | 2 | 4 | 8 | 16 | 32 | 64;
export type DotCount = 0 | 1 | 2;
export type Dynamic = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type Accidental =
  | "none"
  | "sharp"
  | "flat"
  | "natural"
  | "doubleSharp"
  | "doubleFlat";
export type Accent = "none" | "accent" | "heavy";
export type Vibrato = "none" | "slight" | "wide";
export type SlideType =
  | "legato"
  | "shift"
  | "in-from-below"
  | "in-from-above"
  | "out-downwards"
  | "out-upwards";
export type HarmonicType = "natural" | "artificial" | "tapped" | "pinch" | "semi";
export type Ornament = "upperMordent" | "lowerMordent" | "turn" | "invertedTurn";
export type DirectionTarget = "Coda" | "DoubleCoda" | "Segno" | "SegnoSegno" | "Fine";
export type DirectionJump =
  | "DaCapo"
  | "DalSegno"
  | "DalSegnoSegno"
  | "DaCoda"
  | "DaDoubleCoda"
  | "AlCoda"
  | "AlDoubleCoda"
  | "AlFine";
export type SimileMark = "none" | "single" | "double";
export type Ottava = "none" | "8va" | "8vb" | "15ma" | "15mb";
export type AutomationType = "tempo" | "volume" | "pan";
export type AutomationScope = "track" | "master";
export type AutomationTransition = "constant" | "progressive";
export type StemDirection = "auto" | "up" | "down";
export type BeamMode =
  | "auto"
  | "force"
  | "break"
  | "breakSecondary"
  | "forceGroup";

export interface SongInfo {
  title: string;
  artist: string;
  subtitle: string;
  album: string;
  words: string;
  music: string;
  copyright: string;
  transcriber: string;
  notice: string;
  instructions: string;
}

export interface Score {
  meta: SongInfo;
  masterBars: MasterBar[];
  tracks: Track[];
  audioTrack?: AudioTrackRef;
  stylesheet: Stylesheet;
  documentSettings: DocumentSettings;
  masterAutomations: Automation[];
}

export interface DocumentSettings {
  zoom: number;
  displayMode: DisplayMode;
  engine: PlaybackEngine;
  concertTone: boolean;
}

export interface Stylesheet {
  readonly placeholder: true;
}

export interface AudioTrackRef {
  id: string;
  name: string;
  embedded: boolean;
}

export interface TimeSignature {
  numerator: number;
  denominator: BeatDuration;
  beamingPreset: string;
}

export interface KeySignature {
  key: string;
  mode: KeyMode;
}

export interface MasterBar {
  timeSignature: TimeSignature;
  keySignature: KeySignature;
  tripletFeel: string | null;
  freeTime: boolean;
  doubleBar: boolean;
  repeatOpen: boolean;
  repeatClose: number;
  alternateEndings: number;
  section?: SectionMarker;
  directionTargets: DirectionTarget[];
  directionJumps: DirectionJump[];
  fermatas: Fermata[];
  anacrusis: boolean;
  simileMark: SimileMark;
  layout: BarLayout;
}

export interface BarLayout {
  forcedBreak: boolean;
  preventBreak: boolean;
}

export interface SectionMarker {
  letter: string;
  name: string;
  boxed: boolean;
}

export interface Fermata {
  beatTick: number;
  glyph: string;
  tempoScale: number;
}

export interface Track {
  id: string;
  name: string;
  shortName: string;
  color: string;
  icon: string;
  notationTypes: NotationType[];
  staffConfig: StaffConfig;
  tuning: Tuning;
  transpositionTonality: TranspositionTonality;
  sounds: SoundRef[];
  engine: PlaybackEngine;
  interpretation: TrackInterpretation;
  chordLibrary: ChordDiagram[];
  lyricsLines: LyricsLine[];
  automations: Automation[];
  bars: Bar[];
}

export interface Tuning {
  strings: number[];
  capo: number;
  partialCapo: PartialCapo | null;
  label: string;
  accidentalPreference: AccidentalPreference;
}

export interface PartialCapo {
  fret: number;
  strings: number[];
}

export interface TranspositionTonality {
  soundingOffset: number;
}

export interface SoundRef {
  id: string;
  name: string;
}

export interface TrackInterpretation {
  playingStyle: "Pick" | "Finger" | "Picking" | "BassSlap";
  palmMuteIntensity: number;
  accentuation: boolean;
  autoLetRing: boolean;
  autoBrush: boolean;
  stringed: boolean;
}

export interface ChordDiagram {
  id: string;
  name: string;
}

export interface LyricsLine {
  text: string;
  firstBar: number;
  visible: boolean;
}

export interface Automation {
  type: AutomationType;
  scope: AutomationScope;
  points: AutomationPoint[];
}

export interface AutomationPoint {
  tick: number;
  value: number;
  transition: AutomationTransition;
  label?: string;
}

export interface Bar {
  voices: [Voice, Voice, Voice, Voice];
}

export interface Voice {
  beats: Beat[];
}

export interface Tuplet {
  n: number;
  m: number;
  parent?: Tuplet;
}

export interface Beat {
  duration: BeatDuration;
  dots: DotCount;
  tuplet?: Tuplet;
  stemDirection: StemDirection;
  beamMode: BeamMode;
  rest: boolean;
  graceNotes: GraceNote[];
  notes: Note[];
  whammy?: BendCurve;
  brush?: StrokeEffect;
  arpeggio?: StrokeEffect;
  tapping: boolean;
  slash: boolean;
  barVibrato: Vibrato;
  pickstroke: "none" | "down" | "up";
  text?: string;
  timer?: boolean;
  chordId?: string;
  dynamicHairpin?: { type: "cresc" | "decresc" };
  ottava: Ottava;
}

export interface StrokeEffect {
  direction: "down" | "up";
  speed: number;
  delay: number;
}

export interface GraceNote {
  string: number;
  fret: number;
  onBeat: boolean;
}

export interface NoteRef {
  trackId: string;
  barIndex: number;
  voiceIndex: number;
  beatIndex: number;
  noteIndex: number;
}

export interface Note {
  string: number;
  fret: number;
  midiPitch?: number;
  tieOrigin?: NoteRef;
  tieDestination?: NoteRef;
  accidental: Accidental;
  forceAccidental: boolean;
  dynamic: Dynamic;
  ghost: boolean;
  accent: Accent;
  staccato: boolean;
  letRing: boolean;
  palmMute: boolean;
  deadNote: boolean;
  hopo: boolean;
  slide?: SlideType;
  bend?: BendCurve;
  trill?: { secondFret: number; speed: BeatDuration };
  harmonic?: { type: HarmonicType; touchFret: number };
  vibrato: Vibrato;
  tremoloPicking?: 8 | 16 | 32;
  ornament?: Ornament;
  leftFinger?: string;
  rightFinger?: string;
  fadeIn: boolean;
  fadeOut: boolean;
  volumeSwell: boolean;
  wah?: "open" | "closed";
  slap: boolean;
  pop: boolean;
  golpe?: "finger" | "thumb";
  pickscrape?: boolean;
  deadSlapped: boolean;
  showStringNumber: boolean;
}

export interface BendCurve {
  points: BendPoint[];
}

export interface BendPoint {
  offset: number;
  value: number;
}
