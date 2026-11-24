import type { PlaybackCompilation, NoteEvent } from "./compile";
import type { SelectionRange } from "../editing/types";

export interface PlaybackLoopRange {
  startSec: number;
  endSec: number;
}

export function getPlaybackLoop(
  compilation: PlaybackCompilation,
  selection: SelectionRange | null,
  cursorBar: number
): PlaybackLoopRange | null {
  const { segments, tempoMap, totalSeconds } = compilation;
  if (!selection) {
    const startSec = compilation.secondAtBar(cursorBar);
    return startSec < totalSeconds ? { startSec, endSec: totalSeconds } : null;
  }

  const first = Math.min(selection.anchor.barIndex, selection.head.barIndex);
  const last = Math.max(selection.anchor.barIndex, selection.head.barIndex);
  const startIndex = segments.findIndex(({ barIndex }) => barIndex >= first && barIndex <= last);
  if (startIndex < 0) return null;
  let endIndex = startIndex;
  while (endIndex + 1 < segments.length) {
    const next = segments[endIndex + 1].barIndex;
    if (next < first || next > last) break;
    endIndex++;
  }
  const lastSegment = segments[endIndex];
  return {
    startSec: tempoMap.ticksToSeconds(segments[startIndex].startTick),
    endSec: tempoMap.ticksToSeconds(lastSegment.startTick + lastSegment.durationTicks)
  };
}

export function wrappedPlaybackSecond(second: number, loop: PlaybackLoopRange | null): number {
  if (!loop || second < loop.endSec) return second;
  return loop.startSec + ((second - loop.endSec) % (loop.endSec - loop.startSec));
}

interface ScheduledEvent {
  event: NoteEvent;
  startSec: number;
  durationSec: number;
}

export class PlaybackEventQueue {
  private index: number;
  private elapsedOffset = 0;
  private phaseStart: number;
  private readonly firstLoopEvent: number;
  private phaseEvents: readonly NoteEvent[];

  constructor(
    events: readonly NoteEvent[],
    initialStart: number,
    private readonly total: number,
    private readonly loop: PlaybackLoopRange | null,
    private readonly loopEvents = events
  ) {
    this.phaseStart = initialStart;
    this.phaseEvents = events;
    this.index = events.findIndex((event) => event.timeSec + event.durationSec > initialStart);
    this.firstLoopEvent = loop
      ? this.loopEvents.findIndex((event) => event.timeSec < loop.endSec && event.timeSec + event.durationSec > loop.startSec)
      : -1;
  }

  takeThrough(horizon: number, now: number): ScheduledEvent[] {
    const rightEdge = this.loop?.endSec ?? this.total;
    const due: ScheduledEvent[] = [];
    for (;;) {
      const event = this.index < 0 ? undefined : this.phaseEvents[this.index];
      if (!event || event.timeSec >= rightEdge) {
        if (!this.loop || this.firstLoopEvent < 0 || rightEdge + this.elapsedOffset > horizon) break;
        this.elapsedOffset += this.loop.endSec - this.loop.startSec;
        this.phaseStart = this.loop.startSec;
        this.phaseEvents = this.loopEvents;
        this.index = this.firstLoopEvent;
        continue;
      }

      const startSec = Math.max(event.timeSec, this.phaseStart) + this.elapsedOffset;
      if (startSec > horizon) break;

      const endSec = Math.min(event.timeSec + event.durationSec, rightEdge) + this.elapsedOffset;
      const triggerSec = Math.max(startSec, now);
      if (endSec > triggerSec) due.push({ event, startSec: triggerSec, durationSec: endSec - triggerSec });
      this.index++;
    }
    return due;
  }
}
