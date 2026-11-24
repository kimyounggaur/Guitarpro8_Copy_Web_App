import { expect, it } from "vitest";
import { layoutStaffSignature, layoutTimeSignature } from "./signatureLayout";

const style = { replaceCommonTime: true, replaceCutTime: true };
const common = { numerator: 4, denominator: 4, beamingPreset: "default" } as const;
const gMajor = { key: "G", mode: "major" } as const;

it("[A4] G major prints one sharp on the top treble line, and bass lowers it by two positions", () => {
  const options = { key: gMajor, time: common, style, staffSpace: 8, systemStart: true };
  const treble = layoutStaffSignature({ ...options, clef: "treble8vb" });
  const bass = layoutStaffSignature({ ...options, clef: "bass8vb" });

  expect(treble.glyphs.map(({ glyph, position }) => [glyph, position])).toEqual([
    ["gClef8vb", 2], ["accidentalSharp", 8], ["timeSigCommon", 4]
  ]);
  expect(bass.glyphs.map(({ glyph, position }) => [glyph, position])).toEqual([
    ["fClef8vb", 6], ["accidentalSharp", 6], ["timeSigCommon", 4]
  ]);
});

it("[A4] a mid-system change cancels the prior key and inserts the new meter digits", () => {
  const changed = layoutStaffSignature({
    clef: "treble",
    key: { key: "F", mode: "major" },
    previousKey: gMajor,
    previousTime: common,
    time: { ...common, numerator: 3 },
    systemStart: false,
    style,
    staffSpace: 8
  });

  expect(changed.glyphs.map(({ glyph, position }) => [glyph, position])).toEqual([
    ["accidentalNatural", 8], ["accidentalFlat", 4], ["timeSig3", 6], ["timeSig4", 2]
  ]);
  expect(changed.glyphs[0].x).toBeLessThan(changed.glyphs[1].x);
  expect(changed.glyphs[2].x).toBeGreaterThan(changed.glyphs[1].x);
});

it("repeats a key at the next system but displays only changed time signatures", () => {
  const options = {
    clef: "treble" as const, key: gMajor, time: common,
    previousTime: common, previousKey: gMajor, style, staffSpace: 8
  };
  expect(layoutStaffSignature({ ...options, systemStart: true }).glyphs.map(({ glyph }) => glyph)).toEqual([
    "gClef", "accidentalSharp"
  ]);
  expect(layoutStaffSignature({ ...options, systemStart: false })).toEqual({ glyphs: [], width: 0 });
});

it("center-aligns numeric rows and supports optional common/cut-time symbols", () => {
  const meter = layoutTimeSignature({ ...common, numerator: 12, denominator: 8 }, style, 8);
  expect(meter.glyphs.map(({ glyph, position }) => [glyph, position])).toEqual([
    ["timeSig1", 6], ["timeSig2", 6], ["timeSig8", 2]
  ]);
  expect(meter.glyphs[2].x).toBeGreaterThan(0);
  expect(layoutTimeSignature({ ...common, numerator: 2, denominator: 2 }, style, 8).glyphs[0].glyph).toBe("timeSigCutCommon");
  expect(layoutTimeSignature(common, { ...style, replaceCommonTime: false }, 8).glyphs).toHaveLength(2);
});
