import { spellPitch } from "../../engine/notation/pitchSpelling";
import { barTheoreticalTicks, beatDurationTicks, tryWrittenPitch } from "../../model/derive";
import { keyFifths } from "../../model/keys";
import { noteTieIdentity } from "../../model/trackKind";
import { TICKS_PER_QUARTER, type Beat, type MasterBar, type Note, type Score, type Track, type TrackClef, type Tuplet } from "../../model/types";
import { BEAT_TYPES, escapeXml } from "./common";

export function exportMusicXml(score: Score): string {
  const parts = score.tracks.map((track, index) => partDefinition(track, index));
  const bodies = score.tracks.map((track, index) => exportPart(score, track, index));
  const creators = [
    score.meta.music && `<creator type="composer">${escapeXml(score.meta.music)}</creator>`,
    score.meta.words && `<creator type="lyricist">${escapeXml(score.meta.words)}</creator>`
  ].filter(Boolean).join("");
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<score-partwise version="4.0">',
    `  <work><work-title>${escapeXml(score.meta.title || "Untitled Score")}</work-title></work>`,
    `  <identification>${creators}<encoding><software>TabScore</software></encoding></identification>`,
    `  <part-list>${parts.join("\n")}</part-list>`,
    ...bodies,
    "</score-partwise>",
    ""
  ].join("\n");
}

function partDefinition(track: Track, index: number): string {
  const id = `P${index + 1}`;
  const header = `<part-name>${escapeXml(track.name)}</part-name><part-abbreviation>${escapeXml(track.shortName)}</part-abbreviation>`;
  if (track.kind === "percussion") {
    const notes = new Set(track.bars.flatMap((bar) => bar.voices.flatMap((voice) =>
      voice.beats.flatMap((beat) => beat.notes.flatMap(({ midiNumber }) => midiNumber === undefined ? [] : [midiNumber])))));
    const scoreInstruments = [...notes].map((number) =>
      `<score-instrument id="${id}-D${number}"><instrument-name>GM ${number}</instrument-name></score-instrument>`);
    const midiInstruments = [...notes].map((number) =>
      `<midi-instrument id="${id}-D${number}"><midi-channel>10</midi-channel><midi-unpitched>${number + 1}</midi-unpitched></midi-instrument>`);
    return `<score-part id="${id}">${header}${scoreInstruments.join("")}${midiInstruments.join("")}</score-part>`;
  }
  const program = track.sounds.find(({ id }) => /^gm-\d+$/.test(id));
  const programNumber = program && Number(program.id.slice(3));
  const midi = typeof programNumber === "number" && programNumber >= 0 && programNumber <= 127
    ? `<midi-instrument id="${id}-I1"><midi-program>${programNumber + 1}</midi-program></midi-instrument>` : "";
  return `<score-part id="${id}">${header}<score-instrument id="${id}-I1"><instrument-name>${escapeXml(track.name)}</instrument-name></score-instrument>${midi}</score-part>`;
}

