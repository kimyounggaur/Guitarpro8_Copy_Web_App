import { useOverlayStore } from "../../store/overlayStore";
import { useEffect } from "react";
import type { ApplicationShortcutId } from "../../commands/commandIds";
import { commandIdForKeyEvent } from "../../commands/keymap";

export type GlobalShortcutId = ApplicationShortcutId | "history.undo" | "history.redo" | "playback.toggle";

export function useGlobalShortcuts(
  actions: Record<GlobalShortcutId, () => unknown>,
  editorVisible = true
): void {
  useEffect(() => {
    function handleGlobalShortcut(event: KeyboardEvent): void {
      if (event.defaultPrevented || document.querySelector(".fileDecisionDialog[open]")) {
        return;
      }

      const target = event.target instanceof HTMLElement ? event.target : null;
      const editingText = target?.closest("input, select, textarea") || target?.isContentEditable;
      if (target?.closest("[data-anchored-popover], [data-command-menu]")) return;
      // The toolbar preserves score focus on a pointer click. Escape still belongs to its popup.
      if (event.key === "Escape" && (document.querySelector("[data-anchored-popover]") || target?.closest("[data-tooltip-open]"))) return;
      if (document.querySelector("dialog[data-editor-window]:modal")) return;
      if (event.key === "Escape" && !target?.closest('[data-testid="command-palette"]')) {
        const { stack, dismiss } = useOverlayStore.getState();
        const top = stack[stack.length - 1];
        if (top) {
          const panel = document.querySelector('[data-editor-window="' + top.kind + '"]');
          if (panel) panel.dispatchEvent(new Event("editor-window-dismiss"));
          else dismiss(top.kind);
          event.preventDefault();
          return;
        }
      }
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

      if (!editorVisible && !id.startsWith("file.") && !id.startsWith("tabs.") && id !== "view.closeOverlays") return;

      if (id === "playback.toggle" && target?.closest("button, a, [role=button]")) {
        return; // Preserve native keyboard activation of the focused control.
      }

      if (actions[id]() !== false) {
        event.preventDefault();
      }
    }

    window.addEventListener("keydown", handleGlobalShortcut, { capture: true });
    return () => window.removeEventListener("keydown", handleGlobalShortcut, { capture: true });
  }, [actions, editorVisible]);
}

function isGlobalAction(
  actions: Record<GlobalShortcutId, () => unknown>, id: string
): id is GlobalShortcutId {
  return Object.prototype.hasOwnProperty.call(actions, id);
}
