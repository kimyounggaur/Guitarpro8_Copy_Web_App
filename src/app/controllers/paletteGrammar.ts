// Leaf grammar functions for the Command Palette free-text interpreter —
// split out of useCommandController.ts once that file crossed the master
// prompt's ~500-line-per-controller guideline ("각 controller도 500줄을
// 넘으면 하위 utility로 나눈다"). These are the "mode" handlers that
// `handleCommandPaletteSubmit` (in useCommandController.ts) delegates to;
// none of them call back into the dispatcher (`runAppAction`/`runMenuAction`/
// `handleCommandPaletteSubmit`), so this file only imports one direction —
// `CommandControllerDeps`'s type from useCommandController.ts as a
// type-only import, which TypeScript erases at compile time and therefore
// creates no runtime circular dependency.
//
// Extracted from src/App.tsx (part of the App.tsx:820-1375 grammar
// interpreter — see docs/ui-remaster/00-component-map.md §1) as part of
// Phase 2's structural-only refactor. Behavior is unchanged from the
// original.
import { normaliseCursor, setDynamicAtCursor } from "../../engine/editing/operations";
import type { CursorPosition } from "../../engine/editing/types";
import { createBar, createMasterBar } from "../../model/factory";
import type { Beat, BeatDuration, DisplayMode, Dynamic, Track } from "../../model/types";
import type { CommandPaletteResult } from "../../ui/shell/CommandPalette";
import { exportFormatFromText, formatLabel, importFormatFromText } from "./useFileController";
import { clampNumber, ensureBeatAtCursor, selectedBarRange } from "./scoreEditingUtils";
import type { CommandControllerDeps } from "./useCommandController";

