import { describe, expect, it } from "vitest";
import { createDemoScore } from "../../model/demoScore";
import { createBeat, createEmptyScore, createTrack } from "../../model/factory";
import { layoutScore } from "./layoutScore";
import { createMeasureContents, tickToMeasureX, type MeasureContent } from "./measureContents";
import { breakSystems } from "./systemBreaker";

describe("Phase 2a layout pipeline", () => {
  it("wraps systems when measure widths exceed the content width", () => {
    const measures = fakeMeasures([160, 160, 160, 160]);

    const systems = breakSystems(measures, 330);

    expect(systems).toHaveLength(2);
    expect(systems[0].measures.map((measure) => measure.content.barIndex)).toEqual([0, 1]);
    expect(systems[1].measures.map((measure) => measure.content.barIndex)).toEqual([2, 3]);
  });

  it("honors forced line breaks", () => {
    const measures = fakeMeasures([120, 120, 120]);
    measures[0].forcedBreak = true;

    const systems = breakSystems(measures, 500);

    expect(systems).toHaveLength(2);
    expect(systems[0].measures.map((measure) => measure.content.barIndex)).toEqual([0]);
    expect(systems[1].measures.map((measure) => measure.content.barIndex)).toEqual([1, 2]);
  });

  it("keeps tick to x mapping monotonic", () => {
    const score = createEmptyScore();
    score.tracks.push(createTrack(undefined, 1));
    score.tracks[0].bars[0].voices[0].beats = [
      createBeat({ duration: 4 }),
      createBeat({ duration: 4 }),
      createBeat({ duration: 4 }),
      createBeat({ duration: 4 })
    ];

    const measure = createMeasureContents(score)[0];
    const xs = [0, 480, 960, 1440, 1920].map((tick) => tickToMeasureX(measure, tick, 200));

    expect(xs).toEqual([...xs].sort((left, right) => left - right));
    expect(xs[0]).toBe(0);
    expect(xs[4]).toBe(200);
  });

  it("adds note hit metadata to the scene graph", () => {
    const scene = layoutScore(createDemoScore());
    const notePrimitive = scene.pages[0].primitives.find(
      (primitive) => primitive.hit?.kind === "note"
    );

    expect(notePrimitive?.hit?.ref).toMatchObject({
      barIndex: 0,
      voiceIndex: 0,
      beatIndex: 0,
      noteIndex: 0
    });
    expect(notePrimitive?.hit?.bbox.width).toBeGreaterThan(0);
  });
});

function fakeMeasures(widths: number[]): MeasureContent[] {
  return widths.map((width, index) => ({
    barIndex: index,
    expectedTicks: 1920,
    minWidth: width,
    forcedBreak: false,
    preventBreak: false,
    beats: []
  }));
}
