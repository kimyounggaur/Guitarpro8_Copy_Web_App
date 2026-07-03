export type KeymapScope = "global" | "workspace" | "dialog" | "palette";
export type Platform = "win" | "mac";

export interface KeymapEntry {
  commandId: string;
  label: string;
  category: string;
  scope: KeymapScope;
  win: string[];
  mac: string[];
  reserved?: boolean;
}

export interface KeymapEventLike {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

interface ParsedShortcut {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
  key: string;
}

const modifierMap = new Map<string, keyof Omit<ParsedShortcut, "key">>([
  ["ctrl", "ctrl"],
  ["control", "ctrl"],
  ["cmd", "meta"],
  ["command", "meta"],
  ["meta", "meta"],
  ["shift", "shift"],
  ["alt", "alt"],
  ["option", "alt"]
]);

const keyAliases = new Map<string, string>([
  ["backtab", "Tab"],
  ["del", "Delete"],
  ["esc", "Escape"],
  ["ins", "Insert"],
  ["left", "ArrowLeft"],
  ["right", "ArrowRight"],
  ["return", "Enter"],
  ["space", " "],
  ["up", "ArrowUp"],
  ["down", "ArrowDown"]
]);

const shiftedGlyphs = new Set(["!", "\"", "%", "&", "(", ")", "+", ":", "<", ">", "?", "@", "_"]);

export const KEYMAP_ENTRIES: KeymapEntry[] = [
  entry("file.new", "New File", "File", "global", ["Ctrl+N"], ["Cmd+N"], true),
  entry("file.open", "Open File", "File", "global", ["Ctrl+O"], ["Cmd+O"], true),
  entry("file.close", "Close File", "File", "global", ["Ctrl+W"], ["Cmd+W"], true),
  entry("file.closeAll", "Close All Files", "File", "global", ["Ctrl+Shift+W"], ["Cmd+Shift+W"], true),
  entry("file.save", "Save", "File", "global", ["Ctrl+S"], ["Cmd+S"], true),
  entry("file.saveAs", "Save As", "File", "global", ["Ctrl+Shift+S"], ["Cmd+Shift+S"], true),
  entry("file.print", "Print", "File", "global", ["Ctrl+P"], ["Cmd+P"], true),
  entry("app.preferences", "Preferences", "Application", "global", ["Ctrl+,"], ["Cmd+,"]),
  entry("history.undo", "Undo", "Edit", "workspace", ["Ctrl+Z"], ["Cmd+Z"]),
  entry("history.redo", "Redo", "Edit", "workspace", ["Ctrl+Y"], ["Shift+Cmd+Z"]),
  entry("view.fullScreen", "Full Screen", "View", "global", ["F11"], ["F11", "Ctrl+Cmd+F"], true),
  entry("view.exitFullScreen", "Exit full screen", "View", "global", ["Escape"], ["Escape"]),
  entry("tabs.next", "Next Tab", "Window", "global", ["Ctrl+Tab"], ["Ctrl+Tab"], true),
  entry("tabs.previous", "Previous Tab", "Window", "global", ["Ctrl+Shift+Tab", "Ctrl+Backtab"], ["Ctrl+Shift+Tab"], true),
  entry("help.gettingHelp", "Getting help", "Help", "global", ["F1"], []),

  entry("clipboard.copy", "Copy", "Clipboard", "workspace", ["Ctrl+C"], ["Cmd+C"]),
  entry("clipboard.cut", "Cut", "Clipboard", "workspace", ["Ctrl+X"], ["Cmd+X"]),
  entry("clipboard.paste", "Paste", "Clipboard", "workspace", ["Ctrl+V"], ["Cmd+V"]),
  entry("clipboard.specialPaste", "Special Paste", "Clipboard", "workspace", ["Ctrl+Shift+V"], ["Shift+Cmd+V"]),
  entry("clipboard.copyMultitrack", "All-track copy", "Clipboard", "workspace", ["Ctrl+Shift+C"], ["Shift+Cmd+C"]),
  entry("clipboard.cutMultitrack", "All-track cut", "Clipboard", "workspace", ["Ctrl+Shift+X"], ["Shift+Cmd+X"]),
  entry("beat.copyPrevious", "Copy Last Beat", "Edit", "workspace", ["C"], ["C"]),
  entry("selection.selectTrack", "Select All", "Selection", "workspace", ["Ctrl+A"], ["Cmd+A"]),
  entry("selection.extendBarRight", "Selection Until Next Bar", "Selection", "workspace", ["Ctrl+Shift+ArrowRight"], ["Shift+Cmd+ArrowRight"]),
  entry("selection.extendBarLeft", "Selection Until Previous Bar", "Selection", "workspace", ["Ctrl+Shift+ArrowLeft"], ["Shift+Cmd+ArrowLeft"]),
  entry("note.delete", "Delete Note", "Edit", "workspace", ["Backspace", "Delete"], ["Backspace"]),
  entry("beat.delete", "Delete the Beats", "Edit", "workspace", ["Shift+Delete"], ["Cmd+-"]),
  entry("bar.delete", "Delete Bar", "Edit", "workspace", ["Ctrl+Delete"], ["Ctrl+-"]),
  entry("edit.goTo", "Go To", "Edit", "global", ["Ctrl+G"], ["Cmd+G"]),

  entry("bar.insert", "Insert Bar", "Bar", "workspace", ["Insert"], ["Cmd++"]),
  entry("beat.insert", "Insert a Beat", "Bar", "workspace", ["Ctrl+Insert"], ["Ctrl++"]),
  entry("tools.cleanup", "Check bar duration", "Tools", "global", ["F4"], ["F4"]),
  entry("bar.symbol.repeatOpen", "Repeat Open", "Bar", "workspace", ["[", "Shift+["], ["[", "Shift+["]),
  entry("bar.symbol.repeatClose", "Repeat Close", "Bar", "workspace", ["]"], ["]"]),
  entry("bar.symbol.simile", "Repeat One Bar", "Bar", "workspace", ["%"], ["%"]),
  entry("bar.symbol.doubleSimile", "Repeat two Bars", "Bar", "workspace", ["Ctrl+%", "Ctrl+Shift+%"], ["Cmd+%", "Shift+Cmd+%"]),
  entry("bar.symbol.multirest", "Multirest", "Bar", "workspace", ["Ctrl+R"], ["Cmd+R"]),
  entry("bar.symbol.section", "Edit Section", "Section", "workspace", ["Shift+Insert"], ["Alt+Cmd++"]),
  entry("section.next", "Next Section", "Section", "workspace", ["Ctrl+Alt+ArrowRight"], ["Alt+Cmd+ArrowRight"]),
  entry("section.previous", "Previous Section", "Section", "workspace", ["Ctrl+Alt+ArrowLeft"], ["Alt+Cmd+ArrowLeft"]),
  entry("bar.symbol.directionTarget", "Directions", "Section", "workspace", ["D"], ["D"]),
  entry("bar.symbol.freeTime", "Free Time", "Bar", "workspace", ["Alt+Shift+L", "|"], ["Alt+Shift+L", "|"]),
  entry("bar.symbol.timeSignature", "Time Signature", "Bar", "workspace", ["Ctrl+T"], ["Cmd+T"]),
  entry("bar.symbol.keySignature", "Key Signature", "Bar", "workspace", ["Ctrl+K"], ["Cmd+K"]),
  entry("bar.symbol.tripletFeel", "Triplet Feel", "Bar", "workspace", ["Ctrl+/", "Ctrl+Shift+/"], ["Cmd+/", "Shift+Cmd+/"]),
  entry("layout.forceBreak", "Force Break Line", "Bar", "workspace", ["Ctrl+Enter"], ["Cmd+Enter"]),
  entry("layout.preventBreak", "Prevent Break Line", "Bar", "workspace", ["&"], ["&"]),

  entry("track.add", "Add Track", "Track", "global", ["Ctrl+Shift+Insert"], ["Alt+Cmd+N"]),
  entry("track.delete", "Delete Track", "Track", "global", ["Delete"], ["Alt+Cmd+R"]),
  entry("cursor.nextTrack", "Next Track", "Track", "workspace", ["Ctrl+ArrowDown"], ["Cmd+ArrowDown"]),
  entry("cursor.previousTrack", "Previous Track", "Track", "workspace", ["Ctrl+ArrowUp"], ["Cmd+ArrowUp"]),
  entry("voice.edit1", "Edit Voice 1", "Voice", "global", ["Ctrl+1"], ["Cmd+1"]),
  entry("voice.edit2", "Edit Voice 2", "Voice", "global", ["Ctrl+2"], ["Cmd+2"]),
  entry("voice.edit3", "Edit Voice 3", "Voice", "global", ["Ctrl+3"], ["Cmd+3"]),
  entry("voice.edit4", "Edit Voice 4", "Voice", "global", ["Ctrl+4"], ["Cmd+4"]),
  entry("voice.toggleMulti", "Multivoice edition", "Voice", "global", ["Ctrl+M"], ["Cmd+M"]),
  entry("voice.move1", "Move Voice to 1", "Voice", "global", ["Alt+1"], ["Alt+1"]),
  entry("voice.move2", "Move Voice to 2", "Voice", "global", ["Alt+2"], ["Alt+2"]),
  entry("voice.move3", "Move Voice to 3", "Voice", "global", ["Alt+3"], ["Alt+3"]),
  entry("voice.move4", "Move Voice to 4", "Voice", "global", ["Alt+4"], ["Alt+4"]),
  entry("view.multitrack", "Multitrack view", "View", "global", ["F3"], ["F3"]),

  entry("cursor.home", "Bar start", "Cursor", "workspace", ["Home"], ["Home"]),
  entry("cursor.firstBar", "First bar", "Cursor", "workspace", ["Ctrl+Home"], ["Cmd+Home"]),
  entry("cursor.end", "Bar end", "Cursor", "workspace", ["End"], ["End"]),
  entry("cursor.lastBar", "Last bar", "Cursor", "workspace", ["Ctrl+End"], ["Cmd+End"]),
  entry("cursor.moveRight", "Next beat", "Cursor", "workspace", ["ArrowRight"], ["ArrowRight"]),
  entry("cursor.moveLeft", "Previous beat", "Cursor", "workspace", ["ArrowLeft"], ["ArrowLeft"]),
  entry("cursor.moveDown", "Next line", "Cursor", "workspace", ["ArrowDown"], ["ArrowDown"]),
  entry("cursor.moveUp", "Previous line", "Cursor", "workspace", ["ArrowUp"], ["ArrowUp"]),
  entry("cursor.toggleStaff", "Next staff", "Cursor", "workspace", ["Tab", "Shift+Tab"], ["Tab", "Shift+Tab"]),
  entry("note.moveStringDown", "Move note to lower string", "Note", "workspace", ["Alt+ArrowDown"], ["Alt+ArrowDown"]),
  entry("note.moveStringUp", "Move note to upper string", "Note", "workspace", ["Alt+ArrowUp"], ["Alt+ArrowUp"]),
  entry("note.transposeDown", "Shift note down", "Note", "workspace", ["Alt+Shift+ArrowDown"], ["Alt+Shift+ArrowDown"]),
  entry("note.transposeUp", "Shift note up", "Note", "workspace", ["Alt+Shift+ArrowUp"], ["Alt+Shift+ArrowUp"]),

  entry("note.rest", "Rest", "Note", "workspace", ["R"], ["R"]),
  entry("duration.longer", "Increase Note Duration", "Note", "workspace", ["+", "="], ["-"]),
  entry("duration.shorter", "Decrease Note Duration", "Note", "workspace", ["-", "_"], ["+", "="]),
  entry("note.dot", "Dotting", "Note", "workspace", ["Shift+."], ["Shift+."]),
  entry("note.doubleDot", "Double Dotting", "Note", "workspace", ["Ctrl+."], ["Cmd+."]),
  entry("note.triplet", "Triplet", "Note", "workspace", ["Shift+/"], ["Shift+/"]),
  entry("note.tie", "Tie Note", "Note", "workspace", ["L"], ["L"]),
  entry("note.tieBeat", "Tie Beat", "Note", "workspace", ["Shift+L"], ["Shift+L"]),
  entry("note.sharp", "Sharp", "Accidentals", "workspace", ["Ctrl+9"], ["Cmd+9"]),
  entry("note.flat", "Flat", "Accidentals", "workspace", ["Ctrl+7"], ["Cmd+7"]),
  entry("note.natural", "Natural", "Accidentals", "workspace", ["Ctrl+8"], ["Cmd+8"]),
  entry("note.doubleSharp", "Double Sharp", "Accidentals", "workspace", ["Ctrl+Alt+9"], ["Alt+Cmd+9"]),
  entry("note.doubleFlat", "Double Flat", "Accidentals", "workspace", ["Ctrl+Alt+7"], ["Alt+Cmd+7"]),
  entry("note.enharmonic", "Change Accidental", "Accidentals", "workspace", ["Ctrl+Alt+8"], ["Alt+Cmd+8"]),

  entry("note.effect.bend", "Bend", "Effects", "workspace", ["B"], ["B"]),
  entry("note.effect.dead", "Dead Note", "Effects", "workspace", ["X"], ["X"]),
  entry("note.effect.ghost", "Ghost Note", "Effects", "workspace", ["O"], ["O"]),
  entry("note.effect.hopo", "Hammer On / Pull Off", "Effects", "workspace", ["H"], ["H"]),
  entry("note.effect.legato", "Legato", "Effects", "workspace", ["Shift+H"], ["Shift+H"]),
  entry("note.effect.slide", "Legato Slide", "Effects", "workspace", ["S"], ["S"]),
  entry("note.effect.letRing", "Let Ring", "Effects", "workspace", ["i"], ["i"]),
  entry("note.effect.palmMute", "Palm Mute", "Effects", "workspace", ["P"], ["P"]),
  entry("beat.effect.palmMute", "Palm Mute beat", "Effects", "workspace", ["Shift+P"], ["Shift+P"]),
  entry("note.effect.staccato", "Staccato", "Effects", "workspace", ["!"], ["!"]),
  entry("note.effect.accent", "Accented Note", "Effects", "workspace", [";"], [";"]),
  entry("note.effect.heavyAccent", "Heavily Accented Note", "Effects", "workspace", [":"], [":"]),
  entry("note.effect.harmonic", "Natural Harmonic", "Effects", "workspace", ["Y"], ["Y"]),
  entry("note.effect.artificialHarmonic", "Artificial Harmonic", "Effects", "workspace", ["Ctrl+Alt+Y"], ["Alt+Y"]),
  entry("note.effect.vibrato", "Vibrato", "Effects", "workspace", ["V"], ["V"]),
  entry("note.effect.barVibrato", "Vibrato bar", "Effects", "workspace", ["W", "Shift+W"], ["W", "Shift+W"]),
  entry("note.effect.trill", "Trill", "Effects", "workspace", ["N"], ["N"]),
  entry("note.effect.tremoloPicking", "Tremolo Picking", "Effects", "workspace", ["\""], ["\""]),
  entry("note.effect.graceBefore", "Grace note", "Effects", "workspace", ["G"], ["G"]),
  entry("note.effect.graceOnBeat", "Grace note on beat", "Effects", "workspace", ["Ctrl+Alt+G"], ["Alt+G"]),
  entry("beat.effect.tapping", "Tapping", "Effects", "workspace", [")"], [")"]),
  entry("note.effect.leftHandTapping", "Left Hand Tapping", "Effects", "workspace", ["("], ["("]),
  entry("note.effect.slap", "Slap", "Effects", "workspace", ["$"], ["$"]),
  entry("note.effect.rasgueado", "Rasgueado", "Effects", "workspace", ["Shift+R"], ["Shift+R"]),
  entry("beat.effect.brushDown", "Brush Down", "Effects", "workspace", ["Ctrl+D"], ["Cmd+D"]),
  entry("beat.effect.brushUp", "Brush Up", "Effects", "workspace", ["Ctrl+U"], ["Cmd+U"]),
  entry("beat.effect.arpeggioDown", "Arpeggio Down", "Effects", "workspace", ["Ctrl+Shift+D"], ["Shift+Cmd+D"]),
  entry("beat.effect.arpeggioUp", "Arpeggio Up", "Effects", "workspace", ["Ctrl+Shift+U"], ["Shift+Cmd+U"]),
  entry("beat.effect.pickDown", "PickStroke Down", "Effects", "workspace", ["Shift+D"], ["Shift+D"]),
  entry("beat.effect.pickUp", "PickStroke Up", "Effects", "workspace", ["Shift+U"], ["Shift+U"]),
  entry("note.effect.fadeIn", "Fade In", "Effects", "workspace", ["<"], ["<"]),
  entry("note.effect.fadeOut", "Fade Out", "Effects", "workspace", [">"], [">"]),
  entry("note.effect.volumeSwell", "Volume Swell", "Effects", "workspace", ["Alt+<", "Alt+>"], ["Alt+<", "Alt+>"]),
  entry("note.effect.wahOpen", "Wah Open", "Effects", "workspace", ["Ctrl+Alt+O"], ["Alt+O"]),
  entry("note.effect.wahClose", "Wah Close", "Effects", "workspace", ["Ctrl+Alt+C"], ["Alt+C"]),
  entry("bar.symbol.fermata", "Fermata", "Bar symbols", "workspace", ["F"], ["F"]),
  entry("note.effect.barre", "Barre", "Effects", "workspace", ["Shift+I"], ["Shift+I"]),

  entry("tools.chords", "Chord", "Tools", "global", ["A"], ["A"]),
  entry("tools.scales", "Scale Diagram", "Tools", "global", ["Shift+S"], ["Shift+S"]),
  entry("tools.freeText", "Text", "Tools", "workspace", ["T"], ["T"]),
  entry("tools.timer", "Timer", "Tools", "workspace", ["@"], ["@"]),
  entry("tools.key", "Key", "Tools", "workspace", ["K"], ["K"]),

  entry("playback.toggle", "Play/Pause", "Playback", "workspace", ["Space"], ["Space"]),
  entry("playback.fromStart", "Play From The Beginning", "Playback", "workspace", ["Ctrl+Space"], ["Shift+Space"]),
  entry("playback.nextBar", "Fast Forward", "Playback", "workspace", ["Ctrl+ArrowRight"], ["Cmd+ArrowRight"]),
  entry("playback.previousBar", "Rewind", "Playback", "workspace", ["Ctrl+ArrowLeft"], ["Cmd+ArrowLeft"]),
  entry("playback.nextBeat", "Step Forward", "Playback", "workspace", ["Alt+ArrowRight"], ["Alt+ArrowRight"]),
  entry("playback.previousBeat", "Step Backward", "Playback", "workspace", ["Alt+ArrowLeft"], ["Alt+ArrowLeft"]),
  entry("playback.loop", "Toggle Loop", "Playback", "workspace", ["F9"], ["F9"]),
  entry("playback.relativeSpeed", "Relative Speed", "Playback", "global", ["Ctrl+F9"], ["Cmd+F9"]),
  entry("panels.automation", "Edit Automations", "View", "global", ["F10"], ["F10"]),
  entry("sound.audioNoteSettings", "Audio Note Settings", "Sound", "global", ["Shift+F"], ["Shift+F"]),

  entry("panels.palette", "Show/Hide Edition Palette", "View", "global", ["F2"], ["F2"]),
  entry("panels.globalView", "Show/Hide Global View", "View", "global", ["F8"], ["F8"]),
  entry("tools.instrument", "Show/Hide Instrument View", "View", "global", ["Ctrl+F6"], ["Cmd+F6"]),
  entry("panels.songInspector", "Show/Hide Song Inspector", "View", "global", ["F5"], ["F5"]),
  entry("panels.trackInspector", "Show/Hide Track Inspector", "View", "global", ["F6"], ["F6"]),
  entry("view.stylesheet", "Score Stylesheet", "View", "global", ["F7"], ["F7"]),
  entry("view.designMode", "Design Mode", "View", "global", ["Ctrl+Alt+D"], ["Ctrl+Alt+D"]),
  entry("tools.commandPalette", "Show Command Palette", "Tools", "global", ["Ctrl+E"], ["Cmd+E"]),
  entry("tools.actionList", "Show Action List", "Tools", "global", ["Alt+Ctrl+E"], ["Alt+Cmd+E"]),
  entry("tools.expressionText", "Show Expression Text", "Tools", "global", ["Shift+Ctrl+E"], ["Shift+Cmd+E"]),
  entry("view.zoomIn", "Zoom In", "View", "global", ["Ctrl++", "Ctrl+Shift++"], ["Cmd+>"]),
  entry("view.zoomOut", "Zoom Out", "View", "global", ["Ctrl+-"], ["Cmd+<"])
];

export function detectPlatform(platform = typeof navigator === "undefined" ? "" : navigator.platform): Platform {
  return /mac|iphone|ipad|ipod/i.test(platform) ? "mac" : "win";
}

export function keymapEntryForCommand(commandId: string): KeymapEntry | undefined {
  return KEYMAP_ENTRIES.find((entry) => entry.commandId === commandId);
}

export function shortcutLabel(commandId: string, platform: Platform = detectPlatform()): string | undefined {
  const entry = keymapEntryForCommand(commandId);
  return entry ? shortcutsForPlatform(entry, platform)[0] : undefined;
}

export function shortcutsForPlatform(entry: KeymapEntry, platform: Platform): string[] {
  return platform === "mac" ? entry.mac : entry.win;
}

export function commandIdForKeyEvent(
  event: KeymapEventLike,
  scope: KeymapScope,
  platform: Platform = detectPlatform()
): string | null {
  const entries = KEYMAP_ENTRIES.filter((entry) => entry.scope === scope);

  for (const entry of entries) {
    if (shortcutsForPlatform(entry, platform).some((shortcut) => isKeymapEventMatch(event, shortcut))) {
      return entry.commandId;
    }
  }

  return null;
}

export function isKeymapEventMatch(event: KeymapEventLike, shortcut: string): boolean {
  const parsed = parseShortcut(shortcut);
  const shortcutKey = normalizeKey(parsed.key);
  const eventKey = normalizeKey(event.key);
  const shiftMatches =
    event.shiftKey === parsed.shift ||
    (!parsed.shift && event.shiftKey && shiftedGlyphs.has(shortcutKey) && eventKey === shortcutKey);

  return (
    event.ctrlKey === parsed.ctrl &&
    event.altKey === parsed.alt &&
    event.metaKey === parsed.meta &&
    shiftMatches &&
    eventKey === shortcutKey
  );
}

function entry(
  commandId: string,
  label: string,
  category: string,
  scope: KeymapScope,
  win: string[],
  mac: string[],
  reserved = false
): KeymapEntry {
  return { commandId, label, category, scope, win, mac, reserved };
}

function parseShortcut(shortcut: string): ParsedShortcut {
  const parsed: ParsedShortcut = {
    ctrl: false,
    alt: false,
    shift: false,
    meta: false,
    key: ""
  };
  const parts = shortcut.endsWith("+")
    ? [...shortcut.slice(0, -1).split("+").filter(Boolean), "+"]
    : shortcut.split("+").filter(Boolean);

  for (const part of parts) {
    const normalized = part.trim().toLowerCase();
    const modifier = modifierMap.get(normalized);

    if (modifier) {
      parsed[modifier] = true;
    } else {
      parsed.key = part.trim();
    }
  }

  return parsed;
}

function normalizeKey(key: string): string {
  const alias = keyAliases.get(key.toLowerCase());

  if (alias) {
    return alias;
  }

  return key.length === 1 ? key.toLowerCase() : key.toLowerCase().replace(/^arrow/, "Arrow");
}