export function runExpressionText(deps: CommandControllerDeps, expression: string): CommandPaletteResult {
  const value = expression.trim();

  if (!value) {
    return { handled: false, message: "Expression Text needs a value.", keepOpen: true };
  }

  const dynamicIndex = ["ppp", "pp", "p", "mp", "mf", "f", "ff", "fff"].indexOf(value);

  if (dynamicIndex >= 0) {
    deps.editWithCursor("Expression dynamic", (draft) => setDynamicAtCursor(draft, deps.cursor, dynamicIndex as Dynamic));
    return { handled: true, message: `Dynamic ${value}` };
  }

  if (/^[A-G](#|b)?m?(maj|min|dim|aug|sus|add)?\d*$/i.test(value)) {
    const nextScore = deps.transact("Expression chord", (draft) => {
      const beat = ensureBeatAtCursor(draft, deps.cursor);
      const track = draft.tracks.find((candidate) => candidate.id === deps.cursor.trackId);

      if (beat && track) {
        beat.chordId = value;

        if (!track.chordLibrary.some((chord) => chord.id === value)) {
          track.chordLibrary.push({ id: value, name: value });
        }
      }
    });
    deps.setCursor(normaliseCursor(nextScore, deps.cursor));
    return { handled: true, message: `Chord ${value}` };
  }

  if (/^[A-G](#|b)?m?$/.test(value)) {
    const nextScore = deps.transact("Expression key signature", (draft) => {
      const masterBar = draft.masterBars[deps.cursor.barIndex];

      if (masterBar) {
        masterBar.keySignature = { key: value, mode: value.endsWith("m") ? "minor" : "major" };
      }
    });
    deps.setCursor(normaliseCursor(nextScore, deps.cursor));
    return { handled: true, message: `Key ${value}` };
  }

  return { handled: false, message: `Expression "${value}" is not available yet.`, keepOpen: true };
}

export function jumpToSection(deps: CommandControllerDeps, query: string): CommandPaletteResult {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return { handled: false, message: "Type a section letter or name.", keepOpen: true };
  }

  const sectionIndex = deps.score.masterBars.findIndex((bar) => {
    const section = bar.section;
    return section && (section.letter.toLowerCase() === normalized || section.name.toLowerCase().includes(normalized));
  });

  if (sectionIndex < 0) {
    return { handled: false, message: "Section not found.", keepOpen: true };
  }

  deps.setSelection(null);
  deps.setCursor(normaliseCursor(deps.score, { ...deps.cursor, barIndex: sectionIndex, beatIndex: 0 }));
  return { handled: true, message: `Section ${query}` };
}

export function jumpToBar(deps: CommandControllerDeps, query: string): CommandPaletteResult {
  const barNumber = Number(query.trim());

  if (!Number.isInteger(barNumber) || barNumber < 1) {
    return { handled: false, message: "Type a bar number.", keepOpen: true };
  }

  deps.setSelection(null);
  deps.setCursor(normaliseCursor(deps.score, { ...deps.cursor, barIndex: barNumber - 1, beatIndex: 0 }));
  return { handled: true, message: `Bar ${barNumber}` };
}

export function changeViewFromPalette(deps: CommandControllerDeps, query: string): CommandPaletteResult {
  const mode = displayModeFromText(query);

  if (!mode) {
    return { handled: false, message: "Use view vertical-page, horizontal-page, grid, parchment, vertical-screen, or horizontal-screen.", keepOpen: true };
  }

  deps.handleDisplayModeChange(mode);
  return { handled: true, message: `View ${mode}` };
}

export function zoomFromPalette(deps: CommandControllerDeps, query: string): CommandPaletteResult {
  const zoom = Number(query.trim().replace("%", ""));

  if (!Number.isFinite(zoom)) {
    return { handled: false, message: "Type a zoom percent from 25 to 300.", keepOpen: true };
  }

  deps.handleZoomChange(zoom);
  return { handled: true, message: `Zoom ${clampNumber(Math.round(zoom / 5) * 5, 25, 300)}%` };
}

export function setTimeSignatureFromPalette(
  deps: CommandControllerDeps,
  numerator: number,
  denominator: BeatDuration
): CommandPaletteResult {
  const nextScore = deps.transact("Command palette time signature", (draft) => {
    const masterBar = draft.masterBars[deps.cursor.barIndex];

    if (masterBar) {
      masterBar.timeSignature = { numerator, denominator, beamingPreset: "default" };
    }
  });
  deps.setCursor(normaliseCursor(nextScore, deps.cursor));
  return { handled: true, message: `${numerator}/${denominator}` };
}

export function addBarsFromPalette(
  deps: CommandControllerDeps,
  countText: string,
  insertAtCursor: boolean
): CommandPaletteResult {
  const count = Math.min(128, Math.max(1, Number(countText.trim() || "1")));

  if (!Number.isFinite(count)) {
    return { handled: false, message: "Bar count must be a number.", keepOpen: true };
  }

  const nextScore = deps.transact(insertAtCursor ? "Insert bars" : "Add bars", (draft) => {
    const index = insertAtCursor ? deps.cursor.barIndex : deps.cursor.barIndex + 1;

    for (let i = 0; i < count; i += 1) {
      draft.masterBars.splice(index + i, 0, createMasterBar());
      draft.tracks.forEach((track) => track.bars.splice(index + i, 0, createBar()));
    }
  });
  deps.setCursor(normaliseCursor(nextScore, deps.cursor));
  return { handled: true, message: `${insertAtCursor ? "Inserted" : "Added"} ${count} bar(s)` };
}

export function repeatBarsFromPalette(deps: CommandControllerDeps, countText: string): CommandPaletteResult {
  const count = Math.min(32, Math.max(1, Number(countText.trim() || "1")));

  if (!Number.isFinite(count)) {
    return { handled: false, message: "Repeat count must be a number.", keepOpen: true };
  }

  const nextScore = deps.transact("Repeat bars", (draft) => {
    const sourceMaster = structuredClone(draft.masterBars[deps.cursor.barIndex] ?? createMasterBar());
    const sourceBars = draft.tracks.map((track) => structuredClone(track.bars[deps.cursor.barIndex] ?? createBar()));

    for (let i = 0; i < count; i += 1) {
      const index = deps.cursor.barIndex + 1 + i;
      draft.masterBars.splice(index, 0, structuredClone(sourceMaster));
      draft.tracks.forEach((track, trackIndex) => track.bars.splice(index, 0, structuredClone(sourceBars[trackIndex])));
    }
  });
  deps.setCursor(normaliseCursor(nextScore, deps.cursor));
  return { handled: true, message: `Repeated ${count} bar(s)` };
}

export function applyPatternFromPalette(
  deps: CommandControllerDeps,
  prefix: string,
  rawPattern: string
): CommandPaletteResult {
  const pattern = rawPattern;

  if (!pattern) {
    return { handled: false, message: "Pattern required.", keepOpen: true };
  }

  const nextScore = deps.transact("Command palette pattern", (draft) => {
    const track = draft.tracks.find((candidate) => candidate.id === deps.cursor.trackId);
    const beatRefs = collectPatternBeats(track, deps.cursor, selectedBarRange(draft, deps.cursor, deps.selection));

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
  deps.setCursor(normaliseCursor(nextScore, deps.cursor));
  return { handled: true, message: `${prefix} ${pattern}` };
}

export function unsetPaletteEffect(deps: CommandControllerDeps, effect: string): CommandPaletteResult {
  const key = effect.trim().toLowerCase();

  if (!key) {
    return { handled: false, message: "Type an effect to unset.", keepOpen: true };
  }

  const nextScore = deps.transact("Unset effect", (draft) => {
    const track = draft.tracks.find((candidate) => candidate.id === deps.cursor.trackId);
    const { start, end } = selectedBarRange(draft, deps.cursor, deps.selection);

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
  deps.setCursor(normaliseCursor(nextScore, deps.cursor));
  return { handled: true, message: `Unset ${effect}` };
}

export function importFromPalette(deps: CommandControllerDeps, query: string): CommandPaletteResult {
  const format = importFormatFromText(query);

  if (format === "native") {
    void deps.handleOpenNativeFile();
    return { handled: true, message: "Open native score" };
  }

  if (!format) {
    deps.openFileIoPanel();
    return { handled: true, message: "Choose an import format." };
  }

  deps.handleImportFile(format);
  return { handled: true, message: `Import ${formatLabel(format)}` };
}

export function exportFromPalette(deps: CommandControllerDeps, query: string): CommandPaletteResult {
  const format = exportFormatFromText(query);

  if (!format) {
    deps.openFileIoPanel();
    return { handled: true, message: "Choose an export format." };
  }

  void deps.handleExportFile(format);
  return { handled: true, message: `Export ${formatLabel(format)}` };
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
