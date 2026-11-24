import { create } from "zustand";
import { toggleEffectSlot, type EffectSlotType, type TrackMixerState } from "../engine/audio/mixer";
import type { TransportStatus } from "../engine/audio/transport";
import type { TrackMix } from "../model/mix";
import { useDocumentStore } from "./documentStore";
import { useViewStore } from "./viewStore";

export type PlaybackStatus = TransportStatus;
export type MixerEditPhase = "preview" | "commit";

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
  trackControls: Record<string, Partial<TrackMixerState>>;
  focusPreview: number | null;
  setStatus: (status: PlaybackStatus) => void;
  setTempo: (tempo: number) => void;
  setPosition: (position: { barIndex: number; tick: number; timeSec: number }) => void;
  toggleLoop: () => void;
  toggleMetronome: () => void;
  toggleCountIn: () => void;
  setSpeedPercent: (speedPercent: number) => void;
  setTrackMixer: (trackId: string, patch: Partial<TrackMixerState>, phase?: MixerEditPhase) => void;
  setMasterFocusPercent: (focusPercent: number, phase?: MixerEditPhase) => void;
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
  trackControls: {},
  focusPreview: null,
  setStatus: (status) => set({ status }),
  setTempo: (tempo) => set((state) => state.tempo === tempo ? state : { tempo }),
  setPosition: ({ barIndex, tick, timeSec }) =>
    set({ currentBarIndex: barIndex, currentTick: tick, currentTimeSec: timeSec }),
  toggleLoop: () => set((state) => ({ loopEnabled: !state.loopEnabled })),
  toggleMetronome: () => set((state) => ({ metronomeEnabled: !state.metronomeEnabled })),
  toggleCountIn: () => set((state) => ({ countInEnabled: !state.countInEnabled })),
  setSpeedPercent: (speedPercent) =>
    set({ speedPercent: clamp(speedPercent, 10, 300) }),
  setTrackMixer: (trackId, patch, phase = "commit") => {
    const { visible, volumeAutomationEnabled, panAutomationEnabled, effectChain, ...values } = patch;
    if (visible !== undefined) useViewStore.getState().setTrackVisible(trackId, visible);
    const document = useDocumentStore.getState();
    const track = document.score.tracks.find(({ id }) => id === trackId);
    if (!track) return;

    const change: Partial<TrackMix> = { ...values };
    if (values.volume !== undefined) change.volume = clamp(values.volume, 0, 1);
    if (values.pan !== undefined) change.pan = clamp(values.pan, -1, 1);
    if (effectChain !== undefined) change.effects = effectChain;

    if (phase === "commit" && Object.entries(change).some(([key, value]) => track.mix[key as keyof TrackMix] !== value)) {
      document.transact("Mix track", (score) => {
        const draft = score.tracks.find(({ id }) => id === trackId);
        if (draft) Object.assign(draft.mix, change);
      });
    }

    set((state) => {
      const controls = { ...state.trackControls[trackId] };
      if (volumeAutomationEnabled !== undefined) controls.volumeAutomationEnabled = volumeAutomationEnabled;
      if (panAutomationEnabled !== undefined) controls.panAutomationEnabled = panAutomationEnabled;
      if (change.volume !== undefined) controls.volume = phase === "preview" ? change.volume : undefined;
      if (change.pan !== undefined) controls.pan = phase === "preview" ? change.pan : undefined;
      if (controls.volume === undefined) delete controls.volume;
      if (controls.pan === undefined) delete controls.pan;
      return { trackControls: { ...state.trackControls, [trackId]: controls } };
    });
  },
  setMasterFocusPercent: (value, phase = "commit") => {
    const focus = clamp(value, -100, 100);
    if (phase === "preview") {
      set({ focusPreview: focus });
      return;
    }
    const document = useDocumentStore.getState();
    if (document.score.masterMix.focusPercent !== focus) {
      document.transact("Set master focus", (score) => { score.masterMix.focusPercent = focus; });
    }
    set({ focusPreview: null });
  },
  toggleTrackEffect: (trackId, effect) => {
    useDocumentStore.getState().transact("Toggle track effect", (score) => {
      const track = score.tracks.find(({ id }) => id === trackId);
      if (track) track.mix.effects = toggleEffectSlot(track.mix.effects, effect);
    });
  }
}));

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
