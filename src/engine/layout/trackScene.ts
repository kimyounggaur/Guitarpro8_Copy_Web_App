import { beatDurationTicks, writtenPitch } from "../../model/derive";
import type {
  Beat,
  BeatDuration,
  Note,
  NoteRef,
  Score,
  StemDirection,
  Track,
  Tuplet
} from "../../model/types";
import { validateBarDurations, type BarDurationIssue } from "../validate";
import { MUSIC_FONT_FAMILY, SMUFL } from "../render/smufl";
import {
  clefPrimitive,
  barHitRect,
  barlinePrimitive,
  beatHit,
  durationErrorRect,
  keySignaturePrimitive,
  standardStaffLines,
  tabLabelPrimitive,
  tabStaffLines,
  timeSignaturePrimitive,
  trackLabel
} from "./primitiveFactory";
import {
  BEAM_GAP,
  BEAM_THICKNESS,
  FLAG_WIDTH,
  NOTE_DOT_RADIUS,
  NOTE_HEAD_HEIGHT,
  NOTE_HEAD_WIDTH,
  STAFF_LINE_GAP,
  STANDARD_STAFF_HEIGHT,
  STEM_LENGTH,
  STEM_WIDTH,
  SYSTEM_LABEL_WIDTH,
  TAB_LINE_GAP,
  TAB_RHYTHM_GAP,
  TAB_RHYTHM_STEM_LENGTH,
  TAB_STAFF_TOP_GAP,
  TRACK_GAP,
  TUPLET_BRACKET_GAP
} from "./metrics";
import { tickToMeasureX } from "./measureContents";
import type { LinePrimitive, PathPrimitive, ScenePrimitive } from "./sceneGraph";
import type { SystemMeasure } from "./systemBreaker";

export interface SystemPrimitiveOptions {
  durationIssues?: BarDurationIssue[];
  editingBar?: { trackId?: string; barIndex: number };
}

interface NotePlacement {
  ref: NoteRef;
  note: Note;
  x: number;
  y: number;
  tabY: number;
}

interface StemGeometry {
  direction: "up" | "down";
  x: number;
  startY: number;
  endY: number;
}

interface BeatRenderPlacement {
  track: Track;
  barIndex: number;
  voiceIndex: number;
  beatIndex: number;
  beat: Beat;
  tick: number;
  x: number;
  staffY: number;
  tabY: number;
  tabBottomY: number;
  notePlacements: NotePlacement[];
  stem: StemGeometry | null;
  tabStem: StemGeometry | null;
  color: string;
}

interface TieAnchor {
  ref: NoteRef;
  x: number;
  y: number;
  voiceIndex: number;
  color: string;
}

const RHYTHM_BLACK = "#111827";
const INACTIVE_VOICE = "#999999";

export function systemPrimitives(
  score: Score,
  measures: SystemMeasure[],
  originX: number,
  originY: number,
  options: SystemPrimitiveOptions = {}
): ScenePrimitive[] {
  const primitives: ScenePrimitive[] = [];
  const durationIssues = options.durationIssues ?? validateBarDurations(score);
  const invalidBars = invalidBarKeySet(durationIssues, options.editingBar);
  let trackY = originY;

  score.tracks.forEach((track, trackIndex) => {
    primitives.push(
      ...trackPrimitives(score, track, trackIndex, measures, originX, trackY, invalidBars)
    );
    trackY += trackHeight(track) + TRACK_GAP;
  });

  return primitives;
}

