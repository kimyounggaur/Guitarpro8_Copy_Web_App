import { describe, expect, it } from "vitest";
import { exportFormatFromText, importFormatFromText } from "./useFileController";

// These two pure functions are the text→format mapping the Command
// Palette's `import <text>`/`export <text>` grammar uses to pick which
// import/export handler in useFileController runs (handleImportFile /
// handleExportFile route on the resolved format) — see
// docs/ui-remaster/00-component-map.md §1, App.tsx:2176-2199 pre-refactor.
describe("importFormatFromText (file controller import format→handler mapping)", () => {
  it("maps native-score aliases to the native handler", () => {
    expect(importFormatFromText("gp")).toBe("native");
    expect(importFormatFromText("gp8")).toBe("native");
    expect(importFormatFromText("JSON")).toBe("native");
    expect(importFormatFromText("score")).toBe("native");
  });

  it("maps ASCII/MusicXML/MIDI aliases to their respective import handlers", () => {
    expect(importFormatFromText("tab")).toBe("ascii");
    expect(importFormatFromText("txt")).toBe("ascii");
    expect(importFormatFromText("xml")).toBe("musicxml");
    expect(importFormatFromText("MusicXML")).toBe("musicxml");
    expect(importFormatFromText("mid")).toBe("midi");
    expect(importFormatFromText("smf")).toBe("midi");
  });

  it("normalizes whitespace/punctuation before matching", () => {
    expect(importFormatFromText(" Music_XML ")).toBe("musicxml");
    expect(importFormatFromText("ascii-tab")).toBe("ascii");
  });

  it("returns null for blank or unrecognized text (no handler to route to)", () => {
    expect(importFormatFromText("")).toBeNull();
    expect(importFormatFromText("   ")).toBeNull();
    expect(importFormatFromText("not-a-format")).toBeNull();
  });
});

describe("exportFormatFromText (file controller export format→handler mapping)", () => {
  it("maps every supported export handler's aliases", () => {
    expect(exportFormatFromText("gp8")).toBe("native");
    expect(exportFormatFromText("tab")).toBe("ascii");
    expect(exportFormatFromText("xml")).toBe("musicxml");
    expect(exportFormatFromText("midi")).toBe("midi");
    expect(exportFormatFromText("svg")).toBe("svg");
    expect(exportFormatFromText("PNG")).toBe("png");
    expect(exportFormatFromText("pdf")).toBe("pdf");
  });

  it("returns null for a format with no export handler", () => {
    expect(exportFormatFromText("zip")).toBeNull();
    expect(exportFormatFromText("")).toBeNull();
  });
});
