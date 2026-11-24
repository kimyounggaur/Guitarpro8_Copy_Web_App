// Playback transport controller — owns the PlaybackScheduler instance and
// the derived PlaybackCompilation, and exposes start/stop/seek.
//
// Extracted from src/App.tsx (see docs/ui-remaster/00-component-map.md §1,
// rows App.tsx:159-165 and App.tsx:1377-1421) as part of Phase 2's
// structural-only refactor.
import { useEffect, useMemo, useRef } from "react";
import { beatTickForCursor } from "../../engine/editing/operations";
import { metronomeClicks, countInAt } from "../../engine/audio/metronome";
import { setMeasureTempo, writtenBarStarts, writtenTempoMap } from "../../engine/audio/tempoMap";
import { useDocumentStore } from "../../store/documentStore";
import { useViewStore } from "../../store/viewStore";
import type { NoteEvent, PlaybackCompilation } from "../../engine/audio/compile";
import { PlaybackScheduler, unlockPlaybackAudio } from "../../engine/audio/scheduler";
import { getPlaybackLoop } from "../../engine/audio/playbackLoop";
import { PlaybackTransport } from "../../engine/audio/transport";
import { createMixerState, type MixerState } from "../../engine/audio/mixer";
import { compileMixerAutomation } from "../../engine/audio/mixerAutomation";
import { compilePlaybackOnMainThread, isLargePlaybackScore, preparePlaybackInWorker } from "../../engine/audio/playbackPreparation";
import type { CursorPosition, SelectionRange } from "../../engine/editing/types";
import type { Score } from "../../model/types";
import { usePlaybackStore, type PlaybackStatus } from "../../store/playbackStore";
import { usePlaybackCompilation } from "./usePlaybackCompilation";

export interface UsePlaybackControllerParams {
  score: Score;
  cursor: CursorPosition;
  selection: SelectionRange | null;
  speedPercent: number;
  mixer: MixerState;
  loopEnabled: boolean;
  metronomeEnabled: boolean;
  countInEnabled: boolean;
  setPlaybackStatus: (status: PlaybackStatus) => void;
  setPlaybackPosition: (position: { barIndex: number; tick: number; timeSec: number }) => void;
}

export interface PlaybackController {
  playbackCompilation: PlaybackCompilation;
  currentTempo: number;
  changeTempo: (bpm: number) => void;
  startPlayback: (startSec: number) => Promise<void>;
  stopPlayback: () => void;
  seek: (seconds: number) => void;
}

