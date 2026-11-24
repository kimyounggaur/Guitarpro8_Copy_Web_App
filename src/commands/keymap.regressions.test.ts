import { expect, it } from "vitest";
import { APPLICATION_SHORTCUT_IDS } from "./commandIds";
import { ensureEditingCommandsRegistered } from "./editingCommands";
import {
  KEYMAP_ENTRIES,
  commandIdForKeyEvent,
  detectPlatform,
  isKeymapEventMatch,
  shortcutsForPlatform,
  type KeymapEventLike
} from "./keymap";
import { getCommand } from "./registry";

it("[B12] uses physical letters and shifted punctuation in English and Korean", () => {
  expect(commandIdForKeyEvent(keyEvent("ㅌ", "KeyX"), "workspace", "win")).toBe("note.effect.dead");
  expect(commandIdForKeyEvent(keyEvent("Process", "KeyX", { isComposing: true }), "workspace", "win")).toBe("note.effect.dead");
  expect(commandIdForKeyEvent(keyEvent(">", "Period", { shiftKey: true }), "workspace", "win")).toBe("note.dot");
  expect(commandIdForKeyEvent(keyEvent("?", "Slash", { shiftKey: true }), "workspace", "win")).toBe("note.triplet");
  expect(commandIdForKeyEvent(keyEvent("$", "Digit4", { shiftKey: true }), "workspace", "win")).toBe("note.effect.slap");
  expect(commandIdForKeyEvent(keyEvent("|", "Backslash", { shiftKey: true }), "workspace", "win")).toBe("bar.symbol.freeTime");
});

it("[B12] routes zoom modifiers without also selecting note duration", () => {
  const zoomIn = keyEvent("=", "Equal", { ctrlKey: true });
  const zoomOut = keyEvent("-", "Minus", { ctrlKey: true });
  expect(commandIdForKeyEvent(zoomIn, "global", "win")).toBe("view.zoomIn");
  expect(commandIdForKeyEvent(zoomOut, "global", "win")).toBe("view.zoomOut");
  expect(commandIdForKeyEvent(zoomIn, "workspace", "win")).toBeNull();
  expect(commandIdForKeyEvent(zoomOut, "workspace", "win")).toBeNull();
  expect(detectPlatform("MacIntel")).toBe("mac");
  expect(commandIdForKeyEvent(keyEvent("Z", "KeyZ", { metaKey: true, shiftKey: true }), "global", "mac")).toBe("history.redo");
});

it("[B12] all keyboard IDs have an editor command or an application handler", () => {
  ensureEditingCommandsRegistered();
  const applicationIds = new Set<string>(APPLICATION_SHORTCUT_IDS);
  for (const { commandId, scope } of KEYMAP_ENTRIES) {
    expect(applicationIds.has(commandId) ? scope === "global" : getCommand(commandId)).toBeTruthy();
  }
});

it("[B12] physical chords do not select two different commands in the same scope", () => {
  const keys = [
    ...Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ", (letter) => [`Key${letter}`, letter.toLowerCase(), letter]),
    ...Array.from("0123456789", (digit, index) => [`Digit${digit}`, digit, ")!@#$%^&*("[index]]),
    ...Array.from({ length: 12 }, (_, index) => [`F${index + 1}`, `F${index + 1}`, `F${index + 1}`]),
    ...["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Backspace", "Delete", "Escape", "Tab", "Enter", "Home", "End", "Insert"].map((key) =>
      [key, key, key]),
    ["Space", " ", " "], ["Equal", "=", "+"], ["Minus", "-", "_"], ["Period", ".", ">"],
    ["Slash", "/", "?"], ["Comma", ",", "<"], ["BracketLeft", "[", "{"], ["BracketRight", "]", "}"],
    ["Backslash", "\\", "|"], ["Semicolon", ";", ":"], ["Quote", "'", '"']
  ];
  const collisions: string[] = [];
  for (const platform of ["win", "mac"] as const) {
    for (const [code, plain, shifted] of keys) {
      for (let mask = 0; mask < 16; mask += 1) {
        const shiftKey = Boolean(mask & 1);
        const event = keyEvent(shiftKey ? shifted : plain, code, {
          shiftKey,
          ctrlKey: Boolean(mask & 2),
          altKey: Boolean(mask & 4),
          metaKey: Boolean(mask & 8)
        });
        const hits = new Map<string, string>();
        for (const entry of KEYMAP_ENTRIES) {
          if (!shortcutsForPlatform(entry, platform).some((shortcut) => isKeymapEventMatch(event, shortcut))) continue;
          const previous = hits.get(entry.scope);
          if (previous && previous !== entry.commandId) {
            collisions.push(`${platform}:${code}:${mask}: ${previous} and ${entry.commandId}`);
          }
          hits.set(entry.scope, entry.commandId);
        }
      }
    }
  }
  expect(collisions).toEqual([]);
});

function keyEvent(key: string, code: string, modifiers: Partial<KeymapEventLike> = {}): KeymapEventLike {
  return { key, code, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...modifiers };
}
