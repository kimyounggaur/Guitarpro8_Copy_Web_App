import { create } from "zustand";

export type AppPlatform = "win" | "mac";

export interface PanelVisibility {
  palette: boolean;
  songInspector: boolean;
  trackInspector: boolean;
  globalView: boolean;
  automationView: boolean;
}

interface PreferencesStore {
  platform: AppPlatform;
  forceZoom: number | null;
  invertPlusMinus: boolean;
  panelVisibility: PanelVisibility;
  setForceZoom: (zoom: number | null) => void;
  setInvertPlusMinus: (invertPlusMinus: boolean) => void;
  togglePanel: (panel: keyof PanelVisibility) => void;
}

const panelStorageKey = "gp8-clone-panel-visibility";

export const usePreferencesStore = create<PreferencesStore>((set) => ({
  platform: navigator.platform.toLowerCase().includes("mac") ? "mac" : "win",
  forceZoom: null,
  invertPlusMinus: false,
  panelVisibility: loadPanelVisibility(),
  setForceZoom: (forceZoom) => set({ forceZoom }),
  setInvertPlusMinus: (invertPlusMinus) => set({ invertPlusMinus }),
  togglePanel: (panel) =>
    set((state) => {
      const panelVisibility = {
        ...state.panelVisibility,
        [panel]: !state.panelVisibility[panel]
      };
      savePanelVisibility(panelVisibility);
      return { panelVisibility };
    })
}));

function loadPanelVisibility(): PanelVisibility {
  const fallback: PanelVisibility = {
    palette: true,
    songInspector: true,
    trackInspector: true,
    globalView: true,
    automationView: false
  };

  if (typeof localStorage === "undefined") {
    return fallback;
  }

  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(panelStorageKey) ?? "{}") };
  } catch {
    return fallback;
  }
}

function savePanelVisibility(panelVisibility: PanelVisibility): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  localStorage.setItem(panelStorageKey, JSON.stringify(panelVisibility));
}
