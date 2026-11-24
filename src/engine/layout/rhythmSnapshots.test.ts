import { describe, expect, it } from "vitest";
import { createDemoScore } from "../../model/demoScore";
import { layoutScore } from "./layoutScore";
import type { ScenePrimitive } from "./sceneGraph";

describe("Phase 2b rhythm SVG snapshots", () => {
  const scene = layoutScore(createDemoScore());

  it("snapshots standard and tablature beam groups", () => {
    expect(snapshotById("beam", 8)).toMatchInlineSnapshot(`
      [
        "track-x-1-0-0-standard-beam-0-0|path|M 386.5 176 L 487.3 168 L 487.3 172 L 386.5 180 Z|#111827|",
        "track-x-1-0-0-standard-beam-1-0|path|M 386.5 182 L 487.3 174 L 487.3 178 L 386.5 186 Z|#111827|",
        "track-x-1-0-4-standard-beam-0-0|path|M 521 176 L 621.9 168 L 621.9 172 L 521 180 Z|#111827|",
        "track-x-1-0-4-standard-beam-1-0|path|M 521 182 L 621.9 174 L 621.9 178 L 521 186 Z|#111827|",
        "track-x-1-0-0-tab-beam-0-0|path|M 381.5 328 L 482.3 328 L 482.3 332 L 381.5 332 Z|#111827|",
        "track-x-1-0-0-tab-beam-1-0|path|M 381.5 322 L 482.3 322 L 482.3 326 L 381.5 326 Z|#111827|",
        "track-x-1-0-4-tab-beam-0-0|path|M 516 328 L 616.9 328 L 616.9 332 L 516 332 Z|#111827|",
        "track-x-1-0-4-tab-beam-1-0|path|M 516 322 L 616.9 322 L 616.9 326 L 516 326 Z|#111827|",
      ]
    `);
  });

  it("snapshots tuplet bracket primitives", () => {
    expect(snapshotById("tuplet", 12)).toMatchInlineSnapshot(`
      [
        "track-x-2-0-0-tuplet-0-left-hook|line|143.2,557.6-143.2,562.6|#111827",
        "track-x-2-0-0-tuplet-0-top|line|143.2,557.6-219.2,557.6|#111827",
        "track-x-2-0-0-tuplet-0-right-hook|line|219.2,557.6-219.2,562.6|#111827",
        "track-x-2-0-0-tuplet-0-number|text|181.2,554.6|3|#111827",
        "track-x-3-0-0-tuplet-0-left-hook|line|379.7,557.6-379.7,562.6|#111827",
        "track-x-3-0-0-tuplet-0-top|line|379.7,557.6-619.4,557.6|#111827",
        "track-x-3-0-0-tuplet-0-right-hook|line|619.4,557.6-619.4,562.6|#111827",
        "track-x-3-0-0-tuplet-0-number|text|499.5,554.6|3|#111827",
        "track-x-3-0-0-tuplet-1-left-hook|line|379.7,543.6-379.7,548.6|#111827",
        "track-x-3-0-0-tuplet-1-top|line|379.7,543.6-515.6,543.6|#111827",
        "track-x-3-0-0-tuplet-1-right-hook|line|515.6,543.6-515.6,548.6|#111827",
        "track-x-3-0-0-tuplet-1-number|text|447.7,540.6|5|#111827",
      ]
    `);
  });

  it("renders a single cubic tie arc", () => {
    const ties = snapshotById("tie", 4);
    expect(ties).toHaveLength(1);
    expect(ties[0]).toMatch(/-tie\|path\|M .+ C .+\|none\|#111827$/);
  });

  it("snapshots rests and rhythm dots", () => {
    expect(snapshotById("rest", 8).concat(snapshotById("dot", 3))).toMatchInlineSnapshot(`
      [
        "track-x-2-0-4-rest-2|text|280,589.6||#111827",
        "track-x-4-0-0-rest-1|text|151.2,379||#111827",
        "track-x-7-0-0-rest-2|text|151.2,179||#111827",
        "track-x-7-0-1-rest-4|text|327.3,179||#111827",
        "track-x-7-0-2-rest-8|text|415.3,179||#111827",
        "track-x-7-0-3-rest-16|text|490.5,179||#111827",
        "track-x-7-0-4-rest-32|text|552.8,179||#111827",
        "track-x-7-0-5-rest-64|text|609.9,179||#111827",
        "dot-126.816-60-0|ellipse|182.8,236,1.8,1.8|#111827",
      ]
    `);
  });

  it("snapshots invalid bar duration markers", () => {
    expect(snapshotById("duration-error", 4)).toMatchInlineSnapshot(`
      [
        "track-x-10-duration-error|rect|588.9,563.6,149.1,164|rgba(239, 68, 68, 0.07)|#ef4444",
      ]
    `);
  });

  function snapshotById(idPart: string, limit: number): string[] {
    return scene.pages
      .flatMap((page) => page.primitives)
      .filter((primitive) => primitive.id.includes(idPart))
      .slice(0, limit)
      .map(primitiveSnapshot);
  }
});

function primitiveSnapshot(primitive: ScenePrimitive): string {
  const id = primitive.id.replace(/track-\d+/g, "track-x");

  switch (primitive.type) {
    case "line":
      return `${id}|line|${round(primitive.x1)},${round(primitive.y1)}-${round(primitive.x2)},${round(primitive.y2)}|${primitive.stroke}`;
    case "path":
      return `${id}|path|${normalisePath(primitive.d)}|${primitive.fill}|${primitive.stroke ?? ""}`;
    case "text":
      return `${id}|text|${round(primitive.x)},${round(primitive.y)}|${primitive.text}|${primitive.fill}`;
    case "rect":
      return `${id}|rect|${round(primitive.x)},${round(primitive.y)},${round(primitive.width)},${round(primitive.height)}|${primitive.fill}|${primitive.stroke ?? ""}`;
    case "ellipse":
      return `${id}|ellipse|${round(primitive.cx)},${round(primitive.cy)},${round(primitive.rx)},${round(primitive.ry)}|${primitive.fill}`;
  }
}

function normalisePath(path: string): string {
  return path.replace(/-?\d+(?:\.\d+)?/g, (value) => round(Number(value)));
}

function round(value: number): string {
  return Number(value.toFixed(1)).toString();
}
