// Tool/Track/Stylesheet/File/Command-Palette overlay visibility controller.
//
// Extracted from src/App.tsx local useState calls (see
// docs/ui-remaster/00-component-map.md §1, row App.tsx:134-143, and §2's
// "도구 패널/트랙 패널/..." state-ownership row) as part of Phase 2's
// structural-only refactor. Behavior is unchanged from the original.
//
// The state is deliberately kept as a single object (rather than five
// independent useState calls) so that swapping this hook's internals for a
// zustand `overlayStore` in a later phase (see the master prompt's target
// state-ownership table, "열려 있는 팝오버/모달") is a mechanical change: only
// this file's `useState`/`setState` calls need to become store `set` calls,
// the public ToolWindowController contract below does not need to change.
// commandPalette is modeled as a discriminated union because its
// `initialValue` is only meaningful while open — the other panels stay
// plain booleans because, unlike a future single-active-overlay design,
// today's app allows several of them to be visible at once (see
// component-map §5, the floating panels share overlapping z-index layers),
// so collapsing them into one mutually-exclusive union here would silently
// change behavior, which this phase must not do.
import { useState } from "react";
import type { ToolPanelId } from "../../ui/shell/ToolPanels";
import type { TrackPanelId } from "../../ui/shell/TrackSystemPanels";

export type CommandPaletteWindowState = { open: false } | { open: true; initialValue: string };

export interface ToolWindowState {
  activeToolPanel: ToolPanelId | null;
  activeTrackPanel: TrackPanelId | null;
  stylesheetPanelOpen: boolean;
  fileIoPanelOpen: boolean;
  commandPalette: CommandPaletteWindowState;
}

const initialState: ToolWindowState = {
  activeToolPanel: null,
  activeTrackPanel: null,
  stylesheetPanelOpen: false,
  fileIoPanelOpen: false,
  commandPalette: { open: false }
};

export interface ToolWindowController {
  activeToolPanel: ToolPanelId | null;
  activeTrackPanel: TrackPanelId | null;
  stylesheetPanelOpen: boolean;
  fileIoPanelOpen: boolean;
  commandPaletteOpen: boolean;
  commandPaletteInitialValue: string;
  /** True when any overlay/panel tracked by this controller is open — used
   * by the Escape-closes-everything shortcut. */
  anyOverlayOpen: boolean;
  setActiveToolPanel: (tool: ToolPanelId | null) => void;
  closeToolPanel: () => void;
  setActiveTrackPanel: (panel: TrackPanelId | null) => void;
  closeTrackPanel: () => void;
  /** Force-opens the Stylesheet panel only — cannot close it. Mirrors the
   * Style toolbar button and the `view.stylesheet` command today
   * (component-map.md §3 row 1). Kept distinct from
   * `toggleStylesheetPanel` on purpose: unifying the two would change F7's
   * observable behavior relative to the Style button, which this phase
   * must not do. */
  openStylesheetPanel: () => void;
  closeStylesheetPanel: () => void;
  /** Toggles the Stylesheet panel — this is F7's current behavior. See the
   * `openStylesheetPanel` note above for why this stays separate. */
  toggleStylesheetPanel: () => void;
  openFileIoPanel: () => void;
  closeFileIoPanel: () => void;
  openCommandPalette: (initialValue?: string) => void;
  closeCommandPalette: () => void;
  /** Closes every panel/overlay tracked here in one call — used by the
   * global Escape shortcut. */
  closeAllOverlays: () => void;
}

export function useToolWindowController(): ToolWindowController {
  const [state, setState] = useState<ToolWindowState>(initialState);

  function setActiveToolPanel(tool: ToolPanelId | null): void {
    setState((previous) => ({ ...previous, activeToolPanel: tool }));
  }

  function closeToolPanel(): void {
    setActiveToolPanel(null);
  }

  function setActiveTrackPanel(panel: TrackPanelId | null): void {
    setState((previous) => ({ ...previous, activeTrackPanel: panel }));
  }

  function closeTrackPanel(): void {
    setActiveTrackPanel(null);
  }

  function openStylesheetPanel(): void {
    setState((previous) => ({ ...previous, stylesheetPanelOpen: true }));
  }

  function closeStylesheetPanel(): void {
    setState((previous) => ({ ...previous, stylesheetPanelOpen: false }));
  }

  function toggleStylesheetPanel(): void {
    setState((previous) => ({ ...previous, stylesheetPanelOpen: !previous.stylesheetPanelOpen }));
  }

  function openFileIoPanel(): void {
    setState((previous) => ({ ...previous, fileIoPanelOpen: true }));
  }

  function closeFileIoPanel(): void {
    setState((previous) => ({ ...previous, fileIoPanelOpen: false }));
  }

  function openCommandPalette(initialValue = ""): void {
    setState((previous) => ({ ...previous, commandPalette: { open: true, initialValue } }));
  }

  function closeCommandPalette(): void {
    setState((previous) => ({ ...previous, commandPalette: { open: false } }));
  }

  function closeAllOverlays(): void {
    setState((previous) => ({
      ...previous,
      activeToolPanel: null,
      activeTrackPanel: null,
      stylesheetPanelOpen: false,
      fileIoPanelOpen: false,
      commandPalette: { open: false }
    }));
  }

  const commandPaletteOpen = state.commandPalette.open;
  const commandPaletteInitialValue = state.commandPalette.open ? state.commandPalette.initialValue : "";
  const anyOverlayOpen = Boolean(
    state.activeToolPanel ||
      state.activeTrackPanel ||
      state.stylesheetPanelOpen ||
      state.fileIoPanelOpen ||
      commandPaletteOpen
  );

  return {
    activeToolPanel: state.activeToolPanel,
    activeTrackPanel: state.activeTrackPanel,
    stylesheetPanelOpen: state.stylesheetPanelOpen,
    fileIoPanelOpen: state.fileIoPanelOpen,
    commandPaletteOpen,
    commandPaletteInitialValue,
    anyOverlayOpen,
    setActiveToolPanel,
    closeToolPanel,
    setActiveTrackPanel,
    closeTrackPanel,
    openStylesheetPanel,
    closeStylesheetPanel,
    toggleStylesheetPanel,
    openFileIoPanel,
    closeFileIoPanel,
    openCommandPalette,
    closeCommandPalette,
    closeAllOverlays
  };
}
