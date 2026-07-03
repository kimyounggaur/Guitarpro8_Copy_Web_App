import { useEffect, useMemo, useRef, useState } from "react";
import type { Command } from "../../commands/registry";
import {
  COMMAND_PALETTE_PLACEHOLDER,
  commandUsage,
  parsePaletteInput,
  suggestPaletteEntries,
  type PaletteEntry
} from "../../commands/paletteCommands";
import type { EditorCommandContext } from "../../commands/editingCommands";

export interface CommandPaletteResult {
  handled: boolean;
  message: string;
  keepOpen?: boolean;
}

interface CommandPaletteProps {
  open: boolean;
  initialValue: string;
  registeredCommands: Array<Command<EditorCommandContext>>;
  onClose: () => void;
  onSubmit: (input: string) => CommandPaletteResult;
}

export function CommandPalette({
  open,
  initialValue,
  registeredCommands,
  onClose,
  onSubmit
}: CommandPaletteProps) {
  const [value, setValue] = useState(initialValue);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [flowMode, setFlowMode] = useState(false);
  const [status, setStatus] = useState("Ready");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const suggestions = useMemo(
    () => suggestPaletteEntries(value, registeredCommands as Array<Command<unknown>>).slice(0, 12),
    [registeredCommands, value]
  );
  const usage = commandUsage(value);
  const preview = patternPreview(value);

  useEffect(() => {
    if (open) {
      setValue(initialValue);
      setSelectedIndex(0);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [initialValue, open]);

  useEffect(() => {
    setSelectedIndex(0);
    setHistoryIndex(null);
  }, [value]);

  if (!open) {
    return null;
  }

  function completeSuggestion(entry: PaletteEntry): void {
    const parsed = parsePaletteInput(value);

    if (entry.kind === "action") {
      setValue(`@ ${entry.prefix}`);
      return;
    }

    if (entry.kind === "expression") {
      setValue(`>${entry.prefix}`);
      return;
    }

    if (parsed.mode === "action") {
      setValue(`@ ${entry.prefix}`);
      return;
    }

    if (parsed.mode === "expression") {
      setValue(`>${entry.prefix}`);
      return;
    }

    setValue(entry.requiresArgument ? `${entry.prefix} ` : entry.prefix);
  }

  function run(input: string): void {
    const trimmed = input.trim();

    if (!trimmed && suggestions[0]) {
      completeSuggestion(suggestions[0]);
      return;
    }

    if (trimmed === "flow") {
      setFlowMode((enabled) => !enabled);
      setStatus(`Flow mode ${flowMode ? "off" : "on"}`);
      return;
    }

    const result = onSubmit(trimmed);
    setStatus(result.message);

    if (result.handled) {
      setHistory((items) => [trimmed, ...items.filter((item) => item !== trimmed)].slice(0, 20));

      if (!flowMode && !result.keepOpen) {
        onClose();
      } else {
        setValue("");
      }
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      const suggestion = suggestions[selectedIndex] ?? suggestions[0];

      if (suggestion) {
        completeSuggestion(suggestion);
      }
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      run(event.currentTarget.value);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();

      if (suggestions.length > 0) {
        setSelectedIndex((index) => (index + 1) % suggestions.length);
      }
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();

      if (history.length > 0) {
        const nextIndex = historyIndex === null ? 0 : Math.min(history.length - 1, historyIndex + 1);
        setHistoryIndex(nextIndex);
        setValue(history[nextIndex]);
      } else if (suggestions.length > 0) {
        setSelectedIndex((index) => (index - 1 + suggestions.length) % suggestions.length);
      }
    }
  }

  return (
    <section className="commandPalette" aria-label="Command palette">
      <div className="commandPaletteInputRow">
        <span className="commandPrompt">{parsePaletteInput(value).prefix}</span>
        <input
          ref={inputRef}
          value={value}
          placeholder={COMMAND_PALETTE_PLACEHOLDER}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button type="button" className={flowMode ? "activeToggle" : ""} onClick={() => setFlowMode((enabled) => !enabled)}>
          Flow
        </button>
        <button type="button" onClick={onClose} title="Close command palette">
          x
        </button>
      </div>
      <div className="commandSuggestionList">
        {suggestions.map((entry, index) => (
          <button
            key={`${entry.kind}-${entry.prefix}-${index}`}
            type="button"
            className={[
              "commandSuggestion",
              index === selectedIndex ? "selectedSuggestion" : "",
              entry.disabled ? "disabledSuggestion" : ""
            ].join(" ")}
            onClick={() => (entry.requiresArgument ? completeSuggestion(entry) : run(entry.kind === "action" ? `@ ${entry.prefix}` : entry.prefix))}
          >
            <strong>{entry.prefix}</strong>
            <span>{entry.description}</span>
            {entry.requiresArgument ? <em>↹</em> : null}
          </button>
        ))}
      </div>
      <div className="commandUsageBar">
        <strong>{status}</strong>
        <span>{usage}</span>
      </div>
      {preview ? <div className="commandPatternPreview">{preview}</div> : null}
    </section>
  );
}

function patternPreview(input: string): string | null {
  const trimmed = input.trim();
  const match = /^(pickstroke|arpeggio|brush|wah|slap-pop|slap pop pattern)\s+(.+)$/i.exec(trimmed);

  if (!match) {
    return null;
  }

  const [, prefix, pattern] = match;
  return `${prefix}: ${pattern
    .split("")
    .map((char) => (char === " " ? "rest" : char))
    .join(" | ")}`;
}
