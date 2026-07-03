import { beatDurationTicks, writtenPitch } from "../../model/derive";
import { normalizeStylesheet } from "../../model/stylesheet";
import type {
  Beat,
  BeatDuration,
  DirectionJump,
  DirectionTarget,
  MasterBar,
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
  TUPLET_BRACKET_GAP
} from "./metrics";
import { tickToMeasureX } from "./measureContents";
import type { HitKind, LinePrimitive, PathPrimitive, ScenePrimitive } from "./sceneGraph";
import type { SystemMeasure } from "./systemBreaker";

export interface SystemPrimitiveOptions {
  durationIssues?: BarDurationIssue[];
  editingBar?: { trackId?: string; barIndex: number };
  concertTone?: boolean;
  activeVoiceIndex?: number;
  multiVoiceEdit?: boolean;
  trackGap?: number;
}

interface TrackPrimitiveOptions {
  concertTone: boolean;
  activeVoiceIndex: number;
  multiVoiceEdit: boolean;
  trackGap: number;
  staffLineColor: string;
  staffLineThickness: number;
  barlineColor: string;
  barlineThickness: number;
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
const SYMBOL_TEXT = "#1f2937";
const SYMBOL_MUTED = "#4b5563";
const EFFECT_BLUE = "#1d4ed8";

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
  const stylesheet = normalizeStylesheet(score.stylesheet);
  const renderOptions: TrackPrimitiveOptions = {
    concertTone: options.concertTone ?? score.documentSettings.concertTone,
    activeVoiceIndex: options.activeVoiceIndex ?? 0,
    multiVoiceEdit: options.multiVoiceEdit ?? false,
    trackGap: options.trackGap ?? stylesheet.systems.trackGap,
    staffLineColor: stylesheet.systems.staffLineColor,
    staffLineThickness: stylesheet.systems.staffLineThickness,
    barlineColor: stylesheet.systems.barlineColor,
    barlineThickness: stylesheet.systems.barlineThickness
  };
  let trackY = originY;

  score.tracks.forEach((track, trackIndex) => {
    primitives.push(
      ...trackPrimitives(score, track, trackIndex, measures, originX, trackY, invalidBars, renderOptions)
    );
    trackY += trackHeight(track) + renderOptions.trackGap;
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
  invalidBars: Set<string>,
  options: TrackPrimitiveOptions
): ScenePrimitive[] {
  const primitives: ScenePrimitive[] = [];
  const staffX = originX + SYSTEM_LABEL_WIDTH;
  const tabY = originY + STANDARD_STAFF_HEIGHT + TAB_STAFF_TOP_GAP;
  const tabHeight = (track.tuning.strings.length - 1) * TAB_LINE_GAP;
  const trackBottom = tabY + tabHeight + TAB_RHYTHM_GAP + TAB_RHYTHM_STEM_LENGTH;
  const staffEndX = staffX + measures.reduce((max, measure) => Math.max(max, measure.x + measure.width), 0);

  primitives.push(trackLabel(track, trackIndex, originX, originY));
  primitives.push(
    ...standardStaffLines(track.id, staffX, staffEndX, originY, {
      stroke: options.staffLineColor,
      strokeWidth: options.staffLineThickness
    })
  );
  primitives.push(
    ...tabStaffLines(track.id, staffX, staffEndX, tabY, track.tuning.strings.length, {
      stroke: options.staffLineColor,
      strokeWidth: options.staffLineThickness
    })
  );
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
        invalid ? "#ef4444" : options.barlineColor,
        invalid ? options.barlineThickness + 0.5 : options.barlineThickness
      )
    );
    primitives.push(barHitRect(track.id, measure.content.barIndex, x, originY, measure.width, tabY + tabHeight));

    if (trackIndex === 0) {
      primitives.push(
        ...masterBarSymbolPrimitives(masterBar, measure, x, measure.width, originY, tabY + tabHeight)
      );
    }

