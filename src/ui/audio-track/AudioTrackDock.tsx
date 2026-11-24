import { useEffect, useMemo, useRef, useState } from "react";
import type { PlaybackCompilation } from "../../engine/audio/compile";
import { getPlaybackLoop } from "../../engine/audio/playbackLoop";
import { beatTickForCursor } from "../../engine/editing/operations";
import { useDocumentStore } from "../../store/documentStore";
import { usePlaybackStore } from "../../store/playbackStore";
import { useViewStore } from "../../store/viewStore";
import { DecodedAudioFile } from "./audioFile";
import { WaveformCanvas } from "./WaveformCanvas";
import "./audio-track.css";

interface AudioTrackDockProps {
  compilation: PlaybackCompilation;
  onSeek: (scoreSeconds: number) => void;
  visible?: boolean;
}

export function AudioTrackDock(props: AudioTrackDockProps) {
  const documentId = useDocumentStore(state => state.activeId);
  return <DocumentAudioDock key={documentId} documentId={documentId} {...props} />;
}

function DocumentAudioDock({ compilation, onSeek, visible = true, documentId }: AudioTrackDockProps & { documentId: string }) {
  const score = useDocumentStore(state => state.score);
  const reference = score.audioTrack;
  const cursor = useViewStore(state => state.cursor);
  const selection = useViewStore(state => state.selection);
  const countIn = usePlaybackStore(state => state.countInEnabled);
  const loopEnabled = usePlaybackStore(state => state.loopEnabled);
  const [asset, setAsset] = useState<{ id: string; file: DecodedAudioFile } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [gain, setGain] = useState(1);
  const [mute, setMute] = useState(false);
  const [offset, setOffset] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [follow, setFollow] = useState(true);
  const [head, setHead] = useState(0);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const [preview, setPreview] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const clip = asset?.id === reference?.id ? asset?.file : undefined;
  const loop = useMemo(() => loopEnabled ? getPlaybackLoop(compilation, selection, cursor.barIndex) : null,
    [loopEnabled, compilation, selection, cursor.barIndex]);
  const cursorTime = useMemo(() => {
    const segment = compilation.segments.find(item => item.barIndex === cursor.barIndex);
    return segment ? compilation.tempoMap.ticksToSeconds(segment.startTick + beatTickForCursor(score, cursor)) : 0;
  }, [compilation, score, cursor]);

  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => () => asset?.file.dispose(), [asset]);
  useEffect(() => {
    if (asset && asset.id !== reference?.id) {
      setPreview(false);
      setAsset(null);
    }
  }, [asset, reference?.id]);
  useEffect(() => { clip?.setLevel(gain, mute); }, [clip, gain, mute]);
  useEffect(() => {
    if (!clip) return;
    const sync: Parameters<typeof usePlaybackStore.subscribe>[0] = (state, previous) => {
      if (state.status === "playing") {
        setPreview(false);
        if (follow && !state.countInEnabled) {
          if (previous.status !== "playing") {
            void clip.resume().catch(() => setError("Audio output could not start. Try Preview audio to enable sound."));
          }
          clip.follow(state.currentTimeSec - offset);
        }
        else clip.stop();
        if (visible) setHead(state.currentTimeSec);
      } else if (previous.status === "playing" || previous.status === "starting") {
        clip.stop();
        if (visible) setHead(state.currentTimeSec);
      } else if (visible && state.currentTimeSec !== previous.currentTimeSec) {
        setHead(state.currentTimeSec);
      }
    };
    const state = usePlaybackStore.getState();
    sync(state, state);
    return usePlaybackStore.subscribe(sync);
  }, [clip, offset, follow, visible]);

  useEffect(() => {
    if (!preview || !clip) return;
    const timer = window.setInterval(() => {
      const position = clip.position;
      if (position === null) { setPreview(false); setHead(Math.max(0, clip.duration + offset)); }
      else if (visibleRef.current) setHead(Math.max(0, position + offset));
    }, 50);
    return () => { clearInterval(timer); };
  }, [preview, clip, offset]);

  async function attach(file: File) {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true); setError("");
    const oldReference = useDocumentStore.getState().score.audioTrack?.id;
    try {
      const decoded = await DecodedAudioFile.open(file, controller.signal);
      const state = useDocumentStore.getState();
      if (controller.signal.aborted || state.activeId !== documentId || oldReference !== state.score.audioTrack?.id) {
        decoded.dispose(); return;
      }
      const id = reference?.name === file.name && !asset ? reference.id : crypto.randomUUID();
      if (reference?.id !== id || reference.embedded) {
        state.transact("Attach audio file", draft => { draft.audioTrack = { id, name: file.name, embedded: false }; });
      }
      if (useDocumentStore.getState().score.audioTrack?.id !== id) { decoded.dispose(); return; }
      setPreview(false); setHead(0); setOffset(0); setGain(1); setMute(false); setZoom(1);
      setAsset({ id, file: decoded });
    } catch {
      if (!controller.signal.aborted) setError("Could not decode this audio file. Choose a supported WAV, MP3, M4A, FLAC or Ogg file.");
    } finally {
      if (pending.current === controller) { pending.current = null; setLoading(false); }
    }
  }

  function remove() {
    pending.current?.abort(); pending.current = null;
    setLoading(false); setPreview(false); setError(""); setHead(0);
    useDocumentStore.getState().transact("Remove audio file", draft => { delete draft.audioTrack; });
    setAsset(null);
  }
  function seek(seconds: number) {
    setHead(seconds);
    onSeek(Math.min(compilation.totalSeconds, seconds));
    if (preview && clip) {
      clip.follow(seconds - offset);
    }
  }
  async function audition() {
    if (!clip) return;
    if (preview) { clip.stop(); setPreview(false); return; }
    if (usePlaybackStore.getState().status === "playing") {
      setError("Stop score playback before previewing audio on its own."); return;
    }
    try {
      await clip.resume();
      if (clip.closed) return;
      clip.follow(head - offset >= clip.duration ? 0 : Math.max(0, head - offset));
      setPreview(true); setError("");
    } catch { setError("Audio playback could not start. Try preview again."); }
  }

  if (!visible) return null;
  const supported = typeof window.AudioContext === "function";
  return <section className="audioTrackDock" aria-label="Audio track" data-testid="audio-track-dock"
    onDragOver={e => { if (e.dataTransfer.types.includes("Files")) e.preventDefault(); }}
    onDrop={e => { const file = e.dataTransfer.files[0]; if (file && supported) { e.preventDefault(); e.stopPropagation(); void attach(file); } }}>
    <header>
      <strong>Audio track</strong>
      {reference && <span className="audioTrackName">{reference.name}</span>}
      {clip && <span>{clip.duration.toFixed(2)} s</span>}
      <button type="button" disabled={!supported} onClick={() => input.current?.click()}>{!reference ? "Add audio" : clip ? "Replace audio" : "Relink audio"}</button>
      {reference && <button type="button" onClick={remove}>Remove audio</button>}
      <input type="file" accept="audio/*,.wav,.mp3,.m4a,.flac,.aiff,.ogg" ref={input} hidden
        onChange={e => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ""; if (file) void attach(file); }} />
    </header>
    {!supported && <p role="status">This browser does not support audio file decoding.</p>}
    {loading && <p role="status">Reading audio…</p>}
    {error && <p role="alert">{error}</p>}
    {!clip && supported && !loading && <p>{reference ? "The score stores the file name. Select the recording again to hear it." : "Choose or drop a local recording."}</p>}
    {clip && <>
      <div className="audioTrackTools">
        <button type="button" aria-pressed={preview} onClick={() => void audition()}>{preview ? "Stop preview" : "Preview audio"}</button>
        <button type="button" aria-pressed={mute} onClick={() => setMute(!mute)}>Mute</button>
        <label>Gain <input type="range" min="0" max="1" step=".01" value={gain} onChange={e => setGain(Number(e.target.value))} /></label>
        <label>Offset (s) <input type="number" step=".1" value={offset} onChange={e => { const n = e.target.valueAsNumber; if (Number.isFinite(n)) setOffset(n); }} /></label>
        <label>Zoom <select value={zoom} onChange={e => setZoom(Number(e.target.value))}>{[1,2,4,8,16].map(n => <option key={n} value={n}>{n}×</option>)}</select></label>
        <label><input type="checkbox" disabled={countIn} checked={follow && !countIn} onChange={e => setFollow(e.target.checked)} /> Follow score playback</label>
      </div>
      <WaveformCanvas peaks={clip.peaks} duration={clip.duration} offset={offset} zoom={zoom} compilation={compilation}
        playhead={head} cursor={cursorTime} loop={loop} onSeek={seek} />
      {countIn && <p>Turn off count-in to play the recording with the score.</p>}
      <p className="audioTrackPolicy">Audio plays at its original speed. Tempo warping is unavailable. Reopen the local file after loading a saved score.</p>
    </>}
  </section>;
}
