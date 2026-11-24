import { chooseFretForPitch } from "../../engine/notation/staffInput";
import { barTheoreticalTicks, beatDurationTicks } from "../../model/derive";
import { createBar, createBeat, createEmptyScore, createMasterBar, createNote, createTrack } from "../../model/factory";
import { DRUM_MAPPINGS, INSTRUMENT_DEFINITIONS, instrumentById } from "../../model/instruments";
import { keyFromFifths } from "../../model/keys";
import { normalizeTies } from "../../model/ties";
import { clefPitchOffset, frettedMidiPitch, isMidiPitch } from "../../model/trackKind";
import type { AutomationPoint, Bar, Beat, MasterBar, Note, Score, Track, TrackClef } from "../../model/types";
import { element, elements, isDuration, numeric, parseRhythm, readPitch, silence, text, toTicks, xmlRoot } from "./common";
import { readBarline, readDirection } from "./directions";

export interface MusicXmlImportResult {
  score: Score;
  warnings: string[];
}

interface PartInfo {
  track: Track;
  drumNotes: Map<string, number>;
  measures: Element[];
}

interface PartState {
  divisions: number;
  transpose: number;
  xmlClefs: Map<string, TrackClef>;
  voices: Map<string, number>;
  previousTieStrings: Map<string, number>;
  barsWritten: number;
  ending: number;
}

type Unsupported = (item: string) => void;

export function importMusicXml(xml: string): Score {
  return readMusicXml(xml).score;
}

export function readMusicXml(xml: string): MusicXmlImportResult {
  const root = xmlRoot(xml);
  if (root.localName !== "score-partwise") {
    throw new Error("Choose a MusicXML score-partwise document.");
  }
  const definitions = new Map(elements(element(root, "part-list"), "score-part")
    .map((definition) => [definition.getAttribute("id"), definition]));
  const parts = elements(root, "part")
    .map((part, index) => preparePart(part, definitions.get(part.getAttribute("id")) ?? null, index));

  if (parts.length === 0 || parts.every((part) => part.measures.length === 0)) {
    throw new Error("The MusicXML score does not contain any measures.");
  }

  const score = createEmptyScore();
  const creators = elements(element(root, "identification"), "creator");
  score.meta.title = text(element(root, "work"), "work-title") ?? text(root, "movement-title") ?? "Imported MusicXML";
  score.meta.music = creators.find((creator) => creator.getAttribute("type") === "composer")?.textContent?.trim() ?? "";
  score.meta.words = creators.find((creator) => creator.getAttribute("type") === "lyricist")?.textContent?.trim() ?? "";
  score.tracks = parts.map(({ track }) => track);
  score.masterBars = [];
  const tempos = new Map<number, AutomationPoint>();
  const unsupported = new Map<string, number>();
  const skipped: Unsupported = (item) => unsupported.set(item, (unsupported.get(item) ?? 0) + 1);

  parts.forEach((part) => readPart(part, score, tempos, skipped));
  for (const track of score.tracks) {
    while (track.bars.length < score.masterBars.length) track.bars.push(createBar());
  }
  if (tempos.size > 0) {
    score.masterAutomations.push({
      type: "tempo", scope: "master", points: [...tempos.values()].sort((a, b) => a.tick - b.tick)
    });
  }
  for (const _issue of normalizeTies(score)) skipped("tie without a preceding note");
  const skippedCount = [...unsupported.values()].reduce((sum, count) => sum + count, 0);
  const details = [...unsupported].map(([item, count]) => `${item} ×${count}`).join(", ");
  return {
    score,
    warnings: skippedCount ? [`Skipped ${skippedCount} unsupported MusicXML item(s): ${details}.`] : []
  };
}