function exportPart(score: Score, track: Track, trackIndex: number): string {
  const id = `P${trackIndex + 1}`;
  const tempos = score.masterAutomations.find(({ type }) => type === "tempo")?.points ?? [];
  let measureStart = 0;
  const body = score.masterBars.map((bar, barIndex) => {
    const previous = score.masterBars[barIndex - 1];
    const first = !previous;
    const end = measureStart + barTheoreticalTicks(bar);
    const attributes = makeAttributes(bar, previous, track);
    const ending = endingNumbers(bar.alternateEndings);
    const left = bar.repeatOpen || ending ? `<barline location="left">${ending ? `<ending number="${ending}" type="start"/>` : ""}${bar.repeatOpen ? '<repeat direction="forward"/>' : ""}</barline>` : "";
    const right = bar.repeatClose || ending || bar.doubleBar ? `<barline location="right">${bar.doubleBar ? "<bar-style>light-light</bar-style>" : ""}${ending ? `<ending number="${ending}" type="stop"/>` : ""}${bar.repeatClose ? `<repeat direction="backward" times="${bar.repeatClose}"/>` : ""}</barline>` : "";
    const tempo = trackIndex === 0 ? tempos.filter(({ tick }) => tick >= measureStart &&
      (tick < end || tick === end && barIndex === score.masterBars.length - 1)).map(({ tick, value }) =>
      `<direction><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${value}</per-minute></metronome></direction-type>${tick === measureStart ? "" : `<offset>${tick - measureStart}</offset>`}<sound tempo="${value}"/></direction>`
    ).join("") : "";
    const directions = trackIndex === 0 ? exportDirections(bar) : "";
    const symbols = track.bars[barIndex]?.voices ?? [];
    let activeVoiceWritten = false;
    let previousTicks = 0;
    const voices = symbols.map((voice, voiceIndex) => {
      if (voice.beats.length === 0) return "";
      const start = activeVoiceWritten && previousTicks > 0 ? `<backup><duration>${previousTicks}</duration></backup>` : "";
      activeVoiceWritten = true;
      const notes = voice.beats.map((beat, beatIndex) => exportBeat(beat, track, id, bar, barIndex, voiceIndex, beatIndex));
      previousTicks = voice.beats.reduce((sum, beat) => sum + ticksForBeat(beat), 0);
      return start + notes.join("");
    }).join("");
    measureStart = end;

    return [
      `<measure number="${barIndex + 1}"${bar.anacrusis ? ' implicit="yes"' : ""}>`,
      bar.layout.forcedBreak && !first ? '<print new-system="yes"/>' : "",
      attributes, left, tempo, directions, voices, right, "</measure>"
    ].join("");
  });
  return `  <part id="${id}">\n    ${body.join("\n    ")}\n  </part>`;
}

function makeAttributes(bar: MasterBar, previous: MasterBar | undefined, track: Track): string {
  const time = bar.timeSignature;
  const key = bar.keySignature;
  const changedTime = !previous || time.numerator !== previous.timeSignature.numerator || time.denominator !== previous.timeSignature.denominator;
  const changedKey = !previous || keyFifths(key) !== keyFifths(previous.keySignature) || key.mode !== previous.keySignature.mode;
  const attributes = [
    !previous ? `<divisions>${TICKS_PER_QUARTER}</divisions>` : "",
    changedKey ? `<key><fifths>${keyFifths(key)}</fifths><mode>${key.mode}</mode></key>` : "",
    changedTime ? `<time><beats>${time.numerator}</beats><beat-type>${time.denominator}</beat-type></time>` : ""
  ];
  if (!previous) {
    if (track.clef === "grand") attributes.push("<staves>2</staves>", clefXml("treble", 1), clefXml("bass", 2));
    else attributes.push(clefXml(track.clef));
    if (track.kind === "stringed") {
      const tuning = track.tuning.strings.map((midi, index) => {
        const { step, alter, octave } = spellPitch(midi, keyFifths(key));
        return `<staff-tuning line="${index + 1}"><tuning-step>${step}</tuning-step>${alter ? `<tuning-alter>${alter}</tuning-alter>` : ""}<tuning-octave>${octave}</tuning-octave></staff-tuning>`;
      }).join("");
      attributes.push(`<staff-details><staff-lines>${track.tuning.strings.length}</staff-lines>${tuning}${track.tuning.capo ? `<capo>${track.tuning.capo}</capo>` : ""}</staff-details>`);
    }
    if (track.transpositionTonality.soundingOffset) {
      attributes.push(`<transpose><chromatic>${track.transpositionTonality.soundingOffset}</chromatic></transpose>`);
    }
  }
  return attributes.some(Boolean) ? `<attributes>${attributes.join("")}</attributes>` : "";
}

function clefXml(clef: TrackClef, staff?: number): string {
  const prefix = `<clef${staff ? ` number="${staff}"` : ""}>`;
  if (clef === "percussion") return `${prefix}<sign>percussion</sign></clef>`;
  const bass = clef === "bass" || clef === "bass8vb";
  const octave = clef === "treble8vb" || clef === "bass8vb";
  return `${prefix}<sign>${bass ? "F" : "G"}</sign><line>${bass ? 4 : 2}</line>${octave ? "<clef-octave-change>-1</clef-octave-change>" : ""}</clef>`;
}

function ticksForBeat(beat: Beat): number {
  return Math.max(1, Math.round(beatDurationTicks(beat)));
}

