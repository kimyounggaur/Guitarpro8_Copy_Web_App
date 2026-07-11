// Command controller — the Command Palette free-text grammar interpreter
// (`handleCommandPaletteSubmit` and everything it delegates to) plus
// `runMenuAction`/`runAppAction`/`dispatchEditorCommand`.
//
// Extracted from src/App.tsx (see docs/ui-remaster/00-component-map.md §1,
// rows App.tsx:820-1375 and App.tsx:561-568, plus the command-registry
// bootstrap at App.tsx:95-96) as part of Phase 2's structural-only
// refactor. Behavior is unchanged from the original, including command ids
// (unchanged) and the `runAppAction`/`handleCommandPaletteSubmit` grammar.
//
// The grammar interpreter itself (`runAppAction`, `handleCommandPaletteSubmit`
// and friends) is written as plain, dependency-injected functions rather
// than closures defined inside the hook body. This keeps them unit
// testable without rendering a React component or a store — see
// useCommandController.test.ts — while the hook (`useCommandController`)
// stays a thin adapter that builds the `CommandControllerDeps` bag from
// live props/store values each render, exactly mirroring how these
// functions closed over `score`/`cursor`/etc. in the original App.tsx.
//
// The "leaf" grammar functions (jumpToSection, addBarsFromPalette, etc. —
// the ones that don't call back into this dispatcher) live in
// ./paletteGrammar.ts, split out once this file crossed the master
// prompt's ~500-line-per-controller guideline.
import { useMemo } from "react";
import { ensureDemoCommandsRegistered } from "../../commands/demoCommands";
import { ensureEditingCommandsRegistered, type EditorCommandContext } from "../../commands/editingCommands";
import { findMenuAction, paletteEntryByPrefix, parsePaletteInput } from "../../commands/paletteCommands";
import { executeCommand, getAllCommands, type Command } from "../../commands/registry";
import { normaliseCursor } from "../../engine/editing/operations";
import type { CursorPosition, SelectionRange } from "../../engine/editing/types";
import type { BeatDuration, DisplayMode, Score } from "../../model/types";
import type { PanelVisibility } from "../../store/preferencesStore";
import type { CommandPaletteResult } from "../../ui/shell/CommandPalette";
import type { ExportFormat, ImportFormat } from "../../ui/shell/FileIoPanel";
import type { ToolPanelId } from "../../ui/shell/ToolPanels";
import type { TrackPanelId } from "../../ui/shell/TrackSystemPanels";
import { ensureBeatAtCursor } from "./scoreEditingUtils";
import {
  addBarsFromPalette,
  applyPatternFromPalette,
  changeViewFromPalette,
  exportFromPalette,
  importFromPalette,
  jumpToBar,
  jumpToSection,
  repeatBarsFromPalette,
  runExpressionText,
  setTimeSignatureFromPalette,
  unsetPaletteEffect,
  zoomFromPalette
} from "./paletteGrammar";

export interface UseCommandControllerParams {
  score: Score;
  cursor: CursorPosition;
  selection: SelectionRange | null;
  transact: (label: string, recipe: (draft: Score) => void) => Score;
  setCursor: (cursor: CursorPosition) => void;
  setSelection: (selection: SelectionRange | null) => void;
  editWithCursor: (label: string, recipe: (draft: Score) => CursorPosition) => void;
  editorContext: EditorCommandContext;
  handleZoomChange: (zoom: number) => void;
  handleDisplayModeChange: (mode: DisplayMode) => void;
  handleVoiceSelect: (voiceIndex: number) => void;
  handleToggleMultiVoice: () => void;
  handleToggleMultiTrackView: () => void;
  handleTrackDelete: (trackId: string) => void;
  handleNewFile: () => void;
  handleOpenNativeFile: () => Promise<void>;
  handleSaveNativeFile: () => Promise<void>;
  handleSaveNativeFileAs: () => Promise<void>;
  handleImportFile: (format: ImportFormat) => void;
  handleExportFile: (format: ExportFormat) => Promise<void>;
  setActiveToolPanel: (tool: ToolPanelId | null) => void;
  setActiveTrackPanel: (panel: TrackPanelId | null) => void;
  openStylesheetPanel: () => void;
  openFileIoPanel: () => void;
  openCommandPalette: (initialValue?: string) => void;
  togglePanel: (panel: keyof PanelVisibility) => void;
}

