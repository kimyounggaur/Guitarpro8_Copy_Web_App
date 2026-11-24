import type { MeasureContent } from "./measureContents";
import { measureSpacing, shortestBeat } from "./spacing";

export interface SystemMeasure {
  content: MeasureContent;
  x: number;
  width: number;
  showsSignature: boolean;
  tickPositions: { tick: number; x: number }[];
}

export interface LayoutSystem {
  index: number;
  measures: SystemMeasure[];
  width: number;
}

interface SystemSpacingOptions {
  rhythmProportion: number;
  firstSystemIndent: number;
  minMeasureWidth: number;
  justifyLastSystem: boolean;
}

const defaults: SystemSpacingOptions = {
  rhythmProportion: 1,
  firstSystemIndent: 0,
  minMeasureWidth: 0,
  justifyLastSystem: false
};

export function breakSystems(
  measures: MeasureContent[],
  contentWidth: number,
  options: SystemSpacingOptions = defaults
): LayoutSystem[] {
  const groups: MeasureContent[][] = [];
  let current: MeasureContent[] = [];
  const indent = Math.min(Math.max(0, options.firstSystemIndent), contentWidth / 2);

  for (const measure of measures) {
    const candidate = [...current, measure];
    const available = groups.length === 0 ? contentWidth - indent : contentWidth;
    const width = spacingFor(candidate, options).reduce((sum, spacing) => sum + spacing.ideal, 0);
    if (current.length > 0 && width > available && !current.at(-1)?.preventBreak) {
      groups.push(current);
      current = [];
    }
    current.push(measure);

    if (measure.forcedBreak) {
      groups.push(current);
      current = [];
    }
  }
  if (current.length > 0) {
    groups.push(current);
  }

  return groups.map((group, index) => {
    const origin = index === 0 ? indent : 0;
    const available = contentWidth - origin;
    const spacings = spacingFor(group, options);
    const ideal = spacings.reduce((sum, spacing) => sum + spacing.ideal, 0);
    const fixed = spacings.reduce((sum, spacing) => sum + spacing.fixed, 0);
    const justify = index < groups.length - 1 || options.justifyLastSystem || ideal >= available * 0.75;
    const factor = justify && ideal > fixed ? Math.max(1, (available - fixed) / (ideal - fixed)) : 1;

    let x = origin;
    const measures = group.map((content, measureIndex) => {
      const spacing = spacings[measureIndex];
      const width = spacing.fixed + (spacing.ideal - spacing.fixed) * factor;
      let beatX = spacing.left;
      const tickPositions = content.beats.map((beat, beatIndex) => {
        const position = { tick: beat.tick, x: beatX };
        beatX += spacing.gaps[beatIndex] * factor;
        return position;
      });
      const lastBeat = content.beats.at(-1);
      const endTick = Math.max(content.expectedTicks, lastBeat ? lastBeat.tick + lastBeat.durationTicks : 0);
      tickPositions.push({ tick: endTick, x: width - (spacing.fixed - spacing.left) });
      const measure = { content, x, width, showsSignature: spacing.showsSignature, tickPositions };
      x += width;
      return measure;
    });

    return { index, measures, width: x };
  });
}

function spacingFor(measures: MeasureContent[], options: SystemSpacingOptions) {
  const shortest = shortestBeat(measures);
  return measures.map((measure, index) => measureSpacing(
    measure,
    shortest,
    options.rhythmProportion,
    options.minMeasureWidth,
    index === 0
  ));
}
