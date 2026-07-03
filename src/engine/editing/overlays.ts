import type { SceneGraph, ScenePrimitive } from "../layout/sceneGraph";
import type { CursorPosition, SelectionRange } from "./types";
import { VOICE_CURSOR_COLORS } from "./types";

export function withEditorOverlays(
  scene: SceneGraph,
  cursor: CursorPosition,
  selection: SelectionRange | null,
  playbackBarIndex: number | null = null
): SceneGraph {
  return {
    pages: scene.pages.map((page) => ({
      ...page,
      primitives: [
        ...page.primitives,
        ...playbackPrimitives(page.primitives, playbackBarIndex),
        ...selectionPrimitives(page.primitives, selection),
        ...cursorPrimitives(page.primitives, cursor)
      ]
    }))
  };
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

  if (primary?.hit) {
    overlays.push(cursorRect("editor-cursor-primary", primary.hit.bbox, color, 0.16));
  }

  return overlays;
}

function selectionPrimitives(
  primitives: ScenePrimitive[],
  selection: SelectionRange | null
): ScenePrimitive[] {
  if (!selection) {
    return [];
  }

  const startBar = Math.min(selection.anchor.barIndex, selection.head.barIndex);
  const endBar = Math.max(selection.anchor.barIndex, selection.head.barIndex);
  const trackId = selection.head.trackId;

  return primitives
    .filter((primitive) => {
      const ref = primitive.hit?.ref;
      return (
        primitive.hit?.kind === "bar" &&
        ref?.trackId === trackId &&
        typeof ref.barIndex === "number" &&
        ref.barIndex >= startBar &&
        ref.barIndex <= endBar
      );
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
