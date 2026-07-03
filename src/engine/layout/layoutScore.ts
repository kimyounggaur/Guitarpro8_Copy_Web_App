import type { Score } from "../../model/types";
import { validateBarDurations } from "../validate";
import { createMeasureContents } from "./measureContents";
import { CONTENT_WIDTH, PAGE_HEIGHT, PAGE_MARGIN_X, PAGE_WIDTH } from "./metrics";
import { layoutPages } from "./pageLayout";
import type { SceneGraph, ScenePrimitive } from "./sceneGraph";
import { breakSystems } from "./systemBreaker";
import { systemPrimitives } from "./trackScene";

export interface LayoutScoreOptions {
  editingBar?: { trackId?: string; barIndex: number };
}

export function layoutScore(score: Score, options: LayoutScoreOptions = {}): SceneGraph {
  const measureContents = createMeasureContents(score);
  const systems = breakSystems(measureContents, CONTENT_WIDTH);
  const pages = layoutPages(systems, score.tracks.length);
  const durationIssues = validateBarDurations(score);

  return {
    pages: pages.map((page) => ({
      id: `page-${page.index}`,
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
      primitives: [
        pageBackground(page.index),
        header(score),
        ...page.systems.flatMap((pageSystem) =>
          systemPrimitives(score, pageSystem.system.measures, PAGE_MARGIN_X, pageSystem.y, {
            durationIssues,
            editingBar: options.editingBar
          })
        )
      ]
    }))
  };
}

function pageBackground(pageIndex: number): ScenePrimitive {
  return {
    id: `page-${pageIndex}-background`,
    type: "rect",
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    fill: "#fbfaf7",
    stroke: "#d8d2c5",
    strokeWidth: 1
  };
}

function header(score: Score): ScenePrimitive {
  const title = score.meta.title || "Untitled Score";

  return {
    id: "score-header-title",
    type: "text",
    x: PAGE_WIDTH / 2,
    y: 42,
    text: title,
    fill: "#1f2933",
    fontSize: 18,
    anchor: "middle",
    hit: {
      kind: "header",
      ref: {},
      bbox: { x: PAGE_WIDTH / 2 - 120, y: 20, width: 240, height: 28 }
    }
  };
}
