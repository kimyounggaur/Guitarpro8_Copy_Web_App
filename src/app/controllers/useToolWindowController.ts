import { useOverlayStore, type OverlayKind } from "../../store/overlayStore";
import type { ToolPanelId } from "../../ui/shell/ToolPanels";
import type { TrackPanelId } from "../../ui/shell/TrackSystemPanels";

export type ToolWindowController = ReturnType<typeof useToolWindowController>;

export function useToolWindowController() {
  const { stack, show, dismiss } = useOverlayStore();
  const tool = stack.find((item) => item.kind === "tool");
  const track = stack.find((item) => item.kind === "track");
  const palette = stack.find((item) => item.kind === "palette");
  const stylesheetPanelOpen = stack.some((item) => item.kind === "style");

  function closeTopOverlay() {
    const entries = useOverlayStore.getState().stack;
    const top = entries[entries.length - 1];
    if (top) dismiss(top.kind);
  }

  function isOpen(kind: OverlayKind): boolean {
    return useOverlayStore.getState().stack.some((item) => item.kind === kind);
  }

  return {
    activeToolPanel: tool?.kind === "tool" ? tool.id : null,
    activeTrackPanel: track?.kind === "track" ? track.id : null,
    stylesheetPanelOpen,
    fileIoPanelOpen: isOpen("file"),
    shortcutHelpOpen: isOpen("help"),
    openShortcutHelp: () => show({kind: "help"}),
    closeShortcutHelp: () => dismiss("help"),
    commandPaletteOpen: Boolean(palette),
    commandPaletteInitialValue: palette?.kind === "palette" ? palette.initialValue : "",
    anyOverlayOpen: stack.length > 0,
    setActiveToolPanel: (id: ToolPanelId | null) => id ? show({ kind: "tool", id }) : dismiss("tool"),
    closeToolPanel: () => dismiss("tool"),
    setActiveTrackPanel: (id: TrackPanelId | null) => id ? show({ kind: "track", id }) : dismiss("track"),
    closeTrackPanel: () => dismiss("track"),
    openStylesheetPanel: () => show({ kind: "style" }),
    closeStylesheetPanel: () => dismiss("style"),
    toggleStylesheetPanel: () => isOpen("style") ? dismiss("style") : show({ kind: "style" }),
    openFileIoPanel: () => show({ kind: "file" }),
    closeFileIoPanel: () => dismiss("file"),
    openCommandPalette: (initialValue = "") => show({ kind: "palette", initialValue }),
    closeCommandPalette: () => dismiss("palette"),
    closeTopOverlay,
    closeAllOverlays: () => useOverlayStore.setState({ stack: [] })
  };
}