function preparePart(part: Element, definition: Element | null, index: number): PartInfo {
  const measures = elements(part, "measure");
  const name = text(definition, "part-name") ?? `MusicXML ${index + 1}`;
  const midiInstruments = elements(definition, "midi-instrument");
  const program = numeric(midiInstruments[0] ?? null, "midi-program");
  const drumNotes = new Map<string, number>();
  for (const item of midiInstruments) {
    const id = item.getAttribute("id");
    const note = numeric(item, "midi-unpitched");
    if (id && note !== null && isMidiPitch(note - 1)) drumNotes.set(id, note - 1);
  }
  const descendants = Array.from(part.getElementsByTagNameNS("*", "*"));
  const has = (localName: string) => descendants.some((node) => node.localName === localName);
  const detailNodes = descendants.filter((node) => node.localName === "staff-details");
  const staffDetails = detailNodes.find((node) => element(node, "staff-tuning")) ?? detailNodes[0];
  const explicitTuning = elements(staffDetails ?? null, "staff-tuning")
    .map((tuning) => ({ line: Number(tuning.getAttribute("line")), pitch: readPitch(tuning, "tuning-") }))
    .filter((row): row is { line: number; pitch: number } => row.line > 0 && isMidiPitch(row.pitch))
    .sort((a, b) => a.line - b.line)
    .map(({ pitch }) => pitch);
  const stringCount = numeric(staffDetails ?? null, "staff-lines");
  const drum = drumNotes.size > 0 || midiInstruments.some((item) => numeric(item, "midi-channel") === 10) || has("unpitched");
  const frettedProgram = program !== null && program >= 25 && program <= 40;
  const fretted = !drum && (explicitTuning.length > 0 || has("string") || frettedProgram || /guitar|bass|ukulele|banjo|mandolin/i.test(name));
  const definitionForProgram = program === null ? undefined : INSTRUMENT_DEFINITIONS.find((instrument) =>
    instrument.gmProgram === program - 1 && instrument.category !== "Drums"
  );
  const preset = drum ? instrumentById("drums") : definitionForProgram;
  const keyboard = !fretted && (preset?.staffConfig === "grand" || /piano|keyboard/i.test(name) ||
    descendants.some((node) => node.localName === "staves" && Number(node.textContent) === 2));
  const strings = explicitTuning.length > 0 ? explicitTuning : standardTuning(stringCount, name, preset?.tuning);
  const track = createTrack({
    name,
    shortName: text(definition, "part-abbreviation") ?? name,
    icon: drum ? "drums" : fretted ? (/bass/i.test(name) ||
      (strings.length === 4 || strings.length === 5) && !/ukulele|banjo|mandolin|violin|viola|cello/i.test(name) ? "bass" : "guitar") :
      keyboard ? "piano" : preset?.icon ?? "orchestra",
    color: preset?.color ?? "#3b82f6",
    strings,
    tuningLabel: preset?.tuningLabel ?? "",
    notationTypes: fretted ? ["standard", "tab"] : ["standard"],
    staffConfig: keyboard ? "grand" : "single",
    kind: drum ? "percussion" : fretted ? "stringed" : "pitched",
    gmProgram: program !== null && isMidiPitch(program - 1) ? program - 1 : undefined
  }, 0);
  const capo = numeric(staffDetails ?? null, "capo");
  if (capo !== null && Number.isInteger(capo) && capo >= 0) track.tuning.capo = capo;
  return { track, measures, drumNotes };
}

function standardTuning(count: number | null, name: string, preset?: number[]): number[] {
  if (count === 4 || /bass/i.test(name) && count === null) return [28, 33, 38, 43];
  if (count === 5) return [23, 28, 33, 38, 43];
  if (count === 7) return [31, 40, 45, 50, 55, 59, 64];
  if (count && Number.isInteger(count) && count >= 3 && count <= 10) {
    if (preset?.length === count) return [...preset];
    const guitar = [40, 45, 50, 55, 59, 64];
    while (guitar.length < count) guitar.unshift(guitar[0] - 5);
    return guitar.slice(-count);
  }
  return preset ? [...preset] : [40, 45, 50, 55, 59, 64];
}

function readPart(info: PartInfo, score: Score, tempos: Map<number, AutomationPoint>, skipped: Unsupported): void {
  const state: PartState = {
    divisions: 1, transpose: 0, xmlClefs: new Map(), voices: new Map(), previousTieStrings: new Map(),
    barsWritten: 0, ending: 0
  };
  let songTick = 0;

  info.measures.forEach((measure, index) => {
    const previous = score.masterBars[index - 1];
    const shared = score.masterBars[index];
    const bar = createMasterBar();
    bar.timeSignature = shared?.timeSignature ?? previous?.timeSignature ?? bar.timeSignature;
    bar.keySignature = shared?.keySignature ?? previous?.keySignature ?? bar.keySignature;
    bar.alternateEndings = shared?.alternateEndings ?? state.ending;
    const parsed = readMeasure(measure, bar, info, state, songTick, tempos, skipped);
    if (!shared) score.masterBars.push(bar);
    else {
      if (shared.timeSignature.numerator !== bar.timeSignature.numerator ||
          shared.timeSignature.denominator !== bar.timeSignature.denominator) skipped("independent part time signature");
      shared.directionTargets = [...new Set([...shared.directionTargets, ...bar.directionTargets])];
      shared.directionJumps = [...new Set([...shared.directionJumps, ...bar.directionJumps])];
      shared.repeatOpen ||= bar.repeatOpen;
      shared.repeatClose ||= bar.repeatClose;
      shared.alternateEndings ||= bar.alternateEndings;
    }
    info.track.bars.push(parsed);
    songTick += barTheoreticalTicks(shared ?? bar);
    state.barsWritten++;
  });
}