function trackPrimitives(
  score: Score,
  track: Track,
  trackIndex: number,
  measures: SystemMeasure[],
  originX: number,
  originY: number,
  invalidBars: Set<string>
): ScenePrimitive[] {
  const primitives: ScenePrimitive[] = [];
  const staffX = originX + SYSTEM_LABEL_WIDTH;
  const tabY = originY + STANDARD_STAFF_HEIGHT + TAB_STAFF_TOP_GAP;
  const tabHeight = (track.tuning.strings.length - 1) * TAB_LINE_GAP;
  const trackBottom = tabY + tabHeight + TAB_RHYTHM_GAP + TAB_RHYTHM_STEM_LENGTH;
  const staffEndX = staffX + measures.reduce((max, measure) => Math.max(max, measure.x + measure.width), 0);

  primitives.push(trackLabel(track, trackIndex, originX, originY));
  primitives.push(...standardStaffLines(track.id, staffX, staffEndX, originY));
  primitives.push(...tabStaffLines(track.id, staffX, staffEndX, tabY, track.tuning.strings.length));
  primitives.push(clefPrimitive(track.id, staffX - 34, originY + STAFF_LINE_GAP * 3));
  primitives.push(tabLabelPrimitive(track.id, staffX - 38, tabY + TAB_LINE_GAP * 3));

  measures.forEach((measure) => {
    const x = staffX + measure.x;
    const masterBar = score.masterBars[measure.content.barIndex];
    const invalid = invalidBars.has(barKey(track.id, measure.content.barIndex));

    if (invalid) {
      primitives.push(
        durationErrorRect(
          track.id,
          measure.content.barIndex,
          x,
          originY - 4,
          measure.width,
          trackBottom - originY + 8
        )
      );
    }

    primitives.push(
      barlinePrimitive(
        track.id,
        measure.content.barIndex,
        x,
        originY,
        tabY + tabHeight,
        invalid ? "#ef4444" : undefined
      )
    );
    primitives.push(barHitRect(track.id, measure.content.barIndex, x, originY, measure.width, tabY + tabHeight));

    if (measure.x === 0) {
      primitives.push(
        timeSignaturePrimitive(track.id, measure.content.barIndex, x + 24, originY, masterBar.timeSignature.numerator, masterBar.timeSignature.denominator)
      );
      primitives.push(keySignaturePrimitive(track.id, measure.content.barIndex, x + 46, originY, masterBar.keySignature.key));
    }

    primitives.push(
      ...beatAndRhythmPrimitives(track, measure.content.barIndex, measure, x, originY, tabY)
    );
  });

  primitives.push(...tiePrimitivesForSystem(track, measures, staffX, originY));

  const finalMeasure = measures[measures.length - 1];
  if (finalMeasure) {
    primitives.push(
      barlinePrimitive(track.id, finalMeasure.content.barIndex, staffX + finalMeasure.x + finalMeasure.width, originY, tabY + tabHeight)
    );
  }

  return primitives;
}

function beatAndRhythmPrimitives(
  track: Track,
  barIndex: number,
  measure: SystemMeasure,
  measureX: number,
  staffY: number,
  tabY: number
): ScenePrimitive[] {
  const bar = track.bars[barIndex];

  if (!bar) {
    return [];
  }

  const primitives: ScenePrimitive[] = [];
  const activeVoiceCount = bar.voices.filter((voice) => voice.beats.length > 0).length;

  bar.voices.forEach((voice, voiceIndex) => {
    if (voice.beats.length === 0) {
      return;
    }

    const placements = createVoicePlacements(
      track,
      barIndex,
      voiceIndex,
      voice.beats,
      activeVoiceCount,
      measure,
      measureX,
      staffY,
      tabY
    );
    const beamGroups = createBeamGroups(placements);
    const beamedIds = new Set(
      beamGroups
        .filter((group) => group.length > 1)
        .flatMap((group) => group.map((placement) => beatPlacementId(placement)))
    );

    placements.forEach((placement) => {
      primitives.push(...beatPrimitives(placement, beamedIds.has(beatPlacementId(placement))));
    });

    primitives.push(...beamGroupPrimitives(beamGroups, "standard"));
    primitives.push(...beamGroupPrimitives(beamGroups, "tab"));
    primitives.push(...tupletPrimitives(placements));
  });

  return primitives;
}

