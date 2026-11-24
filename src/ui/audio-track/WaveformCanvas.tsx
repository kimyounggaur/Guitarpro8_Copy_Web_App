import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { PlaybackCompilation } from "../../engine/audio/compile";
import type { PlaybackLoopRange } from "../../engine/audio/playbackLoop";
import { secondsToX, xToSeconds, type WaveformPeaks } from "./waveform";

interface Props {
  peaks: WaveformPeaks;
  duration: number;
  offset: number;
  zoom: number;
  compilation: PlaybackCompilation;
  playhead: number;
  cursor: number;
  loop: PlaybackLoopRange | null;
  onSeek: (seconds: number) => void;
}

export function WaveformCanvas({ peaks, duration, offset, zoom, compilation, playhead, cursor, loop, onSeek }: Props) {
  const total = Math.max(0.001, duration + offset, compilation.totalSeconds);
  const span = total / zoom;
  const start = Math.max(0, Math.min(total - span, Math.floor(playhead / span) * span));
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 1, height: 80 });
  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: Math.max(1, Math.round(entry.contentRect.width)), height: Math.max(1, Math.round(entry.contentRect.height)) });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    const { width, height } = size;
    const ratio = window.devicePixelRatio || 1;
    node.width = Math.ceil(width * ratio);
    node.height = Math.ceil(height * ratio);
    const ctx = node.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.fillStyle = "#101e30";
    ctx.fillRect(0, 0, width, height);
    const at = (sec: number) => secondsToX(sec, start, span, width);
    if (loop) {
      ctx.fillStyle = "rgba(65,145,235,.23)";
      ctx.fillRect(at(loop.startSec), 0, at(loop.endSec) - at(loop.startSec), height);
    }
    const lanes = peaks.channels.length;
    const laneHeight = Math.max(1, height - 15) / lanes;
    ctx.strokeStyle = "#94aec4";
    ctx.beginPath();
    for (let c = 0; c < lanes; c++) {
      const mid = 15 + laneHeight * (c + 0.5);
      const channel = peaks.channels[c];
      for (let x = 0; x < width; x++) {
        const sample = ((start + x * span / width - offset) / duration) * peaks.bins;
        const next = ((start + (x + 1) * span / width - offset) / duration) * peaks.bins;
        if (next <= 0 || sample >= peaks.bins) continue;
        let lo = 1, hi = -1;
        for (let i = Math.max(0, Math.floor(sample)); i < Math.min(peaks.bins, Math.ceil(next)); i++) {
          lo = Math.min(lo, channel[i * 2]);
          hi = Math.max(hi, channel[i * 2 + 1]);
        }
        ctx.moveTo(x + .5, mid - hi * laneHeight * .4);
        ctx.lineTo(x + .5, mid - lo * laneHeight * .4 + .5);
      }
    }
    ctx.stroke();
    ctx.font = "10px sans-serif";
    ctx.fillStyle = "#cfdae5";
    ctx.strokeStyle = "rgba(185,205,221,.35)";
    const first = compilation.positionAtSecond(start).segmentIndex;
    let previousLabel = -60;
    for (let i = Math.max(0, first); i < compilation.segments.length; i++) {
      const segment = compilation.segments[i];
      const x = at(compilation.tempoMap.ticksToSeconds(segment.startTick));
      if (x > width) break;
      if (x < 0 || x - previousLabel < 28) continue;
      previousLabel = x;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
      ctx.fillText(String(segment.barIndex + 1), x + 3, 11);
    }
  }, [peaks, duration, offset, compilation, span, start, size, loop?.startSec, loop?.endSec]);

  function seekAt(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    onSeek(xToSeconds(event.clientX - rect.left, start, span, Math.max(1, rect.width)));
  }
  const marker = (sec: number, kind: string) => sec >= start && sec <= start + span
    ? <i className={kind} aria-hidden="true" style={{ left: `${secondsToX(sec, start, span, 100)}%` }} /> : null;
  return <div className="audioWaveform" role="slider" tabIndex={0} aria-label="Audio timeline"
    aria-valuemin={0} aria-valuemax={total} aria-valuenow={Math.min(total, Math.max(0, playhead))}
    aria-valuetext={`${playhead.toFixed(2)} seconds`}
    onPointerDown={event => { if (event.button === 0) { event.currentTarget.setPointerCapture(event.pointerId); seekAt(event); } }}
    onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) seekAt(event); }}
    onKeyDown={event => {
      let next: number;
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") next = playhead + (event.key === "ArrowRight" ? 1 : -1) * (event.shiftKey ? 5 : .25);
      else if (event.key === "Home" || event.key === "End") next = event.key === "Home" ? 0 : total;
      else return;
      event.preventDefault(); event.stopPropagation();
      onSeek(Math.max(0, Math.min(total, next)));
    }}>
    <canvas ref={canvas} aria-hidden="true" />
    {marker(cursor, "waveCursor")}{marker(playhead, "wavePlayhead")}
  </div>;
}