    if (measure.x === 0) {
      primitives.push(
        timeSignaturePrimitive(track.id, measure.content.barIndex, x + 24, originY, masterBar.timeSignature.numerator, masterBar.timeSignature.denominator)
      );
      primitives.push(keySignaturePrimitive(track.id, measure.content.barIndex, x + 46, originY, masterBar.keySignature.key));
    }

    primitives.push(
      ...beatAndRhythmPrimitives(track, measure.content.barIndex, measure, x, originY, tabY, options)
    );
  });

  primitives.push(...tiePrimitivesForSystem(track, measures, staffX, originY, options));

  const finalMeasure = measures[measures.length - 1];
  if (finalMeasure) {
    primitives.push(
      barlinePrimitive(
        track.id,
        finalMeasure.content.barIndex,
        staffX + finalMeasure.x + finalMeasure.width,
        originY,
        tabY + tabHeight,
        options.barlineColor,
        options.barlineThickness
      )
    );
  }

  return primitives;
}

function masterBarSymbolPrimitives(
  masterBar: MasterBar,
  measure: SystemMeasure,
  x: number,
  width: number,
  staffY: number,
  bottomY: number
): ScenePrimitive[] {
  const barIndex = measure.content.barIndex;
  const rightX = x + width;
  const centerX = x + width / 2;
  const primitives: ScenePrimitive[] = [];

  if (masterBar.section) {
    const label = `${masterBar.section.letter} ${masterBar.section.name}`.trim();
    const rectWidth = Math.min(Math.max(label.length * 6 + 14, 34), width - 8);
    primitives.push({
      id: `master-${barIndex}-section-box`,
      type: "rect",
      x: x + 4,
      y: staffY - 50,
      width: rectWidth,
      height: 18,
      fill: masterBar.section.boxed ? "#f8fafc" : "transparent",
      stroke: SYMBOL_TEXT,
      strokeWidth: masterBar.section.boxed ? 1 : 0,
      radius: 2,
      hit: symbolHit("section", barIndex, x + 4, staffY - 50, rectWidth, 18)
    });
    primitives.push(symbolText(`master-${barIndex}-section-text`, label, x + 10, staffY - 37, 11, "start", "section", barIndex));
  }

  if (masterBar.alternateEndings > 0) {
    const y = staffY - 24;
    const label = alternateEndingLabel(masterBar.alternateEndings);
    primitives.push({
      id: `master-${barIndex}-volta-hit`,
      type: "rect",
      x: x + 2,
      y: y - 10,
      width: width - 6,
      height: 18,
      fill: "transparent",
      hit: symbolHit("volta", barIndex, x + 2, y - 10, width - 6, 18)
    });
    primitives.push(bracketLine(`master-${barIndex}-volta-left`, x + 4, y, x + 4, y + 10, SYMBOL_TEXT));
    primitives.push(bracketLine(`master-${barIndex}-volta-top`, x + 4, y, rightX - 4, y, SYMBOL_TEXT));
    primitives.push(symbolText(`master-${barIndex}-volta-label`, label, x + 10, y - 3, 10, "start", "volta", barIndex));
  }

  if (masterBar.repeatOpen) {
    primitives.push(...repeatOpenPrimitives(barIndex, x, staffY, bottomY));
  }

  if (masterBar.repeatClose > 0) {
    primitives.push(...repeatClosePrimitives(barIndex, rightX, staffY, bottomY, masterBar.repeatClose));
  }

  if (masterBar.doubleBar) {
    primitives.push(bracketLine(`master-${barIndex}-double-bar-outer`, rightX - 5, staffY - 2, rightX - 5, bottomY + 2, SYMBOL_TEXT));
    primitives.push(bracketLine(`master-${barIndex}-double-bar-inner`, rightX - 9, staffY - 2, rightX - 9, bottomY + 2, SYMBOL_TEXT));
  }

  masterBar.directionTargets.forEach((target, index) => {
    primitives.push(
      symbolText(
        `master-${barIndex}-direction-target-${index}`,
        directionTargetLabel(target),
        x + 14 + index * 44,
        staffY - 8,
        11,
        "start",
        "direction",
        barIndex
      )
    );
  });

  masterBar.directionJumps.forEach((jump, index) => {
    primitives.push(
      symbolText(
        `master-${barIndex}-direction-jump-${index}`,
        directionJumpLabel(jump),
        rightX - 8 - index * 44,
        staffY - 8,
        11,
        "end",
        "direction",
        barIndex
      )
    );
  });

  if (masterBar.tripletFeel) {
    primitives.push(
      symbolText(
        `master-${barIndex}-triplet-feel`,
        masterBar.tripletFeel,
        centerX,
        staffY - 8,
        10,
        "middle",
        "barSymbol",
        barIndex
      )
    );
  }

  if (masterBar.freeTime) {
    primitives.push(symbolText(`master-${barIndex}-free-time`, "free time", centerX, bottomY + 15, 10, "middle", "barSymbol", barIndex));
  }

  if (masterBar.anacrusis) {
    primitives.push(symbolText(`master-${barIndex}-anacrusis`, "pickup", x + 12, bottomY + 15, 10, "start", "barSymbol", barIndex));
  }

  if (masterBar.simileMark !== "none") {
    primitives.push(
      symbolText(
        `master-${barIndex}-simile`,
        masterBar.simileMark === "single" ? "%" : "%%",
        centerX,
        staffY + STAFF_LINE_GAP * 2.5,
        18,
        "middle",
        "barSymbol",
        barIndex
      )
    );
  }

  masterBar.fermatas.forEach((fermata, index) => {
    const fermataX = x + 16 + tickToMeasureX(measure.content, fermata.beatTick, width - 28);
    primitives.push({
      id: `master-${barIndex}-fermata-${index}`,
      type: "text",
      x: fermataX,
      y: staffY - 8,
      text: SMUFL.fermataAbove,
      fill: SYMBOL_TEXT,
      fontSize: 20,
      fontFamily: MUSIC_FONT_FAMILY,
      anchor: "middle",
      hit: symbolHit("fermata", barIndex, fermataX - 10, staffY - 28, 20, 22)
    });
  });

  return primitives;
}

