import type { ScenePrimitive } from "../layout/sceneGraph";
import type { CursorPosition, SelectionRange } from "./types";
import { positionToY } from "../notation/staffPosition";
import { VOICE_CURSOR_COLORS } from "./types";

export interface EditorOverlayState {
  cursor: CursorPosition;
  selection: SelectionRange | null;
  playbackBarIndex: number | null;
  multiVoiceEdit: boolean;
}

export function editorOverlayPrimitives(
  primitives: ScenePrimitive[],
  { cursor, selection, playbackBarIndex }: EditorOverlayState
): ScenePrimitive[] {
  const editingBar = primitives.find(({ hit }) => hit?.kind === "bar"
    && hit.ref.trackId === cursor.trackId && hit.ref.barIndex === cursor.barIndex)?.hit;

  return [
    ...(editingBar ? [cursorRect("editor-active-bar", editingBar.bbox, "#3b82f6", 0.05)] : []),
    ...playbackPrimitives(primitives, playbackBarIndex),
    ...selectionPrimitives(primitives, selection),
    ...cursorPrimitives(primitives, cursor)
  ];
}

function playbackPrimitives(
  primitives: ScenePrimitive[],
  playbackBarIndex: number | null
): ScenePrimitive[] {
  if (playbackBarIndex === null) {
    return [];
  }

  return primitives
    .filter((primitive) => primitive.hit?.kind === "bar" && primitive.hit.ref.barIndex === playbackBarIndex)
    .map((primitive, index) =>
      cursorRect(`playback-bar-${playbackBarIndex}-${index}`, primitive.hit!.bbox, "#facc15", 0.12)
    );
}

function cursorPrimitives(primitives: ScenePrimitive[], cursor: CursorPosition): ScenePrimitive[] {
  const primary = findCursorPrimitive(primitives, cursor, cursor.staffKind);
  const secondary = findCursorPrimitive(primitives, cursor, cursor.staffKind === "tab" ? "standard" : "tab");
  const color = VOICE_CURSOR_COLORS[cursor.voiceIndex] ?? VOICE_CURSOR_COLORS[0];
  const overlays: ScenePrimitive[] = [];

  if (secondary?.hit) {
    overlays.push(cursorRect("editor-cursor-secondary", secondary.hit.bbox, "#9ca3af", 0.08));
  }

  const staffCursor = cursor.staffKind === "standard" ? staffCursorPrimitive(primitives, cursor, color) : null;
  if (staffCursor) {
    overlays.push(staffCursor);
  } else if (primary?.hit) {
    overlays.push(cursorRect("editor-cursor-primary", primary.hit.bbox, color, 0.16));
  }

  return overlays;
}

function staffCursorPrimitive(primitives: ScenePrimitive[], cursor: CursorPosition, color: string): ScenePrimitive | null {
  const staffHit = primitives.find(({ hit }) => {
    const ref = hit?.ref;
    return hit?.kind === "staffInput"
      && ref?.trackId === cursor.trackId && ref.barIndex === cursor.barIndex
      && ref.voiceIndex === cursor.voiceIndex && ref.beatIndex === cursor.beatIndex
      && (!cursor.staffClef || ref.staffClef === cursor.staffClef);
  })?.hit;
  const top = staffHit?.ref.staffTop;
  const space = staffHit?.ref.staffSpace;
  if (!staffHit || top === undefined || space === undefined) return null;

  return cursorRect("editor-cursor-primary", {
    x: staffHit.bbox.x + Math.max(0, (staffHit.bbox.width - space) / 2),
    y: positionToY(cursor.staffLine, top, space) - space / 4,
    width: space,
    height: space / 2
  }, color, 0.16);
}

function selectionPrimitives(
  primitives: ScenePrimitive[],
  selection: SelectionRange | null
): ScenePrimitive[] {
  if (!selection) {
    return [];
  }

  const forward = selection.anchor.barIndex < selection.head.barIndex ||
    (selection.anchor.barIndex === selection.head.barIndex && selection.anchor.beatIndex <= selection.head.beatIndex);
  const first = forward ? selection.anchor : selection.head;
  const last = forward ? selection.head : selection.anchor;
  const trackIds = [...new Set(primitives.flatMap(({ hit }) =>
    hit?.kind === "bar" && hit.ref.trackId ? [hit.ref.trackId] : []))];
  const trackIndex1 = trackIds.indexOf(first.trackId ?? "");
  const trackIndex2 = trackIds.indexOf(last.trackId ?? "");
  const selectedTracks = new Set(trackIndex1 >= 0 && trackIndex2 >= 0
    ? trackIds.slice(Math.min(trackIndex1, trackIndex2), Math.max(trackIndex1, trackIndex2) + 1)
    : [first.trackId, last.trackId]);

  const unit = selection.unit === "beat" ? "beat" : "bar";
  return primitives
    .filter(({ hit }) => {
      const barIndex = hit?.ref.barIndex;
      if (hit?.kind !== unit || !selectedTracks.has(hit.ref.trackId ?? null) ||
        barIndex === undefined || barIndex < first.barIndex || barIndex > last.barIndex) return false;
      if (unit === "bar") return true;
      const beatIndex = hit.ref.beatIndex;
      return beatIndex !== undefined &&
        (barIndex > first.barIndex || beatIndex >= first.beatIndex) &&
        (barIndex < last.barIndex || beatIndex <= last.beatIndex);
    })
    .map((primitive, index) =>
      cursorRect(`editor-selection-${index}`, primitive.hit!.bbox, "#3b82f6", 0.09)
    );
}

function findCursorPrimitive(
  primitives: ScenePrimitive[],
  cursor: CursorPosition,
  staffKind: "tab" | "standard"
): ScenePrimitive | undefined {
  const suffix = staffKind === "tab" ? "-tab" : "-head";
  const exact = primitives.find((primitive) => {
    const ref = primitive.hit?.ref;
    return (
      primitive.id.endsWith(suffix) &&
      ref?.trackId === cursor.trackId &&
      ref.barIndex === cursor.barIndex &&
      ref.voiceIndex === cursor.voiceIndex &&
      ref.beatIndex === cursor.beatIndex
    );
  });

  if (exact) {
    return exact;
  }

  return primitives.find((primitive) => {
    const ref = primitive.hit?.ref;
    return (
      primitive.hit?.kind === "beat" &&
      ref?.trackId === cursor.trackId &&
      ref.barIndex === cursor.barIndex &&
      ref.voiceIndex === cursor.voiceIndex &&
      ref.beatIndex === cursor.beatIndex
    );
  });
}

function cursorRect(
  id: string,
  bbox: { x: number; y: number; width: number; height: number },
  color: string,
  opacity: number
): ScenePrimitive {
  return {
    id,
    type: "rect",
    x: bbox.x - 2,
    y: bbox.y - 2,
    width: bbox.width + 4,
    height: bbox.height + 4,
    fill: `${color}${Math.round(opacity * 255)
      .toString(16)
      .padStart(2, "0")}`,
    stroke: color,
    strokeWidth: 1.5,
    radius: 3,
    pointerEvents: "none"
  };
}
