import { instrumentById, TUNING_PRESETS } from "../../model/instruments";
import type { NewScoreOptions } from "../../ui/shell/StartScreen";
// File I/O controller — File System Access API, the hidden <input> fallback,
// import/export/download, and score drag & drop.
//
// Extracted from src/App.tsx (see docs/ui-remaster/00-component-map.md §1,
// row App.tsx:570-818, plus the module-level format/download/error helpers
// at App.tsx:2135-2283) as part of Phase 2's structural-only refactor.
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { defaultCursor } from "../../engine/editing/operations";
import type { CursorPosition, SelectionRange } from "../../engine/editing/types";
import { layoutScore } from "../../engine/layout/layoutScore";
import { exportAsciiTab, importAsciiTab } from "../../io/asciiTab";
import { defaultExportName } from "../../io/exportNames";
import { exportMidi, importMidi } from "../../io/midi";
import { exportMusicXml, readMusicXml, readCompressedMusicXml } from "../../io/musicXml";
import { APP_NAME, LEGACY_NATIVE_EXTENSIONS, NATIVE_EXTENSION, NATIVE_FILE_ACCEPT, readScoreFile, writeScoreFile } from "../../io/fileFormat";
import { sniffFileType, UNSUPPORTED_GUITAR_PRO_MESSAGE } from "../../io/sniffFileType";
import { printScore } from "../../io/print/PrintView";
import { exportPageImages, type PngScale } from "../../io/print/imageExport";
import { createEmptyScore, createTrack } from "../../model/factory";
import type { Score } from "../../model/types";
import { checkInvariants } from "../../model/invariants";
import { discardRecoverySnapshot, rememberRecentScore, type RecentScore } from "../../store/autosave";
import { usePreferencesStore } from "../../store/preferencesStore";
import { useDocumentStore, type LoadScoreOptions } from "../../store/documentStore";
import type { UnsavedChoice } from "../../ui/overlays/UnsavedChangesDialog";
import type { ExportFormat, ImportFormat } from "../../ui/shell/FileIoPanel";

export interface BrowserFileHandle {
  isSameEntry?: (other: BrowserFileHandle) => Promise<boolean>;
  getFile: () => Promise<File>;
  createWritable: () => Promise<{ write: (blob: Blob) => Promise<void>; close: () => Promise<void>; abort?: () => Promise<void> }>;
}

interface BrowserFilePickerWindow extends Window {
  showOpenFilePicker?: (options?: unknown) => Promise<BrowserFileHandle[]>;
  showSaveFilePicker?: (options?: unknown) => Promise<BrowserFileHandle>;
}

type PendingFileLoad = { kind: "native" } | { kind: "import"; format: ImportFormat };

export interface UseFileControllerParams {
  score: Score;
  activeTrackId: string | null;
  loadScore: (score: Score, options?: LoadScoreOptions) => void;
  setSelection: (selection: SelectionRange | null) => void;
  setCursor: (cursor: CursorPosition) => void;
  openFileIoPanel: () => void;
  closeFileIoPanel: () => void;
  beforeDocumentSwitch?: () => void;
  onDocumentOpened?: () => void;
}

export interface FileController {
  fileIoStatus: string;
  fileInputRef: React.RefObject<HTMLInputElement>;
  midiImportOpen: boolean;
  resolveMidiImport: (detectTriplets: boolean | null) => void;
  unsavedConfirmationOpen: boolean;
  resolveUnsavedChoice: (choice: UnsavedChoice) => void;
  openDemo: (score: Score) => Promise<boolean>;
  handleNewFile: (options?: NewScoreOptions) => void;
  handleOpenRecent: (recent: RecentScore) => Promise<void>;
  handleOpenLocal: (file: File) => Promise<void>;
  handleSelectDocument: (id: string) => void;
  handleCloseDocument: (id: string) => Promise<boolean>;
  handleSaveDocument: (id: string) => Promise<boolean>;
  handleOpenNativeFile: () => Promise<void>;
  handleSaveNativeFile: () => Promise<void>;
  handleSaveNativeFileAs: () => Promise<void>;
  handleImportFile: (format: ImportFormat) => void;
  handleExportFile: (format: ExportFormat, pngScale?: PngScale) => Promise<void>;
  handleFileInputChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleScoreDrop: (event: DragEvent<HTMLDivElement>) => Promise<void>;
  handleScoreDragOver: (event: DragEvent<HTMLDivElement>) => void;
}

