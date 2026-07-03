import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { ensureDemoCommandsRegistered } from "./commands/demoCommands";
import {
  ensureEditingCommandsRegistered,
  type EditorCommandContext
} from "./commands/editingCommands";
import {
  handleEditorKeyDown,
  type FretInputBuffer
} from "./commands/editorKeymap";
import { executeCommand, getAllCommands } from "./commands/registry";
import { detectPlatform } from "./commands/keymap";
import { findMenuAction, paletteEntryByPrefix, parsePaletteInput } from "./commands/paletteCommands";
import { compilePlayback, type NoteEvent, type PlaybackCompilation } from "./engine/audio/compile";
import { PlaybackScheduler } from "./engine/audio/scheduler";
import type { EffectSlotType, TrackMixerState } from "./engine/audio/mixer";
import { beatDurationTicks, barTheoreticalTicks } from "./model/derive";
import { cursorFromHit } from "./engine/editing/hitTest";
import {
  changeDurationAtCursor,
  cloneCurrentBar,
  copyPreviousBeat,
  cycleKeySignatureAtCursor,
  cycleTimeSignatureAtCursor,
  defaultCursor,
  deleteBarAtCursor,
  deleteBeatAtCursor,
  deleteNoteAtCursor,
  inputFret,
  inputStandardString,
  insertBarAtCursor,
  insertBeatAtCursor,
  moveCursor,
  moveNoteString,
  moveRightWithScoreMutation,
  normaliseCursor,
  replaceTrackBars,
  setAccidentalAtCursor,
  setDynamicAtCursor,
  setDurationAtCursor,
  setDotsAtCursor,
  shouldMutateOnMoveRight,
  tieCurrentNoteToNext,
  toggleBarSymbolAtCursor,
  toggleBeatEffectAtCursor,
  toggleNoteEffectAtCursor,
  toggleRestAtCursor,
  toggleTripletAtCursor,
  transposeNoteAtCursor
} from "./engine/editing/operations";
import { withEditorOverlays } from "./engine/editing/overlays";
import type { ClipboardPayload, CursorMove, CursorPosition, SelectionRange } from "./engine/editing/types";
import { layoutScore } from "./engine/layout/layoutScore";
import { transposeScore, type TransposeOptions } from "./engine/tools/transpose";
import { unrollScore } from "./engine/unroll/unrollScore";
import { exportAsciiTab, importAsciiTab } from "./io/asciiTab";
import { defaultExportName } from "./io/exportNames";
import { exportMidi, importMidi } from "./io/midi";
import { exportMusicXml, importMusicXml } from "./io/musicXml";
import { parseNativeScore, serializeNativeScore } from "./io/nativeScore";
import { sceneToPdf } from "./io/pdfExport";
import { sceneFirstPageSvg, sceneToSvgDocument } from "./io/vectorExport";
import { createBar, createBeat, createEmptyScore, createMasterBar, createNote, createTrack } from "./model/factory";
import { DRUM_MAPPINGS, instrumentById, retuneTrack, type RetuneMode } from "./model/instruments";
import { applyStylePreset, normalizeStylesheet } from "./model/stylesheet";
import type { ChordVoicing } from "./model/chords";
import { TICKS_PER_QUARTER, type Automation, type AutomationScope, type AutomationType, type Beat, type BeatDuration, type DisplayMode, type Dynamic, type Score, type SongInfo, type Stylesheet, type StylesheetPresetName, type Track } from "./model/types";
import { SvgRenderer } from "./engine/render/SvgRenderer";
import { createDemoScore } from "./model/demoScore";
import { useDocumentStore } from "./store/documentStore";
import { usePlaybackStore } from "./store/playbackStore";
import { usePreferencesStore } from "./store/preferencesStore";
import { useViewStore } from "./store/viewStore";
import { EditorShell, type AutomationLaneId } from "./ui/shell/EditorShell";
import type { CommandPaletteResult } from "./ui/shell/CommandPalette";
import type { ExportFormat, ImportFormat } from "./ui/shell/FileIoPanel";
import type { CleanupRequest, ToolPanelId } from "./ui/shell/ToolPanels";
import type { TrackCreateOptions, TrackPanelId } from "./ui/shell/TrackSystemPanels";

interface BrowserFileHandle {
  getFile: () => Promise<File>;
  createWritable: () => Promise<{ write: (blob: Blob) => Promise<void>; close: () => Promise<void> }>;
}

interface BrowserFilePickerWindow extends Window {
  showOpenFilePicker?: (options?: unknown) => Promise<BrowserFileHandle[]>;
  showSaveFilePicker?: (options?: unknown) => Promise<BrowserFileHandle>;
}

type PendingFileLoad =
  | { kind: "native" }
  | { kind: "import"; format: ImportFormat };

