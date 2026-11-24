import { describe, expect, it } from "vitest";
import { createDemoScore } from "../../model/demoScore";
import { layoutScore } from "./layoutScore";
import type { ScenePrimitive } from "./sceneGraph";

describe("Phase 2b rhythm SVG snapshots", () => {
  const scene = layoutScore(createDemoScore());

  it("snapshots standard and tablature beam groups", () => {
    expect(snapshotById("beam", 8)).toMatchInlineSnapshot(`
      [
        "track-x-1-0-0-standard-beam-0-0|path|M 377.2 222 L 487.9 222 L 487.9 226 L 377.2 226 Z|#111827|",
        "track-x-1-0-0-standard-beam-1-0|path|M 377.2 216 L 487.9 216 L 487.9 220 L 377.2 220 Z|#111827|",
        "track-x-1-0-4-standard-beam-0-0|path|M 511.4 222 L 622.1 222 L 622.1 226 L 511.4 226 Z|#111827|",
        "track-x-1-0-4-standard-beam-1-0|path|M 511.4 216 L 622.1 216 L 622.1 220 L 511.4 220 Z|#111827|",
        "track-x-1-0-0-tab-beam-0-0|path|M 382.2 328 L 482.9 328 L 482.9 332 L 382.2 332 Z|#111827|",
        "track-x-1-0-0-tab-beam-1-0|path|M 382.2 322 L 482.9 322 L 482.9 326 L 382.2 326 Z|#111827|",
        "track-x-1-0-4-tab-beam-0-0|path|M 516.4 328 L 617.1 328 L 617.1 332 L 516.4 332 Z|#111827|",
        "track-x-1-0-4-tab-beam-1-0|path|M 516.4 322 L 617.1 322 L 617.1 326 L 516.4 326 Z|#111827|",
      ]
    `);
  });

  it("snapshots tuplet bracket primitives", () => {
    expect(snapshotById("tuplet", 12)).toMatchInlineSnapshot(`
      [
        "track-x-2-0-0-tuplet-0-left-hook|line|164,557.6-164,562.6|#111827",
        "track-x-2-0-0-tuplet-0-top|line|164,557.6-237.6,557.6|#111827",
        "track-x-2-0-0-tuplet-0-right-hook|line|237.6,557.6-237.6,562.6|#111827",
        "track-x-2-0-0-tuplet-0-number|text|200.8,554.6|3|#111827",
        "track-x-3-0-0-tuplet-0-left-hook|line|392.6,557.6-392.6,562.6|#111827",
        "track-x-3-0-0-tuplet-0-top|line|392.6,557.6-623.7,557.6|#111827",
        "track-x-3-0-0-tuplet-0-right-hook|line|623.7,557.6-623.7,562.6|#111827",
        "track-x-3-0-0-tuplet-0-number|text|508.1,554.6|3|#111827",
        "track-x-3-0-0-tuplet-1-left-hook|line|392.6,543.6-392.6,548.6|#111827",
        "track-x-3-0-0-tuplet-1-top|line|392.6,543.6-523.9,543.6|#111827",
        "track-x-3-0-0-tuplet-1-right-hook|line|523.9,543.6-523.9,548.6|#111827",
        "track-x-3-0-0-tuplet-1-number|text|458.2,540.6|5|#111827",
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
        "track-x-2-0-4-rest-2|text|295.8,597.6||#111827",
        "track-x-4-0-0-rest-1|text|172,387||#111827",
        "track-x-7-0-0-rest-2|text|172,187||#111827",
        "track-x-7-0-1-rest-4|text|341.7,188.6||#111827",
        "track-x-7-0-2-rest-8|text|426.5,188.6||#111827",
        "track-x-7-0-3-rest-16|text|499,188.6||#111827",
        "track-x-7-0-4-rest-32|text|559,188.6||#111827",
        "track-x-7-0-5-rest-64|text|614,188.6||#111827",
        "dot-128-16-0|ellipse|184,192,1.8,1.8|#111827",
      ]
    `);
  });

  it("snapshots invalid bar duration markers", () => {
    expect(snapshotById("duration-error", 4)).toMatchInlineSnapshot(`
      [
        "track-x-10-duration-error|rect|593.7,563.6,144.3,164|rgba(239, 68, 68, 0.07)|#ef4444",
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
