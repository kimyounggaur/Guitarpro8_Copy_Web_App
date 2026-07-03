import type { Command } from "./registry";

export type PaletteEntryKind = "quick" | "advanced" | "registered" | "action" | "expression";

export interface PaletteEntry {
  prefix: string;
  description: string;
  kind: PaletteEntryKind;
  commandId?: string;
  usage?: string;
  aliases?: string[];
  requiresArgument?: boolean;
  tabStops?: string[];
  disabled?: boolean;
}

export interface ParsedPaletteInput {
  mode: "help" | "action" | "expression" | "section" | "bar" | "unset" | "command";
  prefix: string;
  args: string;
}

export interface MenuAction {
  id: string;
  label: string;
  commandId?: string;
  paletteInput?: string;
  appAction?: string;
}

export interface MenuGroup {
  name: string;
  actions: MenuAction[];
}

export const COMMAND_PALETTE_PLACEHOLDER =
  "Type ? to show the commands list; up or down to browse the command history";

export const QUICK_COMMANDS: PaletteEntry[] = [
  quick("anacrusis", "Set anacrusis", "bar.symbol.anacrusis"),
  quick("crescendo", "Set crescendo hairpin", "beat.effect.hairpinCresc"),
  quick("dead-note", "Set dead note", "note.effect.dead"),
  quick("dead-slapped", "Set dead slapped", "note.effect.deadSlapped"),
  quick("decrescendo", "Set decrescendo hairpin", "beat.effect.hairpinDecresc"),
  quick("double-barline", "Set double barline", "bar.symbol.doubleBar"),
  quick("double-simile", "Set double simile", "bar.symbol.doubleSimile"),
  quick("fade-in", "Set fade-in", "note.effect.fadeIn"),
  quick("fade-out", "Set fade-out", "note.effect.fadeOut"),
  quick("force-break-line", "Force break line", undefined, "layout.forceBreak"),
  quick("force-tuplet-bracket", "Force tuplet bracket"),
  quick("free-time", "Set free time", "bar.symbol.freeTime"),
  quick("hammer-on-pull-off", "Set hammer on / pull off", "note.effect.hopo"),
  quick("left-hand-tapping", "Set left hand tapping"),
  quick("legato", "Set legato", "note.effect.slide"),
  quick("let-ring", "Set let ring", "note.effect.letRing"),
  quick("multirest", "Activate multirest", "bar.symbol.multirest"),
  quick("multivoice", "Activate multivoice", undefined, "voice.toggleMulti"),
  quick("palm-mute", "Set palm mute", "note.effect.palmMute"),
  quick("pedal", "Set sustain pedal"),
  quick("prevent-break-line", "Prevent break line", undefined, "layout.preventBreak"),
  quick("print", "Print score", undefined, "file.print"),
  quick("repeat-close", "Set repeat close", "bar.symbol.repeatClose"),
  quick("repeat-open", "Set repeat open", "bar.symbol.repeatOpen"),
  quick("rest", "Set rest(s)", "note.rest"),
  quick("show-string-number", "Show string number", "note.effect.stringNumber"),
  quick("simile", "Set simile", "bar.symbol.simile"),
  quick("tapping", "Set tapping", "beat.effect.tapping"),
  quick("tie-beat", "Tie beat(s)", "note.tieBeat"),
  quick("tie-note", "Tie note(s)", "note.tie"),
  quick("timer", "Set timer", undefined, "tools.timer"),
  quick("volume-sweel", "Set volume-swell", "note.effect.volumeSwell")
];