function App() {
  ensureDemoCommandsRegistered();
  ensureEditingCommandsRegistered();

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
  const [activeToolPanel, setActiveToolPanel] = useState<ToolPanelId | null>(null);
  const [activeTrackPanel, setActiveTrackPanel] = useState<TrackPanelId | null>(null);
  const [stylesheetPanelOpen, setStylesheetPanelOpen] = useState(false);
  const [fileIoPanelOpen, setFileIoPanelOpen] = useState(false);
  const [fileIoStatus, setFileIoStatus] = useState("Native .gp, ASCII, MusicXML, MIDI, SVG, PNG, and PDF are ready.");
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandPaletteInitialValue, setCommandPaletteInitialValue] = useState("");
  const [multiVoiceEdit, setMultiVoiceEdit] = useState(false);
  const [multiTrackView, setMultiTrackView] = useState(true);
  const platform = useMemo(() => detectPlatform(), []);
  const fretBufferRef = useRef<FretInputBuffer>({ digits: "", timer: null });
  const clipboardRef = useRef<ClipboardPayload | null>(null);
  const schedulerRef = useRef<PlaybackScheduler | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingFileLoadRef = useRef<PendingFileLoad | null>(null);
  const nativeFileHandleRef = useRef<BrowserFileHandle | null>(null);

  useEffect(() => {
    if (score.tracks.length === 0) {
      loadScore(demoScore);
      setCursor(defaultCursor(demoScore));
    }
  }, [demoScore, loadScore, score.tracks.length, setCursor]);

  useEffect(() => {
    return () => schedulerRef.current?.stop("manual");
  }, []);

  useEffect(() => {
    syncMixerTracks(score.tracks);
  }, [score.tracks, syncMixerTracks]);

  const playbackCompilation = useMemo(
    () =>
      compilePlayback(
        score,
        unrollScore(score),
        {
          mode: "relative",
          percent: speedPercent
        },
        mixer,
        cursor.trackId
      ),
    [score, speedPercent, mixer, cursor.trackId]
  );

  const scoreForLayout = useMemo(() => {
    if (multiTrackView) {
      return score;
    }

    const activeTrack = score.tracks.find((track) => track.id === cursor.trackId);
    return activeTrack ? { ...score, tracks: [activeTrack] } : score;
  }, [cursor.trackId, multiTrackView, score]);

  const baseScene = useMemo(
    () =>
      layoutScore(scoreForLayout, {
        editingBar: { barIndex: cursor.barIndex, trackId: cursor.trackId ?? undefined },
        concertTone: score.documentSettings.concertTone,
        activeVoiceIndex: cursor.voiceIndex,
        multiVoiceEdit
      }),
    [score.documentSettings.concertTone, scoreForLayout, cursor, multiVoiceEdit]
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

  useEffect(() => {
    function handlePanelShortcuts(event: KeyboardEvent) {
      const panelByKey = {
        F2: "palette",
        F5: "songInspector",
        F6: "trackInspector",
        F8: "globalView",
        F10: "automationView"
      } as const;
      const panel = panelByKey[event.key as keyof typeof panelByKey];

      if (panel) {
        event.preventDefault();
        togglePanel(panel);
      }
    }

    window.addEventListener("keydown", handlePanelShortcuts);
    return () => window.removeEventListener("keydown", handlePanelShortcuts);
  }, [togglePanel]);

  useEffect(() => {
    function handleToolShortcuts(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const editingText =
        target?.tagName === "INPUT" ||
        target?.tagName === "SELECT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      const ctrl = event.ctrlKey || event.metaKey;

      if (ctrl && event.altKey && event.key.toLowerCase() === "e") {
        event.preventDefault();
        openCommandPalette("@");
        return;
      }

      if (ctrl && event.shiftKey && event.key.toLowerCase() === "e") {
        event.preventDefault();
        openCommandPalette(">");
        return;
      }

      if (ctrl && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "e") {
        event.preventDefault();
        openCommandPalette("");
        return;
      }

      if (ctrl && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "n") {
        event.preventDefault();
        handleNewFile();
        return;
      }

      if (ctrl && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "o") {
        event.preventDefault();
        void handleOpenNativeFile();
        return;
      }

      if (ctrl && event.shiftKey && !event.altKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void handleSaveNativeFileAs();
        return;
      }

      if (ctrl && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void handleSaveNativeFile();
        return;
      }

      if (event.key === "F7") {
        event.preventDefault();
        setStylesheetPanelOpen((value) => !value);
        return;
      }

      if (ctrl && !event.altKey && (event.key === "+" || event.key === "=")) {
        event.preventDefault();
        handleZoomChange(score.documentSettings.zoom + 10);
        return;
      }

      if (ctrl && !event.altKey && event.key === "-") {
        event.preventDefault();
        handleZoomChange(score.documentSettings.zoom - 10);
        return;
      }

      if (editingText) {
        return;
      }

      if (event.key === "Escape" && (activeToolPanel || activeTrackPanel || stylesheetPanelOpen || fileIoPanelOpen || commandPaletteOpen)) {
        event.preventDefault();
        setActiveToolPanel(null);
        setActiveTrackPanel(null);
        setStylesheetPanelOpen(false);
        setFileIoPanelOpen(false);
        setCommandPaletteOpen(false);
        return;
      }

      if (ctrl && event.shiftKey && event.key === "Insert") {
        event.preventDefault();
        setActiveTrackPanel("wizard");
        return;
      }

      if (event.key === "F3") {
        event.preventDefault();
        setMultiTrackView((value) => !value);
        return;
      }

      if (ctrl && event.key.toLowerCase() === "m") {
        event.preventDefault();
        setMultiVoiceEdit((value) => !value);
        setActiveTrackPanel("voices");
        return;
      }

      if (ctrl && /^[1-4]$/.test(event.key)) {
        event.preventDefault();
        handleVoiceSelect(Number(event.key) - 1);
        return;
      }

      if (event.altKey && /^[1-4]$/.test(event.key)) {
        event.preventDefault();
        handleMoveNoteToVoice(Number(event.key) - 1);
        return;
      }

      if (!ctrl && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "a") {
        event.preventDefault();
        setActiveToolPanel("chords");
        return;
      }

      if (!ctrl && event.shiftKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        setActiveToolPanel("scales");
        return;
      }

      if (ctrl && event.key === "F6") {
        event.preventDefault();
        const activeTrack = score.tracks.find((track) => track.id === cursor.trackId);
        if (activeTrack?.icon === "drums") {
          setActiveTrackPanel("drums");
        } else {
          setActiveToolPanel("instrument");
        }
        return;
      }

      if (event.key === "F4") {
        event.preventDefault();
        setActiveToolPanel("cleanup");
      }
    }

    window.addEventListener("keydown", handleToolShortcuts, { capture: true });
    return () => window.removeEventListener("keydown", handleToolShortcuts, { capture: true });
  }, [activeToolPanel, activeTrackPanel, commandPaletteOpen, cursor.trackId, fileIoPanelOpen, score.documentSettings.zoom, score.tracks, stylesheetPanelOpen]);

  const editorContext = useMemo<EditorCommandContext>(
    () => ({
      staffKind: cursor.staffKind,
      playbackStatus,
      moveCursor: (move, extendSelection) => {
        if (move === "right" && shouldMutateOnMoveRight(score, cursor)) {
          let nextCursor = cursor;
          const nextScore = transact("Move right and extend score", (draft) => {
            nextCursor = moveRightWithScoreMutation(draft, cursor);
          });
          updateCursorSelection(normaliseCursor(nextScore, nextCursor), Boolean(extendSelection));
          return;
        }

        updateCursorSelection(moveCursor(score, cursor, move), Boolean(extendSelection));
      },
      moveBarSelection: (direction) => {
        const next = normaliseCursor(score, {
          ...cursor,
          barIndex: cursor.barIndex + direction,
          beatIndex: 0
        });
        setSelection({ anchor: selection?.anchor ?? cursor, head: next });
        setCursor(next);
      },
      toggleStaffKind: () => {
        if (fretBufferRef.current.timer !== null) {
          window.clearTimeout(fretBufferRef.current.timer);
        }
        fretBufferRef.current = { digits: "", timer: null };
        setSelection(null);
        setCursor({
          ...cursor,
          staffKind: cursor.staffKind === "tab" ? "standard" : "tab"
        });
      },
      inputFret: (value) => {
        editWithCursor("Input note", (draft) =>
          cursor.staffKind === "tab"
            ? inputFret(draft, cursor, value)
            : inputStandardString(draft, cursor, value)
        );
      },
      inputStandardString: (stringNumber) => {
        editWithCursor("Input standard note", (draft) =>
          inputStandardString(draft, cursor, stringNumber)
        );
      },
      changeDuration: (direction) => {
        const effective = invertPlusMinus
          ? direction === "longer"
            ? "shorter"
            : "longer"
          : direction;
        editWithCursor("Change duration", (draft) =>
          changeDurationAtCursor(draft, cursor, effective)
        );
      },
      setDuration: (duration) =>
        editWithCursor("Set duration", (draft) => setDurationAtCursor(draft, cursor, duration)),
      toggleRest: () => editWithCursor("Set rest", (draft) => toggleRestAtCursor(draft, cursor)),
      toggleTie: (wholeBeat) =>
        editWithCursor("Tie note", (draft) => tieCurrentNoteToNext(draft, cursor, wholeBeat)),
      setDots: (dots) => editWithCursor("Set dots", (draft) => setDotsAtCursor(draft, cursor, dots)),
      toggleTriplet: () =>
        editWithCursor("Toggle triplet", (draft) => toggleTripletAtCursor(draft, cursor)),
      cycleTimeSignature: () =>
        editWithCursor("Cycle time signature", (draft) =>
          cycleTimeSignatureAtCursor(draft, cursor)
        ),
      cycleKeySignature: () =>
        editWithCursor("Cycle key signature", (draft) =>
          cycleKeySignatureAtCursor(draft, cursor)
        ),
      toggleBarSymbol: (symbol) =>
        editWithCursor("Toggle bar symbol", (draft) =>
          toggleBarSymbolAtCursor(draft, cursor, symbol)
        ),
      setDynamic: (dynamic) =>
        editWithCursor("Set dynamic", (draft) => setDynamicAtCursor(draft, cursor, dynamic)),
      toggleNoteEffect: (effect) =>
        editWithCursor("Toggle note effect", (draft) =>
          toggleNoteEffectAtCursor(draft, cursor, effect)
        ),
      toggleBeatEffect: (effect) =>
        editWithCursor("Toggle beat effect", (draft) =>
          toggleBeatEffectAtCursor(draft, cursor, effect)
        ),
      togglePlayback: (fromStart) => {
        if (playbackStatus === "playing" && !fromStart) {
          stopPlayback();
          return;
        }

        void startPlayback(fromStart ? 0 : playbackCompilation.secondAtBar(cursor.barIndex));
      },
      stopPlayback,
      movePlaybackBar: (direction) => {
        const next = normaliseCursor(score, {
          ...cursor,
          barIndex: cursor.barIndex + direction,
          beatIndex: 0
        });
        setCursor(next);

        if (playbackStatus === "playing") {
          schedulerRef.current?.seek(playbackCompilation.secondAtBar(next.barIndex));
        }
      },
      stepPlaybackBeat: (direction) => {
        const next = moveCursor(score, cursor, direction === 1 ? "right" : "left");
        setCursor(next);

        if (playbackStatus === "playing") {
          schedulerRef.current?.seek(playbackCompilation.secondAtBar(next.barIndex));
        }
      },
      toggleLoop: togglePlaybackLoop,
      toggleMetronome,
      toggleCountIn,
      changePlaybackSpeed: (direction) => {
        setPlaybackSpeedPercent(speedPercent + direction * 5);
      },
      deleteNote: () => editWithCursor("Delete note", (draft) => deleteNoteAtCursor(draft, cursor)),
      deleteBeat: () => editWithCursor("Delete beat", (draft) => deleteBeatAtCursor(draft, cursor)),
      deleteBar: () => editWithCursor("Delete bar", (draft) => deleteBarAtCursor(draft, cursor)),
      insertBeat: () => editWithCursor("Insert beat", (draft) => insertBeatAtCursor(draft, cursor)),
      insertBar: () => editWithCursor("Insert bar", (draft) => insertBarAtCursor(draft, cursor)),
      copyPreviousBeat: () =>
        editWithCursor("Copy previous beat", (draft) => copyPreviousBeat(draft, cursor)),
      moveNoteString: (direction) =>
        editWithCursor("Move note string", (draft) => moveNoteString(draft, cursor, direction)),
      transposeNote: (semitones) =>
        editWithCursor("Transpose note", (draft) => transposeNoteAtCursor(draft, cursor, semitones)),
      setAccidental: (accidental) =>
        editWithCursor("Set accidental", (draft) =>
          setAccidentalAtCursor(draft, cursor, accidental)
        ),
      selectAllTrack: () => {
        const anchor = normaliseCursor(score, { ...cursor, barIndex: 0, beatIndex: 0 });
        const head = normaliseCursor(score, {
          ...cursor,
          barIndex: Math.max(0, score.masterBars.length - 1),
          beatIndex: 0
        });
        setSelection({ anchor, head });
        setCursor(head);
      },
      copy: (mode, cut) => copySelection(mode, cut),
      paste: (special) => pasteClipboard(special),
      undo: () => {
        const nextScore = undoDocument();
        setCursor(normaliseCursor(nextScore, cursor));
      },
      redo: () => {
        const nextScore = redoDocument();
        setCursor(normaliseCursor(nextScore, cursor));
      }
    }),
    [
      clipboardRef,
      cursor,
      invertPlusMinus,
      playbackCompilation,
      playbackStatus,
      redoDocument,
      score,
      selection,
      setPlaybackSpeedPercent,
      setCursor,
      setSelection,
      speedPercent,
      transact,
      toggleCountIn,
      toggleMetronome,
      togglePlaybackLoop,
      undoDocument
    ]
  );

  function dispatchEditorCommand(commandId: string): void {
    executeCommand(commandId, editorContext);
  }

  function openCommandPalette(initialValue = ""): void {
    setCommandPaletteInitialValue(initialValue);
    setCommandPaletteOpen(true);
  }

  function handleNewFile(): void {
    const nextScore = createEmptyScore();
    nextScore.tracks.push(createTrack(undefined, nextScore.masterBars.length));
    nativeFileHandleRef.current = null;
    loadScore(nextScore);
    setSelection(null);
    setCursor(defaultCursor(nextScore));
    setFileIoStatus("Created a new untitled score.");
    setFileIoPanelOpen(false);
  }

  async function handleOpenNativeFile(): Promise<void> {
    const picker = (window as BrowserFilePickerWindow).showOpenFilePicker;

    if (picker) {
      try {
        const [handle] = await picker({
          multiple: false,
          types: [
            {
              description: "GuitarPro8 Copy score",
              accept: { "application/json": [".gp", ".gp8", ".json"] }
            }
          ]
        });

        if (handle) {
          await loadFileIntoScore(await handle.getFile(), { kind: "native" }, handle);
        }
      } catch (error) {
        if (!isAbortError(error)) {
          setFileIoStatus(errorMessage(error));
        }
      }
      return;
    }

    requestFileLoad({ kind: "native" });
  }

  async function handleSaveNativeFile(): Promise<void> {
    if (!nativeFileHandleRef.current) {
      await handleSaveNativeFileAs();
      return;
    }

    try {
      await writeNativeScore(nativeFileHandleRef.current);
      setFileIoStatus(`Saved ${score.meta.title || "Untitled Score"} as native .gp.`);
    } catch (error) {
      setFileIoStatus(errorMessage(error));
    }
  }

  async function handleSaveNativeFileAs(): Promise<void> {
    const picker = (window as BrowserFilePickerWindow).showSaveFilePicker;

    if (picker) {
      try {
        const handle = await picker({
          suggestedName: defaultExportName(score, ".gp"),
          types: [
            {
              description: "GuitarPro8 Copy score",
              accept: { "application/json": [".gp", ".gp8", ".json"] }
            }
          ]
        });
        nativeFileHandleRef.current = handle;
        await writeNativeScore(handle);
        setFileIoStatus(`Saved ${score.meta.title || "Untitled Score"} as native .gp.`);
      } catch (error) {
        if (!isAbortError(error)) {
          setFileIoStatus(errorMessage(error));
        }
      }
      return;
    }

    downloadBlob(
      new Blob([serializeNativeScore(score)], { type: "application/json" }),
      defaultExportName(score, ".gp")
    );
    setFileIoStatus("Downloaded a native .gp score.");
  }

  function handleImportFile(format: ImportFormat): void {
    requestFileLoad({ kind: "import", format });
  }

  async function handleExportFile(format: ExportFormat): Promise<void> {
    try {
      if (format === "native") {
        await handleSaveNativeFileAs();
        return;
      }

      if (format === "ascii") {
        downloadBlob(
          new Blob([exportAsciiTab(score, cursor.trackId ?? undefined)], { type: "text/plain" }),
          defaultExportName(score, ".txt")
        );
        setFileIoStatus("Exported the active track as ASCII tab.");
        return;
      }

      if (format === "musicxml") {
        downloadBlob(
          new Blob([exportMusicXml(score)], { type: "application/vnd.recordare.musicxml+xml" }),
          defaultExportName(score, ".musicxml")
        );
        setFileIoStatus("Exported the full score as MusicXML.");
        return;
      }

      if (format === "midi") {
        downloadBlob(
          new Blob([bytesToArrayBuffer(exportMidi(score))], { type: "audio/midi" }),
          defaultExportName(score, ".mid")
        );
        setFileIoStatus("Exported playback data as MIDI.");
        return;
      }

      const exportScene = layoutScore(score, {
        concertTone: score.documentSettings.concertTone,
        multiVoiceEdit
      });

      if (format === "svg") {
        downloadBlob(
          new Blob([sceneToSvgDocument(exportScene)], { type: "image/svg+xml" }),
          defaultExportName(score, ".svg")
        );
        setFileIoStatus("Exported the complete score as SVG.");
        return;
      }

      if (format === "pdf") {
        downloadBlob(
          new Blob([bytesToArrayBuffer(sceneToPdf(exportScene))], { type: "application/pdf" }),
          defaultExportName(score, ".pdf")
        );
        setFileIoStatus("Exported the complete score as PDF.");
        return;
      }

      const firstPage = exportScene.pages[0];

      if (!firstPage) {
        throw new Error("The score has no rendered page to export.");
      }

      const pngBlob = await svgToPngBlob(
        sceneFirstPageSvg(exportScene),
        firstPage.width,
        firstPage.height
      );
      downloadBlob(pngBlob, defaultExportName(score, ".png"));
      setFileIoStatus("Exported the first page as PNG.");
    } catch (error) {
      setFileIoStatus(errorMessage(error));
    }
  }

  async function handleFileInputChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.currentTarget.files?.[0] ?? null;
    const pending = pendingFileLoadRef.current;
    pendingFileLoadRef.current = null;
    event.currentTarget.value = "";

    if (!file || !pending) {
      return;
    }

    await loadFileIntoScore(file, pending);
  }

  async function handleScoreDrop(event: DragEvent<HTMLDivElement>): Promise<void> {
    event.preventDefault();
    const file = event.dataTransfer.files[0];

    if (!file) {
      return;
    }

    const pending = pendingLoadForFileName(file.name);

    if (!pending) {
      setFileIoStatus("Drop a .gp, .txt, .tab, .musicxml, .xml, .mid, or .midi file.");
      setFileIoPanelOpen(true);
      return;
    }

    setFileIoPanelOpen(true);
    await loadFileIntoScore(file, pending);
  }

  function handleScoreDragOver(event: DragEvent<HTMLDivElement>): void {
    if (event.dataTransfer.types.includes("Files")) {
      event.preventDefault();
    }
  }

  function requestFileLoad(pending: PendingFileLoad): void {
    pendingFileLoadRef.current = pending;
    setFileIoStatus(`Choose a ${pendingFileLabel(pending)} file.`);

    if (!fileInputRef.current) {
      setFileIoStatus("The browser file input is not ready yet.");
      return;
    }

    fileInputRef.current.accept = acceptForPending(pending);
    fileInputRef.current.click();
  }

  async function loadFileIntoScore(
    file: File,
    pending: PendingFileLoad,
    handle: BrowserFileHandle | null = null
  ): Promise<void> {
    try {
      const nextScore =
        pending.kind === "native"
          ? parseNativeScore(await file.text())
          : pending.format === "ascii"
            ? importAsciiTab(await file.text())
            : pending.format === "musicxml"
              ? importMusicXml(await file.text())
              : importMidi(new Uint8Array(await file.arrayBuffer()));

      nativeFileHandleRef.current = pending.kind === "native" ? handle : null;
      loadScore(nextScore);
      setSelection(null);
      setCursor(defaultCursor(nextScore));
      setFileIoStatus(`Loaded ${file.name} as ${pendingFileLabel(pending)}.`);
      setFileIoPanelOpen(false);
    } catch (error) {
      setFileIoStatus(errorMessage(error));
      setFileIoPanelOpen(true);
    }
  }

  async function writeNativeScore(handle: BrowserFileHandle): Promise<void> {
    const writable = await handle.createWritable();
    await writable.write(new Blob([serializeNativeScore(score)], { type: "application/json" }));
    await writable.close();
  }

  function importFromPalette(query: string): CommandPaletteResult {
    const format = importFormatFromText(query);

    if (format === "native") {
      void handleOpenNativeFile();
      return { handled: true, message: "Open native score" };
    }

    if (!format) {
      setFileIoPanelOpen(true);
      return { handled: true, message: "Choose an import format." };
    }

    handleImportFile(format);
    return { handled: true, message: `Import ${formatLabel(format)}` };
  }

  function exportFromPalette(query: string): CommandPaletteResult {
    const format = exportFormatFromText(query);

    if (!format) {
      setFileIoPanelOpen(true);
      return { handled: true, message: "Choose an export format." };
    }

    void handleExportFile(format);
    return { handled: true, message: `Export ${formatLabel(format)}` };
  }

  function handleCommandPaletteSubmit(input: string): CommandPaletteResult {
    const parsed = parsePaletteInput(input);

    if (!input.trim() || input.trim() === "?") {
      return { handled: false, message: "Type a prefix or choose a command.", keepOpen: true };
    }

    if (parsed.mode === "action") {
      return runMenuAction(parsed.args);
    }

    if (parsed.mode === "expression") {
      return runExpressionText(parsed.args);
    }

    if (parsed.mode === "section") {
      return jumpToSection(parsed.args);
    }

    if (parsed.mode === "bar") {
      return jumpToBar(parsed.args);
    }

    if (parsed.mode === "unset") {
      return unsetPaletteEffect(parsed.args);
    }

    const timeSignature = /^(\d{1,2})\/(1|2|4|8|16|32|64)$/.exec(input.trim());

    if (timeSignature) {
      return setTimeSignatureFromPalette(Number(timeSignature[1]), Number(timeSignature[2]) as BeatDuration);
    }

    const entry = paletteEntryByPrefix(parsed.prefix);

    if (entry?.kind === "quick") {
      return runQuickPaletteCommand(entry.commandId ?? entry.prefix);
    }

    if (parsed.prefix === "add-bar" || parsed.prefix === "insert-bars") {
      return addBarsFromPalette(parsed.args, parsed.prefix === "insert-bars");
    }

    if (parsed.prefix === "x") {
      return repeatBarsFromPalette(parsed.args);
    }

    if (parsed.prefix === "pickstroke" || parsed.prefix === "brush" || parsed.prefix === "arpeggio" || parsed.prefix === "wah" || parsed.prefix === "slap-pop") {
      return applyPatternFromPalette(parsed.prefix, parsed.args);
    }

    if (parsed.prefix === "voice") {
      const voice = Number(parsed.args);

      if (voice >= 1 && voice <= 4) {
        handleVoiceSelect(voice - 1);
        return { handled: true, message: `Voice ${voice}` };
      }
    }

    if (parsed.prefix === "import") {
      return importFromPalette(parsed.args);
    }

    if (parsed.prefix === "export") {
      return exportFromPalette(parsed.args);
    }

    if (parsed.prefix === "view") {
      return changeViewFromPalette(parsed.args);
    }

    if (parsed.prefix === "zoom") {
      return zoomFromPalette(parsed.args);
    }

    const command = getAllCommands(editorContext).find(
      (candidate) =>
        candidate.id === input.trim() ||
        candidate.label.toLowerCase() === input.trim().toLowerCase()
    );

    if (command) {
      dispatchEditorCommand(command.id);
      return { handled: true, message: command.label };
    }

    return { handled: false, message: `No command matched "${input}".`, keepOpen: true };
  }

  function runMenuAction(query: string): CommandPaletteResult {
    const action = findMenuAction(query);

    if (!action) {
      return { handled: false, message: "Action not found.", keepOpen: true };
    }

    if (action.commandId) {
      try {
        dispatchEditorCommand(action.commandId);
        return { handled: true, message: action.label };
      } catch {
        return { handled: false, message: `${action.label} is not available here.`, keepOpen: true };
      }
    }

    if (action.paletteInput) {
      return handleCommandPaletteSubmit(action.paletteInput);
    }

    return runAppAction(action.appAction ?? action.id, action.label);
  }

  function runAppAction(action: string, label = action): CommandPaletteResult {
    switch (action) {
      case "file.new":
        handleNewFile();
        return { handled: true, message: label };
      case "file.open":
        void handleOpenNativeFile();
        return { handled: true, message: label };
      case "file.save":
        void handleSaveNativeFile();
        return { handled: true, message: label };
      case "file.saveAs":
        void handleSaveNativeFileAs();
        return { handled: true, message: label };
      case "file.import":
        setFileIoPanelOpen(true);
        return { handled: true, message: "Import" };
      case "file.import.ascii":
        handleImportFile("ascii");
        return { handled: true, message: "Import ASCII" };
      case "file.import.musicxml":
        handleImportFile("musicxml");
        return { handled: true, message: "Import MusicXML" };
      case "file.import.midi":
        handleImportFile("midi");
        return { handled: true, message: "Import MIDI" };
      case "file.export":
        setFileIoPanelOpen(true);
        return { handled: true, message: "Export" };
      case "file.export.native":
        void handleExportFile("native");
        return { handled: true, message: "Export native" };
      case "file.export.ascii":
        void handleExportFile("ascii");
        return { handled: true, message: "Export ASCII" };
      case "file.export.musicxml":
        void handleExportFile("musicxml");
        return { handled: true, message: "Export MusicXML" };
      case "file.export.midi":
        void handleExportFile("midi");
        return { handled: true, message: "Export MIDI" };
      case "file.export.svg":
        void handleExportFile("svg");
        return { handled: true, message: "Export SVG" };
      case "file.export.png":
        void handleExportFile("png");
        return { handled: true, message: "Export PNG" };
      case "file.export.pdf":
        void handleExportFile("pdf");
        return { handled: true, message: "Export PDF" };
      case "file.print":
        window.print();
        return { handled: true, message: "Print" };
      case "layout.forceBreak": {
        const nextScore = transact("Force break line", (draft) => {
          const masterBar = draft.masterBars[cursor.barIndex];
          if (masterBar) {
            masterBar.layout.forcedBreak = !masterBar.layout.forcedBreak;
            masterBar.layout.preventBreak = false;
          }
        });
        setCursor(normaliseCursor(nextScore, cursor));
        return { handled: true, message: label };
      }
      case "layout.preventBreak": {
        const nextScore = transact("Prevent break line", (draft) => {
          const masterBar = draft.masterBars[cursor.barIndex];
          if (masterBar) {
            masterBar.layout.preventBreak = !masterBar.layout.preventBreak;
            masterBar.layout.forcedBreak = false;
          }
        });
        setCursor(normaliseCursor(nextScore, cursor));
        return { handled: true, message: label };
      }
      case "tools.timer": {
        const nextScore = transact("Toggle timer", (draft) => {
          const beat = ensureBeatAtCursor(draft, cursor);
          if (beat) {
            beat.timer = !beat.timer;
          }
        });
        setCursor(normaliseCursor(nextScore, cursor));
        return { handled: true, message: label };
      }
      case "bar.symbol.doubleSimile": {
        const nextScore = transact("Double simile", (draft) => {
          const masterBar = draft.masterBars[cursor.barIndex];
          if (masterBar) {
            masterBar.simileMark = masterBar.simileMark === "double" ? "none" : "double";
          }
        });
        setCursor(normaliseCursor(nextScore, cursor));
        return { handled: true, message: label };
      }
      case "bar.symbol.multirest": {
        const nextScore = transact("Multirest", (draft) => {
          const masterBar = draft.masterBars[cursor.barIndex];
          if (masterBar) {
            masterBar.simileMark = masterBar.simileMark === "single" ? "none" : "single";
          }
        });
        setCursor(normaliseCursor(nextScore, cursor));
        return { handled: true, message: label };
      }
      case "track.add":
        setActiveTrackPanel("wizard");
        return { handled: true, message: label };
      case "track.delete":
        if (cursor.trackId) {
          handleTrackDelete(cursor.trackId);
          return { handled: true, message: label };
        }
        break;
      case "track.tuning":
        setActiveTrackPanel("tuning");
        return { handled: true, message: label };
      case "voice.toggleMulti":
        handleToggleMultiVoice();
        setActiveTrackPanel("voices");
        return { handled: true, message: label };
      case "tools.commandPalette":
        openCommandPalette("");
        return { handled: true, message: label, keepOpen: true };
      case "tools.chords":
        setActiveToolPanel("chords");
        return { handled: true, message: label };
      case "tools.scales":
        setActiveToolPanel("scales");
        return { handled: true, message: label };
      case "tools.transpose":
        setActiveToolPanel("transpose");
        return { handled: true, message: label };
      case "tools.cleanup":
        setActiveToolPanel("cleanup");
        return { handled: true, message: label };
      case "tools.instrument":
        setActiveToolPanel("instrument");
        return { handled: true, message: label };
      case "panels.palette":
        togglePanel("palette");
        return { handled: true, message: label };
      case "panels.songInspector":
        togglePanel("songInspector");
        return { handled: true, message: label };
      case "panels.trackInspector":
        togglePanel("trackInspector");
        return { handled: true, message: label };
      case "panels.globalView":
        togglePanel("globalView");
        return { handled: true, message: label };
      case "panels.automation":
        togglePanel("automationView");
        return { handled: true, message: label };
      case "view.multitrack":
        handleToggleMultiTrackView();
        return { handled: true, message: label };
      case "view.stylesheet":
        setStylesheetPanelOpen(true);
        return { handled: true, message: label };
      case "view.zoomIn":
        handleZoomChange(score.documentSettings.zoom + 10);
        return { handled: true, message: label };
      case "view.zoomOut":
        handleZoomChange(score.documentSettings.zoom - 10);
        return { handled: true, message: label };
      default:
        break;
    }

    return { handled: false, message: `${label} is not implemented yet.`, keepOpen: true };
  }

  function runQuickPaletteCommand(commandIdOrAction: string): CommandPaletteResult {
    if (commandIdOrAction.includes(".")) {
      try {
        dispatchEditorCommand(commandIdOrAction);
        return { handled: true, message: commandIdOrAction };
      } catch {
        return runAppAction(commandIdOrAction);
      }
    }

    return runAppAction(commandIdOrAction);
  }

  function runExpressionText(expression: string): CommandPaletteResult {
    const value = expression.trim();

    if (!value) {
      return { handled: false, message: "Expression Text needs a value.", keepOpen: true };
    }

    const dynamicIndex = ["ppp", "pp", "p", "mp", "mf", "f", "ff", "fff"].indexOf(value);

    if (dynamicIndex >= 0) {
      editWithCursor("Expression dynamic", (draft) => setDynamicAtCursor(draft, cursor, dynamicIndex as Dynamic));
      return { handled: true, message: `Dynamic ${value}` };
    }

    if (/^[A-G](#|b)?m?(maj|min|dim|aug|sus|add)?\d*$/i.test(value)) {
      const nextScore = transact("Expression chord", (draft) => {
        const beat = ensureBeatAtCursor(draft, cursor);
        const track = draft.tracks.find((candidate) => candidate.id === cursor.trackId);

        if (beat && track) {
          beat.chordId = value;

          if (!track.chordLibrary.some((chord) => chord.id === value)) {
            track.chordLibrary.push({ id: value, name: value });
          }
        }
      });
      setCursor(normaliseCursor(nextScore, cursor));
      return { handled: true, message: `Chord ${value}` };
    }

    if (/^[A-G](#|b)?m?$/.test(value)) {
      const nextScore = transact("Expression key signature", (draft) => {
        const masterBar = draft.masterBars[cursor.barIndex];

        if (masterBar) {
          masterBar.keySignature = { key: value, mode: value.endsWith("m") ? "minor" : "major" };
        }
      });
      setCursor(normaliseCursor(nextScore, cursor));
      return { handled: true, message: `Key ${value}` };
    }

    return { handled: false, message: `Expression "${value}" is not available yet.`, keepOpen: true };
  }

  function jumpToSection(query: string): CommandPaletteResult {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return { handled: false, message: "Type a section letter or name.", keepOpen: true };
    }

    const sectionIndex = score.masterBars.findIndex((bar) => {
      const section = bar.section;
      return section && (section.letter.toLowerCase() === normalized || section.name.toLowerCase().includes(normalized));
    });

    if (sectionIndex < 0) {
      return { handled: false, message: "Section not found.", keepOpen: true };
    }

    setSelection(null);
    setCursor(normaliseCursor(score, { ...cursor, barIndex: sectionIndex, beatIndex: 0 }));
    return { handled: true, message: `Section ${query}` };
  }

  function jumpToBar(query: string): CommandPaletteResult {
    const barNumber = Number(query.trim());

    if (!Number.isInteger(barNumber) || barNumber < 1) {
      return { handled: false, message: "Type a bar number.", keepOpen: true };
    }

    setSelection(null);
    setCursor(normaliseCursor(score, { ...cursor, barIndex: barNumber - 1, beatIndex: 0 }));
    return { handled: true, message: `Bar ${barNumber}` };
  }

  function changeViewFromPalette(query: string): CommandPaletteResult {
    const mode = displayModeFromText(query);

    if (!mode) {
      return { handled: false, message: "Use view vertical-page, horizontal-page, grid, parchment, vertical-screen, or horizontal-screen.", keepOpen: true };
    }

    handleDisplayModeChange(mode);
    return { handled: true, message: `View ${mode}` };
  }

  function zoomFromPalette(query: string): CommandPaletteResult {
    const zoom = Number(query.trim().replace("%", ""));

    if (!Number.isFinite(zoom)) {
      return { handled: false, message: "Type a zoom percent from 25 to 300.", keepOpen: true };
    }

    handleZoomChange(zoom);
    return { handled: true, message: `Zoom ${clampNumber(Math.round(zoom / 5) * 5, 25, 300)}%` };
  }

  function setTimeSignatureFromPalette(numerator: number, denominator: BeatDuration): CommandPaletteResult {
    const nextScore = transact("Command palette time signature", (draft) => {
      const masterBar = draft.masterBars[cursor.barIndex];

      if (masterBar) {
        masterBar.timeSignature = { numerator, denominator, beamingPreset: "default" };
      }
    });
    setCursor(normaliseCursor(nextScore, cursor));
    return { handled: true, message: `${numerator}/${denominator}` };
  }

  function addBarsFromPalette(countText: string, insertAtCursor: boolean): CommandPaletteResult {
    const count = Math.min(128, Math.max(1, Number(countText.trim() || "1")));

    if (!Number.isFinite(count)) {
      return { handled: false, message: "Bar count must be a number.", keepOpen: true };
    }

    const nextScore = transact(insertAtCursor ? "Insert bars" : "Add bars", (draft) => {
      const index = insertAtCursor ? cursor.barIndex : cursor.barIndex + 1;

      for (let i = 0; i < count; i += 1) {
        draft.masterBars.splice(index + i, 0, createMasterBar());
        draft.tracks.forEach((track) => track.bars.splice(index + i, 0, createBar()));
      }
    });
    setCursor(normaliseCursor(nextScore, cursor));
    return { handled: true, message: `${insertAtCursor ? "Inserted" : "Added"} ${count} bar(s)` };
  }

  function repeatBarsFromPalette(countText: string): CommandPaletteResult {
    const count = Math.min(32, Math.max(1, Number(countText.trim() || "1")));

    if (!Number.isFinite(count)) {
      return { handled: false, message: "Repeat count must be a number.", keepOpen: true };
    }

    const nextScore = transact("Repeat bars", (draft) => {
      const sourceMaster = structuredClone(draft.masterBars[cursor.barIndex] ?? createMasterBar());
      const sourceBars = draft.tracks.map((track) => structuredClone(track.bars[cursor.barIndex] ?? createBar()));

      for (let i = 0; i < count; i += 1) {
        const index = cursor.barIndex + 1 + i;
        draft.masterBars.splice(index, 0, structuredClone(sourceMaster));
        draft.tracks.forEach((track, trackIndex) => track.bars.splice(index, 0, structuredClone(sourceBars[trackIndex])));
      }
    });
    setCursor(normaliseCursor(nextScore, cursor));
    return { handled: true, message: `Repeated ${count} bar(s)` };
  }

  function applyPatternFromPalette(prefix: string, rawPattern: string): CommandPaletteResult {
    const pattern = rawPattern;

    if (!pattern) {
      return { handled: false, message: "Pattern required.", keepOpen: true };
    }

    const nextScore = transact("Command palette pattern", (draft) => {
      const track = draft.tracks.find((candidate) => candidate.id === cursor.trackId);
      const beatRefs = collectPatternBeats(track, cursor, selectedBarRange(draft, cursor, selection));

      beatRefs.forEach((beat, index) => {
        const char = pattern[index % pattern.length].toLowerCase();

        if (prefix === "pickstroke") {
          beat.pickstroke = char === "d" ? "down" : char === "u" ? "up" : "none";
        }

        if (prefix === "brush") {
          beat.brush = char === "d" || char === "u" ? { direction: char === "d" ? "down" : "up", speed: 1, delay: 0 } : undefined;
        }

        if (prefix === "arpeggio") {
          beat.arpeggio = char === "d" || char === "u" ? { direction: char === "d" ? "down" : "up", speed: 1, delay: 0 } : undefined;
        }

        if (prefix === "wah") {
          beat.notes.forEach((note) => {
            note.wah = char === "o" ? "open" : char === "c" ? "closed" : undefined;
          });
        }

        if (prefix === "slap-pop") {
          beat.notes.forEach((note) => {
            note.slap = char === "s";
            note.pop = char === "p";
          });
        }
      });
    });
    setCursor(normaliseCursor(nextScore, cursor));
    return { handled: true, message: `${prefix} ${pattern}` };
  }

  function unsetPaletteEffect(effect: string): CommandPaletteResult {
    const key = effect.trim().toLowerCase();

    if (!key) {
      return { handled: false, message: "Type an effect to unset.", keepOpen: true };
    }

    const nextScore = transact("Unset effect", (draft) => {
      const track = draft.tracks.find((candidate) => candidate.id === cursor.trackId);
      const { start, end } = selectedBarRange(draft, cursor, selection);

      track?.bars.slice(start, end + 1).forEach((bar) => {
        bar.voices.forEach((voice) => {
          voice.beats.forEach((beat) => {
            beat.notes.forEach((note) => {
              if (key.includes("tie")) {
                note.tieOrigin = undefined;
                note.tieDestination = undefined;
              }
              if (key.includes("palm")) note.palmMute = false;
              if (key.includes("let")) note.letRing = false;
              if (key.includes("dead")) note.deadNote = false;
              if (key.includes("staccato")) note.staccato = false;
            });
          });
        });
      });
    });
    setCursor(normaliseCursor(nextScore, cursor));
    return { handled: true, message: `Unset ${effect}` };
  }

  async function startPlayback(startSec: number): Promise<void> {
    const scheduler = schedulerRef.current ?? new PlaybackScheduler();
    schedulerRef.current = scheduler;
    const countInSeconds = countInEnabled ? countInDurationSeconds(playbackCompilation) : 0;
    const events = playbackEvents(playbackCompilation, {
      metronome: metronomeEnabled,
      countIn: countInEnabled,
      startSec,
      countInSeconds
    });

    setPlaybackStatus("playing");

    try {
      await scheduler.play({
        startSec: startSec - countInSeconds,
        totalSeconds: playbackCompilation.totalSeconds,
        events,
        onPosition: ({ timeSec }) => {
          const position = playbackCompilation.positionAtSecond(Math.max(0, timeSec));
          setPlaybackPosition({
            barIndex: position.barIndex,
            tick: position.tick,
            timeSec: position.timeSec
          });
        },
        onStop: (reason) => {
          setPlaybackStatus("stopped");

          if (reason === "ended" && loopEnabled) {
            window.setTimeout(() => {
              void startPlayback(loopStartSecond(playbackCompilation, selection, cursor.barIndex));
            }, 0);
          }
        }
      });
    } catch {
      setPlaybackStatus("stopped");
    }
  }

  function stopPlayback(): void {
    schedulerRef.current?.stop("manual");
    setPlaybackStatus("stopped");
  }

  function editWithCursor(
    label: string,
    recipe: (scoreDraft: typeof score) => CursorPosition
  ): void {
    let nextCursor = cursor;
    const nextScore = transact(label, (draft) => {
      nextCursor = recipe(draft);
    });
    setSelection(null);
    setCursor(normaliseCursor(nextScore, nextCursor));
  }

  function updateCursorSelection(nextCursor: CursorPosition, extendSelection: boolean): void {
    const normalised = normaliseCursor(score, nextCursor);
    setCursor(normalised);

    if (extendSelection) {
      setSelection({ anchor: selection?.anchor ?? cursor, head: normalised });
    } else {
      setSelection(null);
    }
  }

  function copySelection(mode: "single" | "multitrack", cut: boolean): void {
    const activeTrackIndex = score.tracks.findIndex((track) => track.id === cursor.trackId);
    const barIndex = cursor.barIndex;

    if (mode === "single") {
      const track = score.tracks[activeTrackIndex];

      if (!track) {
        return;
      }

      clipboardRef.current = {
        mode,
        source: null,
        barsJson: JSON.stringify({ bars: [cloneCurrentBar(track, barIndex)] })
      };

      if (cut) {
        transact("Cut bar", (draft) => {
          const draftTrack = draft.tracks[activeTrackIndex];
          if (draftTrack) {
            draftTrack.bars[barIndex] = createBar();
          }
        });
      }
      return;
    }

    clipboardRef.current = {
      mode,
      source: null,
      barsJson: JSON.stringify({
        masterBars: [score.masterBars[barIndex]],
        trackBars: score.tracks.map((track) => cloneCurrentBar(track, barIndex))
      })
    };

    if (cut) {
      transact("Cut multitrack bar", (draft) => {
        draft.tracks.forEach((track) => {
          track.bars[barIndex] = createBar();
        });
      });
    }
  }

  function pasteClipboard(special: boolean): void {
    const payload = clipboardRef.current;

    if (!payload) {
      return;
    }

    const repeatCount = special ? 2 : 1;
    const activeTrackIndex = score.tracks.findIndex((track) => track.id === cursor.trackId);

    transact(special ? "Special paste" : "Paste", (draft) => {
      const data = JSON.parse(payload.barsJson) as {
        bars?: ReturnType<typeof createBar>[];
        masterBars?: typeof score.masterBars;
        trackBars?: ReturnType<typeof createBar>[];
      };

      for (let repeat = 0; repeat < repeatCount; repeat += 1) {
        const targetBar = cursor.barIndex + repeat;

        if (payload.mode === "single" && data.bars) {
          const track = draft.tracks[activeTrackIndex];
          if (track) {
            replaceTrackBars(track, targetBar, data.bars, false);
          }
        }

        if (payload.mode === "multitrack" && data.trackBars) {
          data.masterBars?.forEach((masterBar, offset) => {
            draft.masterBars[targetBar + offset] = structuredClone(masterBar);
          });
          data.trackBars.forEach((bar, trackIndex) => {
            const track = draft.tracks[trackIndex];
            if (track) {
              replaceTrackBars(track, targetBar, [bar], false);
            }
          });
        }
      }
    });
  }

  function handleScoreClick(event: React.MouseEvent<HTMLElement>) {
    const target = (event.target as Element).closest("[data-hit-ref]") as SVGElement | null;

    if (!target) {
      return;
    }

    const ref = JSON.parse(target.dataset.hitRef ?? "{}") as Record<string, unknown>;
    const kind = target.dataset.hitKind as Parameters<typeof cursorFromHit>[2];
    const staffKind = target.id.endsWith("-head")
      ? "standard"
      : target.id.endsWith("-tab")
        ? "tab"
        : cursor.staffKind;
    const nextCursor = cursorFromHit(score, cursor, kind, ref);
    setSelection(null);
    setCursor(normaliseCursor(score, { ...nextCursor, staffKind }));
  }

  function handleScoreKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    handleEditorKeyDown(event.nativeEvent, editorContext, fretBufferRef.current);
  }

  function handleSongInfoChange(field: keyof SongInfo, value: string) {
    transact("Edit song info", (draft) => {
      draft.meta[field] = value;
    });
  }

  function handleTrackChange(
    trackId: string,
    patch: Partial<Pick<Track, "name" | "shortName" | "color">>
  ) {
    transact("Edit track", (draft) => {
      const track = draft.tracks.find((candidate) => candidate.id === trackId);
      if (track) {
        Object.assign(track, patch);
      }
    });
  }

  function handleCreateTrack(options: TrackCreateOptions) {
    const preset = instrumentById(options.presetId);
    let nextCursor: CursorPosition = cursor;
    const nextScore = transact("Create track", (draft) => {
      const notationTypes = options.notationTypes.length > 0 ? options.notationTypes : preset.notationTypes;
      const track = createTrack(
        {
          name: options.name.trim() || preset.name,
          shortName: options.shortName.trim() || preset.shortName,
          color: options.color,
          icon: options.icon,
          strings: [...options.tuning.strings],
          tuningLabel: options.tuning.label,
          notationTypes: [...notationTypes],
          staffConfig: options.staffConfig,
          stringed: preset.stringed,
          soundingOffset: preset.soundingOffset,
          gmProgram: preset.gmProgram
        },
        draft.masterBars.length
      );

      track.tuning = structuredClone(options.tuning);
      track.interpretation.stringed = preset.stringed;
      track.transpositionTonality.soundingOffset = preset.soundingOffset;
      draft.tracks.push(track);
      nextCursor = {
        trackId: track.id,
        barIndex: 0,
        voiceIndex: 0,
        beatIndex: 0,
        string: 1,
        staffLine: 0,
        staffKind: track.notationTypes.includes("tab") ? "tab" : "standard"
      };
    });

    setSelection(null);
    setCursor(normaliseCursor(nextScore, nextCursor));
    setActiveTrackPanel(null);
  }

  function handleApplyTuning(trackId: string, tuning: Track["tuning"], mode: RetuneMode) {
    const nextScore = transact("Apply tuning", (draft) => {
      const track = draft.tracks.find((candidate) => candidate.id === trackId);

      if (track) {
        retuneTrack(track, structuredClone(tuning), mode);
      }
    });

    setCursor(normaliseCursor(nextScore, cursor));
  }

  function handleTrackSystemPatch(
    trackId: string,
    patch: Partial<Pick<Track, "notationTypes" | "staffConfig">>
  ) {
    transact("Edit track system", (draft) => {
      const track = draft.tracks.find((candidate) => candidate.id === trackId);

      if (!track) {
        return;
      }

      if (patch.notationTypes && patch.notationTypes.length > 0) {
        track.notationTypes = [...patch.notationTypes];
      }

      if (patch.staffConfig) {
        track.staffConfig = patch.staffConfig;
      }
    });
  }

  function handleTrackTranspositionChange(trackId: string, soundingOffset: number) {
    transact("Edit track transposition", (draft) => {
      const track = draft.tracks.find((candidate) => candidate.id === trackId);

      if (track) {
        track.transpositionTonality.soundingOffset = soundingOffset;
      }
    });
  }

  function handleConcertToneToggle() {
    transact("Toggle concert tone", (draft) => {
      draft.documentSettings.concertTone = !draft.documentSettings.concertTone;
    });
  }

  function handleStylesheetChange(stylesheet: Stylesheet) {
    transact("Edit stylesheet", (draft) => {
      draft.stylesheet = normalizeStylesheet(stylesheet);
    });
  }

  function handleStylesheetPreset(presetName: StylesheetPresetName) {
    transact("Apply stylesheet preset", (draft) => {
      draft.stylesheet = applyStylePreset(normalizeStylesheet(draft.stylesheet), presetName);
    });
  }

  function handleDisplayModeChange(displayMode: DisplayMode) {
    transact("Change display mode", (draft) => {
      draft.documentSettings.displayMode = displayMode;
    });
  }

  function handleZoomChange(zoom: number) {
    const nextZoom = clampNumber(Math.round(zoom / 5) * 5, 25, 300);

    transact("Change zoom", (draft) => {
      draft.documentSettings.zoom = nextZoom;
    });
  }

  function handleTrackDelete(trackId: string) {
    const trackIndex = score.tracks.findIndex((track) => track.id === trackId);

    if (trackIndex < 0 || score.tracks.length <= 1) {
      return;
    }

    const nextTrack = score.tracks[trackIndex + 1] ?? score.tracks[trackIndex - 1] ?? null;
    const nextScore = transact("Delete track", (draft) => {
      draft.tracks = draft.tracks.filter((track) => track.id !== trackId);
    });

    setSelection(null);
    setCursor(normaliseCursor(nextScore, { ...cursor, trackId: nextTrack?.id ?? null }));
  }

  function handleTrackMove(trackId: string, direction: -1 | 1) {
    const trackIndex = score.tracks.findIndex((track) => track.id === trackId);
    const targetIndex = Math.min(score.tracks.length - 1, Math.max(0, trackIndex + direction));

    if (trackIndex < 0 || targetIndex === trackIndex) {
      return;
    }

    const nextScore = transact("Move track", (draft) => {
      const [track] = draft.tracks.splice(trackIndex, 1);
      draft.tracks.splice(targetIndex, 0, track);
    });

    setCursor(normaliseCursor(nextScore, cursor));
  }

  function handleVoiceSelect(voiceIndex: number) {
    const nextScore = score;
    setMultiVoiceEdit(true);
    setCursor(normaliseCursor(nextScore, { ...cursor, voiceIndex }));
    setSelection(null);
  }

  function handleMoveNoteToVoice(voiceIndex: number) {
    if (voiceIndex === cursor.voiceIndex) {
      return;
    }

    let nextCursor: CursorPosition = { ...cursor, voiceIndex };
    const nextScore = transact("Move note to voice", (draft) => {
      const track = draft.tracks.find((candidate) => candidate.id === cursor.trackId);
      const bar = track?.bars[cursor.barIndex];
      const sourceVoice = bar?.voices[cursor.voiceIndex];
      const targetVoice = bar?.voices[voiceIndex];
      const sourceBeat = sourceVoice?.beats[cursor.beatIndex];

      if (!sourceBeat || !targetVoice || sourceBeat.notes.length === 0) {
        return;
      }

      while (targetVoice.beats.length <= cursor.beatIndex) {
        targetVoice.beats.push(createBeat({ duration: sourceBeat.duration, dots: sourceBeat.dots, rest: true }));
      }

      const targetBeat = targetVoice.beats[cursor.beatIndex];
      const noteIndex = Math.max(0, sourceBeat.notes.findIndex((note) => note.string === cursor.string));
      const [note] = sourceBeat.notes.splice(noteIndex, 1);

      if (!note) {
        return;
      }

      targetBeat.rest = false;
      targetBeat.notes.push(note);

      if (sourceBeat.notes.length === 0) {
        sourceBeat.rest = true;
      }

      nextCursor = { ...cursor, voiceIndex, string: note.string };
    });

    setMultiVoiceEdit(true);
    setSelection(null);
    setCursor(normaliseCursor(nextScore, nextCursor));
  }

  function handleDrumToggle(mappingId: string, articulation: string) {
    const mapping = DRUM_MAPPINGS.find((candidate) => candidate.id === mappingId);
    const activeTrack = score.tracks.find((track) => track.id === cursor.trackId);

    if (!mapping || activeTrack?.icon !== "drums") {
      return;
    }

    const nextScore = transact("Toggle drum hit", (draft) => {
      const beat = ensureBeatAtCursor(draft, cursor);

      if (!beat) {
        return;
      }

      const existingIndex = beat.notes.findIndex(
        (note) => note.midiNumber === mapping.midiNumber && note.articulation === articulation
      );

      if (existingIndex >= 0) {
        beat.notes.splice(existingIndex, 1);
      } else {
        const note = createNote(1, 0);
        note.midiNumber = mapping.midiNumber;
        note.articulation = articulation;
        note.ghost = articulation === "ghost";
        note.accent = articulation === "accent" || articulation === "rimshot" ? "accent" : "none";
        beat.notes.push(note);
      }

      beat.rest = beat.notes.length === 0;
    });

    setCursor(normaliseCursor(nextScore, cursor));
  }

  function handleToggleMultiVoice() {
    setMultiVoiceEdit((value) => !value);
  }

  function handleToggleMultiTrackView() {
    setMultiTrackView((value) => !value);
  }

  function handleGlobalJump(trackId: string, barIndex: number) {
    setSelection(null);
    setCursor(
      normaliseCursor(score, {
        ...cursor,
        trackId,
        barIndex,
        beatIndex: 0
      })
    );
  }

  function handleMixerTrackChange(trackId: string, patch: Partial<TrackMixerState>) {
    setTrackMixer(trackId, patch);
  }

  function handleMixerEffectToggle(trackId: string, effect: EffectSlotType) {
    toggleTrackEffect(trackId, effect);
  }

  function handleAutomationPointSet(lane: AutomationLaneId, tick: number, value: number) {
    transact("Edit automation", (draft) => {
      const target = automationTarget(draft, lane, cursor.trackId);

      if (!target) {
        return;
      }

      const automation = ensureAutomation(target.automations, target.type, target.scope);
      const snappedTick = snapAutomationTick(tick);
      const existing = nearestAutomationPoint(automation, snappedTick);

      if (existing && Math.abs(existing.tick - snappedTick) <= TICKS_PER_QUARTER / 4) {
        existing.tick = snappedTick;
        existing.value = value;
      } else {
        automation.points.push({ tick: snappedTick, value, transition: "constant" });
      }

      automation.points.sort((left, right) => left.tick - right.tick);
    });
  }

  function handleAutomationPointRemove(lane: AutomationLaneId, tick: number) {
    transact("Remove automation point", (draft) => {
      const target = automationTarget(draft, lane, cursor.trackId);

      if (!target) {
        return;
      }

      const automation = target.automations.find(
        (candidate) => candidate.type === target.type && candidate.scope === target.scope
      );

      if (!automation) {
        return;
      }

      const snappedTick = snapAutomationTick(tick);
      automation.points = automation.points.filter(
        (point) => Math.abs(point.tick - snappedTick) > TICKS_PER_QUARTER / 4
      );
    });
  }

  function handleAutomationTransitionToggle(lane: AutomationLaneId, tick: number) {
    transact("Toggle automation transition", (draft) => {
      const target = automationTarget(draft, lane, cursor.trackId);

      if (!target) {
        return;
      }

      const automation = target.automations.find(
        (candidate) => candidate.type === target.type && candidate.scope === target.scope
      );
      const point = automation ? nearestAutomationPoint(automation, snapAutomationTick(tick)) : null;

      if (point) {
        point.transition = point.transition === "constant" ? "progressive" : "constant";
      }
    });
  }

  function handleInsertChordVoicing(voicing: ChordVoicing, chordName: string) {
    let nextCursor = cursor;
    const nextScore = transact("Insert chord voicing", (draft) => {
      const beat = ensureBeatAtCursor(draft, cursor);
      const track = draft.tracks.find((candidate) => candidate.id === cursor.trackId);

      if (!beat || !track) {
        return;
      }

      beat.rest = false;
      beat.chordId = chordName;
      beat.notes = voicing.notes.map((voicingNote) => createNote(voicingNote.string, voicingNote.fret));

      if (!track.chordLibrary.some((chord) => chord.id === chordName)) {
        track.chordLibrary.push({ id: chordName, name: chordName });
      }

      nextCursor = {
        ...cursor,
        string: voicing.notes[0]?.string ?? cursor.string
      };
    });

    setCursor(normaliseCursor(nextScore, nextCursor));
  }

  function handleFretboardNoteToggle(string: number, fret: number, advance: boolean) {
    let nextCursor = { ...cursor, string };
    const nextScore = transact("Fretboard note input", (draft) => {
      const beat = ensureBeatAtCursor(draft, { ...cursor, string });

      if (!beat) {
        return;
      }

      const existingIndex = beat.notes.findIndex((note) => note.string === string && note.fret === fret);

      if (existingIndex >= 0) {
        beat.notes.splice(existingIndex, 1);
      } else {
        beat.rest = false;
        const sameStringIndex = beat.notes.findIndex((note) => note.string === string);
        const note = createNote(string, fret);

        if (sameStringIndex >= 0) {
          beat.notes[sameStringIndex] = note;
        } else {
          beat.notes.push(note);
        }
      }

      if (beat.notes.length === 0) {
        beat.rest = true;
      }

      if (advance) {
        nextCursor = moveRightWithScoreMutation(draft, { ...cursor, string });
      }
    });

    setCursor(normaliseCursor(nextScore, nextCursor));
  }

  function handleTransposeRequest(options: TransposeOptions) {
    const nextScore = transact("Transpose", (draft) => {
      transposeScore(draft, cursor, selection, options);
    });
    setCursor(normaliseCursor(nextScore, cursor));
  }

  function handleCleanupRequest(request: CleanupRequest) {
    const nextScore = transact("Tools cleanup", (draft) => {
      const track = draft.tracks.find((candidate) => candidate.id === cursor.trackId);

      if (!track) {
        return;
      }

      const { start, end } = selectedBarRange(draft, cursor, selection);

      for (let barIndex = start; barIndex <= end; barIndex += 1) {
        const bar = track.bars[barIndex];

        if (!bar) {
          continue;
        }

        bar.voices.forEach((voice) => {
          voice.beats.forEach((beat) => {
            beat.notes.forEach((note) => {
              if (request === "letRing") {
                note.letRing = true;
                note.palmMute = false;
              }

              if (request === "palmMute") {
                note.palmMute = true;
                note.letRing = false;
              }

              if (request === "fingerPositioning" && note.fret > 12) {
                note.fret -= 12;
              }
            });
          });

          if (request === "completeRests") {
            const expected = draft.masterBars[barIndex] ? barTheoreticalTicks(draft.masterBars[barIndex]) : 0;
            const actual = voice.beats.reduce((sum, beat) => sum + beatDurationTicks(beat), 0);
            const remaining = expected - actual;

            if (remaining > 0) {
              voice.beats.push(createBeat({ duration: durationForTicks(remaining), rest: true }));
            }
          }
        });
      }
    });

    setCursor(normaliseCursor(nextScore, cursor));
  }

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
      activeToolPanel={activeToolPanel}
      activeTrackPanel={activeTrackPanel}
      stylesheetPanelOpen={stylesheetPanelOpen}
      fileIoPanelOpen={fileIoPanelOpen}
      fileIoStatus={fileIoStatus}
      commandPaletteOpen={commandPaletteOpen}
      commandPaletteInitialValue={commandPaletteInitialValue}
      platform={platform}
      registeredCommands={getAllCommands(editorContext)}
      multiVoiceEdit={multiVoiceEdit}
      multiTrackView={multiTrackView}
      dispatchCommand={dispatchEditorCommand}
      togglePanel={togglePanel}
      onSongInfoChange={handleSongInfoChange}
      onTrackChange={handleTrackChange}
      onTrackSystemPatch={handleTrackSystemPatch}
      onTrackTranspositionChange={handleTrackTranspositionChange}
      onConcertToneToggle={handleConcertToneToggle}
      onTrackDelete={handleTrackDelete}
      onTrackMove={handleTrackMove}
      onGlobalJump={handleGlobalJump}
      onMixerTrackChange={handleMixerTrackChange}
      onMixerEffectToggle={handleMixerEffectToggle}
      onMasterFocusChange={setMasterFocusPercent}
      onAutomationPointSet={handleAutomationPointSet}
      onAutomationPointRemove={handleAutomationPointRemove}
      onAutomationTransitionToggle={handleAutomationTransitionToggle}
      onToolOpen={setActiveToolPanel}
      onToolClose={() => setActiveToolPanel(null)}
      onTrackPanelOpen={setActiveTrackPanel}
      onTrackPanelClose={() => setActiveTrackPanel(null)}
      onFileIoPanelOpen={() => setFileIoPanelOpen(true)}
      onFileIoPanelClose={() => setFileIoPanelOpen(false)}
      onNewFile={handleNewFile}
      onOpenNativeFile={() => void handleOpenNativeFile()}
      onSaveNativeFile={() => void handleSaveNativeFile()}
      onSaveNativeFileAs={() => void handleSaveNativeFileAs()}
      onImportFile={handleImportFile}
      onExportFile={(format) => void handleExportFile(format)}
      onStylesheetPanelOpen={() => setStylesheetPanelOpen(true)}
      onStylesheetPanelClose={() => setStylesheetPanelOpen(false)}
      onStylesheetChange={handleStylesheetChange}
      onStylesheetPreset={handleStylesheetPreset}
      onDisplayModeChange={handleDisplayModeChange}
      onZoomChange={handleZoomChange}
      onCommandPaletteOpen={openCommandPalette}
      onCommandPaletteClose={() => setCommandPaletteOpen(false)}
      onCommandPaletteSubmit={handleCommandPaletteSubmit}
      onCreateTrack={handleCreateTrack}
      onApplyTuning={handleApplyTuning}
      onVoiceSelect={handleVoiceSelect}
      onMoveNoteToVoice={handleMoveNoteToVoice}
      onToggleMultiVoice={handleToggleMultiVoice}
      onToggleMultiTrackView={handleToggleMultiTrackView}
      onDrumToggle={handleDrumToggle}
      onInsertChordVoicing={handleInsertChordVoicing}
      onFretboardNoteToggle={handleFretboardNoteToggle}
      onTransposeRequest={handleTransposeRequest}
      onCleanupRequest={handleCleanupRequest}
      workspace={
        <div
          className="scoreViewport"
          tabIndex={0}
          role="application"
          aria-label="Editable score"
          onClick={handleScoreClick}
          onKeyDown={handleScoreKeyDown}
          onDragOver={handleScoreDragOver}
          onDrop={(event) => void handleScoreDrop(event)}
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
        ref={fileInputRef}
        type="file"
        className="hiddenFileInput"
        onChange={(event) => void handleFileInputChange(event)}
      />
    </>
  );
}

