import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { noteMidiPitch } from "../../model/derive";
import {
  NOTE_NAMES_SHARP,
  enumerateChordVoicings,
  parseChordSymbol,
  type ChordVoicing
} from "../../model/chords";
import {
  SCALE_DEFINITIONS,
  matchScalesFromPitchClasses,
  scalePitchClasses,
  searchScales,
  type ScaleDefinition
} from "../../model/scales";
import {
  detectPitchFromBuffer,
  midiToFrequency,
  nearestTuningTarget,
  tuningTargets,
  type PitchDetection
} from "../../model/tuner";
import { checkBarDurations } from "../../engine/tools/barReport";
import type { TransposeOptions } from "../../engine/tools/transpose";
import type { CursorPosition } from "../../engine/editing/types";
import type { Beat, Score, Track, Tuning } from "../../model/types";

export type ToolPanelId = "chords" | "scales" | "instrument" | "tuner" | "transpose" | "cleanup";
export type CleanupRequest = "letRing" | "palmMute" | "completeRests" | "fingerPositioning";

export interface ToolPanelsProps {
  activeTool: ToolPanelId | null;
  score: Score;
  cursor: CursorPosition;
  onClose: () => void;
  onInsertChordVoicing: (voicing: ChordVoicing, chordName: string) => void;
  onFretboardNoteToggle: (string: number, fret: number, advance: boolean) => void;
  onTransposeRequest: (options: TransposeOptions) => void;
  onCleanupRequest: (request: CleanupRequest) => void;
}

const DEFAULT_TRANSPOSE: TransposeOptions = {
  range: "selection",
  target: "currentTrack",
  mode: "semitones",
  semitones: 1,
  chromaticInterval: 2,
  chromaticQuality: "major",
  chromaticDirection: "up",
  chromaticOctaves: 0,
  diatonicSteps: 1,
  includeChordNames: true
};

export function ToolPanels(props: ToolPanelsProps) {
  const activeTrack = props.score.tracks.find((track) => track.id === props.cursor.trackId) ?? props.score.tracks[0] ?? null;

  if (!props.activeTool || !activeTrack) {
    return null;
  }

  return (
    <section className="toolPanel" aria-label="Tools">
      <header className="toolPanelHeader">
        <strong>{toolTitle(props.activeTool)}</strong>
        <button type="button" onClick={props.onClose} title="Close tool">
          x
        </button>
      </header>
      {props.activeTool === "chords" ? <ChordTool {...props} track={activeTrack} /> : null}
      {props.activeTool === "scales" ? <ScaleTool {...props} track={activeTrack} /> : null}
      {props.activeTool === "instrument" ? <InstrumentTool {...props} track={activeTrack} /> : null}
      {props.activeTool === "tuner" ? <TunerTool track={activeTrack} /> : null}
      {props.activeTool === "transpose" ? <TransposeTool onApply={props.onTransposeRequest} /> : null}
      {props.activeTool === "cleanup" ? <CleanupTool {...props} /> : null}
    </section>
  );
}

