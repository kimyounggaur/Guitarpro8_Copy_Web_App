import { create } from "zustand";
import { defaultDocumentView } from "../model/documentView";
import type { DisplayMode, DocumentViewSettings } from "../model/types";
import type { CursorPosition, SelectionRange, StaffKind } from "../engine/editing/types";

interface ViewStore extends DocumentViewSettings {
  cursor: CursorPosition;
  selection: SelectionRange | null;
  trackVisibility: Record<string, boolean>;
  setCursor: (cursor: CursorPosition) => void;
  patchCursor: (cursor: Partial<CursorPosition>) => void;
  setSelection: (selection: SelectionRange | null) => void;
  setStaffKind: (staffKind: StaffKind) => void;
  setZoom: (zoom: number) => void;
  setDisplayMode: (displayMode: DisplayMode) => void;
  setDocumentView: (view?: DocumentViewSettings) => void;
  setTrackVisible: (trackId: string, visible: boolean) => void;
}

export const initialCursor: CursorPosition = {
  trackId: null,
  barIndex: 0,
  beatIndex: 0,
  voiceIndex: 0,
  string: 1,
  staffLine: 0,
  staffKind: "tab"
};

export const useViewStore = create<ViewStore>((set) => ({
  cursor: initialCursor,
  selection: null,
  ...defaultDocumentView,
  trackVisibility: {},
  setCursor: (cursor) => set({ cursor }),
  patchCursor: (cursor) => set((state) => ({ cursor: { ...state.cursor, ...cursor } })),
  setSelection: (selection) => set({ selection }),
  setStaffKind: (staffKind) => set((state) => ({ cursor: { ...state.cursor, staffKind } })),
  setZoom: (zoom) => set({ zoom }),
  setDisplayMode: (displayMode) => set({ displayMode }),
  setDocumentView: (view = defaultDocumentView) => set({ ...view, trackVisibility: {} }),
  setTrackVisible: (trackId, visible) => set((state) => ({
    trackVisibility: { ...state.trackVisibility, [trackId]: visible }
  }))
}));


export function getDocumentView(): DocumentViewSettings {
  const { zoom, displayMode } = useViewStore.getState();
  return { zoom, displayMode };
}