function acceptForPending(pending: PendingFileLoad): string {
  if (pending.kind === "native") {
    return ".gp,.gp8,.json,application/json";
  }

  switch (pending.format) {
    case "ascii":
      return ".txt,.tab,text/plain";
    case "musicxml":
      return ".musicxml,.xml,application/xml,text/xml";
    case "midi":
      return ".mid,.midi,audio/midi,audio/x-midi";
  }
}

function pendingLoadForFileName(fileName: string): PendingFileLoad | null {
  const extension = fileName.toLowerCase().split(".").pop() ?? "";

  if (["gp", "gp8", "json"].includes(extension)) {
    return { kind: "native" };
  }

  if (["txt", "tab"].includes(extension)) {
    return { kind: "import", format: "ascii" };
  }

  if (["musicxml", "xml"].includes(extension)) {
    return { kind: "import", format: "musicxml" };
  }

  if (["mid", "midi"].includes(extension)) {
    return { kind: "import", format: "midi" };
  }

  return null;
}

function pendingFileLabel(pending: PendingFileLoad): string {
  return pending.kind === "native" ? "native .gp" : formatLabel(pending.format);
}

function importFormatFromText(value: string): ImportFormat | "native" | null {
  const token = normalizedFormatToken(value);

  if (!token) return null;
  if (["native", "gp", "gp8", "json", "score"].includes(token)) return "native";
  if (["ascii", "asciitab", "tab", "txt", "text"].includes(token)) return "ascii";
  if (["musicxml", "xml", "mxl"].includes(token)) return "musicxml";
  if (["midi", "mid", "smf"].includes(token)) return "midi";
  return null;
}

