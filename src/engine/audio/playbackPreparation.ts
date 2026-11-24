import type { Score } from "../../model/types";
import { unrollScore, type UnrollResult } from "../unroll/unrollScore";
import { assemblePlaybackCompilation, compilePlayback, type NoteEvent, type PlaybackCompilation } from "./compile";
import { buildTempoMap } from "./tempoMap";

interface CompilationData {
  order: UnrollResult;
  events: NoteEvent[];
}

export function isLargePlaybackScore(score: Score): boolean {
  return score.masterBars.length * score.tracks.length >= 200;
}

export function compilePlaybackOnMainThread(score: Score, speed: number): PlaybackCompilation {
  return compilePlayback(score, unrollScore(score), { mode: "relative", percent: speed });
}

export function makePlaybackTimeline(score: Score, speed: number): PlaybackCompilation {
  const order = unrollScore(score);
  return assemblePlaybackCompilation(order, [], buildTempoMap(score, order.segments, { mode: "relative", percent: speed }));
}

export function preparePlaybackInWorker(score: Score, speed: number, signal: AbortSignal): Promise<PlaybackCompilation> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Playback preparation ended.", "AbortError"));
      return;
    }

    const worker = new Worker(new URL("./playbackCompiler.worker.ts", import.meta.url), { type: "module" });
    function cleanUp() {
      signal.removeEventListener("abort", abort);
      worker.terminate();
    }
    function abort() {
      cleanUp();
      reject(new DOMException("Playback preparation ended.", "AbortError"));
    }

    signal.addEventListener("abort", abort, { once: true });
    worker.onmessage = (event: MessageEvent<CompilationData>) => {
      const { order, events } = event.data;
      cleanUp();
      resolve(assemblePlaybackCompilation(order, events, buildTempoMap(score, order.segments, { mode: "relative", percent: speed })));
    };
    worker.onerror = () => {
      cleanUp();
      reject(new Error("The playback worker could not prepare this score."));
    };
    try {
      worker.postMessage({ score, speed });
    } catch (error) {
      cleanUp();
      reject(error);
    }
  });
}
