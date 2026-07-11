import { executeCommand } from "./registry";
import type { EditorCommandContext } from "./editingCommands";
import { commandIdForKeyEvent, detectPlatform } from "./keymap";

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

  const commandId = commandIdForEvent(event, context);

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

function commandIdForEvent(event: KeyboardEvent, context: EditorCommandContext): string | null {
  if (event.key === "+" || event.key === "=") {
    return context.playbackStatus === "playing" ? "playback.speedUp" : "duration.longer";
  }

  if (event.key === "-") {
    return context.playbackStatus === "playing" ? "playback.speedDown" : "duration.shorter";
  }

  return commandIdForKeyEvent(event, "workspace", detectPlatform());
}