function exportFormatFromText(value: string): ExportFormat | null {
  const token = normalizedFormatToken(value);

  if (!token) return null;
  if (["native", "gp", "gp8", "json", "score"].includes(token)) return "native";
  if (["ascii", "asciitab", "tab", "txt", "text"].includes(token)) return "ascii";
  if (["musicxml", "xml", "mxl"].includes(token)) return "musicxml";
  if (["midi", "mid", "smf"].includes(token)) return "midi";
  if (token === "svg") return "svg";
  if (token === "png") return "png";
  if (token === "pdf") return "pdf";
  return null;
}

function normalizedFormatToken(value: string): string {
  return value.trim().toLowerCase().replace(/[\s._-]+/g, "");
}

function formatLabel(format: ImportFormat | ExportFormat | "native"): string {
  switch (format) {
    case "native":
      return "Native .gp";
    case "ascii":
      return "ASCII tab";
    case "musicxml":
      return "MusicXML";
    case "midi":
      return "MIDI";
    case "svg":
      return "SVG";
    case "png":
      return "PNG";
    case "pdf":
      return "PDF";
  }
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function svgToPngBlob(svg: string, width: number, height: number): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));

  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("The SVG page could not be rendered as PNG."));
      image.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(width));
    canvas.height = Math.max(1, Math.ceil(height));
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("The browser could not create a PNG export canvas.");
    }

    context.drawImage(image, 0, 0);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("The PNG export failed."));
        }
      }, "image/png");
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The file operation failed.";
}

