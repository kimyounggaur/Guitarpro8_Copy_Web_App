import { describe, expect, it } from "vitest";
import { KEYMAP_ENTRIES, commandIdForKeyEvent, isKeymapEventMatch, keymapEntryForCommand, shortcutLabel } from "./keymap";

describe("Phase 10 keymap", () => {
  it("stores a broad fixed shortcut table", () => {
    expect(KEYMAP_ENTRIES.length).toBeGreaterThan(90);
    expect(shortcutLabel("tools.commandPalette", "win")).toBe("Ctrl+E");
    expect(shortcutLabel("history.redo", "mac")).toBe("Shift+Cmd+Z");
  });

  it("matches shifted punctuation by event.key", () => {
    expect(isKeymapEventMatch(key("<", { shiftKey: true }), "<")).toBe(true);
    expect(isKeymapEventMatch(key("%", { shiftKey: true, ctrlKey: true }), "Ctrl+%")).toBe(true);
    expect(isKeymapEventMatch(key("+", { shiftKey: true, ctrlKey: true }), "Ctrl++")).toBe(true);
  });

  it("passes at least 20 official shortcut spot checks", () => {
    const checks: Array<[string, ReturnType<typeof key>, string]> = [
      ["tools.commandPalette", key("e", { ctrlKey: true }), "global"],
      ["tools.actionList", key("e", { ctrlKey: true, altKey: true }), "global"],
      ["track.add", key("Insert", { ctrlKey: true, shiftKey: true }), "global"],
      ["voice.edit1", key("1", { ctrlKey: true }), "global"],
      ["voice.toggleMulti", key("m", { ctrlKey: true }), "global"],
      ["view.multitrack", key("F3"), "global"],
      ["panels.palette", key("F2"), "global"],
      ["history.redo", key("y", { ctrlKey: true }), "workspace"],
      ["clipboard.copy", key("c", { ctrlKey: true }), "workspace"],
      ["bar.insert", key("Insert"), "workspace"],
      ["beat.insert", key("Insert", { ctrlKey: true }), "workspace"],
      ["bar.symbol.timeSignature", key("t", { ctrlKey: true }), "workspace"],
      ["cursor.firstBar", key("Home", { ctrlKey: true }), "workspace"],
      ["note.rest", key("r"), "workspace"],
      ["note.tie", key("l"), "workspace"],
      ["note.sharp", key("9", { ctrlKey: true }), "workspace"],
      ["note.effect.bend", key("b"), "workspace"],
      ["note.effect.dead", key("x"), "workspace"],
      ["playback.toggle", key(" "), "workspace"],
      ["playback.loop", key("F9"), "workspace"],
      ["beat.effect.pickDown", key("D", { shiftKey: true }), "workspace"]
    ];

    checks.forEach(([commandId, event, scope]) => {
      expect(commandIdForKeyEvent(event, scope as never, "win")).toBe(commandId);
      expect(keymapEntryForCommand(commandId)).toBeTruthy();
    });
  });
});

function key(
  keyValue: string,
  options: Partial<Pick<KeyboardEvent, "ctrlKey" | "altKey" | "shiftKey" | "metaKey">> = {}
) {
  return {
    key: keyValue,
    ctrlKey: options.ctrlKey ?? false,
    altKey: options.altKey ?? false,
    shiftKey: options.shiftKey ?? false,
    metaKey: options.metaKey ?? false
  };
}