function readMeasure(
  measure: Element, bar: MasterBar, info: PartInfo, state: PartState, songTick: number,
  tempos: Map<number, AutomationPoint>, skipped: Unsupported
): Bar {
  const voices = Array.from({ length: 4 }, () => new Map<number, Beat>());
  const startByVoice = new Map<number, number>();
  const harmonies = new Map<number, string>();
  let cursor = 0;

  for (const node of elements(measure)) {
    switch (node.localName) {
      case "attributes":
        readAttributes(node, bar, info.track, state, skipped);
        break;
      case "note": {
        const voice = voiceIndex(text(node, "voice") ?? "1", state, skipped);
        if (element(node, "grace")) {
          skipped("grace note");
          break;
        }
        const [rhythm, ticks] = parseRhythm(node, state.divisions);
        const follows = Boolean(element(node, "chord"));
        const start = follows ? startByVoice.get(voice) ?? cursor : cursor;
        if (!follows) {
          startByVoice.set(voice, start);
          cursor += ticks;
        }

        const existing = voices[voice].get(start);
        const beat = existing ?? createBeat(rhythm);
        if (!element(node, "rest")) {
          const note = readNote(node, info, state, voice, beat.notes, skipped);
          if (note) {
            beat.notes.push(note);
            beat.rest = false;
          }
        }
        if (existing && beatDurationTicks(createBeat(rhythm)) !== beatDurationTicks(beat)) {
          skipped("different durations inside one chord");
        }
        voices[voice].set(start, beat);
        break;
      }
      case "backup":
      case "forward": {
        const duration = toTicks(numeric(node, "duration"), state.divisions);
        if (duration !== null && duration >= 0) {
          cursor = Math.max(0, cursor + (node.localName === "backup" ? -duration : duration));
        } else skipped("invalid voice offset");
        break;
      }
      case "barline":
        state.ending = readBarline(node, bar, state.ending);
        break;
      case "direction": {
        const timing = readDirection(node, bar, state.divisions, cursor);
        if (timing) {
          const tick = Math.max(0, songTick + timing.tick);
          tempos.set(tick, { tick, value: timing.bpm, transition: "constant" });
        }
        break;
      }
      case "harmony": {
        const name = readHarmony(node);
        if (name) harmonies.set(cursor + (toTicks(numeric(node, "offset"), state.divisions) ?? 0), name);
        else skipped("harmony");
        break;
      }
      case "print":
        bar.layout.forcedBreak ||= node.getAttribute("new-system") === "yes" || node.getAttribute("new-page") === "yes";
        break;
      default:
        skipped(node.localName);
    }
  }

  if (measure.getAttribute("implicit") === "yes") bar.anacrusis = true;

  const output = createBar();
  for (const [voice, entries] of voices.entries()) {
    let tick = 0;
    for (const [start, beat] of [...entries].sort(([left], [right]) => left - right)) {
      if (start < tick) {
        skipped("overlapping notes within one voice");
        continue;
      }
      if (start > tick) output.voices[voice].beats.push(...silence(start - tick));
      const harmony = harmonies.get(start);
      if (harmony && voice === 0) {
        let chord = info.track.chordLibrary.find((entry) => entry.name === harmony);
        if (!chord) {
          chord = { id: `xml-chord-${info.track.chordLibrary.length + 1}`, name: harmony };
          info.track.chordLibrary.push(chord);
        }
        beat.chordId = chord.id;
      }
      output.voices[voice].beats.push(beat);
      tick = start + Math.round(beatDurationTicks(beat));
    }
  }
  return output;
}

