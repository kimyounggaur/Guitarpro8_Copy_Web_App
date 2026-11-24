import { useEffect } from "react";
import type { ApplicationShortcutId } from "../../commands/commandIds";
import { commandIdForKeyEvent } from "../../commands/keymap";

export type GlobalShortcutId = ApplicationShortcutId | "history.undo" | "history.redo" | "playback.toggle";

export function useGlobalShortcuts(actions: Record<GlobalShortcutId, () => unknown>): void {
  useEffect(() => {
    function handleGlobalShortcut(event: KeyboardEvent): void {
      if (event.defaultPrevented || document.querySelector(".fileDecisionDialog[open]")) {
        return;
      }

      const target = event.target instanceof HTMLElement ? event.target : null;
      const editingText = target?.closest("input, select, textarea") || target?.isContentEditable;
      if (editingText && event.key !== "Escape") {
        return;
      }

      if (event.key === "Escape" && target?.closest('[data-testid="command-palette"]')) {
        return; // The palette closes itself, then restores its previous focus.
      }

      const id = commandIdForKeyEvent(event, "global");
      if (!id || !isGlobalAction(actions, id)) {
        return;
      }

      if (id === "playback.toggle" && target?.closest("button, a, [role=button]")) {
        return; // Preserve native keyboard activation of the focused control.
      }

      if (actions[id]() !== false) {
        event.preventDefault();
      }
    }

    window.addEventListener("keydown", handleGlobalShortcut, { capture: true });
    return () => window.removeEventListener("keydown", handleGlobalShortcut, { capture: true });
  }, [actions]);
}

function isGlobalAction(
  actions: Record<GlobalShortcutId, () => unknown>, id: string
): id is GlobalShortcutId {
  return Object.prototype.hasOwnProperty.call(actions, id);
}