function playbackEvents(
  compilation: PlaybackCompilation,
  options: { metronome: boolean; countIn: boolean; startSec: number; countInSeconds: number }
): NoteEvent[] {
  const events = [...compilation.events];

  if (options.metronome) {
    compilation.segments.forEach((segment) => {
      for (let tick = segment.startTick; tick < segment.startTick + segment.durationTicks; tick += 480) {
        events.push(clickEvent(`metronome-${segment.sequenceIndex}-${tick}`, compilation.tempoMap.ticksToSeconds(tick), tick === segment.startTick));
      }
    });
  }

  if (options.countIn) {
    const beatLength = options.countInSeconds / 4;

    for (let beat = 0; beat < 4; beat += 1) {
      events.push(
        clickEvent(
          `count-in-${beat}`,
          options.startSec - options.countInSeconds + beat * beatLength,
          beat === 0
        )
      );
    }
  }

  return events.sort((left, right) => left.timeSec - right.timeSec);
}

function clickEvent(id: string, timeSec: number, downbeat: boolean): NoteEvent {
  return {
    id,
    timeSec,
    durationSec: 0.035,
    startTick: 0,
    writtenTick: 0,
    durationTicks: 24,
    midiPitch: downbeat ? 96 : 84,
    velocity: downbeat ? 108 : 78,
    trackId: "__metronome__",
    barIndex: 0,
    voiceIndex: 0,
    beatIndex: 0,
    noteIndex: 0,
    string: 0,
    effects: {
      dead: false,
      ghost: false,
      palmMute: true,
      letRing: false,
      staccato: true,
      accent: downbeat ? "heavy" : "none",
      vibrato: "none",
      hopo: false,
      fadeIn: false,
      fadeOut: false,
      volumeSwell: false,
      slap: false,
      pop: false,
      deadSlapped: false,
      pickscrape: false,
      bend: false,
      bendPoints: [],
      slide: null,
      harmonic: null,
      harmonicShift: 0,
      wah: null,
      tremoloPicking: null,
      attackSec: 0.002,
      releaseSec: 0.02,
      filter: "palmMute"
    },
    mix: {
      muted: false,
      gain: 0.9,
      pan: 0,
      eq: "bright",
      effectChain: []
    }
  };
}

