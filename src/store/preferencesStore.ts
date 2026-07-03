import { create } from "zustand";

export type AppPlatform = "win" | "mac";

interface PreferencesStore {
  platform: AppPlatform;
  forceZoom: number | null;
  invertPlusMinus: boolean;
  setForceZoom: (zoom: number | null) => void;
  setInvertPlusMinus: (invertPlusMinus: boolean) => void;
}

export const usePreferencesStore = create<PreferencesStore>((set) => ({
  platform: navigator.platform.toLowerCase().includes("mac") ? "mac" : "win",
  forceZoom: null,
  invertPlusMinus: false,
  setForceZoom: (forceZoom) => set({ forceZoom }),
  setInvertPlusMinus: (invertPlusMinus) => set({ invertPlusMinus })
}));
