import { executeCommand } from "./registry";
import type { EditorCommandContext } from "./editingCommands";

export interface FretInputBuffer {
  digits: string;
  timer: number | null;
}

export function handleEditorKeyDown(
  event: KeyboardEvent,
  context: EditorCommandContext,
  fretBuffer: FretInputBuffer
): boolean {
  if (handleNumericInput(event, context, fretBuffer)) {
    return true;
  }

  const commandId = commandIdForEvent(event);

  if (!commandId) {
    return false;
  }

  executeCommand(commandId, context, { event });
  event.preventDefault();
  return true;
}

export function flushFretBuffer(context: EditorCommandContext, fretBuffer: FretInputBuffer): void {
  if (fretBuffer.digits.length === 0) {
    return;
  }

  context.inputFret(Number(fretBuffer.digits));
  fretBuffer.digits = "";
  fretBuffer.timer = null;
}

function handleNumericInput(
  event: KeyboardEvent,
  context: EditorCommandContext,
  fretBuffer: FretInputBuffer
): boolean {
  if (!/^\d$/.test(event.key) || event.ctrlKey || event.metaKey || event.altKey) {
    return false;
  }

  event.preventDefault();

  if (context.staffKind === "standard") {
    context.inputStandardString(Number(event.key));
    return true;
  }

  if (event.shiftKey) {
    return true;
  }

  if (fretBuffer.timer !== null) {
    window.clearTimeout(fretBuffer.timer);
  }

  fretBuffer.digits += event.key;

  if (fretBuffer.digits.length >= 2) {
    flushFretBuffer(context, fretBuffer);
    return true;
  }

  fretBuffer.timer = window.setTimeout(() => flushFretBuffer(context, fretBuffer), 300);
  return true;
}

function commandIdForEvent(event: KeyboardEvent): string | null {
  const key = event.key;
  const ctrl = event.ctrlKey || event.metaKey;
  const shift = event.shiftKey;
  const alt = event.altKey;

  if (alt && shift && key === "ArrowUp") return "note.transposeUp";
  if (alt && shift && key === "ArrowDown") return "note.transposeDown";
  if (alt && key === "ArrowUp") return "note.moveStringUp";
  if (alt && key === "ArrowDown") return "note.moveStringDown";

  if (ctrl && key === "ArrowUp") return "cursor.previousTrack";
  if (ctrl && key === "ArrowDown") return "cursor.nextTrack";
  if (ctrl && shift && key === "ArrowRight") return "selection.extendBarRight";
  if (ctrl && shift && key === "ArrowLeft") return "selection.extendBarLeft";
  if (key === "ArrowLeft") return "cursor.moveLeft";
  if (key === "ArrowRight") return "cursor.moveRight";
  if (key === "ArrowUp") return "cursor.moveUp";
  if (key === "ArrowDown") return "cursor.moveDown";
  if (ctrl && key === "Home") return "cursor.firstBar";
  if (ctrl && key === "End") return "cursor.lastBar";
  if (key === "Home") return "cursor.home";
  if (key === "End") return "cursor.end";
  if (key === "Tab") return "cursor.toggleStaff";

  if (ctrl && shift && key.toLowerCase() === "c") return "clipboard.copyMultitrack";
  if (ctrl && shift && key.toLowerCase() === "x") return "clipboard.cutMultitrack";
  if (ctrl && shift && key.toLowerCase() === "v") return "clipboard.specialPaste";
  if (ctrl && key.toLowerCase() === "c") return "clipboard.copy";
  if (ctrl && key.toLowerCase() === "x") return "clipboard.cut";
  if (ctrl && key.toLowerCase() === "v") return "clipboard.paste";
  if (ctrl && key.toLowerCase() === "a") return "selection.selectTrack";
  if (ctrl && key.toLowerCase() === "z") return "history.undo";
  if ((ctrl && key.toLowerCase() === "y") || (event.metaKey && shift && key.toLowerCase() === "z")) return "history.redo";

  if (ctrl && alt && key === "9") return "note.doubleSharp";
  if (ctrl && alt && key === "7") return "note.doubleFlat";
  if (ctrl && alt && key === "8") return "note.enharmonic";
  if (ctrl && key === "9") return "note.sharp";
  if (ctrl && key === "7") return "note.flat";
  if (ctrl && key === "8") return "note.natural";
  if (ctrl && key === ".") return "note.doubleDot";

  if (shift && key.toLowerCase() === "l") return "note.tieBeat";
  if (key.toLowerCase() === "l") return "note.tie";
  if (shift && key === ".") return "note.dot";
  if (shift && key === "/") return "note.triplet";
  if (key.toLowerCase() === "r") return "note.rest";
  if (key === "Backspace") return "note.delete";
  if (shift && key === "Delete") return "beat.delete";
  if (ctrl && key === "Delete") return "bar.delete";
  if (ctrl && key === "Insert") return "beat.insert";
  if (key === "Insert") return "bar.insert";
  if (key.toLowerCase() === "c") return "beat.copyPrevious";
  if (key === "+" || key === "=") return "duration.shorter";
  if (key === "-") return "duration.longer";

  return null;
}
