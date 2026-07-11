// Composition root: store subscriptions, controller composition, and the
// route/shell render. All editing, playback, file I/O, command-palette and
// tool-window logic now lives in src/app/controllers/* — see
// docs/ui-remaster/00-component-map.md for the extraction map this Phase 2
// refactor followed. Behavior is unchanged from the pre-refactor
// src/App.tsx.
import { useEffect, useMemo } from "react";
import { defaultCursor } from "../engine/editing/operations";
import { withEditorOverlays } from "../engine/editing/overlays";
import { layoutScore } from "../engine/layout/layoutScore";
import { SvgRenderer } from "../engine/render/SvgRenderer";
import { detectPlatform } from "../commands/keymap";
import { createDemoScore } from "../model/demoScore";
import { useDocumentStore } from "../store/documentStore";
import { usePlaybackStore } from "../store/playbackStore";
import { usePreferencesStore } from "../store/preferencesStore";
import { useViewStore } from "../store/viewStore";
import { EditorShell } from "../ui/shell/EditorShell";
import { useCommandController } from "./controllers/useCommandController";
import { useEditorController } from "./controllers/useEditorController";
import { useFileController } from "./controllers/useFileController";
import { useGlobalShortcuts } from "./controllers/useGlobalShortcuts";
import { usePlaybackController } from "./controllers/usePlaybackController";
import { useToolWindowController } from "./controllers/useToolWindowController";