function countInDurationSeconds(compilation: PlaybackCompilation): number {
  const bpm = compilation.tempoMap.points[0]?.bpm ?? 120;
  return (60 / bpm) * 4;
}

function loopStartSecond(
  compilation: PlaybackCompilation,
  selection: SelectionRange | null,
  fallbackBarIndex: number
): number {
  const barIndex = selection
    ? Math.min(selection.anchor.barIndex, selection.head.barIndex)
    : fallbackBarIndex;
  return compilation.secondAtBar(barIndex);
}

function automationTarget(score: Score, lane: AutomationLaneId, trackId: string | null) {
  if (lane === "tempo") {
    return { automations: score.masterAutomations, type: "tempo" as AutomationType, scope: "master" as AutomationScope };
  }

  if (lane === "masterVolume") {
    return { automations: score.masterAutomations, type: "volume" as AutomationType, scope: "master" as AutomationScope };
  }

  if (lane === "masterPan") {
    return { automations: score.masterAutomations, type: "pan" as AutomationType, scope: "master" as AutomationScope };
  }

  const track = score.tracks.find((candidate) => candidate.id === trackId);

  if (!track) {
    return null;
  }

  return {
    automations: track.automations,
    type: lane === "trackVolume" ? "volume" as AutomationType : "pan" as AutomationType,
    scope: "track" as AutomationScope
  };
}

