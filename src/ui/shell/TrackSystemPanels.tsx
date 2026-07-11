import { useEffect, useState } from "react";
import {
  DRUM_MAPPINGS,
  INSTRUMENT_DEFINITIONS,
  TUNING_PRESETS,
  instrumentById,
  midiName,
  presetsByCategory,
  tuningLabel,
  tuningMatchesPreset,
  type InstrumentCategory,
  type InstrumentDefinition,
  type RetuneMode
} from "../../model/instruments";
import type { AccidentalPreference, NotationType, StaffConfig, Track, Tuning } from "../../model/types";
import type { CursorPosition } from "../../engine/editing/types";

export type TrackPanelId = "wizard" | "tuning" | "voices" | "drums";

export interface TrackCreateOptions {
  presetId: string;
  name: string;
  shortName: string;
  color: string;
  icon: string;
  notationTypes: NotationType[];
  staffConfig: StaffConfig;
  tuning: Tuning;
}

export interface TrackSystemPanelsProps {
  activePanel: TrackPanelId | null;
  activeTrack: Track | null;
  cursor: CursorPosition;
  multiVoiceEdit: boolean;
  onClose: () => void;
  onCreateTrack: (options: TrackCreateOptions) => void;
  onApplyTuning: (trackId: string, tuning: Tuning, mode: RetuneMode) => void;
  onTrackPatch: (trackId: string, patch: Partial<Pick<Track, "notationTypes" | "staffConfig">>) => void;
  onVoiceSelect: (voiceIndex: number) => void;
  onMoveNoteToVoice: (voiceIndex: number) => void;
  onToggleMultiVoice: () => void;
  onDrumToggle: (mappingId: string, articulation: string) => void;
}

const categories: InstrumentCategory[] = ["Stringed", "Orchestra", "Drums", "MIDI"];
const notationTypes: NotationType[] = ["standard", "tab", "slash", "numbered"];

export function TrackSystemPanels(props: TrackSystemPanelsProps) {
  if (!props.activePanel) {
    return null;
  }

  return (
    <section className="trackSystemPanel" aria-label="Track system">
      <header className="toolPanelHeader">
        <strong>{trackPanelTitle(props.activePanel)}</strong>
        <button type="button" onClick={props.onClose} title="Close track panel">
          x
        </button>
      </header>
      {props.activePanel === "wizard" ? <TrackWizard {...props} /> : null}
      {props.activePanel === "tuning" && props.activeTrack ? <TuningPanel {...props} track={props.activeTrack} /> : null}
      {props.activePanel === "voices" ? <VoicePanel {...props} /> : null}
      {props.activePanel === "drums" && props.activeTrack ? <DrumKitPanel {...props} track={props.activeTrack} /> : null}
    </section>
  );
}