export const ADVANCED_COMMANDS: PaletteEntry[] = [
  advanced("$", "Go to section", "section-letter", "$ A"),
  advanced("4/4", "Set time signature", "time-signature", "4/4"),
  advanced(":", "Go to bar", "bar-number", ": 12"),
  advanced("@", "Show and trigger actions", "action", "@ multitrack"),
  advanced("add-bar", "Add bar(s)", "bar-count", "add-bar 20"),
  advanced("alternate-endings", "Set alternate endings", "ending-mask"),
  advanced("arpeggio", "Set arpeggio pattern", "pattern", "arpeggio dud"),
  advanced("barre", "Set barre fret", "fret"),
  advanced("barre-half", "Set half barre fret", "fret"),
  advanced("bend", "Set bend", "value", "bend 2"),
  advanced("bend-release", "Set bend/release", "value"),
  advanced("brush", "Set brush pattern", "pattern", "brush du"),
  advanced("chord", "Set chord", "name", "chord Cm"),
  advanced("clef", "Set clef", "clef"),
  advanced("copy voice", "Copy to an other voice", "voice"),
  advanced("direction", "Set direction target and jump", "direction"),
  advanced("dynamic", "Set dynamic", "mark", "dynamic ff"),
  advanced("export", "Export score", "format"),
  advanced("fermata", "Set fermata", "position"),
  advanced("find-scale", "Find-scale(s)", "scale"),
  advanced("flow", "Toggle flow mode"),
  advanced("focus", "Set current track focus percentage", "percent"),
  advanced("free-text", "Set free text", "text"),
  advanced("golpe", "Set golpe pattern", "pattern", "golpe ft"),
  advanced("hide-tempo-automation", "Hide tempo automation"),
  advanced("hold-bend", "Hold bend", "value"),
  advanced("import", "File import", "format"),
  advanced("insert-bars", "Insert bar(s)", "bar-count", "insert-bars 4"),
  advanced("key-signature", "Set key signature", "key", "key-signature G"),
  advanced("left-hand-fingering", "Set left hand fingering", "pattern"),
  advanced("left hand", "Set left hand pattern", "pattern", "left hand 01234T"),
  advanced("lyrics", "Set lyrics", "text"),
  advanced("master-pan", "Add master pan automation", "value"),
  advanced("master-volume", "Add master volume automation", "value"),
  advanced("move-voice", "Move to an other voice", "voice"),
  advanced("n:m", "Set custom tuplet", "ratio"),
  advanced("octave-sign", "Set octave shift", "8va|8vb|15ma|15mb"),
  advanced("ornament", "Set ornament", "ornament"),
  advanced("pan", "Add pan automation", "value"),
  advanced("picking", "Set automatic picking pattern", "Alternate|Economy"),
  advanced("picking-pattern", "Set picking pattern on monophonic selection", "pattern"),
  advanced("pickstroke", "Set pickstroke pattern", "pattern", "pickstroke dduddud"),
  advanced("playing-style", "Set track playing style", "style"),
  advanced("prebend", "Set prebend", "value"),
  advanced("prebend-bend", "Set prebend/bend", "value"),
  advanced("prebend-release", "Set prebend/release", "value"),
  advanced("rasguedo", "Set rasgueado", "pattern"),
  advanced("relative-speed", "Set relative speed", "percent"),
  advanced("relative-tonality", "Set relative tonality", "key"),
  advanced("release-bend", "Release bend", "value"),
  advanced("right-hand-fingering", "Set right hand fingering", "pattern"),
  advanced("right hand", "Set right hand pattern", "pattern", "right hand pimac"),
  advanced("select-bars", "Select bar span", "start:end"),
  advanced("select-section", "Select-section", "section"),
  advanced("show-scale", "Show scale on virtual fretboard", "scale"),
  advanced("show-tempo automation", "Show tempo automation"),
  advanced("slap-pop", "Set slap/pop pattern", "pattern", "slap-pop sp"),
  advanced("slap pop pattern", "Set slap/pop pattern", "pattern", "slap pop pattern sp"),
  advanced("stem-direction", "Set stem orientation", "auto|up|down"),
  advanced("swap-voices", "Swap with an other voice", "voice"),
  advanced("tempo", "Add tempo automation", "bpm"),
  advanced("transpose", "Transpose selection", "interval"),
  advanced("tremolo-picking", "Set tremolo picking", "duration"),
  advanced("triplet-feel", "Set triplet feel", "feel"),
  advanced("unfocus", "Set current track unfocus percentage", "percent"),
  advanced("unset", "Unset elements", "effect", "unset Tie"),
  advanced("view", "Change view", "mode"),
  advanced("voice", "Change active voice", "1-4"),
  advanced("volume", "Add volume automation", "value"),
  advanced("wah", "Set wah-wah pattern", "pattern", "wah oc"),
  advanced("x", "Repeat bar(s)", "repeat-count", "x 4"),
  advanced("zoom", "Set score zoom", "percent", "zoom 150")
];

