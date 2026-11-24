import type { SchedulerPlayOptions } from "./scheduler";
import type { MixerState } from "./mixer";
import type { PlaybackLoopRange } from "./playbackLoop";

export type TransportStatus = "stopped" | "starting" | "playing" | "paused";

interface TransportBackend {
  play(options: SchedulerPlayOptions): Promise<void>;
  stop(): void;
  seek(seconds: number, sessionId: number): void;
  setMixer?(mixer: MixerState, focusedTrackId: string | null): void;
  setLoop?(loop: PlaybackLoopRange | null): void;
}

interface PlaybackPlan {
  totalSeconds: number;
  countInSeconds: number;
  countInEvents?: SchedulerPlayOptions["countInEvents"];
  events: SchedulerPlayOptions["events"];
  loop?: PlaybackLoopRange | null;
  mixer?: SchedulerPlayOptions["mixer"];
  focusedTrackId?: SchedulerPlayOptions["focusedTrackId"];
  mixerAutomation?: SchedulerPlayOptions["mixerAutomation"];
  ticksToSeconds(tick: number): number;
  onPosition(timeSec: number): void;
  onEnded?(sessionId: number): void;
}

export class PlaybackTransport {
  private sessionId = 0;
  private state: TransportStatus = "stopped";
  private plan: PlaybackPlan | null = null;

  constructor(
    private readonly backend: TransportBackend,
    private readonly onStatus: (status: TransportStatus) => void
  ) {}

  async play(fromTick: number, plan: PlaybackPlan): Promise<void> {
    const sessionId = ++this.sessionId;
    this.plan = plan;
    this.setStatus("starting");

    try {
      const scoreStartSec = plan.ticksToSeconds(fromTick);
      await this.backend.play({
        sessionId,
        startSec: scoreStartSec - plan.countInSeconds,
        scoreStartSec,
        countInEvents: plan.countInEvents,
        totalSeconds: plan.totalSeconds,
        events: plan.events,
        loop: plan.loop,
        mixer: plan.mixer,
        focusedTrackId: plan.focusedTrackId,
        mixerAutomation: plan.mixerAutomation,
        onPosition: (position) => {
          if (this.isActive(position.sessionId)) plan.onPosition(position.timeSec);
        },
        onEnded: (endedSession) => {
          if (!this.isActive(endedSession)) return;
          this.plan = null;
          this.setStatus("stopped");
          plan.onEnded?.(endedSession);
        }
      });
      if (this.isActive(sessionId)) this.setStatus("playing");
    } catch {
      if (this.isActive(sessionId)) this.stop();
    }
  }

  pause(): void {
    if (this.isActive(this.sessionId)) this.endCurrentSession("paused");
  }

  stop(): void {
    this.endCurrentSession("stopped");
  }

  seek(tick: number): void {
    if (this.plan && this.isActive(this.sessionId)) {
      this.backend.seek(this.plan.ticksToSeconds(tick), this.sessionId);
    }
  }

  setMixer(mixer: MixerState, focusedTrackId: string | null): void {
    this.backend.setMixer?.(mixer, focusedTrackId);
  }

  setLoop(loop: PlaybackLoopRange | null): void {
    if (this.isActive(this.sessionId)) this.backend.setLoop?.(loop);
  }

  isCurrent(sessionId: number): boolean {
    return sessionId === this.sessionId;
  }

  private isActive(sessionId: number): boolean {
    return this.isCurrent(sessionId) && (this.state === "starting" || this.state === "playing");
  }

  private endCurrentSession(status: "paused" | "stopped") {
    this.sessionId++;
    this.plan = null;
    this.backend.stop();
    this.setStatus(status);
  }

  private setStatus(status: TransportStatus) {
    if (this.state === status) return;
    this.state = status;
    this.onStatus(status);
  }
}
