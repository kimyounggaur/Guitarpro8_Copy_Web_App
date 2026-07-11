import { describe, expect, it, vi } from "vitest";
import { defaultCursor } from "../../engine/editing/operations";
import { createEmptyScore, createTrack } from "../../model/factory";
import type { EditorCommandContext } from "../../commands/editingCommands";
import { runAppAction, type CommandControllerDeps } from "./useCommandController";

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

  it("routes view.zoomIn to handleZoomChange with the score's current zoom plus 10", () => {
    const deps = createDeps();

    runAppAction(deps, "view.zoomIn");

    expect(deps.handleZoomChange).toHaveBeenCalledWith(deps.score.documentSettings.zoom + 10);
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