export const EXPRESSION_ENTRIES: PaletteEntry[] = [
  expression("Cm", "Set C minor chord"),
  expression("C", "Set C major chord"),
  expression("G", "Set G key signature or chord"),
  expression("Am", "Set A minor chord"),
  expression("ppp", "Set dynamic ppp"),
  expression("pp", "Set dynamic pp"),
  expression("p", "Set dynamic p"),
  expression("mp", "Set dynamic mp"),
  expression("mf", "Set dynamic mf"),
  expression("f", "Set dynamic f"),
  expression("ff", "Set dynamic ff"),
  expression("fff", "Set dynamic fff"),
  expression("8va", "Set octave sign 8va"),
  expression("8vb", "Set octave sign 8vb"),
  expression("Segno", "Set Segno direction"),
  expression("Coda", "Set Coda direction")
];

export const MENU_TREE: MenuGroup[] = [
  menu("File", [
    action("file.new", "New", undefined, undefined, "file.new"),
    action("file.open", "Open", undefined, undefined, "file.open"),
    action("file.save", "Save", undefined, undefined, "file.save"),
    action("file.saveAs", "Save As", undefined, undefined, "file.saveAs"),
    action("file.import", "Import", undefined, undefined, "file.import"),
    action("file.import.ascii", "Import ASCII", undefined, "import ascii", "file.import.ascii"),
    action("file.import.musicxml", "Import MusicXML", undefined, "import musicxml", "file.import.musicxml"),
    action("file.import.midi", "Import MIDI", undefined, "import midi", "file.import.midi"),
    action("file.export", "Export", undefined, undefined, "file.export"),
    action("file.export.native", "Export Native", undefined, "export native", "file.export.native"),
    action("file.export.ascii", "Export ASCII", undefined, "export ascii", "file.export.ascii"),
    action("file.export.musicxml", "Export MusicXML", undefined, "export musicxml", "file.export.musicxml"),
    action("file.export.midi", "Export MIDI", undefined, "export midi", "file.export.midi"),
    action("file.export.svg", "Export SVG", undefined, "export svg", "file.export.svg"),
    action("file.export.png", "Export PNG", undefined, "export png", "file.export.png"),
    action("file.export.pdf", "Export PDF", undefined, "export pdf", "file.export.pdf"),
    action("file.print", "Print", undefined, "print", "file.print"),
    action("app.preferences", "Preferences", "app.preferences")
  ]),
  menu("Edit", [
    action("history.undo", "Undo", "history.undo"),
    action("history.redo", "Redo", "history.redo"),
    action("clipboard.copy", "Copy", "clipboard.copy"),
    action("clipboard.cut", "Cut", "clipboard.cut"),
    action("clipboard.paste", "Paste", "clipboard.paste"),
    action("selection.selectTrack", "Select All", "selection.selectTrack")
  ]),
  menu("Track", [
    action("track.add", "Add", undefined, "track.add"),
    action("track.delete", "Delete", undefined, "track.delete"),
    action("track.tuning", "Tuning", undefined, "track.tuning"),
    action("voice.toggleMulti", "Multivoice", undefined, "voice.toggleMulti")
  ]),
  menu("Bar", [
    action("bar.insert", "Insert Bar", "bar.insert"),
    action("bar.symbol.timeSignature", "Time Signature", "bar.symbol.timeSignature"),
    action("bar.symbol.keySignature", "Key Signature", "bar.symbol.keySignature"),
    action("bar.symbol.repeatOpen", "Repeat Open", "bar.symbol.repeatOpen"),
    action("bar.symbol.repeatClose", "Repeat Close", "bar.symbol.repeatClose")
  ]),
  menu("Note", [
    action("note.rest", "Rest", "note.rest"),
    action("note.tie", "Tie Note", "note.tie"),
    action("note.tieBeat", "Tie Beat", "note.tieBeat"),
    action("note.delete", "Delete Note", "note.delete")
  ]),
  menu("Effects", [
    action("note.effect.palmMute", "Palm Mute", "note.effect.palmMute"),
    action("note.effect.letRing", "Let Ring", "note.effect.letRing"),
    action("note.effect.dead", "Dead Note", "note.effect.dead"),
    action("beat.effect.pickDown", "Pickstroke Down", "beat.effect.pickDown"),
    action("beat.effect.pickUp", "Pickstroke Up", "beat.effect.pickUp")
  ]),
  menu("Section", [
    action("bar.symbol.section", "Edit Section", "bar.symbol.section"),
    action("section.next", "Next Section", undefined, "$ next"),
    action("section.previous", "Previous Section", undefined, "$ previous")
  ]),
  menu("Tools", [
    action("tools.commandPalette", "Show Command Palette", undefined, undefined, "tools.commandPalette"),
    action("tools.actionList", "Action List", undefined, "@"),
    action("tools.expressionText", "Expression Text", undefined, ">"),
    action("tools.chords", "Chords", undefined, undefined, "tools.chords"),
    action("tools.scales", "Scales", undefined, undefined, "tools.scales"),
    action("tools.transpose", "Transpose", undefined, undefined, "tools.transpose"),
    action("tools.cleanup", "Check Bar Duration", undefined, undefined, "tools.cleanup")
  ]),
  menu("Sound", [
    action("playback.toggle", "Play / Stop", "playback.toggle"),
    action("playback.loop", "Loop", "playback.loop"),
    action("sound.instrumentView", "Instrument View", undefined, undefined, "tools.instrument")
  ]),
  menu("View", [
    action("panels.palette", "Show Edition Palette", undefined, undefined, "panels.palette"),
    action("panels.songInspector", "Show Song Inspector", undefined, undefined, "panels.songInspector"),
    action("panels.trackInspector", "Show Track Inspector", undefined, undefined, "panels.trackInspector"),
    action("panels.globalView", "Show Global View", undefined, undefined, "panels.globalView"),
    action("panels.automation", "Show Automation", undefined, undefined, "panels.automation"),
    action("view.multitrack", "Multitrack", undefined, undefined, "view.multitrack"),
    action("view.stylesheet", "Score Stylesheet", undefined, undefined, "view.stylesheet"),
    action("view.verticalPage", "Vertical Page", undefined, "view vertical-page"),
    action("view.horizontalPage", "Horizontal Page", undefined, "view horizontal-page"),
    action("view.grid", "Grid", undefined, "view grid"),
    action("view.parchment", "Parchment", undefined, "view parchment"),
    action("view.verticalScreen", "Vertical Screen", undefined, "view vertical-screen"),
    action("view.horizontalScreen", "Horizontal Screen", undefined, "view horizontal-screen"),
    action("view.zoomIn", "Zoom In", undefined, undefined, "view.zoomIn"),
    action("view.zoomOut", "Zoom Out", undefined, undefined, "view.zoomOut")
  ]),
  menu("Window", [
    action("tabs.next", "Next Tab", "tabs.next"),
    action("tabs.previous", "Previous Tab", "tabs.previous"),
    action("view.fullScreen", "Full Screen", undefined, undefined, "view.fullScreen")
  ]),
  menu("Help", [
    action("help.gettingHelp", "Getting Help", "help.gettingHelp"),
    action("app.about", "About", "app.about")
  ])
];