/** Dependency bag consumed by the pure grammar-interpreter functions below
 * (here and in ./paletteGrammar.ts). Identical in shape to
 * `UseCommandControllerParams` plus the derived `dispatchEditorCommand` —
 * kept as a separate type so the pure functions' signatures don't imply
 * they take React-hook params. */
export interface CommandControllerDeps extends UseCommandControllerParams {
  dispatchEditorCommand: (commandId: string) => void;
}

export interface CommandController {
  dispatchEditorCommand: (commandId: string) => void;
  handleCommandPaletteSubmit: (input: string) => CommandPaletteResult;
  registeredCommands: Array<Command<EditorCommandContext>>;
}

export function useCommandController(params: UseCommandControllerParams): CommandController {
  ensureDemoCommandsRegistered();
  ensureEditingCommandsRegistered();

  const dispatchEditorCommand = (commandId: string): void => {
    executeCommand(commandId, params.editorContext);
  };

  const deps: CommandControllerDeps = { ...params, dispatchEditorCommand };

  const registeredCommands = useMemo(
    () => getAllCommands(params.editorContext),
    [params.editorContext]
  );

  return {
    dispatchEditorCommand,
    handleCommandPaletteSubmit: (input) => handleCommandPaletteSubmit(deps, input),
    registeredCommands
  };
}

export function handleCommandPaletteSubmit(deps: CommandControllerDeps, input: string): CommandPaletteResult {
  const parsed = parsePaletteInput(input);

  if (!input.trim() || input.trim() === "?") {
    return { handled: false, message: "Type a prefix or choose a command.", keepOpen: true };
  }

  if (parsed.mode === "action") {
    return runMenuAction(deps, parsed.args);
  }

  if (parsed.mode === "expression") {
    return runExpressionText(deps, parsed.args);
  }

  if (parsed.mode === "section") {
    return jumpToSection(deps, parsed.args);
  }

  if (parsed.mode === "bar") {
    return jumpToBar(deps, parsed.args);
  }

  if (parsed.mode === "unset") {
    return unsetPaletteEffect(deps, parsed.args);
  }

  const timeSignature = /^(\d{1,2})\/(1|2|4|8|16|32|64)$/.exec(input.trim());

  if (timeSignature) {
    return setTimeSignatureFromPalette(deps, Number(timeSignature[1]), Number(timeSignature[2]) as BeatDuration);
  }

  const entry = paletteEntryByPrefix(parsed.prefix);

  if (entry?.kind === "quick") {
    return runQuickPaletteCommand(deps, entry.commandId ?? entry.prefix);
  }

  if (parsed.prefix === "add-bar" || parsed.prefix === "insert-bars") {
    return addBarsFromPalette(deps, parsed.args, parsed.prefix === "insert-bars");
  }

  if (parsed.prefix === "x") {
    return repeatBarsFromPalette(deps, parsed.args);
  }

  if (parsed.prefix === "pickstroke" || parsed.prefix === "brush" || parsed.prefix === "arpeggio" || parsed.prefix === "wah" || parsed.prefix === "slap-pop") {
    return applyPatternFromPalette(deps, parsed.prefix, parsed.args);
  }

  if (parsed.prefix === "voice") {
    const voice = Number(parsed.args);

    if (voice >= 1 && voice <= 4) {
      deps.handleVoiceSelect(voice - 1);
      return { handled: true, message: `Voice ${voice}` };
    }
  }

  if (parsed.prefix === "import") {
    return importFromPalette(deps, parsed.args);
  }

  if (parsed.prefix === "export") {
    return exportFromPalette(deps, parsed.args);
  }

  if (parsed.prefix === "view") {
    return changeViewFromPalette(deps, parsed.args);
  }

  if (parsed.prefix === "zoom") {
    return zoomFromPalette(deps, parsed.args);
  }

  const command = getAllCommands(deps.editorContext).find(
    (candidate) =>
      candidate.id === input.trim() ||
      candidate.label.toLowerCase() === input.trim().toLowerCase()
  );

  if (command) {
    deps.dispatchEditorCommand(command.id);
    return { handled: true, message: command.label };
  }

  return { handled: false, message: `No command matched "${input}".`, keepOpen: true };
}

