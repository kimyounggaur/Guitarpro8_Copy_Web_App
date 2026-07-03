import { create } from "zustand";

export interface CursorState {
  trackId: string | null;
  barIndex: number;
  beatIndex: number;
  voiceIndex: number;
}

interface ViewStore {
  cursor: CursorState;
  selection: null;
  zoom: number;
  setZoom: (zoom: number) => void;
}

export const useViewStore = create<ViewStore>((set) => ({
  cursor: {
    trackId: null,
    barIndex: 0,
    beatIndex: 0,
    voiceIndex: 0
  },
  selection: null,
  zoom: 100,
  setZoom: (zoom) => set({ zoom })
}));
