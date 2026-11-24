import { useRef, useState, type ReactNode } from "react";
import type { EqPreset } from "../../engine/audio/mixer";
import type { NotationType, SongInfo, StaffConfig, Track } from "../../model/types";
import { useDocumentStore } from "../../store/documentStore";
import { useLayoutStore, type InspectorTab } from "../../store/layoutStore";
import { t } from "../i18n/messages.en";
import { FileDialog } from "../overlays/FileDialog";
import type { EditorShellProps } from "./EditorShell";
import { effectSlotButtons, eqPresets, mixerRangeEvents } from "./mixerControls";

const songFields: ReadonlyArray<keyof SongInfo> = [
  "title", "artist", "subtitle", "album", "words", "music", "copyright", "transcriber", "notice", "instructions"
];

export function InspectorDock(props: EditorShellProps) {
  const activeTab = useLayoutStore((state) => state.activeInspectorTab);
  const activate = useLayoutStore((state) => state.activateInspector);
  const tabButtons = useRef<Record<InspectorTab, HTMLButtonElement | null>>({ song: null, track: null });
  const currentTrack = props.score.tracks.find((track) => track.id === props.cursor.trackId);
  return (
    <aside className="inspectorPanel compactInspector" aria-label={t("editor.inspector")} data-testid="inspector-panel">
      <div className="inspectorTabs" role="tablist" aria-label="Inspector sections">
        {(["song", "track"] as const).map((tab) => (
          <button key={tab} type="button" role="tab" id={`inspector-tab-${tab}`} aria-controls={`inspector-${tab}`}
            aria-selected={tab === activeTab} tabIndex={tab === activeTab ? 0 : -1}
            ref={(button) => { tabButtons.current[tab] = button; }} onClick={() => activate(tab)}
            onKeyDown={(event) => {
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
              event.preventDefault();
              const next = event.key === "Home" ? "song" : event.key === "End" ? "track" : tab === "song" ? "track" : "song";
              activate(next);
              tabButtons.current[next]?.focus();
            }}>{t(`editor.${tab}`)}</button>
        ))}
      </div>
      <div role="tabpanel" id="inspector-song" aria-labelledby="inspector-tab-song" hidden={activeTab !== "song"}>
        {activeTab === "song" && <SongInspector {...props} />}
      </div>
      <div role="tabpanel" id="inspector-track" aria-labelledby="inspector-tab-track" hidden={activeTab !== "track"}>
        {activeTab === "track" && (currentTrack ? <TrackInspector key={currentTrack.id} {...props} track={currentTrack} /> : <p>Select a track.</p>)}
      </div>
    </aside>
  );
}

function InspectorSection({ title, children }: { title: string; children: ReactNode }) {
  return <section><h2>{title}</h2>{children}</section>;
}

function InspectorField({ label, children }: { label: string; children: ReactNode }) {
  return <label><span>{label}</span>{children}</label>;
}

function SongInspector(props: EditorShellProps) {
  return (
    <InspectorSection title="Song information">
      {songFields.map((field) => (
        <InspectorField key={field} label={t(`song.${field}`)}>
          {field === "notice" || field === "instructions" ? (
            <textarea value={props.score.meta[field]} rows={2}
              onChange={(event) => props.onSongInfoChange(field, event.target.value)} onBlur={endEditGroup} />
          ) : (
            <input value={props.score.meta[field]}
              onChange={(event) => props.onSongInfoChange(field, event.target.value)}
              onBlur={endEditGroup}
              onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />
          )}
        </InspectorField>
      ))}
      <button type="button" aria-pressed={props.score.documentSettings.concertTone}
        onClick={props.onConcertToneToggle}>{t("editor.concertTone")}</button>
    </InspectorSection>
  );
}