function createVoicePlacements(
  track: Track,
  barIndex: number,
  voiceIndex: number,
  beats: Beat[],
  activeVoiceCount: number,
  measure: SystemMeasure,
  measureX: number,
  staffY: number,
  tabY: number
): BeatRenderPlacement[] {
  let tick = 0;
  const placements: BeatRenderPlacement[] = [];

  beats.forEach((beat, beatIndex) => {
    const x = measureX + 16 + tickToMeasureX(measure.content, tick, measure.width - 28);
    const color = voiceColor(voiceIndex);
    const notePlacements = beat.notes.map((note, noteIndex) => ({
      ref: { trackId: track.id, barIndex, voiceIndex, beatIndex, noteIndex },
      note,
      x,
      y: pitchToStaffY(writtenPitch(note, track, { concertTone: true, ottava: beat.ottava }), staffY),
      tabY: tabY + (note.string - 1) * TAB_LINE_GAP + 4
    }));
    const direction = resolveStemDirection(beat, voiceIndex, activeVoiceCount, notePlacements, staffY);
    const stem = createStemGeometry(beat, notePlacements, x, direction);
    const tabBottomY = tabY + (track.tuning.strings.length - 1) * TAB_LINE_GAP;
    const tabRhythmBaseY = tabBottomY + TAB_RHYTHM_GAP + voiceIndex * 6;

    placements.push({
      track,
      barIndex,
      voiceIndex,
      beatIndex,
      beat,
      tick,
      x,
      staffY,
      tabY,
      tabBottomY,
      notePlacements,
      stem,
      tabStem:
        beat.duration === 1
          ? null
          : {
              direction: "down",
              x,
              startY: tabRhythmBaseY,
              endY: tabRhythmBaseY + TAB_RHYTHM_STEM_LENGTH
            },
      color
    });

    tick += beatDurationTicks(beat);
  });

  return placements;
}

function beatPrimitives(placement: BeatRenderPlacement, isBeamed: boolean): ScenePrimitive[] {
  if (placement.beat.rest || placement.notePlacements.length === 0) {
    return restPrimitives(placement);
  }

  const primitives = placement.notePlacements.flatMap((notePlacement) => [
    noteHeadPrimitive(placement, notePlacement),
    tabFretPrimitive(placement, notePlacement),
    ...dotPrimitives(placement.beat.dots, placement.x + 12, notePlacement.y, placement.color)
  ]);

  if (placement.stem) {
    primitives.push(stemLine(placement, placement.stem, "standard"));
  }

  if (placement.tabStem) {
    primitives.push(stemLine(placement, placement.tabStem, "tab"));
  }

  if (isBeamable(placement) && !isBeamed) {
    primitives.push(...flagPrimitives(placement, "standard"));
    primitives.push(...flagPrimitives(placement, "tab"));
  }

  return primitives;
}

function noteHeadPrimitive(
  placement: BeatRenderPlacement,
  notePlacement: NotePlacement
): ScenePrimitive {
  const openHead = placement.beat.duration === 1 || placement.beat.duration === 2;

  return {
    id: `${noteId(notePlacement.ref)}-head`,
    type: "ellipse",
    cx: notePlacement.x,
    cy: notePlacement.y,
    rx: NOTE_HEAD_WIDTH / 2,
    ry: NOTE_HEAD_HEIGHT / 2,
    fill: openHead ? "#fbfaf7" : placement.color,
    stroke: placement.color,
    strokeWidth: 1.2,
    hit: {
      kind: "note",
      ref: notePlacement.ref,
      bbox: { x: notePlacement.x - 8, y: notePlacement.y - 8, width: 16, height: 16 }
    }
  };
}

function tabFretPrimitive(
  placement: BeatRenderPlacement,
  notePlacement: NotePlacement
): ScenePrimitive {
  return {
    id: `${noteId(notePlacement.ref)}-tab`,
    type: "text",
    x: notePlacement.x,
    y: notePlacement.tabY,
    text: String(notePlacement.note.fret),
    fill: placement.color,
    fontSize: 11,
    anchor: "middle",
    hit: {
      kind: "note",
      ref: notePlacement.ref,
      bbox: { x: notePlacement.x - 8, y: notePlacement.tabY - 10, width: 16, height: 14 }
    }
  };
}

