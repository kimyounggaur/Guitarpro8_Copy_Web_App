import { keyFifths } from "../../model/keys";
import type { KeySignature, Stylesheet, TimeSignature } from "../../model/types";
import { musicGlyphBounds, type SMUFL } from "../render/smufl";
import { ACCIDENTAL_GLYPHS } from "./accidentals";
import { FLAT_ORDER, keyAlteration, SHARP_ORDER } from "./pitchSpelling";
import type { Clef } from "./staffPosition";

type GlyphName = keyof typeof SMUFL;
type SignatureStyle = Pick<Stylesheet["notation"], "replaceCommonTime" | "replaceCutTime">;

export interface SignatureGlyph {
  glyph: GlyphName;
  /** Offset of the left origin from the beginning of the signature. */
  x: number;
  position: number;
}

export interface SignatureLayout {
  glyphs: SignatureGlyph[];
  width: number;
}

interface SignatureOptions {
  clef: Clef;
  key: KeySignature;
  time: TimeSignature;
  previousKey?: KeySignature;
  previousTime?: TimeSignature;
  systemStart: boolean;
  style: SignatureStyle;
  staffSpace: number;
}

const CLEFS = {
  treble: { glyph: "gClef", position: 2 },
  treble8vb: { glyph: "gClef8vb", position: 2 },
  bass: { glyph: "fClef", position: 6 },
  bass8vb: { glyph: "fClef8vb", position: 6 },
  percussion: { glyph: "unpitchedPercussionClef1", position: 4 }
} as const;

const SHARP_POSITIONS = [8, 5, 9, 6, 3, 7, 4];
const FLAT_POSITIONS = [4, 7, 3, 6, 2, 5, 1];

export function layoutStaffSignature(opts: SignatureOptions): SignatureLayout {
  const { clef, key, time, previousKey, previousTime, systemStart, style, staffSpace } = opts;
  const glyphs: SignatureGlyph[] = [];
  const betweenGroups = staffSpace * 0.75;
  let x = 0;

  if (systemStart) {
    const symbol = CLEFS[clef];
    glyphs.push({ ...symbol, x });
    x += glyphWidth(symbol.glyph, staffSpace) + betweenGroups;
  }
  const fifths = keyFifths(key);
  const previousFifths = previousKey ? keyFifths(previousKey) : 0;
  if (clef !== "percussion" && (systemStart || fifths !== previousFifths)) {
    const clefOffset = clef === "bass" || clef === "bass8vb" ? -2 : 0;
    const previousPositions = previousFifths >= 0 ? SHARP_POSITIONS : FLAT_POSITIONS;
    const previousOrder = previousFifths >= 0 ? SHARP_ORDER : FLAT_ORDER;
    const cancellations = systemStart ? [] : previousOrder.slice(0, Math.abs(previousFifths)).flatMap((step, index) =>
      keyAlteration(step, fifths) === keyAlteration(step, previousFifths)
        ? []
        : [{ glyph: ACCIDENTAL_GLYPHS[0], position: previousPositions[index] + clefOffset }]
    );
    const positions = fifths >= 0 ? SHARP_POSITIONS : FLAT_POSITIONS;
    const additions = positions.slice(0, Math.abs(fifths)).map((position) => ({
      glyph: ACCIDENTAL_GLYPHS[fifths >= 0 ? 1 : -1],
      position: position + clefOffset
    }));
    for (const symbol of [...cancellations, ...additions]) {
      glyphs.push({ ...symbol, x });
      x += glyphWidth(symbol.glyph, staffSpace) + staffSpace * 0.15;
    }
    if (cancellations.length + additions.length > 0) {
      x += betweenGroups;
    }
  }
  if (!previousTime || previousTime.numerator !== time.numerator || previousTime.denominator !== time.denominator) {
    const timeLayout = layoutTimeSignature(time, style, staffSpace);
    glyphs.push(...timeLayout.glyphs.map((symbol) => ({ ...symbol, x: symbol.x + x })));
    x += timeLayout.width + betweenGroups;
  }
  return { glyphs, width: x };
}

export function layoutTimeSignature(time: TimeSignature, style: SignatureStyle, staffSpace: number): SignatureLayout {
  const { numerator, denominator } = time;
  const commonGlyph = numerator === 4 && denominator === 4 && style.replaceCommonTime
    ? "timeSigCommon"
    : numerator === 2 && denominator === 2 && style.replaceCutTime ? "timeSigCutCommon" : null;
  if (commonGlyph) {
    return { glyphs: [{ glyph: commonGlyph, position: 4, x: 0 }], width: glyphWidth(commonGlyph, staffSpace) };
  }

  const digits = ["timeSig0", "timeSig1", "timeSig2", "timeSig3", "timeSig4", "timeSig5", "timeSig6", "timeSig7", "timeSig8", "timeSig9"] as const;
  const rows = [numerator, denominator].map((value, index) => {
    let width = 0;
    const glyphs = [...String(value)].map((digit) => {
      const glyph = digits[Number(digit)];
      const entry = { glyph, x: width, position: index === 0 ? 6 : 2 };
      width += glyphWidth(glyph, staffSpace);
      return entry;
    });
    return { glyphs, width };
  });
  const width = Math.max(...rows.map((row) => row.width));
  return {
    width,
    glyphs: rows.flatMap((row) => row.glyphs.map((symbol) => ({ ...symbol, x: symbol.x + (width - row.width) / 2 })))
  };
}

function glyphWidth(glyph: GlyphName, staffSpace: number): number {
  return musicGlyphBounds(glyph, staffSpace).advance;
}
