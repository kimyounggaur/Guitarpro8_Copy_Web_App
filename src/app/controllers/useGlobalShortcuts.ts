// Thin coordinating hook for the two ad-hoc `window.addEventListener("keydown",
// ...)` effects that used to live directly in src/App.tsx.
//
// Extracted from src/App.tsx (see docs/ui-remaster/00-component-map.md §1,
// rows App.tsx:212-231 and App.tsx:233-379, and §8 risk #6) as part of
// Phase 2's structural-only refactor. These shortcuts intentionally stay
// outside the command registry / `commandIdForKeyEvent` path for now — the
// master prompt calls routing them through `commands/registry.ts` a
// later-phase concern, and changing the dispatch mechanism in this phase
// risks exactly the regression Phase 2 must avoid.
//
// Both effects are reproduced with their **exact** original capture/bubble
// phase, listener options, and dependency arrays (including the
// non-exhaustive one on the second effect) so the relative keydown-handling
// order across window listener #1, window listener #2, and the score
// viewport's own onKeyDown (component-map.md §8 risk #6) is unchanged.
import { useEffect, type Dispatch, type SetStateAction } from "react";
import type { Score } from "../../model/types";
import type { PanelVisibility } from "../../store/preferencesStore";
import type { ToolPanelId } from "../../ui/shell/ToolPanels";
import type { TrackPanelId } from "../../ui/shell/TrackSystemPanels";

export interface UseGlobalShortcutsParams {
  togglePanel: (panel: keyof PanelVisibility) => void;

  score: Score;
  cursorTrackId: string | null;
  activeToolPanel: ToolPanelId | null;
  activeTrackPanel: TrackPanelId | null;
  stylesheetPanelOpen: boolean;
  fileIoPanelOpen: boolean;
  commandPaletteOpen: boolean;
  anyOverlayOpen: boolean;

  openCommandPalette: (initialValue?: string) => void;
  handleNewFile: () => void;
  handleOpenNativeFile: () => Promise<void>;
  handleSaveNativeFile: () => Promise<void>;
  handleSaveNativeFileAs: () => Promise<void>;
  /** F7's current behavior — toggles the Stylesheet panel. See
   * useToolWindowController's `toggleStylesheetPanel` doc comment for why
   * this is intentionally distinct from the Style button/`view.stylesheet`
   * command, which only force-open it. */
  toggleStylesheetPanel: () => void;
  handleZoomChange: (zoom: number) => void;
  closeAllOverlays: () => void;
  setActiveTrackPanel: (panel: TrackPanelId | null) => void;
  /** Raw setters — F3 and Ctrl+M duplicate `handleToggleMultiTrackView`/
   * `handleToggleMultiVoice` inline instead of calling them (see
   * useEditorController's doc comment for the same historical
   * duplication). */
  setMultiTrackView: Dispatch<SetStateAction<boolean>>;
  setMultiVoiceEdit: Dispatch<SetStateAction<boolean>>;
  handleVoiceSelect: (voiceIndex: number) => void;
  handleMoveNoteToVoice: (voiceIndex: number) => void;
  setActiveToolPanel: (tool: ToolPanelId | null) => void;
}

