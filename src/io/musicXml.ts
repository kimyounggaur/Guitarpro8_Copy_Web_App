import { beatDurationTicks, noteMidiPitch } from "../model/derive";
import { createBar, createBeat, createEmptyScore, createMasterBar, createNote, createTrack } from "../model/factory";
import { TICKS_PER_QUARTER, type BeatDuration, type KeyMode, type Score, type Track } from "../model/types";

const divisions = TICKS_PER_QUARTER;
const durationTypes: Record<BeatDuration, string> = {
  1: "whole",
  2: "half",
  4: "quarter",
  8: "eighth",
  16: "16th",
  32: "32nd",
  64: "64th"
};
const keyFifths: Record<string, number> = {
  C: 0,
  G: 1,
  D: 2,
  A: 3,
  E: 4,
  B: 5,
  "F#": 6,
  "C#": 7,
  F: -1,
  Bb: -2,
  Eb: -3,
  Ab: -4,
  Db: -5,
  Gb: -6,
  Cb: -7
};
const durationByType: Record<string, BeatDuration> = {
  whole: 1,
  half: 2,
  quarter: 4,
  eighth: 8,
  "16th": 16,
  "32nd": 32,
  "64th": 64
};

export function exportMusicXml(score: Score): string {
  const title = escapeXml(score.meta.title || "Untitled Score");
  const parts = score.tracks.map((track, index) => {
    const partId = `P${index + 1}`;
    return `    <score-part id="${partId}">\n      <part-name>${escapeXml(track.name)}</part-name>\n    </score-part>`;
  });
  const body = score.tracks.map((track, index) => exportPart(score, track, `P${index + 1}`)).join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<score-partwise version="4.0">',
    `  <work><work-title>${title}</work-title></work>`,
    '  <identification><creator type="software">GuitarPro8 Copy Web App</creator></identification>',
    '  <part-list>',
    parts.join("\n"),
    '  </part-list>',
    body,
    '</score-partwise>',
    ''
  ].join("\n");
}

