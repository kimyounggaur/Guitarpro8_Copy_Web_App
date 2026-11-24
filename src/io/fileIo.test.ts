// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { layoutScore } from "../engine/layout/layoutScore";
import { createDemoScore } from "../model/demoScore";
import { exportAsciiTab, importAsciiTab } from "./asciiTab";
import { buildExportFileName, sanitizeFileName } from "./exportNames";
import { exportMidi, importMidi } from "./midi";
import { exportMusicXml, importMusicXml } from "./musicXml";
import { readScoreFile, writeScoreFile } from "./fileFormat";
import { sceneFirstPageSvg, sceneToSvgDocument } from "./vectorExport";

describe("Phase 12 file I/O", () => {
  it("round-trips the native score envelope with document settings", () => {
    const score = createDemoScore();
    const view = { zoom: 135, displayMode: "grid" } as const;
    const parsed = readScoreFile(writeScoreFile(score, "doc_fixture", new Date("2026-07-03T00:00:00.000Z"), view));
    expect(parsed.score.meta.title).toBe(score.meta.title);
    expect(parsed.score.tracks).toHaveLength(score.tracks.length);
    expect(parsed.view).toEqual(view);
  });

  it("exports and imports ASCII tablature", () => {
    const ascii = exportAsciiTab(createDemoScore());
    const imported = importAsciiTab(ascii);

    expect(ascii).toContain("# TabScore ASCII Tab");
    expect(imported.tracks[0].name).toBe("Guitar");
    expect(imported.tracks[0].bars[0].voices[0].beats.length).toBeGreaterThan(0);
  });

  it("exports and imports a MusicXML partwise document", () => {
    const xml = exportMusicXml(createDemoScore());
    const imported = importMusicXml(xml);

    expect(xml).toContain("<score-partwise");
    expect(xml).toContain("<technical>");
    expect(imported.tracks.length).toBeGreaterThan(0);
    expect(imported.masterBars.length).toBeGreaterThan(0);
  });

  it("exports and imports a standard MIDI file", () => {
    const midi = exportMidi(createDemoScore());
    const imported = importMidi(midi);

    expect(String.fromCharCode(...midi.slice(0, 4))).toBe("MThd");
    expect(imported.tracks.length).toBeGreaterThan(0);
    expect(imported.tracks[0].bars[0].voices[0].beats.length).toBeGreaterThan(0);
  });

  it("exports SVG render artifacts from the scene graph", () => {
    const scene = layoutScore(createDemoScore());
    const svg = sceneToSvgDocument(scene);
    const firstPageSvg = sceneFirstPageSvg(scene);

    expect(svg).toContain("<svg");
    expect(firstPageSvg).toContain("viewBox");
  });

  it("builds safe export filenames with Guitar Pro-style tokens", () => {
    const score = createDemoScore();
    score.meta.title = "Lead: One?";

    expect(sanitizeFileName("Lead: One?/Take*1")).toBe("Lead- One--Take-1");
    expect(buildExportFileName("%T-%n-of-%N", score, score.tracks[0], ".mid")).toBe("Lead- One--1-of-2.mid");
  });
});
