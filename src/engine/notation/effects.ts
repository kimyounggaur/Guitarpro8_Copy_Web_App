import type { BendPoint } from "../../model/types";

export function bendLabel(points: readonly BendPoint[]): string {
  const peak = points.reduce((max, point) => Math.max(max, Math.abs(point.value) > 12 ? point.value / 50 : point.value), 0);
  const quarters = Math.round(peak * 2);
  if (quarters === 0) return "";
  if (quarters === 1) return "1/4";
  if (quarters === 2) return "1/2";
  if (quarters === 3) return "3/4";
  if (quarters === 4) return "full";

  const wholeTones = Math.floor(quarters / 4);
  const suffix = ["", "¼", "½", "¾"][quarters % 4];
  return `${wholeTones}${suffix}`;
}
