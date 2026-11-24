// Tracks the editor panels and restores focus to the control that opened each one.
import { useRef, useState } from "react";
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
  openStylesheetPanel: () => void;
  closeStylesheetPanel: () => void;
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

  const openers = useRef(new Map<keyof ToolWindowState, HTMLElement>());

  function rememberFocus(overlay: keyof ToolWindowState): void {
    const activeElement = document.activeElement;
    if (!openers.current.has(overlay) && activeElement instanceof HTMLElement) {
      openers.current.set(overlay, activeElement);
    }
  }

  function restoreFocus(overlay: keyof ToolWindowState): void {
    const opener = openers.current.get(overlay);
    if (!opener) return;
    openers.current.delete(overlay);
    requestAnimationFrame(() => {
      const target = opener.isConnected && opener !== document.body
        ? opener
        : document.querySelector<HTMLElement>(".scoreViewport");
      target?.focus({ preventScroll: true });
    });
  }

  function setActiveToolPanel(tool: ToolPanelId | null): void {
    if (tool) rememberFocus("activeToolPanel");
    else restoreFocus("activeToolPanel");
    setState((previous) => ({ ...previous, activeToolPanel: tool }));
  }

  function closeToolPanel(): void {
    setActiveToolPanel(null);
  }

  function setActiveTrackPanel(panel: TrackPanelId | null): void {
    if (panel) rememberFocus("activeTrackPanel");
    else restoreFocus("activeTrackPanel");
    setState((previous) => ({ ...previous, activeTrackPanel: panel }));
  }

  function closeTrackPanel(): void {
    setActiveTrackPanel(null);
  }

  function openStylesheetPanel(): void {
    rememberFocus("stylesheetPanelOpen");
    setState((previous) => ({ ...previous, stylesheetPanelOpen: true }));
  }

  function closeStylesheetPanel(): void {
    restoreFocus("stylesheetPanelOpen");
    setState((previous) => ({ ...previous, stylesheetPanelOpen: false }));
  }

  function toggleStylesheetPanel(): void {
    if (state.stylesheetPanelOpen) closeStylesheetPanel();
    else openStylesheetPanel();
  }

  function openFileIoPanel(): void {
    rememberFocus("fileIoPanelOpen");
    setState((previous) => ({ ...previous, fileIoPanelOpen: true }));
  }

  function closeFileIoPanel(): void {
    restoreFocus("fileIoPanelOpen");
    setState((previous) => ({ ...previous, fileIoPanelOpen: false }));
  }

  function openCommandPalette(initialValue = ""): void {
    rememberFocus("commandPalette");
    setState((previous) => ({ ...previous, commandPalette: { open: true, initialValue } }));
  }

  function closeCommandPalette(): void {
    restoreFocus("commandPalette");
    setState((previous) => ({ ...previous, commandPalette: { open: false } }));
  }

  function closeAllOverlays(): void {
    const firstOverlay = openers.current.keys().next().value;
    if (firstOverlay) restoreFocus(firstOverlay);
    openers.current.clear();
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
