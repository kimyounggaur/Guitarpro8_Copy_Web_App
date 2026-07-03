import { create } from "zustand";

export type PlaybackStatus = "stopped" | "playing" | "paused";

interface PlaybackStore {
  status: PlaybackStatus;
  tempo: number;
  currentBarIndex: number;
  currentTick: number;
  currentTimeSec: number;
  loopEnabled: boolean;
  metronomeEnabled: boolean;
  countInEnabled: boolean;
  speedPercent: number;
  setStatus: (status: PlaybackStatus) => void;
  setTempo: (tempo: number) => void;
  setPosition: (position: { barIndex: number; tick: number; timeSec: number }) => void;
  toggleLoop: () => void;
  toggleMetronome: () => void;
  toggleCountIn: () => void;
  setSpeedPercent: (speedPercent: number) => void;
}

export const usePlaybackStore = create<PlaybackStore>((set) => ({
  status: "stopped",
  tempo: 120,
  currentBarIndex: 0,
  currentTick: 0,
  currentTimeSec: 0,
  loopEnabled: false,
  metronomeEnabled: false,
  countInEnabled: false,
  speedPercent: 100,
  setStatus: (status) => set({ status }),
  setTempo: (tempo) => set({ tempo }),
  setPosition: ({ barIndex, tick, timeSec }) =>
    set({ currentBarIndex: barIndex, currentTick: tick, currentTimeSec: timeSec }),
  toggleLoop: () => set((state) => ({ loopEnabled: !state.loopEnabled })),
  toggleMetronome: () => set((state) => ({ metronomeEnabled: !state.metronomeEnabled })),
  toggleCountIn: () => set((state) => ({ countInEnabled: !state.countInEnabled })),
  setSpeedPercent: (speedPercent) =>
    set({ speedPercent: Math.min(300, Math.max(10, speedPercent)) })
}));
