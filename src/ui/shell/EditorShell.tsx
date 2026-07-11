import type { MouseEvent, ReactNode } from "react";
import { beatDurationTicks, barTheoreticalTicks } from "../../model/derive";
import { TICKS_PER_QUARTER, type AutomationPoint, type BeatDuration, type DisplayMode, type NotationType, type Score, type SongInfo, type StaffConfig, type Stylesheet, type StylesheetPresetName, type Track } from "../../model/types";
import type { CursorPosition } from "../../engine/editing/types";
import type { EffectSlotType, EqPreset, MixerState, TrackMixerState } from "../../engine/audio/mixer";
import type { DocumentTabState } from "../../store/documentStore";
import type { PanelVisibility } from "../../store/preferencesStore";
import {
  ToolPanels,
  type CleanupRequest,
  type ToolPanelId
} from "./ToolPanels";
import {
  TrackSystemPanels,
  type TrackCreateOptions,
  type TrackPanelId
} from "./TrackSystemPanels";
import { CommandPalette, type CommandPaletteResult } from "./CommandPalette";
import { StylesheetPanel } from "./StylesheetPanel";
import { FileIoPanel, type ExportFormat, type ImportFormat } from "./FileIoPanel";
import type { ChordVoicing } from "../../model/chords";
import type { TransposeOptions } from "../../engine/tools/transpose";
import type { RetuneMode } from "../../model/instruments";
import type { Command } from "../../commands/registry";
import type { EditorCommandContext } from "../../commands/editingCommands";
import { MENU_TREE } from "../../commands/paletteCommands";
import { shortcutLabel, type Platform } from "../../commands/keymap";

export type AutomationLaneId = "tempo" | "masterVolume" | "masterPan" | "trackVolume" | "trackPan";

interface EditorShellProps {
  score: Score;
  cursor: CursorPosition;
  dirty: boolean;
  undoCount: number;
  redoCount: number;
  documents: DocumentTabState[];
  activeId: string;
  panelVisibility: PanelVisibility;
  playbackStatus: string;
  playbackBarIndex: number;
  playbackTick: number;
  playbackTimeSec: number;
  loopEnabled: boolean;
  metronomeEnabled: boolean;
  countInEnabled: boolean;
  speedPercent: number;
  mixer: MixerState;
  activeToolPanel: ToolPanelId | null;
  activeTrackPanel: TrackPanelId | null;
  stylesheetPanelOpen: boolean;
  fileIoPanelOpen: boolean;
  fileIoStatus: string;
  commandPaletteOpen: boolean;
  commandPaletteInitialValue: string;
  platform: Platform;
  registeredCommands: Array<Command<EditorCommandContext>>;
  multiVoiceEdit: boolean;
  multiTrackView: boolean;
  workspace: ReactNode;
  dispatchCommand: (commandId: string) => void;
  togglePanel: (panel: keyof PanelVisibility) => void;
  onSongInfoChange: (field: keyof SongInfo, value: string) => void;
  onTrackChange: (trackId: string, patch: Partial<Pick<Track, "name" | "shortName" | "color">>) => void;
  onTrackSystemPatch: (trackId: string, patch: Partial<Pick<Track, "notationTypes" | "staffConfig">>) => void;
  onTrackTranspositionChange: (trackId: string, soundingOffset: number) => void;
  onConcertToneToggle: () => void;
  onTrackDelete: (trackId: string) => void;
  onTrackMove: (trackId: string, direction: -1 | 1) => void;
  onGlobalJump: (trackId: string, barIndex: number) => void;
  onMixerTrackChange: (trackId: string, patch: Partial<TrackMixerState>) => void;
  onMixerEffectToggle: (trackId: string, effect: EffectSlotType) => void;
  onMasterFocusChange: (value: number) => void;
  onAutomationPointSet: (lane: AutomationLaneId, tick: number, value: number) => void;
  onAutomationPointRemove: (lane: AutomationLaneId, tick: number) => void;
  onAutomationTransitionToggle: (lane: AutomationLaneId, tick: number) => void;
  onToolOpen: (tool: ToolPanelId) => void;
  onToolClose: () => void;
  onTrackPanelOpen: (panel: TrackPanelId) => void;
  onTrackPanelClose: () => void;
  onFileIoPanelOpen: () => void;
  onFileIoPanelClose: () => void;
  onNewFile: () => void;
  onOpenNativeFile: () => void;
  onSaveNativeFile: () => void;
  onSaveNativeFileAs: () => void;
  onImportFile: (format: ImportFormat) => void;
  onExportFile: (format: ExportFormat) => void;
  onStylesheetPanelOpen: () => void;
  onStylesheetPanelClose: () => void;
  onStylesheetChange: (stylesheet: Stylesheet) => void;
  onStylesheetPreset: (presetName: StylesheetPresetName) => void;
  onDisplayModeChange: (mode: DisplayMode) => void;
  onZoomChange: (zoom: number) => void;
  onCommandPaletteOpen: (initialValue?: string) => void;
  onCommandPaletteClose: () => void;
  onCommandPaletteSubmit: (input: string) => CommandPaletteResult;
  onCreateTrack: (options: TrackCreateOptions) => void;
  onApplyTuning: (trackId: string, tuning: Track["tuning"], mode: RetuneMode) => void;
  onVoiceSelect: (voiceIndex: number) => void;
  onMoveNoteToVoice: (voiceIndex: number) => void;
  onToggleMultiVoice: () => void;
  onToggleMultiTrackView: () => void;
  onDrumToggle: (mappingId: string, articulation: string) => void;
  onInsertChordVoicing: (voicing: ChordVoicing, chordName: string) => void;
  onFretboardNoteToggle: (string: number, fret: number, advance: boolean) => void;
  onTransposeRequest: (options: TransposeOptions) => void;
  onCleanupRequest: (request: CleanupRequest) => void;
}

