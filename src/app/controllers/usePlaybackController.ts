// Playback transport controller — owns the PlaybackScheduler instance and
// the derived PlaybackCompilation, and exposes start/stop/seek.
//
// Extracted from src/App.tsx (see docs/ui-remaster/00-component-map.md §1,
// rows App.tsx:159-165 and App.tsx:1377-1421) as part of Phase 2's
// structural-only refactor. Behavior is unchanged from the original.
import { useEffect, useMemo, useRef } from "react";
import { compilePlayback, type NoteEvent, type PlaybackCompilation } from "../../engine/audio/compile";
import { PlaybackScheduler } from "../../engine/audio/scheduler";
import type { MixerState } from "../../engine/audio/mixer";
import { unrollScore } from "../../engine/unroll/unrollScore";
import type { CursorPosition, SelectionRange } from "../../engine/editing/types";
import type { Score } from "../../model/types";
import type { PlaybackStatus } from "../../store/playbackStore";

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

  const schedulerRef = useRef<PlaybackScheduler | null>(null);

  useEffect(() => {
    return () => schedulerRef.current?.stop("manual");
  }, []);

  const playbackCompilation = useMemo(
    () =>
      compilePlayback(
        score,
        unrollScore(score),
        {
          mode: "relative",
          percent: speedPercent
        },
        mixer,
        cursor.trackId
      ),
    [score, speedPercent, mixer, cursor.trackId]
  );

  async function startPlayback(startSec: number): Promise<void> {
    const scheduler = schedulerRef.current ?? new PlaybackScheduler();
    schedulerRef.current = scheduler;
    const countInSeconds = countInEnabled ? countInDurationSeconds(playbackCompilation) : 0;
    const events = playbackEvents(playbackCompilation, {
      metronome: metronomeEnabled,
      countIn: countInEnabled,
      startSec,
      countInSeconds
    });

    setPlaybackStatus("playing");

    try {
      await scheduler.play({
        startSec: startSec - countInSeconds,
        totalSeconds: playbackCompilation.totalSeconds,
        events,
        onPosition: ({ timeSec }) => {
          const position = playbackCompilation.positionAtSecond(Math.max(0, timeSec));
          setPlaybackPosition({
            barIndex: position.barIndex,
            tick: position.tick,
            timeSec: position.timeSec
          });
        },
        onStop: (reason) => {
          setPlaybackStatus("stopped");

          if (reason === "ended" && loopEnabled) {
            window.setTimeout(() => {
              void startPlayback(loopStartSecond(playbackCompilation, selection, cursor.barIndex));
            }, 0);
          }
        }
      });
    } catch {
      setPlaybackStatus("stopped");
    }
  }

  function stopPlayback(): void {
    schedulerRef.current?.stop("manual");
    setPlaybackStatus("stopped");
  }

  function seek(seconds: number): void {
    schedulerRef.current?.seek(seconds);
  }

  return { playbackCompilation, startPlayback, stopPlayback, seek };
}

function playbackEvents(
  compilation: PlaybackCompilation,
  options: { metronome: boolean; countIn: boolean; startSec: number; countInSeconds: number }
): NoteEvent[] {
  const events = [...compilation.events];

  if (options.metronome) {
    compilation.segments.forEach((segment) => {
      for (let tick = segment.startTick; tick < segment.startTick + segment.durationTicks; tick += 480) {
        events.push(
          clickEvent(
            `metronome-${segment.sequenceIndex}-${tick}`,
            compilation.tempoMap.ticksToSeconds(tick),
            tick === segment.startTick
          )
        );
      }
    });
  }

  if (options.countIn) {
    const beatLength = options.countInSeconds / 4;

    for (let beat = 0; beat < 4; beat += 1) {
      events.push(
        clickEvent(
          `count-in-${beat}`,
          options.startSec - options.countInSeconds + beat * beatLength,
          beat === 0
        )
      );
    }
  }

  return events.sort((left, right) => left.timeSec - right.timeSec);
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
    },
    mix: {
      muted: false,
      gain: 0.9,
      pan: 0,
      eq: "bright",
      effectChain: []
    }
  };
}

function countInDurationSeconds(compilation: PlaybackCompilation): number {
  const bpm = compilation.tempoMap.points[0]?.bpm ?? 120;
  return (60 / bpm) * 4;
}

function loopStartSecond(
  compilation: PlaybackCompilation,
  selection: SelectionRange | null,
  fallbackBarIndex: number
): number {
  const barIndex = selection
    ? Math.min(selection.anchor.barIndex, selection.head.barIndex)
    : fallbackBarIndex;
  return compilation.secondAtBar(barIndex);
}
