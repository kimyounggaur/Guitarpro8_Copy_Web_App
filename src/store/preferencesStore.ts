import { create } from "zustand";
import { useLayoutStore } from "./layoutStore";
import { stylesheetSchema } from "../io/scoreSchema";
import type { Stylesheet } from "../model/types";

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
  defaultStylesheet: Stylesheet | null;
  setDefaultStylesheet: (stylesheet: Stylesheet) => boolean;
  setForceZoom: (zoom: number | null) => void;
  setInvertPlusMinus: (invertPlusMinus: boolean) => void;
  togglePanel: (panel: keyof PanelVisibility) => void;
}

const panelStorageKey = "gp8-clone-panel-visibility";
// The older editor wrote this preference without reading it.
const styleStorageKey = "gp8-clone-saved-stylesheet";

export const usePreferencesStore = create<PreferencesStore>((set) => ({
  platform: typeof navigator !== "undefined" && navigator.platform.toLowerCase().includes("mac") ? "mac" : "win",
  forceZoom: null,
  invertPlusMinus: false,
  panelVisibility: loadPanelVisibility(),
  defaultStylesheet: loadDefaultStylesheet(),
  setDefaultStylesheet: (value) => {
    const stylesheet = stylesheetSchema.safeParse(value);
    if (!stylesheet.success) return false;
    set({ defaultStylesheet: stylesheet.data });
    try {
      if (typeof localStorage === "undefined") return false;
      localStorage.setItem(styleStorageKey, JSON.stringify(stylesheet.data));
      return true;
    } catch {
      return false;
    }
  },
  setForceZoom: (forceZoom) => set({ forceZoom }),
  setInvertPlusMinus: (invertPlusMinus) => set({ invertPlusMinus }),
  togglePanel: (panel) =>
    set((state) => {
      let panelVisibility: PanelVisibility;
      if (panel === "songInspector" || panel === "trackInspector") {
        const tab = panel === "songInspector" ? "song" : "track";
        const layout = useLayoutStore.getState();
        const visible = state.panelVisibility.songInspector || state.panelVisibility.trackInspector;
        const close = visible && layout.activeInspectorTab === tab;
        layout.activateInspector(tab);
        panelVisibility = {
          ...state.panelVisibility,
          songInspector: !close && tab === "song",
          trackInspector: !close && tab === "track"
        };
      } else {
        panelVisibility = { ...state.panelVisibility, [panel]: !state.panelVisibility[panel] };
      }
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
    const stored = JSON.parse(localStorage.getItem(panelStorageKey) ?? "{}");
    for (const panel of Object.keys(fallback) as Array<keyof PanelVisibility>) {
      if (typeof stored?.[panel] === "boolean") fallback[panel] = stored[panel];
    }
    return fallback;
  } catch {
    return fallback;
  }
}

function savePanelVisibility(panelVisibility: PanelVisibility): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  try {
    localStorage.setItem(panelStorageKey, JSON.stringify(panelVisibility));
  } catch {
    // Visibility is still available for the current editing session.
  }
}

function loadDefaultStylesheet(): Stylesheet | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(styleStorageKey);
    if (!raw) return null;
    const style = stylesheetSchema.safeParse(JSON.parse(raw));
    return style.success ? style.data : null;
  } catch {
    return null;
  }
}