export function parsePaletteInput(input: string): ParsedPaletteInput {
  const trimmed = input.trim();

  if (!trimmed || trimmed === "?") {
    return { mode: "help", prefix: "?", args: "" };
  }

  if (trimmed.startsWith("@")) {
    return { mode: "action", prefix: "@", args: trimmed.slice(1).trim() };
  }

  if (trimmed.startsWith(">")) {
    return { mode: "expression", prefix: ">", args: trimmed.slice(1).trim() };
  }

  if (trimmed.startsWith("$")) {
    return { mode: "section", prefix: "$", args: trimmed.slice(1).trim() };
  }

  if (trimmed.startsWith(":")) {
    return { mode: "bar", prefix: ":", args: trimmed.slice(1).trim() };
  }

  const [prefix, ...rest] = trimmed.split(/\s+/);
  return {
    mode: prefix.toLowerCase() === "unset" ? "unset" : "command",
    prefix,
    args: rest.join(" ")
  };
}

export function flattenMenuActions(tree: MenuGroup[] = MENU_TREE): PaletteEntry[] {
  return tree.flatMap((group) =>
    group.actions.map((item) => ({
      prefix: `${group.name} > ${item.label}`,
      description: item.commandId ?? item.paletteInput ?? item.appAction ?? item.id,
      kind: "action" as const,
      commandId: item.commandId,
      aliases: [item.id, item.label, group.name, item.appAction, item.paletteInput].filter(Boolean) as string[]
    }))
  );
}

