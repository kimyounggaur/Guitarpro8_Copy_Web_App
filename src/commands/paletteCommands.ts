import { t } from "../ui/i18n/messages.en";
import { availableMenuGroups } from "./menus";
import { shortcutLabel } from "./keymap";
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
  t("palette.searchPlaceholder");

export const QUICK_COMMANDS: PaletteEntry[] = [
  quick("anacrusis", t("palette.quick.anacrusis"), "bar.symbol.anacrusis"),
  quick("crescendo", t("palette.quick.crescendo"), "beat.effect.hairpinCresc"),
  quick("dead-note", t("palette.quick.deadNote"), "note.effect.dead"),
  quick("dead-slapped", t("palette.quick.deadSlapped"), "note.effect.deadSlapped"),
  quick("decrescendo", t("palette.quick.decrescendo"), "beat.effect.hairpinDecresc"),
  quick("double-barline", t("palette.quick.doubleBarline"), "bar.symbol.doubleBar"),
  quick("double-simile", t("palette.quick.doubleSimile"), "bar.symbol.doubleSimile"),
  quick("fade-in", t("palette.quick.fadeIn"), "note.effect.fadeIn"),
  quick("fade-out", t("palette.quick.fadeOut"), "note.effect.fadeOut"),
  quick("force-break-line", t("palette.quick.forceBreakLine"), undefined, "layout.forceBreak"),
  quick("force-tuplet-bracket", t("palette.quick.forceTupletBracket")),
  quick("free-time", t("palette.quick.freeTime"), "bar.symbol.freeTime"),
  quick("hammer-on-pull-off", t("palette.quick.hammerOnPullOff"), "note.effect.hopo"),
  quick("left-hand-tapping", t("palette.quick.leftHandTapping")),
  quick("legato", t("palette.quick.legato"), "note.effect.slide"),
  quick("let-ring", t("palette.quick.letRing"), "note.effect.letRing"),
  quick("multivoice", t("palette.quick.multivoice"), undefined, "voice.toggleMulti"),
  quick("palm-mute", t("palette.quick.palmMute"), "note.effect.palmMute"),
  quick("pedal", t("palette.quick.pedal")),
  quick("prevent-break-line", t("palette.quick.preventBreakLine"), undefined, "layout.preventBreak"),
  quick("print", t("palette.quick.print"), undefined, "file.print"),
  quick("repeat-close", t("palette.quick.repeatClose"), "bar.symbol.repeatClose"),
  quick("repeat-open", t("palette.quick.repeatOpen"), "bar.symbol.repeatOpen"),
  quick("rest", t("palette.quick.rest"), "note.rest"),
  quick("show-string-number", t("palette.quick.showStringNumber"), "note.effect.stringNumber"),
  quick("simile", t("palette.quick.simile"), "bar.symbol.simile"),
  quick("tapping", t("palette.quick.tapping"), "beat.effect.tapping"),
  quick("tie-beat", t("palette.quick.tieBeat"), "note.tieBeat"),
  quick("tie-note", t("palette.quick.tieNote"), "note.tie"),
  quick("timer", t("palette.quick.timer"), undefined, "tools.timer"),
  quick("volume-sweel", t("palette.quick.volumeSweel"), "note.effect.volumeSwell")
];

