import { create } from "zustand";

export type InspectorTab = "song" | "track";
export type DockSize = "left" | "right" | "global" | "automation" | "audio";

export const dockDefaults: Record<DockSize, number> = {
  left: 184,
  right: 232,
  global: 166,
  automation: 136,
  audio: 112
};

export const dockLimits: Record<DockSize, readonly [number, number]> = {
  left: [164, 300],
  right: [192, 340],
  global: [86, 440],
  automation: [86, 340],
  audio: [72, 260]
};

const storageKey = "tabscore.editor-layout.v1";

interface LayoutState {
  sizes: Record<DockSize, number>;
  activeInspectorTab: InspectorTab;
  paletteCollapsed: Record<string, boolean>;
  paletteScroll: number;
}

interface LayoutStore extends LayoutState {
  setDockSize: (dock: DockSize, size: number) => void;
  save: () => void;
  activateInspector: (tab: InspectorTab) => void;
  togglePaletteSection: (section: string) => void;
  setPaletteScroll: (scroll: number) => void;
}

const defaultState: LayoutState = {
  sizes: dockDefaults,
  activeInspectorTab: "song",
  paletteCollapsed: {},
  paletteScroll: 0
};

export const useLayoutStore = create<LayoutStore>((set, get) => ({
  ...loadLayout(),
  setDockSize: (dock, size) => set((state) => ({
    sizes: { ...state.sizes, [dock]: clampDock(dock, size) }
  })),
  save: () => saveLayout(get()),
  activateInspector: (activeInspectorTab) => {
    set({ activeInspectorTab });
    saveLayout(get());
  },
  togglePaletteSection: (section) => {
    set((state) => ({
      paletteCollapsed: { ...state.paletteCollapsed, [section]: !state.paletteCollapsed[section] }
    }));
    saveLayout(get());
  },
  setPaletteScroll: (paletteScroll) => {
    set({ paletteScroll });
    saveLayout(get());
  }
}));

export function clampDock(dock: DockSize, size: unknown): number {
  const [min, max] = dockLimits[dock];
  return typeof size === "number" && Number.isFinite(size)
    ? Math.min(max, Math.max(min, Math.round(size)))
    : dockDefaults[dock];
}

function loadLayout(): LayoutState {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    if (stored?.version !== 1) return defaultState;
    return {
      sizes: {
        left: clampDock("left", stored.sizes?.left),
        right: clampDock("right", stored.sizes?.right),
        global: clampDock("global", stored.sizes?.global),
        automation: clampDock("automation", stored.sizes?.automation),
        audio: clampDock("audio", stored.sizes?.audio)
      },
      activeInspectorTab: stored.activeInspectorTab === "track" ? "track" : "song",
      paletteCollapsed: stored.paletteCollapsed && typeof stored.paletteCollapsed === "object"
        ? Object.fromEntries(Object.entries(stored.paletteCollapsed).flatMap(([key, value]) => value === true ? [[key, true] as const] : []))
        : {},
      paletteScroll: typeof stored.paletteScroll === "number" && Number.isFinite(stored.paletteScroll)
        ? Math.max(0, stored.paletteScroll)
        : 0
    };
  } catch {
    return defaultState;
  }
}

function saveLayout({ sizes, activeInspectorTab, paletteCollapsed, paletteScroll }: LayoutState) {
  try {
    localStorage.setItem(storageKey, JSON.stringify({
      version: 1, sizes, activeInspectorTab, paletteCollapsed, paletteScroll
    }));
  } catch {
    // Panels remain usable without persistent browser storage.
  }
}