const noteDurations: BeatDuration[] = [1, 2, 4, 8, 16, 32, 64];
const barSymbolButtons = [
  ["Time", "bar.symbol.timeSignature"],
  ["Key", "bar.symbol.keySignature"],
  ["|:", "bar.symbol.repeatOpen"],
  [":|", "bar.symbol.repeatClose"],
  ["||", "bar.symbol.doubleBar"],
  ["Volta", "bar.symbol.alternateEnding"],
  ["Segno", "bar.symbol.directionTarget"],
  ["D.C.", "bar.symbol.directionJump"],
  ["Ferm.", "bar.symbol.fermata"],
  ["Simile", "bar.symbol.simile"],
  ["Swing", "bar.symbol.tripletFeel"],
  ["Free", "bar.symbol.freeTime"],
  ["Pickup", "bar.symbol.anacrusis"],
  ["Sec.", "bar.symbol.section"]
] as const;
const noteEffectButtons = [
  ["ghost", "note.effect.ghost"],
  ["x", "note.effect.dead"],
  [">", "note.effect.accent"],
  ["^", "note.effect.heavyAccent"],
  ["stac", "note.effect.staccato"],
  ["let", "note.effect.letRing"],
  ["PM", "note.effect.palmMute"],
  ["H/P", "note.effect.hopo"],
  ["slide", "note.effect.slide"],
  ["bend", "note.effect.bend"],
  ["N.H.", "note.effect.harmonic"],
  ["vib", "note.effect.vibrato"],
  ["tr", "note.effect.trill"],
  ["trem", "note.effect.tremoloPicking"],
  ["wah", "note.effect.wah"],
  ["slap", "note.effect.slap"],
  ["pop", "note.effect.pop"],
  ["str", "note.effect.stringNumber"]
] as const;
const beatEffectButtons = [
  ["brush v", "beat.effect.brushDown"],
  ["brush ^", "beat.effect.brushUp"],
  ["arp v", "beat.effect.arpeggioDown"],
  ["arp ^", "beat.effect.arpeggioUp"],
  ["pick v", "beat.effect.pickDown"],
  ["pick ^", "beat.effect.pickUp"],
  ["tap", "beat.effect.tapping"],
  ["bar vib", "beat.effect.barVibrato"],
  ["<", "beat.effect.hairpinCresc"],
  [">", "beat.effect.hairpinDecresc"],
  ["8va", "beat.effect.ottava"]
] as const;
const songFields: Array<keyof SongInfo> = [
  "title",
  "artist",
  "subtitle",
  "album",
  "words",
  "music",
  "copyright",
  "transcriber",
  "notice",
  "instructions"
];
const eqPresets: EqPreset[] = ["flat", "bright", "warm", "bass"];
const effectSlotButtons: Array<[EffectSlotType, string]> = [
  ["overdrive", "OD"],
  ["chorus", "Cho"],
  ["phaser", "Phs"],
  ["delay", "Dly"],
  ["reverb", "Rev"],
  ["wah", "Wah"],
  ["compressor", "Cmp"]
];
const displayModeButtons: Array<[DisplayMode, string, string]> = [
  ["vertical-page", "VP", "Vertical Page"],
  ["horizontal-page", "HP", "Horizontal Page"],
  ["grid", "Grid", "Grid"],
  ["parchment", "Parch", "Parchment"],
  ["vertical-screen", "VS", "Vertical Screen"],
  ["horizontal-screen", "HS", "Horizontal Screen"]
];

