import { create } from "zustand";

export type AppPlatform = "win" | "mac";

interface PreferencesStore {
  platform: AppPlatform;
  forceZoom: number | null;
  setForceZoom: (zoom: number | null) => void;
}

export const usePreferencesStore = create<PreferencesStore>((set) => ({
  platform: navigator.platform.toLowerCase().includes("mac") ? "mac" : "win",
  forceZoom: null,
  setForceZoom: (forceZoom) => set({ forceZoom })
}));