export const ADVANCED_COMMANDS: PaletteEntry[] = [
  advanced("$", t("palette.advanced.section"), "section-letter", "$ A"),
  advanced("4/4", t("palette.advanced.timeSignature"), "time-signature", "4/4"),
  advanced(":", t("palette.advanced.bar"), "bar-number", ": 12"),
  advanced("@", t("palette.advanced.actions"), "action", "@ multitrack"),
  advanced("add-bar", t("palette.advanced.addBar"), "bar-count", "add-bar 20"),
  advanced("alternate-endings", t("palette.advanced.alternateEndings"), "ending-mask"),
  advanced("arpeggio", t("palette.advanced.arpeggio"), "pattern", "arpeggio dud"),
  advanced("barre", t("palette.advanced.barre"), "fret"),
  advanced("barre-half", t("palette.advanced.barreHalf"), "fret"),
  advanced("bend", t("palette.advanced.bend"), "value", "bend 2"),
  advanced("bend-release", t("palette.advanced.bendRelease"), "value"),
  advanced("brush", t("palette.advanced.brush"), "pattern", "brush du"),
  advanced("chord", t("palette.advanced.chord"), "name", "chord Cm"),
  advanced("clef", t("palette.advanced.clef"), "clef"),
  advanced("copy voice", t("palette.advanced.copyVoice"), "voice"),
  advanced("direction", t("palette.advanced.direction"), "direction"),
  advanced("dynamic", t("palette.advanced.dynamic"), "mark", "dynamic ff"),
  advanced("export", t("palette.advanced.export"), "format"),
  advanced("fermata", t("palette.advanced.fermata"), "position"),
  advanced("find-scale", t("palette.advanced.findScale"), "scale"),
  advanced("flow", t("palette.advanced.flow")),
  advanced("focus", t("palette.advanced.focus"), "percent"),
  advanced("free-text", t("palette.advanced.freeText"), "text"),
  advanced("golpe", t("palette.advanced.golpe"), "pattern", "golpe ft"),
  advanced("hide-tempo-automation", t("palette.advanced.hideTempoAutomation")),
  advanced("hold-bend", t("palette.advanced.holdBend"), "value"),
  advanced("import", t("palette.advanced.import"), "format"),
  advanced("insert-bars", t("palette.advanced.insertBars"), "bar-count", "insert-bars 4"),
  advanced("key-signature", t("palette.advanced.keySignature"), "key", "key-signature G"),
  advanced("left-hand-fingering", t("palette.advanced.leftHandFingering"), "pattern"),
  advanced("left hand", t("palette.advanced.leftHand"), "pattern", "left hand 01234T"),
  advanced("lyrics", t("palette.advanced.lyrics"), "text"),
  advanced("master-pan", t("palette.advanced.masterPan"), "value"),
  advanced("master-volume", t("palette.advanced.masterVolume"), "value"),
  advanced("move-voice", t("palette.advanced.moveVoice"), "voice"),
  advanced("n:m", t("palette.advanced.tuplet"), "ratio"),
  advanced("octave-sign", t("palette.advanced.octaveSign"), "8va|8vb|15ma|15mb"),
  advanced("ornament", t("palette.advanced.ornament"), "ornament"),
  advanced("pan", t("palette.advanced.pan"), "value"),
  advanced("picking", t("palette.advanced.picking"), "Alternate|Economy"),
  advanced("picking-pattern", t("palette.advanced.pickingPattern"), "pattern"),
  advanced("pickstroke", t("palette.advanced.pickstroke"), "pattern", "pickstroke dduddud"),
  advanced("playing-style", t("palette.advanced.playingStyle"), "style"),
  advanced("prebend", t("palette.advanced.prebend"), "value"),
  advanced("prebend-bend", t("palette.advanced.prebendBend"), "value"),
  advanced("prebend-release", t("palette.advanced.prebendRelease"), "value"),
  advanced("rasguedo", t("palette.advanced.rasguedo"), "pattern"),
  advanced("relative-speed", t("palette.advanced.relativeSpeed"), "percent"),
  advanced("relative-tonality", t("palette.advanced.relativeTonality"), "key"),
  advanced("release-bend", t("palette.advanced.releaseBend"), "value"),
  advanced("right-hand-fingering", t("palette.advanced.rightHandFingering"), "pattern"),
  advanced("right hand", t("palette.advanced.rightHand"), "pattern", "right hand pimac"),
  advanced("select-bars", t("palette.advanced.selectBars"), "start:end"),
  advanced("select-section", t("palette.advanced.selectSection"), "section"),
  advanced("show-scale", t("palette.advanced.showScale"), "scale"),
  advanced("show-tempo automation", t("palette.advanced.showTempoAutomation")),
  advanced("slap-pop", t("palette.advanced.slapPop"), "pattern", "slap-pop sp"),
  advanced("slap pop pattern", t("palette.advanced.slapPopPattern"), "pattern", "slap pop pattern sp"),
  advanced("stem-direction", t("palette.advanced.stemDirection"), "auto|up|down"),
  advanced("swap-voices", t("palette.advanced.swapVoices"), "voice"),
  advanced("tempo", t("palette.advanced.tempo"), "bpm"),
  advanced("transpose", t("palette.advanced.transpose"), "interval"),
  advanced("tremolo-picking", t("palette.advanced.tremoloPicking"), "duration"),
  advanced("triplet-feel", t("palette.advanced.tripletFeel"), "feel"),
  advanced("unfocus", t("palette.advanced.unfocus"), "percent"),
  advanced("unset", t("palette.advanced.unset"), "effect", "unset Tie"),
  advanced("view", t("palette.advanced.view"), "mode"),
  advanced("voice", t("palette.advanced.voice"), "1-4"),
  advanced("volume", t("palette.advanced.volume"), "value"),
  advanced("wah", t("palette.advanced.wah"), "pattern", "wah oc"),
  advanced("x", t("palette.advanced.x"), "repeat-count", "x 4"),
  advanced("zoom", t("palette.advanced.zoom"), "percent", "zoom 150")
];

