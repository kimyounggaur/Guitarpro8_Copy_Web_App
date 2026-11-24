// Composition root: store subscriptions, controller composition, and the
// route/shell render. All editing, playback, file I/O, command-palette and
// tool-window logic now lives in src/app/controllers/* — see
// docs/ui-remaster/00-component-map.md for the extraction map this Phase 2
// refactor followed.
import { useEffect, useMemo, useRef, useState } from "react";
import { defaultCursor } from "../engine/editing/operations";
import { withEditorOverlays } from "../engine/editing/overlays";
import { layoutScore } from "../engine/layout/layoutScore";
import { SvgRenderer } from "../engine/render/SvgRenderer";
import { detectPlatform } from "../commands/keymap";
import { createDemoScore } from "../model/demoScore";
import { readScoreFile } from "../io/fileFormat";
import { discardRecoverySnapshot, listRecoverySnapshots, type RecoverySnapshot } from "../store/autosave";
import { useDocumentStore } from "../store/documentStore";
import { usePlaybackStore } from "../store/playbackStore";
import { usePreferencesStore } from "../store/preferencesStore";
import { useViewStore } from "../store/viewStore";
import { RecoveryDialog } from "../ui/overlays/RecoveryDialog";
import { UnsavedChangesDialog } from "../ui/overlays/UnsavedChangesDialog";
import { EditorShell } from "../ui/shell/EditorShell";
import { AppErrorBoundary } from "./AppErrorBoundary";
import { useCommandController } from "./controllers/useCommandController";
import { useEditorController } from "./controllers/useEditorController";
import { useFileController } from "./controllers/useFileController";
import { useGlobalShortcuts } from "./controllers/useGlobalShortcuts";
import { usePlaybackController } from "./controllers/usePlaybackController";
import { useScoreRecovery } from "./controllers/useScoreRecovery";
import { useToolWindowController } from "./controllers/useToolWindowController";

function App() {
  const { snapshots, setSnapshots, available } = useScoreRecovery();
  const rejection = useDocumentStore((state) => state.lastRejection);
  const [recoveryDismissed, setRecoveryDismissed] = useState(false);
  const [notice, setNotice] = useState("");
  const [editorKey, setEditorKey] = useState(0);

  function restore(snapshot: RecoverySnapshot) {
    try {
      const loaded = readScoreFile(snapshot.payload, { documentId: snapshot.documentId });
      useDocumentStore.getState().loadScore(loaded.score, { documentId: loaded.documentId, recovered: true });
      const view = useViewStore.getState();
      view.setSelection(null);
      view.setCursor(defaultCursor(loaded.score));
      setRecoveryDismissed(true);
      setEditorKey((key) => key + 1);
      setNotice(loaded.warnings.join(" "));
    } catch (error) {
      setRecoveryDismissed(true);
      setNotice(error instanceof Error ? error.message : "The recovery file could not be read.");
    }
  }

  async function discard(snapshot: RecoverySnapshot) {
    try {
      await discardRecoverySnapshot(snapshot.documentId, snapshot.savedAt);
      setSnapshots((records) => records?.filter((record) =>
        record.documentId !== snapshot.documentId || record.savedAt > snapshot.savedAt
      ) ?? null);
    } catch {
      setNotice("The recovery file could not be removed.");
    }
  }

  function openRecovery() {
    void listRecoverySnapshots().then((records) => {
      setSnapshots(records);
      if (records.length) {
        setRecoveryDismissed(false);
      } else {
        setNotice("No automatically saved scores are available.");
      }
    }, () => setNotice("Automatic saving is unavailable in this browser."));
  }

  const recoveryOpen = !!snapshots?.length && !recoveryDismissed;
  const startupReady = snapshots !== null && !recoveryOpen;
  const rejectionMessage = rejection?.issues.find((issue) => issue.severity === "fatal")?.message;

  return (
    <>
      <AppErrorBoundary
        key={editorKey}
        onUndo={() => useDocumentStore.getState().undo()}
        onRecover={openRecovery}
      >
        <EditorApp startupReady={startupReady} />
      </AppErrorBoundary>
      {recoveryOpen && snapshots && (
        <RecoveryDialog
          snapshots={snapshots}
          onRecover={restore}
          onDiscard={(snapshot) => void discard(snapshot)}
          onDismiss={() => setRecoveryDismissed(true)}
        />
      )}
      {(!available || notice || rejectionMessage) && (
        <aside className="autosaveUnavailable" role="status">
          {(!available ? "Automatic saving is unavailable in this browser." : null)}
          {notice && <div>{notice}</div>}
          {rejectionMessage && <div>Score change cancelled. {rejectionMessage}</div>}
        </aside>
      )}
    </>
  );
}

