export interface CommandShortcut {
  win: string;
  mac: string;
}

export interface Command<State = unknown> {
  id: string;
  label: string;
  category: string;
  shortcut?: CommandShortcut;
  contextPredicate?: (state: Readonly<State>) => boolean;
  execute: (state: State, args?: unknown) => void;
}

export class CommandRegistry<State = unknown> {
  private readonly commands = new Map<string, Command<State>>();

  registerCommand(command: Command<State>): void {
    if (this.commands.has(command.id)) {
      throw new Error(`Command already registered: ${command.id}`);
    }

    this.commands.set(command.id, command);
  }

  getCommand(id: string): Command<State> | undefined {
    return this.commands.get(id);
  }

  getAllCommands(state?: Readonly<State>): Command<State>[] {
    const commands = Array.from(this.commands.values()).sort((a, b) =>
      a.id.localeCompare(b.id)
    );

    if (state === undefined) {
      return commands;
    }

    return commands.filter((command) => command.contextPredicate?.(state) ?? true);
  }

  executeCommand(id: string, state: State, args?: unknown): void {
    const command = this.commands.get(id);

    if (!command) {
      throw new Error(`Unknown command: ${id}`);
    }

    if (command.contextPredicate && !command.contextPredicate(state)) {
      throw new Error(`Command is not available in the current context: ${id}`);
    }

    command.execute(state, args);
  }

  clear(): void {
    this.commands.clear();
  }
}

const globalRegistry = new CommandRegistry<unknown>();

export function registerCommand<State>(command: Command<State>): void {
  globalRegistry.registerCommand(command as Command<unknown>);
}

export function getCommand<State = unknown>(id: string): Command<State> | undefined {
  return globalRegistry.getCommand(id) as Command<State> | undefined;
}

export function getAllCommands<State = unknown>(state?: Readonly<State>): Command<State>[] {
  return globalRegistry.getAllCommands(state as Readonly<unknown> | undefined) as Command<State>[];
}

export function executeCommand<State>(id: string, state: State, args?: unknown): void {
  globalRegistry.executeCommand(id, state, args);
}