export function useGlobalShortcuts(params: UseGlobalShortcutsParams): void {
  const { togglePanel } = params;

  useEffect(() => {
    function handlePanelShortcuts(event: KeyboardEvent) {
      const panelByKey = {
        F2: "palette",
        F5: "songInspector",
        F6: "trackInspector",
        F8: "globalView",
        F10: "automationView"
      } as const;
      const panel = panelByKey[event.key as keyof typeof panelByKey];

      if (panel) {
        event.preventDefault();
        togglePanel(panel);
      }
    }

    window.addEventListener("keydown", handlePanelShortcuts);
    return () => window.removeEventListener("keydown", handlePanelShortcuts);
  }, [togglePanel]);

  const {
    score,
    cursorTrackId,
    activeToolPanel,
    activeTrackPanel,
    stylesheetPanelOpen,
    fileIoPanelOpen,
    commandPaletteOpen,
    anyOverlayOpen,
    openCommandPalette,
    handleNewFile,
    handleOpenNativeFile,
    handleSaveNativeFile,
    handleSaveNativeFileAs,
    toggleStylesheetPanel,
    handleZoomChange,
    closeAllOverlays,
    setActiveTrackPanel,
    setMultiTrackView,
    setMultiVoiceEdit,
    handleVoiceSelect,
    handleMoveNoteToVoice,
    setActiveToolPanel
  } = params;

  useEffect(() => {
    function handleToolShortcuts(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const editingText =
        target?.tagName === "INPUT" ||
        target?.tagName === "SELECT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      const ctrl = event.ctrlKey || event.metaKey;

      if (ctrl && event.altKey && event.key.toLowerCase() === "e") {
        event.preventDefault();
        openCommandPalette("@");
        return;
      }

      if (ctrl && event.shiftKey && event.key.toLowerCase() === "e") {
        event.preventDefault();
        openCommandPalette(">");
        return;
      }

      if (ctrl && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "e") {
        event.preventDefault();
        openCommandPalette("");
        return;
      }

      if (ctrl && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "n") {
        event.preventDefault();
        handleNewFile();
        return;
      }

      if (ctrl && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "o") {
        event.preventDefault();
        void handleOpenNativeFile();
        return;
      }

      if (ctrl && event.shiftKey && !event.altKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void handleSaveNativeFileAs();
        return;
      }

      if (ctrl && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void handleSaveNativeFile();
        return;
      }

      if (event.key === "F7") {
        event.preventDefault();
        toggleStylesheetPanel();
        return;
      }

      if (ctrl && !event.altKey && (event.key === "+" || event.key === "=")) {
        event.preventDefault();
        handleZoomChange(score.documentSettings.zoom + 10);
        return;
      }

      if (ctrl && !event.altKey && event.key === "-") {
        event.preventDefault();
        handleZoomChange(score.documentSettings.zoom - 10);
        return;
      }

      if (editingText) {
        return;
      }

      if (event.key === "Escape" && anyOverlayOpen) {
        event.preventDefault();
        closeAllOverlays();
        return;
      }

      if (ctrl && event.shiftKey && event.key === "Insert") {
        event.preventDefault();
        setActiveTrackPanel("wizard");
        return;
      }

      if (event.key === "F3") {
        event.preventDefault();
        setMultiTrackView((value) => !value);
        return;
      }

      if (ctrl && event.key.toLowerCase() === "m") {
        event.preventDefault();
        setMultiVoiceEdit((value) => !value);
        setActiveTrackPanel("voices");
        return;
      }

      if (ctrl && /^[1-4]$/.test(event.key)) {
        event.preventDefault();
        handleVoiceSelect(Number(event.key) - 1);
        return;
      }

      if (event.altKey && /^[1-4]$/.test(event.key)) {
        event.preventDefault();
        handleMoveNoteToVoice(Number(event.key) - 1);
        return;
      }

      if (!ctrl && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "a") {
        event.preventDefault();
        setActiveToolPanel("chords");
        return;
      }

      if (!ctrl && event.shiftKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        setActiveToolPanel("scales");
        return;
      }

      if (ctrl && event.key === "F6") {
        event.preventDefault();
        const activeTrack = score.tracks.find((track) => track.id === cursorTrackId);
        if (activeTrack?.icon === "drums") {
          setActiveTrackPanel("drums");
        } else {
          setActiveToolPanel("instrument");
        }
        return;
      }

      if (event.key === "F4") {
        event.preventDefault();
        setActiveToolPanel("cleanup");
      }
    }

    window.addEventListener("keydown", handleToolShortcuts, { capture: true });
    return () => window.removeEventListener("keydown", handleToolShortcuts, { capture: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately
    // mirrors the original App.tsx dependency array (component-map.md §8
    // risk #6): re-subscribing only on these values preserves the original
    // effect-recreation cadence and therefore the original keydown-handling
    // order relative to other listeners.
  }, [activeToolPanel, activeTrackPanel, commandPaletteOpen, cursorTrackId, fileIoPanelOpen, score.documentSettings.zoom, score.tracks, stylesheetPanelOpen]);
}