function EditorApp({ startupReady }: { startupReady: boolean }) {
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

  const openDemo = file.openDemo;
  const initialized = useRef(false);
  useEffect(() => {
    if (!startupReady || initialized.current) return;
    initialized.current = true;
    const state = useDocumentStore.getState();
    if (!state.dirty && state.score.tracks.length === 0) void openDemo(demoScore);
  }, [demoScore, openDemo, startupReady]);

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
    "file.new": file.handleNewFile,
    "file.open": file.handleOpenNativeFile,
    "file.save": file.handleSaveNativeFile,
    "file.saveAs": file.handleSaveNativeFileAs,
    "file.print": () => window.print(),
    "history.undo": editor.editorContext.undo,
    "history.redo": editor.editorContext.redo,
    "playback.toggle": () => editor.editorContext.togglePlayback(false),
    "view.closeOverlays": () => {
      if (!toolWindow.anyOverlayOpen) return false;
      toolWindow.closeAllOverlays();
    },
    "panels.palette": () => togglePanel("palette"),
    "panels.songInspector": () => togglePanel("songInspector"),
    "panels.trackInspector": () => togglePanel("trackInspector"),
    "panels.globalView": () => togglePanel("globalView"),
    "panels.automation": () => togglePanel("automationView"),
    "view.stylesheet": toolWindow.toggleStylesheetPanel,
    "view.multitrack": editor.handleToggleMultiTrackView,
    "view.zoomIn": () => editor.handleZoomChange(useDocumentStore.getState().score.documentSettings.zoom + 10),
    "view.zoomOut": () => editor.handleZoomChange(useDocumentStore.getState().score.documentSettings.zoom - 10),
    "track.add": () => toolWindow.setActiveTrackPanel("wizard"),
    "voice.toggleMulti": () => {
      editor.handleToggleMultiVoice();
      toolWindow.setActiveTrackPanel("voices");
    },
    "voice.edit1": () => editor.handleVoiceSelect(0),
    "voice.edit2": () => editor.handleVoiceSelect(1),
    "voice.edit3": () => editor.handleVoiceSelect(2),
    "voice.edit4": () => editor.handleVoiceSelect(3),
    "voice.move1": () => editor.handleMoveNoteToVoice(0),
    "voice.move2": () => editor.handleMoveNoteToVoice(1),
    "voice.move3": () => editor.handleMoveNoteToVoice(2),
    "voice.move4": () => editor.handleMoveNoteToVoice(3),
    "tools.chords": () => toolWindow.setActiveToolPanel("chords"),
    "tools.scales": () => toolWindow.setActiveToolPanel("scales"),
    "tools.cleanup": () => toolWindow.setActiveToolPanel("cleanup"),
    "tools.instrument": () => {
      const { score } = useDocumentStore.getState();
      const trackId = useViewStore.getState().cursor.trackId;
      if (score.tracks.find((track) => track.id === trackId)?.icon === "drums") {
        toolWindow.setActiveTrackPanel("drums");
      } else {
        toolWindow.setActiveToolPanel("instrument");
      }
    },
    "tools.commandPalette": () => toolWindow.openCommandPalette(),
    "tools.actionList": () => toolWindow.openCommandPalette("@"),
    "tools.expressionText": () => toolWindow.openCommandPalette(">")
  });

  const scoreViewportRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (startupReady && score.tracks.length > 0 && document.activeElement === document.body) {
      scoreViewportRef.current?.focus({ preventScroll: true });
    }
  }, [score.tracks.length, startupReady]);

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
      {editor.editNotice && <aside className="autosaveUnavailable" role="status">{editor.editNotice}</aside>}
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
            ref={scoreViewportRef}
            className="scoreViewport"
            tabIndex={0}
            role="application"
            aria-label="Editable score"
            onClick={editor.handleScoreClick}
            onKeyDown={(event) => {
              if (event.defaultPrevented) editor.editorContext.endFretInput();
              else editor.handleScoreKeyDown(event);
            }}
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
      {file.unsavedConfirmationOpen && <UnsavedChangesDialog onChoose={file.resolveUnsavedChoice} />}
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
