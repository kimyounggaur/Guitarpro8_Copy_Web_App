import { writtenPitch } from "../../model/derive";
import type { Beat, Note, Score, Track } from "../../model/types";
import {
  clefPrimitive,
  barHitRect,
  barlinePrimitive,
  beatHit,
  keySignaturePrimitive,
  standardStaffLines,
  tabLabelPrimitive,
  tabStaffLines,
  timeSignaturePrimitive,
  trackLabel
} from "./primitiveFactory";
import {
  NOTE_HEAD_HEIGHT,
  NOTE_HEAD_WIDTH,
  STAFF_LINE_GAP,
  STANDARD_STAFF_HEIGHT,
  SYSTEM_LABEL_WIDTH,
  TAB_LINE_GAP,
  TAB_STAFF_TOP_GAP,
  TRACK_GAP
} from "./metrics";
import { tickToMeasureX } from "./measureContents";
import type { ScenePrimitive } from "./sceneGraph";
import type { SystemMeasure } from "./systemBreaker";

export function systemPrimitives(
  score: Score,
  measures: SystemMeasure[],
  originX: number,
  originY: number
): ScenePrimitive[] {
  const primitives: ScenePrimitive[] = [];
  let trackY = originY;

  score.tracks.forEach((track, trackIndex) => {
    primitives.push(...trackPrimitives(score, track, trackIndex, measures, originX, trackY));
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
  originY: number
): ScenePrimitive[] {
  const primitives: ScenePrimitive[] = [];
  const staffX = originX + SYSTEM_LABEL_WIDTH;
  const tabY = originY + STANDARD_STAFF_HEIGHT + TAB_STAFF_TOP_GAP;
  const tabHeight = (track.tuning.strings.length - 1) * TAB_LINE_GAP;
  const staffEndX = staffX + measures.reduce((max, measure) => Math.max(max, measure.x + measure.width), 0);

  primitives.push(trackLabel(track, trackIndex, originX, originY));
  primitives.push(...standardStaffLines(track.id, staffX, staffEndX, originY));
  primitives.push(...tabStaffLines(track.id, staffX, staffEndX, tabY, track.tuning.strings.length));
  primitives.push(clefPrimitive(track.id, staffX - 34, originY + STAFF_LINE_GAP * 3));
  primitives.push(tabLabelPrimitive(track.id, staffX - 38, tabY + TAB_LINE_GAP * 3));

  measures.forEach((measure) => {
    const x = staffX + measure.x;
    const masterBar = score.masterBars[measure.content.barIndex];
    primitives.push(barlinePrimitive(track.id, measure.content.barIndex, x, originY, tabY + tabHeight));
    primitives.push(barHitRect(track.id, measure.content.barIndex, x, originY, measure.width, tabY + tabHeight));

    if (measure.x === 0) {
      primitives.push(
        timeSignaturePrimitive(track.id, measure.content.barIndex, x + 24, originY, masterBar.timeSignature.numerator, masterBar.timeSignature.denominator)
      );
      primitives.push(keySignaturePrimitive(track.id, measure.content.barIndex, x + 46, originY, masterBar.keySignature.key));
    }

    primitives.push(
      ...beatAndNotePrimitives(track, measure.content.barIndex, measure, x, originY, tabY)
    );
  });

  const finalMeasure = measures[measures.length - 1];
  if (finalMeasure) {
    primitives.push(
      barlinePrimitive(track.id, finalMeasure.content.barIndex, staffX + finalMeasure.x + finalMeasure.width, originY, tabY + tabHeight)
    );
  }

  return primitives;
}

function beatAndNotePrimitives(
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

  let tick = 0;
  return bar.voices[0].beats.flatMap((beat, beatIndex) => {
    const beatX = measureX + 16 + tickToMeasureX(measure.content, tick, measure.width - 28);
    const primitives = beatPrimitives(track, barIndex, beatIndex, beat, beatX, staffY, tabY);
    tick += measure.content.beats[beatIndex]?.durationTicks ?? 0;
    return primitives;
  });
}

function beatPrimitives(
  track: Track,
  barIndex: number,
  beatIndex: number,
  beat: Beat,
  beatX: number,
  staffY: number,
  tabY: number
): ScenePrimitive[] {
  if (beat.rest || beat.notes.length === 0) {
    return [
      {
        id: `${track.id}-${barIndex}-${beatIndex}-rest`,
        type: "text",
        x: beatX,
        y: staffY + STAFF_LINE_GAP * 3,
        text: "rest",
        fill: "#8b8b8b",
        fontSize: 9,
        anchor: "middle",
        hit: beatHit({ trackId: track.id, barIndex, voiceIndex: 0, beatIndex }, beatX, staffY)
      }
    ];
  }

  return beat.notes.flatMap((note, noteIndex) => [
    noteHeadPrimitive(track, barIndex, beatIndex, noteIndex, note, beatX, staffY),
    tabFretPrimitive(track, barIndex, beatIndex, noteIndex, note, beatX, tabY)
  ]);
}

function noteHeadPrimitive(
  track: Track,
  barIndex: number,
  beatIndex: number,
  noteIndex: number,
  note: Note,
  x: number,
  staffY: number
): ScenePrimitive {
  const y = pitchToStaffY(writtenPitch(note, track, { concertTone: true }), staffY);

  return {
    id: `${track.id}-${barIndex}-${beatIndex}-${noteIndex}-head`,
    type: "ellipse",
    cx: x,
    cy: y,
    rx: NOTE_HEAD_WIDTH / 2,
    ry: NOTE_HEAD_HEIGHT / 2,
    fill: "#111827",
    hit: {
      kind: "note",
      ref: { trackId: track.id, barIndex, voiceIndex: 0, beatIndex, noteIndex },
      bbox: { x: x - 8, y: y - 8, width: 16, height: 16 }
    }
  };
}

function tabFretPrimitive(
  track: Track,
  barIndex: number,
  beatIndex: number,
  noteIndex: number,
  note: Note,
  x: number,
  tabY: number
): ScenePrimitive {
  const y = tabY + (note.string - 1) * TAB_LINE_GAP + 4;

  return {
    id: `${track.id}-${barIndex}-${beatIndex}-${noteIndex}-tab`,
    type: "text",
    x,
    y,
    text: String(note.fret),
    fill: "#111827",
    fontSize: 11,
    anchor: "middle",
    hit: {
      kind: "note",
      ref: { trackId: track.id, barIndex, voiceIndex: 0, beatIndex, noteIndex },
      bbox: { x: x - 8, y: y - 10, width: 16, height: 14 }
    }
  };
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
  return STANDARD_STAFF_HEIGHT + TAB_STAFF_TOP_GAP + (track.tuning.strings.length - 1) * TAB_LINE_GAP;
}
