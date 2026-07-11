// File I/O controller — File System Access API, the hidden <input> fallback,
// import/export/download, and score drag & drop.
//
// Extracted from src/App.tsx (see docs/ui-remaster/00-component-map.md §1,
// row App.tsx:570-818, plus the module-level format/download/error helpers
// at App.tsx:2135-2283) as part of Phase 2's structural-only refactor.
// Behavior is unchanged from the original.
import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { defaultCursor } from "../../engine/editing/operations";
import type { CursorPosition, SelectionRange } from "../../engine/editing/types";
import { layoutScore } from "../../engine/layout/layoutScore";
import { exportAsciiTab, importAsciiTab } from "../../io/asciiTab";
import { defaultExportName } from "../../io/exportNames";
import { exportMidi, importMidi } from "../../io/midi";
import { exportMusicXml, importMusicXml } from "../../io/musicXml";
import { parseNativeScore, serializeNativeScore } from "../../io/nativeScore";
import { sceneToPdf } from "../../io/pdfExport";
import { sceneFirstPageSvg, sceneToSvgDocument } from "../../io/vectorExport";
import { createEmptyScore, createTrack } from "../../model/factory";
import type { Score } from "../../model/types";
import type { ExportFormat, ImportFormat } from "../../ui/shell/FileIoPanel";

export interface BrowserFileHandle {
  getFile: () => Promise<File>;
  createWritable: () => Promise<{ write: (blob: Blob) => Promise<void>; close: () => Promise<void> }>;
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
  loadScore: (score: Score) => void;
  setSelection: (selection: SelectionRange | null) => void;
  setCursor: (cursor: CursorPosition) => void;
  openFileIoPanel: () => void;
  closeFileIoPanel: () => void;
}

export interface FileController {
  fileIoStatus: string;
  fileInputRef: React.RefObject<HTMLInputElement>;
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
    "Native .gp, ASCII, MusicXML, MIDI, SVG, PNG, and PDF are ready."
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingFileLoadRef = useRef<PendingFileLoad | null>(null);
  const nativeFileHandleRef = useRef<BrowserFileHandle | null>(null);

  function handleNewFile(): void {
    const nextScore = createEmptyScore();
    nextScore.tracks.push(createTrack(undefined, nextScore.masterBars.length));
    nativeFileHandleRef.current = null;
    loadScore(nextScore);
    setSelection(null);
    setCursor(defaultCursor(nextScore));
    setFileIoStatus("Created a new untitled score.");
    closeFileIoPanel();
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
      openFileIoPanel();
      return;
    }

    openFileIoPanel();
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
      closeFileIoPanel();
    } catch (error) {
      setFileIoStatus(errorMessage(error));
      openFileIoPanel();
    }
  }

  async function writeNativeScore(handle: BrowserFileHandle): Promise<void> {
    const writable = await handle.createWritable();
    await writable.write(new Blob([serializeNativeScore(score)], { type: "application/json" }));
    await writable.close();
  }

  return {
    fileIoStatus,
    fileInputRef,
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

/** Maps free-text palette input (e.g. "gp", "xml", "midi") to the import
 * format it should route to. Pure and exported for unit testing the
 * text→format→handler mapping used by `import <text>` in the Command
 * Palette. */
export function importFormatFromText(value: string): ImportFormat | "native" | null {
  const token = normalizedFormatToken(value);

  if (!token) return null;
  if (["native", "gp", "gp8", "json", "score"].includes(token)) return "native";
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

/** Exported for the command controller's palette messages
 * ("Import MusicXML", "Export PDF", ...). */
export function formatLabel(format: ImportFormat | ExportFormat | "native"): string {
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
