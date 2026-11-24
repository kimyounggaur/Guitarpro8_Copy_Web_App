import { MENU_TREE, type MenuAction, type MenuGroup } from "./paletteCommands";

const implementedAppActions = new Set([
  "file.new", "file.open", "file.save", "file.saveAs", "file.import",
  "file.import.ascii", "file.import.musicxml", "file.import.midi", "file.export",
  "file.export.native", "file.export.ascii", "file.export.musicxml", "file.export.midi",
  "file.export.svg", "file.export.png", "file.export.pdf", "file.print",
  "track.add", "track.delete", "track.tuning", "voice.toggleMulti",
  "tools.commandPalette", "tools.chords", "tools.scales", "tools.transpose", "tools.cleanup",
  "tools.instrument", "panels.palette", "panels.songInspector", "panels.trackInspector",
  "panels.globalView", "panels.automation", "view.multitrack", "view.stylesheet",
  "view.zoomIn", "view.zoomOut"
]);

export function isMenuAppAction(id: string): boolean {
  return implementedAppActions.has(id);
}

export function availableMenuGroups(commandIds: ReadonlySet<string>, groups: MenuGroup[] = MENU_TREE): MenuGroup[] {
  return groups
    .map((group) => ({ ...group, actions: group.actions.filter((action) => menuActionAvailable(action, commandIds)) }))
    .filter(({ actions }) => actions.length > 0);
}

function menuActionAvailable(action: MenuAction, commandIds: ReadonlySet<string>): boolean {
  if (action.appAction && implementedAppActions.has(action.appAction)) return true;
  if (action.commandId) return commandIds.has(action.commandId);
  return /^(?:track\.(?:add|delete|tuning)|voice\.toggleMulti|view |\$ (?:next|previous)$|[@>]$)/
    .test(action.paletteInput ?? "");
}