function TrackWizard({ onCreateTrack }: TrackSystemPanelsProps) {
  const [category, setCategory] = useState<InstrumentCategory>("Stringed");
  const [presetId, setPresetId] = useState(presetsByCategory("Stringed")[0].id);
  const preset = instrumentById(presetId);
  const [draft, setDraft] = useState(() => draftFromPreset(preset));

  useEffect(() => {
    const first = presetsByCategory(category)[0];
    setPresetId(first.id);
    setDraft(draftFromPreset(first));
  }, [category]);

  useEffect(() => {
    setDraft(draftFromPreset(preset));
  }, [preset]);

  function create(): void {
    onCreateTrack(draft);
  }

  return (
    <div className="trackWizardGrid">
      <section className="toolColumn">
        <div className="toolButtonRow">
          {categories.map((item) => (
            <button key={item} type="button" className={category === item ? "activeToggle" : ""} onClick={() => setCategory(item)}>
              {item}
            </button>
          ))}
        </div>
        <div className="instrumentList">
          {presetsByCategory(category).map((instrument) => (
            <button
              key={instrument.id}
              type="button"
              className={instrument.id === presetId ? "activeToggle" : ""}
              onClick={() => setPresetId(instrument.id)}
              onDoubleClick={() => onCreateTrack(draftFromPreset(instrument))}
            >
              <span>{instrument.name}</span>
              <em>GM {instrument.gmProgram}</em>
            </button>
          ))}
        </div>
      </section>
      <section className="toolColumn">
        <label>
          <span>Name</span>
          <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
        </label>
        <label>
          <span>Short</span>
          <input value={draft.shortName} onChange={(event) => setDraft({ ...draft, shortName: event.target.value })} />
        </label>
        <label>
          <span>Color</span>
          <input type="color" value={draft.color} onChange={(event) => setDraft({ ...draft, color: event.target.value })} />
        </label>
        <div className="notationChecks">
          {notationTypes.map((notation) => (
            <label key={notation}>
              <input
                type="checkbox"
                checked={draft.notationTypes.includes(notation)}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    notationTypes: event.target.checked
                      ? [...draft.notationTypes, notation]
                      : draft.notationTypes.filter((item) => item !== notation)
                  })
                }
              />
              <span>{notation}</span>
            </label>
          ))}
        </div>
        <label>
          <span>Staff</span>
          <select value={draft.staffConfig} onChange={(event) => setDraft({ ...draft, staffConfig: event.target.value as StaffConfig })}>
            <option value="single">single</option>
            <option value="grand">grand</option>
          </select>
        </label>
      </section>
      <section className="toolColumn">
        <TuningStringEditor
          tuning={draft.tuning}
          onChange={(tuning) => setDraft({ ...draft, tuning })}
        />
        <button type="button" onClick={() => auditionTuning(draft.tuning)}>
          Audition
        </button>
        <button type="button" onClick={create}>
          Create
        </button>
      </section>
    </div>
  );
}

function TuningPanel({
  track,
  onApplyTuning,
  onTrackPatch
}: TrackSystemPanelsProps & { track: Track }) {
  const [tuning, setTuning] = useState<Tuning>(structuredClone(track.tuning));
  const [mode, setMode] = useState<RetuneMode>("keep-fingering");
  const matching = tuningMatchesPreset(tuning.strings);
  const warning = tuning.partialCapo && tuning.partialCapo.fret < tuning.capo;

  useEffect(() => {
    setTuning(structuredClone(track.tuning));
  }, [track.id, track.tuning]);

  return (
    <div className="trackWizardGrid">
      <section className="toolColumn">
        <div className="instrumentList">
          {TUNING_PRESETS.filter((preset) => preset.strings.length === tuning.strings.length).map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={matching?.id === preset.id ? "activeToggle" : ""}
              onClick={() => setTuning({ ...tuning, strings: preset.strings, label: preset.label })}
            >
              <span>{preset.name}</span>
              <em>{preset.label}</em>
            </button>
          ))}
        </div>
      </section>
      <section className="toolColumn">
        <TuningStringEditor tuning={tuning} onChange={setTuning} />
        <label>
          <span>Capo</span>
          <input type="number" min="0" max="12" value={tuning.capo} onChange={(event) => setTuning({ ...tuning, capo: Number(event.target.value) })} />
        </label>
        <label>
          <span>Partial</span>
          <input
            value={partialCapoText(tuning)}
            onChange={(event) => setTuning(parsePartialCapo(tuning, event.target.value))}
          />
        </label>
        {warning ? <p className="toolWarning">Partial capo is below capo</p> : null}
      </section>
      <section className="toolColumn">
        <label>
          <span>Label</span>
          <input value={tuning.label} onChange={(event) => setTuning({ ...tuning, label: event.target.value })} />
        </label>
        <label>
          <span>Spelling</span>
          <select value={tuning.accidentalPreference} onChange={(event) => setTuning({ ...tuning, accidentalPreference: event.target.value as AccidentalPreference })}>
            <option value="sharp">sharp</option>
            <option value="flat">flat</option>
          </select>
        </label>
        <label>
          <span>Staff</span>
          <select value={track.staffConfig} onChange={(event) => onTrackPatch(track.id, { staffConfig: event.target.value as StaffConfig })}>
            <option value="single">single</option>
            <option value="grand">grand</option>
          </select>
        </label>
        <div className="toolButtonRow">
          <button type="button" className={mode === "keep-fingering" ? "activeToggle" : ""} onClick={() => setMode("keep-fingering")}>
            Keep
          </button>
          <button type="button" className={mode === "adjust-fingering" ? "activeToggle" : ""} onClick={() => setMode("adjust-fingering")}>
            Adjust
          </button>
        </div>
        <CapoPreview tuning={tuning} />
        <button type="button" onClick={() => onApplyTuning(track.id, tuning, mode)}>
          Apply
        </button>
      </section>
    </div>
  );
}