export function findMenuAction(query: string, tree: MenuGroup[] = MENU_TREE): MenuAction | null {
  const normalized = normalize(query);
  const actions = tree
    .flatMap((group) =>
      group.actions.map((item, index) => ({
        group,
        item,
        index,
        label: normalize(item.label),
        path: normalize(`${group.name} ${item.label}`),
        haystack: normalize(`${group.name} ${item.label} ${item.id} ${item.commandId ?? ""} ${item.paletteInput ?? ""} ${item.appAction ?? ""}`)
      }))
    )
    .map((candidate) => ({ ...candidate, score: actionScore(candidate, normalized) }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index);

  return actions[0]?.item ?? null;
}

export function paletteEntryByPrefix(prefix: string): PaletteEntry | undefined {
  const normalized = normalize(prefix);
  return [...QUICK_COMMANDS, ...ADVANCED_COMMANDS].find((entry) => normalize(entry.prefix) === normalized);
}

export function suggestPaletteEntries(
  input: string,
  registeredCommands: Array<Command<unknown>> = []
): PaletteEntry[] {
  const parsed = parsePaletteInput(input);

  if (parsed.mode === "action") {
    return filterEntries(flattenMenuActions(), parsed.args);
  }

  if (parsed.mode === "expression") {
    return filterEntries(EXPRESSION_ENTRIES, parsed.args);
  }

  if (parsed.mode === "help" || input.trim() === "?") {
    return [...QUICK_COMMANDS, ...ADVANCED_COMMANDS].sort(byPrefix);
  }

  const registeredEntries = registeredCommands.map((command) => ({
    prefix: command.label,
    description: command.category,
    kind: "registered" as const,
    commandId: command.id,
    aliases: [command.id, command.shortcut?.win, command.shortcut?.mac].filter(Boolean) as string[]
  }));

  return filterEntries([...QUICK_COMMANDS, ...ADVANCED_COMMANDS, ...registeredEntries], input).sort(byPrefix);
}

export function commandUsage(input: string): string {
  const parsed = parsePaletteInput(input);
  const entry = paletteEntryByPrefix(parsed.prefix);

  if (parsed.mode === "action") {
    return "Action List: type a menu or action name, then press Enter.";
  }

  if (parsed.mode === "expression") {
    return "Expression Text: type a chord, dynamic, key, octave sign, clef, or direction.";
  }

  if (parsed.mode === "section") {
    return "Go to section: type a section letter or name.";
  }

  if (parsed.mode === "bar") {
    return "Go to bar: type a bar number.";
  }

  if (entry?.usage) {
    return `Usage: ${entry.usage}`;
  }

  if (entry?.tabStops?.length) {
    return `Options: ${entry.tabStops.join(" > ")}`;
  }

  return "Tab completes; Enter applies; Up and Down browse suggestions and history.";
}

function filterEntries(entries: PaletteEntry[], query: string): PaletteEntry[] {
  const normalized = normalize(query);

  if (!normalized) {
    return entries.sort(byPrefix);
  }

  return entries
    .filter((entry) =>
      normalize([entry.prefix, entry.description, ...(entry.aliases ?? [])].join(" ")).includes(normalized)
    )
    .sort(byPrefix);
}

function quick(prefix: string, description: string, commandId?: string, appAction?: string): PaletteEntry {
  return {
    prefix,
    description,
    kind: "quick",
    commandId: commandId ?? appAction,
    aliases: [commandId, appAction].filter(Boolean) as string[]
  };
}

function advanced(prefix: string, description: string, tabStop?: string, usage?: string): PaletteEntry {
  return {
    prefix,
    description,
    kind: "advanced",
    requiresArgument: Boolean(tabStop),
    tabStops: tabStop ? [tabStop] : [],
    usage
  };
}

function expression(prefix: string, description: string): PaletteEntry {
  return { prefix, description, kind: "expression" };
}

function menu(name: string, actions: MenuAction[]): MenuGroup {
  return { name, actions };
}

function action(
  id: string,
  label: string,
  commandId?: string,
  paletteInput?: string,
  appAction?: string
): MenuAction {
  return { id, label, commandId, paletteInput, appAction };
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/>/g, " ").replace(/\s+/g, " ");
}

function actionScore(
  candidate: { label: string; path: string; haystack: string },
  query: string
): number {
  if (!query) {
    return 0;
  }

  if (candidate.path === query || candidate.label === query) {
    return 100;
  }

  if (candidate.label.startsWith(query)) {
    return 90;
  }

  if (candidate.path.includes(query)) {
    return 80;
  }

  if (candidate.haystack.includes(query)) {
    return 40;
  }

  return 0;
}

function byPrefix(left: PaletteEntry, right: PaletteEntry): number {
  return left.prefix.localeCompare(right.prefix);
}
