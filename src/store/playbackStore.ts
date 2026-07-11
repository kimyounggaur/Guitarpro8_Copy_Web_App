import { create } from "zustand";
import {
  createDefaultMixerState,
  syncMixerToTracks,
  toggleEffectSlot,
  type EffectSlotType,
  type MixerState,
  type TrackMixerState
} from "../engine/audio/mixer";
import type { Track } from "../model/types";

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
  mixer: MixerState;
  setStatus: (status: PlaybackStatus) => void;
  setTempo: (tempo: number) => void;
  setPosition: (position: { barIndex: number; tick: number; timeSec: number }) => void;
  toggleLoop: () => void;
  toggleMetronome: () => void;
  toggleCountIn: () => void;
  setSpeedPercent: (speedPercent: number) => void;
  syncMixerTracks: (tracks: Track[]) => void;
  setTrackMixer: (trackId: string, patch: Partial<TrackMixerState>) => void;
  setMasterFocusPercent: (focusPercent: number) => void;
  toggleTrackEffect: (trackId: string, effect: EffectSlotType) => void;
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
  mixer: createDefaultMixerState(),
  setStatus: (status) => set({ status }),
  setTempo: (tempo) => set({ tempo }),
  setPosition: ({ barIndex, tick, timeSec }) =>
    set({ currentBarIndex: barIndex, currentTick: tick, currentTimeSec: timeSec }),
  toggleLoop: () => set((state) => ({ loopEnabled: !state.loopEnabled })),
  toggleMetronome: () => set((state) => ({ metronomeEnabled: !state.metronomeEnabled })),
  toggleCountIn: () => set((state) => ({ countInEnabled: !state.countInEnabled })),
  setSpeedPercent: (speedPercent) =>
    set({ speedPercent: Math.min(300, Math.max(10, speedPercent)) }),
  syncMixerTracks: (tracks) => set((state) => ({ mixer: syncMixerToTracks(state.mixer, tracks) })),
  setTrackMixer: (trackId, patch) =>
    set((state) => {
      const trackMixer = state.mixer.tracks[trackId];

      if (!trackMixer) {
        return state;
      }

      return {
        mixer: {
          ...state.mixer,
          tracks: {
            ...state.mixer.tracks,
            [trackId]: {
              ...trackMixer,
              ...patch
            }
          }
        }
      };
    }),
  setMasterFocusPercent: (focusPercent) =>
    set((state) => ({
      mixer: {
        ...state.mixer,
        master: {
          ...state.mixer.master,
          focusPercent: Math.min(100, Math.max(-100, focusPercent))
        }
      }
    })),
  toggleTrackEffect: (trackId, effect) =>
    set((state) => ({
      mixer: toggleEffectSlot(state.mixer, trackId, effect)
    }))
}));