function VoicePanel({
  cursor,
  multiVoiceEdit,
  onVoiceSelect,
  onMoveNoteToVoice,
  onToggleMultiVoice
}: TrackSystemPanelsProps) {
  return (
    <div className="voicePanel">
      <section className="toolColumn">
        <button type="button" className={multiVoiceEdit ? "activeToggle" : ""} onClick={onToggleMultiVoice}>
          Multi-voice
        </button>
        <div className="voiceGrid">
          {[0, 1, 2, 3].map((voice) => (
            <button
              key={voice}
              type="button"
              className={cursor.voiceIndex === voice ? "activeToggle" : ""}
              onClick={() => onVoiceSelect(voice)}
            >
              V{voice + 1}
            </button>
          ))}
        </div>
      </section>
      <section className="toolColumn">
        <div className="voiceGrid">
          {[0, 1, 2, 3].map((voice) => (
            <button key={voice} type="button" onClick={() => onMoveNoteToVoice(voice)}>
              Move to V{voice + 1}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function DrumKitPanel({ onDrumToggle }: TrackSystemPanelsProps & { track: Track }) {
  const [articulationIndex, setArticulationIndex] = useState(0);

  useEffect(() => {
    function handleArticulationShortcut(event: KeyboardEvent): void {
      const target = event.target as HTMLElement | null;
      const editingText =
        target?.tagName === "INPUT" ||
        target?.tagName === "SELECT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (editingText) {
        return;
      }

      const key = event.code.startsWith("Numpad") ? event.code.replace("Numpad", "") : event.key;
      const index = Number(key) - 1;

      if (index >= 0 && index <= 2) {
        event.preventDefault();
        setArticulationIndex(index);
      }
    }

    window.addEventListener("keydown", handleArticulationShortcut);
    return () => window.removeEventListener("keydown", handleArticulationShortcut);
  }, []);

  return (
    <div className="drumPanel">
      <section className="toolColumn">
        <div className="toolButtonRow">
          {[0, 1, 2].map((index) => (
            <button key={index} type="button" className={articulationIndex === index ? "activeToggle" : ""} onClick={() => setArticulationIndex(index)}>
              {index + 1}
            </button>
          ))}
        </div>
        <div className="drumStaffPreview">
          {DRUM_MAPPINGS.map((mapping) => (
            <button
              key={mapping.id}
              type="button"
              title={`${mapping.name} MIDI ${mapping.midiNumber}`}
              style={{ gridRow: 12 - mapping.staffLine }}
              onClick={() => onDrumToggle(mapping.id, mapping.articulations[articulationIndex] ?? mapping.articulations[0])}
            >
              {mapping.shortcut}
            </button>
          ))}
        </div>
      </section>
      <section className="toolColumn drumList">
        {DRUM_MAPPINGS.map((mapping) => (
          <button
            key={mapping.id}
            type="button"
            onClick={() => onDrumToggle(mapping.id, mapping.articulations[articulationIndex] ?? mapping.articulations[0])}
          >
            <span>{mapping.name}</span>
            <em>{mapping.midiNumber}</em>
          </button>
        ))}
      </section>
    </div>
  );
}

function TuningStringEditor({ tuning, onChange }: { tuning: Tuning; onChange: (tuning: Tuning) => void }) {
  function updateString(index: number, midi: number): void {
    const strings = tuning.strings.map((value, candidateIndex) => (candidateIndex === index ? midi : value));
    onChange({ ...tuning, strings, label: tuningLabel(strings) });
  }

  function resize(count: number): void {
    const strings =
      count > tuning.strings.length
        ? [...tuning.strings, ...Array.from({ length: count - tuning.strings.length }, () => tuning.strings[tuning.strings.length - 1] + 5)]
        : tuning.strings.slice(0, count);
    onChange({ ...tuning, strings, label: tuningLabel(strings) });
  }

  return (
    <div className="tuningEditor">
      <label>
        <span>Strings</span>
        <input type="number" min="3" max="10" value={tuning.strings.length} onChange={(event) => resize(Number(event.target.value))} />
      </label>
      {tuning.strings.map((midi, index) => (
        <label key={index}>
          <span>{tuning.strings.length - index}</span>
          <input type="number" min="12" max="96" value={midi} onChange={(event) => updateString(index, Number(event.target.value))} />
          <em>{midiName(midi)}</em>
        </label>
      ))}
    </div>
  );
}

function CapoPreview({ tuning }: { tuning: Tuning }) {
  return (
    <div className="capoPreview" style={{ gridTemplateColumns: `repeat(${tuning.strings.length}, 1fr)` }}>
      {tuning.strings.map((_, index) => {
        const string = tuning.strings.length - index;
        const partial = tuning.partialCapo?.strings.includes(string);
        return (
          <span key={string} className={partial ? "partialCapo" : ""}>
            {partial ? tuning.partialCapo?.fret : tuning.capo}
          </span>
        );
      })}
    </div>
  );
}

function draftFromPreset(preset: InstrumentDefinition): TrackCreateOptions {
  return {
    presetId: preset.id,
    name: preset.name,
    shortName: preset.shortName,
    color: preset.color,
    icon: preset.icon,
    notationTypes: preset.notationTypes,
    staffConfig: preset.staffConfig,
    tuning: {
      strings: preset.tuning,
      capo: 0,
      partialCapo: null,
      label: preset.tuningLabel,
      accidentalPreference: "sharp"
    }
  };
}

function partialCapoText(tuning: Tuning): string {
  if (!tuning.partialCapo) {
    return "";
  }

  return `${tuning.partialCapo.fret}:${tuning.partialCapo.strings.join(",")}`;
}

function parsePartialCapo(tuning: Tuning, text: string): Tuning {
  const trimmed = text.trim();

  if (!trimmed) {
    return { ...tuning, partialCapo: null };
  }

  const [fretText, stringsText = ""] = trimmed.split(":");
  const fret = Number(fretText);
  const strings = stringsText
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => value >= 1 && value <= tuning.strings.length);

  return {
    ...tuning,
    partialCapo: Number.isFinite(fret) && strings.length > 0 ? { fret, strings } : tuning.partialCapo
  };
}

function auditionTuning(tuning: Tuning): void {
  const context = new AudioContext();
  tuning.strings.forEach((midi, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + index * 0.08;
    oscillator.type = "triangle";
    oscillator.frequency.value = 440 * 2 ** ((midi + tuning.capo - 69) / 12);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.08, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.38);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.42);
  });
  window.setTimeout(() => void context.close(), 1400);
}

function trackPanelTitle(panel: TrackPanelId): string {
  const titles: Record<TrackPanelId, string> = {
    wizard: "Add Track",
    tuning: "Tuning",
    voices: "Voices",
    drums: "Drum Kit"
  };
  return titles[panel];
}