export function importMusicXml(xml: string): Score {
  const score = createEmptyScore();
  score.meta.title = decodeXml(textBetween(xml, "work-title") ?? "Imported MusicXML");
  const partMatches = [...xml.matchAll(/<score-part\s+id="([^"]+)"[\s\S]*?<part-name>([\s\S]*?)<\/part-name>[\s\S]*?<\/score-part>/g)];
  const partNames = new Map(partMatches.map((match) => [match[1], decodeXml(match[2])]));
  const partBlocks = [...xml.matchAll(/<part\s+id="([^"]+)"\s*>([\s\S]*?)<\/part>/g)];

  score.tracks = [];
  score.masterBars = [];

  partBlocks.forEach((partMatch, partIndex) => {
    const partId = partMatch[1];
    const partXml = partMatch[2];
    const measures = [...partXml.matchAll(/<measure(?:\s+number="([^"]+)")?[^>]*>([\s\S]*?)<\/measure>/g)];
    const track = createTrack(undefined, measures.length);
    track.id = `musicxml-track-${partIndex + 1}`;
    track.name = partNames.get(partId) ?? `MusicXML ${partIndex + 1}`;
    track.shortName = track.name.slice(0, 8);
    track.bars = measures.map((measureMatch, measureIndex) => {
      const measureXml = measureMatch[2];

      if (partIndex === 0) {
        score.masterBars.push(masterBarFromMeasure(measureXml));
      }

      const bar = createBar();
      bar.voices[0].beats = noteBlocks(measureXml).map(noteBlockToBeat);

      if (bar.voices[0].beats.length === 0) {
        bar.voices[0].beats = [createBeat({ duration: 1, rest: true })];
      }

      void measureIndex;
      return bar;
    });
    score.tracks.push(track);
  });

  if (score.tracks.length === 0) {
    throw new Error("No MusicXML parts were found.");
  }

  if (score.masterBars.length === 0) {
    score.masterBars = Array.from({ length: score.tracks[0].bars.length }, () => createMasterBar());
  }

  return score;
}

function exportPart(score: Score, track: Track, partId: string): string {
  const measures = score.masterBars.map((masterBar, barIndex) => {
    const attributes =
      barIndex === 0
        ? [
            "      <attributes>",
            `        <divisions>${divisions}</divisions>`,
            `        <key><fifths>${keyFifths[masterBar.keySignature.key] ?? 0}</fifths><mode>${masterBar.keySignature.mode}</mode></key>`,
            `        <time><beats>${masterBar.timeSignature.numerator}</beats><beat-type>${masterBar.timeSignature.denominator}</beat-type></time>`,
            "        <clef><sign>G</sign><line>2</line></clef>",
            "      </attributes>"
          ].join("\n")
        : "";
    const notes = (track.bars[barIndex]?.voices[0].beats ?? [createBeat({ duration: 1 })])
      .flatMap((beat) => beatToMusicXmlNotes(beat, track))
      .join("\n");

    return `    <measure number="${barIndex + 1}">\n${attributes}\n${notes}\n    </measure>`;
  });

  return `  <part id="${partId}">\n${measures.join("\n")}\n  </part>`;
}

function beatToMusicXmlNotes(beat: ReturnType<typeof createBeat>, track: Track): string[] {
  const duration = Math.round(beatDurationTicks(beat));
  const type = durationTypes[beat.duration] ?? "quarter";

  if (beat.rest || beat.notes.length === 0) {
    return [`      <note><rest/><duration>${duration}</duration><type>${type}</type></note>`];
  }

  return beat.notes.map((note, index) => {
    const pitch = midiToPitch(noteMidiPitch(note, track));
    const chord = index > 0 ? "<chord/>" : "";
    return [
      "      <note>",
      chord ? `        ${chord}` : "",
      "        <pitch>",
      `          <step>${pitch.step}</step>`,
      pitch.alter === 0 ? "" : `          <alter>${pitch.alter}</alter>`,
      `          <octave>${pitch.octave}</octave>`,
      "        </pitch>",
      `        <duration>${duration}</duration>`,
      `        <type>${type}</type>`,
      "        <notations><technical>",
      `          <string>${note.string}</string>`,
      `          <fret>${note.fret}</fret>`,
      "        </technical></notations>",
      "      </note>"
    ].filter(Boolean).join("\n");
  });
}

function masterBarFromMeasure(measureXml: string) {
  const masterBar = createMasterBar();
  const beats = Number(textBetween(measureXml, "beats"));
  const beatType = Number(textBetween(measureXml, "beat-type"));
  const fifths = Number(textBetween(measureXml, "fifths"));
  const mode = textBetween(measureXml, "mode") as KeyMode | null;

  if (Number.isFinite(beats) && Number.isFinite(beatType)) {
    masterBar.timeSignature = {
      numerator: beats,
      denominator: beatType as BeatDuration,
      beamingPreset: "default"
    };
  }

  if (Number.isFinite(fifths)) {
    masterBar.keySignature = { key: keyFromFifths(fifths), mode: mode === "minor" ? "minor" : "major" };
  }

  return masterBar;
}

function noteBlocks(measureXml: string): string[] {
  return [...measureXml.matchAll(/<note>([\s\S]*?)<\/note>/g)].map((match) => match[1]);
}

function noteBlockToBeat(noteXml: string) {
  const type = textBetween(noteXml, "type") ?? "quarter";
  const duration = durationByType[type] ?? durationFromXmlDuration(Number(textBetween(noteXml, "duration")));
  const rest = /<rest\s*\/?>/.test(noteXml);

  if (rest) {
    return createBeat({ duration, rest: true });
  }

  const stringNumber = Number(textBetween(noteXml, "string")) || 1;
  const fret = Number(textBetween(noteXml, "fret")) || 0;
  return createBeat({ duration, rest: false, notes: [createNote(stringNumber, fret)] });
}

function durationFromXmlDuration(duration: number): BeatDuration {
  const ratio = duration / divisions;

  if (ratio >= 4) return 1;
  if (ratio >= 2) return 2;
  if (ratio >= 1) return 4;
  if (ratio >= 0.5) return 8;
  if (ratio >= 0.25) return 16;
  if (ratio >= 0.125) return 32;
  return 64;
}

function midiToPitch(midi: number): { step: string; alter: number; octave: number } {
  const steps = [
    ["C", 0],
    ["C", 1],
    ["D", 0],
    ["D", 1],
    ["E", 0],
    ["F", 0],
    ["F", 1],
    ["G", 0],
    ["G", 1],
    ["A", 0],
    ["A", 1],
    ["B", 0]
  ] as const;
  const [step, alter] = steps[((midi % 12) + 12) % 12];
  return { step, alter, octave: Math.floor(midi / 12) - 1 };
}

function keyFromFifths(fifths: number): string {
  return Object.entries(keyFifths).find(([, value]) => value === fifths)?.[0] ?? "C";
}

function textBetween(xml: string, tagName: string): string | null {
  const match = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`).exec(xml);
  return match ? match[1].trim() : null;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function decodeXml(value: string): string {
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}
