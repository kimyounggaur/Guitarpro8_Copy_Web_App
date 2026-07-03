import { describe, expect, it } from "vitest";
import {
  ADVANCED_COMMANDS,
  MENU_TREE,
  QUICK_COMMANDS,
  findMenuAction,
  flattenMenuActions,
  parsePaletteInput,
  suggestPaletteEntries
} from "./paletteCommands";

describe("Phase 10 command palette data", () => {
  it("registers the exact 32 quick command prefixes", () => {
    expect(QUICK_COMMANDS).toHaveLength(32);
    expect(QUICK_COMMANDS.map((command) => command.prefix)).toContain("palm-mute");
    expect(QUICK_COMMANDS.map((command) => command.prefix)).toContain("volume-sweel");
  });

  it("parses command palette modes", () => {
    expect(parsePaletteInput("add-bar 20")).toMatchObject({
      mode: "command",
      prefix: "add-bar",
      args: "20"
    });
    expect(parsePaletteInput(">Cm")).toMatchObject({ mode: "expression", args: "Cm" });
    expect(parsePaletteInput("@ multitrack")).toMatchObject({ mode: "action", args: "multitrack" });
    expect(parsePaletteInput("unset Tie")).toMatchObject({ mode: "unset", args: "Tie" });
  });

  it("suggests quick, advanced, expression, and action entries", () => {
    expect(suggestPaletteEntries("?").some((entry) => entry.prefix === "add-bar")).toBe(true);
    expect(suggestPaletteEntries("pickstroke").some((entry) => entry.prefix === "pickstroke")).toBe(true);
    expect(suggestPaletteEntries(">ff").some((entry) => entry.prefix === "ff")).toBe(true);
    expect(suggestPaletteEntries("@ multi").some((entry) => entry.prefix === "View > Multitrack")).toBe(true);
    expect(ADVANCED_COMMANDS.some((entry) => entry.prefix === "unset")).toBe(true);
  });

  it("uses one 12-menu tree for menus and Action List", () => {
    expect(MENU_TREE.map((menu) => menu.name)).toEqual([
      "File",
      "Edit",
      "Track",
      "Bar",
      "Note",
      "Effects",
      "Section",
      "Tools",
      "Sound",
      "View",
      "Window",
      "Help"
    ]);
    expect(flattenMenuActions().some((entry) => entry.prefix === "View > Multitrack")).toBe(true);
    expect(findMenuAction("View > Multitrack")?.appAction).toBe("view.multitrack");
  });
});
