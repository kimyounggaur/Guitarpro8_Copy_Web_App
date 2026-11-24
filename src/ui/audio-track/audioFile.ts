import { measurePeaks, type WaveformPeaks } from "./waveform";

export class DecodedAudioFile {
  private source: AudioBufferSourceNode | null = null;
  private sourceStart = 0;
  private fileStart = 0;
  readonly duration: number;
  private buffer: AudioBuffer | null;

  private constructor(
    private context: AudioContext,
    private output: GainNode,
    buffer: AudioBuffer,
    readonly peaks: WaveformPeaks,
    readonly name: string
  ) {
    this.buffer = buffer;
    this.duration = buffer.duration;
  }

  static async open(file: File, signal: AbortSignal): Promise<DecodedAudioFile> {
    if (!window.AudioContext) throw new Error("Audio decoding is unavailable in this browser.");
    const context = new AudioContext();
    const close = () => { if (context.state !== "closed") void context.close().catch(() => {}); };
    signal.addEventListener("abort", close, { once: true });
    try {
      signal.throwIfAborted();
      void context.resume().catch(() => {});
      const buffer = await context.decodeAudioData(await file.arrayBuffer());
      const peaks = await measurePeaks(buffer, signal);
      const output = context.createGain();
      output.connect(context.destination);
      return new DecodedAudioFile(context, output, buffer, peaks, file.name);
    } catch (error) {
      close();
      throw error;
    } finally {
      signal.removeEventListener("abort", close);
    }
  }

  get closed(): boolean { return this.buffer === null; }
  get position(): number | null {
    return this.source ? this.fileStart + this.context.currentTime - this.sourceStart : null;
  }
  setLevel(gain: number, mute: boolean): void {
    if (!this.closed) this.output.gain.setTargetAtTime(mute ? 0 : gain, this.context.currentTime, 0.008);
  }

  /** A negative file time represents silence before a positively offset clip. */
  follow(fileTime: number): void {
    if (!this.buffer || !Number.isFinite(fileTime)) return;
    if (fileTime >= this.duration) { this.stop(); return; }
    const position = this.position;
    if (position !== null && Math.abs(position - fileTime) < 0.12) return;
    this.stop();
    const node = this.context.createBufferSource();
    node.buffer = this.buffer;
    node.connect(this.output);
    this.source = node;
    this.sourceStart = this.context.currentTime + Math.max(0, -fileTime);
    this.fileStart = Math.max(0, fileTime);
    node.onended = () => {
      if (this.source === node) this.source = null;
      node.disconnect();
      node.buffer = null;
    };
    node.start(this.sourceStart, this.fileStart);
  }

  async resume(): Promise<void> { if (!this.closed) await this.context.resume(); }
  stop(): void {
    const source = this.source;
    this.source = null;
    if (!source) return;
    source.onended = null;
    source.stop();
    source.disconnect();
    source.buffer = null;
  }
  dispose(): void {
    if (this.closed) return;
    this.stop();
    this.buffer = null;
    this.output.disconnect();
    if (this.context.state !== "closed") void this.context.close().catch(() => {});
  }
}
