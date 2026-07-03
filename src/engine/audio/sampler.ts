import type { NoteEvent } from "./compile";

export interface ScheduledVoice {
  oscillator: OscillatorNode;
  gain: GainNode;
}

export class SimpleSynth {
  private readonly masterGain: GainNode;

  constructor(private readonly context: AudioContext) {
    this.masterGain = context.createGain();
    this.masterGain.gain.value = 0.18;
    this.masterGain.connect(context.destination);
  }

  trigger(event: NoteEvent, when: number): ScheduledVoice {
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const duration = Math.max(0.03, event.durationSec);
    const peak = (event.velocity / 127) * (event.effects.dead ? 0.22 : event.effects.ghost ? 0.32 : 0.7);

    oscillator.type = event.effects.dead ? "square" : event.effects.palmMute ? "triangle" : "sawtooth";
    oscillator.frequency.setValueAtTime(midiToFrequency(event.midiPitch), when);

    if (event.effects.bend) {
      oscillator.frequency.linearRampToValueAtTime(midiToFrequency(event.midiPitch + 2), when + duration * 0.55);
    }

    if (event.effects.vibrato !== "none") {
      const amount = event.effects.vibrato === "wide" ? 1.008 : 1.004;
      oscillator.frequency.setValueAtTime(midiToFrequency(event.midiPitch) * amount, when + duration * 0.35);
      oscillator.frequency.linearRampToValueAtTime(midiToFrequency(event.midiPitch), when + duration * 0.85);
    }

    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), when + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);

    oscillator.connect(gain);
    gain.connect(this.masterGain);
    oscillator.start(when);
    oscillator.stop(when + duration + 0.02);

    return { oscillator, gain };
  }

  dispose(): void {
    this.masterGain.disconnect();
  }
}

function midiToFrequency(midiPitch: number): number {
  return 440 * 2 ** ((midiPitch - 69) / 12);
}