function ensureAutomation(
  automations: Automation[],
  type: AutomationType,
  scope: AutomationScope
): Automation {
  let automation = automations.find((candidate) => candidate.type === type && candidate.scope === scope);

  if (!automation) {
    automation = { type, scope, points: [] };
    automations.push(automation);
  }

  return automation;
}

function nearestAutomationPoint(automation: Automation, tick: number) {
  return automation.points.reduce<(typeof automation.points)[number] | null>((nearest, point) => {
    if (!nearest || Math.abs(point.tick - tick) < Math.abs(nearest.tick - tick)) {
      return point;
    }

    return nearest;
  }, null);
}

function snapAutomationTick(tick: number): number {
  return Math.max(0, Math.round(tick / TICKS_PER_QUARTER) * TICKS_PER_QUARTER);
}

function ensureBeatAtCursor(score: Score, cursor: CursorPosition) {
  const track = score.tracks.find((candidate) => candidate.id === cursor.trackId);
  const voice = track?.bars[cursor.barIndex]?.voices[cursor.voiceIndex];

  if (!voice) {
    return null;
  }

  while (voice.beats.length <= cursor.beatIndex) {
    voice.beats.push(createBeat({ duration: 4 }));
  }

  return voice.beats[cursor.beatIndex];
}

function selectedBarRange(
  score: Score,
  cursor: CursorPosition,
  selection: SelectionRange | null
): { start: number; end: number } {
  if (!selection) {
    return { start: cursor.barIndex, end: cursor.barIndex };
  }

  return {
    start: Math.max(0, Math.min(selection.anchor.barIndex, selection.head.barIndex)),
    end: Math.min(score.masterBars.length - 1, Math.max(selection.anchor.barIndex, selection.head.barIndex))
  };
}

