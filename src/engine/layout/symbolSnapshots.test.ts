import { describe, expect, it } from "vitest";
import { createDemoScore } from "../../model/demoScore";
import { layoutScore } from "./layoutScore";

describe("Phase 5 symbol and effect rendering", () => {
  const primitives = layoutScore(createDemoScore()).pages.flatMap((page) => page.primitives);

  it("renders master-bar symbols with hit metadata", () => {
    expect(idList()).toEqual(
      expect.arrayContaining([
        "master-0-section-text",
        "master-0-repeat-open-thick",
        "master-1-volta-label",
        "master-1-fermata-0",
        "master-2-repeat-close-thick",
        "master-3-direction-target-0",
        "master-4-direction-jump-0"
      ])
    );

    expect(kinds()).toEqual(expect.arrayContaining(["section", "repeat", "volta", "direction", "fermata"]));
  });

  it("renders common note and beat effects", () => {
    expect(idList()).toEqual(
      expect.arrayContaining([
        "track-x-0-0-0-0-effect-let-ring-label",
        "track-x-0-0-1-0-effect-palm-mute-label",
        "track-x-0-0-2-0-effect-bend-curve",
        "track-x-0-0-3-0-effect-harmonic",
        "track-x-1-0-0-0-effect-dead-left",
        "track-x-5-0-0-effect-brush",
        "track-x-5-0-1-effect-arpeggio",
        "track-x-5-0-2-effect-hairpin-cresc-top",
        "track-x-5-0-3-effect-ottava-label"
      ])
    );

    expect(kinds()).toContain("effect");
  });

  function idList(): string[] {
    return primitives.map((primitive) => primitive.id.replace(/track-\d+/g, "track-x"));
  }

  function kinds(): string[] {
    return primitives.flatMap((primitive) => (primitive.hit ? [primitive.hit.kind] : []));
  }
});