function repeatOpenPrimitives(barIndex: number, x: number, staffY: number, bottomY: number): ScenePrimitive[] {
  return [
    {
      id: `master-${barIndex}-repeat-open-thick`,
      type: "line",
      x1: x + 5,
      y1: staffY - 2,
      x2: x + 5,
      y2: bottomY + 2,
      stroke: SYMBOL_TEXT,
      strokeWidth: 3,
      hit: symbolHit("repeat", barIndex, x, staffY - 4, 18, bottomY - staffY + 8)
    },
    bracketLine(`master-${barIndex}-repeat-open-thin`, x + 10, staffY - 2, x + 10, bottomY + 2, SYMBOL_TEXT),
    repeatDot(`master-${barIndex}-repeat-open-mark-1`, x + 15, staffY + STAFF_LINE_GAP * 1.5, barIndex),
    repeatDot(`master-${barIndex}-repeat-open-mark-2`, x + 15, staffY + STAFF_LINE_GAP * 2.5, barIndex)
  ];
}

function repeatClosePrimitives(
  barIndex: number,
  rightX: number,
  staffY: number,
  bottomY: number,
  repeatCount: number
): ScenePrimitive[] {
  const primitives: ScenePrimitive[] = [
    bracketLine(`master-${barIndex}-repeat-close-thin`, rightX - 10, staffY - 2, rightX - 10, bottomY + 2, SYMBOL_TEXT),
    {
      id: `master-${barIndex}-repeat-close-thick`,
      type: "line",
      x1: rightX - 5,
      y1: staffY - 2,
      x2: rightX - 5,
      y2: bottomY + 2,
      stroke: SYMBOL_TEXT,
      strokeWidth: 3,
      hit: symbolHit("repeat", barIndex, rightX - 18, staffY - 4, 18, bottomY - staffY + 8)
    },
    repeatDot(`master-${barIndex}-repeat-close-mark-1`, rightX - 15, staffY + STAFF_LINE_GAP * 1.5, barIndex),
    repeatDot(`master-${barIndex}-repeat-close-mark-2`, rightX - 15, staffY + STAFF_LINE_GAP * 2.5, barIndex)
  ];

  if (repeatCount > 2) {
    primitives.push(symbolText(`master-${barIndex}-repeat-count`, `x${repeatCount}`, rightX - 18, staffY - 8, 10, "end", "repeat", barIndex));
  }

  return primitives;
}

