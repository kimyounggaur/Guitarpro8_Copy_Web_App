import { describe, expect, it } from "vitest";
import { createDemoScore } from "../model/demoScore";
import { createBeat, createEmptyScore, createMasterBar, createNote, createTrack } from "../model/factory";
import { APP_FILE_FORMAT, CURRENT_SCHEMA_VERSION, readScoreFile, writeScoreFile } from "./fileFormat";
import v1Demo from "../test/fixtures/files/v1-demo.json";
import { NATIVE_SCORE_FORMAT, serializeNativeScore } from "./nativeScore";

describe("TabScore native files", () => {
  it("round-trips the demo and a stable document ID through a compact v2 envelope", () => {
    const score = createDemoScore();
    const saveTime = new Date("2026-11-23T03:00:00.000Z");
    const payload = writeScoreFile(score, "doc_fixture", saveTime);
    const migrated = readScoreFile(payload);

    expect(payload).not.toContain("\n");
    expect(JSON.parse(payload)).toMatchObject({ format: APP_FILE_FORMAT, schemaVersion: CURRENT_SCHEMA_VERSION });
    expect(migrated).toEqual({ score, documentId: "doc_fixture", savedAt: saveTime.toISOString(), warnings: [] });
  });

  it("opens the original v1 demo fixture with its existing IDs", () => {
    const result = readScoreFile(`  \uFEFF${JSON.stringify(v1Demo)}`);
    expect(result.score.meta.title).toBe(v1Demo.score.meta.title);
    expect(result.score.tracks.map(({ id }) => id)).toEqual(["track-1", "track-2"]);
  });

  it("[A11] imports legacy IDs and creates distinct IDs for new tracks", () => {
    const score = createEmptyScore();
    score.tracks = [createTrack(), createTrack()];
    score.tracks[0].id = "track-1";
    score.tracks[1].id = "track-1";
    score.tracks[1].bars[0].voices[0].beats.push(createBeat({
      rest: false,
      notes: [{
        ...createNote(),
        tieOrigin: { trackId: "track-1", barIndex: 0, voiceIndex: 0, beatIndex: 0, noteIndex: 0 }
      }]
    }));
    const payload = JSON.stringify({ format: NATIVE_SCORE_FORMAT, version: 1, score, savedAt: "2026-11-23T00:00:00.000Z" });
    const migrated = readScoreFile(payload, { documentId: "doc_legacy" });

    expect(migrated.documentId).toBe("doc_legacy");
    expect(migrated.score.tracks[0].id).toBe("track-1");
    expect(migrated.score.tracks[1].id).toMatch(/^trk_/);
    expect(migrated.score.tracks[1].bars[0].voices[0].beats[0].notes[0].tieOrigin?.trackId)
      .toBe(migrated.score.tracks[1].id);
    expect(migrated.warnings).toHaveLength(1);
    expect(new Set([...migrated.score.tracks, createTrack()].map(({ id }) => id)).size).toBe(3);
  });

  it("migrates both legacy file shapes, repairing missing measures with rests", () => {
    const score = createEmptyScore();
    score.masterBars.push(createMasterBar());
    score.tracks.push(createTrack());
    score.tracks[0].bars[0].voices[0].beats.push(createBeat({ rest: false, notes: [createNote(1, 7)] }));

    const result = readScoreFile(JSON.stringify(score));
    expect(result.score.tracks[0].bars[1].voices[0].beats).toEqual([createBeat({ duration: 1 })]);
    expect(result.documentId).toMatch(/^doc_/);
    expect(result.warnings[0]).toMatch(/rest/);
    expect(readScoreFile(serializeNativeScore(score)).score).toEqual(result.score);
  });

  it("supplies absent defaults and validates supplied nested values", () => {
    const score = createEmptyScore();
    const stripped = { masterBars: score.masterBars, tracks: [], stylesheet: { page: { width: 820 } } };
    const parsed = readScoreFile(JSON.stringify(stripped));

    expect(parsed.score.stylesheet.page).toMatchObject({ width: 820, height: 1123 });
    expect(parsed.score.meta).toEqual(score.meta);
    expect(parsed.score.documentSettings).toEqual(score.documentSettings);

    expect(() => readScoreFile(JSON.stringify({ ...stripped, stylesheet: { page: { width: "wide" } } })))
      .toThrow(/stylesheet\.page\.width/);
    expect(() => readScoreFile(JSON.stringify({ ...stripped, documentSettings: { displayMode: false } })))
      .toThrow(/documentSettings\.displayMode/);
  });

  it("rejects malformed JSON, newer files, and out-of-range fret positions", () => {
    expect(() => readScoreFile("{invalid")).toThrow(/invalid JSON/);
    expect(() => readScoreFile(JSON.stringify({ format: APP_FILE_FORMAT, schemaVersion: 999 })))
      .toThrow(/newer version/);

    const score = createEmptyScore();
    score.tracks.push(createTrack());
    score.tracks[0].bars[0].voices[0].beats.push(createBeat({ rest: false, notes: [createNote(7, 2)] }));
    expect(() => readScoreFile(writeScoreFile(score, "doc_wrong"))).toThrow(/cannot be opened/);
  });
});