export const EXPRESSION_ENTRIES: PaletteEntry[] = [
  expression("Cm", t("palette.expression.cMinor")),
  expression("C", t("palette.expression.cMajor")),
  expression("G", t("palette.expression.gMajor")),
  expression("Am", t("palette.expression.aMinor")),
  expression("ppp", t("palette.expression.ppp")),
  expression("pp", t("palette.expression.pp")),
  expression("p", t("palette.expression.p")),
  expression("mp", t("palette.expression.mp")),
  expression("mf", t("palette.expression.mf")),
  expression("f", t("palette.expression.f")),
  expression("ff", t("palette.expression.ff")),
  expression("fff", t("palette.expression.fff"))
];

export const MENU_TREE: MenuGroup[] = [
  menu(t("menu.group.file"), [
    action("file.new", t("menu.action.file.new"), undefined, undefined, "file.new"),
    action("file.open", t("menu.action.file.open"), undefined, undefined, "file.open"),
    action("file.save", t("menu.action.file.save"), undefined, undefined, "file.save"),
    action("file.saveAs", t("menu.action.file.saveAs"), undefined, undefined, "file.saveAs"),
    action("file.import", t("menu.action.file.import"), undefined, undefined, "file.import"),
    action("file.import.ascii", t("menu.action.file.import.ascii"), undefined, "import ascii", "file.import.ascii"),
    action("file.import.musicxml", t("menu.action.file.import.musicxml"), undefined, "import musicxml", "file.import.musicxml"),
    action("file.import.midi", t("menu.action.file.import.midi"), undefined, "import midi", "file.import.midi"),
    action("file.export", t("menu.action.file.export"), undefined, undefined, "file.export"),
    action("file.export.native", t("menu.action.file.export.native"), undefined, "export native", "file.export.native"),
    action("file.export.ascii", t("menu.action.file.export.ascii"), undefined, "export ascii", "file.export.ascii"),
    action("file.export.musicxml", t("menu.action.file.export.musicxml"), undefined, "export musicxml", "file.export.musicxml"),
    action("file.export.midi", t("menu.action.file.export.midi"), undefined, "export midi", "file.export.midi"),
    action("file.export.svg", t("menu.action.file.export.svg"), undefined, "export svg", "file.export.svg"),
    action("file.export.png", t("menu.action.file.export.png"), undefined, "export png", "file.export.png"),
    action("file.export.pdf", t("menu.action.file.export.pdf"), undefined, "export pdf", "file.export.pdf"),
    action("file.print", t("menu.action.file.print"), undefined, "print", "file.print"),
    action("app.preferences", t("menu.action.app.preferences"), "app.preferences")
  ]),
  menu(t("menu.group.edit"), [
    action("history.undo", t("menu.action.history.undo"), "history.undo"),
    action("history.redo", t("menu.action.history.redo"), "history.redo"),
    action("clipboard.copy", t("menu.action.clipboard.copy"), "clipboard.copy"),
    action("clipboard.cut", t("menu.action.clipboard.cut"), "clipboard.cut"),
    action("clipboard.paste", t("menu.action.clipboard.paste"), "clipboard.paste"),
    action("selection.selectTrack", t("menu.action.selection.selectTrack"), "selection.selectTrack")
  ]),
  menu(t("menu.group.track"), [
    action("track.add", t("menu.action.track.add"), undefined, "track.add"),
    action("track.delete", t("menu.action.track.delete"), undefined, "track.delete"),
    action("track.tuning", t("tuning"), undefined, "track.tuning"),
    action("voice.toggleMulti", t("menu.action.voice.toggleMulti"), undefined, "voice.toggleMulti")
  ]),
  menu(t("menu.group.bar"), [
    action("bar.insert", t("menu.action.bar.insert"), "bar.insert"),
    action("bar.symbol.timeSignature", t("menu.action.bar.symbol.timeSignature"), "bar.symbol.timeSignature"),
    action("bar.symbol.keySignature", t("menu.action.bar.symbol.keySignature"), "bar.symbol.keySignature"),
    action("bar.symbol.repeatOpen", t("menu.action.bar.symbol.repeatOpen"), "bar.symbol.repeatOpen"),
    action("bar.symbol.repeatClose", t("menu.action.bar.symbol.repeatClose"), "bar.symbol.repeatClose")
  ]),
  menu(t("menu.group.note"), [
    action("note.rest", t("menu.action.note.rest"), "note.rest"),
    action("note.tie", t("menu.action.note.tie"), "note.tie"),
    action("note.tieBeat", t("menu.action.note.tieBeat"), "note.tieBeat"),
    action("note.delete", t("menu.action.note.delete"), "note.delete")
  ]),
  menu(t("menu.group.effects"), [
    action("note.effect.palmMute", t("menu.action.note.effect.palmMute"), "note.effect.palmMute"),
    action("note.effect.letRing", t("menu.action.note.effect.letRing"), "note.effect.letRing"),
    action("note.effect.dead", t("menu.action.note.effect.dead"), "note.effect.dead"),
    action("beat.effect.pickDown", t("menu.action.beat.effect.pickDown"), "beat.effect.pickDown"),
    action("beat.effect.pickUp", t("menu.action.beat.effect.pickUp"), "beat.effect.pickUp")
  ]),
  menu(t("menu.group.section"), [
    action("bar.symbol.section", t("menu.action.bar.symbol.section"), "bar.symbol.section"),
    action("section.next", t("menu.action.section.next"), undefined, "$ next"),
    action("section.previous", t("menu.action.section.previous"), undefined, "$ previous")
  ]),
  menu(t("menu.group.tools"), [
    action("tools.commandPalette", t("menu.action.tools.commandPalette"), undefined, undefined, "tools.commandPalette"),
    action("tools.actionList", t("menu.action.tools.actionList"), undefined, "@"),
    action("tools.expressionText", t("menu.action.tools.expressionText"), undefined, ">"),
    action("tools.chords", t("menu.action.tools.chords"), undefined, undefined, "tools.chords"),
    action("tools.scales", t("menu.action.tools.scales"), undefined, undefined, "tools.scales"),
    action("tools.transpose", t("menu.action.tools.transpose"), undefined, undefined, "tools.transpose"),
    action("tools.cleanup", t("menu.action.tools.cleanup"), undefined, undefined, "tools.cleanup")
  ]),
  menu(t("menu.group.sound"), [
    action("playback.toggle", t("menu.action.playback.toggle"), "playback.toggle"),
    action("playback.loop", t("menu.action.playback.loop"), "playback.loop"),
    action("sound.instrumentView", t("menu.action.sound.instrumentView"), undefined, undefined, "tools.instrument")
  ]),
  menu(t("menu.group.view"), [
    action("panels.palette", t("menu.action.panels.palette"), undefined, undefined, "panels.palette"),
    action("panels.songInspector", t("menu.action.panels.songInspector"), undefined, undefined, "panels.songInspector"),
    action("panels.trackInspector", t("menu.action.panels.trackInspector"), undefined, undefined, "panels.trackInspector"),
    action("panels.globalView", t("menu.action.panels.globalView"), undefined, undefined, "panels.globalView"),
    action("panels.automation", t("menu.action.panels.automation"), undefined, undefined, "panels.automation"),
    action("view.multitrack", t("menu.action.view.multitrack"), undefined, undefined, "view.multitrack"),
    action("view.stylesheet", t("menu.action.view.stylesheet"), undefined, undefined, "view.stylesheet"),
    action("view.verticalPage", t("menu.action.view.verticalPage"), undefined, "view vertical-page"),
    action("view.horizontalPage", t("menu.action.view.horizontalPage"), undefined, "view horizontal-page"),
    action("view.grid", t("menu.action.view.grid"), undefined, "view grid"),
    action("view.parchment", t("menu.action.view.parchment"), undefined, "view parchment"),
    action("view.verticalScreen", t("menu.action.view.verticalScreen"), undefined, "view vertical-screen"),
    action("view.horizontalScreen", t("menu.action.view.horizontalScreen"), undefined, "view horizontal-screen"),
    action("view.zoomIn", t("menu.action.view.zoomIn"), undefined, undefined, "view.zoomIn"),
    action("view.zoomOut", t("menu.action.view.zoomOut"), undefined, undefined, "view.zoomOut")
  ]),
  menu(t("menu.group.window"), [
    action("tabs.next", t("menu.action.tabs.next"), "tabs.next"),
    action("tabs.previous", t("menu.action.tabs.previous"), "tabs.previous"),
    action("view.fullScreen", t("menu.action.view.fullScreen"), undefined, undefined, "view.fullScreen")
  ]),
  menu(t("menu.group.help"), [
    action("help.gettingHelp", t("menu.action.help.gettingHelp"), "help.gettingHelp"),
    action("app.about", t("menu.action.app.about"), "app.about")
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

  const available = new Set(registeredCommands.map(({ id }) => id));
  const quick = QUICK_COMMANDS.filter(({ commandId }) => commandId && available.has(commandId));
  const prefixes = new Set(["$", "4/4", ":", "@", "add-bar", "arpeggio", "brush", "export", "flow", "import",
    "insert-bars", "pickstroke", "slap-pop", "unset", "view", "voice", "wah", "x", "zoom"]);
  const advanced = ADVANCED_COMMANDS.filter(({ prefix }) => prefixes.has(prefix));

  if (parsed.mode === "action") {
    return filterEntries(flattenMenuActions(availableMenuGroups(available)), parsed.args);
  }

  if (parsed.mode === "expression") {
    return filterEntries(EXPRESSION_ENTRIES, parsed.args);
  }

  if (parsed.mode === "help" || input.trim() === "?") {
    return [...quick, ...advanced].sort(byPrefix);
  }

  const registeredEntries = registeredCommands.map((command) => ({
    prefix: command.label,
    description: command.category,
    kind: "registered" as const,
    commandId: command.id,
    aliases: [command.id, shortcutLabel(command.id, "win"), shortcutLabel(command.id, "mac")].filter(Boolean) as string[]
  }));

  return filterEntries([...quick, ...advanced, ...registeredEntries], input).sort(byPrefix);
}

export function paletteInputForEntry(entry: PaletteEntry): string {
  switch (entry.kind) {
    case "registered": return entry.commandId ?? entry.prefix;
    case "action": return `@ ${entry.prefix}`;
    case "expression": return `>${entry.prefix}`;
    default: return entry.prefix;
  }
}

export function commandUsage(input: string): string {
  const parsed = parsePaletteInput(input);
  const entry = paletteEntryByPrefix(parsed.prefix);

  if (parsed.mode === "action") {
    return t("palette.helpAction");
  }

  if (parsed.mode === "expression") {
    return t("palette.helpExpression");
  }

  if (parsed.mode === "section") {
    return t("palette.helpSection");
  }

  if (parsed.mode === "bar") {
    return t("palette.helpBar");
  }

  if (entry?.usage) {
    return t("palette.usage", { usage: entry.usage });
  }

  if (entry?.tabStops?.length) {
    return t("palette.options", { options: entry.tabStops.join(" > ") });
  }

  return t("palette.helpKeyboard");
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
