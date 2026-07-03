import { describe, expect, it } from "vitest";
import { CommandRegistry } from "./registry";

interface TestState {
  count: number;
  enabled: boolean;
}

describe("CommandRegistry", () => {
  it("registers and returns commands by id", () => {
    const registry = new CommandRegistry<TestState>();

    registry.registerCommand({
      id: "test.increment",
      label: "Increment",
      category: "Test",
      execute: (state) => {
        state.count += 1;
      }
    });

    expect(registry.getCommand("test.increment")?.label).toBe("Increment");
  });

  it("executes a registered command", () => {
    const registry = new CommandRegistry<TestState>();
    const state: TestState = { count: 0, enabled: true };

    registry.registerCommand({
      id: "test.increment",
      label: "Increment",
      category: "Test",
      execute: (currentState) => {
        currentState.count += 1;
      }
    });

    registry.executeCommand("test.increment", state);

    expect(state.count).toBe(1);
  });

  it("filters and blocks commands with contextPredicate", () => {
    const registry = new CommandRegistry<TestState>();
    const disabledState: TestState = { count: 0, enabled: false };

    registry.registerCommand({
      id: "test.guarded",
      label: "Guarded",
      category: "Test",
      contextPredicate: (state) => state.enabled,
      execute: (state) => {
        state.count += 1;
      }
    });

    expect(registry.getAllCommands(disabledState)).toHaveLength(0);
    expect(() => registry.executeCommand("test.guarded", disabledState)).toThrow(
      "Command is not available"
    );
  });
});
