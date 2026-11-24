import { create } from "zustand";
import type { ToolPanelId } from "../ui/shell/ToolPanels";
import type { TrackPanelId } from "../ui/shell/TrackSystemPanels";

export type EditorOverlay =
  | { kind: "tool"; id: ToolPanelId }
  | { kind: "track"; id: TrackPanelId }
  | { kind: "style" | "file" | "help" }
  | { kind: "palette"; initialValue: string };
export type OverlayKind = EditorOverlay["kind"];

interface OverlayState {
  stack: EditorOverlay[];
  show: (overlay: EditorOverlay) => void;
  dismiss: (kind: OverlayKind) => void;
  activate: (kind: OverlayKind) => void;
}

export const useOverlayStore = create<OverlayState>((set) => ({
  stack: [],
  show: (overlay) => set(({ stack }) => ({ stack: [...stack.filter((item) => item.kind !== overlay.kind), overlay] })),
  dismiss: (kind) => set(({ stack }) => ({ stack: stack.filter((item) => item.kind !== kind) })),
  activate: (kind) => set((state) => {
    const item = state.stack.find((entry) => entry.kind === kind);
    if (!item || state.stack[state.stack.length - 1] === item) return state;
    return { stack: [...state.stack.filter((entry) => entry !== item), item] };
  })
}));