function readAttributes(node: Element, bar: MasterBar, track: Track, state: PartState, skipped: Unsupported): void {
  const divisions = numeric(node, "divisions");
  if (divisions !== null && divisions > 0 && Number.isInteger(divisions)) state.divisions = divisions;
  const time = element(node, "time");
  const numerator = numeric(time, "beats");
  const denominator = numeric(time, "beat-type");
  if (numerator !== null && numerator > 0 && Number.isInteger(numerator) && isDuration(denominator)) {
    bar.timeSignature = { numerator, denominator, beamingPreset: "default" };
  } else if (time) skipped("time signature");
  const key = element(node, "key");
  const fifths = numeric(key, "fifths");
  if (fifths !== null) bar.keySignature = keyFromFifths(fifths, text(key, "mode") === "minor" ? "minor" : "major");
  else if (key) skipped("key signature");
  const transpose = element(node, "transpose");
  if (transpose) {
    state.transpose = (numeric(transpose, "chromatic") ?? 0) + 12 * (numeric(transpose, "octave-change") ?? 0);
    if (state.barsWritten === 0) track.transpositionTonality.soundingOffset = state.transpose;
    else if (track.transpositionTonality.soundingOffset !== state.transpose) skipped("mid-part transposition change");
  }
  for (const clef of elements(node, "clef")) {
    const sign = text(clef, "sign");
    const octave = numeric(clef, "clef-octave-change");
    if (sign === "TAB") continue;
    const type: TrackClef | null = sign === "G" ? octave === -1 ? "treble8vb" : "treble" :
      sign === "F" ? octave === -1 ? "bass8vb" : "bass" :
        sign === "percussion" ? "percussion" : null;
    if (!type) {
      skipped("clef");
      continue;
    }
    const staff = clef.getAttribute("number") ?? "1";
    state.xmlClefs.set(staff, type);
    if (state.barsWritten === 0 && track.clef !== "grand" && staff === "1") track.clef = type;
    else if (state.barsWritten > 0 && track.clef !== "grand" && track.clef !== type) skipped("mid-part clef change");
  }
}

function voiceIndex(name: string, state: PartState, skipped: Unsupported): number {
  const previous = state.voices.get(name);
  if (previous !== undefined) return previous;
  const index = Math.min(3, state.voices.size);
  if (state.voices.size >= 4) skipped("voice beyond the four stored voices");
  state.voices.set(name, index);
  return index;
}

function readNote(
  node: Element, info: PartInfo, state: PartState, voice: number, occupied: Note[], skipped: Unsupported
): Note | null {
  const notations = elements(node, "notations");
  const technical = notations.map((group) => element(group, "technical")).find(Boolean) ?? null;
  const written = readPitch(element(node, "pitch"));
  const staff = text(node, "staff") ?? "1";
  const baseMidi = written === null ? null :
    written + state.transpose - clefPitchOffset(state.xmlClefs.get(staff) ?? "treble");
  const tieMarkers = [...elements(node, "tie"), ...notations.flatMap((group) => elements(group, "tied"))];
  const tieStart = tieMarkers.some((tie) => tie.getAttribute("type") === "start" || tie.getAttribute("type") === "continue");
  const tieEnd = tieMarkers.some((tie) => tie.getAttribute("type") === "stop" || tie.getAttribute("type") === "continue");

  let note: Note;
  if (info.track.kind === "percussion") {
    const instrument = element(node, "instrument")?.getAttribute("id");
    const fallback = readPitch(element(node, "unpitched"), "display-");
    const midi = (instrument ? info.drumNotes.get(instrument) : undefined) ??
      (isMidiPitch(baseMidi) ? baseMidi : undefined) ??
      DRUM_MAPPINGS.find(({ midiNumber }) => midiNumber === fallback)?.midiNumber;
    if (midi === undefined) {
      skipped("unmapped percussion pitch");
      return null;
    }
    note = { ...createNote(0, -1), midiNumber: midi, articulation: technicalText(technical, "drum-") ?? "normal" };
  } else if (info.track.kind === "pitched") {
    if (!isMidiPitch(baseMidi)) {
      skipped("invalid pitch");
      return null;
    }
    note = { ...createNote(0, -1), midiPitch: baseMidi };
  } else {
    const string = numeric(technical, "string");
    const fret = numeric(technical, "fret");
    const used = new Set(occupied.map((played) => played.string));
    const tieKey = `${voice}:${baseMidi}`;
    const previousString = state.previousTieStrings.get(tieKey);
    const position = string !== null && fret !== null && fret <= 24 && !used.has(string) &&
      frettedMidiPitch(info.track.tuning, string, fret) !== null ? { string, fret } :
      baseMidi === null ? null : chooseFretForPitch(info.track, baseMidi, { occupiedStrings: used, preferredString: previousString });
    if (!position) {
      skipped("pitch outside the stringed instrument range");
      return null;
    }
    if (tieStart) state.previousTieStrings.set(tieKey, position.string);
    else if (tieEnd) state.previousTieStrings.delete(tieKey);
    note = createNote(position.string, position.fret);
  }
  if (tieEnd) note.tiedFromPrevious = true;
  const accidental = text(node, "accidental");
  if (accidental === "sharp" || accidental === "flat" || accidental === "natural" ||
      accidental === "double-sharp" || accidental === "flat-flat") {
    note.accidental = accidental === "double-sharp" ? "doubleSharp" : accidental === "flat-flat" ? "doubleFlat" : accidental;
    note.forceAccidental = true;
  } else if (accidental) skipped("accidental");
  readEffects(notations, technical, note, skipped);

  for (const item of elements(node)) {
    if (!["pitch", "unpitched", "rest", "chord", "duration", "type", "dot", "time-modification", "voice",
      "staff", "instrument", "notations", "tie", "stem", "beam", "accidental"].includes(item.localName)) skipped(item.localName);
  }
  return note;
}

