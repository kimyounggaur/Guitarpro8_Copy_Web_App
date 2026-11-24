import type { NoteEvent } from "./compile";
import { PlaybackEventQueue, wrappedPlaybackSecond, type PlaybackLoopRange } from "./playbackLoop";
import type { MixerState } from "./mixer";
import type { MixerAutomation } from "./mixerAutomation";
import { PlaybackClock } from "./playbackClock";
import { SimpleSynth, type ScheduledVoice } from "./sampler";

export interface SchedulerPosition {
  timeSec: number;
  sessionId: number;
}

export interface SchedulerPlayOptions {
  sessionId: number;
  startSec: number;
  scoreStartSec?: number;
  countInEvents?: NoteEvent[];
  totalSeconds: number;
  events: NoteEvent[];
  loop?: PlaybackLoopRange | null;
  mixer?: MixerState;
  focusedTrackId?: string | null;
  mixerAutomation?: MixerAutomation;
  onPosition: (position: SchedulerPosition) => void;
  onEnded: (sessionId: number) => void;
}

const LOOKAHEAD_SEC = 0.5;
const SEEK_FADE_SEC = 0.01;

export class PlaybackScheduler {
  private context: AudioContext | null = null;
  private synth: SimpleSynth | null = null;
  private readonly clock = new PlaybackClock();
  private scheduled = new Set<ScheduledVoice>();
  private eventQueue: PlaybackEventQueue | null = null;
  private nextLoopBoundary = Infinity;
  private startAudioTime = 0;
  private startSec = 0;
  private sessionId: number | null = null;
  private options: SchedulerPlayOptions | null = null;

  async play(options: SchedulerPlayOptions): Promise<void> {
    this.stop();
    this.sessionId = options.sessionId;
    this.startSec = Math.min(options.totalSeconds, options.startSec);
    this.options = {
      ...options,
      events: [...options.events].sort((left, right) => left.timeSec - right.timeSec)
    };
    const context = audioContext();
    await context.resume();
    if (this.sessionId !== options.sessionId) return;

    this.context = context;
    this.synth = new SimpleSynth(context);
    this.scheduleFrom(this.startSec, this.startSec < (options.scoreStartSec ?? this.startSec));
  }

  stop(): void {
    this.clock.stop();
    this.sessionId = null;
    this.options = null;
    this.eventQueue = null;
    this.nextLoopBoundary = Infinity;
    this.clearVoices();
    this.synth?.dispose();
    this.synth = null;
  }

  seek(seconds: number, sessionId: number): void {
    if (this.sessionId !== sessionId) return;
    const options = this.options;
    if (!options) return;
    const target = options.loop && (seconds < options.loop.startSec || seconds >= options.loop.endSec)
      ? options.loop.startSec
      : clamp(seconds, 0, options.totalSeconds);

    if (!this.context || !this.synth) {
      this.startSec = target;
      return;
    }
    this.clock.stop();
    this.clearVoices(this.context.currentTime + SEEK_FADE_SEC);
    this.scheduleFrom(target);
  }

  currentSecond(): number {
    return wrappedPlaybackSecond(this.elapsedSecond(), this.options?.loop ?? null);
  }

  private elapsedSecond(): number {
    if (!this.context || !this.options) return this.startSec;
    return this.startSec + (this.context.currentTime - this.startAudioTime);
  }

  setMixer(mixer: MixerState, focusedTrackId: string | null): void {
    if (!this.options) return;
    this.options = { ...this.options, mixer, focusedTrackId };
    this.synth?.graph.applyMixer(mixer, focusedTrackId, this.options.mixerAutomation,
      this.currentSecond(), false, this.context?.currentTime, this.options.loop?.endSec);
    const loop = this.options.loop;
    if (loop) {
      const cycles = Math.max(0, Math.floor((this.elapsedSecond() - loop.startSec) / (loop.endSec - loop.startSec)));
      this.nextLoopBoundary = loop.endSec + cycles * (loop.endSec - loop.startSec);
    }
  }

  setLoop(loop: PlaybackLoopRange | null): void {
    const options = this.options;
    if (!options || (options.loop?.startSec === loop?.startSec && options.loop?.endSec === loop?.endSec)) return;
    const position = this.currentSecond();
    this.options = { ...options, loop };
    this.seek(position, options.sessionId);
  }