function TrackInspector(props: EditorShellProps & { track: Track }) {
  const { track } = props;
  const mixer = props.mixer.tracks[track.id];
  const index = props.score.tracks.findIndex(({ id }) => id === track.id);
  const [deleting, setDeleting] = useState(false);
  const playableNotation: NotationType[] = track.kind === "percussion" ? ["standard"]
    : track.kind === "pitched" ? ["standard", "slash"] : ["standard", "tab", "slash"];

  return (
    <>
      <InspectorSection title="Track identity">
        <InspectorField label={t("editor.name")}>
          <input value={track.name} onBlur={endEditGroup}
            onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
            onChange={(event) => props.onTrackChange(track.id, { name: event.target.value })} />
        </InspectorField>
        <InspectorField label={t("editor.short")}>
          <input value={track.shortName} onBlur={endEditGroup}
            onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
            onChange={(event) => props.onTrackChange(track.id, { shortName: event.target.value })} />
        </InspectorField>
        <InspectorField label={t("editor.color")}>
          <input type="color" value={track.color} onChange={(event) => props.onTrackChange(track.id, { color: event.target.value })} />
        </InspectorField>
        <div className="inspectorButtonRow">
          <button type="button" disabled={index <= 0} onClick={() => props.onTrackMove(track.id, -1)}>{t("editor.up")}</button>
          <button type="button" disabled={index >= props.score.tracks.length - 1} onClick={() => props.onTrackMove(track.id, 1)}>{t("editor.down")}</button>
          <button type="button" disabled={props.score.tracks.length <= 1} onClick={() => setDeleting(true)}>{t("editor.delete")}</button>
        </div>
      </InspectorSection>
      <InspectorSection title="Notation">
        <div className="notationChecks">
          {playableNotation.map((notation) => {
            const checked = track.notationTypes.includes(notation);
            return <InspectorField key={notation} label={t(`notation.${notation}`)}>
              <input type="checkbox" checked={checked} disabled={checked && track.notationTypes.length <= 1}
                onChange={(event) => props.onTrackSystemPatch(track.id, { notationTypes: event.target.checked
                  ? [...new Set([...track.notationTypes, notation])]
                  : track.notationTypes.filter((candidate) => candidate !== notation) })} />
            </InspectorField>;
          })}
        </div>
        <InspectorField label={t("editor.staff")}>
          <select value={track.staffConfig} disabled={track.kind === "percussion"}
            onChange={(event) => props.onTrackSystemPatch(track.id, { staffConfig: event.target.value as StaffConfig })}>
            <option value="single">{t("editor.single")}</option>
            <option value="grand">{t("editor.grand")}</option>
          </select>
        </InspectorField>
      </InspectorSection>
      <InspectorSection title="Tuning and transposition">
        <InspectorField label={t("editor.transposition")}>
          <select value={track.transpositionTonality.soundingOffset} disabled={track.kind === "percussion"}
            onChange={(event) => props.onTrackTranspositionChange(track.id, Number(event.target.value))}>
            <option value="0">{t("editor.concertC")}</option>
            <option value="-2">{t("editor.bbInstrument")}</option>
            <option value="-9">{t("editor.ebAlto")}</option>
            <option value="12">{t("editor.octaveUp")}</option>
            <option value="-12">{t("editor.octaveDown")}</option>
          </select>
        </InspectorField>
        {track.kind === "stringed" && <div className="inspectorSummary">
          <span>{track.tuning.label}</span><button type="button" onClick={() => props.onTrackPanelOpen("tuning")}>{t("tuning")}</button>
        </div>}
      </InspectorSection>
      <InspectorSection title="Interpretation">
        <button type="button" onClick={() => props.onTrackPanelOpen("voices")}>Voice settings</button>
        {track.kind === "percussion" && <button type="button" onClick={() => props.onTrackPanelOpen("drums")}>Drum kit</button>}
      </InspectorSection>
      {mixer && <InspectorSection title={t("editor.sound")}>
        <InspectorField label={t("editor.trackSound")}>
          <select value={mixer.eq} onChange={(event) => props.onMixerTrackChange(track.id, { eq: event.target.value as EqPreset })}>
            {eqPresets.map((preset) => <option key={preset} value={preset}>{t(`eq.${preset}`)}</option>)}
          </select>
        </InspectorField>
        <InspectorField label="Track volume">
          <input type="range" min="0" max="1" step="0.01" value={mixer.volume}
            {...mixerRangeEvents((volume, phase) => props.onMixerTrackChange(track.id, { volume }, phase))} />
        </InspectorField>
        <InspectorField label="Track pan">
          <input type="range" min="-1" max="1" step="0.01" value={mixer.pan}
            {...mixerRangeEvents((pan, phase) => props.onMixerTrackChange(track.id, { pan }, phase))} />
        </InspectorField>
        <div className="effectButtons">
          {effectSlotButtons.map(([effect, label]) => (
            <button key={effect} type="button" title={t(`effect.${effect}`)} aria-label={t(`effect.${effect}`)}
              aria-pressed={mixer.effectChain.some((slot) => slot.type === effect && !slot.bypassed)}
              onClick={() => props.onMixerEffectToggle(track.id, effect)}><span aria-hidden="true">{label}</span></button>
          ))}
        </div>
      </InspectorSection>}
      {deleting && <FileDialog title="Delete track" role="alertdialog" onCancel={() => setDeleting(false)}>
        <p>Delete {track.name} and its notes from this score?</p>
        <div className="fileDecisionActions">
          <button type="button" autoFocus onClick={() => setDeleting(false)}>Cancel</button>
          <button type="button" onClick={() => { setDeleting(false); props.onTrackDelete(track.id); }}>Delete track</button>
        </div>
      </FileDialog>}
    </>
  );
}

function endEditGroup(): void {
  useDocumentStore.getState().endEditGroup();
}
