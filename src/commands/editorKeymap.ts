import { executeCommand } from "./registry";
import type { EditorCommandContext } from "./editingCommands";
import { commandIdForKeyEvent } from "./keymap";
import type { CommandId } from "./commandIds";

export function handleEditorKeyDown(
  event: KeyboardEvent,
  context: EditorCommandContext
): boolean {
  if (event.defaultPrevented) return false;
  if (handleNumericInput(event, context)) {
    return true;
  }

  context.endFretInput();
  const commandId = commandIdForEvent(event, context);

  if (!commandId) {
    return false;
  }

  executeCommand(commandId, context, { event });
  event.preventDefault();
  return true;
}

function handleNumericInput(
  event: KeyboardEvent,
  context: EditorCommandContext
): boolean {
  const digit = /^Digit([0-9])$/.exec(event.code)?.[1] ?? (/^\d$/.test(event.key) ? event.key : undefined);
  if (digit === undefined || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return false;

  event.preventDefault();
  if (context.staffKind === "standard") {
    context.endFretInput();
    context.inputStandardString(Number(digit));
  } else {
    context.inputFretDigit(Number(digit));
  }
  return true;
}

function commandIdForEvent(event: KeyboardEvent, context: EditorCommandContext): CommandId | null {
  const id = commandIdForKeyEvent(event, "workspace");
  if (context.playbackStatus === "playing") {
    if (id === "duration.longer") return "playback.speedUp";
    if (id === "duration.shorter") return "playback.speedDown";
  }
  return id;
}
