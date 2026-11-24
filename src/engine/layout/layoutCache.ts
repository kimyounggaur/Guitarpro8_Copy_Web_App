import { normalizeStylesheet } from "../../model/stylesheet";
import type { MasterBar, Score, Stylesheet, Track } from "../../model/types";
import { createMeasureContent, type MeasureContent } from "./measureContents";
import type { ScenePage, ScenePrimitive } from "./sceneGraph";
import { breakSystems, type LayoutSystem, type SystemMeasure, type SystemSpacingOptions } from "./systemBreaker";

interface Keyed<Value> {
  inputs: readonly unknown[];
  value: Value;
}

interface BrokenSystems {
  inputs: readonly number[];
  measures: MeasureContent[];
  systems: LayoutSystem[];
}

interface CachedPage {
  inputs: readonly unknown[];
  body: ScenePrimitive[];
  result: ScenePage;
}

/** An editor-scoped cache for immutable score snapshots. Exporters can lay out a fresh scene. */
export class LayoutCache {
  private readonly styles = new WeakMap<Stylesheet, Stylesheet>();
  private readonly measures = new WeakMap<MasterBar, Keyed<MeasureContent>>();
  private readonly drawings = new WeakMap<LayoutSystem, Keyed<ScenePrimitive[]>>();
  private readonly measureDrawings = new WeakMap<SystemMeasure, Map<string, Keyed<ScenePrimitive[]>>>();
  private broken: BrokenSystems | undefined;
  private pages: Array<CachedPage | undefined> = [];

  stylesheet(raw: Stylesheet): Stylesheet {
    const known = this.styles.get(raw);
    if (known) return known;
    const style = normalizeStylesheet(raw);
    this.styles.set(raw, style);
    return style;
  }

  measureContents(score: Score, notation: Stylesheet["notation"]): MeasureContent[] {
    return score.masterBars.map((bar, index) => {
      const previous = score.masterBars[index - 1];
      const inputs = [index, notation, previous?.keySignature, previous?.timeSignature, ...score.tracks.map((track) => track.bars[index])];
      const known = this.measures.get(bar);
      if (known && same(known.inputs, inputs)) return known.value;

      const value = createMeasureContent(score, index, notation);
      this.measures.set(bar, { inputs, value });
      return value;
    });
  }

  breakSystems(measures: MeasureContent[], width: number, style: SystemSpacingOptions): LayoutSystem[] {
    const inputs = [width, style.rhythmProportion, style.firstSystemIndent, style.minMeasureWidth, Number(style.justifyLastSystem)];
    const prior = this.broken;
    if (!prior || !same(prior.inputs, inputs)) {
      const systems = breakSystems(measures, width, style);
      this.broken = { inputs, measures, systems };
      return systems;
    }

    const end = Math.min(prior.measures.length, measures.length);
    let changed = 0;
    while (changed < end && prior.measures[changed] === measures[changed]) changed++;
    if (changed === end && prior.measures.length === measures.length) return prior.systems;

    let prefix = prior.systems.findIndex((system) => system.measures.at(-1)!.content.barIndex >= changed);
    if (prefix === -1) prefix = Math.max(0, prior.systems.length - 1);

    // The first changed measure may now fit in the preceding line. Appending
    // or removing a tail can also change which line is the last one justified.
    if (prefix > 0 && prior.systems[prefix].measures[0].content.barIndex === changed
      && (changed === measures.length || !prior.measures[changed - 1].forcedBreak)) prefix--;

    const start = prior.systems[prefix]?.measures[0].content.barIndex ?? 0;
    const priorMeasures = new Map(prior.systems.flatMap((system) =>
      system.measures.map((measure) => [measure.content.barIndex, measure] as const)
    ));
    const tail = breakSystems(measures.slice(start), width, style, prefix).map((system) => {
      const old = prior.systems[system.index];
      const reused = system.measures.map((measure) => {
        const candidate = priorMeasures.get(measure.content.barIndex);
        return candidate && sameMeasure(candidate, measure) ? candidate : measure;
      });
      return old?.width === system.width && same(old.measures, reused)
        ? old
        : { ...system, measures: reused };
    });
    const systems = [...prior.systems.slice(0, prefix), ...tail];
    this.broken = { inputs, measures, systems };
    return systems;
  }

  drawSystem(
    score: Score,
    system: LayoutSystem,
    sharedInputs: readonly unknown[],
    draw: () => ScenePrimitive[]
  ): ScenePrimitive[] {
    const first = system.measures[0].content.barIndex;
    const last = system.measures[system.measures.length - 1].content.barIndex;
    // Cross-system ties examine the bordering track measures even when
    // the bars actually drawn on this system have not changed.
    const inputs = [
      ...sharedInputs,
      ...score.tracks.flatMap((track) => [track.bars[first - 1], track.bars[last + 1]])
    ];
    const known = this.drawings.get(system);
    if (known && same(known.inputs, inputs)) return known.value;

    const value = draw();
    this.drawings.set(system, { inputs, value });
    return value;
  }

  drawMeasure(
    measure: SystemMeasure,
    trackId: string,
    inputs: readonly unknown[],
    draw: () => ScenePrimitive[]
  ): ScenePrimitive[] {
    const tracks = this.measureDrawings.get(measure) ?? new Map<string, Keyed<ScenePrimitive[]>>();
    const known = tracks.get(trackId);
    if (known && same(known.inputs, inputs)) return known.value;

    const value = draw();
    tracks.set(trackId, { inputs, value });
    this.measureDrawings.set(measure, tracks);
    return value;
  }

  page(index: number, inputs: readonly unknown[], body: ScenePrimitive[], draw: () => ScenePage): ScenePage {
    const known = this.pages[index];
    if (known && same(known.inputs, inputs) && same(known.body, body)) return known.result;
    const result = draw();
    this.pages[index] = { inputs, body, result };
    return result;
  }

  finishPages(count: number): void {
    this.pages.length = count;
  }
}

export function trackLayoutInputs(track: Track): readonly unknown[] {
  return [
    track.id, track.kind, track.clef, track.name, track.shortName, track.color,
    track.notationTypes, track.staffConfig, track.tuning, track.transpositionTonality
  ];
}

function same(left: readonly unknown[], right: readonly unknown[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function sameMeasure(left: SystemMeasure, right: SystemMeasure): boolean {
  return left.content === right.content && left.x === right.x && left.width === right.width
    && left.showsSignature === right.showsSignature && left.tickPositions.length === right.tickPositions.length
    && left.tickPositions.every((position, index) => {
      const other = right.tickPositions[index];
      return position.tick === other.tick && position.x === other.x;
    });
}