export function EditorShell(props: EditorShellProps) {
  return (
    <main className="gpShell" data-testid="gp-shell">
      <MenuBar />
      <Toolbar {...props} />
      <TabBar documents={props.documents} activeId={props.activeId} />
      <CommandPalette
        open={props.commandPaletteOpen}
        initialValue={props.commandPaletteInitialValue}
        registeredCommands={props.registeredCommands}
        onClose={props.onCommandPaletteClose}
        onSubmit={props.onCommandPaletteSubmit}
      />
      <FileIoPanel
        open={props.fileIoPanelOpen}
        score={props.score}
        dirty={props.dirty}
        status={props.fileIoStatus}
        onClose={props.onFileIoPanelClose}
        onNew={props.onNewFile}
        onOpenNative={props.onOpenNativeFile}
        onSaveNative={props.onSaveNativeFile}
        onSaveNativeAs={props.onSaveNativeFileAs}
        onImport={props.onImportFile}
        onExport={props.onExportFile}
      />
      <StylesheetPanel
        open={props.stylesheetPanelOpen}
        score={props.score}
        onClose={props.onStylesheetPanelClose}
        onChange={props.onStylesheetChange}
        onPreset={props.onStylesheetPreset}
        onDisplayModeChange={props.onDisplayModeChange}
        onZoomChange={props.onZoomChange}
      />
      <section
        className={[
          "gpMain",
          props.panelVisibility.palette ? "" : "paletteHidden",
          props.panelVisibility.songInspector || props.panelVisibility.trackInspector ? "" : "inspectorHidden"
        ].join(" ")}
      >
        {props.panelVisibility.palette ? (
          <EditionPalette
            dispatchCommand={props.dispatchCommand}
            cursor={props.cursor}
            multiVoiceEdit={props.multiVoiceEdit}
            onVoiceSelect={props.onVoiceSelect}
            onToggleMultiVoice={props.onToggleMultiVoice}
          />
        ) : null}
        <section className="workspacePanel" data-testid="workspace-panel">{props.workspace}</section>
        {props.panelVisibility.songInspector || props.panelVisibility.trackInspector ? (
          <InspectorPanel {...props} />
        ) : null}
      </section>
      {props.panelVisibility.globalView || props.panelVisibility.automationView ? (
        <section
          className={[
            "bottomDock",
            props.panelVisibility.automationView ? "automationVisible" : "",
            props.panelVisibility.globalView ? "globalVisible" : ""
          ].join(" ")}
          data-testid="bottom-dock"
        >
          {props.panelVisibility.automationView ? <AutomationEditor {...props} /> : null}
          {props.panelVisibility.globalView ? <GlobalView {...props} /> : null}
        </section>
      ) : null}
      <ToolPanels
        activeTool={props.activeToolPanel}
        score={props.score}
        cursor={props.cursor}
        onClose={props.onToolClose}
        onInsertChordVoicing={props.onInsertChordVoicing}
        onFretboardNoteToggle={props.onFretboardNoteToggle}
        onTransposeRequest={props.onTransposeRequest}
        onCleanupRequest={props.onCleanupRequest}
      />
      <TrackSystemPanels
        activePanel={props.activeTrackPanel}
        activeTrack={props.score.tracks.find((track) => track.id === props.cursor.trackId) ?? null}
        cursor={props.cursor}
        multiVoiceEdit={props.multiVoiceEdit}
        onClose={props.onTrackPanelClose}
        onCreateTrack={props.onCreateTrack}
        onApplyTuning={props.onApplyTuning}
        onTrackPatch={props.onTrackSystemPatch}
        onVoiceSelect={props.onVoiceSelect}
        onMoveNoteToVoice={props.onMoveNoteToVoice}
        onToggleMultiVoice={props.onToggleMultiVoice}
        onDrumToggle={props.onDrumToggle}
      />
    </main>
  );
}

function MenuBar() {
  return (
    <nav className="menuBar" aria-label="Application menus">
      {MENU_TREE.map((menu) => (
        <button key={menu.name} type="button">
          {menu.name}
        </button>
      ))}
    </nav>
  );
}

