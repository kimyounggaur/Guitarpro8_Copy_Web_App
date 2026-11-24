// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { layoutScore } from "../../engine/layout/layoutScore";
import { readMusicXml } from "./import";
import { readCompressedMusicXml } from "./mxl";

export function fixture(name: string) {
  return readFileSync(resolve(`src/test/fixtures/files/musicxml/${name}.musicxml`), "utf8");
}

describe("[B13] MusicXML import", () => {
  it("accepts note attributes, finite coordinates, and inherited time", () => {
    const { score } = readMusicXml(fixture("note-attributes"));
    expect(score.masterBars.map(({ timeSignature }) => timeSignature.numerator)).toEqual([4, 4]);
    expect(score.tracks[0].bars[0].voices[0].beats[0].notes[0].midiPitch).toBe(36);
    expect(JSON.stringify(layoutScore(score))).not.toMatch(/NaN|"x":null|"y":null/);
  });

  it("groups pitch-only chords and resets a second voice with backup/forward", () => {
    const chord = readMusicXml(fixture("chord")).score.tracks[0].bars[0].voices[0].beats[0];
    expect(chord.notes.map(({ midiPitch }) => midiPitch)).toEqual([60, 64, 67]);

    const voices = readMusicXml(fixture("two-voices")).score.tracks[0].bars[0].voices;
    expect(voices[0].beats.map(({ notes }) => notes[0].midiPitch)).toEqual([64, 65]);
    expect(voices[1].beats).toMatchObject([{ duration: 4, rest: true }, { notes: [{ midiPitch: 50 }] }]);
  });

  it("reads dotted and triplet rhythms and the complete repeat and jump metadata", () => {
    const rhythm = readMusicXml(fixture("dotted-triplet")).score.tracks[0].bars[0].voices[0].beats;
    expect(rhythm).toMatchObject([{ duration: 4, dots: 1, rest: true }, { duration: 8, tuplet: { n: 3, m: 2 } }]);
    const repeats = readMusicXml(fixture("repeats-endings")).score.masterBars;
    expect(repeats).toMatchObject([{ repeatOpen: true }, { repeatClose: 2, alternateEndings: 1 }, { alternateEndings: 2 }]);
    const jumps = readMusicXml(fixture("ds-al-coda")).score.masterBars;
    expect(jumps[1].directionTargets).toEqual(["Segno"]);
    expect(jumps[3].directionJumps).toEqual(["DaCoda"]);
    expect(jumps[5].directionJumps).toEqual(["DalSegno", "AlCoda"]);
    expect(jumps[6].directionTargets).toEqual(["Coda"]);
  });

  it("reads the named compressed score and reports missing archive entries", () => {
    const container = `<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles>
      <rootfile full-path="scores/score.musicxml" media-type="application/vnd.recordare.musicxml+xml"/>
      </rootfiles></container>`;
    const bytes = zipSync({
      "META-INF/container.xml": strToU8(container),
      "scores/score.musicxml": strToU8(fixture("chord")),
      "ignored.xml": strToU8("<wrong/>")
    });
    expect(readCompressedMusicXml(bytes).score.meta.title).toBe("chord");
    expect(() => readCompressedMusicXml(zipSync({ "META-INF/container.xml": strToU8(container) }))).toThrow(/missing/);
    expect(() => readMusicXml("<score-partwise>")).toThrow(/invalid XML/);
  });

  it("counts an unsupported element without discarding its supported score", () => {
    const result = readMusicXml(fixture("chord").replace("<attributes>", "<unrecognized/><attributes>"));
    expect(result.score.tracks[0].bars[0].voices[0].beats[0].notes).toHaveLength(3);
    expect(result.warnings).toEqual(["Skipped 1 unsupported MusicXML item(s): unrecognized ×1."]);
  });
});
