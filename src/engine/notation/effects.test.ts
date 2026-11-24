import { expect, it } from "vitest";
import { layoutScore } from "../layout/layoutScore";
import { STAFF_LINE_GAP } from "../layout/metrics";
import { createBeat, createEmptyScore, createNote, createTrack } from "../../model/factory";
import { bendLabel } from "./effects";

it.each([[0.5, "1/4"], [1, "1/2"], [2, "full"], [3, "1½"], [4, "2"], [50, "1/2"], [100, "full"]] as const)(
  "[C6] renders bend peak %s with label %s", (peak, label) => {
    expect(bendLabel([{ offset: 0, value: 0 }, { offset: 60, value: peak }])).toBe(label);
  }
);

it("[C6] renders bend arrows, diamond harmonics and a beam no steeper than a staff space", () => {
  const score = createEmptyScore();
  const track = createTrack();
  score.tracks = [track];
  const notes = [
    { ...createNote(6, 0), bend: { points: [{ offset: 0, value: 0 }, { offset: 60, value: 1 }] } },
    { ...createNote(1, 12), harmonic: { type: "natural" as const, touchFret: 12 } }
  ];
  track.bars[0].voices[0].beats = [
    ...notes.map((note) => createBeat({ duration: 8, rest: false, notes: [note] })),
    ...Array.from({ length: 3 }, () => createBeat())
  ];

  const { primitives } = layoutScore(score).pages[0];
  expect(primitives.find((primitive) => primitive.id.endsWith("-bend-label"))).toMatchObject({ text: "1/2" });
  expect(primitives.filter((primitive) => primitive.id.includes("-bend-arrow-"))).toHaveLength(2);
  expect(primitives.some((primitive) => primitive.type === "path" && primitive.id.endsWith("-head"))).toBe(true);

  const beam = primitives.find((primitive) => primitive.type === "path" && primitive.id.includes("-standard-beam-0"));
  if (beam?.type !== "path") throw new Error("Expected the two notes to be beamed within the same beat");
  const coordinates = beam.d.match(/-?[\d.]+/g)?.map(Number) ?? [];
  expect(Math.abs(coordinates[3] - coordinates[1])).toBeLessThanOrEqual(STAFF_LINE_GAP);
});
