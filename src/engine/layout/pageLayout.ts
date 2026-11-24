import type { PageMetrics } from "../../model/stylesheet";
import type { Stylesheet, Track } from "../../model/types";
import { measureSystem, stackPages, type StackedPage } from "./pageStacker";
import type { ScenePrimitive } from "./sceneGraph";
import { trackStack } from "./staffMetrics";
import type { LayoutSystem } from "./systemBreaker";

export function layoutPages(
  systems: LayoutSystem[],
  tracks: Track[],
  stylesheet: Stylesheet,
  metrics: PageMetrics,
  drawSystem: (system: LayoutSystem) => ScenePrimitive[],
  groupSystems = false
): StackedPage[] {
  const systemHeight = tracks.reduce((height, track) => height + trackStack(track, stylesheet).height, 0)
    + Math.max(0, tracks.length - 1) * metrics.trackGap;
  return stackPages(systems.map((system) => measureSystem(drawSystem(system), systemHeight)), metrics, groupSystems);
}
