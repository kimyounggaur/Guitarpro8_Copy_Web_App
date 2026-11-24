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
import { discardRecoverySnapshot } from "../../store/autosave";
import { useDocumentStore, type LoadScoreOptions } from "../../store/documentStore";
import type { UnsavedChoice } from "../../ui/overlays/UnsavedChangesDialog";
import type { ExportFormat, ImportFormat } from "../../ui/shell/FileIoPanel";

export interface BrowserFileHandle {
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
  multiVoiceEdit: boolean;
  loadScore: (score: Score, options?: LoadScoreOptions) => void;
  setSelection: (selection: SelectionRange | null) => void;
  setCursor: (cursor: CursorPosition) => void;
  openFileIoPanel: () => void;
  closeFileIoPanel: () => void;
}

export interface FileController {
  fileIoStatus: string;
  fileInputRef: React.RefObject<HTMLInputElement>;
  unsavedConfirmationOpen: boolean;
  resolveUnsavedChoice: (choice: UnsavedChoice) => void;
  openDemo: (score: Score) => Promise<boolean>;
  handleNewFile: () => void;
  handleOpenNativeFile: () => Promise<void>;
  handleSaveNativeFile: () => Promise<void>;
  handleSaveNativeFileAs: () => Promise<void>;
  handleImportFile: (format: ImportFormat) => void;
  handleExportFile: (format: ExportFormat) => Promise<void>;
  handleFileInputChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleScoreDrop: (event: DragEvent<HTMLDivElement>) => Promise<void>;
  handleScoreDragOver: (event: DragEvent<HTMLDivElement>) => void;
}