export function usePlaybackController(params: UsePlaybackControllerParams): PlaybackController {
  const {
    score,
    cursor,
    selection,
    speedPercent,
    mixer,
    loopEnabled,
    metronomeEnabled,
    countInEnabled,
    setPlaybackStatus,
    setPlaybackPosition
  } = params;

  const transportRef = useRef<PlaybackTransport | null>(null);
  const startGeneration = useRef(0);
  const tempoRequest = useRef<AbortController | null>(null);
  const mixerRef = useRef(mixer);
  mixerRef.current = mixer;

  useEffect(() => {
    return () => {
      startGeneration.current++;
      tempoRequest.current?.abort();
      transportRef.current?.stop();
    };
  }, []);
  useEffect(() => {
    transportRef.current?.setMixer(mixer, cursor.trackId);
  }, [mixer, cursor.trackId]);

  const { playbackCompilation, prepare } = usePlaybackCompilation(score, speedPercent);

  const loopRange = useMemo(() =>
    loopEnabled ? getPlaybackLoop(playbackCompilation, selection, cursor.barIndex) : null,
    [loopEnabled, playbackCompilation, selection, cursor.barIndex]
  );
  useEffect(() => {
    transportRef.current?.setLoop(loopRange);
  }, [loopRange?.startSec, loopRange?.endSec]);

  const { bpmAtTick: writtenBpmAtTick } = useMemo(() =>
    writtenTempoMap(score, { mode: "relative", percent: speedPercent }),
    [score, speedPercent]
  );
  const writtenStarts = useMemo(() => writtenBarStarts(score), [score]);
  const playbackTempo = usePlaybackStore((state) => state.tempo);
  const playing = usePlaybackStore((state) => state.status === "playing");
  const currentTempo = playing ? playbackTempo
    : writtenBpmAtTick((writtenStarts[cursor.barIndex] ?? 0) + beatTickForCursor(score, cursor));

  async function startPlayback(startSec: number): Promise<void> {
    const generation = ++startGeneration.current;
    setPlaybackStatus("starting");
    try {
      const [compilation] = await Promise.all([prepare(), unlockPlaybackAudio()]);
      if (generation !== startGeneration.current) return;
      if (useDocumentStore.getState().score !== score) {
        setPlaybackStatus("stopped");
        return;
      }
      await launchPlayback(score, compilation, startSec, countInEnabled);
    } catch {
      if (generation === startGeneration.current) setPlaybackStatus("stopped");
    }
  }

  async function launchPlayback(
    playbackScore: Score,
    compilation: PlaybackCompilation,
    startSec: number,
    countInEnabled: boolean
  ): Promise<void> {
    const transport = transportRef.current ?? new PlaybackTransport(new PlaybackScheduler(), setPlaybackStatus);
    transportRef.current = transport;
    const view = useViewStore.getState();
    const loop = usePlaybackStore.getState().loopEnabled
      ? getPlaybackLoop(compilation, view.selection, view.cursor.barIndex)
      : null;
    if (loop && (startSec < loop.startSec || startSec >= loop.endSec)) startSec = loop.startSec;

    const countIn = countInEnabled ? countInAt(playbackScore, compilation.tempoMap, startSec) : null;
    const events = [...compilation.events];
    if (metronomeEnabled) {
      for (const [index, click] of metronomeClicks(playbackScore, compilation.segments, compilation.tempoMap).entries()) {
        events.push(clickEvent(`metronome-${index}`, click.timeSec, click.downbeat));
      }
    }
    const countInEvents = (countIn?.clicks ?? []).map((click, index) =>
      clickEvent(`count-in-${index}`, click.timeSec, click.downbeat));
    await transport.play(compilation.tempoMap.secondsToTicks(startSec), {
      countInSeconds: countIn?.duration ?? 0,
      totalSeconds: compilation.totalSeconds,
      ticksToSeconds: compilation.tempoMap.ticksToSeconds,
      events,
      countInEvents,
      loop,
      mixer: mixerRef.current.tracks[playbackScore.tracks[0]?.id] ? mixerRef.current : createMixerState(playbackScore),
      focusedTrackId: useViewStore.getState().cursor.trackId,
      mixerAutomation: compileMixerAutomation(playbackScore, compilation),
      onPosition: (timeSec) => {
        const position = compilation.positionAtSecond(timeSec);
        usePlaybackStore.getState().setTempo(compilation.tempoMap.bpmAtTick(position.tick));
        setPlaybackPosition({
          barIndex: position.barIndex,
          tick: position.tick,
          timeSec: position.timeSec
        });
      },
    });
  }

  function changeTempo(bpm: number): void {
    if (!Number.isFinite(bpm)) return;
    const playback = usePlaybackStore.getState();
    const cursor = useViewStore.getState().cursor;
    const active = playback.status === "playing" || playback.status === "starting";
    const document = useDocumentStore.getState();
    const nextScore = document.transact("Set measure tempo", (draft) => {
      setMeasureTempo(draft, active ? playback.currentBarIndex : cursor.barIndex, bpm);
    });
    if (active && nextScore !== document.score) {
      tempoRequest.current?.abort();
      const controller = new AbortController();
      tempoRequest.current = controller;
      const speed = playback.speedPercent;
      const prepareTempo = isLargePlaybackScore(nextScore) && typeof Worker !== "undefined"
        ? preparePlaybackInWorker(nextScore, speed, controller.signal).catch((error: unknown) => {
            if (controller.signal.aborted) throw error;
            return compilePlaybackOnMainThread(nextScore, speed);
          })
        : Promise.resolve(compilePlaybackOnMainThread(nextScore, speed));
      void prepareTempo.then((compilation) => {
        if (controller.signal.aborted || useDocumentStore.getState().score !== nextScore) return;
        const time = compilation.tempoMap.ticksToSeconds(usePlaybackStore.getState().currentTick);
        return launchPlayback(nextScore, compilation, time, false);
      }).catch(() => undefined);
    }
  }

  function stopPlayback(): void {
    startGeneration.current++;
    tempoRequest.current?.abort();
    if (transportRef.current) {
      transportRef.current.stop();
    } else {
      setPlaybackStatus("stopped");
    }
  }

  function seek(seconds: number): void {
    transportRef.current?.seek(playbackCompilation.tempoMap.secondsToTicks(seconds));
  }

  return { playbackCompilation, currentTempo, changeTempo, startPlayback, stopPlayback, seek };
}

function clickEvent(id: string, timeSec: number, downbeat: boolean): NoteEvent {
  return {
    id,
    timeSec,
    durationSec: 0.035,
    startTick: 0,
    writtenTick: 0,
    durationTicks: 24,
    midiPitch: downbeat ? 96 : 84,
    velocity: downbeat ? 108 : 78,
    trackId: "__metronome__",
    barIndex: 0,
    voiceIndex: 0,
    beatIndex: 0,
    noteIndex: 0,
    string: 0,
    effects: {
      dead: false,
      ghost: false,
      palmMute: true,
      letRing: false,
      staccato: true,
      accent: downbeat ? "heavy" : "none",
      vibrato: "none",
      hopo: false,
      fadeIn: false,
      fadeOut: false,
      volumeSwell: false,
      slap: false,
      pop: false,
      deadSlapped: false,
      pickscrape: false,
      bend: false,
      bendPoints: [],
      slide: null,
      harmonic: null,
      harmonicShift: 0,
      wah: null,
      tremoloPicking: null,
      attackSec: 0.002,
      releaseSec: 0.02,
      filter: "palmMute"
    }
  };
}
