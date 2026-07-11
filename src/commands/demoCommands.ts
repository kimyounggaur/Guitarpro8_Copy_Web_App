import { getCommand, registerCommand } from "./registry";

interface DemoCommandState {
  lastMessage: string;
}

export function ensureDemoCommandsRegistered(): void {
  if (getCommand("app.about")) {
    return;
  }

  registerCommand<DemoCommandState>({
    id: "app.about",
    label: "About",
    category: "Application",
    execute: (state) => {
      state.lastMessage = "Guitar Pro Clone scaffold is running.";
    }
  });
}