function restPrimitives(placement: BeatRenderPlacement): ScenePrimitive[] {
  const restY = restYForDuration(placement.beat.duration, placement.staffY, placement.voiceIndex);
  const primitives: ScenePrimitive[] = [
    {
      id: `${beatPlacementId(placement)}-rest-${placement.beat.duration}`,
      type: "text",
      x: placement.x,
      y: restY,
      text: restGlyph(placement.beat.duration),
      fill: placement.color,
      fontSize: 22,
      fontFamily: MUSIC_FONT_FAMILY,
      anchor: "middle",
      hit: beatHit(
        {
          trackId: placement.track.id,
          barIndex: placement.barIndex,
          voiceIndex: placement.voiceIndex,
          beatIndex: placement.beatIndex
        },
        placement.x,
        placement.staffY
      )
    },
    ...dotPrimitives(placement.beat.dots, placement.x + 11, restY - 5, placement.color)
  ];

  if (placement.tabStem) {
    primitives.push(stemLine(placement, placement.tabStem, "tab"));
  }

  if (isBeamable(placement)) {
    primitives.push(...flagPrimitives(placement, "tab"));
  }

  return primitives;
}

function dotPrimitives(count: number, x: number, y: number, color: string): ScenePrimitive[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `dot-${x}-${y}-${index}`,
    type: "ellipse" as const,
    cx: x + index * 6,
    cy: y,
    rx: NOTE_DOT_RADIUS,
    ry: NOTE_DOT_RADIUS,
    fill: color
  }));
}

function stemLine(
  placement: BeatRenderPlacement,
  stem: StemGeometry,
  layer: "standard" | "tab"
): LinePrimitive {
  return {
    id: `${beatPlacementId(placement)}-${layer}-stem`,
    type: "line",
    x1: stem.x,
    y1: stem.startY,
    x2: stem.x,
    y2: stem.endY,
    stroke: placement.color,
    strokeWidth: STEM_WIDTH,
    strokeLinecap: "round"
  };
}

function flagPrimitives(
  placement: BeatRenderPlacement,
  layer: "standard" | "tab"
): PathPrimitive[] {
  const stem = layer === "standard" ? placement.stem : placement.tabStem;

  if (!stem) {
    return [];
  }

  return Array.from({ length: beamLevel(placement.beat.duration) }, (_, index) => {
    const offset = index * BEAM_GAP;
    const y = stem.direction === "up" ? stem.endY + offset : stem.endY - offset;
    const d =
      stem.direction === "up"
        ? `M ${stem.x} ${y} C ${stem.x + FLAG_WIDTH} ${y + 2}, ${stem.x + FLAG_WIDTH} ${y + 12}, ${stem.x + 3} ${y + 17}`
        : `M ${stem.x} ${y} C ${stem.x + FLAG_WIDTH} ${y - 2}, ${stem.x + FLAG_WIDTH} ${y - 12}, ${stem.x + 3} ${y - 17}`;

    return {
      id: `${beatPlacementId(placement)}-${layer}-flag-${index}`,
      type: "path",
      d,
      fill: "none",
      stroke: placement.color,
      strokeWidth: STEM_WIDTH,
      strokeLinecap: "round"
    };
  });
}