function exportBeat(
  beat: Beat, track: Track, partId: string, bar: MasterBar, barIndex: number, voiceIndex: number, beatIndex: number
): string {
  const ticks = `<duration>${ticksForBeat(beat)}</duration>`;
  const rhythm = `<voice>${voiceIndex + 1}</voice><type>${BEAT_TYPES[beat.duration]}</type>${"<dot/>".repeat(beat.dots)}`;
  const timeModification = tupletXml(beat.tuplet);
  const chord = track.chordLibrary.find(({ id }) => id === beat.chordId);
  const harmony = chord ? harmonyXml(chord.name) : "";
  if (beat.rest || beat.notes.length === 0) return `${harmony}<note><rest/>${ticks}${rhythm}${timeModification}</note>`;
  const next = track.bars[barIndex]?.voices[voiceIndex].beats[beatIndex + 1] ??
    track.bars[barIndex + 1]?.voices[voiceIndex].beats[0];
  return harmony + beat.notes.map((note, index) => {
    const written = tryWrittenPitch(note, track, { concertTone: false });
    if (written === null) return "";
    const isContinued = note.tiedFromPrevious ?? false;
    const isContinuing = next && !next.rest && next.notes.some((candidate) =>
      candidate.tiedFromPrevious && noteTieIdentity(candidate, track) === noteTieIdentity(note, track));
    const stops = isContinued ? '<tie type="stop"/>' : "";
    const starts = isContinuing ? '<tie type="start"/>' : "";
    const isDrum = track.kind === "percussion";
    const pitch = isDrum ? "<unpitched><display-step>C</display-step><display-octave>5</display-octave></unpitched>"
      : pitchXml(written, keyFifths(bar.keySignature));
    const instrument = isDrum ? `<instrument id="${partId}-D${note.midiNumber}"/>` : "";
    const accidental = note.forceAccidental && note.accidental !== "none" ?
      `<accidental>${note.accidental === "doubleSharp" ? "double-sharp" : note.accidental === "doubleFlat" ? "flat-flat" : note.accidental}</accidental>` : "";
    const staff = track.clef === "grand" ? `<staff>${(note.midiPitch ?? written) < 60 ? 2 : 1}</staff>` : "";
    return `<note>${index ? "<chord/>" : ""}${pitch}${ticks}${stops}${starts}${instrument}${rhythm}${accidental}${timeModification}${staff}${notationXml(note, track, isContinued, Boolean(isContinuing))}</note>`;
  }).join("");
}

function tupletXml(tuplet: Tuplet | undefined): string {
  if (!tuplet) return "";
  let actual = 1;
  let normal = 1;
  for (let group: Tuplet | undefined = tuplet; group; group = group.parent) {
    actual *= group.n;
    normal *= group.m;
  }
  return `<time-modification><actual-notes>${actual}</actual-notes><normal-notes>${normal}</normal-notes></time-modification>`;
}

function pitchXml(midi: number, fifths: number): string {
  const pitch = spellPitch(midi, fifths);
  return `<pitch><step>${pitch.step}</step>${pitch.alter ? `<alter>${pitch.alter}</alter>` : ""}<octave>${pitch.octave}</octave></pitch>`;
}

function notationXml(note: Note, track: Track, isContinued: boolean, isContinuing: boolean): string {
  const ties = `${isContinued ? '<tied type="stop"/>' : ""}${isContinuing ? '<tied type="start"/>' : ""}`;
  const technical = track.kind === "stringed" ? [
    `<string>${note.string}</string><fret>${note.fret}</fret>`,
    note.hopo ? '<hammer-on type="start" number="1">H</hammer-on>' : "",
    note.bend?.points.length ? `<bend><bend-alter>${Math.max(...note.bend.points.map(({ value }) => value))}</bend-alter></bend>` : "",
    note.harmonic ? "<harmonic><natural/></harmonic>" : "",
    note.palmMute ? "<other-technical>palm-mute</other-technical>" : "",
    note.letRing ? "<other-technical>let-ring</other-technical>" : ""
  ].join("") : track.kind === "percussion" && note.articulation
    ? `<other-technical>drum-${escapeXml(note.articulation)}</other-technical>` : "";
  const slide = note.slide === "legato" ? '<slur type="start" number="1"/>' :
    note.slide ? '<slide type="start" number="1"/>' : "";
  const articulation = `${note.staccato ? "<staccato/>" : ""}${note.accent === "heavy" ? "<strong-accent/>" : note.accent === "accent" ? "<accent/>" : ""}`;
  const ornamentTags = { lowerMordent: "mordent", upperMordent: "inverted-mordent", turn: "turn", invertedTurn: "inverted-turn" };
  const ornaments = `${note.ornament ? `<${ornamentTags[note.ornament]}/>` : ""}${note.trill ? "<trill-mark/>" : ""}`;
  return ties || technical || slide || articulation || ornaments
    ? `<notations>${ties}${slide}${technical ? `<technical>${technical}</technical>` : ""}${articulation ? `<articulations>${articulation}</articulations>` : ""}${ornaments ? `<ornaments>${ornaments}</ornaments>` : ""}</notations>` : "";
}

