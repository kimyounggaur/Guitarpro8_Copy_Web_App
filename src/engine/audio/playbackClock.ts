type ClockTick = "schedule" | "position";

export class PlaybackClock {
  private worker: Worker | null = null;
  private scheduleTimer: number | null = null;
  private positionTimer: number | null = null;
  private generation = 0;

  start(onSchedule: () => void, onPosition: () => void): void {
    this.stop();
    const generation = this.generation;
    const fallback = () => {
      if (generation !== this.generation || this.scheduleTimer !== null) return;
      this.worker?.terminate();
      this.worker = null;
      this.scheduleTimer = window.setInterval(onSchedule, 25);
      this.positionTimer = window.setInterval(onPosition, 50);
    };

    if (typeof Worker === "undefined") {
      fallback();
      return;
    }
    try {
      const worker = new Worker(new URL("./playbackClock.worker.ts", import.meta.url), { type: "module" });
      this.worker = worker;
      worker.onmessage = (event: MessageEvent<ClockTick>) => {
        if (generation !== this.generation) return;
        if (event.data === "schedule") onSchedule();
        else if (event.data === "position") onPosition();
      };
      worker.onerror = fallback;
    } catch {
      fallback();
    }
  }

  stop(): void {
    this.generation++;
    this.worker?.terminate();
    this.worker = null;
    if (this.scheduleTimer !== null) window.clearInterval(this.scheduleTimer);
    if (this.positionTimer !== null) window.clearInterval(this.positionTimer);
    this.scheduleTimer = null;
    this.positionTimer = null;
  }
}
