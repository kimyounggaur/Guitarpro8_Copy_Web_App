import { create } from "zustand";
import type { CursorPosition, SelectionRange, StaffKind } from "../engine/editing/types";

interface ViewStore {
  cursor: CursorPosition;
  selection: SelectionRange | null;
  zoom: number;
  trackVisibility: Record<string, boolean>;
  setCursor: (cursor: CursorPosition) => void;
  patchCursor: (cursor: Partial<CursorPosition>) => void;
  setSelection: (selection: SelectionRange | null) => void;
  setStaffKind: (staffKind: StaffKind) => void;
  setZoom: (zoom: number) => void;
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
  zoom: 100,
  trackVisibility: {},
  setCursor: (cursor) => set({ cursor }),
  patchCursor: (cursor) => set((state) => ({ cursor: { ...state.cursor, ...cursor } })),
  setSelection: (selection) => set({ selection }),
  setStaffKind: (staffKind) => set((state) => ({ cursor: { ...state.cursor, staffKind } })),
  setZoom: (zoom) => set({ zoom }),
  setTrackVisible: (trackId, visible) => set((state) => ({
    trackVisibility: { ...state.trackVisibility, [trackId]: visible }
  }))
}));