function createBeamGroups(placements: BeatRenderPlacement[]): BeatRenderPlacement[][] {
  const groups: BeatRenderPlacement[][] = [];
  let current: BeatRenderPlacement[] = [];
  let currentQuarter = -1;

  placements.forEach((placement) => {
    if (!isBeamable(placement)) {
      pushBeamGroup(groups, current);
      current = [];
      currentQuarter = -1;
      return;
    }

    const quarter = Math.floor(placement.tick / 480);
    const forcedGroup = placement.beat.beamMode === "force" || placement.beat.beamMode === "forceGroup";
    const startsNewGroup =
      placement.beat.beamMode === "break" ||
      (current.length > 0 && quarter !== currentQuarter && !forcedGroup);

    if (startsNewGroup) {
      pushBeamGroup(groups, current);
      current = [];
    }

    current.push(placement);
    currentQuarter = currentQuarter === -1 || !forcedGroup ? quarter : currentQuarter;
  });

  pushBeamGroup(groups, current);
  return groups;
}

function pushBeamGroup(groups: BeatRenderPlacement[][], current: BeatRenderPlacement[]): void {
  if (current.length > 0) {
    groups.push(current);
  }
}

function beamGroupPrimitives(
  groups: BeatRenderPlacement[][],
  layer: "standard" | "tab"
): ScenePrimitive[] {
  const primitives: ScenePrimitive[] = [];

  groups
    .filter((group) => group.length > 1)
    .forEach((group) => {
      const maxLevel = Math.max(...group.map((placement) => beamLevel(placement.beat.duration)));

      for (let level = 0; level < maxLevel; level += 1) {
        beamSegments(group, level).forEach(([first, last], segmentIndex) => {
          primitives.push(beamPrimitive(first, last, level, segmentIndex, layer));
        });
      }
    });

  return primitives;
}

function beamSegments(
  group: BeatRenderPlacement[],
  level: number
): Array<[BeatRenderPlacement, BeatRenderPlacement]> {
  if (level === 0) {
    return [[group[0], group[group.length - 1]]];
  }

  const segments: Array<[BeatRenderPlacement, BeatRenderPlacement]> = [];
  let start: BeatRenderPlacement | null = null;
  let previous: BeatRenderPlacement | null = null;

  group.forEach((placement) => {
    const participates = beamLevel(placement.beat.duration) > level;
    const breakSecondary = placement.beat.beamMode === "breakSecondary";

    if (!participates || breakSecondary) {
      if (start && previous && start !== previous) {
        segments.push([start, previous]);
      }
      start = null;
      previous = null;
      return;
    }

    start ??= placement;
    previous = placement;
  });

  if (start && previous && start !== previous) {
    segments.push([start, previous]);
  }

  return segments;
}

function beamPrimitive(
  first: BeatRenderPlacement,
  last: BeatRenderPlacement,
  level: number,
  segmentIndex: number,
  layer: "standard" | "tab"
): PathPrimitive {
  const firstStem = layer === "standard" ? first.stem : first.tabStem;
  const lastStem = layer === "standard" ? last.stem : last.tabStem;

  if (!firstStem || !lastStem) {
    return emptyPath(`${beatPlacementId(first)}-${layer}-beam-empty-${level}-${segmentIndex}`);
  }

  const direction = firstStem.direction;
  const y =
    direction === "up"
      ? Math.min(firstStem.endY, lastStem.endY) + level * BEAM_GAP
      : Math.max(firstStem.endY, lastStem.endY) - level * BEAM_GAP - BEAM_THICKNESS;
  const x1 = firstStem.x;
  const x2 = lastStem.x;

  return {
    id: `${beatPlacementId(first)}-${layer}-beam-${level}-${segmentIndex}`,
    type: "path",
    d: `M ${x1} ${y} L ${x2} ${y} L ${x2} ${y + BEAM_THICKNESS} L ${x1} ${y + BEAM_THICKNESS} Z`,
    fill: first.color
  };
}

