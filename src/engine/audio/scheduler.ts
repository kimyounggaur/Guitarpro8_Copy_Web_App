import type { NoteEvent } from "./compile";
import { SimpleSynth, type ScheduledVoice } from "./sampler";

export interface SchedulerPosition {
  timeSec: number;
}

export interface SchedulerPlayOptions {
  startSec: number;
  totalSeconds: number;
  events: NoteEvent[];
  onPosition: (position: SchedulerPosition) => void;
  onStop: (reason: "manual" | "ended") => void;
}

const LOOKAHEAD_SEC = 0.1;
const SCHEDULE_INTERVAL_MS = 25;
const POSITION_INTERVAL_MS = 50;

export class PlaybackScheduler {
  private context: AudioContext | null = null;
  private synth: SimpleSynth | null = null;
  private scheduleTimer: number | null = null;
  private positionTimer: number | null = null;
  private scheduled: ScheduledVoice[] = [];
  private nextEventIndex = 0;
  private startAudioTime = 0;
  private startSec = 0;
  private options: SchedulerPlayOptions | null = null;

  async play(options: SchedulerPlayOptions): Promise<void> {
    this.stop("manual");
    this.context = await audioContext();
    await this.context.resume();
    this.synth = new SimpleSynth(this.context);
    this.options = {
      ...options,
      events: [...options.events].sort((left, right) => left.timeSec - right.timeSec)
    };
    this.startSec = Math.min(options.totalSeconds, options.startSec);
    this.startAudioTime = this.context.currentTime;
    this.nextEventIndex = this.firstSchedulableEvent(this.startSec);
    this.scheduleTimer = window.setInterval(() => this.scheduleDueEvents(), SCHEDULE_INTERVAL_MS);
    this.positionTimer = window.setInterval(() => this.emitPosition(), POSITION_INTERVAL_MS);
    this.scheduleDueEvents();
    this.emitPosition();
  }

  stop(reason: "manual" | "ended" = "manual"): void {
    if (this.scheduleTimer !== null) {
      window.clearInterval(this.scheduleTimer);
      this.scheduleTimer = null;
    }

    if (this.positionTimer !== null) {
      window.clearInterval(this.positionTimer);
      this.positionTimer = null;
    }

    this.scheduled.forEach((voice) => {
      try {
        voice.oscillator.stop();
      } catch {
        // Already stopped by the audio graph.
      }
      voice.modulators.forEach((modulator) => {
        try {
          modulator.stop();
        } catch {
          // Already stopped by the audio graph.
        }
        modulator.disconnect();
      });
      voice.nodes.forEach((node) => {
        try {
          node.disconnect();
        } catch {
          // Already disconnected by the audio graph.
        }
      });
    });
    this.scheduled = [];
    this.synth?.dispose();
    this.synth = null;

    const callback = this.options?.onStop;
    this.options = null;

    if (callback) {
      callback(reason);
    }
  }

  seek(seconds: number): void {
    const current = this.options;

    if (!current) {
      return;
    }

    void this.play({ ...current, startSec: seconds });
  }

  currentSecond(): number {
    if (!this.context || !this.options) {
      return this.startSec;
    }

    return this.startSec + (this.context.currentTime - this.startAudioTime);
  }

  private scheduleDueEvents(): void {
    if (!this.context || !this.synth || !this.options) {
      return;
    }

    const playbackSec = this.currentSecond();
    const horizon = playbackSec + LOOKAHEAD_SEC;

    while (this.nextEventIndex < this.options.events.length) {
      const event = this.options.events[this.nextEventIndex];

      if (event.timeSec > horizon) {
        break;
      }

      if (event.timeSec + event.durationSec >= playbackSec - 0.02) {
        const when = this.startAudioTime + event.timeSec - this.startSec;
        const voice = this.synth.trigger(event, Math.max(this.context.currentTime, when));

        if (voice) {
          this.scheduled.push(voice);
        }
      }

      this.nextEventIndex += 1;
    }

    if (playbackSec >= this.options.totalSeconds) {
      this.stop("ended");
    }
  }

  private emitPosition(): void {
    if (!this.options) {
      return;
    }

    this.options.onPosition({ timeSec: clamp(this.currentSecond(), 0, this.options.totalSeconds) });
  }

  private firstSchedulableEvent(startSec: number): number {
    const index = this.options?.events.findIndex((event) => event.timeSec + event.durationSec >= startSec) ?? 0;
    return Math.max(0, index);
  }
}

async function audioContext(): Promise<AudioContext> {
  const existing = getAudioContext();

  if (existing) {
    return existing;
  }

  const AudioContextConstructor =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextConstructor) {
    throw new Error("Web Audio is not supported in this browser.");
  }

  const context = new AudioContextConstructor();
  setAudioContext(context);
  return context;
}

let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  return sharedAudioContext;
}

function setAudioContext(context: AudioContext): void {
  sharedAudioContext = context;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
