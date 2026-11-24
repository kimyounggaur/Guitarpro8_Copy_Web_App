import { t } from "../ui/i18n/messages.en";
import type { DisplayMode } from "../model/types";
import type { PanelVisibility } from "../store/preferencesStore";
import { getCommand } from "./registry";
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
  "view.zoomIn", "view.zoomOut", "help.gettingHelp"
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

export interface MenuState {
  panelVisibility: PanelVisibility;
  displayMode: DisplayMode;
  multiTrackView?: boolean;
}

export interface MenuSlotAction {
  id: string;
  label: string;
  onSelect: () => void;
  disabledReason?: string;
}

export interface MenuSlots {
  recent?: MenuSlotAction[];
  imports?: MenuSlotAction[];
  exports?: MenuSlotAction[];
  help?: MenuSlotAction[];
}

export interface MenuItem {
  id: string;
  label: string;
  action?: MenuAction;
  onSelect?: () => void;
  disabledReason?: string;
  checked?: boolean;
  children?: MenuItem[];
}

const panelKeys: Record<string, keyof PanelVisibility> = {
  "panels.palette": "palette",
  "panels.songInspector": "songInspector",
  "panels.trackInspector": "trackInspector",
  "panels.globalView": "globalView",
  "panels.automation": "automationView"
};

function checkedState(action: MenuAction, state: MenuState): boolean | undefined {
  const panel = panelKeys[action.id];
  if (panel) return state.panelVisibility[panel];
  if (action.id === "view.multitrack") return state.multiTrackView;
  if (action.paletteInput?.startsWith("view ")) return action.paletteInput === `view ${state.displayMode}`;
}

/** Shares MENU_TREE and the existing dispatcher with the palette; nesting is presentation only. */
export function desktopMenuGroups(commandIds: ReadonlySet<string>, state: MenuState, slots: MenuSlots = {}) {
  const order = ["file", "edit", "track", "bar", "note", "effects", "section", "tools", "view", "sound", "window", "help"] as const;
  return order.flatMap(key => {
    const group = MENU_TREE.find(group => group.name === t(`menu.group.${key}`));
    if (!group) return [];
    const items: MenuItem[] = [];
    for (const action of group.actions) {
      const available = menuActionAvailable(action, commandIds);
      const registered = action.commandId && getCommand(action.commandId);
      if (!available && !registered && key !== "help") continue;
      const item: MenuItem = {
        id: action.id, label: action.label, action, checked: checkedState(action, state),
        disabledReason: available ? undefined : registered ? "Unavailable in the current selection." : "Unavailable in this editor."
      };
      if (key === "file" && /^file\.(import|export)\./.test(action.id)) {
        const parent = items.find(candidate => action.id.startsWith(candidate.id + ".") && candidate.children);
        if (parent?.children) {
          parent.children.push(item);
          continue;
        }
      }
      if (action.id === "file.import" || action.id === "file.export") item.children = [];
      items.push(item);
      if (action.id === "file.open" && slots.recent?.length) {
        items.push({ id: "file.recent", label: t("recentFiles"), children: [...slots.recent] });
      }
    }
    if (key === "file") {
      items.find(item => item.id === "file.import")?.children?.push(...slots.imports ?? []);
      items.find(item => item.id === "file.export")?.children?.push(...slots.exports ?? []);
    }
    if (key === "help") items.push(...slots.help ?? []);
    return items.length ? [{ name: group.name, items }] : [];
  });
}