export function useFileController(params: UseFileControllerParams): FileController {
  const { score, activeTrackId, multiVoiceEdit, loadScore, setSelection, setCursor, openFileIoPanel, closeFileIoPanel } =
    params;

  const [fileIoStatus, setFileIoStatus] = useState(
    `Native ${NATIVE_EXTENSION}, ASCII, MusicXML, MIDI, SVG, PNG, and PDF are ready.`
  );
  const [unsavedConfirmationOpen, setUnsavedConfirmationOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingFileLoadRef = useRef<PendingFileLoad | null>(null);
  const nativeFileHandleRef = useRef<BrowserFileHandle | null>(null);
  const unsavedChoice = useRef<((choice: UnsavedChoice) => void) | null>(null);
  const pendingNavigation = useRef(false);
  const saving = useRef(false);
  const loadingGeneration = useRef(0);

  useEffect(() => () => unsavedChoice.current?.("cancel"), []);

  function resolveUnsavedChoice(choice: UnsavedChoice): void {
    const resolve = unsavedChoice.current;
    unsavedChoice.current = null;
    setUnsavedConfirmationOpen(false);
    resolve?.(choice);
  }

  async function confirmDiscardIfDirty(): Promise<boolean> {
    const state = useDocumentStore.getState();
    if (!state.dirty) return true;
    if (unsavedChoice.current) return false;

    const choice = await new Promise<UnsavedChoice>((resolve) => {
      unsavedChoice.current = resolve;
      setUnsavedConfirmationOpen(true);
    });
    if (choice === "cancel") return false;
    if (choice === "save") {
      return await saveNativeScore(false) && !useDocumentStore.getState().dirty;
    }

    const discarded = useDocumentStore.getState();
    void discardRecoverySnapshot(discarded.activeId, new Date().toISOString()).catch(() => {});
    return true;
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

  function replaceScore(
    score: Score,
    options: LoadScoreOptions = {},
    handle: BrowserFileHandle | null = null
  ) {
    loadingGeneration.current++;
    nativeFileHandleRef.current = handle;
    loadScore(score, options);
    setSelection(null);
    setCursor(defaultCursor(score));
  }

  function handleNewFile(): void {
    void navigate(async () => {
      if (!await confirmDiscardIfDirty()) return false;
      const nextScore = createEmptyScore();
      nextScore.tracks.push(createTrack(undefined, nextScore.masterBars.length));
      replaceScore(nextScore);
      setFileIoStatus("Created a new untitled score.");
      closeFileIoPanel();
      return true;
    });
  }

  async function openDemo(demoScore: Score): Promise<boolean> {
    return navigate(async () => {
      if (!await confirmDiscardIfDirty()) return false;
      replaceScore(demoScore);
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
            }
          ]
        });
        return handle ? await loadFileIntoScore(await handle.getFile(), handle) : false;
      } catch (error) {
        if (!isAbortError(error)) {
          setFileIoStatus(errorMessage(error));
          openFileIoPanel();
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

  async function saveNativeScore(saveAs: boolean): Promise<boolean> {
    if (saving.current) return false;
    saving.current = true;
    const snapshot = useDocumentStore.getState();
    const generation = loadingGeneration.current;
    const savedAt = new Date();
    const picker = (window as BrowserFilePickerWindow).showSaveFilePicker;
    let handle = saveAs ? null : nativeFileHandleRef.current;

    try {
      if (!handle && picker) {
        handle = await picker.call(window, {
          suggestedName: defaultExportName(snapshot.score, NATIVE_EXTENSION),
          types: [
            {
              description: `${APP_NAME} score`,
              accept: { "application/json": [NATIVE_EXTENSION] }
            }
          ]
        });
      }

      const blob = new Blob(
        [writeScoreFile(snapshot.score, snapshot.activeId, savedAt)],
        { type: "application/json" }
      );
      if (handle) {
        const writable = await handle.createWritable();
        try {
          await writable.write(blob);
          await writable.close();
        } catch (error) {
          await writable.abort?.().catch(() => {});
          throw error;
        }
      } else {
        downloadBlob(blob, defaultExportName(snapshot.score, NATIVE_EXTENSION));
      }

      if (generation !== loadingGeneration.current) return false;
      nativeFileHandleRef.current = handle;
      useDocumentStore.getState().markSaved(snapshot.activeId, snapshot.revision);
      const current = useDocumentStore.getState();
      const cleanupThrough = current.dirty ? savedAt : new Date();
      void discardRecoverySnapshot(snapshot.activeId, cleanupThrough.toISOString()).catch(() => {});
      setFileIoStatus(handle
        ? `Saved ${snapshot.score.meta.title || "Untitled Score"} as native ${NATIVE_EXTENSION}.`
        : `Downloaded a native ${NATIVE_EXTENSION} score.`);
      return true;
    } catch (error) {
      if (!isAbortError(error)) {
        setFileIoStatus(errorMessage(error));
        openFileIoPanel();
      }
      return false;
    } finally {
      saving.current = false;
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

      const exportScene = layoutScore({
        ...score,
        documentSettings: { ...score.documentSettings, displayMode: "vertical-page", zoom: 100 }
      }, { concertTone: score.documentSettings.concertTone, multiVoiceEdit });

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
      const nextScore = loaded?.score ?? xml?.score ?? (kind === "midi" ? importMidi(bytes) : importAsciiTab(text));
      if (!loaded) {
        const fatal = checkInvariants(nextScore).find((issue) => issue.severity === "fatal");
        if (fatal) throw new Error(`This score cannot be opened: ${fatal.message}`);
      }
      if (!await confirmDiscardIfDirty()) return false;

      const hasCurrentExtension = file.name.toLowerCase().endsWith(NATIVE_EXTENSION);
      const warnings = [...(loaded?.warnings ?? []), ...(xml?.warnings ?? [])];
      if (loaded && LEGACY_NATIVE_EXTENSIONS.some((extension) => file.name.toLowerCase().endsWith(extension))) {
        warnings.push(`Save this score again with the ${NATIVE_EXTENSION} extension.`);
      }
      replaceScore(nextScore, loaded ? { documentId: loaded.documentId } : {}, loaded && hasCurrentExtension ? handle : null);
      if (loaded?.savedAt) {
        void discardRecoverySnapshot(loaded.documentId, loaded.savedAt).catch(() => {});
      }
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
    unsavedConfirmationOpen,
    resolveUnsavedChoice,
    openDemo,
    handleNewFile,
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
    return [...NATIVE_FILE_ACCEPT, "application/json"].join(",");
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
