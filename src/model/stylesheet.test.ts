import { describe, expect, it } from "vitest";
import { createEmptyScore } from "./factory";
import {
  applyStylePreset,
  createDefaultStylesheet,
  normalizeStylesheet,
  renderHeaderToken,
  resolvePageMetrics
} from "./stylesheet";

describe("Phase 11 stylesheet model", () => {
  it("stores a document stylesheet with more than 60 primitive settings", () => {
    const stylesheet = createDefaultStylesheet();

    expect(countPrimitiveLeaves(stylesheet)).toBeGreaterThanOrEqual(60);
    expect(stylesheet.headerFooter.firstPageTitle).toBe("%TITLE%");
    expect(stylesheet.symbols.palmMuteText).toBe("PM");
  });

  it("normalizes older placeholder stylesheets", () => {
    const stylesheet = normalizeStylesheet({ placeholder: true });

    expect(stylesheet.presetName).toBe("Classic");
    expect(stylesheet.page.width).toBe(794);
  });

  it("applies Classic, Jazz, and Rock presets without losing custom page values", () => {
    const base = createDefaultStylesheet();
    const jazz = applyStylePreset({ ...base, page: { ...base.page, marginLeft: 88 } }, "Jazz");
    const rock = applyStylePreset(jazz, "Rock");

    expect(jazz.presetName).toBe("Jazz");
    expect(jazz.page.marginLeft).toBe(88);
    expect(jazz.symbols.style).toBe("Jazz");
    expect(rock.presetName).toBe("Rock");
    expect(rock.symbols.effectColor).toBe("#b91c1c");
  });

  it("resolves display mode metrics and header tokens", () => {
    const score = createEmptyScore();
    score.meta.title = "Phase 11";
    score.meta.artist = "Codex";

    const page = resolvePageMetrics(score.stylesheet, "vertical-page");
    const screen = resolvePageMetrics(score.stylesheet, "horizontal-screen");

    expect(page.contentWidth).toBe(682);
    expect(screen.continuous).toBe(true);
    expect(screen.pageWidth).toBeGreaterThan(page.pageWidth);
    expect(renderHeaderToken("%TITLE% by %ARTIST% %PAGE%/%PAGES%", score, 0, 3)).toBe("Phase 11 by Codex 1/3");
  });
});

function countPrimitiveLeaves(value: unknown): number {
  if (typeof value !== "object" || value === null) {
    return 1;
  }

  if (Array.isArray(value)) {
    return value.reduce((sum, item) => sum + countPrimitiveLeaves(item), 0);
  }

  return Object.values(value).reduce((sum, item) => sum + countPrimitiveLeaves(item), 0);
}
