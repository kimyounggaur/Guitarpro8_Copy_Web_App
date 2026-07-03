import { describe, expect, it } from "vitest";
import { layoutScore } from "../engine/layout/layoutScore";
import { createDemoScore } from "../model/demoScore";
import { exportAsciiTab, importAsciiTab } from "./asciiTab";
import { buildExportFileName, sanitizeFileName } from "./exportNames";
import { exportMidi, importMidi } from "./midi";
import { exportMusicXml, importMusicXml } from "./musicXml";
import { parseNativeScore, serializeNativeScore } from "./nativeScore";
import { sceneToPdf } from "./pdfExport";
import { sceneFirstPageSvg, sceneToSvgDocument } from "./vectorExport";

describe("Phase 12 file I/O", () => {
  it("round-trips the native score envelope with document settings", () => {
    const score = createDemoScore();
    score.documentSettings.zoom = 135;
    score.documentSettings.displayMode = "grid";

    const parsed = parseNativeScore(serializeNativeScore(score, new Date("2026-07-03T00:00:00.000Z")));

    expect(parsed.meta.title).toBe(score.meta.title);
    expect(parsed.tracks).toHaveLength(score.tracks.length);
    expect(parsed.documentSettings.zoom).toBe(135);
    expect(parsed.documentSettings.displayMode).toBe("grid");
  });

  it("exports and imports ASCII tablature", () => {
    const ascii = exportAsciiTab(createDemoScore());
    const imported = importAsciiTab(ascii);

    expect(ascii).toContain("# GuitarPro8 Copy ASCII Tab");
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

  it("exports SVG and PDF render artifacts from the scene graph", () => {
    const scene = layoutScore(createDemoScore());
    const svg = sceneToSvgDocument(scene);
    const firstPageSvg = sceneFirstPageSvg(scene);
    const pdf = sceneToPdf(scene);

    expect(svg).toContain("<svg");
    expect(firstPageSvg).toContain("viewBox");
    expect(String.fromCharCode(...pdf.slice(0, 4))).toBe("%PDF");
  });

  it("builds safe export filenames with Guitar Pro-style tokens", () => {
    const score = createDemoScore();
    score.meta.title = "Lead: One?";

    expect(sanitizeFileName("Lead: One?/Take*1")).toBe("Lead- One--Take-1");
    expect(buildExportFileName("%T-%n-of-%N", score, score.tracks[0], ".mid")).toBe("Lead- One--1-of-2.mid");
  });
});