function tupletPrimitives(placements: BeatRenderPlacement[]): ScenePrimitive[] {
  const primitives: ScenePrimitive[] = [];
  const maxDepth = Math.max(0, ...placements.map((placement) => tupletChain(placement.beat.tuplet).length));

  for (let depth = 0; depth < maxDepth; depth += 1) {
    let group: BeatRenderPlacement[] = [];
    let key = "";

    placements.forEach((placement) => {
      const chain = tupletChain(placement.beat.tuplet);
      const tuplet = chain[depth];
      const nextKey = tuplet ? `${tuplet.n}:${tuplet.m}` : "";

      if (!tuplet || (group.length > 0 && nextKey !== key)) {
        primitives.push(...tupletBracket(group, depth, key));
        group = [];
      }

      if (tuplet) {
        group.push(placement);
        key = nextKey;
      }
    });

    primitives.push(...tupletBracket(group, depth, key));
  }

  return primitives;
}

function tupletBracket(group: BeatRenderPlacement[], depth: number, key: string): ScenePrimitive[] {
  if (group.length < 2 || !key) {
    return [];
  }

  const first = group[0];
  const last = group[group.length - 1];
  const number = key.split(":")[0];
  const above = first.voiceIndex !== 1;
  const y = above
    ? first.staffY - 16 - depth * TUPLET_BRACKET_GAP
    : first.staffY + STANDARD_STAFF_HEIGHT + 18 + depth * TUPLET_BRACKET_GAP;
  const hook = above ? 5 : -5;
  const x1 = first.x - 8;
  const x2 = last.x + 8;
  const id = `${beatPlacementId(first)}-tuplet-${depth}`;

  return [
    bracketLine(`${id}-left-hook`, x1, y, x1, y + hook, first.color),
    bracketLine(`${id}-top`, x1, y, x2, y, first.color),
    bracketLine(`${id}-right-hook`, x2, y, x2, y + hook, first.color),
    {
      id: `${id}-number`,
      type: "text",
      x: (x1 + x2) / 2,
      y: y - (above ? 3 : -11),
      text: number,
      fill: first.color,
      fontSize: 10,
      anchor: "middle"
    }
  ];
}

function tiePrimitivesForSystem(
  track: Track,
  measures: SystemMeasure[],
  staffX: number,
  staffY: number
): ScenePrimitive[] {
  const anchors = new Map<string, TieAnchor>();
  const primitives: ScenePrimitive[] = [];
  const firstMeasure = measures[0];
  const lastMeasure = measures[measures.length - 1];

  if (!firstMeasure || !lastMeasure) {
    return [];
  }

  measures.forEach((measure) => {
    const measureX = staffX + measure.x;
    const bar = track.bars[measure.content.barIndex];

    bar?.voices.forEach((voice, voiceIndex) => {
      let tick = 0;

      voice.beats.forEach((beat, beatIndex) => {
        const x = measureX + 16 + tickToMeasureX(measure.content, tick, measure.width - 28);
        beat.notes.forEach((note, noteIndex) => {
          const ref = {
            trackId: track.id,
            barIndex: measure.content.barIndex,
            voiceIndex,
            beatIndex,
            noteIndex
          };

          anchors.set(noteRefKey(ref), {
            ref,
            x,
            y: pitchToStaffY(writtenPitch(note, track, { concertTone: true, ottava: beat.ottava }), staffY),
            voiceIndex,
            color: voiceColor(voiceIndex)
          });
        });

        tick += beatDurationTicks(beat);
      });
    });
  });

  const systemStartX = staffX + firstMeasure.x + 8;
  const systemEndX = staffX + lastMeasure.x + lastMeasure.width - 8;

  measures.forEach((measure) => {
    const bar = track.bars[measure.content.barIndex];

    bar?.voices.forEach((voice, voiceIndex) => {
      voice.beats.forEach((beat, beatIndex) => {
        beat.notes.forEach((note, noteIndex) => {
          const currentRef = {
            trackId: track.id,
            barIndex: measure.content.barIndex,
            voiceIndex,
            beatIndex,
            noteIndex
          };

          if (note.tieDestination) {
            const source = anchors.get(noteRefKey(currentRef));
            const destination = anchors.get(noteRefKey(note.tieDestination));

            if (source && destination) {
              primitives.push(tiePrimitive(source, destination));
            } else if (source) {
              primitives.push(tieToEdgePrimitive(source, systemEndX, "end"));
            }
          }

          if (note.tieOrigin) {
            const destination = anchors.get(noteRefKey(currentRef));
            const origin = anchors.get(noteRefKey(note.tieOrigin));

            if (!origin && destination) {
              primitives.push(tieToEdgePrimitive(destination, systemStartX, "start"));
            }
          }
        });
      });
    });
  });

  return primitives;
}