  private scheduleFrom(seconds: number, intro = false): void {
    if (!this.context || !this.options) return;
    this.startSec = Math.min(seconds, this.options.totalSeconds);
    this.startAudioTime = this.context.currentTime;
    if (this.options.mixer) {
      this.synth?.graph.applyMixer(this.options.mixer, this.options.focusedTrackId ?? null,
        this.options.mixerAutomation, this.startSec, true, this.startAudioTime, this.options.loop?.endSec);
    }
    const musicalEvents = this.options.events;
    const opening = intro ? withCountIn(musicalEvents, this.options.countInEvents ?? [], this.options.scoreStartSec ?? this.startSec) : musicalEvents;
    this.eventQueue = new PlaybackEventQueue(opening, this.startSec, this.options.totalSeconds, this.options.loop ?? null, musicalEvents);
    this.nextLoopBoundary = this.options.loop?.endSec ?? Infinity;

    this.clock.start(() => this.scheduleDueEvents(), () => this.emitPosition());
    this.scheduleDueEvents();
    this.emitPosition();
  }

  private clearVoices(fadeEnd?: number): void {
    for (const voice of this.scheduled) {
      try {
        if (fadeEnd !== undefined && this.context) {
          const now = this.context.currentTime;
          const gain = voice.gain.gain;
          if (typeof gain.cancelAndHoldAtTime === "function") {
            gain.cancelAndHoldAtTime(now);
          } else {
            gain.cancelScheduledValues(now);
            gain.setValueAtTime(gain.value, now);
          }
          gain.linearRampToValueAtTime(0, fadeEnd);
        }
        voice.oscillator.stop(fadeEnd);
      } catch {
        // Voices that have ended will already be disconnected.
      }
      for (const modulator of voice.modulators) {
        try { modulator.stop(fadeEnd); } catch { /* Already ended. */ }
      }
      if (fadeEnd === undefined) this.disposeVoice(voice);
    }
    this.scheduled.clear();
  }

  private disposeVoice(voice: ScheduledVoice): void {
    this.scheduled.delete(voice);
    for (const node of [...voice.modulators, ...voice.nodes]) node.disconnect();
  }

  private scheduleDueEvents(): void {
    const { context, synth, options } = this;
    if (!context || !synth || !options) return;

    const playbackSec = this.elapsedSecond();
    if (!options.loop && playbackSec >= options.totalSeconds) {
      this.emitPosition();
      this.stop();
      options.onEnded(options.sessionId);
      return;
    }
    const horizon = playbackSec + LOOKAHEAD_SEC;

    const loop = options.loop;
    if (loop) {
      if (this.nextLoopBoundary < playbackSec - LOOKAHEAD_SEC) {
        const duration = loop.endSec - loop.startSec;
        this.nextLoopBoundary += Math.floor((playbackSec - this.nextLoopBoundary) / duration) * duration;
      }
      while (this.nextLoopBoundary <= horizon) {
        const when = Math.max(context.currentTime, this.startAudioTime + this.nextLoopBoundary - this.startSec);
        if (options.mixer) {
          synth.graph.applyMixer(options.mixer, options.focusedTrackId ?? null, options.mixerAutomation,
            loop.startSec, true, when, loop.endSec);
        }
        this.nextLoopBoundary += loop.endSec - loop.startSec;
      }
    }
    for (const { event, startSec, durationSec } of this.eventQueue?.takeThrough(horizon, playbackSec) ?? []) {
      const when = Math.max(context.currentTime, this.startAudioTime + startSec - this.startSec);
      const voice = synth.trigger({ ...event, durationSec }, when);
      if (voice) {
        voice.oscillator.addEventListener("ended", () => this.disposeVoice(voice), { once: true });
        this.scheduled.add(voice);
      }
    }
  }

  private emitPosition(): void {
    const options = this.options;
    if (options) {
      options.onPosition({ timeSec: clamp(this.currentSecond(), 0, options.totalSeconds), sessionId: options.sessionId });
    }
  }
}

function withCountIn(events: NoteEvent[], clicks: NoteEvent[], start: number): NoteEvent[] {
  const result = [...clicks];
  for (const event of events) {
    if (event.timeSec >= start) {
      result.push(event);
    } else {
      const durationSec = event.timeSec + event.durationSec - start;
      if (durationSec > 0 && event.trackId !== "__metronome__") result.push({ ...event, timeSec: start, durationSec });
    }
  }
  return result;
}

let sharedAudioContext: AudioContext | null = null;

export async function unlockPlaybackAudio(): Promise<void> {
  await audioContext().resume();
}

function audioContext(): AudioContext {
  if (sharedAudioContext) return sharedAudioContext;
  const AudioContextConstructor =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) {
    throw new Error("Web Audio is not supported in this browser.");
  }
  sharedAudioContext = new AudioContextConstructor();
  return sharedAudioContext;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
