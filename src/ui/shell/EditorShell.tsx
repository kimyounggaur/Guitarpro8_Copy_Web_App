import { t } from "../i18n/messages.en";
import type { PngScale } from "../../io/print/imageExport";
import type { ReactNode } from "react";
import type { DisplayMode, Score, SongInfo, Stylesheet, StylesheetPresetName, Track } from "../../model/types";
import type { CursorPosition } from "../../engine/editing/types";
import type { EffectSlotType, MixerState, TrackMixerState } from "../../engine/audio/mixer";
import type { MixerEditPhase } from "../../store/playbackStore";
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
import { ApplicationMenus } from "./ApplicationMenus";
import type { Platform } from "../../commands/keymap";
import { TopToolbar } from "./TopToolbar";
import { AutomationEditor } from "./AutomationEditor";
import { EditionPalette } from "./EditionPalette";
import { EditorDockLayout } from "./EditorDockLayout";
import { GlobalViewDock } from "./GlobalViewDock";
import { InspectorDock } from "./InspectorDock";
import { ScoreWorkspace } from "./ScoreWorkspace";

export type AutomationLaneId = "tempo" | "masterVolume" | "masterPan" | "trackVolume" | "trackPan";

export interface EditorShellProps {
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
  currentTempo: number;
  onTempoChange: (bpm: number) => void;
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
  documentTabs?: ReactNode;
  onHomeOpen?: () => void;
  onAudioDockToggle?: () => void;
  audioDockOpen?: boolean;
  audioDock?: ReactNode;
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
  onMixerTrackChange: (trackId: string, patch: Partial<TrackMixerState>, phase?: MixerEditPhase) => void;
  onMixerEffectToggle: (trackId: string, effect: EffectSlotType) => void;
  onMasterFocusChange: (value: number, phase?: MixerEditPhase) => void;
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
  onExportFile: (format: ExportFormat, scale?: PngScale) => void;
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
  onApplyTuning: (trackId: string, tuning: Track["tuning"], mode: RetuneMode) => number;
  onVoiceSelect: (voiceIndex: number) => void;
  onMoveNoteToVoice: (voiceIndex: number) => void;
  onToggleMultiVoice: () => void;
  onToggleMultiTrackView: () => void;
  onDrumToggle: (mappingId: string, articulation: string) => void;
  onInsertChordVoicing: (voicing: ChordVoicing, chordName: string) => void;
  onFretboardNoteToggle: (string: number, fret: number, advance: boolean) => void;
  onTransposeRequest: (options: TransposeOptions) => number;
  onCleanupRequest: (request: CleanupRequest) => void;
}

export function EditorShell(props: EditorShellProps) {
  return (
    <main className="gpShell remasterShell" data-testid="gp-shell">
      <ApplicationMenus platform={props.platform} commandIds={new Set(props.registeredCommands.map(({ id }) => id))} onAction={props.onCommandPaletteSubmit} />
      <TopToolbar {...props} onMouseDown={preserveScoreFocus} />
      {props.documentTabs ?? <TabBar documents={props.documents} activeId={props.activeId} />}
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
      <EditorDockLayout
        palette={props.panelVisibility.palette ? <EditionPalette {...props} /> : null}
        inspector={props.panelVisibility.songInspector || props.panelVisibility.trackInspector ? <InspectorDock {...props} /> : null}
        workspace={<ScoreWorkspace documentId={props.activeId} onZoomChange={props.onZoomChange}>{props.workspace}</ScoreWorkspace>}
        audio={props.audioDock}
        audioVisible={props.audioDockOpen}
        automation={props.panelVisibility.automationView ? <AutomationEditor {...props} /> : null}
        global={props.panelVisibility.globalView ? <GlobalViewDock {...props} /> : null}
      />
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

function preserveScoreFocus(event: React.MouseEvent<HTMLElement>): void {
  if (event.button === 0 && event.target instanceof Element && event.target.closest("button")) {
    event.preventDefault();
  }
}

function TabBar({
  documents,
  activeId
}: Pick<EditorShellProps, "documents" | "activeId">) {
  return (
    <div className="tabBar" aria-label={t("editor.openDocuments")} data-testid="tab-bar">
      {documents.map((document) => (
        <span
          key={document.id}
          className={document.id === activeId ? "activeTab" : ""}
          aria-current={document.id === activeId ? "true" : undefined}
          data-testid="document-tab"
        >
          {document.locked ? "L " : ""}
          {document.title}
          {document.dirty ? " ●" : ""}
        </span>
      ))}
    </div>
  );
}