function repeatDot(id: string, cx: number, cy: number, barIndex: number): ScenePrimitive {
  return {
    id,
    type: "ellipse",
    cx,
    cy,
    rx: 2,
    ry: 2,
    fill: SYMBOL_TEXT,
    hit: symbolHit("repeat", barIndex, cx - 4, cy - 4, 8, 8)
  };
}

function beatAndRhythmPrimitives(
  track: Track,
  barIndex: number,
  measure: SystemMeasure,
  measureX: number,
  staffY: number,
  tabY: number,
  options: TrackPrimitiveOptions
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
      tabY,
      options
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
  tabY: number,
  options: TrackPrimitiveOptions
): BeatRenderPlacement[] {
  let tick = 0;
  const placements: BeatRenderPlacement[] = [];

  beats.forEach((beat, beatIndex) => {
    const x = measureX + 16 + tickToMeasureX(measure.content, tick, measure.width - 28);
    const color = voiceColor(voiceIndex, options);
    const notePlacements = beat.notes.map((note, noteIndex) => ({
      ref: { trackId: track.id, barIndex, voiceIndex, beatIndex, noteIndex },
      note,
      x,
      y: pitchToStaffY(writtenPitch(note, track, { concertTone: options.concertTone, ottava: beat.ottava }), staffY),
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
    ...accidentalPrimitives(placement, notePlacement),
    noteHeadPrimitive(placement, notePlacement),
    ...deadNoteCrossPrimitives(placement, notePlacement),
    tabFretPrimitive(placement, notePlacement),
    ...dotPrimitives(placement.beat.dots, placement.x + 12, notePlacement.y, placement.color),
    ...noteEffectPrimitives(placement, notePlacement)
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

  primitives.push(...beatEffectPrimitives(placement));

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
  const note = notePlacement.note;
  const fretText = note.deadNote ? "x" : note.ghost ? `(${note.fret})` : String(note.fret);

  return {
    id: `${noteId(notePlacement.ref)}-tab`,
    type: "text",
    x: notePlacement.x,
    y: notePlacement.tabY,
    text: fretText,
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

function accidentalPrimitives(
  placement: BeatRenderPlacement,
  notePlacement: NotePlacement
): ScenePrimitive[] {
  const glyph = accidentalGlyph(notePlacement.note.accidental);

  if (!notePlacement.note.forceAccidental || !glyph) {
    return [];
  }

  return [
    {
      id: `${noteId(notePlacement.ref)}-accidental`,
      type: "text",
      x: notePlacement.x - 16,
      y: notePlacement.y + 5,
      text: glyph,
      fill: placement.color,
      fontSize: 17,
      fontFamily: MUSIC_FONT_FAMILY,
      anchor: "middle",
      hit: effectHit(notePlacement.ref, notePlacement.x - 24, notePlacement.y - 12, 16, 22)
    }
  ];
}

function deadNoteCrossPrimitives(
  placement: BeatRenderPlacement,
  notePlacement: NotePlacement
): ScenePrimitive[] {
  if (!notePlacement.note.deadNote) {
    return [];
  }

  const id = noteId(notePlacement.ref);
  return [
    bracketLine(`${id}-effect-dead-left`, notePlacement.x - 5, notePlacement.y - 5, notePlacement.x + 5, notePlacement.y + 5, placement.color),
    bracketLine(`${id}-effect-dead-right`, notePlacement.x - 5, notePlacement.y + 5, notePlacement.x + 5, notePlacement.y - 5, placement.color)
  ];
}

function noteEffectPrimitives(
  placement: BeatRenderPlacement,
  notePlacement: NotePlacement
): ScenePrimitive[] {
  const note = notePlacement.note;
  const ref = notePlacement.ref;
  const id = noteId(ref);
  const primitives: ScenePrimitive[] = [];
  let aboveSlot = 0;
  let tabSlot = 0;

  const addAbove = (suffix: string, text: string, color = SYMBOL_MUTED) => {
    primitives.push(
      effectText(
        `${id}-effect-${suffix}`,
        text,
        notePlacement.x,
        notePlacement.y - 12 - aboveSlot * 10,
        9,
        "middle",
        ref,
        color
      )
    );
    aboveSlot += 1;
  };
  const addTab = (suffix: string, text: string, color = SYMBOL_MUTED) => {
    primitives.push(
      effectText(
        `${id}-effect-${suffix}`,
        text,
        notePlacement.x,
        notePlacement.tabY + 14 + tabSlot * 10,
        9,
        "middle",
        ref,
        color
      )
    );
    tabSlot += 1;
  };

  if (note.ghost) {
    addAbove("ghost", "ghost");
  }

  if (note.accent !== "none") {
    addAbove("accent", note.accent === "heavy" ? "^" : ">", placement.color);
  }

  if (note.staccato) {
    primitives.push({
      id: `${id}-effect-staccato`,
      type: "ellipse",
      cx: notePlacement.x,
      cy: notePlacement.y + 10,
      rx: 1.8,
      ry: 1.8,
      fill: placement.color,
      hit: effectHit(ref, notePlacement.x - 5, notePlacement.y + 5, 10, 10)
    });
  }

  if (note.dynamic !== 4) {
    addTab("dynamic", dynamicLabel(note.dynamic), SYMBOL_TEXT);
  }

  if (note.letRing) {
    primitives.push(...sustainLinePrimitives(`${id}-effect-let-ring`, "let ring", ref, notePlacement.x, placement.tabBottomY + 14));
  }

  if (note.palmMute) {
    primitives.push(...sustainLinePrimitives(`${id}-effect-palm-mute`, "PM", ref, notePlacement.x, placement.tabBottomY + 26));
  }

  if (note.hopo) {
    addTab("hopo", "H/P", EFFECT_BLUE);
  }

  if (note.slide) {
    primitives.push({
      id: `${id}-effect-slide`,
      type: "line",
      x1: notePlacement.x + 8,
      y1: notePlacement.tabY - 2,
      x2: notePlacement.x + 26,
      y2: notePlacement.tabY - 14,
      stroke: EFFECT_BLUE,
      strokeWidth: 1.3,
      strokeLinecap: "round",
      hit: effectHit(ref, notePlacement.x + 4, notePlacement.tabY - 18, 26, 20)
    });
  }

  if (note.bend) {
    primitives.push({
      id: `${id}-effect-bend-curve`,
      type: "path",
      d: `M ${notePlacement.x + 6} ${notePlacement.y - 18} C ${notePlacement.x + 24} ${notePlacement.y - 28}, ${notePlacement.x + 28} ${notePlacement.y - 36}, ${notePlacement.x + 34} ${notePlacement.y - 36}`,
      fill: "none",
      stroke: EFFECT_BLUE,
      strokeWidth: 1.2,
      strokeLinecap: "round",
      hit: effectHit(ref, notePlacement.x + 4, notePlacement.y - 42, 34, 26)
    });
    primitives.push(effectText(`${id}-effect-bend-label`, "full", notePlacement.x + 38, notePlacement.y - 34, 8, "start", ref, EFFECT_BLUE));
  }

  if (note.harmonic) {
    addAbove("harmonic", harmonicLabel(note.harmonic.type), EFFECT_BLUE);
  }

  if (note.vibrato !== "none") {
    addTab("vibrato", note.vibrato === "wide" ? "~~~~" : "~~", EFFECT_BLUE);
  }

  if (note.trill) {
    addAbove("trill", `tr ${note.trill.secondFret}`, EFFECT_BLUE);
  }

  if (note.tremoloPicking) {
    addAbove("tremolo", `trem ${note.tremoloPicking}`, EFFECT_BLUE);
  }

  if (note.fadeIn) {
    addTab("fade-in", "fade in");
  }

  if (note.fadeOut) {
    addTab("fade-out", "fade out");
  }

  if (note.volumeSwell) {
    addTab("swell", "swell");
  }

  if (note.wah) {
    addTab("wah", `wah ${note.wah}`);
  }

  if (note.slap) {
    addTab("slap", "S", EFFECT_BLUE);
  }

  if (note.pop) {
    addTab("pop", "P", EFFECT_BLUE);
  }

  if (note.golpe) {
    addTab("golpe", `golpe ${note.golpe}`);
  }

  if (note.pickscrape) {
    addTab("pickscrape", "pickscrape");
  }

  if (note.deadSlapped) {
    addTab("dead-slapped", "dead slap");
  }

  if (note.showStringNumber) {
    addAbove("string-number", `str ${note.string}`);
  }

  if (note.leftFinger) {
    addTab("left-finger", `L${note.leftFinger}`);
  }

  if (note.rightFinger) {
    addTab("right-finger", `R${note.rightFinger}`);
  }

  return primitives;
}

function beatEffectPrimitives(placement: BeatRenderPlacement): ScenePrimitive[] {
  const id = beatPlacementId(placement);
  const ref = {
    trackId: placement.track.id,
    barIndex: placement.barIndex,
    voiceIndex: placement.voiceIndex,
    beatIndex: placement.beatIndex
  };
  const primitives: ScenePrimitive[] = [];

  placement.beat.graceNotes.forEach((grace, index) => {
    primitives.push(
      effectText(
        `${id}-effect-grace-${index}`,
        String(grace.fret),
        placement.x - 18 - index * 8,
        placement.tabY + (grace.string - 1) * TAB_LINE_GAP + 4,
        8,
        "middle",
        ref,
        EFFECT_BLUE
      )
    );
  });

  if (placement.beat.brush) {
    primitives.push(effectText(`${id}-effect-brush`, placement.beat.brush.direction === "down" ? "brush v" : "brush ^", placement.x - 12, placement.tabY - 8, 8, "end", ref));
  }

  if (placement.beat.arpeggio) {
    primitives.push(effectText(`${id}-effect-arpeggio`, placement.beat.arpeggio.direction === "down" ? "arp v" : "arp ^", placement.x - 12, placement.tabY + 4, 8, "end", ref));
  }

  if (placement.beat.tapping) {
    primitives.push(effectText(`${id}-effect-tapping`, "T", placement.x, placement.staffY - 22, 10, "middle", ref, EFFECT_BLUE));
  }

  if (placement.beat.pickstroke !== "none") {
    primitives.push(effectText(`${id}-effect-pickstroke`, placement.beat.pickstroke === "down" ? "v" : "^", placement.x, placement.staffY - 10, 11, "middle", ref));
  }

  if (placement.beat.barVibrato !== "none") {
    primitives.push(effectText(`${id}-effect-bar-vibrato`, placement.beat.barVibrato === "wide" ? "~~~~" : "~~", placement.x + 18, placement.tabBottomY + 14, 10, "start", ref, EFFECT_BLUE));
  }

  if (placement.beat.dynamicHairpin) {
    const opening = placement.beat.dynamicHairpin.type === "cresc";
    const y = placement.staffY + STANDARD_STAFF_HEIGHT + 24;
    const x1 = placement.x + 6;
    const x2 = placement.x + 42;
    primitives.push({
      id: `${id}-effect-hairpin-${placement.beat.dynamicHairpin.type}-top`,
      type: "line",
      x1,
      y1: opening ? y : y - 6,
      x2,
      y2: opening ? y - 6 : y,
      stroke: SYMBOL_TEXT,
      strokeWidth: 1,
      hit: effectHit(ref, x1, y - 10, x2 - x1, 14)
    });
    primitives.push({
      id: `${id}-effect-hairpin-${placement.beat.dynamicHairpin.type}-bottom`,
      type: "line",
      x1,
      y1: opening ? y : y + 6,
      x2,
      y2: opening ? y + 6 : y,
      stroke: SYMBOL_TEXT,
      strokeWidth: 1,
      hit: effectHit(ref, x1, y - 2, x2 - x1, 14)
    });
  }

  if (placement.beat.ottava !== "none") {
    const y = placement.staffY - 34;
    primitives.push(effectText(`${id}-effect-ottava-label`, placement.beat.ottava, placement.x, y, 9, "middle", ref, SYMBOL_TEXT));
    primitives.push({
      id: `${id}-effect-ottava-line`,
      type: "line",
      x1: placement.x + 14,
      y1: y - 3,
      x2: placement.x + 56,
      y2: y - 3,
      stroke: SYMBOL_TEXT,
      strokeWidth: 1,
      strokeDasharray: "4 3",
      hit: effectHit(ref, placement.x, y - 12, 60, 14)
    });
  }

  if (placement.beat.whammy) {
    primitives.push({
      id: `${id}-effect-whammy`,
      type: "path",
      d: `M ${placement.x + 8} ${placement.staffY - 16} C ${placement.x + 18} ${placement.staffY - 28}, ${placement.x + 32} ${placement.staffY - 6}, ${placement.x + 44} ${placement.staffY - 18}`,
      fill: "none",
      stroke: EFFECT_BLUE,
      strokeWidth: 1.1,
      strokeLinecap: "round",
      hit: effectHit(ref, placement.x + 6, placement.staffY - 32, 42, 30)
    });
  }

  if (placement.beat.text) {
    primitives.push(effectText(`${id}-effect-text`, placement.beat.text, placement.x, placement.staffY - 42, 10, "middle", ref, SYMBOL_TEXT));
  }

  if (placement.beat.timer) {
    primitives.push(effectText(`${id}-effect-timer`, "timer", placement.x, placement.tabBottomY + 34, 8, "middle", ref));
  }

  if (placement.beat.chordId) {
    primitives.push(effectText(`${id}-effect-chord`, placement.beat.chordId, placement.x, placement.staffY - 50, 11, "middle", ref, SYMBOL_TEXT));
  }

  if (placement.beat.slash) {
    primitives.push(effectText(`${id}-effect-slash`, "/", placement.x, placement.staffY + STAFF_LINE_GAP * 2, 18, "middle", ref, SYMBOL_MUTED));
  }

  return primitives;
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
  staffY: number,
  options: TrackPrimitiveOptions
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
            y: pitchToStaffY(writtenPitch(note, track, { concertTone: options.concertTone, ottava: beat.ottava }), staffY),
            voiceIndex,
            color: voiceColor(voiceIndex, options)
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

function symbolText(
  id: string,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  anchor: "start" | "middle" | "end",
  kind: HitKind,
  barIndex: number
): ScenePrimitive {
  return {
    id,
    type: "text",
    x,
    y,
    text,
    fill: SYMBOL_TEXT,
    fontSize,
    anchor,
    hit: symbolHit(kind, barIndex, x - text.length * 3, y - fontSize, Math.max(18, text.length * 6), fontSize + 4)
  };
}

function effectText(
  id: string,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  anchor: "start" | "middle" | "end",
  ref: Partial<NoteRef>,
  fill = SYMBOL_MUTED
): ScenePrimitive {
  const width = Math.max(12, text.length * fontSize * 0.55);
  return {
    id,
    type: "text",
    x,
    y,
    text,
    fill,
    fontSize,
    anchor,
    hit: effectHit(ref, x - width / 2, y - fontSize, width, fontSize + 4)
  };
}

function sustainLinePrimitives(
  id: string,
  label: string,
  ref: NoteRef,
  x: number,
  y: number
): ScenePrimitive[] {
  return [
    effectText(`${id}-label`, label, x - 3, y, 8, "end", ref, SYMBOL_MUTED),
    {
      id: `${id}-line`,
      type: "line",
      x1: x + 3,
      y1: y - 3,
      x2: x + 42,
      y2: y - 3,
      stroke: SYMBOL_MUTED,
      strokeWidth: 1,
      strokeDasharray: "4 3",
      hit: effectHit(ref, x - 32, y - 10, 78, 16)
    }
  ];
}

function symbolHit(kind: HitKind, barIndex: number, x: number, y: number, width: number, height: number) {
  return {
    kind,
    ref: { barIndex },
    bbox: { x, y, width, height }
  };
}

function effectHit(ref: Partial<NoteRef>, x: number, y: number, width: number, height: number) {
  return {
    kind: "effect" as const,
    ref,
    bbox: { x, y, width, height }
  };
}

function directionTargetLabel(target: DirectionTarget): string {
  const labels: Record<DirectionTarget, string> = {
    Coda: "Coda",
    DoubleCoda: "Double Coda",
    Segno: "Segno",
    SegnoSegno: "Segno Segno",
    Fine: "Fine"
  };

  return labels[target];
}

function directionJumpLabel(jump: DirectionJump): string {
  const labels: Record<DirectionJump, string> = {
    DaCapo: "D.C.",
    DalSegno: "D.S.",
    DalSegnoSegno: "D.S.S.",
    DaCoda: "Da Coda",
    DaDoubleCoda: "Da Double Coda",
    AlCoda: "Al Coda",
    AlDoubleCoda: "Al Double Coda",
    AlFine: "Al Fine"
  };

  return labels[jump];
}

function alternateEndingLabel(mask: number): string {
  const endings = Array.from({ length: 8 }, (_, index) => index + 1).filter(
    (ending) => (mask & (1 << (ending - 1))) !== 0
  );
  return `${endings.join(", ")}.`;
}

function accidentalGlyph(accidental: Note["accidental"]): string {
  const glyphs: Record<Note["accidental"], string> = {
    none: "",
    sharp: SMUFL.accidentalSharp,
    flat: SMUFL.accidentalFlat,
    natural: SMUFL.accidentalNatural,
    doubleSharp: SMUFL.accidentalDoubleSharp,
    doubleFlat: SMUFL.accidentalDoubleFlat
  };

  return glyphs[accidental];
}

function dynamicLabel(dynamic: Note["dynamic"]): string {
  const dynamics: Record<Note["dynamic"], string> = {
    0: "ppp",
    1: "pp",
    2: "p",
    3: "mp",
    4: "mf",
    5: "f",
    6: "ff",
    7: "fff"
  };

  return dynamics[dynamic];
}

function harmonicLabel(type: NonNullable<Note["harmonic"]>["type"]): string {
  const labels: Record<NonNullable<Note["harmonic"]>["type"], string> = {
    natural: "N.H.",
    artificial: "A.H.",
    tapped: "T.H.",
    pinch: "P.H.",
    semi: "S.H."
  };

  return labels[type];
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

function voiceColor(voiceIndex: number, options?: TrackPrimitiveOptions): string {
  if (options?.multiVoiceEdit && voiceIndex !== options.activeVoiceIndex) {
    return INACTIVE_VOICE;
  }

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
