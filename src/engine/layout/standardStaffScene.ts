import { tryWrittenPitch, type WrittenPitchOptions } from "../../model/derive";
import { DRUM_MAPPINGS } from "../../model/instruments";
import { clefPitchOffset } from "../../model/trackKind";
import type { Note, Track } from "../../model/types";
import type { AccidentalMark } from "../notation/accidentals";
import { spellPitch, type SpelledPitch } from "../notation/pitchSpelling";
import type { SignatureLayout } from "../notation/signatureLayout";
import { ledgerLines, positionToY, staffPosition, type Clef } from "../notation/staffPosition";
import { MUSIC_FONT_FAMILY, MUSIC_FONT_SCALE, musicGlyphBounds, SMUFL } from "../render/smufl";
import { NOTE_HEAD_WIDTH } from "./metrics";
import type { HitMetadata, LinePrimitive, TextPrimitive } from "./sceneGraph";

export interface StaffNotePlacement {
  position: number;
  y: number;
  writtenMidi: number;
  pitch: SpelledPitch | null;
  crossedHead: boolean;
}

export function placeStaffNote(
  note: Note,
  track: Track,
  clef: Clef,
  fifths: number,
  staffTop: number,
  staffSpace: number,
  options: WrittenPitchOptions
): StaffNotePlacement | null {
  const written = tryWrittenPitch(note, track, options);
  if (written === null) {
    return null;
  }

  if (clef === "percussion") {
    const drum = DRUM_MAPPINGS.find((entry) => entry.midiNumber === note.midiNumber);
    const position = drum?.staffLine ?? 4;
    const crossedHead = Boolean(drum?.id.includes("hat") || drum?.id === "crash" || drum?.id === "ride" || drum?.id === "china");
    return { position, y: positionToY(position, staffTop, staffSpace), writtenMidi: written, pitch: null, crossedHead };
  }

  const writtenMidi = written + clefPitchOffset(clef) - clefPitchOffset(track.clef);
  const preference = note.accidental === "flat" || note.accidental === "doubleFlat"
    ? "flat"
    : note.accidental === "sharp" || note.accidental === "doubleSharp" ? "sharp" : track.tuning.accidentalPreference;
  const pitch = spellPitch(writtenMidi, fifths, preference);
  const position = staffPosition(pitch, clef);
  return { position, y: positionToY(position, staffTop, staffSpace), writtenMidi, pitch, crossedHead: false };
}

export function staffLedgerPrimitives(
  id: string, position: number, x: number, staffTop: number, staffSpace: number, color: string
): LinePrimitive[] {
  const halfWidth = NOTE_HEAD_WIDTH * 0.8;
  return ledgerLines(position).map((ledgerPosition) => {
    const y = positionToY(ledgerPosition, staffTop, staffSpace);
    return {
      id: `${id}-ledger-${ledgerPosition}`, type: "line", x1: x - halfWidth, y1: y,
      x2: x + halfWidth, y2: y, stroke: color, strokeWidth: 1, pointerEvents: "none"
    };
  });
}

export function staffSignaturePrimitives(
  id: string,
  signature: SignatureLayout,
  x: number,
  staffTop: number,
  staffSpace: number,
  ref: HitMetadata["ref"]
): TextPrimitive[] {
  return signature.glyphs.map((item, index) => {
    const kind = item.glyph.startsWith("timeSig") ? "timeSig"
      : item.glyph.startsWith("accidental") ? "keySig" : "clef";
    return musicGlyph(`${id}-${kind}-${index}`, item.glyph, x + item.x,
      positionToY(item.position, staffTop, staffSpace), staffSpace, "#111827", kind, ref);
  });
}

export function staffAccidentalPrimitive(
  id: string,
  mark: AccidentalMark,
  noteX: number,
  noteY: number,
  staffSpace: number,
  color: string,
  ref: HitMetadata["ref"]
): TextPrimitive {
  const width = musicGlyphBounds(mark.glyph, staffSpace).advance;
  const x = noteX - NOTE_HEAD_WIDTH / 2 - 3 - width - (staffSpace * 1.4) * mark.column;
  return musicGlyph(id, mark.glyph, x, noteY, staffSpace, color, "effect", ref);
}

function musicGlyph(
  id: string, glyph: keyof typeof SMUFL, x: number, y: number, staffSpace: number,
  fill: string, kind: HitMetadata["kind"], ref: HitMetadata["ref"]
): TextPrimitive {
  const bounds = musicGlyphBounds(glyph, staffSpace);
  return {
    id, type: "text", x, y, text: SMUFL[glyph], fill,
    fontSize: staffSpace * MUSIC_FONT_SCALE, fontFamily: MUSIC_FONT_FAMILY, anchor: "start",
    hit: { kind, ref, bbox: { x: x + bounds.left, y: y + bounds.top, width: bounds.width, height: bounds.height } }
  };
}
