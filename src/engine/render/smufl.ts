import bravura from "./smufl/bravura_metadata.json";

// Code points from the SMuFL glyph names registry.
export const SMUFL = {
  gClef: "\uE050",
  fClef: "\uE062",
  cClef: "\uE05C",
  noteheadBlack: "\uE0A4",
  restWhole: "\uE4E3",
  restHalf: "\uE4E4",
  restQuarter: "\uE4E5",
  rest8th: "\uE4E6",
  rest16th: "\uE4E7",
  rest32nd: "\uE4E8",
  rest64th: "\uE4E9",
  accidentalSharp: "\uE262",
  accidentalFlat: "\uE260",
  accidentalNatural: "\uE261",
  accidentalDoubleSharp: "\uE263",
  accidentalDoubleFlat: "\uE264",
  fermataAbove: "\uE4C0",
  gClef8vb: "\uE052",
  fClef8vb: "\uE064",
  unpitchedPercussionClef1: "\uE069",
  timeSigCommon: "\uE08A",
  timeSigCutCommon: "\uE08B",
  timeSig0: "\uE080",
  timeSig1: "\uE081",
  timeSig2: "\uE082",
  timeSig3: "\uE083",
  timeSig4: "\uE084",
  timeSig5: "\uE085",
  timeSig6: "\uE086",
  timeSig7: "\uE087",
  timeSig8: "\uE088",
  timeSig9: "\uE089",
} as const;

export const MUSIC_FONT_FAMILY = "Bravura, 'Noto Music', 'Segoe UI Symbol', serif";
export const MUSIC_FONT_SCALE = 4;
export const engravingDefaults = bravura.engravingDefaults;

export function musicGlyphBounds(name: keyof typeof SMUFL, staffSpace: number) {
  const { bBoxNE, bBoxSW } = bravura.glyphBBoxes[name];
  return {
    left: bBoxSW[0] * staffSpace,
    top: -bBoxNE[1] * staffSpace,
    width: (bBoxNE[0] - bBoxSW[0]) * staffSpace,
    height: (bBoxNE[1] - bBoxSW[1]) * staffSpace,
    advance: bravura.glyphAdvanceWidths[name] * staffSpace
  };
}
