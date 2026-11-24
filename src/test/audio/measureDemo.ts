import { compilePlayback } from "../../engine/audio/compile";
import { createMixerState } from "../../engine/audio/mixer";
import { compileMixerAutomation } from "../../engine/audio/mixerAutomation";
import { SimpleSynth } from "../../engine/audio/sampler";
import { unrollScore } from "../../engine/unroll/unrollScore";
import { createDemoScore } from "../../model/demoScore";
import { AudioGraph } from "../../engine/audio/audioGraph";
import { createEmptyScore, createTrack } from "../../model/factory";

export async function measureDemo() {
  const score = createDemoScore();
  const playback = compilePlayback(score, unrollScore(score));
  const sampleRate = 44_100;
  const context = new OfflineAudioContext(2, Math.ceil((playback.totalSeconds + 0.1) * sampleRate), sampleRate);
  const synth = new SimpleSynth(context);
  synth.graph.applyMixer(createMixerState(score), null, compileMixerAutomation(score, playback), 0, true);
  for (const event of playback.events) synth.trigger(event, event.timeSec);
  const audio = await context.startRendering();
  synth.dispose();

  const channels = Array.from({ length: audio.numberOfChannels }, (_, index) => audio.getChannelData(index));
  let peak = 0;
  let squared = 0;
  let clippedFrames = 0;
  for (let index = 0; index < audio.length; index++) {
    let framePeak = 0;
    for (const channel of channels) {
      const value = channel[index];
      framePeak = Math.max(framePeak, Math.abs(value));
      squared += value * value;
    }
    peak = Math.max(peak, framePeak);
    if (framePeak >= 1) clippedFrames++;
  }
  return {
    peakDb: 20 * Math.log10(peak),
    rmsDb: 10 * Math.log10(squared / (audio.length * audio.numberOfChannels)),
    clippedSeconds: clippedFrames / sampleRate,
    durationSeconds: audio.duration
  };
}

export async function measureTrackMute() {
  const sampleRate = 44_100;
  const context = new OfflineAudioContext(2, sampleRate / 2, sampleRate);
  const score = createEmptyScore();
  const track = createTrack();
  score.tracks.push(track);
  const mixer = createMixerState(score);
  const graph = new AudioGraph(context);
  graph.applyMixer(mixer, null, undefined, 0, true);
  const oscillator = context.createOscillator();
  oscillator.connect(graph.trackInput(track.id));
  oscillator.start(0);
  oscillator.stop(0.4);

  let mutedAt = 0;
  const muted = context.suspend(0.12).then(async () => {
    mutedAt = context.currentTime;
    mixer.tracks[track.id].mute = true;
    graph.applyMixer(mixer, null, undefined, mutedAt);
    await context.resume();
  });
  const audio = await context.startRendering();
  await muted;
  const channel = audio.getChannelData(0);
  const maxFrom = (from: number, to: number) => channel.slice(Math.ceil(from * sampleRate), Math.floor(to * sampleRate))
    .reduce((max, value) => Math.max(max, Math.abs(value)), 0);
  graph.dispose();
  return { before: maxFrom(0.03, mutedAt), after50ms: maxFrom(mutedAt + 0.05, 0.3) };
}