function App() {
  const score = useDocumentStore((state) => state.score);
  const dirty = useDocumentStore((state) => state.dirty);
  const documents = useDocumentStore((state) => state.documents);
  const activeId = useDocumentStore((state) => state.activeId);
  const undoCount = useDocumentStore((state) => state.undoStack.length);
  const redoCount = useDocumentStore((state) => state.redoStack.length);
  const loadScore = useDocumentStore((state) => state.loadScore);
  const transact = useDocumentStore((state) => state.transact);
  const undoDocument = useDocumentStore((state) => state.undo);
  const redoDocument = useDocumentStore((state) => state.redo);
  const cursor = useViewStore((state) => state.cursor);
  const selection = useViewStore((state) => state.selection);
  const setCursor = useViewStore((state) => state.setCursor);
  const setSelection = useViewStore((state) => state.setSelection);
  const playbackStatus = usePlaybackStore((state) => state.status);
  const playbackBarIndex = usePlaybackStore((state) => state.currentBarIndex);
  const playbackTick = usePlaybackStore((state) => state.currentTick);
  const playbackTimeSec = usePlaybackStore((state) => state.currentTimeSec);
  const loopEnabled = usePlaybackStore((state) => state.loopEnabled);
  const metronomeEnabled = usePlaybackStore((state) => state.metronomeEnabled);
  const countInEnabled = usePlaybackStore((state) => state.countInEnabled);
  const speedPercent = usePlaybackStore((state) => state.speedPercent);
  const mixer = usePlaybackStore((state) => state.mixer);
  const setPlaybackStatus = usePlaybackStore((state) => state.setStatus);
  const setPlaybackPosition = usePlaybackStore((state) => state.setPosition);
  const togglePlaybackLoop = usePlaybackStore((state) => state.toggleLoop);
  const toggleMetronome = usePlaybackStore((state) => state.toggleMetronome);
  const toggleCountIn = usePlaybackStore((state) => state.toggleCountIn);
  const setPlaybackSpeedPercent = usePlaybackStore((state) => state.setSpeedPercent);
  const syncMixerTracks = usePlaybackStore((state) => state.syncMixerTracks);
  const setTrackMixer = usePlaybackStore((state) => state.setTrackMixer);
  const setMasterFocusPercent = usePlaybackStore((state) => state.setMasterFocusPercent);
  const toggleTrackEffect = usePlaybackStore((state) => state.toggleTrackEffect);
  const invertPlusMinus = usePreferencesStore((state) => state.invertPlusMinus);
  const panelVisibility = usePreferencesStore((state) => state.panelVisibility);
  const togglePanel = usePreferencesStore((state) => state.togglePanel);
  const demoScore = useMemo(() => createDemoScore(), []);
  const platform = useMemo(() => detectPlatform(), []);

  useEffect(() => {
    if (score.tracks.length === 0) {
      loadScore(demoScore);
      setCursor(defaultCursor(demoScore));
    }
  }, [demoScore, loadScore, score.tracks.length, setCursor]);

  useEffect(() => {
    syncMixerTracks(score.tracks);
  }, [score.tracks, syncMixerTracks]);

  const playback = usePlaybackController({
    score,
    cursor,
    selection,
    speedPercent,
    mixer,
    loopEnabled,
    metronomeEnabled,
    countInEnabled,
    setPlaybackStatus,
    setPlaybackPosition
  });

  const toolWindow = useToolWindowController();

  const editor = useEditorController({
    score,
    transact,
    undoDocument,
    redoDocument,
    cursor,
    selection,
    setCursor,
    setSelection,
    invertPlusMinus,
    playbackStatus,
    playbackCompilation: playback.playbackCompilation,
    startPlayback: playback.startPlayback,
    stopPlayback: playback.stopPlayback,
    seekPlayback: playback.seek,
    togglePlaybackLoop,
    toggleMetronome,
    toggleCountIn,
    speedPercent,
    setPlaybackSpeedPercent,
    setTrackMixer,
    toggleTrackEffect,
    setActiveTrackPanel: toolWindow.setActiveTrackPanel
  });

  const file = useFileController({
    score,
    activeTrackId: cursor.trackId,
    multiVoiceEdit: editor.multiVoiceEdit,
    loadScore,
    setSelection,
    setCursor,
    openFileIoPanel: toolWindow.openFileIoPanel,
    closeFileIoPanel: toolWindow.closeFileIoPanel
  });

  const command = useCommandController({
    score,
    cursor,
    selection,
    transact,
    setCursor,
    setSelection,
    editWithCursor: editor.editWithCursor,
    editorContext: editor.editorContext,
    handleZoomChange: editor.handleZoomChange,
    handleDisplayModeChange: editor.handleDisplayModeChange,
    handleVoiceSelect: editor.handleVoiceSelect,
    handleToggleMultiVoice: editor.handleToggleMultiVoice,
    handleToggleMultiTrackView: editor.handleToggleMultiTrackView,
    handleTrackDelete: editor.handleTrackDelete,
    handleNewFile: file.handleNewFile,
    handleOpenNativeFile: file.handleOpenNativeFile,
    handleSaveNativeFile: file.handleSaveNativeFile,
    handleSaveNativeFileAs: file.handleSaveNativeFileAs,
    handleImportFile: file.handleImportFile,
    handleExportFile: file.handleExportFile,
    setActiveToolPanel: toolWindow.setActiveToolPanel,
    setActiveTrackPanel: toolWindow.setActiveTrackPanel,
    openStylesheetPanel: toolWindow.openStylesheetPanel,
    openFileIoPanel: toolWindow.openFileIoPanel,
    openCommandPalette: toolWindow.openCommandPalette,
    togglePanel
  });

  useGlobalShortcuts({
    togglePanel,
    score,
    cursorTrackId: cursor.trackId,
    activeToolPanel: toolWindow.activeToolPanel,
    activeTrackPanel: toolWindow.activeTrackPanel,
    stylesheetPanelOpen: toolWindow.stylesheetPanelOpen,
    fileIoPanelOpen: toolWindow.fileIoPanelOpen,
    commandPaletteOpen: toolWindow.commandPaletteOpen,
    anyOverlayOpen: toolWindow.anyOverlayOpen,
    openCommandPalette: toolWindow.openCommandPalette,
    handleNewFile: file.handleNewFile,
    handleOpenNativeFile: file.handleOpenNativeFile,
    handleSaveNativeFile: file.handleSaveNativeFile,
    handleSaveNativeFileAs: file.handleSaveNativeFileAs,
    toggleStylesheetPanel: toolWindow.toggleStylesheetPanel,
    handleZoomChange: editor.handleZoomChange,
    closeAllOverlays: toolWindow.closeAllOverlays,
    setActiveTrackPanel: toolWindow.setActiveTrackPanel,
    setMultiTrackView: editor.setMultiTrackView,
    setMultiVoiceEdit: editor.setMultiVoiceEdit,
    handleVoiceSelect: editor.handleVoiceSelect,
    handleMoveNoteToVoice: editor.handleMoveNoteToVoice,
    setActiveToolPanel: toolWindow.setActiveToolPanel
  });

  const scoreForLayout = useMemo(() => {
    if (editor.multiTrackView) {
      return score;
    }

    const activeTrack = score.tracks.find((track) => track.id === cursor.trackId);
    return activeTrack ? { ...score, tracks: [activeTrack] } : score;
  }, [cursor.trackId, editor.multiTrackView, score]);

  const baseScene = useMemo(
    () =>
      layoutScore(scoreForLayout, {
        editingBar: { barIndex: cursor.barIndex, trackId: cursor.trackId ?? undefined },
        concertTone: score.documentSettings.concertTone,
        activeVoiceIndex: cursor.voiceIndex,
        multiVoiceEdit: editor.multiVoiceEdit
      }),
    [score.documentSettings.concertTone, scoreForLayout, cursor, editor.multiVoiceEdit]
  );
  const scene = useMemo(
    () =>
      withEditorOverlays(
        baseScene,
        cursor,
        selection,
        playbackStatus === "playing" ? playbackBarIndex : null
      ),
    [baseScene, cursor, playbackBarIndex, playbackStatus, selection]
  );

  return (
    <>
      <EditorShell
        score={score}
        cursor={cursor}
        dirty={dirty}
        undoCount={undoCount}
        redoCount={redoCount}
        documents={documents}
        activeId={activeId}
        panelVisibility={panelVisibility}
        playbackStatus={playbackStatus}
        playbackBarIndex={playbackBarIndex}
        playbackTick={playbackTick}
        playbackTimeSec={playbackTimeSec}
        loopEnabled={loopEnabled}
        metronomeEnabled={metronomeEnabled}
        countInEnabled={countInEnabled}
        speedPercent={speedPercent}
        mixer={mixer}
        activeToolPanel={toolWindow.activeToolPanel}
        activeTrackPanel={toolWindow.activeTrackPanel}
        stylesheetPanelOpen={toolWindow.stylesheetPanelOpen}
        fileIoPanelOpen={toolWindow.fileIoPanelOpen}
        fileIoStatus={file.fileIoStatus}
        commandPaletteOpen={toolWindow.commandPaletteOpen}
        commandPaletteInitialValue={toolWindow.commandPaletteInitialValue}
        platform={platform}
        registeredCommands={command.registeredCommands}
        multiVoiceEdit={editor.multiVoiceEdit}
        multiTrackView={editor.multiTrackView}
        dispatchCommand={command.dispatchEditorCommand}
        togglePanel={togglePanel}
        onSongInfoChange={editor.handleSongInfoChange}
        onTrackChange={editor.handleTrackChange}
        onTrackSystemPatch={editor.handleTrackSystemPatch}
        onTrackTranspositionChange={editor.handleTrackTranspositionChange}
        onConcertToneToggle={editor.handleConcertToneToggle}
        onTrackDelete={editor.handleTrackDelete}
        onTrackMove={editor.handleTrackMove}
        onGlobalJump={editor.handleGlobalJump}
        onMixerTrackChange={editor.handleMixerTrackChange}
        onMixerEffectToggle={editor.handleMixerEffectToggle}
        onMasterFocusChange={setMasterFocusPercent}
        onAutomationPointSet={editor.handleAutomationPointSet}
        onAutomationPointRemove={editor.handleAutomationPointRemove}
        onAutomationTransitionToggle={editor.handleAutomationTransitionToggle}
        onToolOpen={toolWindow.setActiveToolPanel}
        onToolClose={toolWindow.closeToolPanel}
        onTrackPanelOpen={toolWindow.setActiveTrackPanel}
        onTrackPanelClose={toolWindow.closeTrackPanel}
        onFileIoPanelOpen={toolWindow.openFileIoPanel}
        onFileIoPanelClose={toolWindow.closeFileIoPanel}
        onNewFile={file.handleNewFile}
        onOpenNativeFile={() => void file.handleOpenNativeFile()}
        onSaveNativeFile={() => void file.handleSaveNativeFile()}
        onSaveNativeFileAs={() => void file.handleSaveNativeFileAs()}
        onImportFile={file.handleImportFile}
        onExportFile={(format) => void file.handleExportFile(format)}
        onStylesheetPanelOpen={toolWindow.openStylesheetPanel}
        onStylesheetPanelClose={toolWindow.closeStylesheetPanel}
        onStylesheetChange={editor.handleStylesheetChange}
        onStylesheetPreset={editor.handleStylesheetPreset}
        onDisplayModeChange={editor.handleDisplayModeChange}
        onZoomChange={editor.handleZoomChange}
        onCommandPaletteOpen={toolWindow.openCommandPalette}
        onCommandPaletteClose={toolWindow.closeCommandPalette}
        onCommandPaletteSubmit={command.handleCommandPaletteSubmit}
        onCreateTrack={editor.handleCreateTrack}
        onApplyTuning={editor.handleApplyTuning}
        onVoiceSelect={editor.handleVoiceSelect}
        onMoveNoteToVoice={editor.handleMoveNoteToVoice}
        onToggleMultiVoice={editor.handleToggleMultiVoice}
        onToggleMultiTrackView={editor.handleToggleMultiTrackView}
        onDrumToggle={editor.handleDrumToggle}
        onInsertChordVoicing={editor.handleInsertChordVoicing}
        onFretboardNoteToggle={editor.handleFretboardNoteToggle}
        onTransposeRequest={editor.handleTransposeRequest}
        onCleanupRequest={editor.handleCleanupRequest}
        workspace={
          <div
            className="scoreViewport"
            tabIndex={0}
            role="application"
            aria-label="Editable score"
            onClick={editor.handleScoreClick}
            onKeyDown={editor.handleScoreKeyDown}
            onDragOver={file.handleScoreDragOver}
            onDrop={(event) => void file.handleScoreDrop(event)}
          >
            <SvgRenderer
              scene={scene}
              displayMode={score.documentSettings.displayMode}
              zoom={score.documentSettings.zoom}
            />
          </div>
        }
      />
      <input
        ref={file.fileInputRef}
        type="file"
        className="hiddenFileInput"
        onChange={(event) => void file.handleFileInputChange(event)}
      />
    </>
  );
}

export default App;