function tiePrimitive(source: TieAnchor, destination: TieAnchor): PathPrimitive {
  const above = source.voiceIndex !== 1;
  const lift = above ? -14 : 14;
  const startY = source.y + (above ? -5 : 5);
  const endY = destination.y + (above ? -5 : 5);
  const controlY = Math.min(startY, endY) + lift;

  return {
    id: `${noteId(source.ref)}-tie`,
    type: "path",
    d: `M ${source.x + 7} ${startY} C ${source.x + 18} ${controlY}, ${destination.x - 18} ${controlY}, ${destination.x - 7} ${endY}`,
    fill: "none",
    stroke: source.color,
    strokeWidth: 1.3,
    strokeLinecap: "round"
  };
}

function tieToEdgePrimitive(anchor: TieAnchor, edgeX: number, side: "start" | "end"): PathPrimitive {
  const above = anchor.voiceIndex !== 1;
  const y = anchor.y + (above ? -5 : 5);
  const controlY = y + (above ? -14 : 14);
  const startX = side === "start" ? edgeX : anchor.x + 7;
  const endX = side === "start" ? anchor.x - 7 : edgeX;

  return {
    id: `${noteId(anchor.ref)}-tie-${side}`,
    type: "path",
    d: `M ${startX} ${y} C ${(startX + endX) / 2 - 18} ${controlY}, ${(startX + endX) / 2 + 18} ${controlY}, ${endX} ${y}`,
    fill: "none",
    stroke: anchor.color,
    strokeWidth: 1.3,
    strokeLinecap: "round"
  };
}

function bracketLine(id: string, x1: number, y1: number, x2: number, y2: number, color: string): LinePrimitive {
  return {
    id,
    type: "line",
    x1,
    y1,
    x2,
    y2,
    stroke: color,
    strokeWidth: 1,
    strokeLinecap: "round"
  };
}

function createStemGeometry(
  beat: Beat,
  notePlacements: NotePlacement[],
  x: number,
  direction: "up" | "down"
): StemGeometry | null {
  if (beat.duration === 1 || beat.rest || notePlacements.length === 0) {
    return null;
  }

  const noteY =
    direction === "up"
      ? Math.min(...notePlacements.map((placement) => placement.y))
      : Math.max(...notePlacements.map((placement) => placement.y));
  const stemX = direction === "up" ? x + NOTE_HEAD_WIDTH / 2 : x - NOTE_HEAD_WIDTH / 2;

  return {
    direction,
    x: stemX,
    startY: noteY,
    endY: direction === "up" ? noteY - STEM_LENGTH : noteY + STEM_LENGTH
  };
}

function resolveStemDirection(
  beat: Beat,
  voiceIndex: number,
  activeVoiceCount: number,
  notePlacements: NotePlacement[],
  staffY: number
): "up" | "down" {
  if (beat.stemDirection !== "auto") {
    return beat.stemDirection;
  }

  if (activeVoiceCount > 1) {
    return voiceIndex === 1 ? "down" : "up";
  }

  return autoStemDirection(notePlacements, beat.stemDirection, staffY);
}

function autoStemDirection(
  notePlacements: NotePlacement[],
  override: StemDirection,
  staffY: number
): "up" | "down" {
  if (override !== "auto") {
    return override;
  }

  if (notePlacements.length === 0) {
    return "up";
  }

  const averageY =
    notePlacements.reduce((sum, placement) => sum + placement.y, 0) / notePlacements.length;
  const staffCenterY = staffY + STAFF_LINE_GAP * 2;

  return averageY > staffCenterY ? "up" : "down";
}