function endingNumbers(mask: number): string {
  return Array.from({ length: 30 }, (_, index) => index + 1).filter((number) => mask & (1 << (number - 1))).join(",");
}

function exportDirections(bar: MasterBar): string {
  const target = {
    Segno: ['<segno/>', 'segno="segno1"'],
    SegnoSegno: ['<segno/>', 'segno="segno2"'],
    Coda: ['<coda/>', 'coda="coda1"'],
    DoubleCoda: ['<coda/>', 'coda="coda2"'],
    Fine: ['<words>Fine</words>', 'fine="yes"']
  };
  const targets = bar.directionTargets.map((name) => {
    const [markup, sound] = target[name];
    return `<direction><direction-type>${markup}</direction-type><sound ${sound}/></direction>`;
  });
  const condition = bar.directionJumps.includes("AlDoubleCoda") ? " al Double Coda" :
    bar.directionJumps.includes("AlCoda") ? " al Coda" : bar.directionJumps.includes("AlFine") ? " al Fine" : "";
  const jumps = bar.directionJumps.flatMap((name) => {
    if (name === "AlCoda" || name === "AlDoubleCoda" || name === "AlFine") return [];
    const [words, sound] = name === "DaCapo" ? [`D.C.${condition}`, 'dacapo="yes"'] :
      name === "DalSegno" ? [`D.S.${condition}`, 'dalsegno="segno1"'] :
      name === "DalSegnoSegno" ? [`D.S.S.${condition}`, 'dalsegno="segno2"'] :
      name === "DaDoubleCoda" ? ["To Double Coda", 'tocoda="coda2"'] : ["To Coda", 'tocoda="coda1"'];
    return [`<direction><direction-type><words>${words}</words></direction-type><sound ${sound}/></direction>`];
  });
  const hasPrimaryJump = bar.directionJumps.some((jump) =>
    jump === "DaCapo" || jump === "DalSegno" || jump === "DalSegnoSegno");
  if (!hasPrimaryJump && condition) {
    jumps.push(`<direction><direction-type><words>${condition.trim()}</words></direction-type></direction>`);
  }
  const section = bar.section ? `<direction><direction-type><rehearsal>${escapeXml([bar.section.letter, bar.section.name].filter(Boolean).join(" "))}</rehearsal></direction-type></direction>` : "";
  return section + targets.join("") + jumps.join("");
}

function harmonyXml(name: string): string {
  const match = /^([A-G])([#b]?)([^/]*)(?:\/([A-G])([#b]?))?$/.exec(name);
  if (!match) return "";
  const [, root, accidental, suffix, bass, bassAccidental] = match;
  const alter = (tag: "root" | "bass", mark: string) => mark ? `<${tag}-alter>${mark === "#" ? 1 : -1}</${tag}-alter>` : "";
  const kind: Record<string, string> = { "": "major", m: "minor", "7": "dominant", maj7: "major-seventh", m7: "minor-seventh", dim: "diminished", aug: "augmented", m7b5: "half-diminished", sus2: "suspended-second", sus4: "suspended-fourth" };
  return `<harmony><root><root-step>${root}</root-step>${alter("root", accidental)}</root><kind${suffix ? ` text="${escapeXml(suffix)}"` : ""}>${kind[suffix] ?? "other"}</kind>${bass ? `<bass><bass-step>${bass}</bass-step>${alter("bass", bassAccidental)}</bass>` : ""}</harmony>`;
}
