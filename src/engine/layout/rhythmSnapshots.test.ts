import { describe, expect, it } from "vitest";
import { createDemoScore } from "../../model/demoScore";
import { layoutScore } from "./layoutScore";
import type { ScenePrimitive } from "./sceneGraph";

describe("Phase 2b rhythm SVG snapshots", () => {
  const scene = layoutScore(createDemoScore());

  it("snapshots standard and tablature beam groups", () => {
    expect(snapshotById("beam", 8)).toMatchInlineSnapshot(`
      [
        "track-x-1-0-0-standard-beam-0-0|path|M 237 172 L 280.8 172 L 280.8 176 L 237 176 Z|#111827|",
        "track-x-1-0-0-standard-beam-1-0|path|M 237 166 L 280.8 166 L 280.8 170 L 237 170 Z|#111827|",
        "track-x-1-0-4-standard-beam-0-0|path|M 282 172 L 325.8 172 L 325.8 176 L 282 176 Z|#111827|",
        "track-x-1-0-4-standard-beam-1-0|path|M 282 166 L 325.8 166 L 325.8 170 L 282 170 Z|#111827|",
        "track-x-1-0-0-tab-beam-0-0|path|M 242 278 L 275.8 278 L 275.8 282 L 242 282 Z|#111827|",
        "track-x-1-0-0-tab-beam-1-0|path|M 242 272 L 275.8 272 L 275.8 276 L 242 276 Z|#111827|",
        "track-x-1-0-4-tab-beam-0-0|path|M 287 278 L 320.8 278 L 320.8 282 L 287 282 Z|#111827|",
        "track-x-1-0-4-tab-beam-1-0|path|M 287 272 L 320.8 272 L 320.8 276 L 287 276 Z|#111827|",
      ]
    `);
  });

  it("snapshots tuplet bracket primitives", () => {
    expect(snapshotById("tuplet", 12)).toMatchInlineSnapshot(`
      [
        "track-x-2-0-0-tuplet-0-left-hook|line|442,110-442,115|#111827",
        "track-x-2-0-0-tuplet-0-top|line|442,110-476,110|#111827",
        "track-x-2-0-0-tuplet-0-right-hook|line|476,110-476,115|#111827",
        "track-x-2-0-0-tuplet-0-number|text|459,107|3|#111827",
        "track-x-3-0-0-tuplet-0-left-hook|line|578,110-578,115|#111827",
        "track-x-3-0-0-tuplet-0-top|line|578,110-654,110|#111827",
        "track-x-3-0-0-tuplet-0-right-hook|line|654,110-654,115|#111827",
        "track-x-3-0-0-tuplet-0-number|text|616,107|3|#111827",
        "track-x-3-0-0-tuplet-1-left-hook|line|578,96-578,101|#111827",
        "track-x-3-0-0-tuplet-1-top|line|578,96-618,96|#111827",
        "track-x-3-0-0-tuplet-1-right-hook|line|618,96-618,101|#111827",
        "track-x-3-0-0-tuplet-1-number|text|598,93|5|#111827",
      ]
    `);
  });

  it("snapshots ties", () => {
    expect(snapshotById("tie", 4)).toMatchInlineSnapshot(`
      [
        "track-x-8-0-0-0-tie|path|M 131 157 C 142 143, 142 143, 153 157|none|#111827",
      ]
    `);
  });

  it("snapshots rests and rhythm dots", () => {
    expect(snapshotById("rest", 8).concat(snapshotById("dot", 3))).toMatchInlineSnapshot(`
      [
        "track-x-2-0-4-rest-2|text|504,150||#111827",
        "track-x-4-0-0-rest-1|text|124,620||#111827",
        "track-x-7-0-0-rest-2|text|124,738||#111827",
        "track-x-7-0-1-rest-4|text|196,739.6||#111827",
        "track-x-7-0-2-rest-8|text|232,739.6||#111827",
        "track-x-7-0-3-rest-16|text|250,739.6||#111827",
        "track-x-7-0-4-rest-32|text|259,739.6||#111827",
        "track-x-7-0-5-rest-64|text|263.5,739.6||#111827",
        "dot-136-142-0|ellipse|136,142,1.8,1.8|#111827",
      ]
    `);
  });

  it("snapshots invalid bar duration markers", () => {
    expect(snapshotById("duration-error", 4)).toMatchInlineSnapshot(`
      [
        "track-x-10-duration-error|rect|380,122,100,164|rgba(239, 68, 68, 0.07)|#ef4444",
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
