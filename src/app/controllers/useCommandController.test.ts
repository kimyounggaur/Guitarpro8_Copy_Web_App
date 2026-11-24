import { useViewStore } from "../../store/viewStore";
import { describe, expect, it, vi } from "vitest";
import { defaultCursor } from "../../engine/editing/operations";
import { createEmptyScore, createTrack } from "../../model/factory";
import { ensureEditingCommandsRegistered, type EditorCommandContext } from "../../commands/editingCommands";
import { getAllCommands, executeCommand, type Command } from "../../commands/registry";
import { paletteInputForEntry, suggestPaletteEntries, type PaletteEntry } from "../../commands/paletteCommands";
import { handleCommandPaletteSubmit, runAppAction, type CommandControllerDeps } from "./useCommandController";

// runAppAction is the App-action router behind the Command Palette's
// Action-List mode and the (currently inert) application menu — see
// docs/ui-remaster/00-component-map.md §3/§6. It is deliberately a pure,
// dependency-injected function so it can be tested here without rendering
// EditorShell/App or touching zustand stores.
function createDeps(overrides: Partial<CommandControllerDeps> = {}): CommandControllerDeps {
  const score = createEmptyScore();
  score.tracks.push(createTrack(undefined, score.masterBars.length));
  const cursor = defaultCursor(score);

  return {
    score,
    cursor,
    selection: null,
    transact: vi.fn((_label: string, recipe: (draft: typeof score) => void) => {
      const draft = structuredClone(score);
      recipe(draft);
      return draft;
    }),
    setCursor: vi.fn(),
    setSelection: vi.fn(),
    editWithCursor: vi.fn(),
    // Unused by any routing branch under test — every branch exercised
    // here dispatches through the injected mocks below instead of the
    // real command registry, so an empty stand-in is safe.
    editorContext: {} as EditorCommandContext,
    dispatchEditorCommand: vi.fn(),
    handleZoomChange: vi.fn(),
    handleDisplayModeChange: vi.fn(),
    handleVoiceSelect: vi.fn(),
    handleToggleMultiVoice: vi.fn(),
    handleToggleMultiTrackView: vi.fn(),
    handleTrackDelete: vi.fn(),
    handleNewFile: vi.fn(),
    handleOpenNativeFile: vi.fn(async () => {}),
    handleSaveNativeFile: vi.fn(async () => {}),
    handleSaveNativeFileAs: vi.fn(async () => {}),
    handleImportFile: vi.fn(),
    handleExportFile: vi.fn(async () => {}),
    setActiveToolPanel: vi.fn(),
    setActiveTrackPanel: vi.fn(),
    openStylesheetPanel: vi.fn(),
    openFileIoPanel: vi.fn(),
    openCommandPalette: vi.fn(),
    togglePanel: vi.fn(),
    ...overrides
  };
}

describe("runAppAction (command controller app-action routing)", () => {
  it("routes file.new to handleNewFile and reports the action id as the message when no label is given", () => {
    const deps = createDeps();

    const result = runAppAction(deps, "file.new");

    expect(deps.handleNewFile).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ handled: true, message: "file.new" });
  });

  it("routes voice.toggleMulti to both handleToggleMultiVoice and opening the voices track panel", () => {
    const deps = createDeps();

    const result = runAppAction(deps, "voice.toggleMulti", "Multi-voice");

    expect(deps.handleToggleMultiVoice).toHaveBeenCalledTimes(1);
    expect(deps.setActiveTrackPanel).toHaveBeenCalledWith("voices");
    expect(result).toEqual({ handled: true, message: "Multi-voice" });
  });

  it("routes view.zoomIn to handleZoomChange with the view's current zoom plus 10", () => {
    const deps = createDeps();

    runAppAction(deps, "view.zoomIn");

    expect(deps.handleZoomChange).toHaveBeenCalledWith(useViewStore.getState().zoom + 10);
  });

  it("routes track.delete to handleTrackDelete only when the cursor has an active track", () => {
    const deps = createDeps({ cursor: { ...createDeps().cursor, trackId: null } });

    const result = runAppAction(deps, "track.delete", "Delete track");

    expect(deps.handleTrackDelete).not.toHaveBeenCalled();
    expect(result).toEqual({ handled: false, message: "Delete track is not implemented yet.", keepOpen: true });
  });

  it("falls back to 'not implemented yet' for an action with no matching case, without calling any handler", () => {
    const deps = createDeps();

    const result = runAppAction(deps, "totally.unknown.action", "Mystery Action");

    expect(result).toEqual({
      handled: false,
      message: "Mystery Action is not implemented yet.",
      keepOpen: true
    });
    expect(deps.handleNewFile).not.toHaveBeenCalled();
    expect(deps.setActiveToolPanel).not.toHaveBeenCalled();
  });
});

describe("[C2] displayed palette commands have working submission routes", () => {
  const argumentsByPrefix: Record<string, string> = {
    "$": " Intro",
    ":": " 1",
    "@": " View > Zoom In",
    "add-bar": " 1",
    arpeggio: " du",
    brush: " du",
    export: " ascii",
    import: " ascii",
    "insert-bars": " 1",
    pickstroke: " du",
    "slap-pop": " sp",
    unset: " Tie",
    view: " vertical-page",
    voice: " 2",
    wah: " oc",
    x: " 1",
    zoom: " 150"
  };

  function entryInput(entry: PaletteEntry): string {
    const input = paletteInputForEntry(entry);
    if (entry.requiresArgument && input !== "4/4") {
      const argument = argumentsByPrefix[entry.prefix];
      if (!argument) throw new Error(`Missing test argument for ${entry.prefix}`);
      return input + argument;
    }
    return input;
  }

  ensureEditingCommandsRegistered();
  for (const staffKind of ["tab", "standard"] as const) {
    const calls = new Map<PropertyKey, ReturnType<typeof vi.fn>>();
    const editorContext = new Proxy({ staffKind, playbackStatus: "stopped" } as EditorCommandContext, {
      get(target, key) {
        if (key === "staffKind" || key === "playbackStatus") return Reflect.get(target, key);
        const call = calls.get(key) ?? vi.fn();
        calls.set(key, call);
        return call;
      }
    });
    const registry = getAllCommands(editorContext);
    const entries = ["", "@", ">", "?"].flatMap((mode) => suggestPaletteEntries(mode, registry as Array<Command<unknown>>));
    const cases = new Map(entries.filter(({ prefix }) => prefix !== "flow").map((entry) => [entryInput(entry), entry]));
    it.each([...cases.entries()])(`${staffKind}: %s`, (input, entry) => {
      vi.stubGlobal("window", { print: vi.fn() });
      try {
        const deps = createDeps({
          editorContext,
          dispatchEditorCommand: vi.fn((id) => executeCommand(id, editorContext))
        });
        deps.score.masterBars[0].section = { letter: "A", name: "Intro", boxed: true };
        deps.score.masterBars.push(
          structuredClone(deps.score.masterBars[0]),
          { ...deps.score.masterBars[0], section: { letter: "B", name: "Ending", boxed: false } }
        );
        delete deps.score.masterBars[1].section;
        deps.cursor.barIndex = 1;
        expect(handleCommandPaletteSubmit(deps, input)).toMatchObject({ handled: true });
        if (entry.kind === "registered") {
          expect(deps.dispatchEditorCommand).toHaveBeenCalledWith(entry.commandId);
        }
      } finally {
        vi.unstubAllGlobals();
      }
    });
  }
});
