import { enablePatches, type Patch } from "immer";
import type { CursorPosition } from "../engine/editing/types";

enablePatches();

const MAX_HISTORY = 500;
const REPEAT_INTERVAL_MS = 1000;

export interface EditTransaction {
  label: string;
  patches: Patch[];
  inversePatches: Patch[];
  revisionBefore: number;
  revisionAfter: number;
  cursorBefore: CursorPosition;
  cursorAfter: CursorPosition;
  time: number;
  group?: string;
  repeatable: boolean;
}

export function appendEdit(
  stack: EditTransaction[],
  current: EditTransaction,
  savedRevision: number | null,
  coalesceRevision?: number
): EditTransaction[] {
  const previous = stack[stack.length - 1];
  const eligible = previous !== undefined && previous.label === current.label &&
    previous.revisionAfter === current.revisionBefore && savedRevision !== current.revisionBefore;

  const explicit = coalesceRevision === current.revisionBefore;
  const grouped = current.group !== undefined && current.group === previous?.group;
  const repeated = current.repeatable && current.label !== "Input note" && current.group === undefined && previous?.group === undefined &&
    previous !== undefined && current.time - previous.time <= REPEAT_INTERVAL_MS &&
    sameCursor(previous.cursorBefore, current.cursorBefore) && sameCursor(current.cursorBefore, current.cursorAfter);

  if (eligible && (explicit || grouped || repeated)) {
    return [...stack.slice(0, -1), {
      ...current,
      revisionBefore: previous.revisionBefore,
      cursorBefore: previous.cursorBefore,
      patches: [...previous.patches, ...current.patches],
      inversePatches: [...current.inversePatches, ...previous.inversePatches]
    }];
  }
  return [...stack.slice(-(MAX_HISTORY - 1)), current];
}

function sameCursor(first: CursorPosition, second: CursorPosition): boolean {
  return first.trackId === second.trackId && first.barIndex === second.barIndex &&
    first.voiceIndex === second.voiceIndex && first.beatIndex === second.beatIndex &&
    first.string === second.string && first.staffKind === second.staffKind &&
    first.staffLine === second.staffLine && first.staffClef === second.staffClef &&
    first.writtenMidi === second.writtenMidi;
}