function isBeamable(placement: BeatRenderPlacement): boolean {
  return !placement.beat.rest && placement.notePlacements.length > 0 && placement.beat.duration >= 8;
}

function beamLevel(duration: BeatDuration): number {
  if (duration >= 64) {
    return 4;
  }

  if (duration >= 32) {
    return 3;
  }

  if (duration >= 16) {
    return 2;
  }

  if (duration >= 8) {
    return 1;
  }

  return 0;
}

function restGlyph(duration: BeatDuration): string {
  const rests: Record<BeatDuration, string> = {
    1: SMUFL.restWhole,
    2: SMUFL.restHalf,
    4: SMUFL.restQuarter,
    8: SMUFL.rest8th,
    16: SMUFL.rest16th,
    32: SMUFL.rest32nd,
    64: SMUFL.rest64th
  };

  return rests[duration];
}

function restYForDuration(duration: BeatDuration, staffY: number, voiceIndex: number): number {
  const voiceOffset = voiceIndex === 1 ? 12 : voiceIndex > 1 ? 18 : 0;

  if (duration === 1) {
    return staffY + STAFF_LINE_GAP * 2 + voiceOffset;
  }

  if (duration === 2) {
    return staffY + STAFF_LINE_GAP * 3 + voiceOffset;
  }

  return staffY + STAFF_LINE_GAP * 3.2 + voiceOffset;
}

function tupletChain(tuplet: Tuplet | undefined): Tuplet[] {
  if (!tuplet) {
    return [];
  }

  return [...tupletChain(tuplet.parent), tuplet];
}

function emptyPath(id: string): PathPrimitive {
  return {
    id,
    type: "path",
    d: "",
    fill: "none"
  };
}

function invalidBarKeySet(
  issues: BarDurationIssue[],
  editingBar: SystemPrimitiveOptions["editingBar"]
): Set<string> {
  return new Set(
    issues
      .filter((issue) => {
        if (!editingBar || editingBar.barIndex !== issue.barIndex) {
          return true;
        }

        return editingBar.trackId !== undefined && editingBar.trackId !== issue.trackId;
      })
      .map((issue) => barKey(issue.trackId, issue.barIndex))
  );
}

function barKey(trackId: string, barIndex: number): string {
  return `${trackId}:${barIndex}`;
}

function beatPlacementId(placement: BeatRenderPlacement): string {
  return `${placement.track.id}-${placement.barIndex}-${placement.voiceIndex}-${placement.beatIndex}`;
}

function noteId(ref: NoteRef): string {
  return `${ref.trackId}-${ref.barIndex}-${ref.voiceIndex}-${ref.beatIndex}-${ref.noteIndex}`;
}

function noteRefKey(ref: NoteRef): string {
  return `${ref.trackId}:${ref.barIndex}:${ref.voiceIndex}:${ref.beatIndex}:${ref.noteIndex}`;
}

function voiceColor(voiceIndex: number): string {
  if (voiceIndex >= 2) {
    return INACTIVE_VOICE;
  }

  return voiceIndex === 1 ? "#374151" : RHYTHM_BLACK;
}

function pitchToStaffY(pitch: number, staffY: number): number {
  let displayPitch = pitch;

  while (displayPitch < 55) {
    displayPitch += 12;
  }

  while (displayPitch > 76) {
    displayPitch -= 12;
  }

  return staffY + STAFF_LINE_GAP * 4 - (displayPitch - 60) * (STAFF_LINE_GAP / 2);
}

function trackHeight(track: Track): number {
  return (
    STANDARD_STAFF_HEIGHT +
    TAB_STAFF_TOP_GAP +
    (track.tuning.strings.length - 1) * TAB_LINE_GAP +
    TAB_RHYTHM_GAP +
    TAB_RHYTHM_STEM_LENGTH
  );
}