function ChordTool(props: ToolPanelsProps & { track: Track }) {
  const [symbol, setSymbol] = useState("C");
  const chord = useMemo(() => parseChordSymbol(symbol), [symbol]);
  const voicings = useMemo(
    () => (chord ? enumerateChordVoicings(props.track.tuning, chord, { limit: 18, maxFret: 12 }) : []),
    [chord, props.track.tuning]
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = voicings.find((voicing) => voicing.id === selectedId) ?? voicings[0] ?? null;

  useEffect(() => {
    setSelectedId(null);
  }, [symbol]);

  return (
    <div className="toolGrid chordTool">
      <section className="toolColumn">
        <label>
          <span>Chord</span>
          <input value={symbol} onChange={(event) => setSymbol(event.target.value)} />
        </label>
        <div className="toolButtonRow">
          {["C", "Am7", "F#m7b5", "G7", "Dsus4"].map((preset) => (
            <button key={preset} type="button" onClick={() => setSymbol(preset)}>
              {preset}
            </button>
          ))}
        </div>
        {chord ? (
          <>
            <p className="toolMeta">{chord.aliases.join(" / ")}</p>
            <p className="toolMeta">{chord.pitchClasses.map((pc) => NOTE_NAMES_SHARP[pc]).join(" ")}</p>
          </>
        ) : (
          <p className="toolWarning">Unknown chord</p>
        )}
        {selected ? (
          <button type="button" onClick={() => auditionChord(selected, props.track.tuning)}>
            Audition
          </button>
        ) : null}
      </section>
      <section className="toolColumn">
        <ChordDiagram voicing={selected} tuning={props.track.tuning} />
        {selected ? (
          <button type="button" onClick={() => props.onInsertChordVoicing(selected, chord?.symbol ?? symbol)}>
            Insert
          </button>
        ) : null}
      </section>
      <section className="toolColumn voicingList">
        {voicings.map((voicing) => (
          <button
            key={voicing.id}
            type="button"
            className={voicing.id === selected?.id ? "activeToggle" : ""}
            onClick={() => setSelectedId(voicing.id)}
          >
            <span>{voicing.label}</span>
            <em>D{Math.round(voicing.difficulty)}</em>
          </button>
        ))}
      </section>
    </div>
  );
}

function ScaleTool(props: ToolPanelsProps & { track: Track }) {
  const [query, setQuery] = useState("minor");
  const [root, setRoot] = useState(0);
  const [selectedScaleId, setSelectedScaleId] = useState(SCALE_DEFINITIONS[0]?.id ?? "");
  const results = useMemo(() => searchScales({ query, limit: 20 }), [query]);
  const selected = SCALE_DEFINITIONS.find((scale) => scale.id === selectedScaleId) ?? results[0] ?? SCALE_DEFINITIONS[0];
  const pitchClasses = selected ? scalePitchClasses(root, selected) : [];
  const currentClasses = currentBeatPitchClasses(props.score, props.cursor, props.track);
  const matches = matchScalesFromPitchClasses(currentClasses, root, 6);

  useEffect(() => {
    if (results[0] && !results.some((scale) => scale.id === selectedScaleId)) {
      setSelectedScaleId(results[0].id);
    }
  }, [results, selectedScaleId]);

  return (
    <div className="toolGrid scaleTool">
      <section className="toolColumn">
        <label>
          <span>Search</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <label>
          <span>Key</span>
          <select value={root} onChange={(event) => setRoot(Number(event.target.value))}>
            {NOTE_NAMES_SHARP.map((name, index) => (
              <option key={name} value={index}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <p className="toolMeta">{SCALE_DEFINITIONS.length} scales</p>
        <button type="button" onClick={() => selected && auditionScale(root, selected)}>
          Audition
        </button>
      </section>
      <section className="toolColumn scaleList">
        {results.map((scale) => (
          <button
            key={scale.id}
            type="button"
            className={scale.id === selected?.id ? "activeToggle" : ""}
            onClick={() => setSelectedScaleId(scale.id)}
          >
            {scale.name}
          </button>
        ))}
      </section>
      <section className="toolColumn">
        <p className="toolMeta">{pitchClasses.map((pc) => NOTE_NAMES_SHARP[pc]).join(" ")}</p>
        <FretboardGrid
          tuning={props.track.tuning}
          notes={currentBeatNotes(props.score, props.cursor, props.track)}
          scalePitchClasses={pitchClasses}
          rootPitchClass={root}
          onInput={props.onFretboardNoteToggle}
        />
        <div className="matchList">
          {matches.map((match) => (
            <span key={match.scale.id}>
              {match.scale.name} {match.matchPercent}%
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}

function InstrumentTool(props: ToolPanelsProps & { track: Track }) {
  const [scope, setScope] = useState("Beat");
  const [leftHanded, setLeftHanded] = useState(false);
  const selectedScale = SCALE_DEFINITIONS.find((scale) => scale.name === "Minor pentatonic") ?? SCALE_DEFINITIONS[0];
  const scalePcs = selectedScale ? scalePitchClasses(9, selectedScale) : [];

  return (
    <div className="toolGrid instrumentTool">
      <section className="toolColumn">
        <div className="toolButtonRow">
          {["Beat", "Beat+Bar", "Beat+Next"].map((mode) => (
            <button key={mode} type="button" className={scope === mode ? "activeToggle" : ""} onClick={() => setScope(mode)}>
              {mode}
            </button>
          ))}
        </div>
        <button type="button" className={leftHanded ? "activeToggle" : ""} onClick={() => setLeftHanded(!leftHanded)}>
          Left
        </button>
        <p className="toolMeta">{props.track.tuning.label} capo {props.track.tuning.capo}</p>
      </section>
      <section className={leftHanded ? "toolColumn fretboardLefty" : "toolColumn"}>
        <FretboardGrid
          tuning={props.track.tuning}
          notes={currentBeatNotes(props.score, props.cursor, props.track)}
          scalePitchClasses={scalePcs}
          rootPitchClass={9}
          onInput={props.onFretboardNoteToggle}
        />
      </section>
    </div>
  );
}

function TunerTool({ track }: { track: Track }) {
  const [detected, setDetected] = useState<PitchDetection | null>(null);
  const [target, setTarget] = useState<ReturnType<typeof nearestTuningTarget> | null>(null);
  const [running, setRunning] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => () => cleanupRef.current?.(), []);

  async function start(): Promise<void> {
    cleanupRef.current?.();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    const source = context.createMediaStreamSource(stream);
    const buffer = new Float32Array(2048);
    let frame = 0;

    analyser.fftSize = 2048;
    source.connect(analyser);
    setRunning(true);

    const tick = () => {
      analyser.getFloatTimeDomainData(buffer);
      const pitch = detectPitchFromBuffer(buffer, context.sampleRate);

      if (pitch) {
        setDetected(pitch);
        setTarget(nearestTuningTarget(track.tuning, pitch.frequency));
      }

      frame = window.requestAnimationFrame(tick);
    };

    tick();
    cleanupRef.current = () => {
      window.cancelAnimationFrame(frame);
      source.disconnect();
      stream.getTracks().forEach((mediaTrack) => mediaTrack.stop());
      void context.close();
      setRunning(false);
    };
  }

  function testSine(): void {
    const sampleRate = 44100;
    const samples = new Float32Array(2048);

    for (let index = 0; index < samples.length; index += 1) {
      samples[index] = Math.sin((Math.PI * 2 * 110 * index) / sampleRate) * 0.8;
    }

    const pitch = detectPitchFromBuffer(samples, sampleRate);
    setDetected(pitch);
    setTarget(pitch ? nearestTuningTarget(track.tuning, pitch.frequency) : null);
  }

  return (
    <div className="toolGrid tunerTool">
      <section className="toolColumn">
        <div className="toolButtonRow">
          <button type="button" onClick={() => void start()} disabled={running}>
            Start
          </button>
          <button type="button" onClick={() => cleanupRef.current?.()} disabled={!running}>
            Stop
          </button>
          <button type="button" onClick={testSine}>
            Test A2
          </button>
        </div>
        <strong className={target ? centsClass(target.cents) : ""}>
          {detected ? `${detected.noteName} ${detected.frequency.toFixed(1)}Hz` : "--"}
        </strong>
        <p className="toolMeta">{target ? `String ${target.string} ${target.noteName} ${target.cents}c` : track.tuning.label}</p>
      </section>
      <section className="toolColumn tuningBars">
        {tuningTargets(track.tuning).map((item) => (
          <div key={item.string} className={target?.string === item.string ? "tuningTarget activeTarget" : "tuningTarget"}>
            <span>{item.string}</span>
            <span>{item.noteName}</span>
            <meter min={-50} max={50} low={-12} high={12} optimum={0} value={target?.string === item.string ? target.cents : 0} />
          </div>
        ))}
      </section>
    </div>
  );
}

function TransposeTool({ onApply }: { onApply: (options: TransposeOptions) => void }) {
  const [options, setOptions] = useState<TransposeOptions>(DEFAULT_TRANSPOSE);

  return (
    <div className="toolGrid transposeTool">
      <section className="toolColumn">
        <label>
          <span>Range</span>
          <select value={options.range} onChange={(event) => setOptions({ ...options, range: event.target.value as TransposeOptions["range"] })}>
            <option value="selection">Selection</option>
            <option value="allBars">All bars</option>
          </select>
        </label>
        <label>
          <span>Target</span>
          <select value={options.target} onChange={(event) => setOptions({ ...options, target: event.target.value as TransposeOptions["target"] })}>
            <option value="currentTrack">Current track</option>
            <option value="allTracks">All tracks</option>
          </select>
        </label>
        <label className="toolCheck">
          <input
            type="checkbox"
            checked={options.includeChordNames}
            onChange={(event) => setOptions({ ...options, includeChordNames: event.target.checked })}
          />
          <span>Chords</span>
        </label>
      </section>
      <section className="toolColumn">
        <div className="toolButtonRow">
          {(["semitones", "chromatic", "diatonic"] as const).map((mode) => (
            <button key={mode} type="button" className={options.mode === mode ? "activeToggle" : ""} onClick={() => setOptions({ ...options, mode })}>
              {mode}
            </button>
          ))}
        </div>
        {options.mode === "semitones" ? (
          <label>
            <span>Half steps</span>
            <input type="number" value={options.semitones} onChange={(event) => setOptions({ ...options, semitones: Number(event.target.value) })} />
          </label>
        ) : null}
        {options.mode === "chromatic" ? (
          <div className="transposeMatrix">
            <select value={options.chromaticInterval} onChange={(event) => setOptions({ ...options, chromaticInterval: Number(event.target.value) })}>
              {[1, 2, 3, 4, 5, 6, 7].map((interval) => (
                <option key={interval} value={interval}>{interval}</option>
              ))}
            </select>
            <select value={options.chromaticQuality} onChange={(event) => setOptions({ ...options, chromaticQuality: event.target.value as TransposeOptions["chromaticQuality"] })}>
              {["minor", "major", "perfect", "diminished", "augmented"].map((quality) => (
                <option key={quality} value={quality}>{quality}</option>
              ))}
            </select>
            <select value={options.chromaticDirection} onChange={(event) => setOptions({ ...options, chromaticDirection: event.target.value as TransposeOptions["chromaticDirection"] })}>
              <option value="up">up</option>
              <option value="down">down</option>
            </select>
          </div>
        ) : null}
        {options.mode === "diatonic" ? (
          <label>
            <span>Degrees</span>
            <input type="number" value={options.diatonicSteps} onChange={(event) => setOptions({ ...options, diatonicSteps: Number(event.target.value) })} />
          </label>
        ) : null}
        <button type="button" onClick={() => onApply(options)}>
          Apply
        </button>
      </section>
    </div>
  );
}

function CleanupTool(props: ToolPanelsProps) {
  const issues = checkBarDurations(props.score);

  return (
    <div className="toolGrid cleanupTool">
      <section className="toolColumn">
        <div className="toolButtonRow">
          <button type="button" onClick={() => props.onCleanupRequest("letRing")}>Let ring</button>
          <button type="button" onClick={() => props.onCleanupRequest("palmMute")}>Palm mute</button>
          <button type="button" onClick={() => props.onCleanupRequest("completeRests")}>Rests</button>
          <button type="button" onClick={() => props.onCleanupRequest("fingerPositioning")}>Fingers</button>
        </div>
        <strong>{issues.length === 0 ? "Bars ok" : `${issues.length} issues`}</strong>
      </section>
      <section className="toolColumn reportList">
        {issues.slice(0, 10).map((issue) => (
          <span key={`${issue.trackId}-${issue.barIndex}-${issue.voiceIndex}`}>
            {issue.trackName} B{issue.barIndex + 1} V{issue.voiceIndex + 1} {Math.round(issue.actualTicks)}/{Math.round(issue.expectedTicks)}
          </span>
        ))}
      </section>
    </div>
  );
}

function ChordDiagram({ voicing, tuning }: { voicing: ChordVoicing | null; tuning: Tuning }) {
  const strings = stringNumbers(tuning);
  const maxFret = Math.max(4, ...(voicing?.notes.map((note) => note.fret) ?? [4]));

  return (
    <div className="chordDiagram" style={{ gridTemplateColumns: `32px repeat(${strings.length}, 28px)` }}>
      <span />
      {strings.map((string) => (
        <strong key={string}>{string}</strong>
      ))}
      {Array.from({ length: maxFret + 1 }, (_, fret) => (
        <Fragment key={`row-${fret}`}>
          <em key={`fret-${fret}`}>{fret}</em>
          {strings.map((string) => {
            const active = voicing?.notes.some((note) => note.string === string && note.fret === fret);
            return <span key={`${string}-${fret}`} className={active ? "diagramDot" : ""} />;
          })}
        </Fragment>
      ))}
    </div>
  );
}

function FretboardGrid({
  tuning,
  notes,
  scalePitchClasses,
  rootPitchClass,
  onInput
}: {
  tuning: Tuning;
  notes: Array<{ string: number; fret: number }>;
  scalePitchClasses: number[];
  rootPitchClass: number;
  onInput: (string: number, fret: number, advance: boolean) => void;
}) {
  const strings = stringNumbers(tuning);
  const frets = Array.from({ length: 13 }, (_, fret) => fret);
  const active = new Set(notes.map((note) => `${note.string}:${note.fret}`));

  return (
    <div className="fretboardGrid" style={{ gridTemplateColumns: `32px repeat(${frets.length}, minmax(26px, 1fr))` }}>
      <span />
      {frets.map((fret) => (
        <strong key={fret}>{fret}</strong>
      ))}
      {strings.map((string) => (
        <Fragment key={`string-${string}`}>
          <em key={`label-${string}`}>{string}</em>
          {frets.map((fret) => {
            const pitchClass = fretPitchClass(tuning, string, fret);
            const inScale = scalePitchClasses.includes(pitchClass);
            const isRoot = pitchClass === rootPitchClass;
            const isActive = active.has(`${string}:${fret}`);
            return (
              <button
                key={`${string}-${fret}`}
                type="button"
                className={[
                  "fretCell",
                  inScale ? "scaleCell" : "",
                  isRoot ? "rootCell" : "",
                  isActive ? "activeFret" : ""
                ].join(" ")}
                title={`${NOTE_NAMES_SHARP[pitchClass]} string ${string} fret ${fret}`}
                onClick={() => onInput(string, fret, false)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  onInput(string, fret, true);
                }}
              >
                {isRoot ? "R" : inScale ? NOTE_NAMES_SHARP[pitchClass] : ""}
              </button>
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}

function currentBeatNotes(score: Score, cursor: CursorPosition, track: Track): Array<{ string: number; fret: number }> {
  const beat = currentBeat(score, cursor, track);
  return beat?.notes.map((note) => ({ string: note.string, fret: note.fret })) ?? [];
}

function currentBeatPitchClasses(score: Score, cursor: CursorPosition, track: Track): number[] {
  const beat = currentBeat(score, cursor, track);
  return beat?.notes.map((note) => noteMidiPitch(note, track) % 12) ?? [];
}

function currentBeat(score: Score, cursor: CursorPosition, track: Track): Beat | null {
  void score;
  return track.bars[cursor.barIndex]?.voices[cursor.voiceIndex]?.beats[cursor.beatIndex] ?? null;
}

function fretPitchClass(tuning: Tuning, string: number, fret: number): number {
  const index = tuning.strings.length - string;
  return ((tuning.strings[index] ?? 0) + tuning.capo + fret) % 12;
}

function stringNumbers(tuning: Tuning): number[] {
  return Array.from({ length: tuning.strings.length }, (_, index) => tuning.strings.length - index);
}

function auditionChord(voicing: ChordVoicing, tuning: Tuning): void {
  const context = new AudioContext();
  voicing.notes
    .sort((left, right) => right.string - left.string)
    .forEach((note, index) => {
      const midi = (tuning.strings[tuning.strings.length - note.string] ?? 40) + tuning.capo + note.fret;
      scheduleTone(context, midiToFrequency(midi), context.currentTime + index * 0.035, 0.55);
    });
  window.setTimeout(() => void context.close(), 900);
}

function auditionScale(root: number, scale: ScaleDefinition): void {
  const context = new AudioContext();
  scalePitchClasses(root, scale).forEach((pitchClass, index) => {
    scheduleTone(context, midiToFrequency(60 + pitchClass), context.currentTime + index * 0.11, 0.1);
  });
  window.setTimeout(() => void context.close(), 1800);
}

function scheduleTone(context: AudioContext, frequency: number, start: number, duration: number): void {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "triangle";
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.08, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function centsClass(cents: number): string {
  return Math.abs(cents) < 7 ? "tunerGood" : Math.abs(cents) < 18 ? "tunerNear" : "toolWarning";
}

function toolTitle(tool: ToolPanelId): string {
  const titles: Record<ToolPanelId, string> = {
    chords: "Chords",
    scales: "Scales",
    instrument: "Instrument",
    tuner: "Tuner",
    transpose: "Transpose",
    cleanup: "Tools"
  };
  return titles[tool];
}