function Toolbar(props: EditorShellProps) {
  const currentTrack = props.score.tracks.find((track) => track.id === props.cursor.trackId);
  const lcd = currentLcdStatus(props.score, props.cursor);

  return (
    <header className="toolbar" aria-label="Toolbar">
      <div className="toolbarGroup homeGroup">
        <button type="button" title="File I/O" onClick={props.onFileIoPanelOpen}>
          ⌂
        </button>
      </div>
      <div className="toolbarGroup panelGroup">
        <button type="button" title="Palette F2" onClick={() => props.togglePanel("palette")}>
          ◧
        </button>
        <button type="button" title="Song Inspector F5" onClick={() => props.togglePanel("songInspector")}>
          ♫
        </button>
        <button type="button" title="Track Inspector F6" onClick={() => props.togglePanel("trackInspector")}>
          ⚙
        </button>
        <button type="button" title="Global View F8" onClick={() => props.togglePanel("globalView")}>
          ▤
        </button>
        <button type="button" title="Automation F10" onClick={() => props.togglePanel("automationView")}>
          A
        </button>
      </div>
      <div className="toolbarGroup toolLaunchGroup">
        <button type="button" title={titleWithShortcut("Add Track", "track.add", props.platform)} onClick={() => props.onTrackPanelOpen("wizard")}>
          +Trk
        </button>
        <button type="button" title="Tuning" disabled={!currentTrack} onClick={() => props.onTrackPanelOpen("tuning")}>
          Tune
        </button>
        <button
          type="button"
          className={props.multiVoiceEdit ? "activeToggle" : ""}
          title={titleWithShortcut("Voices", "voice.toggleMulti", props.platform)}
          onClick={() => props.onTrackPanelOpen("voices")}
        >
          Vox
        </button>
        <button
          type="button"
          title={titleWithShortcut("Drum kit", "tools.instrument", props.platform)}
          disabled={currentTrack?.icon !== "drums"}
          onClick={() => props.onTrackPanelOpen("drums")}
        >
          Kit
        </button>
        <button
          type="button"
          title={titleWithShortcut("Command Palette", "tools.commandPalette", props.platform)}
          data-testid="command-palette-open"
          onClick={() => props.onCommandPaletteOpen()}
        >
          Cmd
        </button>
        <button type="button" title={titleWithShortcut("Score Stylesheet", "view.stylesheet", props.platform)} onClick={props.onStylesheetPanelOpen}>
          Style
        </button>
        <button type="button" title="Chord tool A" onClick={() => props.onToolOpen("chords")}>
          Chord
        </button>
        <button type="button" title="Scale tool Shift+S" onClick={() => props.onToolOpen("scales")}>
          Scale
        </button>
        <button type="button" title="Instrument view Ctrl+F6" onClick={() => props.onToolOpen("instrument")}>
          Fret
        </button>
        <button type="button" title="Tuner" onClick={() => props.onToolOpen("tuner")}>
          Tune
        </button>
        <button type="button" title="Transpose" onClick={() => props.onToolOpen("transpose")}>
          Trans
        </button>
        <button type="button" title="Check bar duration F4" onClick={() => props.onToolOpen("cleanup")}>
          Check
        </button>
      </div>
      <div className="toolbarGroup liveZoomGroup">
        <button type="button" title={titleWithShortcut("Zoom out", "view.zoomOut", props.platform)} onClick={() => props.onZoomChange(props.score.documentSettings.zoom - 10)}>
          -
        </button>
        <span>{props.score.documentSettings.zoom}%</span>
        <button type="button" title={titleWithShortcut("Zoom in", "view.zoomIn", props.platform)} onClick={() => props.onZoomChange(props.score.documentSettings.zoom + 10)}>
          +
        </button>
      </div>
      <div className="toolbarGroup liveDisplayGroup">
        {displayModeButtons.map(([mode, label, title]) => (
          <button
            key={mode}
            type="button"
            className={props.score.documentSettings.displayMode === mode ? "activeToggle" : ""}
            title={title}
            onClick={() => props.onDisplayModeChange(mode)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="toolbarGroup zoomGroup">
        <button type="button" disabled>
          −
        </button>
        <span>100%</span>
        <button type="button" disabled>
          +
        </button>
      </div>
      <div className="toolbarGroup displayGroup">
        {["P", "H", "G", "S"].map((mode) => (
          <button key={mode} type="button" disabled>
            {mode}
          </button>
        ))}
      </div>
      <div className="toolbarGroup historyGroup">
        <button type="button" title="Undo Ctrl+Z" onClick={() => props.dispatchCommand("history.undo")}>
          ↶
        </button>
        <button type="button" title="Redo Ctrl+Y" onClick={() => props.dispatchCommand("history.redo")}>
          ↷
        </button>
      </div>
      <div className="toolbarGroup printGroup">
        <button type="button" disabled title="Print Ctrl+P">
          ⎙
        </button>
      </div>
      <div className="toolbarGroup transportGroup">
        <button type="button" title="First bar" onClick={() => props.dispatchCommand("cursor.firstBar")}>
          |&lt;
        </button>
        <button type="button" title="Previous bar Ctrl+Left" onClick={() => props.dispatchCommand("playback.previousBar")}>
          &lt;
        </button>
        <button
          type="button"
          title="Play / stop Space"
          data-testid="transport-play-stop"
          onClick={() => props.dispatchCommand("playback.toggle")}
        >
          {props.playbackStatus === "playing" ? "Stop" : "Play"}
        </button>
        <button type="button" title="Next bar Ctrl+Right" onClick={() => props.dispatchCommand("playback.nextBar")}>
          &gt;
        </button>
        <button type="button" title="Last bar" onClick={() => props.dispatchCommand("cursor.lastBar")}>
          &gt;|
        </button>
      </div>
      <div className="toolbarGroup transportGroup transportLegacy">
        {["⏮", "◀", props.playbackStatus === "playing" ? "■" : "▶", "▶", "⏭"].map((label, index) => (
          <button key={`${label}-${index}`} type="button" disabled>
            {label}
          </button>
        ))}
      </div>
      <div className="lcd" title={lcd.title}>
        <span className="trackColor" style={{ background: currentTrack?.color ?? "#64748b" }} />
        <strong>{currentTrack?.shortName ?? "Track"}</strong>
        <span>♩ 120</span>
        <span className={lcd.issue ? "lcdWarning" : ""}>
          {lcd.actual}/{lcd.expected}
        </span>
        <button type="button" className={props.multiTrackView ? "activeToggle" : ""} title="Multitrack view F3" onClick={props.onToggleMultiTrackView}>
          {props.multiTrackView ? "Multi" : "1"}
        </button>
        <button type="button" disabled>
          ♫
        </button>
        <button type="button" disabled>
          ⚙
        </button>
      </div>
      <div className="toolbarGroup playbackTools">
        <button type="button" className={props.countInEnabled ? "activeToggle" : ""} title="Count-in" onClick={() => props.dispatchCommand("playback.countIn")}>
          C
        </button>
        <button type="button" className={props.metronomeEnabled ? "activeToggle" : ""} title="Metronome" onClick={() => props.dispatchCommand("playback.metronome")}>
          M
        </button>
        <button type="button" className={props.loopEnabled ? "activeToggle" : ""} title="Loop F9" onClick={() => props.dispatchCommand("playback.loop")}>
          Loop
        </button>
        <button type="button" title="Speed down" onClick={() => props.dispatchCommand("playback.speedDown")}>
          -
        </button>
        <button type="button" title="Playback speed">
          {props.speedPercent}%
        </button>
        <button type="button" title="Speed up" onClick={() => props.dispatchCommand("playback.speedUp")}>
          +
        </button>
        <span className="playbackReadout">
          {props.playbackStatus === "playing"
            ? `Bar ${props.playbackBarIndex + 1} / ${props.playbackTimeSec.toFixed(1)}s`
            : `Bar ${props.cursor.barIndex + 1} / Ready`}
        </span>
      </div>
      <div className="toolbarGroup utilityGroup utilityLegacy">
        {["Loop", "100%", "C", "Audio", "View", "Tune", "Line"].map((label) => (
          <button key={label} type="button" disabled>
            {label}
          </button>
        ))}
      </div>
    </header>
  );
}

function TabBar({
  documents,
  activeId
}: Pick<EditorShellProps, "documents" | "activeId">) {
  return (
    <div className="tabBar" aria-label="Open documents" data-testid="tab-bar">
      {documents.map((document) => (
        <button
          key={document.id}
          type="button"
          className={document.id === activeId ? "activeTab" : ""}
          data-testid="document-tab"
        >
          {document.locked ? "L " : ""}
          {document.title}
          {document.dirty ? " ●" : ""}
        </button>
      ))}
      <button type="button" className="tabAdd" data-testid="tab-add">
        +
      </button>
    </div>
  );
}

function EditionPalette({
  dispatchCommand,
  cursor,
  multiVoiceEdit,
  onVoiceSelect,
  onToggleMultiVoice
}: Pick<EditorShellProps, "dispatchCommand" | "cursor" | "multiVoiceEdit" | "onVoiceSelect" | "onToggleMultiVoice">) {
  return (
    <aside className="palettePanel" aria-label="Edition palette" data-testid="palette-panel">
      <PaletteGroup title="Voices">
        {[1, 2, 3, 4].map((voice) => (
          <button
            key={voice}
            type="button"
            className={cursor.voiceIndex === voice - 1 ? "activeToggle" : ""}
            onClick={() => onVoiceSelect(voice - 1)}
          >
            V{voice}
          </button>
        ))}
      </PaletteGroup>
      <PaletteGroup title="Multivoice">
        <button type="button" className={multiVoiceEdit ? "activeToggle" : ""} onClick={onToggleMultiVoice}>
          {multiVoiceEdit ? "On" : "Off"}
        </button>
      </PaletteGroup>
      {["Design", "Lyrics", "Chords"].map((title) => (
        <PaletteGroup key={title} title={title} disabled />
      ))}
      <PaletteGroup title="Bar symbols">
        {barSymbolButtons.map(([label, command]) => (
          <button key={command} type="button" onClick={() => dispatchCommand(command)}>
            {label}
          </button>
        ))}
      </PaletteGroup>
      <PaletteGroup title="Note symbols">
        {noteDurations.map((duration) => (
          <button key={duration} type="button" onClick={() => dispatchCommand(`duration.set.${duration}`)}>
            {duration}
          </button>
        ))}
        <button type="button" onClick={() => dispatchCommand("note.dot")}>
          •
        </button>
        <button type="button" onClick={() => dispatchCommand("note.doubleDot")}>
          ••
        </button>
        <button type="button" className="modeButton" onClick={() => dispatchCommand("note.triplet")}>
          3
        </button>
        <button type="button" onClick={() => dispatchCommand("note.tie")}>
          ⌒
        </button>
        {[
          ["♯", "note.sharp"],
          ["♭", "note.flat"],
          ["♮", "note.natural"],
          ["𝄪", "note.doubleSharp"],
          ["𝄫", "note.doubleFlat"]
        ].map(([label, command]) => (
          <button key={command} type="button" onClick={() => dispatchCommand(command)}>
            {label}
          </button>
        ))}
        {["ppp", "pp", "p", "mp", "mf", "f", "ff", "fff"].map((dynamic, index) => (
          <button key={dynamic} type="button" onClick={() => dispatchCommand(`note.dynamic.${index}`)}>
            {dynamic}
          </button>
        ))}
      </PaletteGroup>
      <PaletteGroup title="Effect symbols">
        {noteEffectButtons.map(([label, command]) => (
          <button key={command} type="button" onClick={() => dispatchCommand(command)}>
            {label}
          </button>
        ))}
      </PaletteGroup>
      <PaletteGroup title="Beat effects">
        {beatEffectButtons.map(([label, command]) => (
          <button key={command} type="button" onClick={() => dispatchCommand(command)}>
            {label}
          </button>
        ))}
      </PaletteGroup>
      {["Notation symbols", "Automation symbols"].map((title) => (
        <PaletteGroup key={title} title={title} disabled />
      ))}
    </aside>
  );
}

function PaletteGroup({
  title,
  disabled,
  children
}: {
  title: string;
  disabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <section className="paletteGroup">
      <h2>{title}</h2>
      <div className="paletteButtons">
        {children ?? (
          <button type="button" disabled={disabled}>
            ▸
          </button>
        )}
      </div>
    </section>
  );
}

function InspectorPanel(props: EditorShellProps) {
  const currentTrack = props.score.tracks.find((track) => track.id === props.cursor.trackId);
  const currentMixer = currentTrack ? props.mixer.tracks[currentTrack.id] : null;

  return (
    <aside className="inspectorPanel" aria-label="Inspector" data-testid="inspector-panel">
      {props.panelVisibility.songInspector ? (
        <section>
          <h2>Song</h2>
          {songFields.map((field) => (
            <label key={field}>
              <span>{field}</span>
              <input
                value={props.score.meta[field]}
                onChange={(event) => props.onSongInfoChange(field, event.target.value)}
              />
            </label>
          ))}
          <button
            type="button"
            className={props.score.documentSettings.concertTone ? "activeToggle" : ""}
            onClick={props.onConcertToneToggle}
          >
            Concert tone
          </button>
        </section>
      ) : null}
      {props.panelVisibility.trackInspector && currentTrack ? (
        <section>
          <h2>Track</h2>
          <label>
            <span>Name</span>
            <input
              value={currentTrack.name}
              onChange={(event) => props.onTrackChange(currentTrack.id, { name: event.target.value })}
            />
          </label>
          <label>
            <span>Short</span>
            <input
              value={currentTrack.shortName}
              onChange={(event) => props.onTrackChange(currentTrack.id, { shortName: event.target.value })}
            />
          </label>
          <label>
            <span>Color</span>
            <input
              type="color"
              value={currentTrack.color}
              onChange={(event) => props.onTrackChange(currentTrack.id, { color: event.target.value })}
            />
          </label>
          <div className="notationChecks">
            {["standard", "tab", "slash", "numbered"].map((notation) => (
              <label key={notation}>
                <input
                  type="checkbox"
                  checked={currentTrack.notationTypes.includes(notation as NotationType)}
                  onChange={(event) =>
                    props.onTrackSystemPatch(currentTrack.id, {
                      notationTypes: nextNotationTypes(
                        currentTrack.notationTypes,
                        notation as NotationType,
                        event.target.checked
                      )
                    })
                  }
                />
                <span>{notation}</span>
              </label>
            ))}
          </div>
          <label>
            <span>Staff</span>
            <select
              value={currentTrack.staffConfig}
              onChange={(event) =>
                props.onTrackSystemPatch(currentTrack.id, { staffConfig: event.target.value as StaffConfig })
              }
            >
              <option value="single">single</option>
              <option value="grand">grand</option>
            </select>
          </label>
          <label>
            <span>Transposition</span>
            <select
              value={currentTrack.transpositionTonality.soundingOffset}
              onChange={(event) =>
                props.onTrackTranspositionChange(currentTrack.id, Number(event.target.value))
              }
            >
              <option value="0">Concert C</option>
              <option value="-2">Bb instrument</option>
              <option value="-9">Eb alto</option>
              <option value="12">Octave up</option>
              <option value="-12">Octave down</option>
            </select>
          </label>
          <p>{currentTrack.tuning.label}</p>
          <div className="inspectorButtonRow">
            <button type="button" onClick={() => props.onTrackPanelOpen("tuning")}>
              Tuning
            </button>
            <button type="button" onClick={() => props.onTrackMove(currentTrack.id, -1)}>
              Up
            </button>
            <button type="button" onClick={() => props.onTrackMove(currentTrack.id, 1)}>
              Down
            </button>
            <button type="button" onClick={() => props.onTrackDelete(currentTrack.id)}>
              Delete
            </button>
          </div>
          <button type="button" onClick={() => props.onTrackPanelOpen("voices")}>
            Interpretation
          </button>
          {currentMixer ? (
            <div className="soundInspector">
              <h2>Sound</h2>
              <select
                value={currentMixer.eq}
                onChange={(event) =>
                  props.onMixerTrackChange(currentTrack.id, { eq: event.target.value as EqPreset })
                }
              >
                {eqPresets.map((preset) => (
                  <option key={preset} value={preset}>
                    {preset}
                  </option>
                ))}
              </select>
              <div className="effectButtons">
                {effectSlotButtons.map(([effect, label]) => {
                  const active = currentMixer.effectChain.some((slot) => slot.type === effect);

                  return (
                    <button
                      key={effect}
                      type="button"
                      className={active ? "activeToggle" : ""}
                      title={effect}
                      onClick={() => props.onMixerEffectToggle(currentTrack.id, effect)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </aside>
  );
}

function GlobalView(props: EditorShellProps) {
  return (
    <section className="globalView" aria-label="Global view">
      <div className="globalTracks">
        <button type="button" onClick={() => props.onTrackPanelOpen("wizard")}>
          + Track
        </button>
        <span className="globalModeBadge">{props.multiTrackView ? "F3 Multitrack" : "Single focus"}</span>
        <div className="masterStrip">
          <strong>Master</strong>
          <label className="mixerSlider">
            <span>Focus</span>
            <input
              type="range"
              min="-100"
              max="100"
              step="1"
              value={props.mixer.master.focusPercent}
              onChange={(event) => props.onMasterFocusChange(Number(event.target.value))}
            />
            <em>{props.mixer.master.focusPercent}</em>
          </label>
        </div>
        {props.score.tracks.map((track) => (
          <TrackMixerStrip key={track.id} track={track} {...props} />
        ))}
      </div>
      <div className="globalGrid" style={{ gridTemplateColumns: `repeat(${props.score.masterBars.length}, 42px)` }}>
        {props.score.masterBars.map((_, barIndex) => (
          <span key={`header-${barIndex}`} className="globalHeader">
            {barIndex + 1}
          </span>
        ))}
        {props.score.tracks.flatMap((track) =>
          props.score.masterBars.map((_, barIndex) => (
            <button
              key={`${track.id}-${barIndex}`}
              type="button"
              className={
                track.id === props.cursor.trackId && barIndex === props.cursor.barIndex
                  ? "globalCell activeCell"
                  : "globalCell"
              }
              onClick={() => props.onGlobalJump(track.id, barIndex)}
            >
              <span style={{ background: track.color }} />
            </button>
          ))
        )}
      </div>
    </section>
  );
}

function TrackMixerStrip(props: EditorShellProps & { track: Track }) {
  const { track } = props;
  const mixer = props.mixer.tracks[track.id];

  if (!mixer) {
    return (
      <button
        type="button"
        className={track.id === props.cursor.trackId ? "activeTrack" : ""}
        onClick={() => props.onGlobalJump(track.id, props.cursor.barIndex)}
      >
        <span style={{ background: track.color }} />
        {track.shortName}
      </button>
    );
  }

  return (
    <div className={track.id === props.cursor.trackId ? "trackMixerStrip activeTrack" : "trackMixerStrip"}>
      <button
        type="button"
        className="trackSelectButton"
        onClick={() => props.onGlobalJump(track.id, props.cursor.barIndex)}
      >
        <span style={{ background: track.color }} />
        <strong>{track.shortName}</strong>
      </button>
      <div className="mixerButtons">
        <button
          type="button"
          className={mixer.visible ? "activeToggle" : ""}
          title="Visible"
          onClick={() => props.onMixerTrackChange(track.id, { visible: !mixer.visible })}
        >
          V
        </button>
        <button
          type="button"
          className={mixer.mute ? "activeToggle" : ""}
          title="Mute"
          onClick={() => props.onMixerTrackChange(track.id, { mute: !mixer.mute })}
        >
          M
        </button>
        <button
          type="button"
          className={mixer.solo ? "activeToggle" : ""}
          title="Solo"
          onClick={() => props.onMixerTrackChange(track.id, { solo: !mixer.solo })}
        >
          S
        </button>
        <button
          type="button"
          className={mixer.volumeAutomationEnabled ? "automationActive" : ""}
          title="Volume automation"
          onClick={() =>
            props.onMixerTrackChange(track.id, {
              volumeAutomationEnabled: !mixer.volumeAutomationEnabled
            })
          }
        >
          A Vol
        </button>
        <button
          type="button"
          className={mixer.panAutomationEnabled ? "automationActive" : ""}
          title="Pan automation"
          onClick={() =>
            props.onMixerTrackChange(track.id, {
              panAutomationEnabled: !mixer.panAutomationEnabled
            })
          }
        >
          A Pan
        </button>
      </div>
      <label className="mixerSlider">
        <span>Vol</span>
        <input
          type="range"
          min="0"
          max="1.2"
          step="0.01"
          value={mixer.volume}
          onChange={(event) => props.onMixerTrackChange(track.id, { volume: Number(event.target.value) })}
        />
        <em>{Math.round(mixer.volume * 100)}</em>
      </label>
      <label className="mixerSlider">
        <span>Pan</span>
        <input
          type="range"
          min="-1"
          max="1"
          step="0.01"
          value={mixer.pan}
          onChange={(event) => props.onMixerTrackChange(track.id, { pan: Number(event.target.value) })}
        />
        <em>{Math.round(mixer.pan * 100)}</em>
      </label>
      <select
        className="mixerSelect"
        value={mixer.eq}
        title="EQ"
        onChange={(event) => props.onMixerTrackChange(track.id, { eq: event.target.value as EqPreset })}
      >
        {eqPresets.map((preset) => (
          <option key={preset} value={preset}>
            {preset}
          </option>
        ))}
      </select>
      <div className="effectButtons">
        {effectSlotButtons.map(([effect, label]) => {
          const active = mixer.effectChain.some((slot) => slot.type === effect);

          return (
            <button
              key={effect}
              type="button"
              className={active ? "activeToggle" : ""}
              title={effect}
              onClick={() => props.onMixerEffectToggle(track.id, effect)}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface AutomationLaneConfig {
  id: AutomationLaneId;
  label: string;
  min: number;
  max: number;
  points: AutomationPoint[];
}

function AutomationEditor(props: EditorShellProps) {
  const currentTrack = props.score.tracks.find((track) => track.id === props.cursor.trackId) ?? null;
  const totalTicks = Math.max(
    TICKS_PER_QUARTER,
    props.score.masterBars.reduce((sum, masterBar) => sum + barTheoreticalTicks(masterBar), 0)
  );
  const lanes: AutomationLaneConfig[] = [
    {
      id: "tempo",
      label: "Tempo",
      min: 40,
      max: 220,
      points: automationPoints(props.score.masterAutomations, "tempo", "master")
    },
    {
      id: "masterVolume",
      label: "M Vol",
      min: 0,
      max: 1.2,
      points: automationPoints(props.score.masterAutomations, "volume", "master")
    },
    {
      id: "masterPan",
      label: "M Pan",
      min: -1,
      max: 1,
      points: automationPoints(props.score.masterAutomations, "pan", "master")
    },
    {
      id: "trackVolume",
      label: "T Vol",
      min: 0,
      max: 1.2,
      points: currentTrack ? automationPoints(currentTrack.automations, "volume", "track") : []
    },
    {
      id: "trackPan",
      label: "T Pan",
      min: -1,
      max: 1,
      points: currentTrack ? automationPoints(currentTrack.automations, "pan", "track") : []
    }
  ];

  return (
    <section className="automationEditor" aria-label="Automation editor">
      {lanes.map((lane) => (
        <div key={lane.id} className="automationRow">
          <strong>{lane.label}</strong>
          <div
            className="automationLane"
            role="button"
            tabIndex={0}
            onClick={(event) => handleAutomationLaneClick(event, lane, totalTicks, props)}
          >
            {lane.points.map((point, index) => (
              <button
                key={`${lane.id}-${point.tick}-${index}`}
                type="button"
                className={`automationPoint ${point.transition}`}
                style={{
                  left: `${pointLeft(point.tick, totalTicks)}%`,
                  top: `${pointTop(normalizeAutomationPointValue(lane.id, point.value), lane)}%`
                }}
                title={`${lane.label} ${formatAutomationValue(lane.id, point.value)} ${point.transition}`}
                onClick={(event) => {
                  event.stopPropagation();

                  if (event.shiftKey) {
                    props.onAutomationPointRemove(lane.id, point.tick);
                  } else {
                    props.onAutomationTransitionToggle(lane.id, point.tick);
                  }
                }}
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function handleAutomationLaneClick(
  event: MouseEvent<HTMLDivElement>,
  lane: AutomationLaneConfig,
  totalTicks: number,
  props: EditorShellProps
): void {
  const bounds = event.currentTarget.getBoundingClientRect();
  const xRatio = clamp((event.clientX - bounds.left) / Math.max(1, bounds.width), 0, 1);
  const yRatio = clamp((event.clientY - bounds.top) / Math.max(1, bounds.height), 0, 1);
  const tick = xRatio * totalTicks;
  const value = roundAutomationValue(lane.id, lane.min + (1 - yRatio) * (lane.max - lane.min));

  props.onAutomationPointSet(lane.id, tick, value);
}

function automationPoints(
  automations: Score["masterAutomations"],
  type: "tempo" | "volume" | "pan",
  scope: "master" | "track"
): AutomationPoint[] {
  return automations.find((automation) => automation.type === type && automation.scope === scope)?.points ?? [];
}

function pointLeft(tick: number, totalTicks: number): number {
  return clamp((tick / totalTicks) * 100, 0, 100);
}

function pointTop(value: number, lane: AutomationLaneConfig): number {
  return clamp(100 - ((value - lane.min) / (lane.max - lane.min)) * 100, 0, 100);
}

function normalizeAutomationPointValue(lane: AutomationLaneId, value: number): number {
  if (lane === "tempo") {
    return value;
  }

  if (lane === "masterVolume" || lane === "trackVolume") {
    return value > 1.6 ? value / 100 : value;
  }

  return Math.abs(value) > 1 ? value / 100 : value;
}

function roundAutomationValue(lane: AutomationLaneId, value: number): number {
  if (lane === "tempo") {
    return Math.round(value);
  }

  return Math.round(value * 100) / 100;
}

function formatAutomationValue(lane: AutomationLaneId, value: number): string {
  const normalized = normalizeAutomationPointValue(lane, value);

  if (lane === "tempo") {
    return `${Math.round(normalized)} bpm`;
  }

  return `${Math.round(normalized * 100)}`;
}

function currentLcdStatus(score: Score, cursor: CursorPosition) {
  const track = score.tracks.find((candidate) => candidate.id === cursor.trackId);
  const voice = track?.bars[cursor.barIndex]?.voices[cursor.voiceIndex];
  const expected = score.masterBars[cursor.barIndex]
    ? barTheoreticalTicks(score.masterBars[cursor.barIndex])
    : 0;
  const actual = voice?.beats.reduce((total, beat) => total + beatDurationTicks(beat), 0) ?? 0;
  const issue = actual !== expected;

  return {
    actual: Math.round(actual),
    expected: Math.round(expected),
    issue,
    title: issue ? `Voice ${cursor.voiceIndex + 1}: ${actual}/${expected}` : "Bar duration ok"
  };
}

function nextNotationTypes(
  current: NotationType[],
  notation: NotationType,
  enabled: boolean
): NotationType[] {
  if (enabled) {
    return current.includes(notation) ? current : [...current, notation];
  }

  const next = current.filter((candidate) => candidate !== notation);
  return next.length > 0 ? next : current;
}

function titleWithShortcut(label: string, commandId: string, platform: Platform): string {
  const shortcut = shortcutLabel(commandId, platform);
  return shortcut ? `${label} ${shortcut}` : label;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
