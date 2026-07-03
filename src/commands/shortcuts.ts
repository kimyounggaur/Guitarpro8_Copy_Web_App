import type { Command, CommandRegistry } from "./registry";

export type FocusScope = "global" | "workspace" | "dialog" | "palette";
export type Platform = "win" | "mac";

export interface ShortcutDispatchOptions<State> {
  registry: CommandRegistry<State>;
  state: State;
  scope: FocusScope;
  platform: Platform;
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

function parseShortcut(shortcut: string): ParsedShortcut {
  const parts = shortcut.split("+").map((part) => part.trim()).filter(Boolean);
  const parsed: ParsedShortcut = {
    ctrl: false,
    alt: false,
    shift: false,
    meta: false,
    key: ""
  };

  for (const part of parts) {
    const normalized = part.toLowerCase();
    const modifier = modifierMap.get(normalized);

    if (modifier) {
      parsed[modifier] = true;
    } else {
      parsed.key = part;
    }
  }

  return parsed;
}

function shortcutForPlatform(command: Command<unknown>, platform: Platform): string | undefined {
  return platform === "mac" ? command.shortcut?.mac : command.shortcut?.win;
}

function keyMatches(eventKey: string, shortcutKey: string): boolean {
  if (shortcutKey.length === 1) {
    return eventKey === shortcutKey || eventKey.toLowerCase() === shortcutKey.toLowerCase();
  }

  return eventKey.toLowerCase() === shortcutKey.toLowerCase();
}

export function isShortcutMatch(event: KeyboardEvent, shortcut: string): boolean {
  const parsed = parseShortcut(shortcut);

  return (
    event.ctrlKey === parsed.ctrl &&
    event.altKey === parsed.alt &&
    event.shiftKey === parsed.shift &&
    event.metaKey === parsed.meta &&
    keyMatches(event.key, parsed.key)
  );
}

export function dispatchShortcut<State>(
  event: KeyboardEvent,
  options: ShortcutDispatchOptions<State>
): boolean {
  const commands = options.registry.getAllCommands(options.state);

  for (const command of commands) {
    const shortcut = shortcutForPlatform(command as Command<unknown>, options.platform);

    if (shortcut && isShortcutMatch(event, shortcut)) {
      options.registry.executeCommand(command.id, options.state, {
        scope: options.scope,
        event
      });
      event.preventDefault();
      return true;
    }
  }

  return false;
}