function technicalText(technical: Element | null, prefix: string): string | undefined {
  return elements(technical, "other-technical").map((node) => node.textContent?.trim() ?? "")
    .find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function readEffects(notations: Element[], technical: Element | null, note: Note, skipped: Unsupported): void {
  note.hopo = Boolean(element(technical, "hammer-on") || element(technical, "pull-off"));
  note.palmMute = technicalText(technical, "palm-") === "mute";
  note.letRing = technicalText(technical, "let-") === "ring";
  const bend = numeric(element(technical, "bend"), "bend-alter");
  if (bend !== null) note.bend = { points: [{ offset: 0, value: 0 }, { offset: 60, value: bend }] };
  if (element(technical, "harmonic")) note.harmonic = { type: "natural", touchFret: Math.max(0, note.fret) };
  const slide = notations.map((group) => element(group, "slide") ?? element(group, "glissando")).find(Boolean);
  if (slide?.getAttribute("type") !== "stop" && slide) note.slide = "shift";
  const groups = notations.flatMap((group) => elements(group));
  for (const group of groups) {
    if (group.localName === "articulations") {
      note.staccato = Boolean(element(group, "staccato"));
      if (element(group, "strong-accent")) note.accent = "heavy";
      else if (element(group, "accent")) note.accent = "accent";
    } else if (group.localName === "ornaments") {
      if (element(group, "mordent")) note.ornament = "lowerMordent";
      else if (element(group, "inverted-mordent")) note.ornament = "upperMordent";
      else if (element(group, "turn")) note.ornament = "turn";
      else if (element(group, "inverted-turn")) note.ornament = "invertedTurn";
      if (element(group, "trill-mark")) note.trill = { secondFret: note.fret + 2, speed: 32 };
    } else if (group.localName === "slur") {
      if (group.getAttribute("type") !== "stop") note.slide ??= "legato";
    } else if (!["technical", "tied", "slide", "glissando"].includes(group.localName)) skipped(group.localName);
  }
}

function readHarmony(node: Element): string | null {
  const root = element(node, "root");
  const step = text(root, "root-step");
  if (!step) return null;
  const accidental = (value: number | null) => value === 1 ? "#" : value === -1 ? "b" : "";
  const name = element(node, "kind");
  const kind = name?.textContent?.trim() ?? "";
  const suffixes: Record<string, string> = {
    major: "", minor: "m", dominant: "7", "major-seventh": "maj7", "minor-seventh": "m7",
    diminished: "dim", augmented: "aug", "half-diminished": "m7b5", "suspended-second": "sus2",
    "suspended-fourth": "sus4"
  };
  const suffix = name?.getAttribute("text") ?? suffixes[kind] ?? "";
  const bass = element(node, "bass");
  const bassNote = text(bass, "bass-step");
  return `${step}${accidental(numeric(root, "root-alter"))}${suffix}${bassNote ? `/${bassNote}${accidental(numeric(bass, "bass-alter"))}` : ""}`;
}