export function runMenuAction(deps: CommandControllerDeps, query: string): CommandPaletteResult {
  const action = findMenuAction(query);

  if (!action) {
    return { handled: false, message: "Action not found.", keepOpen: true };
  }

  if (action.commandId) {
    try {
      deps.dispatchEditorCommand(action.commandId);
      return { handled: true, message: action.label };
    } catch {
      return { handled: false, message: `${action.label} is not available here.`, keepOpen: true };
    }
  }

  if (action.paletteInput) {
    return handleCommandPaletteSubmit(deps, action.paletteInput);
  }

  return runAppAction(deps, action.appAction ?? action.id, action.label);
}

/** Routes a `MENU_TREE` `appAction` string (or a bare quick-command
 * fallback) to the App-level side effect it names. Exported and kept pure
 * so it can be unit tested directly — see useCommandController.test.ts. */
export function runAppAction(deps: CommandControllerDeps, action: string, label = action): CommandPaletteResult {
  switch (action) {
    case "file.new":
      deps.handleNewFile();
      return { handled: true, message: label };
    case "file.open":
      void deps.handleOpenNativeFile();
      return { handled: true, message: label };
    case "file.save":
      void deps.handleSaveNativeFile();
      return { handled: true, message: label };
    case "file.saveAs":
      void deps.handleSaveNativeFileAs();
      return { handled: true, message: label };
    case "file.import":
      deps.openFileIoPanel();
      return { handled: true, message: "Import" };
    case "file.import.ascii":
      deps.handleImportFile("ascii");
      return { handled: true, message: "Import ASCII" };
    case "file.import.musicxml":
      deps.handleImportFile("musicxml");
      return { handled: true, message: "Import MusicXML" };
    case "file.import.midi":
      deps.handleImportFile("midi");
      return { handled: true, message: "Import MIDI" };
    case "file.export":
      deps.openFileIoPanel();
      return { handled: true, message: "Export" };
    case "file.export.native":
      void deps.handleExportFile("native");
      return { handled: true, message: "Export native" };
    case "file.export.ascii":
      void deps.handleExportFile("ascii");
      return { handled: true, message: "Export ASCII" };
    case "file.export.musicxml":
      void deps.handleExportFile("musicxml");
      return { handled: true, message: "Export MusicXML" };
    case "file.export.midi":
      void deps.handleExportFile("midi");
      return { handled: true, message: "Export MIDI" };
    case "file.export.svg":
      void deps.handleExportFile("svg");
      return { handled: true, message: "Export SVG" };
    case "file.export.png":
      void deps.handleExportFile("png");
      return { handled: true, message: "Export PNG" };
    case "file.export.pdf":
      void deps.handleExportFile("pdf");
      return { handled: true, message: "Export PDF" };
    case "file.print":
      window.print();
      return { handled: true, message: "Print" };
    case "layout.forceBreak": {
      const nextScore = deps.transact("Force break line", (draft) => {
        const masterBar = draft.masterBars[deps.cursor.barIndex];
        if (masterBar) {
          masterBar.layout.forcedBreak = !masterBar.layout.forcedBreak;
          masterBar.layout.preventBreak = false;
        }
      });
      deps.setCursor(normaliseCursor(nextScore, deps.cursor));
      return { handled: true, message: label };
    }
    case "layout.preventBreak": {
      const nextScore = deps.transact("Prevent break line", (draft) => {
        const masterBar = draft.masterBars[deps.cursor.barIndex];
        if (masterBar) {
          masterBar.layout.preventBreak = !masterBar.layout.preventBreak;
          masterBar.layout.forcedBreak = false;
        }
      });
      deps.setCursor(normaliseCursor(nextScore, deps.cursor));
      return { handled: true, message: label };
    }
    case "tools.timer": {
      const nextScore = deps.transact("Toggle timer", (draft) => {
        const beat = ensureBeatAtCursor(draft, deps.cursor);
        if (beat) {
          beat.timer = !beat.timer;
        }
      });
      deps.setCursor(normaliseCursor(nextScore, deps.cursor));
      return { handled: true, message: label };
    }
    case "bar.symbol.doubleSimile": {
      const nextScore = deps.transact("Double simile", (draft) => {
        const masterBar = draft.masterBars[deps.cursor.barIndex];
        if (masterBar) {
          masterBar.simileMark = masterBar.simileMark === "double" ? "none" : "double";
        }
      });
      deps.setCursor(normaliseCursor(nextScore, deps.cursor));
      return { handled: true, message: label };
    }
    case "bar.symbol.multirest": {
      const nextScore = deps.transact("Multirest", (draft) => {
        const masterBar = draft.masterBars[deps.cursor.barIndex];
        if (masterBar) {
          masterBar.simileMark = masterBar.simileMark === "single" ? "none" : "single";
        }
      });
      deps.setCursor(normaliseCursor(nextScore, deps.cursor));
      return { handled: true, message: label };
    }
    case "track.add":
      deps.setActiveTrackPanel("wizard");
      return { handled: true, message: label };
    case "track.delete":
      if (deps.cursor.trackId) {
        deps.handleTrackDelete(deps.cursor.trackId);
        return { handled: true, message: label };
      }
      break;
    case "track.tuning":
      deps.setActiveTrackPanel("tuning");
      return { handled: true, message: label };
    case "voice.toggleMulti":
      deps.handleToggleMultiVoice();
      deps.setActiveTrackPanel("voices");
      return { handled: true, message: label };
    case "tools.commandPalette":
      deps.openCommandPalette("");
      return { handled: true, message: label, keepOpen: true };
    case "tools.chords":
      deps.setActiveToolPanel("chords");
      return { handled: true, message: label };
    case "tools.scales":
      deps.setActiveToolPanel("scales");
      return { handled: true, message: label };
    case "tools.transpose":
      deps.setActiveToolPanel("transpose");
      return { handled: true, message: label };
    case "tools.cleanup":
      deps.setActiveToolPanel("cleanup");
      return { handled: true, message: label };
    case "tools.instrument":
      deps.setActiveToolPanel("instrument");
      return { handled: true, message: label };
    case "panels.palette":
      deps.togglePanel("palette");
      return { handled: true, message: label };
    case "panels.songInspector":
      deps.togglePanel("songInspector");
      return { handled: true, message: label };
    case "panels.trackInspector":
      deps.togglePanel("trackInspector");
      return { handled: true, message: label };
    case "panels.globalView":
      deps.togglePanel("globalView");
      return { handled: true, message: label };
    case "panels.automation":
      deps.togglePanel("automationView");
      return { handled: true, message: label };
    case "view.multitrack":
      deps.handleToggleMultiTrackView();
      return { handled: true, message: label };
    case "view.stylesheet":
      deps.openStylesheetPanel();
      return { handled: true, message: label };
    case "view.zoomIn":
      deps.handleZoomChange(deps.score.documentSettings.zoom + 10);
      return { handled: true, message: label };
    case "view.zoomOut":
      deps.handleZoomChange(deps.score.documentSettings.zoom - 10);
      return { handled: true, message: label };
    default:
      break;
  }

  return { handled: false, message: `${label} is not implemented yet.`, keepOpen: true };
}

function runQuickPaletteCommand(deps: CommandControllerDeps, commandIdOrAction: string): CommandPaletteResult {
  if (commandIdOrAction.includes(".")) {
    try {
      deps.dispatchEditorCommand(commandIdOrAction);
      return { handled: true, message: commandIdOrAction };
    } catch {
      return runAppAction(deps, commandIdOrAction);
    }
  }

  return runAppAction(deps, commandIdOrAction);
}