export function useFileController(params: UseFileControllerParams): FileController {
  const { score, activeTrackId, loadScore, openFileIoPanel, closeFileIoPanel, beforeDocumentSwitch, onDocumentOpened } =
    params;

  const [fileIoStatus, setFileIoStatus] = useState(
    `Native ${NATIVE_EXTENSION}, ASCII, MusicXML, MIDI, SVG, PNG, and PDF are ready.`
  );
  const [midiImportOpen, setMidiImportOpen] = useState(false);
  const midiChoice = useRef<((detectTriplets: boolean | null) => void) | null>(null);
  const [unsavedConfirmationOpen, setUnsavedConfirmationOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingFileLoadRef = useRef<PendingFileLoad | null>(null);
  const nativeFileHandles = useRef(new Map<string, BrowserFileHandle>());
  const unsavedChoice = useRef<((choice: UnsavedChoice) => void) | null>(null);
  const pendingNavigation = useRef(false);
  const saving = useRef<string | null>(null);
  const nativeOperations = useRef(Promise.resolve());

  // Binding a tab to a file and writing its contents form one operation.
  // An overlapping open must observe either the old binding or the committed new one.
  async function withNativeBindings<T>(action: () => Promise<T>): Promise<T> {
    const previous = nativeOperations.current;
    let release!: () => void;
    nativeOperations.current = new Promise<void>(resolve => { release = resolve; });
    await previous;
    try { return await action(); }
    finally { release(); }
  }

  async function ownerOf(handle: BrowserFileHandle): Promise<string | undefined> {
    for (const [id, bound] of nativeFileHandles.current) {
      const same = bound === handle || await bound.isSameEntry?.(handle);
      if (same && useDocumentStore.getState().getSession(id)) return id;
    }
  }
  const openingError = (error: unknown) => setFileIoStatus(errorMessage(error));

  useEffect(() => () => {
    midiChoice.current?.(null);
    unsavedChoice.current?.("cancel");
  }, []);

  function resolveMidiImport(detectTriplets: boolean | null): void {
    const resolve = midiChoice.current;
    midiChoice.current = null;
    setMidiImportOpen(false);
    resolve?.(detectTriplets);
  }

  function chooseMidiGrid(): Promise<boolean | null> {
    return new Promise((resolve) => {
      midiChoice.current = resolve;
      setMidiImportOpen(true);
    });
  }

  function resolveUnsavedChoice(choice: UnsavedChoice): void {
    const resolve = unsavedChoice.current;
    unsavedChoice.current = null;
    setUnsavedConfirmationOpen(false);
    resolve?.(choice);
  }

  async function confirmCloseIfDirty(id: string): Promise<boolean> {
    const tab = useDocumentStore.getState().documents.find((document) => document.id === id);
    if (!tab?.dirty) return true;
    if (unsavedChoice.current) return false;

    const choice = await new Promise<UnsavedChoice>((resolve) => {
      unsavedChoice.current = resolve;
      setUnsavedConfirmationOpen(true);
    });
    if (choice === "cancel") return false;
    if (choice === "save") {
      return await saveNativeScore(false, id) &&
        !useDocumentStore.getState().documents.find((document) => document.id === id)?.dirty;
    }

    void discardRecoverySnapshot(id, new Date().toISOString()).catch(() => {});
    return true;
  }

  async function handleCloseDocument(id: string): Promise<boolean> {
    return navigate(async () => {
      if (saving.current === id) return false;
      if (!await confirmCloseIfDirty(id) || saving.current === id) return false;
      if (useDocumentStore.getState().activeId === id) beforeDocumentSwitch?.();
      nativeFileHandles.current.delete(id);
      useDocumentStore.getState().closeDocument(id);
      return true;
    });
  }

  function handleSelectDocument(id: string): void {
    if (pendingNavigation.current) return;
    const state = useDocumentStore.getState();
    if (state.activeId !== id && state.getSession(id)) {
      beforeDocumentSwitch?.();
      state.selectDocument(id);
    }
    onDocumentOpened?.();
  }

  async function navigate(action: () => Promise<boolean>): Promise<boolean> {
    if (pendingNavigation.current) return false;
    pendingNavigation.current = true;
    try {
      return await action();
    } finally {
      pendingNavigation.current = false;
    }
  }

  function openScore(
    score: Score,
    options: LoadScoreOptions = {},
    handle: BrowserFileHandle | null = null
  ): string {
    const state = useDocumentStore.getState();
    if (state.activeId !== options.documentId) beforeDocumentSwitch?.();
    loadScore(score, { ...options, mode: "tab" });
    const id = useDocumentStore.getState().activeId;
    if (handle) nativeFileHandles.current.set(id, handle);
    onDocumentOpened?.();
    return id;
  }

  function rememberScore(id: string, fileName: string, source: RecentScore["source"], payload: string) {
    const session = useDocumentStore.getState().getSession(id);
    if (!session) return;
    const { title, artist } = session.score.meta;
    const lastOpened = new Date().toISOString();
    void rememberRecentScore({ id, fileName, title: title || fileName, artist, source, lastOpened, payload }).catch(() => {});
  }

  async function handleOpenRecent(recent: RecentScore): Promise<void> {
    await navigate(async () => {
      try {
        const loaded = readScoreFile(recent.payload, { documentId: recent.id });
        openScore(loaded.score, { documentId: loaded.documentId, view: loaded.view });
        void rememberRecentScore(recent).catch(() => {});
        setFileIoStatus(`Opened ${recent.fileName}.`);
        return true;
      } catch (error) {
        openingError(error);
        return false;
      }
    });
  }

  async function handleOpenLocal(file: File): Promise<void> {
    await navigate(() => loadFileIntoScore(file));
  }

  function handleNewFile(options?: NewScoreOptions): void {
    void navigate(async () => {
      const nextScore = createEmptyScore();
      const defaultStylesheet = usePreferencesStore.getState().defaultStylesheet;
      if (defaultStylesheet) nextScore.stylesheet = structuredClone(defaultStylesheet);
      const preset = options ? instrumentById(options.instrumentId) : undefined;
      const tuning = options && TUNING_PRESETS.find(({ id, instrumentIds }) =>
        id === options.tuningId && instrumentIds.includes(options.instrumentId));
      if (options) {
        nextScore.masterBars[0].timeSignature = {
          ...nextScore.masterBars[0].timeSignature, numerator: options.beats, denominator: options.unit
        };
        nextScore.masterAutomations = [{
          type: "tempo", scope: "master", points: [{ tick: 0, value: options.tempo, transition: "constant" }]
        }];
      }
      nextScore.tracks.push(createTrack(preset ? {
        ...preset,
        strings: tuning ? [...tuning.strings] : [...preset.tuning],
        tuningLabel: tuning ? tuning.label : preset.tuningLabel
      } : undefined, nextScore.masterBars.length));
      openScore(nextScore);
      setFileIoStatus("Created a new untitled score.");
      closeFileIoPanel();
      return true;
    });
  }

  async function openDemo(demoScore: Score): Promise<boolean> {
    return navigate(async () => {
      openScore(demoScore);
      return true;
    });
  }

  async function handleOpenNativeFile(): Promise<void> {
    const picker = (window as BrowserFilePickerWindow).showOpenFilePicker;
    if (pendingNavigation.current) return;
    if (!picker) {
      requestFileLoad({ kind: "native" });
      return;
    }

    await navigate(async () => {
      try {
        const [handle] = await picker.call(window, {
          multiple: false,
          types: [
            {
              description: `${APP_NAME} score`,
              accept: { "application/json": NATIVE_FILE_ACCEPT }
            },
            { description: "MIDI", accept: { "audio/midi": [".mid", ".midi"] } }
          ]
        });
        return handle ? await loadFileIntoScore(await handle.getFile(), handle) : false;
      } catch (error) {
        if (!isAbortError(error)) {
          requestFileLoad({ kind: "native" }, "File access was unavailable. Choose a file using the browser picker.");
        }
        return false;
      }
    });
  }

  async function handleSaveNativeFile(): Promise<void> {
    await saveNativeScore(false);
  }

  async function handleSaveNativeFileAs(): Promise<void> {
    await saveNativeScore(true);
  }

  async function saveNativeScore(saveAs: boolean, id = useDocumentStore.getState().activeId): Promise<boolean> {
    const state = useDocumentStore.getState();
    const snapshot = state.getSession(id);
    if (saving.current || !snapshot) return false;
    saving.current = id;
    const view = snapshot.view;
    state.endEditGroup();
    const savedAt = new Date();
    const picker = (window as BrowserFilePickerWindow).showSaveFilePicker;
    let handle = saveAs ? null : nativeFileHandles.current.get(id) ?? null;
    const fileName = defaultExportName(snapshot.score, NATIVE_EXTENSION);

    try {
      if (!handle && picker) {
        handle = await picker.call(window, {
          suggestedName: fileName,
          types: [
            {
              description: `${APP_NAME} score`,
              accept: { "application/json": [NATIVE_EXTENSION] }
            }
          ]
        });
      }

      const destination = handle;
      return await withNativeBindings(async () => {
        if (destination) {
          const owner = await ownerOf(destination);
          if (owner && owner !== id) throw new Error("This file is open in another tab. Choose a different file to save to.");
        }
        const payload = writeScoreFile(snapshot.score, id, savedAt, view);
        const blob = new Blob([payload], { type: "application/json" });
        if (destination) {
          const writable = await destination.createWritable();
          try {
            await writable.write(blob);
            await writable.close();
          } catch (error) {
            await writable.abort?.().catch(() => {});
            throw error;
          }
        } else {
          downloadBlob(blob, fileName);
        }

        if (destination && useDocumentStore.getState().getSession(id)) nativeFileHandles.current.set(id, destination);
        useDocumentStore.getState().markSaved(id, snapshot.revision);
        const dirty = useDocumentStore.getState().documents.find((tab) => tab.id === id)?.dirty;
        const cleanupThrough = dirty ? savedAt : new Date();
        void discardRecoverySnapshot(id, cleanupThrough.toISOString()).catch(() => {});
        rememberScore(id, fileName, "Saved file", payload);
        setFileIoStatus(destination
          ? `Saved ${snapshot.score.meta.title || "Untitled Score"} as native ${NATIVE_EXTENSION}.`
          : `Downloaded a native ${NATIVE_EXTENSION} score.`);
        return true;
      });
    } catch (error) {
      if (!isAbortError(error)) {
        setFileIoStatus(errorMessage(error));
        openFileIoPanel();
      }
      return false;
    } finally {
      saving.current = null;
    }
  }

  function handleImportFile(format: ImportFormat): void {
    if (!pendingNavigation.current) requestFileLoad({ kind: "import", format });
  }

  async function handleExportFile(format: ExportFormat, pngScale?: PngScale): Promise<void> {
    try {
      if (format === "native") {
        await handleSaveNativeFileAs();
        return;
      }

      if (format === "ascii") {
        downloadBlob(
          new Blob([exportAsciiTab(score, activeTrackId ?? undefined)], { type: "text/plain" }),
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

      const exportScene = layoutScore(score, { displayMode: "vertical-page", concertTone: score.documentSettings.concertTone });

      if (format === "pdf") {
        setFileIoStatus("Choose ‘Save as PDF’ in the printer destination.");
        await printScore(exportScene, score.meta.title);
        return;
      }

      const { blob, extension, count } = await exportPageImages(exportScene, format, pngScale);
      downloadBlob(blob, defaultExportName(score, extension));
      setFileIoStatus(`Exported ${count} page(s) as ${format.toUpperCase()}.`);
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

    await navigate(() => loadFileIntoScore(file));
  }

  async function handleScoreDrop(event: DragEvent<HTMLDivElement>): Promise<void> {
    event.preventDefault();
    const file = event.dataTransfer.files[0];

    if (!file) {
      return;
    }

    await navigate(() => loadFileIntoScore(file));
  }

  function handleScoreDragOver(event: DragEvent<HTMLDivElement>): void {
    if (event.dataTransfer.types.includes("Files")) {
      event.preventDefault();
    }
  }

  function requestFileLoad(pending: PendingFileLoad, status = `Choose a ${pendingFileLabel(pending)} file.`): void {
    pendingFileLoadRef.current = pending;
    setFileIoStatus(status);

    if (!fileInputRef.current) {
      setFileIoStatus("The browser file input is not ready yet.");
      return;
    }

    fileInputRef.current.accept = acceptForPending(pending);
    fileInputRef.current.click();
  }

  async function loadFileIntoScore(
    file: File,
    handle: BrowserFileHandle | null = null
  ): Promise<boolean> {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const kind = sniffFileType(bytes, file.name);
      if (kind === "guitar-pro") {
        throw new Error(UNSUPPORTED_GUITAR_PRO_MESSAGE);
      }
      if (kind === "unknown") {
        throw new Error("This file is not a supported score, ASCII tab, MusicXML, or MIDI file.");
      }

      const text = kind === "midi" || kind === "mxl" ? "" : new TextDecoder().decode(bytes);
      const loaded = kind === "native" ? readScoreFile(text) : null;
      const xml = kind === "mxl" ? readCompressedMusicXml(bytes) : kind === "musicxml" ? readMusicXml(text) : null;
      const detectTriplets = kind === "midi" ? await chooseMidiGrid() : false;
      if (detectTriplets === null) return false;
      const nextScore = loaded?.score ?? xml?.score ??
        (kind === "midi" ? importMidi(bytes, { detectTriplets }) : importAsciiTab(text));
      if (!loaded) {
        const fatal = checkInvariants(nextScore).find((issue) => issue.severity === "fatal");
        if (fatal) throw new Error(`This score cannot be opened: ${fatal.message}`);
      }

      const hasCurrentExtension = file.name.toLowerCase().endsWith(NATIVE_EXTENSION);
      const warnings = [...(loaded?.warnings ?? []), ...(xml?.warnings ?? [])];
      if (loaded && LEGACY_NATIVE_EXTENSIONS.some((extension) => file.name.toLowerCase().endsWith(extension))) {
        warnings.push(`Save this score again with the ${NATIVE_EXTENSION} extension.`);
      }
      const nativeHandle = loaded && hasCurrentExtension ? handle : null;
      await withNativeBindings(async () => {
        const existing = nativeHandle && await ownerOf(nativeHandle);
        if (existing) {
          if (useDocumentStore.getState().activeId !== existing) {
            beforeDocumentSwitch?.();
            useDocumentStore.getState().selectDocument(existing);
          }
          onDocumentOpened?.();
          return;
        }
        // Save As and filesystem copies can have the same embedded ID at different paths.
        const newId = loaded && !useDocumentStore.getState().getSession(loaded.documentId) ? loaded.documentId : undefined;
        const opened = openScore(nextScore, { documentId: newId, view: loaded?.view }, nativeHandle);
        const payload = writeScoreFile(nextScore, opened, new Date(), loaded?.view);
        rememberScore(opened, file.name, "Opened file", payload);
        if (loaded?.savedAt && opened === loaded.documentId) {
          void discardRecoverySnapshot(opened, loaded.savedAt).catch(() => {});
        }
      });
      setFileIoStatus([`Loaded ${file.name} as ${formatLabel(kind === "mxl" ? "musicxml" : kind)}.`, ...warnings].join(" "));
      if (warnings.length) {
        openFileIoPanel();
      } else {
        closeFileIoPanel();
      }
      return true;
    } catch (error) {
      setFileIoStatus(errorMessage(error));
      openFileIoPanel();
      return false;
    }
  }

  return {
    fileIoStatus,
    fileInputRef,
    midiImportOpen,
    resolveMidiImport,
    unsavedConfirmationOpen,
    resolveUnsavedChoice,
    openDemo,
    handleNewFile,
    handleOpenRecent,
    handleOpenLocal,
    handleSelectDocument,
    handleCloseDocument,
    handleSaveDocument: (id) => saveNativeScore(false, id),
    handleOpenNativeFile,
    handleSaveNativeFile,
    handleSaveNativeFileAs,
    handleImportFile,
    handleExportFile,
    handleFileInputChange,
    handleScoreDrop,
    handleScoreDragOver
  };
}

function acceptForPending(pending: PendingFileLoad): string {
  if (pending.kind === "native") {
    return [...NATIVE_FILE_ACCEPT, "application/json", ".mid", ".midi", "audio/midi"].join(",");
  }

  switch (pending.format) {
    case "ascii":
      return ".txt,.tab,text/plain";
    case "musicxml":
      return ".musicxml,.xml,.mxl,application/xml,text/xml";
    case "midi":
      return ".mid,.midi,audio/midi,audio/x-midi";
  }
}

function pendingFileLabel(pending: PendingFileLoad): string {
  return pending.kind === "native" ? formatLabel("native") : formatLabel(pending.format);
}

/** Maps free-text palette input (e.g. "gp", "xml", "midi") to the import
 * format it should route to. Pure and exported for unit testing the
 * text→format→handler mapping used by `import <text>` in the Command
 * Palette. */
export function importFormatFromText(value: string): ImportFormat | "native" | null {
  const token = normalizedFormatToken(value);

  if (!token) return null;
  if (isNativeFormatToken(token)) return "native";
  if (["ascii", "asciitab", "tab", "txt", "text"].includes(token)) return "ascii";
  if (["musicxml", "xml", "mxl"].includes(token)) return "musicxml";
  if (["midi", "mid", "smf"].includes(token)) return "midi";
  return null;
}

/** Maps free-text palette input to the export format it should route to.
 * Pure and exported for unit testing the text→format→handler mapping used
 * by `export <text>` in the Command Palette. */
export function exportFormatFromText(value: string): ExportFormat | null {
  const token = normalizedFormatToken(value);

  if (!token) return null;
  if (isNativeFormatToken(token)) return "native";
  if (["ascii", "asciitab", "tab", "txt", "text"].includes(token)) return "ascii";
  if (["musicxml", "xml", "mxl"].includes(token)) return "musicxml";
  if (["midi", "mid", "smf"].includes(token)) return "midi";
  if (token === "svg") return "svg";
  if (token === "png") return "png";
  if (token === "pdf") return "pdf";
  return null;
}

function isNativeFormatToken(token: string): boolean {
  return ["native", "json", "score", NATIVE_EXTENSION, ...LEGACY_NATIVE_EXTENSIONS]
    .some((format) => normalizedFormatToken(format) === token);
}

function normalizedFormatToken(value: string): string {
  return value.trim().toLowerCase().replace(/[\s._-]+/g, "");
}

/** Exported for the command controller's palette messages
 * ("Import MusicXML", "Export PDF", ...). */
export function formatLabel(format: ImportFormat | ExportFormat | "native"): string {
  switch (format) {
    case "native":
      return `Native ${NATIVE_EXTENSION}`;
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

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The file operation failed.";
}
