import type { MeasureContent } from "./measureContents";

export interface SystemMeasure {
  content: MeasureContent;
  x: number;
  width: number;
}

export interface LayoutSystem {
  index: number;
  measures: SystemMeasure[];
  width: number;
}

export function breakSystems(
  measures: MeasureContent[],
  contentWidth: number
): LayoutSystem[] {
  const systems: LayoutSystem[] = [];
  let current: SystemMeasure[] = [];
  let currentWidth = 0;

  for (const measure of measures) {
    const shouldWrap =
      current.length > 0 &&
      currentWidth + measure.minWidth > contentWidth &&
      !current[current.length - 1].content.preventBreak;

    if (shouldWrap) {
      systems.push(createSystem(systems.length, current));
      current = [];
      currentWidth = 0;
    }

    current.push({
      content: measure,
      x: currentWidth,
      width: measure.minWidth
    });
    currentWidth += measure.minWidth;

    if (measure.forcedBreak) {
      systems.push(createSystem(systems.length, current));
      current = [];
      currentWidth = 0;
    }
  }

  if (current.length > 0) {
    systems.push(createSystem(systems.length, current));
  }

  return systems;
}

function createSystem(index: number, measures: SystemMeasure[]): LayoutSystem {
  return {
    index,
    measures: justifyMeasures(measures),
    width: measures.reduce((total, measure) => total + measure.width, 0)
  };
}

function justifyMeasures(measures: SystemMeasure[]): SystemMeasure[] {
  let x = 0;
  return measures.map((measure) => {
    const placed = { ...measure, x };
    x += measure.width;
    return placed;
  });
}
