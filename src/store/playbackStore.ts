import { create } from "zustand";

export type PlaybackStatus = "stopped" | "playing" | "paused";

interface PlaybackStore {
  status: PlaybackStatus;
  tempo: number;
  setStatus: (status: PlaybackStatus) => void;
}

export const usePlaybackStore = create<PlaybackStore>((set) => ({
  status: "stopped",
  tempo: 120,
  setStatus: (status) => set({ status })
}));
