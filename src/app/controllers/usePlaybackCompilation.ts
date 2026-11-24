import { useEffect, useMemo, useRef, useState } from "react";
import type { PlaybackCompilation } from "../../engine/audio/compile";
import { compilePlaybackOnMainThread, isLargePlaybackScore, makePlaybackTimeline, preparePlaybackInWorker } from "../../engine/audio/playbackPreparation";
import type { Score } from "../../model/types";

interface Prepared {
  score: Score;
  speed: number;
  compilation: PlaybackCompilation;
}

interface Preparation extends Pick<Prepared, "score" | "speed"> {
  controller: AbortController;
  promise: Promise<PlaybackCompilation>;
}

export function usePlaybackCompilation(score: Score, speed: number) {
  const large = isLargePlaybackScore(score) && typeof Worker !== "undefined";
  const [completed, setCompleted] = useState<Prepared | null>(null);
  const request = useRef<Preparation | null>(null);
  const timeline = useMemo(() =>
    large ? makePlaybackTimeline(score, speed) : compilePlaybackOnMainThread(score, speed),
    [large, score, speed]
  );

  function prepare(): Promise<PlaybackCompilation> {
    if (!large) return Promise.resolve(timeline);
    if (completed?.score === score && completed.speed === speed) return Promise.resolve(completed.compilation);
    const existing = request.current;
    if (existing?.score === score && existing.speed === speed && !existing.controller.signal.aborted) {
      return existing.promise;
    }

    existing?.controller.abort();
    const controller = new AbortController();
    const promise = preparePlaybackInWorker(score, speed, controller.signal)
      .catch((error: unknown) => {
        if (controller.signal.aborted) throw error;
        return compilePlaybackOnMainThread(score, speed);
      })
      .then((compilation) => {
        if (!controller.signal.aborted) setCompleted({ score, speed, compilation });
        return compilation;
      });
    request.current = { score, speed, controller, promise };
    return promise;
  }

  useEffect(() => {
    if (!large) return;
    // Rapid edits are compiled from their newest snapshot, while Play can request it immediately.
    const timer = window.setTimeout(() => { void prepare().catch(() => undefined); }, 80);
    return () => {
      window.clearTimeout(timer);
      const pending = request.current;
      if (pending?.score === score && pending.speed === speed) {
        pending.controller.abort();
        request.current = null;
      }
    };
  }, [large, score, speed]);

  return {
    playbackCompilation: large && completed?.score === score && completed.speed === speed
      ? completed.compilation : timeline,
    prepare
  };
}