function collectPatternBeats(
  track: Track | undefined,
  cursor: CursorPosition,
  range: { start: number; end: number }
): Beat[] {
  const beats: Beat[] = [];

  if (!track) {
    return beats;
  }

  for (let barIndex = range.start; barIndex <= range.end; barIndex += 1) {
    const voice = track.bars[barIndex]?.voices[cursor.voiceIndex];

    if (!voice) {
      continue;
    }

    voice.beats.forEach((beat, beatIndex) => {
      if (barIndex === cursor.barIndex && beatIndex < cursor.beatIndex && range.start === range.end) {
        return;
      }

      beats.push(beat);
    });
  }

  return beats.length > 0 ? beats : track.bars[cursor.barIndex]?.voices[cursor.voiceIndex]?.beats.slice(cursor.beatIndex, cursor.beatIndex + 1) ?? [];
}

function durationForTicks(ticks: number): BeatDuration {
  const candidates: Array<[BeatDuration, number]> = [
    [1, TICKS_PER_QUARTER * 4],
    [2, TICKS_PER_QUARTER * 2],
    [4, TICKS_PER_QUARTER],
    [8, TICKS_PER_QUARTER / 2],
    [16, TICKS_PER_QUARTER / 4],
    [32, TICKS_PER_QUARTER / 8],
    [64, TICKS_PER_QUARTER / 16]
  ];
  return candidates.reduce((best, candidate) =>
    Math.abs(candidate[1] - ticks) < Math.abs(best[1] - ticks) ? candidate : best
  )[0];
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

function displayModeFromText(value: string): DisplayMode | null {
  const normalized = value.trim().toLowerCase().replace(/[\s_]+/g, "-");
  const aliases: Record<string, DisplayMode> = {
    vp: "vertical-page",
    page: "vertical-page",
    "vertical-page": "vertical-page",
    hp: "horizontal-page",
    "horizontal-page": "horizontal-page",
    grid: "grid",
    parchment: "parchment",
    scroll: "parchment",
    vs: "vertical-screen",
    "vertical-screen": "vertical-screen",
    hs: "horizontal-screen",
    "horizontal-screen": "horizontal-screen"
  };

  return aliases[normalized] ?? null;
}

export default App;
